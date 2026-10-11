import EventEmitter from 'events';
import { AISProvider, NormalizedAISVessel, ProviderStatus } from './types';
import { CompositeAISProvider } from './providers/CompositeAISProvider';

export class ServerAISService extends EventEmitter {
  private provider: AISProvider;
  private trackedVessels: Map<string, NormalizedAISVessel> = new Map();
  private liveFleet: Map<string, NormalizedAISVessel> = new Map();
  private pendingBroadcastQueue: Map<string, NormalizedAISVessel> = new Map();
  private subscriptions: Map<string, () => void> = new Map();
  private readonly maxTrackedVessels = 1000;
  private staleCheckTimer: NodeJS.Timeout | null = null;
  private broadcastTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.provider = new CompositeAISProvider();
  }

  public async initialize(): Promise<void> {
    await this.provider.initialize();

    // Prime initial baseline fleet from statutory directory
    if (this.provider instanceof CompositeAISProvider) {
      const initialFleet = this.provider.getInitialFleet();
      for (const v of initialFleet) {
        this.trackedVessels.set(v.mmsi, v);
        if (v.imo) this.trackedVessels.set(v.imo, v);
      }
    }

    // 100% Real-time global live AIS stream from AISStream.io (1000 real-time ships)
    this.provider.onAnyVessel?.((liveVessel) => {
      this.handleIncomingLiveVessel(liveVessel);
    });

    // Smooth batched broadcast timer: flushes updated ships every 1000ms
    this.broadcastTimer = setInterval(() => {
      this.flushBroadcastQueue();
    }, 1000);

    // Stale evaluation loop runs every 15 seconds
    this.staleCheckTimer = setInterval(() => {
      this.evaluateStaleData();
    }, 15000);
  }

  private handleIncomingLiveVessel(liveVessel: NormalizedAISVessel): void {
    if (!liveVessel || !liveVessel.position) return;
    const { latitude: lat, longitude: lon } = liveVessel.position;
    if (typeof lat !== 'number' || typeof lon !== 'number' || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) {
      return;
    }

    // Cache in live active fleet (up to 2000 live vessels)
    this.liveFleet.set(liveVessel.mmsi, liveVessel);
    if (this.liveFleet.size > 2000) {
      const firstKey = this.liveFleet.keys().next().value;
      if (firstKey) this.liveFleet.delete(firstKey);
    }

    // Register into tracked vessels up to 1000 live real-time ships
    const matchingKey = (liveVessel.imo && this.trackedVessels.has(liveVessel.imo))
      ? liveVessel.imo
      : (this.trackedVessels.has(liveVessel.mmsi) ? liveVessel.mmsi : null);

    if (matchingKey) {
      const existing = this.trackedVessels.get(matchingKey)!;
      const merged: NormalizedAISVessel = {
        ...existing,
        ...liveVessel,
        name: liveVessel.name && !liveVessel.name.startsWith('VESSEL-') ? liveVessel.name : existing.name,
        position: liveVessel.position,
        navigation: {
          ...existing.navigation,
          ...liveVessel.navigation,
        },
        status: 'LIVE',
        lastUpdatedSecondsAgo: 0,
        timestamp: liveVessel.timestamp,
        source: 'AISSTREAM_REALTIME',
      };
      this.trackedVessels.set(matchingKey, merged);
      this.trackedVessels.set(liveVessel.mmsi, merged);
      if (liveVessel.imo) this.trackedVessels.set(liveVessel.imo, merged);
      this.pendingBroadcastQueue.set(liveVessel.mmsi, merged);
    } else if (this.getTrackedVessels().length < this.maxTrackedVessels) {
      this.trackedVessels.set(liveVessel.mmsi, liveVessel);
      if (liveVessel.imo) this.trackedVessels.set(liveVessel.imo, liveVessel);
      this.pendingBroadcastQueue.set(liveVessel.mmsi, liveVessel);
    }
  }

  private flushBroadcastQueue(): void {
    if (this.pendingBroadcastQueue.size === 0) return;

    // Send up to 50 updated vessels in a single batch
    const batch = Array.from(this.pendingBroadcastQueue.values()).slice(0, 50);
    for (const v of batch) {
      this.pendingBroadcastQueue.delete(v.mmsi);
    }
    this.emit('vessel_batch', batch);
  }

  private evaluateStaleData(): void {
    let hasChanges = false;
    const now = Date.now();

    for (const [id, vessel] of this.trackedVessels.entries()) {
      const ts = new Date(vessel.timestamp).getTime();
      const ageSeconds = Math.max(0, Math.floor((now - ts) / 1000));
      vessel.lastUpdatedSecondsAgo = ageSeconds;

      const previousStatus = vessel.status;
      if (ageSeconds > 120) {
        vessel.status = 'STALE';
      } else {
        vessel.status = 'LIVE';
      }

      if (previousStatus !== vessel.status) {
        hasChanges = true;
        this.emit('vessel_update', vessel);
      }
    }

    if (hasChanges) {
      this.emit('tracked_list_change', this.getTrackedVessels());
    }
  }

  public async searchVessel(query: string): Promise<NormalizedAISVessel | null> {
    const q = String(query).trim().toLowerCase();
    if (!q) return null;
    const clean = q.replace(/[^0-9]/g, '');

    // 1. Search in actively streaming live fleet by MMSI, IMO, or Name
    for (const v of this.liveFleet.values()) {
      if ((clean && (v.mmsi === clean || v.imo === clean)) || v.name.toLowerCase().includes(q)) {
        return v;
      }
    }

    // 2. Search in tracked vessels
    for (const v of this.trackedVessels.values()) {
      if ((clean && (v.mmsi === clean || v.imo === clean)) || v.name.toLowerCase().includes(q)) {
        return v;
      }
    }

    if (!clean) return null;

    let found: NormalizedAISVessel | null = null;
    if (clean.length === 7) {
      found = await this.provider.getVesselByIMO(clean);
    }
    if (!found) {
      found = await this.provider.getVesselByMMSI(clean);
    }
    if (!found && clean.length !== 7) {
      found = await this.provider.getVesselByIMO(clean);
    }
    return found;
  }

  public async startTracking(identifier: string): Promise<{ success: boolean; vessel?: NormalizedAISVessel; message?: string }> {
    const clean = String(identifier).trim().replace(/[^0-9]/g, '');
    if (!clean) {
      return { success: false, message: 'Invalid vessel identifier (IMO or MMSI required)' };
    }

    if (this.trackedVessels.size >= this.maxTrackedVessels && !this.trackedVessels.has(clean)) {
      return {
        success: false,
        message: `Maximum tracked vessels capacity reached (${this.maxTrackedVessels} vessels). Remove a vessel to track another.`,
      };
    }

    // Resolve vessel
    const vessel = await this.searchVessel(clean);
    if (!vessel) {
      return { success: false, message: `Vessel with identifier ${clean} could not be resolved from authorized AIS feed.` };
    }

    const primaryKey = vessel.imo || vessel.mmsi;
    this.trackedVessels.set(primaryKey, vessel);
    this.trackedVessels.set(vessel.mmsi, vessel);

    // Unsubscribe prior if exists
    const priorUnsub = this.subscriptions.get(primaryKey);
    if (priorUnsub) {
      priorUnsub();
    }

    // Subscribe to live telemetry updates
    const unsub = this.provider.subscribeVessel(primaryKey, (updated) => {
      this.trackedVessels.set(primaryKey, updated);
      this.trackedVessels.set(updated.mmsi, updated);
      this.emit('vessel_update', updated);
    });

    this.subscriptions.set(primaryKey, unsub);
    this.emit('vessel_added', vessel);
    this.emit('tracked_list_change', this.getTrackedVessels());

    return { success: true, vessel };
  }

  public stopTracking(identifier: string): boolean {
    const clean = String(identifier).trim().replace(/[^0-9]/g, '');
    if (!clean) return false;

    // Find and remove matching vessel
    let removedId: string | null = null;
    let removedVessel: NormalizedAISVessel | null = null;

    for (const [key, v] of this.trackedVessels.entries()) {
      if (key === clean || v.imo === clean || v.mmsi === clean) {
        removedId = key;
        removedVessel = v;
        break;
      }
    }

    if (!removedId) return false;

    const unsub = this.subscriptions.get(removedId);
    if (unsub) {
      unsub();
      this.subscriptions.delete(removedId);
    }

    if (removedVessel) {
      if (removedVessel.imo) this.trackedVessels.delete(removedVessel.imo);
      if (removedVessel.mmsi) this.trackedVessels.delete(removedVessel.mmsi);
    }
    this.trackedVessels.delete(removedId);

    this.emit('vessel_removed', { id: clean, imo: removedVessel?.imo, mmsi: removedVessel?.mmsi });
    this.emit('tracked_list_change', this.getTrackedVessels());
    return true;
  }

  public getTrackedVessels(): NormalizedAISVessel[] {
    const unique = new Map<string, NormalizedAISVessel>();
    for (const v of this.trackedVessels.values()) {
      unique.set(v.mmsi, v);
    }
    // Augment with recent active live vessels from live stream
    for (const v of this.liveFleet.values()) {
      if (unique.size >= this.maxTrackedVessels) break;
      if (!unique.has(v.mmsi)) {
        unique.set(v.mmsi, v);
      }
    }
    return Array.from(unique.values()).slice(0, this.maxTrackedVessels);
  }

  public getProviderStatus(): ProviderStatus {
    const status = this.provider.getProviderStatus();
    status.activeTrackedCount = this.getTrackedVessels().length;
    return status;
  }

  public async dispose(): Promise<void> {
    if (this.staleCheckTimer) clearInterval(this.staleCheckTimer);
    if (this.broadcastTimer) clearInterval(this.broadcastTimer);
    for (const unsub of this.subscriptions.values()) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    this.subscriptions.clear();
    this.trackedVessels.clear();
    this.liveFleet.clear();
    await this.provider.dispose?.();
  }
}

export const serverAISService = new ServerAISService();
