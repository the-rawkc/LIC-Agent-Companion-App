import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'

// Ensure service worker updates immediately, claims clients, and reloads window
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_swScriptUrl, registration) {
    if (registration) {
      setInterval(() => {
        registration.update().catch(() => {});
      }, 10000);
    }
  },
});

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
