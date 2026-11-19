import { useEffect, useRef, useState } from 'react';
import { Dices, Target } from 'lucide-react';
import { GameId } from '../../types/platform';
import { soundFx } from '../../lib/sound';
import { formatRs } from '../../lib/vip';

interface Props {
  gameTitle?: string;
  provider?: string;
  tagline?: string;
  mode?: '7up7down' | 'big-small';
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

type Pick7Up = 'down' | 'seven' | 'up';
type PickBigSmall = 'small' | 'big' | 'odd' | 'even' | 'triple';

const PICKS_7UP: { id: Pick7Up; label: string; desc: string; mult: number; bg: string }[] = [
  { id: 'down', label: '2–6 DOWN', desc: 'Total 2 to 6', mult: 2.1, bg: 'border-[#3B82F6] bg-[#1D4ED8]/25' },
  { id: 'seven', label: 'LUCKY 7', desc: 'Total equals 7', mult: 5.5, bg: 'border-[#FB923C] bg-[#EA580C]/25' },
  { id: 'up', label: '8–12 UP', desc: 'Total 8 to 12', mult: 2.1, bg: 'border-[#4ADE80] bg-[#16A34A]/25' },
];

const PICKS_BIGSMALL: { id: PickBigSmall; label: string; desc: string; mult: number }[] = [
  { id: 'small', label: 'Small (4–10)', desc: 'Sum 4 to 10 (no triple)', mult: 2.0 },
  { id: 'big', label: 'Big (11–17)', desc: 'Sum 11 to 17 (no triple)', mult: 2.0 },
  { id: 'odd', label: 'Odd Sum', desc: 'Total is odd', mult: 1.95 },
  { id: 'even', label: 'Even Sum', desc: 'Total is even', mult: 1.95 },
  { id: 'triple', label: 'Any Triple', desc: 'All 3 dice match', mult: 28.0 },
];

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die3D({ value, rolling }: { value: number; rolling: boolean }) {
  const pips = PIP_POSITIONS[value] || [4];
  const isRedPip = value === 1 || value === 4;
  return (
    <div
      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-white via-zinc-100 to-zinc-300 border-2 border-white/80 shadow-[0_14px_24px_rgba(0,0,0,0.45),inset_0_-6px_10px_rgba(0,0,0,0.12)] grid grid-cols-3 grid-rows-3 p-3.5 gap-1.5 transition-transform duration-150 ${
        rolling ? 'animate-bounce scale-95 rotate-6' : 'scale-100'
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

export function BigSmallGame({
  gameTitle,
  provider = 'WG',
  tagline,
  mode = 'big-small',
  walletBalance,
  isSignedIn,
  onRequireAuth,
  onOpenDeposit,
  onSettleBet,
  onBroadcastWin,
}: Props) {
  const is7Up = mode === '7up7down';
  const [betAmount, setBetAmount] = useState(10);
  const [pick7Up, setPick7Up] = useState<Pick7Up>('up');
  const [pickBS, setPickBS] = useState<PickBigSmall>('big');
  const [dice, setDice] = useState<number[]>(is7Up ? [3, 5] : [3, 4, 5]);
  const [historySums, setHistorySums] = useState<number[]>(
    is7Up ? [9, 4, 7, 11, 5, 8, 3, 10] : [14, 7, 11, 8, 16, 6, 12, 9],
  );
  const [rolling, setRolling] = useState(false);
  const [resultBanner, setResultBanner] = useState<{ won: boolean; text: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const rollingRef = useRef(false);
  const tumbleTimerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      rollingRef.current = false;
      if (tumbleTimerRef.current !== null) window.clearInterval(tumbleTimerRef.current);
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (rollingRef.current) return;
    setDice(is7Up ? [3, 5] : [3, 4, 5]);
    setHistorySums(is7Up ? [9, 4, 7, 11, 5, 8, 3, 10] : [14, 7, 11, 8, 16, 6, 12, 9]);
    setResultBanner(null);
    setErrorMsg(null);
  }, [is7Up]);

  const selected7Up = PICKS_7UP.find((p) => p.id === pick7Up) || PICKS_7UP[0];
  const selectedBS = PICKS_BIGSMALL.find((p) => p.id === pickBS) || PICKS_BIGSMALL[0];

  const handleRoll = () => {
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (rollingRef.current) return;
    if (!Number.isFinite(betAmount) || betAmount < 1 || betAmount > 50000) {
      setErrorMsg('Enter a valid stake between Rs 1 and Rs 50,000.');
      return;
    }
    if (betAmount > walletBalance) {
      setErrorMsg(`Insufficient balance (${formatRs(walletBalance)} available). Lower your stake or deposit.`);
      return;
    }

    const activePick7Up = pick7Up;
    const activePickBS = pickBS;
    const activeStake = betAmount;
    const active7UpMeta = PICKS_7UP.find((p) => p.id === activePick7Up) || PICKS_7UP[0];
    const activeBSMeta = PICKS_BIGSMALL.find((p) => p.id === activePickBS) || PICKS_BIGSMALL[0];

    rollingRef.current = true;
    setRolling(true);
    setResultBanner(null);
    soundFx.chip();

    if (tumbleTimerRef.current !== null) window.clearInterval(tumbleTimerRef.current);
    tumbleTimerRef.current = window.setInterval(() => {
      if (!mountedRef.current) return;
      setDice(
        is7Up
          ? [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]
          : [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1],
      );
    }, 75);

    settleTimerRef.current = window.setTimeout(async () => {
      if (tumbleTimerRef.current !== null) {
        window.clearInterval(tumbleTimerRef.current);
        tumbleTimerRef.current = null;
      }
      if (!mountedRef.current) return;

      if (is7Up) {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2;
        setDice([d1, d2]);
        setHistorySums((prev) => [...prev.slice(-11), total]);

        const won =
          activePick7Up === 'down'
            ? total >= 2 && total <= 6
            : activePick7Up === 'seven'
              ? total === 7
              : total >= 8 && total <= 12;

        const mult = won ? active7UpMeta.mult : 0;
        const payout = won ? Math.round(activeStake * mult * 100) / 100 : 0;

        if (won) soundFx.win();
        else soundFx.crash();

        const zoneTag = total <= 6 ? 'DOWN (2–6)' : total === 7 ? 'LUCKY 7' : 'UP (8–12)';
        setResultBanner({
          won,
          text: won
            ? `WIN! [${d1}+${d2}=${total}] matched ${active7UpMeta.label} · Payout ${formatRs(payout)}`
            : `MISSED · [${d1}+${d2}=${total} · ${zoneTag}] vs Target ${active7UpMeta.label} · -${formatRs(activeStake)}`,
        });

        let ok = false;
        try {
          const res = await onSettleBet({
            game: 'big-small',
            betAmount: activeStake,
            multiplier: mult,
            payout,
            outcome: won ? 'win' : 'loss',
            details: `${gameTitle || '7 Up Down'} [${d1}+${d2}=${total}] · Target ${active7UpMeta.label}`,
          });
          ok = res !== false;
        } catch {
          ok = false;
        } finally {
          rollingRef.current = false;
          if (mountedRef.current) setRolling(false);
        }

        if (!mountedRef.current) return;
        if (!ok) {
          setResultBanner(null);
          setErrorMsg('Could not settle bet on server. Please check your connection or balance.');
          return;
        }
        if (payout > 0) {
          onBroadcastWin(gameTitle || '7 Up Down', activeStake, mult, payout);
        }
      } else {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const d3 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2 + d3;
        const isTriple = d1 === d2 && d2 === d3;
        setDice([d1, d2, d3]);
        setHistorySums((prev) => [...prev.slice(-11), total]);

        let won = false;
        if (activePickBS === 'small') won = !isTriple && total >= 4 && total <= 10;
        else if (activePickBS === 'big') won = !isTriple && total >= 11 && total <= 17;
        else if (activePickBS === 'odd') won = total % 2 === 1;
        else if (activePickBS === 'even') won = total % 2 === 0;
        else if (activePickBS === 'triple') won = isTriple;

        const mult = won ? activeBSMeta.mult : 0;
        const payout = won ? Math.round(activeStake * mult * 100) / 100 : 0;

        if (won) soundFx.win();
        else soundFx.crash();

        const outcomeTag = isTriple ? 'TRIPLE (Small/Big excluded)' : total >= 11 ? 'BIG' : 'SMALL';
        setResultBanner({
          won,
          text: won
            ? `WIN! [${d1}, ${d2}, ${d3}] = ${total} matched ${activeBSMeta.label} · Payout ${formatRs(payout)}`
            : `MISSED · [${d1}, ${d2}, ${d3}] = ${total} (${outcomeTag}) vs Target ${activeBSMeta.label} · -${formatRs(activeStake)}`,
        });

        let ok = false;
        try {
          const res = await onSettleBet({
            game: 'big-small',
            betAmount: activeStake,
            multiplier: mult,
            payout,
            outcome: won ? 'win' : 'loss',
            details: `${gameTitle || 'Big Small'} [${d1}-${d2}-${d3}]=${total} · Target ${activeBSMeta.label}`,
          });
          ok = res !== false;
        } catch {
          ok = false;
        } finally {
          rollingRef.current = false;
          if (mountedRef.current) setRolling(false);
        }

        if (!mountedRef.current) return;
        if (!ok) {
          setResultBanner(null);
          setErrorMsg('Could not settle bet on server. Please check your connection or balance.');
          return;
        }
        if (payout > 0) {
          onBroadcastWin(gameTitle || 'Big Small', activeStake, mult, payout);
        }
      }
    }, 650);
  };

  const diceSum = dice.reduce((acc, v) => acc + v, 0);
  const currentTarget = is7Up ? selected7Up : selectedBS;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-7 items-center">
      {/* Dice Felt Stage */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-gradient-to-b from-[#0E241C] to-[#101413] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-center space-y-5">
          <div className="flex flex-wrap items-center justify-between w-full gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-[#F5B82E] font-bold">
              {provider} · {is7Up ? '2-Dice Table' : '3-Dice Table'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#19B954]/15 border border-[#19B954]/40 text-[#4ADE80] font-semibold">
              <Target className="w-3.5 h-3.5" />
              Target: {currentTarget.label} ({currentTarget.mult}x)
            </span>
            <span className="text-[#A3B3AC] font-mono">
              Total: <strong className="text-white text-sm">{diceSum}</strong>
            </span>
          </div>

          <div className="flex items-center justify-center gap-4 sm:gap-5 py-2">
            {dice.map((val, i) => (
              <Die3D key={i} value={val} rolling={rolling} />
            ))}
          </div>

          {/* Recent Rolls History Strip */}
          <div className="w-full space-y-1.5">
            <div className="text-[11px] text-[#A3B3AC] font-medium">Recent Rolls</div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {historySums.map((s, idx) => {
                const badgeClass = is7Up
                  ? s <= 6
                    ? 'bg-[#1D4ED8] text-white'
                    : s === 7
                      ? 'bg-[#EA580C] text-white'
                      : 'bg-[#16A34A] text-white'
                  : s >= 11
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-[#1D4ED8] text-white';
                return (
                  <span
                    key={idx}
                    className={`w-7 h-7 rounded-lg font-mono text-xs font-bold inline-flex items-center justify-center shrink-0 ${badgeClass} ${
                      idx === historySums.length - 1 ? 'ring-2 ring-[#FACC15]' : ''
                    }`}
                  >
                    {s}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {resultBanner && (
          <div
            className={`rounded-xl px-4 py-3 text-xs font-bold text-center border ${
              resultBanner.won
                ? 'bg-[#19B954]/20 border-[#19B954] text-white'
                : 'bg-[#101413] border-white/10 text-[#D1DCD7]'
            }`}
          >
            {resultBanner.text}
          </div>
        )}
      </div>

      {/* Bet Picker & Controls */}
      <div className="lg:col-span-5 space-y-5">
        <div>
          <h3 className="text-2xl font-bold text-white">
            {gameTitle || (is7Up ? '7 Up Down' : 'Big / Small (Tai Sai)')}
          </h3>
          <p className="text-sm text-[#A3B3AC] mt-1">
            {tagline ||
              (is7Up
                ? 'Pick 2–6 Down (2.1x), Lucky 7 (5.5x), or 8–12 Up (2.1x) on 2 dice.'
                : 'Predict the 3-dice total: Small (4–10), Big (11–17), Odd/Even, or Any Triple for 28x.')}
          </p>
        </div>

        {is7Up ? (
          <div className="grid grid-cols-3 gap-2">
            {PICKS_7UP.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={rolling}
                onClick={() => setPick7Up(p.id)}
                className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  pick7Up === p.id
                    ? `${p.bg} text-white ring-2 ring-[#FACC15]/40`
                    : 'bg-[#101413] border-white/10 text-[#A3B3AC] hover:text-white'
                }`}
              >
                <div className="text-xs font-black text-white">{p.label}</div>
                <div className="font-mono text-sm font-extrabold text-[#FACC15] mt-1">{p.mult}x</div>
                <div className="text-[10px] opacity-80 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {PICKS_BIGSMALL.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={rolling}
                onClick={() => setPickBS(p.id)}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  p.id === 'triple' ? 'col-span-2' : ''
                } ${
                  pickBS === p.id
                    ? 'bg-[#19B954]/20 border-[#19B954] text-white'
                    : 'bg-[#101413] border-white/10 text-[#A3B3AC] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{p.label}</span>
                  <span className="font-mono text-[#F5B82E]">{p.mult}x</span>
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
            <span>Stake Amount</span>
            <span className="font-mono tabular-nums">Balance: {formatRs(walletBalance)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={rolling}
              onClick={() => setBetAmount((v) => Math.max(1, Math.floor(v / 2)))}
              className="px-3 py-3 rounded-xl bg-[#202825] hover:bg-[#28332F] text-xs font-mono font-bold text-white cursor-pointer"
            >
              1/2
            </button>
            <input
              type="number"
              min={1}
              max={50000}
              value={betAmount}
              disabled={rolling}
              onChange={(e) => {
                setBetAmount(Math.max(1, Number(e.target.value)));
                setErrorMsg(null);
              }}
              className="w-full bg-[#101413] border border-white/10 rounded-xl px-4 py-3 font-mono text-white font-semibold text-center"
            />
            <button
              type="button"
              disabled={rolling}
              onClick={() => setBetAmount((v) => Math.min(50000, v * 2))}
              className="px-3 py-3 rounded-xl bg-[#202825] hover:bg-[#28332F] text-xs font-mono font-bold text-white cursor-pointer"
            >
              x2
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[10, 50, 100, 500].map((v) => (
              <button
                key={v}
                type="button"
                disabled={rolling}
                onClick={() => {
                  setBetAmount(v);
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-xl text-xs font-mono font-bold cursor-pointer ${
                  betAmount === v
                    ? 'bg-[#19B954] text-white'
                    : 'bg-[#202825] hover:bg-[#28332F] text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-red-500/15 border border-red-500/35 px-3 py-2 flex items-center justify-between gap-2 text-xs text-red-200">
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

        <button
          onClick={handleRoll}
          disabled={rolling}
          className="w-full py-3.5 px-5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <Dices className="w-4 h-4" />
          <span>
            {rolling
              ? 'Rolling Dice...'
              : `Bet ${currentTarget.label} · ${formatRs(betAmount)}`}
          </span>
        </button>
      </div>
    </div>
  );
}
