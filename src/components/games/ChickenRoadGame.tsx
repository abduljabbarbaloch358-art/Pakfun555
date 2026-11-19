import { useRef, useState } from 'react';
import { Flame, Footprints, Banknote } from 'lucide-react';
import { GameId } from '../../types/platform';
import { soundFx } from '../../lib/sound';
import { formatRs } from '../../lib/vip';

interface Props {
  gameTitle?: string;
  provider?: string;
  tagline?: string;
  walletBalance: number;
  isSignedIn: boolean;
  onRequireAuth: () => void;
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

const DIFFICULTIES = {
  Easy: {
    crashChance: 0.14,
    multipliers: [1.14, 1.32, 1.56, 1.88, 2.3, 2.9, 3.8, 5.2],
  },
  Medium: {
    crashChance: 0.24,
    multipliers: [1.28, 1.68, 2.25, 3.1, 4.4, 6.5, 9.8, 15.0],
  },
  Hard: {
    crashChance: 0.36,
    multipliers: [1.5, 2.35, 3.8, 6.2, 10.5, 18.0, 32.0, 60.0],
  },
} as const;

type Difficulty = keyof typeof DIFFICULTIES;

export function ChickenRoadGame({
  gameTitle = 'Chicken Road',
  provider = 'IN',
  tagline,
  walletBalance,
  isSignedIn,
  onRequireAuth,
  onSettleBet,
  onBroadcastWin,
}: Props) {
  const [betAmount, setBetAmount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [phase, setPhase] = useState<'idle' | 'active' | 'crashed' | 'cashed'>('idle');
  const [step, setStep] = useState(0); // 0 = before lane 1, 1..8 = cleared lanes
  const [hazardLane, setHazardLane] = useState<number | null>(null);
  const [settling, setSettling] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const settlingRef = useRef(false);

  const config = DIFFICULTIES[difficulty];
  const currentMult = step > 0 ? config.multipliers[step - 1] : 1;

  const startRun = () => {
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (settlingRef.current) return;
    if (!Number.isFinite(betAmount) || betAmount < 1 || betAmount > 50000) {
      setErrorMsg('Enter a valid stake between Rs 1 and Rs 50,000.');
      return;
    }
    if (betAmount > walletBalance) {
      setErrorMsg(`Insufficient balance (${formatRs(walletBalance)} available). Lower your stake or deposit.`);
      return;
    }
    soundFx.chip();
    setStep(0);
    setHazardLane(null);
    setSummary(null);
    setPhase('active');
  };

  const stepForward = async () => {
    if (phase !== 'active' || settlingRef.current) return;
    const nextLane = step + 1;
    const hitTrap = Math.random() < config.crashChance;

    if (hitTrap) {
      settlingRef.current = true;
      setSettling(true);
      soundFx.crash();
      setHazardLane(nextLane);
      setPhase('crashed');
      setSummary(`Caught at Lane ${nextLane} (${difficulty}) · Lost ${formatRs(betAmount)}`);
      try {
        await onSettleBet({
          game: 'chicken-road',
          betAmount,
          multiplier: 0,
          payout: 0,
          outcome: 'loss',
          details: `${gameTitle} (${difficulty}) trapped on Lane ${nextLane}`,
        });
      } catch {
        setErrorMsg('Could not record round result. Check your connection.');
      } finally {
        settlingRef.current = false;
        setSettling(false);
      }
      return;
    }

    soundFx.tick();
    setStep(nextLane);

    if (nextLane === config.multipliers.length) {
      settlingRef.current = true;
      setSettling(true);
      const topMult = config.multipliers[nextLane - 1];
      const payout = Math.round(betAmount * topMult * 100) / 100;
      soundFx.win();
      setPhase('cashed');
      setSummary(`Crossed all 8 lanes! Won ${formatRs(payout)} (${topMult}x)`);
      try {
        const ok = await onSettleBet({
          game: 'chicken-road',
          betAmount,
          multiplier: topMult,
          payout,
          outcome: 'cashout',
          details: `${gameTitle} (${difficulty}) cleared all 8 lanes @ ${topMult}x`,
        });
        if (ok !== false) {
          onBroadcastWin(gameTitle, betAmount, topMult, payout);
        } else {
          setSummary(null);
          setErrorMsg('Could not settle payout. Check balance or connection.');
        }
      } catch {
        setSummary(null);
        setErrorMsg('Could not settle payout. Check connection.');
      } finally {
        settlingRef.current = false;
        setSettling(false);
      }
    }
  };

  const cashOut = async () => {
    if (phase !== 'active' || step === 0 || settlingRef.current) return;
    settlingRef.current = true;
    setSettling(true);
    const payout = Math.round(betAmount * currentMult * 100) / 100;
    soundFx.win();
    setPhase('cashed');
    setSummary(`Cashed out after Lane ${step} · Won ${formatRs(payout)} (${currentMult}x)`);
    try {
      const ok = await onSettleBet({
        game: 'chicken-road',
        betAmount,
        multiplier: currentMult,
        payout,
        outcome: 'cashout',
        details: `${gameTitle} (${difficulty}) cashed at Lane ${step} @ ${currentMult}x`,
      });
      if (ok !== false) {
        onBroadcastWin(gameTitle, betAmount, currentMult, payout);
      } else {
        setSummary(null);
        setErrorMsg('Could not settle cashout. Check balance or connection.');
      }
    } catch {
      setSummary(null);
      setErrorMsg('Could not settle cashout. Check connection.');
    } finally {
      settlingRef.current = false;
      setSettling(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-7 items-center">
      {/* Road Lanes */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-[#101413] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#A3B3AC]">8-Lane Multiplier Highway · {difficulty}</span>
            <span className="font-mono font-bold text-[#F5B82E] tabular-nums">
              Current: {currentMult.toFixed(2)}x
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {config.multipliers.map((mult, idx) => {
              const laneNum = idx + 1;
              const cleared = step >= laneNum && hazardLane !== laneNum;
              const crashedHere = hazardLane === laneNum;
              const isNext = phase === 'active' && step + 1 === laneNum;
              return (
                <div
                  key={laneNum}
                  className={`h-24 rounded-xl border flex flex-col items-center justify-between py-2.5 px-1 transition-colors ${
                    crashedHere
                      ? 'bg-red-500/20 border-red-500 text-red-300'
                      : cleared
                        ? 'bg-[#19B954]/20 border-[#19B954] text-[#19B954]'
                        : isNext
                          ? 'bg-[#F5B82E]/15 border-[#F5B82E] text-white'
                          : 'bg-[#171D1B] border-white/10 text-[#A3B3AC]'
                  }`}
                >
                  <span className="text-[10px] font-mono">L{laneNum}</span>
                  {crashedHere ? (
                    <Flame className="w-5 h-5 text-red-400" />
                  ) : cleared ? (
                    <Footprints className="w-5 h-5 text-[#19B954]" />
                  ) : (
                    <span className="text-xs font-bold">{isNext ? 'GO' : '·'}</span>
                  )}
                  <span className="font-mono text-xs font-bold tabular-nums">{mult}x</span>
                </div>
              );
            })}
          </div>
        </div>

        {summary && (
          <div className="bg-[#101413] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium text-white">
            {summary}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="lg:col-span-5 space-y-5">
        <div>
          <div className="text-xs font-mono text-[#F5B82E]">{provider}</div>
          <h3 className="text-2xl font-bold text-white">{gameTitle}</h3>
          <p className="text-sm text-[#A3B3AC] mt-1">
            {tagline || `Step across multiplier lanes up to ${config.multipliers[7]}x. Cash out before hitting a trap.`}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#A3B3AC]">Risk Difficulty</label>
          <div className="grid grid-cols-3 gap-2">
            {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                disabled={phase === 'active'}
                onClick={() => setDifficulty(d)}
                className={`py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  difficulty === d
                    ? 'bg-[#19B954] text-white'
                    : 'bg-[#101413] border border-white/10 text-[#A3B3AC] hover:text-white'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
            <span>Stake Amount</span>
            <span className="font-mono tabular-nums">Balance: {formatRs(walletBalance)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50000}
              value={betAmount}
              disabled={phase === 'active'}
              onChange={(e) => {
                setBetAmount(Math.max(1, Number(e.target.value)));
                setErrorMsg(null);
              }}
              className="w-full bg-[#101413] border border-white/10 rounded-xl px-4 py-3 font-mono text-white font-semibold"
            />
            {[10, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                disabled={phase === 'active'}
                onClick={() => {
                  setBetAmount(v);
                  setErrorMsg(null);
                }}
                className="px-3 py-3 rounded-xl bg-[#202825] hover:bg-[#28332F] text-xs font-mono text-white shrink-0 cursor-pointer"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-red-500/15 border border-red-500/35 px-3 py-2 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        {phase !== 'active' ? (
          <button
            onClick={startRun}
            disabled={settling}
            className="w-full py-3.5 px-5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:opacity-50 text-white font-bold text-sm transition-colors cursor-pointer"
          >
            Start {gameTitle} · {formatRs(betAmount)}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={stepForward}
              disabled={settling}
              className="py-3.5 px-4 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Footprints className="w-4 h-4" />
              <span>Step Lane {step + 1}</span>
            </button>
            <button
              onClick={cashOut}
              disabled={step === 0 || settling}
              className="py-3.5 px-4 rounded-xl bg-[#F5B82E] hover:bg-[#E0A722] disabled:opacity-40 text-[#0F1312] font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Banknote className="w-4 h-4" />
              <span>Cash Out {step > 0 ? formatRs(betAmount * currentMult) : ''}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
