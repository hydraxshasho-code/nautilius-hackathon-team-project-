import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import './index.css';

// Safely intercept and absorb known Firebase Auth SDK internal assertion race condition
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message || '';
    if (
      msg.includes('INTERNAL ASSERTION FAILED: Pending promise was never set') ||
      msg.includes('Pending promise was never set') ||
      msg.includes('auth/popup-closed-by-user') ||
      msg.includes('auth/cancelled-popup-request')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      console.warn('[Handled Firebase Auth Race Condition]', msg);
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('INTERNAL ASSERTION FAILED: Pending promise was never set') ||
      msg.includes('Pending promise was never set')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      console.warn('[Handled Firebase Auth Internal Error]', msg);
    }
  });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
