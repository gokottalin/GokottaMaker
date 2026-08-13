# A59 Security Regression Evidence Brief

## Role

Temporary short-task workbench.

Chinese role note:
`安全与回归证据：复测私有入口、公开最小化、统一关系和响应式交互`

## Mission

Execute S50 after S45-S49 acceptance. Produce truthful release-readiness
evidence for both confirmed requirements without repairing product files.

## Allowed File Edits

- `scripts/run-security-formula-regression.js`
- `docs/security-formula-regression-evidence.md`
- `docs/codex-workline/slices/S50_security_regression_evidence_handoff.md`
- `package.json`

## Required Behavior

1. Run all dedicated and affected regressions in isolated data.
2. Verify public source/API/SEO/routes contain no forbidden content, draft, CMS
   capability, or secret value.
3. Verify private gateway rotation, 404 parity, HTTPS policy, auth, CSRF, rate
   limit, audit, and preserved Owner/data counts.
4. Verify formula binding migration, lifecycle, DAG, public/admin graph split,
   marker accessibility, and responsive rendering.
5. Report limitations and release blockers; do not hide repairs in QA.

## Forbidden

- product, server, migration, renderer, CMS, content, or style repairs
- current/production data, deployment, service, secret, version, or Git writes

## Handoff

Write the evidence and S50 handoff in Chinese, then return to A00 for acceptance.
