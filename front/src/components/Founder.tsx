import { useText, useTexts } from '../hooks/usePublicContent';
import BoldText from './BoldText';

export default function Founder() {
  const eyebrow = useText('founder.eyebrow');
  const name = useText('founder.name');
  const role = useText('founder.role');
  const photo = useText('founder.photo');
  const photoAlt = useText('founder.photo_alt');
  const linkedin = useText('founder.linkedin');
  const quotes = useTexts(['founder.quote_1', 'founder.quote_2', 'founder.quote_3']);
  const wharton = useTexts([
    'wharton.image',
    'wharton.image_alt',
    'wharton.caption',
    'wharton.title',
    'wharton.link',
    'wharton.link_label',
  ]);
  return (
    <section id="haqqimizda" style={{ background: '#F6F6F6', marginTop: '0' }}>
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(72px,10vw,120px) clamp(20px,4vw,32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '56px',
        }}
      >
        <div
          data-reveal="1"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '32px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>{eyebrow}</div>
            <h2
              style={{
                margin: '0',
                fontWeight: '800',
                fontSize: 'clamp(34px,4.6vw,60px)',
                letterSpacing: '-0.04em',
                lineHeight: '1.02',
              }}
            >
              {name}
            </h2>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))',
            gap: '48px 72px',
            alignItems: 'start',
          }}
        >
          <div
            data-reveal="1"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '28px',
              maxWidth: '440px',
              width: '100%',
              justifySelf: 'center',
            }}
          >
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: '18px -18px -18px 18px',
                  border: '2px solid #FF0083',
                  borderRadius: '4px',
                }}
              />
              <img
                src={photo}
                alt={photoAlt}
                loading="lazy"
                decoding="async"
                style={{
                  position: 'relative',
                  display: 'block',
                  width: '100%',
                  aspectRatio: '4/5',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  border: '2px solid #1A1A1A',
                  background: '#FFFFFF',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '12px' }}>
              <div style={{ fontWeight: '800', fontSize: '26px', letterSpacing: '-0.02em' }}>{name}</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#4A4A4A' }}>{role}</div>
            </div>
            <a
              href={linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              title="LinkedIn"
              style={{
                alignSelf: 'flex-start',
                width: '48px',
                height: '48px',
                borderRadius: '6px',
                background: '#0A66C2',
                border: '2px solid #1A1A1A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '4px 4px 0 #1A1A1A',
                transition: 'transform .15s, box-shadow .15s',
              }}
              className="hv-8"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM2.5 9h3v12h-3zM9 9h2.9v1.7c.5-.9 1.7-2 3.6-2 3.8 0 4.5 2.5 4.5 5.7V21h-3v-5.9c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V21H9z" />
              </svg>
            </a>
            <a
              href={wharton[4]}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                padding: '14px',
                background: '#FFFFFF',
                border: '1.5px solid #1A1A1A',
                borderRadius: '6px',
                color: '#1A1A1A',
                transition: 'transform .15s',
              }}
              className="hv-9"
            >
              <img
                src={wharton[0]}
                alt={wharton[1]}
                width="112"
                height="79"
                loading="lazy"
                decoding="async"
                style={{
                  width: '112px',
                  aspectRatio: '1.414/1',
                  objectFit: 'cover',
                  border: '1px solid #E3E3E3',
                  borderRadius: '3px',
                  flexShrink: '0',
                  background: '#F6F6F6',
                }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '0' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#FF0083' }}>{wharton[2]}</span>
                <span style={{ fontSize: '14px', fontWeight: '700', lineHeight: '1.35' }}>{wharton[3]}</span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#4A4A4A',
                    textDecoration: 'underline',
                  }}
                >
                  {wharton[5]}
                </span>
              </span>
            </a>
          </div>
          <div data-reveal="1" style={{ position: 'relative', paddingTop: '40px' }}>
            <svg
              width="140"
              height="96"
              viewBox="0 0 140 96"
              fill="none"
              stroke="#1A1A1A"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ position: 'absolute', top: '0', right: '28px', zIndex: '2' }}
            >
              <rect x="6" y="30" width="128" height="62" rx="3" fill="#FFFFFF" />
              <path d="M28 46 V8 H112 V46" fill="#FFFFFF" />
              <path d="M42 22 H98 M42 32 H86" stroke="#FF0083" strokeWidth="3" />
              <path d="M6 30 L70 66 L134 30" fill="#FFFFFF" />
              <path d="M6 92 L56 58 M134 92 L84 58" />
            </svg>
            <div
              style={{
                position: 'relative',
                background: '#FFFFFF',
                border: '2px solid #1A1A1A',
                borderRadius: '6px',
                padding: 'clamp(28px,4vw,56px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '22px',
                boxShadow: '10px 10px 0 #FFD1E8',
              }}
            >
              <svg width="56" height="44" viewBox="0 0 56 44" aria-hidden="true">
                <path
                  d="M4 44 V26 Q4 6 22 2 L24 9 Q14 13 13 22 H24 V44 Z M32 44 V26 Q32 6 50 2 L52 9 Q42 13 41 22 H52 V44 Z"
                  fill="#FF0083"
                />
              </svg>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  fontSize: '18px',
                  lineHeight: '1.7',
                  color: '#2E2E2E',
                }}
              >
                <p
                  style={{
                    margin: '0',
                    fontSize: 'clamp(19px,1.8vw,22px)',
                    lineHeight: '1.6',
                    color: '#1A1A1A',
                    fontWeight: '600',
                  }}
                >
                  {quotes[0]}
                </p>
                <p style={{ margin: '0' }}>
                  <BoldText text={quotes[1]} />
                </p>
              </div>
              <p
                style={{
                  margin: '0',
                  padding: '20px 0 0',
                  borderTop: '1px dashed #1A1A1A',
                  fontSize: '19px',
                  lineHeight: '1.55',
                  fontWeight: '800',
                  color: '#1A1A1A',
                }}
              >
                {quotes[2]}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ width: '36px', height: '2px', background: '#FF0083' }} />
                <span style={{ fontSize: '17px', fontWeight: '700', color: '#1A1A1A' }}>{name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
