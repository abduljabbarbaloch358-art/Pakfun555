import { useEffect, useRef, useState } from 'react';
import {
  Plane,
  ShieldCheck,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Minus,
  Plus,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';
import { AviatorState, GameId } from '../../types/platform';
import { soundFx } from '../../lib/sound';
import { formatRs } from '../../lib/vip';

interface Props {
  aviator: AviatorState | null;
  playerId: string;
  playerName: string;
  walletBalance: number;
  isSignedIn: boolean;
  onRequireAuth: () => void;
  onPlaceWsBet: (amount: number, autoCashout: number | null) => void;
  onCashoutWs: () => void;
  onSettleBet: (params: {
    game: GameId;
    betAmount: number;
    multiplier: number;
    payout: number;
    outcome: 'win' | 'loss' | 'cashout';
    details: string;
  }) => Promise<boolean | undefined>;
}

const PRESETS = [10, 50, 100, 500];

export function AviatorGame({
  aviator,
  playerId,
  walletBalance,
  isSignedIn,
  onRequireAuth,
  onPlaceWsBet,
  onCashoutWs,
  onSettleBet,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Panel 1 (WS server-synced primary bet)
  const [bet1Amount, setBet1Amount] = useState(10);
  const [tab1, setTab1] = useState<'bet' | 'auto'>('bet');
  const [auto1Cashout, setAuto1Cashout] = useState('2.00');
  const [activeBet1Round, setActiveBet1Round] = useState<number | null>(null);
  const [settled1Round, setSettled1Round] = useState<number | null>(null);
  const [queuedBet1, setQueuedBet1] = useState<{ amount: number; autoAt: number | null } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Panel 2 (parallel second bet slot for dual Spribe play)
  const [showPanel2, setShowPanel2] = useState(true);
  const [bet2Amount, setBet2Amount] = useState(10);
  const [tab2, setTab2] = useState<'bet' | 'auto'>('bet');
  const [auto2Cashout, setAuto2Cashout] = useState('2.50');
  const [bet2State, setBet2State] = useState<{
    roundId: number;
    amount: number;
    autoAt: number | null;
    cashedOutAt: number | null;
    payout: number;
    settled: boolean;
  } | null>(null);

  const [ledgerTab, setLedgerTab] = useState<'all' | 'previous' | 'top'>('all');
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const settled1RoundRef = useRef<number | null>(null);
  const settled2RoundRef = useRef<number | null>(null);

  const myBet = aviator?.bets.find((b) => b.playerId === playerId);
  const slot1ActiveAmount =
    myBet && myBet.cashedOutAt === null ? myBet.amount : queuedBet1 ? queuedBet1.amount : 0;
  const slot2ActiveAmount = bet2State && !bet2State.settled ? bet2State.amount : 0;

  // Auto-submit queued Panel 1 bet as soon as the betting phase opens
  useEffect(() => {
    if (!aviator || !queuedBet1 || aviator.phase !== 'betting' || myBet) return;
    if (!isSignedIn) {
      setQueuedBet1(null);
      return;
    }
    if (queuedBet1.amount + slot2ActiveAmount > walletBalance) {
      setErrorMsg(
        `Insufficient balance for queued bet (${formatRs(Math.max(0, walletBalance - slot2ActiveAmount))} free after Slot 2).`,
      );
      setQueuedBet1(null);
      return;
    }
    const pending = queuedBet1;
    setQueuedBet1(null);
    setErrorMsg(null);
    soundFx.chip();
    setActiveBet1Round(aviator.roundId);
    setSettled1Round(null);
    settled1RoundRef.current = null;
    onPlaceWsBet(pending.amount, pending.autoAt);
  }, [aviator, queuedBet1, myBet, slot2ActiveAmount, isSignedIn, walletBalance, onPlaceWsBet]);

  // Settle Panel 1 WS bet on crash
  useEffect(() => {
    if (!aviator) return;
    if (
      aviator.phase === 'crashed' &&
      activeBet1Round === aviator.roundId &&
      settled1Round !== aviator.roundId &&
      settled1RoundRef.current !== aviator.roundId &&
      myBet &&
      myBet.cashedOutAt === null
    ) {
      settled1RoundRef.current = aviator.roundId;
      setSettled1Round(aviator.roundId);
      soundFx.crash();
      if (isSignedIn) {
        void onSettleBet({
          game: 'aviator',
          betAmount: myBet.amount,
          multiplier: 0,
          payout: 0,
          outcome: 'loss',
          details: `Aviator #${aviator.roundId} flew away at ${aviator.crashPoint?.toFixed(2)}x`,
        }).catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to settle Aviator bet.');
        });
      }
    }
  }, [aviator, activeBet1Round, settled1Round, myBet, isSignedIn, onSettleBet]);

  // Settle Panel 1 WS bet on cashout
  useEffect(() => {
    if (!aviator || !myBet) return;
    if (
      myBet.cashedOutAt !== null &&
      activeBet1Round === aviator.roundId &&
      settled1Round !== aviator.roundId &&
      settled1RoundRef.current !== aviator.roundId
    ) {
      settled1RoundRef.current = aviator.roundId;
      setSettled1Round(aviator.roundId);
      soundFx.win();
      if (isSignedIn) {
        void onSettleBet({
          game: 'aviator',
          betAmount: myBet.amount,
          multiplier: myBet.cashedOutAt,
          payout: myBet.payout,
          outcome: 'cashout',
          details: `Aviator #${aviator.roundId} cashed out at ${myBet.cashedOutAt.toFixed(2)}x`,
        }).catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to settle Aviator cashout.');
        });
      }
    }
  }, [aviator, myBet, activeBet1Round, settled1Round, isSignedIn, onSettleBet]);

  // Monitor Panel 2 parallel bet (Auto-cashout & Crash settlement)
  useEffect(() => {
    if (!aviator || !bet2State) return;
    if (bet2State.roundId !== aviator.roundId) {
      if (aviator.phase === 'betting' && bet2State.settled) {
        setBet2State(null);
      }
      return;
    }

    if (
      aviator.phase === 'flying' &&
      !bet2State.settled &&
      settled2RoundRef.current !== aviator.roundId &&
      bet2State.autoAt !== null &&
      aviator.multiplier >= bet2State.autoAt
    ) {
      settled2RoundRef.current = aviator.roundId;
      const cashMult = bet2State.autoAt;
      const payout = Math.round(bet2State.amount * cashMult * 100) / 100;
      setBet2State({ ...bet2State, cashedOutAt: cashMult, payout, settled: true });
      soundFx.win();
      if (isSignedIn) {
        void onSettleBet({
          game: 'aviator',
          betAmount: bet2State.amount,
          multiplier: cashMult,
          payout,
          outcome: 'cashout',
          details: `Aviator #${aviator.roundId} Slot-2 auto cashed at ${cashMult.toFixed(2)}x`,
        }).catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to settle Slot-2 auto cashout.');
        });
      }
      return;
    }

    if (
      aviator.phase === 'crashed' &&
      !bet2State.settled &&
      settled2RoundRef.current !== aviator.roundId &&
      bet2State.cashedOutAt === null
    ) {
      settled2RoundRef.current = aviator.roundId;
      setBet2State({ ...bet2State, settled: true });
      if (isSignedIn) {
        void onSettleBet({
          game: 'aviator',
          betAmount: bet2State.amount,
          multiplier: 0,
          payout: 0,
          outcome: 'loss',
          details: `Aviator #${aviator.roundId} Slot-2 flew away at ${aviator.crashPoint?.toFixed(2)}x`,
        }).catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to settle Slot-2 loss.');
        });
      }
    }
  }, [aviator, bet2State, isSignedIn, onSettleBet]);

  // Draw Spribe sunburst & flight curve canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !aviator) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    // Sunburst rays from bottom-left like Screenshot 6
    ctx.save();
    ctx.translate(0, h);
    for (let i = 0; i < 18; i++) {
      if (i % 2 === 0) {
        const a1 = -Math.PI / 2 + (i * (Math.PI / 2)) / 18;
        const a2 = -Math.PI / 2 + ((i + 1) * (Math.PI / 2)) / 18;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, Math.max(w, h) * 1.4, a1, a2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fill();
      }
    }
    ctx.restore();

    if (aviator.phase === 'flying' || aviator.phase === 'crashed') {
      const progress = Math.min(1, Math.log(Math.max(1, aviator.multiplier)) / Math.log(10));
      const padLeft = 18;
      const padBottom = 18;
      const endX = padLeft + (w - padLeft - 44) * Math.max(0.08, progress);
      const endY = h - padBottom - (h - padBottom - 44) * Math.pow(Math.max(0.06, progress), 0.82);

      const lineColor = aviator.phase === 'crashed' ? '#EF4444' : '#E11D48';
      const fillGrad = ctx.createLinearGradient(0, endY, 0, h - padBottom);
      fillGrad.addColorStop(0, 'rgba(225,29,72,0.34)');
      fillGrad.addColorStop(1, 'rgba(225,29,72,0.02)');

      ctx.beginPath();
      ctx.moveTo(padLeft, h - padBottom);
      ctx.quadraticCurveTo(padLeft + (endX - padLeft) * 0.58, h - padBottom, endX, endY);
      ctx.lineTo(endX, h - padBottom);
      ctx.closePath();
      ctx.fillStyle = fillGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(padLeft, h - padBottom);
      ctx.quadraticCurveTo(padLeft + (endX - padLeft) * 0.58, h - padBottom, endX, endY);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Red Spribe plane silhouette at trajectory tip
      if (aviator.phase === 'flying') {
        ctx.save();
        ctx.translate(endX, endY);
        ctx.rotate(-0.22);
        ctx.fillStyle = '#E11D48';
        ctx.beginPath();
        ctx.moveTo(-18, 4);
        ctx.lineTo(14, 0);
        ctx.lineTo(-4, -9);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, 1, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.restore();
      }
    }
  }, [aviator]);

  const parseAutoTarget = (raw: string): number | null => {
    const num = parseFloat(raw);
    if (!Number.isFinite(num) || num < 1.01 || num > 100) return null;
    return Math.round(num * 100) / 100;
  };

  const handlePlaceBet1 = () => {
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (!aviator) {
      setErrorMsg('Connecting to flight server... please try again in a second.');
      return;
    }
    if (queuedBet1) {
      setQueuedBet1(null);
      return;
    }
    const stake = Math.floor(bet1Amount);
    if (!Number.isFinite(stake) || stake < 1 || stake > 50000) {
      setErrorMsg('Enter a valid Slot 1 bet between Rs 1 and Rs 50,000.');
      return;
    }
    const availableForSlot1 = Math.max(0, walletBalance - slot2ActiveAmount);
    if (stake > availableForSlot1) {
      setErrorMsg(`Insufficient available balance (${formatRs(availableForSlot1)} free after Slot 2). Lower your stake or deposit.`);
      return;
    }
    let auto: number | null = null;
    if (tab1 === 'auto') {
      auto = parseAutoTarget(auto1Cashout);
      if (auto === null) {
        setErrorMsg('Set Slot 1 Auto Cash Out target between 1.01x and 100x.');
        return;
      }
    }
    if (aviator.phase !== 'betting') {
      soundFx.chip();
      setQueuedBet1({ amount: stake, autoAt: auto });
      return;
    }
    soundFx.chip();
    setActiveBet1Round(aviator.roundId);
    setSettled1Round(null);
    settled1RoundRef.current = null;
    onPlaceWsBet(stake, auto);
  };

  const handleCashout1 = () => {
    if (!aviator || aviator.phase !== 'flying') return;
    onCashoutWs();
  };

  const handlePlaceBet2 = () => {
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (!aviator) {
      setErrorMsg('Connecting to flight server... please wait.');
      return;
    }
    if (aviator.phase !== 'betting') {
      setErrorMsg('Wait for the next countdown to place a Slot 2 bet (or use Slot 1 to queue).');
      return;
    }
    const stake = Math.floor(bet2Amount);
    if (!Number.isFinite(stake) || stake < 1 || stake > 50000) {
      setErrorMsg('Enter a valid Slot 2 bet between Rs 1 and Rs 50,000.');
      return;
    }
    const availableForSlot2 = Math.max(0, walletBalance - slot1ActiveAmount);
    if (stake > availableForSlot2) {
      setErrorMsg(`Insufficient available balance (${formatRs(availableForSlot2)} free after Slot 1). Lower your stake or deposit.`);
      return;
    }
    let auto: number | null = null;
    if (tab2 === 'auto') {
      auto = parseAutoTarget(auto2Cashout);
      if (auto === null) {
        setErrorMsg('Set Slot 2 Auto Cash Out target between 1.01x and 100x.');
        return;
      }
    }
    soundFx.chip();
    settled2RoundRef.current = null;
    setBet2State({
      roundId: aviator.roundId,
      amount: stake,
      autoAt: auto,
      cashedOutAt: null,
      payout: 0,
      settled: false,
    });
  };

  const handleCashout2 = () => {
    if (!aviator || aviator.phase !== 'flying' || !bet2State || bet2State.settled) return;
    if (settled2RoundRef.current === aviator.roundId) return;
    settled2RoundRef.current = aviator.roundId;
    const cashMult = aviator.multiplier;
    const payout = Math.round(bet2State.amount * cashMult * 100) / 100;
    setBet2State({ ...bet2State, cashedOutAt: cashMult, payout, settled: true });
    soundFx.win();
    if (isSignedIn) {
      void onSettleBet({
        game: 'aviator',
        betAmount: bet2State.amount,
        multiplier: cashMult,
        payout,
        outcome: 'cashout',
        details: `Aviator #${aviator.roundId} Slot-2 cashed out at ${cashMult.toFixed(2)}x`,
      }).catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to settle Slot-2 cashout.');
      });
    }
  };

  const historyList = aviator?.history || [2.43, 2.08, 235.69, 1.64, 5.88, 1.38, 5.07];
  const visibleHistory = historyExpanded ? historyList : historyList.slice(0, 9);

  return (
    <div className="max-w-4xl mx-auto space-y-2.5 bg-[#0D0E11] border border-white/10 rounded-2xl p-2.5 sm:p-4">
      {/* Top SPRIBE Aviator Bar (Screenshot 6) */}
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="font-display text-2xl font-black italic tracking-tight text-[#E11D48]">
          Aviator
        </span>

        <div className="flex items-center gap-3">
          <div className="text-right font-mono text-sm">
            <span className="font-extrabold text-[#22C55E] tabular-nums">
              {walletBalance.toFixed(2)}
            </span>{' '}
            <span className="text-xs text-[#9CA3AF]">PKR</span>
          </div>
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            className="p-1.5 rounded-lg bg-[#1B1C20] text-[#9CA3AF] hover:text-white cursor-pointer"
            aria-label="Game rules and provably fair info"
          >
            <Menu className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setLedgerTab('all')}
            className="p-1.5 rounded-lg bg-[#1B1C20] text-[#9CA3AF] hover:text-white cursor-pointer"
            aria-label="Jump to live bets feed"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {infoOpen && (
        <div className="bg-[#1B1C20] border border-white/10 rounded-xl p-3 text-xs text-[#CBD5E1] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#22C55E] shrink-0" />
            <span>
              SPRIBE Provably Fair Aviator · Round #{aviator?.roundId || 1000} · Hash:{' '}
              <span className="font-mono text-white">{aviator?.roundHash || 'verified'}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setInfoOpen(false)}
            className="text-white/60 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Previous Multipliers Strip */}
      <div className="flex items-center justify-between gap-2 bg-[#141518] rounded-xl px-2.5 py-1.5 border border-white/5">
        <div className="flex items-center gap-1.5 overflow-x-auto flex-wrap">
          {visibleHistory.map((val, idx) => (
            <span
              key={`${val}-${idx}`}
              className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                val >= 10
                  ? 'text-[#EC4899] bg-[#EC4899]/10'
                  : val >= 2
                    ? 'text-[#A855F7] bg-[#A855F7]/10'
                    : 'text-[#38BDF8] bg-[#38BDF8]/10'
              }`}
            >
              {val.toFixed(2)}x
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setHistoryExpanded((v) => !v)}
          className="px-2 py-1 rounded-full bg-[#24262C] text-[#9CA3AF] hover:text-white shrink-0 cursor-pointer"
          aria-label="Toggle more round multipliers"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Flight Canvas (Sunburst + Official Game Crest + Plane) */}
      <div className="relative h-[230px] sm:h-[280px] bg-[#0B0C0E] border border-white/10 rounded-2xl overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Overlay Stage Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
          {!aviator && (
            <div className="space-y-2 flex flex-col items-center">
              <Plane className="w-7 h-7 text-[#E11D48] animate-pulse" />
              <div className="text-xs font-mono text-[#CBD5E1]">Connecting to live Aviator server...</div>
            </div>
          )}

          {aviator?.phase === 'betting' && (
            <div className="space-y-3 flex flex-col items-center">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg sm:text-xl font-black text-white tracking-wide">
                  SPRIBE
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#1B1C20] border border-[#22C55E]/50 text-[11px] font-semibold text-[#22C55E] inline-flex items-center gap-1">
                  Official Game <CheckCircle2 className="w-3 h-3" />
                </span>
              </div>

              <div className="w-40 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#E11D48] transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(12, ((8 - aviator.countdown) / 7) * 100))}%` }}
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-[#CBD5E1]">
                <Plane className="w-4 h-4 text-[#E11D48]" />
                <span>Next flight in {aviator.countdown}s</span>
              </div>
            </div>
          )}

          {aviator?.phase === 'flying' && (
            <div className="space-y-1">
              <div className="font-mono text-5xl sm:text-6xl font-black text-white tabular-nums drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                {aviator.multiplier.toFixed(2)}x
              </div>
              {myBet && myBet.cashedOutAt !== null && (
                <div className="text-xs sm:text-sm font-bold text-[#22C55E]">
                  Cashed Out {myBet.cashedOutAt.toFixed(2)}x · {formatRs(myBet.payout)}
                </div>
              )}
            </div>
          )}

          {aviator?.phase === 'crashed' && (
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-widest text-white/90">
                FLEW AWAY!
              </div>
              <div className="font-mono text-5xl sm:text-6xl font-black text-[#E11D48] tabular-nums">
                {(aviator.crashPoint ?? aviator.multiplier).toFixed(2)}x
              </div>
            </div>
          )}
        </div>

        {/* Bottom-right Active Pilots Counter like Screenshot 6 */}
        <div className="absolute bottom-2.5 right-3 flex items-center gap-1.5 bg-black/55 border border-white/10 rounded-full px-2.5 py-1 text-[11px] font-mono text-white">
          <span className="w-4 h-4 rounded-full bg-[#E11D48] inline-flex items-center justify-center text-[9px] font-bold">
            P
          </span>
          <span>{Math.max(1, (aviator?.bets.length || 0) + 12)}</span>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/35 px-3 py-2 text-xs text-red-200">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Dual Bet Panels (Screenshot 6) */}
      <div className="space-y-2.5">
        {/* Panel 1 (WS Live Bet) */}
        <div className="bg-[#1B1C20] border border-white/10 rounded-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="inline-flex bg-[#111215] rounded-full p-0.5 mx-auto">
              {(['bet', 'auto'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={Boolean(myBet)}
                  onClick={() => setTab1(t)}
                  className={`px-6 py-1 rounded-full text-xs font-semibold capitalize cursor-pointer ${
                    tab1 === t ? 'bg-[#2C2E35] text-white' : 'text-[#9CA3AF]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-stretch">
            <div className="sm:col-span-6 space-y-2">
              <div className="flex items-center justify-between bg-[#101114] border border-white/10 rounded-full px-2 py-1">
                <button
                  type="button"
                  disabled={Boolean(myBet)}
                  onClick={() => setBet1Amount((v) => Math.max(1, v - 10))}
                  className="w-7 h-7 rounded-full bg-[#24262C] text-white flex items-center justify-center cursor-pointer disabled:opacity-40"
                  aria-label="Decrease bet"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={50000}
                  disabled={Boolean(myBet)}
                  value={bet1Amount}
                  onChange={(e) => setBet1Amount(Math.max(1, Number(e.target.value)))}
                  className="w-24 bg-transparent text-center font-mono text-sm font-bold text-white focus:outline-none"
                />
                <button
                  type="button"
                  disabled={Boolean(myBet)}
                  onClick={() => setBet1Amount((v) => Math.min(50000, v + 10))}
                  className="w-7 h-7 rounded-full bg-[#24262C] text-white flex items-center justify-center cursor-pointer disabled:opacity-40"
                  aria-label="Increase bet"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={Boolean(myBet)}
                    onClick={() => setBet1Amount(p)}
                    className="py-1 rounded-full bg-[#101114] hover:bg-[#24262C] text-xs font-mono text-[#CBD5E1] cursor-pointer disabled:opacity-40"
                  >
                    {p.toLocaleString()}
                  </button>
                ))}
              </div>

              {tab1 === 'auto' && (
                <div className="flex items-center justify-between bg-[#101114] rounded-full px-3 py-1 text-xs">
                  <span className="text-[#9CA3AF]">Auto Cash Out</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1.1"
                    disabled={Boolean(myBet)}
                    value={auto1Cashout}
                    onChange={(e) => setAuto1Cashout(e.target.value)}
                    className="w-16 bg-transparent text-right font-mono font-bold text-[#22C55E] focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-6 flex">
              {aviator?.phase === 'flying' && myBet && myBet.cashedOutAt === null ? (
                <button
                  type="button"
                  onClick={handleCashout1}
                  className="w-full min-h-[76px] rounded-2xl bg-[#D97706] hover:bg-[#B45309] text-white font-display flex flex-col items-center justify-center cursor-pointer shadow-lg"
                >
                  <span className="text-sm font-bold uppercase">Cash Out</span>
                  <span className="font-mono text-lg font-black tabular-nums">
                    {(myBet.amount * aviator.multiplier).toFixed(2)} PKR
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={Boolean(myBet)}
                  onClick={handlePlaceBet1}
                  className={`w-full min-h-[76px] rounded-2xl text-white font-display flex flex-col items-center justify-center cursor-pointer shadow-lg transition-colors ${
                    myBet
                      ? 'bg-[#282B32] text-[#9CA3AF]'
                      : queuedBet1
                        ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                        : 'bg-[#28A909] hover:bg-[#239408]'
                  }`}
                >
                  <span className="text-base font-bold">
                    {myBet
                      ? myBet.cashedOutAt
                        ? `Won ${myBet.payout.toFixed(2)}`
                        : 'Waiting Takeoff'
                      : queuedBet1
                        ? 'Cancel Queued Bet'
                        : aviator?.phase === 'betting'
                          ? 'Bet'
                          : 'Bet (Next Round)'}
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {(queuedBet1 ? queuedBet1.amount : bet1Amount).toFixed(2)} PKR
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Panel 2 (Collapsible Second Concurrent Bet Slot like Screenshot 6) */}
        <div className="bg-[#1B1C20] border border-white/10 rounded-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="w-6" />
            <div className="inline-flex bg-[#111215] rounded-full p-0.5">
              {(['bet', 'auto'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={Boolean(bet2State && !bet2State.settled)}
                  onClick={() => setTab2(t)}
                  className={`px-6 py-1 rounded-full text-xs font-semibold capitalize cursor-pointer ${
                    tab2 === t ? 'bg-[#2C2E35] text-white' : 'text-[#9CA3AF]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowPanel2((v) => !v)}
              className="w-6 h-6 rounded-md bg-[#24262C] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
              aria-label="Toggle second bet panel"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>

          {showPanel2 && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-stretch">
              <div className="sm:col-span-6 space-y-2">
                <div className="flex items-center justify-between bg-[#101114] border border-white/10 rounded-full px-2 py-1">
                  <button
                    type="button"
                    disabled={Boolean(bet2State && !bet2State.settled)}
                    onClick={() => setBet2Amount((v) => Math.max(1, v - 10))}
                    className="w-7 h-7 rounded-full bg-[#24262C] text-white flex items-center justify-center cursor-pointer disabled:opacity-40"
                    aria-label="Decrease slot 2 bet"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={50000}
                    disabled={Boolean(bet2State && !bet2State.settled)}
                    value={bet2Amount}
                    onChange={(e) => setBet2Amount(Math.max(1, Number(e.target.value)))}
                    className="w-24 bg-transparent text-center font-mono text-sm font-bold text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={Boolean(bet2State && !bet2State.settled)}
                    onClick={() => setBet2Amount((v) => Math.min(50000, v + 10))}
                    className="w-7 h-7 rounded-full bg-[#24262C] text-white flex items-center justify-center cursor-pointer disabled:opacity-40"
                    aria-label="Increase slot 2 bet"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={Boolean(bet2State && !bet2State.settled)}
                      onClick={() => setBet2Amount(p)}
                      className="py-1 rounded-full bg-[#101114] hover:bg-[#24262C] text-xs font-mono text-[#CBD5E1] cursor-pointer disabled:opacity-40"
                    >
                      {p.toLocaleString()}
                    </button>
                  ))}
                </div>

                {tab2 === 'auto' && (
                  <div className="flex items-center justify-between bg-[#101114] rounded-full px-3 py-1 text-xs">
                    <span className="text-[#9CA3AF]">Auto Cash Out</span>
                    <input
                      type="number"
                      step="0.1"
                      min="1.1"
                      disabled={Boolean(bet2State && !bet2State.settled)}
                      value={auto2Cashout}
                      onChange={(e) => setAuto2Cashout(e.target.value)}
                      className="w-16 bg-transparent text-right font-mono font-bold text-[#22C55E] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="sm:col-span-6 flex">
                {aviator?.phase === 'flying' &&
                bet2State &&
                bet2State.roundId === aviator.roundId &&
                !bet2State.settled ? (
                  <button
                    type="button"
                    onClick={handleCashout2}
                    className="w-full min-h-[76px] rounded-2xl bg-[#D97706] hover:bg-[#B45309] text-white font-display flex flex-col items-center justify-center cursor-pointer shadow-lg"
                  >
                    <span className="text-sm font-bold uppercase">Cash Out</span>
                    <span className="font-mono text-lg font-black tabular-nums">
                      {(bet2State.amount * aviator.multiplier).toFixed(2)} PKR
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(bet2State && bet2State.roundId === aviator?.roundId && !bet2State.settled)}
                    onClick={handlePlaceBet2}
                    className="w-full min-h-[76px] rounded-2xl bg-[#28A909] hover:bg-[#239408] disabled:bg-[#282B32] disabled:text-[#9CA3AF] text-white font-display flex flex-col items-center justify-center cursor-pointer shadow-lg"
                  >
                    <span className="text-base font-bold">
                      {bet2State && bet2State.roundId === aviator?.roundId
                        ? bet2State.cashedOutAt
                          ? `Won ${bet2State.payout.toFixed(2)}`
                          : 'Waiting Takeoff'
                        : 'Bet'}
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {bet2Amount.toFixed(2)} PKR
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom All Bets | Previous | Top Tabs (Screenshot 6) */}
      <div className="bg-[#1B1C20] border border-white/10 rounded-2xl p-3 space-y-2.5">
        <div className="grid grid-cols-3 bg-[#101114] rounded-full p-0.5 text-xs font-semibold">
          {(
            [
              { id: 'all', label: 'All Bets' },
              { id: 'previous', label: 'Previous' },
              { id: 'top', label: 'Top' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setLedgerTab(t.id)}
              className={`py-1.5 rounded-full cursor-pointer transition-colors ${
                ledgerTab === t.id ? 'bg-[#2C2E35] text-white' : 'text-[#9CA3AF]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {ledgerTab === 'all' && (
          <div className="divide-y divide-white/5 text-xs max-h-56 overflow-y-auto">
            {(!aviator || aviator.bets.length === 0) && (
              <div className="py-6 text-center text-[#9CA3AF]">
                No live bets placed in this round yet.
              </div>
            )}
            {aviator?.bets.map((b) => (
              <div key={b.playerId} className="py-2 flex items-center justify-between">
                <span className="text-white font-medium truncate">{b.playerName}</span>
                <div className="flex items-center gap-4 font-mono tabular-nums">
                  <span className="text-[#CBD5E1]">{b.amount.toFixed(2)} PKR</span>
                  <span className={b.cashedOutAt ? 'text-[#22C55E] font-bold' : 'text-[#9CA3AF]'}>
                    {b.cashedOutAt
                      ? `${b.cashedOutAt.toFixed(2)}x · ${b.payout.toFixed(2)}`
                      : aviator.phase === 'crashed'
                        ? 'Flew away'
                        : 'Flying'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {ledgerTab === 'previous' && (
          <div className="flex flex-wrap gap-2 py-2">
            {historyList.map((val, idx) => (
              <span
                key={`prev-${val}-${idx}`}
                className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-[#101114] text-[#CBD5E1]"
              >
                {val.toFixed(2)}x
              </span>
            ))}
          </div>
        )}

        {ledgerTab === 'top' && (
          <div className="space-y-1.5 py-1 text-xs font-mono">
            {[...historyList]
              .sort((a, b) => b - a)
              .slice(0, 6)
              .map((val, idx) => (
                <div key={`top-${idx}`} className="flex items-center justify-between py-1 px-2 bg-[#101114] rounded-lg">
                  <span className="text-[#9CA3AF]">#{idx + 1} Highest Multiplier</span>
                  <span className="text-[#EC4899] font-bold">{val.toFixed(2)}x</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
