# Next Agents

## Next Step For The User

Use this short handoff in a fresh Codex session:

```text
Agent 14 Formula Catalog Management（公式目录与管理：确保全部子公式可跳转、公式唯一、多级标签、修订与备份）：请进入 E:\Project\2607-LarkixWeb，运行 npm.cmd run codex:handoff，然后按输出的 Next Agent brief 执行当前任务；使用中文交接，遵守 AGENTS.md 门禁。
```

Current next task: `A14_FormulaCatalogManagement`.

S09 is open for strict formula identity, required namespaced and optional
hierarchical tags, complete L1/L2/L3 child-formula jumps, focused CMS
search/filter/relationships, deterministic catalog export, and pre-change local
snapshots. Migrations, current or production data, cloud writes, deployment,
and Git staging remain closed.

The detailed task contract lives in:

- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `agents/A14_FormulaCatalogManagement/brief.md`
- `docs/codex-workline/slices/S08_calculation_book_engineering_handoff.md`

## Agent After That

After A14 completes and A00 accepts formula identity, full jump coverage,
hierarchical tags, CMS management, and local backup evidence, A00 may open
`A15_ContentCloudSync`. A15 will synchronize accepted generated content to the
cloud with backup and idempotent-update gates. A14 must not deploy.

Teacher instruction:

```text
Use the accepted JSON masters as the source of formula identity and hierarchy.
Every visible formula and subformula must have one stable canonical identity,
one valid route, required strict tags, and a real derivation target. Reject
duplicates and dangling links. Preserve existing revisions and soft-delete
recovery, add deterministic catalog export and pre-change snapshots, and prove
the workflow only with isolated local data.
```
