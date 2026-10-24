# OpenShield Firestore Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Data Invariants
1. **Strict Owner Isolation**: Every document in `/savedReports/{reportId}` belongs exclusively to a single authenticated, email-verified user (`ownerId == request.auth.uid && request.auth.token.email_verified == true`). No user may read, list, create, update, or delete another user's saved report.
2. **Path Variable Hardening**: `{reportId}` must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters on single-document operations (`get`, `create`, `update`, `delete`).
3. **Strict Schema & Key Allowlisting**:
   - Required & allowed keys on `create`: `['ownerId', 'title', 'sourceType', 'targetUrl', 'overallRiskLevel', 'overallSummary', 'findingsCount', 'criticalCount', 'highCount', 'mediumCount', 'lowCount', 'customerNotes', 'createdAt', 'updatedAt']`.
   - No shadow or extra fields are permitted (`data.keys().hasAll(...) && data.keys().hasOnly(...)`).
4. **Immutable & Server-Timestamp Fields**:
   - `ownerId` and `createdAt` are immutable after creation (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`).
   - On `create`, `createdAt == request.time && updatedAt == request.time`.
   - On `update`, only the `UpdateCustomerNotes` action is permitted (`incoming().diff(existing()).affectedKeys().hasOnly(['customerNotes', 'updatedAt'])`) and `incoming().updatedAt == request.time`.
5. **Query Enforcer on List**: `allow list` enforces `isSignedIn() && isEmailVerified() && resource.data.ownerId == request.auth.uid` without delegating filtering to the client and without calling `get()` or `exists()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Create**: `auth == null` attempting to create `/savedReports/rep_1`. -> `PERMISSION_DENIED`
2. **Unverified Email Create**: `auth.uid == 'user_1'`, `email_verified == false` attempting to create `/savedReports/rep_1`. -> `PERMISSION_DENIED`
3. **Identity Spoofing on Create**: `auth.uid == 'user_1'` setting `ownerId: 'user_2'`. -> `PERMISSION_DENIED`
4. **Shadow Field Injection on Create**: Including `isAdmin: true` alongside required fields. -> `PERMISSION_DENIED`
5. **ID Poisoning Attack**: Creating `/savedReports/bad$id!@#` with invalid characters. -> `PERMISSION_DENIED`
6. **Oversized Title Resource Exhaustion**: Setting `title` to a 500-character string (exceeds `maxLength: 200`). -> `PERMISSION_DENIED`
7. **Invalid Enum Value**: Setting `overallRiskLevel: 'Catastrophic'` or `sourceType: 'exe'`. -> `PERMISSION_DENIED`
8. **Client Timestamp Forgery on Create**: Setting `createdAt` to a past timestamp (`!= request.time`). -> `PERMISSION_DENIED`
9. **Unauthorized Update of Immutable Fields**: Updating `title` or `overallRiskLevel` after creation (not in `['customerNotes', 'updatedAt']`). -> `PERMISSION_DENIED`
10. **Value Poisoning on Update**: Updating `customerNotes` with a non-string (`12345`) or >1000-character string. -> `PERMISSION_DENIED`
11. **Cross-User Read (`get`)**: `user_2` attempting `get` on `user_1`'s report. -> `PERMISSION_DENIED`
12. **Unfiltered List Scraping (`list`)**: `user_2` attempting to list reports where `resource.data.ownerId != request.auth.uid`. -> `PERMISSION_DENIED`

## 3. Red Team Conflict Report
- **Identity Spoofing**: Blocked by `data.ownerId == request.auth.uid` in `isValidSavedReport(data)` and immutability check on update.
- **State Shortcutting / System-Generated Fields**: All analysis metrics (`overallRiskLevel`, `overallSummary`, `findingsCount`, `criticalCount`, `highCount`, `mediumCount`, `lowCount`, `title`, `sourceType`, `targetUrl`) are locked against client mutation after creation via `incoming().diff(existing()).affectedKeys().hasOnly(['customerNotes', 'updatedAt'])`.
- **Resource Poisoning**: Blocked by `isValidId(reportId)` and explicit `.size()` bounds on every string and numeric range checks on every integer counter.
- **Value Poisoning**: Blocked because `isValidSavedReport(incoming())` wraps the `allow update` rule prior to `affectedKeys().hasOnly(...)`.
