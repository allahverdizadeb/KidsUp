import '@fontsource-variable/manrope'; // self-hosted: no third-party font request
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { loadPublicContent } from './api/publicContent.ts';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import PublicContentProvider from './content/PublicContentProvider.tsx';

// What the admin panel published (texts, pictures, open courses) is read before the page is drawn, so the
// visitor never sees the built-in text change into the published one. A missing or slow file never blocks
// the page for more than two seconds: it then shows what it was built with.
const content = await loadPublicContent();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PublicContentProvider content={content}>
        <App />
      </PublicContentProvider>
    </ErrorBoundary>
  </StrictMode>,
);
