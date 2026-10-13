import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {BrandsProvider} from './context/BrandsContext';
import {ErrorBoundary} from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrandsProvider>
        <App />
      </BrandsProvider>
    </ErrorBoundary>
  </StrictMode>,
);
