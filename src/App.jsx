import React, { lazy, Suspense, useContext } from 'react';
import { Navigate, useLocation } from './routing';
import AppLayout from './components/AppLayout';
import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';

const Home = lazy(() => import('./pages/Home'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const History = lazy(() => import('./pages/History'));
const Stats = lazy(() => import('./pages/Stats'));
const Profile = lazy(() => import('./pages/Profile'));

function Protected({ children }) {
  const { loading, isAuthenticated, user } = useContext(AuthContext);
  const location = useLocation();
  if (loading) return <div className="splash"><img src="/logo.png" alt="Distrito BG"/><span className="loader"/><p>Validando sesión…</p></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.must_change_password && location.pathname !== '/perfil') return <Navigate to="/perfil?cambio=obligatorio" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  const { pathname } = useLocation();
  if (pathname === '/login') return <Login />;
  if (pathname === '/reset-password') return <ResetPassword />;

  let page;
  if (pathname === '/') page = <Home />;
  else if (/^\/pedidos\/[^/]+$/.test(pathname)) page = <OrderDetail />;
  else if (pathname === '/historial') page = <History />;
  else if (pathname === '/estadisticas') page = <Stats />;
  else if (pathname === '/perfil') page = <Profile />;
  else return <Navigate to="/" replace />;

  return (
    <Suspense fallback={<div className="splash"><img src="/logo.png" alt="Distrito BG"/><span className="loader"/><p>Cargando módulo…</p></div>}>
      <Protected>{page}</Protected>
    </Suspense>
  );
}
