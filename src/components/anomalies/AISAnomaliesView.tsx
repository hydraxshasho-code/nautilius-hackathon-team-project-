import React, { useState } from 'react';
import { AISAnomaly, Vessel, UserRole } from '../../types/maritime';
import { TacticalMaritimeMap } from '../map/TacticalMaritimeMap';
import { Forbidden403View } from '../common/Forbidden403View';
import {
  Activity,
  AlertTriangle,
  MapPin,
  Clock,
  ShieldAlert,
  Search,
  CheckCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface AISAnomaliesViewProps {
  anomalies: AISAnomaly[];
  vessels: Vessel[];
  onSelectVessel: (vesselId: string) => void;
  onNavigateToTab: (tabId: string) => void;
  currentRole?: UserRole;
}

export const AISAnomaliesView: React.FC<AISAnomaliesViewProps> = ({
  anomalies,
  vessels,
  onSelectVessel,
  onNavigateToTab,
  currentRole = 'Compliance Officer',
}) => {
  // AIS Anomalies is visible ONLY to Super Admin, Compliance Officer, Risk Analyst, Operations Manager
  // Investigator and Auditor do not see AIS Anomalies
  const isAuthorized =
    currentRole === 'Super Admin' ||
    currentRole === 'Compliance Officer' ||
    currentRole === 'Risk Analyst' ||
    currentRole === 'Operations Manager';

  if (!isAuthorized) {
    return (
      <Forbidden403View
        currentRole={currentRole}
        moduleName="AIS Anomalies Detection Engine"
        allowedRoles={['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Operations Manager']}
        onReturnToDashboard={() => onNavigateToTab('dashboard')}
      />
    );
  }
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string>(anomalies[0]?.id || 'anom-01');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  const selectedAnomaly = anomalies.find((a) => a.id === selectedAnomalyId) || anomalies[0];
  const relatedVessel = vessels.find((v) => v.id === selectedAnomaly?.vesselId);

  const filtered = anomalies.filter((a) => {
    return filterSeverity === 'ALL' || a.severity === filterSeverity;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white tracking-wide">
              Automated AIS Anomaly & Dark Fleet Detection Engine
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            AIS Blackout Gaps · Route Deviation · Sudden Course Shifts · Geofence Violations · Draught Tampering
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Severity Filter:</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Anomaly Incident Feed (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col h-[600px]">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 mb-3 border-b border-slate-800">
            Active Anomaly Incidents ({filtered.length})
          </h3>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {filtered.map((anom) => (
              <div
                key={anom.id}
                onClick={() => setSelectedAnomalyId(anom.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  anom.id === selectedAnomalyId
                    ? 'bg-slate-950 border-cyan-500/60 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-white">{anom.vesselName}</span>
                  <span
                    className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded ${
                      anom.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : anom.severity === 'HIGH'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}
                  >
                    {anom.severity}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-semibold mb-1">
                  <span>{anom.type}</span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{anom.evidence}</p>

                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-900">
                  <span>
                    LAT {anom.lat.toFixed(2)}°, LON {anom.lon.toFixed(2)}°
                  </span>
                  <span>{new Date(anom.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Anomaly Deep Dive & Target Map (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Anomaly Evidence & Dossier Card */}
          <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800 mb-3">
              <div>
                <span
                  className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded mb-1 inline-block ${
                    selectedAnomaly.severity === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {selectedAnomaly.type.toUpperCase()}
                </span>
                <h2 className="text-base font-bold text-white tracking-wide">{selectedAnomaly.vesselName}</h2>
                <span className="text-xs text-slate-400 font-mono">
                  IMO: {selectedAnomaly.imo} · MMSI: {selectedAnomaly.mmsi}
                </span>
              </div>

              <button
                onClick={() => {
                  onSelectVessel(selectedAnomaly.vesselId);
                  onNavigateToTab('vessel-profile');
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
              >
                <span>Inspect Target</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 font-mono text-[10px] block mb-1">EVIDENCE LOG & ALGORITHM FINDING</span>
                <p className="text-slate-200 leading-relaxed font-sans">{selectedAnomaly.evidence}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">GEOLOCATION AT INCIDENT</span>
                  <span className="text-slate-200">
                    {selectedAnomaly.lat.toFixed(4)}°, {selectedAnomaly.lon.toFixed(4)}°
                  </span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">DETECTION TIMESTAMP</span>
                  <span className="text-slate-200">{new Date(selectedAnomaly.timestamp).toUTCString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Anomaly Location Pinpointed on Live Map */}
          {relatedVessel && (
            <div className="h-[320px] rounded-xl overflow-hidden border border-slate-800 shadow-xl">
              <TacticalMaritimeMap
                vessels={[relatedVessel]}
                selectedVesselId={relatedVessel.id}
                onSelectVessel={() => {}}
                className="w-full h-full"
                allowFullscreen={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
