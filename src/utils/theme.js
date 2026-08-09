const HEX = /^#[0-9A-Fa-f]{6}$/;

export function applyDeliveryTheme(settings = {}) {
  const root = document.documentElement;
  const colors = {
    '--gold': settings.delivery_primary_color,
    '--gold-light': settings.delivery_primary_color,
    '--ink': settings.delivery_background_color,
    '--surface': settings.delivery_surface_color,
    '--surface-2': settings.delivery_surface_color,
    '--delivery-text': settings.delivery_text_color,
  };
  Object.entries(colors).forEach(([key, value]) => {
    if (HEX.test(String(value || ''))) root.style.setProperty(key, value);
  });
  const fonts = {
    modern: "Manrope, 'Inter', sans-serif",
    friendly: "'Poppins', 'Nunito', sans-serif",
    classic: "Georgia, 'Times New Roman', serif",
    system: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  };
  root.style.setProperty('--delivery-font', fonts[settings.delivery_font_family] || fonts.modern);
  root.dataset.cardStyle = settings.delivery_card_style || 'rounded';
  document.title = settings.delivery_page_title || 'Distrito BG Delivery';
}
