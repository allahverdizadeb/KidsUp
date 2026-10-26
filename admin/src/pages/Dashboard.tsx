import { getDashboard } from '../api/dashboard.ts';
import { searchApplications } from '../api/applications.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { LoadError, Loading } from '../components/ui/Feedback.tsx';
import { layoutOf, useWidth } from '../hooks/useWidth.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { activeCourse, flowStats } from '../lib/stats.ts';
import { useDrawer } from '../state/useDrawer.ts';
import { useLive } from '../state/useLive.ts';
import { useNav } from '../state/useNav.ts';
import FlowChart from './dashboard/FlowChart.tsx';
import Hero from './dashboard/Hero.tsx';
import { Kpis, LatestCard, SeatsCard, WaitingCard } from './dashboard/Panels.tsx';

/** The first page: where things stand, computed from the stored applications and courses. */
export default function Dashboard() {
  const width = useWidth();
  const mode = layoutOf(width);
  const { go } = useNav();
  const drawer = useDrawer();
  const { tick } = useLive();
  // `tick` reloads them by themselves when the news changed: those reloads are background requests (see useAsync).
  const overview = useAsync((background) => getDashboard(30, { background }), '', tick);
  // The family that has waited longest comes first: the oldest applications still "new".
  const waiting = useAsync(
    (background) => searchApplications({ statuses: ['new'], sort: 'oldest', limit: 5 }, { background }),
    '',
    tick,
  );

  const dashboard = overview.data;
  const columns = width >= 1100 ? 'minmax(0,1.7fr) minmax(0,1fr)' : 'minmax(0,1fr)';

  return (
    <>
      <PageHeader title="İdarəetmə paneli" sub="Müraciətlər və kurslar üzrə ümumi vəziyyət." />
      {overview.error && !dashboard ? (
        <LoadError error={overview.error} onRetry={overview.reload} />
      ) : !dashboard ? (
        <Loading />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'kaFade .25s ease' }}>
          <Hero
            mode={mode}
            width={width}
            now={dashboard.generated_at}
            newCount={dashboard.totals.by_status.new}
            total={dashboard.totals.applications}
            week={flowStats(dashboard.dynamics).week}
            active={activeCourse(dashboard.courses)}
            onNew={() => go('reg', { status: 'new' })}
            onCourses={() => go('courses')}
          />
          <Kpis
            counts={dashboard.totals.by_status}
            total={dashboard.totals.applications}
            flow={flowStats(dashboard.dynamics)}
            columns={
              width >= 1240
                ? 'repeat(4,minmax(0,1fr))'
                : width >= 480
                  ? 'repeat(2,minmax(0,1fr))'
                  : 'minmax(0,1fr)'
            }
            onOpen={(status) => go('reg', { status })}
          />
          <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 18 }}>
            <FlowChart stats={flowStats(dashboard.dynamics)} mobile={mode === 'mobile'} />
            <WaitingCard
              items={waiting.data?.items ?? null}
              error={waiting.error}
              onRetry={waiting.reload}
              count={dashboard.totals.by_status.new}
              now={dashboard.generated_at}
              onOpen={drawer.open}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 18 }}>
            <LatestCard
              items={dashboard.latest_applications}
              now={dashboard.generated_at}
              wide={width >= 820}
              onOpen={drawer.open}
              onAll={() => go('reg')}
            />
            <SeatsCard courses={dashboard.courses} onCourses={() => go('courses')} />
          </div>
        </div>
      )}
    </>
  );
}
