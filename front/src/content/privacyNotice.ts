// The privacy notice shown in the application form (SEC-F-16).
//
// DRAFT: legal counsel must approve the wording before launch; the points that need a decision are listed in
// front/docs/privacy-notice-review.md. Whenever the text changes, change PRIVACY_NOTICE_VERSION too (and add the
// new version to PUBLISHED_NOTICE_VERSIONS in back/app/schemas/application.py, which the API is deployed with
// first): the version is stored with every application, so the record says which text the parent agreed to.
// privacyNotice.test.ts fails when the text changes under an unchanged version. Drop the "-draft" suffix only when
// counsel has approved the text.
export const PRIVACY_NOTICE_VERSION = '2026-10-19-draft';

// The address fragment the footer link points at; the notice opens when the page is at it.
export const PRIVACY_NOTICE_ANCHOR = 'mexfilik';

export const CONSENT_LABEL =
  'Valideyn (qanuni nümayəndə) kimi öz məlumatlarımın və uşağımın (uşaqlarımın) məlumatlarının Məxfilik bildirişində göstərilən qaydada işlənməsinə razıyam.';

export const PRIVACY_NOTICE: { heading: string; text: string }[] = [
  {
    heading: 'Məlumatları kim idarə edir?',
    text: 'Məlumatları KidsUp proqramının təşkilatçısı (bundan sonra “KidsUp”) toplayır və idarə edir. Əlaqə: +994 50 998 87 07 (zəng və ya WhatsApp).',
  },
  {
    heading: 'Hansı məlumatlar toplanır?',
    text: 'Valideynin adı və əlaqə nömrəsi, uşağın (uşaqların) adı, soyadı və doğum tarixi, üstünlük verilən təlim dili. Ünvan, şəkil, sağlamlıq məlumatı və ya şəxsiyyət sənədi tələb olunmur.',
  },
  {
    heading: 'Nə üçün istifadə olunur?',
    text: 'Yalnız müraciətinizi qeydə almaq, proqram və qeydiyyat şərtləri barədə sizinlə əlaqə saxlamaq üçün. Məlumatlar reklam, analitika və ya satış üçün istifadə edilmir, uşaqlara marketinq göndərilmir, profilləşdirmə aparılmır.',
  },
  {
    heading: 'Hüquqi əsas',
    text: 'Məlumatların işlənməsi sizin razılığınıza əsaslanır. Siz valideyn və ya qanuni nümayəndə kimi həm öz, həm də uşağınızın məlumatlarını təqdim edirsiniz. Razılığı istənilən vaxt geri götürə bilərsiniz.',
  },
  {
    heading: 'Məlumatlara kimlərin çıxışı var?',
    text: 'Yalnız müraciətlərlə işləyən KidsUp komandası. Məlumatlar üçüncü şəxslərə verilmir. Saytı və verilənlər bazasını saxlayan texniki xidmət təchizatçısı məlumatları yalnız bizim tapşırığımızla və təhlükəsizlik tələbləri ilə saxlayır.',
  },
  {
    heading: 'Nə qədər saxlanılır?',
    text: 'Qeydiyyatla nəticələnməyən müraciətlər göndərildiyi gündən ən geci 12 ay sonra avtomatik silinir. Proqrama qəbul olunan ailələrin məlumatları proqram boyunca və qanunvericiliyin tələb etdiyi müddət ərzində saxlanılır.',
  },
  {
    heading: 'Hüquqlarınız',
    text: 'Məlumatlarınıza baxmaq, düzəltdirmək və ya silinməsini tələb etmək, razılığı geri götürmək hüququnuz var. Bunun üçün +994 50 998 87 07 nömrəsinə zəng edin və ya WhatsApp-da yazın. Şəxsiyyətinizi təsdiqlədikdən sonra məlumatlar 30 gün ərzində silinir (ehtiyat nüsxələrdən növbəti dövri təmizləmə zamanı). Pozuntu olduğunu düşünürsünüzsə, səlahiyyətli dövlət orqanına müraciət edə bilərsiniz.',
  },
  {
    heading: 'Saytda texniki məlumatlar',
    text: 'Sayt cookie, izləmə və ya analitika vasitələrindən istifadə etmir və üçüncü tərəflərin resurslarını yükləmir. Sui-istifadədən qorunmaq üçün IP ünvanınız yalnız sorğuların sayını məhdudlaşdırmaq məqsədilə qısa müddət yaddaşda işlənir. Server jurnallarında ünvan qısaldılmış (son hissəsi silinmiş) şəkildə, sorğu parametrləri olmadan yazılır; jurnallar məhdud həcmdə saxlanılır, köhnə qeydlər yeni qeydlərlə əvəz olunur. Ciddi texniki nasazlıq zamanı xəta jurnalına tam ünvan düşə bilər.',
  },
  {
    heading: 'WhatsApp',
    text: 'Forma işləməyəndə və ya istəsəniz, bizə WhatsApp-da yaza bilərsiniz. Saytımız WhatsApp bağlantısına heç bir şəxsi məlumat əlavə etmir. Yazdığınız mesajlar WhatsApp xidmətinin (Meta) öz qaydalarına tabedir.',
  },
  {
    heading: 'Uşaqlar',
    text: 'Formanı yalnız valideyn və ya qanuni nümayəndə doldurmalıdır; uşaqlar formanı özləri doldurmamalıdır.',
  },
];
