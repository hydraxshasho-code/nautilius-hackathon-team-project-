/**
 * NAUTILUS — AIS Processing & Spatial Indexing Worker
 * 
 * Offloads heavy coordinate calculations, batch dead-reckoning extrapolation,
 * and 2D spatial grid indexing from the main browser thread.
 */

export interface WorkerVesselPosition {
  id: string;
  lat: number;
  lon: number;
  heading: number;
  speed: number;
}

export interface ExtrapolateParams {
  positions: WorkerVesselPosition[];
  dtHours: number;
}

export interface SpatialGridCell {
  key: string;
  vesselIds: string[];
}

// In-worker spatial grid index for fast range queries
const spatialGrid = new Map<string, string[]>();
const GRID_CELL_SIZE_DEG = 5.0; // 5 degree spatial grid bins

function getGridKey(lon: number, lat: number): string {
  const gx = Math.floor(lon / GRID_CELL_SIZE_DEG);
  const gy = Math.floor(lat / GRID_CELL_SIZE_DEG);
  return `${gx}:${gy}`;
}

self.onmessage = (e: MessageEvent) => {
  const { type, id, payload } = e.data || {};

  try {
    switch (type) {
      case 'EXTRAPOLATE_POSITIONS': {
        const { positions, dtHours } = payload as ExtrapolateParams;
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

        self.postMessage({ type: 'EXTRAPOLATE_RESULT', id, result });
        break;
      }

      case 'BUILD_SPATIAL_INDEX': {
        const { vessels } = payload as { vessels: { id: string; lat: number; lon: number }[] };
        spatialGrid.clear();

        for (let i = 0; i < vessels.length; i++) {
          const v = vessels[i];
          const key = getGridKey(v.lon, v.lat);
          let cell = spatialGrid.get(key);
          if (!cell) {
            cell = [];
            spatialGrid.set(key, cell);
          }
          cell.push(v.id);
        }

        self.postMessage({ type: 'SPATIAL_INDEX_READY', id, cellCount: spatialGrid.size });
        break;
      }

      case 'QUERY_NEARBY': {
        const { lon, lat, radiusDeg } = payload as { lon: number; lat: number; radiusDeg: number };
        const minGx = Math.floor((lon - radiusDeg) / GRID_CELL_SIZE_DEG);
        const maxGx = Math.floor((lon + radiusDeg) / GRID_CELL_SIZE_DEG);
        const minGy = Math.floor((lat - radiusDeg) / GRID_CELL_SIZE_DEG);
        const maxGy = Math.floor((lat + radiusDeg) / GRID_CELL_SIZE_DEG);

        const candidateIds: string[] = [];
        for (let gx = minGx; gx <= maxGx; gx++) {
          for (let gy = minGy; gy <= maxGy; gy++) {
            const cell = spatialGrid.get(`${gx}:${gy}`);
            if (cell) {
              for (let i = 0; i < cell.length; i++) {
                candidateIds.push(cell[i]);
              }
            }
          }
        }

        self.postMessage({ type: 'QUERY_NEARBY_RESULT', id, candidateIds });
        break;
      }

      default:
        break;
    }
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', id, error: err?.message || 'Worker processing error' });
  }
};
