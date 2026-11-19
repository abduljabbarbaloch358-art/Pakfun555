import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { GameId } from '../../types/platform';
import { soundFx } from '../../lib/sound';
import { formatRs } from '../../lib/vip';

interface Props {
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

type ShotType = 'single' | 'four' | 'six';

const SHOTS: { id: ShotType; label: string; desc: string; mult: number; winProb: number }[] = [
  { id: 'single', label: 'Safe Single / Double', desc: 'Score 1+ Runs', mult: 1.45, winProb: 0.66 },
  { id: 'four', label: 'Boundary Four', desc: 'Hit a 4', mult: 2.5, winProb: 0.38 },
  { id: 'six', label: 'Maximum Six', desc: 'Clear the ropes (6)', mult: 4.8, winProb: 0.2 },
];

export function CricketGame({
  walletBalance,
  isSignedIn,
  onRequireAuth,
  onSettleBet,
  onBroadcastWin,
}: Props) {
  const [betAmount, setBetAmount] = useState(10);
  const [shot, setShot] = useState<ShotType>('four');
  const [bowling, setBowling] = useState(false);
  const [ballOutcome, setBallOutcome] = useState<string>('READY');
  const [recentBalls, setRecentBalls] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const bowlingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      bowlingRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const selectedShot = SHOTS.find((s) => s.id === shot) || SHOTS[0];

  const handlePlayBall = () => {
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (bowlingRef.current) return;
    if (!Number.isFinite(betAmount) || betAmount < 1 || betAmount > 50000) {
      setErrorMsg('Enter a valid stake between Rs 1 and Rs 50,000.');
      return;
    }
    if (betAmount > walletBalance) {
      setErrorMsg(`Insufficient balance (${formatRs(walletBalance)} available). Lower your stake or deposit.`);
      return;
    }

    const activeShot = shot;
    const activeShotMeta = SHOTS.find((s) => s.id === activeShot) || SHOTS[0];
    const activeStake = betAmount;

    bowlingRef.current = true;
    setBowling(true);
    setBallOutcome('BOWLING...');
    setSummary(null);
    soundFx.chip();

    timerRef.current = window.setTimeout(async () => {
      if (!mountedRef.current) return;
      const won = Math.random() < activeShotMeta.winProb;
      let label = 'DOT';
      if (won) {
        label = activeShot === 'six' ? '6' : activeShot === 'four' ? '4' : Math.random() < 0.5 ? '1' : '2';
      } else {
        label = Math.random() < 0.35 ? 'W' : '0';
      }

      const mult = won ? activeShotMeta.mult : 0;
      const payout = won ? Math.round(activeStake * mult * 100) / 100 : 0;

      if (won) soundFx.win();
      else soundFx.crash();

      setBallOutcome(
        label === '6'
          ? 'SIX! +6'
          : label === '4'
            ? 'FOUR! +4'
            : label === 'W'
              ? 'OUT! WICKET'
              : label === '0'
                ? 'DOT BALL'
                : `${label} RUNS`,
      );
      setRecentBalls((prev) => [label, ...prev].slice(0, 6));
      setSummary(
        won
          ? `WIN! Hit ${label} on ${activeShotMeta.label} · Payout ${formatRs(payout)} (${mult}x)`
          : `MISSED · ${label === 'W' ? 'Bowled out!' : 'Dot ball!'} Target was ${activeShotMeta.label} · -${formatRs(activeStake)}`,
      );

      let ok = false;
      try {
        const res = await onSettleBet({
          game: 'cricket',
          betAmount: activeStake,
          multiplier: mult,
          payout,
          outcome: won ? 'win' : 'loss',
          details: `Cricket Super Over (${activeShotMeta.label}) -> ${label}`,
        });
        ok = res !== false;
      } catch {
        ok = false;
      } finally {
        bowlingRef.current = false;
        if (mountedRef.current) setBowling(false);
      }

      if (!mountedRef.current) return;
      if (!ok) {
        setSummary(null);
        setErrorMsg('Could not settle bet on server. Check connection or balance.');
        return;
      }
      if (won) {
        onBroadcastWin('Cricket Super Over', activeStake, mult, payout);
      }
    }, 650);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-7 items-center">
      {/* Cricket Stadium Scoreboard */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-[#101413] border border-[#19B954]/30 rounded-2xl p-6 text-center space-y-5">
          <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
            <span>PAKFUN Super Over Arena</span>
            <span>Over Feed (Last 6 Balls)</span>
          </div>

          <div className="py-6 rounded-xl bg-gradient-to-b from-[#15291E] to-[#101413] border border-white/5">
            <div className="text-xs text-[#A3B3AC] mb-1">Delivery Result</div>
            <div
              className={`font-mono text-3xl sm:text-4xl font-extrabold ${
                ballOutcome.includes('SIX') || ballOutcome.includes('FOUR') || ballOutcome.includes('RUNS')
                  ? 'text-[#19B954]'
                  : ballOutcome.includes('OUT') || ballOutcome.includes('DOT')
                    ? 'text-red-400'
                    : 'text-[#F5B82E]'
              }`}
            >
              {ballOutcome}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            {recentBalls.length === 0 && (
              <span className="text-xs text-[#7D8C85]">Play a delivery to populate the Super Over tracker.</span>
            )}
            {recentBalls.map((b, idx) => (
              <span
                key={idx}
                className={`w-9 h-9 rounded-full font-mono text-xs font-bold flex items-center justify-center border ${
                  b === '6'
                    ? 'bg-[#F5B82E] text-[#0F1312] border-[#F5B82E]'
                    : b === '4' || b === '1' || b === '2'
                      ? 'bg-[#19B954]/20 text-[#19B954] border-[#19B954]'
                      : 'bg-red-500/20 text-red-400 border-red-500/50'
                }`}
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        {summary && (
          <div className="bg-[#101413] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium text-white text-center">
            {summary}
          </div>
        )}
      </div>

      {/* Shot Selector */}
      <div className="lg:col-span-5 space-y-5">
        <div>
          <h3 className="text-2xl font-bold text-white">Cricket Super Over</h3>
          <p className="text-sm text-[#A3B3AC] mt-1">
            Pick your batting shot on the next ball — play safe singles (1.45x), boundary fours (2.5x), or smash a six (4.8x).
          </p>
        </div>

        <div className="space-y-2">
          {SHOTS.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={bowling}
              onClick={() => setShot(s.id)}
              className={`w-full p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer ${
                shot === s.id
                  ? 'bg-[#19B954]/20 border-[#19B954] text-white'
                  : 'bg-[#101413] border-white/10 text-[#A3B3AC] hover:text-white'
              }`}
            >
              <div>
                <div className="text-xs font-bold">{s.label}</div>
                <div className="text-[11px] opacity-80">{s.desc}</div>
              </div>
              <span className="font-mono text-sm font-bold text-[#F5B82E]">{s.mult}x</span>
            </button>
          ))}
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
              disabled={bowling}
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
                disabled={bowling}
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

        <button
          onClick={handlePlayBall}
          disabled={bowling}
          className="w-full py-3.5 px-5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <Trophy className="w-4 h-4" />
          <span>{bowling ? 'Facing Delivery...' : `Hit ${selectedShot.label} · ${formatRs(betAmount)}`}</span>
        </button>
      </div>
    </div>
  );
}
