import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Check,
  TrendingUp,
  X,
  Wallet,
  Signal,
  Menu,
  Box,
  ShieldCheck,
  Dices,
  Square,
  Play,
  Target,
} from 'lucide-react';
import { GameId } from '../../types/platform';
import { soundFx } from '../../lib/sound';
import { formatRs } from '../../lib/vip';

interface Props {
  playerId?: string;
  playerName?: string;
  walletBalance: number;
  isSignedIn: boolean;
  onRequireAuth: () => void;
  onOpenDeposit?: () => void;
  onSettleBet: (params: {
    game: GameId;
    betAmount: number;
    multiplier: number;
    payout: number;
    outcome: 'win' | 'loss' | 'cashout';
    details: string;
  }) => Promise<boolean | undefined>;
  onBroadcastWin: (game: string, betAmount: number, multiplier: number, payout: number) => void;
}

type BetZone = 'low' | 'seven' | 'high';

export type DiceTarget =
  | { kind: 'zone'; zone: BetZone }
  | { kind: 'exact'; number: number };

interface DiceRollRecord {
  d1: number;
  d2: number;
  sum: number;
  zone: BetZone;
  seed: string;
}

interface RollFeedback {
  d1: number;
  d2: number;
  sum: number;
  won: boolean;
  mult: number;
  stake: number;
  payout: number;
  netProfit: number;
  targetLabel: string;
}

const ZONE_META: Record<
  BetZone,
  { label: string; rangeText: string; mult: number; bg: string }
> = {
  low: {
    label: '2-6',
    rangeText: 'Sum 2 to 6',
    mult: 2.3,
    bg: 'bg-[#1D64E8] hover:bg-[#1957CC]',
  },
  seven: {
    label: '7',
    rangeText: 'Sum equals 7',
    mult: 5.6,
    bg: 'bg-[#EA580C] hover:bg-[#D44D08]',
  },
  high: {
    label: '8-12',
    rangeText: 'Sum 8 to 12',
    mult: 2.3,
    bg: 'bg-[#16A34A] hover:bg-[#148E40]',
  },
};

const EXACT_NUMBER_MULTS: Record<number, number> = {
  2: 32,
  3: 16,
  4: 11,
  5: 8,
  6: 6.5,
  7: 5.6,
  8: 6.5,
  9: 8,
  10: 11,
  11: 16,
  12: 32,
};

const EXACT_NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function classifySum(sum: number): BetZone {
  if (sum <= 6) return 'low';
  if (sum === 7) return 'seven';
  return 'high';
}

export function getTargetMeta(target: DiceTarget): { label: string; mult: number; desc: string } {
  if (target.kind === 'zone') {
    const z = ZONE_META[target.zone];
    return { label: z.label, mult: z.mult, desc: z.rangeText };
  }
  const mult = EXACT_NUMBER_MULTS[target.number] ?? 5.6;
  return {
    label: `Exact ${target.number}`,
    mult,
    desc: `Sum equals ${target.number}`,
  };
}

export function evaluateDiceOutcome(
  d1: number,
  d2: number,
  target: DiceTarget,
  stake: number,
): { won: boolean; mult: number; payout: number; netProfit: number; sum: number; zone: BetZone } {
  const sum = d1 + d2;
  const zone = classifySum(sum);
  const { mult: targetMult } = getTargetMeta(target);

  let won = false;
  if (target.kind === 'exact') {
    won = sum === target.number;
  } else if (target.zone === 'low') {
    won = sum >= 2 && sum <= 6;
  } else if (target.zone === 'seven') {
    won = sum === 7;
  } else {
    won = sum >= 8 && sum <= 12;
  }

  const appliedMult = won ? targetMult : 0;
  const payout = won ? Math.round(stake * appliedMult * 100) / 100 : 0;
  const netProfit = Math.round((payout - stake) * 100) / 100;

  return { won, mult: appliedMult, payout, netProfit, sum, zone };
}

function makeSeedHash(): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 18; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const INITIAL_HISTORY: DiceRollRecord[] = [
  { d1: 5, d2: 4, sum: 9, zone: 'high', seed: '17949526012328d75a' },
  { d1: 1, d2: 2, sum: 3, zone: 'low', seed: '17949526012328d75b' },
  { d1: 3, d2: 5, sum: 8, zone: 'high', seed: '17949526012328d75c' },
  { d1: 1, d2: 3, sum: 4, zone: 'low', seed: '17949526012328d75d' },
  { d1: 6, d2: 5, sum: 11, zone: 'high', seed: '17949526012328d75e' },
  { d1: 4, d2: 3, sum: 7, zone: 'seven', seed: '17949526012328d75f' },
  { d1: 2, d2: 5, sum: 7, zone: 'seven', seed: '17949526012328d760' },
  { d1: 5, d2: 6, sum: 11, zone: 'high', seed: '17949526012328d761' },
  { d1: 2, d2: 2, sum: 4, zone: 'low', seed: '17949526012328d762' },
  { d1: 4, d2: 2, sum: 6, zone: 'low', seed: '17949526012328d763' },
  { d1: 3, d2: 4, sum: 7, zone: 'seven', seed: '17949526012328d764' },
  { d1: 1, d2: 2, sum: 3, zone: 'low', seed: '17949526012328d765' },
  { d1: 6, d2: 3, sum: 9, zone: 'high', seed: '17949526012328d766' },
  { d1: 4, d2: 3, sum: 7, zone: 'seven', seed: '17949526012328d767' },
  { d1: 1, d2: 3, sum: 4, zone: 'low', seed: '17949526012328d768' },
];

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function MiniDie({ value }: { value: number }) {
  const pips = PIP_POSITIONS[value] || [4];
  const isRedPip = value === 1 || value === 4;
  return (
    <div className="w-4 h-4 rounded-[3px] bg-white grid grid-cols-3 grid-rows-3 p-[2px] gap-[1px] shrink-0 shadow-xs">
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`rounded-full ${
            pips.includes(i) ? (isRedPip ? 'bg-red-600' : 'bg-zinc-900') : 'bg-transparent'
          }`}
        />
      ))}
    </div>
  );
}

function LargeDie3D({ value, rolling, tilt }: { value: number; rolling: boolean; tilt: string }) {
  const pips = PIP_POSITIONS[value] || [4];
  const isRedPip = value === 1 || value === 4;
  return (
    <div
      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-white via-zinc-100 to-zinc-300 border-2 border-white/80 shadow-[0_14px_24px_rgba(0,0,0,0.45),inset_0_-6px_10px_rgba(0,0,0,0.12)] grid grid-cols-3 grid-rows-3 p-3.5 gap-1.5 transition-transform duration-150 ${
        rolling ? 'animate-bounce scale-95' : tilt
      }`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="flex items-center justify-center">
          {pips.includes(i) && (
            <span
              className={`rounded-full shadow-inner ${
                value === 1
                  ? 'w-5 h-5 bg-red-600'
                  : isRedPip
                    ? 'w-3.5 h-3.5 bg-red-600'
                    : 'w-3.5 h-3.5 bg-zinc-900'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function LuckyDiceGame({
  playerId = 'guest',
  walletBalance,
  isSignedIn,
  onRequireAuth,
  onOpenDeposit,
  onSettleBet,
  onBroadcastWin,
}: Props) {
  const [roundNum, setRoundNum] = useState(1912454);
  const [dice, setDice] = useState<[number, number]>([1, 4]);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<DiceRollRecord[]>(INITIAL_HISTORY);
  const [selectedTarget, setSelectedTarget] = useState<DiceTarget>({ kind: 'zone', zone: 'low' });
  const [betAmount, setBetAmount] = useState<number>(10);
  const [mode, setMode] = useState<'Manual' | 'Auto'>('Manual');
  const [autoRunning, setAutoRunning] = useState(false);
  const [feedback, setFeedback] = useState<RollFeedback | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTrend, setShowTrend] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [copiedSeed, setCopiedSeed] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const mountedRef = useRef(true);
  const rollingRef = useRef(false);
  const autoRunningRef = useRef(false);
  autoRunningRef.current = autoRunning;

  const targetRef = useRef<DiceTarget>(selectedTarget);
  targetRef.current = selectedTarget;
  const betAmountRef = useRef(betAmount);
  betAmountRef.current = betAmount;
  const walletBalanceRef = useRef(walletBalance);
  walletBalanceRef.current = walletBalance;
  const projectedBalanceRef = useRef(walletBalance);
  useEffect(() => {
    projectedBalanceRef.current = walletBalance;
  }, [walletBalance]);

  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;
  const onSettleBetRef = useRef(onSettleBet);
  onSettleBetRef.current = onSettleBet;
  const onBroadcastWinRef = useRef(onBroadcastWin);
  onBroadcastWinRef.current = onBroadcastWin;

  const tumbleTimerRef = useRef<number | null>(null);
  const rollTimeoutRef = useRef<number | null>(null);
  const autoDelayRef = useRef<number | null>(null);

  const clearAllTimers = useCallback(() => {
    if (tumbleTimerRef.current !== null) {
      window.clearInterval(tumbleTimerRef.current);
      tumbleTimerRef.current = null;
    }
    if (rollTimeoutRef.current !== null) {
      window.clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = null;
    }
    if (autoDelayRef.current !== null) {
      window.clearTimeout(autoDelayRef.current);
      autoDelayRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      autoRunningRef.current = false;
      rollingRef.current = false;
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const latestRoll = history[history.length - 1];
  const shortPlayerId = playerId.slice(0, 8).toUpperCase();

  const stopAuto = useCallback(() => {
    autoRunningRef.current = false;
    setAutoRunning(false);
    if (autoDelayRef.current !== null) {
      window.clearTimeout(autoDelayRef.current);
      autoDelayRef.current = null;
    }
  }, []);

  const rollOnce = useCallback(() => {
    if (rollingRef.current || !mountedRef.current) return;
    setErrorMsg(null);

    if (!isSignedInRef.current) {
      stopAuto();
      onRequireAuth();
      return;
    }

    const stake = Number(betAmountRef.current);
    const activeTarget = targetRef.current;
    const available = autoRunningRef.current
      ? Math.min(walletBalanceRef.current, projectedBalanceRef.current)
      : walletBalanceRef.current;

    if (!Number.isFinite(stake) || stake < 1 || stake > 50000) {
      stopAuto();
      setErrorMsg('Enter a valid stake between Rs 1 and Rs 50,000.');
      return;
    }
    if (stake > available) {
      stopAuto();
      setErrorMsg(`Insufficient balance (${formatRs(available)} available). Lower your stake or deposit.`);
      return;
    }

    rollingRef.current = true;
    setRolling(true);
    setFeedback(null);
    soundFx.chip();

    if (tumbleTimerRef.current !== null) window.clearInterval(tumbleTimerRef.current);
    tumbleTimerRef.current = window.setInterval(() => {
      if (!mountedRef.current) return;
      setDice([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]);
    }, 70);

    rollTimeoutRef.current = window.setTimeout(async () => {
      if (tumbleTimerRef.current !== null) {
        window.clearInterval(tumbleTimerRef.current);
        tumbleTimerRef.current = null;
      }
      if (!mountedRef.current) return;

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const outcome = evaluateDiceOutcome(d1, d2, activeTarget, stake);
      const targetMeta = getTargetMeta(activeTarget);
      const seed = makeSeedHash();

      setDice([d1, d2]);
      setRoundNum((r) => r + 1);
      setHistory((h) => [...h.slice(-29), { d1, d2, sum: outcome.sum, zone: outcome.zone, seed }]);

      // Update optimistic projected balance immediately for continuous Auto validation
      projectedBalanceRef.current = Math.max(
        0,
        Math.round((projectedBalanceRef.current - stake + outcome.payout) * 100) / 100,
      );

      // Instant feedback as soon as the dice land
      setFeedback({
        d1,
        d2,
        sum: outcome.sum,
        won: outcome.won,
        mult: outcome.mult,
        stake,
        payout: outcome.payout,
        netProfit: outcome.netProfit,
        targetLabel: targetMeta.label,
      });

      if (outcome.won) {
        soundFx.win();
      } else {
        soundFx.crash();
      }

      let settledOk = false;
      try {
        const res = await onSettleBetRef.current({
          game: 'lucky-dice',
          betAmount: stake,
          multiplier: outcome.mult,
          payout: outcome.payout,
          outcome: outcome.won ? 'win' : 'loss',
          details: `Lucky Dice [${d1}+${d2}=${outcome.sum}] · Target ${targetMeta.label}`,
        });
        settledOk = res !== false;
      } catch {
        settledOk = false;
      } finally {
        rollingRef.current = false;
        if (mountedRef.current) {
          setRolling(false);
        }
      }

      if (!mountedRef.current) return;

      if (!settledOk) {
        stopAuto();
        setFeedback(null);
        setErrorMsg('Could not settle bet on server. Please check your connection or balance.');
        return;
      }

      if (outcome.won) {
        onBroadcastWinRef.current('Lucky Dice', stake, outcome.mult, outcome.payout);
      }

      if (autoRunningRef.current) {
        autoDelayRef.current = window.setTimeout(() => {
          if (mountedRef.current && autoRunningRef.current) {
            rollOnce();
          }
        }, 900);
      }
    }, 650);
  }, [onRequireAuth, stopAuto]);

  const handleSelectZone = (z: BetZone) => {
    if (rolling) return;
    soundFx.tick();
    setSelectedTarget({ kind: 'zone', zone: z });
    setErrorMsg(null);
  };

  const handleSelectExact = (num: number) => {
    if (rolling) return;
    soundFx.tick();
    setSelectedTarget({ kind: 'exact', number: num });
    setErrorMsg(null);
  };

  const handlePrimaryAction = () => {
    if (mode === 'Auto') {
      if (autoRunning) {
        stopAuto();
      } else {
        autoRunningRef.current = true;
        setAutoRunning(true);
        rollOnce();
      }
    } else {
      rollOnce();
    }
  };

  const trendStats = useMemo(() => {
    const total = Math.max(1, history.length);
    const low = history.filter((r) => r.zone === 'low').length;
    const seven = history.filter((r) => r.zone === 'seven').length;
    const high = history.filter((r) => r.zone === 'high').length;
    return {
      lowPct: Math.round((low / total) * 100),
      sevenPct: Math.round((seven / total) * 100),
      highPct: Math.round((high / total) * 100),
    };
  }, [history]);

  const trendColumns = useMemo(() => {
    const cols: DiceRollRecord[][] = [];
    for (const item of history.slice(-18)) {
      const lastCol = cols[cols.length - 1];
      if (lastCol && lastCol[0].zone === item.zone && lastCol.length < 6) {
        lastCol.push(item);
      } else {
        cols.push([item]);
      }
    }
    return cols.slice(-13);
  }, [history]);

  const handleCopySeed = () => {
    navigator.clipboard.writeText(latestRoll?.seed || '').catch(() => {});
    setCopiedSeed(true);
    setTimeout(() => setCopiedSeed(false), 1500);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(shortPlayerId).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const currentSum = dice[0] + dice[1];
  const targetMeta = getTargetMeta(selectedTarget);

  return (
    <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden border border-white/15 bg-[#0A142B] shadow-2xl">
      {/* WG LUCKY DICE Top Bar + Tropical Bamboo Mat Stage */}
      <div className="relative bg-gradient-to-b from-[#0E5D26] via-[#12722E] to-[#0B4A1E] p-3 sm:p-4 overflow-hidden">
        <div
          className="absolute inset-x-4 sm:inset-x-10 top-16 bottom-2 rounded-3xl border-4 border-[#19923E] bg-gradient-to-br from-[#F0B429] via-[#D99B16] to-[#C2840A] opacity-95 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 12px, rgba(255,255,255,0.05) 12px 24px)',
          }}
        />

        {/* Header Strip */}
        <div className="relative z-10 flex items-center justify-between gap-2 pb-2.5">
          <div className="text-[10px] font-mono text-white/75 truncate">
            PKR-52AB-{roundNum}
          </div>

          <div className="font-display text-lg sm:text-xl font-black tracking-tight text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            <span className="text-[#FACC15]">LUCKY </span>
            <span className="text-[#38BDF8]">DICE</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-semibold text-white">
            <span className="inline-flex items-center gap-0.5 text-[#4ADE80]">
              <Signal className="w-3.5 h-3.5" />
              Instant
            </span>
            {onOpenDeposit && (
              <button
                type="button"
                onClick={onOpenDeposit}
                className="inline-flex items-center gap-1 hover:text-[#FACC15] cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Deposit</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowTrend((v) => !v)}
              className="inline-flex items-center gap-0.5 hover:text-[#FACC15] cursor-pointer"
              aria-label="Toggle Trend Chart"
            >
              <Menu className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Recent Dice Pairs Strip + Trend Chart Trigger */}
        <div className="relative z-10 flex items-center gap-1.5 bg-black/35 backdrop-blur-xs rounded-xl p-1.5 border border-white/15 overflow-x-auto">
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
            {history.slice(-7).map((item, idx, arr) => {
              const isLatest = idx === arr.length - 1;
              return (
                <div
                  key={`${item.seed}-${idx}`}
                  className={`relative flex items-center gap-1 px-1.5 py-1 rounded-lg border-2 shrink-0 ${
                    item.zone === 'low'
                      ? 'bg-[#1D4ED8]/60 border-[#3B82F6]'
                      : item.zone === 'seven'
                        ? 'bg-[#C2410C]/65 border-[#FB923C]'
                        : 'bg-[#15803D]/65 border-[#4ADE80]'
                  }`}
                >
                  {isLatest && (
                    <span className="absolute -top-2 right-0 px-1 rounded bg-red-600 text-[8px] font-black text-white leading-tight">
                      NEW
                    </span>
                  )}
                  <MiniDie value={item.d1} />
                  <MiniDie value={item.d2} />
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowTrend(true)}
            className="w-8 h-8 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center shrink-0 cursor-pointer shadow"
            aria-label="Open Trend chart"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
        </div>

        {/* Center Stage */}
        <div className="relative z-10 min-h-[230px] sm:min-h-[250px] flex flex-col items-center justify-between py-3">
          {/* Active Target Pill */}
          <div className="flex flex-col items-center">
            <div className="px-4 py-1.5 rounded-full bg-black/60 border border-[#4ADE80]/60 text-xs font-extrabold text-white shadow-lg flex items-center gap-2">
              <span className="text-[#FACC15]">
                {rolling ? 'Rolling Dice...' : `Dice Total: ${currentSum}`}
              </span>
              <span className="text-white/40">|</span>
              <span className="inline-flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-[#4ADE80]" />
                Target: <strong className="text-[#4ADE80]">{targetMeta.label}</strong> (x{targetMeta.mult})
              </span>
            </div>
          </div>

          {/* Left Quick Target Rules */}
          <div className="hidden sm:block absolute left-2 top-14 w-36 bg-black/45 backdrop-blur-xs rounded-lg p-2 text-[10px] font-mono text-white/90 space-y-1 border border-white/10">
            <div className="text-[#FACC15] font-bold border-b border-white/10 pb-0.5">
              Active Target
            </div>
            <div className="text-white font-bold">{targetMeta.label}</div>
            <div className="text-white/80">{targetMeta.desc}</div>
            <div className="text-[#4ADE80] font-bold">
              Win: {formatRs(betAmount * targetMeta.mult)}
            </div>
          </div>

          {/* Two 3D Dice Center */}
          <div className="relative flex items-center justify-center gap-4 sm:gap-6 my-2">
            <LargeDie3D value={dice[0]} rolling={rolling} tilt="-rotate-6" />
            <LargeDie3D value={dice[1]} rolling={rolling} tilt="rotate-6" />
          </div>

          {/* Instant Outcome / Target Readout */}
          <div className="flex items-center justify-between w-full px-2 gap-2">
            <div className="text-xs font-bold text-white drop-shadow flex flex-wrap items-center gap-1.5">
              {feedback ? (
                <span
                  className={`px-3.5 py-1.5 rounded-full shadow-lg border ${
                    feedback.won
                      ? 'bg-[#16A34A] border-[#86EFAC] text-white'
                      : 'bg-black/80 border-red-400/50 text-white'
                  }`}
                >
                  {feedback.won
                    ? `WIN! [${feedback.d1}+${feedback.d2}=${feedback.sum}] matched ${feedback.targetLabel} · Payout ${formatRs(feedback.payout)}`
                    : `MISSED · [${feedback.d1}+${feedback.d2}=${feedback.sum}] vs Target ${feedback.targetLabel} · -${formatRs(feedback.stake)}`}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-black/55 text-white/95">
                  Target: <strong>{targetMeta.label}</strong> ({targetMeta.desc}) · Payout{' '}
                  <strong className="text-[#FACC15]">{formatRs(betAmount * targetMeta.mult)}</strong>
                </span>
              )}
            </div>
            <span className="font-display text-sm font-black italic text-black/25 select-none">WG</span>
          </div>
        </div>

        {/* Trend Chart Modal */}
        {showTrend && (
          <div className="absolute inset-0 z-30 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="w-full max-w-md rounded-2xl bg-gradient-to-b from-[#169C42] to-[#0C6A2A] border-2 border-[#4ADE80]/60 p-4 text-white shadow-2xl space-y-3">
              <div className="text-center font-display text-base font-extrabold">Trend chart</div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#2563EB] rounded-lg py-2 px-1 font-mono text-xs font-bold">
                  2-6 <span className="font-normal">({trendStats.lowPct}%)</span>
                </div>
                <div className="bg-[#EA580C] rounded-lg py-2 px-1 font-mono text-xs font-bold">
                  7 <span className="font-normal">({trendStats.sevenPct}%)</span>
                </div>
                <div className="bg-[#16A34A] border border-white/25 rounded-lg py-2 px-1 font-mono text-xs font-bold">
                  8-12 <span className="font-normal">({trendStats.highPct}%)</span>
                </div>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto py-1">
                {history.slice(-14).map((h, i, arr) => (
                  <span
                    key={`${h.seed}-t-${i}`}
                    className={`w-5 h-5 rounded text-[10px] font-mono font-bold inline-flex items-center justify-center shrink-0 ${
                      h.zone === 'low'
                        ? 'bg-[#2563EB]'
                        : h.zone === 'seven'
                          ? 'bg-[#EA580C]'
                          : 'bg-[#16A34A] border border-white/30'
                    } ${i === arr.length - 1 ? 'ring-2 ring-[#FACC15]' : ''}`}
                  >
                    {h.sum}
                  </span>
                ))}
              </div>

              <div className="bg-[#0B5923] rounded-lg p-2 grid grid-cols-13 gap-1 overflow-x-auto">
                {Array.from({ length: 13 }, (_, colIdx) => {
                  const col = trendColumns[colIdx] || [];
                  return (
                    <div key={colIdx} className="flex flex-col gap-1">
                      {Array.from({ length: 5 }, (_, rowIdx) => {
                        const cell = col[rowIdx];
                        return (
                          <div
                            key={rowIdx}
                            className={`w-5 h-5 rounded-[3px] text-[9px] font-mono font-bold flex items-center justify-center border border-white/10 ${
                              cell
                                ? cell.zone === 'low'
                                  ? 'bg-[#2563EB] text-white'
                                  : cell.zone === 'seven'
                                    ? 'bg-[#EA580C] text-white'
                                    : 'bg-[#22C55E] text-white'
                                : 'bg-black/15'
                            }`}
                          >
                            {cell ? cell.sum : ''}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowTrend(false)}
                  aria-label="Close trend chart"
                  className="w-8 h-8 rounded-full bg-white text-[#0C6A2A] flex items-center justify-center shadow-lg cursor-pointer"
                >
                  <X className="w-4 h-4 font-bold" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3 Big Zone Target Tiles: 2-6 (x2.3) | 7 (x5.6) | 8-12 (x2.3) */}
      <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#0A1328]">
        {(['low', 'seven', 'high'] as BetZone[]).map((z) => {
          const meta = ZONE_META[z];
          const active =
            (selectedTarget.kind === 'zone' && selectedTarget.zone === z) ||
            (selectedTarget.kind === 'exact' && z === 'seven' && selectedTarget.number === 7);
          return (
            <button
              key={z}
              type="button"
              disabled={rolling}
              onClick={() => handleSelectZone(z)}
              className={`${meta.bg} rounded-xl py-3 px-2 text-center text-white transition cursor-pointer border-2 relative ${
                active ? 'border-[#FACC15] shadow-lg ring-2 ring-[#FACC15]/40' : 'border-transparent opacity-85'
              }`}
            >
              {active && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-[#FACC15] text-[#111827] text-[9px] font-black uppercase leading-none">
                  Target
                </span>
              )}
              <div className="font-display text-xl sm:text-2xl font-black leading-none">{meta.label}</div>
              <div className="font-mono text-xs font-bold text-white/90 mt-1">x{meta.mult}</div>
            </button>
          );
        })}
      </div>

      {/* Optional Exact Target Number Selector (2 - 12) */}
      <div className="px-2.5 pb-2.5 bg-[#0A1328] space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-[#94A3B8] font-mono px-0.5">
          <span>Or pick Exact Sum Target (2–12):</span>
          {selectedTarget.kind === 'exact' && (
            <span className="text-[#FACC15] font-bold">
              Target {selectedTarget.number} · x{EXACT_NUMBER_MULTS[selectedTarget.number]}
            </span>
          )}
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1">
          {EXACT_NUMBERS.map((num) => {
            const isExactActive = selectedTarget.kind === 'exact' && selectedTarget.number === num;
            return (
              <button
                key={num}
                type="button"
                disabled={rolling}
                onClick={() => handleSelectExact(num)}
                className={`py-1.5 rounded-lg text-center font-mono transition-colors cursor-pointer border ${
                  isExactActive
                    ? 'bg-[#EAB308] border-[#FACC15] text-[#111827] font-black shadow'
                    : 'bg-[#111E3C] border-white/10 text-white/85 hover:border-[#FACC15]/50'
                }`}
              >
                <div className="text-xs font-bold leading-none">{num}</div>
                <div className={`text-[9px] mt-0.5 leading-none ${isExactActive ? 'text-[#111827]/80' : 'text-[#94A3B8]'}`}>
                  {EXACT_NUMBER_MULTS[num]}x
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Clear Validation / Insufficient Balance Prompt */}
      {errorMsg && (
        <div className="mx-2.5 mb-2 rounded-xl bg-red-500/15 border border-red-500/40 px-3 py-2 flex items-center justify-between gap-2 text-xs text-red-200">
          <span>{errorMsg}</span>
          {onOpenDeposit && (
            <button
              type="button"
              onClick={onOpenDeposit}
              className="px-2.5 py-1 rounded-lg bg-[#1BB64E] text-white font-bold shrink-0 cursor-pointer"
            >
              Deposit
            </button>
          )}
        </div>
      )}

      {/* Last Seed Provably Fair Bar */}
      <div className="px-3 py-2 bg-[#070F22] border-y border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <div className="flex items-center gap-2 text-[#94A3B8] truncate max-w-[70%]">
          <Box className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
          <span className="truncate">Last seed: {latestRoll?.seed}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopySeed}
            className="p-1 text-[#94A3B8] hover:text-white cursor-pointer"
            aria-label="Copy round seed"
          >
            {copiedSeed ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setShowVerify((v) => !v)}
            className="px-2.5 py-1 rounded bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-semibold cursor-pointer"
          >
            Verify
          </button>
        </div>
      </div>

      {showVerify && latestRoll && (
        <div className="px-4 py-2.5 bg-[#0F1B38] border-b border-white/10 text-xs font-mono text-[#CBD5E1] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#4ADE80]" />
            <span>
              Dice [{latestRoll.d1} + {latestRoll.d2}] = {latestRoll.sum} ({ZONE_META[latestRoll.zone].label}) · Seed{' '}
              {latestRoll.seed}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowVerify(false)}
            className="text-white/60 hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {/* Bottom Manual / Auto Control Deck */}
      <div className="p-3 bg-[#0C1730] space-y-2.5">
        <div className="flex items-stretch gap-2">
          <div className="flex flex-col gap-1 shrink-0 w-12">
            {(['Manual', 'Auto'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  if (m === 'Manual') {
                    stopAuto();
                  }
                }}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                  mode === m ? 'bg-[#2563EB] text-white' : 'bg-[#071022] text-[#64748B]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-[#071022] border border-white/10 rounded-xl p-1 gap-1">
                <button
                  type="button"
                  disabled={rolling}
                  onClick={() => setBetAmount((v) => Math.max(1, Math.floor(v / 2)))}
                  className="px-2.5 py-2 rounded-lg bg-[#1E3A8A] text-xs font-mono font-bold text-white cursor-pointer disabled:opacity-50"
                >
                  1/2
                </button>
                <div className="flex-1 text-center">
                  <div className="text-[9px] text-[#94A3B8] leading-none">Bet amount (Rs)</div>
                  <input
                    type="number"
                    min={1}
                    max={50000}
                    disabled={rolling}
                    value={betAmount}
                    onChange={(e) => {
                      setBetAmount(Math.max(1, Number(e.target.value)));
                      setErrorMsg(null);
                    }}
                    className="w-full bg-transparent text-center font-mono text-sm font-bold text-white focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={rolling}
                  onClick={() => setBetAmount((v) => Math.min(50000, v * 2))}
                  className="px-2.5 py-2 rounded-lg bg-[#1E3A8A] text-xs font-mono font-bold text-white cursor-pointer disabled:opacity-50"
                >
                  x2
                </button>
              </div>

              <button
                type="button"
                disabled={rolling && mode === 'Manual'}
                onClick={handlePrimaryAction}
                className={`px-4 sm:px-6 py-3.5 rounded-xl font-display text-xs sm:text-sm font-black cursor-pointer shrink-0 shadow-lg flex items-center gap-1.5 ${
                  autoRunning
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-[#EAB308] hover:bg-[#CA9A06] text-[#111827] disabled:opacity-60'
                }`}
              >
                {mode === 'Auto' ? (
                  autoRunning ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>STOP AUTO</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>START AUTO</span>
                    </>
                  )
                ) : (
                  <>
                    <Dices className="w-4 h-4" />
                    <span>{rolling ? 'ROLLING...' : 'BET & ROLL'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Presets Row (1, 10, 100, 1000) */}
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 10, 100, 1000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={rolling}
                  onClick={() => {
                    setBetAmount(preset);
                    setErrorMsg(null);
                  }}
                  className={`py-1.5 rounded-lg font-mono text-xs font-bold cursor-pointer disabled:opacity-50 ${
                    betAmount === preset
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-[#172546] hover:bg-[#1E315C] text-white/90'
                  }`}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer ID & Balance Bar */}
        <div className="flex items-center justify-between pt-1.5 border-t border-white/10 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <span>ID:{shortPlayerId}</span>
            <button
              type="button"
              onClick={handleCopyId}
              className="text-[#94A3B8] hover:text-white cursor-pointer"
              aria-label="Copy player ID"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex items-center gap-1.5 bg-[#071022] border border-white/10 rounded-full px-3 py-1">
            <span className="w-4 h-4 rounded-full bg-[#16A34A] text-[9px] font-black text-white inline-flex items-center justify-center">
              Rs
            </span>
            <span className="font-bold text-[#FACC15] tabular-nums">{walletBalance.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
