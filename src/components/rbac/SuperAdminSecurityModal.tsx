import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Fingerprint,
  Smartphone,
  Trash2,
  Plus,
  X,
  Check,
  Copy,
  Download,
  AlertTriangle,
  RefreshCw,
  Laptop,
  Clock,
  Lock,
} from 'lucide-react';
import { mfaPasskeyClient, CredentialsStatus, MfaSetupData } from '../../services/mfaPasskeyClient';
import { SafeSvgRenderer } from '../common/SafeSvgRenderer';

interface SuperAdminSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCredentialsUpdated?: () => void;
}

export const SuperAdminSecurityModal: React.FC<SuperAdminSecurityModalProps> = ({
  isOpen,
  onClose,
  onCredentialsUpdated,
}) => {
  const [status, setStatus] = useState<CredentialsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Passkey registration state
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);
  const [passkeyLabel, setPasskeyLabel] = useState('');
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // MFA TOTP setup wizard state
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false);
  const [mfaData, setMfaData] = useState<MfaSetupData | null>(null);
  const [confirmOtp, setConfirmOtp] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [hasCopiedCodes, setHasCopiedCodes] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mfaPasskeyClient.getCredentialsStatus();
      setStatus(data);
    } catch {
      setError('Unable to load security credential status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setIsRegisteringPasskey(false);
      setIsSettingUpMfa(false);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const handleStartPasskeyRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = passkeyLabel.trim() || 'Hardware Passkey';
    setPasskeyLoading(true);
    setError(null);

    const result = await mfaPasskeyClient.registerPasskey(label);
    setPasskeyLoading(false);

    if (result.success) {
      setSuccessMsg(`Passkey '${label}' registered and cryptographically bound.`);
      setIsRegisteringPasskey(false);
      setPasskeyLabel('');
      fetchStatus();
      onCredentialsUpdated?.();
    } else {
      setError(result.error || 'Failed to register passkey');
    }
  };

  const handleRevokePasskey = async (passkeyId: string) => {
    if (!window.confirm('Revoke this passkey credential? It will immediately stop authenticating.')) return;
    setLoading(true);
    const result = await mfaPasskeyClient.revokePasskey(passkeyId);
    setLoading(false);

    if (result.success) {
      setSuccessMsg('Passkey successfully revoked.');
      fetchStatus();
      onCredentialsUpdated?.();
    } else {
      setError(result.error || 'Failed to revoke passkey');
    }
  };

  const handleStartMfaSetup = async () => {
    setMfaLoading(true);
    setError(null);
    const result = await mfaPasskeyClient.setupMfaInit();
    setMfaLoading(false);

    if (result.success && result.data) {
      setMfaData(result.data);
      setIsSettingUpMfa(true);
      setConfirmOtp('');
      setHasCopiedCodes(false);
    } else {
      setError(result.error || 'Failed to initialize MFA wizard');
    }
  };

  const handleConfirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmOtp.trim() || confirmOtp.trim().length !== 6) {
      setError('Please enter a valid 6-digit confirmation code from your authenticator app.');
      return;
    }

    setMfaLoading(true);
    setError(null);
    const result = await mfaPasskeyClient.setupMfaConfirm(confirmOtp.trim());
    setMfaLoading(false);

    if (result.success) {
      setSuccessMsg('Authenticator App (TOTP) successfully enrolled with backup recovery codes.');
      setIsSettingUpMfa(false);
      setMfaData(null);
      fetchStatus();
      onCredentialsUpdated?.();
    } else {
      setError(result.error || 'Invalid 6-digit confirmation code. Please check device time.');
    }
  };

  const handleDisableMfa = async () => {
    if (!window.confirm('Are you sure you want to disable Authenticator App (MFA)?')) return;
    setLoading(true);
    const result = await mfaPasskeyClient.disableMfa();
    setLoading(false);

    if (result.success) {
      setSuccessMsg('Authenticator App MFA has been disabled.');
      fetchStatus();
      onCredentialsUpdated?.();
    } else {
      setError(result.error || 'Failed to disable MFA');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setLoading(true);
    const result = await mfaPasskeyClient.revokeSession(sessionId);
    setLoading(false);

    if (result.success) {
      setSuccessMsg('Privileged session revoked.');
      fetchStatus();
    } else {
      setError(result.error || 'Failed to revoke session');
    }
  };

  const handleCopyRecoveryCodes = () => {
    if (!mfaData?.recoveryCodes) return;
    const text = mfaData.recoveryCodes.join('\n');
    navigator.clipboard.writeText(text);
    setHasCopiedCodes(true);
    setTimeout(() => setHasCopiedCodes(false), 3000);
  };

  const handleDownloadRecoveryCodes = () => {
    if (!mfaData?.recoveryCodes) return;
    const text = `OCEANIQ MARITIME COMMAND — SUPER ADMIN RECOVERY CODES\nGenerated: ${new Date().toISOString()}\n\nEach code can only be used once for emergency account elevation.\n\n` +
      mfaData.recoveryCodes.map((c, i) => `${(i + 1).toString().padStart(2, '0')}. ${c}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oceaniq-super-admin-recovery-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Super Admin Security & Credentials
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  FIDO2 / WEBAUTHN + TOTP
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-Factor Authentication, Hardware Passkeys & Session Hardening
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Master Password Requirement Notice */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 flex items-start gap-3">
            <KeyRound className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-slate-400">
              <span className="font-semibold text-white">Super Admin Credential Policy:</span> The master password is cryptographically salted and verified server-side. Passkeys and Authenticator App MFA provide a mandatory, phishing-resistant second layer for privileged operations.
            </div>
          </div>

          {/* Section 1: FIDO2 / WebAuthn Passkeys */}
          <div className="bg-slate-950/40 rounded-xl p-5 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="w-4 h-4 text-cyan-400" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Hardware Passkeys & WebAuthn
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Phishing-resistant biometrics, Touch ID, Windows Hello, and YubiKeys
                  </p>
                </div>
              </div>

              {!isRegisteringPasskey && (
                <button
                  onClick={() => {
                    setIsRegisteringPasskey(true);
                    setPasskeyLabel('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Passkey</span>
                </button>
              )}
            </div>

            {/* Passkey Registration Sub-form */}
            {isRegisteringPasskey && (
              <form onSubmit={handleStartPasskeyRegistration} className="bg-slate-900 p-4 rounded-xl border border-cyan-500/40 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="font-bold text-white text-xs">New Passkey Registration</span>
                  <button
                    type="button"
                    onClick={() => setIsRegisteringPasskey(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Device / Authenticator Name
                  </label>
                  <input
                    type="text"
                    value={passkeyLabel}
                    onChange={(e) => setPasskeyLabel(e.target.value)}
                    placeholder="e.g. MacBook Pro Touch ID or YubiKey 5"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRegisteringPasskey(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passkeyLoading}
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {passkeyLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Prompting Authenticator...</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span>Activate Passkey Prompt</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* List of Registered Passkeys */}
            <div className="space-y-2">
              {status?.passkeys && status.passkeys.length > 0 ? (
                status.passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      pk.revoked
                        ? 'bg-slate-950/30 border-slate-900 opacity-50'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Fingerprint className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{pk.deviceName}</span>
                          {pk.revoked ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              REVOKED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-3 mt-0.5">
                          <span>Enrolled: {new Date(pk.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>Last Used: {new Date(pk.lastUsedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {!pk.revoked && (
                      <button
                        onClick={() => handleRevokePasskey(pk.id)}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 transition-all cursor-pointer"
                        title="Revoke passkey"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Revoke</span>
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No FIDO2 passkeys enrolled yet. Register a platform passkey or YubiKey for instant 1-click biometric elevation.
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Authenticator App (RFC 6238 TOTP) */}
          <div className="bg-slate-950/40 rounded-xl p-5 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-teal-400" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Authenticator App (TOTP)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Standard 6-digit rolling code (Google Authenticator, 1Password, Authy)
                  </p>
                </div>
              </div>

              {status?.mfaTotp.enrolled ? (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>ENROLLED</span>
                  </span>
                  <button
                    onClick={handleDisableMfa}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition-all cursor-pointer"
                  >
                    Disable
                  </button>
                </div>
              ) : (
                !isSettingUpMfa && (
                  <button
                    onClick={handleStartMfaSetup}
                    disabled={mfaLoading}
                    className="px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Configure TOTP App</span>
                  </button>
                )
              )}
            </div>

            {/* MFA Setup Wizard */}
            {isSettingUpMfa && mfaData && (
              <form onSubmit={handleConfirmMfa} className="bg-slate-900 p-4 rounded-xl border border-teal-500/40 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-bold text-white text-xs">MFA Setup Wizard</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingUpMfa(false);
                      setMfaData(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  {/* QR Code and Secret */}
                  <div className="flex flex-col items-center bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                    <div className="w-44 h-44 mb-3 flex items-center justify-center bg-white rounded-lg p-2 overflow-hidden">
                      <SafeSvgRenderer
                        svgContent={mfaData.qrSvg}
                        className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                        title="Authenticator App QR Code"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mb-1">Or enter manual key:</span>
                    <div className="bg-slate-900 px-3 py-1.5 rounded border border-slate-800 font-mono text-[11px] text-cyan-300 select-all max-w-full overflow-x-auto">
                      {mfaData.secret}
                    </div>
                  </div>

                  {/* Recovery Codes & Verification */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-white text-[11px]">One-Time Recovery Codes (10)</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyRecoveryCodes}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{hasCopiedCodes ? 'Copied!' : 'Copy'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadRecoveryCodes}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-300 max-h-28 overflow-y-auto">
                        {mfaData.recoveryCodes.map((code, idx) => (
                          <div key={idx} className="truncate">
                            <span className="text-slate-500 mr-1.5">{idx + 1}.</span>
                            {code}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-amber-300/80 mt-1">
                        Store these backup codes safely. They can restore access if you lose your phone.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1 font-semibold">
                        Enter 6-digit code to verify setup:
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={confirmOtp}
                        onChange={(e) => setConfirmOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-center text-sm font-mono tracking-widest text-white focus:outline-none focus:border-teal-500"
                        autoFocus
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingUpMfa(false);
                      setMfaData(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mfaLoading || confirmOtp.length !== 6}
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-500 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {mfaLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Activate MFA</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Status Summary */}
            {status?.mfaTotp.enrolled && (
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                <div className="text-slate-400">
                  <span>Enrolled: {new Date(status.mfaTotp.enrolledAt || '').toLocaleDateString()}</span>
                  <span className="mx-2">•</span>
                  <span>Unused Recovery Codes: <strong className="text-white">{status.recoveryCodes.remaining} of {status.recoveryCodes.total}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Active Privileged Sessions */}
          <div className="bg-slate-950/40 rounded-xl p-5 border border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2.5">
              <Laptop className="w-4 h-4 text-cyan-400" />
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Active Privileged Sessions
                </h4>
                <p className="text-[11px] text-slate-400">
                  Cryptographically signed elevated sessions currently active
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {status?.activeSessions && status.activeSessions.length > 0 ? (
                status.activeSessions.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-white">
                        <span>{s.sessionPrefix}</span>
                        <span className="text-cyan-400 font-semibold">[{s.factors.join(' + ')}]</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        <span>IP: {s.ipAddress}</span>
                        <span className="mx-2">•</span>
                        <span>Created: {new Date(s.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevokeSession(s.sessionPrefix)}
                      className="px-2.5 py-1 text-[10px] rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition-all cursor-pointer"
                    >
                      Revoke
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-xs py-2">
                  No secondary active sessions.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Zero-Trust + Defense In Depth</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
