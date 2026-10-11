import React, { useState, useEffect } from 'react';
import { UserRole } from '../../types/maritime';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Fingerprint,
  Smartphone,
  Trash2,
  Plus,
  RefreshCw,
  Clock,
  Laptop,
  Check,
  AlertTriangle,
  Lock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Shield,
  Activity,
  UserCheck,
} from 'lucide-react';
import { mfaPasskeyClient, CredentialsStatus } from '../../services/mfaPasskeyClient';
import { MfaEnrollmentWizard } from './MfaEnrollmentWizard';
import { SuperAdminSecurityModal } from '../rbac/SuperAdminSecurityModal';

interface SecuritySettingsViewProps {
  currentRole: UserRole;
  onNavigateToTab?: (tabId: string) => void;
}

export const SecuritySettingsView: React.FC<SecuritySettingsViewProps> = ({
  currentRole,
  onNavigateToTab,
}) => {
  const [status, setStatus] = useState<CredentialsStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals & Wizards
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Quick Passkey Registration Inline Modal
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState<boolean>(false);
  const [passkeyLabel, setPasskeyLabel] = useState<string>('');
  const [passkeyLoading, setPasskeyLoading] = useState<boolean>(false);

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
    fetchStatus();
  }, []);

  const handleRevokePasskey = async (passkeyId: string) => {
    if (!window.confirm('Revoke this passkey credential? It will immediately stop authenticating.')) return;
    setLoading(true);
    const result = await mfaPasskeyClient.revokePasskey(passkeyId);
    setLoading(false);

    if (result.success) {
      setSuccessMsg('Passkey successfully revoked.');
      fetchStatus();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setError(result.error || 'Failed to revoke passkey');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!window.confirm('Revoke this privileged active session?')) return;
    setLoading(true);
    const result = await mfaPasskeyClient.revokeSession(sessionId);
    setLoading(false);

    if (result.success) {
      setSuccessMsg('Privileged session revoked immediately.');
      fetchStatus();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setError(result.error || 'Failed to revoke session');
    }
  };

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
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setError(result.error || 'Failed to register passkey');
    }
  };

  const handleToggleMfa = async () => {
    if (status?.mfaTotp?.enrolled) {
      if (!window.confirm('Are you sure you want to disable Authenticator App (MFA)?')) return;
      setLoading(true);
      const res = await mfaPasskeyClient.disableMfa();
      setLoading(false);
      if (res.success) {
        setSuccessMsg('MFA has been disabled.');
        fetchStatus();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(res.error || 'Failed to disable MFA');
      }
    } else {
      // Launch wizard to enroll
      setIsWizardOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-slate-900/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <span>Super Admin Security Settings</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  FIDO2 / WEBAUTHN + TOTP
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Privilege Protection · Multi-Factor Authentication · Hardware Key Management
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-950/40 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Launch MFA Wizard</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer font-bold">
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200 cursor-pointer font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Master Credential */}
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase">Primary Credential</span>
            <KeyRound className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-base font-bold text-white">PBKDF2 Master Pass</div>
          <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>Server Hash: <code className="text-emerald-300 font-bold">SHA512-VERIFIED</code></span>
          </div>
        </div>

        {/* Metric 2: MFA Status */}
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase">MFA Status</span>
            <Smartphone className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-base font-bold text-white">
            {status?.mfaTotp?.enrolled ? 'Enrolled & Active' : 'Not Enrolled'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                status?.mfaTotp?.enrolled ? 'bg-emerald-400' : 'bg-amber-400'
              } inline-block`}
            />
            <span>{status?.mfaTotp?.enrolled ? 'RFC 6238 TOTP' : 'Optional factor'}</span>
          </div>
        </div>

        {/* Metric 3: FIDO2 Passkeys */}
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase">Registered Passkeys</span>
            <Fingerprint className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-base font-bold text-white">
            {status?.passkeys?.filter((p) => !p.revoked).length || 0} Active Keys
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1.5">
            <span className="text-cyan-400 font-bold">WebAuthn / FIDO2</span>
          </div>
        </div>

        {/* Metric 4: Active Sessions */}
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase">Privileged Sessions</span>
            <Laptop className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-white">
            {status?.activeSessions?.length || 1} Active
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1.5">
            <span className="text-emerald-400 font-mono">15m sliding window</span>
          </div>
        </div>
      </div>

      {/* Section 1: Authentication Policy & Master Credential */}
      <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Primary Master Credential</h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            COMPLIANT
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          The primary Super Admin master password is cryptographically protected on the server using{' '}
          <span className="text-cyan-300 font-mono">PBKDF2-SHA512</span> with 100,000 rounds and timing-safe evaluation.
          MFA and Passkeys are additional layers for defense-in-depth and do not overwrite your primary password.
        </p>
      </div>

      {/* Section 2: Multi-Factor Authentication (TOTP) */}
      <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Authenticator App (TOTP) Multi-Factor</h3>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${
                status?.mfaTotp?.enrolled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {status?.mfaTotp?.enrolled ? 'ACTIVE' : 'DISABLED'}
            </span>
            <button
              onClick={handleToggleMfa}
              disabled={loading}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                status?.mfaTotp?.enrolled
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {status?.mfaTotp?.enrolled ? 'Disable MFA' : 'Enable MFA'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Generate rotating 6-digit codes with standard authenticator applications (Google Authenticator, Authy, Apple Keychain, 1Password). Secrets are encrypted at rest with AES-256-GCM.
        </p>

        {status?.recoveryCodes && (
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 font-mono">
                Emergency Backup Recovery Codes:
              </span>
              <span className="font-bold text-amber-300">
                {status.recoveryCodes.remaining} of {status.recoveryCodes.total} remaining
              </span>
            </div>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono underline cursor-pointer"
            >
              Regenerate Codes
            </button>
          </div>
        )}
      </div>

      {/* Section 3: Registered FIDO2 / WebAuthn Passkeys */}
      <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Registered FIDO2 / WebAuthn Passkeys</h3>
          </div>
          <button
            onClick={() => setIsRegisteringPasskey(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register New Passkey</span>
          </button>
        </div>

        {/* Inline Registration Form */}
        {isRegisteringPasskey && (
          <form
            onSubmit={handleStartPasskeyRegistration}
            className="p-4 bg-slate-950/80 border border-cyan-500/40 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-cyan-400" />
                Register Authenticator / Security Key
              </span>
              <button
                type="button"
                onClick={() => setIsRegisteringPasskey(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={passkeyLabel}
                onChange={(e) => setPasskeyLabel(e.target.value)}
                placeholder="Device Name (e.g., YubiKey 5C NFC / MacBook TouchID)"
                autoFocus
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg text-xs text-white outline-none"
              />
              <button
                type="submit"
                disabled={passkeyLoading}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {passkeyLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Start Ceremony</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Insert your security key or trigger biometric prompt when requested by your operating system.
            </p>
          </form>
        )}

        {/* Passkeys Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Device / Key Label</th>
                <th className="px-4 py-3">Credential ID</th>
                <th className="px-4 py-3">Registered Date</th>
                <th className="px-4 py-3">Last Used</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {status?.passkeys && status.passkeys.length > 0 ? (
                status.passkeys.map((pk) => (
                  <tr key={pk.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-sans font-medium text-white flex items-center gap-2">
                      <Fingerprint className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{pk.deviceName || 'Security Key'}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      <code>{pk.id.slice(0, 16)}...</code>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(pk.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      {pk.revoked ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          REVOKED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!pk.revoked && (
                        <button
                          onClick={() => handleRevokePasskey(pk.id)}
                          disabled={loading}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[11px] font-semibold cursor-pointer transition-all"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No hardware passkeys registered yet. Click &quot;Register New Passkey&quot; to enroll your YubiKey or TouchID.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Active Privileged Sessions */}
      <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Active Privileged Sessions</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Auto-expires on 15m inactivity
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Session Token Prefix</th>
                <th className="px-4 py-3">Auth Factors</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">User Agent / Client</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {status?.activeSessions && status.activeSessions.length > 0 ? (
                status.activeSessions.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-white font-mono text-[11px]">
                      <code>{s.sessionPrefix}...</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {s.factors.map((f, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          >
                            {f.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">{s.ipAddress}</td>
                    <td className="px-4 py-3 text-slate-400 text-[11px] max-w-xs truncate">
                      {s.userAgent || 'Web Console'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {Math.max(0, Math.round((s.expiresAt - Date.now()) / 60000))}m remaining
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRevokeSession(s.sessionPrefix)}
                        disabled={loading}
                        className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[11px] font-semibold cursor-pointer transition-all"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-slate-500">
                    Active session active on current browser.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MFA Wizard Modal */}
      <MfaEnrollmentWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={() => {
          fetchStatus();
        }}
      />

      {/* Fallback SuperAdminSecurityModal */}
      <SuperAdminSecurityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCredentialsUpdated={fetchStatus}
      />
    </div>
  );
};
