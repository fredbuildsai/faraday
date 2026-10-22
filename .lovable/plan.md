# Why only "shared interest" matches appear, and the fix

## What the data shows
- Only 6 people are on Lattice Scout, and you are already matched with every member who passes the topic gate (Brett, Jeff, Hubert). Dismissed people are never suggested again, so there are no new members left to show first. The ordering works; the member pool is just empty.
- You have dismissed 20 "collaborator of a collaborator" researchers and 49 "shared interest" ones. Each search only follows your 5 most frequent co-authors, 50 recent papers each, and keeps last authors only. After a few searches that pool runs out, so the batch is filled with shared-interest people like Peter Bruce.

So toggles alone would not help: the network search runs dry.

## Changes
1. **Wider network search.** Follow more of your co-authors (5 to 15), and on each search start with co-authors not yet explored, so new collaborators of collaborators keep appearing.
2. **Network first, but kept separate.** Fill the batch with collaborators of collaborators first. Only add shared-interest people when the network gives fewer than 10, and put them after.
3. **Tell you what happened.** After each search show a short line, for example: "0 new Lattice Scout members (you've seen them all), 3 collaborators of collaborators, 7 shared interest."
4. **Optional filter boxes** next to "Principal investigators only": "Collaborators of collaborators" and "Shared interest" (both ticked by default). Untick "Shared interest" to get only network people, even if fewer than 10.

## Technical details
- `discovery-external.ts`: `BRIDGE_COAUTHORS` 15; `topCoauthors` accepts an "already explored" set and rotates; `collectCandidates` takes layer filters. Tests for rotation, layer filters and network-first fill.
- `findExternalFor`: picks `second_degree` up to `needed` before taking any `interest`; returns per-layer counts.
- `computeMatchesFor` / `computeMatches` server function: accept `layers`, return `{members, second, interest}`; the Matches page shows the summary toast and the two tick boxes.
