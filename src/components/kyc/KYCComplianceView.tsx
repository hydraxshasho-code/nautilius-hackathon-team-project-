import React, { useState } from 'react';
import { Vessel, UserRole } from '../../types/maritime';
import { rbacService } from '../../services/rbacService';
import { Forbidden403View } from '../common/Forbidden403View';
import {
  ShieldCheck,
  Building,
  UserCheck,
  FileCheck,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface KYCComplianceViewProps {
  vessels: Vessel[];
  onSelectVessel: (vesselId: string) => void;
  currentRole?: UserRole;
  onNavigateToTab?: (tabId: string) => void;
}

export const KYCComplianceView: React.FC<KYCComplianceViewProps> = ({
  vessels,
  onSelectVessel,
  currentRole = 'Compliance Officer',
  onNavigateToTab,
}) => {
  // Role Access Verification: Accessible ONLY to Super Admin, Compliance Officer, Risk Analyst, Investigator, Auditor
  const isAuthorized = rbacService.hasPermission(currentRole, 'kyc_aml_compliance');

  if (!isAuthorized) {
    return (
      <Forbidden403View
        currentRole={currentRole}
        moduleName="KYC & Beneficial Ownership (UBO)"
        allowedRoles={['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Investigator', 'Auditor']}
        onReturnToDashboard={() => (onNavigateToTab ? onNavigateToTab('dashboard') : null)}
      />
    );
  }

  const [selectedVesselId, setSelectedVesselId] = useState<string>(
    vessels[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');

  if (!vessels || vessels.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/80 rounded-2xl border border-slate-800 text-slate-400">
        <ShieldCheck className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-50" />
        <h3 className="text-sm font-bold text-white mb-1">No Vessels Registered</h3>
        <p className="text-xs">Add a vessel to conduct beneficial ownership KYC screening.</p>
      </div>
    );
  }

  const vessel = vessels.find((v) => v.id === selectedVesselId) || vessels[0];

  const filteredVessels = vessels.filter((v) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = (v.name || '').toLowerCase().includes(q);
    const ownerMatch = (v.owner || '').toLowerCase().includes(q);
    const uboMatch = (v.beneficialOwner || '').toLowerCase().includes(q);
    return nameMatch || ownerMatch || uboMatch;
  });

  const ownershipNodes = Array.isArray(vessel?.ownershipStructure) ? vessel.ownershipStructure : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white tracking-wide">
              Enterprise KYC & Beneficial Ownership (UBO)
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Ultimate Beneficial Ownership Verification · Corporate Hierarchy Mapping · Jurisdictional Compliance
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search Entity / Vessel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Vessel Entity Selector (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col h-[600px]">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 mb-3 border-b border-slate-800">
            Registered Fleets & Ownership Dossiers ({filteredVessels.length})
          </h3>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {filteredVessels.map((v) => (
              <div
                key={v.id}
                onClick={() => setSelectedVesselId(v.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  v.id === (vessel?.id || selectedVesselId)
                    ? 'bg-slate-950 border-cyan-500/60 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white">{v.name}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                      v.kycStatus === 'Verified'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : v.kycStatus === 'Under Review' || v.kycStatus === 'Pending'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {v.kycStatus || 'Pending'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                  <div className="truncate">
                    <span className="text-slate-500">Owner:</span> {v.owner || 'Unspecified'}
                  </div>
                  <div className="truncate text-cyan-300">
                    <span className="text-slate-500">UBO:</span> {v.beneficialOwner || 'Unspecified'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right UBO Hierarchy Diagram & Compliance Status (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Main KYC Summary Card */}
          <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">{vessel?.name} Ownership Hierarchy</h2>
                <span className="text-xs text-slate-400 font-mono">
                  IMO {vessel?.imo} · MMSI {vessel?.mmsi} · Flag: {vessel?.flag}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-lg border font-mono ${
                    vessel?.kycStatus === 'Verified'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  KYC: {vessel?.kycStatus || 'Pending'}
                </span>
                <button
                  onClick={() => onSelectVessel(vessel.id)}
                  className="px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold transition-all"
                >
                  View Vessel Dossier →
                </button>
              </div>
            </div>

            {/* Corporate Ownership Tree */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Corporate Tier Mapping & Beneficial Ownership Nodes
              </h3>

              <div className="space-y-2">
                {ownershipNodes.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-400 text-xs">
                    Standard registry owner: {vessel?.owner || 'Unspecified'}. No multi-tier offshore layers detected.
                  </div>
                ) : (
                  ownershipNodes.map((node, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 transition-all flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400 mt-0.5">
                          {node.role === 'Beneficial Owner' ? (
                            <UserCheck className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Building className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{node.name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-800 text-slate-300">
                              {node.role}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-3">
                            <span>Jurisdiction: <strong className="text-slate-200">{node.country}</strong></span>
                            <span>·</span>
                            <span>Reg No: <strong className="text-slate-200">{node.registrationNumber}</strong></span>
                            {node.sharePercentage && (
                              <>
                                <span>·</span>
                                <span>Equity: <strong className="text-cyan-400">{node.sharePercentage}%</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                            node.sanctionStatus === 'CLEARED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {node.sanctionStatus}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
