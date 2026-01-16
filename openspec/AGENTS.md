# openspec/ – AGENTS

## OVERVIEW
Spec-driven workflow folder; proposals describe changes before coding.

## WHERE TO LOOK
- `AGENTS.md` (this file) — workflow summary
- `project.md` — context template for project conventions
- `specs/` — deployed capabilities (empty)
- `changes/` — active proposals (empty)
- `changes/archive/` — completed changes

## CONVENTIONS
- New features, breaking changes, or architecture updates require proposals.
- Bug fixes and config-only changes skip proposals.
- Change IDs are kebab-case with verb prefixes (`add-`, `update-`, `remove-`, `refactor-`).
- Delta specs use `## ADDED|MODIFIED|REMOVED|RENAMED Requirements` headers.
- Every requirement includes at least one `#### Scenario:` block.
- Use `project.md` as the starting template for proposals.

## ANTI-PATTERNS
- Implementing features without a proposal.
- Editing specs directly instead of adding deltas in `changes/`.
- Writing MODIFIED requirements without full copied text.
- Using incorrect scenario headers (must be `#### Scenario:`).
- Creating overlapping proposals without checking existing changes.
- Starting implementation before proposal approval.
