import { UserRole } from '../types/maritime';
import { rbacService } from './rbacService';
import { auth } from './firebase';

export interface TemporaryProfileSession {
  sessionId: string;
  userId: string;
  baseRole: UserRole;
  activeProfile: UserRole;
  switchedAt: number;
  expiresAt: number;
  durationMinutes: number;
  reason: string;
  requiresReauth: boolean;
  reauthenticated: boolean;
}

const STORAGE_KEY_SESSION = 'nautilus_active_profile_session';
const STORAGE_KEY_BASE_ROLE = 'nautilus_base_role';

type ProfileChangeListener = (profile: UserRole, session: TemporaryProfileSession | null) => void;

class ProfileSwitchService {
  private baseRole: UserRole = 'Viewer';
  private activeProfile: UserRole = 'Viewer';
  private currentSession: TemporaryProfileSession | null = null;
  private listeners: Set<ProfileChangeListener> = new Set();
  private expiryTimer: any = null;

  constructor() {
    this.loadState();
    this.startExpiryCheck();
  }

  private loadState(): void {
    try {
      const storedBase = localStorage.getItem(STORAGE_KEY_BASE_ROLE) as UserRole | null;
      if (storedBase && storedBase !== 'Super Admin') {
        this.baseRole = storedBase;
      } else {
        this.baseRole = 'Viewer';
      }

      const storedSession = localStorage.getItem(STORAGE_KEY_SESSION);
      if (storedSession) {
        const session: TemporaryProfileSession = JSON.parse(storedSession);
        const now = Date.now();
        if (session.expiresAt && session.expiresAt > now && session.activeProfile !== 'Super Admin') {
          this.currentSession = session;
          this.activeProfile = session.activeProfile;
          this.baseRole = session.baseRole || this.baseRole;
        } else {
          // Expired or unverified privileged session
          this.clearSession(false);
          this.activeProfile = this.baseRole;
        }
      } else {
        this.activeProfile = this.baseRole;
      }
    } catch {
      this.baseRole = 'Viewer';
      this.activeProfile = 'Viewer';
    }
  }

  private startExpiryCheck(): void {
    if (typeof window === 'undefined') return;
    if (this.expiryTimer) clearInterval(this.expiryTimer);

    this.expiryTimer = setInterval(() => {
      if (this.currentSession && Date.now() >= this.currentSession.expiresAt) {
        this.handleSessionExpiry();
      }
    }, 2000);
  }

  private handleSessionExpiry(): void {
    if (!this.currentSession) return;
    const expiredSession = this.currentSession;
    const previous = expiredSession.activeProfile;
    const revertTo = expiredSession.baseRole;

    this.clearSession(true);
    this.activeProfile = revertTo;

    // Record audit event for session expiration
    rbacService.logAuditAction({
      user: expiredSession.userId || 'operator',
      role: revertTo,
      action: 'TEMPORARY_PROFILE_EXPIRED',
      module: 'SECURITY',
      entity: 'USER_PROFILE',
      entityId: expiredSession.userId || 'operator',
      previousState: `Active Profile: ${previous}`,
      newState: `Reverted to Base Role: ${revertTo}`,
    });

    this.notifyListeners();
  }

  private clearSession(notify = true): void {
    this.currentSession = null;
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION);
    } catch {
      // ignore
    }
    if (notify) {
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.activeProfile, this.currentSession);
      } catch (err) {
        console.error('Error in profile change listener:', err);
      }
    }
  }

  public getActiveProfile(): UserRole {
    // Check expiry inline
    if (this.currentSession && Date.now() >= this.currentSession.expiresAt) {
      this.handleSessionExpiry();
    }
    return this.activeProfile;
  }

  public getBaseRole(): UserRole {
    return this.baseRole;
  }

  public setBaseRole(role: UserRole): void {
    if (role === 'Super Admin') {
      console.warn('[ProfileSwitchService] Unauthorized attempt to set baseRole to Super Admin without master credentials');
      return;
    }
    this.baseRole = role;
    try {
      localStorage.setItem(STORAGE_KEY_BASE_ROLE, role);
    } catch {
      // ignore
    }
    if (!this.currentSession) {
      this.activeProfile = role;
      this.notifyListeners();
    }
  }

  public getSession(): TemporaryProfileSession | null {
    if (this.currentSession && Date.now() >= this.currentSession.expiresAt) {
      this.handleSessionExpiry();
      return null;
    }
    return this.currentSession;
  }

  public isTemporaryActive(): boolean {
    return Boolean(this.getSession());
  }

  public getTimeRemainingSeconds(): number {
    const session = this.getSession();
    if (!session) return 0;
    return Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
  }

  /**
   * Request a secure profile switch with centralized authorization and audit logging.
   */
  public async switchProfile(
    targetProfile: UserRole,
    options?: {
      reason?: string;
      durationMinutes?: number;
      password?: string;
    }
  ): Promise<{
    success: boolean;
    activeProfile: UserRole;
    mfaRequired?: boolean;
    tempToken?: string;
    error?: string;
  }> {
    const currentUser = auth.currentUser;
    const userId = currentUser?.uid || currentUser?.email || 'local-operator';
    const durationMinutes = options?.durationMinutes || 60;
    const reason = options?.reason?.trim() || 'Operational maritime task assignment';
    const previous = this.activeProfile;

    // 1. If target is already active, return success
    if (targetProfile === this.activeProfile && !this.currentSession) {
      return { success: true, activeProfile: targetProfile };
    }

    // 2. If target is Super Admin, require credentials verification
    if (targetProfile === 'Super Admin') {
      if (!options?.password) {
        return {
          success: false,
          activeProfile: this.activeProfile,
          error: 'Super Admin credentials required for privilege elevation.',
        };
      }

      const credRes = await rbacService.verifySuperAdminCredentials(options.password);
      if (credRes.mfaRequired) {
        return {
          success: false,
          activeProfile: this.activeProfile,
          mfaRequired: true,
          tempToken: credRes.tempToken,
          error: 'Second-factor authentication required.',
        };
      }

      if (!credRes.success) {
        return {
          success: false,
          activeProfile: this.activeProfile,
          error: credRes.error || 'Invalid Super Admin credentials.',
        };
      }
    }

    // 3. Create temporary profile session
    const switchedAt = Date.now();
    const expiresAt = switchedAt + durationMinutes * 60 * 1000;
    const sessionId = `switch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newSession: TemporaryProfileSession = {
      sessionId,
      userId,
      baseRole: this.baseRole,
      activeProfile: targetProfile,
      switchedAt,
      expiresAt,
      durationMinutes,
      reason,
      requiresReauth: targetProfile === 'Super Admin',
      reauthenticated: true,
    };

    this.currentSession = newSession;
    this.activeProfile = targetProfile;

    try {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(newSession));
    } catch {
      // ignore
    }

    // 4. Centralized audit logging (local + server sync)
    rbacService.logAuditAction({
      user: userId,
      role: targetProfile,
      action: 'PROFILE_SWITCH_SUCCESS',
      module: 'SECURITY',
      entity: 'USER_PROFILE',
      entityId: userId,
      previousState: `Active: ${previous} (Base: ${this.baseRole})`,
      newState: `Active: ${targetProfile} (Duration: ${durationMinutes}m, Reason: ${reason})`,
    });

    // Notify server of profile switch event
    this.syncProfileSwitchWithServer(newSession).catch(() => {});

    // 5. Notify all UI subscribers
    this.notifyListeners();

    return { success: true, activeProfile: targetProfile };
  }

  /**
   * Reverts current active profile back to baseline identity role.
   */
  public async revertToBaseRole(reason?: string): Promise<{ success: boolean; activeProfile: UserRole }> {
    const previous = this.activeProfile;
    const userId = auth.currentUser?.uid || 'local-operator';
    const revertTo = this.baseRole;

    this.clearSession(false);
    this.activeProfile = revertTo;

    rbacService.logAuditAction({
      user: userId,
      role: revertTo,
      action: 'PROFILE_REVERT_TO_BASE',
      module: 'SECURITY',
      entity: 'USER_PROFILE',
      entityId: userId,
      previousState: `Active: ${previous}`,
      newState: `Reverted to Base: ${revertTo}${reason ? ` (${reason})` : ''}`,
    });

    this.syncProfileRevertWithServer().catch(() => {});
    this.notifyListeners();

    return { success: true, activeProfile: revertTo };
  }

  private async syncProfileSwitchWithServer(session: TemporaryProfileSession): Promise<void> {
    try {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      await fetch('/api/auth/profile-switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetProfile: session.activeProfile,
          baseRole: session.baseRole,
          durationMinutes: session.durationMinutes,
          reason: session.reason,
          sessionId: session.sessionId,
        }),
      });
    } catch {
      // Offline / server fallback resilience
    }
  }

  private async syncProfileRevertWithServer(): Promise<void> {
    try {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      await fetch('/api/auth/profile-revert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          baseRole: this.baseRole,
        }),
      });
    } catch {
      // Offline resilience
    }
  }

  public subscribe(listener: ProfileChangeListener): () => void {
    this.listeners.add(listener);
    // Immediately call listener with current state
    try {
      listener(this.activeProfile, this.currentSession);
    } catch {
      // ignore
    }

    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const profileSwitchService = new ProfileSwitchService();
