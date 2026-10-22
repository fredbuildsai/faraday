# Roadmap
- [x] Matching maths (reference implementation) + tests
- [x] Enable Lovable Cloud, profiles table, sign-in (email + Google)
- [x] OpenAlex import (name/ORCID search) + confirm profile + profile page
- [x] Profile: add own topics, AI-prefilled interests, collapsible sections, paginated + sortable publications
- [x] Profile analysis (AI, verified evidence, edits, daily limit)
- [x] compute-matches server function, method synonyms, Matches page, double opt-in
- [x] Opportunities, feedback, notices, empty/loading states
- [x] Opportunity modes, review filter, likely PIs, whitespace check, save/dismiss + manage page with notes
- [ ] Monthly refresh cron
- [ ] Seed test researchers Johan Foster (UBC email) & Raphaell Moreira (Bremen email), check their match
- [x] Test researchers Gasteiger, Dahn, Lucht (scripts/test-seed, rollback ready)
- [ ] Remove test researchers when testing is done (run rollback)

## Later (do not implement yet)
- [ ] Full text for open-access papers: for works with `is_oa`, fetch text via OpenAlex `best_oa_location.pdf_url` (parse PDF server-side), or pre-extracted text from CORE (`/outputs/{id}/text`, free key), Semantic Scholar (free key), Europe PMC (biomed), arXiv/bioRxiv. Possible uses: deeper profile analysis, full-text evidence checks in Opportunities. Mind API quotas; respect licences.
