import { searchApplications } from '../../api/applications.ts';
import type { ApplicationStatus, ApplicationSummary, Course } from '../../api/types.ts';
import { LoadError, Loading } from '../../components/ui/Feedback.tsx';
import { CloseButton, Modal } from '../../components/ui/Modal.tsx';
import { Pill } from '../../components/ui/Pill.tsx';
import { useAsync } from '../../hooks/useAsync.ts';
import { STATUS } from '../../lib/status.ts';
import { childAgesText, childNames } from '../../lib/stats.ts';
import { sx } from '../../lib/sx.ts';

const LIMIT = 100;
/** Approved children first, then the ones being talked to, then the new ones, the declined last. */
const ORDER: Record<ApplicationStatus, number> = { approved: 0, contacted: 1, new: 2, declined: 3 };

function byStatus(a: ApplicationSummary, b: ApplicationSummary): number {
  return ORDER[a.status] - ORDER[b.status] || b.created_at.localeCompare(a.created_at);
}

/** Who applied to a course, with the state of each application; a click opens the application. */
export default function ParticipantsModal({
  course,
  onClose,
  onOpenApplication,
}: {
  course: Course;
  onClose: () => void;
  onOpenApplication: (id: string) => void;
}) {
  const people = useAsync(
    () => searchApplications({ course_id: course.id, sort: 'newest', limit: LIMIT }),
    course.id,
  );
  const page = people.data;
  const items = page ? [...page.items].sort(byStatus) : [];

  return (
    <Modal label="İştirakçılar" width={560} frame={{ overflow: 'hidden' }} onClose={onClose}>
      <div
        style={{
          padding: '22px 24px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          borderBottom: '1px solid #F0F0F0',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {course.title}
          </h2>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#6B6B6B' }}>
            {course.seats.approved_children} / {course.capacity} təsdiqlənib · {page ? page.total : '…'}{' '}
            müraciət
          </span>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {people.error && !page ? (
          <LoadError error={people.error} onRetry={people.reload} />
        ) : !page ? (
          <Loading />
        ) : items.length === 0 ? (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 600,
              color: '#6B6B6B',
            }}
          >
            Bu kurs üçün hələ müraciət yoxdur.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpenApplication(item.id)}
                  {...sx(
                    {
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 24px',
                      border: 'none',
                      borderBottom: '1px solid #F4F4F4',
                      background: '#FFFFFF',
                      textAlign: 'left',
                      transition: 'background .12s',
                    },
                    { background: '#FAFAFA' },
                  )}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>
                      {childNames(item)}{' '}
                      <span style={{ fontWeight: 600, color: '#6B6B6B' }}>· {childAgesText(item)}</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>
                      Valideyn: {item.parent_name}
                    </span>
                  </span>
                  <Pill look={STATUS[item.status]} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {page && page.total > LIMIT && (
          <div style={{ padding: '12px 24px', fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>
            İlk {LIMIT} müraciət göstərilir. Hamısı üçün Qeydiyyatlar səhifəsindən istifadə edin.
          </div>
        )}
      </div>
    </Modal>
  );
}
