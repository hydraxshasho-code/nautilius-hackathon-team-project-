import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { GeofenceZone, geofenceService, LatLng } from '../../services/geofenceService';
import { Vessel } from '../../types/maritime';
import {
  Shield,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  Clock,
  Sliders,
  AlertTriangle,
  Pentagon,
  Ship,
  Sparkles,
} from 'lucide-react';

interface GeofenceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: GeofenceZone[];
  vessels: Vessel[];
  onStartDrawing: () => void;
  onSelectVessel?: (vesselId: string) => void;
}

const COLOR_OPTIONS = [
  { label: 'Cyan Alert', hex: '#06b6d4' },
  { label: 'Rose Critical', hex: '#ef4444' },
  { label: 'Amber Warning', hex: '#f59e0b' },
  { label: 'Emerald Safe', hex: '#10b981' },
  { label: 'Purple Tactical', hex: '#a855f7' },
  { label: 'Blue Maritime', hex: '#3b82f6' },
];

export const GeofenceManagerModal: React.FC<GeofenceManagerModalProps> = ({
  isOpen,
  onClose,
  zones,
  vessels,
  onStartDrawing,
  onSelectVessel,
}) => {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(zones[0]?.id || null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editColor, setEditColor] = useState<string>('#06b6d4');
  const [editSeverity, setEditSeverity] = useState<'CRITICAL' | 'WARNING' | 'INFO'>('WARNING');
  const [editOnEnter, setEditOnEnter] = useState<boolean>(true);
  const [editOnExit, setEditOnExit] = useState<boolean>(true);
  const [editOnDwell, setEditOnDwell] = useState<boolean>(true);
  const [editDwellMinutes, setEditDwellMinutes] = useState<number>(3);

  if (!isOpen) return null;

  const activeZone = zones.find((z) => z.id === selectedZoneId) || zones[0];

  const handleStartEdit = (zone: GeofenceZone) => {
    setSelectedZoneId(zone.id);
    setEditName(zone.name);
    setEditDescription(zone.description || '');
    setEditColor(zone.color);
    setEditSeverity(zone.severity);
    setEditOnEnter(zone.triggers.onEnter);
    setEditOnExit(zone.triggers.onExit);
    setEditOnDwell(zone.triggers.onDwell);
    setEditDwellMinutes(Math.max(1, Math.round((zone.triggers.dwellThresholdSeconds || 180) / 60)));
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZone) return;

    geofenceService.updateZone(activeZone.id, {
      name: editName,
      description: editDescription,
      color: editColor,
      severity: editSeverity,
      triggers: {
        onEnter: editOnEnter,
        onExit: editOnExit,
        onDwell: editOnDwell,
        dwellThresholdSeconds: editDwellMinutes * 60,
      },
    });

    setIsEditing(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this geofence zone? All active triggers will be removed.')) {
      geofenceService.deleteZone(id);
      if (selectedZoneId === id) {
        setSelectedZoneId(zones.find((z) => z.id !== id)?.id || null);
      }
    }
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
        className="bg-[#090f1d] border border-cyan-500/40 rounded-2xl w-full max-w-4xl my-auto shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-cyan-600 to-teal-500 rounded-xl text-slate-950 font-bold shadow-lg shadow-cyan-950/40">
              <Pentagon className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
                  Tactical Geofencing & Exclusion Zone Management
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {zones.length} ZONES ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Custom Polygon Demarcation · Entry/Exit Telemetry Triggers · SOC Dwell Time Alarms
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onStartDrawing();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold text-xs rounded-lg shadow-md shadow-cyan-950/40 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Draw Polygon On Map</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Split View */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Left: Zone List */}
          <div className="w-full md:w-80 bg-slate-950/60 p-3 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1 pb-1">
              <span>DEFINED GEOFENCES</span>
              <button
                onClick={() => geofenceService.resetToDefaults()}
                className="text-cyan-400 hover:underline text-[10px]"
              >
                Reset Defaults
              </button>
            </div>

            {zones.map((zone) => {
              const isSelected = zone.id === (activeZone?.id || selectedZoneId);
              return (
                <div
                  key={zone.id}
                  onClick={() => {
                    setSelectedZoneId(zone.id);
                    setIsEditing(false);
                  }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500 shadow-lg shadow-cyan-950/20'
                      : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-black/40"
                        style={{ backgroundColor: zone.color }}
                      />
                      <span className="font-bold text-white truncate max-w-[150px]">{zone.name}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        geofenceService.toggleZone(zone.id);
                      }}
                      className={`p-1 rounded transition-colors ${
                        zone.enabled ? 'text-emerald-400 hover:bg-emerald-950/40' : 'text-slate-600 hover:bg-slate-800'
                      }`}
                      title={zone.enabled ? 'Zone Active - Monitoring' : 'Zone Muted'}
                    >
                      {zone.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                    {zone.description || 'Custom polygon geofence zone'}
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/60">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold ${
                        zone.severity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300'
                          : zone.severity === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-cyan-500/20 text-cyan-300'
                      }`}
                    >
                      {zone.severity}
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Ship className="w-3 h-3 text-cyan-400" />
                      <span>{zone.vesselCountInside} Inside</span>
                    </span>
                    <span>{zone.polygon.length} Vertices</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Zone Inspector & Config */}
          <div className="flex-1 p-5 overflow-y-auto bg-slate-900/30">
            {activeZone && !isEditing ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: activeZone.color }}
                      />
                      <h4 className="text-base font-bold text-white">{activeZone.name}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{activeZone.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEdit(activeZone)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                    >
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Configure Zone</span>
                    </button>
                    <button
                      onClick={() => handleDelete(activeZone.id)}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors"
                      title="Delete geofence"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Triggers Breakdown */}
                <div>
                  <h5 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-2.5">
                    Surveillance Trigger Rules
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-mono">ON-ENTRY ALERT</div>
                      <div className="flex items-center gap-1.5 mt-1 font-bold text-xs">
                        {activeZone.triggers.onEnter ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-300">Armed (Immediate)</span>
                          </>
                        ) : (
                          <>
                            <X className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-500">Disabled</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-mono">ON-EXIT ALERT</div>
                      <div className="flex items-center gap-1.5 mt-1 font-bold text-xs">
                        {activeZone.triggers.onExit ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-300">Armed (Immediate)</span>
                          </>
                        ) : (
                          <>
                            <X className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-500">Disabled</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-mono">LOITERING / DWELL</div>
                      <div className="flex items-center gap-1.5 mt-1 font-bold text-xs">
                        {activeZone.triggers.onDwell ? (
                          <>
                            <Clock className="w-4 h-4 text-amber-400" />
                            <span className="text-amber-300">
                              Surpass {Math.round(activeZone.triggers.dwellThresholdSeconds / 60)}m
                            </span>
                          </>
                        ) : (
                          <>
                            <X className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-500">Disabled</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Polygon Coordinates Table */}
                <div>
                  <h5 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-2.5">
                    Polygon Geographic Boundaries ({activeZone.polygon.length} Coordinates)
                  </h5>
                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden text-[11px] font-mono">
                    <div className="grid grid-cols-3 p-2 bg-slate-900/80 text-slate-400 font-bold border-b border-slate-800">
                      <span>Vertex</span>
                      <span>Latitude</span>
                      <span>Longitude</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-900">
                      {activeZone.polygon.map((p, idx) => (
                        <div key={idx} className="grid grid-cols-3 p-2 text-slate-300">
                          <span className="text-cyan-400">Node #{idx + 1}</span>
                          <span>{p.lat.toFixed(4)}° {p.lat >= 0 ? 'N' : 'S'}</span>
                          <span>{p.lon.toFixed(4)}° {p.lon >= 0 ? 'E' : 'W'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : isEditing && activeZone ? (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-white">Configure Geofence Parameters</h4>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Zone Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">Alert Severity</label>
                    <select
                      value={editSeverity}
                      onChange={(e) => setEditSeverity(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    >
                      <option value="CRITICAL">Critical Priority</option>
                      <option value="WARNING">Warning</option>
                      <option value="INFO">Informational</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">Map Overlay Color</label>
                    <div className="flex items-center gap-1.5 pt-1">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setEditColor(c.hex)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            editColor === c.hex ? 'border-white scale-110' : 'border-transparent opacity-70'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Trigger Checkboxes */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="text-[11px] font-mono font-bold text-cyan-400">AUTOMATED ALERT TRIGGERS</div>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editOnEnter}
                      onChange={(e) => setEditOnEnter(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span>Trigger alert immediately when vessel enters zone</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editOnExit}
                      onChange={(e) => setEditOnExit(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span>Trigger alert when vessel departs / exits zone</span>
                  </label>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editOnDwell}
                        onChange={(e) => setEditOnDwell(e.target.checked)}
                        className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>Trigger alert on loitering duration surpassing:</span>
                    </label>

                    <div className="flex items-center gap-1 text-xs font-mono">
                      <input
                        type="number"
                        min={1}
                        max={120}
                        disabled={!editOnDwell}
                        value={editDwellMinutes}
                        onChange={(e) => setEditDwellMinutes(parseInt(e.target.value) || 1)}
                        className="w-14 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-center text-white disabled:opacity-40"
                      />
                      <span className="text-slate-400">mins</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-bold rounded-lg text-xs shadow-md shadow-cyan-950/40"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
