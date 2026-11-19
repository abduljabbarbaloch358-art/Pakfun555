import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Users, Play, LogOut, Trophy } from 'lucide-react';
import { GameId, PokerCard, PokerState } from '../../types/platform';
import { soundFx } from '../../lib/sound';
import { formatRs } from '../../lib/vip';

interface Props {
  poker: PokerState | null;
  playerId: string;
  playerName: string;
  walletBalance: number;
  isSignedIn: boolean;
  onRequireAuth: () => void;
  sendEvent: (type: string, payload: unknown) => void;
  onSettleBet: (params: {
    game: GameId;
    betAmount: number;
    multiplier: number;
    payout: number;
    outcome: 'win' | 'loss' | 'cashout';
    details: string;
  }) => Promise<boolean | undefined>;
}

function CardView({ card }: { card: PokerCard }) {
  if (card.rank === '?') {
    return (
      <div className="w-11 h-16 rounded-lg bg-[#202825] border border-white/15 flex items-center justify-center text-xs font-mono text-[#A3B3AC]">
        PF
      </div>
    );
  }
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitGlyph =
    card.suit === 'spades' ? '♠' : card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : '♣';

  return (
    <div className="w-11 h-16 rounded-lg bg-white text-slate-900 border border-slate-200 flex flex-col items-center justify-center shadow-sm">
      <span className={`font-mono text-sm font-bold leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.rank}
      </span>
      <span className={`text-base leading-none mt-0.5 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {suitGlyph}
      </span>
    </div>
  );
}

export function PokerGame({
  poker,
  playerId,
  playerName,
  walletBalance,
  isSignedIn,
  onRequireAuth,
  sendEvent,
  onSettleBet,
}: Props) {
  const [settledHandId, setSettledHandId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const settledHandRef = useRef<number | null>(null);
  const mySeat = poker?.seats.find((s) => s.playerId === playerId);
  const isMyTurn = Boolean(mySeat && poker?.turnSeat === mySeat.seatIndex);
  const toCall = mySeat && poker ? Math.max(0, poker.currentBet - mySeat.bet) : 0;

  useEffect(() => {
    if (
      !poker ||
      poker.phase !== 'showdown' ||
      poker.handId === settledHandId ||
      settledHandRef.current === poker.handId ||
      !mySeat
    ) {
      return;
    }
    settledHandRef.current = poker.handId;
    setSettledHandId(poker.handId);
    const winEntry = poker.winners.find((w) => w.playerId === playerId);
    const payout = winEntry ? winEntry.payout : 0;
    const wagered = mySeat.totalBet || 20;
    if (payout > 0) soundFx.win();
    else soundFx.crash();

    if (isSignedIn && wagered > 0) {
      void onSettleBet({
        game: 'poker',
        betAmount: wagered,
        multiplier: Number((payout / wagered).toFixed(2)),
        payout,
        outcome: payout >= wagered ? 'win' : 'loss',
        details: winEntry ? `Texas Poker: ${winEntry.handLabel}` : `Texas Poker Hand #${poker.handId}`,
      }).catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to settle poker hand.');
      });
    }
  }, [poker, mySeat, playerId, settledHandId, isSignedIn, onSettleBet]);

  const handleJoin = () => {
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (!poker) {
      setErrorMsg('Connecting to live poker table... please wait a second.');
      return;
    }
    if (walletBalance < 50) {
      setErrorMsg(`Minimum Rs 50 buy-in required (${formatRs(walletBalance)} available). Deposit to take a seat.`);
      return;
    }
    soundFx.chip();
    sendEvent('poker:join', { playerId, playerName, buyIn: Math.min(1000, Math.floor(walletBalance)) });
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-4 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">Multiplayer Texas Hold'em</h3>
            <p className="text-xs text-[#A3B3AC]">
              Real-time server-dealt poker table · Ante Rs 20 · Hand #{poker?.handId || 1} ({poker?.phase || 'waiting'})
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!mySeat ? (
              <button
                onClick={handleJoin}
                className="px-4 py-2 rounded-xl bg-[#19B954] hover:bg-[#16A34A] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Take Seat</span>
              </button>
            ) : (
              <>
                {(poker?.phase === 'waiting' || poker?.phase === 'showdown') && (
                  <button
                    onClick={() => sendEvent('poker:start', {})}
                    className="px-4 py-2 rounded-xl bg-[#19B954] hover:bg-[#16A34A] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Deal New Hand</span>
                  </button>
                )}
                <button
                  onClick={() => sendEvent('poker:leave', { playerId })}
                  className="px-3 py-2 rounded-xl bg-[#202825] hover:bg-[#28332F] text-[#D1DCD7] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Leave</span>
                </button>
              </>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/35 px-3 py-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Felt Table */}
        <div className="rounded-3xl bg-[#0F3824] border-4 border-[#2D2118] p-5 sm:p-8 space-y-6 shadow-inner">
          {/* Pot & Community Cards */}
          <div className="flex flex-col items-center gap-3">
            <div className="font-mono text-sm font-bold text-[#F5B82E] tabular-nums">
              Total Pot: {formatRs(poker?.pot || 0)}
            </div>
            <div className="flex items-center justify-center gap-2 min-h-[68px]">
              {(poker?.communityCards || []).length === 0 ? (
                <span className="text-xs text-emerald-200/70">
                  Community cards appear on Flop, Turn, and River
                </span>
              ) : (
                poker?.communityCards.map((c, idx) => <CardView key={idx} card={c} />)
              )}
            </div>
            {poker?.winnerSummary && (
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#F5B82E] bg-black/40 px-4 py-1.5 rounded-lg">
                <Trophy className="w-4 h-4" />
                <span>{poker.winnerSummary}</span>
              </div>
            )}
          </div>

          {/* Seated Players */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(poker?.seats || []).map((seat) => {
              const activeTurn = poker?.turnSeat === seat.seatIndex;
              return (
                <div
                  key={seat.playerId}
                  className={`rounded-xl p-3.5 bg-[#111916]/90 border transition-colors ${
                    activeTurn
                      ? 'border-[#F5B82E]'
                      : seat.playerId === playerId
                        ? 'border-[#19B954]/60'
                        : 'border-white/10'
                  } ${seat.folded ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between text-xs mb-2.5">
                    <span className="font-semibold text-white">
                      {seat.playerName} {seat.playerId === playerId ? '(You)' : ''}
                    </span>
                    <span className="font-mono text-[#F5B82E] tabular-nums">{formatRs(seat.chips)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {seat.cards.map((c, i) => (
                        <CardView key={i} card={c} />
                      ))}
                    </div>
                    <div className="text-right text-[11px] font-mono text-[#A3B3AC]">
                      {seat.folded ? (
                        <span className="text-red-400">Folded</span>
                      ) : activeTurn ? (
                        <span className="text-[#F5B82E] font-semibold">Acting...</span>
                      ) : (
                        <span>Bet: Rs {seat.bet}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Bar */}
        {mySeat && poker?.phase !== 'waiting' && poker?.phase !== 'showdown' && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
            <div className="text-xs text-[#A3B3AC]">
              {isMyTurn ? 'Your turn to act' : 'Waiting for table action...'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={!isMyTurn}
                onClick={() => sendEvent('poker:action', { playerId, action: 'fold' })}
                className="px-4 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
              >
                Fold
              </button>
              {toCall === 0 ? (
                <button
                  disabled={!isMyTurn}
                  onClick={() => sendEvent('poker:action', { playerId, action: 'check' })}
                  className="px-4 py-2.5 rounded-xl bg-[#202825] hover:bg-[#28332F] disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
                >
                  Check
                </button>
              ) : (
                <button
                  disabled={!isMyTurn}
                  onClick={() => sendEvent('poker:action', { playerId, action: 'call' })}
                  className="px-4 py-2.5 rounded-xl bg-[#202825] hover:bg-[#28332F] disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
                >
                  Call Rs {toCall}
                </button>
              )}
              <button
                disabled={!isMyTurn || mySeat.chips < toCall + 50}
                onClick={() => sendEvent('poker:action', { playerId, action: 'raise', raiseAmount: 50 })}
                className="px-4 py-2.5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
              >
                Raise +Rs 50
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
