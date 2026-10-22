import { useHover } from '../hooks/useHover';
import { useLines, useText } from '../hooks/usePublicContent';

export default function DemoDay() {
  const { on, off, hv } = useHover(['i5']);
  const eyebrow = useText('demo_day.eyebrow');
  const heading = useText('demo_day.heading');
  const intro = useText('demo_day.intro');
  const items = useLines('demo_day.items');
  return (
    <section id="demo-day" style={{ background: '#FFFFFF', borderTop: '1px solid #EAEAEA' }}>
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(72px,10vw,120px) clamp(20px,4vw,32px) 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,520px),1fr))',
          gap: '48px 80px',
          alignItems: 'end',
        }}
      >
        <div data-reveal="1" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>{eyebrow}</div>
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
            {heading}
          </h2>
          <p
            style={{ margin: '0', fontSize: '19px', lineHeight: '1.6', color: '#4A4A4A', maxWidth: '560px' }}
          >
            {intro}
          </p>
        </div>
        <ul
          data-reveal="1"
          style={{ margin: '0', padding: '0', listStyle: 'none', display: 'flex', flexDirection: 'column' }}
        >
          {items.map((item, index) => (
            <li
              key={index}
              style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                padding: '16px 0',
                ...(index < items.length - 1 ? { borderBottom: '1px solid #EAEAEA' } : {}),
                fontSize: '18px',
                fontWeight: '700',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#FF0083',
                  flexShrink: '0',
                }}
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div
        data-reveal="1"
        onPointerEnter={on.i5}
        onPointerLeave={off}
        style={{ maxWidth: '1440px', margin: '64px auto 0', padding: '0 16px' }}
      >
        <svg
          viewBox="0 0 1200 520"
          width="100%"
          role="img"
          aria-label="İki uşaq Demo Day-də hazırladıqları məhsulu təqdim edir, ön planda onları dinləyən valideynlər"
          fill="none"
          stroke="#4A4A4A"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'block', maxWidth: '1200px', margin: '0 auto' }}
        >
          <ellipse cx="600" cy="478" rx="420" ry="16" fill="#000000" fillOpacity="0.06" stroke="none" />
          <path d="M800 92 L806 462" stroke="#4A4A4A" strokeWidth="14" />
          <path d="M800 92 L806 462" stroke="#EDEDED" strokeWidth="9" />
          <path d="M650 92 L930 82 L936 292 L656 302 Z" fill="#FFFFFF" />
          <path d="M930 82 L944 90 L950 298 L936 292 Z" fill="#EDEDED" />
          <path d="M690 120 L690 270 L900 262" strokeWidth="2.2" />
          <path
            d="M718 236 L748 236 L748 260 L718 261 Z"
            style={{ fill: hv.i5bar, transition: 'fill .25s ease' }}
          />
          <path d="M766 214 L796 214 L796 258 L766 259 Z" fill="#E4E4E4" />
          <path d="M814 196 L844 196 L844 256 L814 257 Z" fill="#E4E4E4" />
          <path d="M862 150 L892 149 L892 254 L862 255 Z" fill="#FF0083" />
          <path d="M700 230 Q760 190 880 130" stroke="#9A9A9A" strokeWidth="2" strokeDasharray="2 8" />
          <path d="M700 302 L680 468" stroke="#4A4A4A" strokeWidth="16" />
          <path d="M700 302 L680 468" stroke="#FFFFFF" strokeWidth="11" />
          <path d="M890 294 L914 468" stroke="#4A4A4A" strokeWidth="16" />
          <path d="M890 294 L914 468" stroke="#FFFFFF" strokeWidth="11" />
          <path d="M407 297 V462" stroke="#4A4A4A" strokeWidth="24" />
          <path d="M407 297 V462" stroke="#E4E4E4" strokeWidth="19" />
          <path d="M433 297 V462" stroke="#4A4A4A" strokeWidth="24" />
          <path d="M433 297 V462" stroke="#E4E4E4" strokeWidth="19" />
          <path d="M390 470 Q390 456 408 456 Q418 456 418 470 Z" fill="#FFFFFF" />
          <path d="M422 470 Q422 456 432 456 Q450 456 450 470 Z" fill="#FFFFFF" />
          <g transform="translate(420,205)">
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
          <path d="M384 222 Q372 262 382 298" stroke="#4A4A4A" strokeWidth="22" />
          <path d="M384 222 Q372 262 382 298" stroke="#FFFFFF" strokeWidth="17" />
          <circle cx="382" cy="306" r="10" fill="#FFFFFF" />
          <path d="M456 222 Q506 230 526 190" stroke="#4A4A4A" strokeWidth="22" />
          <path d="M456 222 Q506 230 526 190" stroke="#FFFFFF" strokeWidth="17" />
          <circle cx="530" cy="182" r="10" fill="#FFFFFF" />
          <path d="M557 297 V462" stroke="#4A4A4A" strokeWidth="24" />
          <path d="M557 297 V462" stroke="#FFFFFF" strokeWidth="19" />
          <path d="M583 297 V462" stroke="#4A4A4A" strokeWidth="24" />
          <path d="M583 297 V462" stroke="#FFFFFF" strokeWidth="19" />
          <path d="M540 470 Q540 456 558 456 Q568 456 568 470 Z" fill="#FFFFFF" />
          <path d="M572 470 Q572 456 582 456 Q600 456 600 470 Z" fill="#FFFFFF" />
          <g transform="translate(570,205)">
            <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
            <path d="M-12 6 Q0 18 12 6" />
            <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
            <path d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q10 -54 -32 -38Z" fill="#DCDCDC" />
            <path d="M30 -56 Q52 -54 50 -28 Q44 -36 32 -42" fill="#DCDCDC" />
            <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
            <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
            <path d="M-8 -21 Q0 -15 8 -21" />
          </g>
          <path d="M534 222 Q522 262 532 298" stroke="#4A4A4A" strokeWidth="22" />
          <path d="M534 222 Q522 262 532 298" stroke="#FFFFFF" strokeWidth="17" />
          <circle cx="532" cy="306" r="10" fill="#FFFFFF" />
          <g
            style={{
              transform: hv.i5t,
              transition: 'transform .25s ease',
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          >
            <path d="M598 92 L598 150 A14 5 0 0 0 626 150 L626 92" fill="#FFFFFF" />
            <ellipse cx="612" cy="92" rx="14" ry="5" fill="#FFFFFF" />
            <path d="M603 92 V78 A9 3.5 0 0 0 621 78 V92" fill="#FF0083" />
            <ellipse cx="612" cy="78" rx="9" ry="3.5" fill="#FF5CAE" />
            <path d="M606 222 Q636 190 622 150" stroke="#4A4A4A" strokeWidth="22" />
            <path d="M606 222 Q636 190 622 150" stroke="#FFFFFF" strokeWidth="17" />
            <circle cx="620" cy="150" r="11" fill="#FFFFFF" />
          </g>
          <path d="M54 540 Q54 474 150 470 Q246 474 246 540 Z" fill="#EDEDED" />
          <circle cx="150" cy="428" r="40" fill="#FFFFFF" />
          <path
            d="M110 430 Q106 386 150 386 Q194 386 190 430 Q170 412 150 414 Q130 412 110 430Z"
            fill="#DCDCDC"
          />
          <path d="M224 540 Q224 474 320 470 Q416 474 416 540 Z" fill="#EDEDED" />
          <circle cx="320" cy="428" r="40" fill="#FFFFFF" />
          <path
            d="M280 420 Q282 386 320 388 Q358 386 360 420 Q364 456 350 466 Q320 446 290 466 Q276 456 280 420Z"
            fill="#DCDCDC"
          />
          <path d="M784 540 Q784 474 880 470 Q976 474 976 540 Z" fill="#EDEDED" />
          <circle cx="880" cy="428" r="40" fill="#FFFFFF" />
          <path d="M840 426 Q838 384 880 386 Q922 384 920 426 Q880 440 840 426Z" fill="#DCDCDC" />
          <circle cx="880" cy="380" r="15" fill="#DCDCDC" />
          <path d="M964 540 Q964 474 1060 470 Q1156 474 1156 540 Z" fill="#EDEDED" />
          <circle cx="1060" cy="428" r="40" fill="#FFFFFF" />
          <path
            d="M1020 430 Q1016 386 1060 386 Q1104 386 1100 430 Q1080 412 1060 414 Q1040 412 1020 430Z"
            fill="#DCDCDC"
          />
        </svg>
      </div>
    </section>
  );
}
