export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'INFORMATION';

export type NavStatus =
  | 'Under way using engine'
  | 'At anchor'
  | 'Moored'
  | 'Not under command'
  | 'Restricted manoeuvrability'
  | 'Constrained by her draught'
  | 'Aground'
  | 'Engaged in fishing';

export type VesselType =
  | 'Container Ship'
  | 'Crude Oil Tanker'
  | 'Product Tanker'
  | 'LNG Carrier'
  | 'LPG Tanker'
  | 'Bulk Carrier'
  | 'Chemical Tanker'
  | 'Vehicle Carrier'
  | 'General Cargo'
  | 'Offshore Tug / Supply'
  | 'Reefer'
  | 'Passenger / Cruise';

export type AISConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'STALE_DATA' | 'SIMULATING_DELAY';

export interface TrackPoint {
  lat: number;
  lon: number;
  timestamp: string;
  speed: number;
  course: number;
  heading: number;
}

export interface OwnershipNode {
  name: string;
  role: 'Beneficial Owner' | 'Holding Company' | 'Operating Company' | 'Registered Owner' | 'Technical Manager' | 'Commercial Manager';
  country: string;
  registrationNumber: string;
  sanctionStatus: 'CLEARED' | 'POTENTIAL_MATCH' | 'FLAGGED';
  sharePercentage?: number;
}

export interface PortCall {
  portName: string;
  country: string;
  arrival: string;
  departure: string;
  status: 'Completed' | 'Current' | 'Scheduled';
  draughtArrival?: number;
  draughtDeparture?: number;
}

export interface Vessel {
  id: string;
  name: string;
  imo: string;
  mmsi: string;
  callSign: string;
  type: VesselType;
  flag: string;
  flagCode: string; // ISO 2-letter
  flagSource?: 'AIS' | 'VESSEL_METADATA' | 'MMSI_MID_INFERENCE' | 'UNKNOWN';
  lat: number;
  lon: number;
  prevLat: number;
  prevLon: number;
  targetLat?: number;
  targetLon?: number;
  speed: number; // SOG in knots
  course: number; // COG in degrees
  heading: number; // true heading in degrees
  navStatus: NavStatus;
  destination: string;
  destinationPortCode: string;
  origin: string;
  originPortCode: string;
  eta: string;
  timestamp: string; // last AIS transmission
  aisSource: 'TERRESTRIAL' | 'SATELLITE_S_AIS' | 'HYBRID_AIS';
  dataQuality: 'OPTIMAL' | 'DEGRADED' | 'INTERPOLATED' | 'STALE';
  lastUpdatedSecondsAgo: number;
  riskLevel: RiskLevel;
  riskScore: number; // 0 - 100
  isTransmitting: boolean;
  isStale: boolean;
  length: number; // meters
  beam: number; // meters
  draught: number; // meters
  grossTonnage: number; // GT
  deadweightTonnage: number; // DWT
  yearBuilt: number;
  classificationSociety: string;
  owner: string;
  operator: string;
  manager: string;
  beneficialOwner: string;
  kycStatus: 'Verified' | 'Pending' | 'Under Review' | 'Expired' | 'Rejected';
  amlStatus: 'Clear' | 'Potential Match' | 'Confirmed Match' | 'False Positive' | 'Under Review';
  amlMatchConfidence?: number;
  historicalTrack: TrackPoint[];
  predictedTrack?: [number, number][];
  ownershipStructure: OwnershipNode[];
  portCalls: PortCall[];
  riskBreakdown: {
    vesselRisk: number;
    ownershipRisk: number;
    amlRisk: number;
    sanctionsRisk: number;
    routeRisk: number;
    aisRisk: number;
    portRisk: number;
    documentationRisk: number;
    behavioralRisk: number;
  };
  riskEvidence: string[];
  anomaliesDetected: number;
  totalDistanceNm: number;
  distanceTraveledNm: number;
}

export interface RawAISPacket {
  id: string;
  timestamp: string;
  mmsi: string;
  messageType: number;
  description: string;
  lat: number;
  lon: number;
  speed: number;
  course: number;
  heading: number;
  status: string;
}

export interface AISAnomaly {
  id: string;
  vesselId: string;
  vesselName: string;
  imo: string;
  mmsi: string;
  type: 'AIS Gap / Dark Period' | 'Route Deviation' | 'Unusual Speed Surge' | 'Sudden Course Change' | 'Geofence Breach' | 'Identity Inconsistency' | 'Suspicious STS Transfer';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  lat: number;
  lon: number;
  evidence: string;
  status: 'ACTIVE' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  reviewer?: string;
  resolutionNotes?: string;
}

export interface IncidentAlert {
  id: string;
  category:
    | 'AML Alert'
    | 'AIS Anomaly'
    | 'Route Deviation'
    | 'Geofence Breach'
    | 'Geofence Loitering'
    | 'Geofence Exit'
    | 'Geofence'
    | 'Document Expiry'
    | 'Risk Escalation'
    | 'Sanctions Screening'
    | 'War Risk Zone';
  severity: RiskLevel;
  vesselName: string;
  vesselId: string;
  timestamp: string;
  title: string;
  description: string;
  status: 'NEW' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'ESCALATED' | 'RESOLVED';
  assignedTo?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  module: string;
  entity: string;
  entityId: string;
  ipAddress: string;
  previousState: string;
  newState: string;
}

export type UserRole =
  | 'Super Admin'
  | 'Compliance Officer'
  | 'Risk Analyst'
  | 'Operations Manager'
  | 'Vessel Analyst'
  | 'Investigator'
  | 'Auditor'
  | 'Viewer';

export interface UserProfile {
  id: string;
  name: string;
  title: string;
  role: UserRole;
  avatarUrl: string;
  department: string;
  lastLogin: string;
}
