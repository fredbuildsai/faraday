# Collaborative opportunities

## What you get

1. **Create an opportunity yourself** ("New opportunity" on Opportunities)
   - Title and short description.
   - Invite people from Lattice Scout: your matches, plus collaborators who are members. People outside Lattice Scout can be listed as "suggested people" but can't edit.
   - Pick evidence papers: search by title across your publications and those of the people you invited.
   - "Find similar papers": the AI drafts search terms from your title, description and the papers you picked. OpenAlex then returns recent related papers, which you can add as evidence. The same whitespace check as for generated opportunities is shown.
   - Saved opportunities (generated ones too) can be turned into a shared project the same way.

2. **Working together on a shared opportunity** (its own page, linked from Saved / Manage)
   - **Invitations:** invitees see a "Shared with you" list and accept or decline. Only accepted members can see or edit.
   - **Roles:** owner (invite or remove people, archive, delete) and editor (edit, comment). Kept simple.
   - **Proposal text:** one shared draft with sections (aims, approach, who does what, open questions). Each save keeps a version, and you can view or restore earlier versions.
   - **Comments:** a discussion thread, plus comments attached to a section or to an evidence paper. Comments can be marked resolved.
   - **Traceability:** an activity timeline showing who did what and when: created, invited, joined, edited a section, added or removed a paper, commented, changed status.
   - **Status:** idea → drafting → submitted → funded / closed.
   - **Simple tasks:** a checklist of to-dos, each assignable to a member, with an optional due date.

3. **Other basics (included)**
   - An in-app notification badge in the menu for invitations, new comments and edits on your shared opportunities. Email notifications are not included, in line with your earlier "no email for now".
   - Private notes stay private. Shared content is kept separate from your personal notes.
   - Leaving a project. The owner can remove members and transfer ownership.
   - Export the proposal (text and evidence list) as a downloadable document.

## Not included (could come later)
- Live typing by several people at once in the same section. A section is saved when one person finishes, and if two people edit the same section the later save warns about the conflict.
- File attachments and email notifications.

## Technical details
- New tables (each set up with the access rights the database requires, and protected so only the people in a project can read them): `projects` (owner, title, description, status, source opportunity snapshot); `project_members` (role, invite state); `project_papers` (OpenAlex id, title, who added it); `project_sections` and `project_section_versions`; `project_comments` (optional section or paper target, resolved); `project_tasks`; `project_activity` (append-only, written by database triggers so it can't be faked); `notifications`.
- One database check function, "is this user an accepted member?", is used by every access rule, so the rules don't call each other in a loop.
- Paper search over members' publications runs on the server after checking that the user may see them (invitee or match), because members' paper lists aren't otherwise visible to other users.
- The similar-papers search reuses the existing AI call and search-term cleanup, and evidence is only ever added from real OpenAlex results.
- Edit-conflict check: each section save sends the version it started from and is rejected if it is no longer the latest.
- Pure rules (who can invite or edit, the status steps, conflict detection) live in `src/lib/projects.ts` with tests.
- Routes: `/projects` (shared with you), `/projects/$id`, a "New opportunity" dialog on Opportunities, and a menu entry under Opportunities.
