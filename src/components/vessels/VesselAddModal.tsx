import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Vessel, VesselType, RiskLevel } from '../../types/maritime';
import { resolveVesselFlag } from '../../services/flagService';
import {
  Ship,
  X,
  Compass,
  Navigation,
  Anchor,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  MapPin,
  Building,
} from 'lucide-react';

interface VesselAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVessel: (vesselData: Partial<Vessel>) => void;
}

interface VesselPreset {
  name: string;
  type: VesselType;
  flag: string;
  flagCode: string;
  lat: number;
  lon: number;
  speed: number;
  course: number;
  origin: string;
  destination: string;
  owner: string;
  riskLevel: RiskLevel;
  riskScore: number;
  dwt: number;
  length: number;
}

const PRESETS: VesselPreset[] = [
  {
    name: 'NAUTILUS TITAN',
    type: 'Container Ship',
    flag: 'Singapore',
    flagCode: 'SG',
    lat: 1.25,
    lon: 103.82,
    speed: 16.8,
    course: 290,
    origin: 'SINGAPORE',
    destination: 'ROTTERDAM',
    owner: 'Nautilus Global Transport Ltd',
    riskLevel: 'LOW',
    riskScore: 12,
    dwt: 145000,
    length: 366,
  },
  {
    name: 'PACIFIC VALIANT',
    type: 'Crude Oil Tanker',
    flag: 'Marshall Islands',
    flagCode: 'MH',
    lat: 25.12,
    lon: 56.45,
    speed: 13.5,
    course: 145,
    origin: 'RAS TANURA',
    destination: 'NINGBO',
    owner: 'Oceanic Energy Maritime Corp',
    riskLevel: 'MEDIUM',
    riskScore: 38,
    dwt: 310000,
    length: 333,
  },
  {
    name: 'ARCTIC POLARIS',
    type: 'LNG Carrier',
    flag: 'Norway',
    flagCode: 'NO',
    lat: 50.15,
    lon: -0.85,
    speed: 17.2,
    course: 75,
    origin: 'SABINE PASS',
    destination: 'ZEEBRUGGE',
    owner: 'Nordic Gas Lines AS',
    riskLevel: 'LOW',
    riskScore: 9,
    dwt: 95000,
    length: 295,
  },
  {
    name: 'ATLANTIC BULKER',
    type: 'Bulk Carrier',
    flag: 'Panama',
    flagCode: 'PA',
    lat: 27.65,
    lon: 34.22,
    speed: 11.4,
    course: 330,
    origin: 'DAMPIER',
    destination: 'SUEZ CANAL',
    owner: 'Apex Minerals Shipping Ltd',
    riskLevel: 'HIGH',
    riskScore: 68,
    dwt: 180000,
    length: 292,
  },
  {
    name: 'POSEIDON GUARDIAN',
    type: 'Offshore Tug / Supply',
    flag: 'United Kingdom',
    flagCode: 'GB',
    lat: 36.12,
    lon: -5.35,
    speed: 15.0,
    course: 90,
    origin: 'GIBRALTAR',
    destination: 'MALTA OFFSHORE',
    owner: 'Britannia Marine Operations',
    riskLevel: 'LOW',
    riskScore: 14,
    dwt: 4500,
    length: 88,
  },
];

const LOCATION_PRESETS = [
  { label: 'Singapore Strait', lat: 1.25, lon: 103.85 },
  { label: 'Suez Transit', lat: 28.5, lon: 33.1 },
  { label: 'English Channel', lat: 50.2, lon: -0.5 },
  { label: 'Gibraltar Strait', lat: 35.95, lon: -5.5 },
  { label: 'Strait of Hormuz', lat: 26.3, lon: 56.4 },
  { label: 'Panama Approaches', lat: 8.8, lon: -79.5 },
  { label: 'Malacca Strait', lat: 3.2, lon: 100.8 },
];

export const VesselAddModal: React.FC<VesselAddModalProps> = ({
  isOpen,
  onClose,
  onAddVessel,
}) => {
  const [mode, setMode] = useState<'live_lookup' | 'preset' | 'custom'>('live_lookup');

  // Live AIS Lookup state
  const [searchIdentifier, setSearchIdentifier] = useState('9987196');
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Custom form state
  const [name, setName] = useState('');
  const [type, setType] = useState<VesselType>('Container Ship');
  const [flag, setFlag] = useState('Panama');
  const [imo, setImo] = useState('');
  const [mmsi, setMmsi] = useState('');
  const [callSign, setCallSign] = useState('');
  const [lat, setLat] = useState<number>(1.28);
  const [lon, setLon] = useState<number>(103.85);
  const [speed, setSpeed] = useState<number>(14.5);
  const [course, setCourse] = useState<number>(270);
  const [destination, setDestination] = useState('ROTTERDAM');
  const [origin, setOrigin] = useState('SINGAPORE');
  const [owner, setOwner] = useState('Nautilus Maritime Transport Ltd');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('LOW');

  if (!isOpen) return null;

  const handleLiveLookup = async (idToSearch?: string) => {
    const target = (idToSearch || searchIdentifier).trim().replace(/[^0-9]/g, '');
    if (!target) {
      setSearchError('Please enter a valid IMO or MMSI number.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      let token = '';
      if (typeof window !== 'undefined') {
        const { auth } = await import('../../services/firebase');
        if (auth.currentUser) {
          token = await auth.currentUser.getIdToken().catch(() => '');
        }
      }

      const res = await fetch(`/api/ais/search?q=${encodeURIComponent(target)}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const err = await res.json();
        setSearchError(err.error || 'Vessel not found in authorized AIS feed.');
        setLookupResult(null);
      } else {
        const data = await res.json();
        setLookupResult(data);
        setSearchError(null);
      }
    } catch (err: any) {
      setSearchError(err.message || 'Network error during AIS resolution.');
      setLookupResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmLiveTrack = (vesselData: any) => {
    const resolvedFlag = resolveVesselFlag({
      explicitFlag: vesselData.flag,
      explicitFlagCode: vesselData.flagCode,
      mmsi: vesselData.mmsi,
    });

    onAddVessel({
      name: vesselData.name,
      imo: vesselData.imo || '',
      mmsi: vesselData.mmsi,
      callSign: vesselData.callSign || 'NTR99',
      type: (vesselData.type || 'Container Ship') as VesselType,
      flag: resolvedFlag.flag,
      flagCode: resolvedFlag.flagCode,
      flagSource: resolvedFlag.flagSource,
      lat: vesselData.position.latitude,
      lon: vesselData.position.longitude,
      speed: vesselData.navigation.speed ?? 12.0,
      course: vesselData.navigation.course ?? (vesselData.navigation.heading ?? 0),
      heading: vesselData.navigation.heading ?? (vesselData.navigation.course ?? 0),
      navStatus: vesselData.navigation.navigationStatus || 'Under way using engine',
      destination: vesselData.voyage.destination || 'ROTTERDAM',
      eta: vesselData.voyage.eta || new Date(Date.now() + 86400000 * 12).toISOString(),
      owner: vesselData.owner || 'Authorized Maritime Transport',
      operator: vesselData.operator || vesselData.owner || 'Fleet Operator',
      draught: vesselData.navigation.draught ?? 14.5,
      length: vesselData.length ?? 366,
      beam: vesselData.beam ?? 51,
      deadweightTonnage: vesselData.deadweightTonnage ?? 150000,
      grossTonnage: vesselData.grossTonnage ?? 145000,
      yearBuilt: vesselData.yearBuilt ?? 2025,
      isTransmitting: true,
      isStale: false,
    });
    onClose();
  };

  const handleApplyPreset = (preset: VesselPreset) => {
    const generatedImo = Math.floor(9100000 + Math.random() * 890000).toString();
    const generatedMmsi = Math.floor(200000000 + Math.random() * 700000000).toString();
    const generatedCallSign = (preset.flag.slice(0, 2) + Math.floor(1000 + Math.random() * 9000)).toUpperCase();

    onAddVessel({
      name: preset.name,
      type: preset.type,
      flag: preset.flag,
      flagCode: preset.flagCode,
      imo: generatedImo,
      mmsi: generatedMmsi,
      callSign: generatedCallSign,
      lat: preset.lat,
      lon: preset.lon,
      prevLat: preset.lat - 0.05,
      prevLon: preset.lon - 0.05,
      speed: preset.speed,
      course: preset.course,
      heading: preset.course,
      origin: preset.origin,
      destination: preset.destination,
      owner: preset.owner,
      operator: preset.owner,
      deadweightTonnage: preset.dwt,
      grossTonnage: Math.round(preset.dwt * 0.8),
      length: preset.length,
      riskLevel: preset.riskLevel,
      riskScore: preset.riskScore,
      kycStatus: 'Verified',
      amlStatus: preset.riskLevel === 'HIGH' ? 'Potential Match' : 'Clear',
      isTransmitting: true,
      isStale: false,
    });
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vesselName = name.trim() || 'NAUTILUS VANGUARD';
    const finalImo = imo.trim() || Math.floor(9200000 + Math.random() * 790000).toString();
    const finalMmsi = mmsi.trim() || Math.floor(300000000 + Math.random() * 600000000).toString();
    const finalCallSign = callSign.trim() || 'NTL' + Math.floor(100 + Math.random() * 900);

    onAddVessel({
      name: vesselName.toUpperCase(),
      type,
      flag,
      imo: finalImo,
      mmsi: finalMmsi,
      callSign: finalCallSign.toUpperCase(),
      lat: Number(lat),
      lon: Number(lon),
      prevLat: Number(lat) - 0.05,
      prevLon: Number(lon) - 0.05,
      speed: Number(speed),
      course: Number(course),
      heading: Number(course),
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      owner,
      operator: owner,
      riskLevel,
      riskScore: riskLevel === 'CRITICAL' ? 88 : riskLevel === 'HIGH' ? 65 : riskLevel === 'MEDIUM' ? 35 : 12,
      kycStatus: 'Verified',
      amlStatus: riskLevel === 'CRITICAL' ? 'Confirmed Match' : riskLevel === 'HIGH' ? 'Potential Match' : 'Clear',
      isTransmitting: true,
      isStale: false,
    });
    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      style={{ margin: 0 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#09111e] rounded-2xl border border-cyan-500/40 shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col my-auto max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Ship className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                Deploy & Track New Vessel
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                  Real-Time AIS
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Enroll vessel into NAUTILUS global tracking network
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch: One-Click Presets vs Custom Blueprint */}
        <div className="px-6 pt-3 pb-2 flex items-center gap-2 border-b border-slate-800/80 bg-slate-900/40">
          <button
            onClick={() => setMode('preset')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'preset'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>1-Click Fleet Presets (Instant Deploy)</span>
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'custom'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Custom Vessel Blueprint</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {mode === 'preset' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Choose a ready-to-track vessel blueprint. It will immediately begin broadcasting live AIS telemetry
                and moving along its voyage corridor on the Real-Time World Map:
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                {PRESETS.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/60 hover:bg-slate-850/80 transition-all group flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-white group-hover:text-cyan-300 transition-colors">
                          {p.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {p.type}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            p.riskLevel === 'HIGH'
                              ? 'bg-orange-500/20 text-orange-400'
                              : p.riskLevel === 'MEDIUM'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          RISK {p.riskScore}/100
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                        <span>Flag: <strong className="text-slate-200">{p.flag}</strong></span>
                        <span>·</span>
                        <span>Route: <strong className="text-cyan-400">{p.origin} → {p.destination}</strong></span>
                        <span>·</span>
                        <span>Speed: <strong className="text-slate-200">{p.speed} kn</strong></span>
                        <span>·</span>
                        <span>DWT: <strong className="text-slate-200">{p.dwt.toLocaleString()} t</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleApplyPreset(p)}
                      className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs shadow-md shadow-cyan-950/40 transition-all shrink-0 flex items-center gap-1.5"
                    >
                      <Navigation className="w-3.5 h-3.5 fill-current" />
                      <span>Deploy to Map</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'custom' && (
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 font-mono block mb-1">Vessel Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. NAUTILUS DISCOVERY"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-mono block mb-1">Vessel Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as VesselType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Container Ship">Container Ship</option>
                    <option value="Crude Oil Tanker">Crude Oil Tanker</option>
                    <option value="Chemical Tanker">Chemical Tanker</option>
                    <option value="LNG Carrier">LNG Carrier</option>
                    <option value="LPG Tanker">LPG Tanker</option>
                    <option value="Bulk Carrier">Bulk Carrier</option>
                    <option value="General Cargo">General Cargo</option>
                    <option value="Offshore Tug / Supply">Offshore Tug / Supply</option>
                    <option value="Vehicle Carrier">Vehicle Carrier</option>
                    <option value="Passenger / Cruise">Passenger / Cruise</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-mono block mb-1">Flag State</label>
                  <input
                    type="text"
                    value={flag}
                    onChange={(e) => setFlag(e.target.value)}
                    placeholder="e.g. Singapore, Panama, Marshall Islands"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-mono block mb-1">Initial Risk Level</label>
                  <select
                    value={riskLevel}
                    onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="LOW">LOW (Standard compliance)</option>
                    <option value="MEDIUM">MEDIUM (Enhanced scrutiny)</option>
                    <option value="HIGH">HIGH (Advisory flag)</option>
                    <option value="CRITICAL">CRITICAL (Sanction / Dark AIS trigger)</option>
                  </select>
                </div>
              </div>

              {/* Geographic Coordinates & Quick Port Preset Buttons */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    Starting Position Coordinates
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {LOCATION_PRESETS.map((loc, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setLat(loc.lat);
                        setLon(loc.lon);
                      }}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-cyan-500/20 text-[11px] font-mono text-slate-300 hover:text-cyan-300 border border-slate-800 transition-colors"
                    >
                      {loc.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <label className="text-slate-500 block mb-1">Latitude (°N/S)</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={lat}
                      onChange={(e) => setLat(parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-cyan-300 focus:outline-none focus:border-cyan-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Longitude (°E/W)</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={lon}
                      onChange={(e) => setLon(parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-cyan-300 focus:outline-none focus:border-cyan-500 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Speed, Course, Destination */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 font-mono block mb-1">Speed (knots)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-mono block mb-1">Course (° Heading)</label>
                  <input
                    type="number"
                    min="0"
                    max="359"
                    value={course}
                    onChange={(e) => setCourse(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-mono block mb-1">Destination Port</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. ROTTERDAM"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-mono text-xs block mb-1">Registered Owner / Commercial Operator</label>
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g. Nautilus Ocean Transport Ltd"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-cyan-950/50 transition-all flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5 fill-current" />
                  <span>Deploy to Real-Time Map</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
