import type { ApplicationSummary } from '../../api/types.ts';
import { Icon } from '../../components/ui/Icon.tsx';
import { Pill } from '../../components/ui/Pill.tsx';
import { formatDate, formatTime, shortId, telHref } from '../../lib/format.ts';
import { ICON } from '../../lib/icons.ts';
import { STATUS } from '../../lib/status.ts';
import { childAgesText } from '../../lib/stats.ts';
import { sx } from '../../lib/sx.ts';

interface ResultListProps {
  rows: ApplicationSummary[];
  /** The table needs room; below this width the rows are cards. */
  wide: boolean;
  selectedId: string | null;
  onOpen: (id: string) => void;
}

const HEAD: [string, number][] = [
  ['Valideynin adı və soyadı', 20],
  ['Telefon nömrəsi', 14],
  ['Uşağın adı', 14],
  ['Yaş', 14],
  ['Seçilmiş kurs', 14],
  ['Müraciət tarixi', 14],
  ['Status', 14],
];

/** The applications of the page: the design's table on a wide screen, its cards on a narrow one. */
export default function ResultList({ rows, wide, selectedId, onOpen }: ResultListProps) {
  if (!wide) {
    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
        {rows.map((row) => (
          <li
            key={row.id}
            style={{
              borderBottom: '1px solid #F4F4F4',
              background: selectedId === row.id ? '#FFF7FB' : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '16px 18px',
            }}
          >
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
                width: '100%',
                padding: 0,
                border: 'none',
                background: 'none',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{row.parent_name}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#6B6B6B' }}>
                  {row.children.map((child) => child.name).join(', ')} · {childAgesText(row)}
                </span>
              </span>
              <Pill look={STATUS[row.status]} size="sm" />
            </button>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>
                {row.course.title} · {formatDate(row.created_at)}
              </span>
              <a
                href={telHref(row.phone)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 36,
                  padding: '0 12px',
                  border: '1px solid #E3E3E3',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1A1A1A',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <Icon d={ICON.phone} size={14} stroke="#FF0083" strokeWidth={2} />
                {row.phone}
              </a>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 880 }}>
        <thead>
          <tr style={{ background: '#FAFAFA' }}>
            {HEAD.map(([label, pad]) => (
              <th
                key={label}
                scope="col"
                style={{
                  textAlign: 'left',
                  padding: `12px ${pad}px`,
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#6B6B6B',
                  borderBottom: '1px solid #F0F0F0',
                }}
              >
                {label}
              </th>
            ))}
            <th style={{ width: 44, borderBottom: '1px solid #F0F0F0' }}>
              <span className="sr-only">Aç</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onOpen(row.id)}
              {...sx(
                {
                  cursor: 'pointer',
                  borderBottom: '1px solid #F4F4F4',
                  background: selectedId === row.id ? '#FFF7FB' : 'transparent',
                  transition: 'background .12s',
                },
                { background: '#FAFAFA' },
              )}
            >
              <td style={{ padding: '9px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button type="button" className="row-link" onClick={() => onOpen(row.id)}>
                    {row.parent_name}
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>{shortId(row.id)}</span>
                </div>
              </td>
              <td style={{ padding: '9px 14px' }}>
                <a
                  href={telHref(row.phone)}
                  title="Zəng et"
                  onClick={(event) => event.stopPropagation()}
                  {...sx(
                    {
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px',
                      marginLeft: -8,
                      borderRadius: 8,
                      color: '#1A1A1A',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      transition: 'background .12s, color .12s',
                    },
                    { background: '#FFF0F7', color: '#D6006E' },
                  )}
                >
                  <Icon d={ICON.phone} size={14} strokeWidth={2} />
                  {row.phone}
                </a>
              </td>
              <td style={{ padding: '9px 14px', fontWeight: 600, color: '#4A4A4A' }}>
                {row.children.map((child, index) => (
                  <div key={index}>{child.name}</div>
                ))}
              </td>
              <td style={{ padding: '9px 14px', fontWeight: 600, color: '#4A4A4A' }}>
                {row.children.map((child, index) => (
                  <div key={index}>{child.age_at_course_start}</div>
                ))}
              </td>
              <td style={{ padding: '9px 14px', fontWeight: 600, color: '#4A4A4A', whiteSpace: 'nowrap' }}>
                {row.course.title}
              </td>
              <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600, color: '#4A4A4A' }}>{formatDate(row.created_at)}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>
                    {formatTime(row.created_at)}
                  </span>
                </div>
              </td>
              <td style={{ padding: '9px 14px' }}>
                <Pill look={STATUS[row.status]} />
              </td>
              <td style={{ padding: '9px 16px 9px 0', color: '#A3A3A3' }}>
                <Icon d={ICON.chevronRight} size={16} strokeWidth={2.2} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
