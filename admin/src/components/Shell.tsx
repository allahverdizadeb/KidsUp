import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Permission } from '../api/types.ts';
import { layoutOf, useWidth } from '../hooks/useWidth.ts';
import { useOverlay } from '../hooks/useOverlay.ts';
import { initials } from '../lib/format.ts';
import { ICON } from '../lib/icons.ts';
import { ROLE } from '../lib/roles.ts';
import { sx } from '../lib/sx.ts';
import type { PageKey } from '../state/NavContext.ts';
import { useLive } from '../state/useLive.ts';
import { useNav } from '../state/useNav.ts';
import { useAdmin, useSession } from '../state/useSession.ts';
import { Icon } from './ui/Icon.tsx';

interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
  permission: Permission;
}

const ITEMS: NavItem[] = [
  { key: 'dash', label: 'İdarəetmə paneli', icon: ICON.dash, permission: 'dashboard:read' },
  { key: 'reg', label: 'Qeydiyyatlar', icon: ICON.users, permission: 'applications:read' },
  { key: 'courses', label: 'Kurslar', icon: ICON.book, permission: 'courses:read' },
  { key: 'cms', label: 'Saytın idarə edilməsi', icon: ICON.site, permission: 'content:manage' },
  { key: 'users', label: 'İstifadəçilər', icon: ICON.team, permission: 'users:read' },
];

// The design's dark sidebar (its default).
const TONE = {
  bg: '#1A1A1A',
  line: '#2A2A2A',
  logo: '#FFFFFF',
  fg: '#BDBDBD',
  muted: '#A3A3A3',
  chip: '#2A2A2A',
  hover: '#262626',
  activeBg: 'rgba(255,0,131,.16)',
  activeFg: '#FF5CAA',
};

/** The frame of every page: the sidebar (full, icon rail or drawer), the mobile bar and the page area. */
export default function Shell({ children }: { children: ReactNode }) {
  const width = useWidth();
  const mode = layoutOf(width);
  const labels = mode !== 'rail';
  const { page, go, menuOpen, setMenuOpen } = useNav();
  const admin = useAdmin();
  const { can, signOut } = useSession();
  const { newApplications } = useLive();
  const sidebar = useRef<HTMLElement>(null);
  const main = useRef<HTMLElement>(null);
  const drawerOpen = mode === 'mobile' && menuOpen;
  useOverlay(drawerOpen, () => setMenuOpen(false), sidebar);

  // A page change is announced the way a page load is: the title names the page (only its name, never a family),
  // and the focus moves to the page so that keyboard and screen-reader users start at its top.
  const arrived = useRef(false);
  useEffect(() => {
    document.title = `${ITEMS.find((item) => item.key === page)?.label ?? 'KidsUp'} · KidsUp Admin`;
    if (arrived.current) main.current?.focus({ preventScroll: true });
    arrived.current = true;
  }, [page]);

  const sidebarWidth = mode === 'rail' ? 76 : mode === 'full' ? 248 : 272;

  return (
    <div style={{ minHeight: '100vh', background: '#F4F4F6' }}>
      <button
        type="button"
        className="skip-link"
        onClick={() => {
          main.current?.focus();
        }}
      >
        Əsas məzmuna keç
      </button>

      {mode === 'mobile' && (
        <>
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 50,
              height: 60,
              background: '#FFFFFF',
              borderBottom: '1px solid #EDEDED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em' }}>
                Kids<span style={{ color: '#FF0083' }}>Up</span>
              </span>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: '#F3F3F4',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#6B6B6B',
                }}
              >
                Admin
              </span>
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menyunu aç"
              aria-expanded={menuOpen}
              style={{
                width: 44,
                height: 44,
                border: '1px solid #E3E3E3',
                borderRadius: 10,
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon d={ICON.menu} size={20} stroke="#1A1A1A" strokeWidth={2} />
            </button>
          </header>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 55,
              background: 'rgba(26,26,26,.32)',
              opacity: menuOpen ? 1 : 0,
              pointerEvents: menuOpen ? 'auto' : 'none',
              transition: 'opacity .25s ease',
            }}
          />
        </>
      )}

      <aside
        ref={sidebar}
        inert={mode === 'mobile' && !menuOpen}
        aria-label="Yan panel"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 60,
          width: sidebarWidth,
          background: TONE.bg,
          borderRight: `1px solid ${TONE.line}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
          padding: `22px ${mode === 'rail' ? 12 : 14}px 18px`,
          transform: mode === 'mobile' && !menuOpen ? 'translateX(-105%)' : 'none',
          transition: 'transform .28s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: labels ? 'flex-start' : 'center',
            gap: 10,
            height: 36,
            padding: '0 10px',
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em', color: TONE.logo }}>
            {labels ? 'Kids' : 'K'}
            <span style={{ color: '#FF0083' }}>{labels ? 'Up' : 'U'}</span>
          </span>
          {labels && (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                background: TONE.chip,
                fontSize: 11,
                fontWeight: 800,
                color: TONE.muted,
              }}
            >
              Admin
            </span>
          )}
        </div>

        <nav aria-label="Admin menyu" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ITEMS.filter((item) => can(item.permission)).map((item) => {
            const on = page === item.key;
            const badge = item.key === 'reg' && newApplications > 0 ? newApplications : 0;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.key)}
                title={item.label}
                aria-label={badge ? `${item.label}, ${badge} yeni müraciət` : item.label}
                aria-current={on ? 'page' : undefined}
                {...sx(
                  {
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: labels ? 'flex-start' : 'center',
                    gap: 12,
                    height: 44,
                    padding: '0 12px',
                    border: 'none',
                    borderRadius: 10,
                    background: on ? TONE.activeBg : 'transparent',
                    color: on ? TONE.activeFg : TONE.fg,
                    fontSize: 14,
                    fontWeight: on ? 800 : 600,
                    textAlign: 'left',
                    transition: 'background .15s, color .15s',
                  },
                  on ? undefined : { background: TONE.hover },
                )}
              >
                <Icon d={item.icon} size={20} style={{ flexShrink: 0 }} />
                {labels && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                {badge > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: labels ? 'static' : 'absolute',
                      top: 5,
                      right: 6,
                      marginLeft: labels ? 'auto' : 0,
                      minWidth: 20,
                      height: 20,
                      padding: '0 6px',
                      borderRadius: 999,
                      background: '#FF0083',
                      color: '#FFFFFF',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            flexDirection: labels ? 'row' : 'column',
            alignItems: 'center',
            gap: 10,
            padding: '12px 10px',
            borderTop: `1px solid ${TONE.line}`,
          }}
        >
          <span
            aria-hidden="true"
            title={ROLE[admin.role].label}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#FFF0F7',
              color: '#C2006A',
              fontSize: 13,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {initials(admin.display_name)}
          </span>
          {labels && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: TONE.logo,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {admin.display_name}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: TONE.muted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {admin.email}
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#FF5CAA' }}>
                {ROLE[admin.role].label}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            title="Çıxış"
            aria-label="Çıxış"
            {...sx(
              {
                width: 36,
                height: 36,
                border: 'none',
                borderRadius: 8,
                background: 'transparent',
                color: TONE.muted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background .15s, color .15s',
              },
              { background: TONE.hover, color: '#FF5CAA' },
            )}
          >
            <Icon d={ICON.logout} size={18} />
          </button>
        </div>
      </aside>

      <main
        id="main"
        ref={main}
        tabIndex={-1}
        style={{
          marginLeft: mode === 'full' ? 248 : mode === 'rail' ? 76 : 0,
          minHeight: '100vh',
          outline: 'none',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: mode === 'mobile' ? '20px 16px 96px' : '32px 32px 64px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
