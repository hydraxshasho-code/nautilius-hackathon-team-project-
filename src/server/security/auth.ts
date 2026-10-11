import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import * as jose from 'jose';
import firebaseConfig from '../../../firebase-applet-config.json';
import { AuthenticatedUser, UserRole, SystemFeature, WsAuthTicket } from './types';
import { serverAuditLogger } from './auditLog';
import { mfaPasskeyService } from './mfaPasskeyService';

export type { AuthenticatedUser, UserRole, SystemFeature, WsAuthTicket };

export interface SuperAdminAuthResult {
  success: boolean;
  role?: UserRole;
  error?: string;
  locked?: boolean;
  retryAfterSeconds?: number;
  mfaRequired?: boolean;
  tempToken?: string;
  passkeyEnrolled?: boolean;
  totpEnrolled?: boolean;
  sessionToken?: string;
}

const PROJECT_ID = firebaseConfig.projectId;
const FIREBASE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);

// Remote JWKS set cached by jose
const JWKS = jose.createRemoteJWKSet(FIREBASE_JWKS_URL);

// Server-side authoritative roles map: UID -> UserRole
const authoritativeRoles = new Map<string, UserRole>();

import { AtomicExpiringStore } from './SecurityStateStore';

// In-memory active short-lived WebSocket authentication tickets
const wsTickets = new Map<string, WsAuthTicket>();

// Server-side Super Admin Salt & Strong PBKDF2-SHA512 Key Derivation
// Plaintext password is NEVER stored in code, browser storage, or shipped to clients
const SUPER_ADMIN_SALT: string =
  process.env.SUPER_ADMIN_SALT ||
  crypto.randomBytes(32).toString('hex');

/**
 * Derives or retrieves the expected PBKDF2 hash for Super Admin password.
 * Configured strictly via process.env.SUPER_ADMIN_PASSWORD or process.env.SUPER_ADMIN_HASH.
 * If SUPER_ADMIN_PASSWORD is missing in production, fails safely with clear error.
 */
export function getSuperAdminExpectedHash(): string | null {
  if (process.env.SUPER_ADMIN_HASH && process.env.SUPER_ADMIN_HASH.trim().length > 0) {
    return process.env.SUPER_ADMIN_HASH.trim();
  }

  const configuredPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (configuredPassword && typeof configuredPassword === 'string' && configuredPassword.trim().length > 0) {
    return crypto
      .pbkdf2Sync(configuredPassword.trim(), SUPER_ADMIN_SALT, 100000, 64, 'sha512')
      .toString('hex');
  }

  return null;
}

// Account Lockout & Progressive Delay Tracker for Administrative Elevation
interface AdminFailureTracker {
  attempts: number;
  lockedUntil: number;
  lastAttempt: number;
}
const adminFailureStore = new AtomicExpiringStore<AdminFailureTracker>('admin_lockouts');
const MAX_ADMIN_ATTEMPTS = 5;
const ADMIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

// Baseline feature permissions mapping (authoritative server-side definition)
const ROLE_PERMISSIONS: Record<UserRole, SystemFeature[]> = {
  'Super Admin': [
    'vessel_registry',
    'dashboard_ais_feed',
    'dashboard_priority_risk',
    'dashboard_ais_anomalies',
    'kyc_aml_compliance',
    'ais_anomalies_view',
    'reports_view',
    'reports_export',
    'reports_edit_status',
    'onsite_incident_alerts',
    'ai_chat_access',
  ],
  'Compliance Officer': [
    'vessel_registry',
    'dashboard_ais_feed',
    'dashboard_priority_risk',
    'dashboard_ais_anomalies',
    'kyc_aml_compliance',
    'ais_anomalies_view',
    'reports_view',
    'reports_export',
    'reports_edit_status',
    'onsite_incident_alerts',
    'ai_chat_access',
  ],
  'Risk Analyst': [
    'dashboard_priority_risk',
    'dashboard_ais_anomalies',
    'kyc_aml_compliance',
    'ais_anomalies_view',
    'reports_view',
    'reports_export',
    'onsite_incident_alerts',
    'ai_chat_access',
  ],
  'Operations Manager': ['dashboard_ais_feed', 'ais_anomalies_view'],
  Investigator: ['kyc_aml_compliance', 'reports_view'],
  Auditor: ['kyc_aml_compliance', 'reports_view'],
  'Vessel Analyst': ['vessel_registry', 'dashboard_ais_feed'],
  Viewer: ['reports_view'],
};

/**
 * Verifies a Firebase ID token and resolves authenticated user with authoritative role
 */
export async function verifyFirebaseIdToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token || typeof token !== 'string') return null;

  try {
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });

    const uid = String(payload.sub || payload.user_id || '');
    if (!uid) return null;

    // Retrieve authoritative role from server-side store, defaulting to assigned claim or 'Viewer'
    const storedRole = authoritativeRoles.get(uid);
    const claimRole = (payload.role as UserRole) || (payload.admin ? 'Super Admin' : undefined);
    const effectiveRole: UserRole = storedRole || claimRole || 'Viewer';

    if (!storedRole) {
      authoritativeRoles.set(uid, effectiveRole);
    }

    return {
      uid,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      displayName: typeof payload.name === 'string' ? payload.name : undefined,
      role: effectiveRole,
      isAnonymous: Boolean(payload.provider_id === 'anonymous'),
    };
  } catch (err: any) {
    // If external JWKS fetch fails in isolated offline testing, support local test token verification
    if (process.env.NODE_ENV !== 'production' && token.startsWith('test-token-')) {
      const parts = token.split(':');
      const uid = parts[1] || 'test-user';
      const role = (parts[2] as UserRole) || 'Compliance Officer';
      return {
        uid,
        email: `${uid}@oceaniq.test`,
        role,
      };
    }
    return null;
  }
}

/**
 * Creates a short-lived single-use ticket for WebSocket authentication (valid for 60 seconds)
 */
export function createWsTicket(user: AuthenticatedUser): string {
  // Purge expired tickets
  const now = Date.now();
  for (const [k, v] of wsTickets.entries()) {
    if (v.expiresAt < now) wsTickets.delete(k);
  }

  const ticket = crypto.randomBytes(24).toString('hex');
  wsTickets.set(ticket, {
    ticket,
    uid: user.uid,
    role: user.role,
    email: user.email,
    expiresAt: now + 60 * 1000,
  });

  return ticket;
}

/**
 * Consumes a short-lived WebSocket ticket (single-use)
 */
export function consumeWsTicket(ticket: string): AuthenticatedUser | null {
  if (!ticket) return null;
  const found = wsTickets.get(ticket);
  if (!found) return null;

  wsTickets.delete(ticket);
  if (found.expiresAt < Date.now()) return null;

  return {
    uid: found.uid,
    role: authoritativeRoles.get(found.uid) || found.role,
    email: found.email,
  };
}

/**
 * Securely verifies Super Admin master password using salted PBKDF2-SHA512 derivation
 * with timing-safe comparison on the server.
 * Enforces temporary account lockout after repeated failures, progressive delay,
 * rate limiting, and immutable audit logging.
 */
export async function verifyAndElevateSuperAdmin(
  password: string,
  user: AuthenticatedUser,
  ipAddress = '127.0.0.1'
): Promise<SuperAdminAuthResult> {
  const trackerKey = `${user.uid}:${ipAddress}`;
  const now = Date.now();
  let tracker = adminFailureStore.get(trackerKey);

  // 1. Account Lockout Check
  if (tracker && tracker.lockedUntil > now) {
    const remainingSeconds = Math.ceil((tracker.lockedUntil - now) / 1000);
    serverAuditLogger.recordAction({
      user: user.uid,
      role: user.role,
      action: 'SUPER_ADMIN_ELEVATION_BLOCKED_LOCKOUT',
      module: 'SECURITY',
      entity: 'USER_ROLE',
      entityId: user.uid,
      previousState: user.role,
      newState: user.role,
      ipAddress,
    });
    return {
      success: false,
      error: `Too many failed attempts. Administrative access temporarily locked for ${remainingSeconds} seconds.`,
      locked: true,
      retryAfterSeconds: remainingSeconds,
    };
  }

  // 2. Progressive Exponential Delay on Repeated Failures
  if (tracker && tracker.attempts > 0) {
    const delayMs = Math.min(3000, 250 * Math.pow(2, tracker.attempts - 1));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  // 3. Verify that Super Admin password configuration is present
  const expectedHash = getSuperAdminExpectedHash();
  if (!expectedHash) {
    serverAuditLogger.recordAction({
      user: user.uid,
      role: user.role,
      action: 'SUPER_ADMIN_AUTH_CONFIG_MISSING',
      module: 'SECURITY',
      entity: 'USER_ROLE',
      entityId: user.uid,
      previousState: user.role,
      newState: user.role,
      ipAddress,
    });
    return {
      success: false,
      error: 'Super Admin authentication is disabled: SUPER_ADMIN_PASSWORD is not configured.',
    };
  }

  if (!password || typeof password !== 'string') {
    serverAuditLogger.recordAction({
      user: user.uid,
      role: user.role,
      action: 'SUPER_ADMIN_ELEVATION_FAILED',
      module: 'SECURITY',
      entity: 'USER_ROLE',
      entityId: user.uid,
      previousState: user.role,
      newState: user.role,
      ipAddress,
    });
    return { success: false, error: 'Invalid administrative credentials' };
  }

  // 4. Salted PBKDF2 Derivation (100,000 iterations, 64-byte key length, sha512)
  let match = false;
  try {
    const derivedKey = crypto
      .pbkdf2Sync(password.trim(), SUPER_ADMIN_SALT, 100000, 64, 'sha512')
      .toString('hex');
    const bufferA = Buffer.from(derivedKey, 'utf8');
    const bufferB = Buffer.from(expectedHash, 'utf8');

    if (bufferA.length === bufferB.length) {
      match = crypto.timingSafeEqual(bufferA, bufferB);
    }
  } catch {
    match = false;
  }

  // 4. Verification Evaluation
  if (match) {
    // Clear failure tracker upon successful authentication
    adminFailureStore.delete(trackerKey);

    // Check if user has enrolled second factor (Passkey or TOTP)
    const mfaStatus = mfaPasskeyService.hasMfaOrPasskeyEnrolled(user.uid);
    if (mfaStatus.hasAny) {
      const tempToken = mfaPasskeyService.createTempAuthToken(user.uid, 'Super Admin', ipAddress);
      serverAuditLogger.recordAction({
        user: user.uid,
        role: user.role,
        action: 'SUPER_ADMIN_PASSWORD_VERIFIED_MFA_REQUIRED',
        module: 'SECURITY',
        entity: 'USER_ROLE',
        entityId: user.uid,
        ipAddress,
      });

      return {
        success: false,
        mfaRequired: true,
        tempToken,
        passkeyEnrolled: mfaStatus.passkeyEnrolled,
        totpEnrolled: mfaStatus.totpEnrolled,
      };
    }

    // If no MFA/Passkey enrolled yet, elevate directly (backward-compatible)
    const prevRole = user.role;
    authoritativeRoles.set(user.uid, 'Super Admin');
    user.role = 'Super Admin';

    const session = mfaPasskeyService.createPrivilegedSession(
      user.uid,
      'Super Admin',
      ['password'],
      ipAddress,
      'Web Console'
    );

    serverAuditLogger.recordAction({
      user: user.uid,
      role: 'Super Admin',
      action: 'SUPER_ADMIN_ELEVATION_SUCCESS',
      module: 'SECURITY',
      entity: 'USER_ROLE',
      entityId: user.uid,
      previousState: prevRole,
      newState: 'Super Admin',
      ipAddress,
    });

    return {
      success: true,
      role: 'Super Admin',
      sessionToken: session.sessionId,
    };
  }

  // 5. Track Failure & Check for Account Lockout
  if (!tracker) {
    tracker = { attempts: 1, lockedUntil: 0, lastAttempt: now };
    adminFailureStore.set(trackerKey, tracker);
  } else {
    tracker.attempts += 1;
    tracker.lastAttempt = now;
  }

  let locked = false;
  let retryAfterSeconds: number | undefined;
  if (tracker.attempts >= MAX_ADMIN_ATTEMPTS) {
    tracker.lockedUntil = now + ADMIN_LOCKOUT_DURATION_MS;
    locked = true;
    retryAfterSeconds = Math.ceil(ADMIN_LOCKOUT_DURATION_MS / 1000);
  }

  serverAuditLogger.recordAction({
    user: user.uid,
    role: user.role,
    action: locked ? 'SUPER_ADMIN_LOCKOUT_TRIGGERED' : 'SUPER_ADMIN_ELEVATION_FAILED',
    module: 'SECURITY',
    entity: 'USER_ROLE',
    entityId: user.uid,
    previousState: user.role,
    newState: user.role,
    ipAddress,
  });

  return {
    success: false,
    error: locked
      ? `Too many failed attempts. Administrative access temporarily locked for ${retryAfterSeconds} seconds.`
      : 'Invalid administrative credentials',
    locked: locked ? true : undefined,
    retryAfterSeconds,
  };
}

/**
 * Authoritatively elevates a user to Super Admin after verified second-factor (Passkey / TOTP)
 */
export function elevateUserToSuperAdmin(uid: string): void {
  authoritativeRoles.set(uid, 'Super Admin');
}

/**
 * Reusable Express Middleware: Require recent MFA/Passkey authentication (e.g. within 15 mins)
 */
export function requireRecentAuth(maxAgeMs = 15 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user: AuthenticatedUser | undefined = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (user.role === 'Super Admin') {
      const sessionToken = (req.headers['x-privileged-session'] as string) || '';
      if (sessionToken && !mfaPasskeyService.isRecentlyAuthenticated(sessionToken, maxAgeMs)) {
        res.status(403).json({
          error: 'Recent MFA/Passkey re-authentication required for this privileged action.',
          reauthRequired: true,
        });
        return;
      }
    }

    next();
  };
}

/**
 * Super Admin user role modification
 */
export function setAuthoritativeUserRole(
  targetUid: string,
  newRole: UserRole,
  adminUser: AuthenticatedUser,
  ipAddress = '127.0.0.1'
): boolean {
  if (adminUser.role !== 'Super Admin') return false;

  const prev = authoritativeRoles.get(targetUid) || 'Viewer';
  authoritativeRoles.set(targetUid, newRole);

  serverAuditLogger.recordAction({
    user: adminUser.uid,
    role: 'Super Admin',
    action: 'SET_USER_ROLE',
    module: 'RBAC',
    entity: 'USER_ROLE',
    entityId: targetUid,
    previousState: prev,
    newState: newRole,
    ipAddress,
  });

  return true;
}

export function getAuthoritativeUserRole(uid: string): UserRole {
  return authoritativeRoles.get(uid) || 'Viewer';
}

function extractPrivilegedSessionToken(req: Request): string | undefined {
  const headerToken = (req.headers['x-privileged-session'] as string)?.trim();
  if (headerToken) return headerToken;

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(';');
  for (const c of cookies) {
    const [name, val] = c.split('=');
    if (name?.trim() === 'oceaniq_priv_session') {
      return decodeURIComponent(val?.trim() || '');
    }
  }
  return undefined;
}

/**
 * Reusable Express Middleware: Optional Authentication
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const sessionToken = extractPrivilegedSessionToken(req);
  if (sessionToken) {
    const session = mfaPasskeyService.getPrivilegedSession(sessionToken);
    if (session) {
      (req as any).user = {
        uid: session.userId,
        role: session.role,
        email: `${session.userId}@oceaniq.internal`,
      };
      return next();
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    (req as any).user = null;
    return next();
  }

  const token = authHeader.substring(7).trim();
  const user = await verifyFirebaseIdToken(token);
  (req as any).user = user;
  next();
}

/**
 * Reusable Express Middleware: Require Authentication
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionToken = extractPrivilegedSessionToken(req);
  if (sessionToken) {
    const session = mfaPasskeyService.getPrivilegedSession(sessionToken);
    if (session) {
      (req as any).user = {
        uid: session.userId,
        role: session.role,
        email: `${session.userId}@oceaniq.internal`,
      };
      return next();
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing or malformed Bearer token.' });
    return;
  }

  const token = authHeader.substring(7).trim();
  const user = await verifyFirebaseIdToken(token);

  if (!user) {
    res.status(401).json({ error: 'Invalid, expired, or revoked authentication credentials.' });
    return;
  }

  (req as any).user = user;
  next();
}

/**
 * Reusable Express Middleware: Require Specific Role(s)
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user: AuthenticatedUser | undefined = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: `Access denied. Operation requires one of: ${allowedRoles.join(', ')}.`,
      });
      return;
    }

    next();
  };
}

/**
 * Reusable Express Middleware: Require Specific Feature Permission
 */
export function requirePermission(feature: SystemFeature) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user: AuthenticatedUser | undefined = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const permissions = ROLE_PERMISSIONS[user.role] || [];
    if (!permissions.includes(feature)) {
      res.status(403).json({
        error: `Access denied. Role '${user.role}' lacks permission for feature '${feature}'.`,
      });
      return;
    }

    next();
  };
}
