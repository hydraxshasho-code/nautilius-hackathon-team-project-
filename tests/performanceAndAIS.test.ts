import { describe, it } from 'node:test';
import assert from 'node:assert';
import { aisWorkerService } from '../src/services/aisWorkerService';
import { aisStreamService } from '../src/services/aisStreamService';
import { getWorldMapGeoData } from '../src/services/worldMapGeoService';

describe('Nautilus Performance & AIS Processing Pipeline Verification', () => {
  it('1. aisWorkerService correctly extrapolates kinematic positions', async () => {
    const testPositions = [
      { id: 'v-1', lat: 25.0, lon: 55.0, heading: 90, speed: 15 },
      { id: 'v-2', lat: 10.0, lon: 80.0, heading: 0, speed: 20 },
      { id: 'v-3', lat: 0.0, lon: 0.0, heading: 180, speed: 0 }, // stationary
    ];

    const dtHours = 1.0;
    const extrapolated = await aisWorkerService.extrapolatePositions(testPositions, dtHours);

    assert.strictEqual(extrapolated.length, 3);

    // v-1 moving east: lon should increase
    const v1 = extrapolated.find((v) => v.id === 'v-1');
    assert.ok(v1);
    assert.ok(v1!.lon > 55.0);

    // v-2 moving north: lat should increase
    const v2 = extrapolated.find((v) => v.id === 'v-2');
    assert.ok(v2);
    assert.ok(v2!.lat > 10.0);

    // v-3 stationary: coordinates should remain unchanged
    const v3 = extrapolated.find((v) => v.id === 'v-3');
    assert.ok(v3);
    assert.strictEqual(v3!.lat, 0.0);
    assert.strictEqual(v3!.lon, 0.0);
  });

  it('2. aisWorkerService builds spatial index and executes range queries', () => {
    const fleet = [
      { id: 'v-dubai', lat: 25.2, lon: 55.3 },
      { id: 'v-singapore', lat: 1.3, lon: 103.8 },
      { id: 'v-rotterdam', lat: 51.9, lon: 4.5 },
      { id: 'v-fujairah', lat: 25.1, lon: 56.3 },
    ];

    aisWorkerService.buildSpatialIndex(fleet);

    // Query near UAE / Persian Gulf (lon: 55, lat: 25, radius: 4 deg)
    const gulfMatches = aisWorkerService.queryNearbyVesselIds(55.0, 25.0, 4.0);
    assert.ok(gulfMatches.includes('v-dubai'));
    assert.ok(gulfMatches.includes('v-fujairah'));
    assert.ok(!gulfMatches.includes('v-singapore'));
    assert.ok(!gulfMatches.includes('v-rotterdam'));
  });

  it('3. aisStreamService O(1) indexed lookup retrieves vessels accurately', () => {
    const vessels = aisStreamService.getVessels();
    if (vessels.length > 0) {
      const target = vessels[0];
      const lookupById = aisStreamService.getVesselById(target.id);
      assert.ok(lookupById);
      assert.strictEqual(lookupById!.id, target.id);

      if (target.mmsi) {
        const lookupByMmsi = aisStreamService.getVesselById(target.mmsi);
        assert.ok(lookupByMmsi);
        assert.strictEqual(lookupByMmsi!.id, target.id);
      }
    }
  });

  it('4. worldMapGeoService caches geographic features and precomputed bounding boxes', () => {
    const geoData1 = getWorldMapGeoData();
    const geoData2 = getWorldMapGeoData();

    // Verify singleton reference cache
    assert.strictEqual(geoData1, geoData2);
    assert.ok(geoData1.landRings.length > 0);
    assert.ok(geoData1.landRingsBBox);
    assert.strictEqual(geoData1.landRingsBBox!.length, geoData1.landRings.length);
    assert.ok(geoData1.countryFeatures.length > 100);
  });
});
