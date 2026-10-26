import type { Course } from '../../api/types.ts';
import { formatToday } from '../../lib/format.ts';
import { sx } from '../../lib/sx.ts';
import { percent } from '../../lib/stats.ts';
import type { LayoutMode } from '../../hooks/useWidth.ts';

interface HeroProps {
  mode: LayoutMode;
  width: number;
  now: string;
  newCount: number;
  total: number;
  week: number;
  active: Course | null;
  onNew: () => void;
  onCourses: () => void;
}

/** The dark card at the top: what waits for an answer, and the course the landing page's form is tied to. */
export default function Hero({
  mode,
  width,
  now,
  newCount,
  total,
  week,
  active,
  onNew,
  onCourses,
}: HeroProps) {
  const mobile = mode === 'mobile';
  const title =
    total === 0
      ? 'Hələ müraciət gəlməyib'
      : newCount
        ? `${newCount} yeni müraciət cavab gözləyir`
        : 'Bütün müraciətlərə baxılıb';
  const sub = active
    ? `Saytdakı qeydiyyat formu “${active.title}” kursuna bağlıdır. Bu həftə ${week} yeni müraciət gəlib.`
    : 'Saytda aktiv kurs seçilməyib.';
  const taken = active?.seats.approved_children ?? 0;
  const capacity = active?.capacity ?? 0;
  const left = active?.seats.free_seats ?? 0;
  const degrees = Math.round((percent(taken, capacity) / 100) * 360);

  return (
    <section
      aria-label="Ümumi vəziyyət"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#1A1A1A',
        color: '#FFFFFF',
        borderRadius: 24,
        padding: mobile ? '24px 22px' : '32px 34px',
        display: 'grid',
        gridTemplateColumns: width >= 1100 ? 'minmax(0,1.25fr) minmax(0,1fr)' : 'minmax(0,1fr)',
        gap: 28,
        alignItems: 'center',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          right: -110,
          top: -150,
          background: '#FF0083',
          opacity: 0.12,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'flex-start',
            height: 28,
            padding: '0 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,.08)',
            fontSize: 12,
            fontWeight: 700,
            color: '#D9D9D9',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF0083' }} />
          {formatToday(now)}
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: mobile ? 26 : 34,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.08,
            textWrap: 'balance',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.55,
            fontWeight: 500,
            color: '#BDBDBD',
            maxWidth: 520,
            textWrap: 'pretty',
          }}
        >
          {sub}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
          <button
            type="button"
            onClick={onNew}
            {...sx(
              {
                height: 44,
                padding: '0 18px',
                border: 'none',
                borderRadius: 12,
                background: '#FF0083',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background .15s, transform .15s',
              },
              { background: '#E00073', transform: 'translateY(-1px)' },
            )}
          >
            Yeni müraciətlər
            <span
              style={{
                minWidth: 22,
                height: 22,
                padding: '0 7px',
                borderRadius: 999,
                background: 'rgba(255,255,255,.22)',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {newCount}
            </span>
          </button>
          <button
            type="button"
            onClick={onCourses}
            {...sx(
              {
                height: 44,
                padding: '0 18px',
                border: '1px solid #3A3A3A',
                borderRadius: 12,
                background: 'transparent',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background .15s, border-color .15s',
              },
              { background: '#262626', borderColor: '#4A4A4A' },
            )}
          >
            Kursları idarə et
          </button>
        </div>
      </div>

      {active ? (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            padding: '20px 22px',
            borderRadius: 20,
            background: 'rgba(255,255,255,.05)',
            border: '1px solid rgba(255,255,255,.08)',
            minWidth: 0,
          }}
        >
          <div
            role="img"
            aria-label={`${taken} təsdiqlənib, ${capacity} yerdən`}
            style={{
              position: 'relative',
              width: 128,
              height: 128,
              borderRadius: '50%',
              background: `conic-gradient(#FF0083 ${degrees}deg, #333333 0)`,
              flexShrink: 0,
              transition: 'background .4s',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 12,
                borderRadius: '50%',
                background: '#222222',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {taken}
                <span style={{ fontSize: 16, color: '#A3A3A3' }}>/{capacity}</span>
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#A3A3A3' }}>təsdiqlənib</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 800,
                color: '#5FD39C',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#1F9D66',
                  boxShadow: '0 0 0 4px rgba(31,157,102,.22)',
                }}
              />
              Saytda aktiv kurs
            </span>
            <span
              style={{
                fontSize: 17,
                fontWeight: 800,
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
                textWrap: 'balance',
              }}
            >
              {active.title}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#BDBDBD' }}>{active.schedule}</span>
            <span
              style={{
                alignSelf: 'flex-start',
                marginTop: 2,
                padding: '4px 10px',
                borderRadius: 8,
                background: left ? 'rgba(255,0,131,.18)' : '#FFFFFF',
                color: left ? '#FF7AB8' : '#1A1A1A',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {left ? `${left} boş yer` : 'Boş yer yoxdur'}
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            padding: 22,
            borderRadius: 20,
            border: '1px dashed #4A4A4A',
            fontSize: 14,
            fontWeight: 600,
            color: '#BDBDBD',
            lineHeight: 1.5,
          }}
        >
          Saytda aktiv kurs yoxdur. Qeydiyyat formu müraciət qəbul etmir.
        </div>
      )}
    </section>
  );
}
