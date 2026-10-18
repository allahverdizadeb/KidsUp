import { useHover } from '../hooks/useHover';

export default function Skills() {
  const { on, off, hv } = useHover(['k1', 'k2', 'k3', 'k4', 'k5', 'k6']);
  return (
    <section id="oyrenecek" style={{ background: '#FFFFFF' }}>
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(72px,10vw,120px) clamp(20px,4vw,32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '64px',
        }}
      >
        <div
          data-reveal="1"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px' }}
        >
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>Uşaqlar nə öyrənəcək?</div>
          <h2
            style={{
              margin: '0',
              fontWeight: '800',
              fontSize: 'clamp(34px,4.6vw,60px)',
              letterSpacing: '-0.04em',
              lineHeight: '1.02',
              textWrap: 'balance',
            }}
          >
            Öz fikrini həyata keçirmək üçün bacarıqlar
          </h2>
        </div>
        <div
          data-reveal="1"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,max(300px,calc((100% - 80px) / 3))),1fr))',
            gap: '56px 40px',
          }}
        >
          <div
            onPointerEnter={on.k1}
            onPointerLeave={off}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            <div
              style={{
                aspectRatio: '16/10',
                background: '#F6F6F6',
                borderRadius: '6px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                viewBox="0 0 320 200"
                width="100%"
                role="img"
                aria-label="Vərəqdəki problem eskizinə böyüdücü şüşə ilə baxılır"
                fill="none"
                stroke="#4A4A4A"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'block', width: '100%', height: '100%' }}
              >
                <ellipse cx="160" cy="186" rx="130" ry="9" fill="#000000" fillOpacity="0.06" stroke="none" />
                <path d="M50 130 L196 104 L228 168 L82 192 Z" fill="#FFFFFF" />
                <g stroke="#8C8C8C" strokeWidth="2">
                  <path d="M100 134 L106 172 L138 168 L140 130" />
                  <ellipse cx="120" cy="132" rx="20" ry="6" />
                  <path d="M122 142 L116 152 L124 158" />
                  <path d="M142 150 Q148 158 142 164" />
                </g>
                <circle cx="150" cy="176" r="4" fill="#FF0083" stroke="none" />
                <g
                  style={{
                    transform: hv.k1t,
                    transition: 'transform .25s ease',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }}
                >
                  <path d="M238 114 L284 152" stroke="#4A4A4A" strokeWidth="18" />
                  <path
                    d="M238 114 L284 152"
                    strokeWidth="13"
                    style={{ stroke: hv.k1h, transition: 'stroke .25s ease' }}
                  />
                  <circle cx="210" cy="84" r="40" fill="#FFFFFF" fillOpacity="0.6" />
                  <circle cx="210" cy="84" r="31" stroke="#DADADA" strokeWidth="2" />
                  <path d="M188 72 Q194 60 208 56" stroke="#DADADA" strokeWidth="2" />
                </g>
              </svg>
            </div>
            <div style={{ fontWeight: '800', fontSize: '22px', lineHeight: '1.25' }}>
              Problemləri görmək və həll düşünmək
            </div>
          </div>
          <div
            onPointerEnter={on.k2}
            onPointerLeave={off}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            <div
              style={{
                aspectRatio: '16/10',
                background: '#F6F6F6',
                borderRadius: '6px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                viewBox="0 0 320 200"
                width="100%"
                role="img"
                aria-label="Bir uşaq sual verir, digəri dinləyir"
                fill="none"
                stroke="#4A4A4A"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'block', width: '100%', height: '100%' }}
              >
                <g transform="translate(92,130) scale(.62)">
                  <g transform="translate(0,0)">
                    <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                    <path d="M-12 6 Q0 18 12 6" />
                    <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                    <path
                      d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q24 -58 4 -58 Q-16 -52 -32 -38Z"
                      fill="#DCDCDC"
                    />
                    <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                    <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                    <ellipse cx="0" cy="-19" rx="5" ry="4" fill="#FFFFFF" />
                  </g>
                </g>
                <g transform="translate(236,130) scale(.62)">
                  <g transform="translate(0,0)">
                    <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                    <path d="M-12 6 Q0 18 12 6" />
                    <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                    <path d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q10 -54 -32 -38Z" fill="#DCDCDC" />
                    <path d="M30 -56 Q52 -54 50 -28 Q44 -36 32 -42" fill="#DCDCDC" />
                    <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                    <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                    <path d="M-8 -21 Q0 -15 8 -21" />
                  </g>
                </g>
                <g
                  style={{
                    transform: hv.k2t,
                    transition: 'transform .25s ease',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }}
                >
                  <path
                    d="M112 22 H196 Q210 22 210 36 V58 Q210 72 196 72 H142 L124 88 L128 72 H112 Q98 72 98 58 V36 Q98 22 112 22 Z"
                    style={{ fill: hv.k2b, transition: 'fill .25s ease' }}
                  />
                  <circle
                    cx="136"
                    cy="47"
                    r="4.5"
                    stroke="none"
                    style={{ fill: hv.k2d, transition: 'fill .25s ease' }}
                  />
                  <circle
                    cx="154"
                    cy="47"
                    r="4.5"
                    stroke="none"
                    style={{ fill: hv.k2d, transition: 'fill .25s ease' }}
                  />
                  <circle
                    cx="172"
                    cy="47"
                    r="4.5"
                    stroke="none"
                    style={{ fill: hv.k2d, transition: 'fill .25s ease' }}
                  />
                </g>
              </svg>
            </div>
            <div style={{ fontWeight: '800', fontSize: '22px', lineHeight: '1.25' }}>
              Düzgün sual vermək və insanları dinləmək
            </div>
          </div>
          <div
            onPointerEnter={on.k3}
            onPointerLeave={off}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            <div
              style={{
                aspectRatio: '16/10',
                background: '#F6F6F6',
                borderRadius: '6px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                viewBox="0 0 320 200"
                width="100%"
                role="img"
                aria-label="İki əl birlikdə karton qutu prototipini yapışdırır"
                fill="none"
                stroke="#4A4A4A"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'block', width: '100%', height: '100%' }}
              >
                <ellipse cx="166" cy="178" rx="100" ry="9" fill="#000000" fillOpacity="0.06" stroke="none" />
                <g
                  style={{
                    transform: hv.k3t,
                    transition: 'transform .25s ease',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }}
                >
                  <path d="M110 96 L200 96 L200 160 L110 160 Z" fill="#FFFFFF" />
                  <path d="M200 96 L228 80 L228 144 L200 160 Z" fill="#EDEDED" />
                  <path d="M110 96 L138 80 L228 80 L200 96 Z" fill="#FFFFFF" />
                  <path
                    d="M150 80 L170 80 L142 96 L122 96 Z"
                    style={{ fill: hv.k3tape, transition: 'fill .25s ease' }}
                  />
                  <path
                    d="M122 96 L142 96 L142 120 L122 120 Z"
                    style={{ fill: hv.k3tape, transition: 'fill .25s ease' }}
                  />
                </g>
                <path d="M-10 200 L84 146" stroke="#4A4A4A" strokeWidth="40" />
                <path d="M-10 200 L84 146" stroke="#EDEDED" strokeWidth="35" />
                <path d="M78 128 Q100 118 114 130 Q120 146 110 156 Q92 166 80 156 Z" fill="#FFFFFF" />
                <path d="M98 138 H114 M98 148 H112" strokeWidth="2" />
                <path d="M330 200 L246 140" stroke="#4A4A4A" strokeWidth="40" />
                <path d="M330 200 L246 140" stroke="#EDEDED" strokeWidth="35" />
                <path d="M246 120 Q224 112 214 124 Q208 140 218 150 Q236 158 246 148 Z" fill="#FFFFFF" />
                <path d="M214 132 H230 M216 142 H232" strokeWidth="2" />
              </svg>
            </div>
            <div style={{ fontWeight: '800', fontSize: '22px', lineHeight: '1.25' }}>Komandada işləmək</div>
          </div>
          <div
            onPointerEnter={on.k4}
            onPointerLeave={off}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            <div
              style={{
                aspectRatio: '16/10',
                background: '#F6F6F6',
                borderRadius: '6px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                viewBox="0 0 320 200"
                width="100%"
                role="img"
                aria-label="Kalkulyator və sikkələr"
                fill="none"
                stroke="#4A4A4A"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'block', width: '100%', height: '100%' }}
              >
                <ellipse cx="110" cy="162" rx="80" ry="8" fill="#000000" fillOpacity="0.06" stroke="none" />
                <ellipse cx="236" cy="176" rx="46" ry="8" fill="#000000" fillOpacity="0.06" stroke="none" />
                <path d="M40 70 L140 52 L170 130 L70 148 Z" fill="#FFFFFF" />
                <path d="M70 148 L170 130 L170 140 L70 158 Z" fill="#EDEDED" />
                <path d="M40 70 L70 148 L70 158 L40 80 Z" fill="#F4F4F4" />
                <path d="M56 78 L132 64 L140 82 L64 96 Z" fill="#EDEDED" />
                <ellipse cx="75.0" cy="105.4" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <ellipse cx="100.0" cy="100.9" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <ellipse cx="125.0" cy="96.4" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <ellipse cx="147.0" cy="92.4" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <ellipse cx="81.0" cy="121.0" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <ellipse cx="106.0" cy="116.5" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <ellipse cx="131.0" cy="112.0" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <ellipse cx="153.0" cy="108.0" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <ellipse cx="87.0" cy="136.6" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <ellipse cx="112.0" cy="132.1" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <ellipse cx="137.0" cy="127.6" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <ellipse cx="159.0" cy="123.6" rx="7" ry="3.5" fill="#FFFFFF" strokeWidth="2" />
                <path d="M206 160 V167.5 A30 10 0 0 0 266 167.5 V160" fill="#EDEDED" />
                <ellipse cx="236" cy="160" rx="30" ry="10" fill="#FFFFFF" />
                <ellipse cx="236" cy="160" rx="18" ry="6" stroke="#BDBDBD" strokeWidth="2" />
                <path d="M206 152 V159.5 A30 10 0 0 0 266 159.5 V152" fill="#EDEDED" />
                <ellipse cx="236" cy="152" rx="30" ry="10" fill="#FFFFFF" />
                <ellipse cx="236" cy="152" rx="18" ry="6" stroke="#BDBDBD" strokeWidth="2" />
                <path d="M207 144 V151.5 A30 10 0 0 0 267 151.5 V144" fill="#EDEDED" />
                <ellipse cx="237" cy="144" rx="30" ry="10" fill="#FFFFFF" />
                <ellipse cx="237" cy="144" rx="18" ry="6" stroke="#BDBDBD" strokeWidth="2" />
                <g
                  style={{
                    transform: hv.k4t,
                    transition: 'transform .25s ease',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }}
                >
                  <path d="M205 136 V143.5 A30 10 0 0 0 265 143.5 V136" fill="#EDEDED" />
                  <ellipse
                    cx="235"
                    cy="136"
                    rx="30"
                    ry="10"
                    style={{ fill: hv.k4coin, transition: 'fill .25s ease' }}
                  />
                  <ellipse cx="235" cy="136" rx="18" ry="6" stroke="#BDBDBD" strokeWidth="2" />
                </g>
                <path d="M160 178 V183 A20 6.666666666666667 0 0 0 200 183 V178" fill="#EDEDED" />
                <ellipse cx="180" cy="178" rx="20" ry="6.666666666666667" fill="#FFFFFF" />
                <ellipse cx="180" cy="178" rx="12" ry="4" stroke="#BDBDBD" strokeWidth="2" />
              </svg>
            </div>
            <div style={{ fontWeight: '800', fontSize: '22px', lineHeight: '1.25' }}>
              Xərc və gəliri hesablamaq
            </div>
          </div>
          <div
            onPointerEnter={on.k5}
            onPointerLeave={off}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            <div
              style={{
                aspectRatio: '16/10',
                background: '#F6F6F6',
                borderRadius: '6px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                viewBox="0 0 320 200"
                width="100%"
                role="img"
                aria-label="Uşaq lövhənin yanında fikrini izah edir"
                fill="none"
                stroke="#4A4A4A"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'block', width: '100%', height: '100%' }}
              >
                <ellipse cx="180" cy="190" rx="120" ry="7" fill="#000000" fillOpacity="0.06" stroke="none" />
                <path d="M232 40 L234 186" stroke="#4A4A4A" strokeWidth="10" />
                <path d="M232 40 L234 186" stroke="#EDEDED" strokeWidth="5" />
                <path d="M170 30 L292 24 L296 118 L174 124 Z" fill="#FFFFFF" />
                <path d="M184 42 V108 H284" strokeWidth="2" />
                <path d="M194 106 V90 H208 V106 Z" fill="#E4E4E4" />
                <path d="M216 106 V78 H230 V106 Z" fill="#E4E4E4" />
                <path d="M238 106 V58 H252 V106 Z" style={{ fill: hv.k5bar, transition: 'fill .25s ease' }} />
                <path d="M186 124 L176 188" stroke="#4A4A4A" strokeWidth="10" />
                <path d="M186 124 L176 188" stroke="#FFFFFF" strokeWidth="5" />
                <path d="M282 118 L292 188" stroke="#4A4A4A" strokeWidth="10" />
                <path d="M282 118 L292 188" stroke="#FFFFFF" strokeWidth="5" />
                <g transform="translate(100,0) scale(.55)">
                  <path d="M-13 242 V334" stroke="#4A4A4A" strokeWidth="24" />
                  <path d="M-13 242 V334" stroke="#E4E4E4" strokeWidth="19" />
                  <path d="M13 242 V334" stroke="#4A4A4A" strokeWidth="24" />
                  <path d="M13 242 V334" stroke="#E4E4E4" strokeWidth="19" />
                  <path d="M-30 342 Q-30 328 -12 328 Q-2 328 -2 342 Z" fill="#FFFFFF" />
                  <path d="M2 342 Q2 328 12 328 Q30 328 30 342 Z" fill="#FFFFFF" />
                  <g transform="translate(0,150)">
                    <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                    <path d="M-12 6 Q0 18 12 6" />
                    <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                    <path
                      d="M-33 -36 Q-40 -50 -30 -60 Q-30 -76 -12 -72 Q0 -84 14 -72 Q32 -76 32 -58 Q42 -48 33 -36 Q20 -50 0 -52 Q-20 -50 -33 -36Z"
                      fill="#DCDCDC"
                    />
                    <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                    <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                    <ellipse cx="0" cy="-19" rx="5" ry="4" fill="#FFFFFF" />
                  </g>
                  <path d="M-36 167 Q-48 207 -38 243" stroke="#4A4A4A" strokeWidth="22" />
                  <path d="M-36 167 Q-48 207 -38 243" stroke="#FFFFFF" strokeWidth="17" />
                  <circle cx="-38" cy="251" r="10" fill="#FFFFFF" />
                  <g
                    style={{
                      transform: hv.k5t,
                      transition: 'transform .25s ease',
                      transformBox: 'fill-box',
                      transformOrigin: 'center',
                    }}
                  >
                    <path d="M36 167 Q90 150 118 112" stroke="#4A4A4A" strokeWidth="22" />
                    <path d="M36 167 Q90 150 118 112" stroke="#FFFFFF" strokeWidth="17" />
                    <circle cx="122" cy="106" r="10" fill="#FFFFFF" />
                  </g>
                </g>
              </svg>
            </div>
            <div style={{ fontWeight: '800', fontSize: '22px', lineHeight: '1.25' }}>
              Fikrini aydın təqdim etmək
            </div>
          </div>
          <div
            onPointerEnter={on.k6}
            onPointerLeave={off}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            <div
              style={{
                aspectRatio: '16/10',
                background: '#F6F6F6',
                borderRadius: '6px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                viewBox="0 0 320 200"
                width="100%"
                role="img"
                aria-label="Birinci prototipdən rəylə yaxşılaşdırılmış ikinci versiyaya"
                fill="none"
                stroke="#4A4A4A"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'block', width: '100%', height: '100%' }}
              >
                <ellipse cx="76" cy="168" rx="52" ry="7" fill="#000000" fillOpacity="0.06" stroke="none" />
                <ellipse cx="244" cy="166" rx="56" ry="7" fill="#000000" fillOpacity="0.06" stroke="none" />
                <path d="M40 110 Q62 104 96 108 L100 160 Q70 166 44 162 Z" fill="#FFFFFF" />
                <path d="M40 110 L60 94 Q90 90 116 94 L96 108" fill="#FFFFFF" />
                <path d="M96 108 L116 94 L118 146 L100 160" fill="#EDEDED" />
                <path d="M56 126 L82 146 M82 124 L58 148" stroke="#BDBDBD" strokeWidth="2" />
                <path d="M132 118 Q160 88 190 112" strokeDasharray="2 8" />
                <path d="M178 104 L190 112 L178 120" />
                <path d="M200 104 L262 104 L262 160 L200 160 Z" fill="#FFFFFF" />
                <path d="M262 104 L284 90 L284 146 L262 160 Z" fill="#EDEDED" />
                <path d="M200 104 L222 90 L284 90 L262 104 Z" fill="#FFFFFF" />
                <g
                  style={{
                    transform: hv.k6t,
                    transition: 'transform .25s ease',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }}
                >
                  <path
                    d="M214 118 L244 116 L246 142 L216 144 Z"
                    style={{ fill: hv.k6note, transition: 'fill .25s ease' }}
                  />
                  <path d="M222 130 L228 136 L238 124" strokeWidth="2.4" />
                </g>
              </svg>
            </div>
            <div style={{ fontWeight: '800', fontSize: '22px', lineHeight: '1.25' }}>
              Rəylə işini yaxşılaşdırmaq
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
