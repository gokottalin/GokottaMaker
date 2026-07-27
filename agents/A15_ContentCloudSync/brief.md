# A15 Content Cloud Sync Brief

## Role

Temporary content-package cloud-sync integration workbench.

Chinese role note: `内容云端同步：把已验收内容包安全接入云端部署与幂等更新`.

## Objective

Implement S10 after A00 accepts S17. Add a safe, dry-run-first path that can
package accepted calculation-book content, verify checksums, require a backup
before import, update by stable slug idempotently, and stop with actionable
rollback guidance on failure.

This task prepares the cloud workflow only. It must not connect to production,
write cloud data, deploy, or mutate the current database.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/slices/S08_calculation_book_engineering_handoff.md`
- `docs/codex-workline/slices/S09_formula_catalog_management_handoff.md`
- `docs/codex-workline/slices/S17_carousel_focus_buffer_handoff.md`
- `docs/calculation-book-authoring-guide.md`
- `tools/calculation-book`
- `scripts/deploy-update.sh`
- `scripts/backup-linux.sh`
- `scripts/restore-linux.sh`
- `docs/deployment.md`

Stop unless A00 accepted S17 and `npm.cmd run codex:handoff` points to A15.

## Allowed Outputs

- `scripts/content-sync-cloud.sh`
- `scripts/deploy-update.sh`
- `scripts/gokottamaker.env.example`
- `docs/deployment.md`
- `docs/codex-workline/slices/S10_content_cloud_sync_handoff.md`

Do not edit application schema, migrations, CMS/runtime code, current or
production data, credentials, release state, or Git state.

## Sync Contract

- The default command is dry-run and performs no remote write.
- Package inputs are explicit, validated, and checksum-locked before transfer.
- Apply mode must require explicit operator intent, successful backup evidence,
  and a matching package checksum.
- Re-importing the same stable slug and payload is idempotent; changed payloads
  update only the named content package.
- Partial failure stops the workflow, reports the last safe checkpoint, and
  prints rollback instructions without automatically mutating production.
- Secrets remain environment-provided; example files contain placeholders only.
- `deploy-update.sh` may call the sync workflow only through the same gates and
  must not weaken existing backup or health-check behavior.

## Verification

- Run shell syntax checks for every changed shell file.
- Rehearse dry-run and apply logic only against a new isolated Linux-compatible
  `DATA_DIR` or disposable local fixture; prove no network/cloud write occurs.
- Prove checksum mismatch, missing backup evidence, duplicate import, and
  partial-failure stop behavior.
- Run `npm.cmd run test:calculation-book` and `npm.cmd run codex:contract`.

## Handoff

Write `docs/codex-workline/slices/S10_content_cloud_sync_handoff.md` in Chinese
with the standard fields plus command matrix, dry-run evidence, backup/checksum
gates, idempotency evidence, failure/rollback behavior, files changed, tests,
remaining production boundary, and next handoff to A00.
