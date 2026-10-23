# Faraday — Architecture Decision Records

Each record: context, decision, consequences. Status is "Accepted" unless noted.
Business values (weights, limits) are defaults; users can change several in Settings.

---

## ADR-001 Stack and backend
- **Context:** Small team, full-stack web app for researchers.
- **Decision:** TanStack Start v1 (React 19, Vite 7, SSR on Cloudflare Workers), Tailwind v4 with semantic tokens, Lovable Cloud (Postgres, auth, RLS). App logic in `createServerFn`; external callers (cron) under `src/routes/api/public/*` with caller verification.
- **Consequences:** No edge functions; server code must be Worker-compatible.

## ADR-002 Pure, tested business logic
- **Decision:** Deterministic rules (matching, discovery, opportunities, projects, ORCID, candle passages) live in `src/lib/*.ts` with Vitest tests in `src/test/`.
- **Consequences:** Rules are verifiable without the backend; every user-stated rule gets a test.

## ADR-003 Open registration and authentication
- **Decision:** Anyone can register with email/password or Google; no invite list. Email confirmation is kept. Confirmation links land on `/auth-callback` (handles PKCE code and hash tokens, waits for session hydration) to avoid the redirect race that stripped tokens.
- **Password reset:** "Forgot password?" sends a link to public `/reset-password`, which exchanges codes explicitly, polls up to 10 s, and offers a 6-digit code fallback because university mail scanners consume single-use links.
- **Emails:** Sent from the default mailer until a sender domain is configured; branded confirmation + welcome email (logo, tagline, feature banners) are drafted and blocked on the domain.

## ADR-004 Profile from OpenAlex
- **Decision:** After sign-in, the user selects one or more OpenAlex author profiles; data from all selected profiles is combined (not replaced), capped at 2,000 works. Import runs in the background (`profiles.import_status`, `import_started_at`); the user lands on the profile immediately with a progress banner (polling every 4 s, stale after 10 min).
- **Profile UI:** editable topics (collapsed by default), AI-drafted research interests auto-created for first-time users, collapsible sections, publications paginated (5/10/20/50, default 5) and sortable (recent/cited).
- **Open access:** stored per work (`works.is_oa`), badge shown only when true.
- **Future (not implemented):** use OA full text where available.

## ADR-005 AI provider configuration
- **Decision:** Provider/model defaults in `src/lib/ai-config.ts`, overridable by env (`AI_PROVIDER`, `<PROVIDER>_MODEL`). Primary: OpenRouter `nvidia/nemotron-3.5-super-vl:free`. Only API keys are secrets.

## ADR-006 Chunked profile analysis
- **Context:** Large publication lists time out in one AI call.
- **Decision:** Split works into batches of `CHUNK_SIZE` (40); validate each batch's claims against its own titles (≥2 exact titles); cache successful batches by input fingerprint (`analysis_batches`) and reuse on retry; one synthesis pass with deterministic `mergeClaims` fallback; save only if `enoughChunks` (≥ half).

## ADR-007 Match scoring
- **Context:** Large method overlap means the user could do the work alone; complementarity needs domain knowledge not available yet.
- **Decision:** Score = weighted topic similarity + activity (default 85% / 15%), topic gate 0.20 so unrelated scientists never match, minimum score 0.20. Methods are descriptive only, not scored. Weights in `profiles.match_weights`, fallback `DEFAULT_WEIGHTS` (user-selectable later). Legacy formula kept as reference in `matching.ts`.

## ADR-008 Discovery of new matches
- **Decision:** Each request returns up to `BATCH_SIZE` (10) new suggestions. Excludes already matched pairs and direct co-authors; collaborators-of-collaborators ranked first; connection degree and all shared co-authors (`vias`) shown. Platform members shown first with the Faraday mark; previously dismissed members may reappear with a note. Pairs are unique regardless of order (DB index).
- **External researchers:** stored in `external_suggestions` (OpenAlex id, state), never in `matches`, since double opt-in needs two members. PI-only toggle (last author) on by default. Profiles open in an in-app modal.
- **Known issue (documented, not fixed):** exclusion list grows over time; proposed fix in `roadmap.md`.
- **Match management:** saved/dismissed tabs, notes, AI collaboration ideas, "Remove all" dismissed with confirmation.

## ADR-009 Opportunities
- **Decision:** Two modes — based only on the user's and selected people's published research, or broader. Toggle to exclude reviews. Principal investigators = last authors (OpenAlex `author_position`).
- People to choose from: matches (top `matchLimit`, 10) and most frequent direct collaborators (`collaboratorLimit`, 10), shown separately. With no one selected, search uses the user's own works and suggests potential collaborators (direct and 2nd-degree, `potentialLimit` 8).
- Whitespace: OpenAlex counts over a rolling 3-year window; sorted fewest recent papers first.
- Scientist cards show a 4th metric: open-access share over the last 3 years (cached OpenAlex count queries).
- Saving = thumbs up; thumbs down = soft delete; full delete in management; free-form private notes.
- All limits configurable: defaults in `src/lib/opportunity-config.ts`, personal overrides in `profiles.research_settings` via Settings page; `paperLimit` default 30 (2–200).
- All external links open in modals (`PaperDialog`).

## ADR-010 Shared opportunities (collaboration)
- **Decision:** `projects*` tables; access via security-definer checks (`is_project_member/owner/invitee`); history and notifications written only by triggers; section saves via `save_project_section` with version check; invites limited to the caller's matches.
- Manuscript: classical article sections (`DEFAULT_SECTIONS`), aims/questions as items with threads, references, CRediT contributor roles plus saved custom roles, comments with source labels and @mention autocomplete that notifies members.
- Export to md, txt, docx from one outline; download link kept attached and revoked later (immediate revoke cancelled downloads).
- A saved opportunity converts via `fromSaved()` carrying notes (also first discussion post), whitespace, evidence, papers, researchers — no data loss.

## ADR-011 Scheduled refresh
- **Decision:** Monthly data refresh (due after 30 days), cron hourly but each user processed only during their local night (01:00–05:00, profile timezone from browser; UTC fallback). Pauses on 402/403 from providers.

## ADR-012 Navigation
- **Decision:** One `AppHeader` for signed-in pages: logo → /profile, burger drawer with grouped items. Pages do not render their own headers.

## ADR-013 Faraday brand
- **Decision:** Renamed from Lattice Scout to **Faraday**, tagline **"Get out of the cage."** (Faraday cage as the academic silo).
- The full public-domain text of *The Chemical History of a Candle* (Gutenberg #14474) is bundled at `public/books/` and readable at `/candle`; no runtime fetch.
- Passages must be verbatim; a test checks each against the bundled text (two invented quotes were rejected).
- **Fixed quote (2026-10-23):** the sign-in page and import banner always show "We come here to be philosophers; … find out the reason." (Lecture I). No rotation; citation and "Read the book" link kept. Supersedes the earlier rotating/"There is not a law…" default.
- Sign-in page: logo (with tagline) centered and large; duplicate headline removed; layout reorganised so login is visible on mobile.
- GitHub repository rename is done by the owner on GitHub.

## ADR-014 Test data
- **Decision:** Seed and rollback scripts in `scripts/test-seed/`; accounts tagged `user_metadata.seed` so they and all linked rows can be removed cleanly.

## ADR-015 Hosting and domains
- Preview URLs are restricted to the editor session ("Zugriff verweigert" outside it); email links must target the published app. Custom domain `latticescout.frederick-chesneau.com` is primary; the Lovable subdomain can be renamed in Publish settings.

## ADR: Brand icons
Logo mark = royal-blue square, white lattice, French-red (#EF4135) centre dot. `public/favicon.svg` is the source; `favicon.ico`, `apple-touch-icon.png` (180, square — iOS masks corners), `icon-192/512.png` are rendered from it and linked with `site.webmanifest` in `__root.tsx`. Why: tab and iOS home-screen show the Faraday brand.

## ADR: French flag blue
Primary colour (buttons, links, logo, icons) is French flag blue #002395 (`--primary`, oklch 0.338 0.186 263.7), with white lattice and French red centre dot — bleu, blanc, rouge. Supersedes the earlier royal blue.

## ADR: Logo lockup proportions
The mark is sized in `em` against the wordmark's font size (`h-[0.97em]`), so it is exactly the height of the "Faraday" letters (cap top to descender) instead of the fixed 77px/32px boxes it used before; "GET OUT OF THE CAGE" is centred under the whole lockup. Why: the mark read as oversized next to the word, and the lockup must stay proportional at every size (large on /auth, small in `AppHeader`).
