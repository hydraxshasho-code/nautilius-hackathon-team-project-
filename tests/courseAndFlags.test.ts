import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveVesselFlag, extractMidFromMmsi } from '../src/services/flagService';
import { profileSwitchService } from '../src/services/profileSwitchService';
import { liveAISClient } from '../src/services/liveAisClient';
import { NormalizedAISVessel } from '../src/server/ais/types';

describe('NAUTILUS Issue 4 & Issue 5 Verification Suite (Course, Heading, Flags, Default Role)', () => {
  // =========================================================================
  // ISSUE 4: COURSE & HEADING TEST CASES
  // =========================================================================
  describe('Issue 4: Course (COG) & Heading (HDG) Coordinate Transforms', () => {
    /**
     * Converts an AIS true-north angle (0..360°) to screen unit vector
     * Screen convention: 0° is North (pointing -Y), clockwise rotation.
     * dx = sin(rad), dy = -cos(rad)
     */
    function angleToScreenVector(degrees: number): { dx: number; dy: number } {
      const rad = (degrees * Math.PI) / 180;
      const dx = Math.round(Math.sin(rad) * 1000) / 1000;
      const dy = Math.round(-Math.cos(rad) * 1000) / 1000;
      return {
        dx: Object.is(dx, -0) ? 0 : dx,
        dy: Object.is(dy, -0) ? 0 : dy,
      };
    }

    it('1. Course 0° points TRUE NORTH (dx = 0, dy < 0)', () => {
      const v = angleToScreenVector(0);
      assert.strictEqual(v.dx, 0);
      assert.ok(v.dy < 0, 'North must point UP along negative Y axis');
    });

    it('2. Course 45° points NORTH-EAST (dx > 0, dy < 0)', () => {
      const v = angleToScreenVector(45);
      assert.ok(v.dx > 0, 'NE must point RIGHT (+X)');
      assert.ok(v.dy < 0, 'NE must point UP (-Y)');
      assert.strictEqual(Math.round(v.dx * 100), Math.round(-v.dy * 100));
    });

    it('3. Course 90° points EAST (dx > 0, dy = 0)', () => {
      const v = angleToScreenVector(90);
      assert.strictEqual(v.dx, 1);
      assert.strictEqual(v.dy, 0);
    });

    it('4. Course 135° points SOUTH-EAST (dx > 0, dy > 0)', () => {
      const v = angleToScreenVector(135);
      assert.ok(v.dx > 0, 'SE must point RIGHT (+X)');
      assert.ok(v.dy > 0, 'SE must point DOWN (+Y)');
    });

    it('5. Course 180° points SOUTH (dx = 0, dy > 0)', () => {
      const v = angleToScreenVector(180);
      assert.strictEqual(v.dx, 0);
      assert.strictEqual(v.dy, 1);
    });

    it('6. Course 225° points SOUTH-WEST (dx < 0, dy > 0)', () => {
      const v = angleToScreenVector(225);
      assert.ok(v.dx < 0, 'SW must point LEFT (-X)');
      assert.ok(v.dy > 0, 'SW must point DOWN (+Y)');
    });

    it('7. Course 270° points WEST (dx < 0, dy = 0)', () => {
      const v = angleToScreenVector(270);
      assert.strictEqual(v.dx, -1);
      assert.strictEqual(v.dy, 0);
    });

    it('8. Course 315° points NORTH-WEST (dx < 0, dy < 0)', () => {
      const v = angleToScreenVector(315);
      assert.ok(v.dx < 0, 'NW must point LEFT (-X)');
      assert.ok(v.dy < 0, 'NW must point UP (-Y)');
    });

    it('9. Preserves separate COG and Heading when they differ (e.g. crab angle in current)', () => {
      const rawAis: NormalizedAISVessel = {
        imo: '9414108',
        mmsi: '638025160',
        name: 'NAUTILUS TITAN',
        position: { latitude: 25.123, longitude: 56.452 },
        navigation: {
          speed: 12.5,
          course: 100, // COG: movement vector direction is 100°
          heading: 90,  // HDG: physical bow orientation is 090° (due East)
          draught: 14.2,
          navigationStatus: 'Under way using engine',
        },
        voyage: { destination: 'SINGAPORE', eta: null },
        source: 'AISSTREAM_REALTIME',
        timestamp: new Date().toISOString(),
        status: 'LIVE',
        lastUpdatedSecondsAgo: 2,
      };

      const vessel = liveAISClient.normalizedToVessel(rawAis);
      assert.strictEqual(vessel.course, 100, 'Course Over Ground must be 100°');
      assert.strictEqual(vessel.heading, 90, 'Heading bow orientation must be 90°');
      assert.notStrictEqual(vessel.course, vessel.heading, 'COG and HDG must NOT be collapsed together');
    });
  });

  // =========================================================================
  // ISSUE 5: REAL VESSEL FLAGS (NO SINGAPORE FALLBACK)
  // =========================================================================
  describe('Issue 5: Real Vessel Flags & Source Transparency', () => {
    it('1. Correctly resolves verified flags across required maritime nations', () => {
      const testCases = [
        { explicit: 'Singapore', code: 'SG', mmsi: '563254200' },
        { explicit: 'India', code: 'IN', mmsi: '419001234' },
        { explicit: 'Panama', code: 'PA', mmsi: '352981000' },
        { explicit: 'Liberia', code: 'LR', mmsi: '638025160' },
        { explicit: 'Marshall Islands', code: 'MH', mmsi: '538009999' },
        { explicit: 'Bahamas', code: 'BS', mmsi: '308123456' },
        { explicit: 'Malta', code: 'MT', mmsi: '215123456' },
        { explicit: 'Greece', code: 'GR', mmsi: '237123456' },
        { explicit: 'United States', code: 'US', mmsi: '366123456' },
        { explicit: 'United Kingdom', code: 'GB', mmsi: '232123456' },
        { explicit: 'Denmark', code: 'DK', mmsi: '219123456' },
      ];

      for (const tc of testCases) {
        const resolved = resolveVesselFlag({
          explicitFlag: tc.explicit,
          explicitFlagCode: tc.code,
          mmsi: tc.mmsi,
        });
        assert.strictEqual(resolved.flag, tc.explicit);
        assert.strictEqual(resolved.flagCode, tc.code);
        assert.strictEqual(resolved.flagSource, 'AIS');
      }
    });

    it('2. Infers flag from MMSI MID when AIS flag field is omitted and marks source as MMSI_MID_INFERENCE', () => {
      // 419 = India
      const indiaInferred = resolveVesselFlag({ mmsi: '419123456' });
      assert.strictEqual(indiaInferred.flag, 'India');
      assert.strictEqual(indiaInferred.flagCode, 'IN');
      assert.strictEqual(indiaInferred.flagSource, 'MMSI_MID_INFERENCE');

      // 638 = Liberia
      const libInferred = resolveVesselFlag({ mmsi: '638999888' });
      assert.strictEqual(libInferred.flag, 'Liberia');
      assert.strictEqual(libInferred.flagCode, 'LR');
      assert.strictEqual(libInferred.flagSource, 'MMSI_MID_INFERENCE');

      // 538 = Marshall Islands
      const mhInferred = resolveVesselFlag({ mmsi: '538001122' });
      assert.strictEqual(mhInferred.flag, 'Marshall Islands');
      assert.strictEqual(mhInferred.flagCode, 'MH');
      assert.strictEqual(mhInferred.flagSource, 'MMSI_MID_INFERENCE');
    });

    it('3. NEVER silently converts unknown flag into Singapore; displays Unknown / UNKNOWN', () => {
      // MMSI with no match and no explicit flag
      const unknownResult = resolveVesselFlag({ mmsi: '999999999' });
      assert.strictEqual(unknownResult.flag, 'Unknown');
      assert.strictEqual(unknownResult.flagCode, 'UN');
      assert.strictEqual(unknownResult.flagSource, 'UNKNOWN');
      assert.notStrictEqual(unknownResult.flag, 'Singapore', 'Must never default to Singapore');

      // Blank MMSI and no flag
      const blankResult = resolveVesselFlag({});
      assert.strictEqual(blankResult.flag, 'Unknown');
      assert.strictEqual(blankResult.flagSource, 'UNKNOWN');
      assert.notStrictEqual(blankResult.flag, 'Singapore');
    });

    it('4. liveAISClient.normalizedToVessel adopts flag resolution and sets flagSource', () => {
      const raw: NormalizedAISVessel = {
        imo: '9784320',
        mmsi: '636018234', // 636 = Liberia
        name: 'ATLANTIC MERIDIAN',
        position: { latitude: 10.0, longitude: 20.0 },
        navigation: { speed: 10, course: 180, heading: 180, draught: 10, navigationStatus: 'Under way' },
        voyage: { destination: null, eta: null },
        source: 'AIS',
        timestamp: new Date().toISOString(),
        status: 'LIVE',
        lastUpdatedSecondsAgo: 1,
      };

      const v = liveAISClient.normalizedToVessel(raw);
      assert.strictEqual(v.flag, 'Liberia');
      assert.strictEqual(v.flagCode, 'LR');
      assert.strictEqual(v.flagSource, 'MMSI_MID_INFERENCE');
      assert.notStrictEqual(v.flag, 'Singapore');
    });
  });

  // =========================================================================
  // ISSUE 3: BASE ROLE MUST DEFAULT TO VIEWER
  // =========================================================================
  describe('Issue 3: Base Role Default & Privilege Escalation Defenses', () => {
    it('1. Newly initialized base role defaults to Viewer', () => {
      const baseRole = profileSwitchService.getBaseRole();
      assert.strictEqual(baseRole, 'Viewer', 'Initial base role must be Viewer');
    });

    it('2. Client cannot self-promote baseRole to Super Admin via setBaseRole', () => {
      profileSwitchService.setBaseRole('Super Admin' as any);
      assert.notStrictEqual(profileSwitchService.getBaseRole(), 'Super Admin');
      assert.strictEqual(profileSwitchService.getBaseRole(), 'Viewer');
    });
  });
});
