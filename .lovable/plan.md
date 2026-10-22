# Lattice Scout — v1 plan (sign-up, profile, OpenAlex import)

## Look and feel (from screenshots)
- Warm off-white page background, white cards with thin borders and soft rounded corners.
- Serif display headings ("Is this you, Johan?"), clean sans body, monospace for ORCID and numbers.
- Deep royal-blue primary buttons, soft lavender info banners, teal/green "Matched/Found" badges, pill-shaped topic chips.
- Logo: blue lattice square + "Lattice Scout" wordmark, "BY LATTICE PRESS" tag on sign-in.

## Screens
1. **Sign in / Create account** (W0): split layout, headline + three feature lines on the left, card on the right. Email + password sign-in, and a "Create account" view with first name, last name, institution, ORCID (optional, checksum-validated). Only invited emails can register. ORCID / Institutional / Google buttons are left out (not in spec).
2. **Confirm profile** (W1, simplified): "Is this you, {first}?" header.
   - With ORCID: author is found automatically; if ORCID not found in OpenAlex, a notice appears and it falls back to name search.
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

## Seed data
- Invites: 3 example researchers (example.edu) plus your email (please send it).
- 3 example profiles with synthetic works, topic weights and activity.

## Technical details
- Enable Lovable Cloud; email/password auth with auto-confirm off by default (confirmation email).
- Tables: `invites(email)`, `profiles(id→auth.users, first_name, last_name, institution, orcid, research_interests ≤500, openalex_author_id, topic_weights jsonb, activity numeric, works_truncated bool, last_imported_at)`, `works(user_id, openalex_id, doi, title, year, type, cited_by_count, topics jsonb, keywords jsonb, venue, unique(user_id, openalex_id))`, `openalex_cache(url pk, body jsonb, fetched_at)`.
- RLS on all; users read/write only own profile and works; `invites` and `openalex_cache` not readable by clients. Grants per table.
- Invite check: a security-definer function `is_invited(email)` plus a trigger on `auth.users` that rejects non-invited signups and creates the profile row from signup metadata.
- The brief's "Edge Function `import-works`" is implemented as server functions (`resolveAuthor`, `importWorks`) on this stack, authenticated as the user and using the service role server-side for cache writes. Secrets `OPENALEX_MAILTO` (required) and `OPENALEX_API_KEY` (optional) requested after approval.
- ORCID checksum (ISO 7064 MOD 11-2) and the topic-weight / activity math in a pure module with unit tests.
- Seed via migration INSERTs (synthetic auth users for the 3 examples).
