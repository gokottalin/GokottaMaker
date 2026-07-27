# Requirement Clarification Protocol

## Purpose

A18 converts informal Owner requests into confirmed, testable inputs for A00.
This is an intake gate, not an implementation layer and not a new branch in the
project hierarchy.

## State Machine

```text
draft
  -> questioning
  -> awaiting_user_confirmation
  -> user_confirmed
  -> dispatched
```

`superseded` and `cancelled` are terminal states. A material edit to a confirmed
package returns it to `awaiting_user_confirmation` and clears its confirmation.

## Storage

Store one active request at:

```text
docs/codex-workline/requirements/active/<requirementId>.json
```

Use IDs such as `REQ-20260726-001`. Do not place credentials, private keys,
cookies, raw production records, or unnecessary personal data in a package.

## Interview Rules

- Ask one to three questions per round.
- Prioritize questions that change user-visible behavior, data ownership,
  compatibility, security, cost, release scope, or acceptance.
- Record facts as confirmed only when the Owner supplied or approved them.
- Record a temporary interpretation as an assumption, never as a fact.
- Stop questioning when remaining technical choices can safely be delegated to
  A00 and the implementing workbench.
- Present the complete requirement summary before asking for confirmation.

## Confirmation

1. Set the package to `awaiting_user_confirmation`.
2. Run `npm.cmd run codex:requirement -- digest <package.json>`.
3. Show the summary and digest to the Owner.
4. After explicit approval, record the exact approval text and timestamp, set
   `confirmation.confirmed` to `true`, copy the digest, and set status to
   `user_confirmed`.
5. Run `npm.cmd run codex:requirement -- validate <package.json>`.

Changing title, intent, scope, behavior, criteria, constraints, evidence,
questions, assumptions, risks, or priority changes the digest and requires new
Owner confirmation.

## Machine Handoff

Run:

```powershell
npm.cmd run codex:requirement -- emit <package.json>
```

Output is one compact JSON line:

```json
{"protocol":"larkix.requirement-handoff.v1","event":"requirement.user_confirmed","requirementId":"REQ-20260726-001","briefPath":"docs/codex-workline/requirements/active/REQ-20260726-001.json","digest":"sha256:...","target":"A00_ProjectDirector"}
```

Send only this envelope between Agents. A00 must load the referenced package,
verify the digest, and decide sequence, file boundaries, acceptance gates, and
implementation assignment. A18 must not attach implementation instructions to
the envelope.

## Commands

```powershell
npm.cmd run codex:requirement -- digest <package.json>
npm.cmd run codex:requirement -- validate <package.json>
npm.cmd run codex:requirement -- emit <package.json>
npm.cmd run codex:requirement -- selftest
```
