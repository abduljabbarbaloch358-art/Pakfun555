import { UserAccount, VipTier } from '../types/platform';

export interface VipConfig {
  tier: VipTier;
  minWagered: number;
  cashbackPct: number;
  dailyMultiplier: number;
  withdrawLimit: number;
  color: string;
}

export const VIP_TIERS: VipConfig[] = [
  { tier: 'Bronze', minWagered: 0, cashbackPct: 1, dailyMultiplier: 1, withdrawLimit: 25000, color: '#CD7F32' },
  { tier: 'Silver', minWagered: 5000, cashbackPct: 2.5, dailyMultiplier: 1.5, withdrawLimit: 75000, color: '#94A3B8' },
  { tier: 'Gold', minWagered: 25000, cashbackPct: 5, dailyMultiplier: 2, withdrawLimit: 250000, color: '#F5B82E' },
  { tier: 'Platinum', minWagered: 100000, cashbackPct: 8, dailyMultiplier: 3, withdrawLimit: 1000000, color: '#38BDF8' },
  { tier: 'Diamond', minWagered: 500000, cashbackPct: 12, dailyMultiplier: 5, withdrawLimit: 5000000, color: '#19B954' },
];

export function computeVipTier(totalWagered: number): VipConfig {
  let current = VIP_TIERS[0];
  for (const cfg of VIP_TIERS) {
    if (totalWagered >= cfg.minWagered) {
      current = cfg;
    }
  }
  return current;
}

export function getNextVipTier(totalWagered: number): VipConfig | null {
  for (const cfg of VIP_TIERS) {
    if (totalWagered < cfg.minWagered) return cfg;
  }
  return null;
}

export function evaluateTransactionFraudRisk(
  user: UserAccount,
  type: 'deposit' | 'withdrawal',
  amount: number,
  recentTxCountLastHour: number,
): { flagged: boolean; reason: string; severity: 'low' | 'medium' | 'high' } {
  if (type === 'withdrawal' && amount >= 10000 && user.kycStatus !== 'verified') {
    return {
      flagged: true,
      reason: `High-value withdrawal (Rs ${amount.toLocaleString()}) attempted without verified KYC`,
      severity: 'high',
    };
  }
  if (recentTxCountLastHour >= 4) {
    return {
      flagged: true,
      reason: `Velocity threshold exceeded (${recentTxCountLastHour + 1} payment requests in 1 hour)`,
      severity: 'medium',
    };
  }
  if (type === 'withdrawal' && user.totalWagered < user.totalDeposited * 0.25 && amount > 5000) {
    return {
      flagged: true,
      reason: 'Low wagering rollover prior to withdrawal request (anti-AML heuristic)',
      severity: 'medium',
    };
  }
  if (amount >= 500000) {
    return {
      flagged: true,
      reason: `Single transaction exceeds Rs 500,000 compliance review limit`,
      severity: 'high',
    };
  }
  return { flagged: false, reason: '', severity: 'low' };
}

export const DAILY_REWARD_SCHEDULE = [50, 75, 100, 150, 225, 325, 500];

export function formatRs(val: number): string {
  return `Rs ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
