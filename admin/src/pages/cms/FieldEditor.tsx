import { useId } from 'react';
import type { ReactNode } from 'react';
import type { ContentField, ContentValue, ItemField, ItemValue } from '../../api/types.ts';
import { Icon } from '../../components/ui/Icon.tsx';
import { blankItem, sameValue } from '../../lib/cms.ts';
import { ICON } from '../../lib/icons.ts';
import { inputStyle, textareaStyle } from '../../lib/styles.ts';
import { sx } from '../../lib/sx.ts';
import ImagePicker from './ImagePicker.tsx';

interface FieldEditorProps {
  field: ContentField;
  value: ContentValue;
  onChange: (value: ContentValue) => void;
  /** The API's refusal of this place, in words. */
  error?: string;
}

const INPUT_MODE: Partial<Record<ContentField['kind'], 'tel' | 'numeric' | 'url'>> = {
  phone: 'tel',
  digits: 'numeric',
  link: 'url',
};

function RemoveButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      {...sx(
        {
          width: 36,
          height: 36,
          border: 'none',
          borderRadius: 8,
          background: 'transparent',
          color: disabled ? '#D0D0D0' : '#767676',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        { background: '#FDECEC', color: '#C62828' },
      )}
    >
      <Icon d={ICON.trash} size={16} />
    </button>
  );
}

function AddButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...sx(
        {
          alignSelf: 'flex-start',
          height: 36,
          padding: '0 12px',
          border: '1px dashed #D6D6D6',
          borderRadius: 10,
          background: '#FFFFFF',
          fontSize: 13,
          fontWeight: 700,
          color: '#4A4A4A',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color .15s, color .15s',
        },
        { borderColor: '#FF0083', color: '#D6006E' },
      )}
    >
      <Icon d={ICON.plus} size={14} strokeWidth={2.4} />
      {label}
    </button>
  );
}

/** Marks the first box of a place the API refused, and ties the message to it. */
type Fault = { 'aria-invalid': true; 'aria-describedby': string };

/** A list of short lines: one box each, a number, a bin; the number of lines is bounded by the place. */
function Lines({
  label,
  lines,
  min,
  max,
  maxLength,
  fault,
  onChange,
}: {
  label: string;
  lines: string[];
  min: number;
  max: number | null;
  maxLength: number | null;
  fault?: Fault;
  onChange: (lines: string[]) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lines.map((line, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: '#F3F3F4',
              fontSize: 12,
              fontWeight: 800,
              color: '#6B6B6B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {index + 1}
          </span>
          <input
            {...(index === 0 ? fault : undefined)}
            value={line}
            maxLength={maxLength ?? undefined}
            aria-label={`${label}, ${index + 1}`}
            onChange={(event) =>
              onChange(lines.map((current, at) => (at === index ? event.target.value : current)))
            }
            style={{ ...inputStyle(false), flex: 1, minWidth: 0, height: 42 }}
          />
          <RemoveButton
            label={`${label}, ${index + 1}: sil`}
            disabled={lines.length <= min}
            onClick={() => onChange(lines.filter((_, at) => at !== index))}
          />
        </div>
      ))}
      <AddButton
        label="Sətir əlavə et"
        disabled={max !== null && lines.length >= max}
        onClick={() => onChange([...lines, ''])}
      />
    </div>
  );
}

/** One part of an item (a question, its answer): a line, a paragraph or a list of lines. */
function Part({
  part,
  value,
  fault,
  onChange,
}: {
  part: ItemField;
  value: string | string[];
  fault?: Fault;
  onChange: (value: string | string[]) => void;
}) {
  const id = useId();
  if (part.kind === 'strings' && Array.isArray(value)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#6B6B6B' }}>{part.label}</span>
        <Lines
          label={part.label}
          lines={value}
          min={0}
          max={part.max_items}
          maxLength={part.max_length}
          fault={fault}
          onChange={onChange}
        />
      </div>
    );
  }
  const text = typeof value === 'string' ? value : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 12, fontWeight: 800, color: '#6B6B6B' }}>
        {part.label}
      </label>
      {part.kind === 'paragraph' ? (
        <textarea
          {...fault}
          id={id}
          rows={3}
          value={text}
          maxLength={part.max_length}
          onChange={(event) => onChange(event.target.value)}
          style={{ ...textareaStyle(false), fontSize: 14, padding: '10px 14px' }}
        />
      ) : (
        <input
          {...fault}
          id={id}
          value={text}
          maxLength={part.max_length}
          onChange={(event) => onChange(event.target.value)}
          style={{ ...inputStyle(false, 700), height: 42 }}
        />
      )}
    </div>
  );
}

/** The editor of one place of the landing page, by the kind of value it holds. */
export default function FieldEditor({ field, value, onChange, error }: FieldEditorProps) {
  const id = useId();
  const isDefault = sameValue(value, field.default);
  const max = field.max_length;
  // A refused place marks its first box; the message (below the place) is tied to that box.
  const fault: Fault | undefined = error
    ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` }
    : undefined;

  let control: ReactNode;
  if (field.kind === 'image') {
    control = (
      <ImagePicker
        field={field}
        value={typeof value === 'string' ? value : ''}
        isDefault={isDefault}
        onChange={onChange}
        onReset={() => onChange(field.default)}
        error={error}
      />
    );
  } else if (field.kind === 'strings') {
    control = (
      <Lines
        label={field.label}
        lines={Array.isArray(value) ? (value as string[]) : []}
        min={field.min_items}
        max={field.max_items}
        maxLength={max}
        fault={fault}
        onChange={onChange}
      />
    );
  } else if (field.kind === 'list') {
    const items = Array.isArray(value) ? (value as ItemValue[]) : [];
    const canRemove = items.length > field.min_items;
    control = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              border: '1px solid #EDEDED',
              borderRadius: 12,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: '#FCFCFC',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#6B6B6B' }}>Element {index + 1}</span>
              <RemoveButton
                label={`Element ${index + 1}: sil`}
                disabled={!canRemove}
                onClick={() => onChange(items.filter((_, at) => at !== index))}
              />
            </div>
            {field.item.map((part, partIndex) => (
              <Part
                key={part.name}
                part={part}
                fault={index === 0 && partIndex === 0 ? fault : undefined}
                value={item[part.name] ?? ''}
                onChange={(next) =>
                  onChange(
                    items.map((current, at) => (at === index ? { ...current, [part.name]: next } : current)),
                  )
                }
              />
            ))}
          </div>
        ))}
        {(field.max_items === null || items.length < field.max_items) && (
          <AddButton label="Element əlavə et" onClick={() => onChange([...items, blankItem(field)])} />
        )}
      </div>
    );
  } else if (field.kind === 'paragraph') {
    control = (
      <textarea
        id={id}
        rows={4}
        value={typeof value === 'string' ? value : ''}
        maxLength={max ?? undefined}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        style={textareaStyle(!!error)}
      />
    );
  } else {
    control = (
      <input
        id={id}
        value={typeof value === 'string' ? value : ''}
        maxLength={max ?? undefined}
        inputMode={INPUT_MODE[field.kind]}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle(!!error)}
      />
    );
  }

  const text = typeof value === 'string' ? value : '';
  const labelled =
    field.kind === 'text' ||
    field.kind === 'link' ||
    field.kind === 'phone' ||
    field.kind === 'digits' ||
    field.kind === 'paragraph';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        {labelled ? (
          <label htmlFor={id} style={{ fontSize: 13, fontWeight: 800 }}>
            {field.label}
          </label>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 800 }}>{field.label}</span>
        )}
        {!isDefault && field.kind !== 'image' && (
          <button
            type="button"
            onClick={() => onChange(field.default)}
            {...sx(
              {
                border: 'none',
                background: 'transparent',
                padding: '2px 4px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                color: '#6B6B6B',
              },
              { color: '#D6006E' },
            )}
          >
            Standarta qaytar
          </button>
        )}
      </div>
      {control}
      {labelled && max !== null && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: text.length > max ? '#C62828' : '#6B6B6B',
            alignSelf: 'flex-end',
          }}
        >
          {text.length}/{max}
        </span>
      )}
      {error && field.kind !== 'image' && (
        <span id={`${id}-error`} role="alert" style={{ fontSize: 12, fontWeight: 700, color: '#C62828' }}>
          {error}
        </span>
      )}
    </div>
  );
}
