# A63 FinalCandidateGate Brief

## Role

Temporary short-task workbench.

Chinese role note:
`最终候选门禁：同步新版本、重建显式清单并在仓库外验证完整候选副本`

## Mission

After A00 accepts S51-S53, synchronize a new release identity, rebuild the
manifest, run security/portability/license/encoding/large-file audits, and
verify an equivalent clean candidate copy outside the repository. Do not stage
or publish.

## Allowed Edits

- release identity files explicitly named by the accepted S51 manifest
- `docs/final-git-manifest-20260813.json`
- `docs/final-repository-audit-20260813.md`
- `docs/final-release-gate-20260813.md`
- `docs/final-git-staging-plan-20260813.md`
- `scripts/verify-final-git-candidate.js`
- `package.json`
- `package-lock.json`
- `docs/codex-workline/slices/S54_final_candidate_gate_handoff.md`

## Done When

- candidate has a new internally consistent version/build identity
- manifest has zero review paths and explicit staging commands equal the include set
- secrets, runtime data, large files, encoding, paths, dependencies, and licenses pass
- an outside-repository candidate copy installs, initializes isolated data, starts, health-checks, and passes declared tests
- Git index, branch, remote, current/production data, services, and deployment remain unchanged

## Forbidden

- Git staging/commit/push or branch/remote/history changes
- current/production data, secrets, deployment, cloud, service, backup, restore, or cleanup
- files not named by this brief and the accepted S51 include manifest

## Handoff

Write the S54 handoff in Chinese and return directly to A00.
