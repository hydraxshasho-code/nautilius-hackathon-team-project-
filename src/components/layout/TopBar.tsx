import React, { useState, useEffect, useCallback } from 'react';
import { UserRole } from '../../types/maritime';
import { useAuth } from '../common/FirebaseAuthProvider';
import { HiddenPrivilegePanelModal } from '../rbac/HiddenPrivilegePanelModal';
import { ProfileSwitchModal } from '../rbac/ProfileSwitchModal';
import { profileSwitchService, TemporaryProfileSession } from '../../services/profileSwitchService';
import { NautilusLogo } from '../common/NautilusLogo';
import {
  Search,
  Bell,
  Radio,
  Bot,
  Activity,
  ShieldAlert,
  ChevronDown,
  LogIn,
  LogOut,
  UserCheck,
  KeyRound,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

interface TopBarProps {
  currentTab: string;
  onOpenSearch: () => void;
  onOpenAI: () => void;
  onOpenHealth: () => void;
  onNavigateToTab: (tabId: string) => void;
  unreadAlertCount: number;
  currentRole: UserRole;
  onRoleChange?: (newRole: UserRole) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onOpenSearch,
  onOpenAI,
  onOpenHealth,
  onNavigateToTab,
  unreadAlertCount,
  currentRole,
  onRoleChange,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [isPrivilegePanelOpen, setIsPrivilegePanelOpen] = useState(false);
  const [isProfileSwitchModalOpen, setIsProfileSwitchModalOpen] = useState(false);
  const [profileSwitchTarget, setProfileSwitchTarget] = useState<UserRole | undefined>(undefined);
  const [session, setSession] = useState<TemporaryProfileSession | null>(() => profileSwitchService.getSession());

  const handleClosePrivilegePanel = useCallback(() => {
    setIsPrivilegePanelOpen(false);
  }, []);
  const handleCloseProfileSwitchModal = useCallback(() => {
    setIsProfileSwitchModalOpen(false);
    setProfileSwitchTarget(undefined);
  }, []);
  const { user, login, logout, loading: authLoading } = useAuth();

  useEffect(() => {
    const unsub = profileSwitchService.subscribe((_profile, s) => {
      setSession(s);
    });
    return unsub;
  }, []);

  const baseRole = profileSwitchService.getBaseRole();
  const isTemporary = Boolean(session);
  const timeRemainingSec = profileSwitchService.getTimeRemainingSeconds();
  const timeRemainingMin = Math.ceil(timeRemainingSec / 60);

  const availableRoles: UserRole[] = [
    'Super Admin',
    'Compliance Officer',
    'Risk Analyst',
    'Operations Manager',
    'Investigator',
    'Auditor',
  ];

  const tabLabels: Record<string, string> = {
    dashboard: 'Command Center Overview',
    registry: 'Global Vessel Registry',
    'vessel-profile': 'Vessel Intelligence Dossier',
    tracking: 'Real-Time Global Map',
    voyage: 'Voyage Intelligence & Replay',
    kyc: 'KYC & Beneficial Ownership (UBO)',
    aml: 'AML & Sanctions Screening',
    risk: 'AI Threat & Risk Engine',
    anomalies: 'AIS Anomaly Detection',
    alerts: 'Incident & Alert Center',
    reports: 'Statutory Reports Generator',
    rbac: 'Access Control & User Roles',
    audit: 'Immutable Audit Log',
  };

  return (
    <header className="h-16 px-4 sm:px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between gap-4 sticky top-0 z-40">
      {/* Zone 1: Context Breadcrumb */}
      <div className="flex items-center gap-2.5 text-xs font-mono">
        <NautilusLogo size="sm" showText={false} />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-200 font-extrabold tracking-wider uppercase hidden xs:inline">
          NAUTILUS
        </span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-300 font-sans font-semibold truncate max-w-[200px] sm:max-w-none">
          {tabLabels[currentTab] || 'Command Center'}
        </span>
      </div>

      {/* Zone 2: Global Search Bar */}
      <div className="flex-1 max-w-md hidden md:block">
        <button
          onClick={onOpenSearch}
          className="w-full bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 flex items-center justify-between transition-colors shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-mono text-[11px]">Search Vessel, IMO, MMSI, Owner...</span>
          </div>
          <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-slate-500">
            ⌘K
          </span>
        </button>
      </div>

      {/* Zone 3: Live Indicators & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenSearch}
          className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Live Transmit Indicator & Health Modal Trigger */}
        <button
          onClick={onOpenHealth}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 hover:bg-slate-850 rounded-lg border border-slate-800 text-xs font-mono transition-colors shadow-sm"
          title="Open System Telemetry Health Status"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-semibold text-[11px] hidden sm:inline">LIVE AIS FEED</span>
        </button>

        {/* Role Switcher Pill & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 hover:bg-slate-850 border border-cyan-500/40 hover:border-cyan-400 rounded-lg text-xs font-mono transition-all shadow-sm"
            title="Switch Active RBAC User Role"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isTemporary ? 'bg-amber-400 animate-pulse' : 'bg-cyan-400'}`} />
            <span className="text-cyan-300 font-bold hidden sm:inline">{currentRole}</span>
            <span className="text-cyan-300 font-bold sm:hidden">{currentRole.split(' ')[0]}</span>
            {isTemporary && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 font-bold hidden xs:inline">
                TEMP ({timeRemainingMin}m)
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-cyan-400/80" />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-2 z-50 text-xs backdrop-blur-xl space-y-1">
              <div className="px-2.5 py-1.5 bg-slate-950/60 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                <span>BASE: {baseRole}</span>
                {isTemporary && (
                  <span className="text-amber-400 font-bold">TEMP ({timeRemainingMin}m)</span>
                )}
              </div>

              {isTemporary && (
                <button
                  onClick={async () => {
                    const res = await profileSwitchService.revertToBaseRole('Reverted from TopBar');
                    if (onRoleChange) onRoleChange(res.activeProfile);
                    setShowRoleMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-colors text-[11px] font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Revert to Base Role ({baseRole})</span>
                </button>
              )}

              <div className="px-2.5 py-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
                Operational Profiles
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-slate-800">
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    onClick={async () => {
                      if (role === 'Super Admin') {
                        setProfileSwitchTarget('Super Admin');
                        setIsProfileSwitchModalOpen(true);
                      } else {
                        const res = await profileSwitchService.switchProfile(role, { durationMinutes: 60 });
                        if (res.success && onRoleChange) {
                          onRoleChange(res.activeProfile);
                        }
                      }
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                      role === currentRole
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>{role}</span>
                    {role === currentRole && <span className="text-[10px] text-cyan-400 font-mono">ACTIVE</span>}
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-800 pt-1 space-y-1">
                <button
                  onClick={() => {
                    setProfileSwitchTarget(undefined);
                    setIsProfileSwitchModalOpen(true);
                    setShowRoleMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 flex items-center gap-1.5 transition-colors text-[11px] font-semibold"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Secure Profile Switch Layer...</span>
                </button>

                <button
                  onClick={() => {
                    setIsPrivilegePanelOpen(true);
                    setShowRoleMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 flex items-center gap-1.5 transition-colors text-[11px] font-semibold"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Super Admin Panel</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Alerts Center Trigger */}
        <button
          onClick={() => onNavigateToTab('alerts')}
          className="relative p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-800 transition-colors"
          title="Alert Center"
        >
          <Bell className="w-4 h-4" />
          {unreadAlertCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white font-mono text-[9px] font-bold rounded-full flex items-center justify-center border border-slate-900">
              {unreadAlertCount}
            </span>
          )}
        </button>

        {/* User Profile Lockup & Google Auth */}
        <div className="relative">
          {user ? (
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-emerald-500/40 transition-colors"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Operator'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-emerald-500/50 shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-600/30 text-emerald-400 font-bold flex items-center justify-center border border-emerald-500/40 text-xs">
                  {user.displayName?.[0] || user.email?.[0] || 'U'}
                </div>
              )}
              <div className="text-left hidden lg:block">
                <span className="text-xs font-bold text-white block leading-tight truncate max-w-[110px]">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono block leading-tight">
                  Online · {currentRole}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-500 hidden sm:block" />
            </button>
          ) : (
            <button
              onClick={() => login()}
              disabled={authLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition-all border border-emerald-500/30"
              title="Sign in with Google Account"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Google Sign-In</span>
            </button>
          )}

          {showProfileMenu && user && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 text-xs">
              <div className="p-2 border-b border-slate-800 mb-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold text-white block truncate">{user.displayName || 'Authorized Officer'}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono truncate block">{user.email}</span>
                <span className="text-[10px] text-cyan-400 font-mono block mt-1">Role: {currentRole}</span>
                <span className="text-[9px] text-emerald-400 font-mono block mt-0.5">Firestore Sync: LIVE</span>
              </div>
              <button
                onClick={() => {
                  onNavigateToTab('rbac');
                  setShowProfileMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              >
                Switch Role & Privileges
              </button>
              <button
                onClick={() => {
                  onNavigateToTab('audit');
                  setShowProfileMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              >
                View Audit Trail
              </button>
              <button
                onClick={() => {
                  setIsPrivilegePanelOpen(true);
                  setShowProfileMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Super Admin Panel</span>
              </button>
              <div className="border-t border-slate-800 my-1 pt-1">
                <button
                  onClick={() => {
                    logout();
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Privilege Panel Password Protected Modal */}
      {isPrivilegePanelOpen && (
        <HiddenPrivilegePanelModal
          isOpen={isPrivilegePanelOpen}
          onClose={handleClosePrivilegePanel}
          currentRole={currentRole}
        />
      )}

      {/* Secure Profile Switch Modal */}
      {isProfileSwitchModalOpen && (
        <ProfileSwitchModal
          isOpen={isProfileSwitchModalOpen}
          onClose={handleCloseProfileSwitchModal}
          currentRole={currentRole}
          initialTargetRole={profileSwitchTarget}
          onRoleChanged={(newRole) => {
            if (onRoleChange) onRoleChange(newRole);
          }}
        />
      )}
    </header>
  );
};
