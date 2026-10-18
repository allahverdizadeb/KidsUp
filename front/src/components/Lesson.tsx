import { Fragment, useState } from 'react';
import { LESSONS } from '../content/lessons';
import { useWidth } from '../hooks/useWidth';

export default function Lesson() {
  const [current, setCurrent] = useState(0);
  const narrow = useWidth() < 900;

  const lsWide = !narrow;
  const lsNarrow = narrow;
  const lsCols = narrow ? 'minmax(0,1fr)' : 'minmax(280px,380px) minmax(0,1fr)';
  const lessons = LESSONS.map(({ time, title }, i) => {
    const on = i === current;
    return {
      n: i + 1,
      time,
      title,
      start: time.split('–')[0],
      aria: `${i + 1}. ${time} ${title}`,
      cur: on ? ('step' as const) : false,
      pick: () => setCurrent(i),
      ring: on ? '#FF0083' : '#1A1A1A',
      bg: on ? '#FF0083' : '#FFFFFF',
      fg: on ? '#FFFFFF' : '#1A1A1A',
      tc: on ? '#FF0083' : '#6B6B6B',
      fw: on ? 800 : 600,
      ul: on ? 'underline' : 'none',
    };
  });
  const [ls0, ls1, ls2, ls3, ls4, ls5, ls6, ls7] = LESSONS.map((_, i) => i === current);
  const lsTime = LESSONS[current].time;
  const lsTitle = LESSONS[current].title;
  const lsDesc = LESSONS[current].desc;
  return (
    <section id="ders" style={{ background: '#FFFFFF', borderTop: '1px solid #EAEAEA' }}>
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(72px,10vw,120px) clamp(20px,4vw,32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '48px',
        }}
      >
        <div
          data-reveal="1"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px' }}
        >
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>Bir görüş, 3,5 saat</div>
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
            Bir dərsimiz necə keçir?
          </h2>
          <p
            style={{ margin: '0', fontSize: '19px', lineHeight: '1.6', color: '#4A4A4A', textWrap: 'pretty' }}
          >
            Dinləyirik, oynayırıq, hazırlayırıq və fikirlərimizi bölüşürük. Fasilələr də daxil olmaqla, 3,5
            saatlıq bir görüşümüzlə tanış olun.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: lsCols, gap: '40px 72px', alignItems: 'start' }}>
          {lsWide && (
            <>
              <ol
                style={{
                  margin: '0',
                  padding: '0',
                  listStyle: 'none',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '21px',
                    top: '26px',
                    bottom: '26px',
                    width: '2px',
                    background: '#E3E3E3',
                  }}
                />
                {lessons.map((l, __i) => (
                  <Fragment key={__i}>
                    <li style={{ position: 'relative' }}>
                      <button
                        onClick={l.pick}
                        aria-current={l.cur}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '18px',
                          padding: '10px 12px 10px 0',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          color: '#1A1A1A',
                          borderRadius: '6px',
                        }}
                        className="hv-4"
                      >
                        <span
                          style={{
                            position: 'relative',
                            zIndex: '1',
                            width: '44px',
                            height: '44px',
                            flexShrink: '0',
                            borderRadius: '50%',
                            border: `2px solid ${l.ring}`,
                            background: l.bg,
                            color: l.fg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '800',
                            fontSize: '16px',
                            transition: 'background .25s, color .25s, border-color .25s',
                          }}
                        >
                          {l.n}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '0' }}>
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: '800',
                              color: l.tc,
                              transition: 'color .25s',
                            }}
                          >
                            {l.time}
                          </span>
                          <span
                            style={{
                              fontSize: '18px',
                              fontWeight: l.fw,
                              lineHeight: '1.3',
                              textDecorationLine: l.ul,
                              textDecorationColor: '#FF0083',
                              textDecorationThickness: '2px',
                              textUnderlineOffset: '5px',
                            }}
                          >
                            {l.title}
                          </span>
                        </span>
                      </button>
                    </li>
                  </Fragment>
                ))}
              </ol>
            </>
          )}
          {lsNarrow && (
            <>
              <div
                role="group"
                aria-label="Dərsin mərhələləri"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '6px' }}
              >
                {lessons.map((l, __i) => (
                  <Fragment key={__i}>
                    <button
                      onClick={l.pick}
                      aria-current={l.cur}
                      aria-label={l.aria}
                      style={{
                        minHeight: '52px',
                        borderRadius: '6px',
                        border: `1.5px solid ${l.ring}`,
                        background: l.bg,
                        color: l.fg,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1px',
                        fontWeight: '800',
                      }}
                    >
                      <span style={{ fontSize: '15px' }}>{l.n}</span>
                      <span style={{ fontSize: '11px', fontWeight: '700' }}>{l.start}</span>
                    </button>
                  </Fragment>
                ))}
              </div>
            </>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div
              style={{
                aspectRatio: '640/400',
                background: '#F6F6F6',
                borderRadius: '6px',
                padding: '16px',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              {ls0 && (
                <>
                  <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                    <svg
                      viewBox="0 0 640 400"
                      width="100%"
                      role="img"
                      aria-label="Dairə şəklində oturan uşaqlar və təlimçi qısa oyunla günə başlayır"
                      fill="none"
                      stroke="#4A4A4A"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <path d="M0 384 H640" strokeWidth="2" />
                      <ellipse
                        cx="320"
                        cy="350"
                        rx="250"
                        ry="30"
                        fill="#000000"
                        fillOpacity="0.06"
                        stroke="none"
                      />
                      <ellipse
                        cx="320"
                        cy="340"
                        rx="240"
                        ry="36"
                        fill="#F6F6F6"
                        stroke="#DADADA"
                        strokeWidth="2"
                      />
                      <g transform="translate(170,250) scale(0.72)">
                        <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                        <path d="M-12 6 Q0 18 12 6" />
                        <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                        <path
                          d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q24 -58 4 -58 Q-16 -52 -32 -38Z"
                          fill="#DCDCDC"
                        />
                        <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <path d="M-8 -21 Q0 -15 8 -21" />
                      </g>
                      <g transform="translate(470,250) scale(0.72)">
                        <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                        <path d="M-12 6 Q0 18 12 6" />
                        <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                        <path d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q10 -54 -32 -38Z" fill="#DCDCDC" />
                        <path d="M30 -56 Q52 -54 50 -28 Q44 -36 32 -42" fill="#DCDCDC" />
                        <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <path d="M-8 -21 Q0 -15 8 -21" />
                      </g>
                      <path d="M306 274 V376" stroke="#4A4A4A" strokeWidth="24" />
                      <path d="M306 274 V376" stroke="#E4E4E4" strokeWidth="19" />
                      <path d="M334 274 V376" stroke="#4A4A4A" strokeWidth="24" />
                      <path d="M334 274 V376" stroke="#E4E4E4" strokeWidth="19" />
                      <path d="M288 384 Q288 370 306 370 Q318 370 318 384 Z" fill="#FFFFFF" />
                      <path d="M322 384 Q322 370 334 370 Q352 370 352 384 Z" fill="#FFFFFF" />
                      <g transform="translate(320,174)">
                        <path d="M-48 104 Q-50 20 -32 8 Q0 -2 32 8 Q50 20 48 104 Z" fill="#FFFFFF" />
                        <path d="M-12 6 Q0 18 12 6" />
                        <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                        <path
                          d="M-32 -40 Q-34 -72 0 -72 Q34 -72 32 -40 Q26 -56 0 -58 Q-26 -56 -32 -40Z"
                          fill="#9A9A9A"
                        />
                        <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <ellipse cx="0" cy="-19" rx="5" ry="4" fill="#FFFFFF" />
                      </g>
                      <path d="M286 200 Q262 230 268 262" stroke="#4A4A4A" strokeWidth="22" />
                      <path d="M286 200 Q262 230 268 262" stroke="#FFFFFF" strokeWidth="17" />
                      <circle cx="268" cy="270" r="10" fill="#FFFFFF" />
                      <path d="M354 200 Q388 196 398 168" stroke="#4A4A4A" strokeWidth="22" />
                      <path d="M354 200 Q388 196 398 168" stroke="#FFFFFF" strokeWidth="17" />
                      <circle cx="404" cy="152" r="17" fill="#FF0083" />
                      <path d="M392 146 Q404 138 416 148" stroke="#FFFFFF" strokeWidth="2" />
                      <g transform="translate(230,330) scale(0.9)">
                        <path d="M-40 70 Q-40 18 0 16 Q40 18 40 70 Z" fill="#EDEDED" />
                        <circle cx="0" cy="-12" r="28" fill="#FFFFFF" />
                        <path
                          d="M-28 -10 Q-30 -42 0 -42 Q30 -42 28 -10 Q14 -24 0 -24 Q-14 -24 -28 -10Z"
                          fill="#DCDCDC"
                        />
                      </g>
                      <g transform="translate(410,330) scale(0.9)">
                        <path d="M-40 70 Q-40 18 0 16 Q40 18 40 70 Z" fill="#EDEDED" />
                        <circle cx="0" cy="-12" r="28" fill="#FFFFFF" />
                        <path
                          d="M-28 -16 Q-28 -42 0 -42 Q28 -42 28 -16 Q30 10 20 16 Q0 4 -20 16 Q-30 10 -28 -16Z"
                          fill="#DCDCDC"
                        />
                      </g>
                    </svg>
                  </div>
                </>
              )}
              {ls1 && (
                <>
                  <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                    <svg
                      viewBox="0 0 640 400"
                      width="100%"
                      role="img"
                      aria-label="Təlimçi lövhə qarşısında mövzunu izah edir, uşaq sual verir"
                      fill="none"
                      stroke="#4A4A4A"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <path d="M0 384 H640" strokeWidth="2" />
                      <rect x="60" y="70" width="250" height="170" rx="3" fill="#FFFFFF" />
                      <path
                        d="M90 200 V160 M130 200 V140 M170 200 V120"
                        strokeWidth="10"
                        strokeLinecap="butt"
                      />
                      <path d="M210 200 V100" stroke="#4A4A4A" strokeWidth="10" strokeLinecap="butt" />
                      <path
                        d="M240 110 H290 M240 132 H282 M240 154 H276"
                        stroke="#BDBDBD"
                        strokeWidth="2.4"
                      />
                      <path d="M80 240 L70 384" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M80 240 L70 384" stroke="#FFFFFF" strokeWidth="5" />
                      <path d="M290 240 L300 384" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M290 240 L300 384" stroke="#FFFFFF" strokeWidth="5" />
                      <path d="M346 274 V376" stroke="#4A4A4A" strokeWidth="24" />
                      <path d="M346 274 V376" stroke="#E4E4E4" strokeWidth="19" />
                      <path d="M374 274 V376" stroke="#4A4A4A" strokeWidth="24" />
                      <path d="M374 274 V376" stroke="#E4E4E4" strokeWidth="19" />
                      <path d="M328 384 Q328 370 346 370 Q358 370 358 384 Z" fill="#FFFFFF" />
                      <path d="M362 384 Q362 370 374 370 Q392 370 392 384 Z" fill="#FFFFFF" />
                      <g transform="translate(360,174)">
                        <path d="M-48 104 Q-50 20 -32 8 Q0 -2 32 8 Q50 20 48 104 Z" fill="#FFFFFF" />
                        <path d="M-12 6 Q0 18 12 6" />
                        <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                        <path
                          d="M-32 -40 Q-34 -72 0 -72 Q34 -72 32 -40 Q26 -56 0 -58 Q-26 -56 -32 -40Z"
                          fill="#9A9A9A"
                        />
                        <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <ellipse cx="0" cy="-19" rx="5" ry="4" fill="#FFFFFF" />
                      </g>
                      <path d="M326 200 Q290 170 262 150" stroke="#4A4A4A" strokeWidth="22" />
                      <path d="M326 200 Q290 170 262 150" stroke="#FFFFFF" strokeWidth="17" />
                      <circle cx="256" cy="146" r="10" fill="#FFFFFF" />
                      <path d="M394 200 Q404 240 396 270" stroke="#4A4A4A" strokeWidth="22" />
                      <path d="M394 200 Q404 240 396 270" stroke="#FFFFFF" strokeWidth="17" />
                      <circle cx="396" cy="278" r="10" fill="#FFFFFF" />
                      <g transform="translate(540,284) scale(0.78)">
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
                      <path d="M566 296 Q590 260 584 210" stroke="#4A4A4A" strokeWidth="18" />
                      <path d="M566 296 Q590 260 584 210" stroke="#FFFFFF" strokeWidth="13" />
                      <circle cx="584" cy="204" r="8" fill="#FFFFFF" />
                      <path
                        d="M510 92 H564 Q574 92 574 102 V138 Q574 148 564 148 H556 L568 162 L544 148 H510 Q500 148 500 138 V102 Q500 92 510 92 Z"
                        fill="#FFFFFF"
                      />
                      <path
                        d="M530 118 Q530 108 537 108 Q545 108 545 116 Q545 122 537 125 V130 M537 136 V137"
                        stroke="#FF0083"
                        strokeWidth="3.4"
                      />
                    </svg>
                  </div>
                </>
              )}
              {ls2 && (
                <>
                  <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                    <svg
                      viewBox="0 0 640 400"
                      width="100%"
                      role="img"
                      aria-label="Uşaqlar masa üzərində kartlarla tapşırıq həll edir"
                      fill="none"
                      stroke="#4A4A4A"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <path d="M0 384 H640" strokeWidth="2" />
                      <g transform="translate(200,200) scale(0.85)">
                        <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                        <path d="M-12 6 Q0 18 12 6" />
                        <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                        <path
                          d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q24 -58 4 -58 Q-16 -52 -32 -38Z"
                          fill="#DCDCDC"
                        />
                        <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <path d="M-8 -21 Q0 -15 8 -21" />
                      </g>
                      <g transform="translate(320,190) scale(0.85)">
                        <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                        <path d="M-12 6 Q0 18 12 6" />
                        <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                        <path
                          d="M-32 -36 Q-34 -74 0 -72 Q34 -74 32 -36 Q20 -54 0 -54 Q-20 -54 -32 -36Z"
                          fill="#DCDCDC"
                        />
                        <circle cx="0" cy="-80" r="12" fill="#DCDCDC" />
                        <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <ellipse cx="0" cy="-19" rx="5" ry="4" fill="#FFFFFF" />
                      </g>
                      <g transform="translate(440,200) scale(0.85)">
                        <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                        <path d="M-12 6 Q0 18 12 6" />
                        <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                        <path d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q10 -54 -32 -38Z" fill="#DCDCDC" />
                        <path d="M30 -56 Q52 -54 50 -28 Q44 -36 32 -42" fill="#DCDCDC" />
                        <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <path d="M-8 -21 Q0 -15 8 -21" />
                      </g>
                      <path d="M140 270 H500 L530 300 H110 Z" fill="#FFFFFF" />
                      <path d="M110 300 H530 V312 H110 Z" fill="#EDEDED" />
                      <path d="M126 312 V384" stroke="#4A4A4A" strokeWidth="12" />
                      <path d="M126 312 V384" stroke="#FFFFFF" strokeWidth="7" />
                      <path d="M514 312 V384" stroke="#4A4A4A" strokeWidth="12" />
                      <path d="M514 312 V384" stroke="#FFFFFF" strokeWidth="7" />
                      <g transform="rotate(-8 230 286)">
                        <rect x="210" y="274" width="40" height="26" rx="3" fill="#FFFFFF" />
                      </g>
                      <rect x="262" y="276" width="40" height="26" rx="3" fill="#FFFFFF" />
                      <g transform="rotate(6 352 286)">
                        <rect x="330" y="274" width="40" height="26" rx="3" fill="#FF0083" />
                      </g>
                      <g transform="rotate(-4 412 286)">
                        <rect x="392" y="276" width="40" height="26" rx="3" fill="#FFFFFF" />
                      </g>
                      <path d="M226 230 Q226 260 240 278" stroke="#4A4A4A" strokeWidth="18" />
                      <path d="M226 230 Q226 260 240 278" stroke="#FFFFFF" strokeWidth="13" />
                      <path d="M352 220 Q356 252 350 276" stroke="#4A4A4A" strokeWidth="18" />
                      <path d="M352 220 Q356 252 350 276" stroke="#FFFFFF" strokeWidth="13" />
                      <path d="M414 230 Q410 260 408 278" stroke="#4A4A4A" strokeWidth="18" />
                      <path d="M414 230 Q410 260 408 278" stroke="#FFFFFF" strokeWidth="13" />
                    </svg>
                  </div>
                </>
              )}
              {ls3 && (
                <>
                  <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                    <svg
                      viewBox="0 0 640 400"
                      width="100%"
                      role="img"
                      aria-label="Fasilə: su qabı və yüngül hərəkət edən uşaqlar"
                      fill="none"
                      stroke="#4A4A4A"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <path d="M0 384 H640" strokeWidth="2" />
                      <ellipse
                        cx="300"
                        cy="384"
                        rx="200"
                        ry="10"
                        fill="#000000"
                        fillOpacity="0.06"
                        stroke="none"
                      />
                      <g transform="translate(220 384) scale(0.9) translate(-220 -384)">
                        <path d="M207 244 V376" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M207 244 V376" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M233 244 V376" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M233 244 V376" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M190 384 Q190 370 208 370 Q218 370 218 384 Z" fill="#FFFFFF" />
                        <path d="M222 384 Q222 370 232 370 Q250 370 250 384 Z" fill="#FFFFFF" />
                        <g transform="translate(220,152) scale(1)">
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
                      <path d="M190 196 Q176 160 180 120" stroke="#4A4A4A" strokeWidth="20" />
                      <path d="M190 196 Q176 160 180 120" stroke="#FFFFFF" strokeWidth="15" />
                      <circle cx="180" cy="114" r="9" fill="#FFFFFF" />
                      <path d="M250 196 Q264 160 260 120" stroke="#4A4A4A" strokeWidth="20" />
                      <path d="M250 196 Q264 160 260 120" stroke="#FFFFFF" strokeWidth="15" />
                      <circle cx="260" cy="114" r="9" fill="#FFFFFF" />
                      <g transform="translate(400 384) scale(0.9) translate(-400 -384)">
                        <path d="M387 244 V376" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M387 244 V376" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M413 244 V376" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M413 244 V376" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M370 384 Q370 370 388 370 Q398 370 398 384 Z" fill="#FFFFFF" />
                        <path d="M402 384 Q402 370 412 370 Q430 370 430 384 Z" fill="#FFFFFF" />
                        <g transform="translate(400,152) scale(1)">
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
                      <path d="M370 200 Q356 236 368 262" stroke="#4A4A4A" strokeWidth="20" />
                      <path d="M370 200 Q356 236 368 262" stroke="#FFFFFF" strokeWidth="15" />
                      <circle cx="368" cy="270" r="9" fill="#FFFFFF" />
                      <path d="M430 200 Q452 222 456 248" stroke="#4A4A4A" strokeWidth="20" />
                      <path d="M430 200 Q452 222 456 248" stroke="#FFFFFF" strokeWidth="15" />
                      <circle cx="458" cy="256" r="9" fill="#FFFFFF" />
                      <path d="M540 330 H610 V384 H540 Z" fill="#FFFFFF" />
                      <path d="M548 276 V322 Q548 328 554 328 H566 Q572 328 572 322 V276" fill="#FFFFFF" />
                      <rect x="551" y="266" width="18" height="10" rx="2" fill="#FF0083" />
                      <path d="M548 294 H572" stroke="#BDBDBD" strokeWidth="2" />
                      <path d="M578 282 V328 Q578 334 584 334 H596 Q602 334 602 328 V282" fill="#FFFFFF" />
                      <rect x="581" y="272" width="18" height="10" rx="2" fill="#FFFFFF" />
                      <path d="M578 300 H602" stroke="#BDBDBD" strokeWidth="2" />
                    </svg>
                  </div>
                </>
              )}
              {ls4 && (
                <>
                  <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                    <svg
                      viewBox="0 0 640 400"
                      width="100%"
                      role="img"
                      aria-label="Komanda karton, qələm və lentlə prototip hazırlayır"
                      fill="none"
                      stroke="#4A4A4A"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <path d="M0 384 H640" strokeWidth="2" />
                      <g transform="translate(210,206) scale(0.85)">
                        <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                        <path d="M-12 6 Q0 18 12 6" />
                        <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                        <path
                          d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q24 -58 4 -58 Q-16 -52 -32 -38Z"
                          fill="#DCDCDC"
                        />
                        <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <path d="M-8 -21 Q0 -15 8 -21" />
                      </g>
                      <g transform="translate(430,206) scale(0.85)">
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
                      <path d="M130 270 H510 L540 300 H100 Z" fill="#FFFFFF" />
                      <path d="M100 300 H540 V312 H100 Z" fill="#EDEDED" />
                      <path d="M116 312 V384" stroke="#4A4A4A" strokeWidth="12" />
                      <path d="M116 312 V384" stroke="#FFFFFF" strokeWidth="7" />
                      <path d="M524 312 V384" stroke="#4A4A4A" strokeWidth="12" />
                      <path d="M524 312 V384" stroke="#FFFFFF" strokeWidth="7" />
                      <g transform="translate(320 292) scale(0.9)">
                        <path d="M-40 0 L40 0 L40 -70 L-40 -60 Z" fill="#FFFFFF" />
                        <path d="M40 0 L60 -14 L60 -84 L40 -70 Z" fill="#EDEDED" />
                        <path d="M-40 -60 L-20 -74 L60 -84 L40 -70 Z" fill="#F4F4F4" />
                        <path d="M-40 -22 L40 -26 L40 -38 L-40 -34 Z" fill="#FFFFFF" />
                        <path d="M40 -26 L60 -40 L60 -52 L40 -38 Z" fill="#FFFFFF" fillOpacity="0.75" />
                      </g>
                      <path d="M330 248 L350 230" stroke="#FF0083" strokeWidth="8" />
                      <path d="M420 286 V292 A20 7 0 0 0 460 292 V286" fill="#EDEDED" />
                      <ellipse cx="440" cy="286" rx="20" ry="7" fill="#FF0083" />
                      <ellipse cx="440" cy="286" rx="8" ry="3" fill="#FFFFFF" />
                      <path d="M170 282 L240 290" stroke="#4A4A4A" strokeWidth="8" />
                      <path d="M170 282 L240 290" stroke="#FFFFFF" strokeWidth="3" />
                      <path d="M240 290 L252 292 L240 296" fill="#4A4A4A" />
                      <path d="M236 236 Q256 262 278 270" stroke="#4A4A4A" strokeWidth="18" />
                      <path d="M236 236 Q256 262 278 270" stroke="#FFFFFF" strokeWidth="13" />
                      <circle cx="282" cy="272" r="9" fill="#FFFFFF" />
                      <path d="M404 236 Q388 262 368 266" stroke="#4A4A4A" strokeWidth="18" />
                      <path d="M404 236 Q388 262 368 266" stroke="#FFFFFF" strokeWidth="13" />
                      <circle cx="362" cy="266" r="9" fill="#FFFFFF" />
                    </svg>
                  </div>
                </>
              )}
              {ls5 && (
                <>
                  <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                    <svg
                      viewBox="0 0 640 400"
                      width="100%"
                      role="img"
                      aria-label="Qısa fasilə: uşaq oturub su içir"
                      fill="none"
                      stroke="#4A4A4A"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <path d="M0 384 H640" strokeWidth="2" />
                      <path d="M200 300 H440 V318 H200 Z" fill="#FFFFFF" />
                      <path d="M216 318 V384" stroke="#4A4A4A" strokeWidth="12" />
                      <path d="M216 318 V384" stroke="#FFFFFF" strokeWidth="7" />
                      <path d="M424 318 V384" stroke="#4A4A4A" strokeWidth="12" />
                      <path d="M424 318 V384" stroke="#FFFFFF" strokeWidth="7" />
                      <g transform="translate(320,210) scale(0.85)">
                        <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                        <path d="M-12 6 Q0 18 12 6" />
                        <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                        <path
                          d="M-32 -36 Q-34 -74 0 -72 Q34 -74 32 -36 Q20 -54 0 -54 Q-20 -54 -32 -36Z"
                          fill="#DCDCDC"
                        />
                        <circle cx="0" cy="-80" r="12" fill="#DCDCDC" />
                        <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                        <path d="M-8 -21 Q0 -15 8 -21" />
                      </g>
                      <path d="M296 222 Q284 252 300 270" stroke="#4A4A4A" strokeWidth="18" />
                      <path d="M296 222 Q284 252 300 270" stroke="#FFFFFF" strokeWidth="13" />
                      <circle cx="304" cy="272" r="9" fill="#FFFFFF" />
                      <path d="M294 226 V272 Q294 278 300 278 H312 Q318 278 318 272 V226" fill="#FFFFFF" />
                      <rect x="297" y="216" width="18" height="10" rx="2" fill="#FF0083" />
                      <path d="M294 244 H318" stroke="#BDBDBD" strokeWidth="2" />
                      <path d="M470 384 Q470 330 500 320 Q530 330 530 384" fill="#FFFFFF" />
                      <path
                        d="M500 320 Q486 280 504 250 M500 320 Q520 290 528 262 M500 320 Q478 300 470 278"
                        stroke="#9A9A9A"
                      />
                    </svg>
                  </div>
                </>
              )}
              {ls6 && (
                <>
                  <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                    <svg
                      viewBox="0 0 640 400"
                      width="100%"
                      role="img"
                      aria-label="Komanda prototipini digər uşaqlara göstərir"
                      fill="none"
                      stroke="#4A4A4A"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <path d="M0 384 H640" strokeWidth="2" />
                      <g transform="translate(250 330) scale(0.85) translate(-250 -330)">
                        <path d="M237 190 V322" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M237 190 V322" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M263 190 V322" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M263 190 V322" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M220 330 Q220 316 238 316 Q248 316 248 330 Z" fill="#FFFFFF" />
                        <path d="M252 330 Q252 316 262 316 Q280 316 280 330 Z" fill="#FFFFFF" />
                        <g transform="translate(250,98) scale(1)">
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
                      <g transform="translate(380 330) scale(0.85) translate(-380 -330)">
                        <path d="M367 190 V322" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M367 190 V322" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M393 190 V322" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M393 190 V322" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M350 330 Q350 316 368 316 Q378 316 378 330 Z" fill="#FFFFFF" />
                        <path d="M382 330 Q382 316 392 316 Q410 316 410 330 Z" fill="#FFFFFF" />
                        <g transform="translate(380,98) scale(1)">
                          <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                          <path d="M-12 6 Q0 18 12 6" />
                          <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                          <path
                            d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q24 -58 4 -58 Q-16 -52 -32 -38Z"
                            fill="#DCDCDC"
                          />
                          <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                          <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                          <path d="M-8 -21 Q0 -15 8 -21" />
                        </g>
                      </g>
                      <path d="M406 172 Q436 150 432 116" stroke="#4A4A4A" strokeWidth="18" />
                      <path d="M406 172 Q436 150 432 116" stroke="#FFFFFF" strokeWidth="13" />
                      <g transform="translate(432 112) scale(0.55)">
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
                      <path d="M224 172 Q210 200 222 224" stroke="#4A4A4A" strokeWidth="18" />
                      <path d="M224 172 Q210 200 222 224" stroke="#FFFFFF" strokeWidth="13" />
                      <circle cx="222" cy="232" r="9" fill="#FFFFFF" />
                      <g transform="translate(120,348) scale(0.9)">
                        <path d="M-40 70 Q-40 18 0 16 Q40 18 40 70 Z" fill="#EDEDED" />
                        <circle cx="0" cy="-12" r="28" fill="#FFFFFF" />
                        <path
                          d="M-28 -10 Q-30 -42 0 -42 Q30 -42 28 -10 Q14 -24 0 -24 Q-14 -24 -28 -10Z"
                          fill="#DCDCDC"
                        />
                      </g>
                      <g transform="translate(260,348) scale(0.9)">
                        <path d="M-40 70 Q-40 18 0 16 Q40 18 40 70 Z" fill="#EDEDED" />
                        <circle cx="0" cy="-12" r="28" fill="#FFFFFF" />
                        <path
                          d="M-28 -16 Q-28 -42 0 -42 Q28 -42 28 -16 Q30 10 20 16 Q0 4 -20 16 Q-30 10 -28 -16Z"
                          fill="#DCDCDC"
                        />
                      </g>
                      <g transform="translate(400,348) scale(0.9)">
                        <path d="M-40 70 Q-40 18 0 16 Q40 18 40 70 Z" fill="#EDEDED" />
                        <circle cx="0" cy="-12" r="28" fill="#FFFFFF" />
                        <path
                          d="M-28 -10 Q-30 -42 0 -42 Q30 -42 28 -10 Q14 -24 0 -24 Q-14 -24 -28 -10Z"
                          fill="#DCDCDC"
                        />
                      </g>
                      <g transform="translate(540,348) scale(0.9)">
                        <path d="M-40 70 Q-40 18 0 16 Q40 18 40 70 Z" fill="#EDEDED" />
                        <circle cx="0" cy="-12" r="28" fill="#FFFFFF" />
                        <path
                          d="M-28 -16 Q-28 -42 0 -42 Q28 -42 28 -16 Q30 10 20 16 Q0 4 -20 16 Q-30 10 -28 -16Z"
                          fill="#DCDCDC"
                        />
                      </g>
                    </svg>
                  </div>
                </>
              )}
              {ls7 && (
                <>
                  <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                    <svg
                      viewBox="0 0 640 400"
                      width="100%"
                      role="img"
                      aria-label="Uşaqlar qeyd lövhəsinə kiçik kağızlar yerləşdirir"
                      fill="none"
                      stroke="#4A4A4A"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <path d="M0 384 H640" strokeWidth="2" />
                      <rect x="170" y="50" width="300" height="200" rx="3" fill="#FFFFFF" />
                      <g transform="rotate(-5 224 100)">
                        <rect x="200" y="80" width="48" height="40" rx="2" fill="#FFFFFF" />
                        <path d="M208 94 H238 M208 104 H230" stroke="#BDBDBD" strokeWidth="2" />
                      </g>
                      <g transform="rotate(0 286 94)">
                        <rect x="262" y="74" width="48" height="40" rx="2" fill="#FFFFFF" />
                        <path d="M270 88 H300 M270 98 H292" stroke="#BDBDBD" strokeWidth="2" />
                      </g>
                      <g transform="rotate(5 354 106)">
                        <rect x="330" y="86" width="48" height="40" rx="2" fill="#FFFFFF" />
                        <path d="M338 100 H368 M338 110 H360" stroke="#BDBDBD" strokeWidth="2" />
                      </g>
                      <g transform="rotate(-5 238 170)">
                        <rect x="214" y="150" width="48" height="40" rx="2" fill="#FFFFFF" />
                        <path d="M222 164 H252 M222 174 H244" stroke="#BDBDBD" strokeWidth="2" />
                      </g>
                      <g transform="rotate(0 314 160)">
                        <rect x="290" y="140" width="48" height="40" rx="2" fill="#FFFFFF" />
                        <path d="M298 154 H328 M298 164 H320" stroke="#BDBDBD" strokeWidth="2" />
                      </g>
                      <g transform="rotate(5 416 98)">
                        <rect x="392" y="78" width="48" height="40" rx="2" fill="#FFFFFF" />
                        <path d="M400 92 H430 M400 102 H422" stroke="#BDBDBD" strokeWidth="2" />
                      </g>
                      <g transform="rotate(-5 396 172)">
                        <rect x="372" y="152" width="48" height="40" rx="2" fill="#FF0083" />
                      </g>
                      <path d="M190 250 L180 384" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M190 250 L180 384" stroke="#FFFFFF" strokeWidth="5" />
                      <path d="M450 250 L460 384" stroke="#4A4A4A" strokeWidth="10" />
                      <path d="M450 250 L460 384" stroke="#FFFFFF" strokeWidth="5" />
                      <g transform="translate(470 384) scale(0.8) translate(-470 -384)">
                        <path d="M457 244 V376" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M457 244 V376" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M483 244 V376" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M483 244 V376" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M440 384 Q440 370 458 370 Q468 370 468 384 Z" fill="#FFFFFF" />
                        <path d="M472 384 Q472 370 482 370 Q500 370 500 384 Z" fill="#FFFFFF" />
                        <g transform="translate(470,152) scale(1)">
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
                      <path d="M446 208 Q420 200 410 180" stroke="#4A4A4A" strokeWidth="18" />
                      <path d="M446 208 Q420 200 410 180" stroke="#FFFFFF" strokeWidth="13" />
                      <circle cx="406" cy="174" r="9" fill="#FFFFFF" />
                      <g transform="translate(150 384) scale(0.8) translate(-150 -384)">
                        <path d="M137 244 V376" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M137 244 V376" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M163 244 V376" stroke="#4A4A4A" strokeWidth="24" />
                        <path d="M163 244 V376" stroke="#E4E4E4" strokeWidth="19" />
                        <path d="M120 384 Q120 370 138 370 Q148 370 148 384 Z" fill="#FFFFFF" />
                        <path d="M152 384 Q152 370 162 370 Q180 370 180 384 Z" fill="#FFFFFF" />
                        <g transform="translate(150,152) scale(1)">
                          <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                          <path d="M-12 6 Q0 18 12 6" />
                          <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                          <path
                            d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q24 -58 4 -58 Q-16 -52 -32 -38Z"
                            fill="#DCDCDC"
                          />
                          <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                          <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                          <path d="M-8 -21 Q0 -15 8 -21" />
                        </g>
                      </g>
                    </svg>
                  </div>
                </>
              )}
            </div>
            <div
              role="status"
              aria-live="polite"
              style={{ minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    background: '#FF0083',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: '800',
                  }}
                >
                  {lsTime}
                </span>
                <span style={{ fontWeight: '800', fontSize: '24px', letterSpacing: '-0.02em' }}>
                  {lsTitle}
                </span>
              </div>
              <p
                style={{
                  margin: '0',
                  fontSize: '18px',
                  lineHeight: '1.6',
                  color: '#4A4A4A',
                  maxWidth: '680px',
                }}
              >
                {lsDesc}
              </p>
            </div>
            <div style={{ fontSize: '14px', color: '#6B6B6B' }}>
              Nümunə dərs axınıdır. Fəaliyyətlər modula uyğun dəyişə bilər.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
