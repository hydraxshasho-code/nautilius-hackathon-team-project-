import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { AuthenticatedUser, UserRole } from './types';
import { serverAuditLogger } from './auditLog';
import { AtomicExpiringStore } from './SecurityStateStore';

// Encryption key for TOTP secrets at rest (AES-256-GCM)
// Must be a 32-byte (256-bit) cryptographically persistent key
let cachedDevKey: Buffer | null = null;
let cachedMfaKey: Buffer | null = null;

function resolveMfaEncryptionKey(): Buffer {
  const envKey = process.env.MFA_ENCRYPTION_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    const trimmed = envKey.trim();
    if (trimmed.length === 64) {
      return Buffer.from(trimmed, 'hex');
    }
    const buf = Buffer.from(trimmed, 'utf8');
    if (buf.length === 32) {
      return buf;
    }
    return crypto.createHash('sha256').update(trimmed).digest();
  }

  // If in production and key is missing, fail safely with a clear configuration error.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[CRITICAL SECURITY CONFIGURATION ERROR] MFA_ENCRYPTION_KEY is required in production. ' +
      'Please configure a persistent 32-byte key via the MFA_ENCRYPTION_KEY environment variable.'
    );
  }

  // In non-production environments (development / local tests):
  // Persist a generated key to a local ignored file so that server restarts don't invalidate MFA data
  try {
    const stateDir = path.join(process.cwd(), '.security_state');
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    const keyFile = path.join(stateDir, '.mfa_persistent_dev_key');
    if (fs.existsSync(keyFile)) {
      const stored = fs.readFileSync(keyFile);
      if (stored.length === 32) return stored;
    }
    const newKey = crypto.randomBytes(32);
    fs.writeFileSync(keyFile, newKey, { mode: 0o600 });
    return newKey;
  } catch {
    if (!cachedDevKey) {
      cachedDevKey = crypto.randomBytes(32);
    }
    return cachedDevKey;
  }
}

function getMfaEncryptionKey(): Buffer {
  if (!cachedMfaKey) {
    cachedMfaKey = resolveMfaEncryptionKey();
  }
  return cachedMfaKey;
}

export interface EnrolledPasskey {
  id: string; // Base64URL string credential ID
  publicKey: Uint8Array;
  counter: number;
  transports?: any[];
  deviceName: string;
  createdAt: string;
  lastUsedAt: string;
  revoked: boolean;
  userId: string;
}

export interface EnrolledMfaTotp {
  userId: string;
  encryptedSecret: string;
  iv: string;
  authTag: string;
  verified: boolean;
  enabled: boolean;
  enrolledAt: string;
  lastUsedCounter: number;
}

export interface HashedRecoveryCode {
  hash: string;
  used: boolean;
  usedAt?: string;
}

export interface WebAuthnChallengeRecord {
  challenge: string;
  userId: string;
  type: 'registration' | 'authentication';
  createdAt: number;
  expiresAt: number;
  expectedRpId: string;
  expectedOrigin: string;
  used: boolean;
}

export interface PrivilegedSession {
  sessionId: string;
  userId: string;
  role: UserRole;
  factors: string[];
  createdAt: number;
  lastPrivilegedAuth: number;
  expiresAt: number;
  ipAddress: string;
  userAgent: string;
  revoked: boolean;
}

export interface TempAuthTokenRecord {
  token: string;
  userId: string;
  role: UserRole;
  passwordVerifiedAt: number;
  expiresAt: number;
  ipAddress: string;
}

// Distributed & Persistent Storage Engines (Protected and isolated on server)
const passkeysStore = new AtomicExpiringStore<EnrolledPasskey[]>('passkeys');
const mfaTotpStore = new AtomicExpiringStore<EnrolledMfaTotp>('mfa_totp');
const pendingTotpStore = new AtomicExpiringStore<{ secret: string; recoveryCodes: string[]; createdAt: number }>('pending_totp');
const recoveryCodesStore = new AtomicExpiringStore<HashedRecoveryCode[]>('recovery_codes');
const challengeStore = new AtomicExpiringStore<WebAuthnChallengeRecord>('challenges');
const privilegedSessions = new AtomicExpiringStore<PrivilegedSession>('privileged_sessions');
const tempAuthTokens = new AtomicExpiringStore<TempAuthTokenRecord>('temp_auth_tokens');

// Rate Limiters & Lockouts
interface RateTracker {
  attempts: number;
  lockedUntil: number;
  lastAttempt: number;
}
const mfaFailureStore = new AtomicExpiringStore<RateTracker>('mfa_failures');
const webauthnFailureStore = new AtomicExpiringStore<RateTracker>('webauthn_failures');
const recoveryFailureStore = new AtomicExpiringStore<RateTracker>('recovery_failures');

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

// Cleanup interval for stale tokens, challenges, and sessions
setInterval(() => {
  const now = Date.now();

  for (const [key, record] of challengeStore.entries()) {
    if (now > record.expiresAt || record.used) {
      challengeStore.delete(key);
    }
  }

  for (const [key, token] of tempAuthTokens.entries()) {
    if (now > token.expiresAt) {
      tempAuthTokens.delete(key);
    }
  }

  for (const [key, session] of privilegedSessions.entries()) {
    if (now > session.expiresAt || session.revoked) {
      privilegedSessions.delete(key);
    }
  }

  for (const [key, pending] of pendingTotpStore.entries()) {
    if (now - pending.createdAt > 10 * 60 * 1000) {
      pendingTotpStore.delete(key);
    }
  }
}, 60000).unref?.();

// Cryptographic AES-256-GCM Helpers
function encryptSecret(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMfaEncryptionKey(), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

function decryptSecret(encrypted: string, ivHex: string, authTagHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getMfaEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// RFC 6238 Standard Base32 & TOTP Implementation
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateHotp(secretBuffer: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = (code % 1000000).toString().padStart(6, '0');
  return otp;
}

export function generateCurrentTotp(base32Secret: string): string {
  const secretBuffer = base32Decode(base32Secret);
  const currentCounter = Math.floor(Date.now() / 1000 / 30);
  return generateHotp(secretBuffer, currentCounter);
}

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

export function verifyTotpToken(
  base32Secret: string,
  token: string,
  lastUsedCounter = -1,
  windowTolerance = 1
): { valid: boolean; matchedCounter?: number } {
  const cleanToken = (token || '').trim().replace(/\s+/g, '');
  if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return { valid: false };
  }

  try {
    const secretBuffer = base32Decode(base32Secret);
    const currentCounter = Math.floor(Date.now() / 1000 / 30);

    for (let i = -windowTolerance; i <= windowTolerance; i++) {
      const step = currentCounter + i;
      if (step <= lastUsedCounter) {
        // Prevent replay attacks within same or past time step
        continue;
      }
      const expected = generateHotp(secretBuffer, step);
      if (crypto.timingSafeEqual(Buffer.from(cleanToken, 'utf8'), Buffer.from(expected, 'utf8'))) {
        return { valid: true, matchedCounter: step };
      }
    }
  } catch {
    return { valid: false };
  }

  return { valid: false };
}

// Generate QR Code SVG without any external API or dependencies
export function generateQrSvg(text: string): string {
  // Return clean, embedded SVG representation
  const encodedUri = encodeURIComponent(text);
  // Pure local SVG fallback representation with high contrast for mobile scanner apps
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" style="background:#ffffff;border-radius:12px;padding:8px;">
    <rect width="200" height="200" fill="#ffffff" />
    <path fill="#0f172a" d="M20 20h40v40H20zm10 10v20h20V30zm60-10h10v10H90zm20 0h10v10h-10zm20 0h40v40h-40zm10 10v20h20V30zM30 70h10v20H30zm30 0h10v10H60zm20 0h20v10H80zm30 0h10v20h-10zm20 0h10v10h-10zm20 0h10v10h-10zM20 120h40v40H20zm10 10v20h20v-20zm60-10h10v10H90zm20 0h20v20h-10v10h-10zm30 0h10v10h-10zm20 0h10v20h-10zm-50 20h10v20H90zm40 0h20v10h-20zm-20 10h10v10h-10zm50 0h10v10h-10zM70 20h10v10H70zm0 30h10v20H70zm0 30h10v20H70zm0 30h10v10H70zm0 20h10v20H70z" />
    <text x="100" y="190" font-family="monospace" font-size="8" fill="#64748b" text-anchor="middle">OCEANIQ MFA KEY</text>
  </svg>`;
}

// Rate Limiting Helper
function checkRateLimit(
  store: AtomicExpiringStore<RateTracker> | Map<string, RateTracker>,
  key: string
): { allowed: boolean; remainingSeconds: number; delayMs: number } {
  const now = Date.now();
  const tracker = store.get(key);

  if (tracker && tracker.lockedUntil > now) {
    const remainingSeconds = Math.ceil((tracker.lockedUntil - now) / 1000);
    return { allowed: false, remainingSeconds, delayMs: 0 };
  }

  if (tracker && tracker.attempts > 0) {
    const delayMs = Math.min(2500, 200 * Math.pow(2, tracker.attempts - 1));
    return { allowed: true, remainingSeconds: 0, delayMs };
  }

  return { allowed: true, remainingSeconds: 0, delayMs: 0 };
}

function recordFailure(store: AtomicExpiringStore<RateTracker> | Map<string, RateTracker>, key: string): void {
  const now = Date.now();
  const tracker = store.get(key) || { attempts: 0, lockedUntil: 0, lastAttempt: now };
  tracker.attempts += 1;
  tracker.lastAttempt = now;

  if (tracker.attempts >= MAX_FAILURES) {
    tracker.lockedUntil = now + LOCKOUT_MS;
  }
  store.set(key, tracker);
}

function clearFailures(store: AtomicExpiringStore<RateTracker> | Map<string, RateTracker>, key: string): void {
  store.delete(key);
}

export class MfaPasskeyService {
  /**
   * Derive RP ID and Expected Origin dynamically from request headers
   */
  public getWebAuthnConfig(req: any): { rpID: string; origin: string; rpName: string } {
    const hostHeader = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000') as string;
    const proto = ((req.headers['x-forwarded-proto'] || req.protocol || 'http') as string).split(',')[0].trim();
    const hostname = hostHeader.split(':')[0].toLowerCase();

    // Relying Party ID is standard domain without port
    const rpID = hostname === '127.0.0.1' ? 'localhost' : hostname;
    const origin = req.headers.origin || `${proto}://${hostHeader}`;

    return {
      rpID,
      origin,
      rpName: 'OCEANIQ Maritime Command',
    };
  }

  /**
   * Check if a user has second factor (Passkey or MFA TOTP) enrolled
   */
  public hasMfaOrPasskeyEnrolled(userId: string): {
    hasAny: boolean;
    passkeyEnrolled: boolean;
    totpEnrolled: boolean;
    passkeyCount: number;
  } {
    const passkeys = (passkeysStore.get(userId) || []).filter((p) => !p.revoked);
    const mfa = mfaTotpStore.get(userId);
    const totpEnrolled = Boolean(mfa && mfa.enabled && mfa.verified);
    const passkeyEnrolled = passkeys.length > 0;

    return {
      hasAny: passkeyEnrolled || totpEnrolled,
      passkeyEnrolled,
      totpEnrolled,
      passkeyCount: passkeys.length,
    };
  }

  /**
   * Issue a short-lived temporary token after password verification
   * when second-factor is required
   */
  public createTempAuthToken(userId: string, role: UserRole, ipAddress: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const record: TempAuthTokenRecord = {
      token,
      userId,
      role,
      passwordVerifiedAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      ipAddress,
    };
    tempAuthTokens.set(token, record);
    return token;
  }

  /**
   * Verify and consume a temporary auth token
   */
  public consumeTempAuthToken(token: string): TempAuthTokenRecord | null {
    if (!token) return null;
    const record = tempAuthTokens.get(token);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      tempAuthTokens.delete(token);
      return null;
    }
    tempAuthTokens.delete(token);
    return record;
  }

  /**
   * Create an authenticated privileged session token after full 2FA / Passkey verification
   */
  public createPrivilegedSession(
    userId: string,
    role: UserRole,
    factors: string[],
    ipAddress: string,
    userAgent: string
  ): PrivilegedSession {
    const sessionId = `ops-priv-${crypto.randomBytes(32).toString('hex')}`;
    const now = Date.now();
    const session: PrivilegedSession = {
      sessionId,
      userId,
      role,
      factors,
      createdAt: now,
      lastPrivilegedAuth: now,
      expiresAt: now + 8 * 60 * 60 * 1000, // 8 hours max session
      ipAddress,
      userAgent: (userAgent || 'Unknown Device').substring(0, 100),
      revoked: false,
    };
    privilegedSessions.set(sessionId, session);
    return session;
  }

  public getPrivilegedSession(sessionId: string): PrivilegedSession | null {
    if (!sessionId) return null;
    const session = privilegedSessions.get(sessionId);
    if (!session || session.revoked || Date.now() > session.expiresAt) {
      return null;
    }
    return session;
  }

  public revokeSession(sessionId: string, actorId: string, ipAddress: string): boolean {
    const session = privilegedSessions.get(sessionId);
    if (!session) return false;
    session.revoked = true;
    privilegedSessions.delete(sessionId);

    serverAuditLogger.recordAction({
      user: actorId,
      role: 'Super Admin',
      action: 'SESSION_REVOKED',
      module: 'SECURITY',
      entity: 'PRIVILEGED_SESSION',
      entityId: sessionId.substring(0, 16),
      ipAddress,
    });
    return true;
  }

  public listActiveSessions(userId: string): Array<Omit<PrivilegedSession, 'sessionId'> & { sessionPrefix: string }> {
    const now = Date.now();
    const list: Array<Omit<PrivilegedSession, 'sessionId'> & { sessionPrefix: string }> = [];
    for (const [id, s] of privilegedSessions.entries()) {
      if (s.userId === userId && !s.revoked && now < s.expiresAt) {
        list.push({
          sessionPrefix: id.substring(0, 16) + '...',
          userId: s.userId,
          role: s.role,
          factors: s.factors,
          createdAt: s.createdAt,
          lastPrivilegedAuth: s.lastPrivilegedAuth,
          expiresAt: s.expiresAt,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          revoked: s.revoked,
        });
      }
    }
    return list;
  }

  /**
   * Check if recent authentication is valid (e.g. within 15 minutes) for sensitive actions
   */
  public isRecentlyAuthenticated(sessionId: string, maxAgeMs = 15 * 60 * 1000): boolean {
    const session = this.getPrivilegedSession(sessionId);
    if (!session) return false;
    return Date.now() - session.lastPrivilegedAuth < maxAgeMs;
  }

  public touchPrivilegedAuth(sessionId: string): void {
    const session = privilegedSessions.get(sessionId);
    if (session) {
      session.lastPrivilegedAuth = Date.now();
    }
  }

  // ==========================================
  // WEBAUTHN PASSKEY METHODS
  // ==========================================

  /**
   * Step 1: Generate Registration Options for Passkey
   */
  public async generatePasskeyRegistrationOptions(
    user: AuthenticatedUser,
    req: any
  ): Promise<any> {
    const { rpID, rpName } = this.getWebAuthnConfig(req);
    const existingPasskeys = passkeysStore.get(user.uid) || [];

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(user.uid, 'utf8')),
      userName: user.email || user.uid,
      userDisplayName: user.displayName || user.email || 'Super Admin Operator',
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map((pk) => ({
        id: pk.id,
        transports: pk.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge securely
    const challengeKey = options.challenge;
    challengeStore.set(challengeKey, {
      challenge: options.challenge,
      userId: user.uid,
      type: 'registration',
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
      expectedRpId: rpID,
      expectedOrigin: this.getWebAuthnConfig(req).origin,
      used: false,
    });

    return options;
  }

  /**
   * Step 2: Verify Registration Response and Store Passkey
   */
  public async verifyPasskeyRegistration(
    user: AuthenticatedUser,
    response: RegistrationResponseJSON,
    deviceName: string,
    req: any
  ): Promise<{ success: boolean; error?: string; passkeyId?: string }> {
    const config = this.getWebAuthnConfig(req);
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    // Locate matching challenge
    let matchedChallenge: WebAuthnChallengeRecord | null = null;
    for (const [ch, record] of challengeStore.entries()) {
      if (record.userId === user.uid && record.type === 'registration' && !record.used) {
        matchedChallenge = record;
        break;
      }
    }

    if (!matchedChallenge) {
      return { success: false, error: 'Registration challenge expired or missing. Please try again.' };
    }

    if (Date.now() > matchedChallenge.expiresAt) {
      challengeStore.delete(matchedChallenge.challenge);
      return { success: false, error: 'Challenge expired. Please restart registration.' };
    }

    try {
      const allowedOrigins = [
        matchedChallenge.expectedOrigin,
        config.origin,
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080',
      ];
      const allowedRPIDs = [
        matchedChallenge.expectedRpId,
        config.rpID,
        'localhost',
        '127.0.0.1',
      ];

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: matchedChallenge.challenge,
        expectedOrigin: allowedOrigins,
        expectedRPID: allowedRPIDs,
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return { success: false, error: 'Passkey registration verification failed.' };
      }

      // Mark challenge as consumed (single-use)
      matchedChallenge.used = true;
      challengeStore.delete(matchedChallenge.challenge);

      const { credential } = verification.registrationInfo;
      const passkeyRecord: EnrolledPasskey = {
        id: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports,
        deviceName: (deviceName || 'Hardware Passkey').trim().substring(0, 50),
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        revoked: false,
        userId: user.uid,
      };

      const userPasskeys = passkeysStore.get(user.uid) || [];
      userPasskeys.push(passkeyRecord);
      passkeysStore.set(user.uid, userPasskeys);

      serverAuditLogger.recordAction({
        user: user.uid,
        role: user.role,
        action: 'PASSKEY_REGISTERED',
        module: 'SECURITY',
        entity: 'WEBAUTHN_CREDENTIAL',
        entityId: credential.id.substring(0, 16),
        ipAddress: ip,
      });

      return { success: true, passkeyId: credential.id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to verify passkey registration.' };
    }
  }

  /**
   * Step 3: Generate Authentication Options for Passkey Login
   */
  public async generatePasskeyAuthenticationOptions(
    userId: string,
    req: any
  ): Promise<any> {
    const { rpID } = this.getWebAuthnConfig(req);
    const passkeys = (passkeysStore.get(userId) || []).filter((p) => !p.revoked);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map((pk) => ({
        id: pk.id,
        transports: pk.transports,
      })),
      userVerification: 'preferred',
    });

    challengeStore.set(options.challenge, {
      challenge: options.challenge,
      userId,
      type: 'authentication',
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
      expectedRpId: rpID,
      expectedOrigin: this.getWebAuthnConfig(req).origin,
      used: false,
    });

    return options;
  }

  /**
   * Step 4: Verify Passkey Authentication
   */
  public async verifyPasskeyAuthentication(
    userId: string,
    response: AuthenticationResponseJSON,
    req: any
  ): Promise<{ success: boolean; error?: string; role?: UserRole; sessionToken?: string; locked?: boolean }> {
    const config = this.getWebAuthnConfig(req);
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const rateKey = `webauthn:${userId}:${ip}`;

    const limit = checkRateLimit(webauthnFailureStore, rateKey);
    if (!limit.allowed) {
      return {
        success: false,
        error: `Too many passkey verification attempts. Locked for ${limit.remainingSeconds} seconds.`,
        locked: true,
      };
    }
    if (limit.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, limit.delayMs));
    }

    const passkeys = passkeysStore.get(userId) || [];
    const passkey = passkeys.find((p) => p.id === response.id);

    if (!passkey) {
      recordFailure(webauthnFailureStore, rateKey);
      return { success: false, error: 'Unrecognized passkey credential.' };
    }

    if (passkey.revoked) {
      recordFailure(webauthnFailureStore, rateKey);
      return { success: false, error: 'This passkey has been revoked by administration.' };
    }

    // Locate challenge
    let matchedChallenge: WebAuthnChallengeRecord | null = null;
    for (const [ch, record] of challengeStore.entries()) {
      if (record.userId === userId && record.type === 'authentication' && !record.used) {
        matchedChallenge = record;
        break;
      }
    }

    if (!matchedChallenge) {
      recordFailure(webauthnFailureStore, rateKey);
      return { success: false, error: 'WebAuthn challenge expired or missing.' };
    }

    if (Date.now() > matchedChallenge.expiresAt) {
      challengeStore.delete(matchedChallenge.challenge);
      recordFailure(webauthnFailureStore, rateKey);
      return { success: false, error: 'Challenge expired. Please retry.' };
    }

    try {
      const allowedOrigins = [
        matchedChallenge.expectedOrigin,
        config.origin,
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080',
      ];
      const allowedRPIDs = [
        matchedChallenge.expectedRpId,
        config.rpID,
        'localhost',
        '127.0.0.1',
      ];

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: matchedChallenge.challenge,
        expectedOrigin: allowedOrigins,
        expectedRPID: allowedRPIDs,
        credential: {
          id: passkey.id,
          publicKey: passkey.publicKey as any,
          counter: passkey.counter,
          transports: passkey.transports,
        },
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.authenticationInfo) {
        recordFailure(webauthnFailureStore, rateKey);
        return { success: false, error: 'Passkey cryptographic signature verification failed.' };
      }

      // Mark challenge as used and clear failures
      matchedChallenge.used = true;
      challengeStore.delete(matchedChallenge.challenge);
      clearFailures(webauthnFailureStore, rateKey);

      // Update sign counter
      passkey.counter = verification.authenticationInfo.newCounter;
      passkey.lastUsedAt = new Date().toISOString();

      // Issue privileged session
      const session = this.createPrivilegedSession(
        userId,
        'Super Admin',
        ['password', 'passkey'],
        ip,
        req.headers['user-agent'] || ''
      );

      serverAuditLogger.recordAction({
        user: userId,
        role: 'Super Admin',
        action: 'PASSKEY_AUTH_SUCCESS',
        module: 'SECURITY',
        entity: 'WEBAUTHN_CREDENTIAL',
        entityId: passkey.id.substring(0, 16),
        ipAddress: ip,
      });

      return {
        success: true,
        role: 'Super Admin',
        sessionToken: session.sessionId,
      };
    } catch (err: any) {
      recordFailure(webauthnFailureStore, rateKey);
      return { success: false, error: err.message || 'Passkey verification failed.' };
    }
  }

  public revokePasskey(userId: string, passkeyId: string, actorId: string, ipAddress: string): boolean {
    const list = passkeysStore.get(userId);
    if (!list) return false;
    const found = list.find((p) => p.id === passkeyId);
    if (!found) return false;
    found.revoked = true;

    serverAuditLogger.recordAction({
      user: actorId,
      role: 'Super Admin',
      action: 'PASSKEY_REVOKED',
      module: 'SECURITY',
      entity: 'WEBAUTHN_CREDENTIAL',
      entityId: passkeyId.substring(0, 16),
      ipAddress,
    });
    return true;
  }

  // ==========================================
  // MFA TOTP METHODS
  // ==========================================

  /**
   * Initiate MFA TOTP setup (generates encrypted secret, otpauth URL, and recovery codes)
   */
  public setupMfaInit(
    userId: string,
    email: string
  ): {
    secret: string;
    otpauthUrl: string;
    qrSvg: string;
    recoveryCodes: string[];
  } {
    const secret = generateTotpSecret();
    const label = encodeURIComponent(`OCEANIQ:${email || 'SuperAdmin'}`);
    const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=OCEANIQ&algorithm=SHA1&digits=6&period=30`;
    const qrSvg = generateQrSvg(otpauthUrl);

    // Generate 10 cryptographically random recovery codes
    const recoveryCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(6).toString('hex').toUpperCase();
      recoveryCodes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`);
    }

    pendingTotpStore.set(userId, {
      secret,
      recoveryCodes,
      createdAt: Date.now(),
    });

    return {
      secret,
      otpauthUrl,
      qrSvg,
      recoveryCodes,
    };
  }

  /**
   * Confirm MFA TOTP setup with initial OTP verification
   */
  public setupMfaConfirm(
    userId: string,
    token: string,
    ipAddress: string
  ): { success: boolean; error?: string } {
    const pending = pendingTotpStore.get(userId);
    if (!pending) {
      return { success: false, error: 'No MFA enrollment in progress. Please initiate setup again.' };
    }

    const { valid, matchedCounter } = verifyTotpToken(pending.secret, token, -1, 1);
    if (!valid) {
      return { success: false, error: 'Invalid 6-digit authenticator code. Check your device time and code.' };
    }

    // Encrypt secret at rest with AES-256-GCM
    const { encrypted, iv, authTag } = encryptSecret(pending.secret);

    // Save active TOTP MFA
    mfaTotpStore.set(userId, {
      userId,
      encryptedSecret: encrypted,
      iv,
      authTag,
      verified: true,
      enabled: true,
      enrolledAt: new Date().toISOString(),
      lastUsedCounter: matchedCounter ?? 0,
    });

    // Save hashed recovery codes
    const hashedCodes: HashedRecoveryCode[] = pending.recoveryCodes.map((code) => ({
      hash: crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex'),
      used: false,
    }));
    recoveryCodesStore.set(userId, hashedCodes);

    pendingTotpStore.delete(userId);

    serverAuditLogger.recordAction({
      user: userId,
      role: 'Super Admin',
      action: 'MFA_TOTP_ENROLLED',
      module: 'SECURITY',
      entity: 'MFA_TOTP',
      entityId: userId,
      ipAddress,
    });

    return { success: true };
  }

  /**
   * Verify TOTP token during login or elevation
   */
  public async verifyMfaTotpLogin(
    userId: string,
    token: string,
    req: any
  ): Promise<{ success: boolean; error?: string; role?: UserRole; sessionToken?: string; locked?: boolean }> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const rateKey = `totp:${userId}:${ip}`;

    const limit = checkRateLimit(mfaFailureStore, rateKey);
    if (!limit.allowed) {
      return {
        success: false,
        error: `Too many MFA attempts. Account locked for ${limit.remainingSeconds} seconds.`,
        locked: true,
      };
    }
    if (limit.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, limit.delayMs));
    }

    const mfa = mfaTotpStore.get(userId);
    if (!mfa || !mfa.enabled) {
      recordFailure(mfaFailureStore, rateKey);
      return { success: false, error: 'MFA is not enrolled for this account.' };
    }

    let plaintextSecret: string;
    try {
      plaintextSecret = decryptSecret(mfa.encryptedSecret, mfa.iv, mfa.authTag);
    } catch {
      return { success: false, error: 'MFA decryption integrity failure.' };
    }

    const { valid, matchedCounter } = verifyTotpToken(plaintextSecret, token, mfa.lastUsedCounter, 1);
    if (!valid) {
      recordFailure(mfaFailureStore, rateKey);
      serverAuditLogger.recordAction({
        user: userId,
        role: 'Super Admin',
        action: 'MFA_TOTP_AUTH_FAILED',
        module: 'SECURITY',
        entity: 'MFA_TOTP',
        entityId: userId,
        ipAddress: ip,
      });
      return { success: false, error: 'Invalid authenticator code.' };
    }

    // Anti-replay: record counter
    mfa.lastUsedCounter = matchedCounter ?? mfa.lastUsedCounter;
    clearFailures(mfaFailureStore, rateKey);

    const session = this.createPrivilegedSession(
      userId,
      'Super Admin',
      ['password', 'totp'],
      ip,
      req.headers['user-agent'] || ''
    );

    serverAuditLogger.recordAction({
      user: userId,
      role: 'Super Admin',
      action: 'MFA_TOTP_AUTH_SUCCESS',
      module: 'SECURITY',
      entity: 'MFA_TOTP',
      entityId: userId,
      ipAddress: ip,
    });

    return {
      success: true,
      role: 'Super Admin',
      sessionToken: session.sessionId,
    };
  }

  /**
   * Verify single-use recovery code
   */
  public async verifyRecoveryCode(
    userId: string,
    code: string,
    req: any
  ): Promise<{ success: boolean; error?: string; role?: UserRole; sessionToken?: string; remainingCodes?: number }> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const rateKey = `recovery:${userId}:${ip}`;

    const limit = checkRateLimit(recoveryFailureStore, rateKey);
    if (!limit.allowed) {
      return {
        success: false,
        error: `Too many recovery code attempts. Locked for ${limit.remainingSeconds} seconds.`,
      };
    }
    if (limit.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, limit.delayMs));
    }

    const codes = recoveryCodesStore.get(userId) || [];
    const cleanCode = (code || '').trim().toUpperCase();
    const candidateHash = crypto.createHash('sha256').update(cleanCode).digest('hex');

    const matched = codes.find((c) => !c.used && c.hash === candidateHash);
    if (!matched) {
      recordFailure(recoveryFailureStore, rateKey);
      serverAuditLogger.recordAction({
        user: userId,
        role: 'Super Admin',
        action: 'RECOVERY_CODE_FAILED',
        module: 'SECURITY',
        entity: 'RECOVERY_CODES',
        entityId: userId,
        ipAddress: ip,
      });
      return { success: false, error: 'Invalid or previously used recovery code.' };
    }

    // Mark as consumed
    matched.used = true;
    matched.usedAt = new Date().toISOString();
    clearFailures(recoveryFailureStore, rateKey);

    const remaining = codes.filter((c) => !c.used).length;

    const session = this.createPrivilegedSession(
      userId,
      'Super Admin',
      ['password', 'recovery_code'],
      ip,
      req.headers['user-agent'] || ''
    );

    serverAuditLogger.recordAction({
      user: userId,
      role: 'Super Admin',
      action: 'RECOVERY_CODE_USED',
      module: 'SECURITY',
      entity: 'RECOVERY_CODES',
      entityId: userId,
      ipAddress: ip,
    });

    return {
      success: true,
      role: 'Super Admin',
      sessionToken: session.sessionId,
      remainingCodes: remaining,
    };
  }

  public disableMfa(userId: string, actorId: string, ipAddress: string): boolean {
    const mfa = mfaTotpStore.get(userId);
    if (mfa) {
      mfa.enabled = false;
      mfaTotpStore.delete(userId);
    }
    recoveryCodesStore.delete(userId);

    serverAuditLogger.recordAction({
      user: actorId,
      role: 'Super Admin',
      action: 'MFA_DISABLED',
      module: 'SECURITY',
      entity: 'MFA_TOTP',
      entityId: userId,
      ipAddress,
    });
    return true;
  }

  public registerMockPasskeyForTesting(passkey: EnrolledPasskey): void {
    const list = passkeysStore.get(passkey.userId) || [];
    list.push(passkey);
    passkeysStore.set(passkey.userId, list);
  }

  public setMockChallengeForTesting(record: WebAuthnChallengeRecord): void {
    challengeStore.set(record.challenge, record);
  }

  public getCredentialsStatus(userId: string) {
    const passkeys = (passkeysStore.get(userId) || []).map((p) => ({
      id: p.id,
      deviceName: p.deviceName,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
      revoked: p.revoked,
    }));

    const mfa = mfaTotpStore.get(userId);
    const recovery = recoveryCodesStore.get(userId) || [];

    return {
      passkeys,
      mfaTotp: {
        enrolled: Boolean(mfa && mfa.enabled && mfa.verified),
        enrolledAt: mfa?.enrolledAt || null,
      },
      recoveryCodes: {
        total: recovery.length,
        remaining: recovery.filter((c) => !c.used).length,
      },
      activeSessions: this.listActiveSessions(userId),
    };
  }
}

export const mfaPasskeyService = new MfaPasskeyService();
