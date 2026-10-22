import { Fragment, useState } from 'react';
import { useText } from '../hooks/usePublicContent';

const OPTIONS = ['İnsanlardan soruş', 'İdeyanı çək', 'Nümunə hazırla'];

export default function MiniTask() {
  const heading = useText('mini_task.heading');
  const intro = useText('mini_task.intro');
  const [picked, setPicked] = useState<number | null>(null);
  const [seen, setSeen] = useState<number[]>([]);

  const qz_ = picked === null;
  const [qz0, qz1, qz2] = [0, 1, 2].map((i) => picked === i);
  const qzOpts = OPTIONS.map((label, i) => {
    const on = picked === i;
    const viewed = seen.includes(i);
    return {
      label,
      on,
      bg: on ? '#1A1A1A' : '#FFFFFF',
      fg: on ? '#FFFFFF' : '#1A1A1A',
      border: '#1A1A1A',
      dot: viewed ? 1 : 0,
      sr: viewed ? ' (baxılıb)' : '',
      pick: () => {
        setPicked(i);
        setSeen((s) => (s.includes(i) ? s : [...s, i]));
      },
    };
  });
  const qzDone = seen.length === OPTIONS.length;
  return (
    <section id="tapsiriq" style={{ background: '#FFFFFF' }}>
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(72px,10vw,120px) clamp(20px,4vw,32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '44px',
        }}
      >
        <div
          data-reveal="1"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>Mini tapşırıq</div>
          <h2
            style={{
              margin: '0',
              fontWeight: '800',
              fontSize: 'clamp(34px,4.6vw,60px)',
              letterSpacing: '-0.04em',
              lineHeight: '1.04',
              textWrap: 'balance',
              maxWidth: '900px',
            }}
          >
            {heading}
          </h2>
          <p
            style={{ margin: '0', fontSize: '19px', lineHeight: '1.6', color: '#4A4A4A', maxWidth: '640px' }}
          >
            {intro}
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,460px),1fr))',
            gap: '40px 64px',
            alignItems: 'start',
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
            {qz_ && (
              <>
                <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                  <svg
                    viewBox="0 0 660 400"
                    width="100%"
                    role="img"
                    aria-label="Məktəb masası, dəftər və ətrafa səpələnmiş qələmlər"
                    fill="none"
                    stroke="#4A4A4A"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <path d="M40 300 L120 160 H560 L620 300 Z" fill="#FFFFFF" />
                    <path d="M40 300 H620 V318 H40 Z" fill="#EDEDED" />
                    <path d="M70 318 V392" stroke="#4A4A4A" strokeWidth="12" />
                    <path d="M70 318 V392" stroke="#FFFFFF" strokeWidth="7" />
                    <path d="M590 318 V392" stroke="#4A4A4A" strokeWidth="12" />
                    <path d="M590 318 V392" stroke="#FFFFFF" strokeWidth="7" />
                    <path d="M220 270 Q280 250 330 250 L326 186 Q276 184 228 204 Z" fill="#FFFFFF" />
                    <path d="M330 250 Q380 250 438 268 L428 202 Q378 184 326 186 Z" fill="#FFFFFF" />
                    <path d="M326 186 L330 250" stroke="#BDBDBD" />
                    <path
                      d="M246 214 Q280 204 312 204 M246 230 Q280 222 312 222 M346 206 Q380 206 410 214"
                      stroke="#BDBDBD"
                      strokeWidth="2"
                    />
                    <path d="M140 250 L200 230" stroke="#4A4A4A" strokeWidth="9" />
                    <path d="M140 250 L200 230" stroke="#FFFFFF" strokeWidth="4" />
                    <path d="M200 230 L212 226 L202 236" fill="#4A4A4A" />
                    <path d="M470 196 L530 226" stroke="#4A4A4A" strokeWidth="9" />
                    <path d="M470 196 L530 226" stroke="#FFE6F3" strokeWidth="4" />
                    <path d="M530 226 L540 232 L528 232" fill="#4A4A4A" />
                    <path d="M460 262 L520 270" stroke="#4A4A4A" strokeWidth="9" />
                    <path d="M460 262 L520 270" stroke="#FFFFFF" strokeWidth="4" />
                    <path d="M520 270 L532 272 L520 276" fill="#4A4A4A" />
                    <path d="M150 196 L172 168" stroke="#4A4A4A" strokeWidth="9" />
                    <path d="M150 196 L172 168" stroke="#FFFFFF" strokeWidth="4" />
                    <path d="M90 380 L130 362" strokeWidth="9" />
                    <path d="M90 380 L130 362" stroke="#FFFFFF" strokeWidth="4" />
                  </svg>
                </div>
              </>
            )}
            {qz0 && (
              <>
                <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                  <svg
                    viewBox="0 0 660 400"
                    width="100%"
                    role="img"
                    aria-label="İki uşaq problemi müzakirə edir"
                    fill="none"
                    stroke="#4A4A4A"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <path d="M0 384 H660" strokeWidth="2" />
                    <g transform="translate(200,280) scale(1)">
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
                    <g transform="translate(470,280) scale(1)">
                      <path d="M-46 100 Q-48 20 -30 8 Q0 -2 30 8 Q48 20 46 100 Z" fill="#FFFFFF" />
                      <path d="M-12 6 Q0 18 12 6" />
                      <circle cx="0" cy="-36" r="32" fill="#FFFFFF" />
                      <path d="M-32 -38 Q-36 -76 0 -74 Q34 -76 33 -40 Q10 -54 -32 -38Z" fill="#DCDCDC" />
                      <path d="M30 -56 Q52 -54 50 -28 Q44 -36 32 -42" fill="#DCDCDC" />
                      <circle cx="-10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                      <circle cx="10" cy="-34" r="2.8" fill="#4A4A4A" stroke="none" />
                      <path d="M-8 -21 Q0 -15 8 -21" />
                    </g>
                    <path
                      d="M250 70 H380 Q390 70 390 80 V150 Q390 160 380 160 H270 L254 174 L258 160 H250 Q240 160 240 150 V80 Q240 70 250 70 Z"
                      fill="#FFFFFF"
                    />
                    <path
                      d="M293 112 Q293 102 300 102 Q308 102 308 110 Q308 116 300 119 V124 M300 130 V131"
                      stroke="#FF0083"
                      strokeWidth="3.4"
                    />
                    <path d="M330 104 H360 M330 124 H352" stroke="#BDBDBD" strokeWidth="2.4" />
                    <path
                      d="M340 170 H440 Q450 170 450 180 V220 Q450 230 440 230 H432 L444 244 L420 230 H340 Q330 230 330 220 V180 Q330 170 340 170 Z"
                      fill="#FFE6F3"
                    />
                    <path d="M352 194 H424 M352 210 H404" stroke="#9A9A9A" strokeWidth="2.4" />
                  </svg>
                </div>
              </>
            )}
            {qz1 && (
              <>
                <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                  <svg
                    viewBox="0 0 660 400"
                    width="100%"
                    role="img"
                    aria-label="Dəftərdə üç sadə eskiz: ad etiketi, masaya bərkidilən qələm tutacağı və ortaq qələm yeri"
                    fill="none"
                    stroke="#4A4A4A"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <path d="M40 330 Q190 290 330 288 L326 70 Q190 70 50 110 Z" fill="#FFFFFF" />
                    <path d="M330 288 Q470 290 620 330 L610 110 Q470 70 326 70 Z" fill="#FFFFFF" />
                    <path d="M326 70 L330 288" stroke="#BDBDBD" />
                    <path
                      d="M44 330 Q190 300 330 300 Q470 300 616 330 L616 344 Q470 314 330 314 Q190 314 44 344 Z"
                      fill="#EDEDED"
                    />
                    <g stroke="#8C8C8C" strokeWidth="2">
                      <path d="M90 150 L200 142 L204 186 L94 194 Z" />
                      <circle cx="110" cy="170" r="6" />
                      <path d="M126 166 H188 M126 178 H176" />
                      <path d="M90 236 H230 M190 236 V214 H214 V236 M196 214 L188 190 M208 214 L214 188" />
                      <path d="M380 140 L380 200 Q380 210 392 210 H436 Q448 210 448 200 V140" />
                      <ellipse cx="414" cy="140" rx="34" ry="8" />
                      <path d="M396 140 L388 104 M414 138 L416 100 M432 140 L444 106" />
                      <path d="M470 230 Q500 214 530 230 M500 214 V200" />
                    </g>
                    <ellipse cx="202" cy="222" rx="38" ry="30" stroke="#FF0083" strokeWidth="2.6" />
                    <path d="M500 268 L580 214" stroke="#4A4A4A" strokeWidth="10" />
                    <path d="M500 268 L580 214" stroke="#FFFFFF" strokeWidth="5" />
                    <path d="M500 268 L488 276 L496 262" fill="#4A4A4A" />
                  </svg>
                </div>
              </>
            )}
            {qz2 && (
              <>
                <div style={{ width: '100%', height: '100%', animation: 'kuFade .3s ease' }}>
                  <svg
                    viewBox="0 0 660 400"
                    width="100%"
                    role="img"
                    aria-label="Əllər kartondan sadə qələm tutacağı hazırlayır"
                    fill="none"
                    stroke="#4A4A4A"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <path d="M120 360 H540" strokeWidth="2" />
                    <ellipse
                      cx="330"
                      cy="360"
                      rx="120"
                      ry="10"
                      fill="#000000"
                      fillOpacity="0.06"
                      stroke="none"
                    />
                    <g transform="translate(330 356) scale(1.25)">
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
                      <path d="M-40 -22 L40 -26 L40 -38 L-40 -34 Z" fill="#FFFFFF" />
                      <path d="M40 -26 L60 -40 L60 -52 L40 -38 Z" fill="#FFFFFF" fillOpacity="0.75" />
                    </g>
                    <path d="M280 300 L300 296 L302 314 L282 318 Z" fill="#FF0083" />
                    <path d="M-10 400 L170 290" stroke="#4A4A4A" strokeWidth="64" />
                    <path d="M-10 400 L170 290" stroke="#EDEDED" strokeWidth="59" />
                    <path
                      d="M176 266 Q206 248 234 260 Q248 270 242 290 Q234 308 210 308 Q186 310 176 300 Z"
                      fill="#FFFFFF"
                    />
                    <path d="M214 270 H240 M210 286 H236" strokeWidth="2" />
                    <path d="M680 410 L500 300" stroke="#4A4A4A" strokeWidth="64" />
                    <path d="M680 410 L500 300" stroke="#EDEDED" strokeWidth="59" />
                    <path
                      d="M492 276 Q462 260 436 272 Q422 284 428 302 Q436 318 460 318 Q484 318 494 308 Z"
                      fill="#FFFFFF"
                    />
                    <path d="M432 286 H456 M434 300 H458" strokeWidth="2" />
                  </svg>
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div
              style={{
                border: '2px solid #1A1A1A',
                borderRadius: '6px',
                padding: '22px 24px',
                fontSize: 'clamp(20px,2vw,24px)',
                fontWeight: '800',
                lineHeight: '1.35',
                letterSpacing: '-0.01em',
              }}
            >
              “Məktəbdə qələmlər tez-tez itir. Səncə, bunu necə həll etmək olar?”
            </div>
            <div
              role="group"
              aria-label="Kəşf ediləcək istiqamətlər"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
                gap: '8px',
              }}
            >
              {qzOpts.map((o, __i) => (
                <Fragment key={__i}>
                  <button
                    onClick={o.pick}
                    aria-pressed={o.on}
                    style={{
                      position: 'relative',
                      minHeight: '56px',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: `1.5px solid ${o.border}`,
                      background: o.bg,
                      color: o.fg,
                      cursor: 'pointer',
                      fontWeight: '800',
                      fontSize: '16px',
                      lineHeight: '1.25',
                      transition: 'background .25s, color .25s, border-color .25s',
                    }}
                  >
                    {o.label}
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#FF0083',
                        opacity: o.dot,
                        boxShadow: '0 0 0 2px #FFFFFF',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        overflow: 'hidden',
                        clip: 'rect(0 0 0 0)',
                      }}
                    >
                      {o.sr}
                    </span>
                  </button>
                </Fragment>
              ))}
            </div>
            <div
              aria-live="polite"
              style={{ minHeight: '190px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {qz_ && (
                <>
                  <p style={{ margin: '0', fontSize: '17px', lineHeight: '1.6', color: '#6B6B6B' }}>
                    Üç istiqamətdən birini seçin. İstənilən ardıcıllıqla baxa bilərsiniz.
                  </p>
                </>
              )}
              {qz0 && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      animation: 'kuFade .3s ease',
                    }}
                  >
                    <p
                      style={{
                        margin: '0',
                        fontSize: '19px',
                        lineHeight: '1.55',
                        fontWeight: '700',
                        color: '#1A1A1A',
                      }}
                    >
                      Əvvəlcə problemi daha yaxşı anlayaq.
                    </p>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#FF0083' }}>
                      Nümunə suallar
                    </div>
                    <ul
                      style={{
                        margin: '0',
                        padding: '0',
                        listStyle: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <li
                        style={{
                          display: 'flex',
                          gap: '10px',
                          fontSize: '17px',
                          lineHeight: '1.5',
                          color: '#2E2E2E',
                        }}
                      >
                        <span style={{ color: '#FF0083', fontWeight: '800' }}>—</span>“Qələmini ən çox harada
                        itirirsən?”
                      </li>
                      <li
                        style={{
                          display: 'flex',
                          gap: '10px',
                          fontSize: '17px',
                          lineHeight: '1.5',
                          color: '#2E2E2E',
                        }}
                      >
                        <span style={{ color: '#FF0083', fontWeight: '800' }}>—</span>“Bu, adətən nə vaxt baş
                        verir?”
                      </li>
                      <li
                        style={{
                          display: 'flex',
                          gap: '10px',
                          fontSize: '17px',
                          lineHeight: '1.5',
                          color: '#2E2E2E',
                        }}
                      >
                        <span style={{ color: '#FF0083', fontWeight: '800' }}>—</span>“İndiyə qədər nəyi
                        sınamısan?”
                      </li>
                    </ul>
                  </div>
                </>
              )}
              {qz1 && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      animation: 'kuFade .3s ease',
                    }}
                  >
                    <p
                      style={{
                        margin: '0',
                        fontSize: '19px',
                        lineHeight: '1.55',
                        fontWeight: '700',
                        color: '#1A1A1A',
                      }}
                    >
                      Bir neçə həll düşün. Öz ideyanı kağız üzərində çək və onun necə işləyəcəyini izah et.
                    </p>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#FF0083' }}>Əlavə sual</div>
                    <ul
                      style={{
                        margin: '0',
                        padding: '0',
                        listStyle: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <li
                        style={{
                          display: 'flex',
                          gap: '10px',
                          fontSize: '17px',
                          lineHeight: '1.5',
                          color: '#2E2E2E',
                        }}
                      >
                        <span style={{ color: '#FF0083', fontWeight: '800' }}>—</span>“Sənin həllin nə ilə
                        fərqlənərdi?”
                      </li>
                    </ul>
                  </div>
                </>
              )}
              {qz2 && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      animation: 'kuFade .3s ease',
                    }}
                  >
                    <p
                      style={{
                        margin: '0',
                        fontSize: '19px',
                        lineHeight: '1.55',
                        fontWeight: '700',
                        color: '#1A1A1A',
                      }}
                    >
                      Kağız və ya kartonla sadə bir nümunə hazırla. Sonra birindən onu sınamasını istə.
                    </p>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#FF0083' }}>Əlavə sual</div>
                    <ul
                      style={{
                        margin: '0',
                        padding: '0',
                        listStyle: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <li
                        style={{
                          display: 'flex',
                          gap: '10px',
                          fontSize: '17px',
                          lineHeight: '1.5',
                          color: '#2E2E2E',
                        }}
                      >
                        <span style={{ color: '#FF0083', fontWeight: '800' }}>—</span>“İstifadə etmək
                        rahatdır? Nəyi dəyişərdin?”
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>
            {qzDone && (
              <>
                <div
                  style={{
                    background: '#FFF0F7',
                    borderRadius: '6px',
                    padding: '18px 20px',
                    fontSize: '17px',
                    lineHeight: '1.55',
                    fontWeight: '700',
                    color: '#1A1A1A',
                    animation: 'kuFade .3s ease',
                  }}
                >
                  Problemi anlamaq, ideya düşünmək və onu sınamaq — KidsUp-da uşaqlar bu yanaşmanı praktiki
                  tapşırıqlarla məşq edirlər.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
