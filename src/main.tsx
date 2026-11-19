import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {BrandsProvider} from './context/BrandsContext';
import {ErrorBoundary} from './components/ErrorBoundary';
import {PublicAdsPage} from './components/ads/PublicAdsPage';
import {parsePublicRoute} from './utils/publicRoute';
import './index.css';

// Public ad pages (/ads, /s/<token>) render without App, so its login gate is never reached.
const publicRoute = parsePublicRoute(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publicRoute ? (
      <ErrorBoundary>
        <PublicAdsPage route={publicRoute} />
      </ErrorBoundary>
    ) : (
      <ErrorBoundary>
        <BrandsProvider>
          <App />
        </BrandsProvider>
      </ErrorBoundary>
    )}
  </StrictMode>,
);
