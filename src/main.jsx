import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from './routing';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import DeliveryErrorBoundary from './components/DeliveryErrorBoundary';
import './styles.css';

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.__distritoDeliveryInstallPrompt = event;
  window.dispatchEvent(new CustomEvent('distrito:install-ready'));
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DeliveryErrorBoundary>
      <BrowserRouter>
        <AuthProvider><App /></AuthProvider>
      </BrowserRouter>
    </DeliveryErrorBoundary>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(console.error));
}
