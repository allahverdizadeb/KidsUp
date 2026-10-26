import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createCourse, updateCourse } from '../../api/courses.ts';
import { ApiError } from '../../api/client.ts';
import type { Course } from '../../api/types.ts';
import { Field } from '../../components/ui/Field.tsx';
import { Modal, ModalHeader } from '../../components/ui/Modal.tsx';
import { SwitchTrack } from '../../components/ui/Pill.tsx';
import { useFocusFirstFault } from '../../hooks/useFocusFirstFault.ts';
import {
  FIELD_OF_API,
  PILOT_PRICE,
  STANDARD_PRICE,
  blankForm,
  changesFor,
  formOf,
  titleFor,
  toInput,
  validate,
  withStart,
} from '../../lib/courseForm.ts';
import type { CourseErrors, CourseForm } from '../../lib/courseForm.ts';
import { describe } from '../../lib/errors.ts';
import { formatMoney, weeksText } from '../../lib/format.ts';
import { sx } from '../../lib/sx.ts';
import { inputStyle } from '../../lib/styles.ts';
import { useToast } from '../../state/useToast.ts';

interface CourseModalProps {
  /** The course being edited, or null for a new one. */
  course: Course | null;
  courses: Course[];
  onClose: () => void;
  onSaved: () => void;
}

const preset = (active: boolean): CSSProperties => ({
  height: 30,
  padding: '0 10px',
  border: `1px solid ${active ? '#FF0083' : '#E3E3E3'}`,
  borderRadius: 999,
  background: active ? '#FFF0F7' : '#FFFFFF',
  fontSize: 12,
  fontWeight: 700,
});

const two: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))',
  gap: 16,
};

/** Create a course or change one: dates, schedule, place, prices, places, and whether the site's form is tied to it. */
export default function CourseModal({ course, courses, onClose, onSaved }: CourseModalProps) {
  const { toast } = useToast();
  const other = courses.find((candidate) => candidate.registration_open && candidate.id !== course?.id);
  const [form, setForm] = useState<CourseForm>(() => (course ? formOf(course) : blankForm(!!other)));
  const [errors, setErrors] = useState<CourseErrors>({});
  const [busy, setBusy] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const askFocusOnFault = useFocusFirstFault(body, errors);
  const approved = course?.seats.approved_children ?? 0;

  const change = (patch: Partial<CourseForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    // A fault goes away as soon as the field it belongs to is touched.
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof CourseForm)[]) delete next[key as keyof CourseErrors];
      return next;
    });
  };

  const chooseStart = (value: string) => {
    setForm((current) => withStart(current, value));
    setErrors((current) => ({ ...current, start: undefined, end: undefined }));
  };

  const save = async () => {
    const found = validate(form, approved);
    if (Object.keys(found).length > 0) {
      askFocusOnFault();
      setErrors(found);
      toast('error', 'Formada xəta var', 'Xəta göstərilən sahələri düzəldin.');
      return;
    }
    setErrors(found);
    setBusy(true);
    try {
      const input = toInput(form, course);
      let saved: Course;
      if (course === null) {
        saved = await createCourse(input);
      } else {
        const changes = changesFor(input, course);
        saved = Object.keys(changes).length > 0 ? await updateCourse(course.id, changes) : course;
      }
      // The site's form is tied to one course: opening this one closes the others, after this one is open.
      const closed: Course[] = [];
      if (form.open) {
        for (const previous of courses.filter((c) => c.registration_open && c.id !== saved.id)) {
          await updateCourse(previous.id, { registration_open: false });
          closed.push(previous);
        }
      }
      if (course === null) {
        toast(
          'ok',
          'Kurs yaradıldı',
          `${saved.title} · ${saved.capacity} yer · ${formatMoney(saved.price_minor)} AZN`,
        );
      } else {
        toast('ok', 'Kurs yeniləndi', `${saved.title}: ${saved.seats.free_seats} boş yer`);
      }
      for (const previous of closed) {
        toast(
          'ok',
          `${previous.title} üçün qeydiyyat bağlandı`,
          'Saytdakı forma yalnız bir aktiv kursa bağlı ola bilər.',
        );
      }
      onSaved();
      onClose();
    } catch (error) {
      const faults: CourseErrors = {};
      if (error instanceof ApiError) {
        for (const name of error.fields) {
          const field = FIELD_OF_API[name];
          if (field) faults[field] = 'Dəyər qəbul olunmadı.';
        }
        if (error.code === 'capacity_below_approved') {
          faults.max = `Bu kursda artıq ${Number(error.body.approved_children ?? approved)} təsdiqlənmiş iştirakçı var.`;
        }
        if (error.code === 'invalid_course') {
          const named = FIELD_OF_API[String(error.body.field ?? '')];
          if (named) faults[named] = 'Tarixləri yoxlayın.';
        }
      }
      if (Object.keys(faults).length > 0) askFocusOnFault();
      setErrors(faults);
      const problem = describe(error);
      toast('error', problem.title, problem.sub);
      // The course may have been saved and a later step failed: show what the server holds now.
      if (error instanceof ApiError && error.status !== 0) onSaved();
    } finally {
      setBusy(false);
    }
  };

  const title = course ? 'Kursu redaktə et' : 'Yeni kurs';
  const free = Math.max(0, (Number(form.max) || 0) - approved);

  return (
    <Modal label={title} width={580} onClose={onClose}>
      <ModalHeader title={title} onClose={onClose} />
      <div ref={body} style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: 14,
            borderRadius: 12,
            background: '#FAFAFA',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6B6B6B' }}>
            Kursun adı (tarixlərdən avtomatik)
          </span>
          <span style={{ fontSize: 16, fontWeight: 800 }}>
            {form.start ? titleFor(form, course) : 'Tarix seçilməyib'}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>
            {weeksText(form.start, form.end || null)}
          </span>
        </div>

        <div style={two}>
          <Field label="Başlanğıc tarixi" error={errors.start}>
            {(control) => (
              <input
                {...control}
                type="date"
                value={form.start}
                onChange={(event) => chooseStart(event.target.value)}
                style={inputStyle(!!errors.start)}
              />
            )}
          </Field>
          <Field label="Bitmə tarixi" error={errors.end} hint={form.end ? undefined : 'Boş qala bilər'}>
            {(control) => (
              <input
                {...control}
                type="date"
                value={form.end}
                onChange={(event) => change({ end: event.target.value })}
                style={inputStyle(!!errors.end)}
              />
            )}
          </Field>
        </div>

        <Field label="Cədvəl" error={errors.schedule}>
          {(control) => (
            <input
              {...control}
              value={form.schedule}
              maxLength={120}
              placeholder="Şənbə, 09:30–13:00"
              onChange={(event) => change({ schedule: event.target.value })}
              style={inputStyle(!!errors.schedule)}
            />
          )}
        </Field>
        <Field label="Məkan" error={errors.location}>
          {(control) => (
            <input
              {...control}
              value={form.location}
              maxLength={200}
              placeholder="Bakı"
              onChange={(event) => change({ location: event.target.value })}
              style={inputStyle(!!errors.location)}
            />
          )}
        </Field>

        <div style={two}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Field label="Kursun qiyməti (AZN)" error={errors.price}>
              {(control) => (
                <input
                  {...control}
                  inputMode="decimal"
                  value={form.price}
                  onChange={(event) => change({ price: event.target.value })}
                  style={inputStyle(!!errors.price, 700)}
                />
              )}
            </Field>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => change({ price: String(STANDARD_PRICE) })}
                aria-pressed={form.price === String(STANDARD_PRICE)}
                style={preset(form.price === String(STANDARD_PRICE))}
              >
                Standart · {STANDARD_PRICE}
              </button>
              <button
                type="button"
                onClick={() => change({ price: String(PILOT_PRICE) })}
                aria-pressed={form.price === String(PILOT_PRICE)}
                style={preset(form.price === String(PILOT_PRICE))}
              >
                Pilot · {PILOT_PRICE}
              </button>
            </div>
          </div>
          <Field label="İkinci uşaq üçün (AZN)" error={errors.second} hint="Eyni ailədən ikinci uşaq">
            {(control) => (
              <input
                {...control}
                inputMode="decimal"
                value={form.second}
                onChange={(event) => change({ second: event.target.value })}
                style={inputStyle(!!errors.second, 700)}
              />
            )}
          </Field>
        </div>

        <div style={two}>
          <Field
            label="Maksimum iştirakçı"
            error={errors.max}
            hint={
              course
                ? `Hazırda ${approved} təsdiqlənmiş iştirakçı · ${free} boş yer`
                : 'Tövsiyə olunan: 20 uşaq'
            }
          >
            {(control) => (
              <input
                {...control}
                inputMode="numeric"
                value={form.max}
                onChange={(event) => change({ max: event.target.value })}
                style={inputStyle(!!errors.max, 700)}
              />
            )}
          </Field>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={form.open}
          onClick={() => change({ open: !form.open })}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            border: '1px solid #EDEDED',
            borderRadius: 12,
            background: '#FAFAFA',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>Saytda aktiv kurs</span>
            <span style={{ fontSize: 12, lineHeight: 1.45, fontWeight: 600, color: '#6B6B6B' }}>
              {other && form.open
                ? `Saytdakı qeydiyyat formu bu kursa bağlanacaq. Hazırda aktiv olan “${other.title}” avtomatik bağlanacaq.`
                : 'Saytdakı qeydiyyat formu bu kursa bağlanacaq. Eyni anda yalnız bir kurs aktiv ola bilər.'}
            </span>
          </span>
          <SwitchTrack on={form.open} />
        </button>
      </div>

      <div
        style={{
          padding: '16px 24px 22px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          {...sx(
            {
              height: 42,
              padding: '0 16px',
              border: '1px solid #E3E3E3',
              borderRadius: 10,
              background: '#FFFFFF',
              fontSize: 14,
              fontWeight: 700,
            },
            { background: '#F7F7F8' },
          )}
        >
          Ləğv et
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          {...sx(
            {
              height: 42,
              padding: '0 18px',
              border: 'none',
              borderRadius: 10,
              background: '#FF0083',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 800,
              opacity: busy ? 0.7 : 1,
            },
            { background: '#E00073' },
          )}
        >
          {busy ? 'Saxlanılır…' : course ? 'Dəyişiklikləri saxla' : 'Kursu yarat'}
        </button>
      </div>
    </Modal>
  );
}
