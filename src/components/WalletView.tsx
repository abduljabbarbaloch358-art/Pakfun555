import { useEffect, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Copy,
  Check,
  ShieldAlert,
  Landmark,
  Smartphone,
  Coins,
  Globe,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { PaymentGatewaySettings, PaymentMethod, Transaction, UserAccount } from '../types/platform';
import { formatRs } from '../lib/vip';
import { buildLocalGatewayQuote } from '../lib/localTableEngine';

interface Props {
  userProfile: UserAccount | null;
  transactions: Transaction[];
  paymentGateways: PaymentGatewaySettings;
  initialTab?: 'deposit' | 'withdrawal';
  savedWithdrawAccount?: string;
  onOpenManageWithdraw?: () => void;
  isSignedIn: boolean;
  onRequireAuth: () => void;
  onSetWithdrawPassword: (newPassword: string, currentPassword?: string) => Promise<{ ok: boolean; error?: string }>;
  onSubmitPayment: (params: {
    type: 'deposit' | 'withdrawal';
    method: PaymentMethod;
    amount: number;
    fee: number;
    netAmount: number;
    currency: 'PKR' | 'INR' | 'USDT' | 'USD';
    accountDetails: string;
    referenceId: string;
    withdrawPassword?: string;
  }) => Promise<boolean | undefined>;
}

const METHODS: { id: PaymentMethod; label: string; currency: 'PKR' | 'INR' | 'USDT'; icon: typeof Smartphone; note: string }[] = [
  { id: 'EasyPaisa', label: 'EasyPaisa', currency: 'PKR', icon: Smartphone, note: 'Instant Mobile Wallet · 0% Fee' },
  { id: 'JazzCash', label: 'JazzCash', currency: 'PKR', icon: Smartphone, note: 'Instant Mobile Wallet · 0% Fee' },
  { id: 'Local Bank Transfer', label: 'Local Bank Transfer', currency: 'PKR', icon: Landmark, note: 'Raast / IBAN · 0% Fee' },
  { id: 'UPI', label: 'UPI', currency: 'INR', icon: Globe, note: 'GPay / PhonePe / Paytm · 0% Fee' },
  { id: 'Net Banking', label: 'Net Banking', currency: 'INR', icon: Landmark, note: 'IMPS / NEFT · 1% Gateway Fee' },
  { id: 'Cryptocurrency', label: 'Cryptocurrency', currency: 'USDT', icon: Coins, note: 'USDT TRC-20 · 0.5% Network Fee' },
];

export function WalletView({
  userProfile,
  transactions,
  paymentGateways,
  initialTab = 'deposit',
  savedWithdrawAccount = '',
  onOpenManageWithdraw,
  isSignedIn,
  onRequireAuth,
  onSetWithdrawPassword,
  onSubmitPayment,
}: Props) {
  const [tab, setTab] = useState<'deposit' | 'withdrawal'>(initialTab);
  const [method, setMethod] = useState<PaymentMethod>('EasyPaisa');
  const [amount, setAmount] = useState(1000);
  const [accountDetails, setAccountDetails] = useState(
    initialTab === 'withdrawal' && savedWithdrawAccount ? savedWithdrawAccount : '',
  );
  const [referenceId, setReferenceId] = useState('');
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [showWdPassword, setShowWdPassword] = useState(false);
  const [newWdPin, setNewWdPin] = useState('');
  const [confirmWdPin, setConfirmWdPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'bonus'>('all');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    fee: number;
    netAmount: number;
    pkrEquivalent: number;
    gatewayRef: string;
    instructions: { label: string; destination: string; note: string };
  } | null>(null);

  const hasWithdrawPassword = Boolean(userProfile?.withdrawPasswordHash);

  const selectedMeta = METHODS.find((m) => m.id === method) || METHODS[0];
  const minAmount = selectedMeta.currency === 'USDT' ? 5 : 100;
  const maxAmount = tab === 'deposit' ? 50000 : 100000;
  const presets =
    tab === 'deposit'
      ? [100, 500, 1000, 5000, 10000, 25000, 50000]
      : [500, 1000, 5000, 10000, 25000, 50000, 100000];

  useEffect(() => {
    setTab(initialTab);
    setErrorMsg(null);
  }, [initialTab]);

  useEffect(() => {
    if (tab === 'deposit' && amount > 50000) {
      setAmount(50000);
    }
  }, [tab, amount]);

  useEffect(() => {
    if (tab === 'withdrawal' && savedWithdrawAccount && !accountDetails) {
      setAccountDetails(savedWithdrawAccount);
    }
  }, [tab, savedWithdrawAccount, accountDetails]);

  const liveDestinationMap: Record<PaymentMethod, string> = {
    EasyPaisa: paymentGateways.easypaisaAccount,
    JazzCash: paymentGateways.jazzcashAccount,
    'Local Bank Transfer': paymentGateways.bankAccount,
    UPI: paymentGateways.upiId,
    'Net Banking': paymentGateways.netBankingInfo,
    Cryptocurrency: paymentGateways.cryptoWallet,
  };
  const liveDestination = liveDestinationMap[method] || quote?.instructions.destination || '';

  useEffect(() => {
    if (!amount || amount <= 0) return;
    const ctrl = new AbortController();
    fetch('/api/gateway/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, amount, currency: selectedMeta.currency, type: tab }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('static-host');
        const contentType = r.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) throw new Error('non-json');
        return r.json();
      })
      .then((d) => {
        if (!d.error) setQuote(d);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setQuote(
          buildLocalGatewayQuote({
            method,
            amount,
            currency: selectedMeta.currency,
            type: tab,
          }),
        );
      });
    return () => ctrl.abort();
  }, [method, amount, tab, selectedMeta.currency]);

  const handleCopyDest = () => {
    if (!liveDestination) return;
    navigator.clipboard.writeText(liveDestination).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSetupInlinePin = async () => {
    setPinError(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (newWdPin.trim().length < 4 || newWdPin.trim().length > 24) {
      setPinError('Withdraw password must be 4 to 24 characters.');
      return;
    }
    if (newWdPin.trim() !== confirmWdPin.trim()) {
      setPinError('Both withdraw passwords must match.');
      return;
    }
    setSavingPin(true);
    const res = await onSetWithdrawPassword(newWdPin);
    setSavingPin(false);
    if (!res.ok) {
      setPinError(res.error || 'Could not save withdraw password.');
      return;
    }
    setWithdrawPassword(newWdPin.trim());
    setNewWdPin('');
    setConfirmWdPin('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (amount < minAmount) {
      setErrorMsg(`Minimum ${tab} amount is ${minAmount} ${selectedMeta.currency}.`);
      return;
    }
    if (amount > maxAmount) {
      setErrorMsg(`Maximum ${tab} limit is ${maxAmount.toLocaleString()} ${selectedMeta.currency}.`);
      return;
    }
    if (tab === 'withdrawal' && amount > (userProfile?.balance ?? 0)) {
      setErrorMsg(`Insufficient withdrawable balance (${formatRs(userProfile?.balance ?? 0)} available).`);
      return;
    }
    if (!accountDetails.trim()) {
      setErrorMsg('Please enter your account or wallet details.');
      return;
    }
    if (tab === 'withdrawal') {
      if (!hasWithdrawPassword) {
        setErrorMsg('Set your Withdraw Password above before submitting a withdrawal.');
        return;
      }
      if (!withdrawPassword.trim()) {
        setErrorMsg('Enter your Withdraw Password to confirm this withdrawal.');
        return;
      }
    }
    const finalRef = referenceId.trim() || quote?.gatewayRef || `REF-${Date.now()}`;
    setSubmitting(true);
    const ok = await onSubmitPayment({
      type: tab,
      method,
      amount,
      fee: quote?.fee ?? 0,
      netAmount: quote?.netAmount ?? amount,
      currency: selectedMeta.currency,
      accountDetails: accountDetails.trim(),
      referenceId: finalRef,
      withdrawPassword: tab === 'withdrawal' ? withdrawPassword : undefined,
    });
    setSubmitting(false);
    if (ok) {
      setAccountDetails('');
      setReferenceId('');
      setWithdrawPassword('');
    }
  };

  const filteredTx = transactions.filter((t) => {
    if (txFilter === 'all') return true;
    if (txFilter === 'bonus') return t.type === 'bonus' || t.type === 'referral';
    return t.type === txFilter;
  });

  return (
    <div className="space-y-6">
      {/* Wallet Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5">
          <div className="text-xs text-[#A3B3AC]">Real Money Balance</div>
          <div className="font-mono text-2xl font-bold text-white mt-1 tabular-nums">
            {formatRs(userProfile?.balance ?? 0)}
          </div>
          <div className="text-xs text-[#19B954] mt-1">Withdrawable via verified gateways</div>
        </div>
        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5">
          <div className="text-xs text-[#A3B3AC]">Bonus & Promo Balance</div>
          <div className="font-mono text-2xl font-bold text-[#F5B82E] mt-1 tabular-nums">
            {formatRs(userProfile?.bonusBalance ?? 0)}
          </div>
          <div className="text-xs text-[#A3B3AC] mt-1">Playable on all casino tables</div>
        </div>
        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5">
          <div className="text-xs text-[#A3B3AC]">Lifetime Volume</div>
          <div className="font-mono text-2xl font-bold text-white mt-1 tabular-nums">
            {formatRs(userProfile?.totalDeposited ?? 0)}
          </div>
          <div className="text-xs text-[#A3B3AC] mt-1">
            Withdrawn: {formatRs(userProfile?.totalWithdrawn ?? 0)}
          </div>
        </div>
      </div>

      {/* Cashier & Payment Gateway */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center gap-2 p-1 bg-[#101413] rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setTab('deposit')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'deposit' ? 'bg-[#19B954] text-white' : 'text-[#A3B3AC] hover:text-white'
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" />
              <span>Deposit Funds</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('withdrawal')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'withdrawal' ? 'bg-[#19B954] text-white' : 'text-[#A3B3AC] hover:text-white'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span>Withdraw Funds</span>
            </button>
          </div>

          {/* Payment Method Grid */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#A3B3AC]">Select Payment Gateway</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#19B954]/15 border-[#19B954] text-white'
                        : 'bg-[#101413] border-white/10 text-[#D1DCD7] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Icon className={`w-4 h-4 ${active ? 'text-[#19B954]' : 'text-[#A3B3AC]'}`} />
                      <span className="font-mono text-[10px] text-[#A3B3AC]">{m.currency}</span>
                    </div>
                    <div className="text-xs font-semibold mt-1.5 truncate">{m.label}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[#A3B3AC]">{selectedMeta.note}</p>
          </div>

          {/* Gateway Checkout Instructions (Deposit) */}
          {tab === 'deposit' && quote?.instructions && (
            <div className="bg-[#101413] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#19B954]">{quote.instructions.label}</span>
                <button
                  type="button"
                  onClick={handleCopyDest}
                  className="inline-flex items-center gap-1 text-xs text-[#F5B82E] hover:underline cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Details'}</span>
                </button>
              </div>
              <div className="font-mono text-xs sm:text-sm text-white break-all">
                {liveDestination}
              </div>
              <p className="text-[11px] text-[#A3B3AC]">{quote.instructions.note}</p>
            </div>
          )}

          {/* Amount Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
              <span>Quick Amount ({selectedMeta.currency})</span>
              {tab === 'deposit' && (
                <span className="text-[#19B954] font-semibold">+3% Bonus Eligible</span>
              )}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmount(preset);
                    setErrorMsg(null);
                  }}
                  className={`py-2 rounded-xl text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                    amount === preset
                      ? 'bg-[#19B954]/20 border-[#19B954] text-white'
                      : 'bg-[#101413] border-white/10 text-[#A3B3AC] hover:text-white'
                  }`}
                >
                  {preset >= 1000 ? `${preset / 1000}k` : preset}
                </button>
              ))}
            </div>
          </div>

          {/* Amount & Account Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-[#A3B3AC]">
                  Amount ({selectedMeta.currency})
                </label>
                <span className="text-[11px] font-mono text-[#7D8C85]">
                  Limit: {minAmount.toLocaleString()} – {maxAmount.toLocaleString()}
                </span>
              </div>
              <input
                type="number"
                min={minAmount}
                max={maxAmount}
                required
                value={amount}
                onChange={(e) => {
                  const val = Math.max(1, Number(e.target.value));
                  setAmount(val);
                  setErrorMsg(null);
                }}
                className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono font-semibold text-white focus:outline-none focus:border-[#19B954]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#A3B3AC]">
                  {tab === 'deposit' ? 'Sender Account / Wallet Address' : 'Destination Account / IBAN / VPA'}
                </label>
                {tab === 'withdrawal' && onOpenManageWithdraw && (
                  <button
                    type="button"
                    onClick={onOpenManageWithdraw}
                    className="text-[11px] text-[#19B954] hover:underline cursor-pointer"
                  >
                    Manage Saved
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                placeholder={
                  method === 'Cryptocurrency'
                    ? 'TRC-20 Wallet Address'
                    : method === 'UPI'
                      ? 'yourname@upi'
                      : '03XX-XXXXXXX or IBAN'
                }
                value={accountDetails}
                onChange={(e) => setAccountDetails(e.target.value)}
                className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#19B954]"
              />
            </div>
          </div>

          {tab === 'deposit' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#A3B3AC]">
                Transaction ID / UTR / TX Hash
              </label>
              <input
                type="text"
                required
                placeholder="Enter payment reference ID (e.g., TID-90841221)"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#19B954]"
              />
            </div>
          )}

          {tab === 'withdrawal' && isSignedIn && !hasWithdrawPassword && (
            <div className="bg-[#101413] border border-[#F5B82E]/40 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-[#F5B82E] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#F5B82E]">
                    Set Withdraw Password Required
                  </div>
                  <p className="text-[11px] text-[#A3B3AC] mt-0.5">
                    Create a 4–24 character Withdraw Password once before requesting any payout. You will enter this password every time you withdraw.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="password"
                  placeholder="New Withdraw Password (4-24 chars)"
                  value={newWdPin}
                  onChange={(e) => {
                    setNewWdPin(e.target.value);
                    setPinError(null);
                  }}
                  className="bg-[#171D1B] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#19B954]"
                />
                <input
                  type="password"
                  placeholder="Confirm Withdraw Password"
                  value={confirmWdPin}
                  onChange={(e) => {
                    setConfirmWdPin(e.target.value);
                    setPinError(null);
                  }}
                  className="bg-[#171D1B] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#19B954]"
                />
              </div>
              {pinError && (
                <div className="text-[11px] text-red-400 font-medium">{pinError}</div>
              )}
              <button
                type="button"
                disabled={savingPin}
                onClick={handleSetupInlinePin}
                className="px-4 py-2 rounded-xl bg-[#F5B82E] hover:bg-[#E5A820] disabled:opacity-50 text-[#111312] text-xs font-bold cursor-pointer"
              >
                {savingPin ? 'Saving Password...' : 'Save Withdraw Password'}
              </button>
            </div>
          )}

          {tab === 'withdrawal' && isSignedIn && hasWithdrawPassword && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-[#A3B3AC] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#19B954]" />
                  <span>Withdraw Password</span>
                </label>
                {onOpenManageWithdraw && (
                  <button
                    type="button"
                    onClick={onOpenManageWithdraw}
                    className="text-[11px] text-[#19B954] hover:underline cursor-pointer"
                  >
                    Change in Profile
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showWdPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your Withdraw Password"
                  value={withdrawPassword}
                  onChange={(e) => {
                    setWithdrawPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full bg-[#101413] border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-[#19B954]"
                />
                <button
                  type="button"
                  onClick={() => setShowWdPassword((v) => !v)}
                  aria-label="Toggle withdraw password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7D8C85] hover:text-white cursor-pointer"
                >
                  {showWdPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {tab === 'withdrawal' && amount >= 10000 && userProfile?.kycStatus !== 'verified' && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Withdrawals of Rs 10,000+ without verified KYC will be flagged for compliance review. Complete KYC in your Profile tab for instant approvals.
              </span>
            </div>
          )}

          {quote && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A3B3AC] border-t border-white/10 pt-3">
              <span>
                Fee: <strong className="font-mono text-white">{quote.fee} {selectedMeta.currency}</strong>
              </span>
              <span>
                Net Credit: <strong className="font-mono text-[#19B954]">{formatRs(quote.pkrEquivalent)}</strong>
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl bg-red-500/15 border border-red-500/35 px-3.5 py-2.5 text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || (tab === 'withdrawal' && isSignedIn && !hasWithdrawPassword)}
            className="w-full py-3.5 px-5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:opacity-50 text-white font-bold text-sm transition-colors cursor-pointer"
          >
            {submitting
              ? 'Submitting Request...'
              : tab === 'deposit'
                ? `Submit ${method} Deposit`
                : `Request ${method} Withdrawal`}
          </button>
        </form>

        {/* Transaction Ledger */}
        <div className="lg:col-span-5 bg-[#171D1B] border border-white/10 rounded-2xl p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
            <h3 className="text-base font-bold text-white">Transaction History</h3>
            <div className="flex items-center gap-1">
              {(['all', 'deposit', 'withdrawal', 'bonus'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                    txFilter === f ? 'bg-[#19B954] text-white' : 'text-[#A3B3AC] hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5 mt-2 max-h-[460px]">
            {filteredTx.length === 0 && (
              <div className="py-12 text-center text-xs text-[#A3B3AC]">
                No transactions yet. Submit a deposit or claim your daily bonus to view ledger entries.
              </div>
            )}
            {filteredTx.map((tx) => (
              <div key={tx.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0 space-y-0.5">
                  <div className="font-semibold text-white capitalize">
                    {tx.type} · {tx.method}
                  </div>
                  <div className="text-[#A3B3AC] truncate">{tx.accountDetails}</div>
                  <div className="font-mono text-[11px] text-[#7D8C85]">Ref: {tx.referenceId}</div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div
                    className={`font-mono font-bold tabular-nums ${
                      tx.type === 'withdrawal' ? 'text-red-400' : 'text-[#19B954]'
                    }`}
                  >
                    {tx.type === 'withdrawal' ? '-' : '+'}
                    {tx.amount} {tx.currency}
                  </div>
                  <div
                    className={`text-[11px] font-semibold capitalize ${
                      tx.status === 'approved'
                        ? 'text-[#19B954]'
                        : tx.status === 'rejected'
                          ? 'text-red-400'
                          : 'text-[#F5B82E]'
                    }`}
                  >
                    {tx.status}
                    {tx.fraudFlag ? ' (Review)' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
