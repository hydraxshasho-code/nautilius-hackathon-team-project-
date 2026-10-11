import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { auth } from './firebase';

export interface CredentialsStatus {
  passkeys: Array<{
    id: string;
    deviceName: string;
    createdAt: string;
    lastUsedAt: string;
    revoked: boolean;
  }>;
  mfaTotp: {
    enrolled: boolean;
    enrolledAt: string | null;
  };
  recoveryCodes: {
    total: number;
    remaining: number;
  };
  activeSessions: Array<{
    sessionPrefix: string;
    userId: string;
    role: string;
    factors: string[];
    createdAt: number;
    lastPrivilegedAuth: number;
    expiresAt: number;
    ipAddress: string;
    userAgent: string;
  }>;
}

export interface MfaSetupData {
  secret: string;
  otpauthUrl: string;
  qrSvg: string;
  recoveryCodes: string[];
}

export class MfaPasskeyClient {
  private activeSessionToken: string | null = null;

  constructor() {
    // Defense-in-depth: Never persist privileged credentials in browser localStorage/sessionStorage
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('oceaniq_priv_session');
        localStorage.removeItem('oceaniq_priv_session');
      } catch {
        // ignore
      }
    }
  }

  public setSessionToken(token: string | null) {
    this.activeSessionToken = token;
  }

  public getSessionToken(): string | null {
    return this.activeSessionToken;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.activeSessionToken) {
      headers['X-Privileged-Session'] = this.activeSessionToken;
    }
    if (auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${idToken}`;
      } catch {
        // ignore
      }
    }
    return headers;
  }

  public isWebAuthnSupported(): boolean {
    return typeof window !== 'undefined' && browserSupportsWebAuthn();
  }

  public async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isWebAuthnSupported()) return false;
    try {
      return await platformAuthenticatorIsAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Perform WebAuthn Passkey Authentication (Login / Elevation)
   */
  public async loginWithPasskey(tempToken?: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isWebAuthnSupported()) {
      return { success: false, error: 'WebAuthn passkeys are not supported on this browser or platform.' };
    }

    try {
      // 1. Fetch challenge and options from server
      const headers = await this.getAuthHeaders();
      const optionsRes = await fetch('/api/auth/webauthn/login-options', {
        method: 'POST',
        headers,
        body: JSON.stringify({ tempToken, userId }),
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json().catch(() => ({}));
        return { success: false, error: err.error || 'Failed to request passkey challenge' };
      }

      const options = await optionsRes.json();

      // 2. Trigger browser passkey ceremony
      const authResponse = await startAuthentication({ optionsJSON: options });

      // 3. Verify response with server
      const verifyRes = await fetch('/api/auth/webauthn/login-verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tempToken,
          userId,
          response: authResponse,
        }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      if (verifyRes.ok && verifyData.success) {
        if (verifyData.sessionToken) {
          this.setSessionToken(verifyData.sessionToken);
        }
        return { success: true };
      }

      return { success: false, error: verifyData.error || 'Passkey verification failed' };
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        return { success: false, error: 'Passkey ceremony was cancelled or timed out.' };
      }
      return { success: false, error: err.message || 'Passkey authentication error' };
    }
  }

  /**
   * Register a new Passkey
   */
  public async registerPasskey(deviceName: string): Promise<{ success: boolean; error?: string; passkeyId?: string }> {
    if (!this.isWebAuthnSupported()) {
      return { success: false, error: 'WebAuthn passkeys are not supported on this device/browser.' };
    }

    try {
      const headers = await this.getAuthHeaders();
      // 1. Fetch registration options
      const optionsRes = await fetch('/api/auth/webauthn/register-options', {
        method: 'POST',
        headers,
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json().catch(() => ({}));
        return { success: false, error: err.error || 'Failed to initialize passkey registration' };
      }

      const options = await optionsRes.json();

      // 2. Trigger browser credential creation
      const regResponse = await startRegistration({ optionsJSON: options });

      // 3. Send to server for verification and storage
      const verifyRes = await fetch('/api/auth/webauthn/register-verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          response: regResponse,
          deviceName,
        }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      if (verifyRes.ok && verifyData.success) {
        return { success: true, passkeyId: verifyData.passkeyId };
      }

      return { success: false, error: verifyData.error || 'Failed to verify passkey registration' };
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        return { success: false, error: 'Passkey registration cancelled by user.' };
      }
      return { success: false, error: err.message || 'Passkey registration error' };
    }
  }

  /**
   * Verify TOTP code during Super Admin login
   */
  public async verifyMfaTotp(token: string, tempToken?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ token, tempToken }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (data.sessionToken) {
          this.setSessionToken(data.sessionToken);
        }
        return { success: true };
      }

      return { success: false, error: data.error || 'Invalid authenticator code' };
    } catch (err: any) {
      return { success: false, error: err.message || 'MFA verification failed' };
    }
  }

  /**
   * Verify recovery code during login
   */
  public async verifyRecoveryCode(code: string, tempToken?: string): Promise<{ success: boolean; error?: string; remainingCodes?: number }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/auth/mfa/recovery', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code, tempToken }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (data.sessionToken) {
          this.setSessionToken(data.sessionToken);
        }
        return { success: true, remainingCodes: data.remainingCodes };
      }

      return { success: false, error: data.error || 'Invalid recovery code' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Recovery code verification failed' };
    }
  }

  /**
   * Initialize MFA TOTP setup
   */
  public async setupMfaInit(): Promise<{ success: boolean; data?: MfaSetupData; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/auth/mfa/setup-init', {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, data };
      }
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Failed to initialize MFA setup' };
    } catch (err: any) {
      return { success: false, error: err.message || 'MFA initialization error' };
    }
  }

  /**
   * Confirm MFA TOTP setup with initial OTP code
   */
  public async setupMfaConfirm(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/auth/mfa/setup-confirm', {
        method: 'POST',
        headers,
        body: JSON.stringify({ token }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid 6-digit confirmation code' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Confirmation failed' };
    }
  }

  /**
   * Fetch credentials and MFA status
   */
  public async getCredentialsStatus(): Promise<CredentialsStatus | null> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/auth/credentials/status', {
        method: 'GET',
        headers,
      });

      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Revoke a registered passkey
   */
  public async revokePasskey(passkeyId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/auth/credentials/revoke-passkey', {
        method: 'POST',
        headers,
        body: JSON.stringify({ passkeyId }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to revoke passkey' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Revocation error' };
    }
  }

  /**
   * Revoke a session
   */
  public async revokeSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/auth/credentials/revoke-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to revoke session' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Session revocation error' };
    }
  }

  /**
   * Disable MFA
   */
  public async disableMfa(): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/auth/credentials/disable-mfa', {
        method: 'POST',
        headers,
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to disable MFA' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error disabling MFA' };
    }
  }
}

export const mfaPasskeyClient = new MfaPasskeyClient();
