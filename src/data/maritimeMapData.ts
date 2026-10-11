// Major global shipping lanes, ports, and risk zones for OCEANIQ Tactical Map

export interface ShippingLane {
  id: string;
  name: string;
  coordinates: [number, number][]; // [lon, lat]
  type: 'PRIMARY_CORRIDOR' | 'CHOKEPOINT' | 'COASTAL';
}

export interface MapPort {
  id: string;
  name: string;
  code: string;
  country: string;
  lat: number;
  lon: number;
  annualTeuRank: number;
}

export interface RiskZone {
  id: string;
  name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  description: string;
  center: [number, number]; // [lon, lat]
  radiusDeg: number;
  color: string;
}

export interface SanctionedZone {
  id: string;
  name: string;
  authority: 'OFAC / US Treasury' | 'EU Sanctions' | 'UN Security Council' | 'UKMTO / JWC';
  code: string;
  description: string;
  center: [number, number]; // [lon, lat]
  radiusDeg: number;
  color: string;
  severity: 'CRITICAL' | 'HIGH';
  restrictions: string;
}

export interface WeatherSystem {
  id: string;
  name: string;
  type: 'TROPICAL_CYCLONE' | 'SEVERE_GALE' | 'ROUGH_SEAS' | 'MONSOON_DEPRESSION';
  center: [number, number]; // [lon, lat]
  radiusDeg: number;
  windKnots: number;
  waveHeightM: number;
  heading: number;
  pressureHpa: number;
  color: string;
  advisory: string;
}

export const MAJOR_SHIPPING_LANES: ShippingLane[] = [
  {
    id: 'lane-malacca',
    name: 'Malacca Strait High Density TSS',
    type: 'CHOKEPOINT',
    coordinates: [
      [95.2, 5.8],
      [98.5, 3.8],
      [101.4, 2.5],
      [103.8, 1.25],
      [104.5, 1.4],
      [106.8, 3.2],
    ],
  },
  {
    id: 'lane-suez-redsea',
    name: 'Suez - Bab-el-Mandeb - Red Sea Corridor',
    type: 'CHOKEPOINT',
    coordinates: [
      [32.5, 30.0],
      [34.0, 27.5],
      [38.0, 22.0],
      [42.0, 15.5],
      [43.5, 12.6],
      [48.0, 11.8],
      [55.0, 14.5],
    ],
  },
  {
    id: 'lane-hormuz',
    name: 'Strait of Hormuz Tanker Corridor',
    type: 'CHOKEPOINT',
    coordinates: [
      [48.5, 29.8],
      [51.0, 27.2],
      [55.0, 25.5],
      [56.5, 26.3],
      [58.5, 24.2],
      [65.0, 20.5],
    ],
  },
  {
    id: 'lane-gibraltar-med',
    name: 'Gibraltar - Mediterranean Arterial',
    type: 'PRIMARY_CORRIDOR',
    coordinates: [
      [-10.0, 36.0],
      [-5.6, 35.95],
      [0.0, 37.0],
      [12.0, 37.5],
      [24.0, 35.0],
      [32.0, 32.0],
    ],
  },
  {
    id: 'lane-transpacific',
    name: 'North Pacific Great Circle Route',
    type: 'PRIMARY_CORRIDOR',
    coordinates: [
      [122.0, 31.5],
      [135.0, 34.0],
      [150.0, 38.0],
      [180.0, 42.0],
      [-160.0, 42.0],
      [-130.0, 36.0],
      [-118.5, 33.7],
    ],
  },
  {
    id: 'lane-transatlantic',
    name: 'North Atlantic Container Route',
    type: 'PRIMARY_CORRIDOR',
    coordinates: [
      [4.0, 52.0],
      [1.5, 51.0],
      [-5.0, 49.5],
      [-25.0, 46.0],
      [-45.0, 42.0],
      [-65.0, 38.0],
      [-74.0, 40.5],
    ],
  },
  {
    id: 'lane-panama',
    name: 'Panama Canal Trans-Isthmian Transit',
    type: 'CHOKEPOINT',
    coordinates: [
      [-79.9, 9.35],
      [-79.55, 8.95],
    ],
  },
  {
    id: 'lane-dover',
    name: 'English Channel / Dover Strait TSS',
    type: 'CHOKEPOINT',
    coordinates: [
      [-5.0, 49.8],
      [-1.5, 50.3],
      [1.4, 51.1],
      [3.0, 51.8],
      [4.2, 52.1],
    ],
  },
];

export const MAJOR_PORTS: MapPort[] = [
  { id: 'p-sin', name: 'Port of Singapore', code: 'SGSIN', country: 'Singapore', lat: 1.28, lon: 103.85, annualTeuRank: 2 },
  { id: 'p-rtm', name: 'Port of Rotterdam', code: 'NLRTM', country: 'Netherlands', lat: 51.95, lon: 4.12, annualTeuRank: 10 },
  { id: 'p-sha', name: 'Port of Shanghai', code: 'CNSHA', country: 'China', lat: 31.23, lon: 121.50, annualTeuRank: 1 },
  { id: 'p-lax', name: 'Port of Los Angeles', code: 'USLAX', country: 'USA', lat: 33.74, lon: -118.27, annualTeuRank: 17 },
  { id: 'p-pus', name: 'Port of Busan', code: 'KRPUS', country: 'South Korea', lat: 35.10, lon: 129.04, annualTeuRank: 7 },
  { id: 'p-dxb', name: 'Jebel Ali (Dubai)', code: 'AEJEA', country: 'UAE', lat: 25.00, lon: 55.06, annualTeuRank: 11 },
  { id: 'p-hou', name: 'Port of Houston', code: 'USHOU', country: 'USA', lat: 29.75, lon: -95.25, annualTeuRank: 28 },
  { id: 'p-anr', name: 'Port of Antwerp-Bruges', code: 'BEANR', country: 'Belgium', lat: 51.28, lon: 4.35, annualTeuRank: 13 },
  { id: 'p-tyo', name: 'Port of Tokyo', code: 'JPTYO', country: 'Japan', lat: 35.62, lon: 139.77, annualTeuRank: 29 },
  { id: 'p-hkg', name: 'Port of Hong Kong', code: 'HKHKG', country: 'Hong Kong', lat: 22.31, lon: 114.12, annualTeuRank: 9 },
  { id: 'p-ssz', name: 'Port of Santos', code: 'BRSSZ', country: 'Brazil', lat: -23.96, lon: -46.30, annualTeuRank: 38 },
];

export const MARITIME_RISK_ZONES: RiskZone[] = [
  {
    id: 'rz-redsea',
    name: 'Bab-el-Mandeb & Southern Red Sea',
    severity: 'CRITICAL',
    description: 'Active missile/drone strikes & anti-ship ballistic threats against commercial shipping',
    center: [43.0, 14.0],
    radiusDeg: 4.8,
    color: 'rgba(239, 68, 68, 0.22)',
  },
  {
    id: 'rz-blacksea',
    name: 'Black Sea War Hazard Zone (JWLA-030)',
    severity: 'CRITICAL',
    description: 'Active naval combat zone, drifting naval mines, and port infrastructure hazard',
    center: [32.5, 43.5],
    radiusDeg: 4.0,
    color: 'rgba(239, 68, 68, 0.20)',
  },
  {
    id: 'rz-guinea',
    name: 'Gulf of Guinea Piracy High-Risk Corridor',
    severity: 'HIGH',
    description: 'Armed boarding, cargo theft and hostage kidnapping maritime security area',
    center: [4.0, 3.5],
    radiusDeg: 5.5,
    color: 'rgba(249, 115, 22, 0.20)',
  },
  {
    id: 'rz-taiwan',
    name: 'Taiwan Strait Geopolitical Transit Zone',
    severity: 'MEDIUM',
    description: 'Elevated naval military exercises and maritime electronic jamming risks',
    center: [119.8, 24.2],
    radiusDeg: 2.8,
    color: 'rgba(245, 158, 11, 0.18)',
  },
  {
    id: 'rz-hormuz',
    name: 'Strait of Hormuz & Gulf of Oman',
    severity: 'HIGH',
    description: 'Vessel interdiction risk, state boarding and GPS spoofing reports',
    center: [57.5, 25.0],
    radiusDeg: 3.5,
    color: 'rgba(249, 115, 22, 0.20)',
  },
];

export const SANCTIONED_ZONES: SanctionedZone[] = [
  {
    id: 'sz-redsea-yemen',
    name: 'Red Sea / Bab el-Mandeb War Risk & Embargo Zone',
    authority: 'UKMTO / JWC',
    code: 'JWLA-032',
    description: 'Active anti-ship ballistic strikes, armed UAV attacks, and OFAC/UK sanctions monitoring.',
    center: [42.8, 13.8],
    radiusDeg: 4.8,
    color: 'rgba(225, 29, 72, 0.28)',
    severity: 'CRITICAL',
    restrictions: 'High-risk war perimeter. Commercial vessels required to maintain AIS active and report transit.',
  },
  {
    id: 'sz-blacksea-crimea',
    name: 'Black Sea & Sea of Azov Comprehensive Maritime Exclusion',
    authority: 'OFAC / US Treasury',
    code: 'OFAC-RU-CRIMEA',
    description: 'Comprehensive import/export embargo, naval exclusion zone, and drifting mine hazards.',
    center: [33.5, 44.0],
    radiusDeg: 4.2,
    color: 'rgba(239, 68, 68, 0.26)',
    severity: 'CRITICAL',
    restrictions: 'OFAC Crimea embargo & EU 11th package dark fleet transshipment ban in effect.',
  },
  {
    id: 'sz-hormuz-iran',
    name: 'Strait of Hormuz Iranian Petroleum Sanction Perimeter',
    authority: 'OFAC / US Treasury',
    code: 'OFAC-IRAN-PETRO',
    description: 'Surveillance of illicit crude transfers, shadow fleet AIS spoofing, and tanker interdiction.',
    center: [56.2, 26.2],
    radiusDeg: 3.6,
    color: 'rgba(244, 63, 94, 0.25)',
    severity: 'HIGH',
    restrictions: 'Secondary sanctions for unverified STS transshipments of crude and petrochemicals.',
  },
  {
    id: 'sz-korea-sts',
    name: 'DPRK / Yellow Sea STS Interdiction Zone',
    authority: 'UN Security Council',
    code: 'UNSCR-2397',
    description: 'UN-mandated ban on refined petroleum and coal transfers at sea.',
    center: [124.5, 37.8],
    radiusDeg: 3.2,
    color: 'rgba(239, 68, 68, 0.25)',
    severity: 'CRITICAL',
    restrictions: 'Immediate asset freeze and port denial for vessels engaged in unauthorized STS transfers.',
  },
  {
    id: 'sz-baltic-skaw',
    name: 'Baltic / Skaw Dark Fleet STS Monitoring Zone',
    authority: 'EU Sanctions',
    code: 'EU-G7-PRICECAP',
    description: 'G7 price cap verification and ship-to-ship transshipment enforcement area.',
    center: [25.5, 59.5],
    radiusDeg: 3.0,
    color: 'rgba(245, 158, 11, 0.24)',
    severity: 'HIGH',
    restrictions: 'Proof of attestation and P&I maritime insurance required for Russian-origin crude.',
  },
  {
    id: 'sz-venezuela-orinoc',
    name: 'Jose / Orinoco Basin Sanctions Perimeter',
    authority: 'OFAC / US Treasury',
    code: 'OFAC-VE-CRUDE',
    description: 'Petroleum sanctions surveillance and deceptive shipping practices watch area.',
    center: [-65.0, 10.5],
    radiusDeg: 2.8,
    color: 'rgba(249, 115, 22, 0.22)',
    severity: 'HIGH',
    restrictions: 'Verification of beneficial cargo ownership and AIS transmission integrity.',
  },
];

export const WEATHER_SYSTEMS: WeatherSystem[] = [
  {
    id: 'wx-typhoon-haikui',
    name: 'Super Typhoon HAIKUI (Cat 4)',
    type: 'TROPICAL_CYCLONE',
    center: [130.5, 20.8],
    radiusDeg: 5.5,
    windKnots: 88,
    waveHeightM: 9.6,
    heading: 305,
    pressureHpa: 935,
    color: 'rgba(168, 85, 247, 0.32)',
    advisory: 'Violent sea state, wind gusts over 110 kn, significant wave heights exceeding 10 meters. Immediate rerouting advised.',
  },
  {
    id: 'wx-natlantic-gale',
    name: 'North Atlantic Deep Depression (Severe Gale)',
    type: 'SEVERE_GALE',
    center: [-30.0, 52.0],
    radiusDeg: 6.8,
    windKnots: 54,
    waveHeightM: 8.4,
    heading: 75,
    pressureHpa: 968,
    color: 'rgba(59, 130, 246, 0.28)',
    advisory: 'Gale force 9 to 10 winds with dangerous cross swell. Reduced vessel maneuvering speed.',
  },
  {
    id: 'wx-agulhas-rogue',
    name: 'Agulhas Current Storm & Rogue Wave Hazard',
    type: 'ROUGH_SEAS',
    center: [24.0, -36.0],
    radiusDeg: 4.2,
    windKnots: 46,
    waveHeightM: 7.8,
    heading: 90,
    pressureHpa: 1005,
    color: 'rgba(6, 182, 212, 0.28)',
    advisory: 'Southwesterly swell meeting opposing 4-knot current creates steep, breaking pyramidal waves.',
  },
  {
    id: 'wx-bengal-monsoon',
    name: 'Bay of Bengal Deep Monsoon Squall',
    type: 'MONSOON_DEPRESSION',
    center: [88.0, 16.5],
    radiusDeg: 4.8,
    windKnots: 42,
    waveHeightM: 5.2,
    heading: 340,
    pressureHpa: 994,
    color: 'rgba(20, 184, 166, 0.26)',
    advisory: 'Heavy tropical downpours and squall lines with severe visibility degradation under 1 NM.',
  },
  {
    id: 'wx-pacific-winter',
    name: 'North Pacific Great Circle Low',
    type: 'SEVERE_GALE',
    center: [172.0, 44.5],
    radiusDeg: 6.5,
    windKnots: 50,
    waveHeightM: 8.0,
    heading: 85,
    pressureHpa: 974,
    color: 'rgba(99, 102, 241, 0.28)',
    advisory: 'Heavy rolling seas affecting ultra-large container ships along trans-Pacific Great Circle routes.',
  },
];

// Detailed continent vector polygons [lon, lat] for realistic tactical maritime rendering
export const CONTINENT_POLYGONS: [number, number][][] = [
  // North America (Mainland, Alaska, Canada, USA, Mexico, Central America)
  [
    [-168, 65.5], [-165, 66.5], [-162, 70.5], [-156, 71.3], [-140, 69.8], [-130, 70.2], [-120, 69.0],
    [-115, 68.0], [-108, 68.5], [-95, 69.5], [-88, 70.0], [-82, 66.0], [-85, 63.0], [-90, 63.0],
    [-94, 60.0], [-90, 57.0], [-82, 55.0], [-80, 52.0], [-79, 58.0], [-75, 62.0], [-68, 62.5],
    [-65, 59.0], [-60, 55.0], [-55, 51.5], [-58, 48.0], [-64, 46.0], [-66, 44.5], [-70, 42.5],
    [-74, 40.5], [-75.5, 38.5], [-76, 35.0], [-80, 32.0], [-81, 28.5], [-80.5, 25.0], [-81.5, 25.0],
    [-82.5, 28.0], [-84, 30.0], [-88, 30.2], [-90, 29.2], [-94, 29.5], [-97, 27.5], [-97.5, 25.5],
    [-97.8, 22.0], [-96, 19.5], [-92.5, 18.5], [-90.5, 20.0], [-88, 21.5], [-87, 21.0], [-88.5, 18.0],
    [-88.2, 16.0], [-86, 16.0], [-83.5, 15.0], [-83, 12.0], [-80, 9.0], [-77.5, 8.0], [-79, 7.5],
    [-81, 8.5], [-83.5, 8.3], [-85, 10.0], [-87.5, 13.0], [-92, 14.5], [-97, 16.0], [-102, 17.5],
    [-105, 19.5], [-106, 23.0], [-109, 23.5], [-110, 26.0], [-112, 29.0], [-114, 31.5], [-115, 32.0],
    [-117, 32.5], [-120, 34.5], [-122, 37.0], [-124, 40.0], [-124.5, 46.5], [-123, 49.0], [-126, 51.0],
    [-130, 54.0], [-134, 57.0], [-136, 59.0], [-145, 60.0], [-152, 59.5], [-158, 56.5], [-163, 55.0],
    [-166, 60.0], [-162, 63.5], [-166, 64.5], [-168, 65.5],
  ],
  // South America
  [
    [-77.5, 8.0], [-76, 8.5], [-73, 11.5], [-71.5, 12.0], [-69, 11.5], [-63, 10.5], [-61, 10.0],
    [-58, 6.0], [-55, 5.0], [-51, 4.0], [-48, -0.5], [-44, -2.5], [-39, -3.0], [-35, -5.5],
    [-35, -8.5], [-37, -11.0], [-38.5, -13.0], [-39, -17.0], [-41, -21.0], [-44, -23.0], [-48, -25.5],
    [-52, -32.0], [-54, -34.5], [-58, -34.5], [-62, -39.0], [-65, -42.0], [-66, -46.0], [-67, -50.0],
    [-65, -53.5], [-67, -55.5], [-70, -53.0], [-74, -52.0], [-75, -48.0], [-74, -44.0], [-73, -40.0],
    [-71.5, -34.0], [-70.5, -28.0], [-70, -22.0], [-75, -15.0], [-78, -10.0], [-81, -5.0], [-80, -2.0],
    [-77.5, 1.0], [-77.5, 4.0], [-77.5, 8.0],
  ],
  // Eurasia Mainland (Europe, Middle East, Central Asia, Russia, East Asia, SE Asia)
  [
    [-9.5, 37.0], [-9.0, 42.0], [-8.5, 43.5], [-1.5, 43.5], [-0.5, 46.0], [-4.5, 48.5],
    [-1.0, 49.5], [1.5, 50.5], [3.5, 51.5], [5.0, 53.5], [8.5, 55.0], [8.0, 57.5], [10.5, 57.5],
    [10.0, 54.5], [14.0, 54.0], [18.0, 54.5], [20.5, 55.0], [22.0, 57.0], [24.0, 58.0], [27.0, 60.0],
    [30.0, 60.0], [33.0, 65.0], [37.0, 67.0], [42.0, 66.0], [50.0, 68.0], [58.0, 69.0], [68.0, 72.0],
    [75.0, 71.5], [80.0, 73.0], [90.0, 74.0], [105.0, 77.5], [115.0, 76.0], [125.0, 73.0], [140.0, 72.0],
    [155.0, 71.0], [170.0, 69.0], [180.0, 66.0], [172.0, 64.5], [162.0, 61.0], [156.0, 55.0], [157.0, 51.0],
    [150.0, 47.0], [142.0, 47.0], [140.0, 51.0], [136.0, 48.0], [132.0, 43.0], [130.0, 38.0], [128.0, 35.0],
    [126.0, 37.5], [125.0, 39.5], [122.0, 39.0], [119.0, 35.0], [121.0, 31.5], [120.0, 27.0], [116.0, 23.5],
    [113.0, 22.0], [109.0, 21.5], [107.0, 17.0], [109.0, 13.0], [108.0, 10.5], [104.0, 10.5], [101.0, 7.0],
    [103.8, 1.3], [101.0, 3.0], [99.0, 7.5], [98.0, 12.0], [96.0, 16.5], [92.5, 20.5], [89.0, 22.0],
    [85.0, 20.0], [80.0, 16.0], [80.0, 10.0], [77.5, 8.2], [74.0, 15.0], [70.0, 21.0], [67.0, 24.5],
    [62.0, 25.0], [58.5, 24.0], [56.5, 26.0], [55.0, 25.0], [50.0, 28.0], [48.0, 30.0], [49.5, 31.0],
    [52.0, 26.5], [55.0, 22.0], [58.0, 21.0], [53.5, 17.0], [49.0, 14.5], [45.0, 13.0], [43.5, 12.5],
    [42.5, 15.0], [38.5, 22.0], [35.0, 27.5], [34.0, 29.5], [34.5, 31.5], [36.0, 35.5], [35.0, 36.5],
    [32.0, 36.5], [29.0, 36.5], [27.0, 37.5], [26.0, 40.5], [28.5, 41.5], [31.5, 41.5], [37.0, 42.0],
    [41.5, 41.5], [40.0, 44.0], [37.0, 45.5], [33.5, 45.0], [30.0, 46.5], [28.0, 45.0], [28.0, 42.0],
    [26.0, 40.0], [24.0, 38.0], [23.5, 36.5], [22.0, 38.0], [20.0, 39.5], [19.0, 42.0], [16.0, 41.0],
    [16.0, 38.5], [15.5, 41.0], [13.0, 43.0], [12.0, 45.0], [13.5, 45.5], [10.0, 44.0], [8.0, 43.5],
    [5.0, 43.0], [3.0, 42.0], [0.5, 40.5], [-0.5, 38.0], [-2.0, 36.5], [-5.5, 36.0], [-9.5, 37.0],
  ],
  // Scandinavia & Baltic (Norway, Sweden, Finland)
  [
    [5.0, 58.5], [6.0, 62.0], [9.0, 64.0], [12.0, 66.0], [15.0, 68.5], [19.0, 70.0], [26.0, 71.0],
    [31.0, 70.5], [29.0, 67.0], [25.0, 65.0], [22.0, 63.5], [18.0, 60.5], [18.5, 59.5], [16.5, 56.5],
    [13.0, 55.5], [12.0, 58.0], [10.5, 59.5], [8.0, 58.5], [5.0, 58.5],
  ],
  // United Kingdom & Ireland
  [
    [-5.5, 50.0], [-3.0, 50.5], [1.0, 51.2], [1.5, 52.5], [0.0, 53.5], [-1.0, 55.5], [-2.0, 57.5],
    [-3.5, 58.5], [-5.0, 58.5], [-6.0, 56.5], [-4.5, 54.5], [-3.0, 53.5], [-5.0, 51.5], [-5.5, 50.0],
  ],
  // Ireland
  [
    [-6.0, 53.0], [-6.0, 55.0], [-8.5, 55.0], [-10.5, 54.0], [-10.0, 52.0], [-8.0, 51.5], [-6.0, 53.0],
  ],
  // Africa
  [
    [-5.5, 36.0], [-1.0, 35.5], [4.0, 36.8], [10.5, 37.0], [11.0, 33.0], [15.0, 32.5], [20.0, 32.0],
    [25.0, 31.5], [31.5, 31.5], [34.0, 27.5], [38.0, 22.0], [42.5, 14.5], [45.0, 12.0], [51.0, 11.5],
    [50.0, 8.0], [46.0, 4.0], [41.0, -1.0], [39.0, -5.0], [40.5, -11.0], [36.0, -17.0], [34.0, -24.0],
    [32.5, -28.0], [28.0, -32.5], [26.0, -34.0], [20.0, -34.8], [18.0, -34.0], [15.0, -28.0], [12.0, -20.0],
    [12.5, -12.0], [12.0, -6.0], [9.0, 0.0], [9.0, 4.0], [5.0, 4.5], [2.0, 6.0], [-3.0, 5.0],
    [-7.5, 4.5], [-12.0, 6.5], [-15.0, 11.0], [-17.5, 14.5], [-16.5, 19.0], [-13.0, 27.0], [-10.0, 30.0],
    [-6.0, 35.0], [-5.5, 36.0],
  ],
  // Australia & Tasmania
  [
    [114.0, -21.8], [118.0, -20.0], [123.0, -16.5], [130.0, -12.0], [136.0, -12.0], [137.0, -16.5],
    [142.0, -11.0], [145.0, -15.0], [148.0, -20.0], [152.0, -25.0], [153.5, -28.5], [151.0, -33.8],
    [150.0, -37.5], [146.0, -39.0], [140.0, -38.0], [136.0, -35.0], [130.0, -32.0], [125.0, -33.0],
    [118.0, -35.0], [115.0, -34.0], [115.5, -28.0], [113.0, -25.0], [114.0, -21.8],
  ],
  // Japan (Honshu, Hokkaido, Kyushu)
  [
    [131.0, 31.5], [133.0, 33.5], [135.5, 34.5], [139.0, 35.0], [141.0, 37.0], [141.5, 41.5],
    [145.5, 44.0], [142.0, 45.5], [140.5, 42.0], [138.5, 37.5], [136.5, 36.5], [133.0, 35.5],
    [130.5, 33.5], [130.5, 31.5], [131.0, 31.5],
  ],
  // Greenland
  [
    [-44.0, 60.0], [-35.0, 65.5], [-24.0, 70.5], [-19.0, 77.0], [-22.0, 81.5], [-40.0, 83.5],
    [-55.0, 82.0], [-60.0, 77.0], [-55.0, 71.0], [-50.0, 64.0], [-44.0, 60.0],
  ],
  // Madagascar
  [
    [49.5, -12.5], [50.5, -15.5], [48.5, -22.5], [47.0, -25.5], [44.5, -25.0], [43.5, -22.0],
    [44.5, -16.0], [47.0, -13.5], [49.5, -12.5],
  ],
  // New Zealand (North & South Islands)
  [
    [173.0, -35.0], [176.0, -38.0], [178.5, -38.0], [175.5, -41.5], [172.5, -41.0], [174.0, -36.5],
    [173.0, -35.0],
  ],
  [
    [173.5, -41.5], [174.0, -44.0], [170.5, -46.0], [167.0, -46.5], [168.0, -44.0], [171.0, -42.0],
    [173.5, -41.5],
  ],
  // Indonesia (Sumatra, Java, Borneo, Sulawesi)
  [
    [95.5, 5.5], [99.0, 2.5], [103.5, -1.5], [106.0, -5.5], [104.0, -5.0], [100.0, -1.0], [96.0, 4.0], [95.5, 5.5],
  ],
  [
    [106.0, -6.0], [110.0, -7.0], [114.5, -8.0], [113.0, -8.5], [107.0, -7.5], [106.0, -6.0],
  ],
  [
    [109.5, 1.0], [114.0, 4.5], [118.0, 4.5], [117.5, -3.5], [112.5, -3.5], [109.5, -1.0], [109.5, 1.0],
  ],
  // Philippines
  [
    [121.0, 18.5], [122.5, 16.5], [124.0, 13.0], [126.0, 8.0], [124.5, 6.0], [122.0, 7.5],
    [121.0, 10.0], [120.0, 15.0], [121.0, 18.5],
  ],
  // Sri Lanka
  [
    [80.0, 9.8], [81.8, 8.5], [81.9, 7.0], [80.5, 5.9], [79.8, 6.9], [79.8, 8.5], [80.0, 9.8],
  ],
  // Taiwan
  [
    [121.5, 25.3], [122.0, 24.5], [121.5, 22.0], [120.7, 21.9], [120.1, 23.2], [120.5, 24.5], [121.5, 25.3],
  ],
  // Iceland
  [
    [-24.0, 65.5], [-21.5, 66.5], [-14.5, 66.5], [-13.5, 65.0], [-15.0, 64.2], [-19.0, 63.4], [-22.5, 63.8], [-24.5, 64.8], [-24.0, 65.5],
  ],
  // Mediterranean Major Islands: Sicily, Sardinia, Corsica, Crete, Cyprus
  [
    [12.5, 38.0], [15.6, 38.3], [15.3, 37.0], [14.0, 36.6], [12.5, 37.6], [12.5, 38.0],
  ],
  [
    [8.2, 41.2], [9.7, 41.0], [9.6, 39.2], [8.5, 38.9], [8.4, 40.5], [8.2, 41.2],
  ],
  [
    [8.6, 43.0], [9.5, 42.9], [9.4, 41.5], [8.6, 41.6], [8.6, 43.0],
  ],
  [
    [23.6, 35.5], [26.2, 35.2], [25.7, 34.9], [23.6, 35.2], [23.6, 35.5],
  ],
  [
    [32.3, 35.1], [34.5, 35.6], [34.0, 34.9], [32.8, 34.6], [32.3, 35.1],
  ],
];

// Major International Country Borders [lon, lat][] vectors for clear geopolitical division
export const COUNTRY_BORDER_LINES: [number, number][][] = [
  // USA - Canada Border (49th Parallel and Great Lakes)
  [
    [-123.0, 49.0], [-117.0, 49.0], [-110.0, 49.0], [-104.0, 49.0], [-95.0, 49.0],
    [-89.5, 48.0], [-84.5, 46.5], [-82.5, 43.0], [-79.0, 43.5], [-76.5, 44.5],
    [-71.5, 45.0], [-67.5, 45.0], [-67.0, 44.5],
  ],
  // USA - Mexico Border
  [
    [-117.1, 32.5], [-114.8, 32.5], [-111.0, 31.3], [-108.2, 31.8], [-106.5, 31.8],
    [-103.5, 29.0], [-100.5, 28.0], [-99.5, 26.5], [-97.5, 26.0],
  ],
  // Mexico - Guatemala - Belize
  [
    [-92.2, 14.5], [-91.5, 15.5], [-90.5, 16.0], [-89.2, 16.0], [-89.2, 17.8], [-88.3, 18.5],
  ],
  // Colombia - Panama
  [
    [-77.5, 7.5], [-77.7, 8.5],
  ],
  // Colombia - Venezuela
  [
    [-72.0, 11.8], [-72.5, 9.5], [-72.0, 7.0], [-67.5, 6.0], [-67.0, 2.0],
  ],
  // Brazil - Venezuela - Guyana
  [
    [-67.0, 2.0], [-64.0, 4.0], [-60.0, 5.0], [-57.0, 3.5],
  ],
  // Brazil - Peru - Bolivia
  [
    [-70.0, -4.5], [-73.5, -8.0], [-70.5, -10.5], [-68.5, -11.0], [-65.0, -10.0],
    [-65.0, -12.5], [-60.0, -16.5], [-58.0, -18.0],
  ],
  // Chile - Argentina (Andean Border)
  [
    [-68.5, -22.0], [-67.0, -24.0], [-69.0, -28.0], [-70.0, -32.0], [-70.5, -36.0],
    [-71.5, -42.0], [-72.0, -46.0], [-73.0, -50.0], [-68.5, -54.8],
  ],
  // Argentina - Brazil - Paraguay - Uruguay
  [
    [-58.0, -18.0], [-57.5, -22.0], [-54.5, -25.5], [-54.0, -28.0], [-57.5, -30.0],
    [-58.5, -34.0], [-53.5, -34.0],
  ],
  // Portugal - Spain
  [
    [-8.8, 42.0], [-6.5, 41.5], [-6.8, 39.5], [-7.5, 37.2],
  ],
  // Spain - France (Pyrenees)
  [
    [-1.8, 43.4], [0.5, 42.8], [3.1, 42.5],
  ],
  // France - Germany - Benelux - Switzerland - Italy
  [
    [2.5, 51.0], [6.0, 50.0], [7.5, 49.0], [7.5, 47.5], [6.8, 46.0], [7.0, 44.0], [7.5, 43.8],
  ],
  // Germany - Poland - Czechia - Austria
  [
    [14.2, 53.8], [14.8, 52.0], [15.0, 50.8], [13.0, 50.3], [12.0, 47.5],
  ],
  // Poland - Ukraine - Belarus
  [
    [23.5, 52.0], [24.0, 50.5], [22.5, 49.0],
  ],
  // Italy - Switzerland - Austria - Slovenia
  [
    [7.0, 46.0], [9.5, 46.5], [12.5, 46.8], [13.8, 46.0], [13.8, 45.6],
  ],
  // Norway - Sweden - Finland
  [
    [12.0, 59.0], [13.0, 62.0], [15.0, 65.0], [21.0, 68.5], [26.0, 69.5],
  ],
  // Finland - Russia
  [
    [27.5, 60.5], [30.0, 62.0], [29.5, 66.0], [30.0, 69.5],
  ],
  // Russia - Ukraine
  [
    [32.0, 52.0], [35.0, 50.5], [38.0, 49.5], [38.5, 47.0],
  ],
  // Egypt - Libya - Sudan
  [
    [25.0, 31.5], [25.0, 22.0], [36.0, 22.0],
  ],
  // North Africa: Algeria, Morocco, Mauritania, Mali, Niger
  [
    [-2.0, 35.0], [-5.0, 32.0], [-8.5, 27.5], [-12.0, 27.5],
  ],
  [
    [8.0, 37.0], [8.0, 30.0], [12.0, 23.5], [19.0, 20.0],
  ],
  // Nigeria - Cameroon - Chad - Niger
  [
    [3.5, 6.5], [3.5, 12.0], [13.5, 13.0], [9.0, 4.5],
  ],
  // South Africa - Namibia - Botswana - Zimbabwe - Mozambique
  [
    [16.5, -28.5], [20.0, -27.0], [20.0, -22.0], [27.0, -22.0], [32.0, -22.0], [32.0, -26.5],
  ],
  // Saudi Arabia - Yemen - Oman - UAE
  [
    [43.0, 16.5], [52.0, 17.5], [55.0, 20.0], [55.0, 24.5],
  ],
  // Iraq - Syria - Jordan - Saudi Arabia
  [
    [36.0, 32.0], [39.0, 32.5], [42.0, 31.0], [47.0, 29.5],
  ],
  // Turkey - Iran - Iraq
  [
    [44.0, 37.0], [45.0, 35.0], [48.0, 30.0],
  ],
  // India - Pakistan
  [
    [68.5, 23.5], [71.0, 26.5], [74.5, 31.5], [74.0, 35.0],
  ],
  // India - China (Himalayas)
  [
    [78.0, 33.0], [81.0, 30.5], [88.5, 27.5], [92.0, 28.0], [97.0, 28.5],
  ],
  // India - Bangladesh
  [
    [89.0, 22.0], [89.0, 26.0], [92.0, 24.0], [92.5, 21.0],
  ],
  // China - Russia - Mongolia
  [
    [88.0, 49.0], [95.0, 50.0], [105.0, 50.0], [115.0, 50.0], [120.0, 53.0], [130.0, 50.0], [135.0, 48.0],
  ],
  // China - Vietnam - Laos - Myanmar
  [
    [108.0, 21.5], [104.0, 22.5], [100.5, 21.5], [98.0, 24.0],
  ],
  // Thailand - Malaysia
  [
    [100.0, 6.5], [102.0, 6.0],
  ],
  // North Korea - South Korea (38th Parallel / DMZ)
  [
    [126.0, 38.0], [128.5, 38.3],
  ],
  // Netherlands - Belgium - France
  [
    [3.3, 51.3], [4.5, 51.4], [5.9, 51.0], [6.0, 50.7], [5.7, 49.5], [2.5, 51.0],
  ],
  // Poland - Germany (Oder-Neisse Line)
  [
    [14.3, 53.9], [14.4, 52.5], [14.8, 51.8], [15.0, 50.9],
  ],
  // Greece - Turkey - Aegean Sea
  [
    [26.3, 41.7], [26.6, 40.8], [26.2, 39.5], [27.2, 37.0], [27.8, 36.5],
  ],
  // Romania - Ukraine - Moldova
  [
    [29.6, 45.3], [28.2, 45.4], [28.2, 48.0], [26.0, 48.2],
  ],
  // Malaysia - Indonesia (Borneo / Kalimantan)
  [
    [109.6, 2.0], [112.0, 1.2], [115.5, 3.8], [117.5, 4.2],
  ],
  // Vietnam - Cambodia - Laos
  [
    [104.5, 10.5], [106.0, 11.5], [107.5, 14.5], [102.0, 22.0],
  ],
  // Egypt - Israel - Jordan
  [
    [34.2, 31.3], [34.9, 29.5], [35.5, 31.0], [35.6, 32.5],
  ],
  // UK Internal Demarcation: England - Scotland & England - Wales
  [
    [-3.3, 55.0], [-2.8, 55.3], [-2.0, 55.8],
  ],
  [
    [-3.0, 51.5], [-3.1, 52.4], [-3.0, 53.3],
  ],
  // Ireland - Northern Ireland border
  [
    [-8.2, 54.5], [-7.5, 54.0], [-7.0, 54.2], [-6.2, 54.1],
  ],
  // France - Switzerland - Italy (Alpine Arc)
  [
    [6.0, 46.2], [6.8, 46.4], [7.5, 46.0], [8.5, 46.0], [10.5, 46.8], [12.0, 47.0],
  ],
  // Czechia - Slovakia - Poland
  [
    [15.0, 50.8], [17.5, 50.3], [19.0, 49.5], [22.5, 49.0],
  ],
  // Austria - Hungary - Slovenia - Croatia
  [
    [13.8, 46.5], [16.5, 46.8], [17.0, 46.0], [14.0, 45.4], [13.6, 45.5],
  ],
  // Baltic States: Estonia - Latvia - Lithuania
  [
    [24.5, 58.0], [26.0, 57.8], [27.8, 57.5],
  ],
  [
    [21.0, 56.0], [24.0, 56.4], [26.5, 55.8],
  ],
  // Balkans & Greece: Serbia, Bosnia, Montenegro, Albania, North Macedonia, Greece, Bulgaria
  [
    [19.0, 42.5], [20.5, 42.0], [20.8, 40.0], [20.0, 39.7],
  ],
  [
    [21.0, 41.0], [23.0, 41.3], [26.0, 41.7],
  ],
  // Turkey - Syria - Iraq
  [
    [36.0, 36.5], [38.5, 36.8], [42.3, 37.3], [44.8, 37.1],
  ],
  // Iran - Pakistan - Afghanistan
  [
    [61.5, 25.0], [61.8, 28.5], [60.8, 31.5], [60.5, 34.0],
  ],
  // Pakistan - India (Western Border & Rann of Kutch)
  [
    [68.5, 23.5], [71.0, 24.5], [71.5, 27.5], [74.5, 31.5], [74.8, 34.5],
  ],
  // India - Nepal & Bhutan (Himalayan Boundary)
  [
    [80.1, 28.8], [84.0, 27.5], [88.1, 26.8],
  ],
  [
    [89.0, 27.3], [91.5, 27.3],
  ],
  // China - North Korea (Yalu River boundary)
  [
    [124.3, 39.8], [126.0, 41.0], [128.5, 42.0], [130.6, 42.4],
  ],
  // Myanmar - Thailand
  [
    [98.5, 10.0], [99.0, 14.5], [98.5, 16.5], [97.5, 18.5], [100.0, 20.5],
  ],
  // Thailand - Cambodia
  [
    [102.5, 12.0], [103.0, 14.0], [105.0, 14.3],
  ],
  // Colombia - Ecuador - Peru
  [
    [-79.0, 1.2], [-76.0, 0.0], [-75.0, -2.5], [-70.0, -4.5],
  ],
  // Peru - Chile
  [
    [-70.3, -18.3], [-69.5, -17.5],
  ],
  // Bolivia - Paraguay - Argentina
  [
    [-62.5, -22.0], [-60.5, -21.0], [-58.0, -22.5], [-58.5, -26.0],
  ],
  // Canada - Alaska (141st Meridian)
  [
    [-141.0, 60.0], [-141.0, 69.6],
  ],
  // Kenya - Tanzania - Mozambique
  [
    [39.2, -4.7], [37.5, -3.0], [35.0, -1.0],
  ],
  [
    [40.4, -10.5], [38.0, -11.5], [35.0, -12.0],
  ],
  // Australia - Papua New Guinea (Torres Strait Boundary)
  [
    [141.0, -9.1], [142.5, -9.2], [144.0, -9.5],
  ],
  // Cuba & Caribbean Archipelagos
  [
    [-84.9, 21.8], [-82.5, 23.1], [-79.0, 22.5], [-74.2, 20.2], [-77.0, 19.8], [-84.9, 21.8],
  ],
  // Hispaniola (Haiti - Dominican Republic)
  [
    [-71.7, 19.9], [-71.9, 18.8], [-71.7, 18.0],
  ],
];

// Major nautical chokepoint and strait labels
export interface MaritimeChokepoint {
  name: string;
  category: 'CANAL' | 'STRAIT' | 'PASSAGE';
  lat: number;
  lon: number;
}

export const MARITIME_CHOKEPOINTS: MaritimeChokepoint[] = [
  { name: 'DOVER TSS / ENGLISH CHANNEL', category: 'STRAIT', lat: 51.05, lon: 1.4 },
  { name: 'STRAIT OF GIBRALTAR', category: 'STRAIT', lat: 35.95, lon: -5.6 },
  { name: 'SUEZ CANAL', category: 'CANAL', lat: 30.6, lon: 32.3 },
  { name: 'BAB-EL-MANDEB', category: 'STRAIT', lat: 12.6, lon: 43.3 },
  { name: 'STRAIT OF HORMUZ', category: 'STRAIT', lat: 26.5, lon: 56.4 },
  { name: 'MALACCA STRAIT', category: 'STRAIT', lat: 3.2, lon: 101.0 },
  { name: 'SINGAPORE STRAIT', category: 'STRAIT', lat: 1.25, lon: 103.8 },
  { name: 'PANAMA CANAL', category: 'CANAL', lat: 9.1, lon: -79.7 },
  { name: 'BOSPHORUS STRAIT', category: 'STRAIT', lat: 41.1, lon: 29.1 },
  { name: 'TAIWAN STRAIT', category: 'STRAIT', lat: 24.2, lon: 119.5 },
  { name: 'DANISH STRAITS / SKAGERRAK', category: 'STRAIT', lat: 57.5, lon: 10.5 },
  { name: 'STRAIT OF MAGELLAN', category: 'STRAIT', lat: -53.2, lon: -71.0 },
];

// Major geopolitical labels rendered on detailed nautical map
export const MAJOR_COUNTRY_LABELS = [
  { name: 'UNITED STATES', code: 'USA', lat: 39.5, lon: -98.5 },
  { name: 'CANADA', code: 'CAN', lat: 56.0, lon: -106.0 },
  { name: 'MEXICO', code: 'MEX', lat: 23.5, lon: -102.5 },
  { name: 'BRAZIL', code: 'BRA', lat: -12.0, lon: -51.0 },
  { name: 'ARGENTINA', code: 'ARG', lat: -35.0, lon: -65.0 },
  { name: 'CHILE', code: 'CHL', lat: -33.0, lon: -71.0 },
  { name: 'UNITED KINGDOM', code: 'GBR', lat: 54.0, lon: -2.5 },
  { name: 'FRANCE', code: 'FRA', lat: 46.5, lon: 2.5 },
  { name: 'GERMANY', code: 'DEU', lat: 51.0, lon: 10.0 },
  { name: 'NETHERLANDS', code: 'NLD', lat: 52.2, lon: 5.3 },
  { name: 'SPAIN', code: 'ESP', lat: 40.0, lon: -3.5 },
  { name: 'ITALY', code: 'ITA', lat: 42.5, lon: 12.5 },
  { name: 'NORWAY', code: 'NOR', lat: 62.0, lon: 9.0 },
  { name: 'SWEDEN', code: 'SWE', lat: 62.0, lon: 15.0 },
  { name: 'FINLAND', code: 'FIN', lat: 64.0, lon: 26.0 },
  { name: 'RUSSIA', code: 'RUS', lat: 60.0, lon: 90.0 },
  { name: 'CHINA', code: 'CHN', lat: 35.0, lon: 104.0 },
  { name: 'INDIA', code: 'IND', lat: 21.0, lon: 78.0 },
  { name: 'JAPAN', code: 'JPN', lat: 36.5, lon: 138.0 },
  { name: 'SOUTH KOREA', code: 'KOR', lat: 36.0, lon: 128.0 },
  { name: 'AUSTRALIA', code: 'AUS', lat: -25.0, lon: 134.0 },
  { name: 'NEW ZEALAND', code: 'NZL', lat: -41.0, lon: 174.0 },
  { name: 'INDONESIA', code: 'IDN', lat: -1.0, lon: 118.0 },
  { name: 'MALAYSIA', code: 'MYS', lat: 3.5, lon: 102.5 },
  { name: 'SINGAPORE', code: 'SGP', lat: 1.35, lon: 103.8 },
  { name: 'PHILIPPINES', code: 'PHL', lat: 13.0, lon: 122.0 },
  { name: 'SAUDI ARABIA', code: 'SAU', lat: 24.0, lon: 45.0 },
  { name: 'UAE', code: 'ARE', lat: 24.0, lon: 54.0 },
  { name: 'EGYPT', code: 'EGY', lat: 26.5, lon: 30.0 },
  { name: 'SOUTH AFRICA', code: 'ZAF', lat: -29.0, lon: 25.0 },
  { name: 'NIGERIA', code: 'NGA', lat: 9.5, lon: 8.0 },
  { name: 'TURKEY', code: 'TUR', lat: 39.0, lon: 35.0 },
  { name: 'PANAMA', code: 'PAN', lat: 8.5, lon: -80.0 },
  { name: 'GREECE', code: 'GRC', lat: 39.0, lon: 22.0 },
  { name: 'POLAND', code: 'POL', lat: 52.0, lon: 19.5 },
  { name: 'UKRAINE', code: 'UKR', lat: 49.0, lon: 31.5 },
  { name: 'PORTUGAL', code: 'PRT', lat: 39.5, lon: -8.0 },
  { name: 'DENMARK', code: 'DNK', lat: 56.0, lon: 9.5 },
  { name: 'IRELAND', code: 'IRL', lat: 53.4, lon: -8.0 },
  { name: 'SWITZERLAND', code: 'CHE', lat: 46.8, lon: 8.2 },
  { name: 'IRAN', code: 'IRN', lat: 32.0, lon: 53.5 },
  { name: 'IRAQ', code: 'IRQ', lat: 33.0, lon: 44.0 },
  { name: 'PAKISTAN', code: 'PAK', lat: 30.0, lon: 70.0 },
  { name: 'BANGLADESH', code: 'BGD', lat: 23.7, lon: 90.3 },
  { name: 'VIETNAM', code: 'VNM', lat: 16.0, lon: 108.0 },
  { name: 'THAILAND', code: 'THA', lat: 15.0, lon: 101.0 },
  { name: 'COLOMBIA', code: 'COL', lat: 4.5, lon: -73.0 },
  { name: 'PERU', code: 'PER', lat: -9.5, lon: -75.0 },
  { name: 'MOROCCO', code: 'MAR', lat: 32.0, lon: -6.0 },
  { name: 'ALGERIA', code: 'DZA', lat: 28.0, lon: 3.0 },
  { name: 'KENYA', code: 'KEN', lat: 0.5, lon: 38.0 },
  { name: 'TAIWAN', code: 'TWN', lat: 23.7, lon: 121.0 },
  { name: 'SRI LANKA', code: 'LKA', lat: 7.8, lon: 80.7 },
  { name: 'ICELAND', code: 'ISL', lat: 64.9, lon: -18.5 },
];

