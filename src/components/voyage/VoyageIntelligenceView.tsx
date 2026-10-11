import React, { useState } from 'react';
import { Vessel } from '../../types/maritime';
import { TacticalMaritimeMap } from '../map/TacticalMaritimeMap';
import {
  Compass,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Anchor,
  Clock,
  Navigation,
  TrendingUp,
  MapPin,
  AlertTriangle,
} from 'lucide-react';

interface VoyageIntelligenceViewProps {
  vessels: Vessel[];
  selectedVesselId: string | null;
  onSelectVessel: (vesselId: string) => void;
}

export const VoyageIntelligenceView: React.FC<VoyageIntelligenceViewProps> = ({
  vessels,
  selectedVesselId,
  onSelectVessel,
}) => {
  const [activeVesselId, setActiveVesselId] = useState<string>(
    selectedVesselId || vessels[0]?.id || ''
  );
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(1);
  const [playbackProgress, setPlaybackProgress] = useState<number>(65);
  const [timeWindow, setTimeWindow] = useState<'1H' | '6H' | '12H' | '24H' | '7D'>('24H');

  if (!vessels || vessels.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/80 rounded-2xl border border-slate-800 text-slate-400">
        <Compass className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-50" />
        <h3 className="text-sm font-bold text-white mb-1">No Active Vessels Available</h3>
        <p className="text-xs">Add or wait for fleet telemetry ingestion to inspect voyage intelligence.</p>
      </div>
    );
  }

  const vessel = vessels.find((v) => v.id === activeVesselId) || vessels[0];
  const portCalls = Array.isArray(vessel?.portCalls) ? vessel.portCalls : [];
  const totalDist = vessel?.totalDistanceNm ?? 4800;
  const traveledDist = vessel?.distanceTraveledNm ?? 1200;
  const remainingDist = Math.max(0, totalDist - traveledDist);

  const formatEta = (rawEta?: string) => {
    try {
      if (!rawEta) return 'SCHEDULED';
      const d = new Date(rawEta);
      return isNaN(d.getTime()) ? rawEta : d.toUTCString();
    } catch {
      return 'SCHEDULED';
    }
  };

  const handleToggleReplay = () => {
    setIsReplaying(!isReplaying);
  };

  const handleResetReplay = () => {
    setPlaybackProgress(0);
    setIsReplaying(false);
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white tracking-wide">
              Voyage Intelligence & Historical Track Replay
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            AIS Track Reconstruction · Dead Reckoning Verification · Weather Routing Analytics
          </p>
        </div>

        {/* Vessel Selector Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Select Target:</span>
          <select
            value={vessel?.id || activeVesselId}
            onChange={(e) => {
              setActiveVesselId(e.target.value);
              onSelectVessel(e.target.value);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
          >
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.type || 'Vessel'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Voyage Replay Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Map Viewport (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col h-[520px]">
          <div className="flex-1 w-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative">
            <TacticalMaritimeMap
              vessels={[vessel]}
              selectedVesselId={vessel?.id || null}
              onSelectVessel={() => {}}
              className="w-full h-full"
            />

            {/* Floating Replay Controls Overlay */}
            <div className="absolute bottom-4 left-4 right-4 z-30 bg-slate-950/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between mb-2 text-xs font-mono">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-cyan-400 font-bold">REPLAY TIMELINE:</span>
                  <span>{timeWindow} WINDOW</span>
                </div>
                <div className="text-slate-400">
                  PROGRESS: <span className="text-cyan-300 font-bold">{playbackProgress}%</span>
                </div>
              </div>

              {/* Scrubber slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={playbackProgress}
                onChange={(e) => setPlaybackProgress(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 mb-3"
              />

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleToggleReplay}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isReplaying
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    }`}
                  >
                    {isReplaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isReplaying ? 'PAUSE' : 'PLAY REPLAY'}</span>
                  </button>

                  <button
                    onClick={handleResetReplay}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition-colors"
                    title="Reset to origin"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {/* Multiplier */}
                  <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-800 text-[11px] font-mono">
                    {[1, 2, 5, 10].map((s) => (
                      <button
                        key={s}
                        onClick={() => setReplaySpeed(s)}
                        className={`px-2 py-0.5 rounded ${
                          replaySpeed === s ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time filter chips */}
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 text-[11px] font-mono">
                  {(['1H', '6H', '12H', '24H', '7D'] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setTimeWindow(w)}
                      className={`px-2 py-0.5 rounded ${
                        timeWindow === w ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Voyage Metrics & Ports (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Key Voyage Metrics Card */}
          <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 mb-3 border-b border-slate-800">
              Voyage Progress & Nautical Stats
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">ORIGIN:</span>
                <span className="font-bold text-white">{vessel?.origin || 'SINGAPORE'}</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">DESTINATION:</span>
                <span className="font-bold text-cyan-400">{vessel?.destination || 'ROTTERDAM'}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">TOTAL DISTANCE</span>
                  <span className="font-bold text-white text-sm">{totalDist} NM</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">TRAVELED</span>
                  <span className="font-bold text-emerald-400 text-sm">{traveledDist} NM</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">REMAINING</span>
                  <span className="font-bold text-amber-400 text-sm">{remainingDist} NM</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">CURRENT SOG</span>
                  <span className="font-bold text-cyan-300 text-sm">{vessel?.speed ?? 0} kn</span>
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block">ESTIMATED TIME OF ARRIVAL (ETA)</span>
                <span className="text-slate-200 text-xs font-bold">{formatEta(vessel?.eta)}</span>
              </div>
            </div>
          </div>

          {/* Port Calls Timeline */}
          <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 mb-3 border-b border-slate-800">
              Voyage Port Itinerary
            </h3>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {portCalls.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Direct corridor passage / no intermediate coastal port calls.
                </div>
              ) : (
                portCalls.map((pc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Anchor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <div>
                        <span className="font-bold text-white block">{pc.portName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{pc.country}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                        pc.status === 'Completed'
                          ? 'bg-slate-800 text-slate-400'
                          : pc.status === 'Current'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {pc.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
