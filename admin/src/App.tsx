import type { ReactNode } from 'react';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import Login from './components/Login.tsx';
import Shell from './components/Shell.tsx';
import { Loading } from './components/ui/Feedback.tsx';
import Cms from './pages/Cms.tsx';
import Courses from './pages/Courses.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Registrations from './pages/Registrations.tsx';
import Users from './pages/Users.tsx';
import DrawerProvider from './state/DrawerProvider.tsx';
import LiveProvider from './state/LiveProvider.tsx';
import NavProvider from './state/NavProvider.tsx';
import SessionProvider from './state/SessionProvider.tsx';
import ToastProvider from './state/ToastProvider.tsx';
import type { PageKey } from './state/NavContext.ts';
import { useNav } from './state/useNav.ts';
import { useSession } from './state/useSession.ts';
import type { Permission } from './api/types.ts';

const PERMISSION: Record<PageKey, Permission> = {
  dash: 'dashboard:read',
  reg: 'applications:read',
  courses: 'courses:read',
  cms: 'content:manage',
  users: 'users:read',
};

/** The page asked for in the address, or the dashboard when the role may not open it (the API refuses it anyway). */
function CurrentPage() {
  const { page, intent } = useNav();
  const { can } = useSession();
  const shown: PageKey = can(PERMISSION[page]) ? page : 'dash';
  const pages: Record<PageKey, ReactNode> = {
    dash: <Dashboard />,
    // A new request from another page (a figure of the dashboard, a person of a course) starts this page afresh.
    reg: <Registrations key={intent?.nonce ?? 0} />,
    courses: <Courses />,
    cms: <Cms />,
    users: <Users />,
  };
  return <>{pages[shown]}</>;
}

function Gate() {
  const { phase } = useSession();
  if (phase.kind === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading label="Yüklənir…" />
      </div>
    );
  }
  if (phase.kind === 'out') return <Login reason={phase.reason} unreachable={phase.unreachable} />;
  return (
    <NavProvider>
      <LiveProvider>
        <DrawerProvider>
          <Shell>
            <CurrentPage />
          </Shell>
        </DrawerProvider>
      </LiveProvider>
    </NavProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SessionProvider>
          <Gate />
        </SessionProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
