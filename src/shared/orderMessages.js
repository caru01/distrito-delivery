import { normalizeUnicodeText } from './unicode.js';

export function formatCop(value) {
  const amount = Number(value);
  return `$${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString('es-CO')}`;
}

export function normalizeWhatsAppPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 10 ? `57${digits}` : digits;
}

// Los iconos se expresan como puntos de codigo para que ningun editor, servidor o
// proceso de build pueda reinterpretar sus bytes antes de llegar al navegador.
const WHATSAPP_ICONS = Object.freeze({
  burger: '\u{1F354}',
  delivery: '\u{1F69A}',
  store: '\u{1F3EA}',
  pin: '\u{1F4CD}',
  tracking: '\u{1F50E}',
  cart: '\u{1F6D2}',
  note: '\u{1F4DD}',
  card: '\u{1F4B3}',
  cash: '\u{1F4B5}',
  change: '\u{1F4B0}',
  bank: '\u{1F3E6}',
  celebrate: '\u{1F973}',
  heart: '\u2764\uFE0F',
});

export function normalizeWhatsAppMessage(value) {
  return normalizeUnicodeText(value);
}

export function createWhatsAppUrl(phone, message) {
  const normalizedMessage = normalizeWhatsAppMessage(message);
  return `https://wa.me/${normalizeWhatsAppPhone(phone)}?text=${encodeURIComponent(normalizedMessage)}`;
}

function paymentLines({ paymentMethod, cashAmount, change, transferBank }) {
  const isCash = String(paymentMethod || '').toLowerCase() === 'efectivo';
  const lines = [`${WHATSAPP_ICONS.card} Medio de pago: ${isCash ? 'Efectivo' : 'Transferencia'}`];
  if (isCash) {
    lines.push(`${WHATSAPP_ICONS.cash} Paga con: ${formatCop(cashAmount)}`);
    lines.push(`${WHATSAPP_ICONS.change} Cambio: ${formatCop(change)}`);
  } else if (transferBank) {
    lines.push(`${WHATSAPP_ICONS.bank} Entidad: ${transferBank}`);
  }
  return lines;
}

export function buildNewOrderWhatsAppMessage({
  orderId,
  customer = {},
  items = [],
  trackingUrl,
  subtotal = 0,
  deliveryFee = 0,
  total = 0,
  change = 0,
  restaurantName = 'Distrito BG',
}) {
  const orderNumber = String(orderId || 0).padStart(4, '0');
  const isDelivery = String(customer.deliveryType || '').toLowerCase() === 'domicilio';
  const lines = [
    `${WHATSAPP_ICONS.burger} NUEVA ORDEN #${orderNumber}`,
    '',
    `Hola ${restaurantName}, soy ${customer.name}. Me gustaría hacer un pedido.`,
    '',
    'Datos del cliente',
    `Cliente: ${customer.name}`,
    `Teléfono: ${customer.phone}`,
    '',
  ];

  if (isDelivery) {
    lines.push(
      `${WHATSAPP_ICONS.delivery} Entrega a domicilio`,
      `Dirección: ${customer.address || ''}`,
      `Barrio: ${customer.barrio || ''}`,
    );
    if (customer.apartment) lines.push(`Apartamento: ${customer.apartment}`);
    if (customer.tower) lines.push(`Torre: ${customer.tower}`);
    if (customer.floor) lines.push(`Piso: ${customer.floor}`);
    if (customer.reference) lines.push(`Referencia: ${customer.reference}`);
  } else {
    lines.push(
      `${WHATSAPP_ICONS.store} RECOGER EN LOCAL`,
      '',
      `${WHATSAPP_ICONS.pin} ${restaurantName}`,
      'Tu pedido estará disponible para recoger en nuestro establecimiento.',
    );
  }

  lines.push(
    '',
    `${WHATSAPP_ICONS.tracking} Rastrear pedido:`,
    trackingUrl,
    '',
    `${WHATSAPP_ICONS.cart} Detalle del pedido`,
    '',
  );
  items.forEach((item) => {
    const quantity = Number(item.quantity || item.qty || 1);
    lines.push(`\u2022 ${quantity}x ${item.title || item.name || 'Producto'} \u2014 ${formatCop(Number(item.price || 0) * quantity)}`);
  });
  if (customer.comment) lines.push('', `${WHATSAPP_ICONS.note} Observaciones: ${customer.comment}`);
  lines.push('', ...paymentLines({
    paymentMethod: customer.paymentMethod,
    cashAmount: customer.cashAmount,
    change,
    transferBank: customer.transferBank === 'nequi' ? 'Nequi' : customer.transferBank ? 'Llave Bre-B' : '',
  }));
  if (isDelivery && Number(deliveryFee) > 0) lines.push(`${WHATSAPP_ICONS.delivery} Domicilio: ${formatCop(deliveryFee)}`);
  lines.push(
    '',
    `TOTAL A PAGAR: ${formatCop(total || (Number(subtotal) + Number(deliveryFee)))}`,
    '',
    `¡Gracias por elegir ${restaurantName}! ${WHATSAPP_ICONS.heart}`,
  );
  return normalizeWhatsAppMessage(lines.join('\n'));
}

export function buildReadyOrderWhatsAppMessage({
  orderId, trackingUrl, restaurantName = 'Distrito BG', deliveryType,
  providerType, externalCompanyName, status,
}) {
  const orderNumber = String(orderId || 0).padStart(4, '0');
  const isPickup = String(deliveryType || '').toLowerCase() !== 'domicilio';
  if (isPickup) {
    return normalizeWhatsAppMessage([
      `${WHATSAPP_ICONS.burger} ${restaurantName}`,
      '',
      '¡Buenas noticias!',
      `Tu pedido #${orderNumber} ya está listo para recoger. ${WHATSAPP_ICONS.celebrate}`,
      '',
      'Puedes consultar el estado de tu pedido aquí:',
      '',
      `${WHATSAPP_ICONS.tracking} ${trackingUrl}`,
      '',
      `${WHATSAPP_ICONS.pin} Te esperamos en ${restaurantName}.`,
      '',
      `¡Gracias por elegirnos! ${WHATSAPP_ICONS.heart}`,
    ].join('\n'));
  }
  if (String(providerType || '').startsWith('external_')) {
    const alreadyDispatched = ['Entregado al operador externo', 'En camino', 'Entregado'].includes(status);
    return normalizeWhatsAppMessage([
      `${WHATSAPP_ICONS.burger} ${restaurantName}`,
      '',
      alreadyDispatched ? '¡Tu pedido ya salió!' : '¡Tu pedido ya tiene operador logístico!',
      '',
      `${WHATSAPP_ICONS.delivery} En esta ocasión tu pedido será entregado por nuestro operador logístico aliado${externalCompanyName ? ` ${externalCompanyName}` : ''}.`,
      alreadyDispatched ? 'Puedes consultar su avance por estados aquí:' : 'Te avisaremos en el seguimiento cuando salga hacia tu dirección.',
      '',
      `${WHATSAPP_ICONS.tracking} ${trackingUrl}`,
      '',
      `Gracias por elegir ${restaurantName} ${WHATSAPP_ICONS.heart}`,
    ].join('\n'));
  }
  return normalizeWhatsAppMessage([
    `${WHATSAPP_ICONS.burger} ${restaurantName}`,
    '',
    '¡Buenas noticias!',
    `Tu pedido #${orderNumber} está listo y pronto será entregado al domiciliario.`,
    '',
    'Puedes seguir su estado aquí:',
    '',
    `${WHATSAPP_ICONS.tracking} ${trackingUrl}`,
    '',
    `¡Gracias por elegirnos! ${WHATSAPP_ICONS.heart}`,
  ].join('\n'));
}
