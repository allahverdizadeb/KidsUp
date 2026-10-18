import { Fragment, useState } from 'react';
import { MODULES } from '../content/modules';
import ModuleIcon from './ModuleIcon';

export default function Modules() {
  const [openIndex, setOpenIndex] = useState(-1);

  const modules = MODULES.map((m, i) => {
    const open = openIndex === i;
    return {
      n: i + 1,
      week: m.week,
      title: m.title,
      desc: m.desc,
      topics: m.topics,
      icon: <ModuleIcon index={i} />,
      open,
      exp: open,
      sign: open ? '−' : '+',
      label: open ? 'Bağla' : 'Mövzular',
      toggle: () => setOpenIndex(open ? -1 : i),
    };
  });
  return (
    <section id="modullar" style={{ background: '#F6F6F6' }}>
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
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#FF0083' }}>Altı modul</div>
            <h2
              style={{
                margin: '0',
                fontWeight: '800',
                fontSize: 'clamp(34px,4.6vw,60px)',
                letterSpacing: '-0.04em',
                lineHeight: '1.02',
              }}
            >
              İdeyadan ilk təqdimata
            </h2>
          </div>
          <a
            href="#muraciet"
            style={{
              fontWeight: '700',
              fontSize: '17px',
              color: '#1A1A1A',
              borderBottom: '2px solid #FF0083',
              paddingBottom: '3px',
            }}
            className="hv-1"
          >
            Müraciət et
          </a>
        </div>
        <div
          data-reveal="1"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))',
            borderTop: '1px solid #1A1A1A',
            borderLeft: '1px solid #1A1A1A',
          }}
        >
          {modules.map((m, __i) => (
            <Fragment key={__i}>
              <div
                style={{
                  borderRight: '1px solid #1A1A1A',
                  borderBottom: '1px solid #1A1A1A',
                  background: '#FFFFFF',
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '16px',
                  }}
                >
                  <span style={{ fontWeight: '800', fontSize: '15px', color: '#FF0083' }}>Modul {m.n}</span>
                  <span style={{ fontWeight: '800', fontSize: '15px', color: '#6B6B6B' }}>{m.week}</span>
                </div>
                <div style={{ height: '96px', display: 'flex', alignItems: 'center' }}>{m.icon}</div>
                <div
                  style={{
                    fontWeight: '800',
                    fontSize: '23px',
                    lineHeight: '1.22',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {m.title}
                </div>
                <p style={{ margin: '0', fontSize: '16px', lineHeight: '1.6', color: '#4A4A4A' }}>{m.desc}</p>
                <button
                  onClick={m.toggle}
                  aria-expanded={m.exp}
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '15px',
                    color: '#1A1A1A',
                    minHeight: '44px',
                  }}
                  className="hv-1"
                >
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      border: '1.5px solid #1A1A1A',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      lineHeight: '1',
                    }}
                  >
                    {m.sign}
                  </span>
                  {m.label}
                </button>
                {m.open && (
                  <>
                    <ul
                      style={{
                        margin: '0',
                        padding: '16px 0 0',
                        borderTop: '1px solid #EAEAEA',
                        listStyle: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      {m.topics.map((t, __i) => (
                        <Fragment key={__i}>
                          <li
                            style={{
                              display: 'flex',
                              gap: '10px',
                              fontSize: '15px',
                              lineHeight: '1.5',
                              color: '#1A1A1A',
                            }}
                          >
                            <span style={{ color: '#FF0083', fontWeight: '800' }}>—</span>
                            {t}
                          </li>
                        </Fragment>
                      ))}
                    </ul>
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
