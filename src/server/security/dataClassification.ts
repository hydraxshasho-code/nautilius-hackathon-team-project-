import { UserRole } from './types';

/**
 * Projects a vessel object according to the user's authenticated role.
 * Ensures sensitive AML/KYC/UBO intelligence is not leaked to unauthenticated users
 * while preserving 100% of real-time AIS navigation and tracking data.
 */
export function projectVesselForRole(vessel: any, role: UserRole | 'Guest'): any {
  if (!vessel) return null;

  // Extract navigation and coordinates safely whether from NormalizedAISVessel or Vessel
  const lat = typeof vessel.position?.latitude === 'number'
    ? vessel.position.latitude
    : (typeof vessel.lat === 'number' ? vessel.lat : 0);
  const lon = typeof vessel.position?.longitude === 'number'
    ? vessel.position.longitude
    : (typeof vessel.lon === 'number' ? vessel.lon : 0);
  const speed = vessel.navigation?.speed ?? (typeof vessel.speed === 'number' ? vessel.speed : 0);
  const course = vessel.navigation?.course !== null && vessel.navigation?.course !== undefined
    ? vessel.navigation.course
    : (typeof vessel.course === 'number' ? vessel.course : (vessel.navigation?.heading ?? vessel.heading ?? 0));
  const heading = vessel.navigation?.heading !== null && vessel.navigation?.heading !== undefined && vessel.navigation?.heading !== 511
    ? vessel.navigation.heading
    : (typeof vessel.heading === 'number' ? vessel.heading : course);
  const draught = vessel.navigation?.draught ?? (typeof vessel.draught === 'number' ? vessel.draught : 10.0);
  const navStatus = vessel.navigation?.navigationStatus ?? vessel.navStatus ?? 'Under way using engine';
  const destination = vessel.voyage?.destination ?? vessel.destination ?? 'UNAVAILABLE';
  const eta = vessel.voyage?.eta ?? vessel.eta ?? 'UNAVAILABLE';
  const timestamp = vessel.timestamp || new Date().toISOString();
  const source = vessel.source || vessel.aisSource || 'AISSTREAM_REALTIME';
  const status = vessel.status || (vessel.isStale ? 'STALE' : 'LIVE');
  const lastUpdated = vessel.lastUpdatedSecondsAgo ?? (vessel.isStale ? 180 : 0);
  const flagSource = vessel.flagSource || null;
  const imoClean = vessel.imo ? String(vessel.imo).trim() : null;
  const mmsiClean = vessel.mmsi ? String(vessel.mmsi).trim() : '';
  const uniqueId = vessel.id || (imoClean ? `imo-${imoClean}` : `mmsi-${mmsiClean}`);

  const position = { latitude: lat, longitude: lon };
  const navigation = {
    speed,
    course,
    heading,
    draught,
    navigationStatus: navStatus,
  };
  const voyage = {
    destination,
    eta,
  };

  // Roles authorized to see full compliance & risk intelligence
  const hasFullIntelligenceAccess = [
    'Super Admin',
    'Compliance Officer',
    'Risk Analyst',
    'Investigator',
    'Auditor',
  ].includes(role);

  if (hasFullIntelligenceAccess) {
    return {
      ...vessel,
      id: uniqueId,
      imo: imoClean,
      mmsi: mmsiClean,
      lat,
      lon,
      speed,
      course,
      heading,
      navStatus,
      destination,
      eta,
      position,
      navigation,
      voyage,
      source,
      aisSource: source,
      status,
      lastUpdatedSecondsAgo: lastUpdated,
      flagSource,
    };
  }

  // Operations Manager: needs tactical telemetry, AIS anomalies, and basic risk tier,
  // but does not receive sensitive beneficial ownership (UBO) or AML intelligence.
  if (role === 'Operations Manager') {
    return {
      ...vessel,
      id: uniqueId,
      imo: imoClean,
      mmsi: mmsiClean,
      lat,
      lon,
      speed,
      course,
      heading,
      navStatus,
      destination,
      eta,
      position,
      navigation,
      voyage,
      source,
      aisSource: source,
      status,
      lastUpdatedSecondsAgo: lastUpdated,
      flagSource,
      beneficialOwner: '[Restricted: Compliance Authorization Required]',
      ownershipStructure: undefined,
      amlMatchConfidence: undefined,
      amlStatus: 'CONFIDENTIAL',
    };
  }

  // Public / Unauthenticated / Viewer:
  // Returns all operational AIS telemetry required for 3D/2D live map and vessel registry,
  // redacting sensitive internal intelligence dossiers.
  return {
    id: uniqueId,
    name: vessel.name || `VESSEL-${mmsiClean}`,
    imo: imoClean,
    mmsi: mmsiClean,
    callSign: vessel.callSign || null,
    type: vessel.type || 'Container Ship',
    flag: vessel.flag || 'Unknown',
    flagCode: vessel.flagCode || 'XX',
    flagSource,
    position,
    navigation,
    voyage,
    lat,
    lon,
    speed,
    course,
    heading,
    navStatus,
    destination,
    destinationPortCode: vessel.destinationPortCode || 'ZZZZZ',
    origin: vessel.origin || 'ORIGIN PORT',
    originPortCode: vessel.originPortCode || 'ZZZZZ',
    eta,
    timestamp,
    source,
    aisSource: source,
    status,
    lastUpdatedSecondsAgo: lastUpdated,
    length: vessel.length || 300,
    beam: vessel.beam || 40,
    draught,
    grossTonnage: vessel.grossTonnage || 80000,
    deadweightTonnage: vessel.deadweightTonnage || 90000,
    yearBuilt: vessel.yearBuilt || 2020,
    totalDistanceNm: vessel.totalDistanceNm || 3000,
    distanceTraveledNm: vessel.distanceTraveledNm || 100,
    isTransmitting: status === 'LIVE',
    isStale: status === 'STALE' || status === 'OFFLINE',
    historicalTrack: vessel.historicalTrack || [{ lat, lon, timestamp, speed, course, heading }],
    predictedTrack: vessel.predictedTrack || [],
    portCalls: vessel.portCalls || [],
    owner: vessel.owner || '[Commercial Operator]',
    operator: vessel.operator || '[Commercial Operator]',
    // Redacted sensitive intelligence fields
    beneficialOwner: '[Restricted - Authenticate to view UBO]',
    ownershipStructure: undefined,
    kycStatus: 'RESTRICTED',
    amlStatus: 'RESTRICTED',
    riskLevel: 'LOW',
    riskScore: 0,
    riskBreakdown: undefined,
    riskEvidence: undefined,
  };
}

export function projectFleetForRole(fleet: any[], role: UserRole | 'Guest'): any[] {
  if (!Array.isArray(fleet)) return [];
  return fleet.map((v) => projectVesselForRole(v, role));
}
