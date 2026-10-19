<!-- Owner: confirm the contact and the response times below before launch (SEC-B-17). -->

# Security policy

KidsUp keeps personal data of children and their parents, so security reports are taken seriously.

## Reporting a problem

Please **do not** post it publicly (an issue, social media). Tell the project owner privately, by WhatsApp or phone:
**+994 50 998 87 07**. Say that it is a security report and describe what you found and how to see it. **Do not include real
personal data** of anyone, and do not look at, copy or change other people's data.

We aim to acknowledge a report within **3 working days** and to say what we will do within **10 working days**. We will not
take action against anyone who reports in good faith and follows the points above.

<!-- Owner, before launch: add an e-mail address here and serve it at /.well-known/security.txt (nginx already allows that path);
     have counsel confirm the "good faith" promise and the legal notification deadlines in step 3 below. -->

## What is covered

The public website, the application form and its API, and the Docker setup in this repository. Out of scope: attacks
that need physical access, social engineering of the team, and denial-of-service tests against the live site.

## If personal data may have been exposed

1. **Keep the evidence, then contain:** export the logs you may need first (`docker compose logs --no-log-prefix back > <a path outside the
   repository and outside OneDrive>`, also `front`, `db`, `retention`): Docker rotates them by size, so a restart or a busy day can overwrite them.
   Then rotate **all four** database passwords following "Rotating a password" in [`docs/docker.md`](docs/docker.md). The superuser's must be
   changed in the database first (`\password kidsup`) and only then in `.env`: editing `.env` alone leaves the old superuser password valid and
   stops the stack from starting. Finish with `docker compose restart back retention` so that no old connection survives. Stop the stack if needed.
2. **Assess:** which applications are affected (the database holds only parent and child names, a phone number, birth
   dates, the language choice and the record of consent). The API's own account cannot read any of it back, so a flaw in the
   public API alone does not expose stored applications; a leaked superuser, owner or retention password does.
3. **Notify:** the affected families and, where the law requires it, the competent authority, within the legal deadline.
4. **Fix and learn:** correct the cause, add a test that would have caught it, write a short blameless note.
