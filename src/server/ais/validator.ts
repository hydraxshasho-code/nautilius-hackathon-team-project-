import { NormalizedAISVessel } from './types';

/**
 * Validates decimal degree latitude [-90 to 90]
 */
export function isValidLatitude(lat: any): boolean {
  if (lat === null || lat === undefined) return false;
  const num = Number(lat);
  return !isNaN(num) && num >= -90.0 && num <= 90.0;
}

/**
 * Validates decimal degree longitude [-180 to 180]
 */
export function isValidLongitude(lon: any): boolean {
  if (lon === null || lon === undefined) return false;
  const num = Number(lon);
  return !isNaN(num) && num >= -180.0 && num <= 180.0;
}

/**
 * Validates IMO number (7 digits)
 */
export function isValidIMO(imo: any): boolean {
  if (!imo) return false;
  const clean = String(imo).trim().replace(/[^0-9]/g, '');
  return clean.length === 7;
}

/**
 * Validates MMSI number (9 digits)
 */
export function isValidMMSI(mmsi: any): boolean {
  if (!mmsi) return false;
  const clean = String(mmsi).trim().replace(/[^0-9]/g, '');
  return clean.length === 9;
}

/**
 * Validates and sanitizes Speed Over Ground (knots).
 * In ITU-R M.1371, 102.3 = not available.
 */
export function sanitizeSpeed(sog: any): number | null {
  if (sog === null || sog === undefined) return null;
  const num = Number(sog);
  if (isNaN(num) || num < 0 || num >= 102.3) return null;
  return parseFloat(num.toFixed(1));
}

/**
 * Validates and sanitizes Course Over Ground (degrees).
 * In ITU-R M.1371, 360.0 = not available.
 */
export function sanitizeCourse(cog: any): number | null {
  if (cog === null || cog === undefined) return null;
  const num = Number(cog);
  if (isNaN(num) || num < 0 || num >= 360) return null;
  return Math.round(num);
}

/**
 * Validates and sanitizes True Heading (degrees).
 * In ITU-R M.1371, 511 = not available.
 */
export function sanitizeHeading(heading: any): number | null {
  if (heading === null || heading === undefined) return null;
  const num = Number(heading);
  if (isNaN(num) || num < 0 || num >= 360 || num === 511) return null;
  return Math.round(num);
}

/**
 * Validates static draught (meters).
 */
export function sanitizeDraught(draught: any): number | null {
  if (draught === null || draught === undefined) return null;
  const num = Number(draught);
  if (isNaN(num) || num <= 0 || num > 35) return null;
  return parseFloat(num.toFixed(1));
}

/**
 * Validates entire normalized AIS vessel record.
 * Throws or returns sanitized vessel.
 */
export function validateAndSanitizeVessel(raw: Partial<NormalizedAISVessel>): NormalizedAISVessel | null {
  const mmsi = String(raw.mmsi || '').trim().replace(/[^0-9]/g, '');
  if (!mmsi || mmsi.length < 7) {
    return null;
  }

  const lat = raw.position?.latitude;
  const lon = raw.position?.longitude;

  if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
    return null;
  }

  const speed = sanitizeSpeed(raw.navigation?.speed);
  const course = sanitizeCourse(raw.navigation?.course);
  const heading = sanitizeHeading(raw.navigation?.heading);
  const draught = sanitizeDraught(raw.navigation?.draught);

  const timestamp = raw.timestamp ? new Date(raw.timestamp).toISOString() : new Date().toISOString();
  const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));

  let status: 'LIVE' | 'STALE' | 'OFFLINE' = 'LIVE';
  if (ageSeconds > 120) {
    status = 'STALE';
  }

  const sanitized: NormalizedAISVessel = {
    imo: raw.imo ? String(raw.imo).trim().replace(/[^0-9]/g, '') : null,
    mmsi,
    name: String(raw.name || 'UNKNOWN VESSEL').trim().toUpperCase(),
    position: {
      latitude: parseFloat(Number(lat).toFixed(5)),
      longitude: parseFloat(Number(lon).toFixed(5)),
    },
    navigation: {
      speed,
      course,
      heading,
      draught,
      navigationStatus: raw.navigation?.navigationStatus ?? null,
    },
    voyage: {
      destination: raw.voyage?.destination ? String(raw.voyage.destination).trim().toUpperCase() : null,
      eta: raw.voyage?.eta ? String(raw.voyage.eta) : null,
    },
    source: raw.source || 'AIS_AUTHORIZED_FEED',
    timestamp,
    status,
    lastUpdatedSecondsAgo: ageSeconds,
    callSign: raw.callSign ? String(raw.callSign).trim().toUpperCase() : null,
    type: raw.type ? String(raw.type).trim() : null,
    flag: raw.flag ? String(raw.flag).trim() : null,
    flagCode: raw.flagCode ? String(raw.flagCode).trim().toUpperCase() : null,
    length: raw.length ? Number(raw.length) : null,
    beam: raw.beam ? Number(raw.beam) : null,
    deadweightTonnage: raw.deadweightTonnage ? Number(raw.deadweightTonnage) : null,
    grossTonnage: raw.grossTonnage ? Number(raw.grossTonnage) : null,
    yearBuilt: raw.yearBuilt ? Number(raw.yearBuilt) : null,
    classificationSociety: raw.classificationSociety ? String(raw.classificationSociety) : null,
    owner: raw.owner ? String(raw.owner) : null,
    operator: raw.operator ? String(raw.operator) : null,
    beneficialOwner: raw.beneficialOwner ? String(raw.beneficialOwner) : null,
    manager: raw.manager ? String(raw.manager) : null,
  };

  return sanitized;
}
