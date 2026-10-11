import React, { useState, useEffect } from 'react';
import { Vessel } from '../../types/maritime';
import { securityAuditClient, ImmutableAuditLogClient } from '../../services/securityAuditClient';
import { useAuth } from '../common/FirebaseAuthProvider';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Lock,
  Hash,
  Activity,
  AlertTriangle,
  FileCheck2,
  FileText,
  ListFilter,
} from 'lucide-react';
import { SecurityAuditReportPanel } from './SecurityAuditReportPanel';

interface AuditLogsViewProps {
  vessels?: Vessel[];
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'REPORT'>('LEDGER');
  const [logs, setLogs] = useState<ImmutableAuditLogClient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [chainIntegrityVerified, setChainIntegrityVerified] = useState<boolean>(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ImmutableAuditLogClient | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setAccessError(null);
    try {
      const result = await securityAuditClient.getAuditLogs();
      if (result.error) {
        setAccessError(result.error);
        setLogs([]);
      } else {
        setLogs(result.logs);
        setChainIntegrityVerified(result.isVerified);
      }
    } catch (err: any) {
      setAccessError(err.message || 'Unable to load security audit ledger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  const filteredLogs = logs.filter(
    (l) =>
      l.user?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.eventType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.module?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.entity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white tracking-wide">
              Centralized Immutable Security Audit Ledger
            </h1>
            {chainIntegrityVerified && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <FileCheck2 className="w-3 h-3" />
                CHAIN INTEGRITY VERIFIED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Cryptographic SHA-256 Hash Chaining · HMAC Non-Repudiation · Admin-Only Access
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Verify & Refresh</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter by Actor, Event, Entity, Hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono w-64"
            />
          </div>
        </div>
      </div>

      {/* Subnavigation Tabs: Ledger vs Compliance Report */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
            activeTab === 'LEDGER'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>Immutable Audit Ledger</span>
        </button>
        <button
          onClick={() => setActiveTab('REPORT')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
            activeTab === 'REPORT'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          <span>Automated Security Audit Report</span>
        </button>
      </div>

      {activeTab === 'REPORT' ? (
        <SecurityAuditReportPanel />
      ) : (
        <>
          {/* Access Restriction Notice if user is not authorized admin */}
          {accessError && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 text-xs font-mono text-amber-200 flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm mb-0.5">Restricted Security Audit Access</span>
                <p className="text-amber-300/90 leading-relaxed">{accessError}</p>
                <p className="text-[11px] text-amber-400/70 mt-1">
                  Authenticate with Super Admin credentials via the top-bar profile switcher to inspect the cryptographic ledger.
                </p>
              </div>
            </div>
          )}

          {/* Audit Log Table */}
          <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800 font-mono uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Seq / UTC Time</th>
                    <th className="py-3 px-3">Actor (User)</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Event Type</th>
                    <th className="py-3 px-3">Target Entity</th>
                    <th className="py-3 px-3">IP Address</th>
                    <th className="py-3 px-3">State Transition</th>
                    <th className="py-3 px-3 text-right">Hash Signature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          <span className="text-cyan-400 font-bold block text-[10px]">#{log.sequence}</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white font-sans max-w-[140px] truncate">
                          {log.user}
                        </td>
                        <td className="py-2.5 px-3 text-cyan-300 font-sans">{log.role}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              log.eventType.includes('LOGIN')
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : log.eventType.includes('ROLE') || log.eventType.includes('ADMIN')
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : log.eventType.includes('VESSEL')
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {log.eventType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white tracking-wide max-w-[120px] truncate">
                          {log.entity}: {log.entityId}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{log.ipAddress}</td>
                        <td className="py-2.5 px-3 font-sans text-xs">
                          {log.previousState && (
                            <span className="text-rose-400/80 block text-[10px] line-clamp-1">
                              {log.previousState}
                            </span>
                          )}
                          <span className="text-emerald-400 block text-[10px] line-clamp-1">
                            → {log.newState || 'RECORDED'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[10px] text-cyan-400/80 whitespace-nowrap">
                          <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                            {log.currentHash.substring(0, 10)}...
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                        {isLoading ? 'Verifying cryptographic chain...' : 'No audit records match the current filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Details for Clicked Log */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white font-mono text-sm">
                  Ledger Entry #{selectedLog.sequence} Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Event ID:</span>
                <span className="text-white">{selectedLog.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp:</span>
                <span className="text-slate-200">{selectedLog.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Actor User:</span>
                <span className="text-cyan-300 font-bold">{selectedLog.user}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Role:</span>
                <span className="text-emerald-400">{selectedLog.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Event Type:</span>
                <span className="text-amber-400 font-bold">{selectedLog.eventType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Entity:</span>
                <span className="text-white">{selectedLog.entity} ({selectedLog.entityId})</span>
              </div>
              <div className="border-t border-slate-800 pt-2 space-y-1">
                <span className="text-slate-500 block">Cryptographic Hashes:</span>
                <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px] break-all space-y-1">
                  <div>
                    <span className="text-slate-500 block">Previous Hash (Link):</span>
                    <span className="text-slate-400">{selectedLog.previousHash}</span>
                  </div>
                  <div>
                    <span className="text-cyan-500 block">Current Hash:</span>
                    <span className="text-cyan-300">{selectedLog.currentHash}</span>
                  </div>
                  <div>
                    <span className="text-emerald-500 block">HMAC Non-Repudiation Signature:</span>
                    <span className="text-emerald-400">{selectedLog.signature}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-mono font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
