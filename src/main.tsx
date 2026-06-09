import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Mark the platform on <html> so CSS can adapt (Windows font rendering is thinner & lighter)
if (typeof window !== 'undefined') {
  const p = navigator.platform || '';
  document.documentElement.setAttribute('data-platform', p.startsWith('Win') ? 'win' : 'mac');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
