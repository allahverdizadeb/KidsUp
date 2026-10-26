import type { ContentField, ContentSection, ContentValue, Publication } from '../../api/types.ts';
import { Icon } from '../../components/ui/Icon.tsx';
import { Pill } from '../../components/ui/Pill.tsx';
import { lookOf, shownValue } from '../../lib/cms.ts';
import type { Edits, SectionState } from '../../lib/cms.ts';
import { formatDateTime } from '../../lib/format.ts';
import { ICON } from '../../lib/icons.ts';
import { sx } from '../../lib/sx.ts';
import { useNav } from '../../state/useNav.ts';
import FieldEditor from './FieldEditor.tsx';

interface SectionEditorProps {
  section: ContentSection;
  fields: ContentField[];
  edits: Edits;
  state: SectionState;
  publication: Publication | null;
  placeholders: string[];
  errors: Record<string, string>;
  busy: boolean;
  /** Present on a narrow screen, where the list and the editor take turns. */
  onBack?: () => void;
  onEdit: (field: ContentField, value: ContentValue) => void;
  onSave: () => void;
  onPublish: () => void;
  onDiscard: () => void;
  onPreview: () => void;
}

/** The texts and pictures of one section, with Save (a draft), Publish (to the site) and Preview. */
export default function SectionEditor({
  section,
  fields,
  edits,
  state,
  publication,
  placeholders,
  errors,
  busy,
  onBack,
  onEdit,
  onSave,
  onPublish,
  onDiscard,
  onPreview,
}: SectionEditorProps) {
  const { go } = useNav();
  const needsPublishing = state.dirty || state.pending;
  const usesPlaceholders = fields.some((field) => JSON.stringify(field.default).includes('{'));

  return (
    <section
      aria-label={section.label}
      style={{
        background: '#FFFFFF',
        border: '1px solid #EDEDED',
        borderRadius: 14,
        boxShadow: '0 1px 2px rgba(26,26,26,.04)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid #F0F0F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Bölmələrə qayıt"
              style={{
                width: 36,
                height: 36,
                border: '1px solid #E3E3E3',
                borderRadius: 10,
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon d={ICON.chevronLeft} size={16} stroke="#1A1A1A" strokeWidth={2.2} />
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {section.label}
            </h2>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Pill look={lookOf(state)} size="sm" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>
                {publication
                  ? `Son dərc: ${formatDateTime(publication.published_at)}`
                  : 'Hələ dərc olunmayıb: sayt öz mətnlərini göstərir'}
              </span>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onPreview}
          {...sx(
            {
              height: 38,
              padding: '0 14px',
              border: '1px solid #E3E3E3',
              borderRadius: 10,
              background: '#FFFFFF',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background .15s',
            },
            { background: '#F7F7F8' },
          )}
        >
          <Icon d={ICON.eye} size={16} strokeWidth={2} />
          Önizlə
        </button>
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {section.id === 'pricing' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              padding: '12px 14px',
              borderRadius: 12,
              background: '#FAFAFA',
              fontSize: 13,
              lineHeight: 1.5,
              fontWeight: 600,
              color: '#4A4A4A',
            }}
          >
            <span>
              Qiymətlərin özü (məsələn 650 AZN, ikinci uşaq üçün 500 AZN) saytda kursun məlumatından
              götürülür, burada yalnız yazılar dəyişir.
            </span>
            <button
              type="button"
              onClick={() => go('courses')}
              {...sx(
                {
                  height: 34,
                  padding: '0 14px',
                  border: '1px solid #E3E3E3',
                  borderRadius: 9,
                  background: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 800,
                },
                { background: '#F7F7F8' },
              )}
            >
              Kurslara keç
            </button>
          </div>
        )}
        {usesPlaceholders && (
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, fontWeight: 600, color: '#6B6B6B' }}>
            Mətndə fiqurlu mötərizədə yazılan sözlər sayta kursun rəqəmləri ilə yazılır:{' '}
            {placeholders.map((name) => `{${name}}`).join(', ')}.
          </p>
        )}
        {fields.map((field) => (
          <FieldEditor
            key={field.key}
            field={field}
            value={shownValue(field, edits)}
            error={errors[field.key]}
            onChange={(value) => onEdit(field, value)}
          />
        ))}
      </div>

      <div
        style={{
          padding: '16px 24px',
          borderTop: '1px solid #F0F0F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          background: '#FCFCFC',
          borderRadius: '0 0 14px 14px',
        }}
      >
        <button
          type="button"
          onClick={onDiscard}
          disabled={!state.dirty || busy}
          style={{
            height: 40,
            padding: '0 4px',
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            fontWeight: 700,
            color: state.dirty ? '#4A4A4A' : '#767676',
          }}
        >
          Dəyişiklikləri ləğv et
        </button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onSave}
            disabled={!state.dirty || busy}
            {...sx(
              {
                height: 40,
                padding: '0 16px',
                border: `1px solid ${state.dirty ? '#1A1A1A' : '#E3E3E3'}`,
                borderRadius: 10,
                background: '#FFFFFF',
                color: state.dirty ? '#1A1A1A' : '#767676',
                fontSize: 14,
                fontWeight: 800,
                transition: 'background .15s',
              },
              { background: '#F7F7F8' },
            )}
          >
            Yadda saxla
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={busy}
            style={{
              height: 40,
              padding: '0 18px',
              border: 'none',
              borderRadius: 10,
              background: needsPublishing ? '#FF0083' : '#F3F3F4',
              color: needsPublishing ? '#FFFFFF' : '#6B6B6B', // the button works even when there is nothing to publish
              fontSize: 14,
              fontWeight: 800,
              transition: 'background .15s',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Gözləyin…' : 'Dərc et'}
          </button>
        </div>
      </div>
    </section>
  );
}
