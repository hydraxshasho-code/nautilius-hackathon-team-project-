import { Vessel, RawAISPacket, AISConnectionState, RiskLevel } from '../types/maritime';
import {
  persistNewVessel,
  persistRemoveVessel,
  persistVesselTelemetryBatch,
} from './firebase';
import { riskEngine } from './riskEngine';
import { aisWorkerService } from './aisWorkerService';
import { resolveVesselFlag } from './flagService';

type Listener = (vessels: Vessel[], latestPacket?: RawAISPacket) => void;
type ConnectionListener = (state: AISConnectionState) => void;
type RawPacketListener = (packet: RawAISPacket) => void;

class AISStreamService {
  private vessels: Vessel[] = [];
  private listeners: Set<Listener> = new Set();
  private connectionListeners: Set<ConnectionListener> = new Set();
  private rawPacketListeners: Set<RawPacketListener> = new Set();
  private timer: any = null;
  private connectionState: AISConnectionState = 'CONNECTED';
  private isPaused: boolean = false;
  private speedMultiplier: number = 1.5;
  private updateRateMs: number = 1000;
  private rawPacketHistory: RawAISPacket[] = [];
  private maxRawPacketHistory: number = 40;
  private totalPacketsReceived: number = 0;
  private activeVesselId: string = '';
  private packetSeq: number = 0;
  private syncTickCounter: number = 0;
  private vesselIdMap: Map<string, Vessel> = new Map();

  constructor() {
    this.vessels = this.loadLocalFleet();
    this.rebuildVesselIndex();
    this.connectAIS();
  }

  private rebuildVesselIndex() {
    this.vesselIdMap.clear();
    for (let i = 0; i < this.vessels.length; i++) {
      const v = this.vessels[i];
      this.vesselIdMap.set(v.id, v);
      if (v.mmsi) this.vesselIdMap.set(v.mmsi, v);
      if (v.imo) this.vesselIdMap.set(v.imo, v);
    }
    aisWorkerService.buildSpatialIndex(this.vessels);
  }

  private loadLocalFleet(): Vessel[] {
    try {
      const cached = localStorage.getItem('nautilus_firestore_vessels_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  }

  public setFleet(newFleet: Vessel[]) {
    if (!newFleet || newFleet.length === 0) {
      console.log('[AISStreamService] ℹ️ setFleet ignored empty/null fleet to preserve active vessels');
      return;
    }
    console.log(`[AISStreamService] 📋 setFleet loaded ${newFleet.length} vessels`);
    this.vessels = newFleet.map((v) => JSON.parse(JSON.stringify(v)));
    this.rebuildVesselIndex();
    try {
      localStorage.setItem('nautilus_firestore_vessels_cache', JSON.stringify(this.vessels));
    } catch {
      // ignore
    }
    if (!this.vessels.some((v) => v.id === this.activeVesselId)) {
      this.activeVesselId = this.vessels[0]?.id || '';
    }
    for (const fn of this.listeners) {
      fn(this.vessels);
    }
  }

  public syncFromRemote(remoteVessels: Vessel[]) {
    if (!remoteVessels || remoteVessels.length === 0) {
      console.log('[AISStreamService] ℹ️ syncFromRemote ignored empty/null remote fleet to protect live AIS');
      return;
    }
    console.log(`[AISStreamService] 🔄 syncFromRemote merging ${remoteVessels.length} remote vessels`);
    for (const rv of remoteVessels) {
      const idx = this.vessels.findIndex(
        (v) => v.id === rv.id || v.mmsi === rv.mmsi || (v.imo && v.imo === rv.imo)
      );
      if (idx !== -1) {
        // If current vessel is actively transmitting from live AIS, keep its live coords!
        const curr = this.vessels[idx];
        if (!curr.isTransmitting && curr.isStale) {
          this.vessels[idx] = { ...curr, ...rv };
        } else {
          // Keep live kinematic position, merge static info
          this.vessels[idx] = {
            ...rv,
            lat: curr.lat,
            lon: curr.lon,
            speed: curr.speed,
            course: curr.course,
            heading: curr.heading,
            isTransmitting: curr.isTransmitting,
            isStale: curr.isStale,
          };
        }
      } else {
        this.vessels.push(rv);
      }
    }
    if (this.vessels.length > 25) {
      this.vessels = this.vessels.slice(0, 25);
    }
    this.rebuildVesselIndex();
    for (const fn of this.listeners) {
      fn(this.vessels);
    }
  }

  public addVessel(vesselData: Partial<Vessel>): Vessel {
    const mmsiClean = String(vesselData.mmsi || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const imoClean = String(vesselData.imo || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const uniqueDocId = mmsiClean
      ? `mmsi-${mmsiClean}`
      : imoClean
        ? `imo-${imoClean}`
        : (vesselData.id || `vessel-${Date.now()}`);

    const globalWaypoints = [
      { lat: 51.12, lon: 1.45, origin: 'ROTTERDAM', dest: 'NEW YORK', crs: 245 },
      { lat: 36.11, lon: -5.35, origin: 'GIBRALTAR', dest: 'VALENCIA', crs: 85 },
      { lat: 27.85, lon: 34.25, origin: 'PORT SAID', dest: 'JEDDAH', crs: 165 },
      { lat: 24.12, lon: 58.41, origin: 'RAS TANURA', dest: 'NINGBO', crs: 142 },
      { lat: 9.35, lon: -79.88, origin: 'COLON', dest: 'BALBOA', crs: 195 },
      { lat: 31.25, lon: 122.50, origin: 'SHANGHAI', dest: 'SINGAPORE', crs: 205 },
      { lat: 1.28, lon: 103.85, origin: 'SINGAPORE', dest: 'ROTTERDAM', crs: 280 },
    ];
    const randWp = globalWaypoints[Math.floor(Math.random() * globalWaypoints.length)];

    const resolvedFlag = resolveVesselFlag({
      explicitFlag: vesselData.flag,
      explicitFlagCode: vesselData.flagCode,
      mmsi: vesselData.mmsi || mmsiClean,
    });

    const newVessel: Vessel = {
      id: uniqueDocId,
      name: vesselData.name?.toUpperCase() || 'NEW VESSEL',
      imo: vesselData.imo || (imoClean || `${Math.floor(1000000 + Math.random() * 9000000)}`),
      mmsi: vesselData.mmsi || (mmsiClean || `${Math.floor(100000000 + Math.random() * 900000000)}`),
      callSign: vesselData.callSign || 'NTR99',
      type: vesselData.type || 'Container Ship',
      flag: resolvedFlag.flag,
      flagCode: resolvedFlag.flagCode,
      flagSource: resolvedFlag.flagSource,
      lat: vesselData.lat ?? randWp.lat,
      lon: vesselData.lon ?? randWp.lon,
      prevLat: vesselData.prevLat ?? randWp.lat,
      prevLon: vesselData.prevLon ?? randWp.lon,
      speed: vesselData.speed ?? 14.5,
      course: vesselData.course ?? randWp.crs,
      heading: vesselData.heading ?? (vesselData.course ?? randWp.crs),
      navStatus: vesselData.navStatus || 'Under way using engine',
      destination: vesselData.destination || randWp.dest,
      destinationPortCode: vesselData.destinationPortCode || 'NLRTM',
      origin: vesselData.origin || randWp.origin,
      originPortCode: vesselData.originPortCode || 'SGSIN',
      eta: vesselData.eta || new Date(Date.now() + 86400000 * 12).toISOString(),
      timestamp: new Date().toISOString(),
      aisSource: vesselData.aisSource || 'HYBRID_AIS',
      dataQuality: 'OPTIMAL',
      lastUpdatedSecondsAgo: 0,
      riskLevel: vesselData.riskLevel || 'LOW',
      riskScore: vesselData.riskScore ?? 16,
      isTransmitting: true,
      isStale: false,
      length: vesselData.length || 330,
      beam: vesselData.beam || 48,
      draught: vesselData.draught || 13.5,
      grossTonnage: vesselData.grossTonnage || 110000,
      deadweightTonnage: vesselData.deadweightTonnage || 125000,
      yearBuilt: vesselData.yearBuilt || 2022,
      classificationSociety: vesselData.classificationSociety || 'DNV GL',
      owner: vesselData.owner || 'Nautilus Maritime Transport Ltd',
      operator: vesselData.operator || 'Nautilus Fleet Global S.A.',
      manager: vesselData.manager || 'Global Ship Management',
      beneficialOwner: vesselData.beneficialOwner || 'Nautilus Ocean Trust',
      kycStatus: vesselData.kycStatus || 'Verified',
      amlStatus: vesselData.amlStatus || 'Clear',
      totalDistanceNm: vesselData.totalDistanceNm || 5400,
      distanceTraveledNm: vesselData.distanceTraveledNm || 210,
      anomaliesDetected: 0,
      historicalTrack: vesselData.historicalTrack || [
        { lat: vesselData.lat ?? 1.28, lon: vesselData.lon ?? 103.85, timestamp: new Date().toISOString(), speed: 14.5, course: 280, heading: 280 },
      ],
      predictedTrack: [],
      ownershipStructure: vesselData.ownershipStructure || [
        { name: vesselData.beneficialOwner || 'Nautilus Ocean Trust', role: 'Beneficial Owner', country: 'Singapore', registrationNumber: 'SG-2022-9901', sanctionStatus: 'CLEARED', sharePercentage: 100 },
        { name: vesselData.owner || 'Nautilus Maritime Transport Ltd', role: 'Registered Owner', country: vesselData.flag || 'Panama', registrationNumber: 'PA-2022-819', sanctionStatus: 'CLEARED', sharePercentage: 100 },
      ],
      portCalls: vesselData.portCalls || [],
      riskBreakdown: vesselData.riskBreakdown || {
        vesselRisk: 12,
        ownershipRisk: 10,
        amlRisk: 8,
        sanctionsRisk: 6,
        routeRisk: 18,
        aisRisk: 10,
        portRisk: 12,
        documentationRisk: 10,
        behavioralRisk: 8,
      },
      riskEvidence: vesselData.riskEvidence || ['Statutory AIS transponder enrolled into Nautilus command fleet'],
    };

    // Ensure risk breakdown & 9 factors are evaluated
    riskEngine.updateVesselRiskFields(newVessel);

    const existingIndex = this.vessels.findIndex((v) => v.id === newVessel.id || (v.mmsi && v.mmsi === newVessel.mmsi));
    if (existingIndex !== -1) {
      this.vessels[existingIndex] = newVessel;
    } else {
      this.vessels.unshift(newVessel);
    }
    this.activeVesselId = newVessel.id;

    try {
      localStorage.setItem('nautilus_firestore_vessels_cache', JSON.stringify(this.vessels));
    } catch {
      // ignore
    }

    for (const fn of this.listeners) {
      fn(this.vessels);
    }

    // Persist permanently to Firestore database
    persistNewVessel(newVessel).catch((err) =>
      console.warn('Firestore new vessel persist notification:', err)
    );

    return newVessel;
  }

  public removeVessel(vesselId: string): boolean {
    const idx = this.vessels.findIndex((v) => v.id === vesselId);
    if (idx !== -1) {
      this.vessels.splice(idx, 1);
      try {
        localStorage.setItem('nautilus_firestore_vessels_cache', JSON.stringify(this.vessels));
      } catch {
        // ignore
      }
      if (this.activeVesselId === vesselId) {
        this.activeVesselId = this.vessels[0]?.id || '';
      }
      for (const fn of this.listeners) {
        fn(this.vessels);
      }

      // Permanently remove from Firestore database
      persistRemoveVessel(vesselId).catch((err) =>
        console.warn('Firestore remove vessel notification:', err)
      );

      return true;
    }
    return false;
  }

  public connectAIS() {
    this.connectionState = 'CONNECTED';
    this.notifyConnectionState();
    this.startStreaming();
  }

  public handleAISDisconnect() {
    this.connectionState = 'DISCONNECTED';
    this.stopStreaming();
    this.notifyConnectionState();
  }

  public reconnectAIS() {
    this.connectionState = 'RECONNECTING';
    this.notifyConnectionState();
    setTimeout(() => {
      this.connectAIS();
    }, 1200);
  }

  public setConnectionState(state: AISConnectionState) {
    this.connectionState = state;
    if (state === 'DISCONNECTED') {
      this.stopStreaming();
    } else if (state === 'CONNECTED' && !this.timer) {
      this.startStreaming();
    }
    this.notifyConnectionState();
  }

  public togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  public setSpeedMultiplier(mult: number) {
    this.speedMultiplier = mult;
  }

  public getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getConnectionState(): AISConnectionState {
    return this.connectionState;
  }

  public getVessels(): Vessel[] {
    return this.vessels;
  }

  private notifyThrottleTimer: any = null;

  public syncLiveAISVessel(liveVessel: Vessel) {
    if (!liveVessel) return;

    // Check if vessel exists by id, MMSI, or IMO
    const idx = this.vessels.findIndex(
      (v) => v.id === liveVessel.id || v.mmsi === liveVessel.mmsi || (v.imo && v.imo === liveVessel.imo)
    );

    const prev = idx !== -1 ? this.vessels[idx] : null;
    const prevLat = prev ? prev.lat : liveVessel.lat;
    const prevLon = prev ? prev.lon : liveVessel.lon;

    const merged: Vessel = {
      ...(prev || {}),
      ...liveVessel,
      prevLat,
      prevLon,
      isTransmitting: liveVessel.lastUpdatedSecondsAgo <= 120,
      isStale: liveVessel.lastUpdatedSecondsAgo > 60,
    };

    riskEngine.updateVesselRiskFields(merged);

    if (idx !== -1) {
      this.vessels[idx] = merged;
    } else {
      if (this.vessels.length >= 250) {
        this.vessels.pop();
      }
      this.vessels.unshift(merged);
    }

    this.vesselIdMap.set(merged.id, merged);
    if (merged.mmsi) this.vesselIdMap.set(merged.mmsi, merged);
    if (merged.imo) this.vesselIdMap.set(merged.imo, merged);

    if (!this.activeVesselId) {
      this.activeVesselId = merged.id;
    }

    // Emit real AIS packet into history ring buffer (capped at maxRawPacketHistory)
    const packet: RawAISPacket = {
      id: `pkt-${Date.now()}-${++this.packetSeq}-${merged.mmsi}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      mmsi: merged.mmsi,
      messageType: 1,
      description: `REAL_AIS_POS_REP [${merged.name.substring(0, 14)}]`,
      lat: merged.lat,
      lon: merged.lon,
      speed: merged.speed,
      course: merged.course,
      heading: merged.heading,
      status: merged.navStatus,
    };

    this.rawPacketHistory.unshift(packet);
    if (this.rawPacketHistory.length > this.maxRawPacketHistory) {
      this.rawPacketHistory.pop();
    }
    this.totalPacketsReceived++;

    for (const fn of this.rawPacketListeners) {
      fn(packet);
    }

    // Throttled notification to prevent React state thrashing
    if (!this.notifyThrottleTimer) {
      this.notifyThrottleTimer = setTimeout(() => {
        this.notifyThrottleTimer = null;
        for (const fn of this.listeners) {
          fn(this.vessels, packet);
        }
      }, 500);
    }
  }

  public getVesselById(id: string): Vessel | undefined {
    return this.vesselIdMap.get(id) || this.vessels.find((v) => v.id === id);
  }

  public selectVessel(id: string) {
    this.activeVesselId = id;
  }

  public getSelectedVesselId(): string {
    return this.activeVesselId;
  }

  public getRawPackets(): RawAISPacket[] {
    return this.rawPacketHistory;
  }

  public getTotalPacketsReceived(): number {
    return this.totalPacketsReceived;
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.vessels);
    return () => this.listeners.delete(fn);
  }

  public subscribeConnection(fn: ConnectionListener): () => void {
    this.connectionListeners.add(fn);
    fn(this.connectionState);
    return () => this.connectionListeners.delete(fn);
  }

  public subscribeRawPackets(fn: RawPacketListener): () => void {
    this.rawPacketListeners.add(fn);
    return () => this.rawPacketListeners.delete(fn);
  }

  private notifyConnectionState() {
    for (const fn of this.connectionListeners) {
      fn(this.connectionState);
    }
  }

  private startStreaming() {
    // Pure real-time mode: live telemetry is delivered directly via WebSocket liveAISClient
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private stopStreaming() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Real AIS time progression: updates telemetry age counters and advances underway vessels with dead-reckoning
   */
  private tickSimulation() {
    if (this.vessels.length === 0) return;

    // Advance underway vessels along their course vector using kinematic dead-reckoning
    if (!this.isPaused) {
      for (const v of this.vessels) {
        if (v.speed > 0.5) {
          this.advanceVessel(v);
        } else {
          v.lastUpdatedSecondsAgo += Math.round(this.updateRateMs / 1000);
          if (v.lastUpdatedSecondsAgo > 60) {
            v.isStale = true;
          }
        }
      }
    } else {
      for (const v of this.vessels) {
        v.lastUpdatedSecondsAgo += Math.round(this.updateRateMs / 1000);
        if (v.lastUpdatedSecondsAgo > 60) {
          v.isStale = true;
        }
      }
    }

    // Periodically sync live coordinates to Firestore for persistent history
    this.syncTickCounter++;
    if (this.syncTickCounter % 15 === 0) {
      persistVesselTelemetryBatch(this.vessels.slice(0, 10)).catch(() => {});
    }

    // Keep background AIS spatial index synchronized
    aisWorkerService.buildSpatialIndex(this.vessels);

    // Notify UI listeners of updated fleet positions
    for (const fn of this.listeners) {
      fn(this.vessels);
    }
  }

  /**
   * Advances a single vessel along its course with realistic dead-reckoning
   */
  private advanceVessel(vessel: Vessel): RawAISPacket {
    // Store previous coordinates for smooth interpolation
    vessel.prevLat = vessel.lat;
    vessel.prevLon = vessel.lon;

    // Speed in knots -> nautical miles per hour. Scale by speedMultiplier & timestep
    // Time factor of 28 makes ship progression visibly distinct on the global map
    const hours = ((this.updateRateMs / 1000) * this.speedMultiplier * 28) / 3600;
    const distanceNm = vessel.speed * hours;

    // Convert distance & course (degrees) to delta lat & lon
    const radCourse = (vessel.course * Math.PI) / 180;
    const deltaLat = (distanceNm * Math.cos(radCourse)) / 60;
    const latRad = (vessel.lat * Math.PI) / 180;
    const deltaLon = (distanceNm * Math.sin(radCourse)) / (60 * Math.max(0.1, Math.cos(latRad)));

    // Subtle natural sea drift in course (+- 0.8 deg) and speed (+- 0.1 kn)
    const courseDrift = (Math.random() - 0.5) * 1.2;
    const speedDrift = (Math.random() - 0.5) * 0.15;

    vessel.lat = parseFloat((vessel.lat + deltaLat).toFixed(5));
    vessel.lon = parseFloat((vessel.lon + deltaLon).toFixed(5));
    vessel.course = Math.round((vessel.course + courseDrift + 360) % 360);
    vessel.heading = vessel.course;
    vessel.speed = parseFloat(Math.max(1, vessel.speed + speedDrift).toFixed(1));
    vessel.lastUpdatedSecondsAgo = 0;
    vessel.isStale = false;
    vessel.timestamp = new Date().toISOString();
    vessel.distanceTraveledNm = parseFloat((vessel.distanceTraveledNm + distanceNm).toFixed(1));

    // Update historical track (keep last 30 points)
    this.updateVesselTrack(vessel);

    // Create raw AIS packet record (ITU-R M.1371 standard Msg 1/2/3 Position Report)
    const packet: RawAISPacket = {
      id: `pkt-${Date.now()}-${++this.packetSeq}-${vessel.mmsi}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      mmsi: vessel.mmsi,
      messageType: Math.random() > 0.3 ? 1 : 3,
      description: `POS_REP_CLS_A [${vessel.name.substring(0, 14)}]`,
      lat: vessel.lat,
      lon: vessel.lon,
      speed: vessel.speed,
      course: vessel.course,
      heading: vessel.heading,
      status: vessel.navStatus,
    };

    this.rawPacketHistory.unshift(packet);
    if (this.rawPacketHistory.length > this.maxRawPacketHistory) {
      this.rawPacketHistory.pop();
    }
    this.totalPacketsReceived++;

    for (const fn of this.rawPacketListeners) {
      fn(packet);
    }

    return packet;
  }

  public updateVesselTrack(vessel: Vessel) {
    if (!vessel.historicalTrack) vessel.historicalTrack = [];
    vessel.historicalTrack.push({
      lat: vessel.lat,
      lon: vessel.lon,
      timestamp: vessel.timestamp,
      speed: vessel.speed,
      course: vessel.course,
      heading: vessel.heading,
    });
    if (vessel.historicalTrack.length > 35) {
      vessel.historicalTrack.shift();
    }
  }

  /**
   * Manual AIS Packet Ingestion (REST API or custom JSON injection)
   */
  public receiveAISData(payload: {
    mmsi: string;
    lat: number;
    lon: number;
    speed?: number;
    course?: number;
    heading?: number;
    destination?: string;
    navStatus?: string;
  }) {
    const vessel = this.vessels.find((v) => v.mmsi === payload.mmsi);
    if (!vessel) return false;

    vessel.prevLat = vessel.lat;
    vessel.prevLon = vessel.lon;
    vessel.lat = payload.lat;
    vessel.lon = payload.lon;
    if (payload.speed !== undefined) vessel.speed = payload.speed;
    if (payload.course !== undefined) vessel.course = payload.course;
    if (payload.heading !== undefined) vessel.heading = payload.heading;
    if (payload.destination) vessel.destination = payload.destination;
    vessel.timestamp = new Date().toISOString();
    vessel.lastUpdatedSecondsAgo = 0;
    vessel.isStale = false;

    this.updateVesselTrack(vessel);

    const packet: RawAISPacket = {
      id: `pkt-inj-${Date.now()}-${++this.packetSeq}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      mmsi: vessel.mmsi,
      messageType: 1,
      description: `INGEST_REST [${vessel.name.substring(0, 14)}]`,
      lat: vessel.lat,
      lon: vessel.lon,
      speed: vessel.speed,
      course: vessel.course,
      heading: vessel.heading,
      status: vessel.navStatus,
    };

    this.rawPacketHistory.unshift(packet);
    this.totalPacketsReceived++;

    for (const fn of this.listeners) {
      fn(this.vessels, packet);
    }
    for (const fn of this.rawPacketListeners) {
      fn(packet);
    }

    return true;
  }

  public updateVesselRisk(vesselId: string, newRiskLevel: RiskLevel, newScore: number, evidenceReason?: string) {
    const vessel = this.getVesselById(vesselId);
    if (vessel) {
      vessel.riskLevel = newRiskLevel;
      vessel.riskScore = newScore;
      if (evidenceReason) {
        vessel.riskEvidence.unshift(evidenceReason);
      }
      for (const fn of this.listeners) {
        fn(this.vessels);
      }
    }
  }

  public updateAMLStatus(vesselId: string, status: Vessel['amlStatus'], confidence?: number) {
    const vessel = this.getVesselById(vesselId);
    if (vessel) {
      vessel.amlStatus = status;
      if (confidence !== undefined) vessel.amlMatchConfidence = confidence;
      for (const fn of this.listeners) {
        fn(this.vessels);
      }
    }
  }
}

export const aisStreamService = new AISStreamService();
