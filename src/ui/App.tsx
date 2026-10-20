import { Tool } from './pages/Tool';
import { Privacy } from './pages/Privacy';
import { About } from './pages/About';
import { Mask } from './pages/Mask';

/**
 * There is no client-side router on purpose. Navigation is a real page load, so
 * no file content can ever be reconstructed from history or a URL (PRD NG3).
 */
export function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/privacy') return <Privacy />;
  if (path === '/about') return <About />;
  if (path === '/mask') return <Mask />;
  return <Tool />;
}
