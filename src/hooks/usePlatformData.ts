import { useEffect, useState, useCallback } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  limit,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  FraudAlert,
  GameId,
  GameRecord,
  KycProfile,
  PaymentGatewaySettings,
  PaymentMethod,
  SupportMessage,
  SupportTicket,
  Transaction,
  UserAccount,
} from '../types/platform';
import { computeVipTier, DAILY_REWARD_SCHEDULE, evaluateTransactionFraudRisk } from '../lib/vip';

const ADMIN_EMAIL = 'abduljabbarbaloch358@gmail.com';

export const DEFAULT_PAYMENT_GATEWAYS: PaymentGatewaySettings = {
  easypaisaAccount: '0345-8819204 (PAKFUN Merchant)',
  jazzcashAccount: '0301-7742190 (PAKFUN Digital)',
  bankAccount: 'PK42MEZN0002810104928172 (Meezan Bank)',
  upiId: 'pakfun.pay@icici',
  netBankingInfo: 'Gateway Session #NB-99412',
  cryptoWallet: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
};

function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const parsed = Date.parse(String(ts));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeReferralCode(uid: string): string {
  return `PK${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;
}

function normalizeMobileDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

function mobileToAuthEmail(digits: string): string {
  return `${digits}@mobile.pakfun.app`;
}

async function hashWithdrawPassword(uid: string, rawPassword: string): Promise<string> {
  const input = new TextEncoder().encode(`pakfun-wd:${uid}:${rawPassword}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function usePlatformData() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserAccount | null>(null);
  const [kycProfile, setKycProfile] = useState<KycProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  // Admin datasets
  const [isAdmin, setIsAdmin] = useState(false);
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allTickets, setAllTickets] = useState<SupportTicket[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [adminKycQueue, setAdminKycQueue] = useState<KycProfile[]>([]);
  const [allGameHistory, setAllGameHistory] = useState<GameRecord[]>([]);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGatewaySettings>(DEFAULT_PAYMENT_GATEWAYS);

  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast((prev) => (prev?.text === text ? null : prev)), 4200);
  }, []);

  // Auth state listener + automatic account bootstrap
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (!user) {
        setUserProfile(null);
        setKycProfile(null);
        setTransactions([]);
        setGameHistory([]);
        setSupportTickets([]);
        setIsAdmin(false);
        setAllUsers([]);
        setAllTransactions([]);
        setAllTickets([]);
        setFraudAlerts([]);
        setAdminKycQueue([]);
        setAllGameHistory([]);
        setAuthReady(true);
        return;
      }

      try {
        let adminFlag = user.email?.toLowerCase() === ADMIN_EMAIL && user.emailVerified;
        if (!adminFlag) {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) adminFlag = true;
        }
        setIsAdmin(adminFlag);

        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const emailPrefix = user.email?.split('@')[0] || 'Player';
          const cleanName = (user.displayName || emailPrefix || 'Player').slice(0, 64);
          const initialUser = {
            uid: user.uid,
            displayName: cleanName,
            balance: 0,
            bonusBalance: 100,
            vipTier: 'Bronze',
            vipPoints: 0,
            totalWagered: 0,
            totalDeposited: 0,
            totalWithdrawn: 0,
            referralCode: makeReferralCode(user.uid),
            referralCount: 0,
            referralEarnings: 0,
            kycStatus: 'unverified',
            streakDays: 0,
            fraudScore: 0,
            isFrozen: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, initialUser);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // User-scoped Firestore listeners
  useEffect(() => {
    if (!authReady || !authUser) return;

    const uid = authUser.uid;
    const unsubUser = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserAccount);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`),
    );

    const unsubKyc = onSnapshot(
      doc(db, 'users', uid, 'private', 'kyc'),
      (snap) => {
        setKycProfile(snap.exists() ? (snap.data() as KycProfile) : null);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}/private/kyc`),
    );

    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), where('userId', '==', uid), limit(100)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Transaction)
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'),
    );

    const unsubGames = onSnapshot(
      query(collection(db, 'gameHistory'), where('userId', '==', uid), limit(120)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as GameRecord)
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setGameHistory(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'gameHistory'),
    );

    const unsubTickets = onSnapshot(
      query(collection(db, 'supportTickets'), where('userId', '==', uid), limit(50)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as SupportTicket)
          .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
        setSupportTickets(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'supportTickets'),
    );

    const unsubGateways = onSnapshot(
      doc(db, 'platformSettings', 'paymentGateways'),
      (snap) => {
        if (snap.exists()) {
          setPaymentGateways(snap.data() as PaymentGatewaySettings);
        } else {
          setPaymentGateways(DEFAULT_PAYMENT_GATEWAYS);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'platformSettings/paymentGateways'),
    );

    return () => {
      unsubUser();
      unsubKyc();
      unsubTx();
      unsubGames();
      unsubTickets();
      unsubGateways();
    };
  }, [authReady, authUser]);

  // Admin-scoped listeners
  useEffect(() => {
    if (!authReady || !authUser || !isAdmin) return;

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), limit(150)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserAccount);
        setAllUsers(list);
        // Load private KYC profiles for pending/rejected/verified users
        Promise.all(
          list
            .filter((u) => u.kycStatus !== 'unverified')
            .map(async (u) => {
              try {
                const kycSnap = await getDoc(doc(db, 'users', u.uid, 'private', 'kyc'));
                return kycSnap.exists() ? (kycSnap.data() as KycProfile) : null;
              } catch {
                return null;
              }
            }),
        ).then((profiles) => {
          setAdminKycQueue(profiles.filter((p): p is KycProfile => p !== null));
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users'),
    );

    const unsubAllTx = onSnapshot(
      query(collection(db, 'transactions'), limit(200)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Transaction)
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setAllTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'),
    );

    const unsubAllTickets = onSnapshot(
      query(collection(db, 'supportTickets'), limit(100)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as SupportTicket)
          .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
        setAllTickets(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'supportTickets'),
    );

    const unsubFraud = onSnapshot(
      query(collection(db, 'fraudAlerts'), limit(100)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as FraudAlert)
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setFraudAlerts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'fraudAlerts'),
    );

    const unsubAllGames = onSnapshot(
      query(collection(db, 'gameHistory'), limit(200)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as GameRecord)
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setAllGameHistory(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'gameHistory'),
    );

    return () => {
      unsubUsers();
      unsubAllTx();
      unsubAllTickets();
      unsubFraud();
      unsubAllGames();
    };
  }, [authReady, authUser, isAdmin]);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('success', 'Signed in securely to PAKFUN.');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        showToast(
          'error',
          `Add "${host}" to Firebase Authentication -> Settings -> Authorized domains.`,
        );
        return;
      }
      showToast('error', err?.message || 'Sign in canceled.');
    }
  }, [showToast]);

  const signUpWithMobile = useCallback(
    async (mobile: string, password: string, displayName?: string): Promise<{ ok: boolean; error?: string }> => {
      const digits = normalizeMobileDigits(mobile);
      if (digits.length < 10 || digits.length > 15) {
        return { ok: false, error: 'Enter a valid 10-15 digit mobile number (e.g. 03001234567).' };
      }
      if (password.length < 6) {
        return { ok: false, error: 'Password must be at least 6 characters.' };
      }
      const cleanName = (displayName?.trim() || digits).slice(0, 64);
      try {
        const cred = await createUserWithEmailAndPassword(auth, mobileToAuthEmail(digits), password);
        await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
        // Sync preferred display name if bootstrap ran before updateProfile
        const userRef = doc(db, 'users', cred.user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && cleanName && snap.data()?.displayName !== cleanName) {
          await updateDoc(userRef, { displayName: cleanName, updatedAt: serverTimestamp() }).catch(() => {});
        }
        showToast('success', 'Account created! Welcome to PAKFUN.');
        return { ok: true };
      } catch (err: any) {
        const code = err?.code || '';
        if (code === 'auth/email-already-in-use') {
          return { ok: false, error: 'This mobile number is already registered. Please sign in.' };
        }
        if (code === 'auth/operation-not-allowed') {
          const msg =
            'Enable Email/Password in Firebase Console (Authentication -> Sign-in method) to allow Mobile + Password signup.';
          showToast('error', msg);
          return { ok: false, error: msg };
        }
        return { ok: false, error: err?.message || 'Could not create mobile account.' };
      }
    },
    [showToast],
  );

  const signInWithMobile = useCallback(
    async (mobile: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      const digits = normalizeMobileDigits(mobile);
      if (digits.length < 10 || digits.length > 15) {
        return { ok: false, error: 'Enter a valid 10-15 digit mobile number (e.g. 03001234567).' };
      }
      if (!password) {
        return { ok: false, error: 'Enter your password.' };
      }
      try {
        await signInWithEmailAndPassword(auth, mobileToAuthEmail(digits), password);
        showToast('success', 'Signed in securely to PAKFUN.');
        return { ok: true };
      } catch (err: any) {
        const code = err?.code || '';
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
          return { ok: false, error: 'Invalid mobile number or password.' };
        }
        if (code === 'auth/operation-not-allowed') {
          const msg =
            'Enable Email/Password in Firebase Console (Authentication -> Sign-in method) to allow Mobile + Password sign in.';
          showToast('error', msg);
          return { ok: false, error: msg };
        }
        return { ok: false, error: err?.message || 'Could not sign in.' };
      }
    },
    [showToast],
  );

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    showToast('info', 'Signed out of PAKFUN.');
  }, [showToast]);

  // Game settlement helper (updates wallet, VIP progression, and immutable gameHistory)
  const recordGamePlay = useCallback(
    async (params: {
      game: GameId;
      betAmount: number;
      multiplier: number;
      payout: number;
      outcome: 'win' | 'loss' | 'cashout';
      details: string;
    }) => {
      if (!authUser || !userProfile) {
        showToast('error', 'Please sign in first to play with your wallet.');
        return false;
      }
      if (userProfile.isFrozen) {
        showToast('error', 'Your account is frozen pending compliance review.');
        return false;
      }
      const bet = Math.round(params.betAmount * 100) / 100;
      const mult = Math.round(params.multiplier * 10000) / 10000;
      const payout = Math.round(params.payout * 100) / 100;
      const totalSpendable = userProfile.balance + userProfile.bonusBalance;

      if (!Number.isFinite(bet) || bet <= 0 || bet > 100000) {
        showToast('error', 'Invalid wager amount.');
        return false;
      }
      if (!Number.isFinite(mult) || mult < 0 || mult > 100) {
        showToast('error', 'Invalid game multiplier.');
        return false;
      }
      if (!Number.isFinite(payout) || payout < 0 || payout > bet * mult + bet * 0.02 + 1) {
        showToast('error', 'Invalid settlement payout.');
        return false;
      }
      if (bet > totalSpendable + 0.001) {
        showToast('error', 'Insufficient wallet balance for this wager.');
        return false;
      }

      // Deduct from main balance first, then bonusBalance
      let newBalance = userProfile.balance;
      let newBonus = userProfile.bonusBalance;
      if (newBalance >= bet) {
        newBalance -= bet;
      } else {
        const rem = bet - newBalance;
        newBalance = 0;
        newBonus = Math.max(0, newBonus - rem);
      }
      newBalance = Math.round((newBalance + payout) * 100) / 100;
      newBonus = Math.round(newBonus * 100) / 100;

      const newTotalWagered = Math.round((userProfile.totalWagered + bet) * 100) / 100;
      const newVipPoints = Math.round(userProfile.vipPoints + bet * 0.1);
      const nextVip = computeVipTier(newTotalWagered);
      const profit = Math.round((payout - bet) * 100) / 100;

      const betId = makeId('bet');
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', authUser.uid), {
          balance: newBalance,
          bonusBalance: newBonus,
          totalWagered: newTotalWagered,
          vipPoints: newVipPoints,
          vipTier: nextVip.tier,
          lastBetId: betId,
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'gameHistory', betId), {
          id: betId,
          userId: authUser.uid,
          userName: userProfile.displayName.slice(0, 64),
          game: params.game,
          betAmount: bet,
          multiplier: mult,
          payout,
          profit,
          outcome: params.outcome,
          details: params.details.slice(0, 240),
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'gameHistory');
      }
    },
    [authUser, userProfile, showToast],
  );

  const setWithdrawPassword = useCallback(
    async (newPassword: string, currentPassword?: string): Promise<{ ok: boolean; error?: string }> => {
      if (!authUser || !userProfile) {
        return { ok: false, error: 'Please sign in first.' };
      }
      const cleanNew = newPassword.trim();
      if (cleanNew.length < 4 || cleanNew.length > 24) {
        return { ok: false, error: 'Withdraw password must be 4 to 24 characters.' };
      }
      if (userProfile.withdrawPasswordHash) {
        const cleanCurrent = (currentPassword || '').trim();
        if (!cleanCurrent) {
          return { ok: false, error: 'Enter your current withdraw password first.' };
        }
        const curHash = await hashWithdrawPassword(authUser.uid, cleanCurrent);
        if (curHash !== userProfile.withdrawPasswordHash) {
          return { ok: false, error: 'Current withdraw password is incorrect.' };
        }
      }
      const nextHash = await hashWithdrawPassword(authUser.uid, cleanNew);
      try {
        await updateDoc(doc(db, 'users', authUser.uid), {
          withdrawPasswordHash: nextHash,
          updatedAt: serverTimestamp(),
        });
        showToast(
          'success',
          userProfile.withdrawPasswordHash
            ? 'Withdraw password updated successfully.'
            : 'Withdraw password set! Your payouts are now PIN-protected.',
        );
        return { ok: true };
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${authUser.uid}`);
        return { ok: false, error: 'Unable to save withdraw password.' };
      }
    },
    [authUser, userProfile, showToast],
  );

  // Submit Deposit or Withdrawal with Fraud Prevention & Withdraw Password checks
  const submitPaymentRequest = useCallback(
    async (params: {
      type: 'deposit' | 'withdrawal';
      method: PaymentMethod;
      amount: number;
      fee: number;
      netAmount: number;
      currency: 'PKR' | 'INR' | 'USDT' | 'USD';
      accountDetails: string;
      referenceId: string;
      withdrawPassword?: string;
    }) => {
      if (!authUser || !userProfile) return false;
      if (userProfile.isFrozen) {
        showToast('error', 'Account frozen. Contact 24/7 Support.');
        return false;
      }
      if (params.amount <= 0 || Number.isNaN(params.amount)) {
        showToast('error', 'Enter a valid payment amount.');
        return false;
      }
      if (params.type === 'deposit' && params.amount > 50000) {
        showToast('error', 'Maximum deposit limit is Rs 50,000 per transaction.');
        return false;
      }
      if (params.type === 'withdrawal') {
        if (params.amount > 100000) {
          showToast('error', 'Maximum withdrawal limit is Rs 100,000 per transaction.');
          return false;
        }
        if (params.amount > userProfile.balance) {
          showToast('error', 'Withdrawal amount exceeds available real-money balance.');
          return false;
        }
        if (!userProfile.withdrawPasswordHash) {
          showToast('error', 'Set a Withdraw Password first before requesting a withdrawal.');
          return false;
        }
        const cleanPin = (params.withdrawPassword || '').trim();
        if (!cleanPin) {
          showToast('error', 'Enter your Withdraw Password to confirm withdrawal.');
          return false;
        }
        const enteredHash = await hashWithdrawPassword(authUser.uid, cleanPin);
        if (enteredHash !== userProfile.withdrawPasswordHash) {
          showToast('error', 'Incorrect Withdraw Password. Please try again.');
          return false;
        }
      }

      const oneHourAgo = Date.now() - 3600_000;
      const recentCount = transactions.filter((t) => toMillis(t.createdAt) >= oneHourAgo).length;
      const risk = evaluateTransactionFraudRisk(userProfile, params.type, params.amount, recentCount);

      const txId = makeId('tx');
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'transactions', txId), {
          id: txId,
          userId: authUser.uid,
          userName: userProfile.displayName.slice(0, 64),
          type: params.type,
          method: params.method,
          amount: params.amount,
          fee: params.fee,
          netAmount: params.netAmount,
          currency: params.currency,
          accountDetails: params.accountDetails.slice(0, 160),
          referenceId: params.referenceId.slice(0, 80),
          status: 'pending',
          fraudFlag: risk.flagged,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Lock withdrawal funds immediately from user balance
        if (params.type === 'withdrawal') {
          batch.update(doc(db, 'users', authUser.uid), {
            balance: Math.round((userProfile.balance - params.amount) * 100) / 100,
            updatedAt: serverTimestamp(),
          });
        }

        if (risk.flagged) {
          const alertId = makeId('fa');
          batch.set(doc(db, 'fraudAlerts', alertId), {
            id: alertId,
            userId: authUser.uid,
            userName: userProfile.displayName.slice(0, 64),
            reason: risk.reason.slice(0, 200),
            severity: risk.severity,
            status: 'open',
            details: `${params.type.toUpperCase()} · ${params.method} · ${params.currency} ${params.amount} · Ref: ${params.referenceId}`.slice(0, 300),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        showToast(
          risk.flagged ? 'info' : 'success',
          risk.flagged
            ? 'Request submitted and queued for automated compliance verification.'
            : `${params.type === 'deposit' ? 'Deposit' : 'Withdrawal'} request submitted for processing.`,
        );
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `transactions/${txId}`);
      }
    },
    [authUser, userProfile, transactions, showToast],
  );

  // Claim Daily Reward
  const claimDailyReward = useCallback(async () => {
    if (!authUser || !userProfile) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (userProfile.lastDailyClaim === today) {
      showToast('info', 'Today’s daily streak reward has already been claimed.');
      return false;
    }

    const nextStreak = (userProfile.streakDays % 7) + 1;
    const vip = computeVipTier(userProfile.totalWagered);
    const reward = Math.round(DAILY_REWARD_SCHEDULE[nextStreak - 1] * vip.dailyMultiplier);
    const txId = makeId('tx');

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', authUser.uid), {
        bonusBalance: Math.round((userProfile.bonusBalance + reward) * 100) / 100,
        lastDailyClaim: today,
        streakDays: userProfile.streakDays + 1,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: authUser.uid,
        userName: userProfile.displayName.slice(0, 64),
        type: 'bonus',
        method: 'Platform Reward',
        amount: reward,
        fee: 0,
        netAmount: reward,
        currency: 'PKR',
        accountDetails: `Day ${nextStreak} Streak · ${vip.tier} VIP (${vip.dailyMultiplier}x)`,
        referenceId: `DAILY-${today}`,
        status: 'approved',
        fraudFlag: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      showToast('success', `Claimed Rs ${reward} Daily Streak Bonus!`);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${authUser.uid}`);
    }
  }, [authUser, userProfile, showToast]);

  // Apply Referral Code Bonus
  const applyReferralCode = useCallback(
    async (code: string) => {
      if (!authUser || !userProfile) return false;
      const clean = code.trim().toUpperCase();
      if (clean.length < 4 || clean.length > 24 || !/^[A-Z0-9_-]+$/.test(clean)) {
        showToast('error', 'Enter a valid referral code.');
        return false;
      }
      if (userProfile.referredBy) {
        showToast('info', 'A referral bonus has already been applied to your account.');
        return false;
      }
      if (clean === userProfile.referralCode) {
        showToast('error', 'You cannot use your own referral code.');
        return false;
      }

      const bonus = 250;
      const txId = makeId('tx');
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', authUser.uid), {
          referredBy: clean,
          bonusBalance: Math.round((userProfile.bonusBalance + bonus) * 100) / 100,
          referralEarnings: Math.round((userProfile.referralEarnings + bonus) * 100) / 100,
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'transactions', txId), {
          id: txId,
          userId: authUser.uid,
          userName: userProfile.displayName.slice(0, 64),
          type: 'referral',
          method: 'Platform Reward',
          amount: bonus,
          fee: 0,
          netAmount: bonus,
          currency: 'PKR',
          accountDetails: `Invite Code ${clean}`,
          referenceId: `REF-${clean}`,
          status: 'approved',
          fraudFlag: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        showToast('success', `Referral code ${clean} activated! Credited Rs ${bonus} bonus.`);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${authUser.uid}`);
      }
    },
    [authUser, userProfile, showToast],
  );

  // Submit KYC Verification (Atomic Split Collection write)
  const submitKyc = useCallback(
    async (payload: {
      fullName: string;
      phone: string;
      documentType: 'CNIC' | 'Passport' | 'DrivingLicense' | 'Aadhaar';
      documentNumber: string;
      country: string;
      address: string;
    }) => {
      if (!authUser || !userProfile) return false;
      const kycRef = doc(db, 'users', authUser.uid, 'private', 'kyc');
      const userRef = doc(db, 'users', authUser.uid);

      try {
        const existingSnap = await getDoc(kycRef);
        const batch = writeBatch(db);
        if (!existingSnap.exists()) {
          batch.set(kycRef, {
            uid: authUser.uid,
            fullName: payload.fullName.slice(0, 120),
            email: (authUser.email || 'user@pakfun.app').slice(0, 160),
            phone: payload.phone.slice(0, 32),
            documentType: payload.documentType,
            documentNumber: payload.documentNumber.slice(0, 48),
            country: payload.country.slice(0, 64),
            address: payload.address.slice(0, 240),
            status: 'pending',
            submittedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(kycRef, {
            fullName: payload.fullName.slice(0, 120),
            email: (authUser.email || 'user@pakfun.app').slice(0, 160),
            phone: payload.phone.slice(0, 32),
            documentType: payload.documentType,
            documentNumber: payload.documentNumber.slice(0, 48),
            country: payload.country.slice(0, 64),
            address: payload.address.slice(0, 240),
            status: 'pending',
            updatedAt: serverTimestamp(),
          });
        }
        batch.update(userRef, {
          kycStatus: 'pending',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        showToast('success', 'KYC identity dossier submitted for compliance review.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${authUser.uid}/private/kyc`);
      }
    },
    [authUser, userProfile, showToast],
  );

  // Create & Reply to 24/7 Support Tickets
  const createSupportTicket = useCallback(
    async (params: {
      subject: string;
      category: SupportTicket['category'];
      message: string;
    }) => {
      if (!authUser || !userProfile) return false;
      const ticketId = makeId('tkt');
      const firstMsg: SupportMessage = {
        sender: 'user',
        senderName: userProfile.displayName.slice(0, 64),
        text: params.message.slice(0, 500),
        sentAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'supportTickets', ticketId), {
          id: ticketId,
          userId: authUser.uid,
          userName: userProfile.displayName.slice(0, 64),
          subject: params.subject.slice(0, 120),
          category: params.category,
          status: 'open',
          messages: [firstMsg],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('success', 'Support ticket opened. Our 24/7 team is reviewing.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `supportTickets/${ticketId}`);
      }
    },
    [authUser, userProfile, showToast],
  );

  const replySupportTicket = useCallback(
    async (ticket: SupportTicket, text: string, asAgent = false, nextStatus?: SupportTicket['status']) => {
      if (!authUser || !userProfile) return false;
      const msg: SupportMessage = {
        sender: asAgent ? 'agent' : 'user',
        senderName: asAgent ? 'PAKFUN Support Desk' : userProfile.displayName.slice(0, 64),
        text: text.slice(0, 500),
        sentAt: new Date().toISOString(),
      };
      const updatedMsgs = [...ticket.messages, msg].slice(-50);
      try {
        const updatePayload: Record<string, any> = {
          messages: updatedMsgs,
          updatedAt: serverTimestamp(),
        };
        if (asAgent && nextStatus) {
          updatePayload.status = nextStatus;
        }
        await updateDoc(doc(db, 'supportTickets', ticket.id), updatePayload);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `supportTickets/${ticket.id}`);
      }
    },
    [authUser, userProfile],
  );

  // Admin Actions
  const adminProcessTransaction = useCallback(
    async (tx: Transaction, decision: 'approved' | 'rejected', note: string) => {
      if (!isAdmin) return false;
      const targetUser = allUsers.find((u) => u.uid === tx.userId);
      if (!targetUser) return false;

      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'transactions', tx.id), {
          status: decision,
          fraudFlag: decision === 'rejected' ? tx.fraudFlag : false,
          adminNote: note.slice(0, 300),
          updatedAt: serverTimestamp(),
        });

        // Credit approved deposit OR refund rejected withdrawal
        const creditPkr =
          tx.currency === 'USDT' || tx.currency === 'USD'
            ? Math.round(tx.netAmount * 278.5 * 100) / 100
            : tx.currency === 'INR'
              ? Math.round(tx.netAmount * 3.32 * 100) / 100
              : tx.netAmount;

        if (tx.type === 'deposit' && decision === 'approved' && tx.status === 'pending') {
          batch.update(doc(db, 'users', targetUser.uid), {
            balance: Math.round((targetUser.balance + creditPkr) * 100) / 100,
            totalDeposited: Math.round((targetUser.totalDeposited + creditPkr) * 100) / 100,
            updatedAt: serverTimestamp(),
          });
        } else if (tx.type === 'withdrawal' && decision === 'approved' && tx.status === 'pending') {
          batch.update(doc(db, 'users', targetUser.uid), {
            totalWithdrawn: Math.round((targetUser.totalWithdrawn + tx.amount) * 100) / 100,
            updatedAt: serverTimestamp(),
          });
        } else if (tx.type === 'withdrawal' && decision === 'rejected' && tx.status === 'pending') {
          batch.update(doc(db, 'users', targetUser.uid), {
            balance: Math.round((targetUser.balance + tx.amount) * 100) / 100,
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        showToast('success', `Transaction ${tx.id} marked as ${decision}.`);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `transactions/${tx.id}`);
      }
    },
    [isAdmin, allUsers, showToast],
  );

  const adminReviewKyc = useCallback(
    async (uid: string, decision: 'verified' | 'rejected', note: string) => {
      if (!isAdmin) return false;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', uid, 'private', 'kyc'), {
          status: decision,
          reviewNote: note.slice(0, 300),
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'users', uid), {
          kycStatus: decision,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        showToast('success', `KYC status updated to ${decision}.`);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/private/kyc`);
      }
    },
    [isAdmin, showToast],
  );

  const adminToggleFreezeUser = useCallback(
    async (user: UserAccount) => {
      if (!isAdmin) return false;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          isFrozen: !user.isFrozen,
          fraudScore: !user.isFrozen ? Math.max(user.fraudScore, 75) : 0,
          updatedAt: serverTimestamp(),
        });
        showToast('info', `${user.displayName} ${!user.isFrozen ? 'frozen' : 'unfrozen'}.`);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    },
    [isAdmin, showToast],
  );

  const adminUpdateFraudAlert = useCallback(
    async (alertId: string, status: 'reviewed' | 'dismissed') => {
      if (!isAdmin) return false;
      try {
        await updateDoc(doc(db, 'fraudAlerts', alertId), {
          status,
          updatedAt: serverTimestamp(),
        });
        showToast('success', `Fraud alert marked ${status}.`);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `fraudAlerts/${alertId}`);
      }
    },
    [isAdmin, showToast],
  );

  const adminAdjustUserBalance = useCallback(
    async (user: UserAccount, mainDelta: number, bonusDelta = 0) => {
      if (!isAdmin) return false;
      const nextBalance = Math.max(0, Math.min(100000000, Math.round((user.balance + mainDelta) * 100) / 100));
      const nextBonus = Math.max(0, Math.min(100000000, Math.round((user.bonusBalance + bonusDelta) * 100) / 100));
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          balance: nextBalance,
          bonusBalance: nextBonus,
          updatedAt: serverTimestamp(),
        });
        showToast('success', `Updated ${user.displayName}'s wallet balance.`);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    },
    [isAdmin, showToast],
  );

  const adminUpdatePaymentGateways = useCallback(
    async (settings: PaymentGatewaySettings) => {
      if (!isAdmin) return false;
      const clean = (val: string, fallback: string) => {
        const trimmed = val.trim().slice(0, 160);
        return trimmed.length >= 3 ? trimmed : fallback;
      };
      try {
        await setDoc(doc(db, 'platformSettings', 'paymentGateways'), {
          easypaisaAccount: clean(settings.easypaisaAccount, DEFAULT_PAYMENT_GATEWAYS.easypaisaAccount),
          jazzcashAccount: clean(settings.jazzcashAccount, DEFAULT_PAYMENT_GATEWAYS.jazzcashAccount),
          bankAccount: clean(settings.bankAccount, DEFAULT_PAYMENT_GATEWAYS.bankAccount),
          upiId: clean(settings.upiId, DEFAULT_PAYMENT_GATEWAYS.upiId),
          netBankingInfo: clean(settings.netBankingInfo, DEFAULT_PAYMENT_GATEWAYS.netBankingInfo),
          cryptoWallet: clean(settings.cryptoWallet, DEFAULT_PAYMENT_GATEWAYS.cryptoWallet),
          updatedAt: serverTimestamp(),
        });
        showToast('success', 'Receiving payment accounts updated for all players.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'platformSettings/paymentGateways');
      }
    },
    [isAdmin, showToast],
  );

  return {
    authUser,
    authReady,
    userProfile,
    kycProfile,
    transactions,
    gameHistory,
    supportTickets,
    isAdmin,
    allUsers,
    allTransactions,
    allTickets,
    fraudAlerts,
    adminKycQueue,
    allGameHistory,
    paymentGateways,
    toast,
    showToast,
    signInWithGoogle,
    signUpWithMobile,
    signInWithMobile,
    signOutUser,
    setWithdrawPassword,
    recordGamePlay,
    submitPaymentRequest,
    claimDailyReward,
    applyReferralCode,
    submitKyc,
    createSupportTicket,
    replySupportTicket,
    adminProcessTransaction,
    adminReviewKyc,
    adminToggleFreezeUser,
    adminUpdateFraudAlert,
    adminAdjustUserBalance,
    adminUpdatePaymentGateways,
  };
}
