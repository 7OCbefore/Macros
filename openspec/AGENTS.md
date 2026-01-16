# OpenSpec Agents Guide

## OVERVIEW
This directory contains the OpenSpec specification-driven development framework, where changes are proposed and validated before implementation.

## WHERE TO LOOK

- **Full workflow guidance**: `openspec/AGENTS.md` (comprehensive 457-line guide for AI assistants)
- **Project template**: `openspec/project.md` (template for project-specific conventions)
- **Active proposals**: `openspec/changes/` (currently empty)
- **Deployed specifications**: `openspec/specs/` (currently empty)
- **Archived changes**: `openspec/changes/archive/` (for completed work)

## CONVENTIONS

- **Proposal-before-implementation**: All new features, capabilities, and breaking changes MUST have a proposal in `openspec/changes/` before implementation begins
- **Bugfix exception**: Restoring intended behavior does NOT require a proposal; fix directly
- **Change ID format**: Use kebab-case with verb-led prefixes (`add-`, `update-`, `remove-`, `refactor-`)
- **Delta specifications**: Changes use `## ADDED|MODIFIED|REMOVED|RENAMED Requirements` format with `#### Scenario:` blocks
- **Validation**: Run `openspec validate <change-id> --strict` before requesting approval
- **Single purpose**: Each capability should be understandable within 10 minutes; split if description contains "AND"
- **Template usage**: Always start proposals by copying `project.md` structure and filling in project-specific details

## ANTI-PATTERNS

- **Skipping proposals for features**: Never implement new functionality without first creating a change proposal; this breaks the specification-driven workflow
- **Modifying without deltas**: Never edit specs directly without creating proper delta specifications under `changes/`
- **Partial MODIFIED requirements**: When using `## MODIFIED Requirements`, always include the full requirement text, not just changes (partial deltas cause data loss during archiving)
- **Scenario formatting errors**: Never use `- **Scenario:**` or `**Scenario**:` format; always use `#### Scenario:` with exactly four hashtags
- **Missing scenarios**: Every requirement MUST have at least one scenario; requirements without scenarios will fail validation
- **Overlapping changes**: Never create a proposal without checking `openspec/list` for conflicting active changes
- **Implementation before approval**: Never start coding until the proposal is reviewed and approved; the approval gate is mandatory for all non-bugfix changes

## QUICK REFERENCE

```
New request?
├─ Bug fix restoring spec behavior? → Fix directly
├─ Typo/format/comment? → Fix directly  
├─ New feature/capability? → Create proposal
├─ Breaking change? → Create proposal
└─ Architecture change? → Create proposal
```

**Files created**: `proposal.md`, `tasks.md`, optional `design.md`, and delta specs under `changes/[change-id]/`
