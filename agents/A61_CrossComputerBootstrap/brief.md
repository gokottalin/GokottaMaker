# A61 CrossComputerBootstrap Brief

## Role

Temporary short-task workbench.

Chinese role note:
`跨电脑启动契约：让新电脑 Codex 只从 AGENTS.md 即可克隆、启动、验证并接续`

## Mission

Create the portable, secret-free bootstrap and continuation entrypoint for a
fresh Windows checkout while documenting Linux production differences.

## Allowed Edits

- `AGENTS.md`
- `.env.example`
- `scripts/gokottamaker.env.example`
- `docs/cross-computer-bootstrap.md`
- `scripts/verify-clean-clone.ps1`
- `package.json`
- `docs/codex-workline/slices/S52_cross_computer_bootstrap_handoff.md`

## Done When

- AGENTS.md contains the shortest complete clone-to-Codex continuation path
- all required environment variables have secret-free purpose, format, source, and rotation guidance
- a clean Windows checkout can install, initialize isolated data, start, health-check, test, and stop
- no current-machine absolute path, username, browser state, or hidden local file is required
- Linux deployment differences and Owner-authority boundaries are explicit

## Forbidden

- real credentials, private CMS path values, production data, deployment, version, or Git writes
- product files outside the declared write set

## Handoff

Write the S52 handoff in Chinese and return directly to A00.
