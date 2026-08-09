const configured = String(__DELIVERY_API_URL__ || '').trim();
const runtime = typeof window === 'undefined'
  ? ''
  : `${window.location.protocol}//${window.location.hostname}:${__DELIVERY_API_PORT__ || '3001'}`;

if (__DELIVERY_ENVIRONMENT__ === 'production' && configured !== 'https://api.distritobg.app') {
  throw new Error('Configuración de API insegura para DistritoBG Delivery');
}

export const BASE_URL = (configured && configured !== 'auto' ? configured : runtime).replace(/\/$/, '');
export const API_URL = `${BASE_URL}/api/pedidos`;

export function isSecureDeliveryContext() {
  return window.isSecureContext || (
    __DELIVERY_ENVIRONMENT__ !== 'production'
    && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  );
}
