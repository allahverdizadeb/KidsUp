# Privacy notice: what the owner and legal counsel must confirm

The notice and the consent box are built (`SEC-F-16`), but the **wording is a draft**. It is stored as
`PRIVACY_NOTICE_VERSION = '2026-10-19-draft'` in [`src/content/privacyNotice.ts`](../src/content/privacyNotice.ts), and every application
records that version, so the database says which text each parent agreed to. This page lists everything that is an
assumption. Nothing here is legal advice; counsel decides.

## How it works today

- The form has an unticked box (`components/PrivacyConsent.tsx`): *"Valideyn (qanuni nümayəndə) kimi … Məxfilik bildirişində göstərilən qaydada işlənməsinə razıyam."*
  Without it nothing is sent; the API also refuses an application without `consent: true` (a plain `true`, not `1` or `"true"`).
- The full text opens under the box (*"Məxfilik bildirişini oxu"*) and from the footer link *"Məxfilik bildirişi"* (`#mexfilik`).
- The API stores the time of consent and the notice version next to the application, and accepts only a version that was really shown
  (`PUBLISHED_NOTICE_VERSIONS` in `back/app/schemas/application.py`). Rows older than 2026-10-18 have neither.
- The text cannot change under an unchanged version: `src/content/privacyNotice.test.ts` fails if it does.
- A daily job deletes applications that never led to enrolment (status `new`) after `KIDSUP_RETENTION_DAYS` (365, never more: the notice says
  "ən geci 12 ay"). An operator marks an enrolled family with `docker compose exec retention python -m app.cli mark-enrolled <id>`, and
  erases a family's data on request with `… erase-by-phone` (it lists the matches and asks for their count before deleting).
- The public API cannot read anything it has stored: its database account can only insert.

## To confirm before launch

| # | Notice section / behaviour | What the draft says or assumes | Decision needed | From |
|---|---|---|---|---|
| 1 | *Məlumatları kim idarə edir?* | "KidsUp proqramının təşkilatçısı", contact `+994 50 998 87 07` only | The legal name of the data controller (person or company), registration/tax number, postal address, an e-mail address if there is one | Owner |
| 2 | *Hüquqi əsas* and the consent box | Processing rests on the parent's **consent**, given by ticking a box; the parent speaks for the child as legal representative; consent can be withdrawn | Is an electronic tick enough under the Azerbaijani personal-data law for a **minor's** data (or is a signed/written consent needed)? Is a separate consent for the children's data required? | Counsel |
| 3 | *Hansı məlumatlar toplanır?* | Parent: name, phone. Child: name, birth date. Language preference. Nothing else | Confirm no other data is collected now or planned (photos at events, health or allergy notes, school) | Owner |
| 4 | *Nə üçün istifadə olunur?* | Only to record the application and contact the family; no advertising, analytics, resale, profiling, marketing to children | Confirm there will be no newsletter or later marketing to these contacts | Owner |
| 5 | *Məlumatlara kim çıxış əldə edir?* | Only the KidsUp team that handles applications; an unnamed technical provider hosts the data on KidsUp's instructions | Who exactly has access (roles/names); the hosting provider's name and **country**; whether data leaves Azerbaijan; a processing agreement with the provider | Owner, counsel |
| 6 | *Nə qədər saxlanılır?* | Applications that do not lead to enrolment: deleted **at the latest 12 months** after sending (automatic, only while the status is `new`). Enrolled families: "for the programme and as long as the law requires" | Is 12 months acceptable? The concrete period for enrolled families (an application is marked enrolled by hand with `mark-enrolled` until the admin panel exists) | Owner, counsel |
| 7 | *Hüquqlarınız* | Access, correction, deletion, withdrawal by phone/WhatsApp; identity checked first; deleted within **30 days**, from backups at the next rotation; complaint to "the competent state body" | The real procedure and who answers (what proves who the caller is); whether 30 days is right; the **name of the authority** to complain to; whether to offer an e-mail; where erasures are recorded (the system keeps no register: `back/docs/security-standards.md` §5 entry 6) | Owner, counsel |
| 8 | *Saytda texniki məlumatlar* | No cookies, no tracking, no third-party resources. The IP is kept in memory only for rate limiting. nginx's access log holds the IP **shortened** (last number removed), the path without query strings. Logs are kept by **size** (old lines are overwritten), not for a fixed time. A serious technical failure can put a **full** address into nginx's error log | True for this stack. If a hosting provider or TLS proxy sits in front, **its** logs may hold full IPs and be kept longer: configure it the same way or say so here. Is "old lines are overwritten" enough, or should logs have a fixed age limit? | Owner, whoever deploys |
| 9 | *WhatsApp* | If the form fails the site offers a plain WhatsApp link with **no** personal data; messages the parent writes fall under WhatsApp's (Meta's) rules | Confirm the owner accepts WhatsApp as a contact channel for families' details | Owner |
| 10 | *Uşaqlar* | Only a parent or legal representative fills the form | Confirm | Owner |
| 11 | Language | The notice is in Azerbaijani only | Are Russian and English versions needed (the programme is also taught in them)? | Owner, counsel |
| 12 | Registration duties | Not mentioned | Whether the controller must register or notify an authority before collecting this data, and a breach-notification procedure (see `SECURITY.md`) | Counsel |
| 13 | Rows without consent | Test or early submissions made before 2026-10-18 have no consent record (the local database holds one) | Delete them, or contact the families. Nothing was deleted by the security work | Owner |

## After counsel approves

1. Edit the text in `src/content/privacyNotice.ts` (headings and paragraphs; the label of the box is `CONSENT_LABEL`).
2. Set `PRIVACY_NOTICE_VERSION` to the approval date **without** the `-draft` suffix, for example `'2026-11-02'`.
3. Add that version to `PUBLISHED_NOTICE_VERSIONS` in `back/app/schemas/application.py` and deploy the API first (it rejects a version it does not know), then record the new wording's SHA-256 in `src/content/privacyNotice.test.ts` (the failing test prints it).
4. Run `npm run verify`, rebuild (`docker compose up --build -d`) and look at the form once in a browser.
5. Update the status of `SEC-F-16` in [`security-standards.md`](security-standards.md) and in the root `CLAUDE.md`.
