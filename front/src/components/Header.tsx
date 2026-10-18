import { Fragment, useEffect, useState } from 'react';
import { useWidth } from '../hooks/useWidth';

const NAV: [id: string, label: string][] = [
  ['oyrenecek', 'Uşaqlar nə öyrənəcək?'],
  ['modullar', 'Proqram'],
  ['demo-day', 'Demo Day'],
  ['sertifikat', 'Sertifikat'],
  ['haqqimizda', 'Qurucu'],
  ['qiymet', 'Qiymət'],
  ['brosura', 'Broşura'],
  ['suallar', 'Suallar'],
];
const NAV_IDS = [...NAV.map(([id]) => id), 'muraciet'];

export default function Header() {
  const mobile = useWidth() < 1240;
  const [menu, setMenu] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  // Highlight the nav item of the section currently under the header.
  useEffect(() => {
    const onScroll = () => {
      let current: string | null = null;
      for (const id of NAV_IDS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 140) current = id;
      }
      setActive(current === 'muraciet' ? null : current);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const navItems = NAV.map(([id, label]) => {
    const isActive = active === id;
    return {
      href: '#' + id,
      label,
      heart: false,
      heartFill: '#FFFFFF',
      c: isActive ? '#FF0083' : '#1A1A1A',
      fw: 600,
      bg: 'transparent',
      pad: '6px 0',
      rad: '0',
      line: isActive ? '#FF0083' : 'transparent',
    };
  });
  const desktop = !mobile;
  const menuShown = mobile && menu;
  const menuExp = menu;
  const menuLabel = menu ? 'Menyunu bağla' : 'Menyunu aç';
  const toggleMenu = () => setMenu((m) => !m);
  const closeMenu = () => setMenu(false);

  return (
    <header
      style={{
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        zIndex: '100',
        background: '#FFFFFF',
        borderBottom: '1px solid #EAEAEA',
      }}
    >
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '0 clamp(20px,4vw,32px)',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        <a
          href="#top"
          style={{ fontWeight: '800', fontSize: '26px', letterSpacing: '-0.03em', color: '#1A1A1A' }}
        >
          Kids<span style={{ color: '#FF0083' }}>Up</span>
        </a>
        {desktop && (
          <>
            <nav aria-label="Əsas menyu" style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
              {navItems.map((n, __i) => (
                <Fragment key={__i}>
                  <a
                    href={n.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: n.fw,
                      fontSize: '15px',
                      color: n.c,
                      whiteSpace: 'nowrap',
                      padding: n.pad,
                      borderRadius: n.rad,
                      background: n.bg,
                      borderBottom: `2px solid ${n.line}`,
                      transition: 'color .2s, border-color .2s, background .2s',
                    }}
                    className="hv-1"
                  >
                    {n.heart && (
                      <>
                        <svg
                          width="18"
                          height="17"
                          viewBox="0 0 24 22"
                          fill="none"
                          stroke="#FF0083"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          style={{ flexShrink: '0' }}
                        >
                          <path
                            d="M12 20 C 5 15, 2 11.5, 2.4 7.6 C 2.8 4.4, 5.4 2.6, 8 3 C 9.8 3.3, 11 4.6, 12 6.2 C 13 4.6, 14.3 3.2, 16.2 3 C 19 2.7, 21.4 4.8, 21.6 7.8 C 21.9 11.6, 18.6 15.2, 12 20 Z"
                            fill={n.heartFill}
                          />
                        </svg>
                      </>
                    )}
                    {n.label}
                  </a>
                </Fragment>
              ))}
            </nav>
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a
            href="#muraciet"
            style={{
              padding: '12px 22px',
              borderRadius: '6px',
              background: '#FF0083',
              color: '#FFFFFF',
              fontWeight: '700',
              fontSize: '16px',
              transition: 'background .15s, transform .15s',
            }}
            className="hv-2"
          >
            Müraciət et
          </a>
          {mobile && (
            <>
              <button
                onClick={toggleMenu}
                aria-label={menuLabel}
                aria-expanded={menuExp}
                aria-controls="mnav"
                style={{
                  width: '44px',
                  height: '44px',
                  border: '1px solid #1A1A1A',
                  borderRadius: '6px',
                  background: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                }}
              >
                <span style={{ width: '18px', height: '2px', background: '#1A1A1A' }} />
                <span style={{ width: '18px', height: '2px', background: '#1A1A1A' }} />
              </button>
            </>
          )}
        </div>
      </div>
      {menuShown && (
        <>
          <nav
            id="mnav"
            aria-label="Mobil menyu"
            style={{
              borderTop: '1px solid #EAEAEA',
              padding: '8px 24px 16px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'calc(100vh - 80px)',
              overflowY: 'auto',
            }}
          >
            {navItems.map((n, __i) => (
              <Fragment key={__i}>
                <a
                  href={n.href}
                  onClick={closeMenu}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '14px 0',
                    fontWeight: '700',
                    fontSize: '18px',
                    color: n.c,
                    borderBottom: '1px solid #F0F0F0',
                  }}
                >
                  {n.heart && (
                    <>
                      <svg
                        width="18"
                        height="17"
                        viewBox="0 0 24 22"
                        fill="none"
                        stroke="#FF0083"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        style={{ flexShrink: '0' }}
                      >
                        <path
                          d="M12 20 C 5 15, 2 11.5, 2.4 7.6 C 2.8 4.4, 5.4 2.6, 8 3 C 9.8 3.3, 11 4.6, 12 6.2 C 13 4.6, 14.3 3.2, 16.2 3 C 19 2.7, 21.4 4.8, 21.6 7.8 C 21.9 11.6, 18.6 15.2, 12 20 Z"
                          fill={n.heartFill}
                        />
                      </svg>
                    </>
                  )}
                  {n.label}
                </a>
              </Fragment>
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
