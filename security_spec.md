# Security Specification — PAKFUN Platform

## 1. Data Invariants
1. A `UserAccount` at `/users/{userId}` can only be read or updated by `userId` (owner) or a verified Admin. Non-admin users cannot set `isFrozen: false`, lower `fraudScore`, or modify `kycStatus` to `'verified'`.
2. PII (`email`, `phone`, `documentNumber`, `address`) is strictly isolated in `/users/{userId}/private/kyc` and readable only by the owner or verified Admin.
3. A `Transaction` at `/transactions/{txId}` created by a player must have `userId == request.auth.uid`, `status == 'pending'` (except system-verified reward claims or admin), and `amount > 0`. Once `status` becomes `'approved'` or `'rejected'`, non-admins cannot modify the transaction.
4. `GameRecord` documents at `/gameHistory/{betId}` are strictly immutable after creation and owned by `userId == request.auth.uid`.
5. `SupportTicket` messages arrays are bounded (`size() <= 50`) and non-admins can only view/update their own tickets while `status != 'resolved'`.
6. `FraudAlert` documents can only be read, listed, updated, or deleted by verified Admins.
7. `/admins/{userId}` cannot be created or modified by regular users (prevents self-assigned admin escalation).
8. All timestamps (`createdAt`, `updatedAt`, `submittedAt`) are validated against `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on User Create**: Creating `/users/victimUid` with `uid: "victimUid"` while signed in as `attackerUid` -> MUST return `PERMISSION_DENIED`.
2. **Self-Assigned Admin Escalation**: Creating `/admins/attackerUid` while signed in as a regular user -> MUST return `PERMISSION_DENIED`.
3. **Self-Approving KYC Status**: Updating `/users/attackerUid` with `{ kycStatus: "verified" }` as non-admin -> MUST return `PERMISSION_DENIED`.
4. **Unfreezing Own Account**: Updating `/users/attackerUid` with `{ isFrozen: false }` when currently frozen -> MUST return `PERMISSION_DENIED`.
5. **Shadow Field Injection on Transaction**: Creating `/transactions/tx1` with extra ghost field `{ isVerifiedByBank: true }` -> MUST return `PERMISSION_DENIED`.
6. **Pre-Approved Deposit Forgery**: Creating `/transactions/tx2` as non-admin with `{ status: "approved", type: "deposit", amount: 500000 }` -> MUST return `PERMISSION_DENIED`.
7. **Terminal State Tampering**: Updating a `'rejected'` transaction back to `'approved'` as non-admin -> MUST return `PERMISSION_DENIED`.
8. **Cross-User PII Read**: Reading `/users/victimUid/private/kyc` while authenticated as `attackerUid` -> MUST return `PERMISSION_DENIED`.
9. **Blanket List Query Scraping**: Listing `/transactions` or `/gameHistory` without scoping `where('userId', '==', auth.uid)` as non-admin -> MUST return `PERMISSION_DENIED`.
10. **ID Poisoning / Resource Exhaustion**: Writing to `/transactions/<1500-char-string>` or injecting a 10KB string into `displayName` -> MUST return `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Creating a `GameRecord` with a backdated `createdAt` instead of `request.time` -> MUST return `PERMISSION_DENIED`.
12. **Unverified Email Spoof**: Attempting admin action with `request.auth.token.email == 'abduljabbarbaloch358@gmail.com'` when `email_verified == false` -> MUST return `PERMISSION_DENIED`.
