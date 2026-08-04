import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext(null);

function currentLocation() {
  return { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash };
}

export function BrowserRouter({ children }) {
  const [location, setLocation] = useState(currentLocation);
  useEffect(() => {
    const changed = () => setLocation(currentLocation());
    window.addEventListener('popstate', changed);
    return () => window.removeEventListener('popstate', changed);
  }, []);
  const navigate = useCallback((to, options = {}) => {
    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }
    const target = String(to || '/');
    if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
      throw new Error('Ruta interna inválida');
    }
    window.history[options.replace ? 'replaceState' : 'pushState']({}, '', target);
    setLocation(currentLocation());
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);
  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useLocation() {
  return useContext(RouterContext).location;
}

export function useNavigate() {
  return useContext(RouterContext).navigate;
}

export function Link({ to, replace = false, onClick, children, ...props }) {
  const navigate = useNavigate();
  const handleClick = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to, { replace });
  };
  return <a {...props} href={to} onClick={handleClick}>{children}</a>;
}

export function NavLink({ to, end = false, className = '', ...props }) {
  const { pathname } = useLocation();
  const active = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  return <Link {...props} to={to} className={`${className} ${active ? 'active' : ''}`.trim()} />;
}

export function Navigate({ to, replace = false }) {
  const navigate = useNavigate();
  useEffect(() => { navigate(to, { replace }); }, [navigate, replace, to]);
  return null;
}

export function useParams() {
  const { pathname } = useLocation();
  const order = pathname.match(/^\/pedidos\/([^/]+)$/);
  return order ? { id: decodeURIComponent(order[1]) } : {};
}

export function useSearchParams() {
  const { search } = useLocation();
  return [useMemo(() => new URLSearchParams(search), [search])];
}
