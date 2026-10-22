import { Fragment, useState } from 'react';
import { useQuestions, useText } from '../hooks/usePublicContent';

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0);
  const heading = useText('faq.heading');

  const faqs = useQuestions('faq.items').map(({ q, a }, i) => {
    const open = openIndex === i;
    return {
      q,
      parts: a.split('**').map((t, j) => ({ t, w: j % 2 ? 800 : 400, c: j % 2 ? '#1A1A1A' : '#4A4A4A' })),
      open,
      exp: open,
      sign: open ? '−' : '+',
      toggle: () => setOpenIndex(open ? -1 : i),
    };
  });
  return (
    <section id="suallar" style={{ background: '#F6F6F6' }}>
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(72px,10vw,120px) clamp(20px,4vw,32px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))',
          gap: '40px 96px',
          alignItems: 'start',
        }}
      >
        <h2
          data-reveal="1"
          style={{
            margin: '0',
            fontWeight: '800',
            fontSize: 'clamp(34px,4.6vw,60px)',
            letterSpacing: '-0.04em',
            lineHeight: '1.02',
          }}
        >
          {heading}
        </h2>
        <div
          data-reveal="1"
          style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #1A1A1A' }}
        >
          {faqs.map((f, __i) => (
            <Fragment key={__i}>
              <div style={{ borderBottom: '1px solid #1A1A1A' }}>
                <button
                  onClick={f.toggle}
                  aria-expanded={f.exp}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '20px',
                    padding: '24px 0',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: '800',
                    fontSize: '20px',
                    color: '#1A1A1A',
                  }}
                  className="hv-1"
                >
                  {f.q}
                  <span
                    style={{
                      flexShrink: '0',
                      fontSize: '28px',
                      fontWeight: '500',
                      color: '#FF0083',
                      lineHeight: '1',
                    }}
                  >
                    {f.sign}
                  </span>
                </button>
                {f.open && (
                  <>
                    <p
                      style={{
                        margin: '0',
                        padding: '0 48px 24px 0',
                        fontSize: '17px',
                        lineHeight: '1.65',
                        color: '#4A4A4A',
                      }}
                    >
                      {f.parts.map((p, __i) => (
                        <Fragment key={__i}>
                          <span style={{ fontWeight: p.w, color: p.c }}>{p.t}</span>
                        </Fragment>
                      ))}
                    </p>
                  </>
                )}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
