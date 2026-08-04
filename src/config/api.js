const configured = String(import.meta.env.VITE_API_URL || '').trim();
const runtime = typeof window === 'undefined'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT || '3001'}`;

export const BASE_URL = (configured && configured !== 'auto' ? configured : runtime).replace(/\/$/, '');
export const API_URL = `${BASE_URL}/api/pedidos`;
