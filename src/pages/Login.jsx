import React, { useContext, useEffect, useState } from 'react';
import { Download, Eye, EyeOff, KeyRound, LogIn, User } from 'lucide-react';
import { Navigate } from '../routing';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { unlockDeliveryAlerts } from '../utils/orderAlert';

export default function Login() {
  const { isAuthenticated, login } = useContext(AuthContext);
  const [form, setForm] = useState({ username: '', password: '', remember: true });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [installPrompt, setInstallPrompt] = useState(() => window.__distritoDeliveryInstallPrompt || null);

  useEffect(() => {
    const notice = sessionStorage.getItem('distrito_delivery_notice');
    if (notice) { setError(notice); sessionStorage.removeItem('distrito_delivery_notice'); }
  }, []);
  useEffect(() => {
    const ready = () => setInstallPrompt(window.__distritoDeliveryInstallPrompt || null);
    window.addEventListener('distrito:install-ready', ready);
    return () => window.removeEventListener('distrito:install-ready', ready);
  }, []);
  if (isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault();
    unlockDeliveryAlerts().catch(() => {});
    setError(''); setBusy(true);
    try { await login(form); } catch (loginError) { setError(loginError.message); } finally { setBusy(false); }
  };

  const recover = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${API_URL}/admin/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, app: 'delivery' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message); setForgot(false);
    } catch (recoverError) { setError(recoverError.message); } finally { setBusy(false); }
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    window.__distritoDeliveryInstallPrompt = null;
    setInstallPrompt(null);
  };

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand"><img src="/logo.png" alt="Distrito BG Delivery" /><span>Delivery</span></div>
        <div><span className="eyebrow">Entregas conectadas</span><h1>Tu ruta.<br />Tu operación.<br /><em>En tiempo real.</em></h1><p>Recibe, navega y entrega pedidos sin salir de la aplicación.</p></div>
        <small>Distrito BG · Valledupar, Colombia</small>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={forgot ? recover : submit}>
          <div className="mobile-auth-logo"><img src="/logo.png" alt="Distrito BG" /><b>Delivery</b></div>
          <span className="eyebrow">Acceso seguro</span>
          <h2>{forgot ? 'Recuperar contraseña' : 'Bienvenido de vuelta'}</h2>
          <p>{forgot ? 'Te enviaremos un enlace válido durante una hora.' : 'Usa tus credenciales asignadas por el administrador.'}</p>
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}
          {forgot ? <label>Correo electrónico<div className="field"><User size={19} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></div></label> : <>
            <label>Usuario o documento<div className="field"><User size={19} /><input required autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Usuario o documento" /></div></label>
            <label>Contraseña<div className="field"><KeyRound size={19} /><input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Contraseña" /><button type="button" className="icon-button" onClick={() => setShowPassword(!showPassword)} aria-label="Mostrar contraseña">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
            <div className="auth-options"><label className="check"><input type="checkbox" checked={form.remember} onChange={(event) => setForm({ ...form, remember: event.target.checked })} /> Recordar sesión</label><button type="button" className="link-button" onClick={() => setForgot(true)}>Recuperar contraseña</button></div>
          </>}
          <button className="button button-primary button-large" disabled={busy}>{busy ? 'Procesando…' : forgot ? 'Enviar enlace' : <>Iniciar sesión <LogIn size={19} /></>}</button>
          {installPrompt && <button type="button" className="button button-ghost button-large" onClick={install}><Download size={19} /> Instalar Distrito Delivery</button>}
          {forgot && <button type="button" className="link-button centered" onClick={() => setForgot(false)}>Volver al inicio de sesión</button>}
          <small className="security-copy">Máximo 3 dispositivos activos por usuario.</small>
        </form>
      </section>
    </div>
  );
}
