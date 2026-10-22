import { useHover } from '../hooks/useHover';
import { useText } from '../hooks/usePublicContent';

export default function Approach() {
  const { on, off, hv } = useHover(['i2', 'i3', 'i4']);
  const first = { title: useText('approach.1_title'), text: useText('approach.1_text') };
  const second = { title: useText('approach.2_title'), text: useText('approach.2_text') };
  const third = { title: useText('approach.3_title'), text: useText('approach.3_text') };
  return (
    <section id="yanasma" style={{ background: '#FFFFFF', borderTop: '1px solid #EAEAEA' }}>
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(72px,10vw,120px) clamp(20px,4vw,32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(72px,9vw,120px)',
        }}
      >
        <div
          data-reveal="1"
          onPointerEnter={on.i2}
          onPointerLeave={off}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '48px 80px' }}
        >
          <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>İdeya</div>
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
              {first.title}
            </h2>
            <p
              style={{
                margin: '0',
                fontSize: '19px',
                lineHeight: '1.6',
                color: '#4A4A4A',
                maxWidth: '520px',
                textWrap: 'pretty',
              }}
            >
              {first.text}
            </p>
          </div>
          <div style={{ flex: '1.5 1 460px', minWidth: '0' }}>
            <svg
              viewBox="0 0 720 460"
              width="100%"
              role="img"
              aria-label="Açıq eskiz dəftərində su qabı üçün qarmaq ixtirasının qaralaması və yanında hazırlanmış kiçik model"
              fill="none"
              stroke="#4A4A4A"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'block' }}
            >
              <ellipse cx="310" cy="424" rx="290" ry="24" fill="#000000" fillOpacity="0.06" stroke="none" />
              <ellipse cx="628" cy="390" rx="50" ry="10" fill="#000000" fillOpacity="0.06" stroke="none" />
              <path
                d="M86 400 Q200 372 318 360 Q430 372 532 402 L532 416 Q430 386 318 374 Q200 386 86 414 Z"
                fill="#EDEDED"
              />
              <path d="M70 236 Q190 200 312 196 L318 360 Q200 372 86 400 Z" fill="#FFFFFF" />
              <path d="M312 196 Q430 204 548 238 L532 402 Q430 372 318 360 Z" fill="#FFFFFF" />
              <path d="M312 196 L318 360" stroke="#BDBDBD" />
              <g stroke="#8C8C8C" strokeWidth="2">
                <path d="M150 262 Q148 252 160 250 L190 248 Q200 248 200 258 L204 340 Q204 350 194 350 L164 352 Q154 352 154 342 Z" />
                <path d="M164 250 L164 238 L188 236 L190 248" />
                <path d="M120 300 Q132 296 138 304 M246 252 Q262 240 280 248 L272 240 M280 248 L272 256" />
              </g>
              <path
                d="M204 272 Q232 268 234 292 Q234 308 220 308"
                strokeWidth="2.4"
                style={{ stroke: hv.i2line, transition: 'stroke .25s ease' }}
              />
              <ellipse cx="222" cy="290" rx="30" ry="34" stroke="#FF0083" strokeWidth="2.6" />
              <g stroke="#B0B0B0" strokeWidth="2">
                <path d="M346 238 Q430 246 512 262" />
                <path d="M346 262 Q420 268 500 284" />
              </g>
              <g stroke="#9A9A9A" strokeWidth="2">
                <rect x="350" y="290" width="14" height="14" rx="2" />
                <path d="M374 300 Q420 304 470 314" />
                <rect x="348" y="318" width="14" height="14" rx="2" />
                <path d="M378 328 Q420 332 460 340" />
              </g>
              <path d="M352 296 L357 302 L366 290 M350 324 L355 330 L364 318" strokeWidth="2.2" />
              <path d="M366 352 L506 292" stroke="#4A4A4A" strokeWidth="14" />
              <path d="M366 352 L506 292" stroke="#FFFFFF" strokeWidth="9" />
              <path d="M366 352 L348 362 L360 344" fill="#4A4A4A" />
              <path d="M492 298 L498 310" strokeWidth="2" />
              <path d="M90 160 L140 146 L168 160 L118 176 Z" fill="#FFFFFF" />
              <path d="M90 160 L118 176 L118 196 L90 180 Z" fill="#EDEDED" />
              <path d="M118 176 L168 160 L168 180 L118 196 Z" fill="#FFFFFF" />
              <circle cx="246" cy="146" r="17" fill="#FFFFFF" />
              <path d="M236 140 Q246 132 254 144 Q244 154 240 146" strokeWidth="1.8" />
              <circle cx="36" cy="330" r="14" fill="#FFFFFF" />
              <path d="M28 326 Q36 320 42 330" strokeWidth="1.8" />
              <path d="M520 214 Q574 146 626 184" strokeDasharray="2 9" />
              <path d="M612 176 L626 184 L612 192" />
              <g
                style={{
                  transform: hv.i2t,
                  transition: 'transform .25s ease',
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                }}
              >
                <path d="M600 252 L600 378 A26 9 0 0 0 652 378 L652 252" fill="#FFFFFF" />
                <ellipse cx="626" cy="252" rx="26" ry="9" fill="#FFFFFF" />
                <path d="M612 252 V228 A14 5 0 0 0 640 228 V252" fill="#FF0083" />
                <ellipse cx="626" cy="228" rx="14" ry="5" fill="#FF5CAE" />
                <path d="M610 266 V366" stroke="#E4E4E4" strokeWidth="6" />
                <path d="M652 284 Q692 282 692 314 Q692 338 670 338" stroke="#4A4A4A" strokeWidth="14" />
                <path
                  d="M652 284 Q692 282 692 314 Q692 338 670 338"
                  strokeWidth="9"
                  style={{ stroke: hv.i2hook, transition: 'stroke .25s ease' }}
                />
              </g>
            </svg>
          </div>
        </div>
        <div
          data-reveal="1"
          onPointerEnter={on.i3}
          onPointerLeave={off}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: '48px 80px',
          }}
        >
          <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>Praktika</div>
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
              {second.title}
            </h2>
            <p
              style={{
                margin: '0',
                fontSize: '19px',
                lineHeight: '1.6',
                color: '#4A4A4A',
                maxWidth: '520px',
                textWrap: 'pretty',
              }}
            >
              {second.text}
            </p>
          </div>
          <div style={{ flex: '1.5 1 460px', minWidth: '0' }}>
            <svg
              viewBox="0 0 720 480"
              width="100%"
              role="img"
              aria-label="Uşaqların əlləri karton, lent və taxta çubuqlardan kiçik satış piştaxtası prototipi hazırlayır"
              fill="none"
              stroke="#4A4A4A"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'block' }}
            >
              <ellipse cx="370" cy="406" rx="170" ry="16" fill="#000000" fillOpacity="0.06" stroke="none" />
              <ellipse cx="120" cy="444" rx="54" ry="10" fill="#000000" fillOpacity="0.06" stroke="none" />
              <path d="M470 272 V132" stroke="#4A4A4A" strokeWidth="12" />
              <path d="M470 272 V132" stroke="#F4F4F4" strokeWidth="7" />
              <path d="M250 300 L430 300 L430 400 L250 400 Z" fill="#FFFFFF" />
              <path d="M430 300 L480 270 L480 366 L430 400 Z" fill="#EDEDED" />
              <path d="M250 300 L300 270 L480 270 L430 300 Z" fill="#FFFFFF" />
              <path
                d="M280 316 V388 M310 316 V388 M340 316 V388 M370 316 V388 M400 316 V388"
                stroke="#DADADA"
                strokeWidth="2"
              />
              <path d="M262 300 V152" stroke="#4A4A4A" strokeWidth="12" />
              <path d="M262 300 V152" stroke="#F4F4F4" strokeWidth="7" />
              <path d="M420 300 V152" stroke="#4A4A4A" strokeWidth="12" />
              <path d="M420 300 V152" stroke="#F4F4F4" strokeWidth="7" />
              <g
                style={{
                  transform: hv.i3t,
                  transition: 'transform .25s ease',
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                }}
              >
                <path d="M240 156 L440 156 L490 124 L292 124 Z" fill="#FFFFFF" />
                <path d="M240 156 L440 156 L440 168 L240 168 Z" fill="#EDEDED" />
                <path d="M440 156 L490 124 L490 136 L440 168 Z" fill="#E4E4E4" />
              </g>
              <path d="M246 286 L278 284 L280 308 L248 310 Z" fill="#FF0083" />
              <path d="M76 424 V440 A44 16 0 0 0 164 440 V424" fill="#EDEDED" />
              <ellipse
                cx="120"
                cy="424"
                rx="44"
                ry="16"
                style={{ fill: hv.i3tape, transition: 'fill .25s ease' }}
              />
              <ellipse cx="120" cy="424" rx="20" ry="7" fill="#EDEDED" />
              <path d="M520 446 L660 414" stroke="#4A4A4A" strokeWidth="12" />
              <path d="M520 446 L660 414" stroke="#F4F4F4" strokeWidth="7" />
              <path d="M548 466 L694 446" stroke="#4A4A4A" strokeWidth="12" />
              <path d="M548 466 L694 446" stroke="#F4F4F4" strokeWidth="7" />
              <path d="M-20 440 L176 336" stroke="#4A4A4A" strokeWidth="72" />
              <path d="M-20 440 L176 336" stroke="#EDEDED" strokeWidth="67" />
              <path d="M160 312 L192 368" strokeWidth="2.4" />
              <path
                d="M184 320 Q214 296 246 304 Q266 312 262 334 Q256 354 230 356 Q204 358 190 350 Z"
                fill="#FFFFFF"
              />
              <path d="M224 306 Q234 290 252 292 Q262 296 256 306" fill="#FFFFFF" />
              <path d="M232 330 H256 M228 342 H252" strokeWidth="2" />
              <path d="M740 450 L566 352" stroke="#4A4A4A" strokeWidth="72" />
              <path d="M740 450 L566 352" stroke="#EDEDED" strokeWidth="67" />
              <path d="M582 326 L552 382" strokeWidth="2.4" />
              <path
                d="M560 330 Q530 312 496 322 Q480 332 486 350 Q494 370 520 370 Q546 370 558 360 Z"
                fill="#FFFFFF"
              />
              <path d="M500 326 Q486 310 492 296 Q500 290 508 300 L514 320" fill="#FFFFFF" />
              <path d="M494 344 H516 M498 356 H520" strokeWidth="2" />
            </svg>
          </div>
        </div>
        <div
          data-reveal="1"
          onPointerEnter={on.i4}
          onPointerLeave={off}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '48px 80px' }}
        >
          <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>Pul və planlama</div>
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
              {third.title}
            </h2>
            <p
              style={{
                margin: '0',
                fontSize: '19px',
                lineHeight: '1.6',
                color: '#4A4A4A',
                maxWidth: '520px',
                textWrap: 'pretty',
              }}
            >
              {third.text}
            </p>
          </div>
          <div style={{ flex: '1.5 1 460px', minWidth: '0' }}>
            <svg
              viewBox="0 0 720 460"
              width="100%"
              role="img"
              aria-label="Kalkulyator, sikkələr, xərc dəftəri və çəhrayı qiymət etiketi olan əl işi məhsul"
              fill="none"
              stroke="#4A4A4A"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'block' }}
            >
              <ellipse cx="200" cy="300" rx="130" ry="16" fill="#000000" fillOpacity="0.06" stroke="none" />
              <ellipse cx="372" cy="388" rx="60" ry="12" fill="#000000" fillOpacity="0.06" stroke="none" />
              <ellipse cx="540" cy="316" rx="110" ry="12" fill="#000000" fillOpacity="0.06" stroke="none" />
              <ellipse cx="610" cy="410" rx="56" ry="10" fill="#000000" fillOpacity="0.06" stroke="none" />
              <path d="M80 170 L250 140 L300 250 L130 280 Z" fill="#FFFFFF" />
              <path d="M130 280 L300 250 L300 266 L130 296 Z" fill="#EDEDED" />
              <path d="M80 170 L130 280 L130 296 L80 186 Z" fill="#F4F4F4" />
              <path
                d="M104 182 L236 158 L248 184 L116 208 Z"
                style={{ fill: hv.i4scr, transition: 'fill .25s ease' }}
              />
              <ellipse cx="133.1" cy="214.1" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="170.5" cy="207.5" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="207.9" cy="200.9" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="245.3" cy="194.3" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="140.6" cy="230.6" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="178.0" cy="224.0" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="215.4" cy="217.4" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="252.8" cy="210.8" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="148.1" cy="247.1" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="185.5" cy="240.5" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="222.9" cy="233.9" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="260.3" cy="227.3" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="155.6" cy="263.6" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="193.0" cy="257.0" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="230.4" cy="250.4" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="267.8" cy="243.8" rx="10" ry="5" fill="#FFFFFF" strokeWidth="2" />
              <path d="M470 150 L640 170 L620 300 L450 280 Z" fill="#FFFFFF" />
              <path d="M450 280 L620 300 L620 314 L450 294 Z" fill="#EDEDED" />
              <ellipse cx="486" cy="154" rx="5" ry="9" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="507" cy="156.4" rx="5" ry="9" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="528" cy="158.8" rx="5" ry="9" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="549" cy="161.2" rx="5" ry="9" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="570" cy="163.6" rx="5" ry="9" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="591" cy="166" rx="5" ry="9" fill="#FFFFFF" strokeWidth="2" />
              <ellipse cx="612" cy="168.4" rx="5" ry="9" fill="#FFFFFF" strokeWidth="2" />
              <g stroke="#9A9A9A" strokeWidth="2">
                <path d="M476 196 L556 205" />
                <path d="M584 208 L612 211" />
                <path d="M473.4 218 L553.4 227" />
                <path d="M581.4 230 L609.4 233" />
                <path d="M470.8 240 L550.8 249" />
                <path d="M578.8 252 L606.8 255" />
                <path d="M468.2 262 L548.2 271" />
                <path d="M576.2 274 L604.2 277" />
              </g>
              <path d="M566 286 L606 291 M566 292 L606 297" strokeWidth="2" />
              <path d="M336 374 V383 A36 12 0 0 0 408 383 V374" fill="#EDEDED" />
              <ellipse cx="372" cy="374" rx="36" ry="12" fill="#FFFFFF" />
              <ellipse cx="372" cy="374" rx="21.599999999999998" ry="7.2" stroke="#BDBDBD" strokeWidth="2" />
              <path d="M334 365 V374 A36 12 0 0 0 406 374 V365" fill="#EDEDED" />
              <ellipse cx="370" cy="365" rx="36" ry="12" fill="#FFFFFF" />
              <ellipse cx="370" cy="365" rx="21.599999999999998" ry="7.2" stroke="#BDBDBD" strokeWidth="2" />
              <path d="M337 356 V365 A36 12 0 0 0 409 365 V356" fill="#EDEDED" />
              <ellipse cx="373" cy="356" rx="36" ry="12" fill="#FFFFFF" />
              <ellipse cx="373" cy="356" rx="21.599999999999998" ry="7.2" stroke="#BDBDBD" strokeWidth="2" />
              <g
                style={{
                  transform: hv.i4t,
                  transition: 'transform .25s ease',
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                }}
              >
                <path d="M335 347 V356 A36 12 0 0 0 407 356 V347" fill="#EDEDED" />
                <ellipse
                  cx="371"
                  cy="347"
                  rx="36"
                  ry="12"
                  style={{ fill: hv.i4coin, transition: 'fill .25s ease' }}
                />
                <ellipse
                  cx="371"
                  cy="347"
                  rx="21.599999999999998"
                  ry="7.2"
                  stroke="#BDBDBD"
                  strokeWidth="2"
                />
              </g>
              <path d="M256 396 V403 A30 10 0 0 0 316 403 V396" fill="#EDEDED" />
              <ellipse cx="286" cy="396" rx="30" ry="10" fill="#FFFFFF" />
              <path d="M570 352 L630 352 L630 408 L570 408 Z" fill="#FFFFFF" />
              <path d="M630 352 L654 336 L654 392 L630 408 Z" fill="#EDEDED" />
              <path d="M570 352 L594 336 L654 336 L630 352 Z" fill="#FFFFFF" />
              <path d="M600 352 V408 M612 336 L594 352" stroke="#BDBDBD" strokeWidth="2" />
              <path d="M654 338 Q672 326 676 312" strokeWidth="2" />
              <path d="M666 300 L704 290 L712 318 L674 328 Z" fill="#FF0083" />
              <circle cx="676" cy="312" r="3.5" fill="#FFFFFF" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
