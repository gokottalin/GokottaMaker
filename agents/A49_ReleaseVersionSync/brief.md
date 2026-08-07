# A49 ReleaseVersionSync Brief

## Role

Temporary short-task workbench.

Chinese role note:
`发布版本同步：为已验收批次递增唯一版本与静态资源 build`

## Mission

Advance the accepted 2026-07-30 batch from the HEAD identity
`V2.5.2+20260730-0012` to the unique patch identity
`V2.5.3+20260807-0001`, keeping package, server, site metadata, README, MD2File
icon cache key, and every HTML resource cache key synchronized.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/release-git-gate-20260730.md`
- `docs/codex-workline/slices/S41_release_git_gate_handoff.md`
- `scripts/check-version.js`

## Allowed Edits

- `404.html`
- `category.html`
- `admin/course-paths.html`
- `admin/index.html`
- `data/miniapps.js`
- `data/site-meta.js`
- `projects.html`
- `project.html`
- `post.html`
- `package.json`
- `package-lock.json`
- `miniapps.html`
- `index.html`
- `maker.html`
- `README.md`
- `server.js`
- `tools/gokotta-elec.html`
- `tools/larkix-elec.html`
- `tools/md2doc.html`
- `derive.html`
- `docs/codex-workline/slices/S41A_release_version_sync_handoff.md`

You are the only active writer for this list. Preserve all accepted content
inside these files and perform version substitutions only.

## Required Outputs

- site version `V2.5.3`
- package version `2.5.3`
- build `20260807-0001`
- all HTML resource query versions synchronized
- Chinese handoff with exact verification evidence

## Verification

- `npm.cmd run check:version`
- old version/build residue scan across the allowed runtime paths
- `npm.cmd run test:batch-regression`
- strict UTF-8, diff, secret, index-empty, and Codex contract checks

## Forbidden

- files outside the declared write set
- feature, content, layout, API, database, migration, or test behavior changes
- current/production data, cloud, deployment, service, backup, restore, rollback, or physical cleanup actions
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick

## Handoff

Write `docs/codex-workline/slices/S41A_release_version_sync_handoff.md` in
Chinese and return directly to `A00_ProjectDirector`.
