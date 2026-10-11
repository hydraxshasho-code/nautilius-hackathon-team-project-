/**
 * NAUTILUS — AIS Worker Management Service
 * 
 * Provides an asynchronous worker-backed interface for AIS dead-reckoning extrapolation,
 * batch coordinate calculations, and spatial indexing.
 * 
 * Includes 100% resilient main-thread fallback if Web Workers are not supported or fail.
 */

import { WorkerVesselPosition } from '../workers/aisProcessingWorker';

class AISWorkerService {
  private worker: Worker | null = null;
  private isWorkerSupported = false;
  private pendingRequests = new Map<number, (val: any) => void>();
  private requestCounter = 0;
  private fallbackGrid = new Map<string, string[]>();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      this.isWorkerSupported = false;
      return;
    }

    try {
      this.worker = new Worker(new URL('../workers/aisProcessingWorker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent) => {
        const { id, result, candidateIds, error } = e.data || {};
        if (id && this.pendingRequests.has(id)) {
          const resolve = this.pendingRequests.get(id)!;
          this.pendingRequests.delete(id);
          if (error) {
            console.warn('[AISWorkerService] Worker reported error:', error);
          }
          resolve(result || candidateIds || null);
        }
      };

      this.worker.onerror = (err) => {
        console.warn('[AISWorkerService] Worker failure, switching to main-thread fallback:', err);
        this.terminate();
        this.isWorkerSupported = false;
      };

      this.isWorkerSupported = true;
    } catch (e) {
      console.warn('[AISWorkerService] Worker initialization unavailable, using main-thread fallback:', e);
      this.isWorkerSupported = false;
    }
  }

  public async extrapolatePositions(
    positions: WorkerVesselPosition[],
    dtHours: number
  ): Promise<WorkerVesselPosition[]> {
    if (!this.isWorkerSupported || !this.worker) {
      // Main-thread fallback
      return this.extrapolateFallback(positions, dtHours);
    }

    const reqId = ++this.requestCounter;
    return new Promise<WorkerVesselPosition[]>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        resolve(this.extrapolateFallback(positions, dtHours));
      }, 50);

      this.pendingRequests.set(reqId, (res) => {
        clearTimeout(timeout);
        resolve(res || this.extrapolateFallback(positions, dtHours));
      });

      this.worker!.postMessage({
        type: 'EXTRAPOLATE_POSITIONS',
        id: reqId,
        payload: { positions, dtHours },
      });
    });
  }

  private extrapolateFallback(
    positions: WorkerVesselPosition[],
    dtHours: number
  ): WorkerVesselPosition[] {
    const result: WorkerVesselPosition[] = [];
    for (let i = 0; i < positions.length; i++) {
      const v = positions[i];
      if (v.speed > 0.5) {
        const distNm = v.speed * dtHours;
        const rad = (v.heading * Math.PI) / 180;
        const latChange = (distNm * Math.cos(rad)) / 60;
        const nextLat = v.lat + latChange;
        const cosLat = Math.max(0.1, Math.cos((nextLat * Math.PI) / 180));
        const lonChange = (distNm * Math.sin(rad)) / (60 * cosLat);
        let nextLon = v.lon + lonChange;

        while (nextLon > 180) nextLon -= 360;
        while (nextLon < -180) nextLon += 360;

        result.push({
          id: v.id,
          lat: nextLat,
          lon: nextLon,
          heading: v.heading,
          speed: v.speed,
        });
      } else {
        result.push(v);
      }
    }
    return result;
  }

  public buildSpatialIndex(vessels: { id: string; lat: number; lon: number }[]): void {
    if (this.isWorkerSupported && this.worker) {
      this.worker.postMessage({
        type: 'BUILD_SPATIAL_INDEX',
        id: ++this.requestCounter,
        payload: { vessels },
      });
    }

    // Always maintain fast fallback index in sync
    this.fallbackGrid.clear();
    for (let i = 0; i < vessels.length; i++) {
      const v = vessels[i];
      const gx = Math.floor(v.lon / 5.0);
      const gy = Math.floor(v.lat / 5.0);
      const key = `${gx}:${gy}`;
      let cell = this.fallbackGrid.get(key);
      if (!cell) {
        cell = [];
        this.fallbackGrid.set(key, cell);
      }
      cell.push(v.id);
    }
  }

  public queryNearbyVesselIds(lon: number, lat: number, radiusDeg: number): string[] {
    const minGx = Math.floor((lon - radiusDeg) / 5.0);
    const maxGx = Math.floor((lon + radiusDeg) / 5.0);
    const minGy = Math.floor((lat - radiusDeg) / 5.0);
    const maxGy = Math.floor((lat + radiusDeg) / 5.0);

    const candidateIds: string[] = [];
    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        const cell = this.fallbackGrid.get(`${gx}:${gy}`);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            candidateIds.push(cell[i]);
          }
        }
      }
    }
    return candidateIds;
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

export const aisWorkerService = new AISWorkerService();
