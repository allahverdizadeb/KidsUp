export default function ProgramStats() {
  return (
    <section id="proqram" style={{ marginTop: '96px', background: '#F6F6F6' }}>
      <div
        data-reveal="1"
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(56px,8vw,88px) clamp(20px,4vw,32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,150px),1fr))',
            gap: '28px 0',
          }}
        >
          <div
            style={{
              padding: '8px clamp(16px,2vw,28px)',
              borderLeft: '1px solid #D6D6D6',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span
              style={{
                fontWeight: '800',
                fontSize: 'clamp(56px,6vw,84px)',
                letterSpacing: '-0.04em',
                lineHeight: '1',
              }}
            >
              6
            </span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#4A4A4A' }}>həftə</span>
          </div>
          <div
            style={{
              padding: '8px clamp(16px,2vw,28px)',
              borderLeft: '1px solid #D6D6D6',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span
              style={{
                fontWeight: '800',
                fontSize: 'clamp(56px,6vw,84px)',
                letterSpacing: '-0.04em',
                lineHeight: '1',
              }}
            >
              6
            </span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#4A4A4A' }}>modul</span>
          </div>
          <div
            style={{
              padding: '8px clamp(16px,2vw,28px)',
              borderLeft: '1px solid #D6D6D6',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span
              style={{
                fontWeight: '800',
                fontSize: 'clamp(56px,6vw,84px)',
                letterSpacing: '-0.04em',
                lineHeight: '1',
              }}
            >
              16
            </span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#4A4A4A' }}>dərs mövzusu</span>
          </div>
          <div
            style={{
              padding: '8px clamp(16px,2vw,28px)',
              borderLeft: '1px solid #D6D6D6',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span
              style={{
                fontWeight: '800',
                fontSize: 'clamp(56px,6vw,84px)',
                letterSpacing: '-0.04em',
                lineHeight: '1',
                color: '#FF0083',
              }}
            >
              60%
            </span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#4A4A4A' }}>oyun və praktika</span>
          </div>
        </div>
        <p
          style={{
            margin: '0',
            paddingLeft: 'clamp(16px,2vw,28px)',
            fontSize: '18px',
            lineHeight: '1.6',
            color: '#4A4A4A',
            maxWidth: '760px',
          }}
        >
          Həftədə bir görüş. Hər görüşdə bir modul və ona uyğun praktiki tapşırıqlar.
        </p>
      </div>
    </section>
  );
}
