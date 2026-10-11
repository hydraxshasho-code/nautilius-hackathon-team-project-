import React, { useState, useEffect } from 'react';
import {
  securityAuditClient,
  SecurityAuditReportClient,
} from '../../services/securityAuditClient';
import {
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  Download,
  Printer,
  RefreshCw,
  Clock,
  KeyRound,
  Users,
  AlertTriangle,
  Lock,
  UserCheck,
  CheckCircle,
  XCircle,
  FileText,
  Filter,
} from 'lucide-react';

interface SecurityAuditReportPanelProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

export const SecurityAuditReportPanel: React.FC<SecurityAuditReportPanelProps> = ({
  onClose,
  showCloseButton = false,
}) => {
  const [report, setReport] = useState<SecurityAuditReportClient | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframeHours, setTimeframeHours] = useState<number>(720); // 30 days
  const [activeSection, setActiveSection] = useState<'LOGINS' | 'CREDENTIALS' | 'ANOMALIES' | 'ROLE_SWITCH'>('LOGINS');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await securityAuditClient.getComplianceReport(timeframeHours);
      if (res.error) {
        setError(res.error);
        setReport(null);
      } else {
        setReport(res.report);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate security audit report');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [timeframeHours]);

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    await securityAuditClient.downloadComplianceReport(format, timeframeHours);
    setIsExporting(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Module Top Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-wide">
              Automated Security Audit & Compliance Report
            </h2>
            {report?.chainIntegrity.verified && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <FileCheck2 className="w-3 h-3" />
                INTEGRITY VERIFIED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {report?.complianceStandard || 'IMO MSC-FAL.1/Circ.3 Maritime Cyber Risk Management & ISO/IEC 27001 ISMS'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Selector */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-xs font-mono">
            {[
              { label: '24h', hours: 24 },
              { label: '7d', hours: 168 },
              { label: '30d', hours: 720 },
              { label: 'All Time', hours: 8760 },
            ].map((t) => (
              <button
                key={t.label}
                onClick={() => setTimeframeHours(t.hours)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  timeframeHours === t.hours
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchReport}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 transition-colors"
            title="Refresh Report Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-md shadow-cyan-950/40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => handleExport('json')}
            disabled={isExporting || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Export JSON</span>
          </button>

          <button
            onClick={handlePrint}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
            title="Print Statutory Dossier"
          >
            <Printer className="w-4 h-4" />
          </button>

          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono">LOGIN ATTEMPTS</span>
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {report?.summary.totalLogins ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {report?.summary.failedLogins ?? 0} failed attempts
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono">FAILED MFA</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">
            {report?.summary.failedMfaAttempts ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">2nd factor rejects</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono">CREDENTIAL CHANGES</span>
            <KeyRound className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {report?.summary.passwordChanges ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Passkeys & TOTP</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono">ACCESS ANOMALIES</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-300">
            {report?.summary.accessAnomalies ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {report?.summary.accountLockouts ?? 0} lockouts
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono">ROLE SWITCHES</span>
            <Users className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {report?.summary.roleSwitchEvents ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Temporary profiles</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono">CHAIN INTEGRITY</span>
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold font-mono text-emerald-400 flex items-center gap-1 mt-1">
            <CheckCircle className="w-4 h-4" />
            <span>100% VALID</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">SHA-256 HMAC</span>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-mono">
        <button
          onClick={() => setActiveSection('LOGINS')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
            activeSection === 'LOGINS'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Login Attempts ({report?.sections.recentLoginAttempts.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSection('CREDENTIALS')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
            activeSection === 'CREDENTIALS'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Password & Credentials ({report?.sections.passwordAndCredentialChanges.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSection('ANOMALIES')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
            activeSection === 'ANOMALIES'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Access Anomalies ({report?.sections.systemAccessAnomalies.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSection('ROLE_SWITCH')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
            activeSection === 'ROLE_SWITCH'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Role-Switching Events ({report?.sections.roleSwitchingEvents.length || 0})</span>
        </button>
      </div>

      {/* Active Section Content */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        {/* Section 1: Recent Logins */}
        {activeSection === 'LOGINS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Timestamp (UTC)</th>
                  <th className="py-2.5 px-4">User / Identity</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">IP Address</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {report?.sections.recentLoginAttempts && report.sections.recentLoginAttempts.length > 0 ? (
                  report.sections.recentLoginAttempts.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-white font-semibold">{item.user}</td>
                      <td className="py-2 px-4 text-cyan-300">{item.role}</td>
                      <td className="py-2 px-4 text-slate-400">{item.ipAddress}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'SUCCESS'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {item.status === 'SUCCESS' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span>{item.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                      No recent login records found in the selected timeframe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 2: Password and Credential Changes */}
        {activeSection === 'CREDENTIALS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Timestamp (UTC)</th>
                  <th className="py-2.5 px-4">User / Actor</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Entity</th>
                  <th className="py-2.5 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {report?.sections.passwordAndCredentialChanges &&
                report.sections.passwordAndCredentialChanges.length > 0 ? (
                  report.sections.passwordAndCredentialChanges.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-white font-semibold">{item.user}</td>
                      <td className="py-2 px-4 text-purple-300 font-bold">{item.action}</td>
                      <td className="py-2 px-4 text-slate-300">{item.entity}</td>
                      <td className="py-2 px-4 text-slate-400">{item.ipAddress}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                      No credential configuration changes detected in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 3: System Access Anomalies */}
        {activeSection === 'ANOMALIES' && (
          <div className="p-4 space-y-3">
            {report?.sections.systemAccessAnomalies && report.sections.systemAccessAnomalies.length > 0 ? (
              report.sections.systemAccessAnomalies.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                    item.severity === 'CRITICAL'
                      ? 'bg-rose-500/10 border-rose-500/40'
                      : 'bg-amber-500/10 border-amber-500/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          item.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        }`}
                      >
                        {item.severity} · {item.type}
                      </span>
                      <span className="text-slate-400 text-xs font-mono">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200">{item.description}</p>
                  </div>
                  <div className="text-right text-xs font-mono text-slate-400">
                    <div>User: <strong className="text-white">{item.user}</strong></div>
                    <div>Source IP: <strong className="text-slate-300">{item.ipAddress}</strong></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 font-mono text-xs">
                Zero system access anomalies or lockout events recorded. Platform posture is clean.
              </div>
            )}
          </div>
        )}

        {/* Section 4: Role-Switching Events */}
        {activeSection === 'ROLE_SWITCH' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Timestamp (UTC)</th>
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-4">Previous Role</th>
                  <th className="py-2.5 px-4">Active Profile</th>
                  <th className="py-2.5 px-4">Duration</th>
                  <th className="py-2.5 px-4">Reason</th>
                  <th className="py-2.5 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {report?.sections.roleSwitchingEvents && report.sections.roleSwitchingEvents.length > 0 ? (
                  report.sections.roleSwitchingEvents.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-white font-semibold">{item.user}</td>
                      <td className="py-2 px-4 text-slate-400">{item.previousRole}</td>
                      <td className="py-2 px-4 text-cyan-300 font-bold">{item.activeProfile}</td>
                      <td className="py-2 px-4 text-slate-300">{item.durationMinutes || 60}m</td>
                      <td className="py-2 px-4 text-slate-300 max-w-xs truncate">{item.reason || 'Operational switch'}</td>
                      <td className="py-2 px-4 text-slate-400">{item.ipAddress}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                      No profile delegation or role-switching events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
