# A62 EncryptedDataHandoff Brief

## Role

Temporary short-task workbench.

Chinese role note:
`加密数据交接：设计并用隔离样本验证 Git 之外的数据备份、校验与恢复`

## Mission

Provide an executable encrypted backup and restore workflow for optional
database and upload transfer without storing backup bodies or decryption
material in Git.

## Allowed Edits

- `scripts/export-encrypted-handoff.ps1`
- `scripts/restore-encrypted-handoff.ps1`
- `docs/encrypted-data-handoff.md`
- `docs/codex-workline/slices/S53_encrypted_data_handoff.md`

## Done When

- isolated sample database/uploads can be encrypted, checksummed, restored, and count-compared
- backup output and keys remain outside the repository and are ignored
- responsibility, recovery order, key delivery, rotation, and failure behavior are documented
- production/current data are never read or modified during verification

## Forbidden

- real production data, secrets, backup bodies, deployment, version, product, or Git writes
- files outside the declared write set

## Handoff

Write the S53 handoff in Chinese and return directly to A00.
