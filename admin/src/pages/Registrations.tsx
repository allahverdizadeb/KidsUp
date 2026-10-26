import { useEffect, useState } from 'react';
import { exportApplications, searchApplications } from '../api/applications.ts';
import { listCourses } from '../api/courses.ts';
import type { ApplicationFilter, ApplicationSummary } from '../api/types.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Icon } from '../components/ui/Icon.tsx';
import { LoadError, Loading } from '../components/ui/Feedback.tsx';
import { ConfirmDialog } from '../components/ui/Modal.tsx';
import { useAsync } from '../hooks/useAsync.ts';
import { useDebounced } from '../hooks/useDebounced.ts';
import { useWidth } from '../hooks/useWidth.ts';
import { saveBlob } from '../lib/download.ts';
import { describe } from '../lib/errors.ts';
import { ICON } from '../lib/icons.ts';
import { sx } from '../lib/sx.ts';
import { useDrawer } from '../state/useDrawer.ts';
import { useLive } from '../state/useLive.ts';
import { useNav } from '../state/useNav.ts';
import { useSession } from '../state/useSession.ts';
import { useToast } from '../state/useToast.ts';
import FilterBar from './registrations/FilterBar.tsx';
import type { StatusFilter } from './registrations/FilterBar.tsx';
import ResultList from './registrations/ResultList.tsx';

const PAGE_SIZE = 25;

/** The applications that came from the landing page's form: search, filter, open, change, export. */
export default function Registrations() {
  const width = useWidth();
  const { intent } = useNav();
  const drawer = useDrawer();
  const { can } = useSession();
  const { toast } = useToast();
  const { tick } = useLive();

  const [query, setQuery] = useState('');
  // A page that sent us here (a figure of the dashboard, a person in a course) can ask for a filter or an application;
  // App gives this page a new key for every such request, so it starts from the request.
  const [status, setStatus] = useState<StatusFilter>(intent?.status ?? 'all');
  const [courseId, setCourseId] = useState('all');
  const [more, setMore] = useState<{ after: unknown; items: ApplicationSummary[] }>({
    after: null,
    items: [],
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmingExport, setConfirmingExport] = useState(false);
  const search = useDebounced(query.trim(), 300);

  const wantedApplication = intent?.applicationId;
  const openApplication = drawer.open;
  useEffect(() => {
    if (wantedApplication) openApplication(wantedApplication);
  }, [wantedApplication, openApplication]);

  const filter: ApplicationFilter = {
    search: search || null,
    statuses: status === 'all' ? [] : [status],
    course_id: courseId === 'all' ? null : courseId,
  };
  const filterKey = JSON.stringify(filter);

  // The answer says which filter it belongs to: while the next one is on its way the old list stays, and a failure of
  // the next one is shown as a failure and not as the old list.
  // A reload that only `tick` asked for (the news changed) is a background request: it does not keep an idle session alive.
  const first = useAsync(
    async (background) => ({
      key: filterKey,
      page: await searchApplications(
        { ...filter, sort: 'newest', limit: PAGE_SIZE, offset: 0 },
        { background },
      ),
    }),
    filterKey,
    tick,
  );
  const courses = useAsync((background) => listCourses({ background }).then((page) => page.items), '', tick);
  const shown = first.data?.page ?? null;
  const failed = first.error !== null && first.data?.key !== filterKey;

  // What was loaded beyond the first page belongs to that first page: when it is loaded again, the rest is dropped.
  const further = more.after === first.data ? more.items : [];
  const rows = [...(shown?.items ?? []), ...further];
  const total = shown?.total ?? 0;

  // The chips count over the chosen course; the counts come from the courses (no personal data is read for them).
  const scope = courses.data?.filter((course) => courseId === 'all' || course.id === courseId) ?? null;
  const counts = scope
    ? scope.reduce(
        (sum, course) => ({
          new: sum.new + course.seats.applications.new,
          contacted: sum.contacted + course.seats.applications.contacted,
          approved: sum.approved + course.seats.applications.approved,
          declined: sum.declined + course.seats.applications.declined,
        }),
        { new: 0, contacted: 0, approved: 0, declined: 0 },
      )
    : null;
  const everything = counts ? counts.new + counts.contacted + counts.approved + counts.declined : null;
  const filtering = status !== 'all' || search !== '';

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await searchApplications({
        ...filter,
        sort: 'newest',
        limit: PAGE_SIZE,
        offset: rows.length,
      });
      setMore({ after: first.data, items: [...further, ...page.items] });
    } catch (error) {
      const problem = describe(error);
      toast('error', problem.title, problem.sub);
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await exportApplications(filter);
      saveBlob(blob, filename);
      toast(
        'ok',
        'CSV yükləndi',
        'Fayldakı məlumatlar ailələrə aiddir: onu yalnız lazım olan müddətə saxlayın.',
      );
    } catch (error) {
      const problem = describe(error);
      toast('error', problem.title, problem.sub);
    } finally {
      setExporting(false);
      setConfirmingExport(false);
    }
  };

  const reset = () => {
    setQuery('');
    setStatus('all');
  };

  const count =
    everything !== null && (filtering || courseId !== 'all')
      ? `${everything} müraciətdən ${total} tapıldı`
      : `${total} müraciət`;

  return (
    <>
      <PageHeader
        title="Qeydiyyatlar"
        sub="Saytdakı formadan gələn valideyn müraciətləri. Yeni müraciətlər avtomatik “Yeni” statusu ilə və saytda aktiv olan kursa bağlı şəkildə görünür."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'kaFade .25s ease' }}>
        <FilterBar
          query={query}
          onQuery={setQuery}
          status={status}
          onStatus={setStatus}
          counts={counts}
          courses={courses.data ?? []}
          courseId={courseId}
          onCourse={setCourseId}
          exporter={
            can('applications:export')
              ? { onExport: () => setConfirmingExport(true), busy: exporting }
              : undefined
          }
        />

        <Card soft style={{ overflow: 'hidden' }}>
          {failed ? (
            <LoadError error={first.error} onRetry={first.reload} />
          ) : !shown ? (
            <Loading />
          ) : rows.length === 0 ? (
            <div
              style={{
                padding: '56px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: '#F3F3F4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon d={ICON.search} size={22} stroke="#767676" strokeWidth={2} />
              </span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>
                {filtering || courseId !== 'all' ? 'Müraciət tapılmadı' : 'Hələ müraciət yoxdur'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#6B6B6B' }}>
                {filtering || courseId !== 'all'
                  ? 'Axtarış sözünü və ya status filtrini dəyişin.'
                  : 'Saytdakı formadan göndərilən müraciətlər burada görünəcək.'}
              </span>
              {(filtering || courseId !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setCourseId('all');
                  }}
                  {...sx(
                    {
                      marginTop: 6,
                      height: 36,
                      padding: '0 14px',
                      border: '1px solid #E3E3E3',
                      borderRadius: 10,
                      background: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 700,
                    },
                    { background: '#F7F7F8' },
                  )}
                >
                  Filtrləri sıfırla
                </button>
              )}
            </div>
          ) : (
            <ResultList rows={rows} wide={width >= 1024} selectedId={drawer.openId} onOpen={drawer.open} />
          )}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #F0F0F0',
              background: '#FAFAFA',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              fontSize: 12,
              fontWeight: 700,
              color: '#6B6B6B',
            }}
          >
            <span aria-live="polite">
              {shown ? count : ''}
              {shown && rows.length < total ? ` · ${rows.length} göstərilir` : ''}
            </span>
            {rows.length < total && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                {...sx(
                  {
                    height: 32,
                    padding: '0 14px',
                    border: '1px solid #E3E3E3',
                    borderRadius: 10,
                    background: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#1A1A1A',
                    opacity: loadingMore ? 0.6 : 1,
                  },
                  { background: '#F7F7F8' },
                )}
              >
                {loadingMore ? 'Yüklənir…' : 'Daha çox göstər'}
              </button>
            )}
          </div>
        </Card>
      </div>
      {confirmingExport && (
        <ConfirmDialog
          tone="careful"
          title="CSV faylı yüklənsin?"
          text={`${first.data?.key === filterKey ? `${total} müraciətin` : 'Seçilmiş müraciətlərin'} məlumatları (valideynlərin və uşaqların adları, telefon nömrələri, uşaqların doğum tarixləri) kompüterinizə fayl kimi yazılacaq. Bu əməliyyat jurnalda qeyd olunur. Faylı yalnız lazım olan müddətə saxlayın.`}
          confirmLabel="CSV yüklə"
          busy={exporting}
          onConfirm={() => void exportCsv()}
          onCancel={() => setConfirmingExport(false)}
        />
      )}
    </>
  );
}
