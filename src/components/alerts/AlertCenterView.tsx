import React, { useState, useEffect } from 'react';
import { IncidentAlert, RiskLevel, UserRole } from '../../types/maritime';
import { rbacService } from '../../services/rbacService';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle,
  Clock,
  UserPlus,
  ArrowUpRight,
  Filter,
  Search,
  Check,
  X,
  Pentagon,
  MapPin,
} from 'lucide-react';

interface AlertCenterViewProps {
  alerts: IncidentAlert[];
  onSelectVesselByName?: (name: string) => void;
  onNavigateToTab?: (tabId: string) => void;
  currentRole?: UserRole;
}

export const AlertCenterView: React.FC<AlertCenterViewProps> = ({
  alerts: initialAlerts,
  onSelectVesselByName,
  onNavigateToTab,
  currentRole = 'Compliance Officer',
}) => {
  // Alerts strictly filtered and routed according to active user role
  const roleRoutedAlerts = rbacService.filterAlertsForRole(currentRole, initialAlerts);
  const [alerts, setAlerts] = useState<IncidentAlert[]>(roleRoutedAlerts);

  useEffect(() => {
    setAlerts(rbacService.filterAlertsForRole(currentRole, initialAlerts));
  }, [currentRole, initialAlerts]);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpdateStatus = (alertId: string, newStatus: IncidentAlert['status']) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
    );
    showToast(`Alert status updated to "${newStatus}"`);
  };

  const filteredAlerts = alerts.filter((a) => {
    const matchSeverity = selectedSeverity === 'ALL' || a.severity === selectedSeverity;
    const matchCategory =
      selectedCategory === 'ALL' ||
      (selectedCategory === 'GEOFENCE'
        ? a.category.toLowerCase().includes('geofence')
        : a.category === selectedCategory);
    const matchSearch =
      a.vesselName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSeverity && matchCategory && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 border border-cyan-500 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h1 className="text-base font-bold text-white tracking-wide">
              Security Operations Center (SOC) Alert & Incident Management
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-Time Threat Triaging · Escalation Workflows · Automated Rule-Based Triggers
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <input
            type="text"
            placeholder="Search Alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Categories</option>
            <option value="GEOFENCE">⬡ Geofence (Breach / Loiter / Exit)</option>
            <option value="Sanctions Screening">Sanctions Screening</option>
            <option value="AIS Anomaly">AIS Anomaly</option>
            <option value="War Risk Zone">War Risk Zone</option>
            <option value="Route Deviation">Route Deviation</option>
            <option value="AML Alert">AML Alert</option>
          </select>
        </div>
      </div>

      {/* Alerts Table Grid */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800 font-mono uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3">Target Vessel</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Incident Summary</th>
                <th className="py-3 px-3">Assigned To</th>
                <th className="py-3 px-3">Logged</th>
                <th className="py-3 px-3">Workflow State</th>
                <th className="py-3 px-3 text-center">Action Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                    No active incident alerts matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : alert.severity === 'HIGH'
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                            : alert.severity === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-white tracking-wide">
                      <button
                        onClick={() => onSelectVesselByName && onSelectVesselByName(alert.vesselName)}
                        className="hover:text-cyan-400 transition-colors text-left"
                      >
                        {alert.vesselName}
                      </button>
                    </td>
                    <td className="py-3 px-3 font-sans">
                      {alert.category.toLowerCase().includes('geofence') ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">
                          <Pentagon className="w-3 h-3 fill-current" />
                          <span>{alert.category}</span>
                        </span>
                      ) : (
                        <span className="text-cyan-300">{alert.category}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-sans max-w-xs">
                      <span className="font-bold text-slate-200 block mb-0.5">{alert.title}</span>
                      <p className="text-slate-400 text-[11px] line-clamp-1">{alert.description}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-sans">{alert.assignedTo || 'Unassigned'}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          alert.status === 'NEW'
                            ? 'bg-rose-500/10 text-rose-400'
                            : alert.status === 'INVESTIGATING'
                            ? 'bg-amber-500/10 text-amber-400'
                            : alert.status === 'ESCALATED'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        {alert.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            if (onSelectVesselByName) onSelectVesselByName(alert.vesselName);
                            if (onNavigateToTab) onNavigateToTab('tracking');
                          }}
                          className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded text-[10px] transition-colors flex items-center gap-1 font-semibold"
                          title="View on Real-Time Map"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Map</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(alert.id, 'ACKNOWLEDGED')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-colors"
                          title="Acknowledge Alert"
                        >
                          Ack
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(alert.id, 'INVESTIGATING')}
                          className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[10px] transition-colors"
                          title="Assign to Investigation"
                        >
                          Investigate
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(alert.id, 'ESCALATED')}
                          className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded text-[10px] transition-colors"
                          title="Escalate to Legal/Flag Authority"
                        >
                          Escalate
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(alert.id, 'RESOLVED')}
                          className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded text-[10px] transition-colors"
                          title="Mark Resolved"
                        >
                          Resolve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
