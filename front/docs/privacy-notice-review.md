# Privacy notice: what counsel approved, and what is still the owner's to do

The notice and the consent box are built (`SEC-F-16`) and were **approved by legal counsel in the current wording** (the owner's report,
2026-10-19). The approved text is `PRIVACY_NOTICE_VERSION = '2026-10-19'` in [`src/content/privacyNotice.ts`](../src/content/privacyNotice.ts),
and every application records that version, so the database says which text each parent agreed to. This page records what that text says and
assumes, so that the next change can be checked against it. Nothing here is legal advice.

## How it works today

- The form has an unticked box (`components/PrivacyConsent.tsx`): *"Valideyn (qanuni nümayəndə) kimi … Məxfilik bildirişində göstərilən qaydada işlənməsinə razıyam."*
  Without it nothing is sent; the API also refuses an application without `consent: true` (a plain `true`, not `1` or `"true"`).
- The full text opens under the box (*"Məxfilik bildirişini oxu"*) and from the footer link *"Məxfilik bildirişi"* (`#mexfilik`).
- The API stores the time of consent and the notice version next to the application, and accepts only a version that was really shown
  (`PUBLISHED_NOTICE_VERSIONS` in `back/app/schemas/application.py`). Rows older than 2026-10-18 have neither.
- The text cannot change under an unchanged version: `src/content/privacyNotice.test.ts` fails if it does.
- A daily job deletes applications that were not approved (status `new`, `contacted` or `declined`) after `KIDSUP_RETENTION_DAYS` (365, never more: the notice
  says "ən geci 12 ay"). Staff approve an application ("Təsdiqlənib") in the admin panel, which keeps it and takes the children's places in the course;
  an approved application stays until it is erased. A family's data is erased on request in the admin panel (`DELETE /api/admin/applications/{id}`, audited)
  or with `docker compose exec retention python -m app.cli erase-by-phone` (it lists the matches and asks for their count before deleting).
- The public API cannot read anything it has stored: its database account can only insert. Staff read applications only through the admin panel's API:
  named accounts with a password and a one-time code, three roles, a short session, and an audit log of who looked at, changed, exported or erased what
  (ids only, never the family's details).

## What the approved text says and assumes

Counsel approved all of these. The right-hand column says who answers it when the text changes again.

| # | Notice section / behaviour | What the text says or assumes | The question behind it | From |
|---|---|---|---|---|
| 1 | *Məlumatları kim idarə edir?* | "KidsUp proqramının təşkilatçısı", contact `+994 50 998 87 07` only | The legal name of the data controller (person or company), registration/tax number, postal address, an e-mail address if there is one | Owner |
| 2 | *Hüquqi əsas* and the consent box | Processing rests on the parent's **consent**, given by ticking a box; the parent speaks for the child as legal representative; consent can be withdrawn | Is an electronic tick enough under the Azerbaijani personal-data law for a **minor's** data (or is a signed/written consent needed)? Is a separate consent for the children's data required? | Counsel |
| 3 | *Hansı məlumatlar toplanır?* | Parent: name, phone. Child: name, birth date. Language preference. Nothing else | Confirm no other data is collected now or planned (photos at events, health or allergy notes, school) | Owner |
| 4 | *Nə üçün istifadə olunur?* | Only to record the application and contact the family; no advertising, analytics, resale, profiling, marketing to children | Confirm there will be no newsletter or later marketing to these contacts | Owner |
| 5 | *Məlumatlara kimlərin çıxışı var?* | Only the KidsUp team that handles applications; an unnamed technical provider hosts the data on KidsUp's instructions | Who exactly has access (each person gets a named account with the least role: `viewer` reads, `coordinator` also works on applications, `admin` also exports and erases); the hosting provider's name and **country**; whether data leaves Azerbaijan; a processing agreement with the provider | Owner, counsel |
| 6 | *Nə qədər saxlanılır?* | Applications that do not lead to enrolment: deleted **at the latest 12 months** after sending (automatic, while the status is `new`, `contacted` or `declined`). Enrolled families (`approved` in the admin panel): "for the programme and as long as the law requires" | Is 12 months acceptable? The concrete period for enrolled families (an approved application is kept until it is erased on request: nothing deletes it by itself) | Owner, counsel |
| 7 | *Hüquqlarınız* | Access, correction, deletion, withdrawal by phone/WhatsApp; identity checked first; deleted within **30 days**, from backups at the next rotation; complaint to "the competent state body" | The real procedure and who answers (what proves who the caller is); whether 30 days is right; the **name of the authority** to complain to; whether to offer an e-mail; where erasures are recorded (the system keeps no register: `back/docs/security-standards.md` §5 entry 6) | Owner, counsel |
| 8 | *Saytda texniki məlumatlar* | No cookies, no tracking, no third-party resources. The IP is kept in memory only for rate limiting. nginx's access log holds the IP **shortened** (last number removed), the path without query strings. Logs are kept by **size** (old lines are overwritten), not for a fixed time. A serious technical failure can put a **full** address into nginx's error log | True for this stack. If a hosting provider or TLS proxy sits in front, **its** logs may hold full IPs and be kept longer: configure it the same way or say so here. Is "old lines are overwritten" enough, or should logs have a fixed age limit? | Owner, whoever deploys |
| 9 | *WhatsApp* | If the form fails the site offers a plain WhatsApp link with **no** personal data; messages the parent writes fall under WhatsApp's (Meta's) rules | Confirm the owner accepts WhatsApp as a contact channel for families' details | Owner |
| 10 | *Uşaqlar* | Only a parent or legal representative fills the form | Confirm | Owner |
| 11 | Language | The notice is in Azerbaijani only | Are Russian and English versions needed (the programme is also taught in them)? | Owner, counsel |
| 12 | Registration duties | Not mentioned | Whether the controller must register or notify an authority before collecting this data, and a breach-notification procedure (see `SECURITY.md`) | Counsel |
| 13 | Rows without consent | Test or early submissions made before 2026-10-18 have no consent record (the local database holds one) | Delete them, or contact the families. Nothing was deleted by the security work or by the admin panel work | Owner |
| 14 | **New since the approval:** what staff record about a family in the admin panel | The notice (row 3) lists what the *parent* gives and says nothing else is collected. Staff can now also record, per application, a **status** (new, contacted, approved, declined) and **internal notes** (free text, up to 2000 characters, shown to every role that can read the application, erased with it); the audit log records which staff member did what, but never the family's details | Does the notice need to say that KidsUp keeps a status and its own notes about each application (and, if notes may hold anything beyond "called on …, will confirm"), or is that covered by "record the application and contact the family"? The notes were asked for by the owner: agree what may go in them (never health, religion, or anything about a child beyond the programme) and tell the staff. **If the notice changes, it needs a new version and counsel's approval (see below)** | Owner, counsel |

## Still the owner's to do (the approval does not do these)

1. **Hosting:** the notice speaks of an unnamed technical provider. Once the host is chosen, make sure its **country** and any transfer of the data out of
   Azerbaijan are what counsel assumed (row 5), and sign a processing agreement with it.
2. **A written procedure** for access, correction and deletion requests: who answers, what proves who the caller is, the 30-day deadline, and a register of what
   was done (the system keeps none: `back/docs/security-standards.md` §5 entry 6).
3. **Logs of a hosting provider or TLS proxy** must be set up like the stack's (row 8), or the notice's statement about logs is no longer true.
4. **The one application from 2026-10-18** has no consent record (row 13): delete it, or ask the family. Nothing was deleted by the security work.
5. **Approving applications:** an application is kept past 12 months only if staff approved it in the admin panel ("Təsdiqlənib", which also takes the children's places in the
   course); the period for enrolled families is the programme's (row 6). Decide who may approve (the `coordinator` and `admin` roles can) and write it down.
6. **Staff notes and statuses (row 14):** ask counsel whether the notice needs a sentence about them, and agree with the staff what a note may contain.

## When the text changes again

1. Have counsel approve the new wording, then edit the text in `src/content/privacyNotice.ts` (headings and paragraphs; the label of the box is `CONSENT_LABEL`).
2. Set `PRIVACY_NOTICE_VERSION` to the approval date, for example `'2026-11-02'`. Applications already stored keep the old version, which still names the text they agreed to.
3. Add that version to `PUBLISHED_NOTICE_VERSIONS` in `back/app/schemas/application.py` and deploy the API first (it rejects a version it does not know), then record the new wording's SHA-256 in `src/content/privacyNotice.test.ts` (the failing test prints the line to add).
4. Run `npm run verify`, rebuild (`docker compose up --build -d`) and look at the form once in a browser.
5. Keep the old version's line in `SHOWN_WORDING` and in `PUBLISHED_NOTICE_VERSIONS` as long as stored applications refer to it, and note the approval in [`security-standards.md`](security-standards.md).
