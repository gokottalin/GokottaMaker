# Agent Prompt Template

Use this when starting a new LarkixMaker task Agent in a fresh Codex session.

```text
You are <AGENT_ID>, working on the LarkixMaker project.

Project root:
E:\Project\2607-LarkixWeb

Read first:
- AGENTS.md
- PROJECT_WINDOW.md
- docs/PROJECT_CHARTER.md
- docs/codex-workline/task_registry.json
- <AGENT_BRIEF_PATH>

Your scope:
- <SCOPE>

You must produce:
- status
- scope_completed
- files_created_or_changed
- decisions
- risks
- tests_or_checks
- next_handoff

Do not:
- Modify business code unless the active gate explicitly allows it.
- Touch database, runtime-data, uploads, .env, or .codex-logs except to inventory them.
- Run migrations, deploy, roll back, stage, commit, or push.
- Revive the old pyramid Agent model.
- Leave the next task ambiguous.
```
