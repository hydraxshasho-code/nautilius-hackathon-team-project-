import crypto from 'crypto';
import { UserRole } from './types';

export type AuditEventType =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'AUTH_TOKEN_VERIFIED'
  | 'ROLE_MODIFIED'
  | 'SUPER_ADMIN_ELEVATION'
  | 'ROLE_RESET'
  | 'VESSEL_CREATED'
  | 'VESSEL_UPDATED'
  | 'VESSEL_DELETED'
  | 'VESSEL_TRACKED'
  | 'VESSEL_UNTRACKED'
  | 'ALERT_STATUS_CHANGED'
  | 'ALERT_MUTATED'
  | 'SECURITY_POLICY_CHANGED'
  | 'SYSTEM_BOOTSTRAP'
  | 'PROFILE_SWITCH'
  | 'PROFILE_REVERT'
  | 'MFA_VERIFICATION_FAILED'
  | 'MFA_VERIFIED'
  | 'MFA_REGISTERED'
  | 'MFA_REVOKED'
  | 'PASSWORD_CHANGED'
  | 'ACCESS_ANOMALY'
  | 'ADMIN_LOCKOUT_TRIGGERED';

export type SecurityAuthEventType =
  | 'MFA_FAILED'
  | 'MFA_SUCCESS'
  | 'MFA_ENROLLED'
  | 'MFA_DISABLED'
  | 'ROLE_SWITCH'
  | 'ROLE_REVERT'
  | 'ROLE_MODIFIED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'PASSWORD_ELEVATION_FAILED'
  | 'PASSWORD_ELEVATION_SUCCESS'
  | 'ACCOUNT_LOCKED'
  | 'PASSKEY_REGISTERED'
  | 'PASSKEY_REVOKED'
  | 'ACCESS_ANOMALY';

export interface SecurityAuthEvent {
  type: SecurityAuthEventType;
  user: string;
  role?: string;
  action?: string;
  ipAddress?: string;
  timestamp?: string;
  details?: Record<string, any>;
  previousState?: string;
  newState?: string;
  severity?: 'INFO' | 'WARN' | 'CRITICAL';
}

export type SecurityEventListener = (event: SecurityAuthEvent, logEntry: ImmutableAuditLog) => void;

export interface SecurityAuditReport {
  generatedAt: string;
  complianceStandard: string;
  timeRange: {
    from: string;
    to: string;
  };
  chainIntegrity: {
    verified: boolean;
    totalRecords: number;
    corruptedIndex: number | null;
  };
  summary: {
    totalEvents: number;
    totalLogins: number;
    failedLogins: number;
    failedMfaAttempts: number;
    passwordChanges: number;
    roleSwitchEvents: number;
    accessAnomalies: number;
    accountLockouts: number;
  };
  sections: {
    recentLoginAttempts: Array<{
      timestamp: string;
      user: string;
      role: string;
      ipAddress: string;
      status: 'SUCCESS' | 'FAILED' | 'LOCKED';
      details: Record<string, any>;
    }>;
    passwordAndCredentialChanges: Array<{
      timestamp: string;
      user: string;
      action: string;
      entity: string;
      ipAddress: string;
      details: Record<string, any>;
    }>;
    systemAccessAnomalies: Array<{
      timestamp: string;
      user: string;
      type: string;
      severity: 'WARN' | 'CRITICAL';
      description: string;
      ipAddress: string;
      details: Record<string, any>;
    }>;
    roleSwitchingEvents: Array<{
      timestamp: string;
      user: string;
      previousRole: string;
      activeProfile: string;
      reason?: string;
      durationMinutes?: number;
      ipAddress: string;
    }>;
  };
}

export interface ImmutableAuditLog {
  id: string;
  sequence: number;
  timestamp: string;
  eventType: AuditEventType;
  action?: string;
  user: string;
  role: UserRole | string;
  module: string;
  entity: string;
  entityId: string;
  details: Record<string, any>;
  previousState?: string;
  newState?: string;
  ipAddress: string;
  previousHash: string;
  currentHash: string;
  signature: string;
}

const AUDIT_SECRET = process.env.AUDIT_HMAC_SECRET || 'oceaniq-immutable-audit-chain-key-2026';
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export class SecurityAuditService {
  private logChain: ImmutableAuditLog[] = [];
  private lastHash: string = GENESIS_HASH;
  private sequenceCounter: number = 0;
  private readonly maxChainLength: number = 2000;
  private securityListeners: Set<SecurityEventListener> = new Set();

  constructor() {
    // Record immutable Genesis log entry
    this.recordEvent({
      eventType: 'SYSTEM_BOOTSTRAP',
      user: 'SYSTEM_KERNEL',
      role: 'Super Admin',
      module: 'SECURITY_AUDIT',
      entity: 'AUDIT_LEDGER',
      entityId: 'GENESIS_BLOCK',
      details: {
        engine: 'OCEANIQ_IMMUTABLE_AUDIT_V2',
        hashAlgorithm: 'SHA-256',
        signatureScheme: 'HMAC-SHA256',
      },
      newState: 'AUDIT_LEDGER_ARMED',
      ipAddress: '127.0.0.1',
    });
  }

  /**
   * Registers a security event listener to capture and react to authentication/authorization events
   */
  public addSecurityEventListener(listener: SecurityEventListener): () => void {
    this.securityListeners.add(listener);
    return () => {
      this.securityListeners.delete(listener);
    };
  }

  /**
   * Dispatches and persists an authentication-related security event adhering to the cryptographic audit trail
   */
  public emitSecurityEvent(event: SecurityAuthEvent): ImmutableAuditLog {
    let auditEventType: AuditEventType = 'AUTH_TOKEN_VERIFIED';
    let module = 'SECURITY_AUTH';
    let entity = 'AUTH_CREDENTIAL';

    switch (event.type) {
      case 'MFA_FAILED':
        auditEventType = 'MFA_VERIFICATION_FAILED';
        module = 'MFA';
        entity = 'MFA_CHALLENGE';
        break;
      case 'MFA_SUCCESS':
        auditEventType = 'MFA_VERIFIED';
        module = 'MFA';
        entity = 'MFA_TOKEN';
        break;
      case 'MFA_ENROLLED':
        auditEventType = 'MFA_REGISTERED';
        module = 'MFA';
        entity = 'TOTP_SECRET';
        break;
      case 'MFA_DISABLED':
        auditEventType = 'MFA_REVOKED';
        module = 'MFA';
        entity = 'TOTP_SECRET';
        break;
      case 'ROLE_SWITCH':
        auditEventType = 'PROFILE_SWITCH';
        module = 'RBAC';
        entity = 'USER_PROFILE';
        break;
      case 'ROLE_REVERT':
        auditEventType = 'PROFILE_REVERT';
        module = 'RBAC';
        entity = 'USER_PROFILE';
        break;
      case 'ROLE_MODIFIED':
        auditEventType = 'ROLE_MODIFIED';
        module = 'RBAC';
        entity = 'USER_PERMISSIONS';
        break;
      case 'LOGIN_SUCCESS':
        auditEventType = 'USER_LOGIN';
        module = 'AUTH';
        entity = 'USER_SESSION';
        break;
      case 'LOGIN_FAILED':
        auditEventType = 'USER_LOGIN';
        module = 'AUTH';
        entity = 'USER_SESSION';
        break;
      case 'PASSWORD_ELEVATION_FAILED':
        auditEventType = 'SUPER_ADMIN_ELEVATION';
        module = 'SECURITY';
        entity = 'SUPER_ADMIN_PASSWORD';
        break;
      case 'PASSWORD_ELEVATION_SUCCESS':
        auditEventType = 'SUPER_ADMIN_ELEVATION';
        module = 'SECURITY';
        entity = 'USER_ROLE';
        break;
      case 'ACCOUNT_LOCKED':
        auditEventType = 'ADMIN_LOCKOUT_TRIGGERED';
        module = 'SECURITY';
        entity = 'LOCKOUT_STORE';
        break;
      case 'PASSKEY_REGISTERED':
        auditEventType = 'SECURITY_POLICY_CHANGED';
        module = 'WEBAUTHN';
        entity = 'PASSKEY_CREDENTIAL';
        break;
      case 'PASSKEY_REVOKED':
        auditEventType = 'SECURITY_POLICY_CHANGED';
        module = 'WEBAUTHN';
        entity = 'PASSKEY_CREDENTIAL';
        break;
      case 'ACCESS_ANOMALY':
        auditEventType = 'ACCESS_ANOMALY';
        module = 'THREAT_DETECTION';
        entity = 'ACCESS_PATTERN';
        break;
    }

    const logEntry = this.recordEvent({
      eventType: auditEventType,
      user: event.user || 'anonymous',
      role: event.role || 'Viewer',
      module,
      entity,
      entityId: event.user,
      details: {
        securityEventType: event.type,
        action: event.action,
        severity: event.severity || 'INFO',
        ...event.details,
      },
      previousState: event.previousState,
      newState: event.newState,
      ipAddress: event.ipAddress || '127.0.0.1',
    });

    // Notify registered listeners
    for (const listener of this.securityListeners) {
      try {
        listener(event, logEntry);
      } catch (err) {
        console.error('[SecurityEventListener Error]', err);
      }
    }

    return logEntry;
  }

  /**
   * Generates cryptographic hash chaining: SHA256(sequence + timestamp + event + user + entity + previousHash)
   */
  private computeHash(
    sequence: number,
    timestamp: string,
    eventType: string,
    user: string,
    entity: string,
    entityId: string,
    detailsStr: string,
    previousHash: string
  ): string {
    const payload = `${sequence}|${timestamp}|${eventType}|${user}|${entity}|${entityId}|${detailsStr}|${previousHash}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Generates HMAC-SHA256 non-repudiation signature for the log entry
   */
  private computeSignature(currentHash: string): string {
    return crypto.createHmac('sha256', AUDIT_SECRET).update(currentHash).digest('hex');
  }

  /**
   * Records a sensitive security event in the immutable cryptographic ledger
   */
  public recordEvent(params: {
    eventType: AuditEventType;
    action?: string;
    user: string;
    role: UserRole | string;
    module: string;
    entity: string;
    entityId: string;
    details?: Record<string, any>;
    previousState?: string;
    newState?: string;
    ipAddress?: string;
  }): ImmutableAuditLog {
    this.sequenceCounter++;
    const sequence = this.sequenceCounter;
    const timestamp = new Date().toISOString();
    const id = `audit-seq-${sequence.toString().padStart(6, '0')}-${crypto.randomBytes(3).toString('hex')}`;
    const previousHash = this.lastHash;
    const details = params.details || {};
    const detailsStr = JSON.stringify(details);

    const currentHash = this.computeHash(
      sequence,
      timestamp,
      params.eventType,
      params.user,
      params.entity,
      params.entityId,
      detailsStr,
      previousHash
    );

    const signature = this.computeSignature(currentHash);

    const entry: ImmutableAuditLog = {
      id,
      sequence,
      timestamp,
      eventType: params.eventType,
      action: params.action || details.action || params.eventType,
      user: params.user || 'anonymous',
      role: params.role || 'Viewer',
      module: params.module,
      entity: params.entity,
      entityId: params.entityId,
      details,
      previousState: params.previousState,
      newState: params.newState,
      ipAddress: params.ipAddress || '127.0.0.1',
      previousHash,
      currentHash,
      signature,
    };

    // Append-only write
    this.logChain.unshift(entry);
    this.lastHash = currentHash;

    if (this.logChain.length > this.maxChainLength) {
      this.logChain = this.logChain.slice(0, this.maxChainLength);
    }

    return entry;
  }

  /**
   * Specifically logs user authentication events (logins, session activations)
   */
  public logLogin(uid: string, email?: string, role = 'Viewer', ipAddress = '127.0.0.1'): ImmutableAuditLog {
    return this.recordEvent({
      eventType: 'USER_LOGIN',
      user: email || uid,
      role,
      module: 'AUTH',
      entity: 'USER_SESSION',
      entityId: uid,
      details: { email, authProvider: 'google.com' },
      newState: 'AUTHENTICATED_SESSION_OPEN',
      ipAddress,
    });
  }

  /**
   * Logs user sign-out
   */
  public logLogout(uid: string, email?: string, role = 'Viewer', ipAddress = '127.0.0.1'): ImmutableAuditLog {
    return this.recordEvent({
      eventType: 'USER_LOGOUT',
      user: email || uid,
      role,
      module: 'AUTH',
      entity: 'USER_SESSION',
      entityId: uid,
      details: { email },
      previousState: 'AUTHENTICATED_SESSION_OPEN',
      newState: 'SESSION_TERMINATED',
      ipAddress,
    });
  }

  /**
   * Logs authoritative user role modifications
   */
  public logRoleModification(
    targetUid: string,
    previousRole: string,
    newRole: string,
    adminUser: string,
    ipAddress = '127.0.0.1'
  ): ImmutableAuditLog {
    return this.recordEvent({
      eventType: 'ROLE_MODIFIED',
      user: adminUser,
      role: 'Super Admin',
      module: 'RBAC',
      entity: 'USER_PERMISSIONS',
      entityId: targetUid,
      previousState: previousRole,
      newState: newRole,
      details: { targetUid, previousRole, newRole },
      ipAddress,
    });
  }

  /**
   * Logs vessel creation, modification, or removal
   */
  public logVesselMutation(
    action: 'CREATED' | 'UPDATED' | 'DELETED' | 'TRACKED' | 'UNTRACKED',
    vesselId: string,
    vesselName: string,
    actorUid: string,
    actorRole: string,
    details?: Record<string, any>,
    ipAddress = '127.0.0.1'
  ): ImmutableAuditLog {
    const eventTypeMap: Record<string, AuditEventType> = {
      CREATED: 'VESSEL_CREATED',
      UPDATED: 'VESSEL_UPDATED',
      DELETED: 'VESSEL_DELETED',
      TRACKED: 'VESSEL_TRACKED',
      UNTRACKED: 'VESSEL_UNTRACKED',
    };

    return this.recordEvent({
      eventType: eventTypeMap[action] || 'VESSEL_UPDATED',
      user: actorUid,
      role: actorRole,
      module: 'VESSEL_REGISTRY',
      entity: 'MARITIME_VESSEL',
      entityId: vesselId,
      details: { vesselName, ...details },
      newState: `VESSEL_${action}`,
      ipAddress,
    });
  }

  /**
   * Verifies the cryptographic chain integrity of all logs in the ledger
   */
  public verifyChainIntegrity(): {
    valid: boolean;
    totalRecords: number;
    corruptedIndex: number | null;
    error?: string;
  } {
    // Reverse to check in chronological order from sequence 1 to N
    const chronological = [...this.logChain].reverse();
    let prevHash = GENESIS_HASH;

    for (let i = 0; i < chronological.length; i++) {
      const entry = chronological[i];

      // 1. Verify previous hash linkage
      if (entry.previousHash !== prevHash) {
        return {
          valid: false,
          totalRecords: chronological.length,
          corruptedIndex: i,
          error: `Broken chain link at sequence ${entry.sequence}: expected ${prevHash} but found ${entry.previousHash}`,
        };
      }

      // 2. Recompute current hash
      const expectedHash = this.computeHash(
        entry.sequence,
        entry.timestamp,
        entry.eventType,
        entry.user,
        entry.entity,
        entry.entityId,
        JSON.stringify(entry.details),
        entry.previousHash
      );

      if (expectedHash !== entry.currentHash) {
        return {
          valid: false,
          totalRecords: chronological.length,
          corruptedIndex: i,
          error: `Content hash mismatch at sequence ${entry.sequence}: entry has been tampered with`,
        };
      }

      // 3. Verify HMAC signature
      const expectedSignature = this.computeSignature(entry.currentHash);
      if (expectedSignature !== entry.signature) {
        return {
          valid: false,
          totalRecords: chronological.length,
          corruptedIndex: i,
          error: `Signature invalid at sequence ${entry.sequence}`,
        };
      }

      prevHash = entry.currentHash;
    }

    return {
      valid: true,
      totalRecords: chronological.length,
      corruptedIndex: null,
    };
  }

  /**
   * Returns immutable audit logs (Admin only)
   */
  public getLogs(limit = 200): ImmutableAuditLog[] {
    return this.logChain.slice(0, Math.min(limit, 500));
  }

  /**
   * Returns ledger summary statistics
   */
  public getStats(): {
    totalEvents: number;
    logins: number;
    roleModifications: number;
    vesselMutations: number;
    chainIntegrity: boolean;
  } {
    let logins = 0;
    let roleModifications = 0;
    let vesselMutations = 0;

    for (const l of this.logChain) {
      if (l.eventType === 'USER_LOGIN' || l.eventType === 'USER_LOGOUT') logins++;
      else if (l.eventType === 'ROLE_MODIFIED' || l.eventType === 'SUPER_ADMIN_ELEVATION') roleModifications++;
      else if (l.eventType.startsWith('VESSEL_')) vesselMutations++;
    }

    return {
      totalEvents: this.logChain.length,
      logins,
      roleModifications,
      vesselMutations,
      chainIntegrity: this.verifyChainIntegrity().valid,
    };
  }

  /**
   * Generates an automated Security Audit Report summarizing all recent login attempts,
   * password/credential changes, and system access anomalies for compliance purposes.
   */
  public generateComplianceReport(options?: { sinceHours?: number }): SecurityAuditReport {
    const sinceHours = options?.sinceHours && options.sinceHours > 0 ? options.sinceHours : 720; // default 30 days
    const cutoffTime = Date.now() - sinceHours * 60 * 60 * 1000;
    const nowIso = new Date().toISOString();
    const fromIso = new Date(cutoffTime).toISOString();

    const filteredLogs = this.logChain.filter((entry) => {
      const entryTime = new Date(entry.timestamp).getTime();
      return entryTime >= cutoffTime;
    });

    const recentLoginAttempts: SecurityAuditReport['sections']['recentLoginAttempts'] = [];
    const passwordAndCredentialChanges: SecurityAuditReport['sections']['passwordAndCredentialChanges'] = [];
    const systemAccessAnomalies: SecurityAuditReport['sections']['systemAccessAnomalies'] = [];
    const roleSwitchingEvents: SecurityAuditReport['sections']['roleSwitchingEvents'] = [];

    let totalLogins = 0;
    let failedLogins = 0;
    let failedMfaAttempts = 0;
    let passwordChanges = 0;
    let roleSwitchEvents = 0;
    let accessAnomalies = 0;
    let accountLockouts = 0;

    for (const entry of filteredLogs) {
      const ev = entry.eventType;
      const details = entry.details || {};

      // 1. Login Attempts
      if (ev === 'USER_LOGIN') {
        const isFailure = entry.newState === 'LOGIN_FAILURE' || details.status === 'FAILED';
        totalLogins++;
        if (isFailure) failedLogins++;
        recentLoginAttempts.push({
          timestamp: entry.timestamp,
          user: entry.user,
          role: String(entry.role),
          ipAddress: entry.ipAddress,
          status: isFailure ? 'FAILED' : 'SUCCESS',
          details,
        });
      } else if (ev === 'SUPER_ADMIN_ELEVATION') {
        const isFailure = entry.newState === 'REJECTED_BAD_CREDENTIALS' || details.attemptSuccess === false;
        totalLogins++;
        if (isFailure) failedLogins++;
        recentLoginAttempts.push({
          timestamp: entry.timestamp,
          user: entry.user,
          role: String(entry.role),
          ipAddress: entry.ipAddress,
          status: isFailure ? 'FAILED' : 'SUCCESS',
          details: { ...details, elevationAttempt: true },
        });
      }

      // 2. Failed MFA attempts
      if (
        ev === 'MFA_VERIFICATION_FAILED' ||
        details.securityEventType === 'MFA_FAILED' ||
        (entry.action && entry.action.includes('MFA') && entry.action.includes('FAIL'))
      ) {
        failedMfaAttempts++;
        systemAccessAnomalies.push({
          timestamp: entry.timestamp,
          user: entry.user,
          type: 'MFA_VERIFICATION_FAILURE',
          severity: 'WARN',
          description: `Failed second-factor authentication attempt for user ${entry.user}`,
          ipAddress: entry.ipAddress,
          details,
        });
      }

      // 3. Password and Credential Changes
      if (
        ev === 'PASSWORD_CHANGED' ||
        ev === 'MFA_REGISTERED' ||
        ev === 'MFA_REVOKED' ||
        details.securityEventType === 'MFA_ENROLLED' ||
        details.securityEventType === 'MFA_DISABLED' ||
        details.securityEventType === 'PASSKEY_REGISTERED' ||
        details.securityEventType === 'PASSKEY_REVOKED' ||
        entry.module === 'WEBAUTHN' ||
        (entry.action && (entry.action.includes('PASSKEY') || entry.action.includes('PASSWORD_CHANGE')))
      ) {
        passwordChanges++;
        passwordAndCredentialChanges.push({
          timestamp: entry.timestamp,
          user: entry.user,
          action: entry.action || ev,
          entity: entry.entity,
          ipAddress: entry.ipAddress,
          details,
        });
      }

      // 4. System Access Anomalies
      if (
        ev === 'ADMIN_LOCKOUT_TRIGGERED' ||
        ev === 'ACCESS_ANOMALY' ||
        (entry.action && entry.action.includes('LOCKOUT')) ||
        details.locked === true
      ) {
        accessAnomalies++;
        accountLockouts++;
        systemAccessAnomalies.push({
          timestamp: entry.timestamp,
          user: entry.user,
          type: 'ADMIN_ACCOUNT_LOCKOUT',
          severity: 'CRITICAL',
          description: `Account lockout triggered due to repeated failed authentication attempts from IP ${entry.ipAddress}`,
          ipAddress: entry.ipAddress,
          details,
        });
      }

      // 5. Role-Switching Events
      if (
        ev === 'PROFILE_SWITCH' ||
        ev === 'PROFILE_REVERT' ||
        ev === 'ROLE_MODIFIED' ||
        details.securityEventType === 'ROLE_SWITCH' ||
        details.securityEventType === 'ROLE_REVERT'
      ) {
        roleSwitchEvents++;
        roleSwitchingEvents.push({
          timestamp: entry.timestamp,
          user: entry.user,
          previousRole: entry.previousState || details.baseRole || 'Viewer',
          activeProfile: entry.newState || details.targetProfile || String(entry.role),
          reason: details.reason,
          durationMinutes: details.durationMinutes,
          ipAddress: entry.ipAddress,
        });
      }
    }

    const integrity = this.verifyChainIntegrity();

    return {
      generatedAt: nowIso,
      complianceStandard: 'IMO MSC-FAL.1/Circ.3 Maritime Cyber Risk Management & ISO/IEC 27001 ISMS',
      timeRange: {
        from: fromIso,
        to: nowIso,
      },
      chainIntegrity: {
        verified: integrity.valid,
        totalRecords: integrity.totalRecords,
        corruptedIndex: integrity.corruptedIndex,
      },
      summary: {
        totalEvents: filteredLogs.length,
        totalLogins,
        failedLogins,
        failedMfaAttempts,
        passwordChanges,
        roleSwitchEvents,
        accessAnomalies,
        accountLockouts,
      },
      sections: {
        recentLoginAttempts,
        passwordAndCredentialChanges,
        systemAccessAnomalies,
        roleSwitchingEvents,
      },
    };
  }

  /**
   * Exports the compliance audit report in standard RFC 4180 CSV format
   */
  public exportComplianceReportCSV(options?: { sinceHours?: number }): string {
    const report = this.generateComplianceReport(options);
    const rows: string[] = [];

    // Header metadata
    rows.push('"NAUTILUS MARITIME CYBER RISK & SECURITY AUDIT COMPLIANCE REPORT"');
    rows.push(`"Standard","${report.complianceStandard}"`);
    rows.push(`"Report Generated","${report.generatedAt}"`);
    rows.push(`"Reporting Window","${report.timeRange.from} to ${report.timeRange.to}"`);
    rows.push(`"Ledger Chain Integrity","${report.chainIntegrity.verified ? 'VERIFIED (PASS)' : 'TAMPERED (FAIL)'}"`);
    rows.push(`"Total Logged Security Events","${report.summary.totalEvents}"`);
    rows.push('');

    // Summary Section
    rows.push('"EXECUTIVE COMPLIANCE SUMMARY"');
    rows.push('"Metric","Count"');
    rows.push(`"Total Login Attempts","${report.summary.totalLogins}"`);
    rows.push(`"Failed Login Attempts","${report.summary.failedLogins}"`);
    rows.push(`"Failed MFA / Second-Factor Challenges","${report.summary.failedMfaAttempts}"`);
    rows.push(`"Password & Credential Configuration Changes","${report.summary.passwordChanges}"`);
    rows.push(`"Role-Switching & Privilege Delegation Events","${report.summary.roleSwitchEvents}"`);
    rows.push(`"Access Anomalies & Security Alerts","${report.summary.accessAnomalies}"`);
    rows.push(`"Account Lockout Threshold Triggers","${report.summary.accountLockouts}"`);
    rows.push('');

    // Section 1: Recent Logins
    rows.push('"SECTION 1: RECENT LOGIN ATTEMPTS"');
    rows.push('"Timestamp","User / Identity","Assigned Role","IP Address","Status"');
    for (const login of report.sections.recentLoginAttempts) {
      rows.push(`"${login.timestamp}","${login.user}","${login.role}","${login.ipAddress}","${login.status}"`);
    }
    rows.push('');

    // Section 2: Credential & Password Changes
    rows.push('"SECTION 2: PASSWORD AND CREDENTIAL CHANGES"');
    rows.push('"Timestamp","User / Actor","Action","Entity","IP Address"');
    for (const cred of report.sections.passwordAndCredentialChanges) {
      rows.push(`"${cred.timestamp}","${cred.user}","${cred.action}","${cred.entity}","${cred.ipAddress}"`);
    }
    rows.push('');

    // Section 3: System Access Anomalies
    rows.push('"SECTION 3: SYSTEM ACCESS ANOMALIES & INCIDENTS"');
    rows.push('"Timestamp","User / Subject","Anomaly Type","Severity","Description","IP Address"');
    for (const a of report.sections.systemAccessAnomalies) {
      rows.push(`"${a.timestamp}","${a.user}","${a.type}","${a.severity}","${a.description.replace(/"/g, '""')}","${a.ipAddress}"`);
    }
    rows.push('');

    // Section 4: Role-Switching Events
    rows.push('"SECTION 4: ROLE-SWITCHING AND PRIVILEGE DELEGATIONS"');
    rows.push('"Timestamp","User","Previous Role","Active Profile","Duration (min)","Reason","IP Address"');
    for (const r of report.sections.roleSwitchingEvents) {
      rows.push(`"${r.timestamp}","${r.user}","${r.previousRole}","${r.activeProfile}","${r.durationMinutes || 60}","${(r.reason || 'Operational switch').replace(/"/g, '""')}","${r.ipAddress}"`);
    }

    return rows.join('\r\n');
  }
}

export const securityAuditService = new SecurityAuditService();
