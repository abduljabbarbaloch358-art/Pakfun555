import { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { GameId } from '../../types/platform';
import { soundFx } from '../../lib/sound';
import { formatRs } from '../../lib/vip';

interface Props {
  gameTitle?: string;
  provider?: string;
  tagline?: string;
  leftLabel?: string;
  rightLabel?: string;
  tieLabel?: string;
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

interface Card {
  rank: string;
  suit: '♠' | '♥' | '♦' | '♣';
  val: number;
  red: boolean;
}

const RANKS = [
  { r: 'A', v: 14 },
  { r: '2', v: 2 },
  { r: '3', v: 3 },
  { r: '4', v: 4 },
  { r: '5', v: 5 },
  { r: '6', v: 6 },
  { r: '7', v: 7 },
  { r: '8', v: 8 },
  { r: '9', v: 9 },
  { r: '10', v: 10 },
  { r: 'J', v: 11 },
  { r: 'Q', v: 12 },
  { r: 'K', v: 13 },
];
const SUITS: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];

function drawCard(): Card {
  const rk = RANKS[Math.floor(Math.random() * RANKS.length)];
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { rank: rk.r, suit, val: rk.v, red: suit === '♥' || suit === '♦' };
}

export function JiliCardsGame({
  gameTitle = 'JILI Cards (Andar Bahar Duel)',
  provider = 'JILI',
  tagline = 'Fast-paced high-card duel. Pick your side (2x) or Tie (8x).',
  leftLabel = 'ANDAR (2x)',
  rightLabel = 'BAHAR (2x)',
  tieLabel = 'Tie (8x)',
  walletBalance,
  isSignedIn,
  onRequireAuth,
  onSettleBet,
  onBroadcastWin,
}: Props) {
  const [betAmount, setBetAmount] = useState(10);
  const [side, setSide] = useState<'andar' | 'bahar' | 'tie'>('andar');
  const [dealing, setDealing] = useState(false);
  const [leftCard, setLeftCard] = useState<Card | null>(null);
  const [rightCard, setRightCard] = useState<Card | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const dealingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      dealingRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleDeal = () => {
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (dealingRef.current) return;
    if (!Number.isFinite(betAmount) || betAmount < 1 || betAmount > 50000) {
      setErrorMsg('Enter a valid stake between Rs 1 and Rs 50,000.');
      return;
    }
    if (betAmount > walletBalance) {
      setErrorMsg(`Insufficient balance (${formatRs(walletBalance)} available). Lower your stake or deposit.`);
      return;
    }

    const activeSide = side;
    const activeStake = betAmount;
    dealingRef.current = true;
    setDealing(true);
    setSummary(null);
    soundFx.chip();

    timerRef.current = window.setTimeout(async () => {
      if (!mountedRef.current) return;
      const andar = drawCard();
      const bahar = drawCard();
      setLeftCard(andar);
      setRightCard(bahar);

      let winner: 'andar' | 'bahar' | 'tie' = 'tie';
      if (andar.val > bahar.val) winner = 'andar';
      else if (bahar.val > andar.val) winner = 'bahar';

      const won = activeSide === winner;
      const mult = won ? (activeSide === 'tie' ? 8 : 2) : winner === 'tie' ? 0.5 : 0;
      const payout = Math.round(activeStake * mult * 100) / 100;

      if (won) soundFx.win();
      else soundFx.crash();

      const leftShort = leftLabel.split(' ')[0];
      const rightShort = rightLabel.split(' ')[0];
      const targetName = activeSide === 'andar' ? leftShort : activeSide === 'bahar' ? rightShort : 'TIE';

      setSummary(
        `${leftShort} ${andar.rank}${andar.suit} vs ${rightShort} ${bahar.rank}${bahar.suit} · Target ${targetName} -> ${
          won
            ? `WON ${formatRs(payout)} (${mult}x)`
            : winner === 'tie'
              ? `Tie (50% Refund: ${formatRs(payout)})`
              : `Missed (-${formatRs(activeStake)})`
        }`,
      );

      let ok = false;
      try {
        const res = await onSettleBet({
          game: 'jili-cards',
          betAmount: activeStake,
          multiplier: mult,
          payout,
          outcome: won ? 'win' : 'loss',
          details: `${gameTitle}: ${leftShort} ${andar.rank}${andar.suit} vs ${rightShort} ${bahar.rank}${bahar.suit}`,
        });
        ok = res !== false;
      } catch {
        ok = false;
      } finally {
        dealingRef.current = false;
        if (mountedRef.current) setDealing(false);
      }

      if (!mountedRef.current) return;
      if (!ok) {
        setSummary(null);
        setErrorMsg('Could not settle bet on server. Check connection or balance.');
        return;
      }
      if (won) {
        onBroadcastWin(gameTitle, activeStake, mult, payout);
      }
    }, 550);
  };

  const renderCard = (c: Card | null, label: string) => (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold text-[#A3B3AC]">{label}</span>
      <div
        className={`w-24 h-36 rounded-2xl border-2 flex flex-col items-center justify-center font-mono font-bold shadow-xl ${
          !c
            ? 'bg-[#181F1D] border-white/10 text-[#7D8C85]'
            : 'bg-[#F8FAF9] border-[#F5B82E] ' + (c.red ? 'text-red-600' : 'text-slate-900')
        }`}
      >
        {!c ? (
          <Layers className="w-7 h-7 opacity-40" />
        ) : (
          <>
            <span className="text-3xl leading-none">{c.rank}</span>
            <span className="text-3xl leading-none mt-1">{c.suit}</span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-7 items-center">
      {/* Card Duel Stage */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-[#101413] border border-white/10 rounded-2xl p-6 flex items-center justify-around">
          {renderCard(leftCard, leftLabel)}
          <div className="font-mono text-lg font-extrabold text-[#F5B82E]">VS</div>
          {renderCard(rightCard, rightLabel)}
        </div>
        {summary && (
          <div className="bg-[#101413] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium text-white text-center">
            {summary}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="lg:col-span-5 space-y-5">
        <div>
          <div className="text-xs font-mono text-[#F5B82E]">{provider}</div>
          <h3 className="text-2xl font-bold text-white">{gameTitle}</h3>
          <p className="text-sm text-[#A3B3AC] mt-1">{tagline}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'andar', label: leftLabel },
            { id: 'bahar', label: rightLabel },
            { id: 'tie', label: tieLabel },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={dealing}
              onClick={() => setSide(opt.id as any)}
              className={`py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${
                side === opt.id
                  ? 'bg-[#19B954] text-white'
                  : 'bg-[#101413] border border-white/10 text-[#A3B3AC]'
              }`}
            >
              {opt.label}
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
              disabled={dealing}
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
                disabled={dealing}
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
          onClick={handleDeal}
          disabled={dealing}
          className="w-full py-3.5 px-5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:opacity-50 text-white font-bold text-sm cursor-pointer"
        >
          {dealing ? 'Dealing Cards...' : `Deal Cards · ${formatRs(betAmount)}`}
        </button>
      </div>
    </div>
  );
}
