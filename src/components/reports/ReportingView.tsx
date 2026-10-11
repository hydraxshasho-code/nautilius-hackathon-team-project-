import React, { useState } from 'react';
import { Vessel } from '../../types/maritime';
import {
  FileText,
  Download,
  Printer,
  Share2,
  Calendar,
  CheckCircle,
  ShieldCheck,
  Ship,
  Clock,
  Compass,
} from 'lucide-react';

interface ReportingViewProps {
  vessels: Vessel[];
}

export const ReportingView: React.FC<ReportingViewProps> = ({ vessels }) => {
  const [selectedVesselId, setSelectedVesselId] = useState<string>(vessels[0]?.id || 'vessel-01');
  const [reportType, setReportType] = useState<'VESSEL_DOSSIER' | 'KYC_AUDIT' | 'AML_CERT' | 'RISK_AUDIT'>('VESSEL_DOSSIER');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedDate, setGeneratedDate] = useState<string>(new Date().toUTCString());

  const currentVessel = vessels.find((v) => v.id === selectedVesselId) || vessels[0];

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setGeneratedDate(new Date().toUTCString());
    }, 600);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      `"NAUTILUS MARITIME INTELLIGENCE DOSSIER"\n` +
      `"Vessel Name","${currentVessel.name}"\n` +
      `"IMO","${currentVessel.imo}"\n` +
      `"MMSI","${currentVessel.mmsi}"\n` +
      `"Flag","${currentVessel.flag}"\n` +
      `"Type","${currentVessel.type}"\n` +
      `"Risk Score","${currentVessel.riskScore}/100"\n` +
      `"Risk Level","${currentVessel.riskLevel}"\n` +
      `"Owner","${currentVessel.owner}"\n` +
      `"Beneficial Owner","${currentVessel.beneficialOwner}"\n` +
      `"KYC Status","${currentVessel.kycStatus}"\n` +
      `"AML Status","${currentVessel.amlStatus}"\n` +
      `"Generated At","${new Date().toISOString()}"\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentVessel.name}_Nautilus_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white tracking-wide">
              Enterprise Compliance & Statutory Maritime Reporting
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Automated Generation of IMO / Sanctions Due Diligence Dossiers · Export PDF & CSV
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-cyan-900/30 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF Dossier</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Config Panel (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-slate-800">
            Report Parameters
          </h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Target Vessel</label>
            <select
              value={selectedVesselId}
              onChange={(e) => setSelectedVesselId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            >
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Report Template</label>
            <div className="space-y-1.5">
              {[
                { id: 'VESSEL_DOSSIER', label: 'Comprehensive Vessel Intelligence Dossier' },
                { id: 'KYC_AUDIT', label: 'KYC & Beneficial Ownership (UBO) Audit' },
                { id: 'AML_CERT', label: 'Sanctions Screening & Clearance Certificate' },
                { id: 'RISK_AUDIT', label: 'Multi-Factor Threat & Route Risk Assessment' },
              ].map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setReportType(tmpl.id as any)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                    reportType === tmpl.id
                      ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-300 font-semibold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold rounded-lg text-xs transition-colors border border-slate-700 shadow-sm"
          >
            {isGenerating ? 'Compiling Dossier...' : 'Re-compile Live Telemetry'}
          </button>
        </div>

        {/* Right Live Report Document Preview (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 p-6 shadow-2xl">
          {/* Printable Document Paper Card */}
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800/90 space-y-5">
            {/* Document Header Lockup */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="font-extrabold text-sm tracking-widest text-white uppercase">NAUTILUS MARITIME</span>
                </div>
                <h2 className="text-base font-bold text-white tracking-wide">
                  OFFICIAL VESSEL COMPLIANCE & INTELLIGENCE DOSSIER
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  Document Reference: NTL-DOSS-{currentVessel.imo}-2026
                </span>
              </div>

              <div className="text-right text-[11px] font-mono text-slate-400">
                <span className="block text-slate-300">Generated: {generatedDate}</span>
                <span className="text-emerald-400 font-semibold">DIGITALLY ATTESTED</span>
              </div>
            </div>

            {/* Target Identity Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 font-mono text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">VESSEL NAME</span>
                <strong className="text-white text-sm">{currentVessel.name}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">IMO / MMSI</span>
                <span className="text-cyan-400">
                  {currentVessel.imo} / {currentVessel.mmsi}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">FLAG / CALL SIGN</span>
                <span className="text-slate-200">
                  {currentVessel.flag} ({currentVessel.callSign})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">VESSEL TYPE</span>
                <span className="text-slate-200 font-sans">{currentVessel.type}</span>
              </div>
            </div>

            {/* Risk Index & Compliance Findings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block">COMPOSITE RISK RATING</span>
                <span className="text-xl font-bold text-white block mt-0.5">
                  {currentVessel.riskScore} / 100
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    currentVessel.riskLevel === 'CRITICAL' ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  CLASSIFICATION: {currentVessel.riskLevel}
                </span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block">KYC STATUS</span>
                <span className="text-xl font-bold text-emerald-400 block mt-0.5">
                  {currentVessel.kycStatus.toUpperCase()}
                </span>
                <span className="text-[10px] text-slate-500 font-sans">Tier 1 Verified Documentation</span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block">AML / SANCTIONS</span>
                <span
                  className={`text-xl font-bold block mt-0.5 ${
                    currentVessel.amlStatus === 'Clear' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {currentVessel.amlStatus.toUpperCase()}
                </span>
                <span className="text-[10px] text-slate-500 font-sans">OFAC / EU / UN Screening</span>
              </div>
            </div>

            {/* Ownership & Operation */}
            <div className="p-4 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2 text-xs">
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-1">
                Verified Beneficial Ownership Hierarchy
              </h4>
              <div className="grid grid-cols-2 gap-3 text-slate-300 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block">Ultimate Beneficial Owner (UBO):</span>
                  <strong className="text-white">{currentVessel.beneficialOwner}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Registered Commercial Owner:</span>
                  <strong className="text-white">{currentVessel.owner}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Commercial Fleet Operator:</span>
                  <strong className="text-white">{currentVessel.operator}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Technical Ship Manager:</span>
                  <strong className="text-white">{currentVessel.manager}</strong>
                </div>
              </div>
            </div>

            {/* Statutory Attestation Footer */}
            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between font-mono">
              <span>AUTHORIZED BY: Senior Maritime Intelligence Officer</span>
              <span>VERIFICATION HASH: 8f9b2a...3e41</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
