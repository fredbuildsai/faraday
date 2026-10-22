# Roadmap
- [x] Matching maths (reference implementation) + tests
- [x] Enable Lovable Cloud, profiles table, sign-in (email + Google)
- [x] OpenAlex import (name/ORCID search) + confirm profile + profile page
- [x] Profile: add own topics, AI-prefilled interests, collapsible sections, paginated + sortable publications
- [x] Profile analysis (AI, verified evidence, edits, daily limit)
- [x] compute-matches server function, method synonyms, Matches page, double opt-in
- [x] Opportunities, feedback, notices, empty/loading states
- [x] Opportunity modes, review filter, likely PIs, whitespace check, save/dismiss + manage page with notes
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
- [ ] 2nd-degree layer (co-authors of your co-authors on the platform): needs co-author lists stored at import
- [ ] Further-afield layer (3–5 degrees / exploratory cross-disciplinary)
