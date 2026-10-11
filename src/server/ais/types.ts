/**
 * Normalized Maritime AIS Telemetry Types
 * Strictly enforces clean schemas, valid coordinate bounds, and no fabricated values.
 */

export interface RawAISPosition {
  latitude: number;
  longitude: number;
}

export interface RawAISNavigation {
  speed: number | null; // SOG in knots (null if unavailable)
  course: number | null; // COG in degrees (null if unavailable)
  heading: number | null; // True heading (null if unavailable)
  draught: number | null; // Present static draught in meters (null if unavailable)
  navigationStatus: string | number | null; // AIS Navigational status
}

export interface RawAISVoyage {
  destination: string | null;
  eta: string | null; // ISO 8601 or formatted UTC
}

export type AISDataQuality = 'VERIFIED_REALTIME' | 'STALE' | 'OFFLINE';

export interface NormalizedAISVessel {
  imo: string | null; // International Maritime Organization 7-digit identifier
  mmsi: string; // Maritime Mobile Service Identity 9-digit identifier
  name: string; // Statutory vessel name
  position: RawAISPosition;
  navigation: RawAISNavigation;
  voyage: RawAISVoyage;
  source: string; // e.g. "AISSTREAM_REALTIME", "NORWEGIAN_COASTAL_AIS", "MARITIME_DIRECTORY"
  timestamp: string; // ISO 8601 timestamp of AIS message
  status: 'LIVE' | 'STALE' | 'OFFLINE';
  lastUpdatedSecondsAgo: number;
  // Maritime specifications
  callSign?: string | null;
  type?: string | null;
  flag?: string | null;
  flagCode?: string | null;
  flagSource?: 'AIS' | 'VESSEL_METADATA' | 'MMSI_MID_INFERENCE' | 'UNKNOWN' | null;
  length?: number | null;
  beam?: number | null;
  draught?: number | null;
  deadweightTonnage?: number | null;
  grossTonnage?: number | null;
  yearBuilt?: number | null;
  classificationSociety?: string | null;
  owner?: string | null;
  operator?: string | null;
  beneficialOwner?: string | null;
  manager?: string | null;
}

export interface ProviderStatus {
  name: string;
  connected: boolean;
  activeTrackedCount: number;
  lastMessageTimestamp: string | null;
  error?: string | null;
  authenticated: boolean;
}

export interface AISProvider {
  name: string;
  initialize(): Promise<void>;
  getVesselByIMO(imo: string): Promise<NormalizedAISVessel | null>;
  getVesselByMMSI(mmsi: string): Promise<NormalizedAISVessel | null>;
  getFleet(identifiers: string[]): Promise<NormalizedAISVessel[]>;
  normalizeVessel(raw: any): NormalizedAISVessel | null;
  subscribeVessel(identifier: string, onUpdate: (vessel: NormalizedAISVessel) => void): () => void;
  onAnyVessel?(onUpdate: (vessel: NormalizedAISVessel) => void): () => void;
  getProviderStatus(): ProviderStatus;
  dispose?(): Promise<void>;
}

export type WebSocketAISMessageType =
  | 'vessel_update'
  | 'vessel_batch'
  | 'vessel_removed'
  | 'provider_status'
  | 'search_result'
  | 'error'
  | 'pong';

export interface WebSocketAISMessage {
  type: WebSocketAISMessageType;
  payload?: any;
  timestamp: string;
}
