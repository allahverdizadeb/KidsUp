import type { Content } from '../../api/types.ts';
import { Icon } from '../../components/ui/Icon.tsx';
import { fieldsOf, lookOf, sectionState, sectionSummary } from '../../lib/cms.ts';
import type { Edits } from '../../lib/cms.ts';
import { ICON } from '../../lib/icons.ts';
import { sx } from '../../lib/sx.ts';

/** An icon for each section of the landing page; one the panel does not know yet gets the page icon. */
const SECTION_ICON: Record<string, string> = {
  hero: ICON.layout,
  stats: ICON.grid,
  skills: ICON.star,
  lesson: ICON.clock,
  approach: ICON.rocket,
  modules: ICON.book,
  mini_task: ICON.file,
  sample_project: ICON.image,
  demo_day: ICON.award,
  certificate: ICON.award,
  founder: ICON.user,
  pricing: ICON.tag,
  brochure: ICON.download,
  faq: ICON.help,
  apply: ICON.send,
  contact: ICON.phone,
};

function iconOfSection(id: string): string {
  return SECTION_ICON[id] ?? ICON.site;
}

interface SectionListProps {
  content: Content;
  edits: Edits;
  activeId: string | null;
  onPick: (id: string) => void;
}

/** The sections of the page, each with the state of its text: saved or not, published or waiting. */
export default function SectionList({ content, edits, activeId, onPick }: SectionListProps) {
  return (
    <nav
      aria-label="Sayt bölmələri"
      style={{
        background: '#FFFFFF',
        border: '1px solid #EDEDED',
        borderRadius: 14,
        boxShadow: '0 1px 2px rgba(26,26,26,.04)',
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div
        style={{
          padding: '10px 12px 8px',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: '#6B6B6B',
        }}
      >
        Sayt bölmələri
      </div>
      {content.sections.map((section) => {
        const fields = fieldsOf(content, section.id);
        const look = lookOf(sectionState(fields, edits));
        const on = activeId === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onPick(section.id)}
            aria-current={on ? 'true' : undefined}
            {...sx(
              {
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                borderRadius: 10,
                background: on ? '#FFF0F7' : 'transparent',
                textAlign: 'left',
                transition: 'background .15s',
              },
              { background: on ? '#FFF0F7' : '#F7F7F8' },
            )}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: on ? '#FF0083' : '#F3F3F4',
                color: on ? '#FFFFFF' : '#4A4A4A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background .15s',
              }}
            >
              <Icon d={iconOfSection(section.id)} size={18} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{section.label}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#6B6B6B',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {sectionSummary(fields)}
              </span>
            </span>
            <span
              title={look.label}
              aria-hidden="true"
              style={{ width: 8, height: 8, borderRadius: '50%', background: look.dot, flexShrink: 0 }}
            />
            <span className="sr-only">{look.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
