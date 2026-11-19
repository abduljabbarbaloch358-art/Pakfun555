import { useEffect, useRef, useState, useCallback } from 'react';
import { AviatorState, LiveFeedItem, PokerState, RouletteState } from '../types/platform';
import { createLocalTableEngine } from '../lib/localTableEngine';

export interface AviatorCashoutEvent {
  roundId: number;
  playerId: string;
  multiplier: number;
  payout: number;
  betAmount: number;
}

export interface RouletteSettledEvent {
  roundId: number;
  playerId: string;
  winningNumber: number;
  winningColor: 'red' | 'black' | 'green';
  wagered: number;
  payout: number;
}

export function useMultiplayerWs(
  playerId?: string,
  playerName?: string,
  onAviatorCashout?: (ev: AviatorCashoutEvent) => void,
  onRouletteSettled?: (ev: RouletteSettledEvent) => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const localEngineRef = useRef<ReturnType<typeof createLocalTableEngine> | null>(null);
  const playerIdRef = useRef(playerId);
  const playerNameRef = useRef(playerName);
  playerIdRef.current = playerId;
  playerNameRef.current = playerName;

  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [aviator, setAviator] = useState<AviatorState | null>(null);
  const [roulette, setRoulette] = useState<RouletteState | null>(null);
  const [poker, setPoker] = useState<PokerState | null>(null);
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([]);

  const cashoutCbRef = useRef(onAviatorCashout);
  const rouletteCbRef = useRef(onRouletteSettled);
  cashoutCbRef.current = onAviatorCashout;
  rouletteCbRef.current = onRouletteSettled;

  useEffect(() => {
    let active = true;
    let hasEverOpened = false;
    let reconnectTimer: number | undefined;

    function startLocalFallback() {
      if (!active || localEngineRef.current) return;
      localEngineRef.current = createLocalTableEngine(
        {
          onAviatorState: (s) => active && setAviator(s),
          onAviatorCashout: (ev) => active && cashoutCbRef.current?.(ev),
          onRouletteState: (s) => active && setRoulette(s),
          onRouletteSettled: (ev) => active && rouletteCbRef.current?.(ev),
          onPokerState: (s) => active && setPoker(s),
          onLiveFeedItem: (item) =>
            active && setLiveFeed((prev) => [item, ...prev].slice(0, 30)),
          onOnlineCount: (c) => active && setOnlineCount(c),
        },
        playerIdRef.current,
      );
      setConnected(true);
    }

    const fallbackBootTimer = window.setTimeout(() => {
      if (!hasEverOpened) startLocalFallback();
    }, 1800);

    function connect() {
      if (!active) return;
      try {
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) return;
          hasEverOpened = true;
          window.clearTimeout(fallbackBootTimer);
          if (localEngineRef.current) {
            localEngineRef.current.destroy();
            localEngineRef.current = null;
          }
          setConnected(true);
          if (playerIdRef.current) {
            ws.send(
              JSON.stringify({
                type: 'auth:identify',
                payload: { playerId: playerIdRef.current, playerName: playerNameRef.current },
              }),
            );
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'init') {
              setAviator(msg.payload.aviator);
              setRoulette(msg.payload.roulette);
              setPoker(msg.payload.poker);
              setLiveFeed(msg.payload.liveFeed || []);
              setOnlineCount(msg.payload.onlineCount || 1);
            } else if (msg.type === 'presence:count') {
              setOnlineCount(msg.payload.onlineCount || 1);
            } else if (msg.type === 'aviator:state') {
              setAviator(msg.payload);
            } else if (msg.type === 'aviator:tick') {
              setAviator((prev) => (prev ? { ...prev, multiplier: msg.payload.multiplier } : prev));
            } else if (msg.type === 'aviator:cashed_out') {
              cashoutCbRef.current?.(msg.payload);
            } else if (msg.type === 'roulette:state') {
              setRoulette(msg.payload);
            } else if (msg.type === 'roulette:settled') {
              rouletteCbRef.current?.(msg.payload);
            } else if (msg.type === 'poker:state') {
              setPoker(msg.payload);
            } else if (msg.type === 'live:feed_item') {
              setLiveFeed((prev) => [msg.payload, ...prev].slice(0, 30));
            }
          } catch {
            // Ignore invalid JSON frames
          }
        };

        ws.onclose = () => {
          if (!active) return;
          if (!hasEverOpened) {
            // Static host without WS server — switch cleanly to standalone browser engine
            startLocalFallback();
            return;
          }
          setConnected(false);
          reconnectTimer = window.setTimeout(connect, 1800);
        };

        ws.onerror = () => {
          if (!hasEverOpened) startLocalFallback();
        };
      } catch {
        startLocalFallback();
      }
    }

    connect();
    return () => {
      active = false;
      window.clearTimeout(fallbackBootTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      if (localEngineRef.current) {
        localEngineRef.current.destroy();
        localEngineRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!playerId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'auth:identify', payload: { playerId, playerName } }));
    } else if (localEngineRef.current) {
      localEngineRef.current.sendEvent('auth:identify', { playerId, playerName });
    }
  }, [playerId, playerName]);

  const sendEvent = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else if (localEngineRef.current) {
      localEngineRef.current.sendEvent(type, payload);
    }
  }, []);

  return {
    connected,
    onlineCount,
    aviator,
    roulette,
    poker,
    liveFeed,
    sendEvent,
  };
}
