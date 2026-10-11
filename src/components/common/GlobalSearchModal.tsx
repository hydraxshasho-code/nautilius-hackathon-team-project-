import React, { useState } from 'react';
import { Vessel, IncidentAlert, AISAnomaly } from '../../types/maritime';
import { MAJOR_PORTS } from '../../data/maritimeMapData';
import { liveAISClient } from '../../services/liveAisClient';
import {
  Search,
  Ship,
  Building,
  Anchor,
  AlertTriangle,
  X,
  ExternalLink,
  Radio,
  Plus,
} from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  vessels: Vessel[];
  alerts: IncidentAlert[];
  anomalies: AISAnomaly[];
  onSelectVessel: (vesselId: string) => void;
  onNavigateToTab: (tabId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  vessels,
  alerts,
  anomalies,
  onSelectVessel,
  onNavigateToTab,
}) => {
  const [query, setQuery] = useState('');
  const [isResolvingAIS, setIsResolvingAIS] = useState(false);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();
  const digitsOnly = q.replace(/[^0-9]/g, '');

  const matchingVessels = q
    ? vessels.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.imo.toLowerCase().includes(q) ||
          v.mmsi.toLowerCase().includes(q) ||
          (digitsOnly.length >= 4 && (v.imo.includes(digitsOnly) || v.mmsi.includes(digitsOnly))) ||
          v.callSign.toLowerCase().includes(q) ||
          v.flag.toLowerCase().includes(q)
      )
    : vessels.slice(0, 5);

  const matchingCompanies = q
    ? vessels
        .filter(
          (v) =>
            v.owner.toLowerCase().includes(q) ||
            v.operator.toLowerCase().includes(q) ||
            v.beneficialOwner.toLowerCase().includes(q)
        )
        .map((v) => ({ name: v.owner, role: 'Owner', vessel: v.name, vesselId: v.id }))
    : [];

  const matchingPorts = q
    ? MAJOR_PORTS.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.country.toLowerCase().includes(q)
      )
    : MAJOR_PORTS.slice(0, 4);

  const matchingAlerts = q
    ? alerts.filter(
        (a) =>
          a.vesselName.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
      )
    : alerts.slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-16 overflow-y-auto">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center gap-3">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search Vessel Name, IMO, MMSI, Call Sign, Owner, Port, Alert..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-white text-sm focus:outline-none placeholder-slate-500 font-mono"
          />
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Area */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs font-mono scrollbar-thin scrollbar-thumb-slate-800">
          {/* Vessels Group */}
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2 font-bold font-sans">
              Vessels ({matchingVessels.length})
            </span>
            <div className="space-y-1.5">
              {digitsOnly.length >= 7 && !matchingVessels.some((v) => v.imo === digitsOnly || v.mmsi === digitsOnly) && (
                <div
                  onClick={async () => {
                    setIsResolvingAIS(true);
                    try {
                      const res = await liveAISClient.trackVessel(digitsOnly);
                      if (res.success && res.vessel) {
                        onSelectVessel(res.vessel.id);
                        onNavigateToTab('vessel-profile');
                        onClose();
                      }
                    } finally {
                      setIsResolvingAIS(false);
                    }
                  }}
                  className="flex items-center justify-between p-2.5 bg-cyan-950/40 hover:bg-cyan-900/50 rounded-lg border border-cyan-500/50 cursor-pointer transition-all shadow-md group"
                >
                  <div className="flex items-center gap-2.5">
                    <Radio className={`w-4 h-4 text-cyan-400 ${isResolvingAIS ? 'animate-spin' : 'animate-pulse'}`} />
                    <div>
                      <div className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                        <span>Resolve & Track from Authorized AIS:</span>
                        <span className="font-mono text-white bg-slate-900 px-1.5 py-0.5 rounded border border-cyan-500/40">
                          {digitsOnly.length === 7 ? `IMO ${digitsOnly}` : `MMSI ${digitsOnly}`}
                        </span>
                      </div>
                      <span className="text-slate-400 text-[10px]">
                        Query authorized live feed, stream real-time AIS telemetry & open tactical dossier
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-cyan-400 font-bold group-hover:translate-x-0.5 transition-transform">
                    {isResolvingAIS ? 'Resolving...' : 'Track Live →'}
                  </span>
                </div>
              )}

              {matchingVessels.length === 0 && digitsOnly.length < 7 ? (
                <div className="text-slate-600 text-[11px] font-sans">No matching vessels found. Enter IMO or MMSI number to track.</div>
              ) : (
                matchingVessels.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => {
                      onSelectVessel(v.id);
                      onNavigateToTab('vessel-profile');
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 bg-slate-950/80 hover:bg-slate-800/60 rounded-lg border border-slate-800/80 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Ship className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <span className="font-bold text-white text-xs">{v.name}</span>
                        <span className="text-slate-400 text-[10px] ml-2">
                          IMO: {v.imo} · MMSI: {v.mmsi} · Flag: {v.flag}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        v.riskLevel === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-400'
                          : v.riskLevel === 'HIGH'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {v.riskLevel} ({v.riskScore})
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Companies Group */}
          {matchingCompanies.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2 font-bold font-sans">
                Companies & Entities
              </span>
              <div className="space-y-1.5">
                {matchingCompanies.map((c, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      onSelectVessel(c.vesselId);
                      onNavigateToTab('kyc');
                      onClose();
                    }}
                    className="flex items-center justify-between p-2 bg-slate-950/60 hover:bg-slate-800/60 rounded-lg border border-slate-800 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-bold text-slate-200">{c.name}</span>
                      <span className="text-slate-500">· Vessel: {c.vessel}</span>
                    </div>
                    <span className="text-slate-400 text-[10px]">Inspect KYC →</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ports Group */}
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2 font-bold font-sans">
              Global Maritime Ports
            </span>
            <div className="grid grid-cols-2 gap-2">
              {matchingPorts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    onNavigateToTab('dashboard');
                    onClose();
                  }}
                  className="p-2 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between hover:border-slate-700 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Anchor className="w-3.5 h-3.5 text-cyan-400" />
                    <div>
                      <span className="font-bold text-white text-xs block">{p.name}</span>
                      <span className="text-slate-500 text-[10px]">
                        {p.code} · {p.country}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts Group */}
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2 font-bold font-sans">
              Recent Alerts
            </span>
            <div className="space-y-1.5">
              {matchingAlerts.map((a) => (
                <div
                  key={a.id}
                  onClick={() => {
                    onNavigateToTab('alerts');
                    onClose();
                  }}
                  className="p-2 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between hover:border-slate-700 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold text-slate-200">{a.vesselName}:</span>
                    <span className="text-slate-400 truncate max-w-sm">{a.title}</span>
                  </div>
                  <span className="text-cyan-400 text-[10px]">View Alert →</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
