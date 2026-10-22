import { Fragment, useState } from 'react';
import { useText } from '../hooks/usePublicContent';
import { useWidth } from '../hooks/useWidth';

const STAGES = ['Eskiz', 'Prototip və sınaq', 'Sadə hesab', 'Təqdimat'];

export default function SampleProject() {
  const heading = useText('sample_project.heading');
  const intro = useText('sample_project.intro');
  const [stage, setStage] = useState(0);
  const narrow = useWidth() < 700;

  const pjCols = narrow ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))';
  const pjStages = STAGES.map((label, i) => {
    const on = stage === i;
    return {
      n: i + 1,
      label,
      cur: on ? ('step' as const) : false,
      pick: () => setStage(i),
      line: on ? '#FF0083' : 'transparent',
      ring: on ? '#FF0083' : '#1A1A1A',
      bg: on ? '#FF0083' : '#FFFFFF',
      fg: on ? '#FFFFFF' : '#1A1A1A',
      fw: on ? 800 : 600,
    };
  });
  const [pj0, pj1, pj2, pj3] = STAGES.map((_, i) => stage === i);
  return (
    <section id="layihe" style={{ background: '#FFFFFF', borderTop: '1px solid #EAEAEA' }}>
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(72px,10vw,120px) clamp(20px,4vw,32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
        }}
      >
        <div
          data-reveal="1"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>İdeyadan təqdimata</div>
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
              {heading}
            </h2>
            <p style={{ margin: '0', fontSize: '19px', lineHeight: '1.6', color: '#4A4A4A' }}>{intro}</p>
          </div>
          <span
            style={{
              padding: '8px 14px',
              border: '1.5px dashed #1A1A1A',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '800',
            }}
          >
            Nümunə layihə
          </span>
        </div>
        <div
          role="group"
          aria-label="Layihənin mərhələləri"
          style={{ display: 'grid', gridTemplateColumns: pjCols, borderTop: '1.5px solid #1A1A1A' }}
        >
          {pjStages.map((p, __i) => (
            <Fragment key={__i}>
              <button
                onClick={p.pick}
                aria-current={p.cur}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '18px 14px 16px 0',
                  border: 'none',
                  borderBottom: `3px solid ${p.line}`,
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: '#1A1A1A',
                  transition: 'border-color .25s',
                }}
                className="hv-1"
              >
                <span
                  style={{
                    width: '38px',
                    height: '38px',
                    flexShrink: '0',
                    borderRadius: '50%',
                    border: `2px solid ${p.ring}`,
                    background: p.bg,
                    color: p.fg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '15px',
                    transition: 'background .25s, color .25s, border-color .25s',
                  }}
                >
                  {p.n}
                </span>
                <span style={{ fontWeight: p.fw, fontSize: '17px', lineHeight: '1.25' }}>{p.label}</span>
              </button>
            </Fragment>
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))',
            gap: '32px 64px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              aspectRatio: '660/400',
              background: '#F6F6F6',
              borderRadius: '6px',
              padding: '16px',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {pj0 && (
              <>
                <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                  <svg
                    viewBox="0 0 660 400"
                    width="100%"
                    role="img"
                    aria-label="Dəftərdə qələm tutacağının ilkin eskizi və ölçü qeydləri"
                    fill="none"
                    stroke="#4A4A4A"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <path d="M60 340 Q200 300 330 298 L326 70 Q200 70 70 110 Z" fill="#FFFFFF" />
                    <path d="M330 298 Q460 300 600 340 L590 110 Q460 70 326 70 Z" fill="#FFFFFF" />
                    <path d="M326 70 L330 298" stroke="#BDBDBD" />
                    <path
                      d="M64 340 Q200 310 330 310 Q460 310 596 340 L596 354 Q460 324 330 324 Q200 324 64 354 Z"
                      fill="#EDEDED"
                    />
                    <g stroke="#8C8C8C" strokeWidth="2" strokeDasharray="0">
                      <path d="M150 260 L250 260 L250 170 L150 182 Z" />
                      <path d="M250 260 L276 242 L276 154 L250 170" />
                      <path d="M150 182 L176 164 L276 154" />
                      <path d="M168 176 L158 120 M200 172 L202 112 M232 170 L248 120" />
                    </g>
                    <path d="M150 226 L250 222 L250 210 L150 214 Z" stroke="#FF0083" strokeWidth="2.4" />
                    <g stroke="#9A9A9A" strokeWidth="1.8">
                      <path d="M150 284 H250 M150 278 V290 M250 278 V290" />
                      <path d="M126 182 V260 M120 182 H132 M120 260 H132" />
                    </g>
                    <g stroke="#BDBDBD" strokeWidth="2">
                      <path d="M370 150 Q440 154 520 164 M370 180 Q430 184 500 192 M370 210 Q420 214 480 220" />
                    </g>
                    <path d="M380 270 L520 236" stroke="#4A4A4A" strokeWidth="12" />
                    <path d="M380 270 L520 236" stroke="#FFFFFF" strokeWidth="7" />
                    <path d="M380 270 L364 276 L376 262" fill="#4A4A4A" />
                  </svg>
                </div>
              </>
            )}
            {pj1 && (
              <>
                <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                  <svg
                    viewBox="0 0 660 400"
                    width="100%"
                    role="img"
                    aria-label="Karton model, içinə qoyulan qələmlər və altlığı düzəldən əl"
                    fill="none"
                    stroke="#4A4A4A"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <path d="M80 360 H580" strokeWidth="2" />
                    <ellipse
                      cx="330"
                      cy="358"
                      rx="150"
                      ry="10"
                      fill="#000000"
                      fillOpacity="0.06"
                      stroke="none"
                    />
                    <path d="M190 356 L470 356 L500 336 L220 336 Z" fill="#FFFFFF" />
                    <path d="M190 356 H470 V366 H190 Z" fill="#EDEDED" />
                    <g transform="translate(330 344) scale(1.25)">
                      <path d="M-18 -64 L-26 -112" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M-18 -64 L-26 -112" stroke="#FFFFFF" strokeWidth="5" />
                      <path d="M-26 -112 L-30 -124 L-22 -116" fill="#4A4A4A" />
                      <path d="M4 -72 L6 -124" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M4 -72 L6 -124" stroke="#F4F4F4" strokeWidth="5" />
                      <path d="M6 -124 L6 -136 L10 -126" fill="#4A4A4A" />
                      <path d="M26 -76 L40 -118" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M26 -76 L40 -118" stroke="#FFE6F3" strokeWidth="5" />
                      <path d="M40 -118 L44 -130 L45 -118" fill="#4A4A4A" />
                      <path d="M-40 0 L40 0 L40 -70 L-40 -60 Z" fill="#FFFFFF" />
                      <path d="M40 0 L60 -14 L60 -84 L40 -70 Z" fill="#EDEDED" />
                      <path d="M-40 -60 L-20 -74 L60 -84 L40 -70 Z" fill="#F4F4F4" />
                      <path d="M-40 -22 L40 -26 L40 -38 L-40 -34 Z" fill="#FF0083" />
                      <path d="M40 -26 L60 -40 L60 -52 L40 -38 Z" fill="#FF0083" fillOpacity="0.75" />
                    </g>
                    <path d="M196 350 L210 342" stroke="#FF0083" strokeWidth="3" />
                    <path d="M680 420 L520 342" stroke="#4A4A4A" strokeWidth="60" />
                    <path d="M680 420 L520 342" stroke="#EDEDED" strokeWidth="55" />
                    <path
                      d="M512 320 Q486 306 462 318 Q450 330 456 346 Q464 360 486 360 Q508 360 516 350 Z"
                      fill="#FFFFFF"
                    />
                    <path d="M460 334 H482 M462 346 H486" strokeWidth="2" />
                  </svg>
                </div>
              </>
            )}
            {pj2 && (
              <>
                <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                  <svg
                    viewBox="0 0 660 400"
                    width="100%"
                    role="img"
                    aria-label="Eyni prototip və kalkulyator"
                    fill="none"
                    stroke="#4A4A4A"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <path d="M60 360 H600" strokeWidth="2" />
                    <ellipse
                      cx="230"
                      cy="358"
                      rx="90"
                      ry="9"
                      fill="#000000"
                      fillOpacity="0.06"
                      stroke="none"
                    />
                    <g transform="translate(230 354) scale(1.15)">
                      <path d="M-18 -64 L-26 -112" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M-18 -64 L-26 -112" stroke="#FFFFFF" strokeWidth="5" />
                      <path d="M-26 -112 L-30 -124 L-22 -116" fill="#4A4A4A" />
                      <path d="M4 -72 L6 -124" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M4 -72 L6 -124" stroke="#F4F4F4" strokeWidth="5" />
                      <path d="M6 -124 L6 -136 L10 -126" fill="#4A4A4A" />
                      <path d="M26 -76 L40 -118" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M26 -76 L40 -118" stroke="#FFE6F3" strokeWidth="5" />
                      <path d="M40 -118 L44 -130 L45 -118" fill="#4A4A4A" />
                      <path d="M-40 0 L40 0 L40 -70 L-40 -60 Z" fill="#FFFFFF" />
                      <path d="M40 0 L60 -14 L60 -84 L40 -70 Z" fill="#EDEDED" />
                      <path d="M-40 -60 L-20 -74 L60 -84 L40 -70 Z" fill="#F4F4F4" />
                      <path d="M-40 -22 L40 -26 L40 -38 L-40 -34 Z" fill="#FF0083" />
                      <path d="M40 -26 L60 -40 L60 -52 L40 -38 Z" fill="#FF0083" fillOpacity="0.75" />
                    </g>
                    <ellipse
                      cx="470"
                      cy="358"
                      rx="110"
                      ry="10"
                      fill="#000000"
                      fillOpacity="0.06"
                      stroke="none"
                    />
                    <path d="M390 230 L530 210 L560 330 L420 352 Z" fill="#FFFFFF" />
                    <path d="M420 352 L560 330 L560 342 L420 364 Z" fill="#EDEDED" />
                    <path d="M408 244 L516 228 L524 256 L416 272 Z" fill="#FFE6F3" />
                    <ellipse cx="428" cy="292" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
                    <ellipse cx="462" cy="287" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
                    <ellipse cx="496" cy="282" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
                    <ellipse cx="436" cy="314" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
                    <ellipse cx="470" cy="309" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
                    <ellipse cx="504" cy="304" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
                    <ellipse cx="444" cy="336" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
                    <ellipse cx="478" cy="331" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
                    <ellipse cx="512" cy="326" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
                  </svg>
                </div>
              </>
            )}
            {pj3 && (
              <>
                <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                  <svg
                    viewBox="0 0 640 400"
                    width="100%"
                    role="img"
                    aria-label="Uşaq qələm tutacağını kiçik auditoriyaya təqdim edir"
                    fill="none"
                    stroke="#4A4A4A"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <path d="M0 384 H660" strokeWidth="2" />
                    <rect x="420" y="50" width="200" height="150" rx="3" fill="#FFFFFF" />
                    <path
                      d="M450 170 V140 M490 170 V120 M530 170 V104"
                      strokeWidth="10"
                      strokeLinecap="butt"
                    />
                    <path d="M570 170 V84" stroke="#FF0083" strokeWidth="10" strokeLinecap="butt" />
                    <path d="M440 200 L430 384" stroke="#4A4A4A" strokeWidth="10" />
                    <path d="M440 200 L430 384" stroke="#FFFFFF" strokeWidth="5" />
                    <path d="M600 200 L610 384" stroke="#4A4A4A" strokeWidth="10" />
                    <path d="M600 200 L610 384" stroke="#FFFFFF" strokeWidth="5" />
                    <g transform="translate(300 330) scale(0.9) translate(-300 -330)">
                      <path d="M287 190 V322" stroke="#4A4A4A" strokeWidth="24" />
                      <path d="M287 190 V322" stroke="#E4E4E4" strokeWidth="19" />
                      <path d="M313 190 V322" stroke="#4A4A4A" strokeWidth="24" />
                      <path d="M313 190 V322" stroke="#E4E4E4" strokeWidth="19" />
                      <path d="M270 330 Q270 316 288 316 Q298 316 298 330 Z" fill="#FFFFFF" />
                      <path d="M302 330 Q302 316 312 316 Q330 316 330 330 Z" fill="#FFFFFF" />
                      <g transform="translate(300,98) scale(1)">
                        <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                        <path d="M-12 6 Q0 18 12 6" />
                        <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                        <path
                          d="M-33 -36 Q-40 -50 -30 -60 Q-30 -76 -12 -72 Q0 -84 14 -72 Q32 -76 32 -58 Q42 -48 33 -36 Q20 -50 0 -52 Q-20 -50 -33 -36Z"
                          fill="#DCDCDC"
                        />
                        <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <path d="M-8 -21 Q0 -15 8 -21" />
                      </g>
                    </g>
                    <path d="M272 170 Q262 200 274 226" stroke="#4A4A4A" strokeWidth="18" />
                    <path d="M272 170 Q262 200 274 226" stroke="#FFFFFF" strokeWidth="13" />
                    <circle cx="274" cy="234" r="9" fill="#FFFFFF" />
                    <path d="M328 170 Q360 150 364 118" stroke="#4A4A4A" strokeWidth="18" />
                    <path d="M328 170 Q360 150 364 118" stroke="#FFFFFF" strokeWidth="13" />
                    <g transform="translate(364 112) scale(0.55)">
                      <path d="M-18 -64 L-26 -112" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M-18 -64 L-26 -112" stroke="#FFFFFF" strokeWidth="5" />
                      <path d="M-26 -112 L-30 -124 L-22 -116" fill="#4A4A4A" />
                      <path d="M4 -72 L6 -124" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M4 -72 L6 -124" stroke="#F4F4F4" strokeWidth="5" />
                      <path d="M6 -124 L6 -136 L10 -126" fill="#4A4A4A" />
                      <path d="M26 -76 L40 -118" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M26 -76 L40 -118" stroke="#FFE6F3" strokeWidth="5" />
                      <path d="M40 -118 L44 -130 L45 -118" fill="#4A4A4A" />
                      <path d="M-40 0 L40 0 L40 -70 L-40 -60 Z" fill="#FFFFFF" />
                      <path d="M40 0 L60 -14 L60 -84 L40 -70 Z" fill="#EDEDED" />
                      <path d="M-40 -60 L-20 -74 L60 -84 L40 -70 Z" fill="#F4F4F4" />
                      <path d="M-40 -22 L40 -26 L40 -38 L-40 -34 Z" fill="#FF0083" />
                      <path d="M40 -26 L60 -40 L60 -52 L40 -38 Z" fill="#FF0083" fillOpacity="0.75" />
                    </g>
                    <g transform="translate(140,350) scale(0.95)">
                      <path d="M-40 70 Q-40 18 0 16 Q40 18 40 70 Z" fill="#EDEDED" />
                      <circle cx="0" cy="-12" r="28" fill="#FFFFFF" />
                      <path
                        d="M-28 -10 Q-30 -42 0 -42 Q30 -42 28 -10 Q14 -24 0 -24 Q-14 -24 -28 -10Z"
                        fill="#DCDCDC"
                      />
                    </g>
                    <g transform="translate(300,356) scale(0.95)">
                      <path d="M-40 70 Q-40 18 0 16 Q40 18 40 70 Z" fill="#EDEDED" />
                      <circle cx="0" cy="-12" r="28" fill="#FFFFFF" />
                      <path
                        d="M-28 -16 Q-28 -42 0 -42 Q28 -42 28 -16 Q30 10 20 16 Q0 4 -20 16 Q-30 10 -28 -16Z"
                        fill="#DCDCDC"
                      />
                    </g>
                    <g transform="translate(460,356) scale(0.95)">
                      <path d="M-40 70 Q-40 18 0 16 Q40 18 40 70 Z" fill="#EDEDED" />
                      <circle cx="0" cy="-12" r="28" fill="#FFFFFF" />
                      <path
                        d="M-28 -10 Q-30 -42 0 -42 Q30 -42 28 -10 Q14 -24 0 -24 Q-14 -24 -28 -10Z"
                        fill="#DCDCDC"
                      />
                    </g>
                  </svg>
                </div>
              </>
            )}
          </div>
          <div
            aria-live="polite"
            style={{
              minHeight: '300px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '16px',
            }}
          >
            {pj0 && (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    animation: 'kuFade .3s ease',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#FF0083' }}>Mərhələ 1 / 4</div>
                  <div style={{ fontWeight: '800', fontSize: '30px', letterSpacing: '-0.02em' }}>Eskiz</div>
                  <p style={{ margin: '0', fontSize: '18px', lineHeight: '1.6', color: '#4A4A4A' }}>
                    Qələmləri bir yerdə saxlamaq üçün sadə həll düşünür, necə görünəcəyini çəkirik.
                  </p>
                </div>
              </>
            )}
            {pj1 && (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    animation: 'kuFade .3s ease',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#FF0083' }}>Mərhələ 2 / 4</div>
                  <div style={{ fontWeight: '800', fontSize: '30px', letterSpacing: '-0.02em' }}>
                    Prototip və sınaq
                  </div>
                  <p style={{ margin: '0', fontSize: '18px', lineHeight: '1.6', color: '#4A4A4A' }}>
                    İlk nümunəni hazırlayır və sınayırıq. Aşırsa, altlığını genişləndiririk. Qələmlər
                    sığmırsa, formasını dəyişirik.
                  </p>
                </div>
              </>
            )}
            {pj2 && (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    animation: 'kuFade .3s ease',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#FF0083' }}>Mərhələ 3 / 4</div>
                  <div style={{ fontWeight: '800', fontSize: '30px', letterSpacing: '-0.02em' }}>
                    Sadə hesab
                  </div>
                  <p style={{ margin: '0', fontSize: '18px', lineHeight: '1.6', color: '#4A4A4A' }}>
                    Hazırlamaq neçəyə başa gəlir? Hansı qiyməti sınaya bilərik? Hesablayır və müzakirə edirik.
                  </p>
                  <dl
                    style={{
                      margin: '0',
                      display: 'flex',
                      flexDirection: 'column',
                      borderTop: '1.5px solid #1A1A1A',
                      maxWidth: '420px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '16px',
                        padding: '10px 0',
                        borderBottom: '1px solid #EAEAEA',
                        fontSize: '17px',
                      }}
                    >
                      <dt style={{ color: '#4A4A4A', fontWeight: '600' }}>Material xərci</dt>
                      <dd style={{ margin: '0', fontWeight: '800' }}>2 AZN</dd>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '16px',
                        padding: '10px 0',
                        borderBottom: '1px solid #EAEAEA',
                        fontSize: '17px',
                      }}
                    >
                      <dt style={{ color: '#4A4A4A', fontWeight: '600' }}>Nümunə satış qiyməti</dt>
                      <dd style={{ margin: '0', fontWeight: '800' }}>5 AZN</dd>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '16px',
                        padding: '10px 0',
                        fontSize: '19px',
                      }}
                    >
                      <dt style={{ fontWeight: '800' }}>Fərq</dt>
                      <dd style={{ margin: '0', fontWeight: '800', color: '#FF0083' }}>3 AZN</dd>
                    </div>
                  </dl>
                  <div style={{ fontSize: '14px', lineHeight: '1.5', color: '#6B6B6B' }}>
                    Yalnız material xərcini nəzərə alan tədris nümunəsidir. Digər xərclər olduqda nəticə
                    dəyişir.
                  </div>
                </div>
              </>
            )}
            {pj3 && (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    animation: 'kuFade .3s ease',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#FF0083' }}>Mərhələ 4 / 4</div>
                  <div style={{ fontWeight: '800', fontSize: '30px', letterSpacing: '-0.02em' }}>
                    Təqdimat
                  </div>
                  <p style={{ margin: '0', fontSize: '18px', lineHeight: '1.6', color: '#4A4A4A' }}>
                    Hansı problemi həll etdiyimizi, kimə faydalı olduğunu və sınaqdan nə öyrəndiyimizi izah
                    edirik.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ fontSize: '14px', color: '#6B6B6B' }}>
          Bu, proqramın yanaşmasını göstərən illüstrativ nümunədir. Uşaqların hazırlayacağı layihələr fərqli
          ola bilər.
        </div>
      </div>
    </section>
  );
}
