import {
  notificationAudioReady,
  playAttentionAlert,
  speakNotification,
  unlockNotificationAudio,
} from '@distrito/shared-ui';

export async function unlockDeliveryAlerts() {
  return unlockNotificationAudio();
}

export function deliveryAlertsReady() {
  return notificationAudioReady();
}

export function playNewOrderAlert(settings = {}) {
  const played = playAttentionAlert({ cycles: 5 });
  window.setTimeout(() => speakNotification('new_order', settings), 320);
  return played;
}

export function announceAvailableOrder(detail = {}) {
  window.dispatchEvent(new CustomEvent('distrito:new-order-alert', { detail }));
}
