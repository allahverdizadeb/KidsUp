import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  addNote,
  changeStatus,
  deleteNote,
  eraseApplication,
  getApplication,
} from '../../api/applications.ts';
import { listCourses } from '../../api/courses.ts';
import type { ApplicationStatus, Course } from '../../api/types.ts';
import { CloseButton, ConfirmDialog } from '../../components/ui/Modal.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { LoadError, Loading } from '../../components/ui/Feedback.tsx';
import { Pill } from '../../components/ui/Pill.tsx';
import { useAsync } from '../../hooks/useAsync.ts';
import { useOverlay } from '../../hooks/useOverlay.ts';
import { describe } from '../../lib/errors.ts';
import { formatDate, formatDateTime, formatMoney, shortId, telHref } from '../../lib/format.ts';
import { ICON } from '../../lib/icons.ts';
import { STATUS, STATUS_ORDER } from '../../lib/status.ts';
import { sx } from '../../lib/sx.ts';
import { useLive } from '../../state/useLive.ts';
import { useSession } from '../../state/useSession.ts';
import { useToast } from '../../state/useToast.ts';

function Heading({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        margin: 0,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: '#767676',
      }}
    >
      {children}
    </h3>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: '110px minmax(0,1fr)',
        gap: '10px 14px',
        fontSize: 14,
        margin: 0,
      }}
    >
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'contents' }}>
          <dt style={{ fontWeight: 600, color: '#767676' }}>{label}</dt>
          <dd style={{ fontWeight: 700, margin: 0, overflowWrap: 'anywhere' }}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The side sheet with everything about one application. It slides in from the right, as in the design. */
export default function RegistrationDrawer({
  open,
  id,
  onClose,
  slideMs,
}: {
  open: boolean;
  /** The application whose details are in the sheet; it stays set while the sheet slides out. */
  id: string | null;
  onClose: () => void;
  slideMs: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, ref);

  return (
    <>
      {/* A click outside the sheet closes it; the keyboard has Escape and the sheet's own button. */}
      <div
        data-testid="drawer-scrim"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'rgba(26,26,26,.28)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .25s ease',
        }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Müraciət detalları"
        aria-hidden={!open}
        inert={!open}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 90,
          width: 'min(460px,100vw)',
          background: '#FFFFFF',
          boxShadow: '-16px 0 48px rgba(26,26,26,.12)',
          transform: open ? 'none' : 'translateX(105%)',
          visibility: open ? 'visible' : 'hidden',
          transition: `transform ${slideMs}ms cubic-bezier(.2,.8,.2,1), visibility ${slideMs}ms`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {id && <DrawerBody key={id} id={id} onClose={onClose} />}
      </div>
    </>
  );
}

function DrawerBody({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = useSession();
  const { toast } = useToast();
  const live = useLive();
  const detail = useAsync(() => getApplication(id), id);
  const courses = useAsync(
    (background) => listCourses({ background }).then((page) => page.items),
    '',
    live.tick,
  );
  const [noteDraft, setNoteDraft] = useState('');
  const [working, setWorking] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);

  const application = detail.data;
  const canUpdate = can('applications:update');
  const canErase = can('applications:delete');

  if (detail.error && !application) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ alignSelf: 'flex-end' }}>
          <CloseButton onClick={onClose} />
        </div>
        <LoadError error={detail.error} onRetry={detail.reload} />
      </div>
    );
  }
  if (!application) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <CloseButton onClick={onClose} />
        </div>
        <Loading />
      </div>
    );
  }

  const course = courses.data?.find((candidate) => candidate.id === application.course.id) ?? null;
  const needed = application.children.length;
  const hasRoom = application.status === 'approved' || (course ? course.seats.free_seats >= needed : false);
  const dirty = noteDraft.trim().length > 0;

  const fail = (error: unknown) => {
    const problem = describe(error);
    toast('error', problem.title, problem.sub);
  };

  const pick = async (next: ApplicationStatus) => {
    if (next === application.status || working) return;
    if (next === 'approved' && !hasRoom) {
      toast(
        'error',
        'Təsdiq mümkün deyil',
        `${application.course.title} kursunda kifayət qədər boş yer yoxdur (lazım: ${needed}, boş: ${course?.seats.free_seats ?? 0}).`,
      );
      return;
    }
    setWorking(true);
    const was = application.status;
    try {
      const updated = await changeStatus(application.id, next);
      detail.setData(updated);
      live.refresh();
      // The seats are what the server now says, not what this page guessed. If this read fails, the change is still
      // made: the message just does not name the seats.
      const fresh = await listCourses()
        .then((page) => page.items.find((candidate) => candidate.id === application.course.id))
        .catch(() => undefined);
      // The messages say what happened, never who it happened to: they stay on the screen for a while.
      if (next === 'approved') {
        toast(
          'ok',
          'Qeydiyyat təsdiqləndi',
          `${needed} uşaq kursa əlavə olundu.${fresh ? ` ${fresh.title}: ${fresh.seats.free_seats} boş yer qaldı.` : ''}`,
        );
      } else if (was === 'approved') {
        toast('ok', `Status: ${STATUS[next].label}`, `Təsdiq ləğv olundu, kursda ${needed} yer boşaldı.`);
      } else {
        toast('ok', 'Status yeniləndi', STATUS[next].label);
      }
    } catch (error) {
      fail(error);
    } finally {
      setWorking(false);
    }
  };

  const saveNote = async () => {
    const body = noteDraft.trim();
    if (!body || working) return;
    setWorking(true);
    try {
      const note = await addNote(application.id, body);
      detail.setData(
        (current) =>
          current && {
            ...current,
            notes: [...current.notes, note],
            notes_count: current.notes_count + 1,
          },
      );
      setNoteDraft('');
      live.refresh();
      toast('ok', 'Qeyd yadda saxlanıldı');
    } catch (error) {
      fail(error);
    } finally {
      setWorking(false);
    }
  };

  const removeNote = async (noteId: string) => {
    if (working) return;
    setWorking(true);
    try {
      await deleteNote(application.id, noteId);
      detail.setData(
        (current) =>
          current && {
            ...current,
            notes: current.notes.filter((note) => note.id !== noteId),
            notes_count: Math.max(0, current.notes_count - 1),
          },
      );
      live.refresh();
      toast('ok', 'Qeyd silindi');
    } catch (error) {
      fail(error);
    } finally {
      setWorking(false);
    }
  };

  const erase = async () => {
    setWorking(true);
    try {
      await eraseApplication(application.id);
      setConfirmErase(false);
      onClose();
      live.refresh();
      toast('ok', 'Müraciət silindi', application.status === 'approved' ? 'Kursda yerlər boşaldı.' : '');
    } catch (error) {
      setConfirmErase(false);
      fail(error);
    } finally {
      setWorking(false);
    }
  };

  const look = STATUS[application.status];
  const lockedByRole = application.status === 'approved' && !canErase;

  return (
    <>
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid #F0F0F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#767676' }}>
            Müraciət {shortId(application.id)} · {formatDateTime(application.created_at)}
          </span>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {application.parent_name}
          </h2>
          <span style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <Pill look={look} />
          </span>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
        }}
      >
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Heading>Valideyn</Heading>
          <Facts
            rows={[
              ['Ad, soyad', application.parent_name],
              ['Telefon', application.phone],
              ['Təlim dili', application.languages.join(', ') || '—'],
            ]}
          />
          <a
            href={telHref(application.phone)}
            {...sx(
              {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 44,
                borderRadius: 10,
                background: '#FF0083',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 800,
                transition: 'background .15s',
              },
              { background: '#E00073', color: '#FFFFFF' },
            )}
          >
            <Icon d={ICON.phone} size={16} strokeWidth={2} />
            Zəng et
          </a>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Heading>{application.children.length > 1 ? 'Uşaqlar' : 'Uşaq'}</Heading>
          {application.children.map((child, index) => (
            <div key={`${child.name}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Facts
                rows={[
                  ['Ad, soyad', child.name],
                  ['Yaş', `${child.age_at_course_start} yaş`],
                  ['Doğum tarixi', formatDate(child.birth_date)],
                ]}
              />
              {!child.within_age_range && (
                <span
                  role="note"
                  style={{
                    alignSelf: 'flex-start',
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: '#FFF4E2',
                    color: '#8F5400',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Kursun yaş həddindən kənardır
                </span>
              )}
            </div>
          ))}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Heading>Seçilmiş kurs</Heading>
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: '#FAFAFA',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}
            >
              <span style={{ fontSize: 15, fontWeight: 800 }}>{application.course.title}</span>
              {course && <SeatsText course={course} />}
            </div>
            {course && (
              <>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#6B6B6B' }}>
                  {course.schedule} · {formatMoney(course.price_minor)} AZN
                </span>
                <div style={{ height: 6, borderRadius: 999, background: '#ECECEC', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, (course.seats.approved_children / course.capacity) * 100)}%`,
                      background: course.seats.free_seats ? '#FF0083' : '#1A1A1A',
                      borderRadius: 999,
                      transition: 'width .4s ease',
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Heading>Status</Heading>
          <div
            role="group"
            aria-label="Status"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}
          >
            {STATUS_ORDER.map((key) => {
              const option = STATUS[key];
              const on = application.status === key;
              const blocked = key === 'approved' && !on && !hasRoom;
              const unavailable = !canUpdate || (lockedByRole && !on);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => void pick(key)}
                  aria-pressed={on}
                  aria-disabled={blocked || undefined}
                  disabled={unavailable}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 4,
                    minHeight: 52,
                    padding: '10px 12px',
                    border: `1.5px solid ${on ? option.dot : '#E3E3E3'}`,
                    borderRadius: 10,
                    background: on ? option.bg : '#FFFFFF',
                    color: on ? option.fg : '#1A1A1A',
                    textAlign: 'left',
                    transition: 'background .15s, border-color .15s',
                  }}
                >
                  {/* Only the name is dimmed when the status cannot be chosen: the reason stays readable. */}
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 800,
                      opacity: blocked || unavailable ? 0.55 : 1,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: option.dot }} />
                    {option.label}
                  </span>
                  {blocked && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6B6B6B' }}>
                      {course && course.seats.free_seats > 0 ? 'Kursda yer çatmır' : 'Kursda boş yer yoxdur'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, fontWeight: 600, color: '#6B6B6B' }}>
            {!canUpdate
              ? 'Rolunuz yalnız baxış üçündür: statusu dəyişmək olmur.'
              : lockedByRole
                ? 'Təsdiqlənmiş müraciətin statusunu yalnız admin dəyişə bilər.'
                : 'Yeni → Əlaqə saxlanılıb → Təsdiqlənib və ya İmtina edilib. Təsdiqlənmiş qeydiyyat hər uşaq üçün kursda bir yer tutur.'}
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Heading>Daxili qeyd</Heading>
          {application.notes.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {application.notes.map((note) => (
                <li
                  key={note.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#FAFAFA',
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6B6B6B' }}>
                      {note.author ?? 'Silinmiş hesab'} · {formatDateTime(note.created_at)}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {note.body}
                    </span>
                  </div>
                  {canErase && (
                    <button
                      type="button"
                      onClick={() => void removeNote(note.id)}
                      aria-label="Qeydi sil"
                      {...sx(
                        {
                          width: 32,
                          height: 32,
                          border: 'none',
                          borderRadius: 8,
                          background: 'transparent',
                          color: '#767676',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        },
                        { background: '#FDECEC', color: '#C62828' },
                      )}
                    >
                      <Icon d={ICON.trash} size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canUpdate && (
            <>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={3}
                maxLength={2000}
                spellCheck={false}
                aria-label="Yeni daxili qeyd"
                placeholder="Məsələn: cümə günü yenidən zəng ediləcək"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #E3E3E3',
                  borderRadius: 10,
                  background: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  resize: 'vertical',
                }}
              />
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>
                  Yalnız panel işçiləri görür
                </span>
                <button
                  type="button"
                  onClick={() => void saveNote()}
                  disabled={!dirty || working}
                  style={{
                    height: 34,
                    padding: '0 14px',
                    border: 'none',
                    borderRadius: 9,
                    background: dirty ? '#1A1A1A' : '#EFEFEF',
                    color: dirty ? '#FFFFFF' : '#767676',
                    fontSize: 13,
                    fontWeight: 800,
                    transition: 'background .15s',
                  }}
                >
                  Qeydi saxla
                </button>
              </div>
            </>
          )}
        </section>

        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, fontWeight: 600, color: '#6B6B6B' }}>
          {application.consent_given_at
            ? `Valideyn razılığı: ${formatDateTime(application.consent_given_at)}${application.privacy_notice_version ? ` · bildiriş ${application.privacy_notice_version}` : ''}.`
            : 'Razılıq qeydi yoxdur (bildirişdən əvvəlki müraciət).'}
        </p>
      </div>

      {canErase && (
        <div style={{ padding: '14px 24px', borderTop: '1px solid #F0F0F0' }}>
          <button
            type="button"
            onClick={() => setConfirmErase(true)}
            {...sx(
              {
                height: 40,
                padding: '0 12px',
                marginLeft: -12,
                border: 'none',
                borderRadius: 10,
                background: 'transparent',
                color: '#C62828',
                fontSize: 13,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              },
              { background: '#FDECEC' },
            )}
          >
            <Icon d={ICON.trash} size={16} />
            Müraciəti sil
          </button>
        </div>
      )}

      {confirmErase && (
        <ConfirmDialog
          title="Müraciət silinsin?"
          text={`${application.parent_name} (${application.children.map((child) => child.name).join(', ')}) müraciəti birdəfəlik silinəcək. Bu əməliyyatı geri qaytarmaq olmur.`}
          confirmLabel="Bəli, sil"
          busy={working}
          onConfirm={() => void erase()}
          onCancel={() => setConfirmErase(false)}
        />
      )}
    </>
  );
}

function SeatsText({ course }: { course: Course }) {
  const left = course.seats.free_seats;
  return (
    <span
      style={{ fontSize: 12, fontWeight: 800, color: left ? '#D6006E' : '#1A1A1A', whiteSpace: 'nowrap' }}
    >
      {left ? `${left} boş yer` : 'Dolub'} · {course.seats.approved_children}/{course.capacity}
    </span>
  );
}
