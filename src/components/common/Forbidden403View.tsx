import React from 'react';
import { UserRole } from '../../types/maritime';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

interface Forbidden403ViewProps {
  currentRole: UserRole;
  moduleName: string;
  allowedRoles?: UserRole[];
  onReturnToDashboard: () => void;
}

export const Forbidden403View: React.FC<Forbidden403ViewProps> = ({
  currentRole,
  moduleName,
  allowedRoles = [],
  onReturnToDashboard,
}) => {
  return (
    <div className="min-h-[480px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-rose-500/40 rounded-2xl p-6 shadow-2xl text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
          <Lock className="w-7 h-7" />
        </div>

        <div>
          <span className="text-[11px] font-mono font-bold text-rose-400 uppercase tracking-widest block mb-1">
            HTTP 403 · Access Forbidden
          </span>
          <h2 className="text-lg font-bold text-white tracking-wide">
            {moduleName} Restricted
          </h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Your current assigned permission tier (<strong>{currentRole}</strong>) is not authorized to view, access, or initiate operations in this module.
          </p>
        </div>

        {allowedRoles.length > 0 && (
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-left text-xs font-mono">
            <span className="text-slate-500 block text-[10px] uppercase mb-1">Authorized Roles Only:</span>
            <div className="flex flex-wrap gap-1.5">
              {allowedRoles.map((r) => (
                <span
                  key={r}
                  className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={onReturnToDashboard}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Authorized Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
