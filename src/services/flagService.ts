/**
 * Authoritative Maritime Flag Resolution Service
 * ITU Maritime Identification Digits (MID) table and multi-tier flag resolution.
 * Strictly avoids hardcoded single-nation fallbacks (e.g. Singapore).
 */

export type FlagSource = 'AIS' | 'VESSEL_METADATA' | 'MMSI_MID_INFERENCE' | 'UNKNOWN';

export interface ResolvedFlag {
  flag: string;
  flagCode: string;
  flagSource: FlagSource;
}

// Official ITU Maritime Identification Digits (MID) Table
const ITU_MID_MAP: Record<string, { country: string; code: string }> = {
  // Asia
  '419': { country: 'India', code: 'IN' },
  '563': { country: 'Singapore', code: 'SG' },
  '564': { country: 'Singapore', code: 'SG' },
  '565': { country: 'Singapore', code: 'SG' },
  '566': { country: 'Singapore', code: 'SG' },
  '412': { country: 'China', code: 'CN' },
  '413': { country: 'China', code: 'CN' },
  '414': { country: 'China', code: 'CN' },
  '431': { country: 'Japan', code: 'JP' },
  '432': { country: 'Japan', code: 'JP' },
  '440': { country: 'Republic of Korea', code: 'KR' },
  '441': { country: 'Republic of Korea', code: 'KR' },
  '477': { country: 'Hong Kong', code: 'HK' },
  '533': { country: 'Malaysia', code: 'MY' },
  '525': { country: 'Indonesia', code: 'ID' },
  '548': { country: 'Philippines', code: 'PH' },
  '567': { country: 'Thailand', code: 'TH' },
  '574': { country: 'Vietnam', code: 'VN' },
  '416': { country: 'Taiwan', code: 'TW' },
  '422': { country: 'Iran', code: 'IR' },
  '403': { country: 'Saudi Arabia', code: 'SA' },
  '470': { country: 'United Arab Emirates', code: 'AE' },

  // Americas / Flag of Convenience
  '351': { country: 'Panama', code: 'PA' },
  '352': { country: 'Panama', code: 'PA' },
  '353': { country: 'Panama', code: 'PA' },
  '354': { country: 'Panama', code: 'PA' },
  '355': { country: 'Panama', code: 'PA' },
  '356': { country: 'Panama', code: 'PA' },
  '357': { country: 'Panama', code: 'PA' },
  '370': { country: 'Panama', code: 'PA' },
  '371': { country: 'Panama', code: 'PA' },
  '372': { country: 'Panama', code: 'PA' },
  '373': { country: 'Panama', code: 'PA' },
  '538': { country: 'Marshall Islands', code: 'MH' },
  '308': { country: 'Bahamas', code: 'BS' },
  '309': { country: 'Bahamas', code: 'BS' },
  '311': { country: 'Bahamas', code: 'BS' },
  '338': { country: 'United States', code: 'US' },
  '366': { country: 'United States', code: 'US' },
  '367': { country: 'United States', code: 'US' },
  '368': { country: 'United States', code: 'US' },
  '369': { country: 'United States', code: 'US' },
  '316': { country: 'Canada', code: 'CA' },
  '310': { country: 'Bermuda', code: 'BM' },
  '710': { country: 'Brazil', code: 'BR' },

  // Europe / Mediterranean
  '636': { country: 'Liberia', code: 'LR' },
  '637': { country: 'Liberia', code: 'LR' },
  '638': { country: 'Liberia', code: 'LR' },
  '215': { country: 'Malta', code: 'MT' },
  '229': { country: 'Malta', code: 'MT' },
  '248': { country: 'Malta', code: 'MT' },
  '249': { country: 'Malta', code: 'MT' },
  '256': { country: 'Malta', code: 'MT' },
  '237': { country: 'Greece', code: 'GR' },
  '239': { country: 'Greece', code: 'GR' },
  '240': { country: 'Greece', code: 'GR' },
  '241': { country: 'Greece', code: 'GR' },
  '232': { country: 'United Kingdom', code: 'GB' },
  '233': { country: 'United Kingdom', code: 'GB' },
  '234': { country: 'United Kingdom', code: 'GB' },
  '235': { country: 'United Kingdom', code: 'GB' },
  '219': { country: 'Denmark', code: 'DK' },
  '220': { country: 'Denmark', code: 'DK' },
  '209': { country: 'Cyprus', code: 'CY' },
  '210': { country: 'Cyprus', code: 'CY' },
  '212': { country: 'Cyprus', code: 'CY' },
  '214': { country: 'Cyprus', code: 'CY' },
  '271': { country: 'Turkey', code: 'TR' },
  '244': { country: 'Netherlands', code: 'NL' },
  '245': { country: 'Netherlands', code: 'NL' },
  '246': { country: 'Netherlands', code: 'NL' },
  '257': { country: 'Norway', code: 'NO' },
  '258': { country: 'Norway', code: 'NO' },
  '259': { country: 'Norway', code: 'NO' },
  '211': { country: 'Germany', code: 'DE' },
  '218': { country: 'Germany', code: 'DE' },
  '226': { country: 'France', code: 'FR' },
  '227': { country: 'France', code: 'FR' },
  '228': { country: 'France', code: 'FR' },
  '247': { country: 'Italy', code: 'IT' },
  '224': { country: 'Spain', code: 'ES' },
  '263': { country: 'Portugal', code: 'PT' },
  '265': { country: 'Sweden', code: 'SE' },
  '266': { country: 'Sweden', code: 'SE' },
  '230': { country: 'Finland', code: 'FI' },
  '250': { country: 'Ireland', code: 'IE' },
  '205': { country: 'Belgium', code: 'BE' },
  '261': { country: 'Poland', code: 'PL' },
  '273': { country: 'Russian Federation', code: 'RU' },
  '272': { country: 'Ukraine', code: 'UA' },
  '423': { country: 'Azerbaijan', code: 'AZ' },

  // Africa / Oceania
  '503': { country: 'Australia', code: 'AU' },
  '512': { country: 'New Zealand', code: 'NZ' },
  '601': { country: 'South Africa', code: 'ZA' },
  '622': { country: 'Egypt', code: 'EG' },
};

/**
 * Extracts 3-digit Maritime Identification Digit (MID) from 9-digit MMSI.
 */
export function extractMidFromMmsi(mmsi: string | number | undefined | null): string | null {
  if (!mmsi) return null;
  const clean = String(mmsi).trim().replace(/[^0-9]/g, '');
  if (clean.length < 3) return null;

  // Standard ship stations: first 3 digits
  let candidate = clean.substring(0, 3);
  if (ITU_MID_MAP[candidate]) return candidate;

  // Coastal stations or group MMSI starting with 0: digits 2..4
  if (clean.startsWith('0') && clean.length >= 4) {
    candidate = clean.substring(1, 4);
    if (ITU_MID_MAP[candidate]) return candidate;
  }

  // SAR aircraft or auxiliary starting with 111: digits 4..6
  if (clean.startsWith('111') && clean.length >= 6) {
    candidate = clean.substring(3, 6);
    if (ITU_MID_MAP[candidate]) return candidate;
  }

  return ITU_MID_MAP[candidate] ? candidate : null;
}

/**
 * Resolves vessel flag prioritizing authoritative sources over fallback inference.
 * NEVER defaults blindly to Singapore.
 *
 * @param explicitFlag Flag field directly supplied from AIS or API
 * @param explicitFlagCode Flag country ISO code supplied from AIS or API
 * @param metadataFlag Authoritative registry metadata flag
 * @param metadataFlagCode Authoritative registry ISO code
 * @param mmsi MMSI number for ITU MID derivation
 */
export function resolveVesselFlag(params: {
  explicitFlag?: string | null;
  explicitFlagCode?: string | null;
  metadataFlag?: string | null;
  metadataFlagCode?: string | null;
  mmsi?: string | number | null;
}): ResolvedFlag {
  const { explicitFlag, explicitFlagCode, metadataFlag, metadataFlagCode, mmsi } = params;

  // 1. Authoritative explicit AIS flag
  if (explicitFlag && explicitFlag.trim().length > 0 && explicitFlag.trim().toLowerCase() !== 'unknown') {
    return {
      flag: explicitFlag.trim(),
      flagCode: explicitFlagCode?.trim() || getFlagCodeForCountry(explicitFlag.trim()) || 'UN',
      flagSource: 'AIS',
    };
  }

  // 2. Authoritative vessel registry metadata
  if (metadataFlag && metadataFlag.trim().length > 0 && metadataFlag.trim().toLowerCase() !== 'unknown') {
    return {
      flag: metadataFlag.trim(),
      flagCode: metadataFlagCode?.trim() || getFlagCodeForCountry(metadataFlag.trim()) || 'UN',
      flagSource: 'VESSEL_METADATA',
    };
  }

  // 3. ITU MID inference from MMSI (auditable, marked clearly as MMSI_MID_INFERENCE)
  const mid = extractMidFromMmsi(mmsi);
  if (mid && ITU_MID_MAP[mid]) {
    const info = ITU_MID_MAP[mid];
    return {
      flag: info.country,
      flagCode: info.code,
      flagSource: 'MMSI_MID_INFERENCE',
    };
  }

  // 4. Unknown flag state (NEVER fabricated as Singapore)
  return {
    flag: 'Unknown',
    flagCode: 'UN',
    flagSource: 'UNKNOWN',
  };
}

/**
 * Maps known nation names to ISO 3166-1 alpha-2 country codes
 */
export function getFlagCodeForCountry(countryName: string): string | null {
  const normalized = (countryName || '').trim().toLowerCase();
  for (const midInfo of Object.values(ITU_MID_MAP)) {
    if (midInfo.country.toLowerCase() === normalized) {
      return midInfo.code;
    }
  }
  return null;
}
