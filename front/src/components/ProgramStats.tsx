import { useText } from '../hooks/usePublicContent';

export default function ProgramStats() {
  const weeks = { value: useText('stats.weeks_value'), label: useText('stats.weeks_label') };
  const modules = { value: useText('stats.modules_value'), label: useText('stats.modules_label') };
  const topics = { value: useText('stats.topics_value'), label: useText('stats.topics_label') };
  const play = { value: useText('stats.play_value'), label: useText('stats.play_label') };
  const caption = useText('stats.caption');
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
              {weeks.value}
            </span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#4A4A4A' }}>{weeks.label}</span>
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
              {modules.value}
            </span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#4A4A4A' }}>{modules.label}</span>
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
              {topics.value}
            </span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#4A4A4A' }}>{topics.label}</span>
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
              {play.value}
            </span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#4A4A4A' }}>{play.label}</span>
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
          {caption}
        </p>
      </div>
    </section>
  );
}
