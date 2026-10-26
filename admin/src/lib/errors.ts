import { ApiError } from '../api/client.ts';

/** What a person sees when something fails: a short title and one line to act on. No raw server text, no values. */
export interface Problem {
  title: string;
  sub: string;
}

const NETWORK: Problem = {
  title: 'Serverlə əlaqə yoxdur',
  sub: 'İnternet bağlantısını yoxlayın və yenidən cəhd edin.',
};

/** Why a text for the landing page was refused (the API's `rule`). */
const CONTENT_RULES: Record<string, string> = {
  not_text: 'Mətn olmalıdır.',
  hidden_characters: 'Mətndə görünməyən simvol var.',
  too_many_lines: 'Çox sətir var.',
  unbalanced_bold: '** işarələri cüt olmalıdır.',
  one_line_only: 'Bu sahə tək sətirdir.',
  no_bold_here: 'Bu sahədə qalın yazı (**) olmur.',
  empty: 'Boş qala bilməz.',
  too_long: 'Mətn çox uzundur.',
  unknown_placeholder: 'Mətndə tanınmayan {söz} var.',
  bad_link: 'Keçid düzgün deyil (https://…, /yol, #bölmə və ya tel:+…).',
  bad_format: 'Format düzgün deyil.',
  bad_image: 'Şəkil seçimi düzgün deyil.',
  unknown_image: 'Bu şəkil yüklənməyib.',
  missing_image_file: 'Şəkil faylı serverdə yoxdur. Yenidən yükləyin.',
  not_a_list: 'Siyahı olmalıdır.',
  too_many_items: 'Çox element var.',
  too_few_items: 'Elementlər azdır.',
  bad_item: 'Elementin hissələri tam deyil.',
};

/** The words for why a place was refused. */
export function contentRuleMessage(rule: unknown): string {
  return (typeof rule === 'string' ? CONTENT_RULES[rule] : undefined) ?? 'Dəyər bu sahəyə uyğun deyil.';
}

const PICTURE_REASONS: Record<string, string> = {
  unsupported_type: 'Yalnız JPG, PNG və ya WEBP şəkil yükləyin.',
  not_a_picture: 'Fayl şəkil deyil və ya zədələnib.',
  animated: 'Animasiyalı şəkil qəbul olunmur.',
  too_many_pixels: 'Şəkil çox böyükdür (piksel sayı).',
  too_many_pictures: 'Yüklənmiş şəkillərin sayı limitə çatıb.',
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function number(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/** The registry label of the place an error names (`lesson.items.title` belongs to `lesson.items`). */
export type LabelOf = (key: string) => string | undefined;

export function describe(error: unknown, labelOf?: LabelOf): Problem {
  if (!(error instanceof ApiError))
    return { title: 'Gözlənilməz xəta', sub: 'Səhifəni yeniləyib yenidən cəhd edin.' };
  const { status, code, body } = error;
  if (status === 0) return NETWORK;
  switch (code) {
    case 'approval_locked':
      return {
        title: 'Təsdiqi geri götürmək olmur',
        sub: 'Təsdiqlənmiş müraciətin statusunu yalnız admin dəyişə bilər.',
      };
    case 'not_enough_seats':
      return {
        title: 'Təsdiq mümkün deyil',
        sub: `Kursda kifayət qədər boş yer yoxdur (lazım: ${number(body.needed)}, boş: ${number(body.free_seats)}).`,
      };
    case 'application_not_found':
      return { title: 'Müraciət tapılmadı', sub: 'Başqa istifadəçi silmiş ola bilər. Siyahını yeniləyin.' };
    case 'note_not_found':
      return { title: 'Qeyd tapılmadı', sub: 'Başqa istifadəçi silmiş ola bilər.' };
    case 'course_not_found':
      return { title: 'Kurs tapılmadı', sub: 'Siyahını yeniləyin.' };
    case 'media_not_found':
      return { title: 'Şəkil tapılmadı', sub: 'Siyahını yeniləyin.' };
    case 'too_many_notes':
      return {
        title: 'Qeydlərin sayı limitə çatıb',
        sub: `Bir müraciətə ən çox ${number(body.maximum)} qeyd yazıla bilər.`,
      };
    case 'capacity_below_approved':
      return {
        title: 'Yer sayı azdır',
        sub: `Bu kursda artıq ${number(body.approved_children)} təsdiqlənmiş uşaq var.`,
      };
    case 'course_has_applications':
      return { title: 'Kursu silmək olmur', sub: 'Müraciətləri olan kurs silinmir, qeydiyyatı bağlayın.' };
    case 'media_in_use':
      return { title: 'Şəkil istifadədədir', sub: 'Əvvəlcə onu səhifədən götürün və dəyişikliyi dərc edin.' };
    case 'invalid_course':
      return { title: 'Kurs məlumatı düzgün deyil', sub: 'Tarixləri və yaşları yoxlayın.' };
    case 'invalid_content': {
      const label = labelOf?.(text(body.key));
      return {
        title: label ? `“${label}” saxlanmadı` : 'Mətn saxlanmadı',
        sub: contentRuleMessage(body.rule),
      };
    }
    case 'unknown_content_key':
      return { title: 'Sahə tapılmadı', sub: 'Səhifəni yeniləyin.' };
    case 'invalid_image':
      return {
        title: 'Şəkil qəbul olunmadı',
        sub: PICTURE_REASONS[text(body.reason)] ?? 'Yalnız JPG, PNG və ya WEBP şəkil yükləyin.',
      };
    case 'too_many_rows':
      return { title: 'İxrac üçün çox sətir var', sub: 'Filtri daraldın və yenidən cəhd edin.' };
    case 'public_file_failed':
      return { title: 'Sayta yazmaq alınmadı', sub: 'Dəyişiklik saxlanılmadı. Bir azdan yenidən cəhd edin.' };
    case 'confirmation_required':
      return { title: 'Təsdiq lazımdır', sub: 'Silməni təsdiqləyin.' };
    case 'busy':
      return { title: 'Server məşğuldur', sub: 'Bir neçə saniyə sonra yenidən cəhd edin.' };
    default:
      break;
  }
  if (status === 401) return { title: 'Sessiya başa çatıb', sub: 'Yenidən daxil olun.' };
  if (status === 403) return { title: 'İcazə yoxdur', sub: 'Bu əməliyyat sizin rolunuz üçün açıq deyil.' };
  if (status === 413) return { title: 'Fayl çox böyükdür', sub: 'Şəkil 5 MB-dan böyük olmamalıdır.' };
  if (status === 422) return { title: 'Məlumat düzgün deyil', sub: 'Xəta göstərilən sahələri yoxlayın.' };
  if (status === 429) return { title: 'Çox sorğu göndərildi', sub: 'Bir az gözləyin və yenidən cəhd edin.' };
  return { title: 'Server xətası', sub: 'Bir az sonra yenidən cəhd edin.' };
}

/** The one line the sign-in form shows. The API says "wrong" without saying which part (SEC-B-03). */
export function describeSignIn(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Daxil olmaq alınmadı. Yenidən cəhd edin.';
  if (error.status === 0) return NETWORK.sub;
  if (error.status === 429) return 'Çox cəhd edildi. Bir az gözləyib yenidən cəhd edin.';
  if (error.status === 401) return 'E-poçt, şifrə və ya kod yanlışdır.';
  if (error.status === 422) return 'E-poçtu, şifrəni və 6 rəqəmli kodu daxil edin.';
  if (error.status === 403) return 'Bu ünvandan daxil olmaq mümkün deyil.';
  return 'Server cavab vermir. Bir az sonra yenidən cəhd edin.';
}
