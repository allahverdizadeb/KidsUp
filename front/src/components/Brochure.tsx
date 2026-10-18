import { useHover } from '../hooks/useHover';

export default function Brochure() {
  const { on, off, hv } = useHover(['b1']);
  return (
    <section id="brosura" style={{ background: '#FFFFFF' }}>
      <div
        data-reveal="1"
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '0 clamp(20px,4vw,32px) clamp(72px,10vw,120px)',
        }}
      >
        <div
          onPointerEnter={on.b1}
          onPointerLeave={off}
          style={{
            border: '2px solid #1A1A1A',
            borderRadius: '6px',
            padding: 'clamp(28px,4vw,56px)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '40px 64px',
          }}
        >
          <div style={{ flex: '0 1 220px', minWidth: '180px' }}>
            <svg
              viewBox="0 0 240 220"
              width="100%"
              role="img"
              aria-label="KidsUp proqram broşurası"
              fill="none"
              stroke="#4A4A4A"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'block' }}
            >
              <ellipse cx="120" cy="206" rx="96" ry="9" fill="#000000" fillOpacity="0.06" stroke="none" />
              <path d="M64 30 L176 22 L186 186 L74 194 Z" fill="#EDEDED" transform="rotate(6 125 108)" />
              <path d="M54 28 L166 24 L170 190 L58 194 Z" fill="#FFFFFF" />
              <path d="M72 46 H128" strokeWidth="5" />
              <path d="M72 62 H112" stroke="#BDBDBD" strokeWidth="2" />
              <path d="M74 140 H150 M74 154 H140 M74 168 H146" stroke="#BDBDBD" strokeWidth="2" />
              <path
                d="M80 122 L80 100 L100 100 L100 122 M108 122 L108 88 L128 88 L128 122"
                strokeWidth="2.2"
              />
              <path
                d="M136 122 L136 76 L156 76 L156 122 Z"
                style={{ fill: hv.b1bar, transition: 'fill .25s ease' }}
              />
              <g
                style={{
                  transform: hv.b1t,
                  transition: 'transform .25s ease',
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                }}
              >
                <circle cx="186" cy="168" r="26" fill="#FF0083" />
                <path d="M186 154 V180 M175 170 L186 181 L197 170" stroke="#FFFFFF" strokeWidth="3.2" />
              </g>
            </svg>
          </div>
          <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>Broşura</div>
            <h2
              style={{
                margin: '0',
                fontWeight: '800',
                fontSize: 'clamp(34px,4.6vw,60px)',
                letterSpacing: '-0.04em',
                lineHeight: '1.04',
                textWrap: 'balance',
              }}
            >
              Proqramın tam təsvirini yükləyin
            </h2>
            <p
              style={{
                margin: '0',
                fontSize: '18px',
                lineHeight: '1.6',
                color: '#4A4A4A',
                maxWidth: '560px',
              }}
            >
              6 modul, dərs mövzuları, cədvəl və qiymət bir faylda. 2 səhifə.
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                flexWrap: 'wrap',
                marginTop: '6px',
              }}
            >
              <a
                href="/assets/KidsUp-Brosura.pdf"
                download="KidsUp-Brosura.pdf"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '18px 28px',
                  borderRadius: '6px',
                  background: '#FF0083',
                  color: '#FFFFFF',
                  fontWeight: '800',
                  fontSize: '18px',
                  transition: 'background .15s, transform .15s',
                }}
                className="hv-3"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 4v12M6 11l6 6 6-6M5 20h14" />
                </svg>
                Broşuranı yüklə
              </a>
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#6B6B6B' }}>PDF · 0,6 MB</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
