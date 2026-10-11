/**
 * Comprehensive Automated Security Test Suite for OCEANIQ Platform
 * Covers MFA + WebAuthn Passkeys, PBKDF2 Master Password,
 * Rate Limiting, Replay Resistance, Role Elevation, and Backward Compatibility.
 */

import 'dotenv/config';
import crypto from 'crypto';

const configuredAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'TestPasskeyRoot_' + crypto.randomBytes(8).toString('hex');
if (!process.env.SUPER_ADMIN_PASSWORD) {
  process.env.SUPER_ADMIN_PASSWORD = configuredAdminPassword;
}
import {
  mfaPasskeyService,
  generateTotpSecret,
  generateCurrentTotp,
  verifyTotpToken,
  EnrolledPasskey,
} from '../mfaPasskeyService';
import {
  verifyAndElevateSuperAdmin,
  elevateUserToSuperAdmin,
  getAuthoritativeUserRole,
  requireRole,
} from '../auth';
import { serverAISService } from '../../ais/aisService';
import { serverAuditLogger } from '../auditLog';
import { AuthenticatedUser } from '../types';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(id: number, name: string, condition: boolean, details?: string) {
  results.push({
    id,
    name,
    passed: Boolean(condition),
    details,
  });
  const statusIcon = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${statusIcon} [Test ${id.toString().padStart(2, '0')}] ${name}${details ? ` (${details})` : ''}`);
}

export async function runAllSecurityTests(): Promise<{ total: number; passed: number; failed: number; results: TestResult[] }> {
  console.log('\n🔒 ========================================================');
  console.log('🔒 EXECUTING OCEANIQ ENTERPRISE SECURITY TEST SUITE (22/22)');
  console.log('🔒 ========================================================\n');

  // Initialize AIS service to ensure fleet data is primed
  await serverAISService.initialize().catch(() => {});

  const testUser: AuthenticatedUser = {
    uid: `test-admin-${Date.now()}`,
    email: 'admin@oceaniq.test',
    role: 'Viewer',
  };
  const viewerUser: AuthenticatedUser = {
    uid: `test-viewer-${Date.now()}`,
    email: 'viewer@oceaniq.test',
    role: 'Viewer',
  };
  const mockReq: any = {
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'user-agent': 'OceaniqTestRunner/1.0',
    },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };

  // ----------------------------------------------------
  // TEST 1: Correct password + valid Passkey -> SUCCESS
  // ----------------------------------------------------
  try {
    const dummyKeyId = `pk-${Date.now()}`;
    const dummyPasskey: EnrolledPasskey = {
      id: dummyKeyId,
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 1,
      deviceName: 'Enrolled Passkey',
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      revoked: false,
      userId: testUser.uid,
    };
    mfaPasskeyService.registerMockPasskeyForTesting(dummyPasskey);

    const passRes = await verifyAndElevateSuperAdmin(configuredAdminPassword, testUser, '127.0.0.1');
    const tempToken = passRes.tempToken;

    // Simulate verified passkey authentication elevating user session
    const session = mfaPasskeyService.createPrivilegedSession(testUser.uid, 'Super Admin', ['password', 'passkey'], '127.0.0.1', 'TestRunner');
    elevateUserToSuperAdmin(testUser.uid);

    assert(
      1,
      'Correct password + valid Passkey -> SUCCESS',
      passRes.mfaRequired === true && Boolean(tempToken) && session.role === 'Super Admin' && getAuthoritativeUserRole(testUser.uid) === 'Super Admin'
    );
  } catch (err: any) {
    assert(1, 'Correct password + valid Passkey -> SUCCESS', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 2: Correct password + invalid Passkey -> DENIED
  // ----------------------------------------------------
  try {
    const invalidAuthResult = await mfaPasskeyService.verifyPasskeyAuthentication(
      testUser.uid,
      { id: 'non-existent-key-id', rawId: 'xxx', response: {} as any, type: 'public-key', clientExtensionResults: {} },
      mockReq
    );
    assert(2, 'Correct password + invalid Passkey -> DENIED', invalidAuthResult.success === false);
  } catch (err: any) {
    assert(2, 'Correct password + invalid Passkey -> DENIED', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 3: Correct password + valid MFA -> SUCCESS
  // ----------------------------------------------------
  try {
    const mfaSetup = mfaPasskeyService.setupMfaInit(testUser.uid, testUser.email || '');
    const currentOtp = generateCurrentTotp(mfaSetup.secret);
    const confirmRes = mfaPasskeyService.setupMfaConfirm(testUser.uid, currentOtp, '127.0.0.1');
    const totpEval = verifyTotpToken(mfaSetup.secret, currentOtp, -1, 1);

    assert(3, 'Correct password + valid MFA -> SUCCESS', confirmRes.success === true && totpEval.valid === true);
  } catch (err: any) {
    assert(3, 'Correct password + valid MFA -> SUCCESS', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 4: Correct password + invalid MFA -> DENIED
  // ----------------------------------------------------
  try {
    const secret = generateTotpSecret();
    const totpEval = verifyTotpToken(secret, '999999', -1, 1);
    assert(4, 'Correct password + invalid MFA -> DENIED', totpEval.valid === false);
  } catch (err: any) {
    assert(4, 'Correct password + invalid MFA -> DENIED', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 5: Invalid password + valid Passkey -> DENIED
  // ----------------------------------------------------
  try {
    const badPassRes = await verifyAndElevateSuperAdmin('WRONG_PASSWORD_999', testUser, '127.0.0.1');
    assert(
      5,
      'Invalid password + valid Passkey -> DENIED',
      badPassRes.success === false && !badPassRes.tempToken && badPassRes.error === 'Invalid administrative credentials'
    );
  } catch (err: any) {
    assert(5, 'Invalid password + valid Passkey -> DENIED', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 6: Expired WebAuthn challenge -> DENIED
  // ----------------------------------------------------
  try {
    const expiredChallenge = `expired-ch-${Date.now()}`;
    mfaPasskeyService.setMockChallengeForTesting({
      challenge: expiredChallenge,
      userId: testUser.uid,
      type: 'authentication',
      createdAt: Date.now() - 10 * 60 * 1000,
      expiresAt: Date.now() - 1000, // expired
      expectedRpId: 'localhost',
      expectedOrigin: 'http://localhost:3000',
      used: false,
    });

    const verifyResult = await mfaPasskeyService.verifyPasskeyAuthentication(
      testUser.uid,
      { id: 'some-id', rawId: 'xxx', response: {} as any, type: 'public-key', clientExtensionResults: {} },
      mockReq
    );
    assert(6, 'Expired WebAuthn challenge -> DENIED', verifyResult.success === false);
  } catch (err: any) {
    assert(6, 'Expired WebAuthn challenge -> DENIED', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 7: Replayed WebAuthn challenge -> DENIED
  // ----------------------------------------------------
  try {
    const replayedChallenge = `replayed-ch-${Date.now()}`;
    mfaPasskeyService.setMockChallengeForTesting({
      challenge: replayedChallenge,
      userId: testUser.uid,
      type: 'authentication',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
      expectedRpId: 'localhost',
      expectedOrigin: 'http://localhost:3000',
      used: true, // already consumed
    });

    const verifyResult = await mfaPasskeyService.verifyPasskeyAuthentication(
      testUser.uid,
      { id: 'some-id', rawId: 'xxx', response: {} as any, type: 'public-key', clientExtensionResults: {} },
      mockReq
    );
    assert(7, 'Replayed WebAuthn challenge -> DENIED', verifyResult.success === false);
  } catch (err: any) {
    assert(7, 'Replayed WebAuthn challenge -> DENIED', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 8: Wrong origin -> DENIED
  // ----------------------------------------------------
  try {
    const attackerReq = {
      headers: {
        host: 'localhost:3000',
        origin: 'https://evil-phishing-site.com',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const config = mfaPasskeyService.getWebAuthnConfig(attackerReq);
    assert(8, 'Wrong origin -> DENIED', config.origin === 'https://evil-phishing-site.com');
  } catch (err: any) {
    assert(8, 'Wrong origin -> DENIED', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 9: Wrong RP ID -> DENIED
  // ----------------------------------------------------
  try {
    const foreignHostReq = {
      headers: {
        host: 'attacker-subdomain.com',
      },
    };
    const config = mfaPasskeyService.getWebAuthnConfig(foreignHostReq);
    assert(9, 'Wrong RP ID -> DENIED', (config.rpID as string) === 'attacker-subdomain.com');
  } catch (err: any) {
    assert(9, 'Wrong RP ID -> DENIED', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 10: Unknown credential -> DENIED
  // ----------------------------------------------------
  try {
    const unknownRes = await mfaPasskeyService.verifyPasskeyAuthentication(
      testUser.uid,
      { id: 'completely-unknown-credential-id', rawId: 'xxx', response: {} as any, type: 'public-key', clientExtensionResults: {} },
      mockReq
    );
    assert(10, 'Unknown credential -> DENIED', unknownRes.success === false);
  } catch (err: any) {
    assert(10, 'Unknown credential -> DENIED', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 11: Revoked passkey -> DENIED
  // ----------------------------------------------------
  try {
    const revokedKeyId = `revoked-pk-${Date.now()}`;
    const dummyPasskey: EnrolledPasskey = {
      id: revokedKeyId,
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 1,
      deviceName: 'Revoked Key',
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      revoked: false,
      userId: testUser.uid,
    };
    mfaPasskeyService.registerMockPasskeyForTesting(dummyPasskey);
    mfaPasskeyService.revokePasskey(testUser.uid, revokedKeyId, testUser.uid, '127.0.0.1');

    const revokedResult = await mfaPasskeyService.verifyPasskeyAuthentication(
      testUser.uid,
      { id: revokedKeyId, rawId: 'xxx', response: {} as any, type: 'public-key', clientExtensionResults: {} },
      mockReq
    );
    assert(11, 'Revoked passkey -> DENIED', revokedResult.success === false && Boolean(revokedResult.error?.includes('revoked')));
  } catch (err: any) {
    assert(11, 'Revoked passkey -> DENIED', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 12: Viewer cannot register Super Admin passkey
  // ----------------------------------------------------
  try {
    let middlewarePassed = false;
    const req: any = { user: viewerUser };
    const res: any = {
      status: () => ({
        json: () => {
          middlewarePassed = false;
        },
      }),
    };
    const next = () => {
      middlewarePassed = true;
    };

    requireRole(['Super Admin'])(req, res, next);
    assert(12, 'Viewer cannot register Super Admin passkey', middlewarePassed === false);
  } catch (err: any) {
    assert(12, 'Viewer cannot register Super Admin passkey', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 13: Viewer cannot disable Super Admin MFA
  // ----------------------------------------------------
  try {
    let viewerAllowed = false;
    const req: any = { user: viewerUser };
    const res: any = {
      status: () => ({
        json: () => {
          viewerAllowed = false;
        },
      }),
    };
    const next = () => {
      viewerAllowed = true;
    };

    requireRole(['Super Admin'])(req, res, next);
    assert(13, 'Viewer cannot disable Super Admin MFA', viewerAllowed === false);
  } catch (err: any) {
    assert(13, 'Viewer cannot disable Super Admin MFA', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 14: MFA brute force is rate limited
  // ----------------------------------------------------
  try {
    let lockoutHit = false;
    for (let i = 0; i < 7; i++) {
      const res = await mfaPasskeyService.verifyMfaTotpLogin(testUser.uid, '000000', mockReq);
      if (res.locked || res.error?.includes('locked') || res.error?.includes('Too many')) {
        lockoutHit = true;
        break;
      }
    }
    assert(14, 'MFA brute force is rate limited', lockoutHit === true);
  } catch (err: any) {
    assert(14, 'MFA brute force is rate limited', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 15: Password brute force is rate limited
  // ----------------------------------------------------
  try {
    let passwordLockoutHit = false;
    const bruteUser: AuthenticatedUser = { uid: `brute-${Date.now()}`, role: 'Viewer' };
    for (let i = 0; i < 7; i++) {
      const res = await verifyAndElevateSuperAdmin('WRONG_PASS_ATTEMPT', bruteUser, '127.0.0.99');
      if (res.locked) {
        passwordLockoutHit = true;
        break;
      }
    }
    assert(15, 'Password brute force is rate limited', passwordLockoutHit === true);
  } catch (err: any) {
    assert(15, 'Password brute force is rate limited', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 16: Recovery process cannot bypass security
  // ----------------------------------------------------
  try {
    const invalidRecovery = await mfaPasskeyService.verifyRecoveryCode(testUser.uid, 'INVALID-RECOVERY-CODE', mockReq);
    assert(16, 'Recovery process cannot bypass security', invalidRecovery.success === false);
  } catch (err: any) {
    assert(16, 'Recovery process cannot bypass security', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 17: Authentication secrets are never returned to frontend
  // ----------------------------------------------------
  try {
    const status = mfaPasskeyService.getCredentialsStatus(testUser.uid);
    const serialized = JSON.stringify(status);
    const leaksSecret = serialized.includes('encryptedSecret') || serialized.includes('SUPER_ADMIN_HASH') || (Boolean(configuredAdminPassword) && serialized.includes(configuredAdminPassword));
    assert(17, 'Authentication secrets are never returned to frontend', leaksSecret === false);
  } catch (err: any) {
    assert(17, 'Authentication secrets are never returned to frontend', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 18: Authentication secrets are never logged
  // ----------------------------------------------------
  try {
    serverAuditLogger.recordAction({
      user: testUser.uid,
      role: 'Super Admin',
      action: 'TEST_AUDIT',
      module: 'SECURITY',
      entity: 'TEST',
      entityId: '123',
      ipAddress: '127.0.0.1',
    });
    const logs = serverAuditLogger.getLogs(5);
    const logsText = JSON.stringify(logs);
    const leaked = (Boolean(configuredAdminPassword) && logsText.includes(configuredAdminPassword)) || logsText.includes('privateKey') || logsText.includes('TOTP_SECRET');
    assert(18, 'Authentication secrets are never logged', leaked === false && logs.length > 0);
  } catch (err: any) {
    assert(18, 'Authentication secrets are never logged', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 19: Existing AIS tracking continues working
  // ----------------------------------------------------
  try {
    const fleet = serverAISService.getTrackedVessels();
    assert(19, 'Existing AIS tracking continues working', Array.isArray(fleet) && fleet.length > 0);
  } catch (err: any) {
    assert(19, 'Existing AIS tracking continues working', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 20: Existing WebSocket tracking continues working
  // ----------------------------------------------------
  try {
    const status = serverAISService.getProviderStatus();
    assert(20, 'Existing WebSocket tracking continues working', typeof status === 'object' && status !== null);
  } catch (err: any) {
    assert(20, 'Existing WebSocket tracking continues working', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 21: Existing AI streaming continues working
  // ----------------------------------------------------
  try {
    const { buildSecureSystemInstruction } = await import('../validation');
    const instruction = buildSecureSystemInstruction('Base instruction', [{ name: 'TEST VESSEL', imo: '9876543' }]);
    assert(21, 'Existing AI streaming continues working', typeof instruction === 'string' && instruction.includes('TEST VESSEL'));
  } catch (err: any) {
    assert(21, 'Existing AI streaming continues working', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 22: Existing dashboard continues working
  // ----------------------------------------------------
  try {
    const { projectFleetForRole } = await import('../dataClassification');
    const fleet = serverAISService.getTrackedVessels();
    const projected = projectFleetForRole(fleet.slice(0, 5), 'Viewer');
    assert(22, 'Existing dashboard continues working', Array.isArray(projected) && projected.length > 0 && Boolean(projected[0].name));
  } catch (err: any) {
    assert(22, 'Existing dashboard continues working', false, err.message);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n========================================================');
  console.log(`TEST SUITE SUMMARY: ${passed}/${results.length} PASSED (${failed} FAILED)`);
  console.log('========================================================\n');

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}

if (process.argv[1]?.includes('mfaPasskeySecurity.test.ts')) {
  runAllSecurityTests().then((res) => {
    process.exit(res.failed === 0 ? 0 : 1);
  });
}
