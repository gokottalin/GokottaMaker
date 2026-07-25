# A00 ProjectDirector Handoff

Status: active planning line, broad business implementation closed.

The project is moving away from the old pyramid Agent model. Existing
`docs/Agent*` material remains valuable evidence, but it should not be treated
as active ownership. New work should flow through short task agents with clear
inputs, allowed edits, outputs, and verification.

Current facts:

- Batch1 remains closed for broad business implementation, production release,
  Git staging, commit, and push.
- S02 additive migration implementation is accepted.
- S03 API/runtime boundary is accepted.
- S04 Markdown/DOCX derivation shortcode work is accepted.
- S05 CMS admin knowledge-node workflow is accepted.
- S06 is open only for visitor frontend derivation page and focused navigation
  edits.
- `A01_ProjectStateRetriever`, `A02_ContractValidator`,
  `A03_ResourceManager`, `A04_RuntimeBaseline`, and
  `A05_ImplementationSlicePlanner`, `A06_DataModelMigrationContract`,
  `A07_DataModelMigrationImplementation`, `A08_ApiRuntimeBoundary`,
  `A09_MarkdownDocxDerivationLinks`, and `A10_CmsKnowledgeNodeWorkflow` are
  complete.
- `S00_batch1_open_dispatch` is complete.
- The latest accepted handoff is
  `docs/codex-workline/slices/S05_cms_knowledge_node_workflow_handoff.md`.
- Fresh-session handoffs should use the short `npm.cmd run codex:handoff`
  pattern and begin with Agent number, English role, and Chinese note.
- Owner instruction: Codex should act as Agent 00 Project Director and execute
  A00-scoped governance work directly in this thread when asked.

Next task:

`A11_PublicDerivationAndFocusMode`

Purpose:

- Implement public derivation pages and focused visitor navigation using
  existing A08 APIs, A09 shortcode output, and A10 CMS workflow output.
- Keep server/API routes, database, migrations, CMS admin files,
  Markdown/DOCX renderer internals, current database/runtime data, production
  release, deployment, and Git staging closed.
- Return to A00 for acceptance before content/SEO visibility policy work opens.

Allowed outputs:

- `PROJECT_WINDOW.md`
- `docs/prompts/next_agents.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `.codex/larkix-governance.json`
- `scripts/codex-governance.js`
- `agents/A11_PublicDerivationAndFocusMode/brief.md`
- `.codex/agents/a11-public-derivation-and-focus-mode.toml`

Verification:

```powershell
npm.cmd run codex:check
```
