import { useState } from 'react';
import { Gift, Crown, Share2, Copy, Check, CalendarCheck } from 'lucide-react';
import { UserAccount } from '../types/platform';
import { computeVipTier, DAILY_REWARD_SCHEDULE, formatRs, getNextVipTier, VIP_TIERS } from '../lib/vip';

interface Props {
  userProfile: UserAccount | null;
  isSignedIn: boolean;
  onRequireAuth: () => void;
  onClaimDaily: () => Promise<boolean | undefined>;
  onApplyReferral: (code: string) => Promise<boolean | undefined>;
}

export function RewardsVipView({
  userProfile,
  isSignedIn,
  onRequireAuth,
  onClaimDaily,
  onApplyReferral,
}: Props) {
  const [friendCode, setFriendCode] = useState('');
  const [copied, setCopied] = useState(false);

  const wagered = userProfile?.totalWagered ?? 0;
  const currentVip = computeVipTier(wagered);
  const nextVip = getNextVipTier(wagered);
  const progressPct = nextVip
    ? Math.min(100, Math.round(((wagered - currentVip.minWagered) / (nextVip.minWagered - currentVip.minWagered)) * 100))
    : 100;

  const today = new Date().toISOString().slice(0, 10);
  const claimedToday = userProfile?.lastDailyClaim === today;
  const currentStreakIdx = (userProfile?.streakDays ?? 0) % 7;

  const handleCopyCode = () => {
    if (!userProfile?.referralCode) return;
    navigator.clipboard.writeText(userProfile.referralCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Daily Streak Rewards */}
      <section className="bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#F5B82E]">
              <CalendarCheck className="w-4 h-4" />
              <span>7-Day Login Streak · {currentVip.tier} VIP ({currentVip.dailyMultiplier}x Multiplier)</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">Daily Rewards</h2>
          </div>

          <button
            onClick={() => (isSignedIn ? onClaimDaily() : onRequireAuth())}
            disabled={claimedToday}
            className="px-5 py-2.5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:bg-[#202825] disabled:text-[#A3B3AC] text-white text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Gift className="w-4 h-4" />
            <span>{claimedToday ? 'Claimed Today' : 'Claim Today’s Bonus'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {DAILY_REWARD_SCHEDULE.map((base, idx) => {
            const reward = Math.round(base * currentVip.dailyMultiplier);
            const isPast = idx < currentStreakIdx;
            const isToday = idx === currentStreakIdx && !claimedToday;
            return (
              <div
                key={idx}
                className={`rounded-xl p-3.5 border text-center space-y-1 ${
                  isToday
                    ? 'bg-[#19B954]/15 border-[#19B954]'
                    : isPast
                      ? 'bg-[#101413] border-white/5 opacity-60'
                      : 'bg-[#101413] border-white/10'
                }`}
              >
                <div className="text-[11px] text-[#A3B3AC]">Day {idx + 1}</div>
                <div className="font-mono text-base font-bold text-[#F5B82E] tabular-nums">
                  Rs {reward}
                </div>
                <div className="text-[10px] text-[#A3B3AC]">
                  {isPast ? 'Claimed' : isToday ? 'Ready' : 'Locked'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* VIP Levels */}
        <section className="lg:col-span-7 bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#F5B82E]">
                <Crown className="w-4 h-4" />
                <span>Tiered Loyalty Program</span>
              </div>
              <h3 className="text-xl font-bold text-white mt-1">
                Current Tier: {currentVip.tier}
              </h3>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#A3B3AC]">Total Wagered</div>
              <div className="font-mono text-base font-bold text-white tabular-nums">
                {formatRs(wagered)}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded-full bg-[#101413] overflow-hidden">
              <div
                className="h-full bg-[#19B954] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
              <span>{progressPct}% progress</span>
              <span>
                {nextVip
                  ? `${formatRs(nextVip.minWagered - wagered)} more to ${nextVip.tier}`
                  : 'Maximum Diamond VIP Achieved'}
              </span>
            </div>
          </div>

          {/* VIP Tiers Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#A3B3AC]">
                  <th className="py-2.5 font-medium">VIP Tier</th>
                  <th className="py-2.5 font-medium">Wager Target</th>
                  <th className="py-2.5 font-medium">Cashback</th>
                  <th className="py-2.5 font-medium text-right">Daily Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {VIP_TIERS.map((tier) => (
                  <tr
                    key={tier.tier}
                    className={tier.tier === currentVip.tier ? 'bg-[#19B954]/10' : ''}
                  >
                    <td className="py-2.5 font-semibold" style={{ color: tier.color }}>
                      {tier.tier}
                    </td>
                    <td className="py-2.5 font-mono text-[#D1DCD7] tabular-nums">
                      Rs {tier.minWagered.toLocaleString()}
                    </td>
                    <td className="py-2.5 font-mono text-[#19B954] tabular-nums">
                      {tier.cashbackPct}%
                    </td>
                    <td className="py-2.5 font-mono text-white text-right tabular-nums">
                      Rs {tier.withdrawLimit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Referral Bonus */}
        <section className="lg:col-span-5 bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#19B954]">
              <Share2 className="w-4 h-4" />
              <span>Invite & Earn Rs 250</span>
            </div>
            <h3 className="text-xl font-bold text-white mt-1">Referral Program</h3>
            <p className="text-xs text-[#A3B3AC] mt-1">
              Share your PAKFUN invite code. Friends receive Rs 250 bonus on activation.
            </p>
          </div>

          <div className="bg-[#101413] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-[#A3B3AC]">Your Referral Code</div>
              <div className="font-mono text-lg font-bold text-[#F5B82E] tracking-wider mt-0.5">
                {userProfile?.referralCode || 'SIGN-IN-TO-VIEW'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              disabled={!isSignedIn}
              className="px-3.5 py-2 rounded-xl bg-[#202825] hover:bg-[#28332F] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {copied ? <Check className="w-4 h-4 text-[#19B954]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-[#101413] border border-white/10 rounded-xl p-3">
              <div className="text-[11px] text-[#A3B3AC]">Friends Invited</div>
              <div className="font-mono text-lg font-bold text-white mt-0.5 tabular-nums">
                {userProfile?.referralCount ?? 0}
              </div>
            </div>
            <div className="bg-[#101413] border border-white/10 rounded-xl p-3">
              <div className="text-[11px] text-[#A3B3AC]">Referral Earnings</div>
              <div className="font-mono text-lg font-bold text-[#19B954] mt-0.5 tabular-nums">
                {formatRs(userProfile?.referralEarnings ?? 0)}
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isSignedIn) {
                onRequireAuth();
                return;
              }
              onApplyReferral(friendCode);
              setFriendCode('');
            }}
            className="space-y-2.5 pt-2 border-t border-white/10"
          >
            <label className="text-xs font-medium text-[#A3B3AC]">
              Have a Friend’s Referral Code?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter invite code"
                disabled={Boolean(userProfile?.referredBy)}
                value={userProfile?.referredBy || friendCode}
                onChange={(e) => setFriendCode(e.target.value)}
                className="flex-1 bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white uppercase disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={Boolean(userProfile?.referredBy)}
                className="px-4 py-2.5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:bg-[#202825] text-white text-xs font-semibold cursor-pointer"
              >
                {userProfile?.referredBy ? 'Applied' : 'Redeem'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
