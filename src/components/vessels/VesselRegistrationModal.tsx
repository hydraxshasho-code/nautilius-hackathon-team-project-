import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Vessel, VesselType, RiskLevel } from '../../types/maritime';
import {
  Ship,
  CheckCircle,
  AlertCircle,
  FileText,
  ShieldCheck,
  Building,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  X,
} from 'lucide-react';

interface VesselRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterVessel: (newVessel: Partial<Vessel>) => void;
}

export const VesselRegistrationModal: React.FC<VesselRegistrationModalProps> = ({
  isOpen,
  onClose,
  onRegisterVessel,
}) => {
  const [step, setStep] = useState<number>(1);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    imo: '',
    mmsi: '',
    callSign: '',
    type: 'Container Ship' as VesselType,
    flag: 'Singapore',
    portOfRegistry: 'Singapore',
    yearBuilt: 2022,
    grossTonnage: 120000,
    deadweightTonnage: 140000,
    length: 366,
    beam: 51,
    draught: 14.5,
    classificationSociety: 'DNV GL',
    owner: '',
    operator: '',
    manager: '',
    beneficialOwner: '',
    pniClub: "Gard P&I Club",
    insurancePolicyNumber: 'POL-GARD-2026-9912',
    kycStatus: 'Verified' as const,
    amlStatus: 'Clear' as const,
    initialRiskScore: 18,
  });

  if (!isOpen) return null;

  const totalSteps = 9;

  const handleNext = () => {
    if (step < totalSteps) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegisterVessel({
      id: 'vessel-' + Date.now(),
      name: formData.name.toUpperCase() || 'NEW MARITIME VESSEL',
      imo: formData.imo || '9988112',
      mmsi: formData.mmsi || '563991234',
      callSign: formData.callSign || '9V9981',
      type: formData.type,
      flag: formData.flag,
      flagCode: 'SG',
      lat: 1.29,
      lon: 103.85,
      prevLat: 1.28,
      prevLon: 103.84,
      speed: 14.2,
      course: 280,
      heading: 280,
      navStatus: 'Under way using engine',
      destination: 'ROTTERDAM',
      destinationPortCode: 'NLRTM',
      origin: 'SINGAPORE',
      originPortCode: 'SGSIN',
      eta: '2026-10-18T12:00:00Z',
      timestamp: new Date().toISOString(),
      aisSource: 'HYBRID_AIS',
      dataQuality: 'OPTIMAL',
      lastUpdatedSecondsAgo: 0,
      riskLevel: 'LOW',
      riskScore: formData.initialRiskScore,
      isTransmitting: true,
      isStale: false,
      length: formData.length,
      beam: formData.beam,
      draught: formData.draught,
      grossTonnage: formData.grossTonnage,
      deadweightTonnage: formData.deadweightTonnage,
      yearBuilt: formData.yearBuilt,
      classificationSociety: formData.classificationSociety,
      owner: formData.owner || 'Standard Maritime Carriers Ltd',
      operator: formData.operator || 'Global Fleet Operations',
      manager: formData.manager || 'Wilhelmsen Ship Management',
      beneficialOwner: formData.beneficialOwner || 'Trustee Investments S.A.',
      kycStatus: formData.kycStatus,
      amlStatus: formData.amlStatus,
      totalDistanceNm: 4500,
      distanceTraveledNm: 120,
      anomaliesDetected: 0,
      historicalTrack: [{ lat: 1.29, lon: 103.85, timestamp: new Date().toISOString(), speed: 14.2, course: 280, heading: 280 }],
      portCalls: [],
      ownershipStructure: [
        { name: formData.beneficialOwner || 'Apex Maritime Trust', role: 'Beneficial Owner', country: 'Singapore', registrationNumber: 'SG-2022-881', sanctionStatus: 'CLEARED', sharePercentage: 100 },
        { name: formData.owner || 'Standard Maritime Carriers Ltd', role: 'Registered Owner', country: formData.flag, registrationNumber: 'REG-99120', sanctionStatus: 'CLEARED', sharePercentage: 100 },
      ],
      riskBreakdown: {
        vesselRisk: 14,
        ownershipRisk: 12,
        amlRisk: 10,
        sanctionsRisk: 8,
        routeRisk: 18,
        aisRisk: 10,
        portRisk: 12,
        documentationRisk: 10,
        behavioralRisk: 8,
      },
      riskEvidence: ['Statutory classification documentation validated upon enrollment'],
    });
    onClose();
  };

  const stepTitles = [
    'Basic Information',
    'Identification',
    'Ownership Structure',
    'Fleet Operator',
    'Technical Specs',
    'Certifications & P&I',
    'KYC & AML Due Diligence',
    'AI Risk Assessment',
    'Final Review & Sign-Off',
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      style={{ margin: 0 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col my-auto overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <Ship className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white tracking-wide">Enterprise Vessel Registration Wizard</h2>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Step {step} of {totalSteps}: {stepTitles[step - 1]}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator Bar */}
        <div className="w-full bg-slate-950 h-1.5 flex">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className={`flex-1 transition-all ${
                idx + 1 <= step ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {step === 1 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">1. Basic Vessel Information</h3>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Vessel Commercial Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PACIFIC GUARDIAN"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 uppercase font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Vessel Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as VesselType })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Container Ship">Container Ship</option>
                    <option value="Crude Oil Tanker">Crude Oil Tanker</option>
                    <option value="LNG Carrier">LNG Carrier</option>
                    <option value="LPG Tanker">LPG Tanker</option>
                    <option value="Bulk Carrier">Bulk Carrier</option>
                    <option value="Chemical Tanker">Chemical Tanker</option>
                    <option value="Vehicle Carrier">Vehicle Carrier</option>
                    <option value="Offshore Tug / Supply">Offshore Tug / Supply</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Year Built *</label>
                  <input
                    type="number"
                    min="1990"
                    max="2026"
                    value={formData.yearBuilt}
                    onChange={(e) => setFormData({ ...formData, yearBuilt: parseInt(e.target.value) || 2022 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">2. Statutory Identification & Flag</h3>
              <div className="grid grid-cols-3 gap-3 font-mono">
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-sans">IMO Number (7 Digits) *</label>
                  <input
                    type="text"
                    required
                    placeholder="9812401"
                    maxLength={7}
                    value={formData.imo}
                    onChange={(e) => setFormData({ ...formData, imo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-sans">MMSI (9 Digits) *</label>
                  <input
                    type="text"
                    required
                    placeholder="352981000"
                    maxLength={9}
                    value={formData.mmsi}
                    onChange={(e) => setFormData({ ...formData, mmsi: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-sans">Call Sign *</label>
                  <input
                    type="text"
                    required
                    placeholder="3E2198"
                    value={formData.callSign}
                    onChange={(e) => setFormData({ ...formData, callSign: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Flag State *</label>
                  <input
                    type="text"
                    value={formData.flag}
                    onChange={(e) => setFormData({ ...formData, flag: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Port of Registry *</label>
                  <input
                    type="text"
                    value={formData.portOfRegistry}
                    onChange={(e) => setFormData({ ...formData, portOfRegistry: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">3. Corporate Ownership Hierarchy</h3>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Ultimate Beneficial Owner (UBO) *</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Global Maritime Trust S.A."
                  value={formData.beneficialOwner}
                  onChange={(e) => setFormData({ ...formData, beneficialOwner: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Registered Vessel Owner Entity *</label>
                <input
                  type="text"
                  placeholder="e.g. Pacific Carrier Shipping Ltd"
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">4. Commercial & Technical Management</h3>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Commercial Operator *</label>
                <input
                  type="text"
                  placeholder="e.g. Maersk / Evergreen Line / Stolt Tankers"
                  value={formData.operator}
                  onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Technical Ship Manager (ISM Holder) *</label>
                <input
                  type="text"
                  placeholder="e.g. Wilhelmsen Ship Management / V.Ships"
                  value={formData.manager}
                  onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">5. Technical Dimensions & Tonnage</h3>
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-sans">Gross Tonnage (GT)</label>
                  <input
                    type="number"
                    value={formData.grossTonnage}
                    onChange={(e) => setFormData({ ...formData, grossTonnage: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-sans">Deadweight Tonnage (DWT)</label>
                  <input
                    type="number"
                    value={formData.deadweightTonnage}
                    onChange={(e) => setFormData({ ...formData, deadweightTonnage: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-sans">Length Overall (meters)</label>
                  <input
                    type="number"
                    value={formData.length}
                    onChange={(e) => setFormData({ ...formData, length: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-sans">Maximum Draught (meters)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.draught}
                    onChange={(e) => setFormData({ ...formData, draught: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">6. Classification Society & P&I Insurance</h3>
              <div>
                <label className="text-xs text-slate-400 block mb-1">IACS Classification Society *</label>
                <select
                  value={formData.classificationSociety}
                  onChange={(e) => setFormData({ ...formData, classificationSociety: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="DNV GL">DNV GL</option>
                  <option value="Lloyd's Register">Lloyd's Register</option>
                  <option value="American Bureau of Shipping (ABS)">American Bureau of Shipping (ABS)</option>
                  <option value="Bureau Veritas (BV)">Bureau Veritas (BV)</option>
                  <option value="ClassNK (Nippon Kaiji Kyokai)">ClassNK</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Protection & Indemnity (P&I) Club *</label>
                <input
                  type="text"
                  value={formData.pniClub}
                  onChange={(e) => setFormData({ ...formData, pniClub: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">7. KYC & AML Compliance Screening</h3>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Sanctions Screening Engine:</span>
                  <span className="text-emerald-400 font-semibold font-mono">OFAC / EU / UN Clean</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">PEP Exposure Status:</span>
                  <span className="text-emerald-400 font-semibold font-mono">No PEP Match</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Adverse Media Check:</span>
                  <span className="text-emerald-400 font-semibold font-mono">Negative</span>
                </div>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">8. AI Risk Assessment Scoring</h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                <span className="text-xs text-slate-400 block mb-1">Preliminary Calculated Risk Score</span>
                <span className="text-4xl font-extrabold text-emerald-400 font-mono">18 / 100</span>
                <span className="text-xs text-emerald-300 block font-semibold mt-1">LOW COMPLIANCE RISK</span>
              </div>
            </div>
          )}

          {step === 9 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">9. Final Verification & Sign-off</h3>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Vessel Name:</span>
                  <span className="text-white font-bold">{formData.name || 'NEW VESSEL'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">IMO / MMSI:</span>
                  <span className="text-cyan-400">{formData.imo} / {formData.mmsi}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Type & Flag:</span>
                  <span className="text-slate-300">{formData.type} · {formData.flag}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Beneficial Owner:</span>
                  <span className="text-slate-300 truncate">{formData.beneficialOwner || 'Verified'}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                By submitting this dossier, the vessel will be enrolled into the OCEANIQ Real-Time AIS Tracking Engine and continuous AML sanctions monitoring stream.
              </p>
            </div>
          )}

          {/* Modal Footer Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                step === 1 ? 'opacity-40 cursor-not-allowed text-slate-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            {step < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-cyan-900/30 transition-all"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-900/30 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Submit & Ingest Target</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
