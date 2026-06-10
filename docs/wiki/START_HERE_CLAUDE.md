# START HERE - Okyo Repo Setup For Claude Code

Use this folder exactly as the starting point.

## What To Upload To GitHub

Upload the contents of the repo to your private GitHub repo.

The GitHub repo should include:

```text
README.md
CLAUDE.md
AGENTS.md
.claude/
.gitignore
.env.example
docs/
```

`CLAUDE.md` and `.claude/skills/` are for Claude Code. `AGENTS.md` is kept for Codex or other coding agents that read AGENTS-style instructions.

## Do Not Upload Old Duplicate Folders

Do not upload these separately:

```text
Okyo_Mini_Wiki/
Okyo_Seed_Folder/
old ZIPs
old duplicate PRD drafts
```

This clean starter already includes the important docs in the correct place.

## First GitHub Settings

- Repo name: `Okyo` or `okyo`
- Visibility: Private
- README: Yes is okay
- .gitignore: Node is okay
- License: None

## After Upload

Open the repo locally, then start Claude Code from the repo root:

```bash
cd /Users/rober/Documents/Okyo-1
claude
```

Claude Code should read `CLAUDE.md` automatically and discover project skills from `.claude/skills/`.
