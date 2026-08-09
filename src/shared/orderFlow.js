export const DELIVERY_ORDER_STEPS = ['Nuevo', 'En preparación', 'Listo', 'En camino', 'Entregado'];
export const EXTERNAL_DELIVERY_ORDER_STEPS = ['Nuevo', 'En preparación', 'Listo', 'Asignado externo', 'Entregado al operador externo', 'En camino', 'Entregado'];
export const PICKUP_ORDER_STEPS = ['Nuevo', 'En preparación', 'Listo', 'Entregado'];

const ORDER_STATUS_META = Object.freeze({
  Nuevo: { label: 'Recibido', description: 'Pendiente de enviar a cocina.', tone: 'received', color: '#3B82F6', background: 'rgba(59,130,246,.14)' },
  'En preparación': { label: 'En cocina', description: 'El equipo está preparando el pedido.', tone: 'preparing', color: '#F59E0B', background: 'rgba(245,158,11,.14)' },
  Listo: { label: 'Listo para despacho', description: 'Disponible para que un domiciliario lo acepte.', tone: 'ready', color: '#06B6D4', background: 'rgba(6,182,212,.14)' },
  'Asignado externo': { label: 'Operador asignado', description: 'La empresa aliada fue seleccionada y recogerá el pedido.', tone: 'external-assigned', color: '#8B5CF6', background: 'rgba(139,92,246,.14)' },
  'Entregado al operador externo': { label: 'Entregado al operador', description: 'Distrito BG entregó físicamente el pedido al aliado logístico.', tone: 'external-handoff', color: '#0EA5E9', background: 'rgba(14,165,233,.14)' },
  'En camino': { label: 'En reparto', description: 'El domiciliario se dirige al cliente.', tone: 'delivery', color: '#D4A017', background: 'rgba(212,160,23,.16)' },
  Entregado: { label: 'Entregado', description: 'El pedido fue recibido por el cliente.', tone: 'delivered', color: '#22C55E', background: 'rgba(34,197,94,.14)' },
  Cancelado: { label: 'Cancelado', description: 'El pedido salió del flujo operativo.', tone: 'cancelled', color: '#EF4444', background: 'rgba(239,68,68,.14)' },
  'Pendiente Pago': { label: 'Pago pendiente', description: 'Requiere confirmar o completar el pago.', tone: 'payment', color: '#8B5CF6', background: 'rgba(139,92,246,.14)' },
});

const DELIVERY_STATUS_META = Object.freeze({
  Pendiente: { label: 'Disponible', description: 'El pedido está listo para ser aceptado.', tone: 'ready', color: '#06B6D4', background: 'rgba(6,182,212,.14)' },
  Aceptado: { label: 'Aceptado', description: 'El pedido quedó reservado para este domiciliario.', tone: 'accepted', color: '#8B5CF6', background: 'rgba(139,92,246,.14)' },
  Recogido: { label: 'Recogido', description: 'El pedido salió del restaurante.', tone: 'picked-up', color: '#F59E0B', background: 'rgba(245,158,11,.14)' },
  'Asignado externo': { label: 'Operador asignado', description: 'La empresa aliada fue seleccionada.', tone: 'external-assigned', color: '#8B5CF6', background: 'rgba(139,92,246,.14)' },
  'Entregado al operador externo': { label: 'Entregado al operador', description: 'El aliado logístico ya recibió el pedido.', tone: 'external-handoff', color: '#0EA5E9', background: 'rgba(14,165,233,.14)' },
  'En camino': { label: 'En reparto', description: 'La entrega está en curso.', tone: 'delivery', color: '#D4A017', background: 'rgba(212,160,23,.16)' },
  Entregado: { label: 'Entregado', description: 'La entrega fue finalizada.', tone: 'delivered', color: '#22C55E', background: 'rgba(34,197,94,.14)' },
  Cancelado: { label: 'Cancelado', description: 'La entrega fue cancelada.', tone: 'cancelled', color: '#EF4444', background: 'rgba(239,68,68,.14)' },
});

export function isDeliveryOrder(deliveryType) {
  return String(deliveryType || '').trim().toLowerCase() === 'domicilio';
}

export function orderSteps(deliveryType, providerType) {
  if (!isDeliveryOrder(deliveryType)) return PICKUP_ORDER_STEPS;
  return String(providerType || '').startsWith('external_') ? EXTERNAL_DELIVERY_ORDER_STEPS : DELIVERY_ORDER_STEPS;
}

export function orderStatusMeta(status, context = {}) {
  const options = typeof context === 'string' ? { deliveryType: context } : context;
  const normalized = status === 'Completado' ? 'Entregado' : String(status || 'Nuevo');
  const base = ORDER_STATUS_META[normalized] || { label: normalized, description: 'Estado operativo del pedido.', tone: 'neutral', color: '#9CA3AF', background: 'rgba(156,163,175,.14)' };
  if (normalized === 'Nuevo' && !isDeliveryOrder(options.deliveryType)) {
    return { ...base, label: 'Pedido recibido' };
  }
  if (normalized === 'Listo' && !isDeliveryOrder(options.deliveryType)) {
    return { ...base, label: 'Listo para recoger', description: 'El cliente puede recogerlo en el restaurante.' };
  }
  if (normalized === 'Listo' && options.hasDriver) {
    if (String(options.deliveryStatus || '') === 'Aceptado') {
      return { ...base, label: 'Aceptado por domiciliario', description: 'El pedido está reservado; el domiciliario debe confirmar la salida.' };
    }
    return { ...base, label: 'Domiciliario asignado', description: 'Pendiente de aceptación por el domiciliario.' };
  }
  return base;
}

export function deliveryStatusMeta(status) {
  const normalized = String(status || 'Pendiente');
  return DELIVERY_STATUS_META[normalized] || { label: normalized, description: 'Estado operativo de la entrega.', tone: 'neutral', color: '#9CA3AF', background: 'rgba(156,163,175,.14)' };
}

export function orderStatusLabel(status, deliveryType) {
  return orderStatusMeta(status, { deliveryType }).label;
}
