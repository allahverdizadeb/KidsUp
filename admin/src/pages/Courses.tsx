import { useState } from 'react';
import { listCourses, updateCourse } from '../api/courses.ts';
import type { Course } from '../api/types.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { PrimaryButton } from '../components/ui/Buttons.tsx';
import { LoadError, Loading } from '../components/ui/Feedback.tsx';
import { Icon } from '../components/ui/Icon.tsx';
import { Pill, SwitchTrack } from '../components/ui/Pill.tsx';
import { useAsync } from '../hooks/useAsync.ts';
import { describe } from '../lib/errors.ts';
import { formatMoney, weeksText } from '../lib/format.ts';
import { ICON } from '../lib/icons.ts';
import { sx } from '../lib/sx.ts';
import { activeCourse, percent } from '../lib/stats.ts';
import type { StatusLook } from '../lib/status.ts';
import { useLive } from '../state/useLive.ts';
import { useNav } from '../state/useNav.ts';
import { useSession } from '../state/useSession.ts';
import { useToast } from '../state/useToast.ts';
import CourseModal from './courses/CourseModal.tsx';
import ParticipantsModal from './courses/ParticipantsModal.tsx';

const STATUS_FULL_OPEN: StatusLook = {
  label: 'Saytda aktiv · dolub',
  fg: '#FFFFFF',
  bg: '#1A1A1A',
  dot: '#1F9D66',
};
const STATUS_FULL: StatusLook = { label: 'Dolub', fg: '#FFFFFF', bg: '#1A1A1A', dot: '#FFFFFF' };
const STATUS_OPEN: StatusLook = { label: 'Saytda aktiv', fg: '#0F6B43', bg: '#E8F6EE', dot: '#1F9D66' };
const STATUS_CLOSED: StatusLook = { label: 'Qeydiyyat bağlı', fg: '#5C5C5C', bg: '#F1F1F1', dot: '#A3A3A3' };

function statusOf(course: Course): StatusLook {
  const full = course.seats.free_seats === 0;
  if (full) return course.registration_open ? STATUS_FULL_OPEN : STATUS_FULL;
  return course.registration_open ? STATUS_OPEN : STATUS_CLOSED;
}

function priceTag(minor: number): { label: string; bg: string; fg: string } {
  if (minor === 50_000) return { label: 'Pilot qiymət', bg: '#FFF0F7', fg: '#C2006A' };
  if (minor === 65_000) return { label: 'Standart qiymət', bg: '#F3F3F4', fg: '#4A4A4A' };
  return { label: 'Xüsusi qiymət', bg: '#F3F3F4', fg: '#4A4A4A' };
}

const infoRow = { display: 'flex', justifyContent: 'space-between', gap: 16 } as const;

/** The courses: what each costs, when it runs, how many seats are taken, and which one the site's form is tied to. */
export default function Courses() {
  const { can } = useSession();
  const { toast } = useToast();
  const { go } = useNav();
  const live = useLive();
  const list = useAsync(
    (background) => listCourses({ background }).then((page) => page.items),
    '',
    live.tick,
  );
  const [editing, setEditing] = useState<Course | 'new' | null>(null);
  const [people, setPeople] = useState<Course | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const mayWrite = can('courses:write');

  const courses = list.data ?? [];
  const active = activeCourse(courses);
  // The design ties the form to one course; if the data says more are open (set outside the panel), say so.
  const others = courses.filter((course) => course.registration_open).length - (active ? 1 : 0);

  const toggle = async (course: Course) => {
    setSwitching(course.id);
    try {
      if (course.registration_open) {
        await updateCourse(course.id, { registration_open: false });
        toast(
          'ok',
          'Qeydiyyat bağlandı',
          'Saytda aktiv kurs yoxdur. Formdan gələn müraciətlər heç bir kursa bağlanmayacaq.',
        );
      } else {
        // Opened first, the others closed after: the form never has no course in between.
        await updateCourse(course.id, { registration_open: true });
        const closed = courses.filter((other) => other.registration_open && other.id !== course.id);
        for (const other of closed) await updateCourse(other.id, { registration_open: false });
        toast(
          'ok',
          `${course.title} aktivdir`,
          `Saytdakı qeydiyyat formu artıq bu kursa bağlıdır.${closed.length ? ` ${closed.map((other) => other.title).join(', ')} üçün qeydiyyat bağlandı.` : ''}`,
        );
      }
    } catch (error) {
      const problem = describe(error);
      toast('error', problem.title, problem.sub);
    } finally {
      setSwitching(null);
      list.reload();
      live.refresh();
    }
  };

  return (
    <>
      <PageHeader
        title="Kurslar"
        sub="Saytdakı qeydiyyat formu eyni anda yalnız bir aktiv kursa bağlıdır. Hansı kurs aktivdirsə, yeni müraciətlər ona düşür. Digər kurslar keçmiş və ya gələcək qruplardır."
        actions={
          mayWrite ? (
            <PrimaryButton plus onClick={() => setEditing('new')}>
              Yeni kurs
            </PrimaryButton>
          ) : undefined
        }
      />

      {list.error && !list.data ? (
        <LoadError error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
              padding: '14px 18px',
              borderRadius: 14,
              background: active ? '#FFFFFF' : '#FFF4E2',
              border: `1px solid ${active ? '#EDEDED' : '#F5DDB4'}`,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6B6B6B', whiteSpace: 'nowrap' }}>
              Saytdakı qeydiyyat formu
            </span>
            <Icon d={ICON.arrowRight} size={18} stroke="#767676" strokeWidth={2} />
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 15,
                fontWeight: 800,
                color: active ? '#1A1A1A' : '#8F5400',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: active ? '#1F9D66' : '#F29900',
                }}
              />
              {active ? active.title : 'Aktiv kurs yoxdur'}
            </span>
            {others > 0 && (
              <span
                role="note"
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: '#FFF4E2',
                  color: '#8F5400',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {`Daha ${others} kurs da aktivdir: sayt formu qrupu seçdirəcək`}
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#6B6B6B' }}>
              {active
                ? `${active.seats.approved_children} / ${active.capacity} təsdiqlənib · ${active.seats.free_seats ? `${active.seats.free_seats} boş yer` : 'Boş yer yoxdur'}`
                : 'Kurs kartında “Saytda aktiv” açarını yandırın'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,330px),1fr))',
              gap: 16,
              animation: 'kaFade .25s ease',
            }}
          >
            {courses.map((course) => {
              const tag = priceTag(course.price_minor);
              const full = course.seats.free_seats === 0;
              const applications = Object.values(course.seats.applications).reduce((a, b) => a + b, 0);
              return (
                <article
                  key={course.id}
                  {...sx(
                    {
                      background: '#FFFFFF',
                      border: '1px solid #EDEDED',
                      borderRadius: 14,
                      boxShadow: '0 1px 2px rgba(26,26,26,.04)',
                      padding: 24,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 20,
                      transition: 'box-shadow .2s, transform .2s',
                    },
                    { boxShadow: '0 10px 30px rgba(26,26,26,.07)', transform: 'translateY(-2px)' },
                  )}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: 19,
                          fontWeight: 800,
                          letterSpacing: '-0.01em',
                          lineHeight: 1.25,
                        }}
                      >
                        {course.title}
                      </h2>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#6B6B6B' }}>
                        {course.age_min}–{course.age_max} yaş
                      </span>
                    </div>
                    <Pill look={statusOf(course)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {formatMoney(course.price_minor)}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#6B6B6B' }}>AZN</span>
                    <span
                      style={{
                        marginLeft: 4,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: tag.bg,
                        color: tag.fg,
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {tag.label}
                    </span>
                  </div>
                  <dl style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, margin: 0 }}>
                    <div style={infoRow}>
                      <dt style={{ fontWeight: 600, color: '#6B6B6B' }}>Müddət</dt>
                      <dd style={{ fontWeight: 700, textAlign: 'right', margin: 0 }}>
                        {weeksText(course.start_date, course.end_date)}
                      </dd>
                    </div>
                    <div style={infoRow}>
                      <dt style={{ fontWeight: 600, color: '#6B6B6B' }}>Cədvəl</dt>
                      <dd style={{ fontWeight: 700, textAlign: 'right', margin: 0 }}>{course.schedule}</dd>
                    </div>
                    <div style={infoRow}>
                      <dt style={{ fontWeight: 600, color: '#6B6B6B' }}>Məkan</dt>
                      <dd style={{ fontWeight: 700, textAlign: 'right', maxWidth: 220, margin: 0 }}>
                        {course.location}
                      </dd>
                    </div>
                    <div style={infoRow}>
                      <dt style={{ fontWeight: 600, color: '#6B6B6B' }}>İkinci uşaq</dt>
                      <dd style={{ fontWeight: 700, textAlign: 'right', margin: 0 }}>
                        {formatMoney(course.second_child_price_minor)} AZN
                      </dd>
                    </div>
                  </dl>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: 14,
                      borderRadius: 12,
                      background: '#FAFAFA',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 800 }}>
                        {course.seats.approved_children} / {course.capacity}{' '}
                        <span style={{ fontWeight: 600, color: '#6B6B6B' }}>təsdiqlənib</span>
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: full ? '#1A1A1A' : '#D6006E' }}>
                        {full ? 'Boş yer yoxdur' : `${course.seats.free_seats} boş yer`}
                      </span>
                    </div>
                    <div
                      aria-hidden="true"
                      style={{ height: 8, borderRadius: 999, background: '#ECECEC', overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, percent(course.seats.approved_children, course.capacity))}%`,
                          background: full ? '#1A1A1A' : '#FF0083',
                          borderRadius: 999,
                          transition: 'width .5s ease',
                        }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 'auto',
                    }}
                  >
                    {mayWrite && (
                      <button
                        type="button"
                        onClick={() => setEditing(course)}
                        {...sx(
                          {
                            height: 38,
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
                            flexShrink: 0,
                            transition: 'background .15s',
                          },
                          { background: '#F7F7F8' },
                        )}
                      >
                        <Icon d={ICON.edit} size={14} strokeWidth={2} />
                        Redaktə et
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPeople(course)}
                      {...sx(
                        {
                          height: 38,
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
                          flexShrink: 0,
                          transition: 'background .15s',
                        },
                        { background: '#F7F7F8' },
                      )}
                    >
                      İştirakçılar
                      <span
                        style={{
                          minWidth: 20,
                          height: 20,
                          padding: '0 6px',
                          borderRadius: 999,
                          background: '#F3F3F4',
                          fontSize: 11,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {applications}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={course.registration_open}
                      aria-label={`Saytda aktiv: ${course.title}`}
                      title="Saytdakı qeydiyyat formunu bu kursa bağla"
                      disabled={!mayWrite || switching !== null}
                      onClick={() => void toggle(course)}
                      style={{
                        marginLeft: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        height: 38,
                        padding: '0 4px 0 8px',
                        border: 'none',
                        background: 'transparent',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#6B6B6B',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {/* The words never change (the name of a switch must not); the switch shows the state. */}
                      <span>Saytda aktiv</span>
                      <SwitchTrack on={course.registration_open} />
                    </button>
                  </div>
                </article>
              );
            })}
            {mayWrite && (
              <button
                type="button"
                onClick={() => setEditing('new')}
                {...sx(
                  {
                    minHeight: 300,
                    border: '1.5px dashed #D6D6D6',
                    borderRadius: 14,
                    background: 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    color: '#6B6B6B',
                    transition: 'border-color .15s, background .15s, color .15s',
                  },
                  { borderColor: '#FF0083', background: '#FFF7FB', color: '#D6006E' },
                )}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    border: '1px solid #E3E3E3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon d={ICON.plus} size={20} strokeWidth={2.2} />
                </span>
                <span style={{ fontSize: 15, fontWeight: 800 }}>Yeni kurs yarat</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>
                  Standart: 650 AZN · 20 yer
                </span>
              </button>
            )}
          </div>
          {courses.length === 0 && !mayWrite && (
            <div style={{ fontSize: 14, fontWeight: 600, color: '#6B6B6B' }}>Hələ kurs yaradılmayıb.</div>
          )}
        </>
      )}

      {editing && (
        <CourseModal
          course={editing === 'new' ? null : editing}
          courses={courses}
          onClose={() => setEditing(null)}
          onSaved={() => {
            list.reload();
            live.refresh();
          }}
        />
      )}
      {people && (
        <ParticipantsModal
          course={people}
          onClose={() => setPeople(null)}
          onOpenApplication={(id) => {
            setPeople(null);
            go('reg', { applicationId: id });
          }}
        />
      )}
    </>
  );
}
