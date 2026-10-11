import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { profileSwitchService } from '../src/services/profileSwitchService';
import { securityAuditService } from '../src/server/security/SecurityAuditService';
import { rbacService } from '../src/services/rbacService';

describe('Nautilus Secure Profile Switch Layer - Non-Breaking Verification Suite', () => {
  it('1. Default base role and active profile initialized', () => {
    const baseRole = profileSwitchService.getBaseRole();
    const activeProfile = profileSwitchService.getActiveProfile();
    assert.ok(baseRole, 'Base role must be initialized');
    assert.ok(activeProfile, 'Active profile must be initialized');
  });

  it('2. Switching to operational profile establishes temporary session', async () => {
    const res = await profileSwitchService.switchProfile('Risk Analyst', {
      durationMinutes: 30,
      reason: 'Automated test task',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.activeProfile, 'Risk Analyst');
    assert.strictEqual(profileSwitchService.getActiveProfile(), 'Risk Analyst');
    assert.strictEqual(profileSwitchService.isTemporaryActive(), true);

    const session = profileSwitchService.getSession();
    assert.ok(session);
    assert.strictEqual(session?.activeProfile, 'Risk Analyst');
    assert.strictEqual(session?.durationMinutes, 30);
    assert.strictEqual(session?.reason, 'Automated test task');
  });

  it('3. Profile switch preserves existing RBAC permissions for active profile', () => {
    const activeProfile = profileSwitchService.getActiveProfile();
    // Risk Analyst has dashboard_priority_risk but not vessel_registry (default)
    const canSeePriorityRisk = rbacService.hasPermission(activeProfile, 'dashboard_priority_risk');
    assert.strictEqual(canSeePriorityRisk, true);
  });

  it('4. Switching to Super Admin without credentials is rejected', async () => {
    const res = await profileSwitchService.switchProfile('Super Admin');
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes('credentials required') || res.error?.includes('Super Admin'));
  });

  it('5. Revert to base role clears temporary session and restores base identity', async () => {
    const baseRole = profileSwitchService.getBaseRole();
    const res = await profileSwitchService.revertToBaseRole('Test revert');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.activeProfile, baseRole);
    assert.strictEqual(profileSwitchService.isTemporaryActive(), false);
    assert.strictEqual(profileSwitchService.getSession(), null);
  });

  it('6. Server security audit logger records PROFILE_SWITCH and PROFILE_REVERT events', () => {
    const entry = securityAuditService.recordEvent({
      eventType: 'PROFILE_SWITCH',
      user: 'operator-test',
      role: 'Operations Manager',
      module: 'SECURITY_AUTH',
      entity: 'USER_PROFILE',
      entityId: 'operator-test',
      details: { targetProfile: 'Operations Manager', durationMinutes: 60 },
      previousState: 'Compliance Officer',
      newState: 'Operations Manager',
      ipAddress: '127.0.0.1',
    });

    assert.strictEqual(entry.eventType, 'PROFILE_SWITCH');
    assert.strictEqual(entry.role, 'Operations Manager');
    assert.ok(entry.currentHash);
    assert.ok(entry.sequence > 0);

    const revertEntry = securityAuditService.recordEvent({
      eventType: 'PROFILE_REVERT',
      user: 'operator-test',
      role: 'Compliance Officer',
      module: 'SECURITY_AUTH',
      entity: 'USER_PROFILE',
      entityId: 'operator-test',
      details: { revertedTo: 'Compliance Officer' },
      previousState: 'Operations Manager',
      newState: 'Compliance Officer',
      ipAddress: '127.0.0.1',
    });

    assert.strictEqual(revertEntry.eventType, 'PROFILE_REVERT');
    assert.ok(revertEntry.currentHash);
  });

  it('7. Security event listener captures and persists authentication-related events (MFA failure, role-switching)', () => {
    const capturedEvents: any[] = [];
    const unsubscribe = securityAuditService.addSecurityEventListener((event, logEntry) => {
      capturedEvents.push({ event, logEntry });
    });

    // 1. Emit a failed MFA attempt
    const mfaLog = securityAuditService.emitSecurityEvent({
      type: 'MFA_FAILED',
      user: 'analyst@oceaniq.test',
      role: 'Risk Analyst',
      action: 'MFA_TOTP_VERIFICATION_FAILED',
      ipAddress: '192.168.1.10',
      details: { attempt: 3, reason: 'Invalid token digits' },
      severity: 'WARN',
    });

    assert.ok(mfaLog);
    assert.strictEqual(mfaLog.eventType, 'MFA_VERIFICATION_FAILED');
    assert.ok(mfaLog.currentHash);

    // 2. Emit a role-switching event
    const roleSwitchLog = securityAuditService.emitSecurityEvent({
      type: 'ROLE_SWITCH',
      user: 'operator@oceaniq.test',
      role: 'Compliance Officer',
      action: 'PROFILE_SWITCH_APPLIED',
      ipAddress: '192.168.1.20',
      previousState: 'Viewer',
      newState: 'Compliance Officer',
      details: { durationMinutes: 45, reason: 'Compliance audit review' },
      severity: 'INFO',
    });

    assert.ok(roleSwitchLog);
    assert.strictEqual(roleSwitchLog.eventType, 'PROFILE_SWITCH');
    assert.strictEqual(roleSwitchLog.newState, 'Compliance Officer');

    // Verify the registered listener was triggered for both authentication events
    assert.strictEqual(capturedEvents.length, 2);
    assert.strictEqual(capturedEvents[0].event.type, 'MFA_FAILED');
    assert.strictEqual(capturedEvents[0].logEntry.user, 'analyst@oceaniq.test');
    assert.strictEqual(capturedEvents[1].event.type, 'ROLE_SWITCH');
    assert.strictEqual(capturedEvents[1].logEntry.newState, 'Compliance Officer');

    // Unsubscribe cleanly
    unsubscribe();
  });

  it('8. Automated Security Audit Report generates compliance summary and exports CSV', () => {
    const report = securityAuditService.generateComplianceReport({ sinceHours: 24 });

    assert.ok(report);
    assert.ok(report.generatedAt);
    assert.ok(report.complianceStandard.includes('Maritime Cyber Risk Management') || report.complianceStandard.includes('ISO/IEC'));
    assert.strictEqual(report.chainIntegrity.verified, true);
    assert.ok(report.summary.totalEvents > 0);
    assert.ok(Array.isArray(report.sections.recentLoginAttempts));
    assert.ok(Array.isArray(report.sections.systemAccessAnomalies));
    assert.ok(Array.isArray(report.sections.roleSwitchingEvents));

    // Verify CSV export
    const csv = securityAuditService.exportComplianceReportCSV({ sinceHours: 24 });
    assert.ok(typeof csv === 'string');
    assert.ok(csv.includes('NAUTILUS MARITIME CYBER RISK & SECURITY AUDIT COMPLIANCE REPORT'));
    assert.ok(csv.includes('SECTION 1: RECENT LOGIN ATTEMPTS'));
    assert.ok(csv.includes('SECTION 3: SYSTEM ACCESS ANOMALIES & INCIDENTS'));
  });
});
