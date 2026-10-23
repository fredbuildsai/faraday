<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Pure business logic (matching maths, ORCID checks) lives in `src/lib/*.ts` with Vitest tests in `src/test/`; why: deterministic rules must stay testable without the backend.
- `src/lib/matching.ts` is the user's original reference implementation (helpers + legacy c2 formula); live scoring is `src/lib/match-score.ts` (topic gate, weighted topic+activity, methods descriptive only) with weights from `profiles.match_weights` falling back to `DEFAULT_WEIGHTS`; why: weighting must become user-selectable.
- Signed-in pages live under `src/routes/_authenticated/`; `/` redirects to `/auth` or `/profile`.
- AI provider/model choice lives in `src/lib/ai-config.ts` (code defaults, env overrides `AI_PROVIDER`, `<PROVIDER>_MODEL`); why: model names are not secret, only keys go in Secrets.
- Test data lives in `scripts/test-seed/` (seed.ts + rollback.ts, accounts tagged `user_metadata.seed`); why: test people must be removable cleanly with all linked rows.
- Signed-in navigation is one `AppHeader` (logo → /profile, burger drawer with grouped items) rendered by `src/routes/_authenticated/route.tsx`; why: pages must not duplicate their own headers or nav.
- Open-access status is stored per work (`works.is_oa`, from OpenAlex `open_access.is_oa`) and shown via `OaBadge` only when true; why: one source of truth for every paper list.
- Profile analysis runs in batches (`CHUNK_SIZE` works each): each batch is validated against its own titles, findings merged with `mergeClaims`, each successful batch result is saved and reused on retry while its input is unchanged, then one AI synthesis over compact findings with a deterministic-merge fallback; saved only if `enoughChunks`. Why: large publication lists time out or exceed provider limits in one request.

- Discovery (`src/lib/discovery.ts`, batch of `BATCH_SIZE`) picks new matches: excludes already matched pairs and direct co-authors (`works.authors`), ranks collaborators-of-collaborators first; matches carry `layer`/`via`; why: one pure, tested rule for who may be suggested.
- Match pairs are unique regardless of order (DB index); inserts tolerate duplicate-pair errors; why: concurrent searches must not duplicate matches.
- Researchers outside the platform are stored per user in `external_suggestions` (OpenAlex id, state), never in `matches` (which needs two members); rules in `src/lib/discovery-external.ts`, fetching in `discovery-external.server.ts`; why: non-members cannot take part in double opt-in.
- Opportunity people are authorized from the caller's matches and imported co-authors; external co-author selections use OpenAlex author IDs and fetch published works server-side, while member selections retain profile IDs. Why: collaborators remain usable without creating discovery matches or exposing private profiles.
- Scientist publication metrics use cached OpenAlex count queries for the same rolling date window, combining all selected author IDs with an OR filter. Why: the OA share must use complete, deduplicated publication counts rather than a truncated imported list.
- Opportunity defaults live in `src/lib/opportunity-config.ts` with optional runtime override; personal `profiles.research_settings` take precedence and are passed into pure selection rules. Why: users must be able to configure limits and search defaults through the Settings page without changing selection logic.
- Shared opportunities (`projects*` tables): access is decided by `is_project_member/owner/invitee` security-definer checks; history and notifications are written only by database triggers, section saves go through `save_project_section` (version check), invites/creation/paper search run server-side in `src/lib/projects.functions.ts` limited to the caller's matches; pure rules in `src/lib/projects.ts`. Why: collaborators must not be able to forge history or reach private profiles.
- Shared-opportunity manuscript: draft sections follow `DEFAULT_SECTIONS` (article structure; older sections show as "Earlier notes"), aims/questions are `project_items`, bibliography is `project_references`, contributor roles are `project_contributions` (CRediT list in `CREDIT_ROLES` + per-project `projects.custom_roles`), comments may target section/paper/item/reference and carry `mentions` (notified by trigger, members only). Why: each piece needs its own thread, history and export.
- Exports build one outline (`exportOutline`) rendered to md/txt in `src/lib/projects.ts` and to .docx in `src/lib/project-export.ts` (`docx` loaded on click; download link attached to the page and revoked later). Why: formats stay consistent, and immediate revoke cancelled downloads.
- A saved opportunity becomes shared through `fromSaved()`: notes, whitespace, evidence + closest papers (tagged by origin) and named researchers all carry over; notes also become the first discussion post. Why: no data may be lost on the way to collaboration.
- Password reset: `/auth` "Forgot password?" sends a link to the public `/reset-password` page, which sets the new password from the recovery session. Why: recovery links must land on a page that asks for a new password.
- Brand is "Faraday" (tagline "Get out of the cage."); the name lives in `Logo.tsx`, route `head()` titles and copy. Why: one consistent identity across pages, exports and emails.
- Faraday's "The Chemical History of a Candle" is bundled in full at `public/books/chemical-history-of-a-candle.txt` (Project Gutenberg #14474, public domain), readable at `/candle`; curated passages live in `src/lib/candle.ts`, shown by `CandleQuote`, and `src/test/candle.test.ts` checks every passage is verbatim in the bundled text. Why: no runtime fetch from outside the app, and no misquotes.
- Architecture decisions are recorded in `docs/ADR.md`; add or supersede a record there when a decision changes. Why: one traceable history of decisions.
