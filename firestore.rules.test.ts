/**
 * Phase 0: Security Test Suite for PAKFUN Firestore Rules ("Dirty Dozen" Payloads)
 * Verifies Identity, Integrity, State Locking, and PII Isolation invariants.
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on User Create',
    collectionPath: '/users/victimUid',
    operation: 'create',
    auth: { uid: 'attackerUid', email_verified: true },
    payload: { uid: 'victimUid', displayName: 'Attacker', balance: 500 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Self-Assigned Admin Escalation',
    collectionPath: '/admins/attackerUid',
    operation: 'create',
    auth: { uid: 'attackerUid', email: 'attacker@example.com', email_verified: true },
    payload: { uid: 'attackerUid', assignedAt: 'SERVER_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-Approving KYC Status',
    collectionPath: '/users/attackerUid',
    operation: 'update',
    auth: { uid: 'attackerUid', email_verified: true },
    payload: { kycStatus: 'verified' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unfreezing Own Frozen Account',
    collectionPath: '/users/attackerUid',
    operation: 'update',
    auth: { uid: 'attackerUid', email_verified: true },
    payload: { isFrozen: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Field Injection on Transaction',
    collectionPath: '/transactions/tx_shadow_1',
    operation: 'create',
    auth: { uid: 'attackerUid', email_verified: true },
    payload: { id: 'tx_shadow_1', userId: 'attackerUid', isVerifiedByBank: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Pre-Approved Deposit Forgery',
    collectionPath: '/transactions/tx_forge_2',
    operation: 'create',
    auth: { uid: 'attackerUid', email_verified: true },
    payload: { id: 'tx_forge_2', userId: 'attackerUid', type: 'deposit', status: 'approved', amount: 500000 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Terminal State Tampering on Rejected Transaction',
    collectionPath: '/transactions/tx_rejected_3',
    operation: 'update',
    auth: { uid: 'attackerUid', email_verified: true },
    payload: { status: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Cross-User KYC PII Read',
    collectionPath: '/users/victimUid/private/kyc',
    operation: 'get',
    auth: { uid: 'attackerUid', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Blanket Transaction List Scraping',
    collectionPath: '/transactions',
    operation: 'list',
    auth: { uid: 'attackerUid', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'ID Poisoning / Resource Exhaustion',
    collectionPath: `/transactions/${'a'.repeat(1500)}`,
    operation: 'create',
    auth: { uid: 'attackerUid', email_verified: true },
    payload: { id: 'a'.repeat(1500), userId: 'attackerUid' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Backdated GameRecord Timestamp Forgery',
    collectionPath: '/gameHistory/bet_backdated_1',
    operation: 'create',
    auth: { uid: 'attackerUid', email_verified: true },
    payload: { id: 'bet_backdated_1', userId: 'attackerUid', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unverified Email Admin Spoof',
    collectionPath: '/users',
    operation: 'list',
    auth: { uid: 'spoofUid', email: 'abduljabbarbaloch358@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
];
