import { Vessel, NavStatus, VesselType, RiskLevel } from '../types/maritime';
import { NormalizedAISVessel, ProviderStatus, WebSocketAISMessage } from '../server/ais/types';
import { aisStreamService } from './aisStreamService';
import { resolveVesselFlag } from './flagService';
import { auth } from './firebase';

type VesselListener = (vessels: Vessel[], updatedVessel?: Vessel) => void;
type StatusListener = (status: ProviderStatus) => void;

class LiveAISClient {
  private ws: WebSocket | null = null;
  private trackedVessels: Map<string, Vessel> = new Map();
  private vesselListeners: Set<VesselListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private providerStatus: ProviderStatus = {
    name: 'AIS_SERVICE_CONNECTING',
    connected: false,
    activeTrackedCount: 0,
    lastMessageTimestamp: null,
    authenticated: false,
  };
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private reconnectTimer: any = null;
  private isExplicitlyClosed = false;
  public connectionState: 'Connected' | 'Disconnected' | 'Reconnecting' = 'Reconnecting';
  private connectionListeners: Set<(state: 'Connected' | 'Disconnected' | 'Reconnecting') => void> = new Set();

  constructor() {
    this.connect();
    this.fetchInitialFleet().catch(() => {});

    // Listen to auth changes and upgrade active WebSocket session with user token
    if (typeof window !== 'undefined') {
      auth.onAuthStateChanged(async (currentUser) => {
        if (currentUser && this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            const token = await currentUser.getIdToken();
            this.ws.send(JSON.stringify({ type: 'auth', token }));
          } catch {
            // ignore
          }
        }
      });
    }
  }

  public async fetchInitialFleet(): Promise<Vessel[]> {
    if (typeof window === 'undefined') return [];
    try {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken().catch(() => '');
      }
      const res = await fetch('/api/ais/tracked', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.vessels) && data.vessels.length > 0) {
          console.log(`[LiveAISClient] 🌐 Eagerly hydrated ${data.vessels.length} real AIS vessels via /api/ais/tracked`);
          for (const raw of data.vessels) {
            const v = this.normalizedToVessel(raw);
            this.trackedVessels.set(v.id, v);
            if (v.imo) this.trackedVessels.set(`imo-${v.imo}`, v);
            if (v.mmsi) this.trackedVessels.set(`mmsi-${v.mmsi}`, v);
            aisStreamService.syncLiveAISVessel(v);
          }
          this.cachedUniqueVessels = null;
          const list = this.getUniqueVessels();
          this.notifyVesselListeners();
          return list;
        }
      }
    } catch (err) {
      console.warn('[LiveAISClient] Failed eager fleet fetch:', err);
    }
    return this.getTrackedVessels();
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    this.isExplicitlyClosed = false;
    this.connectionState = 'Reconnecting';
    this.notifyConnectionListeners();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ais/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        this.reconnectAttempts = 0;
        this.providerStatus.connected = true;
        this.connectionState = 'Connected';
        console.log('[LiveAISClient] 🟢 WebSocket connection established:', wsUrl);
        this.notifyStatusListeners();
        this.notifyConnectionListeners();

        // If authenticated, transmit ID token to server
        if (auth.currentUser) {
          try {
            const token = await auth.currentUser.getIdToken();
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'auth', token }));
            }
          } catch {
            // ignore
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WebSocketAISMessage = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch {
          // ignore malformed
        }
      };

      this.ws.onerror = (err) => {
        this.providerStatus.connected = false;
        this.connectionState = 'Disconnected';
        console.warn('[LiveAISClient] ⚠️ WebSocket error occurred:', err);
        this.notifyStatusListeners();
        this.notifyConnectionListeners();
      };

      this.ws.onclose = (ev) => {
        this.providerStatus.connected = false;
        this.connectionState = this.isExplicitlyClosed ? 'Disconnected' : 'Reconnecting';
        console.log(`[LiveAISClient] 🔌 WebSocket closed (code ${ev.code}, reason: ${ev.reason || 'none'})`);
        this.notifyStatusListeners();
        this.notifyConnectionListeners();
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.warn('[LiveAISClient] Failed to instantiate WebSocket:', err);
      this.connectionState = 'Disconnected';
      this.notifyConnectionListeners();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.connectionState = 'Reconnecting';
    this.notifyConnectionListeners();
    console.log(`[LiveAISClient] Scheduling reconnect in ${delay}ms (attempt #${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleMessage(msg: WebSocketAISMessage): void {
    if (msg.type === 'vessel_update' && msg.payload) {
      const payload = msg.payload;
      const uniqueId = payload.imo ? `imo-${payload.imo}` : `mmsi-${payload.mmsi}`;
      const existing =
        this.trackedVessels.get(uniqueId) ||
        (payload.imo ? this.trackedVessels.get(`imo-${payload.imo}`) : null) ||
        (payload.mmsi ? this.trackedVessels.get(`mmsi-${payload.mmsi}`) : null);

      const vessel = this.normalizedToVessel(payload);

      this.trackedVessels.set(vessel.id, vessel);
      if (vessel.imo) this.trackedVessels.set(`imo-${vessel.imo}`, vessel);
      if (vessel.mmsi) this.trackedVessels.set(`mmsi-${vessel.mmsi}`, vessel);
      this.cachedUniqueVessels = null;

      // Sync into main application stream service for map & dashboard
      aisStreamService.syncLiveAISVessel(vessel);
      this.scheduleNotifyVesselListeners(vessel);
    } else if (msg.type === 'vessel_batch' && Array.isArray(msg.payload)) {
      for (const raw of msg.payload) {
        const vessel = this.normalizedToVessel(raw);
        this.trackedVessels.set(vessel.id, vessel);
      }
      this.cachedUniqueVessels = null;
      const list = this.getUniqueVessels();
      for (const v of list) {
        aisStreamService.syncLiveAISVessel(v);
      }
      this.notifyVesselListeners();
    } else if (msg.type === 'provider_status' && msg.payload) {
      this.providerStatus = msg.payload;
      this.notifyStatusListeners();
    } else if (msg.type === 'vessel_removed' && msg.payload) {
      const cleanId = String(msg.payload.id || '').replace(/[^0-9]/g, '');
      for (const [k, v] of this.trackedVessels.entries()) {
        if (k === cleanId || v.imo === cleanId || v.mmsi === cleanId || v.id === msg.payload.id) {
          this.trackedVessels.delete(k);
          aisStreamService.removeVessel(v.id);
        }
      }
      this.cachedUniqueVessels = null;
      this.notifyVesselListeners();
    }
  }

  /**
   * Converts NormalizedAISVessel from authorized backend feed into full UI Vessel object
   */
  public normalizedToVessel(norm: NormalizedAISVessel | any): Vessel {
    const rawMmsi = norm.mmsi ? String(norm.mmsi).trim() : '';
    const rawImo = norm.imo ? String(norm.imo).trim() : null;
    const uniqueId = norm.id || (rawImo ? `imo-${rawImo}` : `mmsi-${rawMmsi}`);

    const lat = typeof norm.position?.latitude === 'number'
      ? norm.position.latitude
      : (typeof norm.lat === 'number' ? norm.lat : 0);
    const lon = typeof norm.position?.longitude === 'number'
      ? norm.position.longitude
      : (typeof norm.lon === 'number' ? norm.lon : 0);

    const speed = typeof norm.navigation?.speed === 'number'
      ? norm.navigation.speed
      : (typeof norm.speed === 'number' ? norm.speed : 0);

    // COG: Course Over Ground represents the actual movement vector direction
    const course = norm.navigation?.course !== null && norm.navigation?.course !== undefined
      ? norm.navigation.course
      : (typeof norm.course === 'number'
        ? norm.course
        : (norm.navigation?.heading ?? (typeof norm.heading === 'number' ? norm.heading : 0)));

    // HDG: Heading represents the physical bow compass orientation
    const heading = norm.navigation?.heading !== null && norm.navigation?.heading !== undefined && norm.navigation?.heading !== 511
      ? norm.navigation.heading
      : (typeof norm.heading === 'number' ? norm.heading : course);

    const draught = norm.navigation?.draught ?? (norm.draught ?? 12.0);

    const existing = this.trackedVessels.get(uniqueId);

    // Resolve flag authoritatively: AIS -> Metadata -> MMSI MID Inference -> Unknown (never hardcoded Singapore)
    const resolvedFlag = resolveVesselFlag({
      explicitFlag: norm.flag,
      explicitFlagCode: norm.flagCode,
      metadataFlag: existing?.flag,
      metadataFlagCode: existing?.flagCode,
      mmsi: rawMmsi,
    });

    const vessel: Vessel = {
      id: uniqueId,
      name: norm.name || `VESSEL-${rawMmsi}`,
      imo: rawImo || existing?.imo || '9000000',
      mmsi: rawMmsi,
      callSign: norm.callSign || existing?.callSign || 'CALLSIGN',
      type: (norm.type || existing?.type || 'Container Ship') as VesselType,
      flag: resolvedFlag.flag,
      flagCode: resolvedFlag.flagCode,
      flagSource: resolvedFlag.flagSource,
      lat,
      lon,
      prevLat: existing ? existing.lat : lat,
      prevLon: existing ? existing.lon : lon,
      speed,
      course,
      heading,
      navStatus: (norm.navigation?.navigationStatus || norm.navStatus || existing?.navStatus || 'Under way using engine') as NavStatus,
      destination: norm.voyage?.destination || norm.destination || existing?.destination || 'UNAVAILABLE',
      destinationPortCode: existing?.destinationPortCode || 'ZZZZZ',
      origin: existing?.origin || 'ORIGIN PORT',
      originPortCode: existing?.originPortCode || 'ZZZZZ',
      eta: norm.voyage?.eta || norm.eta || existing?.eta || 'UNAVAILABLE',
      timestamp: norm.timestamp || new Date().toISOString(),
      aisSource: norm.source || norm.aisSource || 'AISSTREAM_REALTIME',
      dataQuality: norm.status === 'LIVE' ? 'OPTIMAL' : 'STALE',
      lastUpdatedSecondsAgo: norm.lastUpdatedSecondsAgo ?? 0,
      riskLevel: existing?.riskLevel || 'LOW',
      riskScore: existing?.riskScore ?? 16,
      isTransmitting: norm.status === 'LIVE',
      isStale: norm.status === 'STALE' || norm.status === 'OFFLINE',
      length: norm.length ?? (existing?.length ?? 330),
      beam: norm.beam ?? (existing?.beam ?? 48),
      draught,
      grossTonnage: norm.grossTonnage ?? (existing?.grossTonnage ?? 110000),
      deadweightTonnage: norm.deadweightTonnage ?? (existing?.deadweightTonnage ?? 125000),
      yearBuilt: norm.yearBuilt ?? (existing?.yearBuilt ?? 2024),
      classificationSociety: norm.classificationSociety || existing?.classificationSociety || 'DNV GL',
      owner: norm.owner || existing?.owner || 'Authorized Maritime Carriers',
      operator: norm.operator || existing?.operator || 'Global Fleet Operator',
      manager: norm.manager || existing?.manager || 'Ship Management Group',
      beneficialOwner: norm.beneficialOwner || existing?.beneficialOwner || 'Holding Trust',
      kycStatus: existing?.kycStatus || 'Verified',
      amlStatus: existing?.amlStatus || 'Clear',
      totalDistanceNm: existing?.totalDistanceNm ?? 4500,
      distanceTraveledNm: existing?.distanceTraveledNm ?? 120,
      anomaliesDetected: existing?.anomaliesDetected ?? 0,
      historicalTrack: existing?.historicalTrack || [
        { lat: norm.position.latitude, lon: norm.position.longitude, timestamp: norm.timestamp, speed, course, heading }
      ],
      predictedTrack: existing?.predictedTrack || [],
      ownershipStructure: existing?.ownershipStructure || [
        { name: norm.owner || 'Registered Owner', role: 'Registered Owner', country: resolvedFlag.flag, registrationNumber: 'REG-2025', sanctionStatus: 'CLEARED' }
      ],
      portCalls: existing?.portCalls || [],
      riskBreakdown: existing?.riskBreakdown || {
        vesselRisk: 10,
        ownershipRisk: 8,
        amlRisk: 8,
        sanctionsRisk: 6,
        routeRisk: 14,
        aisRisk: 10,
        portRisk: 10,
        documentationRisk: 8,
        behavioralRisk: 8,
      },
      riskEvidence: existing?.riskEvidence || ['Statutory AIS transponder verified and authorized by maritime registry.'],
    };

    // Append to historical track if moved
    if (!vessel.historicalTrack) vessel.historicalTrack = [];
    const lastPt = vessel.historicalTrack[vessel.historicalTrack.length - 1];
    if (!lastPt || lastPt.lat !== vessel.lat || lastPt.lon !== vessel.lon) {
      vessel.historicalTrack.push({
        lat: vessel.lat,
        lon: vessel.lon,
        timestamp: vessel.timestamp,
        speed: vessel.speed,
        course: vessel.course,
        heading: vessel.heading,
      });
      if (vessel.historicalTrack.length > 50) {
        vessel.historicalTrack.shift();
      }
    }

    return vessel;
  }

  public async trackVessel(identifier: string): Promise<{ success: boolean; vessel?: Vessel; message?: string }> {
    const clean = String(identifier).trim().replace(/[^0-9]/g, '');
    if (!clean) {
      console.warn('[LiveAISClient] trackVessel rejected: Invalid IMO/MMSI identifier', identifier);
      return { success: false, message: 'Invalid IMO/MMSI identifier' };
    }

    console.log(`[LiveAISClient] 🚀 trackVessel requested for identifier: "${clean}" (raw: "${identifier}")`);

    // Try WebSocket track command first
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(`[LiveAISClient] Sending WS track_vessel command for: ${clean}`);
      this.ws.send(JSON.stringify({ type: 'track_vessel', identifier: clean }));
    } else {
      console.warn(`[LiveAISClient] WS not open (readyState=${this.ws?.readyState}), relying on REST dual-transport`);
    }

    // Call REST endpoint as reliable dual-path transport
    try {
      console.log(`[LiveAISClient] Fetching POST /api/ais/track for: ${clean}`);
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken().catch(() => '');
      }

      const res = await fetch('/api/ais/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ identifier: clean }),
      });
      const data = await res.json();
      console.log(`[LiveAISClient] REST /api/ais/track response (${res.status}):`, data);

      if (!res.ok) {
        console.warn('[LiveAISClient] ❌ REST track failed:', data.error);
        return { success: false, message: data.error || 'Failed to start tracking' };
      }
      if (data.vessel) {
        const v = this.normalizedToVessel(data.vessel);
        this.trackedVessels.set(v.id, v);
        if (v.imo) this.trackedVessels.set(`imo-${v.imo}`, v);
        if (v.mmsi) this.trackedVessels.set(`mmsi-${v.mmsi}`, v);
        this.cachedUniqueVessels = null;

        console.log(
          `[LiveAISClient] ✅ Vessel resolved: ${v.name} (${v.id}), coords=[${v.lat.toFixed(4)}, ${v.lon.toFixed(4)}], syncing to aisStreamService`
        );
        aisStreamService.syncLiveAISVessel(v);
        this.notifyVesselListeners(v);
        return { success: true, vessel: v };
      }
      return { success: true };
    } catch (e: any) {
      console.error('[LiveAISClient] ❌ Network error during trackVessel:', e);
      return { success: false, message: e.message || 'Network error' };
    }
  }

  public async untrackVessel(identifier: string): Promise<boolean> {
    const clean = String(identifier).trim().replace(/[^0-9]/g, '');
    if (!clean) return false;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'untrack_vessel', identifier: clean }));
    }

    try {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken().catch(() => '');
      }

      await fetch('/api/ais/untrack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ identifier: clean }),
      });
    } catch {
      // ignore
    }

    // Remove locally
    for (const [k, v] of this.trackedVessels.entries()) {
      if (k === clean || v.imo === clean || v.mmsi === clean || v.id === identifier) {
        this.trackedVessels.delete(k);
        aisStreamService.removeVessel(v.id);
      }
    }
    this.cachedUniqueVessels = null;
    this.notifyVesselListeners();
    return true;
  }

  public async searchVessel(query: string): Promise<NormalizedAISVessel | null> {
    const clean = String(query).trim().replace(/[^0-9]/g, '');
    if (!clean) return null;

    try {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken().catch(() => '');
      }

      const res = await fetch(`/api/ais/search?q=${encodeURIComponent(clean)}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  private cachedUniqueVessels: Vessel[] | null = null;

  public getTrackedVessels(): Vessel[] {
    return this.getUniqueVessels();
  }

  private getUniqueVessels(): Vessel[] {
    if (this.cachedUniqueVessels) {
      return this.cachedUniqueVessels;
    }
    const map = new Map<string, Vessel>();
    for (const v of this.trackedVessels.values()) {
      map.set(v.mmsi, v);
    }
    this.cachedUniqueVessels = Array.from(map.values()).slice(0, 1000);
    return this.cachedUniqueVessels;
  }

  public getProviderStatus(): ProviderStatus {
    return this.providerStatus;
  }

  public subscribeVessels(listener: VesselListener): () => void {
    this.vesselListeners.add(listener);
    listener(this.getTrackedVessels());
    return () => this.vesselListeners.delete(listener);
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.providerStatus);
    return () => this.statusListeners.delete(listener);
  }

  private notifyThrottleTimer: any = null;
  private pendingUpdatedVessel?: Vessel;

  private scheduleNotifyVesselListeners(updated?: Vessel): void {
    if (updated) this.pendingUpdatedVessel = updated;
    if (this.notifyThrottleTimer) return;

    this.notifyThrottleTimer = setTimeout(() => {
      this.notifyThrottleTimer = null;
      const target = this.pendingUpdatedVessel;
      this.pendingUpdatedVessel = undefined;
      this.notifyVesselListeners(target);
    }, 600);
  }

  private notifyVesselListeners(updated?: Vessel): void {
    const fleet = this.getTrackedVessels();
    for (const fn of this.vesselListeners) {
      fn(fleet, updated);
    }
  }

  private notifyStatusListeners(): void {
    for (const fn of this.statusListeners) {
      fn(this.providerStatus);
    }
  }

  public getConnectionState(): 'Connected' | 'Disconnected' | 'Reconnecting' {
    return this.connectionState;
  }

  public subscribeConnectionState(listener: (state: 'Connected' | 'Disconnected' | 'Reconnecting') => void): () => void {
    this.connectionListeners.add(listener);
    listener(this.connectionState);
    return () => this.connectionListeners.delete(listener);
  }

  private notifyConnectionListeners(): void {
    for (const fn of this.connectionListeners) {
      try {
        fn(this.connectionState);
      } catch {
        // ignore listener error
      }
    }
  }

  public dispose(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.vesselListeners.clear();
    this.statusListeners.clear();
    this.connectionListeners.clear();
  }
}

export const liveAISClient = new LiveAISClient();
