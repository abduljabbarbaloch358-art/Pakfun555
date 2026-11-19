import { useState } from 'react';
import {
  ShieldCheck,
  FileCheck2,
  History,
  Lock,
  Copy,
  Check,
  CreditCard,
  Users,
  Headphones,
  ChevronRight,
  Crown,
  MessageCircle,
  RefreshCw,
  Pencil,
  Wallet,
  Banknote,
  Globe,
  HelpCircle,
  MessageSquarePlus,
  UserCheck,
  Link2,
  KeyRound,
} from 'lucide-react';
import { GameId, GameRecord, KycProfile, UserAccount } from '../types/platform';
import { computeVipTier, formatRs } from '../lib/vip';
import { Lang, TRANSLATIONS } from '../lib/i18n';

interface Props {
  lang: Lang;
  onToggleLang: () => void;
  userProfile: UserAccount | null;
  kycProfile: KycProfile | null;
  gameHistory: GameRecord[];
  isSignedIn: boolean;
  isAdmin?: boolean;
  savedWithdrawAccount: string;
  onSaveWithdrawAccount: (account: string) => void;
  onOpenWallet: (tab: 'deposit' | 'withdrawal') => void;
  onOpenAdmin?: () => void;
  onOpenRewards: () => void;
  onOpenSupport: () => void;
  onRequireAuth: () => void;
  onSetWithdrawPassword: (newPassword: string, currentPassword?: string) => Promise<{ ok: boolean; error?: string }>;
  onSubmitKyc: (payload: {
    fullName: string;
    phone: string;
    documentType: 'CNIC' | 'Passport' | 'DrivingLicense' | 'Aadhaar';
    documentNumber: string;
    country: string;
    address: string;
  }) => Promise<boolean | undefined>;
}

const VIP_LEVEL_LABEL: Record<string, { code: string; nextBonus: number; depTarget: number; betTarget: number }> = {
  Bronze: { code: 'V0', nextBonus: 10, depTarget: 1000, betTarget: 8000 },
  Silver: { code: 'V1', nextBonus: 50, depTarget: 10000, betTarget: 50000 },
  Gold: { code: 'V2', nextBonus: 250, depTarget: 50000, betTarget: 200000 },
  Platinum: { code: 'V3', nextBonus: 1000, depTarget: 200000, betTarget: 1000000 },
  Diamond: { code: 'V4', nextBonus: 5000, depTarget: 500000, betTarget: 2500000 },
};

function numericPlayerId(uid?: string): string {
  if (!uid) return '929428111';
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = (h * 31 + uid.charCodeAt(i)) % 900000000;
  }
  return String(100000000 + Math.abs(h));
}

export function ProfileKycView({
  lang,
  onToggleLang,
  userProfile,
  kycProfile,
  gameHistory,
  isSignedIn,
  isAdmin = false,
  savedWithdrawAccount,
  onSaveWithdrawAccount,
  onOpenWallet,
  onOpenAdmin,
  onOpenRewards,
  onOpenSupport,
  onRequireAuth,
  onSetWithdrawPassword,
  onSubmitKyc,
}: Props) {
  const t = TRANSLATIONS[lang];
  const [fullName, setFullName] = useState(kycProfile?.fullName || '');
  const [phone, setPhone] = useState(kycProfile?.phone || '');
  const [documentType, setDocumentType] = useState<'CNIC' | 'Passport' | 'DrivingLicense' | 'Aadhaar'>(
    kycProfile?.documentType || 'CNIC',
  );
  const [documentNumber, setDocumentNumber] = useState(kycProfile?.documentNumber || '');
  const [country, setCountry] = useState(kycProfile?.country || 'Pakistan');
  const [address, setAddress] = useState(kycProfile?.address || '');
  const [gameFilter, setGameFilter] = useState<'all' | GameId>('all');
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedName, setCopiedName] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [manageWithdrawOpen, setManageWithdrawOpen] = useState(false);
  const [withdrawDraft, setWithdrawDraft] = useState(savedWithdrawAccount);
  const [withdrawSavedMsg, setWithdrawSavedMsg] = useState(false);
  const [currentWdPass, setCurrentWdPass] = useState('');
  const [newWdPass, setNewWdPass] = useState('');
  const [confirmWdPass, setConfirmWdPass] = useState('');
  const [wdPassSaving, setWdPassSaving] = useState(false);
  const [wdPassMsg, setWdPassMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const playerNumericId = numericPlayerId(userProfile?.uid);
  const handleName = userProfile?.displayName || 'Guest Player';
  const vipMeta = VIP_LEVEL_LABEL[userProfile?.vipTier || 'Bronze'] || VIP_LEVEL_LABEL.Bronze;
  const vipStats = computeVipTier(userProfile?.totalWagered ?? 0);
  const spendable = (userProfile?.balance ?? 0) + (userProfile?.bonusBalance ?? 0);
  const totalDep = userProfile?.totalDeposited ?? 0;
  const totalWagered = userProfile?.totalWagered ?? 0;
  const depPct = Math.min(100, Math.round((totalDep / vipMeta.depTarget) * 100));
  const betPct = Math.min(100, Math.round((totalWagered / vipMeta.betTarget) * 100));
  const remDep = Math.max(0, vipMeta.depTarget - totalDep);
  const remBets = Math.max(0, vipMeta.betTarget - totalWagered);

  const handleCopyId = () => {
    navigator.clipboard.writeText(playerNumericId).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1600);
  };

  const handleCopyName = () => {
    navigator.clipboard.writeText(handleName).catch(() => {});
    setCopiedName(true);
    setTimeout(() => setCopiedName(false), 1600);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 450);
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    await onSubmitKyc({ fullName, phone, documentType, documentNumber, country, address });
    setSubmitting(false);
  };

  const handleSaveWithdrawBinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawDraft.trim()) return;
    onSaveWithdrawAccount(withdrawDraft.trim());
    setWithdrawSavedMsg(true);
    setTimeout(() => {
      setWithdrawSavedMsg(false);
      setManageWithdrawOpen(false);
    }, 900);
  };

  const handleSaveWithdrawPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setWdPassMsg(null);
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (newWdPass.trim().length < 4 || newWdPass.trim().length > 24) {
      setWdPassMsg({ ok: false, text: 'Withdraw password must be 4 to 24 characters.' });
      return;
    }
    if (newWdPass.trim() !== confirmWdPass.trim()) {
      setWdPassMsg({ ok: false, text: 'New withdraw passwords do not match.' });
      return;
    }
    setWdPassSaving(true);
    const res = await onSetWithdrawPassword(newWdPass, currentWdPass);
    setWdPassSaving(false);
    if (!res.ok) {
      setWdPassMsg({ ok: false, text: res.error || 'Could not update withdraw password.' });
      return;
    }
    setCurrentWdPass('');
    setNewWdPass('');
    setConfirmWdPass('');
    setWdPassMsg({ ok: true, text: 'Withdraw password saved securely!' });
  };

  const filteredHistory = gameHistory.filter((g) => (gameFilter === 'all' ? true : g.game === gameFilter));

  return (
    <div className="space-y-4 sm:space-y-6">
      {isAdmin && onOpenAdmin && (
        <div className="bg-[#171D1B] border border-[#F5B82E]/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5B82E]/15 border border-[#F5B82E]/40 flex items-center justify-center text-[#FACC15]">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#FACC15]">{t.adminPortal}</div>
              <p className="text-xs text-[#A3B3AC]">
                {lang === 'ur'
                  ? 'صرف آپ (ایڈمن) کے لیے — ڈپازٹ، وِدڈرا اور کھلاڑی مینج کریں۔'
                  : 'Verified owner access — manage deposits, withdrawals, KYC & players.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl bg-[#F5B82E] hover:bg-[#E5A820] text-[#111312] text-xs font-extrabold cursor-pointer"
          >
            {lang === 'ur' ? 'ایڈمن پینل کھولیں' : 'Open Admin Panel'}
          </button>
        </div>
      )}

      {/* Screenshot 3 Top Profile Dark Curved Header Card */}
      <section className="rounded-2xl overflow-hidden bg-[#161817] border border-white/10">
        <div className="p-4 sm:p-6 bg-[radial-gradient(ellipse_at_top_right,_rgba(27,182,78,0.14),_transparent_60%)] space-y-5">
          {/* Top-right support icons */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => document.getElementById('kyc-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[#F472B6] via-[#A855F7] to-[#6366F1] border-2 border-[#1BB64E] flex items-center justify-center font-display text-xl font-black text-white shrink-0 cursor-pointer"
                aria-label="Edit profile and KYC"
              >
                {handleName.slice(0, 1).toUpperCase()}
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#1BB64E] border-2 border-[#161817] flex items-center justify-center">
                  <Pencil className="w-2.5 h-2.5 text-white" />
                </span>
              </button>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-bold text-white">{handleName}</span>
                  <button
                    type="button"
                    onClick={handleCopyName}
                    className="text-[#1BB64E] hover:text-white cursor-pointer"
                    aria-label="Copy username"
                  >
                    {copiedName ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                  <span className="inline-flex items-center gap-1.5 text-[#A3B3AC] font-mono">
                    ID: <strong className="text-white font-semibold">{playerNumericId}</strong>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="text-[#1BB64E] hover:text-white cursor-pointer"
                      aria-label="Copy player ID"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#EAB308] text-[#111312] font-black text-[9px] inline-flex items-center justify-center">
                      Rs
                    </span>
                    <span className="font-mono font-bold text-[#FACC15] underline underline-offset-4 tabular-nums">
                      {spendable.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      aria-label="Refresh balance"
                      className="text-[#1BB64E] hover:text-white cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenSupport}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#1BB64E] cursor-pointer"
                aria-label="Online Support"
              >
                <Headphones className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenSupport}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#1BB64E] cursor-pointer"
                aria-label="Messages and feedback"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Screenshot 3 Centered Withdraw & Deposit(+3%) Icon Actions */}
          <div className="grid grid-cols-2 gap-4 pt-1 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => onOpenWallet('withdrawal')}
              className="min-h-[48px] py-2.5 px-4 rounded-xl hover:bg-white/5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[#1BB64E]/15 border border-[#1BB64E]/40 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-[#1BB64E]" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-white">{t.withdraw}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenWallet('deposit')}
              className="min-h-[48px] py-2.5 px-4 rounded-xl hover:bg-white/5 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative transition-colors"
            >
              <div className="relative w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-sky-400" />
                <span className="absolute -top-1.5 -right-3 px-1.5 py-0.5 rounded-full bg-red-600 text-[9px] font-extrabold text-white leading-none">
                  +3%
                </span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-white">{t.deposit}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Link Wallet Free Prize Strip (Screenshot 3) */}
      <section className="bg-[#181B1A] border border-white/10 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 text-xs sm:text-sm text-[#E2E8E4]">
          <Link2 className="w-4 h-4 text-[#1BB64E] shrink-0" />
          <span className="truncate">
            Link NO Wallet deposit/withdrawal free + draw{' '}
            <strong className="font-mono font-extrabold text-[#FACC15]">777,777.70</strong> Big prize
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setManageWithdrawOpen((v) => !v)}
            className="px-4 py-1.5 rounded-lg bg-[#1BB64E] hover:bg-[#169C42] text-white text-xs font-bold cursor-pointer"
          >
            {savedWithdrawAccount ? 'Linked' : 'Link'}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Sync linked wallet"
            className="p-1.5 text-[#1BB64E] hover:text-white cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {/* Inline Manage Withdrawal Account Form */}
      {manageWithdrawOpen && (
        <form
          onSubmit={handleSaveWithdrawBinding}
          className="bg-[#181B1A] border border-[#1BB64E]/50 rounded-xl p-4 space-y-3"
        >
          <div className="text-xs font-semibold text-white">
            Manage Withdrawal Account (EasyPaisa / JazzCash / IBAN / USDT TRC-20)
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              placeholder="e.g., EasyPaisa 0300-1234567 or TRC-20 address"
              value={withdrawDraft}
              onChange={(e) => setWithdrawDraft(e.target.value)}
              className="flex-1 bg-[#111312] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#1BB64E]"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#1BB64E] hover:bg-[#169C42] text-white text-xs font-bold cursor-pointer"
            >
              {withdrawSavedMsg ? 'Saved!' : 'Save Withdrawal Account'}
            </button>
          </div>
        </form>
      )}

      {/* Screenshot 3 Green VIP Card (V0..V4) */}
      <section
        onClick={onOpenRewards}
        className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[#1BB64E] via-[#13903D] to-[#0B662A] border border-white/15 text-white cursor-pointer hover:brightness-105 transition"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3 min-w-[200px] flex-1">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-black/20 border border-[#FACC15]/60 flex items-center justify-center">
                <Crown className="w-6 h-6 text-[#FACC15]" />
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-black italic leading-none">
                  {vipMeta.code}
                </div>
                <div className="text-[11px] text-white/80 font-medium">{vipStats.tier} Level</div>
              </div>
            </div>

            {/* Two progress bars under V0 like Screenshot 3 */}
            <div className="space-y-1.5 max-w-xs">
              <div className="h-3.5 rounded-full bg-black/30 overflow-hidden relative flex items-center justify-center">
                <div
                  className="absolute inset-y-0 left-0 bg-[#4ADE80]/80 rounded-full"
                  style={{ width: `${depPct}%` }}
                />
                <span className="relative z-10 font-mono text-[10px] font-bold text-white">
                  {totalDep.toFixed(2)}/{vipMeta.depTarget.toLocaleString()}
                </span>
              </div>

              <div className="h-3.5 rounded-full bg-black/30 overflow-hidden relative flex items-center justify-center">
                <div
                  className="absolute inset-y-0 left-0 bg-[#4ADE80]/80 rounded-full"
                  style={{ width: `${betPct}%` }}
                />
                <span className="relative z-10 font-mono text-[10px] font-bold text-white">
                  {totalWagered.toFixed(2)}/{vipMeta.betTarget.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right space-y-1 text-xs">
              <div>
                Next level bonus{' '}
                <strong className="font-mono text-base font-extrabold text-white">
                  {vipMeta.nextBonus.toFixed(2)}
                </strong>
              </div>
              <div className="text-white/90">
                VIP requires <span className="underline">Deposit</span>{' '}
                <strong className="font-mono">{remDep.toFixed(2)}</strong>
              </div>
              <div className="text-white/90">
                VIP requires <span className="underline">Bets</span>{' '}
                <strong className="font-mono">{remBets.toFixed(2)}</strong>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
          </div>
        </div>
      </section>

      {/* Screenshot 3 Menu List Block 1 */}
      <section className="bg-[#181B1A] border border-white/10 rounded-xl divide-y divide-white/5 overflow-hidden">
        <button
          type="button"
          onClick={() => document.getElementById('profile-game-history')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.03] cursor-pointer"
        >
          <div className="flex items-center gap-3 shrink-0">
            <History className="w-5 h-5 text-[#FACC15]" />
            <span className="text-sm font-medium text-white">{t.myRecords}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-[#1BB64E] text-right truncate">
              Details, records, reports, recover balance
            </span>
            <ChevronRight className="w-4 h-4 text-[#7D8C85] shrink-0" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setManageWithdrawOpen((v) => !v)}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.03] cursor-pointer"
        >
          <div className="flex items-center gap-3 shrink-0">
            <CreditCard className="w-5 h-5 text-red-400" />
            <span className="text-sm font-medium text-white">{t.manageWithdrawal}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-[#A3B3AC] truncate max-w-[180px]">
              {savedWithdrawAccount || 'Bind account'}
            </span>
            <ChevronRight className="w-4 h-4 text-[#7D8C85] shrink-0" />
          </div>
        </button>
      </section>

      {/* Screenshot 3 Menu List Block 2 */}
      <section className="bg-[#181B1A] border border-white/10 rounded-xl divide-y divide-white/5 overflow-hidden">
        {[
          {
            label: t.invite,
            hint: 'Invite 1 person Rs 250',
            hintGreen: true,
            icon: Users,
            onClick: onOpenRewards,
          },
          {
            label: t.profile,
            hint: `KYC: ${userProfile?.kycStatus || 'unverified'}`,
            hintGreen: userProfile?.kycStatus === 'verified',
            icon: UserCheck,
            onClick: () => document.getElementById('kyc-section')?.scrollIntoView({ behavior: 'smooth' }),
          },
          {
            label: t.withdrawPassword,
            hint: userProfile?.withdrawPasswordHash ? t.withdrawPasswordSet : t.withdrawPasswordNotSet,
            hintGreen: Boolean(userProfile?.withdrawPasswordHash),
            icon: KeyRound,
            onClick: () => document.getElementById('withdraw-password-card')?.scrollIntoView({ behavior: 'smooth' }),
          },
          {
            label: t.securityCenter,
            hint: userProfile?.isFrozen ? 'Review' : 'Active & Clear',
            hintGreen: !userProfile?.isFrozen,
            icon: ShieldCheck,
            onClick: () => document.getElementById('security-section')?.scrollIntoView({ behavior: 'smooth' }),
          },
          {
            label: t.languageLabel,
            hint: t.languageName,
            hintGreen: true,
            icon: Globe,
            onClick: onToggleLang,
          },
          {
            label: t.faq,
            hint: '24/7 Support Desk',
            hintGreen: false,
            icon: HelpCircle,
            onClick: onOpenSupport,
          },
          {
            label: t.rewardFeedback,
            hint: 'Send ticket',
            hintGreen: false,
            icon: MessageSquarePlus,
            onClick: onOpenSupport,
          },
        ].map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={row.label}
              type="button"
              onClick={row.onClick}
              className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.03] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-[#1BB64E] shrink-0" />
                <span className="text-sm font-medium text-white">{row.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${row.hintGreen ? 'text-[#1BB64E] font-medium' : 'text-[#A3B3AC]'}`}>
                  {row.hint}
                </span>
                <ChevronRight className="w-4 h-4 text-[#7D8C85]" />
              </div>
            </button>
          );
        })}
      </section>

      {/* KYC & Security Center Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          id="kyc-section"
          onSubmit={handleSubmitKyc}
          className="lg:col-span-6 bg-[#181B1A] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <FileCheck2 className="w-5 h-5 text-[#1BB64E]" />
              <div>
                <h2 className="text-lg font-bold text-white">KYC Identity Verification</h2>
                <p className="text-xs text-[#A3B3AC]">Required for withdrawals above Rs 10,000</p>
              </div>
            </div>
            <span
              className={`text-xs font-semibold capitalize ${
                userProfile?.kycStatus === 'verified'
                  ? 'text-[#1BB64E]'
                  : userProfile?.kycStatus === 'rejected'
                    ? 'text-red-400'
                    : 'text-[#FACC15]'
              }`}
            >
              {userProfile?.kycStatus || 'unverified'}
            </span>
          </div>

          {kycProfile?.reviewNote && (
            <div className="p-3 rounded-xl bg-[#111312] border border-white/10 text-xs text-[#D1DCD7]">
              Compliance Note: {kycProfile.reviewNote}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs text-[#A3B3AC]">Legal Full Name</label>
              <input
                type="text"
                required
                disabled={userProfile?.kycStatus === 'verified'}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="As shown on ID document"
                className="w-full bg-[#111312] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#A3B3AC]">Mobile Number</label>
              <input
                type="text"
                required
                disabled={userProfile?.kycStatus === 'verified'}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full bg-[#111312] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#A3B3AC]">Document Type</label>
              <select
                disabled={userProfile?.kycStatus === 'verified'}
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as any)}
                className="w-full bg-[#111312] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white disabled:opacity-50"
              >
                <option value="CNIC">CNIC</option>
                <option value="Passport">Passport</option>
                <option value="DrivingLicense">Driving License</option>
                <option value="Aadhaar">Aadhaar</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#A3B3AC]">Document Number</label>
              <input
                type="text"
                required
                disabled={userProfile?.kycStatus === 'verified'}
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="42101-XXXXXXX-X"
                className="w-full bg-[#111312] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#A3B3AC]">Country</label>
              <input
                type="text"
                required
                disabled={userProfile?.kycStatus === 'verified'}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-[#111312] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#A3B3AC]">Residential Address</label>
              <input
                type="text"
                required
                disabled={userProfile?.kycStatus === 'verified'}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, City"
                className="w-full bg-[#111312] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || userProfile?.kycStatus === 'verified'}
            className="w-full py-3 px-4 rounded-xl bg-[#1BB64E] hover:bg-[#169C42] disabled:bg-[#202825] disabled:text-[#A3B3AC] text-white font-semibold text-sm cursor-pointer"
          >
            {userProfile?.kycStatus === 'verified'
              ? 'Identity Verified'
              : submitting
                ? 'Encrypting & Submitting...'
                : 'Submit KYC Verification'}
          </button>
        </form>

        {/* Security & Fraud Prevention Posture */}
        <div
          id="security-section"
          className="lg:col-span-6 bg-[#181B1A] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <ShieldCheck className="w-5 h-5 text-[#1BB64E]" />
            <div>
              <h2 className="text-lg font-bold text-white">Security Center & Compliance</h2>
              <p className="text-xs text-[#A3B3AC]">Real-time anti-fraud and AML risk guardrails</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111312] border border-white/10 rounded-xl p-4">
              <div className="text-xs text-[#A3B3AC]">Account Standing</div>
              <div className={`text-base font-bold mt-1 ${userProfile?.isFrozen ? 'text-red-400' : 'text-[#1BB64E]'}`}>
                {userProfile?.isFrozen ? 'Frozen (Review)' : 'Active & Clear'}
              </div>
            </div>
            <div className="bg-[#111312] border border-white/10 rounded-xl p-4">
              <div className="text-xs text-[#A3B3AC]">Fraud Risk Score</div>
              <div className="font-mono text-base font-bold text-white mt-1 tabular-nums">
                {userProfile?.fraudScore ?? 0} / 100
              </div>
            </div>
          </div>

          {/* Withdraw Password Setup & Update */}
          <form
            id="withdraw-password-card"
            onSubmit={handleSaveWithdrawPassword}
            className="bg-[#111312] border border-white/10 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-white text-xs sm:text-sm">
                <KeyRound className="w-4 h-4 text-[#1BB64E]" />
                <span>{t.withdrawPassword}</span>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  userProfile?.withdrawPasswordHash
                    ? 'bg-[#1BB64E]/15 text-[#1BB64E]'
                    : 'bg-amber-500/15 text-[#FACC15]'
                }`}
              >
                {userProfile?.withdrawPasswordHash ? t.withdrawPasswordSet : t.withdrawPasswordNotSet}
              </span>
            </div>

            {userProfile?.withdrawPasswordHash && (
              <input
                type="password"
                required
                placeholder="Current Withdraw Password"
                value={currentWdPass}
                onChange={(e) => {
                  setCurrentWdPass(e.target.value);
                  setWdPassMsg(null);
                }}
                className="w-full bg-[#181B1A] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#1BB64E]"
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="password"
                required
                placeholder={userProfile?.withdrawPasswordHash ? 'New Withdraw Password' : 'Set Withdraw Password (4-24 chars)'}
                value={newWdPass}
                onChange={(e) => {
                  setNewWdPass(e.target.value);
                  setWdPassMsg(null);
                }}
                className="w-full bg-[#181B1A] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#1BB64E]"
              />
              <input
                type="password"
                required
                placeholder="Confirm Withdraw Password"
                value={confirmWdPass}
                onChange={(e) => {
                  setConfirmWdPass(e.target.value);
                  setWdPassMsg(null);
                }}
                className="w-full bg-[#181B1A] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#1BB64E]"
              />
            </div>

            {wdPassMsg && (
              <div className={`text-xs font-medium ${wdPassMsg.ok ? 'text-[#1BB64E]' : 'text-red-400'}`}>
                {wdPassMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={wdPassSaving}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1BB64E] hover:bg-[#169C42] disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
            >
              {wdPassSaving
                ? 'Saving...'
                : userProfile?.withdrawPasswordHash
                  ? 'Update Withdraw Password'
                  : 'Set Withdraw Password'}
            </button>
          </form>

          <div className="space-y-2.5 text-xs text-[#D1DCD7] bg-[#111312] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Lock className="w-4 h-4 text-[#1BB64E]" />
              <span>Active Protections</span>
            </div>
            <p className="text-[#A3B3AC]">
              • Salted SHA-256 Withdraw Password protection required before every payout request.
            </p>
            <p className="text-[#A3B3AC]">
              • PII data isolated in encrypted owner-only Firestore private subcollection.
            </p>
            <p className="text-[#A3B3AC]">
              • Automated velocity monitoring flags rapid payout requests and unverified high-value withdrawals.
            </p>
            <p className="text-[#A3B3AC]">
              • Every game round is logged immutably for transparent auditing.
            </p>
          </div>
        </div>
      </div>

      {/* Game History Ledger */}
      <section
        id="profile-game-history"
        className="bg-[#181B1A] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#1BB64E]" />
            <h3 className="text-lg font-bold text-white">My Records (Game History)</h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                'all',
                'aviator',
                'chicken-road',
                'slots',
                'lucky-dice',
                'jili-cards',
                'cricket',
                'big-small',
                'teen-patti',
                'wheel',
                'roulette',
                'poker',
              ] as const
            ).map((g) => (
              <button
                key={g}
                onClick={() => setGameFilter(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                  gameFilter === g ? 'bg-[#1BB64E] text-white' : 'bg-[#111312] text-[#A3B3AC] hover:text-white'
                }`}
              >
                {g.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#A3B3AC]">
                <th className="py-2.5 font-medium">Game</th>
                <th className="py-2.5 font-medium">Round Details</th>
                <th className="py-2.5 font-medium text-right">Stake</th>
                <th className="py-2.5 font-medium text-right">Multiplier</th>
                <th className="py-2.5 font-medium text-right">Payout</th>
                <th className="py-2.5 font-medium text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#A3B3AC]">
                    No bets recorded yet. Play any game to populate your ledger.
                  </td>
                </tr>
              )}
              {filteredHistory.map((rec) => (
                <tr key={rec.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 font-semibold text-white capitalize">{rec.game.replace('-', ' ')}</td>
                  <td className="py-2.5 text-[#A3B3AC] max-w-[260px] truncate">{rec.details}</td>
                  <td className="py-2.5 font-mono text-right text-white tabular-nums">{formatRs(rec.betAmount)}</td>
                  <td className="py-2.5 font-mono text-right text-[#D1DCD7] tabular-nums">{rec.multiplier.toFixed(2)}x</td>
                  <td className="py-2.5 font-mono text-right text-[#FACC15] tabular-nums">{formatRs(rec.payout)}</td>
                  <td
                    className={`py-2.5 font-mono text-right font-semibold tabular-nums ${
                      rec.profit >= 0 ? 'text-[#1BB64E]' : 'text-red-400'
                    }`}
                  >
                    {rec.profit >= 0 ? '+' : ''}
                    {formatRs(rec.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
