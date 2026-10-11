import React from 'react';
import { Radio, Server, Database, Shield, MapPin, Activity, CheckCircle, X } from 'lucide-react';

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemHealthModal: React.FC<SystemHealthModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const subsystems = [
    { name: 'AIS Data Stream', status: 'CONNECTED', latency: '42ms', protocol: 'NMEA / ITU-R M.1371 Stream', icon: Radio, healthy: true },
    { name: 'Tactical Map Engine', status: 'ONLINE', latency: '60 FPS', protocol: 'HTML5 Vector / WebGL 2D/3D', icon: MapPin, healthy: true },
    { name: 'AI Risk Engine', status: 'ONLINE', latency: '120ms', protocol: '9-Vector Neural Threat Classifier', icon: Activity, healthy: true },
    { name: 'AML Screening Engine', status: 'ONLINE', latency: '85ms', protocol: 'OFAC / EU / UN Sanctions Connector', icon: Shield, healthy: true },
    { name: 'REST Ingestion Gateway', status: 'HEALTHY', latency: '18ms', protocol: 'HTTPS / JSON Direct Feed Ingest', icon: Server, healthy: true },
    { name: 'Vessel State Store', status: 'HEALTHY', latency: '2ms', protocol: 'In-Memory Real-Time State DB', icon: Database, healthy: true },
    { name: 'WebSocket Bi-Directional Bus', status: 'CONNECTED', latency: '12ms', protocol: 'WSS Push Telemetry Channel', icon: Radio, healthy: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              System Infrastructure & Subsystem Telemetry
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 font-mono text-xs">
          {subsystems.map((sub, i) => {
            const Icon = sub.icon;
            return (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-900 text-cyan-400 border border-slate-800">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block font-sans">{sub.name}</span>
                    <span className="text-slate-500 text-[10px]">{sub.protocol}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-emerald-400 text-xs">{sub.status}</span>
                  </div>
                  <span className="text-slate-500 text-[10px] block mt-0.5">{sub.latency}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-center text-[11px] text-slate-400 font-mono">
          All 7 platform subsystems operational · Zero packet loss in last 60 minutes
        </div>
      </div>
    </div>
  );
};
