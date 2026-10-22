import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useText } from '../hooks/usePublicContent';

export default function Certificate() {
  const eyebrow = useText('certificate.eyebrow');
  const heading = useText('certificate.heading');
  const text = useText('certificate.text');
  const buttonLabel = useText('certificate.button');
  const image = useText('certificate.image');
  const imageAlt = useText('certificate.image_alt');
  const [certOpen, setCertOpen] = useState(false);
  const certCloseRef = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const scrollY = useRef(0);

  // Move focus into the dialog when it opens; never leave the page scroll-locked on unmount.
  useEffect(() => {
    if (certOpen) certCloseRef.current?.focus();
  }, [certOpen]);
  useEffect(() => () => void (document.body.style.overflow = ''), []);

  const openCert = (e: MouseEvent<HTMLElement>) => {
    trigger.current = e.currentTarget;
    scrollY.current = window.scrollY;
    document.body.style.overflow = 'hidden';
    setCertOpen(true);
  };
  const closeCert = () => {
    document.body.style.overflow = '';
    setCertOpen(false);
    trigger.current?.focus({ preventScroll: true });
    window.scrollTo(0, scrollY.current);
  };
  // Focus stays on the close button while the dialog is open.
  const certKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCert();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      certCloseRef.current?.focus();
    }
  };
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <section id="sertifikat" style={{ background: '#FFFFFF' }}>
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(64px,8vw,96px) clamp(20px,4vw,32px) clamp(72px,10vw,120px)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '48px 80px',
        }}
      >
        <div
          data-reveal="1"
          style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>{eyebrow}</div>
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
          <p
            style={{
              margin: '0',
              fontSize: '19px',
              lineHeight: '1.6',
              color: '#4A4A4A',
              maxWidth: '540px',
              textWrap: 'pretty',
            }}
          >
            {text}
          </p>
          <button
            onClick={openCert}
            style={{
              alignSelf: 'flex-start',
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '16px 24px',
              minHeight: '52px',
              border: '2px solid #1A1A1A',
              borderRadius: '6px',
              background: '#FFFFFF',
              color: '#1A1A1A',
              fontWeight: '800',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'background .15s, color .15s',
            }}
            className="hv-5"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6" />
            </svg>
            {buttonLabel}
          </button>
        </div>
        <div
          data-reveal="1"
          style={{
            flex: '1.4 1 440px',
            minWidth: '0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <button
            onClick={openCert}
            aria-label="Sertifikat nümunəsini böyüt"
            style={{
              display: 'block',
              width: '100%',
              padding: '0',
              border: '1.5px solid #DADADA',
              borderRadius: '6px',
              background: '#FFFFFF',
              cursor: 'zoom-in',
              overflow: 'hidden',
              boxShadow: '0 10px 30px -18px rgba(0,0,0,0.25)',
              transition: 'border-color .25s ease',
            }}
            className="hv-6 fc-1"
          >
            <img
              src={image}
              alt={imageAlt}
              width="2246"
              height="1588"
              loading="lazy"
              decoding="async"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                aspectRatio: '2246/1588',
                objectFit: 'contain',
              }}
            />
          </button>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#6B6B6B' }}>Sertifikat nümunəsi</div>
        </div>
      </div>
      {certOpen && (
        <>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sertifikat nümunəsi"
            onClick={closeCert}
            onKeyDown={certKey}
            style={{
              position: 'fixed',
              inset: '0',
              zIndex: '300',
              background: 'rgba(26,26,26,0.82)',
              overflow: 'auto',
              display: 'flex',
              padding: '72px 16px 24px',
              boxSizing: 'border-box',
            }}
          >
            <button
              ref={certCloseRef}
              onClick={closeCert}
              aria-label="Bağla"
              style={{
                position: 'fixed',
                top: '16px',
                right: '16px',
                zIndex: '2',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                height: '44px',
                padding: '0 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#FFFFFF',
                color: '#1A1A1A',
                fontWeight: '800',
                fontSize: '15px',
                cursor: 'pointer',
              }}
              className="hv-7"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
              Bağla
            </button>
            <div
              onClick={stop}
              style={{
                margin: 'auto',
                width: 'min(1400px,100%)',
                flexShrink: '0',
                background: '#FFFFFF',
                borderRadius: '4px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              }}
            >
              <img
                src={image}
                alt={`${imageAlt}, böyüdülmüş`}
                width="2246"
                height="1588"
                style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '4px' }}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
