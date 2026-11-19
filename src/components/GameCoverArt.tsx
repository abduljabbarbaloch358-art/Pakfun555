import { useState } from 'react';
import {
  Plane,
  Bird,
  Coins,
  Crown,
  Gem,
  Banknote,
  Sparkles,
  Flame,
  Dices,
  Spade,
  Trophy,
  RotateCw,
  CircleDot,
  Rabbit,
  Star,
  Car,
  Swords,
  Gift,
  Trees,
  Box,
  ThumbsUp,
} from 'lucide-react';
import { GameCatalogItem } from '../lib/gameCatalog';

interface Props {
  game: GameCatalogItem;
  isFavorite: boolean;
  onToggleFavorite: (slug: string) => void;
}

const RECOMMENDED_SLUGS = new Set(['7-up-down', 'andar-bahar', 'bull-bull-100']);

export function GameCoverArt({ game, isFavorite, onToggleFavorite }: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  const renderPosterArtwork = () => {
    const cls = 'w-9 h-9 sm:w-11 sm:h-11 drop-shadow-[0_4px_10px_rgba(0,0,0,0.65)]';
    let icon = <Coins className={`${cls} text-[#F5B82E]`} />;
    let tagText = '';

    switch (game.emblem) {
      case 'plane':
        icon = <Plane className={`${cls} text-rose-400 -rotate-12`} />;
        tagText = game.provider === 'SPRIBE' ? 'AVIATOR' : 'CRASH';
        break;
      case 'chicken':
        icon = <Bird className={`${cls} text-white`} />;
        tagText = game.slug === 'chicken-road-2' ? 'CHICKEN 2.0' : 'CHICKEN ROAD';
        break;
      case 'piggy':
        icon = <Coins className={`${cls} text-yellow-300`} />;
        tagText = '13000X';
        break;
      case 'garuda':
        icon = <Crown className={`${cls} text-yellow-300`} />;
        tagText = game.slug.includes('1000') ? '1000X' : '500X';
        break;
      case 'gems':
        icon = <Gem className={`${cls} text-emerald-300`} />;
        tagText = 'FORTUNE';
        break;
      case 'cash':
        icon = <Banknote className={`${cls} text-emerald-200`} />;
        tagText = 'MONEY';
        break;
      case 'bowl':
        icon = <Sparkles className={`${cls} text-yellow-300`} />;
        tagText = 'X-HUGE';
        break;
      case 'cowboy':
        icon = <Star className={`${cls} text-amber-300`} />;
        tagText = 'BOUNTY';
        break;
      case 'anubis':
        icon = <Flame className={`${cls} text-amber-300`} />;
        tagText = 'ANUBIS';
        break;
      case 'aztec':
        icon = <Crown className={`${cls} text-emerald-300`} />;
        tagText = 'AZTEC';
        break;
      case '777':
        return (
          <div className="flex flex-col items-center justify-center relative z-10">
            <span className="font-display text-2xl sm:text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-rose-500 drop-shadow-[0_3px_8px_rgba(0,0,0,0.85)]">
              {game.slug === 'fortune-bingo' ? '39' : '777'}
            </span>
            <span className="text-[9px] font-extrabold tracking-widest uppercase text-amber-200/95">
              {game.slug === 'fortune-bingo' ? 'FORTUNE BINGO' : '10000X'}
            </span>
          </div>
        );
      case 'rabbit':
        icon = <Rabbit className={`${cls} text-pink-100`} />;
        tagText = 'RABBIT 2';
        break;
      case 'dice':
        if (game.slug === 'lucky-dice') {
          return (
            <div className="flex flex-col items-center justify-center relative z-10 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-lg bg-white shadow-lg border border-black/15 flex items-center justify-center -rotate-6">
                  <span className="w-3 h-3 rounded-full bg-red-600" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-white shadow-lg border border-black/15 grid grid-cols-2 p-1.5 gap-1 rotate-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                </div>
              </div>
              <span className="mt-1.5 font-display text-[10px] sm:text-[11px] font-black text-white uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                LUCKY DICE
              </span>
            </div>
          );
        }
        icon = <Dices className={`${cls} text-white`} />;
        tagText = game.slug === '7-up-down' || game.slug === '7up7down-jili' ? '7UP 7DOWN' : 'DICE';
        break;
      case 'bigsmall':
        icon = <Dices className={`${cls} text-amber-200`} />;
        tagText = game.slug === 'sic-bo-jili' ? 'SIC BO' : 'BIG & SMALL';
        break;
      case 'cards':
      case 'poker':
      case 'baccarat':
        icon = <Spade className={`${cls} text-white`} />;
        tagText =
          game.slug === 'teen-patti'
            ? '3 PATTI'
            : game.slug === 'bull-bull-100'
              ? 'BULL 100'
              : game.slug === 'baccarat'
                ? 'BACCARAT'
                : 'CARDS';
        break;
      case 'cricket':
        icon = <Trophy className={`${cls} text-yellow-300`} />;
        tagText = 'SUPER OVER';
        break;
      case 'wheel':
        icon = <RotateCw className={`${cls} text-yellow-300`} />;
        tagText = '10X WHEEL';
        break;
      case 'roulette':
        icon = <CircleDot className={`${cls} text-rose-300`} />;
        tagText = 'ROULETTE';
        break;
      case 'dragon':
        icon = <Swords className={`${cls} text-amber-300`} />;
        tagText = 'DRAGON TIGER';
        break;
      case 'redblack':
        icon = <Crown className={`${cls} text-rose-300`} />;
        tagText = 'RED VS BLACK';
        break;
      case 'car':
        icon = <Car className={`${cls} text-sky-200`} />;
        tagText = 'AUTO CLUB';
        break;
      case 'beast':
        icon = <Crown className={`${cls} text-emerald-200`} />;
        tagText = 'SAFARI 10X';
        break;
      case 'packet':
        icon = <Gift className={`${cls} text-yellow-300`} />;
        tagText = 'BOOM';
        break;
      case 'chest':
        icon = <Box className={`${cls} text-amber-300`} />;
        tagText = game.slug === 'mines-gold' ? 'MINES GOLD' : 'DIGGER';
        break;
      case 'forest':
        icon = <Trees className={`${cls} text-emerald-200`} />;
        tagText = 'FOREST';
        break;
    }

    return (
      <div className="flex flex-col items-center justify-center relative z-10 px-1.5">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-black/25 backdrop-blur-[2px] border border-white/20 flex items-center justify-center shadow-inner">
          {icon}
        </div>
        {tagText && (
          <span className="mt-1.5 font-display text-[10px] sm:text-[11px] font-black tracking-tight text-white uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] text-center leading-none">
            {tagText}
          </span>
        )}
      </div>
    );
  };

  const isRecommended = !game.hot && RECOMMENDED_SLUGS.has(game.slug);

  return (
    <div className="aspect-square w-full bg-[#151917] rounded-xl overflow-hidden relative border border-white/10">
      {game.image && !imgFailed ? (
        <>
          <img
            src={game.image}
            alt={game.title}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-200"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/15 to-transparent pointer-events-none" />
        </>
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${game.gradient} flex flex-col items-center justify-center relative overflow-hidden`}
        >
          {/* Decorative radial shine like game posters */}
          <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white/15 blur-xl pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
          {renderPosterArtwork()}
        </div>
      )}

      {/* Top-left HOT ribbon or Orange Thumbs-up badge (Screenshot 1 & 2) */}
      {game.hot && (
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-gradient-to-r from-red-600 to-rose-500 text-[9px] font-black italic text-white tracking-wide shadow-md">
          HOT
        </span>
      )}
      {isRecommended && (
        <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
          <ThumbsUp className="w-3 h-3 text-white fill-white" />
        </span>
      )}

      {/* Top-right Favorite Star */}
      <span
        role="button"
        tabIndex={0}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(game.slug);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(game.slug);
          }
        }}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 border border-white/15 flex items-center justify-center hover:bg-black/80 cursor-pointer z-10"
      >
        <Star
          className={`w-3.5 h-3.5 ${isFavorite ? 'text-[#F5B82E] fill-[#F5B82E]' : 'text-white/80'}`}
        />
      </span>

      {/* Bottom-right Provider Badge (Screenshot 1 & 2) */}
      <span
        className={`absolute bottom-1 right-1.5 font-display text-[11px] font-black italic tracking-tight drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)] ${
          game.provider === 'WG'
            ? 'text-[#38BDF8]'
            : game.provider === 'JILI'
              ? 'text-[#FACC15]'
              : game.provider === 'JDB'
                ? 'text-[#FB923C]'
                : game.provider === 'PG'
                  ? 'text-white'
                  : game.provider === 'SPRIBE'
                    ? 'text-[#F43F5E]'
                    : 'text-[#4ADE80]'
        }`}
      >
        {game.provider}
      </span>
    </div>
  );
}
