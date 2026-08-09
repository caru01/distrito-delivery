import React from 'react';
import { AlertTriangle, Home, LogOut, RefreshCw } from 'lucide-react';
import { apiFetch, clearCredentials } from '../services/api';

export default class DeliveryErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Error de interfaz en Distrito Delivery:', error, info);
    this.recoveryTimer = window.setTimeout(() => {
      void this.closeSession('La sesión se cerró después de 40 minutos en la pantalla de recuperación.');
    }, 40 * 60 * 1000);

    const chunkFailed = /dynamically imported|loading chunk|failed to fetch module/i.test(String(error?.message || error));
    if (chunkFailed && sessionStorage.getItem('distrito_delivery_chunk_reloaded') !== 'true') {
      sessionStorage.setItem('distrito_delivery_chunk_reloaded', 'true');
      window.location.reload();
    }
  }

  componentWillUnmount() {
    window.clearTimeout(this.recoveryTimer);
  }

  closeSession = async (notice = '') => {
    try { await apiFetch('/admin/logout', { method: 'POST' }); } catch {}
    clearCredentials(notice);
    window.location.assign('/login');
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="delivery-recovery" role="alert">
        <img src="/logo.png" alt="Distrito BG Delivery" />
        <AlertTriangle size={42} />
        <h1>No pudimos mostrar esta pantalla</h1>
        <p>Tu sesión sigue activa. Puedes recuperar Pedidos, recargar la aplicación o cerrar sesión. Si esta pantalla permanece abierta, la sesión se cerrará después de 40 minutos.</p>
        <div className="delivery-recovery-actions">
          <button className="button button-primary" onClick={() => window.location.assign('/')}><Home size={18} /> Ir a pedidos</button>
          <button className="button button-ghost" onClick={() => window.location.reload()}><RefreshCw size={18} /> Volver a cargar</button>
          <button className="button button-ghost" onClick={() => void this.closeSession()}><LogOut size={18} /> Cerrar sesión</button>
        </div>
      </main>
    );
  }
}
