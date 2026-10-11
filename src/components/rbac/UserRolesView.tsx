import React, { useState, useEffect, useCallback } from 'react';
import { UserRole } from '../../types/maritime';
import { Users, Shield, ShieldCheck, Check, Lock, CheckCircle, KeyRound, Clock, RotateCcw } from 'lucide-react';
import { HiddenPrivilegePanelModal } from './HiddenPrivilegePanelModal';
import { SuperAdminSecurityModal } from './SuperAdminSecurityModal';
import { ProfileSwitchModal } from './ProfileSwitchModal';
import { profileSwitchService, TemporaryProfileSession } from '../../services/profileSwitchService';

interface UserRolesViewProps {
  currentRole: UserRole;
  onRoleChange: (newRole: UserRole) => void;
  onNavigateToTab?: (tabId: string) => void;
}

export const UserRolesView: React.FC<UserRolesViewProps> = ({ currentRole, onRoleChange, onNavigateToTab }) => {
  const [isPrivilegePanelOpen, setIsPrivilegePanelOpen] = useState<boolean>(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [isProfileSwitchModalOpen, setIsProfileSwitchModalOpen] = useState<boolean>(false);
  const [switchTargetRole, setSwitchTargetRole] = useState<UserRole | undefined>(undefined);
  const [session, setSession] = useState<TemporaryProfileSession | null>(() => profileSwitchService.getSession());

  useEffect(() => {
    const unsub = profileSwitchService.subscribe((_p, s) => {
      setSession(s);
    });
    return unsub;
  }, []);

  const baseRole = profileSwitchService.getBaseRole();
  const isTemporary = Boolean(session);
  const timeRemainingSec = profileSwitchService.getTimeRemainingSeconds();
  const timeRemainingMin = Math.ceil(timeRemainingSec / 60);

  const handleClosePrivilegePanel = useCallback(() => {
    setIsPrivilegePanelOpen(false);
  }, []);
  const handleCloseSecurityModal = useCallback(() => {
    setIsSecurityModalOpen(false);
  }, []);
  const handleCloseProfileSwitchModal = useCallback(() => {
    setIsProfileSwitchModalOpen(false);
    setSwitchTargetRole(undefined);
  }, []);
  const roles: { role: UserRole; title: string; desc: string; usersCount: number }[] = [
    { role: 'Super Admin', title: 'Global Platform Administrator', desc: 'Full root access to all system modules, API connectors, ingestion streams, and RBAC policies.', usersCount: 2 },
    { role: 'Compliance Officer', title: 'Senior AML & Sanctions Officer', desc: 'Authorized to adjudicate potential sanctions matches, clear PEP alerts, and issue legal holds.', usersCount: 5 },
    { role: 'Risk Analyst', title: 'Maritime Intelligence Threat Analyst', desc: 'Evaluates neural risk scoring, overrides risk vectors, and investigates dark fleet anomalies.', usersCount: 8 },
    { role: 'Operations Manager', title: 'Fleet Fleet Operations Controller', desc: 'Manages live voyages, waypoint adjustments, port call schedules, and fleet telemetry.', usersCount: 12 },
    { role: 'Vessel Analyst', title: 'Technical Vessel Specialist', desc: 'Enrolls vessels, updates technical documentation, and reviews classification survey reports.', usersCount: 14 },
    { role: 'Investigator', title: 'Maritime Forensic Investigator', desc: 'Detailed forensic investigation of AIS gaps, spoofed coordinates, and ship-to-ship transfers.', usersCount: 6 },
    { role: 'Auditor', title: 'Independent Compliance Auditor', desc: 'Read-only access to all statutory logs, KYC registers, and immutable audit trails.', usersCount: 4 },
    { role: 'Viewer', title: 'General Operations Observer', desc: 'Read-only telemetry map view and fleet registry browsing.', usersCount: 20 },
  ];

  const permissions = [
    'View Vessel Intelligence',
    'Edit Vessel Specifications',
    'Enroll New Targets',
    'Adjudicate AML / Sanctions',
    'Override Risk Scores',
    'Export Statutory Dossiers',
    'Manage AIS Ingestion Stream',
    'Manage User Roles & RBAC',
    'Access Immutable Audit Logs',
  ];

  const rolePermissionMap: Record<UserRole, string[]> = {
    'Super Admin': permissions,
    'Compliance Officer': ['View Vessel Intelligence', 'Adjudicate AML / Sanctions', 'Export Statutory Dossiers', 'Access Immutable Audit Logs'],
    'Risk Analyst': ['View Vessel Intelligence', 'Override Risk Scores', 'Export Statutory Dossiers'],
    'Operations Manager': ['View Vessel Intelligence', 'Edit Vessel Specifications', 'Export Statutory Dossiers'],
    'Vessel Analyst': ['View Vessel Intelligence', 'Enroll New Targets', 'Edit Vessel Specifications'],
    'Investigator': ['View Vessel Intelligence', 'Export Statutory Dossiers', 'Access Immutable Audit Logs'],
    'Auditor': ['View Vessel Intelligence', 'Export Statutory Dossiers', 'Access Immutable Audit Logs'],
    'Viewer': ['View Vessel Intelligence'],
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white tracking-wide">
              Role-Based Access Control (RBAC) & Security Governance
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Enterprise Privilege Separation · Multi-Role Delegation · Granular Operational Permissions
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentRole === 'Super Admin' && (
            <>
              <button
                onClick={() => onNavigateToTab ? onNavigateToTab('security-management') : setIsSecurityModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold transition-all shadow-md shadow-cyan-950/30 cursor-pointer"
                title="Open Dedicated Security Management Module"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Security Management</span>
              </button>

              <button
                onClick={() => setIsSecurityModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                title="Manage FIDO2 Passkeys, Authenticator App MFA & Active Sessions"
              >
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Passkeys & MFA Modal</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsProfileSwitchModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600/30 to-teal-600/30 hover:from-cyan-600/40 hover:to-teal-600/40 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold transition-all shadow-md shadow-cyan-950/40 cursor-pointer"
            title="Open Secure Profile Switch Layer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Secure Profile Switch</span>
          </button>

          <button
            onClick={() => setIsPrivilegePanelOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-600/30 to-amber-600/30 hover:from-rose-600/40 hover:to-amber-600/40 text-amber-300 border border-rose-500/40 rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-950/40"
            title="Open Password-Protected Super Admin Panel"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Super Admin Panel</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">ACTIVE SESSION ROLE:</span>
            <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg font-bold">
              {currentRole}
            </span>
          </div>
        </div>
      </div>

      {/* Temporary Profile Session Banner */}
      {isTemporary && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-amber-200 font-mono">
              Temporary Active Profile: <strong className="text-white">{currentRole}</strong> (Base Identity: {baseRole}) · Expires in <strong className="text-amber-300">{timeRemainingMin}m</strong>
            </span>
          </div>
          <button
            onClick={async () => {
              const res = await profileSwitchService.revertToBaseRole('Reverted from UserRolesView');
              onRoleChange(res.activeProfile);
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-mono font-bold text-[11px] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Revert to Base Role ({baseRole})</span>
          </button>
        </div>
      )}

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {roles.map((r) => {
          const isActive = r.role === currentRole;
          const isBase = r.role === baseRole;
          return (
            <div
              key={r.role}
              onClick={async () => {
                if (r.role === 'Super Admin') {
                  setSwitchTargetRole('Super Admin');
                  setIsProfileSwitchModalOpen(true);
                } else {
                  const res = await profileSwitchService.switchProfile(r.role, { durationMinutes: 60 });
                  if (res.success) {
                    onRoleChange(res.activeProfile);
                  }
                }
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-slate-950 border-cyan-500 shadow-xl shadow-cyan-950/20'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-white">{r.role}</span>
                  <div className="flex items-center gap-1">
                    {isBase && (
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono border border-slate-700">
                        BASE
                      </span>
                    )}
                    {isActive && (
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>
                <h4 className="text-xs text-cyan-400 font-medium mb-1">{r.title}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{r.desc}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 mt-3 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>{r.usersCount} Active Users</span>
                <span className="text-cyan-400 font-semibold">{isActive ? 'Current' : 'Switch →'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 mb-3 border-b border-slate-800">
          Privilege Matrix for Active Role: {currentRole}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {permissions.map((perm) => {
            const hasAccess = rolePermissionMap[currentRole]?.includes(perm);
            return (
              <div
                key={perm}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  hasAccess
                    ? 'bg-slate-950/80 border-cyan-500/30 text-white'
                    : 'bg-slate-950/40 border-slate-900 text-slate-600'
                }`}
              >
                <span>{perm}</span>
                {hasAccess ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-700" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Password-Protected Hidden Privilege Panel Modal */}
      {isPrivilegePanelOpen && (
        <HiddenPrivilegePanelModal
          isOpen={isPrivilegePanelOpen}
          onClose={handleClosePrivilegePanel}
          currentRole={currentRole}
        />
      )}

      {/* Super Admin Passkeys, MFA & Credential Management Modal */}
      {isSecurityModalOpen && (
        <SuperAdminSecurityModal
          isOpen={isSecurityModalOpen}
          onClose={handleCloseSecurityModal}
        />
      )}

      {/* Secure Profile Switch Modal */}
      {isProfileSwitchModalOpen && (
        <ProfileSwitchModal
          isOpen={isProfileSwitchModalOpen}
          onClose={handleCloseProfileSwitchModal}
          currentRole={currentRole}
          initialTargetRole={switchTargetRole}
          onRoleChanged={(newRole) => {
            onRoleChange(newRole);
          }}
        />
      )}
    </div>
  );
};
