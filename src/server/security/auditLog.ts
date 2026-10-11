import crypto from 'crypto';
import { ServerAuditLogEntry, UserRole } from './types';
import { securityAuditService, SecurityAuthEventType } from './SecurityAuditService';

const AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || crypto.randomBytes(32).toString('hex');

class ServerAuditLogger {
  private logs: ServerAuditLogEntry[] = [];
  private readonly maxLogs: number = 1000;

  constructor() {
    // Seed initial operational startup log
    this.recordAction({
      user: 'SYSTEM_BOOT',
      role: 'Super Admin',
      action: 'SERVER_BOOTSTRAP',
      module: 'SECURITY',
      entity: 'SECURITY_SUBSYSTEM',
      entityId: 'ROOT',
      previousState: 'INITIALIZING',
      newState: 'ARMED_AND_ACTIVE',
      ipAddress: '127.0.0.1',
    });
  }

  private computeIntegrityHash(entry: Omit<ServerAuditLogEntry, 'integrityHash'>): string {
    const canonical = `${entry.id}|${entry.timestamp}|${entry.user}|${entry.role}|${entry.action}|${entry.entity}|${entry.entityId}|${entry.ipAddress}`;
    return crypto.createHmac('sha256', AUDIT_HMAC_SECRET).update(canonical).digest('hex');
  }

  public recordAction(params: {
    user: string;
    role: UserRole;
    action: string;
    module: string;
    entity: string;
    entityId: string;
    previousState?: string;
    newState?: string;
    ipAddress?: string;
  }): ServerAuditLogEntry {
    const entryWithoutHash: Omit<ServerAuditLogEntry, 'integrityHash'> = {
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
      user: params.user || 'anonymous',
      role: params.role || 'Viewer',
      action: params.action,
      module: params.module,
      entity: params.entity,
      entityId: params.entityId,
      previousState: params.previousState,
      newState: params.newState,
      ipAddress: params.ipAddress || '127.0.0.1',
    };

    const integrityHash = this.computeIntegrityHash(entryWithoutHash);
    const fullEntry: ServerAuditLogEntry = {
      ...entryWithoutHash,
      integrityHash,
    };

    this.logs.unshift(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Capture and persist authentication-related events into the cryptographic audit trail
    try {
      const act = params.action ? params.action.toUpperCase() : '';
      if (
        act.includes('MFA') ||
        act.includes('LOCKOUT') ||
        act.includes('ELEVATION') ||
        act.includes('ROLE') ||
        act.includes('AUTH') ||
        act.includes('PASSKEY')
      ) {
        let type: SecurityAuthEventType = 'ACCESS_ANOMALY';
        if (act.includes('MFA') && (act.includes('FAIL') || act.includes('BLOCKED') || act.includes('DENIED'))) {
          type = 'MFA_FAILED';
        } else if (act.includes('MFA') && act.includes('SUCCESS')) {
          type = 'MFA_SUCCESS';
        } else if (act.includes('MFA') && act.includes('ENROLL')) {
          type = 'MFA_ENROLLED';
        } else if (act.includes('MFA') && act.includes('DISABLE')) {
          type = 'MFA_DISABLED';
        } else if (act.includes('LOCKOUT')) {
          type = 'ACCOUNT_LOCKED';
        } else if (act.includes('ELEVATION_FAILED')) {
          type = 'PASSWORD_ELEVATION_FAILED';
        } else if (act.includes('ELEVATION_SUCCESS') || act.includes('ELEVATED')) {
          type = 'PASSWORD_ELEVATION_SUCCESS';
        } else if (act.includes('PROFILE_SWITCH') || act.includes('ROLE_SWITCH')) {
          type = 'ROLE_SWITCH';
        } else if (act.includes('PROFILE_REVERT') || act.includes('ROLE_REVERT')) {
          type = 'ROLE_REVERT';
        } else if (act.includes('ROLE_MODIFIED') || act.includes('USER_ROLE')) {
          type = 'ROLE_MODIFIED';
        } else if (act.includes('PASSKEY') && (act.includes('ENROLL') || act.includes('REGISTER'))) {
          type = 'PASSKEY_REGISTERED';
        } else if (act.includes('PASSKEY') && act.includes('REVOKE')) {
          type = 'PASSKEY_REVOKED';
        }

        securityAuditService.emitSecurityEvent({
          type,
          user: params.user,
          role: params.role,
          action: params.action,
          ipAddress: params.ipAddress,
          previousState: params.previousState,
          newState: params.newState,
          details: { action: params.action, module: params.module, entity: params.entity, entityId: params.entityId },
          severity: act.includes('FAIL') || act.includes('LOCKOUT') ? 'WARN' : 'INFO',
        });
      }
    } catch {
      // Non-breaking fallback
    }

    return fullEntry;
  }

  public getLogs(limit = 100): ServerAuditLogEntry[] {
    return this.logs.slice(0, Math.min(limit, 500));
  }

  public verifyLogIntegrity(entry: ServerAuditLogEntry): boolean {
    const { integrityHash, ...rest } = entry;
    const expected = this.computeIntegrityHash(rest);
    return crypto.timingSafeEqual(Buffer.from(integrityHash), Buffer.from(expected));
  }

  /**
   * Registers a security event listener to capture and persist authentication-related events
   */
  public addSecurityEventListener(listener: (event: any, logEntry: any) => void): () => void {
    return securityAuditService.addSecurityEventListener(listener);
  }
}

export const serverAuditLogger = new ServerAuditLogger();
