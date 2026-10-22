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
- `src/lib/matching.ts` is the user's verbatim reference implementation; only type-level tweaks allowed, never change the maths.
- Signed-in pages live under `src/routes/_authenticated/`; `/` redirects to `/auth` or `/profile`.
- AI provider/model choice lives in `src/lib/ai-config.ts` (code defaults, env overrides `AI_PROVIDER`, `<PROVIDER>_MODEL`); why: model names are not secret, only keys go in Secrets.
- Test data lives in `scripts/test-seed/` (seed.ts + rollback.ts, accounts tagged `user_metadata.seed`); why: test people must be removable cleanly with all linked rows.
