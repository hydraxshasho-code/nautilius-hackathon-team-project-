import { IncidentAlert, RiskLevel, Vessel } from '../types/maritime';

export interface LatLng {
  lat: number;
  lon: number;
}

export interface GeofenceTriggerConfig {
  onEnter: boolean;
  onExit: boolean;
  onDwell: boolean;
  dwellThresholdSeconds: number; // Duration before dwell alert triggers
}

export interface GeofenceZone {
  id: string;
  name: string;
  description: string;
  polygon: LatLng[];
  color: string; // Hex color for rendering
  enabled: boolean;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: 'WAR_HAZARD' | 'SANCTIONED_ZONE' | 'PORT_LIMIT' | 'CUSTOM' | 'GEOFENCE';
  triggers: GeofenceTriggerConfig;
  vesselCountInside: number;
  createdAt: string;
  updatedAt?: string;
}

export interface GeofenceAlertEvent {
  id: string;
  zoneId: string;
  zoneName: string;
  vesselId: string;
  vesselName: string;
  vesselImo: string;
  eventType: 'ENTER' | 'EXIT' | 'DWELL';
  message: string;
  dwellDurationSeconds?: number;
  timestamp: string;
}

const STORAGE_KEY_GEOFENCES = 'oceaniq_geofence_zones';

// Default initial high-value maritime geofences
const DEFAULT_ZONES: GeofenceZone[] = [
  {
    id: 'geo-zone-bab-el-mandeb',
    name: 'Bab-el-Mandeb War Hazard Geofence',
    description: 'High-risk maritime corridor with armed interdiction warnings and drone loitering zones.',
    polygon: [
      { lat: 13.5, lon: 42.5 },
      { lat: 13.8, lon: 43.8 },
      { lat: 12.3, lon: 44.5 },
      { lat: 11.8, lon: 43.2 },
      { lat: 12.5, lon: 42.6 },
    ],
    color: '#ef4444', // Red
    enabled: true,
    severity: 'CRITICAL',
    category: 'WAR_HAZARD',
    triggers: {
      onEnter: true,
      onExit: true,
      onDwell: true,
      dwellThresholdSeconds: 120, // 2 minutes for testing / fast simulation
    },
    vesselCountInside: 0,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'geo-zone-singapore-tss',
    name: 'Singapore Strait Port & TSS Geofence',
    description: 'Deep-draft navigational channel, pilotage boarding limits, and Pasir Panjang berth approaches.',
    polygon: [
      { lat: 1.45, lon: 103.55 },
      { lat: 1.42, lon: 104.15 },
      { lat: 1.15, lon: 104.10 },
      { lat: 1.18, lon: 103.60 },
    ],
    color: '#06b6d4', // Cyan
    enabled: true,
    severity: 'WARNING',
    category: 'PORT_LIMIT',
    triggers: {
      onEnter: true,
      onExit: false,
      onDwell: true,
      dwellThresholdSeconds: 180,
    },
    vesselCountInside: 0,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'geo-zone-hormuz-chokepoint',
    name: 'Strait of Hormuz Security Transit Zone',
    description: 'Vital Persian Gulf crude choke point requiring 24/7 AIS broadcasting and escort surveillance.',
    polygon: [
      { lat: 26.9, lon: 56.0 },
      { lat: 26.6, lon: 56.9 },
      { lat: 25.8, lon: 56.7 },
      { lat: 26.1, lon: 55.8 },
    ],
    color: '#f59e0b', // Amber
    enabled: true,
    severity: 'WARNING',
    category: 'WAR_HAZARD',
    triggers: {
      onEnter: true,
      onExit: true,
      onDwell: false,
      dwellThresholdSeconds: 300,
    },
    vesselCountInside: 0,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

/**
 * Standard Ray-casting algorithm to test whether a geographical coordinate
 * is inside an arbitrary closed polygon.
 */
export function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const x = point.lon;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon;
    const yi = polygon[i].lat;
    const xj = polygon[j].lon;
    const yj = polygon[j].lat;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

interface VesselZoneTracker {
  vesselId: string;
  zoneId: string;
  isInside: boolean;
  enteredAt: number;
  lastDwellAlertAt: number;
}

class GeofenceService {
  private zones: GeofenceZone[] = [];
  private vesselTrackers: Map<string, VesselZoneTracker> = new Map();
  private listeners: Set<(zones: GeofenceZone[]) => void> = new Set();
  private alertListeners: Set<(alert: IncidentAlert) => void> = new Set();
  private eventListeners: Set<(event: GeofenceAlertEvent) => void> = new Set();

  constructor() {
    this.zones = this.loadZones();
  }

  private loadZones(): GeofenceZone[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_GEOFENCES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Geofence load notice:', e);
    }
    return DEFAULT_ZONES;
  }

  private saveZones(): void {
    try {
      localStorage.setItem(STORAGE_KEY_GEOFENCES, JSON.stringify(this.zones));
    } catch (e) {
      console.warn('Geofence save notice:', e);
    }
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn([...this.zones]));
  }

  public getZones(): GeofenceZone[] {
    return [...this.zones];
  }

  public getZoneById(id: string): GeofenceZone | undefined {
    return this.zones.find((z) => z.id === id);
  }

  public subscribe(fn: (zones: GeofenceZone[]) => void): () => void {
    this.listeners.add(fn);
    fn([...this.zones]);
    return () => this.listeners.delete(fn);
  }

  public onAlert(fn: (alert: IncidentAlert) => void): () => void {
    this.alertListeners.add(fn);
    return () => this.alertListeners.delete(fn);
  }

  public onEvent(fn: (event: GeofenceAlertEvent) => void): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  public addZone(newZone: Omit<GeofenceZone, 'id' | 'createdAt' | 'vesselCountInside'>): GeofenceZone {
    const created: GeofenceZone = {
      ...newZone,
      id: `geo-zone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      vesselCountInside: 0,
      createdAt: new Date().toISOString(),
    };
    this.zones.push(created);
    this.saveZones();
    return created;
  }

  public updateZone(id: string, updates: Partial<GeofenceZone>): void {
    this.zones = this.zones.map((z) => {
      if (z.id === id) {
        return { ...z, ...updates, updatedAt: new Date().toISOString() };
      }
      return z;
    });
    this.saveZones();
  }

  public deleteZone(id: string): void {
    this.zones = this.zones.filter((z) => z.id !== id);
    // Clean up trackers for deleted zone
    for (const [key] of this.vesselTrackers.entries()) {
      if (key.endsWith(`_${id}`)) {
        this.vesselTrackers.delete(key);
      }
    }
    this.saveZones();
  }

  public toggleZone(id: string): void {
    this.zones = this.zones.map((z) => {
      if (z.id === id) {
        return { ...z, enabled: !z.enabled };
      }
      return z;
    });
    this.saveZones();
  }

  public resetToDefaults(): void {
    this.zones = DEFAULT_ZONES;
    this.vesselTrackers.clear();
    this.saveZones();
  }

  /**
   * Evaluate all active vessels against all active geofence zones.
   * Called continuously upon AIS telemetry ingestion.
   */
  public evaluateVessels(vessels: Vessel[]): void {
    if (!vessels || vessels.length === 0 || this.zones.length === 0) return;

    const now = Date.now();
    let countsChanged = false;

    // Track vessel count inside each zone
    const zoneCounts: Record<string, number> = {};
    for (const z of this.zones) {
      zoneCounts[z.id] = 0;
    }

    for (const vessel of vessels) {
      if (typeof vessel.lat !== 'number' || typeof vessel.lon !== 'number') continue;
      const vesselPt: LatLng = { lat: vessel.lat, lon: vessel.lon };

      for (const zone of this.zones) {
        if (!zone.enabled || zone.polygon.length < 3) continue;

        const isInside = isPointInPolygon(vesselPt, zone.polygon);
        const trackerKey = `${vessel.id}_${zone.id}`;
        let tracker = this.vesselTrackers.get(trackerKey);

        if (isInside) {
          zoneCounts[zone.id] = (zoneCounts[zone.id] || 0) + 1;
        }

        if (!tracker) {
          // First time seeing this vessel/zone pair
          tracker = {
            vesselId: vessel.id,
            zoneId: zone.id,
            isInside,
            enteredAt: isInside ? now : 0,
            lastDwellAlertAt: 0,
          };
          this.vesselTrackers.set(trackerKey, tracker);

          // If vessel spawned inside the zone and enter trigger is on
          if (isInside && zone.triggers.onEnter) {
            this.dispatchGeofenceAlert(vessel, zone, 'ENTER', `Vessel ${vessel.name} (IMO ${vessel.imo}) entered geofence '${zone.name}'`);
          }
          continue;
        }

        // Check state transitions
        if (!tracker.isInside && isInside) {
          // ENTER EVENT
          tracker.isInside = true;
          tracker.enteredAt = now;
          tracker.lastDwellAlertAt = 0;

          if (zone.triggers.onEnter) {
            this.dispatchGeofenceAlert(
              vessel,
              zone,
              'ENTER',
              `GEOFENCE BREACH: ${vessel.name} (IMO ${vessel.imo}) entered guarded zone "${zone.name}"`
            );
          }
        } else if (tracker.isInside && !isInside) {
          // EXIT EVENT
          const dwellSeconds = Math.round((now - tracker.enteredAt) / 1000);
          tracker.isInside = false;

          if (zone.triggers.onExit) {
            this.dispatchGeofenceAlert(
              vessel,
              zone,
              'EXIT',
              `GEOFENCE EXIT: ${vessel.name} (IMO ${vessel.imo}) exited guarded zone "${zone.name}" after ${Math.max(1, Math.round(dwellSeconds / 60))} min(s)`
            );
          }
        } else if (tracker.isInside && isInside) {
          // DWELL EVENT: Still inside zone
          if (zone.triggers.onDwell) {
            const dwellDurationSeconds = Math.round((now - tracker.enteredAt) / 1000);
            const threshold = zone.triggers.dwellThresholdSeconds || 120;

            // Trigger alert if surpassed threshold and haven't alerted in the last threshold interval
            if (
              dwellDurationSeconds >= threshold &&
              now - tracker.lastDwellAlertAt >= threshold * 1000
            ) {
              tracker.lastDwellAlertAt = now;
              const minutes = Math.max(1, Math.round(dwellDurationSeconds / 60));
              this.dispatchGeofenceAlert(
                vessel,
                zone,
                'DWELL',
                `GEOFENCE LOITERING: ${vessel.name} (IMO ${vessel.imo}) has remained inside "${zone.name}" for ${minutes} min(s) (Limit: ${Math.round(threshold / 60)}m)`
              );
            }
          }
        }
      }
    }

    // Update vessel count inside each zone if changed
    for (const zone of this.zones) {
      const count = zoneCounts[zone.id] || 0;
      if (zone.vesselCountInside !== count) {
        zone.vesselCountInside = count;
        countsChanged = true;
      }
    }

    if (countsChanged) {
      this.notifyListeners();
    }
  }

  private dispatchGeofenceAlert(
    vessel: Vessel,
    zone: GeofenceZone,
    eventType: 'ENTER' | 'EXIT' | 'DWELL',
    description: string
  ): void {
    const eventId = `geo-evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const alertId = `alt-geo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Dispatch event
    const event: GeofenceAlertEvent = {
      id: eventId,
      zoneId: zone.id,
      zoneName: zone.name,
      vesselId: vessel.id,
      vesselName: vessel.name,
      vesselImo: vessel.imo,
      eventType,
      message: description,
      timestamp: new Date().toISOString(),
    };
    this.eventListeners.forEach((fn) => fn(event));

    // Construct IncidentAlert compatible with platform AlertCenter
    let severity: IncidentAlert['severity'] = 'HIGH';
    if (zone.severity === 'CRITICAL') severity = 'CRITICAL';
    else if (zone.severity === 'WARNING') severity = 'HIGH';
    else severity = 'MEDIUM';

    let category: IncidentAlert['category'] = 'Geofence Breach';
    if (eventType === 'DWELL') category = 'Geofence Loitering';
    else if (eventType === 'EXIT') category = 'Geofence Exit';

    const incidentAlert: IncidentAlert = {
      id: alertId,
      vesselId: vessel.id,
      vesselName: vessel.name,
      timestamp: new Date().toISOString(),
      category,
      severity,
      title: `Geofence ${eventType}: ${zone.name}`,
      description,
      status: 'NEW',
      assignedTo: 'SOC Watch Officer',
    };

    this.alertListeners.forEach((fn) => fn(incidentAlert));
  }
}

export const geofenceService = new GeofenceService();
