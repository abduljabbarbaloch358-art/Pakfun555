import {
  AviatorState,
  LiveFeedItem,
  PaymentMethod,
  PokerCard,
  PokerState,
  RouletteState,
} from '../types/platform';

export interface GatewayQuote {
  method: PaymentMethod;
  type: 'deposit' | 'withdrawal';
  currency: string;
  amount: number;
  fee: number;
  netAmount: number;
  pkrEquivalent: number;
  gatewayRef: string;
  instructions: { label: string; destination: string; note: string };
}

export function buildLocalGatewayQuote(params: {
  method: PaymentMethod;
  amount: number;
  currency: string;
  type: 'deposit' | 'withdrawal';
}): GatewayQuote {
  const { method, amount, currency, type } = params;
  const numAmount = Math.max(0, Number(amount || 0));

  const feeRates: Record<string, number> = {
    EasyPaisa: 0,
    JazzCash: 0,
    'Local Bank Transfer': 0,
    UPI: 0,
    'Net Banking': 0.01,
    Cryptocurrency: 0.005,
  };
  const rate = feeRates[method] ?? 0;
  const fee = Math.round(numAmount * rate * 100) / 100;
  const netAmount = Math.max(0, Math.round((numAmount - fee) * 100) / 100);

  const pkrEquivalent =
    currency === 'USDT' || currency === 'USD'
      ? Math.round(netAmount * 278.5 * 100) / 100
      : currency === 'INR'
        ? Math.round(netAmount * 3.32 * 100) / 100
        : netAmount;

  const gatewayInstructions: Record<PaymentMethod, { label: string; destination: string; note: string }> = {
    EasyPaisa: {
      label: 'EasyPaisa Merchant Till',
      destination: '0345-8819204 (PAKFUN Merchant)',
      note: 'Send exact amount via EasyPaisa app and enter the 11-digit TID below.',
    },
    JazzCash: {
      label: 'JazzCash Business Wallet',
      destination: '0301-7742190 (PAKFUN Digital)',
      note: 'Transfer using JazzCash Mobile Account and submit your TID.',
    },
    'Local Bank Transfer': {
      label: 'Raast / IBAN Instant Transfer',
      destination: 'PK42MEZN0002810104928172 (Meezan Bank)',
      note: 'Use Raast or IBAN transfer and attach your bank reference number.',
    },
    UPI: {
      label: 'Unified Payments Interface (UPI)',
      destination: 'pakfun.pay@icici',
      note: 'Pay via GPay, PhonePe, or Paytm UPI and paste your 12-digit UTR.',
    },
    'Net Banking': {
      label: 'Verified Net Banking Gateway',
      destination: 'Gateway Session #NB-99412',
      note: 'Instant NEFT/IMPS or local online banking settlement.',
    },
    Cryptocurrency: {
      label: 'USDT (TRC-20) Treasury Vault',
      destination: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
      note: 'Send USDT on TRC-20 network only. Credited automatically after 1 confirmation.',
    },
  };

  const randBytes = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randBytes);
  }
  const refHex = Array.from(randBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  return {
    method,
    type,
    currency,
    amount: numAmount,
    fee,
    netAmount,
    pkrEquivalent,
    gatewayRef: `PG-${refHex}`,
    instructions: gatewayInstructions[method] || gatewayInstructions.EasyPaisa,
  };
}

// ---------- Standalone Static-Host Game Table Engine ----------

interface LocalAviatorBet {
  playerId: string;
  playerName: string;
  amount: number;
  autoCashout: number | null;
  cashedOutAt: number | null;
  payout: number;
}

interface LocalPokerSeat {
  seatIndex: number;
  playerId: string;
  playerName: string;
  chips: number;
  bet: number;
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  cards: PokerCard[];
  acted: boolean;
  isBot: boolean;
}

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SUITS: PokerCard['suit'][] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = [
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 11 },
  { rank: 'Q', value: 12 },
  { rank: 'K', value: 13 },
  { rank: 'A', value: 14 },
];

function secureRandomFloat(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / 0xffffffff;
}

function secureRandomInt(maxExclusive: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % maxExclusive;
}

function getRouletteColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

function calculateRoulettePayout(betType: string, amount: number, winningNumber: number): number {
  const color = getRouletteColor(winningNumber);
  if (betType.startsWith('number:')) {
    const target = Number(betType.split(':')[1]);
    return target === winningNumber ? amount * 36 : 0;
  }
  if (betType === 'red' && color === 'red') return amount * 2;
  if (betType === 'black' && color === 'black') return amount * 2;
  if (betType === 'even' && winningNumber !== 0 && winningNumber % 2 === 0) return amount * 2;
  if (betType === 'odd' && winningNumber % 2 === 1) return amount * 2;
  if (betType === '1st12' && winningNumber >= 1 && winningNumber <= 12) return amount * 3;
  if (betType === '2nd12' && winningNumber >= 13 && winningNumber <= 24) return amount * 3;
  if (betType === '3rd12' && winningNumber >= 25 && winningNumber <= 36) return amount * 3;
  return 0;
}

function createShuffledDeck(): PokerCard[] {
  const deck: PokerCard[] = [];
  for (const suit of SUITS) {
    for (const r of RANKS) {
      deck.push({ rank: r.rank, suit, value: r.value });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function scoreFiveCardHand(hand: PokerCard[]): { score: number; label: string } {
  const sorted = [...hand].sort((a, b) => b.value - a.value);
  const values = sorted.map((c) => c.value);
  const isFlush = sorted.every((c) => c.suit === sorted[0].suit);
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  let isStraight = false;
  let straightHigh = values[0];
  if (new Set(values).size === 5) {
    if (values[0] - values[4] === 4) {
      isStraight = true;
    } else if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  const tieBreaker = groups.reduce((acc, [v], idx) => acc + v * Math.pow(15, 4 - idx), 0);

  if (isFlush && isStraight && straightHigh === 14) return { score: 9_000_000 + straightHigh, label: 'Royal Flush' };
  if (isFlush && isStraight) return { score: 8_000_000 + straightHigh, label: 'Straight Flush' };
  if (groups[0][1] === 4) return { score: 7_000_000 + tieBreaker, label: 'Four of a Kind' };
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) return { score: 6_000_000 + tieBreaker, label: 'Full House' };
  if (isFlush) return { score: 5_000_000 + tieBreaker, label: 'Flush' };
  if (isStraight) return { score: 4_000_000 + straightHigh, label: 'Straight' };
  if (groups[0][1] === 3) return { score: 3_000_000 + tieBreaker, label: 'Three of a Kind' };
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) return { score: 2_000_000 + tieBreaker, label: 'Two Pair' };
  if (groups[0][1] === 2) return { score: 1_000_000 + tieBreaker, label: 'One Pair' };
  return { score: tieBreaker, label: 'High Card' };
}

function evaluateHandScore(cards: PokerCard[]): { score: number; label: string } {
  const n = cards.length;
  if (n < 5) {
    const high = Math.max(...cards.map((c) => c.value), 0);
    return { score: high, label: 'High Card' };
  }
  let best = { score: 0, label: 'High Card' };
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const res = scoreFiveCardHand([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (res.score > best.score) best = res;
          }
        }
      }
    }
  }
  return best;
}

export interface LocalTableCallbacks {
  onAviatorState: (state: AviatorState) => void;
  onAviatorCashout: (ev: {
    roundId: number;
    playerId: string;
    multiplier: number;
    payout: number;
    betAmount: number;
  }) => void;
  onRouletteState: (state: RouletteState) => void;
  onRouletteSettled: (ev: {
    roundId: number;
    playerId: string;
    winningNumber: number;
    winningColor: 'red' | 'black' | 'green';
    wagered: number;
    payout: number;
  }) => void;
  onPokerState: (state: PokerState) => void;
  onLiveFeedItem: (item: LiveFeedItem) => void;
  onOnlineCount: (count: number) => void;
}

export function createLocalTableEngine(callbacks: LocalTableCallbacks, initialPlayerId?: string) {
  let activePlayerId = initialPlayerId;
  let destroyed = false;

  const pushLiveFeed = (item: Omit<LiveFeedItem, 'id' | 'timestamp'>) => {
    callbacks.onLiveFeedItem({
      ...item,
      id: `loc-${Date.now()}-${secureRandomInt(99999)}`,
      timestamp: Date.now(),
    });
  };

  // Aviator state
  const genCrash = () => {
    const r = secureRandomFloat();
    const crashPoint = r < 0.04 ? 1.0 : Math.min(50, Math.max(1.01, Math.floor((0.96 / (1 - r)) * 100) / 100));
    const roundHash = Math.floor(secureRandomFloat() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
    return { crashPoint, roundHash };
  };

  const initialCrash = genCrash();
  const aviator = {
    roundId: 1001,
    phase: 'betting' as 'betting' | 'flying' | 'crashed',
    countdown: 7,
    multiplier: 1.0,
    crashPoint: initialCrash.crashPoint,
    roundHash: initialCrash.roundHash,
    startedAt: Date.now(),
    bets: [] as LocalAviatorBet[],
    history: [1.84, 3.42, 1.12, 7.65, 2.09, 1.45, 14.2, 2.88, 1.04, 4.15],
  };

  const emitAviator = () => {
    callbacks.onAviatorState({
      roundId: aviator.roundId,
      phase: aviator.phase,
      countdown: aviator.countdown,
      multiplier: aviator.multiplier,
      crashPoint: aviator.phase === 'crashed' ? aviator.crashPoint : null,
      roundHash: aviator.roundHash,
      bets: [...aviator.bets],
      history: [...aviator.history],
    });
  };

  // Roulette state
  const roulette: RouletteState = {
    roundId: 501,
    phase: 'betting',
    countdown: 18,
    winningNumber: null,
    winningColor: null,
    bets: [],
    history: [17, 0, 32, 8, 23, 14, 36, 5, 11, 29],
  };

  const emitRoulette = () => {
    callbacks.onRouletteState({
      ...roulette,
      bets: [...roulette.bets],
      history: [...roulette.history],
    });
  };

  // Poker state
  const poker = {
    handId: 1,
    phase: 'waiting' as PokerState['phase'],
    pot: 0,
    currentBet: 0,
    turnSeat: -1,
    communityCards: [] as PokerCard[],
    deck: [] as PokerCard[],
    seats: [] as LocalPokerSeat[],
    winnerSummary: '',
    winners: [] as PokerState['winners'],
  };

  let botTimer: number | undefined;

  const emitPoker = () => {
    callbacks.onPokerState({
      handId: poker.handId,
      phase: poker.phase,
      pot: poker.pot,
      currentBet: poker.currentBet,
      turnSeat: poker.turnSeat,
      communityCards: [...poker.communityCards],
      winnerSummary: poker.winnerSummary,
      winners: [...poker.winners],
      seats: poker.seats.map((s) => ({
        seatIndex: s.seatIndex,
        playerId: s.playerId,
        playerName: s.playerName,
        chips: s.chips,
        bet: s.bet,
        totalBet: s.totalBet,
        folded: s.folded,
        allIn: s.allIn,
        acted: s.acted,
        isBot: s.isBot,
        cards:
          poker.phase === 'showdown' || s.playerId === activePlayerId
            ? s.cards
            : s.cards.map(() => ({ rank: '?', suit: 'spades' as const, value: 0 })),
      })),
    });
  };

  const resolvePokerShowdown = () => {
    poker.phase = 'showdown';
    poker.turnSeat = -1;
    const active = poker.seats.filter((s) => !s.folded);

    if (active.length === 1) {
      const winner = active[0];
      winner.chips += poker.pot;
      poker.winners = [
        { playerId: winner.playerId, playerName: winner.playerName, payout: poker.pot, handLabel: 'Opponents Folded' },
      ];
      poker.winnerSummary = `${winner.playerName} wins Rs ${poker.pot.toFixed(0)} (Opponents Folded)`;
      if (!winner.isBot && poker.pot > 0) {
        pushLiveFeed({
          playerName: winner.playerName,
          game: 'Texas Poker',
          betAmount: winner.totalBet || 50,
          multiplier: Number((poker.pot / Math.max(1, winner.totalBet || 50)).toFixed(2)),
          payout: poker.pot,
        });
      }
    } else {
      let bestScore = -1;
      let bestPlayers: { seat: LocalPokerSeat; label: string }[] = [];
      for (const s of active) {
        const evaluated = evaluateHandScore([...s.cards, ...poker.communityCards]);
        if (evaluated.score > bestScore) {
          bestScore = evaluated.score;
          bestPlayers = [{ seat: s, label: evaluated.label }];
        } else if (evaluated.score === bestScore) {
          bestPlayers.push({ seat: s, label: evaluated.label });
        }
      }
      const splitPayout = Math.floor(poker.pot / Math.max(1, bestPlayers.length));
      poker.winners = bestPlayers.map(({ seat, label }) => {
        seat.chips += splitPayout;
        if (!seat.isBot && splitPayout > 0) {
          pushLiveFeed({
            playerName: seat.playerName,
            game: 'Texas Poker',
            betAmount: seat.totalBet || 50,
            multiplier: Number((splitPayout / Math.max(1, seat.totalBet || 50)).toFixed(2)),
            payout: splitPayout,
          });
        }
        return { playerId: seat.playerId, playerName: seat.playerName, payout: splitPayout, handLabel: label };
      });
      poker.winnerSummary =
        bestPlayers.map((w) => `${w.seat.playerName} (${w.label})`).join(' & ') + ` won Rs ${poker.pot.toFixed(0)}`;
    }
    emitPoker();
  };

  const maybeTriggerDealerTurn = () => {
    const current = poker.seats.find((s) => s.seatIndex === poker.turnSeat);
    if (current && current.isBot && poker.phase !== 'waiting' && poker.phase !== 'showdown') {
      botTimer = window.setTimeout(() => {
        if (destroyed) return;
        const seat = poker.seats.find((s) => s.seatIndex === poker.turnSeat && s.isBot);
        if (!seat) return;
        const toCall = Math.max(0, poker.currentBet - seat.bet);
        const handEval = evaluateHandScore([...seat.cards, ...poker.communityCards]);
        if (toCall > 0 && handEval.score < 500_000 && toCall > seat.chips * 0.4) {
          seat.folded = true;
          seat.acted = true;
        } else if (toCall > 0) {
          const pay = Math.min(seat.chips, toCall);
          seat.chips -= pay;
          seat.bet += pay;
          seat.totalBet += pay;
          poker.pot += pay;
          if (seat.chips === 0) seat.allIn = true;
          seat.acted = true;
        } else if (handEval.score >= 1_000_000 && seat.chips >= 50 && poker.currentBet === 0) {
          const raiseAmt = Math.min(seat.chips, 50);
          seat.chips -= raiseAmt;
          seat.bet += raiseAmt;
          seat.totalBet += raiseAmt;
          poker.currentBet = seat.bet;
          poker.pot += raiseAmt;
          seat.acted = true;
        } else {
          seat.acted = true;
        }
        advancePokerTurn();
      }, 750);
    }
  };

  const advancePokerTurn = () => {
    const active = poker.seats.filter((s) => !s.folded);
    if (active.length <= 1) {
      resolvePokerShowdown();
      return;
    }

    const allActedAndMatched = active.every((s) => (s.acted && s.bet === poker.currentBet) || s.allIn);
    if (allActedAndMatched) {
      for (const s of poker.seats) {
        s.bet = 0;
        s.acted = false;
      }
      poker.currentBet = 0;
      if (poker.phase === 'preflop') {
        poker.phase = 'flop';
        poker.communityCards.push(poker.deck.pop()!, poker.deck.pop()!, poker.deck.pop()!);
      } else if (poker.phase === 'flop') {
        poker.phase = 'turn';
        poker.communityCards.push(poker.deck.pop()!);
      } else if (poker.phase === 'turn') {
        poker.phase = 'river';
        poker.communityCards.push(poker.deck.pop()!);
      } else if (poker.phase === 'river') {
        resolvePokerShowdown();
        return;
      }
      const firstActive = poker.seats.find((s) => !s.folded && !s.allIn);
      poker.turnSeat = firstActive ? firstActive.seatIndex : -1;
      emitPoker();
      maybeTriggerDealerTurn();
      return;
    }

    const ordered = poker.seats.map((s) => s.seatIndex);
    const startIdx = ordered.indexOf(poker.turnSeat);
    for (let offset = 1; offset <= ordered.length; offset++) {
      const candidate = poker.seats[(startIdx + offset) % ordered.length];
      if (!candidate.folded && !candidate.allIn && (!candidate.acted || candidate.bet < poker.currentBet)) {
        poker.turnSeat = candidate.seatIndex;
        emitPoker();
        maybeTriggerDealerTurn();
        return;
      }
    }
    resolvePokerShowdown();
  };

  const startPokerHand = () => {
    const humanSeats = poker.seats.filter((s) => !s.isBot && s.chips >= 20);
    if (humanSeats.length === 0) return;

    poker.seats = poker.seats.filter((s) => !s.isBot);
    if (poker.seats.length === 1) {
      poker.seats.push({
        seatIndex: 4,
        playerId: 'house-dealer',
        playerName: 'House Dealer',
        chips: 5000,
        bet: 0,
        totalBet: 0,
        folded: false,
        allIn: false,
        cards: [],
        acted: false,
        isBot: true,
      });
    }

    poker.handId += 1;
    poker.phase = 'preflop';
    poker.deck = createShuffledDeck();
    poker.communityCards = [];
    poker.pot = 0;
    poker.currentBet = 20;
    poker.winnerSummary = '';
    poker.winners = [];

    for (const s of poker.seats) {
      const ante = Math.min(s.chips, 20);
      s.chips -= ante;
      s.bet = ante;
      s.totalBet = ante;
      poker.pot += ante;
      s.folded = false;
      s.allIn = s.chips === 0;
      s.acted = false;
      s.cards = [poker.deck.pop()!, poker.deck.pop()!];
    }

    const firstHuman = poker.seats.find((s) => !s.isBot && !s.allIn);
    poker.turnSeat = firstHuman ? firstHuman.seatIndex : poker.seats[0].seatIndex;
    emitPoker();
    maybeTriggerDealerTurn();
  };

  // Emit initial snapshots
  callbacks.onOnlineCount(1);
  emitAviator();
  emitRoulette();
  emitPoker();

  // Aviator 60ms loop
  const aviatorTimer = window.setInterval(() => {
    if (aviator.phase === 'betting') {
      const elapsedSec = (Date.now() - aviator.startedAt) / 1000;
      const remaining = Math.max(0, Math.ceil(7 - elapsedSec));
      if (remaining !== aviator.countdown) {
        aviator.countdown = remaining;
        emitAviator();
      }
      if (elapsedSec >= 7) {
        aviator.phase = 'flying';
        aviator.startedAt = Date.now();
        aviator.multiplier = 1.0;
        emitAviator();
      }
    } else if (aviator.phase === 'flying') {
      const elapsedSec = (Date.now() - aviator.startedAt) / 1000;
      const mult = Math.floor(Math.exp(0.085 * elapsedSec) * 100) / 100;
      aviator.multiplier = mult;

      for (const bet of aviator.bets) {
        if (bet.cashedOutAt === null && bet.autoCashout && mult >= bet.autoCashout && mult < aviator.crashPoint) {
          bet.cashedOutAt = bet.autoCashout;
          bet.payout = Math.round(bet.amount * bet.autoCashout * 100) / 100;
          callbacks.onAviatorCashout({
            roundId: aviator.roundId,
            playerId: bet.playerId,
            multiplier: bet.cashedOutAt,
            payout: bet.payout,
            betAmount: bet.amount,
          });
          pushLiveFeed({
            playerName: bet.playerName,
            game: 'Aviator Crash',
            betAmount: bet.amount,
            multiplier: bet.cashedOutAt,
            payout: bet.payout,
          });
        }
      }

      if (mult >= aviator.crashPoint) {
        aviator.phase = 'crashed';
        aviator.multiplier = aviator.crashPoint;
        aviator.startedAt = Date.now();
        aviator.history = [aviator.crashPoint, ...aviator.history].slice(0, 18);
      }
      emitAviator();
    } else if (aviator.phase === 'crashed') {
      const elapsedSec = (Date.now() - aviator.startedAt) / 1000;
      if (elapsedSec >= 3.5) {
        const next = genCrash();
        aviator.roundId += 1;
        aviator.phase = 'betting';
        aviator.countdown = 7;
        aviator.multiplier = 1.0;
        aviator.crashPoint = next.crashPoint;
        aviator.roundHash = next.roundHash;
        aviator.startedAt = Date.now();
        aviator.bets = [];
        emitAviator();
      }
    }
  }, 60);

  // Roulette 1s loop
  const rouletteTimer = window.setInterval(() => {
    if (roulette.phase === 'betting') {
      roulette.countdown -= 1;
      if (roulette.countdown <= 0) {
        roulette.phase = 'spinning';
        roulette.countdown = 5;
        roulette.winningNumber = secureRandomInt(37);
        roulette.winningColor = getRouletteColor(roulette.winningNumber);
      }
      emitRoulette();
    } else if (roulette.phase === 'spinning') {
      roulette.countdown -= 1;
      if (roulette.countdown <= 0) {
        roulette.phase = 'settled';
        roulette.countdown = 4;
        const winNum = roulette.winningNumber ?? 0;
        roulette.history = [winNum, ...roulette.history].slice(0, 16);

        const payouts = new Map<string, { playerName: string; wagered: number; payout: number }>();
        for (const b of roulette.bets) {
          const won = calculateRoulettePayout(b.betType, b.amount, winNum);
          const cur = payouts.get(b.playerId) || { playerName: b.playerName, wagered: 0, payout: 0 };
          cur.wagered += b.amount;
          cur.payout += won;
          payouts.set(b.playerId, cur);
        }
        for (const [playerId, summary] of payouts.entries()) {
          callbacks.onRouletteSettled({
            roundId: roulette.roundId,
            playerId,
            winningNumber: winNum,
            winningColor: roulette.winningColor || 'green',
            wagered: summary.wagered,
            payout: summary.payout,
          });
          if (summary.payout > 0) {
            pushLiveFeed({
              playerName: summary.playerName,
              game: 'Royal Roulette',
              betAmount: summary.wagered,
              multiplier: Number((summary.payout / Math.max(1, summary.wagered)).toFixed(2)),
              payout: summary.payout,
            });
          }
        }
      }
      emitRoulette();
    } else if (roulette.phase === 'settled') {
      roulette.countdown -= 1;
      if (roulette.countdown <= 0) {
        roulette.roundId += 1;
        roulette.phase = 'betting';
        roulette.countdown = 18;
        roulette.bets = [];
        roulette.winningNumber = null;
        roulette.winningColor = null;
      }
      emitRoulette();
    }
  }, 1000);

  return {
    sendEvent(type: string, rawPayload: unknown) {
      const payload = (rawPayload || {}) as Record<string, any>;
      if (type === 'auth:identify') {
        if (payload.playerId) activePlayerId = String(payload.playerId);
        emitPoker();
        return;
      }

      if (type === 'aviator:bet') {
        if (aviator.phase !== 'betting') return;
        const pid = String(payload.playerId || '');
        const amt = Number(payload.amount || 0);
        const auto = payload.autoCashout ? Number(payload.autoCashout) : null;
        if (!pid || !Number.isFinite(amt) || amt < 1 || amt > 50000) return;
        if (aviator.bets.some((b) => b.playerId === pid)) return;
        aviator.bets.push({
          playerId: pid,
          playerName: String(payload.playerName || 'Player').slice(0, 40),
          amount: Math.round(amt * 100) / 100,
          autoCashout: auto ? Math.round(auto * 100) / 100 : null,
          cashedOutAt: null,
          payout: 0,
        });
        emitAviator();
        return;
      }

      if (type === 'aviator:cashout') {
        if (aviator.phase !== 'flying') return;
        const pid = String(payload.playerId || '');
        const bet = aviator.bets.find((b) => b.playerId === pid && b.cashedOutAt === null);
        if (!bet) return;
        bet.cashedOutAt = aviator.multiplier;
        bet.payout = Math.round(bet.amount * aviator.multiplier * 100) / 100;
        callbacks.onAviatorCashout({
          roundId: aviator.roundId,
          playerId: bet.playerId,
          multiplier: bet.cashedOutAt,
          payout: bet.payout,
          betAmount: bet.amount,
        });
        pushLiveFeed({
          playerName: bet.playerName,
          game: 'Aviator Crash',
          betAmount: bet.amount,
          multiplier: bet.cashedOutAt,
          payout: bet.payout,
        });
        emitAviator();
        return;
      }

      if (type === 'roulette:bet') {
        if (roulette.phase !== 'betting') return;
        const pid = String(payload.playerId || '');
        const amt = Number(payload.amount || 0);
        const betType = String(payload.betType || '');
        if (!pid || !betType || !Number.isFinite(amt) || amt < 1 || amt > 50000) return;
        roulette.bets = [
          ...roulette.bets,
          {
            playerId: pid,
            playerName: String(payload.playerName || 'Player').slice(0, 40),
            betType,
            amount: Math.round(amt * 100) / 100,
          },
        ];
        emitRoulette();
        return;
      }

      if (type === 'poker:join') {
        const pid = String(payload.playerId || '');
        const buyIn = Math.floor(Number(payload.buyIn ?? 1000));
        if (!pid || !Number.isFinite(buyIn) || buyIn < 50 || buyIn > 10000) return;
        activePlayerId = pid;
        if (!poker.seats.some((s) => s.playerId === pid)) {
          poker.seats.push({
            seatIndex: 0,
            playerId: pid,
            playerName: String(payload.playerName || 'Player').slice(0, 40),
            chips: buyIn,
            bet: 0,
            totalBet: 0,
            folded: poker.phase !== 'waiting' && poker.phase !== 'showdown',
            allIn: false,
            cards: [],
            acted: false,
            isBot: false,
          });
        }
        emitPoker();
        return;
      }

      if (type === 'poker:leave') {
        const pid = String(payload.playerId || '');
        poker.seats = poker.seats.filter((s) => s.playerId !== pid);
        if (poker.seats.filter((s) => !s.isBot).length === 0) {
          poker.seats = [];
          poker.phase = 'waiting';
          poker.pot = 0;
          poker.communityCards = [];
        }
        emitPoker();
        return;
      }

      if (type === 'poker:start') {
        startPokerHand();
        return;
      }

      if (type === 'poker:action') {
        const pid = String(payload.playerId || '');
        const action = String(payload.action || '');
        const raiseAmount = Number(payload.raiseAmount ?? 50);
        const seat = poker.seats.find((s) => s.playerId === pid && s.seatIndex === poker.turnSeat);
        if (!seat || poker.phase === 'waiting' || poker.phase === 'showdown') return;
        const toCall = Math.max(0, poker.currentBet - seat.bet);
        if (action === 'fold') {
          seat.folded = true;
          seat.acted = true;
        } else if (action === 'check') {
          if (toCall > 0) return;
          seat.acted = true;
        } else if (action === 'call') {
          const pay = Math.min(seat.chips, toCall);
          seat.chips -= pay;
          seat.bet += pay;
          seat.totalBet += pay;
          poker.pot += pay;
          if (seat.chips === 0) seat.allIn = true;
          seat.acted = true;
        } else if (action === 'raise') {
          const add = Math.min(seat.chips, toCall + Math.floor(Math.max(10, Math.min(5000, raiseAmount))));
          seat.chips -= add;
          seat.bet += add;
          seat.totalBet += add;
          poker.pot += add;
          if (seat.bet > poker.currentBet) {
            poker.currentBet = seat.bet;
            for (const other of poker.seats) {
              if (other.playerId !== seat.playerId && !other.folded && !other.allIn) {
                other.acted = false;
              }
            }
          }
          if (seat.chips === 0) seat.allIn = true;
          seat.acted = true;
        }
        advancePokerTurn();
        return;
      }

      if (type === 'game:record_feed' && payload.playerName) {
        const betAmt = Number(payload.betAmount || 0);
        const mult = Number(payload.multiplier || 0);
        const payAmt = Number(payload.payout || 0);
        if (betAmt > 0 && mult >= 0 && payAmt >= 0) {
          pushLiveFeed({
            playerName: String(payload.playerName).slice(0, 40),
            game: String(payload.game || 'Casino').slice(0, 40),
            betAmount: Math.round(betAmt * 100) / 100,
            multiplier: Math.round(mult * 100) / 100,
            payout: Math.round(payAmt * 100) / 100,
          });
        }
      }
    },
    destroy() {
      destroyed = true;
      window.clearInterval(aviatorTimer);
      window.clearInterval(rouletteTimer);
      if (botTimer) window.clearTimeout(botTimer);
    },
  };
}
