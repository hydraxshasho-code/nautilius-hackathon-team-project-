import React, { useState } from 'react';
import { Vessel } from '../../types/maritime';
import { riskEngine, ComprehensiveRiskAssessment } from '../../services/riskEngine';
import {
  ShieldAlert,
  Activity,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  FileCheck,
  Compass,
  ArrowRight,
  Radio,
  Building,
  FileText,
  MapPin,
  CloudRain,
  History,
  ShieldCheck,
} from 'lucide-react';

interface RiskAssessmentViewProps {
  vessels: Vessel[];
  onSelectVessel: (vesselId: string) => void;
}

export const RiskAssessmentView: React.FC<RiskAssessmentViewProps> = ({ vessels, onSelectVessel }) => {
  const [selectedVesselId, setSelectedVesselId] = useState<string>(
    vessels.find((v) => v.riskLevel === 'CRITICAL' || v.riskLevel === 'HIGH')?.id ||
      vessels[0]?.id ||
      ''
  );

  if (!vessels || vessels.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/80 rounded-2xl border border-slate-800 text-slate-400">
        <ShieldAlert className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-50" />
        <h3 className="text-sm font-bold text-white mb-1">No Fleet Telemetry Loaded</h3>
        <p className="text-xs">Add a vessel to evaluate neural risk scoring across 9 dimensions.</p>
      </div>
    );
  }

  const vessel = vessels.find((v) => v.id === selectedVesselId) || vessels[0];
  const assessment: ComprehensiveRiskAssessment = riskEngine.evaluateVessel(vessel);

  const factorItems = [
    { key: 'A', name: 'AIS Telemetry', data: assessment.factors.ais, icon: Radio, desc: 'Signal continuity, dead-reckoning drift, spoofing flags' },
    { key: 'B', name: 'Vessel Identity', data: assessment.factors.vesselIdentity, icon: FileCheck, desc: 'IMO integrity, hull age, flag state regulatory tier' },
    { key: 'C', name: 'Ownership (UBO)', data: assessment.factors.ownership, icon: Building, desc: 'Beneficial ownership transparency, corporate layering' },
    { key: 'D', name: 'Documents', data: assessment.factors.documents, icon: FileText, desc: 'Statutory safety certificates, IACS classification, P&I' },
    { key: 'E', name: 'Sanctions (OFAC)', data: assessment.factors.sanctions, icon: ShieldAlert, desc: 'OFAC SDN, EU, UN, UK maritime sanction registries' },
    { key: 'F', name: 'Voyage Schedule', data: assessment.factors.voyage, icon: Compass, desc: 'Schedule adherence, open sea loitering, speed drops' },
    { key: 'G', name: 'Route Corridors', data: assessment.factors.route, icon: MapPin, desc: 'War risk zones, Bab-el-Mandeb, Hormuz, chokepoints' },
    { key: 'H', name: 'Weather Hazards', data: assessment.factors.weather, icon: CloudRain, desc: 'Tropical cyclones, severe gales, high wave swells' },
    { key: 'I', name: 'Historical Behaviour', data: assessment.factors.historicalBehaviour, icon: History, desc: 'Dark activity history, AIS gaps, prior STS events' },
  ];

  // SVG Radar Polygon points calculation (9 axes)
  const numAxes = factorItems.length;
  const radarRadius = 85;
  const centerCoord = 110;

  const points = factorItems.map((comp, idx) => {
    const angle = (Math.PI * 2 * idx) / numAxes - Math.PI / 2;
    const r = (comp.data.score / 100) * radarRadius;
    const x = centerCoord + Math.cos(angle) * r;
    const y = centerCoord + Math.sin(angle) * r;
    return `${x},${y}`;
  });

  const polygonString = points.join(' ');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white tracking-wide">
              Explainable Maritime Threat & Risk Engine (9 Defined Dimensions)
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Algorithmic Threat Evaluation · Live AIS, Voyage & KYC Integrations · Continuous Background Scoring
          </p>
        </div>

        {/* Vessel Target Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Target Vessel:</span>
          <select
            value={vessel.id}
            onChange={(e) => {
              setSelectedVesselId(e.target.value);
              onSelectVessel(e.target.value);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
          >
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} (Risk: {v.riskScore}/100 [{v.riskLevel}])
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Target Vessel Snapshot & Aggregate Risk Bar */}
      <div className="bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-extrabold text-white">{vessel.name}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                {vessel.type || 'Vessel'}
              </span>
              <span
                className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded ${
                  assessment.overallLevel === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : assessment.overallLevel === 'HIGH'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                    : assessment.overallLevel === 'MEDIUM'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {assessment.overallLevel} RISK ({assessment.overallScore}/100)
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              IMO {vessel.imo} · Flag: {vessel.flag} · Destination: {vessel.destination || 'Unassigned'} · KYC: {vessel.kycStatus || 'Pending'}
            </p>
          </div>

          <button
            onClick={() => onSelectVessel(vessel.id)}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-all"
          >
            Open Intelligence Dossier →
          </button>
        </div>

        {/* Dynamic Aggregate Risk Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 font-bold">AGGREGATE WEIGHTED THREAT SCORE:</span>
            <span
              className={`font-extrabold ${
                assessment.overallScore >= 75
                  ? 'text-rose-400'
                  : assessment.overallScore >= 50
                  ? 'text-orange-400'
                  : assessment.overallScore >= 25
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {assessment.overallScore} / 100
            </span>
          </div>

          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                assessment.overallScore >= 75
                  ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-red-600 shadow-md shadow-rose-950'
                  : assessment.overallScore >= 50
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                  : assessment.overallScore >= 25
                  ? 'bg-gradient-to-r from-teal-500 to-amber-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${Math.max(4, assessment.overallScore)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0 (Low Risk)</span>
            <span>25 (Medium)</span>
            <span>50 (High)</span>
            <span>75+ (Critical Sanctions / Breach)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: 9 Factors Breakdown (8 Cols) + Radar Chart (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 9 Dimensions Breakdown (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Nine Defined Risk Dimensions & Evidence Audit
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Asynchronously updated on AIS & KYC events
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {factorItems.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.key}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-white block">
                            {f.key}. {f.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Weight: {Math.round(f.data.weight * 100)}%
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                          f.data.score >= 70
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : f.data.score >= 40
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {f.data.score}/100
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-tight mb-2">{f.desc}</p>
                  </div>

                  {f.data.evidence && f.data.evidence.length > 0 && (
                    <div className="pt-2 border-t border-slate-900 text-[10px] text-slate-400 italic">
                      "{f.data.evidence[0]}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 9-Axis Vector Threat Radar (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl flex flex-col items-center justify-between">
          <div className="w-full text-left pb-3 mb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              9-Axis Neural Radar Polygon
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Multi-dimensional threat footprint</span>
          </div>

          <div className="relative my-auto flex items-center justify-center">
            <svg width="220" height="220" className="overflow-visible">
              {/* Concentric rings */}
              {[0.25, 0.5, 0.75, 1.0].map((ring, rIdx) => (
                <circle
                  key={rIdx}
                  cx={centerCoord}
                  cy={centerCoord}
                  r={radarRadius * ring}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray={ring < 1.0 ? '2,2' : undefined}
                />
              ))}

              {/* Axis Spoke Lines */}
              {factorItems.map((_, idx) => {
                const angle = (Math.PI * 2 * idx) / numAxes - Math.PI / 2;
                const x = centerCoord + Math.cos(angle) * radarRadius;
                const y = centerCoord + Math.sin(angle) * radarRadius;
                return (
                  <line
                    key={idx}
                    x1={centerCoord}
                    y1={centerCoord}
                    x2={x}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Data polygon */}
              <polygon
                points={polygonString}
                fill={assessment.overallScore >= 50 ? 'rgba(244, 63, 94, 0.35)' : 'rgba(6, 182, 212, 0.35)'}
                stroke={assessment.overallScore >= 50 ? '#f43f5e' : '#06b6d4'}
                strokeWidth="2"
              />

              {/* Points */}
              {points.map((pt, pIdx) => {
                const [px, py] = pt.split(',').map(Number);
                return (
                  <circle
                    key={pIdx}
                    cx={px}
                    cy={py}
                    r="3.5"
                    fill={assessment.overallScore >= 50 ? '#fda4af' : '#67e8f9'}
                  />
                );
              })}
            </svg>
          </div>

          <div className="w-full text-center pt-3 border-t border-slate-800 text-[11px] text-slate-400 font-mono">
            Evaluated: {new Date(assessment.lastEvaluatedAt).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};
