import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Vessel, RiskLevel } from '../../types/maritime';
import {
  MAJOR_SHIPPING_LANES,
  MAJOR_PORTS,
  MARITIME_RISK_ZONES,
  SANCTIONED_ZONES,
  WEATHER_SYSTEMS,
  MARITIME_CHOKEPOINTS,
} from '../../data/maritimeMapData';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Compass,
  Layers,
  Globe,
  Map as MapIcon,
  ShieldAlert,
  Anchor,
  Activity,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Ship,
  Plus,
  Trash2,
  Play,
  Pause,
  Search,
  X,
  Crosshair,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Sliders,
  Wind,
  CloudRain,
  AlertOctagon,
  Check,
  Eye,
  EyeOff,
  Pentagon,
  Radio,
} from 'lucide-react';
import { aisStreamService } from '../../services/aisStreamService';
import { liveAISClient } from '../../services/liveAisClient';
import { geofenceService, GeofenceZone, LatLng } from '../../services/geofenceService';
import { MapLayersControlPanel } from './MapLayersControlPanel';
import { GeofenceManagerModal } from './GeofenceManagerModal';
import { SaveGeofenceModal } from './SaveGeofenceModal';
import { getWorldMapGeoData } from '../../services/worldMapGeoService';

interface TacticalMaritimeMapProps {
  vessels: Vessel[];
  selectedVesselId: string | null;
  onSelectVessel: (vesselId: string) => void;
  className?: string;
  allowFullscreen?: boolean;
  onAddVesselClick?: () => void;
  onRemoveVesselClick?: (vesselId: string) => void;
  onOpenDossier?: (vesselId: string) => void;
}

// ---------------------------------------------------------------------------
// High-Performance Offscreen Buffers & Coordinate Projections
// ---------------------------------------------------------------------------

function createOffscreenBuffer(width: number, height: number): { canvas: any; ctx: CanvasRenderingContext2D } | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const oc = new OffscreenCanvas(width, height);
      const ctx = oc.getContext('2d');
      if (ctx) return { canvas: oc, ctx: ctx as any };
    } catch {
      // Fallback below
    }
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (ctx) return { canvas: c, ctx };
  }
  return null;
}

// Pre-rendered 90x90 radial heatmap blur sprite to replace 1,000 createRadialGradient calls per frame
let cachedHeatmapSprite: any = null;
function getHeatmapSprite(): any {
  if (cachedHeatmapSprite) return cachedHeatmapSprite;
  const buf = createOffscreenBuffer(90, 90);
  if (!buf) return null;
  const { canvas, ctx } = buf;
  const hGrad = ctx.createRadialGradient(45, 45, 4, 45, 45, 45);
  hGrad.addColorStop(0, 'rgba(239, 68, 68, 0.7)');
  hGrad.addColorStop(0.4, 'rgba(245, 158, 11, 0.3)');
  hGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
  ctx.fillStyle = hGrad;
  ctx.beginPath();
  ctx.arc(45, 45, 45, 0, Math.PI * 2);
  ctx.fill();
  cachedHeatmapSprite = canvas;
  return canvas;
}

function project2DCoord(
  lon: number,
  lat: number,
  width: number,
  height: number,
  centerLon: number,
  centerLat: number,
  zoom: number
): [number, number] {
  let dLon = lon - centerLon;
  while (dLon > 180) dLon -= 360;
  while (dLon < -180) dLon += 360;

  const scale = (width / 360) * zoom;
  const x = width / 2 + dLon * scale;
  const y = height / 2 - (lat - centerLat) * scale * 1.08;
  return [x, y];
}

function project3DGlobeCoord(
  lon: number,
  lat: number,
  width: number,
  height: number,
  globeRotationLon: number,
  globeRotationLat: number,
  zoom: number
): [number, number, boolean] {
  const radius = Math.min(width, height) * 0.42 * (zoom / 1.6);
  const cx = width / 2;
  const cy = height / 2;

  const lambda = ((lon - globeRotationLon) * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const rotPhi = (globeRotationLat * Math.PI) / 180;

  const x = Math.cos(phi) * Math.sin(lambda);
  const y = Math.sin(phi) * Math.cos(rotPhi) - Math.cos(phi) * Math.cos(lambda) * Math.sin(rotPhi);
  const z = Math.sin(phi) * Math.sin(rotPhi) + Math.cos(phi) * Math.cos(lambda) * Math.cos(rotPhi);

  const isVisible = z > 0.05;
  return [cx + x * radius, cy - y * radius, isVisible];
}

function drawStaticChart2D(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number,
  centerLon: number,
  centerLat: number,
  mapBearing: number,
  showLanes: boolean,
  showPorts: boolean,
  showGraticule: boolean,
  worldGeoData: any
) {
  // Ocean bathymetry background gradient
  const bathy = ctx.createLinearGradient(0, 0, 0, height);
  bathy.addColorStop(0, '#071322');
  bathy.addColorStop(0.5, '#09192e');
  bathy.addColorStop(1, '#06111e');
  ctx.fillStyle = bathy;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  if (mapBearing !== 0) {
    ctx.translate(width / 2, height / 2);
    ctx.rotate((mapBearing * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);
  }

  // Graticules (Nautical Grid lines)
  if (showGraticule) {
    ctx.strokeStyle = 'rgba(30, 58, 92, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 4]);

    for (let lat = -80; lat <= 80; lat += 20) {
      const [, y] = project2DCoord(0, lat, width, height, centerLon, centerLat, zoom);
      if (y >= 0 && y <= height) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(100, 116, 139, 0.6)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(`${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}`, 8, y - 3);
      }
    }

    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = project2DCoord(lon, 0, width, height, centerLon, centerLat, zoom);
      if (x >= 0 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.fillStyle = 'rgba(100, 116, 139, 0.6)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(`${Math.abs(lon)}°${lon >= 0 ? 'E' : 'W'}`, x + 4, height - 8);
      }
    }
    ctx.setLineDash([]);
  }

  // 1. Draw Landmasses with precise Natural Earth vector contours (50m resolution)
  ctx.fillStyle = '#0c1b2d';
  ctx.strokeStyle = '#1e3e66';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const landRings = worldGeoData.landRings;
  const bboxes = worldGeoData.landRingsBBox;
  const canCull = zoom >= 2.0 && bboxes && bboxes.length === landRings.length;
  const latSpan = 180 / (zoom * 1.08);
  const minVisLat = centerLat - latSpan * 0.6;
  const maxVisLat = centerLat + latSpan * 0.6;

  for (let rIdx = 0; rIdx < landRings.length; rIdx++) {
    if (canCull) {
      const [, bMinLat, , bMaxLat] = bboxes[rIdx];
      if (bMaxLat < minVisLat || bMinLat > maxVisLat) {
        continue;
      }
    }
    const ring = landRings[rIdx];
    let started = false;
    let prevLon = 0;
    let prevX = 0;
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      const [x, y] = project2DCoord(lon, lat, width, height, centerLon, centerLat, zoom);
      if (!started || Math.abs(lon - prevLon) > 120 || Math.abs(x - prevX) > width * 0.45) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
      prevLon = lon;
      prevX = x;
    }
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  // 2. High-precision Vector Coastlines (ocean-land boundaries)
  ctx.strokeStyle = '#1e40af';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const line of worldGeoData.coastlines) {
    let started = false;
    let prevLon = 0;
    let prevX = 0;
    for (let i = 0; i < line.length; i++) {
      const [lon, lat] = line[i];
      const [x, y] = project2DCoord(lon, lat, width, height, centerLon, centerLat, zoom);
      if (!started || Math.abs(lon - prevLon) > 120 || Math.abs(x - prevX) > width * 0.45) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
      prevLon = lon;
      prevX = x;
    }
  }
  ctx.stroke();

  // 3. Accurate International Country Borders for ALL 241 countries
  ctx.strokeStyle = 'rgba(30, 58, 95, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const border of worldGeoData.allCountryBorders) {
    let started = false;
    let prevLon = 0;
    let prevX = 0;
    for (let i = 0; i < border.length; i++) {
      const [lon, lat] = border[i];
      const [x, y] = project2DCoord(lon, lat, width, height, centerLon, centerLat, zoom);
      if (!started || Math.abs(lon - prevLon) > 120 || Math.abs(x - prevX) > width * 0.45) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
      prevLon = lon;
      prevX = x;
    }
  }
  ctx.stroke();

  // High-visibility international interior border lines (187 shared borders, 19,000+ points across all middle continents)
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (const border of worldGeoData.internalBorderLines) {
    let started = false;
    let prevLon = 0;
    let prevX = 0;
    for (let i = 0; i < border.length; i++) {
      const [lon, lat] = border[i];
      const [x, y] = project2DCoord(lon, lat, width, height, centerLon, centerLat, zoom);
      if (!started || Math.abs(lon - prevLon) > 120 || Math.abs(x - prevX) > width * 0.45) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
      prevLon = lon;
      prevX = x;
    }
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  for (const border of worldGeoData.internalBorderLines) {
    let started = false;
    let prevLon = 0;
    let prevX = 0;
    for (let i = 0; i < border.length; i++) {
      const [lon, lat] = border[i];
      const [x, y] = project2DCoord(lon, lat, width, height, centerLon, centerLat, zoom);
      if (!started || Math.abs(lon - prevLon) > 120 || Math.abs(x - prevX) > width * 0.45) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
      prevLon = lon;
      prevX = x;
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 4. Accurate Country Labels for ALL countries at exact geographic centers
  if (zoom >= 1.3) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of worldGeoData.countryFeatures) {
      const [x, y] = project2DCoord(c.center[0], c.center[1], width, height, centerLon, centerLat, zoom);
      if (x >= -80 && x <= width + 80 && y >= -40 && y <= height + 40) {
        const labelText = c.name.toUpperCase();
        ctx.font = zoom >= 2.4 ? 'bold 10px "JetBrains Mono", monospace' : '9px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
        ctx.fillRect(x - textWidth / 2 - 3, y - 6, textWidth + 6, 12);

        ctx.fillStyle = 'rgba(224, 242, 254, 0.9)';
        ctx.fillText(labelText, x, y);
      }
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // Shipping corridors
  if (showLanes) {
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    for (const lane of MAJOR_SHIPPING_LANES) {
      ctx.beginPath();
      let started = false;
      for (const [lon, lat] of lane.coordinates) {
        const [x, y] = project2DCoord(lon, lat, width, height, centerLon, centerLat, zoom);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      if (zoom >= 1.8 && lane.coordinates.length > 2) {
        const mid = lane.coordinates[Math.floor(lane.coordinates.length / 2)];
        const [mx, my] = project2DCoord(mid[0], mid[1], width, height, centerLon, centerLat, zoom);
        if (mx >= 0 && mx <= width && my >= 0 && my <= height) {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.85)';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText(`≋ ${lane.name}`, mx + 6, my - 4);
        }
      }
    }
    ctx.setLineDash([]);
  }

  // Major Strategic Maritime Chokepoints (Canals, Straits, Passes)
  if (zoom >= 1.25) {
    for (const cp of MARITIME_CHOKEPOINTS) {
      const [cx, cy] = project2DCoord(cp.lon, cp.lat, width, height, centerLon, centerLat, zoom);
      if (cx >= -20 && cx <= width + 20 && cy >= -20 && cy <= height + 20) {
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        const tw = ctx.measureText(cp.name).width;
        ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.fillRect(cx - tw / 2 - 3, cy - 14, tw + 6, 12);
        ctx.strokeRect(cx - tw / 2 - 3, cy - 14, tw + 6, 12);

        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.fillText(cp.name, cx, cy - 5);
        ctx.textAlign = 'start';
      }
    }
  }

  // Major ports in 2D
  if (showPorts) {
    for (const port of MAJOR_PORTS) {
      const [px, py] = project2DCoord(port.lon, port.lat, width, height, centerLon, centerLat, zoom);
      if (px >= -20 && px <= width + 20 && py >= -20 && py <= height + 20) {
        ctx.fillStyle = '#06b6d4';
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (zoom >= 1.8) {
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '10px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(`${port.name} (${port.code})`, px + 7, py + 3);
        }
      }
    }
  }

  ctx.restore();
}

function drawStaticGlobe3D(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number,
  globeRotationLon: number,
  globeRotationLat: number,
  showLanes: boolean,
  showPorts: boolean,
  worldGeoData: any
) {
  const globeRadius = Math.min(width, height) * 0.42 * (zoom / 1.6);
  const cx = width / 2;
  const cy = height / 2;

  // Atmosphere outer glow
  const glowGrad = ctx.createRadialGradient(cx, cy, globeRadius * 0.9, cx, cy, globeRadius * 1.15);
  glowGrad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
  glowGrad.addColorStop(0.5, 'rgba(14, 116, 144, 0.1)');
  glowGrad.addColorStop(1, 'rgba(6, 13, 23, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, globeRadius * 1.15, 0, Math.PI * 2);
  ctx.fill();

  // Globe sphere ocean background
  const oceanGrad = ctx.createRadialGradient(cx - globeRadius * 0.3, cy - globeRadius * 0.3, globeRadius * 0.1, cx, cy, globeRadius);
  oceanGrad.addColorStop(0, '#0a223a');
  oceanGrad.addColorStop(0.7, '#071626');
  oceanGrad.addColorStop(1, '#040b14');
  ctx.fillStyle = oceanGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
  ctx.fill();

  // Clip inside globe sphere
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
  ctx.clip();

  // Draw graticules (lat/lon lines)
  ctx.strokeStyle = 'rgba(30, 58, 92, 0.35)';
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath();
    let first = true;
    for (let lon = -180; lon <= 180; lon += 6) {
      const [gx, gy, vis] = project3DGlobeCoord(lon, lat, width, height, globeRotationLon, globeRotationLat, zoom);
      if (vis) {
        if (first) {
          ctx.moveTo(gx, gy);
          first = false;
        } else {
          ctx.lineTo(gx, gy);
        }
      } else {
        first = true;
      }
    }
    ctx.stroke();
  }

  // Draw precise world landmasses in 3D
  ctx.fillStyle = '#0f2238';
  ctx.strokeStyle = '#1e426f';
  ctx.lineWidth = 1.2;
  for (const ring of worldGeoData.landRings) {
    ctx.beginPath();
    let started = false;
    let prevLon = 0;
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      const [gx, gy, vis] = project3DGlobeCoord(lon, lat, width, height, globeRotationLon, globeRotationLat, zoom);
      if (vis && (!started || Math.abs(lon - prevLon) < 180)) {
        if (!started) {
          ctx.moveTo(gx, gy);
          started = true;
        } else {
          ctx.lineTo(gx, gy);
        }
      } else {
        started = false;
      }
      prevLon = lon;
    }
    if (started) {
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // Draw all accurate international country borders in 3D
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  for (const border of worldGeoData.internalBorderLines) {
    ctx.beginPath();
    let started = false;
    let prevLon = 0;
    for (let i = 0; i < border.length; i++) {
      const [lon, lat] = border[i];
      const [gx, gy, vis] = project3DGlobeCoord(lon, lat, width, height, globeRotationLon, globeRotationLat, zoom);
      if (vis && (!started || Math.abs(lon - prevLon) < 180)) {
        if (!started) {
          ctx.moveTo(gx, gy);
          started = true;
        } else {
          ctx.lineTo(gx, gy);
        }
      } else {
        started = false;
      }
      prevLon = lon;
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Draw Country Labels in 3D
  if (zoom >= 1.5) {
    ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const c of worldGeoData.countryFeatures) {
      const [gx, gy, vis] = project3DGlobeCoord(c.center[0], c.center[1], width, height, globeRotationLon, globeRotationLat, zoom);
      if (vis) {
        ctx.fillText(c.name.toUpperCase(), gx, gy);
      }
    }
    ctx.textAlign = 'start';
  }

  // Shipping lanes on 3D globe
  if (showLanes) {
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    for (const lane of MAJOR_SHIPPING_LANES) {
      ctx.beginPath();
      let started = false;
      for (const [lon, lat] of lane.coordinates) {
        const [gx, gy, vis] = project3DGlobeCoord(lon, lat, width, height, globeRotationLon, globeRotationLat, zoom);
        if (vis) {
          if (!started) {
            ctx.moveTo(gx, gy);
            started = true;
          } else {
            ctx.lineTo(gx, gy);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Major ports on 3D globe
  if (showPorts) {
    for (const port of MAJOR_PORTS) {
      const [px, py, vis] = project3DGlobeCoord(port.lon, port.lat, width, height, globeRotationLon, globeRotationLat, zoom);
      if (vis) {
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        if (zoom >= 2) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText(port.code, px + 5, py + 3);
        }
      }
    }
  }

  ctx.restore();
}

export const TacticalMaritimeMap: React.FC<TacticalMaritimeMapProps> = ({
  vessels,
  selectedVesselId,
  onSelectVessel,
  className = '',
  allowFullscreen = true,
  onAddVesselClick,
  onRemoveVesselClick,
  onOpenDossier,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const worldGeoData = useRef(getWorldMapGeoData()).current;

  // Map state
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1.6);
  const [centerLon, setCenterLon] = useState<number>(30); // Centered towards Afro-Eurasia / Suez / Indian Ocean
  const [centerLat, setCenterLat] = useState<number>(20);
  const [globeRotationLon, setGlobeRotationLon] = useState<number>(45);
  const [globeRotationLat, setGlobeRotationLat] = useState<number>(20);
  const [mapBearing, setMapBearing] = useState<number>(0); // 2D rotation bearing in degrees (0 = North up)
  const [isAutoSpinning, setIsAutoSpinning] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const lastPointerRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const [hoveredVessel, setHoveredVessel] = useState<Vessel | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Simulation controls state
  const [isPaused, setIsPaused] = useState<boolean>(aisStreamService.getIsPaused());
  const [simSpeed, setSimSpeed] = useState<number>(aisStreamService.getSpeedMultiplier());
  const [isFleetDrawerOpen, setIsFleetDrawerOpen] = useState<boolean>(false);
  const [drawerSearch, setDrawerSearch] = useState<string>('');
  const [drawerRiskFilter, setDrawerRiskFilter] = useState<string>('ALL');
  const [isHudDismissed, setIsHudDismissed] = useState<boolean>(false);

  // Layers
  const [showSanctionedZones, setShowSanctionedZones] = useState<boolean>(true);
  const [showWeather, setShowWeather] = useState<boolean>(true);
  const [showLanes, setShowLanes] = useState<boolean>(true);
  const [showPorts, setShowPorts] = useState<boolean>(true);
  const [showRiskZones, setShowRiskZones] = useState<boolean>(true);
  const [showWakeTrails, setShowWakeTrails] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showGraticule, setShowGraticule] = useState<boolean>(true);
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState<boolean>(false);
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [autoTrackTarget, setAutoTrackTarget] = useState<boolean>(false);
  const [isTrueNorthLocked, setIsTrueNorthLocked] = useState<boolean>(false);
  const [aisConnState, setAisConnState] = useState<'Connected' | 'Disconnected' | 'Reconnecting'>(() =>
    liveAISClient.getConnectionState()
  );

  useEffect(() => {
    const unsub = liveAISClient.subscribeConnectionState((state) => {
      setAisConnState(state);
    });
    return unsub;
  }, []);

  // Geofence states
  const [geofenceZones, setGeofenceZones] = useState<GeofenceZone[]>(geofenceService.getZones());
  const [showGeofences, setShowGeofences] = useState<boolean>(true);
  const [isGeofenceManagerOpen, setIsGeofenceManagerOpen] = useState<boolean>(false);
  const [isDrawingGeofence, setIsDrawingGeofence] = useState<boolean>(false);
  const [drawnVertices, setDrawnVertices] = useState<LatLng[]>([]);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);
  const [isSaveGeofenceModalOpen, setIsSaveGeofenceModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsub = geofenceService.subscribe((updated) => {
      setGeofenceZones(updated);
    });
    return unsub;
  }, []);

  // Animation frame
  const animFrameRef = useRef<number | null>(null);
  const pulseRef = useRef<number>(0);

  // Interpolated vessel positions for smooth 60fps movement (tracking both COG movement vector and HDG bow orientation)
  const interpolatedPositions = useRef<Map<string, { lat: number; lon: number; heading: number; course: number }>>(new Map());
  const vesselsRef = useRef<Vessel[]>(vessels);

  // Auto-spinning controllers: strictly decoupled to maintain smooth 60 FPS rotation without React state thrashing
  const isAutoSpinningRef = useRef<boolean>(false);
  const isSpinSuspendedRef = useRef<boolean>(false);
  const lastSpinInteractionEndRef = useRef<number>(0);

  // Keep vesselsRef synchronized and update interpolation targets
  useEffect(() => {
    vesselsRef.current = vessels;
    for (const v of vessels) {
      const vCourse = v.course ?? (v.heading ?? 0);
      const vHdg = (v.heading !== null && v.heading !== undefined && v.heading !== 511) ? v.heading : vCourse;
      if (!interpolatedPositions.current.has(v.id)) {
        interpolatedPositions.current.set(v.id, { lat: v.lat, lon: v.lon, heading: vHdg, course: vCourse });
      }
    }
  }, [vessels]);

  // Decoupled authoritative camera state for 60fps rendering without React state thrashing
  const cameraRef = useRef({
    zoom: 1.6,
    centerLon: 30,
    centerLat: 20,
    globeRotationLon: 45,
    globeRotationLat: 20,
    mapBearing: 0,
    isDragging: false,
    isAutoSpinning: false,
  });

  // Keep cameraRef in sync with state changes when not actively interacting or auto-spinning
  useEffect(() => {
    if (!cameraRef.current.isDragging && !isAutoSpinningRef.current) {
      cameraRef.current.zoom = zoom;
      cameraRef.current.centerLon = centerLon;
      cameraRef.current.centerLat = centerLat;
      cameraRef.current.globeRotationLon = globeRotationLon;
      cameraRef.current.globeRotationLat = globeRotationLat;
      cameraRef.current.mapBearing = mapBearing;
    }
  }, [zoom, centerLon, centerLat, globeRotationLon, globeRotationLat, mapBearing]);

  // Static background layer cache key and render routine
  const staticLayerKeyRef = useRef<string>('');

  const renderStaticLayer = useCallback((width: number, height: number, dpr: number) => {
    const staticCanvas = staticCanvasRef.current;
    if (!staticCanvas) return;
    const staticCtx = staticCanvas.getContext('2d');
    if (!staticCtx) return;

    staticCtx.save();
    staticCtx.scale(dpr, dpr);

    // 1. Clear background
    staticCtx.fillStyle = '#060d17';
    staticCtx.fillRect(0, 0, width, height);

    const cam = cameraRef.current;
    if (is3DMode) {
      drawStaticGlobe3D(
        staticCtx,
        width,
        height,
        cam.zoom,
        cam.globeRotationLon,
        cam.globeRotationLat,
        showLanes,
        showPorts,
        worldGeoData
      );
    } else {
      drawStaticChart2D(
        staticCtx,
        width,
        height,
        cam.zoom,
        cam.centerLon,
        cam.centerLat,
        cam.mapBearing,
        showLanes,
        showPorts,
        showGraticule,
        worldGeoData
      );
    }

    staticCtx.restore();
  }, [is3DMode, showLanes, showPorts, showGraticule, worldGeoData]);

  // Spatial indexing for high-speed hover / click queries
  const spatialIndex = useRef<{ grid: Map<string, Vessel[]>; cellSizeDeg: number }>({
    grid: new Map(),
    cellSizeDeg: 10,
  });

  useEffect(() => {
    const grid = spatialIndex.current.grid;
    grid.clear();
    const cellSize = spatialIndex.current.cellSizeDeg;
    for (let i = 0; i < vessels.length; i++) {
      const v = vessels[i];
      const gx = Math.floor(v.lon / cellSize);
      const gy = Math.floor(v.lat / cellSize);
      const key = `${gx}:${gy}`;
      let list = grid.get(key);
      if (!list) {
        list = [];
        grid.set(key, list);
      }
      list.push(v);
    }
  }, [vessels]);

  // Throttled camera sync to React state with diff-bailout so HUD updates without choking React
  const lastStateSyncRef = useRef<number>(0);
  const syncCameraToState = useCallback((immediate = false) => {
    const now = performance.now();
    if (!immediate && now - lastStateSyncRef.current < 200) {
      return;
    }
    lastStateSyncRef.current = now;
    const cam = cameraRef.current;
    if (immediate) {
      setCenterLon(cam.centerLon);
      setCenterLat(cam.centerLat);
      setGlobeRotationLon(cam.globeRotationLon);
      setGlobeRotationLat(cam.globeRotationLat);
      setMapBearing(cam.mapBearing);
    } else {
      setCenterLon((prev) => (Math.abs(prev - cam.centerLon) > 0.05 ? cam.centerLon : prev));
      setCenterLat((prev) => (Math.abs(prev - cam.centerLat) > 0.05 ? cam.centerLat : prev));
      setGlobeRotationLon((prev) => (Math.abs(prev - cam.globeRotationLon) > 0.1 ? cam.globeRotationLon : prev));
      setGlobeRotationLat((prev) => (Math.abs(prev - cam.globeRotationLat) > 0.1 ? cam.globeRotationLat : prev));
      setMapBearing((prev) => (Math.abs(prev - cam.mapBearing) > 0.1 ? cam.mapBearing : prev));
    }
  }, []);

  const prevSelectedVesselRef = useRef<string | null>(null);

  // Center on selected vessel ONLY when explicitly requested, then release lock so user view is NEVER trapped
  useEffect(() => {
    if (selectedVesselId && autoTrackTarget && prevSelectedVesselRef.current !== selectedVesselId) {
      prevSelectedVesselRef.current = selectedVesselId;
      setIsHudDismissed(false);
      const v = vessels.find((item) => item.id === selectedVesselId);
      if (v) {
        setCenterLon(v.lon);
        setCenterLat(v.lat);
        setGlobeRotationLon(v.lon);
        setGlobeRotationLat(v.lat);
        cameraRef.current.centerLon = v.lon;
        cameraRef.current.centerLat = v.lat;
        cameraRef.current.globeRotationLon = v.lon;
        cameraRef.current.globeRotationLat = v.lat;
        cameraRef.current.zoom = Math.max(2.4, cameraRef.current.zoom);
        setZoom((z) => Math.max(2.4, z));
      }
      // Release immediately so user retains full navigation and zoom control
      setAutoTrackTarget(false);
    }
  }, [selectedVesselId, autoTrackTarget, vessels]);

  // Screen coordinate projection functions
  const project2D = useCallback(
    (lon: number, lat: number, width: number, height: number): [number, number] => {
      return project2DCoord(lon, lat, width, height, cameraRef.current.centerLon, cameraRef.current.centerLat, cameraRef.current.zoom);
    },
    []
  );

  const unproject2D = useCallback(
    (x: number, y: number, width: number, height: number): [number, number] => {
      const cam = cameraRef.current;
      const scale = (width / 360) * cam.zoom;
      const lon = (x - width / 2) / scale + cam.centerLon;
      const lat = (height / 2 - y) / (scale * 1.08) + cam.centerLat;
      return [lon, lat];
    },
    []
  );

  const project3DGlobe = useCallback(
    (lon: number, lat: number, width: number, height: number): [number, number, boolean] => {
      return project3DGlobeCoord(
        lon,
        lat,
        width,
        height,
        cameraRef.current.globeRotationLon,
        cameraRef.current.globeRotationLat,
        cameraRef.current.zoom
      );
    },
    []
  );

  // Canvas render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    pulseRef.current = (pulseRef.current + 0.04) % (Math.PI * 2);

    // Smoothly ease interpolated vessel positions towards true positions & extrapolate when signal interrupted
    const isSignalInterrupted = aisConnState !== 'Connected';
    for (const v of vessels) {
      const curr = interpolatedPositions.current.get(v.id);
      if (curr) {
        const targetCourse = v.course ?? (v.heading ?? 0);
        const targetHeading = (v.heading !== null && v.heading !== undefined && v.heading !== 511) ? v.heading : targetCourse;

        if (isSignalInterrupted && v.speed > 0.5 && !isPaused) {
          // Dead-reckoning kinematic extrapolation per frame using COG (Course Over Ground)
          const dtHours = (16 / 3600000) * simSpeed * 40;
          const distNm = v.speed * dtHours;
          const cogRad = (curr.course * Math.PI) / 180;
          curr.lat += (distNm * Math.cos(cogRad)) / 60;
          curr.lon += (distNm * Math.sin(cogRad)) / (60 * Math.max(0.1, Math.cos((curr.lat * Math.PI) / 180)));
        } else {
          // Linear interpolation towards target coords
          curr.lat += (v.lat - curr.lat) * 0.12;
          curr.lon += (v.lon - curr.lon) * 0.12;
          curr.heading += (targetHeading - curr.heading) * 0.15;
          curr.course += (targetCourse - curr.course) * 0.15;
        }
      }
    }

    const cam = cameraRef.current;

    // Auto-spinning or Momentum Inertia Decay
    const now = performance.now();
    const hasMomentum = Math.abs(velocityRef.current.vx) > 0.005 || Math.abs(velocityRef.current.vy) > 0.005;

    // Resume auto-rotation if user enabled it and manual interaction has ended + inertia has settled
    if (isAutoSpinningRef.current && isSpinSuspendedRef.current && !cam.isDragging && !hasMomentum && (now - lastSpinInteractionEndRef.current > 200)) {
      isSpinSuspendedRef.current = false;
    }

    if (isAutoSpinningRef.current && !isSpinSuspendedRef.current && !cam.isDragging) {
      if (is3DMode) {
        // Stable, smooth constant angular velocity: 0.15 deg/frame (~9 deg/sec)
        cam.globeRotationLon = (cam.globeRotationLon + 0.15 + 360) % 360;
      } else {
        cam.mapBearing = (cam.mapBearing + 0.12) % 360;
      }
      // Note: Never thrash React setState on every 60 FPS animation frame!
    } else if (!cam.isDragging && hasMomentum) {
      if (is3DMode) {
        cam.globeRotationLon = (cam.globeRotationLon - velocityRef.current.vx * 0.35 + 360) % 360;
        cam.globeRotationLat = Math.max(-80, Math.min(80, cam.globeRotationLat + velocityRef.current.vy * 0.35));
      } else {
        const scale = (width / 360) * cam.zoom;
        let nextLon = cam.centerLon - velocityRef.current.vx / scale;
        while (nextLon > 180) nextLon -= 360;
        while (nextLon < -180) nextLon += 360;
        cam.centerLon = nextLon;
        cam.centerLat = Math.max(-75, Math.min(75, cam.centerLat + velocityRef.current.vy / (scale * 1.08)));
      }
      velocityRef.current.vx *= 0.94;
      velocityRef.current.vy *= 0.94;
    }

    // 1. Update static geographic background canvas ONLY when camera/projection/layers change
    // Quantize floating-point micro-jitter to prevent redundant static vector re-rasterization
    const qZoom = (Math.round(cam.zoom * 20) / 20).toFixed(2);
    const qLon = is3DMode
      ? (Math.round(cam.globeRotationLon * 5) / 5).toFixed(1)
      : (Math.round(cam.centerLon * 10) / 10).toFixed(1);
    const qLat = is3DMode
      ? (Math.round(cam.globeRotationLat * 5) / 5).toFixed(1)
      : (Math.round(cam.centerLat * 10) / 10).toFixed(1);
    const qBearing = (Math.round(cam.mapBearing * 2) / 2).toFixed(1);

    const staticKey = is3DMode
      ? `3D_${Math.round(width)}_${Math.round(height)}_${qZoom}_${qLon}_${qLat}_${showLanes}_${showPorts}`
      : `2D_${Math.round(width)}_${Math.round(height)}_${qZoom}_${qLon}_${qLat}_${qBearing}_${showLanes}_${showPorts}_${showGraticule}`;

    if (staticKey !== staticLayerKeyRef.current) {
      renderStaticLayer(width, height, dpr);
      staticLayerKeyRef.current = staticKey;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 2. Clear ONLY the dynamic foreground canvas (static geographic layer remains rasterized in background canvas!)
    ctx.clearRect(0, 0, width, height);

    if (is3DMode) {
      // 3D Globe Mode Dynamic Overlays
      const globeRadius = Math.min(width, height) * 0.42 * (cam.zoom / 1.6);
      const cx = width / 2;
      const cy = height / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
      ctx.clip();

      // Sanctioned zones on 3D globe
      if (showSanctionedZones) {
        for (const sz of SANCTIONED_ZONES) {
          const [gx, gy, vis] = project3DGlobe(sz.center[0], sz.center[1], width, height);
          if (vis) {
            const rPx = sz.radiusDeg * (globeRadius / 90);
            ctx.fillStyle = sz.color;
            ctx.strokeStyle = sz.severity === 'CRITICAL' ? 'rgba(244, 63, 94, 0.85)' : 'rgba(245, 158, 11, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(gx, gy, Math.max(8, rPx), 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);

            if (cam.zoom >= 1.6) {
              ctx.fillStyle = '#fca5a5';
              ctx.font = '9px "JetBrains Mono", monospace';
              ctx.fillText(`⛔ ${sz.code}`, gx + 6, gy - rPx - 3);
            }
          }
        }
      }

      // Weather systems on 3D globe
      if (showWeather) {
        for (const wx of WEATHER_SYSTEMS) {
          const [gx, gy, vis] = project3DGlobe(wx.center[0], wx.center[1], width, height);
          if (vis) {
            const rPx = wx.radiusDeg * (globeRadius / 90);
            const stormGrad = ctx.createRadialGradient(gx, gy, 3, gx, gy, Math.max(10, rPx));
            stormGrad.addColorStop(0, wx.type === 'TROPICAL_CYCLONE' ? 'rgba(168, 85, 247, 0.5)' : 'rgba(56, 189, 248, 0.4)');
            stormGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
            ctx.fillStyle = stormGrad;
            ctx.beginPath();
            ctx.arc(gx, gy, Math.max(10, rPx), 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = wx.type === 'TROPICAL_CYCLONE' ? 'rgba(216, 180, 254, 0.7)' : 'rgba(125, 211, 252, 0.6)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(gx, gy, Math.max(6, rPx * 0.6), 0, Math.PI * 2);
            ctx.stroke();

            if (cam.zoom >= 1.5) {
              ctx.fillStyle = '#e9d5ff';
              ctx.font = '9px "JetBrains Mono", monospace';
              ctx.fillText(`🌀 ${wx.name.substring(0, 16)} (${wx.windKnots}kn)`, gx + 6, gy + 3);
            }
          }
        }
      }

      // Risk zones on 3D globe
      if (showRiskZones) {
        for (const rz of MARITIME_RISK_ZONES) {
          const [gx, gy, vis] = project3DGlobe(rz.center[0], rz.center[1], width, height);
          if (vis) {
            const rPx = rz.radiusDeg * (globeRadius / 90);
            ctx.fillStyle = rz.color;
            ctx.strokeStyle = rz.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.7)' : 'rgba(245, 158, 11, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(gx, gy, rPx, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
      }

      // Geofence polygons on 3D globe
      if (showGeofences) {
        for (const zone of geofenceZones) {
          if (!zone.enabled || zone.polygon.length < 3) continue;
          ctx.beginPath();
          let started = false;
          let anyVis = false;
          for (const pt of zone.polygon) {
            const [gx, gy, vis] = project3DGlobe(pt.lon, pt.lat, width, height);
            if (vis) anyVis = true;
            if (!started) {
              ctx.moveTo(gx, gy);
              started = true;
            } else {
              ctx.lineTo(gx, gy);
            }
          }
          if (anyVis && started) {
            ctx.closePath();
            ctx.fillStyle = `${zone.color}33`;
            ctx.fill();
            ctx.strokeStyle = zone.color;
            ctx.lineWidth = 1.8;
            ctx.stroke();
          }
        }
      }

      // Draw vessels on 3D globe
      drawVessels(ctx, width, height, true);

      // Spherical edge shadow
      const rimGrad = ctx.createRadialGradient(cx, cy, globeRadius * 0.75, cx, cy, globeRadius);
      rimGrad.addColorStop(0, 'rgba(4, 11, 20, 0)');
      rimGrad.addColorStop(0.85, 'rgba(4, 11, 20, 0.45)');
      rimGrad.addColorStop(1, 'rgba(4, 11, 20, 0.9)');
      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Border circle
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // 2D Tactical Mercator Nautical Chart Dynamic Overlays
      ctx.save();
      if (cam.mapBearing !== 0) {
        ctx.translate(width / 2, height / 2);
        ctx.rotate((cam.mapBearing * Math.PI) / 180);
        ctx.translate(-width / 2, -height / 2);
      }

      // Sanctioned zones in 2D
      if (showSanctionedZones) {
        for (const sz of SANCTIONED_ZONES) {
          const [x, y] = project2D(sz.center[0], sz.center[1], width, height);
          const rPx = sz.radiusDeg * ((width / 360) * cam.zoom);
          if (x + rPx < -50 || x - rPx > width + 50 || y + rPx < -50 || y - rPx > height + 50) continue;

          ctx.fillStyle = sz.color;
          ctx.strokeStyle = sz.severity === 'CRITICAL' ? 'rgba(244, 63, 94, 0.85)' : 'rgba(245, 158, 11, 0.8)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 4]);

          ctx.beginPath();
          ctx.arc(x, y, Math.max(10, rPx), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);

          const innerRing = (pulseRef.current * 8) % Math.max(10, rPx);
          ctx.strokeStyle = sz.severity === 'CRITICAL' ? 'rgba(244, 63, 94, 0.35)' : 'rgba(245, 158, 11, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(4, innerRing), 0, Math.PI * 2);
          ctx.stroke();

          if (cam.zoom >= 1.3) {
            ctx.fillStyle = sz.severity === 'CRITICAL' ? '#fda4af' : '#fde047';
            ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
            ctx.fillText(`⛔ [SANCTION] ${sz.code} · ${sz.authority}`, x - 40, y - rPx - 6);
            if (cam.zoom >= 2.0) {
              ctx.fillStyle = '#cbd5e1';
              ctx.font = '9px "JetBrains Mono", monospace';
              ctx.fillText(sz.name, x - 40, y - rPx + 7);
            }
          }
        }
      }

      // Weather systems in 2D
      if (showWeather) {
        for (const wx of WEATHER_SYSTEMS) {
          const [x, y] = project2D(wx.center[0], wx.center[1], width, height);
          const rPx = wx.radiusDeg * ((width / 360) * cam.zoom);
          if (x + rPx < -50 || x - rPx > width + 50 || y + rPx < -50 || y - rPx > height + 50) continue;

          const stormGrad = ctx.createRadialGradient(x, y, 4, x, y, Math.max(15, rPx));
          stormGrad.addColorStop(0, wx.type === 'TROPICAL_CYCLONE' ? 'rgba(168, 85, 247, 0.45)' : 'rgba(56, 189, 248, 0.35)');
          stormGrad.addColorStop(0.7, wx.type === 'TROPICAL_CYCLONE' ? 'rgba(147, 51, 234, 0.18)' : 'rgba(14, 165, 233, 0.15)');
          stormGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = stormGrad;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(15, rPx), 0, Math.PI * 2);
          ctx.fill();

          const swirlAngle = pulseRef.current * (wx.type === 'TROPICAL_CYCLONE' ? -1.5 : 1.2);
          ctx.strokeStyle = wx.type === 'TROPICAL_CYCLONE' ? 'rgba(216, 180, 254, 0.7)' : 'rgba(125, 211, 252, 0.6)';
          ctx.lineWidth = 1.2;
          for (let arm = 0; arm < 3; arm++) {
            ctx.beginPath();
            const armOffset = (arm * Math.PI * 2) / 3;
            for (let step = 0; step < 14; step++) {
              const rad = swirlAngle + armOffset + step * 0.28;
              const dist = 5 + (step / 14) * rPx;
              const px = x + Math.cos(rad) * dist;
              const py = y + Math.sin(rad) * dist * 0.8;
              if (step === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.stroke();
          }

          if (cam.zoom >= 1.2) {
            ctx.fillStyle = wx.type === 'TROPICAL_CYCLONE' ? '#e9d5ff' : '#bae6fd';
            ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
            const typeIcon = wx.type === 'TROPICAL_CYCLONE' ? '🌀' : '💨';
            ctx.fillText(`${typeIcon} ${wx.name}`, x - 40, y - rPx - 6);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.fillText(`${wx.windKnots} kn · ${wx.waveHeightM}m waves · ${wx.pressureHpa} hPa`, x - 40, y - rPx + 7);
          }
        }
      }

      // Risk zones in 2D
      if (showRiskZones) {
        for (const rz of MARITIME_RISK_ZONES) {
          const [x, y] = project2D(rz.center[0], rz.center[1], width, height);
          const rPx = rz.radiusDeg * ((width / 360) * cam.zoom);

          const pulse = Math.sin(pulseRef.current) * 4;
          ctx.fillStyle = rz.color;
          ctx.strokeStyle = rz.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.75)' : 'rgba(245, 158, 11, 0.75)';
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.arc(x, y, Math.max(10, rPx + pulse), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          if (cam.zoom >= 1.4) {
            ctx.fillStyle = rz.severity === 'CRITICAL' ? '#fca5a5' : '#fcd34d';
            ctx.font = '10px "Plus Jakarta Sans", sans-serif';
            ctx.fillText(rz.name, x - 40, y - rPx - 6);
          }
        }
      }

      // Geofence Zones in 2D
      if (showGeofences) {
        for (const zone of geofenceZones) {
          if (!zone.enabled || zone.polygon.length < 3) continue;

          ctx.beginPath();
          let started = false;
          let sumX = 0;
          let sumY = 0;
          let count = 0;

          for (const pt of zone.polygon) {
            const [x, y] = project2D(pt.lon, pt.lat, width, height);
            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
            sumX += x;
            sumY += y;
            count++;
          }
          ctx.closePath();

          ctx.fillStyle = `${zone.color}2e`;
          ctx.fill();

          ctx.strokeStyle = zone.color;
          ctx.lineWidth = zone.severity === 'CRITICAL' ? 2.5 : 2;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          for (const pt of zone.polygon) {
            const [vx, vy] = project2D(pt.lon, pt.lat, width, height);
            ctx.beginPath();
            ctx.arc(vx, vy, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = zone.color;
            ctx.fill();
            ctx.strokeStyle = '#020617';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          if (count > 0 && cam.zoom >= 1.2) {
            const cx = sumX / count;
            const cy = sumY / count;
            if (cx >= 0 && cx <= width && cy >= 0 && cy <= height) {
              ctx.font = 'bold 9px "JetBrains Mono", monospace';
              const label = `⬡ ${zone.name} (${zone.vesselCountInside})`;
              const tw = ctx.measureText(label).width;

              ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
              ctx.fillRect(cx - tw / 2 - 4, cy - 8, tw + 8, 14);
              ctx.strokeStyle = `${zone.color}80`;
              ctx.lineWidth = 1;
              ctx.strokeRect(cx - tw / 2 - 4, cy - 8, tw + 8, 14);

              ctx.fillStyle = zone.color;
              ctx.fillText(label, cx - tw / 2, cy + 3);
            }
          }
        }
      }

      // Drawing Preview in 2D
      if (isDrawingGeofence && drawnVertices.length > 0) {
        ctx.beginPath();
        let started = false;
        for (const pt of drawnVertices) {
          const [x, y] = project2D(pt.lon, pt.lat, width, height);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }

        if (mouseCanvasPos) {
          ctx.lineTo(mouseCanvasPos.x, mouseCanvasPos.y);
        }

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (drawnVertices.length >= 2 && mouseCanvasPos) {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
          ctx.fill();
        }

        for (let i = 0; i < drawnVertices.length; i++) {
          const pt = drawnVertices[i];
          const [vx, vy] = project2D(pt.lon, pt.lat, width, height);
          ctx.beginPath();
          ctx.arc(vx, vy, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#06b6d4';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px monospace';
          ctx.fillText(`${i + 1}`, vx + 6, vy - 4);
        }
      }

      // Draw vessels
      drawVessels(ctx, width, height, false);

      ctx.restore();
    }

    // Compass rose indicator top right
    drawCompassRose(ctx, width);

    ctx.restore();
  }, [
    is3DMode,
    zoom,
    centerLon,
    centerLat,
    globeRotationLon,
    globeRotationLat,
    mapBearing,
    isAutoSpinning,
    isDragging,
    showSanctionedZones,
    showWeather,
    showLanes,
    showPorts,
    showRiskZones,
    showWakeTrails,
    showHeatmap,
    showGraticule,
    showGeofences,
    geofenceZones,
    isDrawingGeofence,
    drawnVertices,
    mouseCanvasPos,
    riskFilter,
    project2D,
    project3DGlobe,
    selectedVesselId,
    aisConnState,
    isPaused,
    simSpeed,
    syncCameraToState,
    vessels,
    renderStaticLayer,
  ]);

  // Draw vessel markers, wake trails, heading vectors, and live ping pulses
  const drawVessels = (ctx: CanvasRenderingContext2D, width: number, height: number, is3D: boolean) => {
    // Filter vessels if risk filter is set
    const currentFleet = vesselsRef.current;
    const filteredVessels = riskFilter === 'ALL' ? currentFleet : currentFleet.filter((v) => v.riskLevel === riskFilter);

    // Heatmap mode if enabled — blits pre-rendered sprite for massive GPU/CPU savings
    if (showHeatmap) {
      const sprite = getHeatmapSprite();
      for (const v of filteredVessels) {
        const curr = interpolatedPositions.current.get(v.id) || { lat: v.lat, lon: v.lon };
        let vx = 0,
          vy = 0,
          vis = true;
        if (is3D) {
          [vx, vy, vis] = project3DGlobe(curr.lon, curr.lat, width, height);
        } else {
          [vx, vy] = project2D(curr.lon, curr.lat, width, height);
        }
        if (!vis) continue;

        if (sprite) {
          ctx.drawImage(sprite, vx - 45, vy - 45);
        } else {
          const hGrad = ctx.createRadialGradient(vx, vy, 4, vx, vy, 45);
          hGrad.addColorStop(0, 'rgba(239, 68, 68, 0.7)');
          hGrad.addColorStop(0.4, 'rgba(245, 158, 11, 0.3)');
          hGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
          ctx.fillStyle = hGrad;
          ctx.beginPath();
          ctx.arc(vx, vy, 45, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (const v of filteredVessels) {
      const curr = interpolatedPositions.current.get(v.id) || { lat: v.lat, lon: v.lon, heading: v.heading, course: v.course };
      let vx = 0,
        vy = 0,
        vis = true;

      if (is3D) {
        [vx, vy, vis] = project3DGlobe(curr.lon, curr.lat, width, height);
      } else {
        [vx, vy] = project2D(curr.lon, curr.lat, width, height);
      }

      if (!vis) continue;

      const isSelected = v.id === selectedVesselId;
      const isHovered = hoveredVessel?.id === v.id;

      // Color based on risk level
      let color = '#10b981'; // LOW: emerald
      if (v.riskLevel === 'MEDIUM') color = '#f59e0b';
      else if (v.riskLevel === 'HIGH') color = '#f97316';
      else if (v.riskLevel === 'CRITICAL') color = '#ef4444';

      if (v.isStale) {
        color = '#64748b'; // Muted grey if stale / stopped transmitting
      }

      // 1. Draw historical wake trail if enabled
      if (showWakeTrails && v.historicalTrack && v.historicalTrack.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        let first = true;
        let lastTx = -9999;
        let lastTy = -9999;
        for (let i = 0; i < v.historicalTrack.length; i++) {
          const pt = v.historicalTrack[i];
          let tx = 0,
            ty = 0,
            tvis = true;
          if (is3D) {
            [tx, ty, tvis] = project3DGlobe(pt.lon, pt.lat, width, height);
          } else {
            [tx, ty] = project2D(pt.lon, pt.lat, width, height);
          }
          if (tvis) {
            if (first) {
              ctx.moveTo(tx, ty);
              first = false;
              lastTx = tx;
              lastTy = ty;
            } else if (Math.abs(tx - lastTx) >= 0.75 || Math.abs(ty - lastTy) >= 0.75 || i === v.historicalTrack.length - 1) {
              ctx.lineTo(tx, ty);
              lastTx = tx;
              lastTy = ty;
            }
          }
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // 2. Draw forward predictive route vector / Dead-reckoning extrapolation vector
      const isExtrapolating = aisConnState !== 'Connected' || v.isStale;
      const vCourse = curr.course;
      const vHdg = curr.heading;

      // Determine local True North reference angle in screen coordinates
      // In 2D Mercator/equirectangular, True North is always screen UP (-Y), angle = 0.
      // In 3D Globe, True North curves along the spherical meridian towards the North Pole.
      let northScreenAngle = 0;
      if (is3D) {
        const [gx0, gy0] = project3DGlobe(curr.lon, curr.lat, width, height);
        const [gxN, gyN] = project3DGlobe(curr.lon, Math.min(89.8, curr.lat + 0.15), width, height);
        // Canvas Y increases downwards, so screen North vector is (gxN - gx0, gyN - gy0)
        northScreenAngle = Math.atan2(gxN - gx0, -(gyN - gy0));
      }

      // COG (Course Over Ground): governs the movement vector over water/ground
      const cogScreenRad = northScreenAngle + (vCourse * Math.PI) / 180;
      // HDG (Heading): governs physical vessel bow compass pointing
      const hdgScreenRad = northScreenAngle + (vHdg * Math.PI) / 180;

      if (isExtrapolating && v.speed > 0.5) {
        // Prominent amber dashed Dead-Reckoning Extrapolation path along COG
        const forwardDistance = Math.min(85, Math.max(32, v.speed * 4.5));
        const fwdX = vx + Math.sin(cogScreenRad) * forwardDistance;
        const fwdY = vy - Math.cos(cogScreenRad) * forwardDistance;

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.lineTo(fwdX, fwdY);
        ctx.stroke();

        // Extrapolated waypoint beacon tip
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(fwdX, fwdY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Extrapolation arrowhead pointing towards movement course
        const arrowRad = cogScreenRad + Math.PI;
        ctx.beginPath();
        ctx.moveTo(fwdX, fwdY);
        ctx.lineTo(fwdX + Math.sin(arrowRad - 0.4) * 8, fwdY - Math.cos(arrowRad - 0.4) * 8);
        ctx.lineTo(fwdX + Math.sin(arrowRad + 0.4) * 8, fwdY - Math.cos(arrowRad + 0.4) * 8);
        ctx.closePath();
        ctx.fill();
        ctx.setLineDash([]);
      } else if (v.speed > 2 && (isSelected || zoom >= 2.2)) {
        const forwardDistance = Math.min(60, v.speed * 3.5);
        const fwdX = vx + Math.sin(cogScreenRad) * forwardDistance;
        const fwdY = vy - Math.cos(cogScreenRad) * forwardDistance;

        ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.lineTo(fwdX, fwdY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3. Live Transmitting Sonar Pulse Ring
      if (v.isTransmitting && !v.isStale) {
        const pulseRadius = 8 + Math.sin(pulseRef.current + v.imo.charCodeAt(0)) * 6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = Math.max(0.1, 1 - (pulseRadius - 8) / 8);
        ctx.beginPath();
        ctx.arc(vx, vy, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // 4. Selection halo
      if (isSelected || isHovered) {
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(vx, vy, 14, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshair reticle
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(vx - 18, vy);
        ctx.lineTo(vx - 14, vy);
        ctx.moveTo(vx + 14, vy);
        ctx.lineTo(vx + 18, vy);
        ctx.moveTo(vx, vy - 18);
        ctx.lineTo(vx, vy - 14);
        ctx.moveTo(vx, vy + 14);
        ctx.lineTo(vx, vy + 18);
        ctx.stroke();
      }

      // 5. Tactical Vessel Marker (Hull silhouette pointing along Heading)
      ctx.save();
      ctx.translate(vx, vy);
      ctx.rotate(hdgScreenRad);

      // Ship hull polygon pointing forward towards True North (0° = canvas -Y)
      ctx.fillStyle = color;
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      // Vessel bow point (points UP to 0° North)
      ctx.moveTo(0, -9);
      // Starboard side
      ctx.lineTo(4.5, -2);
      ctx.lineTo(4, 7);
      // Stern
      ctx.lineTo(-4, 7);
      // Port side
      ctx.lineTo(-4.5, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Heading directional needle tip (white pointer towards bow)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(2, -4);
      ctx.lineTo(-2, -4);
      ctx.closePath();
      ctx.fill();

      // If COG differs from HDG by > 3° and vessel is moving, render small COG drift tick
      if (Math.abs(vCourse - vHdg) > 3 && v.speed > 1.0) {
        const driftRad = ((vCourse - vHdg) * Math.PI) / 180;
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(Math.sin(driftRad) * 14, -Math.cos(driftRad) * 14);
        ctx.stroke();
      }

      ctx.restore();

      // 6. Vessel Name Label (displayed if selected, hovered, or zoom >= 2.0)
      if (isSelected || isHovered || zoom >= 2.2) {
        ctx.font = '10px "JetBrains Mono", monospace';
        const isExtrapolating = aisConnState !== 'Connected' || v.isStale;
        const displayName = isExtrapolating ? `${v.name} [DR]` : v.name;
        const textWidth = ctx.measureText(displayName).width;

        ctx.fillStyle = 'rgba(6, 13, 23, 0.9)';
        ctx.strokeStyle = isExtrapolating ? '#f59e0b' : isSelected ? '#00f0ff' : 'rgba(30, 58, 92, 0.8)';
        ctx.lineWidth = isExtrapolating || isSelected ? 1.5 : 1;

        ctx.fillRect(vx + 12, vy - 14, textWidth + 14, 22);
        ctx.strokeRect(vx + 12, vy - 14, textWidth + 14, 22);

        ctx.fillStyle = isExtrapolating ? '#fef08a' : '#f8fafc';
        ctx.fillText(displayName, vx + 18, vy);

        ctx.fillStyle = isExtrapolating ? '#f59e0b' : color;
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(`${v.speed} kn · ${v.course}° ${isExtrapolating ? '· EXT' : ''}`, vx + 18, vy + 7);
      }
    }
  };

  const drawCompassRose = (ctx: CanvasRenderingContext2D, width: number) => {
    const rx = width - 42;
    const ry = 42;

    ctx.save();
    ctx.translate(rx, ry);

    // Rotate compass indicator based on 2D bearing or 3D globe longitude
    const rot = is3DMode ? ((-globeRotationLon + 45) * Math.PI) / 180 : ((-mapBearing) * Math.PI) / 180;
    ctx.rotate(rot);

    ctx.fillStyle = 'rgba(10, 20, 36, 0.85)';
    ctx.strokeStyle = 'rgba(30, 58, 92, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // North arrow (red)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, -4);
    ctx.closePath();
    ctx.fill();

    // South arrow (slate)
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText('N', -3, -8);

    ctx.restore();
  };

  // Resize both canvas layers to match display container size
  useEffect(() => {
    const updateSize = () => {
      const dynamicCanvas = canvasRef.current;
      const staticCanvas = staticCanvasRef.current;
      const container = containerRef.current;
      if (!dynamicCanvas || !container) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        const targetW = Math.floor(w * dpr);
        const targetH = Math.floor(h * dpr);
        if (dynamicCanvas.width !== targetW || dynamicCanvas.height !== targetH) {
          dynamicCanvas.width = targetW;
          dynamicCanvas.height = targetH;
        }
        if (staticCanvas && (staticCanvas.width !== targetW || staticCanvas.height !== targetH)) {
          staticCanvas.width = targetW;
          staticCanvas.height = targetH;
          staticLayerKeyRef.current = '';
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const renderRef = useRef<() => void>(() => {});
  renderRef.current = render;

  // Stable 60 FPS animation loop with tab visibility pausing
  useEffect(() => {
    let active = true;
    const loop = () => {
      if (!active) return;
      if (!document.hidden) {
        renderRef.current();
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    const handleVisibilityChange = () => {
      if (!document.hidden && active) {
        renderRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pointer drag & smooth rotation handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingGeofence) {
      return;
    }
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    cameraRef.current.isDragging = true;
    setAutoTrackTarget(false); // Free navigation immediately
    setDragStart({ x: e.clientX, y: e.clientY });
    lastPointerRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    velocityRef.current = { vx: 0, vy: 0 };
    // Temporarily suspend auto-rotation while user manually controls camera without destroying user preference
    isSpinSuspendedRef.current = true;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDrawingGeofence) {
      setMouseCanvasPos({ x: mouseX, y: mouseY });
      return;
    }

    if (cameraRef.current.isDragging) {
      const now = performance.now();
      const dt = Math.max(1, now - lastPointerRef.current.time);
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };

      // Track instant velocity for smooth flick / spin release
      const instVx = (dx / dt) * 16;
      const instVy = (dy / dt) * 16;
      velocityRef.current = {
        vx: velocityRef.current.vx * 0.3 + instVx * 0.7,
        vy: velocityRef.current.vy * 0.3 + instVy * 0.7,
      };
      lastPointerRef.current = { x: e.clientX, y: e.clientY, time: now };

      const cam = cameraRef.current;
      if (is3DMode) {
        // Free 3D globe rotation without React re-render churn
        cam.globeRotationLon = (cam.globeRotationLon - dx * 0.35 + 360) % 360;
        cam.globeRotationLat = Math.max(-80, Math.min(80, cam.globeRotationLat + dy * 0.35));
      } else {
        // If holding Alt/Shift or right button, rotate 2D bearing freely
        if (e.buttons === 2 || e.shiftKey || e.altKey) {
          setIsTrueNorthLocked(false);
          cam.mapBearing = (cam.mapBearing - dx * 0.5 + 360) % 360;
        } else {
          // Pan 2D chart
          const scale = (rect.width / 360) * cam.zoom;
          let next = cam.centerLon - dx / scale;
          while (next > 180) next -= 360;
          while (next < -180) next += 360;
          cam.centerLon = next;
          cam.centerLat = Math.max(-75, Math.min(75, cam.centerLat + dy / (scale * 1.08)));
        }
      }
      syncCameraToState(false);
    } else {
      // Check vessel hover with unprojected coordinate if rotated
      let testX = mouseX;
      let testY = mouseY;
      if (!is3DMode && cameraRef.current.mapBearing !== 0) {
        const rad = (-cameraRef.current.mapBearing * Math.PI) / 180;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const offX = mouseX - cx;
        const offY = mouseY - cy;
        testX = cx + offX * Math.cos(rad) - offY * Math.sin(rad);
        testY = cy + offX * Math.sin(rad) + offY * Math.cos(rad);
      }

      let found: Vessel | null = null;
      const cam = cameraRef.current;
      const halfSpanLat = !is3DMode ? 90 / (cam.zoom * 1.08) + 15 : 90;

      for (let i = 0; i < vessels.length; i++) {
        const v = vessels[i];
        const curr = interpolatedPositions.current.get(v.id) || { lat: v.lat, lon: v.lon };
        if (!is3DMode && Math.abs(curr.lat - cam.centerLat) > halfSpanLat) {
          continue;
        }

        let px = 0,
          py = 0,
          vis = true;
        if (is3DMode) {
          [px, py, vis] = project3DGlobe(curr.lon, curr.lat, rect.width, rect.height);
        } else {
          [px, py] = project2D(curr.lon, curr.lat, rect.width, rect.height);
        }
        if (vis) {
          const dist = Math.hypot(testX - px, testY - py);
          const hitLabel = testX >= px + 8 && testX <= px + 150 && testY >= py - 18 && testY <= py + 14;
          if (dist < 22 || hitLabel) {
            found = v;
            setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            break;
          }
        }
      }
      if ((hoveredVessel?.id || null) !== (found?.id || null)) {
        setHoveredVessel(found);
      }
    }
  };

  const checkVesselClick = (clientX: number, clientY: number): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    // Check if clicked the compass rose in the top right to reset orientation
    const compX = rect.width - 42;
    const compY = 42;
    if (Math.hypot(mouseX - compX, mouseY - compY) < 26) {
      resetRotation();
      return true;
    }

    let testX = mouseX;
    let testY = mouseY;
    if (!is3DMode && cameraRef.current.mapBearing !== 0) {
      const rad = (-cameraRef.current.mapBearing * Math.PI) / 180;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const offX = mouseX - cx;
      const offY = mouseY - cy;
      testX = cx + offX * Math.cos(rad) - offY * Math.sin(rad);
      testY = cy + offX * Math.sin(rad) + offY * Math.cos(rad);
    }

    if (isDrawingGeofence) {
      const [lon, lat] = unproject2D(testX, testY, rect.width, rect.height);
      setDrawnVertices((prev) => [
        ...prev,
        { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) },
      ]);
      return true;
    }

    // Check if clicked a vessel marker or vessel label
    for (const v of vessels) {
      const curr = interpolatedPositions.current.get(v.id) || { lat: v.lat, lon: v.lon };
      let px = 0,
        py = 0,
        vis = true;
      if (is3DMode) {
        [px, py, vis] = project3DGlobe(curr.lon, curr.lat, rect.width, rect.height);
      } else {
        [px, py] = project2D(curr.lon, curr.lat, rect.width, rect.height);
      }
      if (vis) {
        const dist = Math.hypot(testX - px, testY - py);
        const hitMarker = dist < 24;
        const hitLabel = testX >= px + 8 && testX <= px + 150 && testY >= py - 18 && testY <= py + 14;
        if (hitMarker || hitLabel) {
          onSelectVessel(v.id);
          if (onOpenDossier) {
            onOpenDossier(v.id);
          }
          return true;
        }
      }
    }
    return false;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    cameraRef.current.isDragging = false;
    lastSpinInteractionEndRef.current = performance.now();
    syncCameraToState(true);

    // If pointer was barely moved (tap/click), check vessel selection
    const moveDist = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y
    );
    if (moveDist <= 6) {
      checkVesselClick(e.clientX, e.clientY);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    checkVesselClick(e.clientX, e.clientY);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setAutoTrackTarget(false); // Free zoom without auto recentering
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => Math.max(1.0, Math.min(8.0, prev + delta)));
  };

  const toggleAutoSpinning = () => {
    setIsAutoSpinning((prev) => {
      const next = !prev;
      isAutoSpinningRef.current = next;
      cameraRef.current.isAutoSpinning = next;
      if (next) {
        setIsTrueNorthLocked(false);
        if (!is3DMode) {
          setIs3DMode(true);
        }
        isSpinSuspendedRef.current = false;
        velocityRef.current = { vx: 0, vy: 0 };
      } else {
        isSpinSuspendedRef.current = false;
        velocityRef.current = { vx: 0, vy: 0 };
        syncCameraToState(true);
      }
      return next;
    });
  };

  const rotateLeft = () => {
    setIsTrueNorthLocked(false);
    if (is3DMode) {
      setGlobeRotationLon((prev) => (prev - 15 + 360) % 360);
    } else {
      setMapBearing((prev) => (prev - 15 + 360) % 360);
    }
  };

  const rotateRight = () => {
    setIsTrueNorthLocked(false);
    if (is3DMode) {
      setGlobeRotationLon((prev) => (prev + 15 + 360) % 360);
    } else {
      setMapBearing((prev) => (prev + 15 + 360) % 360);
    }
  };

  const toggleTrueNorth = () => {
    const nextState = !isTrueNorthLocked;
    setIsTrueNorthLocked(nextState);
    if (nextState) {
      setMapBearing(0);
      setGlobeRotationLon(45);
      setGlobeRotationLat(20);
      velocityRef.current = { vx: 0, vy: 0 };
      setIsAutoSpinning(false);
    }
  };

  const resetRotation = () => {
    toggleTrueNorth();
  };

  const resetView = () => {
    setZoom(1.6);
    setCenterLon(30);
    setCenterLat(20);
    setGlobeRotationLon(45);
    setGlobeRotationLat(20);
    setMapBearing(0);
    velocityRef.current = { vx: 0, vy: 0 };
    setIsAutoSpinning(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const selectedVessel = vessels.find((v) => v.id === selectedVesselId);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[440px] bg-[#060b13] rounded-xl overflow-hidden border border-slate-800/80 shadow-2xl ${className}`}
    >
      {/* Layer 1: Static Geographic Background Canvas (vector landmasses, borders, coastlines, graticule, lanes, ports) */}
      <canvas
        ref={staticCanvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none select-none"
      />

      {/* Layer 2: High-Frequency Dynamic Foreground Canvas (vessels, live AIS vectors, sonar pings, wake trails, overlays) */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full block ${isDrawingGeofence ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'} touch-none select-none`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Floating Geofence Drawing Banner */}
      {isDrawingGeofence && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-xl border border-cyan-500 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-bold text-white">Plotting Geofence Polygon</span>
            <span className="font-mono text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/30">
              {drawnVertices.length} Points
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {drawnVertices.length > 0 && (
              <button
                onClick={() => setDrawnVertices((prev) => prev.slice(0, -1))}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
              >
                Undo Point
              </button>
            )}

            <button
              disabled={drawnVertices.length < 3}
              onClick={() => setIsSaveGeofenceModalOpen(true)}
              className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded text-[11px] disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-950/40"
            >
              Complete & Save ({drawnVertices.length}/3 min)
            </button>

            <button
              onClick={() => {
                setIsDrawingGeofence(false);
                setDrawnVertices([]);
              }}
              className="px-2 py-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded text-[11px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Top Left: Map Mode & Layer Switchers */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-20 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800/80 text-xs shadow-xl max-w-[calc(100%-80px)]">
        {/* Fleet Explorer Drawer Toggle */}
        <button
          onClick={() => setIsFleetDrawerOpen(!isFleetDrawerOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            isFleetDrawerOpen
              ? 'bg-gradient-to-r from-cyan-600 to-teal-500 text-white shadow-md shadow-cyan-950/40'
              : 'bg-slate-950 text-cyan-300 border border-slate-800 hover:border-cyan-500/50'
          }`}
          title="Toggle Fleet Target List & Quick Navigator"
        >
          <Ship className="w-3.5 h-3.5 text-cyan-400" />
          <span>Fleet ({vessels.length})</span>
          {isFleetDrawerOpen ? (
            <ChevronLeft className="w-3 h-3 text-cyan-200" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-400" />
          )}
        </button>

        {/* Quick Add Vessel Button */}
        {onAddVesselClick && (
          <button
            onClick={onAddVesselClick}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 shadow-md shadow-cyan-950/40 transition-all"
            title="Deploy new vessel to real-time world map"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Vessel</span>
          </button>
        )}

        {/* Live AIS Connection Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all ${
            aisConnState === 'Connected'
              ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-950/40'
              : aisConnState === 'Reconnecting'
              ? 'bg-amber-950/80 border border-amber-500/50 text-amber-300 shadow-sm shadow-amber-950/40'
              : 'bg-rose-950/80 border border-rose-500/50 text-rose-300 shadow-sm shadow-rose-950/40'
          }`}
          title={
            aisConnState === 'Connected'
              ? 'Live Real-Time AIS Stream: CONNECTED (/api/ais/ws active)'
              : aisConnState === 'Reconnecting'
              ? 'Live Real-Time AIS Stream: RECONNECTING (Establishing websocket stream...)'
              : 'Live Real-Time AIS Stream: DISCONNECTED (Data may be stale or dead-reckoned)'
          }
        >
          <Radio
            className={`w-3.5 h-3.5 shrink-0 ${
              aisConnState === 'Connected'
                ? 'animate-pulse text-emerald-400'
                : aisConnState === 'Reconnecting'
                ? 'animate-spin text-amber-400'
                : 'text-rose-400'
            }`}
          />
          <span className="font-bold text-[11px] uppercase tracking-wider">{aisConnState}</span>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-0.5" />

        {/* 2D / 3D Globe Mode Toggle */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setIs3DMode(false)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
              !is3DMode ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>2D</span>
          </button>
          <button
            onClick={() => setIs3DMode(true)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
              is3DMode ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>3D</span>
          </button>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-0.5" />

        {/* Simulation Speed & Pause Controls */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 gap-1">
          <button
            onClick={() => {
              const next = aisStreamService.togglePause();
              setIsPaused(next);
            }}
            className={`p-1 rounded text-xs transition-colors ${
              isPaused ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'
            }`}
            title={isPaused ? 'Resume Real-Time Simulation' : 'Pause Simulation'}
          >
            {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3" />}
          </button>

          <select
            value={simSpeed}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              aisStreamService.setSpeedMultiplier(val);
              setSimSpeed(val);
            }}
            className="bg-transparent text-slate-300 text-[11px] font-mono focus:outline-none cursor-pointer pr-1"
            title="Simulation Speed Multiplier"
          >
            <option value="1">1x Speed</option>
            <option value="2">2x Speed</option>
            <option value="3">3x Speed</option>
            <option value="5">5x Speed</option>
            <option value="10">10x Speed</option>
          </select>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-0.5 hidden sm:block" />

        {/* Dedicated Map Layers Controls Panel Trigger Button */}
        <button
          onClick={() => setIsLayersPanelOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all shadow-sm ${
            isLayersPanelOpen
              ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-400/60 shadow-cyan-500/30'
              : 'bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/40'
          }`}
          title="Open Map Layer Controls Panel (Sanctioned Zones, Weather, Shipping Lanes & more)"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Layers</span>
          <span className="px-1.5 py-0.2 bg-slate-950/80 text-cyan-300 rounded text-[10px] font-mono border border-cyan-500/30">
            {[showSanctionedZones, showWeather, showLanes, showRiskZones, showPorts, showWakeTrails, showHeatmap].filter(Boolean).length}/7
          </span>
          <Sliders className="w-3 h-3 text-cyan-400" />
        </button>

        <div className="h-4 w-px bg-slate-800 mx-0.5 hidden sm:block" />

        {/* Quick Map Layer Toggles */}
        <button
          onClick={() => setShowSanctionedZones(!showSanctionedZones)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            showSanctionedZones
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold'
              : 'text-slate-400 hover:bg-slate-800/50'
          }`}
          title="Toggle Sanctioned Zones (OFAC, EU, UN)"
        >
          <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden md:inline">Sanctions</span>
        </button>

        <button
          onClick={() => setShowWeather(!showWeather)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            showWeather
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
              : 'text-slate-400 hover:bg-slate-800/50'
          }`}
          title="Toggle Weather Overlays (Cyclones & Gales)"
        >
          <Wind className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden md:inline">Weather</span>
        </button>

        <button
          onClick={() => setShowLanes(!showLanes)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            showLanes
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
              : 'text-slate-400 hover:bg-slate-800/50'
          }`}
          title="Toggle Shipping Corridors & TSS"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Lanes</span>
        </button>

        <button
          onClick={() => setShowRiskZones(!showRiskZones)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            showRiskZones
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
              : 'text-slate-400 hover:bg-slate-800/50'
          }`}
          title="Toggle High-Risk & War Zones"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden lg:inline">Risk</span>
        </button>

        {/* Geofence Controls in Toolbar */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setIsGeofenceManagerOpen(true)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              showGeofences
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/50'
            }`}
            title="Open Geofence & Exclusion Zone Manager"
          >
            <Pentagon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">Geofences ({geofenceZones.filter((z) => z.enabled).length})</span>
          </button>

          <button
            onClick={() => {
              if (isDrawingGeofence) {
                setIsDrawingGeofence(false);
                setDrawnVertices([]);
              } else {
                setIs3DMode(false);
                setIsDrawingGeofence(true);
                setDrawnVertices([]);
              }
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all ${
              isDrawingGeofence
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-950/40'
                : 'text-cyan-300 hover:bg-cyan-500/20'
            }`}
            title="Draw custom polygon on nautical chart"
          >
            <Plus className="w-3 h-3 text-cyan-400" />
            <span>{isDrawingGeofence ? 'Cancel' : 'Draw'}</span>
          </button>
        </div>

        <button
          onClick={() => setShowPorts(!showPorts)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            showPorts
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold'
              : 'text-slate-400 hover:bg-slate-800/50'
          }`}
          title="Toggle Major Global Ports"
        >
          <Anchor className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden lg:inline">Ports</span>
        </button>

        <button
          onClick={() => setShowWakeTrails(!showWakeTrails)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            showWakeTrails
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
              : 'text-slate-400 hover:bg-slate-800/50'
          }`}
          title="Toggle Historical Wake Trails"
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden xl:inline">Tracks</span>
        </button>

        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            showHeatmap
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold'
              : 'text-slate-400 hover:bg-slate-800/50'
          }`}
          title="Toggle Traffic Density Heatmap"
        >
          <Layers className="w-3.5 h-3.5 text-orange-400" />
          <span className="hidden xl:inline">Density</span>
        </button>

        <button
          onClick={() => setAutoTrackTarget(!autoTrackTarget)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            autoTrackTarget
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
              : 'text-slate-400 hover:bg-slate-800/50'
          }`}
          title="Auto-Follow Selected Target Movement in Real-Time"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span className="hidden xl:inline">Follow</span>
        </button>
      </div>

      {/* Slide-out Fleet Target Drawer */}
      {isFleetDrawerOpen && (
        <div className="absolute top-16 left-3 bottom-12 w-80 max-w-[calc(100%-24px)] bg-[#09111e]/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl shadow-2xl z-30 flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-4 duration-200">
          {/* Drawer Header */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="font-extrabold text-xs text-white uppercase tracking-wider">
                Fleet Navigator ({vessels.length})
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {onAddVesselClick && (
                <button
                  onClick={onAddVesselClick}
                  className="p-1 px-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1"
                  title="Add Vessel"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              )}
              <button
                onClick={() => setIsFleetDrawerOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="p-2.5 border-b border-slate-800/80 space-y-2 bg-slate-900/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                placeholder="Search name, IMO, type, flag..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-[10px] font-mono">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((risk) => (
                <button
                  key={risk}
                  onClick={() => setDrawerRiskFilter(risk)}
                  className={`px-2 py-0.5 rounded border transition-colors ${
                    drawerRiskFilter === risk
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                      : 'border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {risk}
                </button>
              ))}
            </div>
          </div>

          {/* Vessel List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
            {vessels
              .filter((v) => {
                const matchSearch =
                  v.name.toLowerCase().includes(drawerSearch.toLowerCase()) ||
                  v.imo.includes(drawerSearch) ||
                  v.mmsi.includes(drawerSearch) ||
                  v.type.toLowerCase().includes(drawerSearch.toLowerCase()) ||
                  v.flag.toLowerCase().includes(drawerSearch.toLowerCase());
                const matchRisk = drawerRiskFilter === 'ALL' || v.riskLevel === drawerRiskFilter;
                return matchSearch && matchRisk;
              })
              .map((v) => {
                const isSelected = v.id === selectedVesselId;
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      onSelectVessel(v.id);
                      setIsHudDismissed(false);
                      setCenterLon(v.lon);
                      setCenterLat(v.lat);
                      setGlobeRotationLon(v.lon);
                      setGlobeRotationLat(v.lat);
                      setZoom(2.8);
                      setAutoTrackTarget(true);
                    }}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/80 shadow-md shadow-cyan-950/50'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            v.isTransmitting && !v.isStale ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                          }`}
                        />
                        <span className="font-bold text-white truncate">{v.name}</span>
                      </div>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 font-bold ${
                          v.riskLevel === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : v.riskLevel === 'HIGH'
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                            : v.riskLevel === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {v.riskScore}/100
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{v.type}</span>
                      <span className="text-cyan-300 font-bold">{v.speed} kn · {v.course}°</span>
                    </div>

                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-900 text-[10px] text-slate-500">
                      <span className="truncate max-w-[170px]">{v.destination}</span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setCenterLon(v.lon);
                            setCenterLat(v.lat);
                            setGlobeRotationLon(v.lon);
                            setGlobeRotationLat(v.lat);
                            setZoom(3.0);
                            setAutoTrackTarget(true);
                          }}
                          className="p-1 hover:text-cyan-300 text-slate-400"
                          title="Locate & Center Target"
                        >
                          <Crosshair className="w-3 h-3" />
                        </button>
                        {onRemoveVesselClick && (
                          <button
                            onClick={() => onRemoveVesselClick(v.id)}
                            className="p-1 hover:text-rose-400 text-slate-500"
                            title="De-register Vessel"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Top Right: Zoom, Rotation, Recenter & Fullscreen Controls */}
      <div className="absolute top-16 right-3 flex flex-col gap-1.5 z-20">
        <button
          onClick={() => setZoom((z) => Math.min(8.0, z + 0.35))}
          className="p-2 bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 rounded-lg border border-slate-800 backdrop-blur-md shadow-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={() => setZoom((z) => Math.max(1.0, z - 0.35))}
          className="p-2 bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 rounded-lg border border-slate-800 backdrop-blur-md shadow-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <div className="h-px bg-slate-800/80 my-0.5" />

        {/* Free Smooth Auto-Rotation Toggle */}
        <button
          onClick={toggleAutoSpinning}
          className={`p-2 rounded-lg border backdrop-blur-md shadow-lg transition-all ${
            isAutoSpinning
              ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/70 shadow-cyan-950/60 ring-1 ring-cyan-500/50'
              : 'bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border-slate-800'
          }`}
          title={isAutoSpinning ? 'Pause Free Smooth Auto-Rotation' : 'Enable Free Smooth Auto-Rotation (60 FPS)'}
        >
          <Globe className={`w-4 h-4 ${isAutoSpinning ? 'animate-spin' : ''}`} style={{ animationDuration: '10s' }} />
        </button>

        {/* Rotate Left (◀ 15°) */}
        <button
          onClick={rotateLeft}
          className="p-2 bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 rounded-lg border border-slate-800 backdrop-blur-md shadow-lg transition-colors"
          title="Rotate Counter-Clockwise (◀ 15°)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Rotate Right (▶ 15°) */}
        <button
          onClick={rotateRight}
          className="p-2 bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 rounded-lg border border-slate-800 backdrop-blur-md shadow-lg transition-colors"
          title="Rotate Clockwise (▶ 15°)"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        {/* Toggleable True North Lock Button (can turn ON or OFF) */}
        <button
          onClick={toggleTrueNorth}
          className={`p-2 rounded-lg border backdrop-blur-md shadow-lg transition-all relative ${
            isTrueNorthLocked
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-emerald-950/40 ring-1 ring-emerald-500/50'
              : 'bg-slate-900/85 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border-slate-800'
          }`}
          title={isTrueNorthLocked ? 'Orientation: True North LOCKED [ON] (Click to turn OFF)' : 'Orientation: Free Rotation [OFF] (Click to lock True North)'}
        >
          <Compass className={`w-4 h-4 ${isTrueNorthLocked ? 'text-emerald-400' : 'text-slate-400'}`} />
          {isTrueNorthLocked && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 border border-slate-950" />
          )}
        </button>

        <div className="h-px bg-slate-800/80 my-0.5" />

        <button
          onClick={resetView}
          className="p-2 bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 rounded-lg border border-slate-800 backdrop-blur-md shadow-lg transition-colors"
          title="Reset Camera & Center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {allowFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 rounded-lg border border-slate-800 backdrop-blur-md shadow-lg transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Bottom Left: Live Scale & Coordinates Bar */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 font-mono z-20">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-semibold">AIS STREAM 60FPS</span>
        </div>
        <span className="text-slate-600">·</span>
        <span>
          LAT {centerLat >= 0 ? centerLat.toFixed(2) + '°N' : Math.abs(centerLat).toFixed(2) + '°S'} / LON{' '}
          {centerLon >= 0 ? centerLon.toFixed(2) + '°E' : Math.abs(centerLon).toFixed(2) + '°W'}
        </span>
        <span className="text-slate-600">·</span>
        <span>ZOOM {zoom.toFixed(1)}x</span>
        <span className="text-slate-600">·</span>
        <span className="text-cyan-400 font-bold">{vessels.length} TARGETS UNDER RADAR</span>
      </div>

      {/* Hover Tooltip */}
      {hoveredVessel && (
        <div
          className="absolute pointer-events-none z-30 bg-slate-900/95 backdrop-blur-md p-3 rounded-lg border border-cyan-500/40 shadow-2xl text-xs min-w-[210px] transform -translate-x-1/2 -translate-y-[120%]"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="font-bold text-white tracking-wide">{hoveredVessel.name}</span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                hoveredVessel.riskLevel === 'CRITICAL'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : hoveredVessel.riskLevel === 'HIGH'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : hoveredVessel.riskLevel === 'MEDIUM'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              RISK {hoveredVessel.riskScore}/100
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 font-mono">
            <div>
              <span className="text-slate-500">IMO:</span> {hoveredVessel.imo}
            </div>
            <div>
              <span className="text-slate-500">MMSI:</span> {hoveredVessel.mmsi}
            </div>
            <div>
              <span className="text-slate-500">SPEED:</span> {hoveredVessel.speed} kn
            </div>
            <div>
              <span className="text-slate-500">COURSE:</span> {hoveredVessel.course}°
            </div>
            <div className="col-span-2 truncate">
              <span className="text-slate-500">DEST:</span> {hoveredVessel.destination}
            </div>
            <div className="col-span-2 text-[10px] text-cyan-400 pt-0.5">Click to lock target & open dossier</div>
          </div>
        </div>
      )}

      {/* Selected Vessel Floating HUD Card (Bottom Right) */}
      {selectedVessel && !isHudDismissed && (
        <div className="absolute bottom-3 right-3 z-20 max-w-sm w-full sm:w-88 bg-slate-900/95 backdrop-blur-xl p-3.5 rounded-xl border border-cyan-500/60 shadow-2xl shadow-cyan-950/70 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <h4 className="font-extrabold text-sm text-white tracking-wide">{selectedVessel.name}</h4>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                IMO {selectedVessel.imo} · MMSI {selectedVessel.mmsi} · Flag: {selectedVessel.flag}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    selectedVessel.riskLevel === 'CRITICAL'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : selectedVessel.riskLevel === 'HIGH'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                      : selectedVessel.riskLevel === 'MEDIUM'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {selectedVessel.riskLevel} ({selectedVessel.riskScore}/100)
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  {selectedVessel.lastUpdatedSecondsAgo}s ago
                </span>
              </div>
              <button
                onClick={() => setIsHudDismissed(true)}
                className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800"
                title="Dismiss HUD"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-2.5">
            <div className="bg-slate-950/70 p-2 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 block">LIVE SOG / COG</span>
              <span className="text-cyan-300 font-bold text-sm">
                {selectedVessel.speed} kn / {selectedVessel.course}°
              </span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 block">DESTINATION</span>
              <span className="text-slate-200 truncate block font-bold text-xs">{selectedVessel.destination}</span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 block">CURRENT COORDS</span>
              <span className="text-slate-300 text-[11px] font-bold">
                {selectedVessel.lat.toFixed(4)}°, {selectedVessel.lon.toFixed(4)}°
              </span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 block">AML / KYC</span>
              <span
                className={`text-[11px] font-bold ${
                  selectedVessel.amlStatus === 'Clear' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {selectedVessel.amlStatus} · {selectedVessel.kycStatus}
              </span>
            </div>
          </div>

          {selectedVessel.riskEvidence && selectedVessel.riskEvidence.length > 0 && (
            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80 mb-2.5">
              <span className="text-amber-400 font-medium block mb-0.5">Risk Insight:</span>
              <p className="line-clamp-2 text-slate-300">{selectedVessel.riskEvidence[0]}</p>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
            <button
              onClick={() => {
                if (onOpenDossier) onOpenDossier(selectedVessel.id);
                else onSelectVessel(selectedVessel.id);
              }}
              className="flex-1 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-cyan-950/40 flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Intelligence Dossier</span>
            </button>

            <button
              onClick={() => {
                setCenterLon(selectedVessel.lon);
                setCenterLat(selectedVessel.lat);
                setGlobeRotationLon(selectedVessel.lon);
                setGlobeRotationLat(selectedVessel.lat);
                setZoom(3.2);
                setAutoTrackTarget(false);
              }}
              className="p-1.5 px-2 bg-slate-950 hover:bg-slate-800 text-cyan-400 border border-slate-800 rounded-lg text-xs transition-colors"
              title="Re-center camera on target"
            >
              <Crosshair className="w-4 h-4" />
            </button>

            {onRemoveVesselClick && (
              <button
                onClick={() => onRemoveVesselClick(selectedVessel.id)}
                className="p-1.5 px-2 bg-slate-950 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 rounded-lg text-xs transition-colors"
                title="De-register vessel from fleet"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive Map Layers & Overlays Controls Panel */}
      <MapLayersControlPanel
        isOpen={isLayersPanelOpen}
        onClose={() => setIsLayersPanelOpen(false)}
        config={{
          showSanctionedZones,
          setShowSanctionedZones,
          showWeather,
          setShowWeather,
          showLanes,
          setShowLanes,
          showRiskZones,
          setShowRiskZones,
          showPorts,
          setShowPorts,
          showWakeTrails,
          setShowWakeTrails,
          showHeatmap,
          setShowHeatmap,
          showGraticule,
          setShowGraticule,
          showGeofences,
          setShowGeofences,
        }}
      />

      {/* Geofence Manager Modal */}
      <GeofenceManagerModal
        isOpen={isGeofenceManagerOpen}
        onClose={() => setIsGeofenceManagerOpen(false)}
        zones={geofenceZones}
        vessels={vessels}
        onStartDrawing={() => {
          setIs3DMode(false);
          setIsDrawingGeofence(true);
          setDrawnVertices([]);
        }}
        onSelectVessel={onSelectVessel}
      />

      {/* Save Drawn Geofence Modal */}
      <SaveGeofenceModal
        isOpen={isSaveGeofenceModalOpen}
        vertices={drawnVertices}
        onClose={() => setIsSaveGeofenceModalOpen(false)}
        onSaved={() => {
          setIsSaveGeofenceModalOpen(false);
          setIsDrawingGeofence(false);
          setDrawnVertices([]);
        }}
      />
    </div>
  );
};
