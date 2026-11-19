import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CircleDot, Users } from 'lucide-react';
import { GameId, RouletteState } from '../../types/platform';
import { soundFx } from '../../lib/sound';
import { formatRs } from '../../lib/vip';

interface Props {
  roulette: RouletteState | null;
  playerId: string;
  walletBalance: number;
  isSignedIn: boolean;
  onRequireAuth: () => void;
  onPlaceBetWs: (betType: string, amount: number) => void;
  onSettleBet: (params: {
    game: GameId;
    betAmount: number;
    multiplier: number;
    payout: number;
    outcome: 'win' | 'loss' | 'cashout';
    details: string;
  }) => Promise<boolean | undefined>;
  lastSettledEvent: {
    roundId: number;
    playerId: string;
    winningNumber: number;
    winningColor: 'red' | 'black' | 'green';
    wagered: number;
    payout: number;
  } | null;
}

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function RouletteGame({
  roulette,
  playerId,
  walletBalance,
  isSignedIn,
  onRequireAuth,
  onPlaceBetWs,
  onSettleBet,
  lastSettledEvent,
}: Props) {
  const [chipAmount, setChipAmount] = useState(10);
  const [settledRoundId, setSettledRoundId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultFeedback, setResultFeedback] = useState<{
    roundId: number;
    winningNumber: number;
    winningColor: 'red' | 'black' | 'green';
    wagered: number;
    payout: number;
  } | null>(null);

  const settledRoundRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      lastSettledEvent &&
      lastSettledEvent.playerId === playerId &&
      lastSettledEvent.roundId !== settledRoundId &&
      settledRoundRef.current !== lastSettledEvent.roundId
    ) {
      settledRoundRef.current = lastSettledEvent.roundId;
      setSettledRoundId(lastSettledEvent.roundId);
      setResultFeedback({
        roundId: lastSettledEvent.roundId,
        winningNumber: lastSettledEvent.winningNumber,
        winningColor: lastSettledEvent.winningColor,
        wagered: lastSettledEvent.wagered,
        payout: lastSettledEvent.payout,
      });
      if (lastSettledEvent.payout > 0) soundFx.win();
      else soundFx.crash();

      if (isSignedIn) {
        const mult = lastSettledEvent.wagered > 0 ? lastSettledEvent.payout / lastSettledEvent.wagered : 0;
        void onSettleBet({
          game: 'roulette',
          betAmount: lastSettledEvent.wagered,
          multiplier: mult,
          payout: lastSettledEvent.payout,
          outcome: lastSettledEvent.payout >= lastSettledEvent.wagered ? 'win' : 'loss',
          details: `Round #${lastSettledEvent.roundId} landed ${lastSettledEvent.winningNumber} (${lastSettledEvent.winningColor})`,
        }).catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to settle roulette round.');
        });
      }
    }
  }, [lastSettledEvent, playerId, settledRoundId, isSignedIn, onSettleBet]);

  const myBets = (roulette?.bets || []).filter((b) => b.playerId === playerId);
  const myTableStake = myBets.reduce((s, b) => s + b.amount, 0);

  const handleBet = (betType: string) => {
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (!roulette) {
      setErrorMsg('Connecting to multiplayer roulette wheel... please wait a moment.');
      return;
    }
    if (roulette.phase !== 'betting') {
      setErrorMsg('Wheel is spinning right now — wait a few seconds for the next betting round.');
      return;
    }
    if (chipAmount <= 0 || myTableStake + chipAmount > walletBalance) {
      const remaining = Math.max(0, walletBalance - myTableStake);
      setErrorMsg(`Insufficient available balance (${formatRs(remaining)} remaining after table chips).`);
      return;
    }
    if (myTableStake + chipAmount > 50000) {
      setErrorMsg('Maximum total table stake is Rs 50,000 per spin.');
      return;
    }
    soundFx.chip();
    onPlaceBetWs(betType, chipAmount);
  };

  return (
    <div className="space-y-5">
      {/* Status & History Header */}
      <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center font-mono text-lg font-bold border-2 ${
              roulette?.phase === 'spinning'
                ? 'border-[#F5B82E] bg-[#202825] text-[#F5B82E] animate-spin'
                : roulette?.winningColor === 'red'
                  ? 'border-red-500 bg-red-600/20 text-white'
                  : roulette?.winningColor === 'black'
                    ? 'border-white/30 bg-black/60 text-white'
                    : 'border-[#19B954] bg-[#19B954]/20 text-[#19B954]'
            }`}
          >
            {roulette?.phase === 'settled' ? roulette.winningNumber : <CircleDot className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              {!roulette
                ? 'Connecting to multiplayer wheel...'
                : roulette.phase === 'betting'
                  ? `Place Your Chips · ${roulette.countdown}s`
                  : roulette.phase === 'spinning'
                    ? 'Wheel Spinning · Bets Locked'
                    : `Winning Pocket: ${roulette.winningNumber} (${roulette.winningColor})`}
            </div>
            <div className="text-xs text-[#A3B3AC]">
              Multiplayer European Roulette · Round #{roulette?.roundId || 501}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(roulette?.history || []).slice(0, 12).map((n, idx) => {
            const c = n === 0 ? 'bg-[#19B954]' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-[#28332F]';
            return (
              <span
                key={`${n}-${idx}`}
                className={`w-7 h-7 rounded-md flex items-center justify-center font-mono text-xs font-bold text-white shrink-0 ${c}`}
              >
                {n}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Betting Board */}
        <div className="lg:col-span-8 bg-[#171D1B] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
          {resultFeedback && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold border ${
                resultFeedback.payout >= resultFeedback.wagered
                  ? 'bg-[#19B954]/15 border-[#19B954]/40 text-[#4ADE80]'
                  : resultFeedback.payout > 0
                    ? 'bg-[#F5B82E]/15 border-[#F5B82E]/40 text-[#FCD34D]'
                    : 'bg-red-500/15 border-red-500/35 text-red-200'
              }`}
            >
              Round #{resultFeedback.roundId} · Pocket {resultFeedback.winningNumber} (
              {resultFeedback.winningColor.toUpperCase()}) · Staked {formatRs(resultFeedback.wagered)} →{' '}
              {resultFeedback.payout > 0
                ? `Payout ${formatRs(resultFeedback.payout)}`
                : `Missed (-${formatRs(resultFeedback.wagered)})`}
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/35 px-3 py-2 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Chip Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#A3B3AC]">Chip:</span>
              {[1, 10, 50, 100, 500].map((val) => (
                <button
                  key={val}
                  onClick={() => {
                    setChipAmount(val);
                    setErrorMsg(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-colors cursor-pointer ${
                    chipAmount === val
                      ? 'bg-[#19B954] text-white'
                      : 'bg-[#202825] text-[#D1DCD7] hover:bg-[#28332F]'
                  }`}
                >
                  Rs {val}
                </button>
              ))}
            </div>
            <span className="text-xs font-mono text-[#A3B3AC] tabular-nums">
              My Table Stake: {formatRs(myBets.reduce((s, b) => s + b.amount, 0))}
            </span>
          </div>

          {/* 0 + 1-36 Grid */}
          <div className="grid grid-cols-13 gap-1.5">
            <button
              onClick={() => handleBet('number:0')}
              disabled={roulette?.phase !== 'betting'}
              className="col-span-1 row-span-3 min-h-[120px] rounded-lg bg-[#19B954]/80 hover:bg-[#19B954] text-white font-mono text-sm font-bold flex items-center justify-center transition-colors disabled:opacity-60 cursor-pointer"
            >
              0
            </button>
            <div className="col-span-12 grid grid-cols-6 sm:grid-cols-12 gap-1.5">
              {Array.from({ length: 36 }, (_, i) => i + 1).map((num) => {
                const isRed = RED_NUMBERS.has(num);
                const betCount = myBets.filter((b) => b.betType === `number:${num}`).length;
                return (
                  <button
                    key={num}
                    onClick={() => handleBet(`number:${num}`)}
                    disabled={roulette?.phase !== 'betting'}
                    className={`relative h-10 rounded-lg font-mono text-xs font-bold text-white transition-transform active:scale-95 disabled:opacity-60 cursor-pointer ${
                      isRed ? 'bg-red-700 hover:bg-red-600' : 'bg-[#232B28] hover:bg-[#313B37]'
                    } ${betCount > 0 ? 'ring-2 ring-[#F5B82E]' : ''}`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Outside Bets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {[
              { id: 'red', label: 'Red (2x)', cls: 'bg-red-700/80 hover:bg-red-600' },
              { id: 'black', label: 'Black (2x)', cls: 'bg-[#232B28] hover:bg-[#313B37]' },
              { id: 'even', label: 'Even (2x)', cls: 'bg-[#202825] hover:bg-[#28332F]' },
              { id: 'odd', label: 'Odd (2x)', cls: 'bg-[#202825] hover:bg-[#28332F]' },
            ].map((b) => {
              const active = myBets.some((mb) => mb.betType === b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => handleBet(b.id)}
                  disabled={roulette?.phase !== 'betting'}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer ${b.cls} ${
                    active ? 'ring-2 ring-[#F5B82E]' : ''
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: '1st12', label: '1st 12 (3x)' },
              { id: '2nd12', label: '2nd 12 (3x)' },
              { id: '3rd12', label: '3rd 12 (3x)' },
            ].map((b) => {
              const active = myBets.some((mb) => mb.betType === b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => handleBet(b.id)}
                  disabled={roulette?.phase !== 'betting'}
                  className={`py-2.5 px-3 rounded-xl bg-[#202825] hover:bg-[#28332F] text-xs font-semibold text-[#D1DCD7] transition-colors cursor-pointer ${
                    active ? 'ring-2 ring-[#F5B82E]' : ''
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Multiplayer Table Bets */}
        <div className="lg:col-span-4 bg-[#171D1B] border border-white/10 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Users className="w-4 h-4 text-[#19B954]" />
              <span>Table Chips</span>
            </div>
            <span className="text-xs font-mono text-[#A3B3AC]">{roulette?.bets.length || 0} bets</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5 mt-2 max-h-[300px]">
            {(!roulette || roulette.bets.length === 0) && (
              <p className="py-10 text-center text-xs text-[#A3B3AC]">
                Select a chip and tap any pocket or outside bet to join this spin.
              </p>
            )}
            {roulette?.bets.map((b, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <div className="text-white font-medium">{b.playerName}</div>
                  <div className="text-[#A3B3AC] font-mono">{b.betType}</div>
                </div>
                <div className="font-mono text-[#F5B82E] font-semibold tabular-nums">
                  {formatRs(b.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
