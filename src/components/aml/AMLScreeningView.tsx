import React, { useState } from 'react';
import { Vessel, UserRole } from '../../types/maritime';
import { aisStreamService } from '../../services/aisStreamService';
import { rbacService } from '../../services/rbacService';
import { Forbidden403View } from '../common/Forbidden403View';
import {
  ShieldAlert,
  Search,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  FileText,
  RotateCcw,
  Check,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';

interface AMLScreeningViewProps {
  vessels: Vessel[];
  onSelectVessel: (vesselId: string) => void;
  currentRole?: UserRole;
  onNavigateToTab?: (tabId: string) => void;
}

export const AMLScreeningView: React.FC<AMLScreeningViewProps> = ({
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
        moduleName="AML & Sanctions Screening"
        allowedRoles={['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Investigator', 'Auditor']}
        onReturnToDashboard={() => (onNavigateToTab ? onNavigateToTab('dashboard') : null)}
      />
    );
  }

  if (!vessels || vessels.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/80 rounded-2xl border border-slate-800 text-slate-400">
        <ShieldAlert className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-50" />
        <h3 className="text-sm font-bold text-white mb-1">No Vessels Registered</h3>
        <p className="text-xs">Add a vessel to conduct automated AML and sanctions watchlist screening.</p>
      </div>
    );
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedVesselId, setSelectedVesselId] = useState<string>(
    vessels.find((v) => v.amlStatus === 'Potential Match' || v.amlStatus === 'Confirmed Match')?.id ||
      vessels[0]?.id ||
      ''
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAdjudicate = (status: Vessel['amlStatus'], confidence?: number) => {
    aisStreamService.updateAMLStatus(selectedVesselId, status, confidence);
    showToast(`Adjudication recorded: Vessel AML status updated to "${status}". Audit event created.`);
  };

  const currentVessel = vessels.find((v) => v.id === selectedVesselId) || vessels[0];

  const filteredVessels = vessels.filter((v) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      (v.name || '').toLowerCase().includes(q) ||
      (v.owner || '').toLowerCase().includes(q) ||
      (v.beneficialOwner || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'ALL' || v.amlStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 border border-cyan-500 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h1 className="text-base font-bold text-white tracking-wide">
              Global AML & Sanctions Intelligence Screening Engine
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            OFAC SDN · EU Consolidated · UN Security Council · UK HMT Sanctions & Politically Exposed Persons (PEP)
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Filter By Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Screening Records</option>
            <option value="Confirmed Match">Confirmed Match</option>
            <option value="Potential Match">Potential Match</option>
            <option value="Under Review">Under Review</option>
            <option value="Clear">Clear</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left List of Vessels with screening matches (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col h-[620px]">
          <div className="pb-3 border-b border-slate-800 mb-3">
            <input
              type="text"
              placeholder="Search Vessels or Entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {filteredVessels.map((v) => (
              <div
                key={v.id}
                onClick={() => setSelectedVesselId(v.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  v.id === selectedVesselId
                    ? 'bg-slate-950 border-cyan-500/60 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white">{v.name}</span>
                  <span
                    className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                      v.amlStatus === 'Confirmed Match'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : v.amlStatus === 'Potential Match'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : v.amlStatus === 'Under Review'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}
                  >
                    {v.amlStatus}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 truncate font-mono">
                  IMO: {v.imo} · Flag: {v.flag}
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  UBO: <span className="text-slate-300">{v.beneficialOwner}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Adjudication & Match Deep Dive Console (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Active Screening Target Header */}
          <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-wide">{currentVessel.name}</h2>
                  <span className="text-xs text-slate-400 font-mono">(IMO {currentVessel.imo})</span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Beneficial Owner: <strong className="text-cyan-300">{currentVessel.beneficialOwner}</strong>
                </p>
              </div>

              <div className="flex items-center gap-3">
                {currentVessel.amlMatchConfidence && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-mono">MATCH CONFIDENCE</span>
                    <span className="text-base font-extrabold text-rose-400 font-mono">
                      {currentVessel.amlMatchConfidence}%
                    </span>
                  </div>
                )}
                <span
                  className={`text-xs font-bold font-mono px-3 py-1 rounded-lg ${
                    currentVessel.amlStatus === 'Confirmed Match'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : currentVessel.amlStatus === 'Potential Match'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {currentVessel.amlStatus.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Watchlist Screening Matrix */}
            <div className="space-y-3 mb-5">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Sanctions & PEP Database Cross-References
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400">OFAC SDN List (USA)</span>
                    <span
                      className={`font-bold ${
                        currentVessel.amlStatus === 'Confirmed Match' ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {currentVessel.amlStatus === 'Confirmed Match' ? 'POSITIVE MATCH (OFAC-819)' : 'CLEARED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">
                    US Department of the Treasury Office of Foreign Assets Control.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400">EU Consolidated Sanctions</span>
                    <span
                      className={`font-bold ${
                        currentVessel.amlStatus === 'Confirmed Match' ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {currentVessel.amlStatus === 'Confirmed Match' ? 'DESIGNATED ENTITY' : 'CLEARED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">
                    European External Action Service (EEAS) restrictive measures.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400">UN Security Council Resolutions</span>
                    <span className="text-emerald-400 font-bold">CLEARED</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">United Nations Sanctions Committees lists.</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400">PEP & Adverse Media Screening</span>
                    <span
                      className={`font-bold ${
                        currentVessel.amlStatus === 'Potential Match' ? 'text-amber-400' : 'text-slate-300'
                      }`}
                    >
                      {currentVessel.amlStatus === 'Potential Match' ? 'PEP AFFILIATION DETECTED' : 'LOW RISK'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Global PEP databases and maritime adverse media mentions.
                  </p>
                </div>
              </div>
            </div>

            {/* Adjudication Action Workflow Bar */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Analyst Adjudication & Workflow Resolution
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                Review automated algorithm findings against primary statutory documents before applying resolution.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleAdjudicate('Clear', 0)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Clear / False Positive</span>
                </button>

                <button
                  onClick={() => handleAdjudicate('Under Review', currentVessel.amlMatchConfidence || 50)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-amber-950/40"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Request Enhanced Due Diligence (EDD)</span>
                </button>

                <button
                  onClick={() => handleAdjudicate('Confirmed Match', 98)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-950/40"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Confirm Match & Escalate to Legal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
