import React, { useState, useMemo } from 'react';
import { Vessel, VesselType, RiskLevel, UserRole } from '../../types/maritime';
import { VesselRegistrationModal } from './VesselRegistrationModal';
import { Forbidden403View } from '../common/Forbidden403View';
import {
  Ship,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Plus,
  Eye,
  ShieldAlert,
  CheckCircle,
  Clock,
  Radio,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Trash2,
  Navigation,
  Compass,
  Zap,
  Anchor,
} from 'lucide-react';

interface VesselRegistryViewProps {
  vessels: Vessel[];
  onSelectVessel: (vesselId: string) => void;
  onNavigateToTab: (tabId: string) => void;
  onRegisterVessel: (vessel: Partial<Vessel>) => void;
  onRemoveVessel: (vesselId: string) => void;
  currentRole?: UserRole;
}

export const VesselRegistryView: React.FC<VesselRegistryViewProps> = ({
  vessels,
  onSelectVessel,
  onNavigateToTab,
  onRegisterVessel,
  onRemoveVessel,
  currentRole = 'Compliance Officer',
}) => {
  // Vessel Registry is accessible ONLY to Super Admin and Compliance Officer
  const isAuthorized = currentRole === 'Super Admin' || currentRole === 'Compliance Officer';

  if (!isAuthorized) {
    return (
      <Forbidden403View
        currentRole={currentRole}
        moduleName="Global Vessel Registry"
        allowedRoles={['Super Admin', 'Compliance Officer']}
        onReturnToDashboard={() => onNavigateToTab('dashboard')}
      />
    );
  }
  const [statusTab, setStatusTab] = useState<'ALL' | 'AT_SEA' | 'IN_PORT' | 'HIGH_RISK'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [kycFilter, setKycFilter] = useState<string>('ALL');
  const [amlFilter, setAmlFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof Vessel>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [vesselToDelete, setVesselToDelete] = useState<Vessel | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickType, setQuickType] = useState<VesselType>('Container Ship');
  const [quickFlag, setQuickFlag] = useState('Singapore');

  // Dynamic Fleet Status Counts
  const vesselsAtSeaCount = useMemo(() => vessels.filter((v) => v.speed > 0.5).length, [vessels]);
  const vesselsInPortCount = useMemo(() => vessels.filter((v) => v.speed <= 0.5).length, [vessels]);
  const highRiskCount = useMemo(() => vessels.filter((v) => v.riskLevel === 'HIGH' || v.riskLevel === 'CRITICAL').length, [vessels]);

  // Filter & Search Logic
  const filteredVessels = useMemo(() => {
    return vessels.filter((v) => {
      const matchSearch =
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.imo.includes(searchQuery) ||
        v.mmsi.includes(searchQuery) ||
        v.callSign.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.flag.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusTab === 'ALL'
          ? true
          : statusTab === 'AT_SEA'
          ? v.speed > 0.5
          : statusTab === 'IN_PORT'
          ? v.speed <= 0.5
          : v.riskLevel === 'HIGH' || v.riskLevel === 'CRITICAL';

      const matchType = typeFilter === 'ALL' || v.type === typeFilter;
      const matchRisk = riskFilter === 'ALL' || v.riskLevel === riskFilter;
      const matchKyc = kycFilter === 'ALL' || v.kycStatus === kycFilter;
      const matchAml = amlFilter === 'ALL' || v.amlStatus === amlFilter;

      return matchSearch && matchStatus && matchType && matchRisk && matchKyc && matchAml;
    });
  }, [vessels, searchQuery, statusTab, typeFilter, riskFilter, kycFilter, amlFilter]);

  // Sort Logic
  const sortedVessels = useMemo(() => {
    return [...filteredVessels].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        return sortAsc
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      }
      if (typeof aVal === 'number') {
        return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      }
      return 0;
    });
  }, [filteredVessels, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedVessels.length / pageSize));
  const paginatedVessels = sortedVessels.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (field: keyof Vessel) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedVessels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedVessels.map((v) => v.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    for (const id of selectedIds) {
      onRemoveVessel(id);
    }
    setSelectedIds(new Set());
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;

    onRegisterVessel({
      name: quickName.toUpperCase(),
      type: quickType,
      flag: quickFlag,
      speed: 15.0,
      course: Math.floor(Math.random() * 360),
      heading: Math.floor(Math.random() * 360),
      lat: 1.28 + (Math.random() - 0.5) * 5,
      lon: 103.85 + (Math.random() - 0.5) * 10,
      riskLevel: 'LOW',
      riskScore: 15,
      owner: 'Nautilus Fleet Global S.A.',
      operator: 'Nautilus Carrier Lines',
      beneficialOwner: 'Nautilus Ocean Trust',
      destination: 'ROTTERDAM',
      origin: 'SINGAPORE',
    });

    setShowQuickAdd(false);
    setQuickName('');
  };

  const exportCSV = () => {
    const headers = [
      'Name',
      'IMO',
      'MMSI',
      'Call Sign',
      'Flag',
      'Type',
      'Status',
      'Owner',
      'Operator',
      'Built',
      'GT',
      'DWT',
      'Class',
      'Risk Score',
      'Risk Level',
      'KYC',
      'AML',
      'Speed',
      'Lat',
      'Lon',
    ];

    const exportRows = sortedVessels.map((v) => [
      `"${v.name}"`,
      v.imo,
      v.mmsi,
      v.callSign,
      v.flag,
      `"${v.type}"`,
      `"${v.navStatus}"`,
      `"${v.owner}"`,
      `"${v.operator}"`,
      v.yearBuilt,
      v.grossTonnage,
      v.deadweightTonnage,
      `"${v.classificationSociety}"`,
      v.riskScore,
      v.riskLevel,
      v.kycStatus,
      v.amlStatus,
      v.speed,
      v.lat,
      v.lon,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...exportRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NAUTILUS_Vessel_Registry_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/85 backdrop-blur-md p-4 rounded-xl border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white tracking-wide">NAUTILUS Global Vessel Registry</h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {vessels.length} Transmitting Vessels Ingested · Real-Time Satellite & Terrestrial AIS Synchronization
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold border border-rose-500/40 transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Selected ({selectedIds.size})</span>
            </button>
          )}

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-cyan-300 rounded-lg text-xs font-semibold border border-cyan-500/40 transition-colors shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>+ Quick Add</span>
          </button>

          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-cyan-900/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll New Vessel</span>
          </button>
        </div>
      </div>

      {/* Operational Fleet Status Navigation Tabs (At Port vs At Sea) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => {
              setStatusTab('ALL');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusTab === 'ALL'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Ship className="w-3.5 h-3.5 text-cyan-400" />
            <span>All Fleet</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {vessels.length}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusTab('AT_SEA');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusTab === 'AT_SEA'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>Vessels at Sea</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-950 text-blue-300 border border-blue-800/50 font-mono">
              {vesselsAtSeaCount}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusTab('IN_PORT');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusTab === 'IN_PORT'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Anchor className="w-3.5 h-3.5 text-emerald-400" />
            <span>Vessels in Port</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/50 font-mono">
              {vesselsInPortCount}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusTab('HIGH_RISK');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusTab === 'HIGH_RISK'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>High Risk Flagged</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50 font-mono">
              {highRiskCount}
            </span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-mono px-2 hidden sm:block">
          Matching: <strong className="text-white">{filteredVessels.length}</strong> vessels
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/85 backdrop-blur-md p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Vessel Name, IMO, MMSI, Call Sign, Owner..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Vessel Types</option>
            <option value="Container Ship">Container Ship</option>
            <option value="Crude Oil Tanker">Crude Oil Tanker</option>
            <option value="Product Tanker">Product Tanker</option>
            <option value="LNG Carrier">LNG Carrier</option>
            <option value="LPG Tanker">LPG Tanker</option>
            <option value="Bulk Carrier">Bulk Carrier</option>
            <option value="Chemical Tanker">Chemical Tanker</option>
            <option value="Vehicle Carrier">Vehicle Carrier</option>
            <option value="Offshore Tug / Supply">Offshore Tug / Supply</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => {
              setRiskFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">Critical Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="LOW">Low Risk</option>
          </select>

          <select
            value={kycFilter}
            onChange={(e) => {
              setKycFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">KYC: All</option>
            <option value="Verified">Verified</option>
            <option value="Under Review">Under Review</option>
            <option value="Pending">Pending</option>
          </select>

          <select
            value={amlFilter}
            onChange={(e) => {
              setAmlFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">AML: All</option>
            <option value="Clear">Clear</option>
            <option value="Potential Match">Potential Match</option>
            <option value="Confirmed Match">Confirmed Match</option>
          </select>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800 font-mono uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === paginatedVessels.length}
                    onChange={toggleSelectAll}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Vessel Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th onClick={() => toggleSort('imo')} className="py-3 px-3 cursor-pointer hover:text-white">
                  IMO
                </th>
                <th className="py-3 px-3">MMSI</th>
                <th className="py-3 px-3">Call Sign</th>
                <th className="py-3 px-3">Flag</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Owner / Operator</th>
                <th
                  onClick={() => toggleSort('deadweightTonnage')}
                  className="py-3 px-3 cursor-pointer hover:text-white text-right"
                >
                  DWT
                </th>
                <th className="py-3 px-3">Class</th>
                <th
                  onClick={() => toggleSort('riskScore')}
                  className="py-3 px-3 cursor-pointer hover:text-white text-center"
                >
                  Risk
                </th>
                <th className="py-3 px-3 text-center">KYC</th>
                <th className="py-3 px-3 text-center">AML</th>
                <th className="py-3 px-3 text-right">Speed</th>
                <th className="py-3 px-3 text-center">Live Map & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {paginatedVessels.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-500 font-sans">
                    No vessels found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedVessels.map((v) => {
                  const isChecked = selectedIds.has(v.id);
                  return (
                    <tr
                      key={v.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isChecked ? 'bg-cyan-950/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(v.id)}
                          className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white tracking-wide">
                        <button
                          onClick={() => {
                            onSelectVessel(v.id);
                            onNavigateToTab('tracking');
                          }}
                          className="text-left hover:text-cyan-400 transition-colors flex items-center gap-1.5 group"
                          title="Click to locate on Real-Time World Map"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              v.isTransmitting && !v.isStale
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-slate-600'
                            }`}
                          />
                          <span className="group-hover:underline">{v.name}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono">{v.imo}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{v.mmsi}</td>
                      <td className="py-2.5 px-3 text-slate-400 uppercase">{v.callSign}</td>
                      <td className="py-2.5 px-3 text-slate-300 font-sans">{v.flag}</td>
                      <td className="py-2.5 px-3 text-slate-300 font-sans truncate max-w-[130px]">{v.type}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-sans truncate max-w-[120px]">
                        {v.navStatus}
                      </td>
                      <td className="py-2.5 px-3 font-sans truncate max-w-[140px] text-slate-300" title={v.owner}>
                        {v.owner}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {v.deadweightTonnage.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-400 truncate max-w-[90px]">
                        {v.classificationSociety}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                            v.riskLevel === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : v.riskLevel === 'HIGH'
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                              : v.riskLevel === 'MEDIUM'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          }`}
                        >
                          {v.riskScore}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span
                          className={`text-[10px] font-semibold ${
                            v.kycStatus === 'Verified' ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {v.kycStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span
                          className={`text-[10px] font-semibold ${
                            v.amlStatus === 'Clear'
                              ? 'text-emerald-400'
                              : v.amlStatus === 'Confirmed Match'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {v.amlStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-cyan-400 font-semibold tabular-nums">
                        {v.speed} kn
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Real-time map trigger */}
                          <button
                            onClick={() => {
                              onSelectVessel(v.id);
                              onNavigateToTab('tracking');
                            }}
                            className="p-1.5 hover:bg-cyan-500/20 text-cyan-400 rounded transition-colors"
                            title="Open on Real-Time World Map"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </button>

                          {/* Dossier trigger */}
                          <button
                            onClick={() => {
                              onSelectVessel(v.id);
                              onNavigateToTab('vessel-profile');
                            }}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
                            title="Inspect Intelligence Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Remove Vessel trigger */}
                          <button
                            onClick={() => setVesselToDelete(v)}
                            className="p-1.5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded transition-colors"
                            title="Remove Vessel from Fleet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Status Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/80 border-t border-slate-800 text-xs">
          <div className="text-slate-400 font-mono">
            {sortedVessels.length === 0
              ? '0 of 0 vessels in Firestore'
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, sortedVessels.length)} of ${sortedVessels.length} vessels`}
            {selectedIds.size > 0 && <span className="text-cyan-400 ml-2">({selectedIds.size} selected)</span>}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-1.5 rounded-lg border border-slate-800 ${
                currentPage === 1 ? 'opacity-40 cursor-not-allowed text-slate-600' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono text-slate-300 text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-1.5 rounded-lg border border-slate-800 ${
                currentPage === totalPages
                  ? 'opacity-40 cursor-not-allowed text-slate-600'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Vessel Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">Quick Add Vessel Target</h3>
              </div>
              <button
                onClick={() => setShowQuickAdd(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Vessel Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NAUTILUS DISCOVERY"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Vessel Type *</label>
                <select
                  value={quickType}
                  onChange={(e) => setQuickType(e.target.value as VesselType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Container Ship">Container Ship</option>
                  <option value="Crude Oil Tanker">Crude Oil Tanker</option>
                  <option value="Product Tanker">Product Tanker</option>
                  <option value="LNG Carrier">LNG Carrier</option>
                  <option value="Bulk Carrier">Bulk Carrier</option>
                  <option value="Chemical Tanker">Chemical Tanker</option>
                  <option value="Offshore Tug / Supply">Offshore Tug / Supply</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Flag State</label>
                <input
                  type="text"
                  value={quickFlag}
                  onChange={(e) => setQuickFlag(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-md shadow-cyan-900/30 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Live Map</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Confirmation Dialog Modal */}
      {vesselToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800 mb-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Remove Vessel from Active Fleet</h3>
                <span className="text-xs text-slate-400 font-mono">De-register from Real-Time AIS Stream</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed font-sans">
              Are you sure you want to de-register <strong className="text-white">{vesselToDelete.name}</strong> (IMO:{' '}
              {vesselToDelete.imo})? This target will stop receiving real-time coordinates and will be removed from the
              active tactical map and compliance monitoring.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVesselToDelete(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemoveVessel(vesselToDelete.id);
                  setVesselToDelete(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs shadow-md shadow-rose-950/40 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Removal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration Wizard Modal */}
      <VesselRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onRegisterVessel={onRegisterVessel}
      />
    </div>
  );
};
