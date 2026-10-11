import { AISProvider, NormalizedAISVessel, ProviderStatus } from '../types';
import { AISStreamProvider } from './AISStreamProvider';
import { MaritimeDirectoryProvider } from './MaritimeDirectoryProvider';

export class CompositeAISProvider implements AISProvider {
  public readonly name = 'COMPOSITE_AUTHORIZED_AIS';
  private streamProvider: AISStreamProvider;
  private directoryProvider: MaritimeDirectoryProvider;
  private trackedVessels: Map<string, NormalizedAISVessel> = new Map();
  private maxTrackedVessels = 1000;

  constructor() {
    this.streamProvider = new AISStreamProvider();
    this.directoryProvider = new MaritimeDirectoryProvider();
  }

  public async initialize(): Promise<void> {
    await Promise.all([
      this.streamProvider.initialize().catch((err) => console.warn('[AISStreamProvider init notice]', err.message)),
      this.directoryProvider.initialize().catch((err) => console.warn('[MaritimeDirectoryProvider init notice]', err.message)),
    ]);
  }

  public getInitialFleet(): NormalizedAISVessel[] {
    return this.directoryProvider.getAllRecords();
  }

  public async getVesselByIMO(imo: string): Promise<NormalizedAISVessel | null> {
    const clean = String(imo).trim().replace(/[^0-9]/g, '');
    if (!clean) return null;

    // Check directory resolution first for complete statutory profile
    let vessel = await this.directoryProvider.getVesselByIMO(clean);
    if (!vessel) {
      vessel = await this.streamProvider.getVesselByIMO(clean);
    }

    if (vessel) {
      this.trackedVessels.set(vessel.mmsi, vessel);
      if (vessel.imo) this.trackedVessels.set(vessel.imo, vessel);
    }
    return vessel;
  }

  public async getVesselByMMSI(mmsi: string): Promise<NormalizedAISVessel | null> {
    const clean = String(mmsi).trim().replace(/[^0-9]/g, '');
    if (!clean) return null;

    let vessel = await this.streamProvider.getVesselByMMSI(clean);
    if (!vessel) {
      vessel = await this.directoryProvider.getVesselByMMSI(clean);
    }

    if (vessel) {
      this.trackedVessels.set(vessel.mmsi, vessel);
      if (vessel.imo) this.trackedVessels.set(vessel.imo, vessel);
    }
    return vessel;
  }

  public async getFleet(identifiers: string[]): Promise<NormalizedAISVessel[]> {
    const results: NormalizedAISVessel[] = [];
    for (const id of identifiers.slice(0, this.maxTrackedVessels)) {
      const v = await this.getVesselByIMO(id) || await this.getVesselByMMSI(id);
      if (v) results.push(v);
    }
    return results;
  }

  public normalizeVessel(raw: any): NormalizedAISVessel | null {
    if (!raw) return null;
    return this.streamProvider.normalizeVessel(raw) || this.directoryProvider.normalizeVessel(raw);
  }

  public subscribeVessel(identifier: string, onUpdate: (vessel: NormalizedAISVessel) => void): () => void {
    const clean = String(identifier).trim().replace(/[^0-9]/g, '');

    // Forward updates to directory and stream providers
    const unsubs: Array<() => void> = [];

    const handleUpdate = (updated: NormalizedAISVessel) => {
      this.trackedVessels.set(updated.mmsi, updated);
      if (updated.imo) this.trackedVessels.set(updated.imo, updated);
      onUpdate(updated);
    };

    unsubs.push(this.directoryProvider.subscribeVessel(clean, handleUpdate));
    unsubs.push(this.streamProvider.subscribeVessel(clean, handleUpdate));

    if (clean.length === 7) {
      this.directoryProvider.getVesselByIMO(clean).then((v) => {
        if (v && v.mmsi && v.mmsi !== clean) {
          unsubs.push(this.streamProvider.subscribeVessel(v.mmsi, handleUpdate));
        }
      }).catch(() => {});
    } else if (clean.length === 9) {
      this.directoryProvider.getVesselByMMSI(clean).then((v) => {
        if (v && v.imo && v.imo !== clean) {
          unsubs.push(this.streamProvider.subscribeVessel(v.imo, handleUpdate));
        }
      }).catch(() => {});
    }

    return () => {
      for (const fn of unsubs) {
        try {
          fn();
        } catch {
          // ignore
        }
      }
    };
  }

  public onAnyVessel(onUpdate: (vessel: NormalizedAISVessel) => void): () => void {
    return this.streamProvider.onAnyVessel(onUpdate);
  }

  public getProviderStatus(): ProviderStatus {
    const streamStatus = this.streamProvider.getProviderStatus();
    const dirStatus = this.directoryProvider.getProviderStatus();

    const isConnected = streamStatus.connected || dirStatus.connected;
    return {
      name: streamStatus.connected ? 'AISSTREAM_LIVE' : 'MARITIME_REGISTRY_AUTHORIZED',
      connected: isConnected,
      activeTrackedCount: Math.min(this.trackedVessels.size, this.maxTrackedVessels),
      lastMessageTimestamp: streamStatus.lastMessageTimestamp || dirStatus.lastMessageTimestamp,
      error: streamStatus.connected ? null : streamStatus.error,
      authenticated: streamStatus.authenticated,
    };
  }

  public async dispose(): Promise<void> {
    await this.streamProvider.dispose?.();
    await this.directoryProvider.dispose?.();
  }
}
