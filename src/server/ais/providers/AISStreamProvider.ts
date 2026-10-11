import WebSocket from 'ws';
import { AISProvider, NormalizedAISVessel, ProviderStatus } from '../types';
import { validateAndSanitizeVessel } from '../validator';

/**
 * Real-time authorized WebSocket client for AISStream.io (wss://stream.aisstream.io/v0/stream)
 * Requires API key in AISSTREAM_API_KEY or AIS_API_KEY environment variable.
 */
export class AISStreamProvider implements AISProvider {
  public readonly name = 'AISSTREAM_IO';
  private ws: WebSocket | null = null;
  private apiKey: string = '';
  private trackedMmsis: Set<string> = new Set();
  private listeners: Map<string, Set<(v: NormalizedAISVessel) => void>> = new Map();
  private globalStreamListeners: Set<(v: NormalizedAISVessel) => void> = new Set();
  private vesselCache: Map<string, NormalizedAISVessel> = new Map();
  private isConnected: boolean = false;
  private lastMessageTimestamp: string | null = null;
  private lastError: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldRun: boolean = true;

  constructor() {
    this.apiKey = (process.env.AISSTREAM_API_KEY || process.env.AIS_API_KEY || '').trim();
  }

  public async initialize(): Promise<void> {
    if (!this.apiKey) {
      this.apiKey = (process.env.AISSTREAM_API_KEY || process.env.AIS_API_KEY || '').trim();
    }
    if (!this.apiKey) {
      this.lastError = 'AISStream API key not configured (set AISSTREAM_API_KEY in environment)';
      return;
    }
    this.connect();
  }

  private connect(): void {
    if (!this.apiKey) {
      this.apiKey = (process.env.AISSTREAM_API_KEY || process.env.AIS_API_KEY || '').trim();
    }
    if (!this.shouldRun || !this.apiKey) return;

    try {
      this.ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

      this.ws.on('open', () => {
        this.isConnected = true;
        this.lastError = null;
        this.sendSubscription();
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (err: Error) => {
        this.lastError = err.message;
        this.isConnected = false;
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        if (this.shouldRun) {
          this.scheduleReconnect();
        }
      });
    } catch (err: any) {
      this.lastError = err.message;
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  private sendSubscription(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.apiKey) return;

    // Ingest the real-time worldwide AIS stream across all oceans & corridors
    const subscription: any = {
      APIKey: this.apiKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    };

    console.log('[AISStreamProvider] 🌐 Subscribed to real-time global live AIS stream (all ships)');
    try {
      this.ws.send(JSON.stringify(subscription));
    } catch (e: any) {
      this.lastError = `Failed to send subscription: ${e.message}`;
    }
  }

  private handleMessage(rawData: WebSocket.RawData): void {
    try {
      const msg = JSON.parse(rawData.toString());
      this.lastMessageTimestamp = new Date().toISOString();

      const meta = msg.MetaData || {};
      const mmsi = String(meta.MMSI || meta.MMSI_String || '').trim();
      if (!mmsi) return;

      const messageType = msg.MessageType;
      const payload = msg.Message?.[messageType] || {};

      let existing = this.vesselCache.get(mmsi);
      const nowIso = new Date().toISOString();

      if (messageType === 'PositionReport') {
        const lat = payload.Latitude ?? meta.latitude;
        const lon = payload.Longitude ?? meta.longitude;
        const speed = payload.Sog;
        const course = payload.Cog;
        const heading = payload.TrueHeading;
        const navStatus = payload.NavigationalStatus;

        const updated: Partial<NormalizedAISVessel> = {
          imo: existing?.imo ?? null,
          mmsi,
          name: meta.ShipName || existing?.name || `VESSEL-${mmsi}`,
          callSign: existing?.callSign ?? null,
          type: existing?.type ?? null,
          flag: existing?.flag ?? null,
          flagCode: existing?.flagCode ?? null,
          length: existing?.length ?? null,
          beam: existing?.beam ?? null,
          owner: existing?.owner ?? null,
          operator: existing?.operator ?? null,
          beneficialOwner: existing?.beneficialOwner ?? null,
          manager: existing?.manager ?? null,
          position: { latitude: lat, longitude: lon },
          navigation: {
            speed: speed !== undefined ? speed : existing?.navigation.speed ?? null,
            course: course !== undefined ? course : existing?.navigation.course ?? null,
            heading: heading !== undefined ? heading : existing?.navigation.heading ?? null,
            draught: existing?.navigation.draught ?? null,
            navigationStatus: navStatus !== undefined ? navStatus : existing?.navigation.navigationStatus ?? null,
          },
          voyage: {
            destination: existing?.voyage.destination ?? null,
            eta: existing?.voyage.eta ?? null,
          },
          source: 'AISSTREAM_REALTIME',
          timestamp: meta.time_utc ? new Date(meta.time_utc).toISOString() : nowIso,
          status: 'LIVE',
          lastUpdatedSecondsAgo: 0,
        };

        const validated = validateAndSanitizeVessel(updated);
        if (validated) {
          this.vesselCache.set(mmsi, validated);
          this.notifySubscribers(mmsi, validated);
        }
      } else if (messageType === 'ShipStaticData') {
        const imo = payload.ImoNumber ? String(payload.ImoNumber) : existing?.imo ?? null;
        const name = payload.ShipName || meta.ShipName || existing?.name || `VESSEL-${mmsi}`;
        const destination = payload.Destination || existing?.voyage.destination || null;
        const draught = payload.Draught ? payload.Draught / 10 : existing?.navigation.draught ?? null;
        const callSign = payload.CallSign || existing?.callSign || null;

        if (existing) {
          existing.imo = imo;
          existing.name = name.trim().toUpperCase();
          if (destination) existing.voyage.destination = destination.trim().toUpperCase();
          if (draught) existing.navigation.draught = draught;
          if (callSign) existing.callSign = callSign;
          this.notifySubscribers(mmsi, existing);
        }
      }
    } catch {
      // Ignore malformed individual packet
    }
  }

  private notifySubscribers(mmsi: string, vessel: NormalizedAISVessel): void {
    const subs = this.listeners.get(mmsi);
    if (subs) {
      for (const cb of subs) {
        cb(vessel);
      }
    }
    if (vessel.imo) {
      const imoSubs = this.listeners.get(vessel.imo);
      if (imoSubs) {
        for (const cb of imoSubs) {
          cb(vessel);
        }
      }
    }
    for (const cb of this.globalStreamListeners) {
      cb(vessel);
    }
  }

  public onAnyVessel(callback: (vessel: NormalizedAISVessel) => void): () => void {
    this.globalStreamListeners.add(callback);
    return () => {
      this.globalStreamListeners.delete(callback);
    };
  }

  public async getVesselByIMO(imo: string): Promise<NormalizedAISVessel | null> {
    for (const v of this.vesselCache.values()) {
      if (v.imo === imo) return v;
    }
    return null;
  }

  public async getVesselByMMSI(mmsi: string): Promise<NormalizedAISVessel | null> {
    return this.vesselCache.get(mmsi) || null;
  }

  public async getFleet(identifiers: string[]): Promise<NormalizedAISVessel[]> {
    const result: NormalizedAISVessel[] = [];
    for (const id of identifiers) {
      const v = this.vesselCache.get(id);
      if (v) result.push(v);
    }
    return result;
  }

  public normalizeVessel(raw: any): NormalizedAISVessel | null {
    if (!raw) return null;
    return validateAndSanitizeVessel(raw);
  }

  public subscribeVessel(identifier: string, onUpdate: (vessel: NormalizedAISVessel) => void): () => void {
    const clean = identifier.replace(/[^0-9]/g, '');
    this.trackedMmsis.add(clean);

    let subs = this.listeners.get(clean);
    if (!subs) {
      subs = new Set();
      this.listeners.set(clean, subs);
    }
    subs.add(onUpdate);

    // Update filter subscription on WebSocket
    this.sendSubscription();

    return () => {
      subs?.delete(onUpdate);
      if (subs && subs.size === 0) {
        this.listeners.delete(clean);
        this.trackedMmsis.delete(clean);
        this.sendSubscription();
      }
    };
  }

  public getProviderStatus(): ProviderStatus {
    return {
      name: this.name,
      connected: this.isConnected,
      activeTrackedCount: this.trackedMmsis.size,
      lastMessageTimestamp: this.lastMessageTimestamp,
      error: this.lastError,
      authenticated: Boolean(this.apiKey),
    };
  }

  public async dispose(): Promise<void> {
    this.shouldRun = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
