import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

// ---------- Authoritative Multiplayer State ----------

interface AviatorBet {
  playerId: string;
  playerName: string;
  amount: number;
  autoCashout: number | null;
  cashedOutAt: number | null;
  payout: number;
}

interface RouletteBet {
  playerId: string;
  playerName: string;
  betType: string; // e.g., 'number:17', 'red', 'black', 'even', 'odd', '1st12', '2nd12', '3rd12'
  amount: number;
}

interface PokerCard {
  rank: string;
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs';
  value: number;
}

interface PokerSeat {
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

interface LiveFeedItem {
  id: string;
  playerName: string;
  game: string;
  betAmount: number;
  multiplier: number;
  payout: number;
  timestamp: number;
}

const liveFeed: LiveFeedItem[] = [];

function pushLiveFeed(item: Omit<LiveFeedItem, 'id' | 'timestamp'>) {
  const entry: LiveFeedItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  liveFeed.unshift(entry);
  if (liveFeed.length > 30) liveFeed.pop();
  broadcastAll({ type: 'live:feed_item', payload: entry });
}

// ---------- Aviator Crash Engine ----------
const aviatorState = {
  roundId: 1001,
  phase: 'betting' as 'betting' | 'flying' | 'crashed',
  countdown: 7,
  multiplier: 1.0,
  crashPoint: 2.45,
  roundHash: '',
  startedAt: Date.now(),
  bets: [] as AviatorBet[],
  history: [1.84, 3.42, 1.12, 7.65, 2.09, 1.45, 14.2, 2.88, 1.04, 4.15] as number[],
};

function generateCrashPoint(): { crashPoint: number; hash: string } {
  const bytes = crypto.randomBytes(4);
  const intVal = bytes.readUInt32BE(0);
  const r = intVal / 0xffffffff;
  // ~4% instant 1.00x house edge, otherwise pareto distribution capped at 50x
  let crashPoint = 1.0;
  if (r >= 0.04) {
    crashPoint = Math.min(50, Math.max(1.01, Math.floor((0.96 / (1 - r)) * 100) / 100));
  }
  const hash = crypto.createHash('sha256').update(`${aviatorState.roundId}:${crashPoint}:${intVal}`).digest('hex').slice(0, 16);
  return { crashPoint, hash };
}

function startAviatorBetting() {
  aviatorState.roundId += 1;
  aviatorState.phase = 'betting';
  aviatorState.countdown = 7;
  aviatorState.multiplier = 1.0;
  aviatorState.bets = [];
  const { crashPoint, hash } = generateCrashPoint();
  aviatorState.crashPoint = crashPoint;
  aviatorState.roundHash = hash;
  aviatorState.startedAt = Date.now();
  broadcastAll({
    type: 'aviator:state',
    payload: getPublicAviatorState(),
  });
}

function getPublicAviatorState() {
  return {
    roundId: aviatorState.roundId,
    phase: aviatorState.phase,
    countdown: aviatorState.countdown,
    multiplier: aviatorState.multiplier,
    crashPoint: aviatorState.phase === 'crashed' ? aviatorState.crashPoint : null,
    roundHash: aviatorState.roundHash,
    bets: aviatorState.bets,
    history: aviatorState.history,
  };
}

// ---------- Multiplayer Roulette Engine ----------
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const rouletteState = {
  roundId: 501,
  phase: 'betting' as 'betting' | 'spinning' | 'settled',
  countdown: 18,
  winningNumber: null as number | null,
  winningColor: null as 'red' | 'black' | 'green' | null,
  bets: [] as RouletteBet[],
  history: [17, 0, 32, 8, 23, 14, 36, 5, 11, 29] as number[],
};

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

// ---------- Multiplayer Texas Hold'em Poker Engine ----------
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

function createShuffledDeck(): PokerCard[] {
  const deck: PokerCard[] = [];
  for (const suit of SUITS) {
    for (const r of RANKS) {
      deck.push({ rank: r.rank, suit, value: r.value });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function evaluateHandScore(cards: PokerCard[]): { score: number; label: string } {
  // Evaluate best 5-card combination out of up to 7 cards
  const combos: PokerCard[][] = [];
  const n = cards.length;
  if (n < 5) {
    const high = Math.max(...cards.map((c) => c.value), 0);
    return { score: high, label: 'High Card' };
  }
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            combos.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
          }
        }
      }
    }
  }
  let best = { score: 0, label: 'High Card' };
  for (const hand of combos) {
    const res = scoreFiveCardHand(hand);
    if (res.score > best.score) best = res;
  }
  return best;
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

const pokerState = {
  handId: 1,
  phase: 'waiting' as 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown',
  pot: 0,
  currentBet: 0,
  turnSeat: -1,
  communityCards: [] as PokerCard[],
  deck: [] as PokerCard[],
  seats: [] as PokerSeat[],
  winnerSummary: '' as string,
  winners: [] as { playerId: string; playerName: string; payout: number; handLabel: string }[],
};

function getPublicPokerState(viewerPlayerId?: string) {
  return {
    handId: pokerState.handId,
    phase: pokerState.phase,
    pot: pokerState.pot,
    currentBet: pokerState.currentBet,
    turnSeat: pokerState.turnSeat,
    communityCards: pokerState.communityCards,
    winnerSummary: pokerState.winnerSummary,
    winners: pokerState.winners,
    seats: pokerState.seats.map((s) => ({
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
        pokerState.phase === 'showdown' || s.playerId === viewerPlayerId
          ? s.cards
          : s.cards.map(() => ({ rank: '?', suit: 'spades' as const, value: 0 })),
    })),
  };
}

function advancePokerTurn() {
  const active = pokerState.seats.filter((s) => !s.folded);
  if (active.length <= 1) {
    resolvePokerShowdown();
    return;
  }

  const allActedAndMatched = active.every((s) => (s.acted && s.bet === pokerState.currentBet) || s.allIn);
  if (allActedAndMatched) {
    // Advance street
    for (const s of pokerState.seats) {
      s.bet = 0;
      s.acted = false;
    }
    pokerState.currentBet = 0;
    if (pokerState.phase === 'preflop') {
      pokerState.phase = 'flop';
      pokerState.communityCards.push(pokerState.deck.pop()!, pokerState.deck.pop()!, pokerState.deck.pop()!);
    } else if (pokerState.phase === 'flop') {
      pokerState.phase = 'turn';
      pokerState.communityCards.push(pokerState.deck.pop()!);
    } else if (pokerState.phase === 'turn') {
      pokerState.phase = 'river';
      pokerState.communityCards.push(pokerState.deck.pop()!);
    } else if (pokerState.phase === 'river') {
      resolvePokerShowdown();
      return;
    }
    const firstActive = pokerState.seats.find((s) => !s.folded && !s.allIn);
    pokerState.turnSeat = firstActive ? firstActive.seatIndex : -1;
    broadcastPokerPerViewer();
    maybeTriggerDealerTurn();
    return;
  }

  // Find next active seat after current turnSeat
  const ordered = pokerState.seats.map((s) => s.seatIndex);
  const startIdx = ordered.indexOf(pokerState.turnSeat);
  for (let offset = 1; offset <= ordered.length; offset++) {
    const candidate = pokerState.seats[(startIdx + offset) % ordered.length];
    if (!candidate.folded && !candidate.allIn && (!candidate.acted || candidate.bet < pokerState.currentBet)) {
      pokerState.turnSeat = candidate.seatIndex;
      broadcastPokerPerViewer();
      maybeTriggerDealerTurn();
      return;
    }
  }
  resolvePokerShowdown();
}

function maybeTriggerDealerTurn() {
  const current = pokerState.seats.find((s) => s.seatIndex === pokerState.turnSeat);
  if (current && current.isBot && pokerState.phase !== 'waiting' && pokerState.phase !== 'showdown') {
    setTimeout(() => {
      const seat = pokerState.seats.find((s) => s.seatIndex === pokerState.turnSeat && s.isBot);
      if (!seat) return;
      const toCall = Math.max(0, pokerState.currentBet - seat.bet);
      const handEval = evaluateHandScore([...seat.cards, ...pokerState.communityCards]);
      if (toCall > 0 && handEval.score < 500_000 && toCall > seat.chips * 0.4) {
        seat.folded = true;
        seat.acted = true;
      } else if (toCall > 0) {
        const pay = Math.min(seat.chips, toCall);
        seat.chips -= pay;
        seat.bet += pay;
        seat.totalBet += pay;
        pokerState.pot += pay;
        if (seat.chips === 0) seat.allIn = true;
        seat.acted = true;
      } else if (handEval.score >= 1_000_000 && seat.chips >= 50 && pokerState.currentBet === 0) {
        const raiseAmt = Math.min(seat.chips, 50);
        seat.chips -= raiseAmt;
        seat.bet += raiseAmt;
        seat.totalBet += raiseAmt;
        pokerState.currentBet = seat.bet;
        pokerState.pot += raiseAmt;
        seat.acted = true;
      } else {
        seat.acted = true;
      }
      advancePokerTurn();
    }, 850);
  }
}

function resolvePokerShowdown() {
  pokerState.phase = 'showdown';
  pokerState.turnSeat = -1;
  const active = pokerState.seats.filter((s) => !s.folded);

  if (active.length === 1) {
    const winner = active[0];
    winner.chips += pokerState.pot;
    pokerState.winners = [
      { playerId: winner.playerId, playerName: winner.playerName, payout: pokerState.pot, handLabel: 'Opponents Folded' },
    ];
    pokerState.winnerSummary = `${winner.playerName} wins Rs ${pokerState.pot.toFixed(0)} (Opponents Folded)`;
    if (!winner.isBot && pokerState.pot > 0) {
      pushLiveFeed({
        playerName: winner.playerName,
        game: 'Texas Poker',
        betAmount: winner.totalBet || 50,
        multiplier: Number((pokerState.pot / Math.max(1, winner.totalBet || 50)).toFixed(2)),
        payout: pokerState.pot,
      });
    }
  } else {
    let bestScore = -1;
    let bestPlayers: { seat: PokerSeat; label: string }[] = [];
    for (const s of active) {
      const evaluated = evaluateHandScore([...s.cards, ...pokerState.communityCards]);
      if (evaluated.score > bestScore) {
        bestScore = evaluated.score;
        bestPlayers = [{ seat: s, label: evaluated.label }];
      } else if (evaluated.score === bestScore) {
        bestPlayers.push({ seat: s, label: evaluated.label });
      }
    }
    const splitPayout = Math.floor(pokerState.pot / Math.max(1, bestPlayers.length));
    pokerState.winners = bestPlayers.map(({ seat, label }) => {
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
    pokerState.winnerSummary = bestPlayers.map((w) => `${w.seat.playerName} (${w.label})`).join(' & ') + ` won Rs ${pokerState.pot.toFixed(0)}`;
  }

  broadcastPokerPerViewer();
}

function startPokerHand() {
  const humanSeats = pokerState.seats.filter((s) => !s.isBot && s.chips >= 20);
  if (humanSeats.length === 0) return;

  // Ensure House Dealer seat is available if only 1 human is playing
  pokerState.seats = pokerState.seats.filter((s) => !s.isBot);
  if (pokerState.seats.length === 1) {
    pokerState.seats.push({
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

  pokerState.handId += 1;
  pokerState.phase = 'preflop';
  pokerState.deck = createShuffledDeck();
  pokerState.communityCards = [];
  pokerState.pot = 0;
  pokerState.currentBet = 20;
  pokerState.winnerSummary = '';
  pokerState.winners = [];

  for (const s of pokerState.seats) {
    const ante = Math.min(s.chips, 20);
    s.chips -= ante;
    s.bet = ante;
    s.totalBet = ante;
    pokerState.pot += ante;
    s.folded = false;
    s.allIn = s.chips === 0;
    s.acted = false;
    s.cards = [pokerState.deck.pop()!, pokerState.deck.pop()!];
  }

  const firstHuman = pokerState.seats.find((s) => !s.isBot && !s.allIn);
  pokerState.turnSeat = firstHuman ? firstHuman.seatIndex : pokerState.seats[0].seatIndex;
  broadcastPokerPerViewer();
  maybeTriggerDealerTurn();
}

// ---------- WebSocket Setup & Broadcasting ----------
const clientMeta = new WeakMap<WebSocket, { playerId?: string; playerName?: string }>();
let wss: WebSocketServer;

function broadcastAll(data: unknown) {
  if (!wss) return;
  const raw = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  }
}

function broadcastPokerPerViewer() {
  if (!wss) return;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      const meta = clientMeta.get(client);
      client.send(
        JSON.stringify({
          type: 'poker:state',
          payload: getPublicPokerState(meta?.playerId),
        }),
      );
    }
  }
}

function broadcastPresence() {
  const onlineCount = wss ? wss.clients.size : 0;
  broadcastAll({ type: 'presence:count', payload: { onlineCount } });
}

// ---------- Express + HTTP + Vite Middleware ----------
async function bootstrap() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, onlinePlayers: wss ? wss.clients.size : 0, aviatorRound: aviatorState.roundId });
  });

  app.post('/api/gateway/checkout', (req, res) => {
    const { method, amount, currency = 'PKR', type = 'deposit' } = req.body || {};
    const numAmount = Number(amount || 0);
    if (!method || !Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Invalid payment amount or gateway method.' });
      return;
    }
    if (type === 'deposit' && numAmount > 50000) {
      res.status(400).json({ error: 'Maximum deposit limit is 50,000 per transaction.' });
      return;
    }
    if (type === 'withdrawal' && numAmount > 100000) {
      res.status(400).json({ error: 'Maximum withdrawal limit is 100,000 per transaction.' });
      return;
    }

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

    const gatewayInstructions: Record<string, { label: string; destination: string; note: string }> = {
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

    res.json({
      method,
      type,
      currency,
      amount: numAmount,
      fee,
      netAmount,
      pkrEquivalent,
      gatewayRef: `PG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      instructions: gatewayInstructions[method] || gatewayInstructions.EasyPaisa,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  wss = new WebSocketServer({ server, path: '/ws' });

  const wsRateLimiter = new WeakMap<WebSocket, { count: number; windowStart: number }>();

  wss.on('connection', (ws) => {
    clientMeta.set(ws, {});
    wsRateLimiter.set(ws, { count: 0, windowStart: Date.now() });
    broadcastPresence();

    // Send initial authoritative snapshots
    ws.send(
      JSON.stringify({
        type: 'init',
        payload: {
          aviator: getPublicAviatorState(),
          roulette: rouletteState,
          poker: getPublicPokerState(),
          liveFeed,
          onlineCount: wss.clients.size,
        },
      }),
    );

    ws.on('message', (rawMsg) => {
      try {
        const rawStr = rawMsg.toString();
        if (rawStr.length > 4096) return;

        const now = Date.now();
        const rl = wsRateLimiter.get(ws) || { count: 0, windowStart: now };
        if (now - rl.windowStart > 5000) {
          rl.count = 1;
          rl.windowStart = now;
        } else {
          rl.count += 1;
        }
        wsRateLimiter.set(ws, rl);
        if (rl.count > 40) {
          ws.send(JSON.stringify({ type: 'error', payload: 'Rate limit exceeded. Slow down requests.' }));
          return;
        }

        const msg = JSON.parse(rawStr);
        const { type, payload } = msg;
        const safeName = (v: unknown) => String(v || 'Player').trim().slice(0, 40) || 'Player';
        const safeId = (v: unknown) => {
          const s = String(v || '').trim();
          return /^[a-zA-Z0-9_-]{1,128}$/.test(s) ? s : null;
        };

        if (type === 'auth:identify') {
          const pid = safeId(payload?.playerId);
          if (!pid) return;
          clientMeta.set(ws, {
            playerId: pid,
            playerName: safeName(payload?.playerName),
          });
          ws.send(JSON.stringify({ type: 'poker:state', payload: getPublicPokerState(pid) }));
          return;
        }

        if (type === 'aviator:bet') {
          if (aviatorState.phase !== 'betting') {
            ws.send(JSON.stringify({ type: 'error', payload: 'Aviator betting closed for current flight.' }));
            return;
          }
          const pid = safeId(payload?.playerId);
          const amt = Number(payload?.amount);
          const auto = payload?.autoCashout ? Number(payload.autoCashout) : null;
          if (!pid || !Number.isFinite(amt) || amt < 1 || amt > 50000) return;
          if (auto !== null && (!Number.isFinite(auto) || auto < 1.01 || auto > 100)) return;
          if (aviatorState.bets.some((b) => b.playerId === pid)) return;

          aviatorState.bets.push({
            playerId: pid,
            playerName: safeName(payload?.playerName),
            amount: Math.round(amt * 100) / 100,
            autoCashout: auto ? Math.round(auto * 100) / 100 : null,
            cashedOutAt: null,
            payout: 0,
          });
          broadcastAll({ type: 'aviator:state', payload: getPublicAviatorState() });
          return;
        }

        if (type === 'aviator:cashout') {
          if (aviatorState.phase !== 'flying') return;
          const pid = safeId(payload?.playerId);
          if (!pid) return;
          const bet = aviatorState.bets.find((b) => b.playerId === pid && b.cashedOutAt === null);
          if (!bet) return;

          bet.cashedOutAt = aviatorState.multiplier;
          bet.payout = Math.round(bet.amount * aviatorState.multiplier * 100) / 100;
          broadcastAll({
            type: 'aviator:cashed_out',
            payload: {
              roundId: aviatorState.roundId,
              playerId: bet.playerId,
              multiplier: bet.cashedOutAt,
              payout: bet.payout,
              betAmount: bet.amount,
            },
          });
          pushLiveFeed({
            playerName: bet.playerName,
            game: 'Aviator Crash',
            betAmount: bet.amount,
            multiplier: bet.cashedOutAt,
            payout: bet.payout,
          });
          broadcastAll({ type: 'aviator:state', payload: getPublicAviatorState() });
          return;
        }

        if (type === 'roulette:bet') {
          if (rouletteState.phase !== 'betting') {
            ws.send(JSON.stringify({ type: 'error', payload: 'Roulette bets locked while wheel spins.' }));
            return;
          }
          const pid = safeId(payload?.playerId);
          const amt = Number(payload?.amount);
          const betType = String(payload?.betType || '');
          const validBetType =
            ['red', 'black', 'even', 'odd', '1st12', '2nd12', '3rd12'].includes(betType) ||
            (/^number:([0-9]|[12][0-9]|3[0-6])$/.test(betType));
          if (!pid || !validBetType || !Number.isFinite(amt) || amt < 1 || amt > 50000) return;
          rouletteState.bets.push({
            playerId: pid,
            playerName: safeName(payload?.playerName),
            betType,
            amount: Math.round(amt * 100) / 100,
          });
          broadcastAll({ type: 'roulette:state', payload: rouletteState });
          return;
        }

        if (type === 'poker:join') {
          const pid = safeId(payload?.playerId);
          const rawBuyIn = Number(payload?.buyIn ?? 1000);
          if (!pid || !Number.isFinite(rawBuyIn) || rawBuyIn < 50 || rawBuyIn > 10000) return;
          const buyIn = Math.floor(rawBuyIn);
          const pname = safeName(payload?.playerName);
          clientMeta.set(ws, { playerId: pid, playerName: pname });
          const existingSeat = pokerState.seats.find((s) => s.playerId === pid);
          if (!existingSeat && pokerState.seats.filter((s) => !s.isBot).length < 4) {
            const usedSeats = new Set(pokerState.seats.map((s) => s.seatIndex));
            let seatIdx = 0;
            while (usedSeats.has(seatIdx)) seatIdx++;
            pokerState.seats.push({
              seatIndex: seatIdx,
              playerId: pid,
              playerName: pname,
              chips: buyIn,
              bet: 0,
              totalBet: 0,
              folded: pokerState.phase !== 'waiting' && pokerState.phase !== 'showdown',
              allIn: false,
              cards: [],
              acted: false,
              isBot: false,
            });
          }
          broadcastPokerPerViewer();
          return;
        }

        if (type === 'poker:leave') {
          const pid = safeId(payload?.playerId);
          if (!pid) return;
          pokerState.seats = pokerState.seats.filter((s) => s.playerId !== pid);
          if (pokerState.seats.filter((s) => !s.isBot).length === 0) {
            pokerState.seats = [];
            pokerState.phase = 'waiting';
            pokerState.pot = 0;
            pokerState.communityCards = [];
          }
          broadcastPokerPerViewer();
          return;
        }

        if (type === 'poker:start') {
          startPokerHand();
          return;
        }

        if (type === 'poker:action') {
          const pid = safeId(payload?.playerId);
          const action = String(payload?.action || '');
          const raiseAmount = Number(payload?.raiseAmount ?? 50);
          if (!pid || !['fold', 'check', 'call', 'raise'].includes(action)) return;
          if (!Number.isFinite(raiseAmount) || raiseAmount < 10 || raiseAmount > 5000) return;
          const seat = pokerState.seats.find((s) => s.playerId === pid && s.seatIndex === pokerState.turnSeat);
          if (!seat || pokerState.phase === 'waiting' || pokerState.phase === 'showdown') return;

          const toCall = Math.max(0, pokerState.currentBet - seat.bet);
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
            pokerState.pot += pay;
            if (seat.chips === 0) seat.allIn = true;
            seat.acted = true;
          } else if (action === 'raise') {
            const add = Math.min(seat.chips, toCall + Math.floor(raiseAmount));
            seat.chips -= add;
            seat.bet += add;
            seat.totalBet += add;
            pokerState.pot += add;
            if (seat.bet > pokerState.currentBet) {
              pokerState.currentBet = seat.bet;
              for (const other of pokerState.seats) {
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

        if (type === 'game:record_feed' && payload?.playerName) {
          const betAmt = Number(payload.betAmount || 0);
          const mult = Number(payload.multiplier || 0);
          const payAmt = Number(payload.payout || 0);
          if (
            !Number.isFinite(betAmt) || betAmt <= 0 || betAmt > 100000 ||
            !Number.isFinite(mult) || mult < 0 || mult > 100 ||
            !Number.isFinite(payAmt) || payAmt < 0 || payAmt > betAmt * mult + betAmt * 0.02 + 1
          ) {
            return;
          }
          pushLiveFeed({
            playerName: safeName(payload.playerName),
            game: String(payload.game || 'Casino').slice(0, 40),
            betAmount: Math.round(betAmt * 100) / 100,
            multiplier: Math.round(mult * 100) / 100,
            payout: Math.round(payAmt * 100) / 100,
          });
        }
      } catch {
        // Ignore malformed WS frames
      }
    });

    ws.on('close', () => {
      broadcastPresence();
    });
  });

  // Start Aviator loop (60ms tick)
  startAviatorBetting();
  setInterval(() => {
    if (aviatorState.phase === 'betting') {
      const elapsedSec = (Date.now() - aviatorState.startedAt) / 1000;
      const remaining = Math.max(0, Math.ceil(7 - elapsedSec));
      if (remaining !== aviatorState.countdown) {
        aviatorState.countdown = remaining;
        broadcastAll({ type: 'aviator:state', payload: getPublicAviatorState() });
      }
      if (elapsedSec >= 7) {
        aviatorState.phase = 'flying';
        aviatorState.startedAt = Date.now();
        aviatorState.multiplier = 1.0;
        broadcastAll({ type: 'aviator:state', payload: getPublicAviatorState() });
      }
    } else if (aviatorState.phase === 'flying') {
      const elapsedSec = (Date.now() - aviatorState.startedAt) / 1000;
      const mult = Math.floor(Math.exp(0.085 * elapsedSec) * 100) / 100;
      aviatorState.multiplier = mult;

      // Auto-cashouts
      for (const bet of aviatorState.bets) {
        if (bet.cashedOutAt === null && bet.autoCashout && mult >= bet.autoCashout && mult < aviatorState.crashPoint) {
          bet.cashedOutAt = bet.autoCashout;
          bet.payout = Math.round(bet.amount * bet.autoCashout * 100) / 100;
          broadcastAll({
            type: 'aviator:cashed_out',
            payload: {
              roundId: aviatorState.roundId,
              playerId: bet.playerId,
              multiplier: bet.cashedOutAt,
              payout: bet.payout,
              betAmount: bet.amount,
            },
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

      if (mult >= aviatorState.crashPoint) {
        aviatorState.phase = 'crashed';
        aviatorState.multiplier = aviatorState.crashPoint;
        aviatorState.startedAt = Date.now();
        aviatorState.history.unshift(aviatorState.crashPoint);
        if (aviatorState.history.length > 18) aviatorState.history.pop();
        broadcastAll({ type: 'aviator:state', payload: getPublicAviatorState() });
      } else {
        broadcastAll({
          type: 'aviator:tick',
          payload: { multiplier: mult, elapsed: elapsedSec },
        });
      }
    } else if (aviatorState.phase === 'crashed') {
      const elapsedSec = (Date.now() - aviatorState.startedAt) / 1000;
      if (elapsedSec >= 3.5) {
        startAviatorBetting();
      }
    }
  }, 60);

  // Start Roulette loop (1s tick)
  setInterval(() => {
    if (rouletteState.phase === 'betting') {
      rouletteState.countdown -= 1;
      if (rouletteState.countdown <= 0) {
        rouletteState.phase = 'spinning';
        rouletteState.countdown = 5;
        rouletteState.winningNumber = crypto.randomInt(0, 37);
        rouletteState.winningColor = getRouletteColor(rouletteState.winningNumber);
      }
      broadcastAll({ type: 'roulette:state', payload: rouletteState });
    } else if (rouletteState.phase === 'spinning') {
      rouletteState.countdown -= 1;
      if (rouletteState.countdown <= 0) {
        rouletteState.phase = 'settled';
        rouletteState.countdown = 4;
        const winNum = rouletteState.winningNumber ?? 0;
        rouletteState.history.unshift(winNum);
        if (rouletteState.history.length > 16) rouletteState.history.pop();

        // Group payouts by player
        const payouts = new Map<string, { playerName: string; wagered: number; payout: number }>();
        for (const b of rouletteState.bets) {
          const won = calculateRoulettePayout(b.betType, b.amount, winNum);
          const cur = payouts.get(b.playerId) || { playerName: b.playerName, wagered: 0, payout: 0 };
          cur.wagered += b.amount;
          cur.payout += won;
          payouts.set(b.playerId, cur);
        }
        for (const [playerId, summary] of payouts.entries()) {
          broadcastAll({
            type: 'roulette:settled',
            payload: {
              roundId: rouletteState.roundId,
              playerId,
              winningNumber: winNum,
              winningColor: rouletteState.winningColor,
              wagered: summary.wagered,
              payout: summary.payout,
            },
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
      broadcastAll({ type: 'roulette:state', payload: rouletteState });
    } else if (rouletteState.phase === 'settled') {
      rouletteState.countdown -= 1;
      if (rouletteState.countdown <= 0) {
        rouletteState.roundId += 1;
        rouletteState.phase = 'betting';
        rouletteState.countdown = 18;
        rouletteState.bets = [];
        rouletteState.winningNumber = null;
        rouletteState.winningColor = null;
      }
      broadcastAll({ type: 'roulette:state', payload: rouletteState });
    }
  }, 1000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PAKFUN server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap();
