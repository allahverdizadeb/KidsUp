export default function Pricing() {
  return (
    <section id="qiymet" style={{ background: '#FFFFFF' }}>
      <div
        data-reveal="1"
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: 'clamp(72px,10vw,120px) clamp(20px,4vw,32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '48px',
        }}
      >
        <h2
          style={{
            margin: '0',
            fontWeight: '800',
            fontSize: 'clamp(34px,4.6vw,60px)',
            letterSpacing: '-0.04em',
            lineHeight: '1.02',
            textAlign: 'center',
          }}
        >
          Qiymət və iştirak
        </h2>
        <div
          style={{
            border: '2px solid #1A1A1A',
            borderRadius: '6px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,400px),1fr))',
          }}
        >
          <div
            style={{ padding: 'clamp(28px,4vw,56px)', display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            <div style={{ fontSize: '20px', fontWeight: '700' }}>6 həftəlik KidsUp proqramı</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#6B6B6B' }}>1 uşaq üçün</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span
                  style={{
                    fontWeight: '800',
                    fontSize: 'clamp(72px,9vw,128px)',
                    letterSpacing: '-0.05em',
                    lineHeight: '0.9',
                  }}
                >
                  650
                </span>
                <span style={{ fontWeight: '800', fontSize: '32px', color: '#FF0083' }}>AZN</span>
              </div>
            </div>
            <div
              style={{
                borderTop: '1px solid #1A1A1A',
                paddingTop: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ fontWeight: '800', fontSize: '22px', letterSpacing: '-0.01em' }}>
                Birlikdə öyrənmək daha sərfəlidir!
              </div>
              <p style={{ margin: '0', fontSize: '17px', lineHeight: '1.6', color: '#4A4A4A' }}>
                Eyni ailədən iki uşaq qoşulduqda ikinci uşaq üçün qiymət{' '}
                <b style={{ color: '#1A1A1A' }}>500 AZN</b> olur.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '14px',
                  flexWrap: 'wrap',
                  marginTop: '4px',
                }}
              >
                <span style={{ fontSize: '17px', fontWeight: '700' }}>İki uşaq üçün:</span>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#6B6B6B',
                    textDecoration: 'line-through',
                  }}
                >
                  1 300 AZN
                </span>
                <span style={{ fontSize: '30px', fontWeight: '800', letterSpacing: '-0.02em' }}>
                  1 150 AZN
                </span>
              </div>
              <span
                style={{
                  alignSelf: 'flex-start',
                  padding: '8px 14px',
                  borderRadius: '4px',
                  background: '#FF0083',
                  color: '#FFFFFF',
                  fontSize: '15px',
                  fontWeight: '800',
                }}
              >
                150 AZN qənaət — 11,5% ailə endirimi
              </span>
            </div>
            <p style={{ margin: '0', fontSize: '16px', lineHeight: '1.6', color: '#4A4A4A' }}>
              Dərs materialları, Demo Day və sertifikat qiymətə daxildir.
            </p>
          </div>
          <div
            style={{
              padding: 'clamp(28px,4vw,56px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '28px',
              background: '#F6F6F6',
              borderLeft: '1px solid #1A1A1A',
            }}
          >
            <dl style={{ margin: '0', display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '20px',
                  padding: '16px 0',
                  borderBottom: '1px solid #DADADA',
                  flexWrap: 'wrap',
                }}
              >
                <dt style={{ fontSize: '16px', fontWeight: '600', color: '#6B6B6B' }}>Başlanğıc</dt>
                <dd style={{ margin: '0', fontSize: '17px', fontWeight: '800' }}>5 dekabr 2026</dd>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '20px',
                  padding: '16px 0',
                  borderBottom: '1px solid #DADADA',
                  flexWrap: 'wrap',
                }}
              >
                <dt style={{ fontSize: '16px', fontWeight: '600', color: '#6B6B6B' }}>Vaxt</dt>
                <dd style={{ margin: '0', fontSize: '17px', fontWeight: '800' }}>şənbə, 09:30–13:00</dd>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '20px',
                  padding: '16px 0',
                  borderBottom: '1px solid #DADADA',
                  flexWrap: 'wrap',
                }}
              >
                <dt style={{ fontSize: '16px', fontWeight: '600', color: '#6B6B6B' }}>Yaş</dt>
                <dd style={{ margin: '0', fontSize: '17px', fontWeight: '800' }}>8–13</dd>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '20px',
                  padding: '16px 0',
                  borderBottom: '1px solid #DADADA',
                  flexWrap: 'wrap',
                }}
              >
                <dt style={{ fontSize: '16px', fontWeight: '600', color: '#6B6B6B' }}>Qrup</dt>
                <dd style={{ margin: '0', fontSize: '17px', fontWeight: '800' }}>maksimum 20 uşaq</dd>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '20px',
                  padding: '16px 0',
                  flexWrap: 'wrap',
                }}
              >
                <dt style={{ fontSize: '16px', fontWeight: '600', color: '#6B6B6B' }}>Məkan</dt>
                <dd
                  style={{
                    margin: '0',
                    fontSize: '17px',
                    fontWeight: '800',
                    textAlign: 'right',
                    maxWidth: '340px',
                  }}
                >
                  Bakı, dəqiq ünvan qeydiyyatdan əvvəl bildiriləcək
                </dd>
              </div>
            </dl>
            <a
              href="#muraciet"
              style={{
                marginTop: 'auto',
                textAlign: 'center',
                padding: '20px 32px',
                borderRadius: '6px',
                background: '#FF0083',
                color: '#FFFFFF',
                fontWeight: '800',
                fontSize: '19px',
                transition: 'background .15s',
              }}
              className="hv-10"
            >
              Müraciət et
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
