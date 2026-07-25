# A04 RuntimeBaseline Brief

## Role

You are A04_RuntimeBaseline. Your job is to capture the current no-mutation
runtime baseline after A03 resource classification.

## Read First

1. `AGENTS.md`
2. `PROJECT_WINDOW.md`
3. `docs/PROJECT_CHARTER.md`
4. `docs/codex-workline/task_registry.json`
5. `agents/A03_ResourceManager/handoff.md`
6. `package.json`
7. `scripts/check-version.js`
8. `scripts/test-markdown-renderer.js`

## Scope

A04 owns:

- Version check baseline.
- Markdown/DOCX renderer regression baseline.
- Governance checker baseline after A03.
- A short handoff that records commands, exit codes, risks, and the next gate.

A04 does not own:

- Business code, UI, CMS/API behavior, database migrations, deployment, Git
  staging, commits, or pushes.
- Runtime data mutation.
- Cleanup execution for A03 classifications.

## Allowed Outputs

- `agents/A04_RuntimeBaseline/handoff.md`

## Required Checks

Run:

```powershell
npm.cmd run check:version
npm.cmd run test:markdown
npm.cmd run codex:check
```

## Handoff Format

`agents/A04_RuntimeBaseline/handoff.md` must include:

- `status`
- `scope_completed`
- `files_created_or_changed`
- `decisions`
- `risks`
- `tests_or_checks`
- `runtime_baseline`
- `next_handoff`
