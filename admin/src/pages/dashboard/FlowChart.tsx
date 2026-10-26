import { useId, useState } from 'react';
import { formatShortDay } from '../../lib/format.ts';
import type { FlowStats } from '../../lib/stats.ts';
import { Card } from '../../components/ui/Card.tsx';

/** Applications per day over the last 30 days: the design's bar chart with the average line. */
export default function FlowChart({ stats, mobile }: { stats: FlowStats; mobile: boolean }) {
  const [hover, setHover] = useState(-1);
  const headingId = useId();
  const { daily, days, max, total, week, average } = stats;
  const last = daily.length - 1;
  const shown = hover >= 0 ? hover : -1;
  const averagePosition = (average / max).toFixed(3);

  return (
    <Card
      labelledBy={headingId}
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 id={headingId} style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            Müraciət axını
          </h2>
          <span
            aria-live="polite"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: shown >= 0 ? '#D6006E' : '#6B6B6B',
              transition: 'color .15s',
            }}
          >
            {shown >= 0
              ? `${formatShortDay(days[shown] as string)} · ${daily[shown]} müraciət`
              : 'Gündəlik daxil olan müraciətlər'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {week}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>bu həftə</span>
          </div>
          <div aria-hidden="true" style={{ width: 1, background: '#ECECEE' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {total}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>{daily.length} gündə</span>
          </div>
        </div>
      </div>

      <div
        role="img"
        aria-label={`Son ${daily.length} gündə ${total} müraciət, gündə orta ${average.toFixed(1).replace('.', ',')}`}
        onMouseLeave={() => setHover(-1)}
        style={{
          position: 'relative',
          height: 210,
          display: 'flex',
          alignItems: 'flex-end',
          gap: mobile ? 3 : 6,
          paddingTop: 22,
        }}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, top: 22, borderTop: '1px dashed #ECECEE' }} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(22px + (100% - 22px) / 2)',
            borderTop: '1px dashed #ECECEE',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: `calc((100% - 22px) * ${averagePosition})`,
            borderTop: '1.5px dashed #1A1A1A',
            opacity: 0.35,
            pointerEvents: 'none',
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: 0,
            bottom: `calc((100% - 22px) * ${averagePosition})`,
            transform: 'translateY(-4px)',
            zIndex: 1,
            padding: '2px 7px',
            borderRadius: 6,
            background: '#1A1A1A',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: 800,
            pointerEvents: 'none',
          }}
        >
          {`orta ${average.toFixed(1).replace('.', ',')}/gün`}
        </span>
        {daily.map((count, index) => {
          const height = `${(count / max) * 100}%`;
          const hot = index === shown;
          return (
            <div
              key={days[index]}
              onMouseEnter={() => setHover(index)}
              title={`${formatShortDay(days[index] as string)}: ${count}`}
              style={{
                position: 'relative',
                flex: 1,
                height: '100%',
                display: 'flex',
                alignItems: 'flex-end',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height,
                  minHeight: 4,
                  borderRadius: '6px 6px 3px 3px',
                  background: hot ? '#FF0083' : index === last ? '#1A1A1A' : count ? '#FFC7E1' : '#F1F1F3',
                  transition: 'background .15s, height .4s ease',
                }}
              />
              {hot && (
                <span
                  style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: height,
                    transform: 'translate(-50%,-6px)',
                    minWidth: 22,
                    height: 20,
                    padding: '0 6px',
                    borderRadius: 6,
                    background: '#1A1A1A',
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <ul className="sr-only">
        {daily.map((count, index) => (
          <li key={days[index]}>{`${formatShortDay(days[index] as string)}: ${count}`}</li>
        ))}
      </ul>
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          fontWeight: 600,
          color: '#6B6B6B',
          marginTop: -8,
        }}
      >
        <span>{days[0] ? formatShortDay(days[0]) : ''}</span>
        <span>{days[15] ? formatShortDay(days[15]) : ''}</span>
        <span style={{ color: '#D6006E', fontWeight: 800 }}>Bu gün</span>
      </div>
    </Card>
  );
}
