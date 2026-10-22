import { Fragment } from 'react';
import type { PointerEvent } from 'react';
import { useHover } from '../hooks/useHover';
import { useFigures, useText } from '../hooks/usePublicContent';

const STEPS = ['İdeya yarat', 'Birlikdə hazırla', 'Sına', 'Təqdim et'];

export default function Hero() {
  const { hov, setHov, on, off, hv } = useHover(['h0', 'h1', 'h2', 'h3']);
  const figures = useFigures();
  const titleFirst = useText('hero.title_first');
  const titleLead = useText('hero.title_lead');
  const titleAccent = useText('hero.title_accent');
  const subtitle = useText('hero.subtitle');
  const primaryCta = useText('hero.primary_cta');
  const secondaryCta = useText('hero.secondary_cta');
  const duration = useText('hero.duration');

  // Moving over the hero illustration lights up whichever of the four kids/props is under the pointer.
  const heroMove = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    const id = f < 0.31 ? 'h1' : f < 0.5 ? 'h0' : f < 0.76 ? 'h2' : 'h3';
    if (hov !== id) setHov(id);
  };

  const steps = STEPS.map((label, i) => {
    const active = hov === 'h' + i;
    return {
      n: i + 1,
      label,
      enter: on['h' + i],
      c: active ? '#FF0083' : '#1A1A1A',
      bg: active ? '#FF0083' : '#FFFFFF',
      fg: active ? '#FFFFFF' : '#1A1A1A',
    };
  });
  return (
    <section id="top" style={{ padding: '88px 0 0' }}>
      <div
        data-reveal="1"
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '0 clamp(20px,4vw,32px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '28px',
        }}
      >
        <h1
          style={{
            margin: '0',
            fontWeight: '800',
            fontSize: 'clamp(46px,8.2vw,120px)',
            lineHeight: '0.98',
            letterSpacing: '-0.045em',
            color: '#1A1A1A',
          }}
        >
          {titleFirst}
          <br />
          {titleLead} <span style={{ color: '#FF0083' }}>{titleAccent}</span>
        </h1>
        <p
          style={{
            margin: '0',
            maxWidth: '720px',
            fontSize: 'clamp(18px,1.6vw,22px)',
            lineHeight: '1.55',
            color: '#4A4A4A',
            textWrap: 'pretty',
          }}
        >
          {subtitle}
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '28px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <a
            href="#muraciet"
            style={{
              padding: '20px 40px',
              borderRadius: '6px',
              background: '#FF0083',
              color: '#FFFFFF',
              fontWeight: '800',
              fontSize: '19px',
              transition: 'background .15s, transform .15s',
            }}
            className="hv-3"
          >
            {primaryCta}
          </a>
          <a
            href="#proqram"
            style={{
              fontWeight: '700',
              fontSize: '18px',
              color: '#1A1A1A',
              borderBottom: '2px solid #FF0083',
              paddingBottom: '3px',
            }}
            className="hv-1"
          >
            {secondaryCta}
          </a>
        </div>
        <ul
          aria-label="Əsas məlumatlar"
          style={{
            margin: '0',
            padding: '0',
            listStyle: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <li
            style={{
              padding: '8px 14px',
              borderRadius: '4px',
              background: '#F6F6F6',
              fontSize: '15px',
              fontWeight: '700',
              color: '#1A1A1A',
            }}
          >
            {figures.age_min}–{figures.age_max} yaş
          </li>
          <li
            style={{
              padding: '8px 14px',
              borderRadius: '4px',
              background: '#F6F6F6',
              fontSize: '15px',
              fontWeight: '700',
              color: '#1A1A1A',
            }}
          >
            Başlanğıc: {figures.start_date}
          </li>
          <li
            style={{
              padding: '8px 14px',
              borderRadius: '4px',
              background: '#F6F6F6',
              fontSize: '15px',
              fontWeight: '700',
              color: '#1A1A1A',
            }}
          >
            {duration} · {figures.schedule}
          </li>
          <li
            style={{
              padding: '8px 14px',
              borderRadius: '4px',
              background: '#F6F6F6',
              fontSize: '15px',
              fontWeight: '700',
              color: '#1A1A1A',
            }}
          >
            Maksimum {figures.capacity} iştirakçı
          </li>
        </ul>
      </div>
      <div data-reveal="1" style={{ maxWidth: '1440px', margin: '56px auto 0', padding: '0 16px' }}>
        <svg
          viewBox="0 0 1200 500"
          width="100%"
          role="img"
          aria-label="Masa ətrafında ideya üzərində işləyən dörd uşaq: biri çəkir, biri karton prototip qurur, digərləri müzakirə edir"
          fill="none"
          stroke="#4A4A4A"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          onPointerMove={heroMove}
          onPointerLeave={off}
          style={{ display: 'block', maxWidth: '1200px', margin: '0 auto' }}
        >
          <ellipse cx="600" cy="476" rx="450" ry="18" fill="#000000" fillOpacity="0.06" stroke="none" />
          <path d="M332 360 V444" stroke="#4A4A4A" strokeWidth="18" />
          <path d="M332 360 V444" stroke="#EDEDED" strokeWidth="13" />
          <path d="M868 360 V444" stroke="#4A4A4A" strokeWidth="18" />
          <path d="M868 360 V444" stroke="#EDEDED" strokeWidth="13" />
          <g transform="translate(500,180)">
            <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
            <path d="M-12 6 Q0 18 12 6" />
            <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
            <path d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q24 -58 4 -58 Q-16 -52 -32 -38Z" fill="#DCDCDC" />
            <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
            <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
            <path d="M-8 -21 Q0 -15 8 -21" />
          </g>
          <g transform="translate(730,180)">
            <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
            <path d="M-12 6 Q0 18 12 6" />
            <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
            <path d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q10 -54 -32 -38Z" fill="#DCDCDC" />
            <path d="M30 -56 Q52 -54 50 -28 Q44 -36 32 -42" fill="#DCDCDC" />
            <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
            <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
            <ellipse cx="0" cy="-19" rx="5" ry="4" fill="#FFFFFF" />
          </g>
          <path d="M758 196 Q800 178 806 132" stroke="#4A4A4A" strokeWidth="22" />
          <path d="M758 196 Q800 178 806 132" stroke="#FFFFFF" strokeWidth="17" />
          <circle cx="806" cy="124" r="10" fill="#FFFFFF" />
          <path d="M137 297 V462" stroke="#4A4A4A" strokeWidth="24" />
          <path d="M137 297 V462" stroke="#E4E4E4" strokeWidth="19" />
          <path d="M163 297 V462" stroke="#4A4A4A" strokeWidth="24" />
          <path d="M163 297 V462" stroke="#E4E4E4" strokeWidth="19" />
          <path d="M120 470 Q120 456 138 456 Q148 456 148 470 Z" fill="#FFFFFF" />
          <path d="M152 470 Q152 456 162 456 Q180 456 180 470 Z" fill="#FFFFFF" />
          <g transform="translate(150,205)">
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
          <path d="M114 222 Q100 262 112 298" stroke="#4A4A4A" strokeWidth="22" />
          <path d="M114 222 Q100 262 112 298" stroke="#FFFFFF" strokeWidth="17" />
          <circle cx="112" cy="306" r="10" fill="#FFFFFF" />
          <path d="M1037 297 V462" stroke="#4A4A4A" strokeWidth="24" />
          <path d="M1037 297 V462" stroke="#E4E4E4" strokeWidth="19" />
          <path d="M1063 297 V462" stroke="#4A4A4A" strokeWidth="24" />
          <path d="M1063 297 V462" stroke="#E4E4E4" strokeWidth="19" />
          <path d="M1020 470 Q1020 456 1038 456 Q1048 456 1048 470 Z" fill="#FFFFFF" />
          <path d="M1052 470 Q1052 456 1062 456 Q1080 456 1080 470 Z" fill="#FFFFFF" />
          <g transform="translate(1050,205)">
            <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
            <path d="M-12 6 Q0 18 12 6" />
            <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
            <path d="M-32 -36 Q-34 -74 0 -72 Q34 -74 32 -36 Q20 -54 0 -54 Q-20 -54 -32 -36Z" fill="#DCDCDC" />
            <circle cx="0" cy="-80" r="12" fill="#DCDCDC" />
            <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
            <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
            <path d="M-8 -21 Q0 -15 8 -21" />
          </g>
          <path d="M1086 222 Q1098 262 1088 298" stroke="#4A4A4A" strokeWidth="22" />
          <path d="M1086 222 Q1098 262 1088 298" stroke="#FFFFFF" strokeWidth="17" />
          <circle cx="1088" cy="306" r="10" fill="#FFFFFF" />
          <path d="M300 255 Q600 249 900 255 L1000 345 Q600 351 200 345 Z" fill="#FFFFFF" />
          <path d="M200 345 Q600 351 1000 345 L1000 362 Q600 368 200 362 Z" fill="#EDEDED" />
          <path d="M228 362 V466" stroke="#4A4A4A" strokeWidth="18" />
          <path d="M228 362 V466" stroke="#FFFFFF" strokeWidth="13" />
          <path d="M972 362 V466" stroke="#4A4A4A" strokeWidth="18" />
          <path d="M972 362 V466" stroke="#FFFFFF" strokeWidth="13" />
          <path
            d="M330 278 L392 278 L392 326 L330 326 Z"
            style={{ fill: hv.h1box, transition: 'fill .25s ease' }}
          />
          <path d="M392 278 L414 262 L414 308 L392 326 Z" fill="#EDEDED" />
          <path d="M330 278 L352 262 L414 262 L392 278 Z" fill="#FFFFFF" />
          <path
            d="M352 262 L414 262 L406 236 L346 239 Z"
            fill="#FF0083"
            style={{
              transform: hv.h1t,
              transition: 'transform .25s ease',
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          />
          <rect x="344" y="292" width="32" height="18" rx="3" />
          <g
            style={{
              transform: hv.h0t,
              transition: 'transform .25s ease',
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          >
            <path
              d="M430 286 L512 280 L518 326 L434 332 Z"
              style={{ fill: hv.h0sheet, transition: 'fill .25s ease' }}
            />
            <circle
              cx="460"
              cy="302"
              r="9"
              strokeWidth="1.8"
              style={{ stroke: hv.h0line, transition: 'stroke .25s ease' }}
            />
            <path
              d="M478 298 H500 M478 308 H504 M478 318 H494"
              strokeWidth="1.8"
              style={{ stroke: hv.h0line, transition: 'stroke .25s ease' }}
            />
          </g>
          <path d="M590 296 L660 302 L654 338 L584 332 Z" fill="#FFFFFF" />
          <path d="M598 310 L644 314 M596 322 L632 325" stroke="#9A9A9A" strokeWidth="1.8" />
          <path d="M622 266 L654 264 L656 290 L624 292 Z" fill="#FF0083" />
          <g
            style={{
              transform: hv.h2t,
              transition: 'transform .25s ease',
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          >
            <path d="M790 286 L842 282 L848 326 L796 330 Z" fill="#FFFFFF" />
            <path
              d="M798 292 L836 289 L838 299 L800 302 Z"
              style={{ fill: hv.h2scr, transition: 'fill .25s ease' }}
            />
            <circle cx="806" cy="310" r="2.4" fill="#4A4A4A" stroke="none" />
            <circle cx="818" cy="309" r="2.4" fill="#4A4A4A" stroke="none" />
            <circle cx="830" cy="308" r="2.4" fill="#4A4A4A" stroke="none" />
            <circle cx="807" cy="320" r="2.4" fill="#4A4A4A" stroke="none" />
            <circle cx="819" cy="319" r="2.4" fill="#4A4A4A" stroke="none" />
            <circle cx="831" cy="318" r="2.4" fill="#4A4A4A" stroke="none" />
          </g>
          <circle cx="884" cy="314" r="12" fill="#FFFFFF" />
          <path d="M876 310 Q884 302 890 312 Q882 320 878 314" strokeWidth="1.8" />
          <path d="M528 196 Q566 236 552 296" stroke="#4A4A4A" strokeWidth="22" />
          <path d="M528 196 Q566 236 552 296" stroke="#FFFFFF" strokeWidth="17" />
          <circle cx="550" cy="302" r="10" fill="#FFFFFF" />
          <path d="M538 318 L574 280" stroke="#4A4A4A" strokeWidth="9" />
          <path d="M538 318 L574 280" stroke="#FFFFFF" strokeWidth="4" />
          <path d="M538 318 L530 328 L534 314" fill="#4A4A4A" />
          <path d="M472 196 Q446 246 470 290" stroke="#4A4A4A" strokeWidth="22" />
          <path d="M472 196 Q446 246 470 290" stroke="#FFFFFF" strokeWidth="17" />
          <circle cx="474" cy="296" r="10" fill="#FFFFFF" />
          <path d="M702 196 Q682 248 700 292" stroke="#4A4A4A" strokeWidth="22" />
          <path d="M702 196 Q682 248 700 292" stroke="#FFFFFF" strokeWidth="17" />
          <circle cx="704" cy="298" r="10" fill="#FFFFFF" />
          <path d="M184 222 Q244 248 312 282" stroke="#4A4A4A" strokeWidth="22" />
          <path d="M184 222 Q244 248 312 282" stroke="#FFFFFF" strokeWidth="17" />
          <circle cx="320" cy="286" r="10" fill="#FFFFFF" />
          <g
            style={{
              transform: hv.h3t,
              transition: 'transform .25s ease',
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          >
            <path d="M1016 222 Q960 240 904 262" stroke="#4A4A4A" strokeWidth="22" />
            <path d="M1016 222 Q960 240 904 262" stroke="#FFFFFF" strokeWidth="17" />
            <circle cx="896" cy="264" r="10" style={{ fill: hv.h3hand, transition: 'fill .25s ease' }} />
          </g>
        </svg>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,max(140px,calc((100% - 48px) / 4))),1fr))',
            gap: '28px 16px',
            padding: '28px 0 0',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          {steps.map((st, __i) => (
            <Fragment key={__i}>
              <div
                onPointerEnter={st.enter}
                onPointerLeave={off}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
              >
                <span
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: `2px solid ${st.c}`,
                    background: st.bg,
                    color: st.fg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '17px',
                    transition: 'background .25s ease, color .25s ease, border-color .25s ease',
                  }}
                >
                  {st.n}
                </span>
                <span
                  style={{
                    fontWeight: '800',
                    fontSize: '18px',
                    lineHeight: '1.2',
                    textAlign: 'center',
                    color: st.c,
                    transition: 'color .25s ease',
                  }}
                >
                  {st.label}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
