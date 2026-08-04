import { useEffect, useRef } from 'react';
import { API_URL } from '../config/api';
import { accessToken, renewAccessToken } from '../services/api';

export default function useRealtime(enabled, onEvent) {
  const callback = useRef(onEvent);
  useEffect(() => { callback.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    let retryTimer;
    let stopped = false;

    const connect = async () => {
      try {
        let token = accessToken() || await renewAccessToken();
        let response = await fetch(`${API_URL}/realtime/stream`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          token = await renewAccessToken();
          response = await fetch(`${API_URL}/realtime/stream`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        }
        if (!response.ok || !response.body) throw new Error('Canal en vivo no disponible');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const packets = buffer.split('\n\n');
          buffer = packets.pop() || '';
          for (const packet of packets) {
            if (!packet || packet.startsWith(':')) continue;
            const event = packet.match(/^event:\s*(.+)$/m)?.[1] || 'message';
            const raw = packet.match(/^data:\s*(.+)$/m)?.[1];
            let data = {};
            try { data = raw ? JSON.parse(raw) : {}; } catch {}
            callback.current?.({ event, data });
          }
        }
        if (!stopped) retryTimer = window.setTimeout(connect, 2500);
      } catch (error) {
        if (!stopped && error.name !== 'AbortError') retryTimer = window.setTimeout(connect, 4000);
      }
    };
    connect();
    return () => { stopped = true; controller.abort(); window.clearTimeout(retryTimer); };
  }, [enabled]);
}
