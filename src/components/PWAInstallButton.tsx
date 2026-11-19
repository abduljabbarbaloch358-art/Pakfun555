import { useState } from 'react';
import { Download, Smartphone, Share, X, CheckCircle2, Copy, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Lang, TRANSLATIONS } from '../lib/i18n';

interface Props {
  lang: Lang;
  variant?: 'compact' | 'banner';
}

export function PWAInstallButton({ lang, variant = 'compact' }: Props) {
  const { isInstalled, isIOS, isInIframe, hasNativePrompt, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const t = TRANSLATIONS[lang];

  if (isInstalled) return null;

  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '';

  const handleCopyUrl = () => {
    if (!appUrl) return;
    navigator.clipboard.writeText(appUrl).catch(() => {});
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1800);
  };

  const handleClick = async () => {
    if (hasNativePrompt) {
      const ok = await install();
      if (!ok) setShowGuide(true);
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleClick}
          aria-label={t.installApp}
          className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-[#1E2220] hover:bg-[#262B29] border border-[#1BB64E]/40 text-xs font-bold text-[#1BB64E] whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{t.installApp}</span>
        </button>
      ) : (
        <div className="bg-gradient-to-r from-[#17231C] via-[#181B1A] to-[#1A201D] border border-[#1BB64E]/35 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="PAKFUN App Logo"
              className="w-10 h-10 rounded-xl border border-[#F5B82E]/50 object-cover shrink-0 shadow-md"
            />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#1BB64E] shrink-0" />
                <span>{t.installAppTitle}</span>
              </div>
              <p className="text-[11px] text-[#A3B3AC] truncate">{t.installAppDesc}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClick}
            className="px-3.5 py-2 rounded-lg bg-[#1BB64E] hover:bg-[#169C42] text-white text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.installApp}</span>
          </button>
        </div>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-[#161B19] border border-white/15 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="PAKFUN App Icon"
                  className="w-12 h-12 rounded-2xl border border-[#F5B82E]/50 object-cover shadow-lg"
                />
                <div>
                  <h3 className="text-base font-bold text-white">PAKFUN Mobile App</h3>
                  <p className="text-xs text-[#A3B3AC]">
                    {lang === 'ur'
                      ? 'فون کی ہوم اسکرین پر براہِ راست انسٹال کریں'
                      : 'Instant Web App — installs directly to your Home Screen'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="p-1.5 rounded-lg bg-[#1E2220] text-[#A3B3AC] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInIframe && (
              <div className="rounded-xl bg-amber-500/15 border border-amber-400/30 p-3 text-xs text-amber-200 space-y-2">
                <p>
                  {lang === 'ur'
                    ? 'آپ ابھی پری ویو فریم کے اندر ہیں — براؤزر یہاں انسٹال پاپ اپ نہیں دکھاتا۔ لنک کاپی کر کے سیدھا Chrome میں کھولیں:'
                    : 'You are viewing inside an embedded preview frame. Copy and open this link directly in Chrome to install:'}
                </p>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>
                    {copiedUrl
                      ? lang === 'ur'
                        ? 'لنک کاپی ہو گیا!'
                        : 'Link Copied!'
                      : lang === 'ur'
                        ? 'ایپ لنک کاپی کریں'
                        : 'Copy App Link'}
                  </span>
                </button>
              </div>
            )}

            {isIOS ? (
              <ol className="space-y-2.5 text-xs text-[#E5EAE7] bg-[#111513] border border-white/10 rounded-xl p-3.5">
                <li className="flex items-center gap-2">
                  <Share className="w-4 h-4 text-[#1BB64E] shrink-0" />
                  <span>
                    {lang === 'ur'
                      ? '1. Safari براؤزر میں نیچے Share بٹن دبائیں'
                      : '1. Tap the Share icon at the bottom of Safari'}
                  </span>
                </li>
                <li>
                  {lang === 'ur'
                    ? '2. فہرست میں "Add to Home Screen" منتخب کریں'
                    : '2. Scroll and tap "Add to Home Screen"'}
                </li>
                <li>
                  {lang === 'ur'
                    ? '3. اوپر "Add" دبائیں — PAKFUN ایپ لوگو کے ساتھ فون میں آ جائے گی!'
                    : '3. Tap "Add" — PAKFUN launches full-screen with its logo!'}
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-xs text-[#E5EAE7] bg-[#111513] border border-white/10 rounded-xl p-3.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#1BB64E] shrink-0" />
                  <span>
                    {lang === 'ur'
                      ? '1. پبلک لنک کو براہِ راست Google Chrome میں کھولیں (واٹس ایپ/فیس بک براؤزر میں نہیں)'
                      : '1. Open the public link directly in Google Chrome (not WhatsApp/FB in-app browser)'}
                  </span>
                </li>
                <li>
                  {lang === 'ur'
                    ? '2. Chrome کے اوپر دائیں جانب 3 نقطوں (⋮) پر کلک کریں'
                    : '2. Tap Chrome menu (⋮) in the top-right corner'}
                </li>
                <li>
                  {lang === 'ur'
                    ? '3. "Add to Home screen" یا "Install app" دبائیں — PAKFUN لوگو والی ایپ انسٹال ہو جائے گی!'
                    : '3. Tap "Install app" or "Add to Home screen" to install PAKFUN with its logo!'}
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#1BB64E] hover:bg-[#169C42] text-white text-xs font-bold cursor-pointer"
            >
              {lang === 'ur' ? 'سمجھ گیا' : 'Got It'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
