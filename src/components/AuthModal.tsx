import { useState } from 'react';
import { ShieldCheck, X, Wallet, Award, Smartphone, Lock, User, Eye, EyeOff } from 'lucide-react';
import { Lang, TRANSLATIONS } from '../lib/i18n';

interface Props {
  open: boolean;
  lang: Lang;
  onClose: () => void;
  onGoogleSignIn: () => void;
  onMobileSignUp: (
    mobile: string,
    password: string,
    displayName?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  onMobileSignIn: (mobile: string, password: string) => Promise<{ ok: boolean; error?: string }>;
}

export function AuthModal({
  open,
  lang,
  onClose,
  onGoogleSignIn,
  onMobileSignUp,
  onMobileSignIn,
}: Props) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [displayName, setDisplayName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;
  const t = TRANSLATIONS[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    const res =
      mode === 'signup'
        ? await onMobileSignUp(mobile, password, displayName)
        : await onMobileSignIn(mobile, password);
    setSubmitting(false);
    if (res.ok) {
      setPassword('');
      onClose();
    } else if (res.error) {
      setErrorMsg(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        dir={lang === 'ur' ? 'rtl' : 'ltr'}
        className="w-full max-w-md bg-[#171D1B] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl my-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{t.authTitle}</h2>
            <p className="text-xs sm:text-sm text-[#A3B3AC] mt-1">{t.authSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#A3B3AC] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Sign Up / Sign In Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#101413] border border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              mode === 'signup' ? 'bg-[#19B954] text-white' : 'text-[#A3B3AC] hover:text-white'
            }`}
          >
            {t.tabSignUp}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              mode === 'signin' ? 'bg-[#19B954] text-white' : 'text-[#A3B3AC] hover:text-white'
            }`}
          >
            {t.tabSignIn}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#A3B3AC]">{t.labelName}</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#7D8C85] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  maxLength={48}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t.placeholderName}
                  className="w-full bg-[#101413] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-[#687670] focus:outline-none focus:border-[#19B954]"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#A3B3AC]">{t.labelMobile}</label>
            <div className="relative">
              <Smartphone className="w-4 h-4 text-[#19B954] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder={t.placeholderMobile}
                dir="ltr"
                className="w-full bg-[#101413] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-mono text-white placeholder:text-[#687670] focus:outline-none focus:border-[#19B954]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#A3B3AC]">{t.labelPassword}</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#7D8C85] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.placeholderPassword}
                dir="ltr"
                className="w-full bg-[#101413] border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-[#687670] focus:outline-none focus:border-[#19B954]"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7D8C85] hover:text-white cursor-pointer"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-xl bg-[#19B954] hover:bg-[#16A34A] disabled:opacity-50 text-white font-bold text-sm transition-colors cursor-pointer"
          >
            {submitting
              ? '...'
              : mode === 'signup'
                ? t.btnCreateAccount
                : t.btnSignInMobile}
          </button>
        </form>

        <div className="flex items-center gap-3 text-[11px] text-[#7D8C85]">
          <div className="flex-1 h-px bg-white/10" />
          <span>{t.orDivider}</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <button
          type="button"
          onClick={() => {
            onGoogleSignIn();
            onClose();
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-[#101413] hover:bg-[#1E2523] border border-white/15 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
        >
          {t.btnGoogle}
        </button>

        <div className="space-y-2 border-t border-white/10 pt-3">
          <div className="flex items-center gap-2.5 text-xs text-[#D1DCD7]">
            <Wallet className="w-3.5 h-3.5 text-[#19B954] shrink-0" />
            <span>{t.authFeature1}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-[#D1DCD7]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#19B954] shrink-0" />
            <span>{t.authFeature2}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-[#D1DCD7]">
            <Award className="w-3.5 h-3.5 text-[#F5B82E] shrink-0" />
            <span>{t.authFeature3}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
