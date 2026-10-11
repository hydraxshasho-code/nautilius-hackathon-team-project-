# Security Specification & Test Suite

## 1. Data Invariants
- **Vessel Invariants**:
  - `id` must be valid string identifier <= 128 chars matching `^[a-zA-Z0-9_\-]+$`.
  - Required fields `id`, `name`, `imo`, `mmsi`, `lat`, `lon`, `speed`, `course`, `heading`, `navStatus`, `riskLevel`, `riskScore` must be present on create.
  - Coordinate bounds: `lat >= -90.0 && lat <= 90.0`, `lon >= -180.0 && lon <= 180.0`.
  - Speed and course bounds: `speed >= 0 && speed <= 150`, `course >= 0 && course <= 360`.
  - No shadow fields or unvalidated injection fields on write operations.
  - Anyone (public read) can inspect live vessel fleet so the shared link displays real ship data immediately to everyone.
  - Deletions are permitted by authorized operators.
- **User Profile Invariants**:
  - A user can only create or modify their own user profile matching `request.auth.uid == userId`.
  - `email` and private profile fields are isolated to the owner.
- **Incident Alert Invariants**:
  - Alerts are accessible to users with valid roles; updates only permitted for allowed status fields.

## 2. The Dirty Dozen Payloads
1. **Ghost Field Injection**: Adding an unverified privileged property `__admin__: true` to vessel payload.
2. **Lat Coordinate Out of Range**: Vessel with `lat: 250.0`.
3. **Lon Coordinate Out of Range**: Vessel with `lon: -400.0`.
4. **Negative Speed Injection**: Vessel with `speed: -55.0`.
5. **Huge Payload / Denial of Wallet**: Vessel with `name` exceeding maximum allowed characters (1MB string).
6. **Cross-User Profile Hijack**: Authenticated user 'alice' attempting to write to `/users/bob`.
7. **Invalid ID Character Poisoning**: Path ID with path traversal or script tags `../../malicious`.
8. **Missing Mandatory Vessel Field**: Creating a vessel without `mmsi` or `imo`.
9. **Invalid Risk Level Enum**: Setting `riskLevel: 'SUPER_DANGEROUS'`.
10. **Corrupt Heading Value**: Setting `heading: 9999`.
11. **Direct Unauthenticated Write to User Profile**: Writing without auth token.
12. **Malformed Alert Severity**: Setting `severity: 'UNKNOWN_CRIT'`.
