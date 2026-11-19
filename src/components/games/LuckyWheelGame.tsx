import { useEffect, useRef, useState } from 'react';
import { Sparkles, RotateCw } from 'lucide-react';
import { GameId } from '../../types/platform';
import { soundFx } from '../../lib/sound';
import { formatRs } from '../../lib/vip';

interface Props {
  gameTitle?: string;
  provider?: string;
  tagline?: string;
  playerName: string;
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

const SEGMENTS = [
  { label: '0x', mult: 0, color: '#1F2724' },
  { label: '1.5x', mult: 1.5, color: '#19B954' },
  { label: '0.5x', mult: 0.5, color: '#28332F' },
  { label: '2x', mult: 2, color: '#15803D' },
  { label: '0x', mult: 0, color: '#1F2724' },
  { label: '3x', mult: 3, color: '#D97706' },
  { label: '1x', mult: 1, color: '#28332F' },
  { label: '5x', mult: 5, color: '#19B954' },
  { label: '0.5x', mult: 0.5, color: '#1F2724' },
  { label: '2x', mult: 2, color: '#15803D' },
  { label: '0x', mult: 0, color: '#28332F' },
  { label: '10x', mult: 10, color: '#F5B82E' },
];

export function LuckyWheelGame({
  gameTitle = 'Lucky Wheel',
  provider = 'PAKFUN',
  tagline = 'Select your stake and spin the 12-segment fortune wheel for multipliers up to 10x.',
  walletBalance,
  isSignedIn,
  onRequireAuth,
  onSettleBet,
  onBroadcastWin,
}: Props) {
  const [betAmount, setBetAmount] = useState(10);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<{ label: string; mult: number; payout: number; stake: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const spinningRef = useRef(false);
  const spinTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (spinTimerRef.current !== null) {
        window.clearTimeout(spinTimerRef.current);
        spinTimerRef.current = null;
      }
    };
  }, []);

  const handleSpin = () => {
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (spinningRef.current || spinning) return;
    const stake = Math.floor(betAmount);
    if (!Number.isFinite(stake) || stake < 1 || stake > 50000) {
      setErrorMsg('Enter a valid stake between Rs 1 and Rs 50,000.');
      return;
    }
    if (stake > walletBalance) {
      setErrorMsg(`Insufficient balance (${formatRs(walletBalance)} available). Lower your stake or deposit.`);
      return;
    }

    spinningRef.current = true;
    setSpinning(true);
    setLastResult(null);
    soundFx.chip();

    const winningIndex = Math.floor(Math.random() * SEGMENTS.length);
    const segmentAngle = 360 / SEGMENTS.length;
    const targetMod = 360 - (winningIndex * segmentAngle + segmentAngle / 2);
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;
    const extraSpins = 360 * 5;
    const nextRotation = rotation + extraSpins + delta;

    setRotation(nextRotation);

    spinTimerRef.current = window.setTimeout(async () => {
      spinTimerRef.current = null;
      if (!mountedRef.current) return;

      const seg = SEGMENTS[winningIndex];
      const payout = Math.round(stake * seg.mult * 100) / 100;
      const outcome = seg.mult >= 1 ? 'win' : 'loss';

      try {
        const settled = await onSettleBet({
          game: 'wheel',
          betAmount: stake,
          multiplier: seg.mult,
          payout,
          outcome,
          details: `${gameTitle} landed on ${seg.label}`,
        });
        if (!mountedRef.current) return;
        if (settled === false) {
          setErrorMsg('Bet could not be settled on your wallet. Please try again.');
          return;
        }
        if (seg.mult >= 1.5) soundFx.win();
        else if (seg.mult === 0) soundFx.crash();

        setLastResult({ label: seg.label, mult: seg.mult, payout, stake });
        if (payout > 0) {
          onBroadcastWin(gameTitle, stake, seg.mult, payout);
        }
      } catch (err) {
        if (mountedRef.current) {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to settle wheel spin.');
        }
      } finally {
        spinningRef.current = false;
        if (mountedRef.current) {
          setSpinning(false);
        }
      }
    }, 3600);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-7">
      {/* Wheel Stage */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center relative py-4">
        {/* Top Pointer */}
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-[#F5B82E] z-20 -mb-2 drop-shadow" />

        <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full p-2 bg-[#202825] border-4 border-[#F5B82E]/50 shadow-2xl">
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full rounded-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 3.5s cubic-bezier(0.16, 1, 0.25, 1)' : 'none',
            }}
          >
            {SEGMENTS.map((seg, i) => {
              const angle = 360 / SEGMENTS.length;
              const startAngle = (i * angle - 90) * (Math.PI / 180);
              const endAngle = ((i + 1) * angle - 90) * (Math.PI / 180);
              const x1 = 100 + 98 * Math.cos(startAngle);
              const y1 = 100 + 98 * Math.sin(startAngle);
              const x2 = 100 + 98 * Math.cos(endAngle);
              const y2 = 100 + 98 * Math.sin(endAngle);
              const midDeg = i * angle + angle / 2;
              return (
                <g key={i}>
                  <path
                    d={`M100,100 L${x1},${y1} A98,98 0 0,1 ${x2},${y2} Z`}
                    fill={seg.color}
                    stroke="#0F1312"
                    strokeWidth="1.2"
                  />
                  <text
                    x="100"
                    y="28"
                    fill={seg.mult === 10 ? '#0F1312' : '#FFFFFF'}
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                    transform={`rotate(${midDeg} 100 100)`}
                  >
                    {seg.label}
                  </text>
                </g>
              );
            })}
            <circle cx="100" cy="100" r="18" fill="#101413" stroke="#F5B82E" strokeWidth="3" />
          </svg>
        </div>

        {lastResult && (
          <div className="mt-4 text-center">
            <span
              className={`font-mono text-sm sm:text-base font-bold ${
                lastResult.mult >= 1
                  ? 'text-[#19B954]'
                  : lastResult.mult > 0
                    ? 'text-[#F5B82E]'
                    : 'text-red-400'
              }`}
            >
              {lastResult.mult >= 1
                ? `WIN! Landed ${lastResult.label} · Payout ${formatRs(lastResult.payout)}`
                : lastResult.mult > 0
                  ? `PARTIAL (${lastResult.label}) · Returned ${formatRs(lastResult.payout)}`
                  : `MISSED (${lastResult.label}) · -${formatRs(lastResult.stake)}`}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="lg:col-span-5 space-y-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#F5B82E] font-medium">
            <Sparkles className="w-4 h-4" />
            <span>{provider} · Spin & Win Instant Multiplier</span>
          </div>
          <h3 className="text-2xl font-bold text-white mt-1">{gameTitle}</h3>
          <p className="text-sm text-[#A3B3AC] mt-1">{tagline}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
            <span>Stake Amount</span>
            <span className="font-mono tabular-nums">Balance: {formatRs(walletBalance)}</span>
          </div>
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
            className="w-full bg-[#101413] border border-white/10 rounded-xl px-4 py-3 font-mono text-white font-semibold focus:outline-none focus:border-[#19B954]"
          />
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[10, 50, 100, 500].map((v) => (
              <button
                key={v}
                type="button"
                disabled={spinning}
                onClick={() => {
                  setBetAmount(v);
                  setErrorMsg(null);
                }}
                className="py-2 rounded-xl bg-[#202825] hover:bg-[#28332F] text-xs font-mono text-white transition-colors cursor-pointer"
              >
                Rs {v}
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
          <RotateCw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
          <span>{spinning ? 'Spinning Wheel...' : `Spin & Win (${formatRs(betAmount)})`}</span>
        </button>
      </div>
    </div>
  );
}
