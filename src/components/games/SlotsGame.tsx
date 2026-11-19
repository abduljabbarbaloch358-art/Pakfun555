import { useEffect, useRef, useState } from 'react';
import { Gem, Crown, Coins, Sparkles, Play } from 'lucide-react';
import { GameId } from '../../types/platform';
import { soundFx } from '../../lib/sound';
import { formatRs } from '../../lib/vip';

interface Props {
  slotTitle?: string;
  slotProvider?: string;
  slotTagline?: string;
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

const SYMBOLS = [
  { id: '777', label: '777', mult3: 15, color: 'text-[#F5B82E]' },
  { id: 'GEM', label: 'Emerald', mult3: 8, color: 'text-[#19B954]' },
  { id: 'CRN', label: 'Crown', mult3: 5, color: 'text-amber-300' },
  { id: 'BAR', label: 'Bullion', mult3: 3.5, color: 'text-sky-400' },
  { id: 'COI', label: 'Coin', mult3: 2.5, color: 'text-emerald-300' },
];

function randomSymbol() {
  const weights = [1, 2, 3, 4, 5]; // Weighted for balanced RTP
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= weights[i];
    if (r <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[4];
}

export function SlotsGame({
  slotTitle = 'Golden Emerald 777',
  slotProvider = 'PAKFUN',
  slotTagline = '5 active paylines (3 rows + 2 diagonals). Match 3 symbols for up to 15x per line.',
  walletBalance,
  isSignedIn,
  onRequireAuth,
  onSettleBet,
  onBroadcastWin,
}: Props) {
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [grid, setGrid] = useState([
    [SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]],
    [SYMBOLS[0], SYMBOLS[0], SYMBOLS[0]],
    [SYMBOLS[3], SYMBOLS[4], SYMBOLS[1]],
  ]);
  const [summary, setSummary] = useState<{ mult: number; payout: number; stake: number; note: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const spinningRef = useRef(false);
  const tickIntervalRef = useRef<number | null>(null);
  const spinTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      if (spinTimerRef.current !== null) {
        window.clearTimeout(spinTimerRef.current);
        spinTimerRef.current = null;
      }
    };
  }, []);

  const renderSymbolIcon = (id: string, color: string) => {
    if (id === '777') return <span className={`font-mono text-2xl font-extrabold ${color}`}>777</span>;
    if (id === 'GEM') return <Gem className={`w-7 h-7 ${color}`} />;
    if (id === 'CRN') return <Crown className={`w-7 h-7 ${color}`} />;
    if (id === 'BAR') return <Sparkles className={`w-7 h-7 ${color}`} />;
    return <Coins className={`w-7 h-7 ${color}`} />;
  };

  const handleSpin = () => {
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (spinningRef.current || spinning) return;
    const stake = Math.floor(betAmount);
    if (!Number.isFinite(stake) || stake < 1 || stake > 50000) {
      setErrorMsg('Enter a valid bet between Rs 1 and Rs 50,000.');
      return;
    }
    if (stake > walletBalance) {
      setErrorMsg(`Insufficient balance (${formatRs(walletBalance)} available). Lower your bet or deposit.`);
      return;
    }

    spinningRef.current = true;
    setSpinning(true);
    setSummary(null);
    soundFx.chip();

    tickIntervalRef.current = window.setInterval(() => {
      if (!mountedRef.current) return;
      soundFx.tick();
      setGrid([
        [randomSymbol(), randomSymbol(), randomSymbol()],
        [randomSymbol(), randomSymbol(), randomSymbol()],
        [randomSymbol(), randomSymbol(), randomSymbol()],
      ]);
    }, 95);

    spinTimerRef.current = window.setTimeout(async () => {
      spinTimerRef.current = null;
      if (tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      if (!mountedRef.current) return;

      const finalGrid = [
        [randomSymbol(), randomSymbol(), randomSymbol()],
        [randomSymbol(), randomSymbol(), randomSymbol()],
        [randomSymbol(), randomSymbol(), randomSymbol()],
      ];
      setGrid(finalGrid);

      const lines = [
        [finalGrid[0][0], finalGrid[0][1], finalGrid[0][2]],
        [finalGrid[1][0], finalGrid[1][1], finalGrid[1][2]],
        [finalGrid[2][0], finalGrid[2][1], finalGrid[2][2]],
        [finalGrid[0][0], finalGrid[1][1], finalGrid[2][2]],
        [finalGrid[2][0], finalGrid[1][1], finalGrid[0][2]],
      ];

      let totalMult = 0;
      const hits: string[] = [];
      lines.forEach((line, idx) => {
        if (line[0].id === line[1].id && line[1].id === line[2].id) {
          totalMult += line[0].mult3;
          hits.push(`Line ${idx + 1}: 3x ${line[0].label} (${line[0].mult3}x)`);
        } else if (line[0].id === line[1].id && idx === 1) {
          totalMult += 0.6;
          hits.push(`Center Pair: ${line[0].label} (0.6x)`);
        }
      });

      const payout = Math.round(stake * totalMult * 100) / 100;

      try {
        const settled = await onSettleBet({
          game: 'slots',
          betAmount: stake,
          multiplier: totalMult,
          payout,
          outcome: payout >= stake ? 'win' : 'loss',
          details: hits.length > 0 ? `${slotTitle} · ${hits.join(' · ')}` : `${slotTitle} spin`,
        });
        if (!mountedRef.current) return;
        if (settled === false) {
          setErrorMsg('Spin could not be settled on your wallet. Please try again.');
          return;
        }
        if (payout >= stake) soundFx.win();
        else if (payout === 0) soundFx.crash();

        setSummary({
          mult: totalMult,
          payout,
          stake,
          note: hits.length > 0 ? hits.join(' · ') : 'No matching payline',
        });
        if (payout > 0) {
          onBroadcastWin(slotTitle, stake, totalMult, payout);
        }
      } catch (err) {
        if (mountedRef.current) {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to settle slots spin.');
        }
      } finally {
        spinningRef.current = false;
        if (mountedRef.current) {
          setSpinning(false);
        }
      }
    }, 1100);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-7 items-center">
      {/* Slot Reels */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-[#101413] border border-[#F5B82E]/30 rounded-2xl p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-3">
            {grid.map((row, rIdx) =>
              row.map((sym, cIdx) => (
                <div
                  key={`${rIdx}-${cIdx}`}
                  className={`h-20 sm:h-24 rounded-xl bg-[#181F1D] border flex flex-col items-center justify-center gap-1 transition-transform ${
                    rIdx === 1 ? 'border-[#19B954]/40' : 'border-white/5'
                  } ${spinning ? 'scale-[0.97]' : 'scale-100'}`}
                >
                  {renderSymbolIcon(sym.id, sym.color)}
                  <span className="text-[10px] font-medium text-[#A3B3AC]">{sym.label}</span>
                </div>
              )),
            )}
          </div>
        </div>

        {summary && (
          <div className="flex items-center justify-between text-xs bg-[#101413] border border-white/10 rounded-xl px-4 py-3">
            <span className="text-[#D1DCD7]">{summary.note}</span>
            <span
              className={`font-mono font-bold tabular-nums ${
                summary.payout >= summary.stake
                  ? 'text-[#19B954]'
                  : summary.payout > 0
                    ? 'text-[#F5B82E]'
                    : 'text-red-400'
              }`}
            >
              {summary.payout > 0
                ? `${formatRs(summary.payout)} (${summary.mult.toFixed(1)}x)`
                : `-${formatRs(summary.stake)}`}
            </span>
          </div>
        )}
      </div>

      {/* Controls & Paytable */}
      <div className="lg:col-span-5 space-y-5">
        <div>
          <div className="text-xs font-mono text-[#F5B82E]">{slotProvider}</div>
          <h3 className="text-2xl font-bold text-white">{slotTitle}</h3>
          <p className="text-sm text-[#A3B3AC] mt-1">{slotTagline}</p>
        </div>

        <div className="grid grid-cols-5 gap-2 text-center bg-[#101413] border border-white/10 rounded-xl p-3">
          {SYMBOLS.map((s) => (
            <div key={s.id} className="space-y-1">
              <div className={`font-mono text-xs font-bold ${s.color}`}>{s.id}</div>
              <div className="font-mono text-[11px] text-[#A3B3AC]">{s.mult3}x</div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
            <span>Bet Per Spin</span>
            <span className="font-mono tabular-nums">Balance: {formatRs(walletBalance)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50000}
              value={betAmount}
              disabled={spinning}
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
                disabled={spinning}
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
          onClick={handleSpin}
          disabled={spinning}
          className="w-full py-3.5 px-5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:bg-[#202825] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{spinning ? 'Spinning Reels...' : `Spin Reels · ${formatRs(betAmount)}`}</span>
        </button>
      </div>
    </div>
  );
}
