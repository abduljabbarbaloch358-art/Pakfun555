import { Activity, Users, TrendingUp, Award } from 'lucide-react';
import { AviatorState, GameRecord, LiveFeedItem, PokerState, RouletteState, UserAccount } from '../types/platform';
import { formatRs } from '../lib/vip';

interface Props {
  wsConnected: boolean;
  onlineCount: number;
  userProfile: UserAccount | null;
  gameHistory: GameRecord[];
  liveFeed: LiveFeedItem[];
  aviator: AviatorState | null;
  roulette: RouletteState | null;
  poker: PokerState | null;
  onLaunchGame: (game: 'aviator' | 'wheel' | 'slots' | 'roulette' | 'poker') => void;
}

export function LiveDashboardView({
  wsConnected,
  onlineCount,
  userProfile,
  gameHistory,
  liveFeed,
  aviator,
  roulette,
  poker,
  onLaunchGame,
}: Props) {
  const totalProfit = gameHistory.reduce((acc, g) => acc + g.profit, 0);
  const wins = gameHistory.filter((g) => g.profit > 0).length;
  const winRate = gameHistory.length > 0 ? Math.round((wins / gameHistory.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Live KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
            <span>Active Multiplayer Players</span>
            <Users className="w-4 h-4 text-[#19B954]" />
          </div>
          <div className="font-mono text-2xl font-bold text-white mt-2 tabular-nums">
            {onlineCount} Online
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#19B954] mt-1">
            {wsConnected && <span className="w-2 h-2 rounded-full bg-[#19B954] animate-pulse" />}
            <span>{wsConnected ? 'WebSocket Connected' : 'Reconnecting...'}</span>
          </div>
        </div>

        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
            <span>Personal Wagered</span>
            <Activity className="w-4 h-4 text-[#F5B82E]" />
          </div>
          <div className="font-mono text-2xl font-bold text-white mt-2 tabular-nums">
            {formatRs(userProfile?.totalWagered ?? 0)}
          </div>
          <div className="text-xs text-[#A3B3AC] mt-1">{gameHistory.length} settled rounds</div>
        </div>

        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
            <span>Net Session P&L</span>
            <TrendingUp className="w-4 h-4 text-[#19B954]" />
          </div>
          <div
            className={`font-mono text-2xl font-bold mt-2 tabular-nums ${
              totalProfit >= 0 ? 'text-[#19B954]' : 'text-red-400'
            }`}
          >
            {totalProfit >= 0 ? '+' : ''}
            {formatRs(totalProfit)}
          </div>
          <div className="text-xs text-[#A3B3AC] mt-1">Win Rate: {winRate}%</div>
        </div>

        <div className="bg-[#171D1B] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#A3B3AC]">
            <span>VIP Standing</span>
            <Award className="w-4 h-4 text-[#F5B82E]" />
          </div>
          <div className="font-mono text-2xl font-bold text-[#F5B82E] mt-2">
            {userProfile?.vipTier || 'Bronze'}
          </div>
          <div className="text-xs text-[#A3B3AC] mt-1 tabular-nums">
            {userProfile?.vipPoints ?? 0} VIP Points
          </div>
        </div>
      </div>

      {/* Live Room Pulse + Live Winners Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-[#171D1B] border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white">Live Multiplayer Tables</h3>
          <div className="divide-y divide-white/10">
            <div className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Aviator Crash · #{aviator?.roundId || 1001}</div>
                <div className="text-xs text-[#A3B3AC]">
                  Phase: {aviator?.phase || 'betting'} · {aviator?.bets.length || 0} active bets
                </div>
              </div>
              <button
                onClick={() => onLaunchGame('aviator')}
                className="px-3.5 py-2 rounded-xl bg-[#19B954] hover:bg-[#16A34A] text-white text-xs font-semibold cursor-pointer"
              >
                Join
              </button>
            </div>

            <div className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Royal Roulette · #{roulette?.roundId || 501}</div>
                <div className="text-xs text-[#A3B3AC]">
                  Phase: {roulette?.phase || 'betting'} · {roulette?.bets.length || 0} table chips
                </div>
              </div>
              <button
                onClick={() => onLaunchGame('roulette')}
                className="px-3.5 py-2 rounded-xl bg-[#19B954] hover:bg-[#16A34A] text-white text-xs font-semibold cursor-pointer"
              >
                Join
              </button>
            </div>

            <div className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Texas Hold'em Poker · Hand #{poker?.handId || 1}</div>
                <div className="text-xs text-[#A3B3AC]">
                  Pot: {formatRs(poker?.pot || 0)} · {poker?.seats.length || 0} seated
                </div>
              </div>
              <button
                onClick={() => onLaunchGame('poker')}
                className="px-3.5 py-2 rounded-xl bg-[#19B954] hover:bg-[#16A34A] text-white text-xs font-semibold cursor-pointer"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#171D1B] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Live Payout Stream</h3>
            <span className="text-xs text-[#A3B3AC]">Real-time multiplayer wins</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#A3B3AC]">
                  <th className="py-2 font-medium">Player</th>
                  <th className="py-2 font-medium">Game</th>
                  <th className="py-2 font-medium text-right">Stake</th>
                  <th className="py-2 font-medium text-right">Multiplier</th>
                  <th className="py-2 font-medium text-right">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {liveFeed.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[#A3B3AC]">
                      Waiting for live round payouts. Place a bet in any table to see live telemetry here.
                    </td>
                  </tr>
                )}
                {liveFeed.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 font-medium text-white">{item.playerName}</td>
                    <td className="py-2.5 text-[#A3B3AC]">{item.game}</td>
                    <td className="py-2.5 font-mono text-right text-[#D1DCD7] tabular-nums">
                      {formatRs(item.betAmount)}
                    </td>
                    <td className="py-2.5 font-mono text-right text-[#19B954] tabular-nums">
                      {item.multiplier.toFixed(2)}x
                    </td>
                    <td className="py-2.5 font-mono text-right font-bold text-[#F5B82E] tabular-nums">
                      {formatRs(item.payout)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
