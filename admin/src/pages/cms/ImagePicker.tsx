import { useId, useState } from 'react';
import type { ChangeEvent } from 'react';
import { uploadPicture } from '../../api/content.ts';
import type { ContentField } from '../../api/types.ts';
import { Icon } from '../../components/ui/Icon.tsx';
import { describe } from '../../lib/errors.ts';
import { ICON } from '../../lib/icons.ts';
import { sx } from '../../lib/sx.ts';
import { uploadedPicture } from '../../lib/cms.ts';
import { useToast } from '../../state/useToast.ts';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

interface ImagePickerProps {
  field: ContentField;
  /** The id of an uploaded picture, or what the page ships with. */
  value: string;
  /** Whether the value is the page's own picture. */
  isDefault: boolean;
  onChange: (id: string) => void;
  onReset: () => void;
  error?: string;
}

/** One picture of the page: what it looks like now, and a way to replace it with an upload or take it back. */
export default function ImagePicker({ field, value, isDefault, onChange, onReset, error }: ImagePickerProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const uploaded = uploadedPicture(value);

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      toast('error', 'Fayl formatı uyğun deyil', 'Yalnız JPG, PNG və ya WEBP şəkil yükləyin.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast('error', 'Şəkil çox böyükdür', 'Maksimum ölçü 5 MB-dır.');
      return;
    }
    setBusy(true);
    try {
      const asset = await uploadPicture(file);
      onChange(asset.id);
      toast('ok', 'Şəkil yükləndi', 'Dəyişikliyi saxlamağı və dərc etməyi unutmayın.');
    } catch (failure) {
      const problem = describe(failure);
      toast('error', problem.title, problem.sub);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
      <div
        style={{
          aspectRatio: '4/3',
          borderRadius: 12,
          border: '1.5px dashed #D6D6D6',
          background: '#FAFAFA',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {uploaded ? (
          <div
            role="img"
            aria-label={field.label}
            style={{
              width: '100%',
              height: '100%',
              backgroundImage: `url("/media/${uploaded}.webp")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ) : (
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              color: '#6B6B6B',
              fontSize: 12,
              fontWeight: 700,
              textAlign: 'center',
              padding: 12,
            }}
          >
            <Icon d={ICON.image} size={22} strokeWidth={1.8} />
            {isDefault ? 'Saytın öz şəkli' : 'Şəkil yoxdur'}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <label
          htmlFor={inputId}
          {...sx(
            {
              height: 34,
              padding: '0 12px',
              border: '1px solid #E3E3E3',
              borderRadius: 9,
              background: '#FFFFFF',
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: busy ? 'progress' : 'pointer',
              opacity: busy ? 0.6 : 1,
              transition: 'background .15s',
            },
            { background: '#F7F7F8' },
          )}
        >
          <Icon d={ICON.upload} size={14} strokeWidth={2} />
          {busy ? 'Yüklənir…' : uploaded ? 'Dəyiş' : 'Şəkil yüklə'}
        </label>
        <input
          id={inputId}
          type="file"
          accept={TYPES.join(',')}
          disabled={busy}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-hint ${inputId}-error` : `${inputId}-hint`}
          onChange={(event) => void choose(event)}
        />
        {!isDefault && (
          <button
            type="button"
            onClick={onReset}
            {...sx(
              {
                height: 34,
                padding: '0 10px',
                border: 'none',
                borderRadius: 9,
                background: 'transparent',
                fontSize: 12,
                fontWeight: 700,
                color: '#6B6B6B',
              },
              { background: '#FDECEC', color: '#C62828' },
            )}
          >
            Standarta qaytar
          </button>
        )}
      </div>
      {/* What is allowed is said before the choice, not only after a wrong one. */}
      <span id={`${inputId}-hint`} style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>
        JPG, PNG və ya WEBP, maksimum 5 MB.
      </span>
      {error && (
        <span
          id={`${inputId}-error`}
          role="alert"
          style={{ fontSize: 12, fontWeight: 700, color: '#C62828' }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
