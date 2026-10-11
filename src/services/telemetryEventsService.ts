import { Vessel, IncidentAlert, AISAnomaly, AuditLogEntry } from '../types/maritime';

/**
 * Dynamically synthesizes and synchronizes real-time Alerts, AIS Anomalies,
 * and Cryptographic Audit Logs anchored to current real-time clock and active vessels.
 */
export function generateLiveAlerts(vessels: Vessel[] = []): IncidentAlert[] {
  const now = Date.now();

  const getV = (idx: number, fallbackName: string, fallbackImo: string, fallbackMmsi: string, lat: number, lon: number): Vessel => {
    if (vessels && vessels.length > idx && vessels[idx]) {
      return vessels[idx];
    }
    return {
      id: `imo-${fallbackImo}`,
      name: fallbackName,
      imo: fallbackImo,
      mmsi: fallbackMmsi,
      lat,
      lon,
      speed: 14.5,
      course: 280,
      heading: 280,
      type: 'Cargo Vessel',
      flag: 'Panama',
      riskScore: 65,
      riskLevel: 'HIGH',
      isTransmitting: true,
      isStale: false,
    } as unknown as Vessel;
  };

  const v1 = getV(0, 'CMA CGM SEINE', '9987196', '563254200', 1.2584, 103.7412);
  const v2 = getV(1, 'RED SEA VANGUARD', '9790145', '352009876', 14.80, 42.15);
  const v3 = getV(2, 'ATLANTIC MERIDIAN', '9784320', '636018234', 24.12, 58.41);
  const v4 = getV(3, 'BOSPORUS GLORY', '9498821', '271004567', 41.22, 29.11);
  const v5 = getV(4, 'ELEONORA MAERSK', '9321500', '563254700', 12.65, 43.32);
  const v6 = getV(5, 'NAUTILUS TITAN', '9414108', '638025160', 25.12, 56.45);
  const v7 = getV(6, 'EVER GIVEN', '9811000', '353136000', 29.84, 32.55);
  const v8 = getV(7, 'MSC GULSUN', '9839438', '352827000', 36.12, -5.34);

  return [
    {
      id: `alert-${now}-01`,
      category: 'AIS Anomaly',
      severity: 'CRITICAL',
      vesselName: v2.name,
      vesselId: v2.id,
      timestamp: new Date(now - 4 * 60 * 1000).toISOString(), // 4 mins ago
      title: 'Prolonged Transponder Deactivation (AIS Gap)',
      description: `Transponder signal ceased near Bab-el-Mandeb Strait for over 3 hours before reappearing at [${v2.lat.toFixed(4)}, ${v2.lon.toFixed(4)}]. High-threat corridor alert triggered.`,
      status: 'INVESTIGATING',
      assignedTo: 'Lead Compliance Officer',
    },
    {
      id: `alert-${now}-02`,
      category: 'AML Alert',
      severity: 'CRITICAL',
      vesselName: v3.name,
      vesselId: v3.id,
      timestamp: new Date(now - 12 * 60 * 1000).toISOString(), // 12 mins ago
      title: 'OFAC Sanctioned Beneficial Owner Match (94% Match)',
      description: `Automated screening flagged ultimate beneficial ownership entity under multilateral maritime sanctions lists. Immediate compliance clearance required.`,
      status: 'ESCALATED',
      assignedTo: 'Chief Risk Officer',
    },
    {
      id: `alert-${now}-03`,
      category: 'War Risk Zone',
      severity: 'HIGH',
      vesselName: v5.name,
      vesselId: v5.id,
      timestamp: new Date(now - 28 * 60 * 1000).toISOString(), // 28 mins ago
      title: 'Red Sea / Gulf of Aden Joint War Committee Zone Entry',
      description: `Vessel crossed perimeter into high-threat war hazard advisory corridor at speed ${v5.speed || 15} kn, heading ${v5.heading || 320}°. Automated notification dispatched to operations bridge.`,
      status: 'NEW',
    },
    {
      id: `alert-${now}-04`,
      category: 'Sanctions Screening',
      severity: 'MEDIUM',
      vesselName: v6.name,
      vesselId: v6.id,
      timestamp: new Date(now - 42 * 60 * 1000).toISOString(), // 42 mins ago
      title: 'PEP Associated Directorship Flag',
      description: `Corporate ownership registry records share executive board members with foreign Politically Exposed Persons (PEPs). Enhanced Due Diligence (EDD) documentation requested.`,
      status: 'ACKNOWLEDGED',
      assignedTo: 'AML Investigator',
    },
    {
      id: `alert-${now}-05`,
      category: 'Route Deviation',
      severity: 'HIGH',
      vesselName: v4.name,
      vesselId: v4.id,
      timestamp: new Date(now - 65 * 60 * 1000).toISOString(), // 1h 5m ago
      title: 'Significant Sea Lane Corridor Offset',
      description: `Vessel deviated by >12 nautical miles from designated international TSS channel into restricted coastal waters. SOG: ${v4.speed || 12} kn.`,
      status: 'INVESTIGATING',
      assignedTo: 'Operations Analyst',
    },
    {
      id: `alert-${now}-06`,
      category: 'AIS Anomaly',
      severity: 'LOW',
      vesselName: v1.name,
      vesselId: v1.id,
      timestamp: new Date(now - 95 * 60 * 1000).toISOString(), // ~1.5h ago
      title: 'Authorized AIS Telemetry Sync Established',
      description: `Active live transponder stream verified for MMSI ${v1.mmsi} (IMO ${v1.imo}). Current telemetry: [${v1.lat.toFixed(4)}, ${v1.lon.toFixed(4)}] @ ${v1.speed || 14} kn.`,
      status: 'RESOLVED',
    },
    {
      id: `alert-${now}-07`,
      category: 'Geofence Breach',
      severity: 'HIGH',
      vesselName: v7.name,
      vesselId: v7.id,
      timestamp: new Date(now - 130 * 60 * 1000).toISOString(), // ~2.1h ago
      title: 'Canal Convoys Speed Restriction Exceeded',
      description: `Speed over ground exceeded 11.0 knots in canal approach zone. Speed telemetry logged at ${v7.speed || 13.5} kn.`,
      status: 'RESOLVED',
    },
    {
      id: `alert-${now}-08`,
      category: 'Sanctions Screening',
      severity: 'MEDIUM',
      vesselName: v8.name,
      vesselId: v8.id,
      timestamp: new Date(now - 170 * 60 * 1000).toISOString(), // ~2.8h ago
      title: 'Transshipment STS Risk Assessment',
      description: `Vessel lingered near offshore anchorage coordinates with concurrent vessel loitering profile. AIS proximity evaluated clean.`,
      status: 'ACKNOWLEDGED',
      assignedTo: 'Risk Analyst',
    },
  ];
}

export function generateLiveAnomalies(vessels: Vessel[] = []): AISAnomaly[] {
  const now = Date.now();

  const getV = (idx: number, fallbackName: string, fallbackImo: string, fallbackMmsi: string, lat: number, lon: number): Vessel => {
    if (vessels && vessels.length > idx && vessels[idx]) {
      return vessels[idx];
    }
    return {
      id: `imo-${fallbackImo}`,
      name: fallbackName,
      imo: fallbackImo,
      mmsi: fallbackMmsi,
      lat,
      lon,
      speed: 13.8,
      course: 290,
      heading: 290,
      type: 'Cargo Vessel',
    } as unknown as Vessel;
  };

  const v1 = getV(0, 'CMA CGM SEINE', '9987196', '563254200', 1.2584, 103.7412);
  const v2 = getV(1, 'RED SEA VANGUARD', '9790145', '352009876', 14.80, 42.15);
  const v3 = getV(2, 'ATLANTIC MERIDIAN', '9784320', '636018234', 24.12, 58.41);
  const v4 = getV(3, 'BOSPORUS GLORY', '9498821', '271004567', 41.22, 29.11);
  const v5 = getV(4, 'ELEONORA MAERSK', '9321500', '563254700', 12.65, 43.32);
  const v6 = getV(5, 'TAIPEI HORIZON', '9740019', '416001234', 24.85, 119.92);

  return [
    {
      id: `anom-${now}-01`,
      vesselId: v2.id,
      vesselName: v2.name,
      imo: v2.imo,
      mmsi: v2.mmsi,
      type: 'AIS Gap / Dark Period',
      severity: 'CRITICAL',
      timestamp: new Date(now - 6 * 60 * 1000).toISOString(), // 6 mins ago
      lat: v2.lat,
      lon: v2.lon,
      evidence: `Transponder stopped transmitting for 3 hours 45 minutes in high-risk waters north of Bab-el-Mandeb before resuming AIS broadcast.`,
      status: 'ACTIVE',
    },
    {
      id: `anom-${now}-02`,
      vesselId: v3.id,
      vesselName: v3.name,
      imo: v3.imo,
      mmsi: v3.mmsi,
      type: 'Unusual Speed Surge',
      severity: 'MEDIUM',
      timestamp: new Date(now - 19 * 60 * 1000).toISOString(), // 19 mins ago
      lat: v3.lat,
      lon: v3.lon,
      evidence: `Speed dropped from 14.5 kn to 2.8 kn for 40 minutes off Fujairah anchorage with no declared distress signal.`,
      status: 'ACTIVE',
    },
    {
      id: `anom-${now}-03`,
      vesselId: v4.id,
      vesselName: v4.name,
      imo: v4.imo,
      mmsi: v4.mmsi,
      type: 'Geofence Breach',
      severity: 'HIGH',
      timestamp: new Date(now - 34 * 60 * 1000).toISOString(), // 34 mins ago
      lat: v4.lat,
      lon: v4.lon,
      evidence: `Vessel entered Black Sea Joint War Committee designated high-risk area JWLA-030 without prior security clearance notification.`,
      status: 'UNDER_REVIEW',
      reviewer: 'Chief Risk Officer',
    },
    {
      id: `anom-${now}-04`,
      vesselId: v5.id,
      vesselName: v5.name,
      imo: v5.imo,
      mmsi: v5.mmsi,
      type: 'Route Deviation',
      severity: 'HIGH',
      timestamp: new Date(now - 58 * 60 * 1000).toISOString(), // 58 mins ago
      lat: v5.lat,
      lon: v5.lon,
      evidence: `Destination broadcast changed dynamically from "ROTTERDAM" to "PORT SAID" mid-voyage after entering the Gulf of Aden corridor.`,
      status: 'UNDER_REVIEW',
      reviewer: 'Operations Analyst',
    },
    {
      id: `anom-${now}-05`,
      vesselId: v1.id,
      vesselName: v1.name,
      imo: v1.imo,
      mmsi: v1.mmsi,
      type: 'Route Deviation',
      severity: 'LOW',
      timestamp: new Date(now - 85 * 60 * 1000).toISOString(), // ~1.4h ago
      lat: v1.lat,
      lon: v1.lon,
      evidence: `Dead-reckoning kinematic projection active between VHF radio bursts. Extrapolating forward course ${v1.course || 286}° at ${v1.speed || 13.9} kn.`,
      status: 'ACTIVE',
    },
    {
      id: `anom-${now}-06`,
      vesselId: v6.id,
      vesselName: v6.name,
      imo: v6.imo,
      mmsi: v6.mmsi,
      type: 'Identity Inconsistency',
      severity: 'LOW',
      timestamp: new Date(now - 140 * 60 * 1000).toISOString(), // ~2.3h ago
      lat: v6.lat,
      lon: v6.lon,
      evidence: `Draught broadcast discrepancy: AIS reported 12.2m vs 12.8m recorded at Kaohsiung port departure clearance.`,
      status: 'RESOLVED',
      reviewer: 'Operations Analyst',
      resolutionNotes: 'Confirmed minor bilge water deballasting prior to strait transit.',
    },
  ];
}

export function generateLiveAuditLogs(vessels: Vessel[] = []): AuditLogEntry[] {
  const now = Date.now();

  const getV = (idx: number, fallbackName: string, fallbackImo: string): { name: string; id: string; speed: number; course: number } => {
    if (vessels && vessels.length > idx && vessels[idx]) {
      return {
        name: vessels[idx].name,
        id: vessels[idx].id,
        speed: vessels[idx].speed || 14.2,
        course: vessels[idx].course || 280,
      };
    }
    return {
      name: fallbackName,
      id: `imo-${fallbackImo}`,
      speed: 14.5,
      course: 280,
    };
  };

  const v1 = getV(0, 'CMA CGM SEINE', '9987196');
  const v2 = getV(1, 'RED SEA VANGUARD', '9790145');
  const v3 = getV(2, 'ATLANTIC MERIDIAN', '9784320');
  const v4 = getV(3, 'ELEONORA MAERSK', '9321500');

  return [
    {
      id: `audit-${now}-01`,
      timestamp: new Date(now - 1 * 60 * 1000).toISOString(), // 1 min ago
      user: 'Capt. Elena Vance',
      role: 'Compliance Officer',
      action: 'INGEST_LIVE_AIS_STREAM',
      module: 'Real-Time Telemetry',
      entity: v1.name,
      entityId: v1.id,
      ipAddress: '10.128.0.45',
      previousState: 'Feed: DIRECTORY_STANDBY',
      newState: 'Feed: AISSTREAM_LIVE (Authenticated WebSocket wss://stream.aisstream.io/v0/stream)',
    },
    {
      id: `audit-${now}-02`,
      timestamp: new Date(now - 7 * 60 * 1000).toISOString(), // 7 mins ago
      user: 'Automated Daemon',
      role: 'System Engine',
      action: 'DEAD_RECKONING_EXTRAPOLATION',
      module: 'Kinematic Engine',
      entity: v1.name,
      entityId: v1.id,
      ipAddress: '127.0.0.1',
      previousState: 'Status: PENDING_PING',
      newState: 'Status: EXTRAPOLATING_VECTOR (Smooth 60FPS dead-reckoning projection along course)',
    },
    {
      id: `audit-${now}-03`,
      timestamp: new Date(now - 18 * 60 * 1000).toISOString(), // 18 mins ago
      user: 'Marcus Sterling',
      role: 'Risk Analyst',
      action: 'EXECUTE_AML_SANCTION_SCREENING',
      module: 'AML & Sanctions Engine',
      entity: v2.name,
      entityId: v2.id,
      ipAddress: '10.128.0.62',
      previousState: 'Compliance Status: UNVERIFIED',
      newState: 'Compliance Status: ESCALATED_BENEFICIAL_OWNERSHIP (OFAC maritime sanctions match)',
    },
    {
      id: `audit-${now}-04`,
      timestamp: new Date(now - 32 * 60 * 1000).toISOString(), // 32 mins ago
      user: 'David Chen',
      role: 'Operations Manager',
      action: 'UPDATE_VOYAGE_WAYPOINTS',
      module: 'Voyage Intelligence',
      entity: v3.name,
      entityId: v3.id,
      ipAddress: '10.128.0.33',
      previousState: 'Route Status: STANDARD',
      newState: `ETA: Scheduled (Optimal corridor speed ${v3.speed} kn, course ${v3.course}°)`,
    },
    {
      id: `audit-${now}-05`,
      timestamp: new Date(now - 48 * 60 * 1000).toISOString(), // 48 mins ago
      user: 'Sarah Jenkins',
      role: 'Super Admin',
      action: 'EVALUATE_GEOFENCE_RULE',
      module: 'Geofencing Engine',
      entity: v4.name,
      entityId: v4.id,
      ipAddress: '10.128.0.12',
      previousState: 'Geofence Status: MONITORING',
      newState: 'Geofence Status: BREACH_ACKNOWLEDGED (JWLA-030 Maritime Risk Corridor)',
    },
    {
      id: `audit-${now}-06`,
      timestamp: new Date(now - 75 * 60 * 1000).toISOString(), // ~1.2h ago
      user: 'System Ingestion Service',
      role: 'Automated Daemon',
      action: 'SECURITY_AUDIT_LOG_INITIALIZATION',
      module: 'Cryptographic Audit Trail',
      entity: 'FLEET_GLOBAL_REGISTRY',
      entityId: 'registry-master',
      ipAddress: '127.0.0.1',
      previousState: 'Audit State: INITIALIZING',
      newState: 'Audit State: VERIFIED_IMMUTABLE (SHA-256 block ledger active)',
    },
  ];
}
