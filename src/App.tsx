import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Home,
  Wallet,
  Gift,
  User,
  Headphones,
  Shield,
  Volume2,
  VolumeX,
  LogOut,
  ArrowLeft,
  Coins,
  Link2,
  Flame,
  Clock,
  Star,
  LayoutGrid,
  Menu,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Spade,
  Gamepad2,
  Dices,
  Crown,
  Globe,
} from 'lucide-react';
import { Lang, TRANSLATIONS } from './lib/i18n';
import { GameId, NavView } from './types/platform';
import { usePlatformData } from './hooks/usePlatformData';
import { useMultiplayerWs, AviatorCashoutEvent, RouletteSettledEvent } from './hooks/useMultiplayerWs';
import { AuthModal } from './components/AuthModal';
import { AviatorGame } from './components/games/AviatorGame';
import { LuckyWheelGame } from './components/games/LuckyWheelGame';
import { SlotsGame } from './components/games/SlotsGame';
import { RouletteGame } from './components/games/RouletteGame';
import { PokerGame } from './components/games/PokerGame';
import { ChickenRoadGame } from './components/games/ChickenRoadGame';
import { LuckyDiceGame } from './components/games/LuckyDiceGame';
import { BigSmallGame } from './components/games/BigSmallGame';
import { TeenPattiGame } from './components/games/TeenPattiGame';
import { JiliCardsGame } from './components/games/JiliCardsGame';
import { CricketGame } from './components/games/CricketGame';
import { GameCoverArt } from './components/GameCoverArt';
import { GAME_CATALOG, GameCatalogItem, LobbyCategory } from './lib/gameCatalog';
import { WalletView } from './components/WalletView';
import { RewardsVipView } from './components/RewardsVipView';
import { ProfileKycView } from './components/ProfileKycView';
import { LiveDashboardView } from './components/LiveDashboardView';
import { SupportView } from './components/SupportView';
import { AdminPanelView } from './components/AdminPanelView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { formatRs } from './lib/vip';
import { soundFx } from './lib/sound';

export default function App() {
  const {
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
  } = usePlatformData();

  const [view, setView] = useState<NavView>(() => {
    if (typeof window === 'undefined') return 'lobby';
    const params = new URLSearchParams(window.location.search);
    const pathSlug = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const paramView = (params.get('view') || window.location.hash.replace('#', '') || pathSlug).toLowerCase();
    const validViews: NavView[] = ['lobby', 'games', 'wallet', 'rewards', 'dashboard', 'profile', 'support', 'admin'];
    return validViews.includes(paramView as NavView) ? (paramView as NavView) : 'lobby';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const pathSlug = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      const paramView = (params.get('view') || window.location.hash.replace('#', '') || pathSlug).toLowerCase();
      const validViews: NavView[] = ['lobby', 'games', 'wallet', 'rewards', 'dashboard', 'profile', 'support', 'admin'];
      if (validViews.includes(paramView as NavView)) {
        setView(paramView as NavView);
      }
    };
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  const navigateToPlayerLobby = () => {
    setCategoryFilter('Hot');
    setProviderFilter('All');
    setSubFilter('all');
    setView('lobby');
    if (typeof window !== 'undefined') {
      try {
        if (window.location.search || window.location.hash || window.location.pathname !== '/') {
          window.history.replaceState({}, '', '/');
        }
      } catch {
        // Ignore history restriction
      }
    }
  };
  const [activeCatalogItem, setActiveCatalogItem] = useState<GameCatalogItem>(GAME_CATALOG[0]);
  const [categoryFilter, setCategoryFilter] = useState<LobbyCategory>('Hot');
  const [providerFilter, setProviderFilter] = useState<'All' | GameCatalogItem['provider']>('All');
  const [subFilter, setSubFilter] = useState<'all' | 'hot' | 'recent' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshingBal, setRefreshingBal] = useState(false);
  const [walletInitialTab, setWalletInitialTab] = useState<'deposit' | 'withdrawal'>('deposit');
  const [savedWithdrawAccount, setSavedWithdrawAccount] = useState('');
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('pakfun_fav_games');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('pakfun_recent_games');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [lastRouletteSettled, setLastRouletteSettled] = useState<RouletteSettledEvent | null>(null);
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    try {
      return window.localStorage.getItem('pakfun_lang') === 'ur' ? 'ur' : 'en';
    } catch {
      return 'en';
    }
  });

  const t = TRANSLATIONS[lang];
  const toggleLang = () => {
    setLang((prev) => {
      const next: Lang = prev === 'en' ? 'ur' : 'en';
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('pakfun_lang', next);
        } catch {
          // Ignore storage error
        }
      }
      return next;
    });
  };

  const activeGame = activeCatalogItem.engine;

  const playerId = authUser?.uid || 'guest-viewer';
  const playerName = userProfile?.displayName || authUser?.displayName || 'Guest';
  const spendableBalance = (userProfile?.balance ?? 0) + (userProfile?.bonusBalance ?? 0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = `pakfun_withdraw_${authUser?.uid || 'guest'}`;
      setSavedWithdrawAccount(window.localStorage.getItem(key) || '');
    } catch {
      setSavedWithdrawAccount('');
    }
  }, [authUser?.uid]);

  const saveWithdrawAccount = (account: string) => {
    setSavedWithdrawAccount(account);
    if (typeof window !== 'undefined') {
      try {
        const key = `pakfun_withdraw_${authUser?.uid || 'guest'}`;
        window.localStorage.setItem(key, account);
      } catch {
        // Ignore storage errors in restricted environments
      }
    }
  };

  const toggleFavorite = (slug: string) => {
    setFavoriteSlugs((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [slug, ...prev];
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('pakfun_fav_games', JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
      }
      return next;
    });
  };

  const pushRecentSlug = (slug: string) => {
    setRecentSlugs((prev) => {
      const next = [slug, ...prev.filter((s) => s !== slug)].slice(0, 16);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('pakfun_recent_games', JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
      }
      return next;
    });
  };

  const openWallet = (tab: 'deposit' | 'withdrawal') => {
    setWalletInitialTab(tab);
    setView('wallet');
  };

  const handleAviatorCashoutEvent = (_ev: AviatorCashoutEvent) => {
    // Handled inside AviatorGame effect for the local round
  };

  const handleRouletteSettledEvent = (ev: RouletteSettledEvent) => {
    setLastRouletteSettled(ev);
  };

  const {
    connected: wsConnected,
    onlineCount,
    aviator,
    roulette,
    poker,
    liveFeed,
    sendEvent,
  } = useMultiplayerWs(playerId, playerName, handleAviatorCashoutEvent, handleRouletteSettledEvent);

  const filteredGames = useMemo(() => {
    return GAME_CATALOG.filter((g) => {
      const catOk =
        categoryFilter === 'All'
          ? true
          : categoryFilter === 'Hot'
            ? g.hot
            : g.category === categoryFilter;
      const provOk = providerFilter === 'All' ? true : g.provider === providerFilter;
      const subOk =
        subFilter === 'all'
          ? true
          : subFilter === 'hot'
            ? g.hot
            : subFilter === 'favorites'
              ? favoriteSlugs.includes(g.slug)
              : recentSlugs.includes(g.slug);
      const q = searchQuery.trim().toLowerCase();
      const searchOk =
        !q ||
        g.title.toLowerCase().includes(q) ||
        g.subtitle.toLowerCase().includes(q) ||
        g.provider.toLowerCase().includes(q);
      return catOk && provOk && subOk && searchOk;
    });
  }, [categoryFilter, providerFilter, subFilter, favoriteSlugs, recentSlugs, searchQuery]);

  useEffect(() => {
    setPageIndex(0);
  }, [categoryFilter, providerFilter, subFilter, searchQuery]);

  const isStudioBrowserMode =
    categoryFilter !== 'Hot' || providerFilter !== 'All' || subFilter !== 'all';
  const pageSize = isStudioBrowserMode ? 15 : 16;
  const totalPages = Math.max(1, Math.ceil(filteredGames.length / pageSize));
  const safePage = Math.min(pageIndex, totalPages - 1);
  const pagedGames = filteredGames.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const openCatalogGame = (item: GameCatalogItem) => {
    setActiveCatalogItem(item);
    pushRecentSlug(item.slug);
    setView('games');
  };

  const openGame = (id: GameId) => {
    const found = GAME_CATALOG.find((g) => g.engine === id) || GAME_CATALOG[0];
    setActiveCatalogItem(found);
    pushRecentSlug(found.slug);
    setView('games');
  };

  const triggerRefreshBalance = () => {
    setRefreshingBal(true);
    setTimeout(() => setRefreshingBal(false), 450);
  };

  const toggleSound = () => {
    soundFx.muted = !muted;
    setMuted(!muted);
  };

  const broadcastWin = (game: string, betAmount: number, multiplier: number, payout: number) => {
    sendEvent('game:record_feed', {
      playerName,
      game,
      betAmount,
      multiplier,
      payout,
    });
  };

  return (
    <div className="min-h-screen bg-[#111312] text-[#F1F5F3] flex flex-col pb-20 md:pb-8">
      <OfflineIndicator lang={lang} />
      {/* Sticky Top Header (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-30 bg-[#141716]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark + App Logo */}
          <button
            onClick={() => {
              setCategoryFilter('Hot');
              setProviderFilter('All');
              setSubFilter('all');
              setView('lobby');
            }}
            className="font-display text-xl font-black tracking-tight whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
          >
            <img
              src="/pwa-192x192.png"
              alt="PAKFUN Logo"
              className="w-8 h-8 rounded-lg border border-[#F5B82E]/50 object-cover shrink-0"
            />
            <span>
              <span className="text-white">PAK</span>
              <span className="text-[#1BB64E]">FUN</span>
            </span>
          </button>

          {/* Zone 2: Concise Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {(
              [
                { id: 'lobby', label: t.home },
                { id: 'games', label: t.games },
                { id: 'rewards', label: t.promo },
                { id: 'dashboard', label: t.live },
                { id: 'profile', label: t.profile },
              ] as { id: NavView; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  view === item.id ? 'text-[#1BB64E]' : 'text-[#A3B3AC] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Install App + Language Toggle + Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton lang={lang} variant="compact" />
            <button
              type="button"
              onClick={toggleLang}
              aria-label="Switch language between English and Urdu"
              className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-[#1E2220] hover:bg-[#262B29] border border-white/10 text-xs font-bold text-[#E5EAE7] whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#1BB64E] shrink-0" />
              <span>{lang === 'en' ? 'EN | اردو' : 'اردو | EN'}</span>
            </button>

            {authUser ? (
              <button
                onClick={() => openWallet('deposit')}
                className="relative px-4 py-2 rounded-xl bg-[#1BB64E] hover:bg-[#169C42] text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {t.deposit}
                <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 rounded-full bg-red-600 text-[9px] font-extrabold text-white leading-none">
                  +3%
                </span>
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#1BB64E] hover:bg-[#169C42] text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {t.signIn}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* PAKFUN Balance & Menu Toolbar (Screenshot 1 Top Bar Controls) */}
      <div className="border-b border-white/5 bg-[#161918]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu drawer"
              className="relative w-9 h-9 rounded-lg bg-[#1E2220] hover:bg-[#262B29] flex items-center justify-center text-white cursor-pointer"
            >
              <Menu className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 px-1 rounded-full bg-red-600 text-[9px] font-bold text-white leading-tight">
                7
              </span>
            </button>

            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <span className="w-5 h-5 rounded-full bg-[#EAB308] text-[#111312] font-black text-[10px] inline-flex items-center justify-center shrink-0">
                Rs
              </span>
              <span className="font-mono font-bold text-[#FACC15] underline underline-offset-4 tabular-nums">
                {authUser ? spendableBalance.toFixed(2) : '0.00'}
              </span>
              <button
                type="button"
                onClick={triggerRefreshBalance}
                aria-label="Refresh wallet balance"
                className="p-1 text-[#1BB64E] hover:text-white cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingBal ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {userProfile && (
              <span className="hidden md:inline text-xs text-[#A3B3AC]">
                {userProfile.vipTier} · KYC {userProfile.kycStatus}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setView('admin')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  view === 'admin'
                    ? 'bg-[#F5B82E] text-[#111312]'
                    : 'bg-[#F5B82E]/15 text-[#FACC15] border border-[#F5B82E]/40 hover:bg-[#F5B82E]/25'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{t.admin}</span>
              </button>
            )}

            <button
              onClick={() => setView('support')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                view === 'support' ? 'bg-[#1BB64E] text-white' : 'bg-[#1E2220] text-[#D1DCD7] hover:text-white'
              }`}
            >
              <Headphones className="w-3.5 h-3.5 text-[#1BB64E]" />
              <span className="hidden sm:inline">{t.support}</span>
            </button>

            <button
              onClick={() => setView('profile')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                view === 'profile' ? 'bg-[#1BB64E] text-white' : 'bg-[#1E2220] text-[#D1DCD7] hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.profile}</span>
            </button>

            <button
              onClick={toggleSound}
              aria-label={muted ? 'Unmute game sounds' : 'Mute game sounds'}
              className="p-1.5 rounded-lg bg-[#1E2220] text-[#A3B3AC] hover:text-white cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {authUser && (
              <button
                onClick={signOutUser}
                aria-label="Sign out"
                className="p-1.5 rounded-lg bg-[#1E2220] text-[#A3B3AC] hover:text-red-400 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Slide-out Navigation Drawer (Screenshot 1 Top-Left Menu) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-[#161918] border-r border-white/10 h-full p-5 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="font-display text-xl font-black flex items-center gap-2">
                  <img
                    src="/pwa-192x192.png"
                    alt="PAKFUN Logo"
                    className="w-7 h-7 rounded-lg border border-[#F5B82E]/50 object-cover"
                  />
                  <span>
                    <span className="text-white">PAK</span>
                    <span className="text-[#1BB64E]">FUN</span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg bg-[#1E2220] text-[#A3B3AC] hover:text-white cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                {[
                  { label: t.homeLobby, icon: Home, action: () => setView('lobby') },
                  { label: t.depositBonus, icon: Wallet, action: () => openWallet('deposit') },
                  { label: t.withdrawCash, icon: Coins, action: () => openWallet('withdrawal') },
                  { label: t.promoDaily, icon: Gift, action: () => setView('rewards') },
                  { label: t.liveDashboard, icon: Gamepad2, action: () => setView('dashboard') },
                  { label: t.profileKyc, icon: User, action: () => setView('profile') },
                  { label: t.customerSupport, icon: Headphones, action: () => setView('support') },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        item.action();
                        setDrawerOpen(false);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium text-[#E5EAE7] hover:bg-[#1BB64E]/15 hover:text-[#1BB64E] flex items-center gap-3 cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-[#1BB64E]" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setView('admin');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-bold text-[#FACC15] bg-[#F5B82E]/10 hover:bg-[#F5B82E]/20 border border-[#F5B82E]/30 flex items-center gap-3 cursor-pointer"
                  >
                    <Shield className="w-4 h-4 text-[#FACC15]" />
                    <span>{t.adminPortal}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              {authUser ? (
                <button
                  type="button"
                  onClick={() => {
                    signOutUser();
                    setDrawerOpen(false);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-500/15 text-red-400 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t.signOut}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalOpen(true);
                    setDrawerOpen(false);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1BB64E] text-white text-xs font-bold cursor-pointer"
                >
                  {t.signInWithGoogle}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 max-w-sm bg-[#191F1D] border border-white/15 rounded-xl px-4 py-3 shadow-2xl text-xs font-medium text-white">
          <span
            className={
              toast.type === 'success'
                ? 'text-[#1BB64E]'
                : toast.type === 'error'
                  ? 'text-red-400'
                  : 'text-[#FACC15]'
            }
          >
            {toast.text}
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 space-y-5">
        {!authReady ? (
          <div className="py-24 text-center text-sm text-[#A3B3AC]">Loading PAKFUN platform...</div>
        ) : (
          <>
            {/* LOBBY VIEW (Screenshot 1 Home + Screenshot 2 Studio Browser) */}
            {view === 'lobby' && (
              <div className="space-y-4">
                {/* Link Wallet Free Draw Banner (Screenshot 1 & 3) */}
                <section className="bg-[#181B1A] border border-white/10 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Link2 className="w-4 h-4 text-[#1BB64E] shrink-0" />
                    <div className="text-xs sm:text-sm font-medium text-[#E5EAE7] truncate">
                      {t.linkBannerPrefix}{' '}
                      <span className="font-mono font-extrabold text-[#FACC15]">777,777.70</span> {t.linkBannerSuffix}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setView('profile')}
                      className="px-3.5 py-1.5 rounded-lg bg-[#1BB64E] hover:bg-[#169C42] text-white text-xs font-bold cursor-pointer"
                    >
                      {savedWithdrawAccount ? t.linked : t.link}
                    </button>
                    <button
                      type="button"
                      onClick={triggerRefreshBalance}
                      aria-label="Refresh wallet link status"
                      className="p-1 text-[#1BB64E] hover:text-white cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingBal ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </section>

                {/* PAKFUN Mobile App Install Banner */}
                <PWAInstallButton lang={lang} variant="banner" />

                {/* Full-width Search Bar (Screenshot 1 & 2) */}
                <div className="relative w-full">
                  <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#1C1F1D] border border-white/10 rounded-full pl-4 pr-11 py-2.5 text-xs sm:text-sm text-white placeholder:text-[#7D8C85] focus:outline-none focus:border-[#1BB64E]"
                  />
                  <Search className="w-4 h-4 text-[#1BB64E] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Main Category Pill Strip (Screenshot 1) */}
                {!isStudioBrowserMode ? (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {(
                      [
                        { id: 'Hot', label: t.catHot, icon: Flame },
                        { id: 'Slot', label: t.catSlot, icon: Coins },
                        { id: 'Mini Games', label: t.catMini, icon: Dices },
                        { id: 'Cards', label: t.catCards, icon: Spade },
                        { id: 'All', label: t.catAll, icon: LayoutGrid },
                      ] as const
                    ).map((cat) => {
                      const Icon = cat.icon;
                      const active = categoryFilter === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setCategoryFilter(cat.id);
                            setProviderFilter('All');
                            setSubFilter('all');
                          }}
                          className={`px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#1BB64E] text-white'
                              : 'bg-[#191C1B] text-[#D1DCD7] hover:text-white border border-white/10'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Screenshot 2 Sub-Page Category Header (< Cards v) */
                  <div className="flex items-center justify-between gap-3 bg-[#181B1A] border border-white/10 rounded-xl px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter('Hot');
                        setProviderFilter('All');
                        setSubFilter('all');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#A3B3AC] hover:text-white cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>{t.home}</span>
                    </button>

                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {(['Cards', 'Slot', 'Mini Games', 'All'] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${
                            categoryFilter === cat
                              ? 'bg-[#1BB64E] text-white'
                              : 'text-[#A3B3AC] hover:text-white'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Game Browser Area */}
                {!isStudioBrowserMode ? (
                  /* SCREENSHOT 1: Hot Header + Dense 4-Column Mobile / 6-Column Desktop Square Poster Grid */
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                        <Flame className="w-4 h-4 text-[#FACC15]" />
                        <span>{t.catHot}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCategoryFilter('All')}
                          className="text-xs font-medium text-[#A3B3AC] hover:text-white cursor-pointer"
                        >
                          {t.catAll}
                        </button>
                        <div className="inline-flex items-center rounded-lg bg-[#191C1B] border border-white/10 overflow-hidden">
                          <button
                            type="button"
                            disabled={safePage === 0}
                            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                            aria-label="Previous games page"
                            className="px-2.5 py-1.5 text-[#A3B3AC] hover:text-white disabled:opacity-35 cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={safePage >= totalPages - 1}
                            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                            aria-label="Next games page"
                            className="px-2.5 py-1.5 text-[#A3B3AC] hover:text-white disabled:opacity-35 border-l border-white/10 cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
                      {pagedGames.map((game) => (
                        <button
                          key={game.slug}
                          onClick={() => openCatalogGame(game)}
                          className="group text-center cursor-pointer flex flex-col items-center"
                        >
                          <GameCoverArt
                            game={game}
                            isFavorite={favoriteSlugs.includes(game.slug)}
                            onToggleFavorite={toggleFavorite}
                          />
                          <div className="mt-1.5 px-0.5 text-[11px] sm:text-xs font-medium text-[#E5EAE7] leading-tight line-clamp-2 w-full">
                            {game.title}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : (
                  /* SCREENSHOT 2: Left Studio Sidebar + All/Hot/Recent/Favorites + 3-Col Grid + Page Numbers */
                  <section className="flex gap-2.5 sm:gap-4 items-start">
                    {/* Left Studio Sidebar */}
                    <aside className="w-[74px] sm:w-24 shrink-0 flex flex-col gap-2">
                      {(
                        [
                          { id: 'All', label: categoryFilter === 'All' ? 'All' : categoryFilter, icon: Spade },
                          { id: 'JILI', label: 'JILI', icon: Crown },
                          { id: 'WG', label: 'WG', icon: Dices },
                          { id: 'PG', label: 'PG', icon: Flame },
                          { id: 'JDB', label: 'JDB', icon: Coins },
                          { id: 'SPRIBE', label: 'SPRIBE', icon: Gamepad2 },
                          { id: 'IN', label: 'IN', icon: Star },
                          { id: 'PAKFUN', label: 'PAKFUN', icon: LayoutGrid },
                        ] as const
                      ).map((prov) => {
                        const Icon = prov.icon;
                        const active = providerFilter === prov.id;
                        return (
                          <button
                            key={prov.id}
                            onClick={() => setProviderFilter(prov.id)}
                            className={`py-2.5 px-1.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#1BB64E] text-white shadow-lg shadow-[#1BB64E]/25'
                                : 'bg-[#1C1F1D] text-[#A3B3AC] hover:text-white border border-white/5'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-[#1BB64E]'}`} />
                            <span className="text-[10px] sm:text-[11px] font-bold leading-none truncate max-w-full">
                              {prov.label}
                            </span>
                          </button>
                        );
                      })}
                    </aside>

                    {/* Right Sub-Filters + 3-Column Grid + Pagination */}
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                        {(
                          [
                            { id: 'all', label: t.subAll },
                            { id: 'hot', label: t.subHot },
                            { id: 'recent', label: t.subRecent },
                            { id: 'favorites', label: t.subFavorites },
                          ] as const
                        ).map((sf) => (
                          <button
                            key={sf.id}
                            onClick={() => setSubFilter(sf.id)}
                            className={`py-2 px-2 rounded-lg text-[11px] sm:text-xs font-semibold truncate cursor-pointer transition-colors ${
                              subFilter === sf.id
                                ? 'bg-[#1BB64E] text-white'
                                : 'bg-[#1C1F1D] text-[#A3B3AC] hover:text-white border border-white/5'
                            }`}
                          >
                            {sf.label}
                          </button>
                        ))}
                      </div>

                      {pagedGames.length === 0 ? (
                        <div className="bg-[#181B1A] border border-white/10 rounded-xl p-8 text-center space-y-2">
                          <div className="text-sm font-bold text-white">{t.noGamesMatch}</div>
                          <p className="text-xs text-[#A3B3AC]">
                            {subFilter === 'favorites'
                              ? 'Tap the star icon on any game card to save it to Favorites.'
                              : subFilter === 'recent'
                                ? 'Open any game to see it in Recent history.'
                                : 'Try another studio or filter tab.'}
                          </p>
                          <button
                            onClick={() => {
                              setProviderFilter('All');
                              setSubFilter('all');
                              setSearchQuery('');
                            }}
                            className="mt-2 px-4 py-2 rounded-lg bg-[#1BB64E] text-white text-xs font-bold cursor-pointer"
                          >
                            {t.showAll}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
                            {pagedGames.map((game) => (
                              <button
                                key={game.slug}
                                onClick={() => openCatalogGame(game)}
                                className="group text-center cursor-pointer flex flex-col items-center"
                              >
                                <GameCoverArt
                                  game={game}
                                  isFavorite={favoriteSlugs.includes(game.slug)}
                                  onToggleFavorite={toggleFavorite}
                                />
                                <div className="mt-1.5 px-0.5 text-[11px] sm:text-xs font-medium text-[#E5EAE7] leading-tight line-clamp-2 w-full">
                                  {game.title}
                                </div>
                              </button>
                            ))}
                          </div>

                          {/* Screenshot 2 Numeric Pagination Bar (< 1 2 >) */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-2">
                              <button
                                type="button"
                                disabled={safePage === 0}
                                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                                className="w-8 h-8 rounded-lg bg-[#1C1F1D] border border-white/10 text-[#A3B3AC] hover:text-white disabled:opacity-40 flex items-center justify-center cursor-pointer"
                                aria-label="Previous page"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              {Array.from({ length: totalPages }, (_, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setPageIndex(idx)}
                                  className={`w-8 h-8 rounded-lg font-mono text-xs font-bold cursor-pointer ${
                                    safePage === idx
                                      ? 'bg-[#1BB64E] text-white'
                                      : 'bg-[#1C1F1D] border border-white/10 text-[#A3B3AC] hover:text-white'
                                  }`}
                                >
                                  {idx + 1}
                                </button>
                              ))}
                              <button
                                type="button"
                                disabled={safePage >= totalPages - 1}
                                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                                className="w-8 h-8 rounded-lg bg-[#1C1F1D] border border-white/10 text-[#A3B3AC] hover:text-white disabled:opacity-40 flex items-center justify-center cursor-pointer"
                                aria-label="Next page"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                )}

                {/* Supported Payment Gateways & Platform Guarantees */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/10 pt-6">
                  <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5 space-y-2">
                    <h3 className="text-sm font-bold text-white">{t.paymentsTitle}</h3>
                    <p className="text-xs text-[#A3B3AC] leading-relaxed">
                      {t.paymentsDesc}
                    </p>
                    <button
                      onClick={() => openWallet('deposit')}
                      className="text-xs font-semibold text-[#19B954] hover:underline cursor-pointer"
                    >
                      {t.openCashier}
                    </button>
                  </div>

                  <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5 space-y-2">
                    <h3 className="text-sm font-bold text-white">{t.vipTitle}</h3>
                    <p className="text-xs text-[#A3B3AC] leading-relaxed">
                      {t.vipDesc}
                    </p>
                    <button
                      onClick={() => setView('rewards')}
                      className="text-xs font-semibold text-[#19B954] hover:underline cursor-pointer"
                    >
                      {t.viewVipPerks}
                    </button>
                  </div>

                  <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5 space-y-2">
                    <h3 className="text-sm font-bold text-white">{t.securityTitle}</h3>
                    <p className="text-xs text-[#A3B3AC] leading-relaxed">
                      {t.securityDesc}
                    </p>
                    <button
                      onClick={() => setView('profile')}
                      className="text-xs font-semibold text-[#19B954] hover:underline cursor-pointer"
                    >
                      {t.verifyKyc}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* GAMES ARENA VIEW */}
            {view === 'games' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => setView('lobby')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A3B3AC] hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t.backToLobby}</span>
                  </button>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {GAME_CATALOG.map((g) => (
                      <button
                        key={g.slug}
                        onClick={() => {
                          setActiveCatalogItem(g);
                          pushRecentSlug(g.slug);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          activeCatalogItem.slug === g.slug
                            ? 'bg-[#19B954] text-white'
                            : 'bg-[#171D1B] text-[#A3B3AC] hover:text-white border border-white/10'
                        }`}
                      >
                        {g.title}
                      </button>
                    ))}
                  </div>
                </div>

                {activeGame === 'aviator' && (
                  <AviatorGame
                    aviator={aviator}
                    playerId={playerId}
                    playerName={playerName}
                    walletBalance={spendableBalance}
                    isSignedIn={Boolean(authUser)}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onPlaceWsBet={(amount, auto) =>
                      sendEvent('aviator:bet', { playerId, playerName, amount, autoCashout: auto })
                    }
                    onCashoutWs={() => sendEvent('aviator:cashout', { playerId })}
                    onSettleBet={recordGamePlay}
                  />
                )}

                {activeGame === 'wheel' && (
                  <LuckyWheelGame
                    gameTitle={activeCatalogItem.title}
                    provider={activeCatalogItem.provider}
                    tagline={activeCatalogItem.tagline}
                    playerName={playerName}
                    walletBalance={spendableBalance}
                    isSignedIn={Boolean(authUser)}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onSettleBet={recordGamePlay}
                    onBroadcastWin={broadcastWin}
                  />
                )}

                {activeGame === 'slots' && (
                  <SlotsGame
                    slotTitle={activeCatalogItem.title}
                    slotProvider={activeCatalogItem.provider}
                    slotTagline={activeCatalogItem.tagline}
                    walletBalance={spendableBalance}
                    isSignedIn={Boolean(authUser)}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onSettleBet={recordGamePlay}
                    onBroadcastWin={broadcastWin}
                  />
                )}

                {activeGame === 'roulette' && (
                  <RouletteGame
                    roulette={roulette}
                    playerId={playerId}
                    walletBalance={spendableBalance}
                    isSignedIn={Boolean(authUser)}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onPlaceBetWs={(betType, amount) =>
                      sendEvent('roulette:bet', { playerId, playerName, betType, amount })
                    }
                    onSettleBet={recordGamePlay}
                    lastSettledEvent={lastRouletteSettled}
                  />
                )}

                {activeGame === 'poker' && (
                  <PokerGame
                    poker={poker}
                    playerId={playerId}
                    playerName={playerName}
                    walletBalance={spendableBalance}
                    isSignedIn={Boolean(authUser)}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    sendEvent={sendEvent}
                    onSettleBet={recordGamePlay}
                  />
                )}

                {activeGame === 'chicken-road' && (
                  <ChickenRoadGame
                    gameTitle={activeCatalogItem.title}
                    provider={activeCatalogItem.provider}
                    tagline={activeCatalogItem.tagline}
                    walletBalance={spendableBalance}
                    isSignedIn={Boolean(authUser)}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onSettleBet={recordGamePlay}
                    onBroadcastWin={broadcastWin}
                  />
                )}

                {activeGame === 'lucky-dice' && (
                  <LuckyDiceGame
                    playerId={playerId}
                    playerName={playerName}
                    walletBalance={spendableBalance}
                    isSignedIn={Boolean(authUser)}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onOpenDeposit={() => openWallet('deposit')}
                    onSettleBet={recordGamePlay}
                    onBroadcastWin={broadcastWin}
                  />
                )}

                {activeGame === 'big-small' && (
                  <BigSmallGame
                    gameTitle={activeCatalogItem.title}
                    provider={activeCatalogItem.provider}
                    tagline={activeCatalogItem.tagline}
                    mode={activeCatalogItem.slug.includes('7') ? '7up7down' : 'big-small'}
                    walletBalance={spendableBalance}
                    isSignedIn={Boolean(authUser)}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onOpenDeposit={() => openWallet('deposit')}
                    onSettleBet={recordGamePlay}
                    onBroadcastWin={broadcastWin}
                  />
                )}

                {activeGame === 'teen-patti' && (
                  <TeenPattiGame
                    walletBalance={spendableBalance}
                    isSignedIn={Boolean(authUser)}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onSettleBet={recordGamePlay}
                    onBroadcastWin={broadcastWin}
                  />
                )}

                {activeGame === 'jili-cards' && (
                  <JiliCardsGame
                    gameTitle={activeCatalogItem.title}
                    provider={activeCatalogItem.provider}
                    tagline={activeCatalogItem.tagline}
                    leftLabel={activeCatalogItem.cardsConfig?.leftLabel}
                    rightLabel={activeCatalogItem.cardsConfig?.rightLabel}
                    tieLabel={activeCatalogItem.cardsConfig?.tieLabel}
                    walletBalance={spendableBalance}
                    isSignedIn={Boolean(authUser)}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onSettleBet={recordGamePlay}
                    onBroadcastWin={broadcastWin}
                  />
                )}

                {activeGame === 'cricket' && (
                  <CricketGame
                    walletBalance={spendableBalance}
                    isSignedIn={Boolean(authUser)}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onSettleBet={recordGamePlay}
                    onBroadcastWin={broadcastWin}
                  />
                )}
              </div>
            )}

            {/* WALLET & PAYMENT GATEWAYS */}
            {view === 'wallet' && (
              <WalletView
                userProfile={userProfile}
                transactions={transactions}
                paymentGateways={paymentGateways}
                initialTab={walletInitialTab}
                savedWithdrawAccount={savedWithdrawAccount}
                onOpenManageWithdraw={() => setView('profile')}
                isSignedIn={Boolean(authUser)}
                onRequireAuth={() => setAuthModalOpen(true)}
                onSetWithdrawPassword={setWithdrawPassword}
                onSubmitPayment={submitPaymentRequest}
              />
            )}

            {/* REWARDS, VIP & REFERRALS */}
            {view === 'rewards' && (
              <RewardsVipView
                userProfile={userProfile}
                isSignedIn={Boolean(authUser)}
                onRequireAuth={() => setAuthModalOpen(true)}
                onClaimDaily={claimDailyReward}
                onApplyReferral={applyReferralCode}
              />
            )}

            {/* LIVE DASHBOARD */}
            {view === 'dashboard' && (
              <LiveDashboardView
                wsConnected={wsConnected}
                onlineCount={onlineCount}
                userProfile={userProfile}
                gameHistory={gameHistory}
                liveFeed={liveFeed}
                aviator={aviator}
                roulette={roulette}
                poker={poker}
                onLaunchGame={openGame}
              />
            )}

            {/* PROFILE, KYC & GAME HISTORY */}
            {view === 'profile' && (
              <ProfileKycView
                lang={lang}
                onToggleLang={toggleLang}
                userProfile={userProfile}
                kycProfile={kycProfile}
                gameHistory={gameHistory}
                isSignedIn={Boolean(authUser)}
                isAdmin={isAdmin}
                savedWithdrawAccount={savedWithdrawAccount}
                onSaveWithdrawAccount={saveWithdrawAccount}
                onOpenWallet={openWallet}
                onOpenAdmin={() => setView('admin')}
                onOpenRewards={() => setView('rewards')}
                onOpenSupport={() => setView('support')}
                onRequireAuth={() => setAuthModalOpen(true)}
                onSetWithdrawPassword={setWithdrawPassword}
                onSubmitKyc={submitKyc}
              />
            )}

            {/* 24/7 CUSTOMER SUPPORT */}
            {view === 'support' && (
              <SupportView
                tickets={supportTickets}
                isSignedIn={Boolean(authUser)}
                onRequireAuth={() => setAuthModalOpen(true)}
                onCreateTicket={createSupportTicket}
                onReplyTicket={(t, txt) => replySupportTicket(t, txt, false)}
              />
            )}

            {/* ADMIN PANEL (Strictly isolated to explicit /?view=admin or /admin route) */}
            {view === 'admin' && isAdmin && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-[#171D1B] border border-[#F5B82E]/30 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#FACC15]">
                    <Shield className="w-4 h-4" />
                    <span>PAKFUN Owner Admin Panel</span>
                  </div>
                  <button
                    type="button"
                    onClick={navigateToPlayerLobby}
                    className="px-3.5 py-1.5 rounded-xl bg-[#1E2220] hover:bg-[#262B29] text-white text-xs font-semibold cursor-pointer"
                  >
                    Exit to Player Lobby
                  </button>
                </div>
                <AdminPanelView
                  allUsers={allUsers}
                  allTransactions={allTransactions}
                  adminKycQueue={adminKycQueue}
                  fraudAlerts={fraudAlerts}
                  allTickets={allTickets}
                  allGameHistory={allGameHistory}
                  paymentGateways={paymentGateways}
                  onProcessTx={adminProcessTransaction}
                  onReviewKyc={adminReviewKyc}
                  onToggleFreeze={adminToggleFreezeUser}
                  onAdjustBalance={adminAdjustUserBalance}
                  onUpdateFraudAlert={adminUpdateFraudAlert}
                  onSavePaymentGateways={adminUpdatePaymentGateways}
                  onReplyTicket={replySupportTicket}
                />
              </div>
            )}

            {view === 'admin' && !isAdmin && (
              <div className="max-w-lg mx-auto bg-[#171D1B] border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#F5B82E]/15 border border-[#F5B82E]/30 flex items-center justify-center mx-auto">
                  <Shield className="w-6 h-6 text-[#F5B82E]" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold text-white">Restricted Access</h2>
                  <p className="text-xs text-[#A3B3AC] leading-relaxed">
                    {authUser
                      ? 'This portal is restricted to the verified platform owner only.'
                      : 'Sign in with the authorized owner Google account to continue.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  {!authUser ? (
                    <button
                      onClick={signInWithGoogle}
                      className="px-5 py-2.5 rounded-xl bg-[#19B954] hover:bg-[#16A34A] text-white text-xs font-bold cursor-pointer"
                    >
                      Owner Sign In
                    </button>
                  ) : (
                    <button
                      onClick={signOutUser}
                      className="px-5 py-2.5 rounded-xl bg-[#202825] hover:bg-[#2A3531] text-white text-xs font-semibold cursor-pointer"
                    >
                      Sign Out
                    </button>
                  )}
                  <button
                    onClick={navigateToPlayerLobby}
                    className="px-5 py-2.5 rounded-xl bg-[#101413] border border-white/10 text-[#A3B3AC] hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    Back to Lobby
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Online Support Button (Screenshot 1, 2 & 3) */}
      {view !== 'support' && (
        <button
          type="button"
          onClick={() => setView('support')}
          aria-label="Open 24/7 Online Support"
          className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-30 flex items-center gap-2 px-3 py-2 rounded-full bg-[#1C2320] hover:bg-[#242D29] border border-[#1BB64E]/50 shadow-xl text-xs font-bold text-white cursor-pointer"
        >
          <Headphones className="w-4 h-4 text-[#1BB64E]" />
          <span>{t.onlineSupport}</span>
        </button>
      )}

      {/* Mobile Bottom Thumb Navigation (Matches Screenshots 1 & 3) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#161918]/95 backdrop-blur-md border-t border-white/10 grid grid-cols-5 items-center">
        {[
          { id: 'lobby', label: t.home, icon: Home, badge: '' },
          { id: 'rewards', label: t.promo, icon: Gift, badge: '7' },
          { id: 'wallet', label: t.deposit, icon: Wallet, badge: '+3%' },
          { id: 'support', label: t.support, icon: Headphones, badge: '' },
          { id: 'profile', label: t.profile, icon: User, badge: '' },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = view === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'wallet') {
                  openWallet('deposit');
                } else {
                  setView(tab.id as NavView);
                }
              }}
              className={`relative min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? 'text-[#1BB64E]' : 'text-[#A3B3AC]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-3 px-1.5 py-0.2 rounded-full bg-red-600 text-[8px] font-extrabold text-white leading-tight">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <AuthModal
        open={authModalOpen}
        lang={lang}
        onClose={() => setAuthModalOpen(false)}
        onGoogleSignIn={signInWithGoogle}
        onMobileSignUp={signUpWithMobile}
        onMobileSignIn={signInWithMobile}
      />
    </div>
  );
}
