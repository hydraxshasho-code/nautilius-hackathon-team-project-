import React, { useState, useMemo } from 'react';
import { Vessel, IncidentAlert, AISAnomaly, UserRole } from '../../types/maritime';
import { TacticalMaritimeMap } from '../map/TacticalMaritimeMap';
import { rbacService } from '../../services/rbacService';
import {
  Ship,
  Anchor,
  AlertTriangle,
  ShieldAlert,
  Activity,
  Compass,
  Download,
  FileCheck,
  Waves,
  Radio,
} from 'lucide-react';

interface DashboardViewProps {
  vessels: Vessel[];
  alerts: IncidentAlert[];
  anomalies: AISAnomaly[];
  selectedVesselId: string | null;
  onSelectVessel: (vesselId: string) => void;
  onOpenDossier?: (vesselId: string) => void;
  onNavigateToTab: (tabId: string) => void;
  currentRole: UserRole;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  vessels,
  alerts,
  anomalies,
  selectedVesselId,
  onSelectVessel,
  onOpenDossier,
  onNavigateToTab,
  currentRole,
}) => {
  const [fleetLocationFilter, setFleetLocationFilter] = useState<'ALL' | 'AT_SEA' | 'IN_PORT' | 'HIGH_RISK'>('ALL');
  const isViewOnlyCompliance = currentRole === 'Investigator' || currentRole === 'Auditor';

  // Role-routed alerts
  const roleAlerts = rbacService.filterAlertsForRole(currentRole, alerts);

  // Compute dynamic KPIs
  const totalVessels = vessels.length;
  const activeTransmitting = vessels.filter((v) => v.isTransmitting && !v.isStale).length;
  const vesselsAtSea = vessels.filter((v) => v.speed > 0.5).length;
  const vesselsInPort = vessels.filter((v) => v.speed <= 0.5).length;
  const highRiskCount = vessels.filter((v) => v.riskLevel === 'HIGH' || v.riskLevel === 'CRITICAL').length;
  const amlAlertCount = alerts.filter((a) => a.category === 'AML Alert' || a.category === 'Sanctions Screening').length;
  const activeAnomaliesCount = anomalies.filter((anom) => anom.status === 'ACTIVE').length;

  // Filter vessels for the interactive tactical map based on selected tab
  const displayedVessels = useMemo(() => {
    switch (fleetLocationFilter) {
      case 'AT_SEA':
        return vessels.filter((v) => v.speed > 0.5);
      case 'IN_PORT':
        return vessels.filter((v) => v.speed <= 0.5);
      case 'HIGH_RISK':
        return vessels.filter((v) => v.riskLevel === 'HIGH' || v.riskLevel === 'CRITICAL');
      case 'ALL':
      default:
        return vessels;
    }
  }, [vessels, fleetLocationFilter]);

  // Export CSV for Auditor & Investigator
  const handleExportComplianceCSV = () => {
    const headers = ['IMO', 'Name', 'Flag', 'Type', 'KYC Status', 'AML Status', 'Classification', 'Risk Score'];
    const rows = vessels.map((v) => [
      v.imo,
      `"${v.name}"`,
      v.flag,
      v.type,
      v.kycStatus,
      v.amlStatus,
      `"${v.classificationSociety || 'Uncertified'}"`,
      v.riskScore,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nautilus_compliance_screening_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Top-level fleet deployment summary metrics
  const seaPercentage = Math.round((vesselsAtSea / (totalVessels || 1)) * 100);
  const portPercentage = Math.round((vesselsInPort / (totalVessels || 1)) * 100);
  const avgSpeed = vessels.length > 0
    ? (vessels.reduce((sum, v) => sum + v.speed, 0) / vessels.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-4">
      {/* Top-Level Maritime Deployment Posture & Operational Tabs */}
      <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-800 p-4 shadow-2xl relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-96 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
              </span>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Fleet Deployment & Operational Posture
              </h2>
              <span className="text-[11px] font-mono text-cyan-400/90 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/50">
                LIVE TELEMETRY
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Active real-time maritime telemetry dividing operational assets between high-seas transit and port operations.
            </p>
          </div>

          {/* Quick Metrics Badge Group */}
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-slate-800/80 self-start lg:self-center">
            <div className="flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-blue-400" />
              <span>Avg Speed: <strong className="text-white">{avgSpeed} kn</strong></span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Sync: <strong className="text-emerald-400">{activeTransmitting}/{totalVessels}</strong></span>
            </div>
          </div>
        </div>

        {/* Top-Level Clickable Summary Tabs Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-800/80">
          {/* Tab 1: All Fleet */}
          <button
            onClick={() => setFleetLocationFilter('ALL')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
              fleetLocationFilter === 'ALL'
                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500/30'
                : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${fleetLocationFilter === 'ALL' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                  <Ship className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200">All Fleet</span>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300">
                100%
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white font-mono tracking-tight">{totalVessels}</span>
              <span className="text-[11px] text-slate-400 font-mono">Total Tracked</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 font-mono truncate">
              Global AIS Fleet Deployment
            </div>
            {fleetLocationFilter === 'ALL' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500" />
            )}
          </button>

          {/* Tab 2: Vessels At Sea */}
          <button
            onClick={() => setFleetLocationFilter('AT_SEA')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
              fleetLocationFilter === 'AT_SEA'
                ? 'bg-blue-950/50 border-blue-500/60 shadow-lg shadow-blue-950/50 ring-1 ring-blue-500/30'
                : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${fleetLocationFilter === 'AT_SEA' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-blue-400'}`}>
                  <Compass className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200">Vessels at Sea</span>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-950/90 text-blue-300 border border-blue-800/60">
                {seaPercentage}%
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white font-mono tracking-tight text-blue-300">{vesselsAtSea}</span>
              <span className="text-[11px] text-blue-400/80 font-mono">Speed &gt; 0.5 kn</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>Underway in transit</span>
              <span className="text-cyan-400 text-[10px]">Click to filter →</span>
            </div>
            {fleetLocationFilter === 'AT_SEA' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-400" />
            )}
          </button>

          {/* Tab 3: Vessels In Port */}
          <button
            onClick={() => setFleetLocationFilter('IN_PORT')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
              fleetLocationFilter === 'IN_PORT'
                ? 'bg-emerald-950/50 border-emerald-500/60 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/30'
                : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${fleetLocationFilter === 'IN_PORT' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-emerald-400'}`}>
                  <Anchor className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200">Vessels in Port</span>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-800/60">
                {portPercentage}%
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white font-mono tracking-tight text-emerald-300">{vesselsInPort}</span>
              <span className="text-[11px] text-emerald-400/80 font-mono">Speed ≤ 0.5 kn</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>Moored / Anchored</span>
              <span className="text-emerald-400 text-[10px]">Click to filter →</span>
            </div>
            {fleetLocationFilter === 'IN_PORT' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
            )}
          </button>

          {/* Tab 4: High Risk Flagged */}
          <button
            onClick={() => setFleetLocationFilter('HIGH_RISK')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
              fleetLocationFilter === 'HIGH_RISK'
                ? 'bg-rose-950/50 border-rose-500/60 shadow-lg shadow-rose-950/50 ring-1 ring-rose-500/30'
                : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${fleetLocationFilter === 'HIGH_RISK' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-rose-400'}`}>
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200">High Risk Flagged</span>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-950/90 text-rose-300 border border-rose-800/60">
                {highRiskCount} Flagged
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white font-mono tracking-tight text-rose-300">{highRiskCount}</span>
              <span className="text-[11px] text-rose-400/80 font-mono">Critical Threat Vector</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>Sanctions / KYC anomalies</span>
              <span className="text-rose-400 text-[10px]">Click to filter →</span>
            </div>
            {fleetLocationFilter === 'HIGH_RISK' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-500 to-amber-500" />
            )}
          </button>
        </div>
      </div>

      {/* Main Full-Width Command Map (Spacious, Expansive 12-Column Layout) */}
      <div className="w-full flex flex-col h-[560px] lg:h-[680px]">
        <div className="flex flex-wrap items-center justify-between pb-2 mb-1 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              Global Live Maritime Command Map
            </h2>
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">
              · High-Precision AIS Geolocation
            </span>
          </div>

          {/* Operational Fleet Status Tabs (At Port vs At Sea) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/90 rounded-xl border border-slate-800 shadow-inner">
            <button
              onClick={() => setFleetLocationFilter('ALL')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                fleetLocationFilter === 'ALL'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Show all transmitting vessels"
            >
              <Ship className="w-3.5 h-3.5 text-cyan-400" />
              <span>All Fleet</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {totalVessels}
              </span>
            </button>

            <button
              onClick={() => setFleetLocationFilter('AT_SEA')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                fleetLocationFilter === 'AT_SEA'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Filter vessels currently navigating at sea (speed > 0.5 kn)"
            >
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>At Sea</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-950 text-blue-300 border border-blue-800/50 font-mono">
                {vesselsAtSea}
              </span>
            </button>

            <button
              onClick={() => setFleetLocationFilter('IN_PORT')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                fleetLocationFilter === 'IN_PORT'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Filter vessels currently in port, moored, or at anchor (speed <= 0.5 kn)"
            >
              <Anchor className="w-3.5 h-3.5 text-emerald-400" />
              <span>In Port</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/50 font-mono">
                {vesselsInPort}
              </span>
            </button>

            <button
              onClick={() => setFleetLocationFilter('HIGH_RISK')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                fleetLocationFilter === 'HIGH_RISK'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Filter high and critical risk vessels"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>High Risk</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50 font-mono">
                {highRiskCount}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-mono text-cyan-400 font-bold hidden sm:inline">
              {displayedVessels.length} Shown on Chart
            </span>
            <button
              onClick={() => onNavigateToTab('tracking')}
              className="px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>Full Tactical Chart</span>
              <span>→</span>
            </button>
          </div>
        </div>

        <div className="flex-1 w-full rounded-xl overflow-hidden shadow-2xl border border-slate-800">
          <TacticalMaritimeMap
            vessels={displayedVessels}
            selectedVesselId={selectedVesselId}
            onSelectVessel={(id) => {
              if (onOpenDossier) {
                onOpenDossier(id);
              } else {
                onSelectVessel(id);
                onNavigateToTab('vessel-profile');
              }
            }}
            onOpenDossier={(id) => {
              if (onOpenDossier) {
                onOpenDossier(id);
              } else {
                onSelectVessel(id);
                onNavigateToTab('vessel-profile');
              }
            }}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Secondary Bottom Operational Section: Role-Routed Maritime Incident Alerts */}
      <div className={`grid grid-cols-1 ${isViewOnlyCompliance ? 'lg:grid-cols-2' : 'grid-cols-1'} gap-4 pt-1`}>
        {/* Incident Alerts */}
        <div className="bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {currentRole === 'Operations Manager' ? 'Operational Incident Alerts' : 'Role-Routed Incident Alerts'}
              </h3>
            </div>
            <button
              onClick={() => onNavigateToTab('alerts')}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Alert Center ({roleAlerts.length}) →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {roleAlerts.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs sm:col-span-2">
                No active incidents routed to your permission tier.
              </div>
            ) : (
              roleAlerts.slice(0, 6).map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => onNavigateToTab('alerts')}
                  className="flex items-start justify-between gap-3 p-2.5 bg-slate-950/60 hover:bg-slate-950/90 rounded-lg border border-slate-800/80 hover:border-cyan-500/40 text-xs transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-400'
                            : alert.severity === 'HIGH'
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="font-bold text-white">{alert.vesselName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{alert.category}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{alert.title}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-cyan-400 font-semibold">{alert.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* View-Only Compliance Screening Logbook (Visible to Investigator & Auditor) */}
        {isViewOnlyCompliance && (
          <div className="bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Compliance Screening Logbook
                  </h3>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                  VIEW-ONLY
                </span>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 pr-1">
                {vessels.slice(0, 4).map((v) => (
                  <div key={v.id} className="p-2 bg-slate-950/70 rounded-lg border border-slate-800 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white">{v.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                          v.kycStatus === 'Verified'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        KYC: {v.kycStatus}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                      <span>IMO: {v.imo}</span>
                      <span>AML: {v.amlStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 mt-2 flex items-center gap-2">
              <button
                onClick={handleExportComplianceCSV}
                className="flex-1 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV Logbook</span>
              </button>
              <button
                onClick={() => onNavigateToTab('reports')}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
              >
                View All →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
