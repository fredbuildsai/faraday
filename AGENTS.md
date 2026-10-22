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
