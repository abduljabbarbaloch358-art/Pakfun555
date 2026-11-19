export type VipTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
export type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type PaymentMethod =
  | 'EasyPaisa'
  | 'JazzCash'
  | 'Local Bank Transfer'
  | 'UPI'
  | 'Net Banking'
  | 'Cryptocurrency';

export type GameId =
  | 'aviator'
  | 'wheel'
  | 'slots'
  | 'roulette'
  | 'poker'
  | 'chicken-road'
  | 'lucky-dice'
  | 'big-small'
  | 'teen-patti'
  | 'jili-cards'
  | 'cricket';
export type NavView = 'lobby' | 'games' | 'wallet' | 'rewards' | 'dashboard' | 'profile' | 'support' | 'admin';

export interface UserAccount {
  uid: string;
  displayName: string;
  balance: number;
  bonusBalance: number;
  vipTier: VipTier;
  vipPoints: number;
  totalWagered: number;
  totalDeposited: number;
  totalWithdrawn: number;
  referralCode: string;
  referredBy?: string;
  referralCount: number;
  referralEarnings: number;
  kycStatus: KycStatus;
  withdrawPasswordHash?: string;
  lastBetId?: string;
  lastDailyClaim?: string;
  streakDays: number;
  fraudScore: number;
  isFrozen: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface KycProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  documentType: 'CNIC' | 'Passport' | 'DrivingLicense' | 'Aadhaar';
  documentNumber: string;
  country: string;
  address: string;
  status: 'pending' | 'verified' | 'rejected';
  reviewNote?: string;
  submittedAt: any;
  updatedAt: any;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  type: 'deposit' | 'withdrawal' | 'bonus' | 'referral';
  method: PaymentMethod | 'Platform Reward';
  amount: number;
  fee: number;
  netAmount: number;
  currency: 'PKR' | 'INR' | 'USDT' | 'USD';
  accountDetails: string;
  referenceId: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  fraudFlag: boolean;
  adminNote?: string;
  createdAt: any;
  updatedAt: any;
}

export interface GameRecord {
  id: string;
  userId: string;
  userName: string;
  game: GameId;
  betAmount: number;
  multiplier: number;
  payout: number;
  profit: number;
  outcome: 'win' | 'loss' | 'cashout';
  details: string;
  createdAt: any;
}

export interface SupportMessage {
  sender: 'user' | 'agent';
  senderName: string;
  text: string;
  sentAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  category: 'Deposit' | 'Withdrawal' | 'KYC' | 'Game Issue' | 'Account Security';
  status: 'open' | 'in_progress' | 'resolved';
  messages: SupportMessage[];
  createdAt: any;
  updatedAt: any;
}

export interface FraudAlert {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'reviewed' | 'dismissed';
  details: string;
  createdAt: any;
  updatedAt: any;
}

export interface AviatorState {
  roundId: number;
  phase: 'betting' | 'flying' | 'crashed';
  countdown: number;
  multiplier: number;
  crashPoint: number | null;
  roundHash: string;
  bets: {
    playerId: string;
    playerName: string;
    amount: number;
    autoCashout: number | null;
    cashedOutAt: number | null;
    payout: number;
  }[];
  history: number[];
}

export interface RouletteState {
  roundId: number;
  phase: 'betting' | 'spinning' | 'settled';
  countdown: number;
  winningNumber: number | null;
  winningColor: 'red' | 'black' | 'green' | null;
  bets: {
    playerId: string;
    playerName: string;
    betType: string;
    amount: number;
  }[];
  history: number[];
}

export interface PokerCard {
  rank: string;
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs';
  value: number;
}

export interface PokerState {
  handId: number;
  phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  pot: number;
  currentBet: number;
  turnSeat: number;
  communityCards: PokerCard[];
  winnerSummary: string;
  winners: { playerId: string; playerName: string; payout: number; handLabel: string }[];
  seats: {
    seatIndex: number;
    playerId: string;
    playerName: string;
    chips: number;
    bet: number;
    totalBet: number;
    folded: boolean;
    allIn: boolean;
    acted: boolean;
    isBot: boolean;
    cards: PokerCard[];
  }[];
}

export interface LiveFeedItem {
  id: string;
  playerName: string;
  game: string;
  betAmount: number;
  multiplier: number;
  payout: number;
  timestamp: number;
}

export interface PaymentGatewaySettings {
  easypaisaAccount: string;
  jazzcashAccount: string;
  bankAccount: string;
  upiId: string;
  netBankingInfo: string;
  cryptoWallet: string;
  updatedAt?: any;
}
