import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UserRole } from '../../types/maritime';
import {
  rbacService,
  SYSTEM_ROLES,
  SystemFeature,
  DEFAULT_ROLE_PERMISSIONS,
} from '../../services/rbacService';
import { useAuth } from '../common/FirebaseAuthProvider';
import { mfaPasskeyClient } from '../../services/mfaPasskeyClient';
import { SuperAdminSecurityModal } from './SuperAdminSecurityModal';
import { MfaEnrollmentWizard } from '../security/MfaEnrollmentWizard';
import {
  Lock,
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  RotateCcw,
  AlertTriangle,
  Clock,
  Eye,
  KeyRound,
  Fingerprint,
  Smartphone,
  Shield,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface HiddenPrivilegePanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
}

const FEATURE_METADATA: { id: SystemFeature; label: string; description: string }[] = [
  { id: 'vessel_registry', label: 'Vessel Registry', description: 'Access to manage and add vessels to the registry' },
  { id: 'dashboard_ais_feed', label: 'AIS Feed Ingestion', description: 'Real-time raw AIS packet telemetry terminal on dashboard' },
  { id: 'dashboard_priority_risk', label: 'Priority Risk Targets', description: 'Priority risk vessel queue on main command dashboard' },
  { id: 'dashboard_ais_anomalies', label: 'AIS Anomalies Section', description: 'Live anomaly detection stream on dashboard' },
  { id: 'kyc_aml_compliance', label: 'KYC & AML Compliance', description: 'Beneficial ownership and sanctions screening dossiers' },
  { id: 'ais_anomalies_view', label: 'AIS Anomalies Tab', description: 'Full dedicated AIS anomaly investigation workbench' },
  { id: 'reports_view', label: 'Compliance Reports View', description: 'Access to tabular groups and vessel compliance dossiers' },
  { id: 'reports_export', label: 'Reports Export', description: 'Ability to export CSV / Formatted PDF logbooks' },
  { id: 'reports_edit_status', label: 'Approve / Edit KYC Status', description: 'Authorize and sign off on vessel KYC & AML clearance' },
  { id: 'onsite_incident_alerts', label: 'On-Site Incident Alerts', description: 'Receive war hazard and critical on-site maritime alerts' },
  { id: 'ai_chat_access', label: 'Maritime AI Copilot', description: 'Access to the discreet AI assistant corner tool' },
];

export const HiddenPrivilegePanelModal: React.FC<HiddenPrivilegePanelModalProps> = ({
  isOpen,
  onClose,
  currentRole,
}) => {
  const { user } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<{ role: UserRole; feature: SystemFeature; enabled: boolean } | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(300); // 5 minutes (300 seconds)

  // Two-Stage MFA/Passkey state
  const [authStage, setAuthStage] = useState<'password' | 'mfa_required'>('password');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [mfaMethod, setMfaMethod] = useState<'passkey' | 'totp' | 'recovery'>('passkey');
  const [passkeyEnrolled, setPasskeyEnrolled] = useState(false);
  const [totpEnrolled, setTotpEnrolled] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Inactivity timeout handling
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSecurityModalOpen && !isWizardOpen) {
        handleLogout();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isSecurityModalOpen]);

  useEffect(() => {
    if (!isOpen || !isAuthenticated) {
      setSessionTimeLeft(300);
      return;
    }

    const interval = setInterval(() => {
      setSessionTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => {
            handleLogout();
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isAuthenticated]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthStage('password');
    setTempToken(null);
    setPasswordInput('');
    setPasswordError(null);
    setOtpInput('');
    setRecoveryInput('');
    setPendingChange(null);
    setShowConfirmReset(false);
    setTimeout(() => {
      onClose();
    }, 0);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setMfaSubmitting(true);

    const res = await rbacService.verifySuperAdminCredentials(passwordInput);
    setMfaSubmitting(false);

    if (res.mfaRequired) {
      setAuthStage('mfa_required');
      setTempToken(res.tempToken || null);
      setPasskeyEnrolled(Boolean(res.passkeyEnrolled));
      setTotpEnrolled(Boolean(res.totpEnrolled));
      if (res.passkeyEnrolled && mfaPasskeyClient.isWebAuthnSupported()) {
        setMfaMethod('passkey');
      } else {
        setMfaMethod('totp');
      }
    } else if (res.success) {
      setIsAuthenticated(true);
      setSessionTimeLeft(300);
      setPasswordInput('');
      rbacService.logAuditAction({
        user: user?.uid || 'super-admin-root',
        role: 'Super Admin',
        action: 'AUTHENTICATE_PRIVILEGE_PANEL',
        module: 'SECURITY',
        entity: 'SUPER_ADMIN_PANEL',
        entityId: 'PANEL_ACCESS',
        previousState: 'Locked',
        newState: 'Unlocked (5m Session)',
      });
    } else {
      setPasswordError(res.error || 'Invalid Super Admin credentials. Access denied.');
      rbacService.logAuditAction({
        user: user?.uid || 'unknown-attempt',
        role: currentRole,
        action: 'FAILED_PRIVILEGE_PANEL_AUTH',
        module: 'SECURITY',
        entity: 'SUPER_ADMIN_PANEL',
        entityId: 'AUTH_FAILURE',
        previousState: 'Locked',
        newState: 'Locked',
      });
    }
  };

  const handlePasskeySubmit = async () => {
    setMfaSubmitting(true);
    setPasswordError(null);

    const result = await mfaPasskeyClient.loginWithPasskey(tempToken || undefined, user?.uid);
    setMfaSubmitting(false);

    if (result.success) {
      setIsAuthenticated(true);
      setAuthStage('password');
      setSessionTimeLeft(300);
      setPasswordInput('');
    } else {
      setPasswordError(result.error || 'Passkey verification failed');
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim() || otpInput.trim().length !== 6) {
      setPasswordError('Please enter a 6-digit code');
      return;
    }

    setMfaSubmitting(true);
    setPasswordError(null);

    const result = await mfaPasskeyClient.verifyMfaTotp(otpInput.trim(), tempToken || undefined);
    setMfaSubmitting(false);

    if (result.success) {
      setIsAuthenticated(true);
      setAuthStage('password');
      setSessionTimeLeft(300);
      setPasswordInput('');
    } else {
      setPasswordError(result.error || 'Invalid 6-digit authenticator code');
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryInput.trim()) {
      setPasswordError('Please enter a recovery code');
      return;
    }

    setMfaSubmitting(true);
    setPasswordError(null);

    const result = await mfaPasskeyClient.verifyRecoveryCode(recoveryInput.trim(), tempToken || undefined);
    setMfaSubmitting(false);

    if (result.success) {
      setIsAuthenticated(true);
      setAuthStage('password');
      setSessionTimeLeft(300);
      setPasswordInput('');
    } else {
      setPasswordError(result.error || 'Invalid recovery code');
    }
  };

  const handleTogglePermission = (role: UserRole, feature: SystemFeature) => {
    const current = rbacService.hasPermission(role, feature);
    setPendingChange({ role, feature, enabled: !current });
  };

  const handleConfirmChange = () => {
    if (!pendingChange) return;
    const { role, feature, enabled } = pendingChange;
    const currentFeatures = rbacService.getRolePermissions(role);
    let updated: SystemFeature[];
    if (enabled) {
      updated = Array.from(new Set([...currentFeatures, feature]));
    } else {
      updated = currentFeatures.filter((f) => f !== feature);
    }

    rbacService.updateRolePermissions(role, updated, user?.uid || 'super-admin');
    setPendingChange(null);
  };

  const handleResetDefaults = () => {
    rbacService.resetToDefault(user?.uid || 'super-admin');
    setShowConfirmReset(false);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleLogout();
      }}
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
      style={{ margin: 0 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#090f1d] border border-cyan-500/50 rounded-2xl w-full my-auto shadow-2xl overflow-hidden relative flex flex-col transition-all duration-300 ${
          isAuthenticated ? 'max-w-5xl max-h-[88vh]' : 'max-w-md'
        }`}
      >
        {/* Header Bar */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-rose-600 to-amber-600 rounded-xl text-white shadow-lg shadow-rose-950/40">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
                  Super Admin Panel
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  CONFIDENTIAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Direct security governance · Real-time privilege overrides · Cryptographically audited
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Timeout: {Math.floor(sessionTimeLeft / 60)}:
                  {(sessionTimeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="px-2.5 py-1 text-slate-300 hover:text-white rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Close window"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </div>

        {/* Content: Password Prompt or MFA Step or Privilege Grid */}
        <div className="p-6 overflow-y-auto flex-1">
          {!isAuthenticated ? (
            authStage === 'mfa_required' ? (
              <div className="w-full text-center space-y-4 py-2 max-w-md mx-auto">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xl">
                  {mfaMethod === 'passkey' ? (
                    <Fingerprint className="w-7 h-7" />
                  ) : mfaMethod === 'totp' ? (
                    <Smartphone className="w-7 h-7" />
                  ) : (
                    <KeyRound className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <h4 className="text-base font-bold text-white mb-1">Second-Factor Verification</h4>
                  <p className="text-xs text-slate-400">
                    Master password verified. Complete multi-factor challenge to elevate session.
                  </p>
                </div>

                {/* Factor Selection Tabs */}
                <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs font-mono">
                  {passkeyEnrolled && (
                    <button
                      type="button"
                      onClick={() => {
                        setMfaMethod('passkey');
                        setPasswordError(null);
                      }}
                      className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        mfaMethod === 'passkey'
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>Passkey</span>
                    </button>
                  )}

                  {totpEnrolled && (
                    <button
                      type="button"
                      onClick={() => {
                        setMfaMethod('totp');
                        setPasswordError(null);
                      }}
                      className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        mfaMethod === 'totp'
                          ? 'bg-teal-500/20 text-teal-300 font-bold border border-teal-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>App Code</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMfaMethod('recovery');
                      setPasswordError(null);
                    }}
                    className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      mfaMethod === 'recovery'
                        ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Recovery Code</span>
                  </button>
                </div>

                {/* Method Form: Passkey */}
                {mfaMethod === 'passkey' && (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Authenticate with Touch ID, Windows Hello, device passkey, or hardware security key.
                    </p>

                    <button
                      type="button"
                      disabled={mfaSubmitting}
                      onClick={handlePasskeySubmit}
                      className="w-full py-3 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {mfaSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Verifying Biometric Passkey...</span>
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-4 h-4" />
                          <span>Verify with Passkey</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Method Form: TOTP */}
                {mfaMethod === 'totp' && (
                  <form onSubmit={handleTotpSubmit} className="space-y-3 pt-2">
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      required
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit code"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-center text-base tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono"
                    />

                    <button
                      type="submit"
                      disabled={mfaSubmitting || otpInput.length !== 6}
                      className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-500 hover:to-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {mfaSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying Code...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Verify Authenticator Code</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Method Form: Recovery Code */}
                {mfaMethod === 'recovery' && (
                  <form onSubmit={handleRecoverySubmit} className="space-y-3 pt-2">
                    <input
                      type="text"
                      autoFocus
                      required
                      value={recoveryInput}
                      onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
                      placeholder="XXXX-XXXX-XXXX"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs tracking-wider text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />

                    <button
                      type="submit"
                      disabled={mfaSubmitting || !recoveryInput.trim()}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {mfaSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying Recovery Code...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Verify Recovery Code</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                {passwordError && (
                  <p className="text-rose-400 text-xs font-mono flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{passwordError}</span>
                  </p>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStage('password');
                      setPasswordError(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 font-mono underline transition-colors"
                  >
                    ← Back to Master Password
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full text-center space-y-4 py-2 max-w-md mx-auto">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-xl">
                  <KeyRound className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white mb-1">Super Admin Authentication</h4>
                  <p className="text-xs text-slate-400">
                    Enter master credential to access administrative privilege matrix
                  </p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-2">
                  <div>
                    <input
                      type="password"
                      autoFocus
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter Master Password..."
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono text-center"
                    />
                    {passwordError && (
                      <p className="text-rose-400 text-xs mt-2 font-mono flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{passwordError}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-1/3 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Close Window
                    </button>
                    <button
                      type="submit"
                      disabled={mfaSubmitting}
                      className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950/50 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {mfaSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <span>Verify & Continue</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )
          ) : (
            <div className="space-y-6">
              {/* Top Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono text-slate-300">
                    Administrator Session Active ({SYSTEM_ROLES.length} Roles Defined)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsWizardOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/40 hover:to-blue-600/40 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    title="Launch guided MFA & Passkey Enrollment Wizard"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>MFA & Passkey Wizard</span>
                  </button>
                  <button
                    onClick={() => setIsSecurityModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Security & Passkeys</span>
                  </button>
                  <button
                    onClick={() => setShowConfirmReset(true)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Default</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Close Window</span>
                  </button>
                </div>
              </div>

              {/* Privilege Matrix Table */}
              <div className="rounded-xl border border-slate-800 overflow-x-auto bg-slate-950/60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                      <th className="p-3 sticky left-0 bg-slate-900 z-10 min-w-[200px]">System Feature</th>
                      {SYSTEM_ROLES.map((r) => (
                        <th key={r} className="p-3 text-center min-w-[120px]">
                          {r}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-sans">
                    {FEATURE_METADATA.map((feat) => (
                      <tr key={feat.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 sticky left-0 bg-[#090f1d] z-10 border-r border-slate-800/80">
                          <span className="font-bold text-white block">{feat.label}</span>
                          <span className="text-[11px] text-slate-500 leading-tight block">
                            {feat.description}
                          </span>
                        </td>
                        {SYSTEM_ROLES.map((r) => {
                          const hasIt = rbacService.hasPermission(r, feat.id);
                          return (
                            <td key={r} className="p-3 text-center">
                              <button
                                onClick={() => handleTogglePermission(r, feat.id)}
                                className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all ${
                                  hasIt
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40'
                                    : 'bg-slate-900 text-slate-600 border border-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40'
                                }`}
                                title={`${hasIt ? 'Revoke' : 'Grant'} ${feat.label} for ${r}`}
                              >
                                {hasIt ? <Check className="w-4 h-4 font-bold" /> : <X className="w-4 h-4" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Change Confirmation Modal */}
        {pendingChange && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-500/60 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-bold text-sm text-white">Confirm Privilege Alteration</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to{' '}
                <strong className={pendingChange.enabled ? 'text-emerald-400' : 'text-rose-400'}>
                  {pendingChange.enabled ? 'GRANT' : 'REVOKE'}
                </strong>{' '}
                <code className="text-cyan-300 bg-slate-950 px-1 py-0.5 rounded font-mono">
                  {pendingChange.feature}
                </code>{' '}
                for role <strong className="text-white">{pendingChange.role}</strong>? This change takes effect immediately and will be logged in the immutable security audit store.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setPendingChange(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmChange}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-950/40"
                >
                  Confirm & Apply Override
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Confirmation Modal */}
        {showConfirmReset && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-rose-500/60 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-bold text-sm text-white">Reset Baseline Permissions</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                This will revert all 6 system roles to the default immutable platform security matrix. All custom overrides will be discarded.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetDefaults}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/40"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Super Admin Security, Passkeys & MFA Modal */}
        <SuperAdminSecurityModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
        />

        {/* Guided MFA & Passkey Enrollment Wizard */}
        <MfaEnrollmentWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
        />
      </div>
    </div>,
    document.body
  );
};
