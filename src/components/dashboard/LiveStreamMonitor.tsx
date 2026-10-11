import React, { useState, useEffect } from 'react';
import { RawAISPacket, AISConnectionState } from '../../types/maritime';
import { aisStreamService } from '../../services/aisStreamService';
import { Play, Pause, Radio, RefreshCw, Terminal, Send, AlertTriangle, CheckCircle, Wifi, WifiOff } from 'lucide-react';

interface LiveStreamMonitorProps {
  onSelectVesselByMmsi?: (mmsi: string) => void;
}

export const LiveStreamMonitor: React.FC<LiveStreamMonitorProps> = ({ onSelectVesselByMmsi }) => {
  const [packets, setPackets] = useState<RawAISPacket[]>([]);
  const [connectionState, setConnectionState] = useState<AISConnectionState>('CONNECTED');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [totalPackets, setTotalPackets] = useState<number>(0);
  const [showInjectModal, setShowInjectModal] = useState<boolean>(false);

  // Injection form state
  const [injectMmsi, setInjectMmsi] = useState('352981000');
  const [injectLat, setInjectLat] = useState('1.295');
  const [injectLon, setInjectLon] = useState('103.870');
  const [injectSpeed, setInjectSpeed] = useState('16.2');
  const [injectCourse, setInjectCourse] = useState('286');

  useEffect(() => {
    setPackets(aisStreamService.getRawPackets());
    setConnectionState(aisStreamService.getConnectionState());
    setIsPaused(aisStreamService.getIsPaused());
    setTotalPackets(aisStreamService.getTotalPacketsReceived());

    const unsubVessels = aisStreamService.subscribe((_, latestPacket) => {
      setPackets([...aisStreamService.getRawPackets()]);
      setTotalPackets(aisStreamService.getTotalPacketsReceived());
    });

    const unsubConn = aisStreamService.subscribeConnection((state) => {
      setConnectionState(state);
    });

    return () => {
      unsubVessels();
      unsubConn();
    };
  }, []);

  const handleTogglePause = () => {
    const paused = aisStreamService.togglePause();
    setIsPaused(paused);
  };

  const handleSpeedChange = (mult: number) => {
    setSpeedMultiplier(mult);
    aisStreamService.setSpeedMultiplier(mult);
  };

  const handleStateChange = (state: AISConnectionState) => {
    if (state === 'RECONNECTING') {
      aisStreamService.reconnectAIS();
    } else {
      aisStreamService.setConnectionState(state);
    }
  };

  const handleManualInject = (e: React.FormEvent) => {
    e.preventDefault();
    const success = aisStreamService.receiveAISData({
      mmsi: injectMmsi,
      lat: parseFloat(injectLat),
      lon: parseFloat(injectLon),
      speed: parseFloat(injectSpeed),
      course: parseFloat(injectCourse),
    });
    if (success) {
      setShowInjectModal(false);
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col h-full">
      {/* Header telemetry status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/30">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live AIS Feed Ingestion</h3>
            <p className="text-[10px] text-slate-400 font-mono">ITU-R M.1371 STREAM · HIGH-PRECISION SATELLITE AIS</p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 rounded-md border border-slate-800">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === 'CONNECTED'
                  ? 'bg-emerald-400 animate-pulse'
                  : connectionState === 'RECONNECTING'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span
              className={`font-semibold ${
                connectionState === 'CONNECTED'
                  ? 'text-emerald-400'
                  : connectionState === 'RECONNECTING'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {connectionState}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-slate-950 rounded-md border border-slate-800 text-slate-300">
            <span className="text-slate-500">PKTS:</span>
            <span className="text-cyan-400 font-semibold">{totalPackets}</span>
          </div>
        </div>
      </div>

      {/* Terminal View */}
      <div className="flex-1 bg-slate-950/95 rounded-lg border border-slate-800/80 p-2.5 font-mono text-[11px] overflow-y-auto max-h-[175px] min-h-[120px] scrollbar-thin scrollbar-thumb-slate-800">
        <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-900 pb-1 mb-1.5">
          <span>TIME · MSG · MMSI · TELEMETRY SOG/COG</span>
          <span>STATUS</span>
        </div>

        {packets.length === 0 ? (
          <div className="text-center py-6 text-slate-600">Awaiting incoming NMEA/AIS telemetry packets...</div>
        ) : (
          <div className="space-y-1">
            {packets.slice(0, 16).map((pkt, idx) => (
              <div
                key={`stream-pkt-${pkt.id || 'p'}-${idx}-${pkt.mmsi}`}
                onClick={() => onSelectVesselByMmsi && onSelectVesselByMmsi(pkt.mmsi)}
                className="flex items-center justify-between text-slate-300 hover:bg-slate-900/80 px-1 py-0.5 rounded cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-cyan-400 text-[10px]">{pkt.timestamp}</span>
                  <span className="text-slate-500 font-bold">MMSI:{pkt.mmsi}</span>
                  <span className="text-slate-200 truncate">{pkt.description}</span>
                  <span className="text-slate-400 text-[10px] hidden sm:inline">
                    LAT:{pkt.lat.toFixed(3)} LON:{pkt.lon.toFixed(3)}
                  </span>
                  <span className="text-emerald-400 text-[10px]">
                    {pkt.speed}kn/{pkt.course}°
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 group-hover:text-cyan-300 shrink-0">
                  {pkt.status.substring(0, 10)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Packet Ingestion Modal */}
      {showInjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">Direct AIS Ingestion Simulator</h3>
              </div>
              <button
                onClick={() => setShowInjectModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleManualInject} className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">MMSI (9 Digits):</label>
                <input
                  type="text"
                  value={injectMmsi}
                  onChange={(e) => setInjectMmsi(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Latitude:</label>
                  <input
                    type="number"
                    step="0.001"
                    value={injectLat}
                    onChange={(e) => setInjectLat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Longitude:</label>
                  <input
                    type="number"
                    step="0.001"
                    value={injectLon}
                    onChange={(e) => setInjectLon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Speed (knots):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={injectSpeed}
                    onChange={(e) => setInjectSpeed(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Course (degrees):</label>
                  <input
                    type="number"
                    value={injectCourse}
                    onChange={(e) => setInjectCourse(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInjectModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded flex items-center gap-1.5 shadow-lg shadow-cyan-900/30"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Transmit Packet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
