# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repository. The shared guidance for the whole project lives in AGENTS.md, imported below, so there is a single source of truth for every agent. Read it first.

@AGENTS.md

## Claude Code specifics

A few things that apply when working here with Claude Code:

- The canonical guide is AGENTS.md. Keep it current when project conventions change, and do not duplicate its content here.
- Machine-local notes live in `memory/` (gitignored). Do not commit that folder.
- When an AI tool helps with a change, follow the AI attribution rules in AGENTS.md: a `Co-Authored-By` trailer on the commit and an attribution note in the PR description.
- Write almost no code comments, per the Code comments section in AGENTS.md. Comment only a non-obvious reason, never restate what the code does.
