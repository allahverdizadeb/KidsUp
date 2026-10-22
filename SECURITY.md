<!-- Owner: confirm the contact and the response times below before launch (SEC-B-17). -->

# Security policy

KidsUp keeps personal data of children and their parents, so security reports are taken seriously.

## Reporting a problem

Please **do not** post it publicly (an issue, social media). Tell the project owner privately, by WhatsApp or phone:
**+994 50 998 87 07**. Say that it is a security report and describe what you found and how to see it. **Do not include real
personal data** of anyone, and do not look at, copy or change other people's data.

We aim to acknowledge a report within **3 working days** and to say what we will do within **10 working days**. We will not
take action against anyone who reports in good faith and follows the points above.

<!-- Owner, before launch: add an e-mail address here and serve it at /.well-known/security.txt (nginx already allows that path;
     front/src/publicAssets.test.tsx allows only images and PDFs under public/, so extend it in the same change);
     have counsel confirm the "good faith" promise and the legal notification deadlines in step 3 below. -->

## What is covered

The public website, the application form and its API, the admin panel (its API and its origin) and the Docker setup in this
repository. Out of scope: attacks that need physical access, social engineering of the team, and denial-of-service tests
against the live site. If you find a way to reach the admin panel's data without signing in, or to do more than your role
allows once signed in, that is the most serious kind of report: tell us at once, and do not use it.

## If personal data may have been exposed

1. **Keep the evidence, then contain:** export the logs you may need first (`docker compose logs --no-log-prefix back > <a path outside the
   repository and outside OneDrive>`, also `panel`, `front`, `admin`, `db`, `retention`): Docker rotates them by size, so a restart or a busy day
   can overwrite them. The **audit log** in the database (who signed in, looked at, changed, exported or erased what, from which network; a listing or an export names the ids of the families it showed) is
   evidence too and cannot be edited: copy it out (`docker compose exec db psql -U kidsup -d kidsup -c "\copy audit_log to …"`, to a path outside the
   repository and OneDrive). Then rotate **all five** database passwords following "Rotating a password" in [`docs/docker.md`](docs/docker.md). The superuser's must be
   changed in the database first (`\password kidsup`) and only then in `.env`: editing `.env` alone leaves the old superuser password valid and
   stops the stack from starting. If a staff account or the panel key may be involved, also switch the accounts off (`docker compose exec panel python -m app.panel.cli
   deactivate <e-mail>`: it ends their sessions), and rotate the panel key (every authenticator must then be set up again). Finish with
   `docker compose restart back panel retention` so that no old connection survives. Stop the stack if needed.
2. **Assess:** which applications are affected (the database holds only parent and child names, a phone number, birth
   dates, the language choice, the record of consent, and staff's statuses and notes about each application). The API's own account cannot read any of it
   back, so a flaw in the public API alone does not expose stored applications; a leaked superuser, owner, retention or panel password does, and so does a
   signed-in staff session or a stolen staff password together with its one-time code: the audit log says what a given account looked at.
3. **Notify:** the affected families and, where the law requires it, the competent authority, within the legal deadline.
4. **Fix and learn:** correct the cause, add a test that would have caught it, write a short blameless note.
