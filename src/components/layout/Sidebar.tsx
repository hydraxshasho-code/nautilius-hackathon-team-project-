import React, { useState } from 'react';
import {
  LayoutDashboard,
  Ship,
  FileSearch,
  Navigation,
  Compass,
  ShieldCheck,
  ShieldAlert,
  Activity,
  AlertTriangle,
  FileText,
  Users,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Radio,
  Bot,
} from 'lucide-react';

import { UserRole } from '../../types/maritime';
import { NautilusLogo } from '../common/NautilusLogo';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  alertCount: number;
  anomalyCount: number;
  currentRole: UserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  alertCount,
  anomalyCount,
  currentRole,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // All menu items (AI Copilot is deliberately removed from navigation per requirement)
  const allMenuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Operations Manager', 'Investigator', 'Auditor'] as UserRole[],
    },
    {
      id: 'tracking',
      label: 'Real-Time World Map',
      icon: Navigation,
      isLive: true,
      roles: ['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Operations Manager', 'Investigator', 'Auditor'] as UserRole[],
    },
    {
      id: 'registry',
      label: 'Vessel Registry',
      icon: Ship,
      // Accessible ONLY to Super Admin and Compliance Officer
      roles: ['Super Admin', 'Compliance Officer'] as UserRole[],
    },
    {
      id: 'vessel-profile',
      label: 'Vessel Intelligence',
      icon: FileSearch,
      roles: ['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Operations Manager', 'Investigator', 'Auditor'] as UserRole[],
    },
    {
      id: 'voyage',
      label: 'Voyage Intelligence',
      icon: Compass,
      roles: ['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Operations Manager', 'Investigator'] as UserRole[],
    },
    {
      id: 'kyc',
      label: 'KYC Compliance',
      icon: ShieldCheck,
      // Accessible ONLY to Super Admin, Compliance Officer, Risk Analyst, Investigator, Auditor (NO Operations Manager)
      roles: ['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Investigator', 'Auditor'] as UserRole[],
    },
    {
      id: 'aml',
      label: 'AML & Sanctions',
      icon: ShieldAlert,
      // Accessible ONLY to Super Admin, Compliance Officer, Risk Analyst, Investigator, Auditor (NO Operations Manager)
      roles: ['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Investigator', 'Auditor'] as UserRole[],
    },
    {
      id: 'risk',
      label: 'Risk Assessment',
      icon: Activity,
      roles: ['Super Admin', 'Compliance Officer', 'Risk Analyst'] as UserRole[],
    },
    {
      id: 'anomalies',
      label: 'AIS Anomalies',
      icon: Radio,
      badge: anomalyCount,
      // Visible ONLY to Super Admin, Compliance Officer, Risk Analyst, Operations Manager (NO Investigator, Auditor)
      roles: ['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Operations Manager'] as UserRole[],
    },
    {
      id: 'alerts',
      label: 'Alerts & Incidents',
      icon: AlertTriangle,
      badge: alertCount,
      roles: ['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Operations Manager', 'Investigator', 'Auditor'] as UserRole[],
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      // View-only compliance reports for Investigator and Auditor; full reports for Compliance & Super Admin
      roles: ['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Investigator', 'Auditor'] as UserRole[],
    },
    {
      id: 'rbac',
      label: 'Users & Roles',
      icon: Users,
      roles: ['Super Admin'] as UserRole[],
    },
    {
      id: 'security-management',
      label: 'Security Management',
      icon: ShieldCheck,
      roles: ['Super Admin'] as UserRole[],
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      icon: ScrollText,
      roles: ['Super Admin', 'Compliance Officer', 'Investigator', 'Auditor'] as UserRole[],
    },
  ];

  // Strictly filter menu items by current active role
  const menuItems = allMenuItems.filter((item) => item.roles.includes(currentRole));

  return (
    <aside
      className={`bg-[#070e1a] border-r border-slate-800 flex flex-col justify-between transition-all duration-300 z-30 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div>
        {/* Brand Header with Stunning Luminous Logo */}
        <div className="h-16 px-3 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/70">
          {!isCollapsed && <NautilusLogo size="md" showText={true} />}

          {isCollapsed && <NautilusLogo size="sm" showText={false} className="mx-auto" />}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors hidden sm:block shrink-0"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-120px)] scrollbar-thin scrollbar-thumb-slate-800">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-slate-400'
                  }`}
                />

                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between truncate">
                    <span className="truncate">{item.label}</span>
                    {item.isLive && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                      </span>
                    )}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-[10px] font-mono text-slate-500 flex items-center justify-between">
          <span className="text-cyan-400 font-bold">NAUTILUS v4.2 PRO</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            OPERATIONAL
          </span>
        </div>
      )}
    </aside>
  );
};
