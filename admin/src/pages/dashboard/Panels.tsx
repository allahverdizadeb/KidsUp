import { useId } from 'react';
import type { ApplicationStatus, ApplicationSummary, Course, StatusCounts } from '../../api/types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { LoadError, Loading } from '../../components/ui/Feedback.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { Avatar, Pill } from '../../components/ui/Pill.tsx';
import { formatMoney, initials, relativeDay, telHref, waitingFor } from '../../lib/format.ts';
import { ICON } from '../../lib/icons.ts';
import { STATUS, avatarOf } from '../../lib/status.ts';
import { sx } from '../../lib/sx.ts';
import { childAgesText, childNames, percent, seatCells } from '../../lib/stats.ts';
import type { FlowStats } from '../../lib/stats.ts';

// --- the four figures

interface KpiProps {
  counts: StatusCounts;
  total: number;
  flow: FlowStats;
  columns: string;
  onOpen: (status: ApplicationStatus | 'all') => void;
}

export function Kpis({ counts, total, flow, columns, onOpen }: KpiProps) {
  const whole = total || 1;
  const delta = flow.week - flow.previousWeek;
  const rising = delta >= 0;
  const conversion = Math.round(percent(counts.approved, whole));
  const items: {
    status: ApplicationStatus | 'all';
    label: string;
    value: number;
    chip: string;
    chipBackground: string;
    chipColor: string;
    sub: string;
    share: number;
    dot: string;
  }[] = [
    {
      status: 'all',
      label: 'Ümumi müraciətlər',
      value: total,
      chip: `${rising ? '+' : ''}${delta} həftəlik`,
      chipBackground: rising ? '#E8F6EE' : '#F1F1F1',
      chipColor: rising ? '#0F6B43' : '#5C5C5C',
      sub: `Son ${flow.daily.length} gündə ${flow.total} müraciət`,
      share: 100,
      dot: '#1A1A1A',
    },
    {
      status: 'new',
      label: 'Yeni',
      value: counts.new,
      chip: `${Math.round(percent(counts.new, whole))}%`,
      chipBackground: '#FFEFF7',
      chipColor: '#C2006A',
      sub: 'Baxılmağı gözləyir',
      share: percent(counts.new, whole),
      dot: '#FF0083',
    },
    {
      status: 'contacted',
      label: 'Əlaqə saxlanılıb',
      value: counts.contacted,
      chip: `${Math.round(percent(counts.contacted, whole))}%`,
      chipBackground: '#FFF4E2',
      chipColor: '#8F5400',
      sub: 'Qərar mərhələsində',
      share: percent(counts.contacted, whole),
      dot: '#F29900',
    },
    {
      status: 'approved',
      label: 'Təsdiqlənib',
      value: counts.approved,
      chip: `${conversion}% konversiya`,
      chipBackground: '#E8F6EE',
      chipColor: '#0F6B43',
      sub: 'Bütün kurslar üzrə',
      share: conversion,
      dot: '#1F9D66',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 14 }}>
      {items.map((item) => (
        <button
          key={item.status}
          type="button"
          onClick={() => onOpen(item.status)}
          {...sx(
            {
              background: '#FFFFFF',
              border: '1px solid #ECECEE',
              borderRadius: 20,
              boxShadow: '0 1px 2px rgba(26,26,26,.03),0 8px 24px rgba(26,26,26,.03)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              textAlign: 'left',
              transition: 'transform .18s, box-shadow .18s, border-color .18s',
            },
            {
              transform: 'translateY(-2px)',
              boxShadow: '0 14px 32px rgba(26,26,26,.08)',
              borderColor: '#E0E0E3',
            },
          )}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              width: '100%',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                color: '#6B6B6B',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 3, background: item.dot }} />
              {item.label}
            </span>
            <Icon d={ICON.arrowUpRight} size={16} stroke="#A3A3A3" strokeWidth={2.2} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
              {item.value}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 999,
                background: item.chipBackground,
                color: item.chipColor,
              }}
            >
              {item.chip}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <div
              aria-hidden="true"
              style={{ height: 6, borderRadius: 999, background: '#F1F1F3', overflow: 'hidden' }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${item.share}%`,
                  background: item.dot,
                  borderRadius: 999,
                  transition: 'width .5s ease',
                }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>{item.sub}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// --- who has waited longest

interface WaitingProps {
  /** The oldest "new" applications; `null` while they are on their way or when they could not be read. */
  items: ApplicationSummary[] | null;
  /** Why `items` is `null`, when it failed. */
  error: unknown;
  onRetry: () => void;
  count: number;
  now: string;
  onOpen: (id: string) => void;
}

export function WaitingCard({ items, error, onRetry, count, now, onOpen }: WaitingProps) {
  const shown = items ?? [];
  const headingId = useId();
  return (
    <Card
      labelledBy={headingId}
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 id={headingId} style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            Cavab gözləyənlər
          </h2>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#6B6B6B' }}>Ən köhnə “Yeni” müraciətlər</span>
        </div>
        <span
          aria-label={`${count} gözləyən müraciət`}
          style={{
            minWidth: 30,
            height: 30,
            padding: '0 9px',
            borderRadius: 10,
            background: '#FFF0F7',
            color: '#C2006A',
            fontSize: 14,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {count}
        </span>
      </div>
      <ul
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}
      >
        {shown.map((item) => {
          const [background, color] = avatarOf(item.id);
          const waited = waitingFor(item.created_at, now);
          return (
            <li
              key={item.id}
              {...sx(
                {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  margin: '0 -10px',
                  borderRadius: 12,
                  transition: 'background .12s',
                },
                { background: '#F7F7F8' },
              )}
            >
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                }}
              >
                <Avatar
                  initials={initials(item.parent_name)}
                  background={background}
                  color={color}
                  size={38}
                  rounded={12}
                />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.parent_name}
                  </span>
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: waited.days >= 3 ? '#C2006A' : '#6B6B6B' }}
                  >
                    {waited.text}
                  </span>
                </span>
              </button>
              <a
                href={telHref(item.phone)}
                title="Zəng et"
                aria-label={`Zəng et: ${item.parent_name}`}
                {...sx(
                  {
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: '1px solid #ECECEE',
                    color: '#1A1A1A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background .12s, color .12s, border-color .12s',
                  },
                  { background: '#FF0083', color: '#FFFFFF', borderColor: '#FF0083' },
                )}
              >
                <Icon d={ICON.phone} size={15} strokeWidth={2} />
              </a>
            </li>
          );
        })}
      </ul>
      {items === null && (error ? <LoadError error={error} onRetry={onRetry} /> : <Loading />)}
      {items !== null && items.length === 0 && (
        <div
          style={{
            padding: '28px 8px',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: '#6B6B6B',
          }}
        >
          Bütün yeni müraciətlərə baxılıb.
        </div>
      )}
    </Card>
  );
}

// --- the newest applications

interface LatestProps {
  items: ApplicationSummary[];
  now: string;
  wide: boolean;
  onOpen: (id: string) => void;
  onAll: () => void;
}

export function LatestCard({ items, now, wide, onOpen, onAll }: LatestProps) {
  const headingId = useId();
  return (
    <Card labelledBy={headingId} style={{ overflow: 'hidden', minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '22px 24px 12px',
        }}
      >
        <h2 id={headingId} style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
          Son müraciətlər
        </h2>
        <button
          type="button"
          onClick={onAll}
          {...sx(
            {
              height: 32,
              padding: '0 12px',
              border: '1px solid #ECECEE',
              borderRadius: 10,
              background: '#FFFFFF',
              fontSize: 13,
              fontWeight: 800,
              color: '#1A1A1A',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'background .15s',
            },
            { background: '#F7F7F8' },
          )}
        >
          Hamısına bax
        </button>
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '0 12px 12px',
        }}
      >
        {items.map((item) => {
          const [background, color] = avatarOf(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                {...sx(
                  {
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '9px 12px',
                    border: 'none',
                    borderRadius: 12,
                    background: 'transparent',
                    textAlign: 'left',
                    transition: 'background .12s',
                  },
                  { background: '#F7F7F8' },
                )}
              >
                <Avatar initials={initials(item.parent_name)} background={background} color={color} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.parent_name}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#6B6B6B',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {childNames(item)} · {childAgesText(item)}
                  </span>
                </span>
                {wide && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#6B6B6B',
                      whiteSpace: 'nowrap',
                      minWidth: 110,
                      textAlign: 'right',
                    }}
                  >
                    {relativeDay(item.created_at, now)}
                  </span>
                )}
                <Pill look={STATUS[item.status]} />
              </button>
            </li>
          );
        })}
      </ul>
      {items.length === 0 && (
        <div
          style={{
            padding: '28px 24px 36px',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: '#6B6B6B',
          }}
        >
          Hələ müraciət gəlməyib.
        </div>
      )}
    </Card>
  );
}

// --- seats

const CELL = {
  taken: { background: '#FF0083', border: '#FF0083', title: 'Təsdiqlənib' },
  waiting: { background: '#FFD1E6', border: '#FFD1E6', title: 'Gözləyir' },
  empty: { background: '#F4F4F6', border: '#E6E6EA', title: 'Boş' },
} as const;

export function SeatsCard({ courses, onCourses }: { courses: Course[]; onCourses: () => void }) {
  const headingId = useId();
  return (
    <Card
      labelledBy={headingId}
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 id={headingId} style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
          Kurslarda yerlər
        </h2>
        <button
          type="button"
          onClick={onCourses}
          {...sx(
            {
              border: 'none',
              background: 'none',
              padding: '4px 0',
              fontSize: 13,
              fontWeight: 800,
              color: '#D6006E',
            },
            { color: '#A8005A' },
          )}
        >
          Kurslar →
        </button>
      </div>
      {courses.map((course) => {
        const cells = seatCells(course);
        const taken = cells.filter((cell) => cell === 'taken').length;
        const waiting = cells.filter((cell) => cell === 'waiting').length;
        const full = course.seats.free_seats === 0;
        const tag = full
          ? { label: 'Dolub', background: '#1A1A1A', color: '#FFFFFF' }
          : course.registration_open
            ? { label: 'Aktiv', background: '#E8F6EE', color: '#0F6B43' }
            : { label: `${course.seats.free_seats} boş`, background: '#F1F1F1', color: '#5C5C5C' };
        return (
          <div key={course.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{course.title}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>
                  {course.seats.approved_children} / {course.capacity} təsdiqlənib ·{' '}
                  {formatMoney(course.price_minor)} AZN
                </span>
              </div>
              <span
                style={{
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: tag.background,
                  color: tag.color,
                  fontSize: 11,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {tag.label}
              </span>
            </div>
            <div
              role="img"
              aria-label={`Təsdiqlənib: ${taken}, gözləyir: ${waiting}, boş: ${cells.length - taken - waiting}`}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(10,minmax(0,26px))', gap: 5 }}
            >
              {cells.map((cell, index) => (
                <span
                  key={index}
                  title={CELL[cell].title}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 5,
                    background: CELL[cell].background,
                    border: `1px solid ${CELL[cell].border}`,
                    transition: 'background .3s',
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      {courses.length === 0 && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6B6B6B' }}>Hələ kurs yaradılmayıb.</div>
      )}
      <div
        style={{
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
          paddingTop: 14,
          borderTop: '1px solid #F1F1F3',
          fontSize: 12,
          fontWeight: 700,
          color: '#6B6B6B',
        }}
      >
        {(['taken', 'waiting', 'empty'] as const).map((key) => (
          <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: CELL[key].background,
                border: key === 'empty' ? `1px solid ${CELL.empty.border}` : undefined,
              }}
            />
            {CELL[key].title}
          </span>
        ))}
      </div>
    </Card>
  );
}
