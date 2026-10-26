import { Fragment, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Content, ContentField, ContentValue, Course, ItemValue } from '../../api/types.ts';
import { CloseButton, Modal } from '../../components/ui/Modal.tsx';
import { fieldsOf, shownValue, uploadedPicture } from '../../lib/cms.ts';
import type { Edits } from '../../lib/cms.ts';
import { fillPlaceholders, placeholderValues } from '../../lib/placeholders.ts';

interface PreviewProps {
  content: Content;
  edits: Edits;
  /** The section being edited: outlined, and scrolled into view. */
  activeId: string | null;
  /** The course the page will show figures from. */
  course: Course | null;
  onClose: () => void;
}

const PAD = 'clamp(16px,4vw,40px)';

/** **bold** marks bold text in the page's paragraphs. */
function Bold({ text }: { text: string }) {
  return (
    <>
      {text
        .split('**')
        .map((part, index) =>
          index % 2 ? <b key={index}>{part}</b> : <Fragment key={index}>{part}</Fragment>,
        )}
    </>
  );
}

/**
 * What a place will look like on the page, in the colours and type of the page. This is a faithful reading of the
 * texts, not a copy of the page's layout: it shows the words and pictures as they will be, section by section.
 */
function Rendered({
  field,
  value,
  fill,
}: {
  field: ContentField;
  value: ContentValue;
  fill: (text: string) => string;
}) {
  if (field.kind === 'image') {
    const picture = typeof value === 'string' ? uploadedPicture(value) : null;
    return (
      <div
        style={{
          width: 'min(100%,320px)',
          aspectRatio: '4/3',
          borderRadius: 8,
          background: '#F6F6F6',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {picture ? (
          <div
            role="img"
            aria-label={field.label}
            style={{
              width: '100%',
              height: '100%',
              backgroundImage: `url("/media/${picture}.webp")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6B6B6B', padding: 8, textAlign: 'center' }}>
            {field.label} · saytın öz şəkli
          </span>
        )}
      </div>
    );
  }
  if (typeof value === 'string') {
    return field.kind === 'paragraph' ? (
      <p
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.6,
          color: '#4A4A4A',
          maxWidth: 720,
          whiteSpace: 'pre-line',
        }}
      >
        <Bold text={fill(value)} />
      </p>
    ) : (
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{fill(value)}</p>
    );
  }
  if (Array.isArray(value) && field.kind === 'strings') {
    return (
      <ul
        style={{
          margin: 0,
          paddingLeft: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 15,
          lineHeight: 1.5,
        }}
      >
        {(value as string[]).map((line, index) => (
          <li key={index}>{fill(line)}</li>
        ))}
      </ul>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))',
          gap: 12,
        }}
      >
        {(value as ItemValue[]).map((item, index) => (
          <div
            key={index}
            style={{
              border: '1px solid #EAEAEA',
              borderRadius: 6,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {field.item.map((part, at) => {
              const text = item[part.name];
              if (Array.isArray(text)) {
                return (
                  <ul key={part.name} style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: '#4A4A4A' }}>
                    {text.map((line, lineAt) => (
                      <li key={lineAt}>{fill(line)}</li>
                    ))}
                  </ul>
                );
              }
              return at === 0 || part.kind === 'text' ? (
                <span
                  key={part.name}
                  style={{
                    fontWeight: at === 0 ? 800 : 700,
                    fontSize: at === 0 ? 13 : 16,
                    color: at === 0 ? '#FF0083' : '#1A1A1A',
                  }}
                >
                  {fill(text ?? '')}
                </span>
              ) : (
                <span key={part.name} style={{ fontSize: 14, lineHeight: 1.5, color: '#4A4A4A' }}>
                  <Bold text={fill(text ?? '')} />
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function Block({
  id,
  active,
  children,
  tinted = false,
}: {
  id: string;
  active: boolean;
  children: ReactNode;
  tinted?: boolean;
}) {
  return (
    <div
      id={`pv-${id}`}
      style={{
        outline: active ? '2px dashed #FF0083' : '2px solid transparent',
        outlineOffset: -6,
        background: tinted ? '#F6F6F6' : '#FFFFFF',
        padding: `40px ${PAD}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {children}
    </div>
  );
}

/** The page as it will read once published: every section's texts and pictures, the one being edited outlined. */
export default function PreviewDialog({ content, edits, activeId, course, onClose }: PreviewProps) {
  const box = useRef<HTMLDivElement>(null);
  const values = placeholderValues(course);
  const fill = (text: string) => fillPlaceholders(text, values);
  const valueOf = (key: string): string => {
    const field = content.fields.find((candidate) => candidate.key === key);
    const value = field ? shownValue(field, edits) : '';
    return typeof value === 'string' ? fill(value) : '';
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const target = activeId ? document.getElementById(`pv-${activeId}`) : null;
      if (box.current && target) box.current.scrollTop = Math.max(0, target.offsetTop - 24);
    }, 80);
    return () => clearTimeout(timer);
  }, [activeId]);

  return (
    <Modal
      label="Saytın önizləməsi"
      width={1100}
      layer={130}
      dim={0.5}
      onClose={onClose}
      frame={{
        height: 'calc(100vh - 32px)',
        maxHeight: 860,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,.3)',
      }}
    >
      <div
        style={{
          height: 52,
          flexShrink: 0,
          background: '#F3F3F4',
          borderBottom: '1px solid #E6E6E6',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 14px',
        }}
      >
        <span aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map((dot) => (
            <span key={dot} style={{ width: 10, height: 10, borderRadius: '50%', background: '#D6D6D6' }} />
          ))}
        </span>
        <span
          style={{
            flex: 1,
            maxWidth: 340,
            height: 30,
            borderRadius: 8,
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            fontSize: 12,
            fontWeight: 600,
            color: '#6B6B6B',
          }}
        >
          kidsup.az
        </span>
        <span
          style={{
            padding: '5px 10px',
            borderRadius: 999,
            background: '#FFF0F7',
            color: '#C2006A',
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          Önizləmə · dərc olunmayıb
        </span>
        <span style={{ flex: 1 }} />
        <CloseButton onClick={onClose} label="Önizləməni bağla" />
      </div>

      <div ref={box} style={{ position: 'relative', flex: 1, overflowY: 'auto', background: '#FFFFFF' }}>
        <div
          style={{
            height: 64,
            borderBottom: '1px solid #EAEAEA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `0 ${PAD}`,
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em' }}>
            Kids<span style={{ color: '#FF0083' }}>Up</span>
          </span>
          <span
            style={{
              padding: '10px 18px',
              borderRadius: 6,
              background: '#FF0083',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {valueOf('hero.primary_cta')}
          </span>
        </div>

        {content.sections.map((section, index) => {
          const fields = fieldsOf(content, section.id);
          const active = activeId === section.id;
          if (section.id === 'hero') {
            return (
              <div
                key={section.id}
                id="pv-hero"
                style={{
                  outline: active ? '2px dashed #FF0083' : '2px solid transparent',
                  outlineOffset: -6,
                  padding: `64px ${PAD} 40px`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 22,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    maxWidth: 820,
                    fontWeight: 800,
                    fontSize: 'clamp(34px,5.4vw,64px)',
                    lineHeight: 1,
                    letterSpacing: '-0.045em',
                    textWrap: 'balance',
                  }}
                >
                  {valueOf('hero.title_first')}
                  <br />
                  {valueOf('hero.title_lead')}{' '}
                  <span style={{ color: '#FF0083' }}>{valueOf('hero.title_accent')}</span>
                </h2>
                <p
                  style={{
                    margin: 0,
                    maxWidth: 620,
                    fontSize: 17,
                    lineHeight: 1.55,
                    color: '#4A4A4A',
                    textWrap: 'pretty',
                  }}
                >
                  {valueOf('hero.subtitle')}
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 22,
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      padding: '16px 30px',
                      borderRadius: 6,
                      background: '#FF0083',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: 16,
                    }}
                  >
                    {valueOf('hero.primary_cta')}
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                      borderBottom: '2px solid #FF0083',
                      paddingBottom: 3,
                    }}
                  >
                    {valueOf('hero.secondary_cta')}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#6B6B6B' }}>
                  {valueOf('hero.duration')}
                </span>
              </div>
            );
          }
          return (
            <Block key={section.id} id={section.id} active={active} tinted={index % 2 === 1}>
              <h2 style={{ margin: 0, fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em' }}>
                {section.label}
              </h2>
              {fields.map((field) => (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: '#6B6B6B',
                    }}
                  >
                    {field.label}
                  </span>
                  <Rendered field={field} value={shownValue(field, edits)} fill={fill} />
                </div>
              ))}
            </Block>
          );
        })}
      </div>
    </Modal>
  );
}
