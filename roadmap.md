# Roadmap
- [x] Matching maths (reference implementation) + tests
- [x] Enable Lovable Cloud, profiles table, sign-in (email + Google)
- [x] OpenAlex import (name/ORCID search) + confirm profile + profile page
- [x] Profile: add own topics, AI-prefilled interests, collapsible sections, paginated + sortable publications
- [x] Profile analysis (AI, verified evidence, edits, daily limit)
- [x] compute-matches server function, method synonyms, Matches page, double opt-in
- [x] Opportunities, feedback, notices, empty/loading states
- [x] Opportunity modes, review filter, likely PIs, whitespace check, save/dismiss + manage page with notes
- [x] Include direct collaborators alongside matches in opportunity selection and published-work evidence
- [x] Limit opportunity collaborator choices using configurable settings (default: 10 most frequent)
- [x] Add personal Settings for collaborator limit and default match/opportunity search switches
- [x] Remove duplicated search preference controls from Matches and Opportunities; use saved Settings and keep participant selection on Opportunities
- [x] Add fourth scientist-card metric: open-access percentage over the rolling last three years
- [x] Match management (save/dismiss, tabs, private notes, AI collaboration ideas)
- [x] Monthly refresh cron (once a night at 01:00 UTC = 03:00 Madrid summer time, up to 5 due users per run, pauses on AI 402/403)
- [ ] Seed test researchers Johan Foster (UBC email) & Raphaell Moreira (Bremen email), check their match
- [x] Test researchers Gasteiger, Dahn, Lucht (scripts/test-seed, rollback ready)
- [ ] Remove test researchers when testing is done (run rollback)

## Later (do not implement yet)
- [ ] Full text for open-access papers: for works with `is_oa`, fetch text via OpenAlex `best_oa_location.pdf_url` (parse PDF server-side), or pre-extracted text from CORE (`/outputs/{id}/text`, free key), Semantic Scholar (free key), Europe PMC (biomed), arXiv/bioRxiv. Possible uses: deeper profile analysis, full-text evidence checks in Opportunities. Mind API quotas; respect licences.
- [x] Nightly refresh follows each researcher's own time zone

## Chunked profile analysis (done)
- Split works into batches, analyse each, validate evidence per batch, merge duplicates, synthesise final result (fallback: deterministic merge), show "batch X of Y" progress, save if ≥ half the batches succeed.

## Swipe discovery
- [x] Discover deck on Matches: swipe right = interested + saved, left = dismissed, undo, keyboard arrows; cards show h-index, citations, recent papers, shared topics, methods, interests (platform members only)
- [x] Discovery layer: "Find new matches" returns up to 10 new platform members; excludes self, anyone already matched/saved/dismissed and direct co-authors; collaborators of collaborators first (card names the shared co-author), then shared-topic matches; topic gate applies to both
- [x] Wider OpenAlex fill when fewer than 10 platform members qualify: co-authors of your 5 most frequent co-authors (last 3 years) first, then last authors of recent work in your top 3 topics; same topic gate and score; shown as "Not on Lattice Scout" cards, save/dismiss/restore, link to OpenAlex; "Principal investigators only" switch (on by default) limits outside suggestions to last authors
- [ ] Further-afield layer (3–5 degrees / exploratory cross-disciplinary)

## Technical debt & scaling: matching concurrency and performance
Issues
- Race: double-clicks or two people searching at once could insert the same pair twice.
- Full scans: matching reads every profile and every publication row on each request; cost grows with platform size, not with the user's own history. (The exclusion list itself is cheap: a few hundred ids in a set.)
Done
- Unique index on the unordered pair (LEAST/GREATEST of user_a, user_b); inserts ignore duplicate-pair errors, so races are harmless.
- The user's own matches are read with a filter on user_a/user_b, backed by indexes.
Proposed (not yet implemented)
- Pre-filter candidates in the database: only profiles sharing at least one topic key with the user and not already matched, then score that subset in code.
- Store co-author ids in their own indexed table (user_id, coauthor_id) instead of reading every publication row's author list.
- Per-user short lock (or button disable) against repeated requests.
