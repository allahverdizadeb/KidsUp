import { useCourse, useFigures, useText } from '../hooks/usePublicContent';
import { splitMoney } from '../lib/figures';
import BoldText from './BoldText';

export default function Pricing() {
  const price = splitMoney(useCourse().priceMinor);
  const figures = useFigures();
  const heading = useText('pricing.heading');
  const planTitle = useText('pricing.plan_title');
  const firstChildLabel = useText('pricing.first_child_label');
  const familyTitle = useText('pricing.family_title');
  const familyText = useText('pricing.family_text');
  const doubleLabel = useText('pricing.double_label');
  const savingBadge = useText('pricing.saving_badge');
  const included = useText('pricing.included');
  const cta = useText('pricing.cta');
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
          {heading}
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
            <div style={{ fontSize: '20px', fontWeight: '700' }}>{planTitle}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#6B6B6B' }}>{firstChildLabel}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span
                  style={{
                    fontWeight: '800',
                    fontSize: 'clamp(72px,9vw,128px)',
                    letterSpacing: '-0.05em',
                    lineHeight: '0.9',
                  }}
                >
                  {price.amount}
                </span>
                <span style={{ fontWeight: '800', fontSize: '32px', color: '#FF0083' }}>
                  {price.currency}
                </span>
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
                {familyTitle}
              </div>
              <p style={{ margin: '0', fontSize: '17px', lineHeight: '1.6', color: '#4A4A4A' }}>
                <BoldText text={familyText} />
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
                <span style={{ fontSize: '17px', fontWeight: '700' }}>{doubleLabel}</span>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#6B6B6B',
                    textDecoration: 'line-through',
                  }}
                >
                  {figures.price_double}
                </span>
                <span style={{ fontSize: '30px', fontWeight: '800', letterSpacing: '-0.02em' }}>
                  {figures.price_family}
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
                {savingBadge}
              </span>
            </div>
            <p style={{ margin: '0', fontSize: '16px', lineHeight: '1.6', color: '#4A4A4A' }}>{included}</p>
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
                <dd style={{ margin: '0', fontSize: '17px', fontWeight: '800' }}>{figures.start_date}</dd>
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
                <dd style={{ margin: '0', fontSize: '17px', fontWeight: '800' }}>{figures.schedule}</dd>
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
                <dd style={{ margin: '0', fontSize: '17px', fontWeight: '800' }}>
                  {figures.age_min}–{figures.age_max}
                </dd>
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
                <dd style={{ margin: '0', fontSize: '17px', fontWeight: '800' }}>
                  maksimum {figures.capacity} uşaq
                </dd>
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
                  {figures.location}
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
              {cta}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
