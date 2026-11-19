import { useRef, useState } from 'react';
import { Spade } from 'lucide-react';
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

interface Card {
  rank: string;
  suit: '♠' | '♥' | '♦' | '♣';
  val: number;
  red: boolean;
}

const RANKS = [
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
  { r: 'A', v: 14 },
];
const SUITS: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const rk of RANKS) {
      deck.push({ rank: rk.r, suit: s, val: rk.v, red: s === '♥' || s === '♦' });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function evaluateTeenPatti(cards: Card[]): { rank: number; label: string; bonusMult: number; tiebreaker: number } {
  const sorted = [...cards].sort((a, b) => b.val - a.val);
  const [c1, c2, c3] = sorted;
  const isFlush = c1.suit === c2.suit && c2.suit === c3.suit;
  const isSeq =
    (c1.val - 1 === c2.val && c2.val - 1 === c3.val) ||
    (c1.val === 14 && c2.val === 3 && c3.val === 2);
  const isTrail = c1.val === c2.val && c2.val === c3.val;
  const isPair = c1.val === c2.val || c2.val === c3.val || c1.val === c3.val;
  const tb = c1.val * 400 + c2.val * 20 + c3.val;

  if (isTrail) return { rank: 6, label: 'Trail (Three of a Kind)', bonusMult: 5, tiebreaker: tb };
  if (isFlush && isSeq) return { rank: 5, label: 'Pure Sequence', bonusMult: 4, tiebreaker: tb };
  if (isSeq) return { rank: 4, label: 'Sequence', bonusMult: 3, tiebreaker: tb };
  if (isFlush) return { rank: 3, label: 'Color (Flush)', bonusMult: 2.5, tiebreaker: tb };
  if (isPair) {
    const pairVal = c1.val === c2.val ? c1.val : c3.val;
    return { rank: 2, label: 'Pair', bonusMult: 2, tiebreaker: pairVal * 1000 + tb };
  }
  return { rank: 1, label: `High Card ${c1.rank}`, bonusMult: 2, tiebreaker: tb };
}

export function TeenPattiGame({
  walletBalance,
  isSignedIn,
  onRequireAuth,
  onSettleBet,
  onBroadcastWin,
}: Props) {
  const [ante, setAnte] = useState(10);
  const [phase, setPhase] = useState<'idle' | 'dealt' | 'settled'>('idle');
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [outcomeText, setOutcomeText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const settlingRef = useRef(false);

  const dealHand = () => {
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (settlingRef.current || settling) return;
    const anteStake = Math.floor(ante);
    if (!Number.isFinite(anteStake) || anteStake < 1 || anteStake > 25000) {
      setErrorMsg('Enter a valid Ante between Rs 1 and Rs 25,000 (Chaal = Rs 50,000 max).');
      return;
    }
    if (anteStake * 2 > walletBalance) {
      setErrorMsg(`Chaal requires ${formatRs(anteStake * 2)} (2x Ante). You have ${formatRs(walletBalance)}.`);
      return;
    }
    soundFx.chip();
    const deck = buildDeck();
    setPlayerCards(deck.slice(0, 3));
    setDealerCards(deck.slice(3, 6));
    setOutcomeText(null);
    setPhase('dealt');
  };

  const handlePack = async () => {
    if (phase !== 'dealt' || settlingRef.current) return;
    setErrorMsg(null);
    settlingRef.current = true;
    setSettling(true);
    const anteStake = Math.floor(ante);

    try {
      const settled = await onSettleBet({
        game: 'teen-patti',
        betAmount: anteStake,
        multiplier: 0,
        payout: 0,
        outcome: 'loss',
        details: '3 Patti: Player Packed (Folded)',
      });
      if (settled === false) {
        setErrorMsg('Could not settle Pack on your wallet. Please try again.');
        return;
      }
      soundFx.crash();
      setPhase('settled');
      setOutcomeText(`Packed hand · Lost Ante (${formatRs(anteStake)})`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to settle packed hand.');
    } finally {
      settlingRef.current = false;
      setSettling(false);
    }
  };

  const handleChaal = async () => {
    if (phase !== 'dealt' || settlingRef.current) return;
    setErrorMsg(null);
    const totalBet = Math.floor(ante) * 2;
    if (totalBet > walletBalance) {
      setErrorMsg(`Insufficient balance for Chaal (${formatRs(totalBet)} required).`);
      return;
    }

    settlingRef.current = true;
    setSettling(true);

    const pEval = evaluateTeenPatti(playerCards);
    const dEval = evaluateTeenPatti(dealerCards);

    let playerWon = false;
    let isTie = false;
    if (pEval.rank > dEval.rank) playerWon = true;
    else if (pEval.rank === dEval.rank) {
      if (pEval.tiebreaker > dEval.tiebreaker) playerWon = true;
      else if (pEval.tiebreaker === dEval.tiebreaker) isTie = true;
    }

    const mult = isTie ? 1 : playerWon ? pEval.bonusMult : 0;
    const payout = Math.round(totalBet * mult * 100) / 100;

    try {
      const settled = await onSettleBet({
        game: 'teen-patti',
        betAmount: totalBet,
        multiplier: mult,
        payout,
        outcome: playerWon || isTie ? 'win' : 'loss',
        details: `3 Patti: ${pEval.label} vs ${dEval.label}`,
      });
      if (settled === false) {
        setErrorMsg('Could not settle Chaal on your wallet. Please try again.');
        return;
      }
      if (playerWon) soundFx.win();
      else if (!isTie) soundFx.crash();

      setPhase('settled');
      setOutcomeText(
        `You: ${pEval.label} vs Dealer: ${dEval.label} · ${
          isTie ? 'Push (Refunded)' : playerWon ? `Won ${formatRs(payout)} (${mult}x)` : 'Dealer Wins'
        }`,
      );
      if (playerWon) {
        onBroadcastWin('3 Patti', totalBet, mult, payout);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to settle 3 Patti hand.');
    } finally {
      settlingRef.current = false;
      setSettling(false);
    }
  };

  const renderCard = (c: Card, hidden = false) => (
    <div
      className={`w-16 h-24 sm:w-20 sm:h-28 rounded-xl border flex flex-col items-center justify-center font-mono font-bold shadow-lg ${
        hidden
          ? 'bg-[#1D2623] border-[#F5B82E]/30 text-[#F5B82E]'
          : 'bg-[#F8FAF9] border-white/20 ' + (c.red ? 'text-red-600' : 'text-slate-900')
      }`}
    >
      {hidden ? (
        <Spade className="w-6 h-6 opacity-60" />
      ) : (
        <>
          <span className="text-lg sm:text-xl leading-none">{c.rank}</span>
          <span className="text-xl sm:text-2xl leading-none mt-1">{c.suit}</span>
        </>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-7 items-center">
      {/* 3 Patti Felt Table */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-[#101413] border border-[#19B954]/30 rounded-2xl p-5 sm:p-6 space-y-6">
          <div className="space-y-2 text-center">
            <div className="text-xs text-[#A3B3AC]">Dealer Hand</div>
            <div className="flex justify-center gap-3">
              {dealerCards.length === 0
                ? [0, 1, 2].map((i) => <div key={i}>{renderCard({ rank: '?', suit: '♠', val: 0, red: false }, true)}</div>)
                : dealerCards.map((c, i) => <div key={i}>{renderCard(c, phase === 'dealt')}</div>)}
            </div>
          </div>

          <div className="border-t border-white/10" />

          <div className="space-y-2 text-center">
            <div className="text-xs text-[#19B954] font-semibold">
              Your Hand {playerCards.length > 0 ? `(${evaluateTeenPatti(playerCards).label})` : ''}
            </div>
            <div className="flex justify-center gap-3">
              {playerCards.length === 0
                ? [0, 1, 2].map((i) => <div key={i}>{renderCard({ rank: '?', suit: '♠', val: 0, red: false }, true)}</div>)
                : playerCards.map((c, i) => <div key={i}>{renderCard(c, false)}</div>)}
            </div>
          </div>
        </div>

        {outcomeText && (
          <div className="bg-[#101413] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium text-white text-center">
            {outcomeText}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="lg:col-span-5 space-y-5">
        <div>
          <h3 className="text-2xl font-bold text-white">3 Patti (Teen Patti)</h3>
          <p className="text-sm text-[#A3B3AC] mt-1">
            Trail pays 5x, Pure Sequence 4x, Sequence 3x, Flush 2.5x. Deal your cards and choose Chaal (2x) or Pack.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
            <span>Ante Stake (Chaal = 2x Ante)</span>
            <span className="font-mono tabular-nums">Balance: {formatRs(walletBalance)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={25000}
              value={ante}
              disabled={phase === 'dealt' || settling}
              onChange={(e) => {
                setAnte(Math.max(1, Number(e.target.value)));
                setErrorMsg(null);
              }}
              className="w-full bg-[#101413] border border-white/10 rounded-xl px-4 py-3 font-mono text-white font-semibold"
            />
            {[10, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                disabled={phase === 'dealt' || settling}
                onClick={() => {
                  setAnte(v);
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

        {phase !== 'dealt' ? (
          <button
            onClick={dealHand}
            disabled={settling}
            className="w-full py-3.5 px-5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:bg-[#202825] text-white font-bold text-sm cursor-pointer"
          >
            Deal 3 Patti Hand · Ante {formatRs(ante)}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleChaal}
              disabled={settling}
              className="py-3.5 px-4 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:bg-[#202825] text-white font-bold text-sm cursor-pointer"
            >
              {settling ? 'Settling...' : `Chaal (Play ${formatRs(ante * 2)})`}
            </button>
            <button
              onClick={handlePack}
              disabled={settling}
              className="py-3.5 px-4 rounded-xl bg-red-600/80 hover:bg-red-600 disabled:bg-[#202825] text-white font-bold text-sm cursor-pointer"
            >
              Pack (Fold)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
