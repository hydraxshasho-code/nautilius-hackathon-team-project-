import React from 'react';
import { Vessel } from '../../types/maritime';
import { AlertTriangle, Trash2, X, Ship } from 'lucide-react';

interface VesselRemoveConfirmModalProps {
  isOpen: boolean;
  vessel: Vessel | null;
  onClose: () => void;
  onConfirmRemove: (vesselId: string) => void;
}

export const VesselRemoveConfirmModal: React.FC<VesselRemoveConfirmModalProps> = ({
  isOpen,
  vessel,
  onClose,
  onConfirmRemove,
}) => {
  if (!isOpen || !vessel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#09111e] rounded-2xl border border-rose-500/40 shadow-2xl shadow-rose-950/50 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-wide">De-register Vessel</h3>
              <p className="text-[11px] text-slate-400 font-mono">Remove target from live AIS tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
            <Ship className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{vessel.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {vessel.flag}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                IMO: <span className="text-slate-200">{vessel.imo}</span> · MMSI:{' '}
                <span className="text-slate-200">{vessel.mmsi}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Type: <span className="text-cyan-400">{vessel.type}</span> · Current speed:{' '}
                <span className="text-slate-200">{vessel.speed} kn</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Are you sure you want to remove this vessel from NAUTILUS? Its active AIS broadcast stream, historical
              track, and live positioning coordinates will be de-registered from the command console.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirmRemove(vessel.id);
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/60 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Confirm De-registration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
