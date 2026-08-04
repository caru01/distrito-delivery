import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="delivery-recovery" role="alert">
        <img src="/logo.png" alt="Distrito BG Delivery" />
        <AlertTriangle size={42} />
        <h1>No pudimos mostrar esta pantalla</h1>
        <p>Tu sesión se conserva. Recarga la aplicación para continuar recibiendo pedidos.</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>
          <RefreshCw size={18} /> Volver a cargar
        </button>
      </main>
    );
  }
}
