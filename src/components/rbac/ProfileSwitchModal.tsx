import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserRole } from '../../types/maritime';
import { profileSwitchService, TemporaryProfileSession } from '../../services/profileSwitchService';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Clock,
  KeyRound,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Lock,
  ArrowRight,
  Info,
} from 'lucide-react';

interface ProfileSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onRoleChanged?: (newRole: UserRole) => void;
  initialTargetRole?: UserRole;
}

interface RoleOption {
  role: UserRole;
  title: string;
  desc: string;
  isElevated: boolean;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'Super Admin',
    title: 'Platform Root Administrator',
    desc: 'Full system privileges: Ingestion feeds, encryption keys, RBAC governance & audit export.',
    isElevated: true,
  },
  {
    role: 'Compliance Officer',
    title: 'Senior Compliance & Sanctions Officer',
    desc: 'Statutory vessel adjudication, AML/KYC review, UBO investigations & legal holds.',
    isElevated: false,
  },
  {
    role: 'Risk Analyst',
    title: 'Maritime Intelligence Threat Analyst',
    desc: 'Neural risk score adjudication, anomaly investigations & dark fleet tracking.',
    isElevated: false,
  },
  {
    role: 'Operations Manager',
    title: 'Fleet Operations Controller',
    desc: 'Live telemetry monitoring, waypoint planning, voyage coordination & vessel dispatch.',
    isElevated: false,
  },
  {
    role: 'Vessel Analyst',
    title: 'Technical Vessel Specialist',
    desc: 'Vessel registry enrollment, specifications dossier management & survey reports.',
    isElevated: false,
  },
  {
    role: 'Investigator',
    title: 'Forensic Maritime Investigator',
    desc: 'Sanctions analysis, AIS gap investigations, spoofing forensics & dossier reports.',
    isElevated: false,
  },
  {
    role: 'Auditor',
    title: 'Statutory Compliance Auditor',
    desc: 'Read-only access to statutory compliance records, immutable ledger & KYC registers.',
    isElevated: false,
  },
  {
    role: 'Viewer',
    title: 'Maritime Observer',
    desc: 'Telemetry viewing, public map tracking and standard statutory registry browsing.',
    isElevated: false,
  },
];

const DURATION_OPTIONS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1 Hour', minutes: 60 },
  { label: '4 Hours', minutes: 240 },
  { label: '8 Hours', minutes: 480 },
];

export const ProfileSwitchModal: React.FC<ProfileSwitchModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  onRoleChanged,
  initialTargetRole,
}) => {
  const [targetRole, setTargetRole] = useState<UserRole>(initialTargetRole || currentRole);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [reason, setReason] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<TemporaryProfileSession | null>(null);
  const baseRole = profileSwitchService.getBaseRole();

  useEffect(() => {
    if (initialTargetRole) {
      setTargetRole(initialTargetRole);
    }
    setSession(profileSwitchService.getSession());
    setErrorMessage(null);
    setPasswordInput('');
  }, [isOpen, initialTargetRole]);

  if (!isOpen) return null;

  const handleSwitchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await profileSwitchService.switchProfile(targetRole, {
        durationMinutes,
        reason: reason.trim() || `Operational switch to ${targetRole}`,
        password: targetRole === 'Super Admin' ? passwordInput : undefined,
      });

      if (result.success) {
        if (onRoleChanged) {
          onRoleChanged(result.activeProfile);
        }
        onClose();
      } else {
        setErrorMessage(result.error || 'Failed to switch active profile.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during profile switch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevert = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await profileSwitchService.revertToBaseRole('Manual operator revert');
      if (onRoleChanged) {
        onRoleChanged(res.activeProfile);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to revert to base role.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTemporary = profileSwitchService.isTemporaryActive();
  const timeRemainingSeconds = profileSwitchService.getTimeRemainingSeconds();
  const timeRemainingMin = Math.ceil(timeRemainingSeconds / 60);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Secure Profile Switch Layer</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono border border-cyan-500/40">
                  CENTRALIZED RBAC
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Temporary Operational Profile Delegation · Re-Authentication & Immutable Audit Trail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Posture Summary */}
        <div className="px-5 py-3 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">BASE IDENTITY:</span>
            <span className="text-slate-300 font-bold px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
              {baseRole}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">ACTIVE PROFILE:</span>
            <span className="text-cyan-300 font-bold px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/40 rounded">
              {currentRole}
            </span>
            {isTemporary && (
              <span className="text-amber-400 text-[11px] font-bold">
                ({timeRemainingMin}m remaining)
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSwitchSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Select Target Profile */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
              Target Operational Profile
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {ROLE_OPTIONS.map((item) => {
                const isSelected = targetRole === item.role;
                const isCurrent = currentRole === item.role;
                return (
                  <button
                    type="button"
                    key={item.role}
                    onClick={() => setTargetRole(item.role)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-400 text-white shadow-md shadow-cyan-950/30 ring-1 ring-cyan-400'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        {item.role}
                        {item.isElevated && (
                          <span title="Requires Master Credentials">
                            <Lock className="w-3 h-3 text-amber-400" />
                          </span>
                        )}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] text-cyan-400 font-mono">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* If Super Admin is selected, prompt for credentials */}
          {targetRole === 'Super Admin' && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 font-mono">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Super Admin Elevation Re-Authentication Required</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Switching to Super Admin grants root control over all maritime system policies. Enter the server-configured master password to authorize this elevation.
              </p>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter Super Admin Password..."
                className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
          )}

          {/* Duration Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Session Duration</span>
              </label>
              <div className="flex items-center gap-1.5">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    type="button"
                    key={d.label}
                    onClick={() => setDurationMinutes(d.minutes)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-mono font-semibold transition-all ${
                      durationMinutes === d.minutes
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Operational Justification</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Incident triage, KYC review..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {/* Audit Notice */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              Profile switches are temporary and authoritatively logged to the tamper-evident audit ledger.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
            {isTemporary ? (
              <button
                type="button"
                onClick={handleRevert}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Revert to Base Role ({baseRole})</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || targetRole === currentRole}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                  targetRole === currentRole
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-extrabold cursor-pointer shadow-cyan-950/40'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Verifying...' : `Switch to ${targetRole}`}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
