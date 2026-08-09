import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../config/api';
import { accessToken, renewAccessToken } from '../services/api';

export default function useRealtime(enabled, onEvent, options = {}) {
  const callback = useRef(onEvent);
  const seenEventIds = useRef(new Set());
  const lastEventId = useRef('');
  const [state, setState] = useState({ status: enabled ? 'connecting' : 'disabled', lastEventAt: null, error: '' });
  useEffect(() => { callback.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'disabled', lastEventAt: null, error: '' });
      return undefined;
    }
    const controller = new AbortController();
    let retryTimer;
    let stopped = false;
    let attempts = 0;

    const connect = async () => {
      setState((current) => ({ ...current, status: attempts ? 'reconnecting' : 'connecting', error: '' }));
      try {
        let token = accessToken() || await renewAccessToken();
        const headers = { Authorization: `Bearer ${token}` };
        if (lastEventId.current) headers['Last-Event-ID'] = lastEventId.current;
        let response = await fetch(`${API_URL}/realtime/stream`, { headers, signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          token = await renewAccessToken();
          headers.Authorization = `Bearer ${token}`;
          response = await fetch(`${API_URL}/realtime/stream`, { headers, signal: controller.signal });
        }
        if (!response.ok || !response.body) throw new Error('Canal en vivo no disponible');
        attempts = 0;
        setState((current) => ({ ...current, status: 'connected', error: '' }));
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
            const streamId = packet.match(/^id:\s*(.+)$/m)?.[1] || null;
            const raw = packet.match(/^data:\s*(.+)$/m)?.[1];
            let data = {};
            try { data = raw ? JSON.parse(raw) : {}; } catch {}
            const eventId = data.eventId || streamId;
            if (eventId && seenEventIds.current.has(eventId)) continue;
            if (eventId) {
              lastEventId.current = eventId;
              seenEventIds.current.add(eventId);
              if (seenEventIds.current.size > 300) seenEventIds.current.delete(seenEventIds.current.values().next().value);
            }
            const receivedAt = new Date().toISOString();
            setState({ status: 'connected', lastEventAt: receivedAt, error: '' });
            callback.current?.({ event, data, eventId, receivedAt });
          }
        }
        if (!stopped) throw new Error('Se cerró el canal en vivo');
      } catch (error) {
        if (stopped || error.name === 'AbortError') return;
        attempts += 1;
        const initialDelay = Math.min(Math.max(Number(options.initialReconnectMs || 1500), 500), 10_000);
        const maximumDelay = Math.min(Math.max(Number(options.maxReconnectMs || 30_000), 5_000), 120_000);
        const delay = Math.min(maximumDelay, initialDelay * 2 ** Math.min(attempts, 6));
        setState((current) => ({ ...current, status: navigator.onLine ? 'reconnecting' : 'offline', error: error.message }));
        retryTimer = window.setTimeout(connect, delay);
      }
    };
    void connect();
    return () => { stopped = true; controller.abort(); window.clearTimeout(retryTimer); };
  }, [enabled, options.initialReconnectMs, options.maxReconnectMs]);

  return state;
}
