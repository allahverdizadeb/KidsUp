import { useEffect, useRef, useState } from 'react';
import { getContent, publish, saveDraft } from '../api/content.ts';
import { listCourses } from '../api/courses.ts';
import { ApiError } from '../api/client.ts';
import type { ContentField, ContentValue } from '../api/types.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { LoadError, Loading } from '../components/ui/Feedback.tsx';
import { useAsync } from '../hooks/useAsync.ts';
import { useFocusFirstFault } from '../hooks/useFocusFirstFault.ts';
import { useWidth } from '../hooks/useWidth.ts';
import { changesToSave, fieldsOf, labelFinder, sectionState } from '../lib/cms.ts';
import { contentRuleMessage, describe } from '../lib/errors.ts';
import { activeCourse } from '../lib/stats.ts';
import { dropEdits, setEdit, useEdits } from '../state/cmsEdits.ts';
import { useToast } from '../state/useToast.ts';
import PreviewDialog from './cms/PreviewDialog.tsx';
import SectionEditor from './cms/SectionEditor.tsx';
import SectionList from './cms/SectionList.tsx';
import { PrimaryButton } from '../components/ui/Buttons.tsx';

const WIDE = 1180;

/** The landing page's texts and pictures: edit a section, save it as a draft, preview it, publish it. */
export default function Cms() {
  const width = useWidth();
  const wide = width >= WIDE;
  const { toast } = useToast();
  const edits = useEdits();
  const content = useAsync(() => getContent());
  const courses = useAsync(() => listCourses().then((page) => page.items));
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editorArea = useRef<HTMLDivElement>(null);
  const askFocusOnFault = useFocusFirstFault(editorArea, errors);

  const data = content.data;
  // On a wide screen the first section is open from the start; on a narrow one the list comes first.
  const activeId = picked ?? (wide ? (data?.sections[0]?.id ?? null) : null);
  const section = data?.sections.find((candidate) => candidate.id === activeId) ?? null;

  const sectionIds = data?.sections.map((candidate) => candidate.id) ?? [];
  const states = new Map(sectionIds.map((id) => [id, sectionState(data ? fieldsOf(data, id) : [], edits)]));
  const waiting = sectionIds.filter((id) => states.get(id)?.dirty || states.get(id)?.pending);
  const anythingUnsaved = [...states.values()].some((state) => state.dirty);

  // Leaving the page with text that was not saved asks first.
  useEffect(() => {
    if (!anythingUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anythingUnsaved]);

  const fail = (error: unknown) => {
    const problem = describe(error, labelFinder(data));
    toast('error', problem.title, problem.sub);
    if (error instanceof ApiError && error.code === 'invalid_content') {
      const key = String(error.body.key ?? '');
      const field = data?.fields.find(
        (candidate) => key === candidate.key || key.startsWith(`${candidate.key}.`),
      );
      if (field) {
        askFocusOnFault();
        setErrors((current) => ({ ...current, [field.key]: contentRuleMessage(error.body.rule) }));
      }
    }
  };

  const edit = (field: ContentField, value: ContentValue) => {
    setEdit(field.key, value);
    setErrors((current) => {
      if (!(field.key in current)) return current;
      const next = { ...current };
      delete next[field.key];
      return next;
    });
  };

  /** Save the changed places of these sections as the draft. True when nothing is left unsaved. */
  const save = async (ids: string[]): Promise<boolean> => {
    if (!data) return false;
    const values = changesToSave(
      data.fields.filter((field) => ids.includes(field.section)),
      edits,
    );
    if (Object.keys(values).length === 0) return true;
    try {
      content.setData(await saveDraft(values));
      dropEdits(Object.keys(values));
      setErrors({});
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  };

  const onSave = async (id: string) => {
    setBusy(true);
    try {
      if (await save([id])) {
        toast(
          'ok',
          'Yadda saxlanıldı',
          'Dəyişikliklər qaralama kimi saxlanıldı. Sayta göndərmək üçün “Dərc et” düyməsini basın.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  /** What the server holds after a change. If this read fails the change is made all the same, and the page says so. */
  const reread = async () => {
    try {
      content.setData(await getContent());
    } catch {
      toast('error', 'Siyahı yenilənmədi', 'Dəyişiklik edildi, lakin ekran köhnə qalıb. Səhifəni yeniləyin.');
    }
  };

  const onPublish = async (id: string) => {
    if (!data) return;
    const state = states.get(id);
    if (!state?.dirty && !state?.pending) {
      toast('ok', 'Dəyişiklik yoxdur', 'Bu bölmə artıq dərc olunub.');
      return;
    }
    setBusy(true);
    try {
      if (!(await save([id]))) return;
      await publish(fieldsOf(data, id).map((field) => field.key));
      toast('ok', 'Dərc olundu', 'Dəyişiklik saytdadır: səhifəni yeniləyən ziyarətçi onu görür.');
      await reread();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const onPublishAll = async () => {
    if (waiting.length === 0) return;
    setBusy(true);
    try {
      if (!(await save(waiting))) return;
      await publish();
      toast(
        'ok',
        `${waiting.length} bölmə dərc olundu`,
        'Dəyişikliklər saytdadır: səhifəni yeniləyən ziyarətçi onları görür.',
      );
      await reread();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const onDiscard = (id: string) => {
    if (!data) return;
    dropEdits(fieldsOf(data, id).map((field) => field.key));
    setErrors({});
    toast('ok', 'Dəyişikliklər ləğv olundu', 'Son yadda saxlanılmış versiya bərpa edildi.');
  };

  return (
    <>
      <PageHeader
        title="Saytın idarə edilməsi"
        sub="Landing səhifənin mətnlərini və şəkillərini kod yazmadan dəyişin. Dəyişiklik “Yadda saxla” ilə qaralama olur, “Dərc et” ilə saytda görünür."
        actions={
          waiting.length > 0 ? (
            <PrimaryButton onClick={() => void onPublishAll()} disabled={busy}>
              Hamısını dərc et
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  padding: '0 6px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,.22)',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {waiting.length}
              </span>
            </PrimaryButton>
          ) : undefined
        }
      />
      {content.error && !data ? (
        <LoadError error={content.error} onRetry={content.reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: wide ? '320px minmax(0,1fr)' : 'minmax(0,1fr)',
            gap: 16,
            alignItems: 'start',
            animation: 'kaFade .25s ease',
          }}
        >
          {(wide || !section) && (
            <SectionList content={data} edits={edits} activeId={activeId} onPick={setPicked} />
          )}
          {section && (
            <div ref={editorArea} style={{ minWidth: 0 }}>
              <SectionEditor
                section={section}
                fields={fieldsOf(data, section.id)}
                edits={edits}
                state={states.get(section.id) ?? { dirty: false, pending: false }}
                publication={data.publication}
                placeholders={data.placeholders}
                errors={errors}
                busy={busy}
                onBack={wide ? undefined : () => setPicked(null)}
                onEdit={edit}
                onSave={() => void onSave(section.id)}
                onPublish={() => void onPublish(section.id)}
                onDiscard={() => onDiscard(section.id)}
                onPreview={() => setPreviewing(true)}
              />
            </div>
          )}
        </div>
      )}
      {previewing && data && (
        <PreviewDialog
          content={data}
          edits={edits}
          activeId={activeId}
          course={courses.data ? activeCourse(courses.data) : null}
          onClose={() => setPreviewing(false)}
        />
      )}
    </>
  );
}
