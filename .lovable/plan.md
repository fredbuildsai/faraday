# Lattice Scout — v1 plan (sign-up, profile, OpenAlex import)

## Look and feel (from screenshots)
- Warm off-white page background, white cards with thin borders and soft rounded corners.
- Serif display headings ("Is this you, Johan?"), clean sans body, monospace for ORCID and numbers.
- Deep royal-blue primary buttons, soft lavender info banners, teal/green "Matched/Found" badges, pill-shaped topic chips.
- Logo: blue lattice square + "Lattice Scout" wordmark, "BY LATTICE PRESS" tag on sign-in.

## Screens
1. **Sign in / Create account** (W0): split layout, headline + three feature lines on the left, card on the right. "Continue with Google" button plus email + password sign-in, and a "Create account" view with first name, last name, institution, ORCID (optional, checksum-validated). Google users get their name from their Google account and can add institution/ORCID on the confirm step. Only invited emails can register (applies to Google too). ORCID / Institutional buttons are left out.
2. **Confirm profile** (W1, simplified): "Is this you, {first}?" header. Runs automatically on first entry so the profile builds itself.
   - With ORCID: author is found automatically; if ORCID not found in OpenAlex, a notice appears and it falls back to name search.
   - Single high-confidence name match (exact name + matching institution): shown pre-selected with a one-click "Yes, that's me".
   - Without ORCID: up to 10 candidate cards (name, institution, works count, top 3 topics) plus "None of these". Never auto-picked.
   - After import: lavender banner "Imported N works" (plus truncation notice above 2,000), left profile card (name, institution, ORCID), publications list (title, venue, year, citations, type badge), "Research topics" chips from the top topics.
   - Stepper, uncertain-works checkboxes, Sources panel, matching settings are omitted (NOT NOW).
3. **Profile** (W10, simplified): header card with initials avatar, name, institution, ORCID chip, works / citations stats; editable "Research interests" (max 500 chars, live counter); "Refresh my publications" button; works list. Tabs other than the profile are omitted.
4. **Header** (W2/W10): logo + avatar menu with Profile and Sign out only. Home, Vault, Opportunities, Matches, Reach, Ask Scout, side menu (W11) are not built.
- "/" sends signed-out users to sign-in and signed-in users to their profile (or the confirm step if no author chosen yet).

## OpenAlex import
- Runs right after sign-up and from "Refresh my publications".
- Always sends the contact email; adds the API key when it is set.
- Max 5 requests/second, one retry after 2s on rate limit, every response cached 24h.
- Fetches all works via cursor paging (200 per page), skips untitled works, stops at 2,000 with a notice.
- Saves each work (deduplicated per user), then computes topic weights (top 25, summing to 1) and activity score (works in last 3 calendar years / 3, capped at 1).

## Automatic profile analysis (Mistral)
- Starts on its own after every import (first and each refresh); no click needed.
- Profile page shows a status chip: pending, running, done, failed (with "Retry"). The last finished result stays visible while a new one runs.
- Sends only work titles, keywords, topic names, years, and the user's own research-interests text (no email, ORCID, institution or ids). 100 works per call, then one merge call. Model `mistral-small-latest`, temperature 0.2, JSON-schema output; one retry on invalid output, then failed.
- Result: summary (max 80 words), up to 10 research interests, up to 8 methods, up to 5 emerging directions (themes new in the last 3 years), each interest/method backed by 2 exact work titles.
- Code checks every evidence title against the user's works; items with fewer than 2 verified titles are dropped and kept privately (never shown).
- Skipped when works + interests text are unchanged. Max 3 analyses per user per day, with a notice when exceeded.
- User can delete any interest/method and add their own (marked "added by you"); these edits survive re-analysis.

## Matching (no AI in the score)
- Runs automatically each time a profile analysis finishes, comparing the user with everyone else who has a finished analysis.
- Score = topic similarity x (1 - method overlap)^1.5 x activity factor: "similar topics, different methods, both active".
- Pairs where either side brings no method the other lacks are skipped. Minimum score 0.11 (adjustable setting). Max 5 new matches per user per 7 days, best first.
- **Matches page**: header gains a "Matches" link. Cards show name, institution, score, shared topics, "you bring / they bring" methods, and a collapsible "Why this score" panel with each number. No email on cards.
- **Match detail**: short AI summary (max 60 words) and up to 2 collaboration ideas, from shared topics, methods and up to 5 work titles each only; generated once and saved.
- **Double opt-in**: "I'm interested" button. Both emails appear only once both people clicked it, enforced in the database, not just on screen.
- Seed profiles get analyses and methods so matches show up right away.

## Opportunities page
- Header gains an "Opportunities" link.
- Uses the user's finished analysis (interests, methods, emerging directions) to search OpenAlex for related works from the last 3 years (25 results).
- Mistral suggests up to 3 research gaps: title, description (max 60 words), and evidence work ids.
- Each evidence id is checked against the OpenAlex results; only suggestions with at least 2 verified works are shown, each work with title and link. Dropped suggestions are stored hidden.
- Novelty comes from an OpenAlex count of works matching the combined topic terms, never from the AI.
- Results cached per user for 7 days.

## Trust and polish
- Notice on the profile and sign-up / confirm pages (the pages with no uploads): "Only published information is used. Do not enter confidential data."
- Thumbs up / down on every match card and opportunity; clicking again changes the vote.
- Simple empty state for every list (works, topics, interests, methods, matches, opportunities).
- Loading state (skeletons + "Analysing your profile…") while the analysis runs.

## Monthly automatic update
- Every user's publications are re-imported from OpenAlex about once a month, then their analysis and matches update automatically (analysis is skipped when nothing changed; the daily limit still applies).
- Runs in small batches each day so it stays within OpenAlex and Mistral limits. Profile shows "Last updated" date.

## Seed data
- Invites: 3 example researchers (example.edu) plus your email (please send it).
- 3 example profiles with synthetic works, topic weights and activity.

## Technical details
- Enable Lovable Cloud; email/password auth (confirmation email) plus managed Google sign-in.
- Tables: `invites(email)`, `profiles(id→auth.users, first_name, last_name, institution, orcid, research_interests ≤500, openalex_author_id, topic_weights jsonb, activity numeric, works_truncated bool, last_imported_at)`, `works(user_id, openalex_id, doi, title, year, type, cited_by_count, topics jsonb, keywords jsonb, venue, unique(user_id, openalex_id))`, `openalex_cache(url pk, body jsonb, fetched_at)`.
- RLS on all; users read/write only own profile and works; `invites` and `openalex_cache` not readable by clients. Grants per table.
- Invite check: a security-definer function `is_invited(email)` plus a trigger on `auth.users` that rejects non-invited signups and creates the profile row from signup metadata.
- The brief's "Edge Function `import-works`" is implemented as server functions (`resolveAuthor`, `importWorks`) on this stack, authenticated as the user and using the service role server-side for cache writes. Secrets `OPENALEX_MAILTO` (required) and `OPENALEX_API_KEY` (optional) requested after approval.
- ORCID checksum (ISO 7064 MOD 11-2) and the topic-weight / activity math in a pure module with unit tests.
- Analysis: "Edge Function `analyze-profile`" implemented as a server function started in the background after `importWorks`, calling the Mistral API directly with secret `MISTRAL_API_KEY`. Tables `profile_analysis(user_id, status, summary, research_interests, methods, emerging_directions, evidence, dropped_claims, model, input_hash, created_at)`, `profile_analysis_edits(user_id, kind, value, action add/remove)` for user edits, `llm_calls(user_id, tokens, ms, ok)`. RLS own rows only; `dropped_claims` excluded from client reads (served via a view/server function). Daily limit counted from `profile_analysis` rows. Evidence verification, input hash and edit-merge logic in a pure module with unit tests.
- Matching: TypeScript server function `computeMatches(userId)` (pure scoring module with unit tests for T, M, act, score, complementarity skip, threshold, 7-day cap) run after analysis reaches done. Setting table `app_settings(match_threshold default 0.11)`. Table `matches(user_a, user_b, score, t, m, act, shared_topics, a_only, b_only, formula 'c2', explanation jsonb, created_at)`; RLS readable only by its two users; no email column. `explainMatch` server function calls Mistral (JSON schema, max 60-word summary, max 2 ideas) with only topics, methods and up to 5 titles each; result cached in `matches.explanation`; logged in `llm_calls`.
- Double opt-in: table `interests(from_user, to_user)` (insert own only). View `match_reveal_v` (security barrier, filtered to auth.uid()) returns the other user's email only when both interest rows exist; email is never readable any other way.
- Opportunities: server function `findOpportunities` (the brief's Edge Function) reusing the cached, rate-limited OpenAlex client. Table `opportunities(user_id pk, suggestions jsonb, dropped_claims jsonb, created_at)`; RLS own row; `dropped_claims` not exposed to clients. Evidence-id verification and novelty query building in the pure module with unit tests.
- Feedback: table `feedback(user_id, target_type 'match'|'opportunity', target_id, value -1|1, created_at, unique(user_id, target_type, target_id))`; RLS own rows; upsert on click.
- Monthly refresh: daily pg_cron job calls `/api/public/cron/refresh` with a shared secret header (`CRON_SECRET`, generated). Picks up to 20 users whose `last_imported_at` is over 30 days old, runs import then analysis (skipped if input hash unchanged) then matching. Lease row in `job_locks` for single-flight; pauses and records reason on Mistral 402/403 or repeated 429.
- Seed via migration INSERTs (synthetic auth users for the 3 examples).
