import { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Users,
  CreditCard,
  Headphones,
  Gamepad2,
  Landmark,
  Copy,
  Check,
  Link2,
} from 'lucide-react';
import {
  FraudAlert,
  GameRecord,
  KycProfile,
  PaymentGatewaySettings,
  SupportTicket,
  Transaction,
  UserAccount,
} from '../types/platform';
import { formatRs } from '../lib/vip';

interface Props {
  allUsers: UserAccount[];
  allTransactions: Transaction[];
  adminKycQueue: KycProfile[];
  fraudAlerts: FraudAlert[];
  allTickets: SupportTicket[];
  allGameHistory: GameRecord[];
  paymentGateways: PaymentGatewaySettings;
  onProcessTx: (tx: Transaction, decision: 'approved' | 'rejected', note: string) => Promise<boolean | undefined>;
  onReviewKyc: (uid: string, decision: 'verified' | 'rejected', note: string) => Promise<boolean | undefined>;
  onToggleFreeze: (user: UserAccount) => Promise<boolean | undefined>;
  onAdjustBalance: (user: UserAccount, mainDelta: number, bonusDelta?: number) => Promise<boolean | undefined>;
  onUpdateFraudAlert: (alertId: string, status: 'reviewed' | 'dismissed') => Promise<boolean | undefined>;
  onSavePaymentGateways: (settings: PaymentGatewaySettings) => Promise<boolean | undefined>;
  onReplyTicket: (
    ticket: SupportTicket,
    text: string,
    asAgent: boolean,
    nextStatus: SupportTicket['status'],
  ) => Promise<boolean | undefined>;
}

export function AdminPanelView({
  allUsers,
  allTransactions,
  adminKycQueue,
  fraudAlerts,
  allTickets,
  allGameHistory,
  paymentGateways,
  onProcessTx,
  onReviewKyc,
  onToggleFreeze,
  onAdjustBalance,
  onUpdateFraudAlert,
  onSavePaymentGateways,
  onReplyTicket,
}: Props) {
  const [section, setSection] = useState<'transactions' | 'kyc' | 'fraud' | 'users' | 'bets' | 'gateways' | 'support'>('transactions');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [gatewayDraft, setGatewayDraft] = useState<PaymentGatewaySettings>(paymentGateways);
  const [savingGateways, setSavingGateways] = useState(false);
  const [copiedLink, setCopiedLink] = useState<'player' | 'admin' | null>(null);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const playerLink = `${originUrl}/`;
  const adminLink = `${originUrl}/?view=admin`;

  const copyLink = (kind: 'player' | 'admin', value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedLink(kind);
    setTimeout(() => setCopiedLink((prev) => (prev === kind ? null : prev)), 1800);
  };

  const pendingTxCount = allTransactions.filter((t) => t.status === 'pending').length;
  const pendingKycCount = adminKycQueue.filter((k) => k.status === 'pending').length;
  const openFraudCount = fraudAlerts.filter((f) => f.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Owner Shareable Links Bar */}
      <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-center justify-between gap-3 bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#19B954] flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              <span>Player Public Link (Share in Ads)</span>
            </div>
            <div className="font-mono text-xs text-white truncate mt-0.5">{playerLink}</div>
          </div>
          <button
            type="button"
            onClick={() => copyLink('player', playerLink)}
            className="px-3 py-1.5 rounded-lg bg-[#19B954] hover:bg-[#16A34A] text-white text-xs font-bold shrink-0 inline-flex items-center gap-1 cursor-pointer"
          >
            {copiedLink === 'player' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink === 'player' ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 bg-[#101413] border border-[#F5B82E]/30 rounded-xl px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#F5B82E] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Owner Admin Link (Private)</span>
            </div>
            <div className="font-mono text-xs text-white truncate mt-0.5">{adminLink}</div>
          </div>
          <button
            type="button"
            onClick={() => copyLink('admin', adminLink)}
            className="px-3 py-1.5 rounded-lg bg-[#F5B82E] hover:bg-[#E5A820] text-[#111312] text-xs font-bold shrink-0 inline-flex items-center gap-1 cursor-pointer"
          >
            {copiedLink === 'admin' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink === 'admin' ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Admin Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-[#A3B3AC]">Registered Players</div>
          <div className="font-mono text-2xl font-bold text-white mt-1 tabular-nums">{allUsers.length}</div>
        </div>
        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-[#A3B3AC]">Pending Transactions</div>
          <div className="font-mono text-2xl font-bold text-[#F5B82E] mt-1 tabular-nums">{pendingTxCount}</div>
        </div>
        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-[#A3B3AC]">Pending KYC Reviews</div>
          <div className="font-mono text-2xl font-bold text-white mt-1 tabular-nums">{pendingKycCount}</div>
        </div>
        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-[#A3B3AC]">Open Fraud Alerts</div>
          <div className="font-mono text-2xl font-bold text-red-400 mt-1 tabular-nums">{openFraudCount}</div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {[
          { id: 'transactions', label: `Transactions (${pendingTxCount})`, icon: CreditCard },
          { id: 'kyc', label: `KYC Queue (${pendingKycCount})`, icon: CheckCircle2 },
          { id: 'fraud', label: `Fraud Alerts (${openFraudCount})`, icon: ShieldAlert },
          { id: 'users', label: `Users (${allUsers.length})`, icon: Users },
          { id: 'bets', label: `Game Bets (${allGameHistory.length})`, icon: Gamepad2 },
          { id: 'gateways', label: 'Payment Accounts', icon: Landmark },
          { id: 'support', label: `Support (${allTickets.filter((t) => t.status !== 'resolved').length})`, icon: Headphones },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'gateways') setGatewayDraft(paymentGateways);
                setSection(tab.id as any);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                section === tab.id ? 'bg-[#19B954] text-white' : 'bg-[#171D1B] text-[#A3B3AC] hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Transactions Management */}
      {section === 'transactions' && (
        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#A3B3AC]">
                <th className="py-2.5 font-medium">Player</th>
                <th className="py-2.5 font-medium">Type / Gateway</th>
                <th className="py-2.5 font-medium">Account / Ref</th>
                <th className="py-2.5 font-medium text-right">Amount</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="py-3 font-medium text-white">{tx.userName}</td>
                  <td className="py-3 text-[#D1DCD7] capitalize">
                    {tx.type} · {tx.method}
                  </td>
                  <td className="py-3 font-mono text-[#A3B3AC]">
                    {tx.accountDetails} · {tx.referenceId}
                  </td>
                  <td className="py-3 font-mono text-right text-white tabular-nums">
                    {tx.amount} {tx.currency}
                  </td>
                  <td className="py-3">
                    <span
                      className={`font-semibold capitalize ${
                        tx.status === 'approved'
                          ? 'text-[#19B954]'
                          : tx.status === 'rejected'
                            ? 'text-red-400'
                            : 'text-[#F5B82E]'
                      }`}
                    >
                      {tx.status} {tx.fraudFlag ? '· Flagged' : ''}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {tx.status === 'pending' ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onProcessTx(tx, 'approved', 'Verified by Admin')}
                          className="px-2.5 py-1.5 rounded-lg bg-[#19B954] hover:bg-[#16A34A] text-white font-semibold cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onProcessTx(tx, 'rejected', 'Rejected by Admin')}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[#7D8C85]">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* KYC Verification Queue */}
      {section === 'kyc' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {adminKycQueue.length === 0 && (
            <div className="col-span-full bg-[#171D1B] border border-white/10 rounded-2xl p-8 text-center text-xs text-[#A3B3AC]">
              No KYC submissions in queue.
            </div>
          )}
          {adminKycQueue.map((kyc) => (
            <div key={kyc.uid} className="bg-[#171D1B] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-white">{kyc.fullName}</div>
                <span className="text-xs font-semibold capitalize text-[#F5B82E]">{kyc.status}</span>
              </div>
              <div className="text-xs text-[#A3B3AC] space-y-1">
                <div>
                  {kyc.documentType}: <span className="font-mono text-white">{kyc.documentNumber}</span>
                </div>
                <div>Phone: {kyc.phone} · Email: {kyc.email}</div>
                <div>Address: {kyc.address}, {kyc.country}</div>
              </div>
              {kyc.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => onReviewKyc(kyc.uid, 'verified', 'Document verified')}
                    className="flex-1 py-2 rounded-xl bg-[#19B954] hover:bg-[#16A34A] text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify</span>
                  </button>
                  <button
                    onClick={() => onReviewKyc(kyc.uid, 'rejected', 'Document mismatch — resubmit')}
                    className="flex-1 py-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fraud Prevention Alerts */}
      {section === 'fraud' && (
        <div className="space-y-3">
          {fraudAlerts.length === 0 && (
            <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-8 text-center text-xs text-[#A3B3AC]">
              Zero open fraud prevention alerts.
            </div>
          )}
          {fraudAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-[#171D1B] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>{alert.userName}</span>
                  <span className="text-xs font-mono text-red-400 uppercase">{alert.severity}</span>
                </div>
                <div className="text-xs text-[#D1DCD7]">{alert.reason}</div>
                <div className="text-[11px] font-mono text-[#A3B3AC]">{alert.details}</div>
              </div>
              <div className="flex items-center gap-2">
                {alert.status === 'open' ? (
                  <>
                    <button
                      onClick={() => onUpdateFraudAlert(alert.id, 'reviewed')}
                      className="px-3 py-1.5 rounded-lg bg-[#19B954] text-white text-xs font-semibold cursor-pointer"
                    >
                      Mark Reviewed
                    </button>
                    <button
                      onClick={() => onUpdateFraudAlert(alert.id, 'dismissed')}
                      className="px-3 py-1.5 rounded-lg bg-[#202825] text-[#D1DCD7] text-xs font-semibold cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-[#A3B3AC] capitalize">{alert.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users Management */}
      {section === 'users' && (
        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#A3B3AC]">
                <th className="py-2.5 font-medium">Player</th>
                <th className="py-2.5 font-medium">VIP / KYC</th>
                <th className="py-2.5 font-medium text-right">Balance</th>
                <th className="py-2.5 font-medium text-right">Total Wagered</th>
                <th className="py-2.5 font-medium text-right">Account Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allUsers.map((u) => (
                <tr key={u.uid}>
                  <td className="py-3 font-medium text-white">{u.displayName}</td>
                  <td className="py-3 text-[#A3B3AC]">
                    {u.vipTier} · KYC: {u.kycStatus}
                  </td>
                  <td className="py-3 font-mono text-right text-[#F5B82E] tabular-nums">
                    {formatRs(u.balance)}
                  </td>
                  <td className="py-3 font-mono text-right text-white tabular-nums">
                    {formatRs(u.totalWagered)}
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => onAdjustBalance(u, 500, 0)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#202825] hover:bg-[#2A3531] text-[#19B954] text-xs font-semibold cursor-pointer"
                      >
                        +500
                      </button>
                      <button
                        onClick={() => onAdjustBalance(u, -500, 0)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#202825] hover:bg-[#2A3531] text-[#F5B82E] text-xs font-semibold cursor-pointer"
                      >
                        -500
                      </button>
                      <button
                        onClick={() => onToggleFreeze(u)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          u.isFrozen
                            ? 'bg-[#19B954] text-white'
                            : 'bg-red-600/80 hover:bg-red-600 text-white'
                        }`}
                      >
                        {u.isFrozen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>{u.isFrozen ? 'Unfreeze' : 'Freeze'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* All Game Bets Ledger */}
      {section === 'bets' && (
        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#A3B3AC]">
                <th className="py-2.5 font-medium">Player</th>
                <th className="py-2.5 font-medium">Game</th>
                <th className="py-2.5 font-medium">Details</th>
                <th className="py-2.5 font-medium text-right">Bet</th>
                <th className="py-2.5 font-medium text-right">Mult</th>
                <th className="py-2.5 font-medium text-right">Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allGameHistory.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#A3B3AC]">
                    No settled game rounds recorded yet.
                  </td>
                </tr>
              )}
              {allGameHistory.map((b) => (
                <tr key={b.id}>
                  <td className="py-3 font-medium text-white">{b.userName}</td>
                  <td className="py-3 capitalize text-[#D1DCD7]">{b.game}</td>
                  <td className="py-3 text-[#A3B3AC]">{b.details}</td>
                  <td className="py-3 font-mono text-right text-white tabular-nums">{formatRs(b.betAmount)}</td>
                  <td className="py-3 font-mono text-right text-[#F5B82E] tabular-nums">{b.multiplier}x</td>
                  <td
                    className={`py-3 font-mono text-right font-semibold tabular-nums ${
                      b.payout > 0 ? 'text-[#19B954]' : 'text-[#7D8C85]'
                    }`}
                  >
                    {formatRs(b.payout)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Support Desk */}
      {section === 'support' && (
        <div className="space-y-4">
          {allTickets.map((t) => (
            <div key={t.id} className="bg-[#171D1B] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="font-semibold text-white">
                  {t.userName} · {t.subject} ({t.category})
                </div>
                <span className="text-[#F5B82E] capitalize">{t.status.replace('_', ' ')}</span>
              </div>
              <div className="text-xs text-[#D1DCD7] bg-[#101413] rounded-xl p-3 max-h-32 overflow-y-auto space-y-1.5">
                {t.messages.map((m, i) => (
                  <div key={i}>
                    <strong className={m.sender === 'agent' ? 'text-[#19B954]' : 'text-white'}>
                      {m.senderName}:
                    </strong>{' '}
                    {m.text}
                  </div>
                ))}
              </div>
              {t.status !== 'resolved' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Reply to player..."
                    value={replyDrafts[t.id] || ''}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    className="flex-1 bg-[#101413] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <button
                    onClick={() => {
                      const txt = replyDrafts[t.id]?.trim();
                      if (!txt) return;
                      onReplyTicket(t, txt, true, 'in_progress');
                      setReplyDrafts((prev) => ({ ...prev, [t.id]: '' }));
                    }}
                    className="px-3 py-2 rounded-xl bg-[#19B954] text-white text-xs font-semibold cursor-pointer"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => onReplyTicket(t, 'Issue resolved by Support Desk.', true, 'resolved')}
                    className="px-3 py-2 rounded-xl bg-[#202825] text-white text-xs font-semibold cursor-pointer"
                  >
                    Resolve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Payment Receiving Accounts Configuration */}
      {section === 'gateways' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingGateways(true);
            await onSavePaymentGateways(gatewayDraft);
            setSavingGateways(false);
          }}
          className="bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div>
            <h3 className="text-base font-bold text-white">Receiving Payment Accounts</h3>
            <p className="text-xs text-[#A3B3AC] mt-1">
              Enter your real EasyPaisa, JazzCash, Bank IBAN, UPI, Net Banking, and USDT TRC-20 accounts. Players see these exact details on the Deposit screen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#A3B3AC]">EasyPaisa Account (Number & Title)</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={160}
                value={gatewayDraft.easypaisaAccount}
                onChange={(e) => setGatewayDraft((p) => ({ ...p, easypaisaAccount: e.target.value }))}
                className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#19B954]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#A3B3AC]">JazzCash Account (Number & Title)</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={160}
                value={gatewayDraft.jazzcashAccount}
                onChange={(e) => setGatewayDraft((p) => ({ ...p, jazzcashAccount: e.target.value }))}
                className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#19B954]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#A3B3AC]">Local Bank Transfer (IBAN / Bank Name)</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={160}
                value={gatewayDraft.bankAccount}
                onChange={(e) => setGatewayDraft((p) => ({ ...p, bankAccount: e.target.value }))}
                className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#19B954]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#A3B3AC]">UPI ID (INR)</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={160}
                value={gatewayDraft.upiId}
                onChange={(e) => setGatewayDraft((p) => ({ ...p, upiId: e.target.value }))}
                className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#19B954]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#A3B3AC]">Net Banking Details</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={160}
                value={gatewayDraft.netBankingInfo}
                onChange={(e) => setGatewayDraft((p) => ({ ...p, netBankingInfo: e.target.value }))}
                className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#19B954]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#A3B3AC]">USDT (TRC-20) Crypto Wallet</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={160}
                value={gatewayDraft.cryptoWallet}
                onChange={(e) => setGatewayDraft((p) => ({ ...p, cryptoWallet: e.target.value }))}
                className="w-full bg-[#101413] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#19B954]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingGateways}
            className="px-5 py-2.5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
          >
            {savingGateways ? 'Saving Accounts...' : 'Save Receiving Accounts'}
          </button>
        </form>
      )}
    </div>
  );
}
