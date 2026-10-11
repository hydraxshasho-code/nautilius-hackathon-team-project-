import { Vessel, RiskLevel } from '../types/maritime';

export interface RiskFactorScore {
  score: number; // 0 - 100
  weight: number; // percentage
  status: 'OPTIMAL' | 'ELEVATED' | 'HIGH_RISK' | 'CRITICAL';
  evidence: string[];
}

export interface ComprehensiveRiskAssessment {
  overallScore: number; // 0 - 100
  overallLevel: RiskLevel;
  factors: {
    ais: RiskFactorScore;
    vesselIdentity: RiskFactorScore;
    ownership: RiskFactorScore;
    documents: RiskFactorScore;
    sanctions: RiskFactorScore;
    voyage: RiskFactorScore;
    route: RiskFactorScore;
    weather: RiskFactorScore;
    historicalBehaviour: RiskFactorScore;
  };
  lastEvaluatedAt: string;
}

// Factor weights summing to 1.0 (100%)
export const FACTOR_WEIGHTS = {
  ais: 0.12,
  vesselIdentity: 0.10,
  ownership: 0.14,
  documents: 0.10,
  sanctions: 0.20,
  voyage: 0.10,
  route: 0.08,
  weather: 0.06,
  historicalBehaviour: 0.10,
};

class RiskEngineService {
  /**
   * Calculates comprehensive risk score based on the 9 defined dimensions:
   * A) AIS
   * B) Vessel Identity
   * C) Ownership
   * D) Documents
   * E) Sanctions
   * F) Voyage
   * G) Route
   * H) Weather
   * I) Historical Behaviour
   */
  public evaluateVessel(vessel: Vessel): ComprehensiveRiskAssessment {
    // 1. AIS Factor (transponder continuity, spoofing indicators, dead reckoning drift)
    let aisScore = 10;
    const aisEvidence: string[] = [];
    if (vessel.isStale || !vessel.isTransmitting) {
      aisScore += 45;
      aisEvidence.push('Transponder signal stale or non-transmitting');
    }
    if (vessel.dataQuality === 'DEGRADED' || vessel.dataQuality === 'INTERPOLATED') {
      aisScore += 25;
      aisEvidence.push(`Data transmission quality is ${vessel.dataQuality}`);
    }
    if (vessel.anomaliesDetected > 0) {
      aisScore += Math.min(30, vessel.anomaliesDetected * 10);
      aisEvidence.push(`${vessel.anomaliesDetected} active telemetry anomalies registered`);
    }
    aisScore = Math.min(100, Math.max(5, aisScore));

    // 2. Vessel Identity Factor (IMO validity, registry flags, age, callsign)
    let identityScore = 12;
    const identityEvidence: string[] = [];
    const highRiskFlags = ['Iran', 'Russia', 'North Korea', 'Syria', 'Comoros', 'Palau', 'Togo'];
    if (highRiskFlags.includes(vessel.flag)) {
      identityScore += 50;
      identityEvidence.push(`Flag state ${vessel.flag} is designated high regulatory oversight`);
    }
    if (vessel.yearBuilt && new Date().getFullYear() - vessel.yearBuilt > 20) {
      identityScore += 20;
      identityEvidence.push(`Vessel hull age exceeds 20 years (Built ${vessel.yearBuilt})`);
    }
    identityScore = Math.min(100, Math.max(5, identityScore));

    // 3. Ownership Factor (Beneficial ownership KYC, corporate opacity)
    let ownershipScore = 15;
    const ownershipEvidence: string[] = [];
    if (vessel.kycStatus === 'Expired' || vessel.kycStatus === 'Rejected') {
      ownershipScore += 65;
      ownershipEvidence.push(`Beneficial ownership KYC status is ${vessel.kycStatus.toUpperCase()}`);
    } else if (vessel.kycStatus === 'Under Review' || vessel.kycStatus === 'Pending') {
      ownershipScore += 25;
      ownershipEvidence.push(`KYC documentation is currently ${vessel.kycStatus}`);
    } else {
      ownershipEvidence.push('Verified beneficial ownership hierarchy');
    }
    ownershipScore = Math.min(100, Math.max(5, ownershipScore));

    // 4. Documents Factor (Classification, statutory certificates)
    let documentsScore = 10;
    const docsEvidence: string[] = [];
    if (!vessel.classificationSociety || vessel.classificationSociety === 'Uncertified') {
      documentsScore += 60;
      docsEvidence.push('Missing IACS recognized classification survey');
    } else {
      docsEvidence.push(`Classification validated by ${vessel.classificationSociety}`);
    }
    documentsScore = Math.min(100, Math.max(5, documentsScore));

    // 5. Sanctions Factor (OFAC, EU, UN, UK maritime lists)
    let sanctionsScore = 10;
    const sanctionsEvidence: string[] = [];
    if (vessel.amlStatus === 'Confirmed Match') {
      sanctionsScore = 95;
      sanctionsEvidence.push('Confirmed SDN / Designated Entities sanctions listing');
    } else if (vessel.amlStatus === 'Potential Match') {
      sanctionsScore = 65;
      sanctionsEvidence.push('Potential PEP or adverse sanctions media match under review');
    } else {
      sanctionsEvidence.push('Sanctions watchlist screening clear');
    }

    // 6. Voyage Factor (Schedules, ETA precision, port dwell times)
    let voyageScore = 12;
    const voyageEvidence: string[] = [];
    if (!vessel.destination || vessel.destination === 'FOR ORDERS') {
      voyageScore += 30;
      voyageEvidence.push('Undisclosed destination / "FOR ORDERS" designation');
    }
    if (vessel.speed < 2.0 && vessel.navStatus === 'Under way using engine') {
      voyageScore += 20;
      voyageEvidence.push('Unexplained open sea loitering / anomalous slow steaming');
    }
    voyageScore = Math.min(100, Math.max(5, voyageScore));

    // 7. Route Factor (Chokepoint transit, war hazard zones)
    let routeScore = 15;
    const routeEvidence: string[] = [];
    // Red Sea / Bab-el-Mandeb / Black Sea route checks
    if (vessel.lat > 11.5 && vessel.lat < 15.5 && vessel.lon > 41.5 && vessel.lon < 44.5) {
      routeScore += 55;
      routeEvidence.push('Transiting Bab-el-Mandeb High Risk War Exclusion Area');
    } else if (vessel.lat > 41.0 && vessel.lat < 47.0 && vessel.lon > 28.0 && vessel.lon < 42.0) {
      routeScore += 50;
      routeEvidence.push('Transiting Black Sea Maritime War Risk Zone');
    } else if (vessel.lat > 24.0 && vessel.lat < 27.0 && vessel.lon > 54.0 && vessel.lon < 57.0) {
      routeScore += 30;
      routeEvidence.push('Transiting Strait of Hormuz chokepoint corridor');
    }
    routeScore = Math.min(100, Math.max(5, routeScore));

    // 8. Weather Factor (Tropical cyclones, severe gales, wave heights)
    let weatherScore = 8;
    const weatherEvidence: string[] = [];
    // Example: Bay of Bengal Cyclone proximity
    if (vessel.lat > 10.0 && vessel.lat < 18.0 && vessel.lon > 82.0 && vessel.lon < 92.0) {
      weatherScore += 45;
      weatherEvidence.push('Proximity to Severe Cyclone Gale Warning in Bay of Bengal');
    } else {
      weatherEvidence.push('Sea state and barometric pressure nominal');
    }
    weatherScore = Math.min(100, Math.max(5, weatherScore));

    // 9. Historical Behaviour Factor (Dark activity history, AIS gaps, STS transfers)
    let historyScore = 10;
    const historyEvidence: string[] = [];
    if (vessel.riskEvidence && vessel.riskEvidence.some((e) => e.toLowerCase().includes('dark') || e.toLowerCase().includes('sts'))) {
      historyScore += 55;
      historyEvidence.push('Historical record contains unverified dark STS or loitering events');
    } else {
      historyEvidence.push('No historical AIS tampering or deceptive shipping patterns logged');
    }
    historyScore = Math.min(100, Math.max(5, historyScore));

    // Calculate weighted aggregate score
    const weightedAggregate = Math.round(
      aisScore * FACTOR_WEIGHTS.ais +
      identityScore * FACTOR_WEIGHTS.vesselIdentity +
      ownershipScore * FACTOR_WEIGHTS.ownership +
      documentsScore * FACTOR_WEIGHTS.documents +
      sanctionsScore * FACTOR_WEIGHTS.sanctions +
      voyageScore * FACTOR_WEIGHTS.voyage +
      routeScore * FACTOR_WEIGHTS.route +
      weatherScore * FACTOR_WEIGHTS.weather +
      historyScore * FACTOR_WEIGHTS.historicalBehaviour
    );

    const getStatus = (s: number): 'OPTIMAL' | 'ELEVATED' | 'HIGH_RISK' | 'CRITICAL' => {
      if (s >= 75) return 'CRITICAL';
      if (s >= 50) return 'HIGH_RISK';
      if (s >= 30) return 'ELEVATED';
      return 'OPTIMAL';
    };

    let overallLevel: RiskLevel = 'LOW';
    if (weightedAggregate >= 75) overallLevel = 'CRITICAL';
    else if (weightedAggregate >= 50) overallLevel = 'HIGH';
    else if (weightedAggregate >= 25) overallLevel = 'MEDIUM';

    return {
      overallScore: weightedAggregate,
      overallLevel,
      factors: {
        ais: { score: aisScore, weight: FACTOR_WEIGHTS.ais, status: getStatus(aisScore), evidence: aisEvidence },
        vesselIdentity: { score: identityScore, weight: FACTOR_WEIGHTS.vesselIdentity, status: getStatus(identityScore), evidence: identityEvidence },
        ownership: { score: ownershipScore, weight: FACTOR_WEIGHTS.ownership, status: getStatus(ownershipScore), evidence: ownershipEvidence },
        documents: { score: documentsScore, weight: FACTOR_WEIGHTS.documents, status: getStatus(documentsScore), evidence: docsEvidence },
        sanctions: { score: sanctionsScore, weight: FACTOR_WEIGHTS.sanctions, status: getStatus(sanctionsScore), evidence: sanctionsEvidence },
        voyage: { score: voyageScore, weight: FACTOR_WEIGHTS.voyage, status: getStatus(voyageScore), evidence: voyageEvidence },
        route: { score: routeScore, weight: FACTOR_WEIGHTS.route, status: getStatus(routeScore), evidence: routeEvidence },
        weather: { score: weatherScore, weight: FACTOR_WEIGHTS.weather, status: getStatus(weatherScore), evidence: weatherEvidence },
        historicalBehaviour: { score: historyScore, weight: FACTOR_WEIGHTS.historicalBehaviour, status: getStatus(historyScore), evidence: historyEvidence },
      },
      lastEvaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Synchronizes vessel object riskBreakdown with the 9-factor model
   */
  public updateVesselRiskFields(vessel: Vessel): Vessel {
    const assessment = this.evaluateVessel(vessel);
    vessel.riskScore = assessment.overallScore;
    vessel.riskLevel = assessment.overallLevel;
    vessel.riskBreakdown = {
      vesselRisk: assessment.factors.vesselIdentity.score,
      ownershipRisk: assessment.factors.ownership.score,
      amlRisk: assessment.factors.sanctions.score,
      sanctionsRisk: assessment.factors.sanctions.score,
      routeRisk: assessment.factors.route.score,
      aisRisk: assessment.factors.ais.score,
      portRisk: assessment.factors.voyage.score,
      documentationRisk: assessment.factors.documents.score,
      behavioralRisk: assessment.factors.historicalBehaviour.score,
    };
    return vessel;
  }
}

export const riskEngine = new RiskEngineService();
