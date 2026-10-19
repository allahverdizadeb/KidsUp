import { Fragment, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { PRIVACY_NOTICE_ANCHOR } from '../content/privacyNotice';
import { prefersReducedMotion } from '../lib/hover';
import { useWidth } from '../hooks/useWidth';

const CYCLE_MS = 23000;
// Wavy flight path of the rocket across the footer.
const pathY = (x: number, w: number) =>
  118 + 34 * Math.sin((x / w) * Math.PI * 3) + 8 * Math.sin((x / w) * Math.PI * 7 + 1);
// Stars: [x as fraction of width, y, scale, twinkles, brightens when footer hovered]
const STARS = [
  [0.2, 40, 1, 0, 1],
  [0.38, 228, 0.8, 1, 0],
  [0.44, 30, 0.7, 0, 1],
  [0.58, 236, 1.1, 1, 1],
  [0.62, 24, 0.8, 0, 0],
  [0.76, 226, 0.9, 1, 1],
  [0.9, 190, 0.7, 0, 0],
  [0.16, 214, 0.8, 1, 0],
];

export default function Footer() {
  const width = useWidth();
  const [measured, setMeasured] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  const footRef = useRef<HTMLElement>(null);
  const rocketRef = useRef<SVGGElement>(null);
  const flameRef = useRef<SVGGElement>(null);
  const tr0 = useRef<SVGPathElement>(null);
  const tr1 = useRef<SVGPathElement>(null);
  const tr2 = useRef<SVGPathElement>(null);

  // SVG viewBox width follows the footer's aspect ratio so the scene always fills it.
  const vbW = measured || (width < 700 ? 560 : 1440);
  const vbWRef = useRef(vbW);
  // The animation loop reads the latest values through refs so it never has to restart.
  useEffect(() => {
    pausedRef.current = paused;
    vbWRef.current = vbW;
  });

  useEffect(() => {
    const foot = footRef.current;
    if (!foot) return;
    const measure = () => {
      if (!foot.clientHeight) return;
      setMeasured(Math.max(400, Math.round((260 * foot.clientWidth) / foot.clientHeight)));
    };
    measure();
    const resize = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
    resize?.observe(foot);

    const drawRocket = (p: number, ts: number) => {
      const rocket = rocketRef.current;
      if (!rocket) return;
      const w = vbWRef.current;
      const scale = w < 1000 ? 0.72 : 1;
      const x = -140 + p * (w + 280);
      const y = pathY(x, w);
      const angle = (Math.atan2(pathY(x + 3, w) - y, 3) * 180) / Math.PI;
      rocket.setAttribute(
        'transform',
        `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(2)}) scale(${scale})`,
      );
      const flame = 1 + 0.22 * Math.sin(ts / 260);
      flameRef.current?.setAttribute(
        'transform',
        `translate(-34 0) scale(${flame.toFixed(3)} 1) translate(34 0)`,
      );
      const pts: string[] = [];
      for (let i = 0; i <= 12; i++) {
        const xi = x - (36 + i * 9) * scale;
        pts.push(`${xi.toFixed(1)} ${pathY(xi, w).toFixed(1)}`);
      }
      [tr0, tr1, tr2].forEach((ref, i) =>
        ref.current?.setAttribute('d', 'M' + pts.slice(i * 4, i * 4 + 5).join(' L')),
      );
    };

    if (prefersReducedMotion()) {
      const t = setTimeout(() => drawRocket(0.42, 0), 30);
      return () => {
        clearTimeout(t);
        resize?.disconnect();
      };
    }

    let elapsed = CYCLE_MS * 0.42;
    let last: number | null = null;
    let visible = true;
    let raf = requestAnimationFrame(function step(ts) {
      raf = requestAnimationFrame(step);
      const dt = last === null ? 0 : Math.min(ts - last, 100);
      last = ts;
      if (!visible || pausedRef.current) return;
      elapsed = (elapsed + dt) % CYCLE_MS;
      drawRocket(elapsed / CYCLE_MS, ts);
    });
    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver((entries) =>
            entries.forEach((e) => {
              visible = e.isIntersecting;
            }),
          )
        : null;
    io?.observe(foot);

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      resize?.disconnect();
    };
  }, []);

  const wide = width >= 700;
  const list = (wide ? STARS : STARS.filter((_, i) => i % 2 === 0)).map(([fx, y, s, twinkle, near]) => ({
    x: (fx * vbW).toFixed(0),
    y,
    s,
    o: hovered && near ? 1 : 0.5,
    anim: twinkle && !paused ? `kuTwinkle ${(5 + fx * 4).toFixed(1)}s ease-in-out infinite` : 'none',
  }));
  const stars = list;
  const gx1 = (vbW * (wide ? 0.3 : 0.28)).toFixed(0);
  const gx2 = (vbW * 0.42).toFixed(0);
  const gx3 = (vbW * 0.62).toFixed(0);
  const plx = (vbW * (wide ? 0.24 : 0.5)).toFixed(0);
  const fh = { pink: hovered ? '#FF4DA6' : '#FF0083', flame: hovered ? 1 : 0.85 };
  const footOn = (e: PointerEvent) => e.pointerType === 'mouse' && setHovered(true);
  const footOff = () => setHovered(false);
  const canAnimate = !prefersReducedMotion();
  const pauseLabel = paused ? 'Animasiyanı davam etdir' : 'Animasiyanı dayandır';
  const pauseIcon = paused ? '▶' : '❚❚';
  const togglePause = () => setPaused((p) => !p);
  return (
    <footer
      ref={footRef}
      onPointerEnter={footOn}
      onPointerLeave={footOff}
      style={{ position: 'relative', overflow: 'hidden', background: '#1A1A1A', color: '#FFFFFF' }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', inset: '0', pointerEvents: 'none' }}>
        <svg
          viewBox={`0 0 ${vbW} 260`}
          preserveAspectRatio="xMidYMid slice"
          width="100%"
          height="100%"
          style={{ display: 'block' }}
        >
          <g
            transform={`translate(${gx1} 62) rotate(-14) scale(1)`}
            stroke="#7A7A7A"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          >
            <ellipse cx="0" cy="0" rx="46" ry="15" strokeOpacity="0.55" />
            <path d="M-3 -2 C 8 -14, 30 -10, 36 4 C 40 12, 30 18, 20 14" strokeOpacity="0.8" />
            <path d="M3 2 C -8 14, -30 10, -36 -4 C -40 -12, -30 -18, -20 -14" strokeOpacity="0.8" />
            <path d="M-6 -3 Q0 -8 6 -3 Q8 3 0 5 Q-8 4 -6 -3Z" fill="#3A3A3A" stroke="#9A9A9A" />
          </g>
          <g
            transform={`translate(${gx2} 200) rotate(10) scale(0.8)`}
            stroke="#7A7A7A"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          >
            <ellipse cx="0" cy="0" rx="46" ry="15" strokeOpacity="0.55" />
            <path d="M-3 -2 C 8 -14, 30 -10, 36 4 C 40 12, 30 18, 20 14" strokeOpacity="0.8" />
            <path d="M3 2 C -8 14, -30 10, -36 -4 C -40 -12, -30 -18, -20 -14" strokeOpacity="0.8" />
            <path d="M-6 -3 Q0 -8 6 -3 Q8 3 0 5 Q-8 4 -6 -3Z" fill="#3A3A3A" stroke="#9A9A9A" />
          </g>
          {wide && (
            <>
              <g
                transform={`translate(${gx3} 40) rotate(22) scale(0.65)`}
                stroke="#7A7A7A"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              >
                <ellipse cx="0" cy="0" rx="46" ry="15" strokeOpacity="0.55" />
                <path d="M-3 -2 C 8 -14, 30 -10, 36 4 C 40 12, 30 18, 20 14" strokeOpacity="0.8" />
                <path d="M3 2 C -8 14, -30 10, -36 -4 C -40 -12, -30 -18, -20 -14" strokeOpacity="0.8" />
                <path d="M-6 -3 Q0 -8 6 -3 Q8 3 0 5 Q-8 4 -6 -3Z" fill="#3A3A3A" stroke="#9A9A9A" />
              </g>
            </>
          )}
          <g
            transform={`translate(${plx} 214)`}
            stroke="#7A7A7A"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          >
            <circle cx="0" cy="0" r="15" fill="#222222" />
            <path d="M-12 -4 Q0 -8 12 -2" strokeOpacity="0.6" />
            <path
              d="M-28 6 Q-30 -2 -14 -6 M14 -8 Q32 -12 30 -4 Q26 6 -10 12 Q-30 16 -28 6"
              stroke="#FF0083"
              strokeOpacity="0.55"
            />
          </g>
          {stars.map((st, __i) => (
            <Fragment key={__i}>
              <g
                transform={`translate(${st.x} ${st.y}) scale(${st.s})`}
                style={{ opacity: st.o, transition: 'opacity .3s ease' }}
              >
                <path
                  d="M0 -5 Q1 -1 5 0 Q1 1 0 5 Q-1 1 -5 0 Q-1 -1 0 -5Z"
                  fill="#D6D6D6"
                  style={{ animation: st.anim }}
                />
              </g>
            </Fragment>
          ))}
          <path
            ref={tr0}
            d=""
            stroke="#FF0083"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            strokeOpacity="0.5"
          />
          <path
            ref={tr1}
            d=""
            stroke="#FF0083"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
            strokeOpacity="0.3"
          />
          <path
            ref={tr2}
            d=""
            stroke="#FF0083"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
            strokeOpacity="0.14"
          />
          <g ref={rocketRef} transform="translate(-200 130)" strokeLinecap="round" strokeLinejoin="round">
            <g ref={flameRef}>
              <path
                d="M-34 -7 Q-62 0 -34 7 Q-44 0 -34 -7Z"
                fill="#FF0083"
                stroke="none"
                style={{ opacity: fh.flame, transition: 'opacity .3s ease' }}
              />
            </g>
            <path
              d="M-20 -12 L-34 -27 Q-24 -26 -10 -14"
              fill="#FF0083"
              stroke="#E6E6E6"
              strokeWidth="1.8"
              style={{ fill: fh.pink, transition: 'fill .3s ease' }}
            />
            <path d="M-20 12 L-34 27 Q-24 26 -10 14" fill="#1A1A1A" stroke="#E6E6E6" strokeWidth="1.8" />
            <path
              d="M-34 -13 Q6 -19 34 0 Q6 19 -34 13 Q-38 0 -34 -13Z"
              fill="#1A1A1A"
              stroke="#E6E6E6"
              strokeWidth="2"
            />
            <path
              d="M18 -9.5 Q29 -5 34 0 Q29 5 18 9.5 Q21 0 18 -9.5Z"
              fill="#FF0083"
              stroke="#E6E6E6"
              strokeWidth="1.6"
              style={{ fill: fh.pink, transition: 'fill .3s ease' }}
            />
            <circle cx="0" cy="0" r="6.5" fill="#1A1A1A" stroke="#E6E6E6" strokeWidth="1.8" />
            <path d="M-2.5 -3 Q0 -4.5 2.5 -3" stroke="#9A9A9A" strokeWidth="1.4" fill="none" />
            <path d="M-26 -3 V3" stroke="#9A9A9A" strokeWidth="1.6" />
          </g>
        </svg>
      </div>
      <div
        style={{
          position: 'relative',
          zIndex: '1',
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '48px clamp(20px,4vw,32px)',
          minHeight: '260px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '28px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontWeight: '800', fontSize: '24px', letterSpacing: '-0.03em' }}>
            Kids<span style={{ color: '#FF0083' }}>Up</span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '12px 28px',
              flexWrap: 'wrap',
              alignItems: 'center',
              fontSize: '15px',
              fontWeight: '600',
            }}
          >
            <a
              href="https://wa.me/994509988707"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#FFFFFF' }}
              className="hv-1"
            >
              WhatsApp
            </a>
            <a href="tel:+994509988707" style={{ color: '#FFFFFF' }} className="hv-1">
              +994 50 998 87 07
            </a>
            <a href={`#${PRIVACY_NOTICE_ANCHOR}`} style={{ color: '#FFFFFF' }} className="hv-1">
              Məxfilik bildirişi
            </a>
            {canAnimate && (
              <>
                <button
                  type="button"
                  onClick={togglePause}
                  aria-pressed={paused}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minHeight: '44px',
                    margin: '-12px 0',
                    padding: '0 14px',
                    border: '1px solid #6B6B6B',
                    borderRadius: '6px',
                    background: 'transparent',
                    color: '#FFFFFF',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                  className="hv-6"
                >
                  <span aria-hidden="true" style={{ fontSize: '11px' }}>
                    {pauseIcon}
                  </span>
                  {pauseLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
