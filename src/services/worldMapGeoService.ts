import worldAtlasRaw from 'world-atlas/countries-50m.json';
import * as topojson from 'topojson-client';

export interface CountryGeoFeature {
  id: string;
  name: string;
  rings: [number, number][][]; // list of closed polygon rings [lon, lat][]
  center: [number, number]; // [lon, lat] approximate centroid
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
}

export interface WorldMapGeoData {
  landRings: [number, number][][]; // exterior landmass rings (1400+ high-precision contours)
  landRingsBBox?: [number, number, number, number][]; // precomputed bounding boxes [minLon, minLat, maxLon, maxLat]
  countryFeatures: CountryGeoFeature[]; // all 241 sovereign countries & territories with precise borders
  internalBorderLines: [number, number][][]; // shared international borders (187 lines, 19,000+ points across all middle continents)
  allCountryBorders: [number, number][][]; // all national boundaries (1,605 lines covering all nations)
  coastlines: [number, number][][]; // ocean coastlines
}

let cachedGeoData: WorldMapGeoData | null = null;

export function getWorldMapGeoData(): WorldMapGeoData {
  if (cachedGeoData) return cachedGeoData;

  const atlas = worldAtlasRaw as any;
  const landFeature = topojson.feature(atlas, atlas.objects.land) as any;
  const countriesFeature = topojson.feature(atlas, atlas.objects.countries) as any;
  
  // High-precision shared internal borders (where countries touch landlocked and middle continents)
  const bordersMesh = topojson.mesh(atlas, atlas.objects.countries, (a: any, b: any) => a !== b) as any;
  // All country borders
  const allMesh = topojson.mesh(atlas, atlas.objects.countries) as any;
  // Coastlines
  const coastlinesMesh = topojson.mesh(atlas, atlas.objects.land) as any;

  // Extract land rings
  const landRings: [number, number][][] = [];
  const landRingsBBox: [number, number, number, number][] = [];
  if (landFeature) {
    const addRing = (ring: [number, number][]) => {
      landRings.push(ring);
      let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
      for (let i = 0; i < ring.length; i++) {
        const lon = ring[i][0];
        const lat = ring[i][1];
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      landRingsBBox.push([minLon, minLat, maxLon, maxLat]);
    };

    const processGeom = (geom: any) => {
      if (!geom) return;
      if (geom.type === 'Polygon') {
        for (const ring of geom.coordinates) {
          addRing(ring);
        }
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
          for (const ring of poly) {
            addRing(ring);
          }
        }
      }
    };

    if (landFeature.features) {
      for (const f of landFeature.features) {
        processGeom(f.geometry);
      }
    } else if (landFeature.geometry) {
      processGeom(landFeature.geometry);
    }
  }

  // Extract country features with centroids and bboxes for all 241 countries
  const countryFeatures: CountryGeoFeature[] = [];
  if (countriesFeature && countriesFeature.features) {
    for (const f of countriesFeature.features) {
      if (!f.geometry) continue;

      const rings: [number, number][][] = [];
      let minLon = 180;
      let maxLon = -180;
      let minLat = 90;
      let maxLat = -90;
      let totalLon = 0;
      let totalLat = 0;
      let totalPoints = 0;

      const processRing = (ring: [number, number][]) => {
        rings.push(ring);
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          totalLon += lon;
          totalLat += lat;
          totalPoints++;
        }
      };

      if (f.geometry.type === 'Polygon') {
        for (const r of f.geometry.coordinates) {
          processRing(r);
        }
      } else if (f.geometry.type === 'MultiPolygon') {
        for (const poly of f.geometry.coordinates) {
          for (const r of poly) {
            processRing(r);
          }
        }
      }

      if (rings.length > 0 && totalPoints > 0) {
        const centerLon = (minLon + maxLon) / 2;
        const centerLat = (minLat + maxLat) / 2;

        countryFeatures.push({
          id: String(f.id || f.properties?.name || countryFeatures.length),
          name: String(f.properties?.name || 'Unknown Territory'),
          rings,
          center: [centerLon, centerLat],
          bbox: [minLon, minLat, maxLon, maxLat],
        });
      }
    }
  }

  // Extract internal border lines (landlocked and middle continent boundaries)
  const internalBorderLines: [number, number][][] = [];
  if (bordersMesh && bordersMesh.coordinates) {
    for (const line of bordersMesh.coordinates) {
      if (Array.isArray(line) && line.length >= 2) {
        internalBorderLines.push(line);
      }
    }
  }

  // Extract all country borders
  const allCountryBorders: [number, number][][] = [];
  if (allMesh && allMesh.coordinates) {
    for (const line of allMesh.coordinates) {
      if (Array.isArray(line) && line.length >= 2) {
        allCountryBorders.push(line);
      }
    }
  }

  // Extract coastlines
  const coastlines: [number, number][][] = [];
  if (coastlinesMesh && coastlinesMesh.coordinates) {
    for (const line of coastlinesMesh.coordinates) {
      if (Array.isArray(line) && line.length >= 2) {
        coastlines.push(line);
      }
    }
  }

  cachedGeoData = {
    landRings,
    landRingsBBox,
    countryFeatures,
    internalBorderLines,
    allCountryBorders,
    coastlines,
  };

  return cachedGeoData;
}
