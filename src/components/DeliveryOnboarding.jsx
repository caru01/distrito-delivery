import React from 'react';
import { CheckCircle2, Download, MapPin, ShieldCheck, Smartphone, Volume2, X } from 'lucide-react';
import { isSecureDeliveryContext } from '../config/api';

function Step({ icon: Icon, title, description, complete, children }) {
  return <article className={`onboarding-step ${complete ? 'is-complete' : ''}`}>
    <span className="onboarding-step-icon">{complete ? <CheckCircle2 /> : <Icon />}</span>
    <div><div className="onboarding-step-title"><strong>{title}</strong>{complete && <small>Listo</small>}</div><p>{description}</p>{children}</div>
  </article>;
}

export default function DeliveryOnboarding({
  open,
  installed,
  installPrompt,
  onInstall,
  gpsPermission,
  gpsError,
  onEnableGps,
  soundReady,
  onEnableSound,
  setupComplete,
  onClose,
}) {
  if (!open) return null;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const secureContext = isSecureDeliveryContext();
  const gpsReady = gpsPermission === 'granted';

  return <div className="onboarding-backdrop" role="presentation">
    <section className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="delivery-onboarding-title">
      <header>
        <span className="onboarding-logo"><ShieldCheck /></span>
        <div><span className="eyebrow">{setupComplete ? 'Dispositivo preparado' : 'Preparar este dispositivo'}</span><h2 id="delivery-onboarding-title">{setupComplete ? 'Todo está listo para trabajar' : 'Distrito Delivery listo para trabajar'}</h2><p>{setupComplete ? 'La instalación, el GPS y las alertas ya están configurados.' : 'Activa estas funciones para recibir pedidos y compartir el recorrido.'}</p></div>
        <button className="onboarding-close" type="button" onClick={onClose} aria-label="Cerrar configuración inicial"><X /></button>
      </header>

      <div className="onboarding-steps">
        <Step icon={Download} title="Instalar aplicación" complete={installed} description="Acceso rápido, pantalla completa y mejor estabilidad durante la jornada.">
          {!installed && installPrompt && <button className="button button-primary" type="button" onClick={onInstall}><Download size={18} /> Instalar ahora</button>}
          {!installed && !installPrompt && <p className="onboarding-hint"><Smartphone size={16} /> {!secureContext ? 'Abre Delivery mediante HTTPS para habilitar la instalación.' : isIos ? 'En Safari: Compartir → Añadir a pantalla de inicio.' : 'Abre el menú del navegador y selecciona Instalar aplicación.'}</p>}
        </Step>

        <Step icon={MapPin} title="Ubicación GPS" complete={gpsReady} description="Se comparte con todos tus pedidos activos mientras Delivery está abierta.">
          {!gpsReady && <button className="button button-primary" type="button" disabled={gpsPermission === 'requesting'} onClick={onEnableGps}><MapPin size={18} /> {gpsPermission === 'requesting' ? 'Solicitando permiso…' : 'Permitir ubicación'}</button>}
          {gpsError && <p className="onboarding-error">{gpsError}</p>}
        </Step>

        <Step icon={Volume2} title="Alertas con sonido" complete={soundReady} description="Reproduce una alerta cuando llegue un pedido disponible.">
          {!soundReady && <button className="button button-primary" type="button" onClick={onEnableSound}><Volume2 size={18} /> Activar sonido</button>}
        </Step>
      </div>

      <footer><p>El navegador conserva estos permisos. Por seguridad, la ubicación en vivo se comparte mientras Delivery está abierta y hay pedidos activos.</p><button className={`button ${setupComplete ? 'button-primary' : 'button-ghost'} button-large`} type="button" onClick={onClose}>Continuar a pedidos</button></footer>
    </section>
  </div>;
}
