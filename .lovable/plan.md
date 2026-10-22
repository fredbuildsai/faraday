# Shared opportunity workspace v2, password reset

## Decisions
- Export: one outline rendered to .docx (docx library, in browser), .md and .txt. Download link is attached to the page and released after 2 s (the old instant release cancelled the download).
- Draft: classical article sections (Abstract, Introduction, Experimental, Results and discussion, Conclusions). Existing opportunities received these sections; their old sections stay visible as "Earlier notes" when they have text.
- Contributors: roles per person from the CRediT taxonomy; members can add custom roles, saved on the opportunity for reuse; a custom role can be removed only when nobody holds it.
- Aims and open questions: individual items (title, details, resolved), each with its own comment thread; history records add/resolve/remove.
- References: separate from evidence papers; added from OpenAlex (title, keywords or DOI) or by hand (title, authors, year, journal, DOI, link); numbered in exports; commentable.
- Discussion: every comment shows its source (General, Draft: section, Aim, Open question, Paper, Reference) with a filter; typing @ suggests members; tagged members get a notification and see "Mentions you".
- Saved to shared: notes (editable before creating, then posted as the first comment and kept with the record), whitespace check, evidence and closest papers (labelled by origin), and named researchers (members pre-ticked for invitation, others listed as suggested).
- Password reset: "Forgot password?" on sign-in sends an email link to a public page where the new password is set twice and saved; expired links show a clear message.
- Google button shows the official Google logo (brand colours kept as-is).
