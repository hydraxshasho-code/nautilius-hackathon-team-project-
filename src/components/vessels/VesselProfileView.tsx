import React, { useState, useEffect } from 'react';
import { Vessel, IncidentAlert, AISAnomaly } from '../../types/maritime';
import { TacticalMaritimeMap } from '../map/TacticalMaritimeMap';
import tankerPhoto from '../../assets/images/vessel_crude_tanker_1790444889279.jpg';
import reconPhoto from '../../assets/images/vessel_satellite_recon_1790444877704.jpg';
import {
  Ship,
  Navigation,
  Compass,
  Anchor,
  ShieldAlert,
  ShieldCheck,
  Building,
  FileText,
  Activity,
  AlertTriangle,
  History,
  CheckCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Layers,
  Radio,
  Trash2,
  MapPin,
  ZoomIn,
  X,
  Camera,
  Eye,
  Maximize2,
  Crosshair,
} from 'lucide-react';

interface VesselProfileViewProps {
  vessel: Vessel;
  allVessels?: Vessel[];
  alerts: IncidentAlert[];
  anomalies: AISAnomaly[];
  onNavigateToTab: (tabId: string) => void;
  onSelectVessel: (vesselId: string) => void;
  onRemoveVessel?: (vesselId: string) => void;
}

export const VesselProfileView: React.FC<VesselProfileViewProps> = ({
  vessel,
  allVessels,
  alerts,
  anomalies,
  onNavigateToTab,
  onSelectVessel,
  onRemoveVessel,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'tracking'
    | 'voyage'
    | 'ownership'
    | 'kyc'
    | 'aml'
    | 'risk'
    | 'documents'
    | 'history'
    | 'alerts'
  >('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalFilter, setModalFilter] = useState<'standard' | 'night_vision' | 'sar_thermal'>('standard');
  const [imageZoom, setImageZoom] = useState<number>(1);

  // Pick appropriate satellite/aerial reconnaissance photo from bundled assets with fallback
  const isTanker =
    vessel.type?.includes('Tanker') ||
    vessel.type === 'Crude Oil Tanker' ||
    vessel.type === 'Chemical Tanker' ||
    vessel.type === 'Product Tanker';

  const defaultPhoto = isTanker
    ? (tankerPhoto || '/vessel_crude_tanker_1790444889279.jpg')
    : (reconPhoto || '/vessel_satellite_recon_1790444877704.jpg');

  const [photoSrc, setPhotoSrc] = useState<string>(defaultPhoto);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
    setPhotoSrc(defaultPhoto);
  }, [vessel.id, vessel.name, defaultPhoto]);

  const handlePhotoError = () => {
    if (isTanker && photoSrc !== '/vessel_crude_tanker_1790444889279.jpg') {
      setPhotoSrc('/vessel_crude_tanker_1790444889279.jpg');
    } else if (!isTanker && photoSrc !== '/vessel_satellite_recon_1790444877704.jpg') {
      setPhotoSrc('/vessel_satellite_recon_1790444877704.jpg');
    } else {
      setImageError(true);
    }
  };

  const vesselAlerts = alerts.filter((a) => a.vesselId === vessel.id);
  const vesselAnomalies = anomalies.filter((a) => a.vesselId === vessel.id);

  return (
    <div className="space-y-4">
      {/* Top Vessel Dossier Header Card */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Visual satellite/recon preview thumbnail with zoom trigger */}
            <div
              onClick={() => {
                setImageZoom(1);
                setIsImageModalOpen(true);
              }}
              className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-cyan-500/50 bg-slate-950 shrink-0 shadow-2xl cursor-pointer group hover:border-cyan-400 transition-all duration-300"
              title="Click to inspect full-resolution satellite reconnaissance imagery"
            >
              {!imageError ? (
                <img
                  src={photoSrc}
                  alt={vessel.name}
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                  onError={handlePhotoError}
                />
              ) : (
                /* Crisp tactical SVG schematic if image fails */
                <div className="w-full h-full p-2 bg-slate-950 flex flex-col items-center justify-center text-cyan-400">
                  <Ship className="w-10 h-10 opacity-80" />
                  <span className="text-[9px] font-mono mt-1 text-slate-400 uppercase tracking-wider font-bold">
                    {vessel.type?.split(' ')[0] || 'VESSEL'}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute top-1.5 right-1.5 bg-slate-950/90 border border-cyan-500/40 p-1.5 rounded-lg text-cyan-300 opacity-90 group-hover:opacity-100 shadow-md transition-all group-hover:scale-110">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
              <span className="absolute bottom-1.5 left-2 text-[10px] font-mono text-cyan-300 font-bold flex items-center gap-1.5 bg-slate-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                SAT-RECON
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h1 className="text-xl font-extrabold text-white tracking-wide">{vessel.name}</h1>
                <span className="text-xs text-slate-400 font-sans">({vessel.flag})</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                <div>
                  <span className="text-slate-500">IMO:</span> <span className="text-slate-200">{vessel.imo}</span>
                </div>
                <div>
                  <span className="text-slate-500">MMSI:</span> <span className="text-slate-200">{vessel.mmsi}</span>
                </div>
                <div>
                  <span className="text-slate-500">CALL SIGN:</span>{' '}
                  <span className="text-slate-200 uppercase">{vessel.callSign}</span>
                </div>
                <div>
                  <span className="text-slate-500">TYPE:</span>{' '}
                  <span className="text-cyan-400 font-sans">{vessel.type}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                <span>
                  Owner: <strong className="text-slate-300 font-sans">{vessel.owner}</strong>
                </span>
                <span>·</span>
                <span>
                  Operator: <strong className="text-slate-300 font-sans">{vessel.operator}</strong>
                </span>
                <span>·</span>
                <span>
                  Class: <strong className="text-slate-300 font-mono">{vessel.classificationSociety}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Right Status & Risk Score Pills */}
          <div className="flex flex-wrap items-center lg:flex-col lg:items-end gap-2 shrink-0">
            <div
              className={`px-3 py-1 rounded-lg text-xs font-bold font-mono tracking-wide ${
                vessel.riskLevel === 'CRITICAL'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-rose-950/40 shadow-lg'
                  : vessel.riskLevel === 'HIGH'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : vessel.riskLevel === 'MEDIUM'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              RISK INDEX: {vessel.riskScore}/100 ({vessel.riskLevel})
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">KYC:</span>
              <span
                className={`font-semibold ${
                  vessel.kycStatus === 'Verified' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {vessel.kycStatus}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">AML:</span>
              <span
                className={`font-semibold ${
                  vessel.amlStatus === 'Clear'
                    ? 'text-emerald-400'
                    : vessel.amlStatus === 'Confirmed Match'
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                {vessel.amlStatus}
              </span>
            </div>

            <span className="text-[11px] text-slate-500 font-mono">
              Last AIS signal received {vessel.lastUpdatedSecondsAgo}s ago
            </span>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => {
                  onSelectVessel(vessel.id);
                  onNavigateToTab('tracking');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white rounded-lg text-xs font-bold shadow-md shadow-cyan-950/40 transition-all"
                title="Locate and follow this vessel on the Real-Time World Map"
              >
                <Navigation className="w-3.5 h-3.5 fill-current" />
                <span>Track on Live World Map</span>
              </button>

              {onRemoveVessel && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-950 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 rounded-lg text-xs font-medium transition-colors"
                  title="Remove / De-register vessel from active tracking"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">De-register</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Intelligence Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 mt-5 pt-3 border-t border-slate-800 text-xs font-medium">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'tracking', label: 'Live Tracking' },
            { id: 'voyage', label: 'Voyage Intelligence' },
            { id: 'ownership', label: 'Corporate Ownership' },
            { id: 'kyc', label: 'KYC Compliance' },
            { id: 'aml', label: 'AML & Sanctions' },
            { id: 'risk', label: 'AI Risk Engine' },
            { id: 'documents', label: 'Certificates' },
            { id: 'history', label: 'AIS Historical Track' },
            { id: 'alerts', label: `Alerts (${vesselAlerts.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content Display */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Telemetry Details (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Live Navigation & Real-time Metrics Card */}
            <div className="bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Real-Time Navigational Telemetry
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">STATUS: {vessel.navStatus}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono mb-4">
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">SOG (SPEED)</span>
                  <span className="text-base font-bold text-cyan-300">{vessel.speed} kn</span>
                </div>
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">COG (COURSE)</span>
                  <span className="text-base font-bold text-slate-200">{vessel.course}°</span>
                </div>
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">HEADING</span>
                  <span className="text-base font-bold text-slate-200">{vessel.heading}°</span>
                </div>
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">DRAUGHT</span>
                  <span className="text-base font-bold text-slate-200">{vessel.draught} m</span>
                </div>
              </div>

              {/* Coordinates & Route Destination */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
                <div>
                  <span className="text-slate-500 text-[10px] block">CURRENT COORDINATES</span>
                  <span className="text-slate-200 text-sm font-bold">
                    {vessel.lat.toFixed(4)}° {vessel.lat >= 0 ? 'N' : 'S'} / {vessel.lon.toFixed(4)}°{' '}
                    {vessel.lon >= 0 ? 'E' : 'W'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">DESTINATION & ESTIMATED ARRIVAL</span>
                  <span className="text-cyan-300 text-sm font-bold block">{vessel.destination}</span>
                  <span className="text-slate-400 text-[11px]">ETA: {new Date(vessel.eta).toUTCString()}</span>
                </div>
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 mb-3 border-b border-slate-800">
                Statutory Dimensions & Tonnage
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">GROSS TONNAGE</span>
                  <span className="text-slate-200 font-semibold">{vessel.grossTonnage.toLocaleString()} GT</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">DEADWEIGHT TONNAGE</span>
                  <span className="text-slate-200 font-semibold">{vessel.deadweightTonnage.toLocaleString()} DWT</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">LENGTH OVERALL (LOA)</span>
                  <span className="text-slate-200 font-semibold">{vessel.length} meters</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">BEAM (WIDTH)</span>
                  <span className="text-slate-200 font-semibold">{vessel.beam} meters</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">YEAR BUILT</span>
                  <span className="text-slate-200 font-semibold">{vessel.yearBuilt}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">CLASSIFICATION SOCIETY</span>
                  <span className="text-cyan-300 font-semibold">{vessel.classificationSociety}</span>
                </div>
              </div>
            </div>

            {/* Risk Factors Highlight */}
            {vessel.riskEvidence && vessel.riskEvidence.length > 0 && (
              <div className="bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl">
                <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-800">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    AI Risk Engine Evidence Summary
                  </h3>
                </div>

                <div className="space-y-1.5">
                  {vessel.riskEvidence.map((ev, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2 bg-slate-950/70 rounded border border-slate-800/80 text-xs text-slate-300"
                    >
                      <span className="text-amber-400 font-bold">·</span>
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Recon Imagery & Mini Command Map (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Dedicated Satellite & Aerial Reconnaissance Imagery Card */}
            <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Satellite & Visual Reconnaissance
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  VERIFIED TARGET
                </span>
              </div>

              {/* Photo Display Frame with Interactive Zoom & Inspection */}
              <div
                onClick={() => {
                  setImageZoom(1);
                  setIsImageModalOpen(true);
                }}
                className="relative h-48 w-full rounded-lg overflow-hidden border border-slate-700/80 bg-slate-950 cursor-pointer group shadow-2xl hover:border-cyan-500/60 transition-all duration-300"
              >
                {!imageError ? (
                  <img
                    src={photoSrc}
                    alt={vessel.name}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    onError={handlePhotoError}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-cyan-400 p-4">
                    <Ship className="w-12 h-12 opacity-80" />
                    <span className="text-xs font-mono mt-2 text-slate-300 uppercase font-bold">{vessel.type}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">IMO {vessel.imo}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/30 pointer-events-none" />

                {/* Tactical Reticle Lines */}
                <div className="absolute inset-0 pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity">
                  <div className="absolute top-1/2 left-4 right-4 h-[1px] bg-cyan-500/30" />
                  <div className="absolute left-1/2 top-4 bottom-4 w-[1px] bg-cyan-500/30" />
                </div>

                {/* Corner Overlays */}
                <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-300 bg-slate-950/85 px-2 py-0.5 rounded border border-cyan-500/40">
                  FOV: OPTICAL-HIRES · 0.35m GSD
                </div>
                <div className="absolute top-2 right-2 bg-slate-950/85 p-1.5 rounded-lg text-cyan-300 border border-cyan-500/40 opacity-90 group-hover:opacity-100 flex items-center gap-1 text-[11px] font-mono shadow-md">
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Inspect Full-Res</span>
                </div>
                <div className="absolute bottom-2 left-2 text-[10px] font-mono text-slate-300">
                  <span className="font-bold text-white">{vessel.name}</span> · Flag: {vessel.flag}
                </div>
              </div>

              {/* Reconnaissance Telemetry Metadata */}
              <div className="grid grid-cols-3 gap-2 mt-2.5 text-[10px] font-mono text-slate-400">
                <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800 text-center">
                  <span className="text-slate-500 block">SENSOR TYPE</span>
                  <span className="text-slate-200 font-bold">{isTanker ? 'SAR / OPTICAL' : 'ELECTRO-OPTICAL'}</span>
                </div>
                <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800 text-center">
                  <span className="text-slate-500 block">TARGET LENGTH</span>
                  <span className="text-cyan-300 font-bold">{vessel.length}m × {vessel.beam}m</span>
                </div>
                <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800 text-center">
                  <span className="text-slate-500 block">IMAGE STATUS</span>
                  <span className="text-emerald-400 font-bold">CALIBRATED</span>
                </div>
              </div>
            </div>

            {/* Mini Command Map */}
            <div className="flex flex-col h-[380px]">
              <div className="flex items-center justify-between pb-2 mb-1">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Target Position & Historical Track</h3>
                <span className="text-[11px] font-mono text-cyan-400">Live Satellite AIS</span>
              </div>

              <div className="flex-1 w-full rounded-xl overflow-hidden border border-slate-800 shadow-xl">
                <TacticalMaritimeMap
                  vessels={allVessels || [vessel]}
                  selectedVesselId={vessel.id}
                  onSelectVessel={onSelectVessel}
                  className="w-full h-full"
                  allowFullscreen={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tracking' && (
        <div className="h-[580px] w-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
          <TacticalMaritimeMap
            vessels={allVessels || [vessel]}
            selectedVesselId={vessel.id}
            onSelectVessel={onSelectVessel}
            className="w-full h-full"
          />
        </div>
      )}

      {activeTab === 'ownership' && (
        <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Building className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                Verified Corporate Ownership Tree
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Entity Hierarchy & Beneficial Ownership (UBO) Registry
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {vessel.ownershipStructure.map((node, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-cyan-400 font-mono">
                    {idx + 1}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block">{node.name}</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      Role: <strong className="text-slate-200">{node.role}</strong> · Country: {node.country} · Reg:{' '}
                      {node.registrationNumber}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                      node.sanctionStatus === 'FLAGGED'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : node.sanctionStatus === 'POTENTIAL_MATCH'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}
                  >
                    {node.sanctionStatus}
                  </span>
                  {node.sharePercentage && (
                    <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                      {node.sharePercentage}% Equity Control
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'risk' && (
        <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                Explainable Multi-Factor Risk Assessment
              </h3>
              <p className="text-xs text-slate-400 font-mono">9 Automated Algorithmic Risk Vectors</p>
            </div>
            <span className="text-2xl font-extrabold text-cyan-400 font-mono">{vessel.riskScore} / 100</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(vessel.riskBreakdown).map(([key, score]) => (
              <div key={key} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-400 uppercase font-mono text-[11px]">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <span className="font-bold text-white font-mono">{score}/100</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      score > 70 ? 'bg-rose-500' : score > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide pb-2 border-b border-slate-800">
            Statutory Maritime Certificates & Insurance
          </h3>

          <div className="space-y-2 text-xs font-mono">
            {[
              { doc: 'Safety Management Certificate (ISM Code)', issuer: vessel.classificationSociety, exp: '2028-04-14', status: 'VALID' },
              { doc: 'International Ship Security Certificate (ISPS)', issuer: vessel.flag, exp: '2027-11-20', status: 'VALID' },
              { doc: 'Maritime Labour Convention (MLC 2006)', issuer: 'International Labour Org', exp: '2027-08-01', status: 'VALID' },
              { doc: 'International Oil Pollution Prevention (IOPP)', issuer: vessel.classificationSociety, exp: '2026-12-15', status: 'RENEWAL_DUE' },
              { doc: 'Protection & Indemnity (P&I) Entry Certificate', issuer: 'Gard P&I Club / UK P&I', exp: '2027-02-20', status: 'VALID' },
            ].map((d, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-slate-200">{d.doc}</span>
                </div>
                <div className="flex items-center gap-4 text-slate-400">
                  <span>Issuer: {d.issuer}</span>
                  <span>Expires: {d.exp}</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      d.status === 'VALID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'voyage' && (
        <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Voyage Route & Port Call Timeline</h3>
              <p className="text-xs text-slate-400 font-mono">
                From {vessel.origin} to {vessel.destination}
              </p>
            </div>
            <div className="text-right font-mono text-xs">
              <span className="text-slate-400">Total Distance:</span>{' '}
              <strong className="text-cyan-400">{vessel.totalDistanceNm} NM</strong> ·{' '}
              <span className="text-slate-400">Traveled:</span>{' '}
              <strong className="text-emerald-400">{vessel.distanceTraveledNm} NM</strong>
            </div>
          </div>

          <div className="space-y-3">
            {vessel.portCalls.map((pc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-3">
                  <Anchor className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="font-bold text-white text-sm block">{pc.portName}</span>
                    <span className="text-slate-400 font-mono text-[11px]">Country: {pc.country}</span>
                  </div>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <span className="text-slate-400 block">ARR: {new Date(pc.arrival).toLocaleDateString()}</span>
                  <span
                    className={`font-bold ${
                      pc.status === 'Completed'
                        ? 'text-slate-400'
                        : pc.status === 'Current'
                        ? 'text-cyan-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {pc.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-5 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide pb-2 border-b border-slate-800">
            Active Security & Compliance Alerts for {vessel.name}
          </h3>

          {vesselAlerts.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No active security incidents or alerts logged for this vessel.
            </div>
          ) : (
            vesselAlerts.map((a) => (
              <div key={a.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{a.title}</span>
                  <span className="text-rose-400 font-mono font-bold">{a.severity}</span>
                </div>
                <p className="text-slate-400">{a.description}</p>
                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 font-mono">
                  <span>Assigned: {a.assignedTo || 'Unassigned'}</span>
                  <span>{new Date(a.timestamp).toUTCString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800 mb-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">De-register Vessel from Fleet</h3>
                <span className="text-xs text-slate-400 font-mono">Disconnect Live Real-Time AIS Stream</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed font-sans">
              Confirm removal of <strong className="text-white">{vessel.name}</strong> (IMO {vessel.imo}) from active monitoring? Its tracking thread will be terminated and removed from the tactical real-time world map.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onRemoveVessel) {
                    onRemoveVessel(vessel.id);
                    onNavigateToTab('registry');
                  }
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs shadow-md shadow-rose-950/40 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm De-registration</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Resolution Satellite & Aerial Reconnaissance Imagery Modal */}
      {isImageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <span>Tactical Visual Reconnaissance Dossier: {vessel.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      IMO {vessel.imo}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    High-Resolution Orbital Reconnaissance · Multi-Spectral Sensor Capture
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Optical Filter Controls */}
                <div className="hidden sm:flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                  <button
                    onClick={() => setModalFilter('standard')}
                    className={`px-2 py-1 rounded transition-colors ${
                      modalFilter === 'standard' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    OPTICAL
                  </button>
                  <button
                    onClick={() => setModalFilter('night_vision')}
                    className={`px-2 py-1 rounded transition-colors ${
                      modalFilter === 'night_vision' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    NIGHT FLIR
                  </button>
                  <button
                    onClick={() => setModalFilter('sar_thermal')}
                    className={`px-2 py-1 rounded transition-colors ${
                      modalFilter === 'sar_thermal' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ORBITAL SAR
                  </button>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
                  <button
                    onClick={() => setImageZoom((prev) => Math.max(1, prev - 0.25))}
                    className="px-1 hover:text-cyan-400"
                    title="Zoom Out"
                  >
                    -
                  </button>
                  <span className="text-[11px] text-cyan-300 font-bold">{Math.round(imageZoom * 100)}%</span>
                  <button
                    onClick={() => setImageZoom((prev) => Math.min(2.5, prev + 0.25))}
                    className="px-1 hover:text-cyan-400"
                    title="Zoom In"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => setIsImageModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* High-Resolution Image Canvas with Tactical HUD */}
            <div className="relative bg-black h-[420px] sm:h-[480px] w-full overflow-hidden flex items-center justify-center select-none">
              {!imageError ? (
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-200"
                  style={{ transform: `scale(${imageZoom})` }}
                >
                  <img
                    src={photoSrc}
                    alt={vessel.name}
                    className={`max-w-full max-h-full object-contain ${
                      modalFilter === 'night_vision'
                        ? 'hue-rotate-90 saturate-200 contrast-125'
                        : modalFilter === 'sar_thermal'
                        ? 'invert saturate-50 contrast-150'
                        : ''
                    }`}
                    onError={handlePhotoError}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-cyan-400 p-8 space-y-3">
                  <Ship className="w-20 h-20 opacity-80" />
                  <span className="text-sm font-bold text-white font-mono">{vessel.name}</span>
                  <span className="text-xs text-slate-400 font-mono">
                    Tactical transponder telemetry verified · High-frequency satellite radar track active
                  </span>
                </div>
              )}

              {/* Tactical Reticle Overlay */}
              <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start text-[10px] font-mono text-cyan-400/80">
                  <div className="bg-slate-950/80 p-2 rounded border border-cyan-500/30 space-y-0.5">
                    <div>LAT: <span className="text-white font-bold">{vessel.lat.toFixed(4)}° {vessel.lat >= 0 ? 'N' : 'S'}</span></div>
                    <div>LON: <span className="text-white font-bold">{vessel.lon.toFixed(4)}° {vessel.lon >= 0 ? 'E' : 'W'}</span></div>
                    <div>SOG: <span className="text-cyan-300 font-bold">{vessel.speed} kn</span> · COG: {vessel.course}°</div>
                  </div>

                  <div className="bg-slate-950/80 p-2 rounded border border-cyan-500/30 text-right space-y-0.5">
                    <div>TARGET: <span className="text-white font-bold">{vessel.name}</span></div>
                    <div>CLASS: <span className="text-slate-300">{vessel.type}</span></div>
                    <div>FLAG: <span className="text-emerald-400 font-bold">{vessel.flag}</span></div>
                  </div>
                </div>

                {/* Central Targeting Reticle */}
                <div className="self-center flex flex-col items-center justify-center">
                  <div className="w-20 h-20 border border-cyan-400/40 rounded-full flex items-center justify-center animate-pulse">
                    <Crosshair className="w-8 h-8 text-cyan-400/60" />
                  </div>
                </div>

                <div className="flex justify-between items-end text-[10px] font-mono text-slate-400">
                  <div className="bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
                    RESOLVED GSD: 0.35m · SATELLITE PASS: METEOR-M2 · TIME: {new Date(vessel.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800 text-cyan-300 font-bold">
                    NAUTILUS SAT-RECON ENGINE
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Metadata Bar */}
            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-4 text-slate-400">
                <span>Draught: <strong className="text-white">{vessel.draught}m</strong></span>
                <span>Length: <strong className="text-white">{vessel.length}m</strong></span>
                <span>Beam: <strong className="text-white">{vessel.beam}m</strong></span>
                <span>Call Sign: <strong className="text-cyan-400 uppercase">{vessel.callSign}</strong></span>
                <span>Status: <strong className="text-emerald-400">{vessel.navStatus}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-mono font-semibold transition-colors"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
