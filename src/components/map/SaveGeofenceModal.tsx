import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { LatLng, geofenceService } from '../../services/geofenceService';
import { Pentagon, X, Shield, Clock, Check, AlertTriangle } from 'lucide-react';

interface SaveGeofenceModalProps {
  isOpen: boolean;
  vertices: LatLng[];
  onClose: () => void;
  onSaved: () => void;
}

const COLOR_OPTIONS = [
  { label: 'Cyan Alert', hex: '#06b6d4' },
  { label: 'Rose Critical', hex: '#ef4444' },
  { label: 'Amber Warning', hex: '#f59e0b' },
  { label: 'Emerald Safe', hex: '#10b981' },
  { label: 'Purple Tactical', hex: '#a855f7' },
  { label: 'Blue Maritime', hex: '#3b82f6' },
];

export const SaveGeofenceModal: React.FC<SaveGeofenceModalProps> = ({
  isOpen,
  vertices,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('Custom Surveillance Geofence ' + (Math.floor(Math.random() * 900) + 100));
  const [description, setDescription] = useState('Guarded exclusion perimeter with automated alert triggers.');
  const [color, setColor] = useState('#06b6d4');
  const [severity, setSeverity] = useState<'CRITICAL' | 'WARNING' | 'INFO'>('WARNING');
  const [onEnter, setOnEnter] = useState(true);
  const [onExit, setOnExit] = useState(true);
  const [onDwell, setOnDwell] = useState(true);
  const [dwellMinutes, setDwellMinutes] = useState(3);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (vertices.length < 3) return;

    geofenceService.addZone({
      name,
      description,
      polygon: vertices,
      color,
      enabled: true,
      severity,
      category: 'CUSTOM',
      triggers: {
        onEnter,
        onExit,
        onDwell,
        dwellThresholdSeconds: dwellMinutes * 60,
      },
    });

    onSaved();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
      style={{ margin: 0 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#090f1d] border border-cyan-500/40 rounded-2xl w-full max-w-lg my-auto shadow-2xl overflow-hidden relative flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-cyan-600 to-teal-500 rounded-xl text-slate-950 font-bold shadow-md shadow-cyan-950/40">
              <Pentagon className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Save Drawn Geofence Zone
              </h3>
              <p className="text-[11px] text-slate-400">
                {vertices.length} vertices plotted on tactical nautical chart
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">Geofence Name</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              placeholder="e.g. Malacca TSS Exclusion Area"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">Purpose / Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              placeholder="Describe trigger rationale or regulatory mandate..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Alert Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="CRITICAL">Critical Alert</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Informational</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Overlay Color</label>
              <div className="flex items-center gap-1.5 pt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      color === c.hex ? 'border-white scale-110' : 'border-transparent opacity-70'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Trigger Toggles */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
            <div className="text-[11px] font-mono font-bold text-cyan-400">SURVEILLANCE TRIGGER RULES</div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onEnter}
                onChange={(e) => setOnEnter(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Trigger alert when vessel enters zone (Immediate)</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onExit}
                onChange={(e) => setOnExit(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Trigger alert when vessel exits zone</span>
            </label>

            <div className="flex items-center justify-between pt-1 border-t border-slate-900">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onDwell}
                  onChange={(e) => setOnDwell(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>Trigger alert on loitering duration surpassing:</span>
              </label>

              <div className="flex items-center gap-1 text-xs font-mono">
                <input
                  type="number"
                  min={1}
                  max={120}
                  disabled={!onDwell}
                  value={dwellMinutes}
                  onChange={(e) => setDwellMinutes(parseInt(e.target.value) || 1)}
                  className="w-14 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-center text-white disabled:opacity-40"
                />
                <span className="text-slate-400">mins</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
            >
              Discard
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-bold rounded-lg text-xs shadow-lg shadow-cyan-950/40"
            >
              Activate Geofence
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
