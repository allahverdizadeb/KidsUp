import type { ApplicationStatus, Course } from '../../api/types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { CountBadge } from '../../components/ui/Buttons.tsx';
import { ICON } from '../../lib/icons.ts';
import { STATUS, STATUS_ORDER } from '../../lib/status.ts';
import { sx } from '../../lib/sx.ts';
import type { StatusCounts } from '../../api/types.ts';

export type StatusFilter = ApplicationStatus | 'all';

interface FilterBarProps {
  query: string;
  onQuery: (value: string) => void;
  status: StatusFilter;
  onStatus: (value: StatusFilter) => void;
  counts: StatusCounts | null;
  courses: Course[];
  courseId: string;
  onCourse: (value: string) => void;
  /** Present only for a role that may export. */
  exporter?: { onExport: () => void; busy: boolean };
}

/** Search, the status chips with their counts, the course, and (for an admin) the CSV download. */
export default function FilterBar({
  query,
  onQuery,
  status,
  onStatus,
  counts,
  courses,
  courseId,
  onCourse,
  exporter,
}: FilterBarProps) {
  const all = counts ? counts.new + counts.contacted + counts.approved + counts.declined : null;
  const chips: [StatusFilter, string, number | null][] = [
    ['all', 'Hamısı', all],
    ...STATUS_ORDER.map((key): [StatusFilter, string, number | null] => [
      key,
      STATUS[key].label,
      counts ? counts[key] : null,
    ]),
  ];

  return (
    <Card
      soft
      style={{
        padding: 14,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid #EDEDED',
      }}
    >
      <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 400 }}>
        <Icon
          d={ICON.search}
          size={18}
          stroke="#767676"
          strokeWidth={2}
          style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }}
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Valideyn, uşaq və ya telefon üzrə axtar"
          aria-label="Axtarış"
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          style={{
            width: '100%',
            height: 42,
            padding: '0 38px 0 40px',
            border: '1px solid #E3E3E3',
            borderRadius: 10,
            background: '#FFFFFF',
            fontSize: 14,
            fontWeight: 600,
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            aria-label="Axtarışı təmizlə"
            {...sx(
              {
                position: 'absolute',
                right: 6,
                top: 6,
                width: 30,
                height: 30,
                border: 'none',
                borderRadius: 8,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#767676',
              },
              { background: '#F3F3F4' },
            )}
          >
            <Icon d={ICON.close} size={14} strokeWidth={2.4} />
          </button>
        )}
      </div>

      <div role="group" aria-label="Status filtri" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {chips.map(([key, label, count]) => {
          const on = status === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onStatus(key)}
              aria-pressed={on}
              style={{
                height: 36,
                padding: '0 12px',
                border: `1px solid ${on ? '#1A1A1A' : '#E3E3E3'}`,
                borderRadius: 999,
                background: on ? '#1A1A1A' : '#FFFFFF',
                color: on ? '#FFFFFF' : '#4A4A4A',
                fontSize: 13,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background .15s, color .15s, border-color .15s',
              }}
            >
              {label}
              {count !== null && (
                <CountBadge background={on ? 'rgba(255,255,255,.18)' : '#F3F3F4'}>{count}</CountBadge>
              )}
            </button>
          );
        })}
      </div>

      {(courses.length > 1 || exporter) && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {courses.length > 1 && (
            <select
              value={courseId}
              onChange={(event) => onCourse(event.target.value)}
              aria-label="Kurs"
              style={{
                height: 36,
                padding: '0 10px',
                border: '1px solid #E3E3E3',
                borderRadius: 10,
                background: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                maxWidth: 240,
              }}
            >
              <option value="all">Bütün kurslar</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          )}
          {exporter && (
            <button
              type="button"
              onClick={exporter.onExport}
              disabled={exporter.busy}
              {...sx(
                {
                  height: 36,
                  padding: '0 12px',
                  border: '1px solid #E3E3E3',
                  borderRadius: 10,
                  background: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  opacity: exporter.busy ? 0.6 : 1,
                },
                { background: '#F7F7F8' },
              )}
            >
              <Icon d={ICON.download} size={15} strokeWidth={2} />
              CSV yüklə
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
