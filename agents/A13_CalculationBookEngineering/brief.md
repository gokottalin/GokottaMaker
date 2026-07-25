# A13 Calculation Book Engineering Brief

## Role

Temporary calculation-book engineering workbench. This Agent converts a power
electronics design request into one traceable calculation graph and generates
three synchronized outputs from it:

1. A local JSON calculation-book master.
2. A Mathcad 15 `.xmcd` worksheet.
3. A Larkix calculation sheet with layered formula derivations.

Chinese role note: `计算书撰写与详细计算细化专家：从输入输出条件完成拓扑总设计，并生成 JSON、MathCAD 与 Larkix 分层计算书`.

Recommended handoff and content language: Chinese. Use ASCII for schema keys,
IDs, slugs, filenames, and machine-readable expressions.

## Objective

Build a reusable calculation-book contract for an arbitrary power-electronics
topology. Given topology, operating mode, input/output ranges, efficiency,
switching frequency, ripple targets, thermal limits, derating rules, and known
parts, the calculation book must derive the information needed to size and
review the design, including relevant inductors or transformers, capacitors,
power-device stresses, losses, control boundaries, tolerance corners, and
verification requirements.

Use the existing CCM flyback material as the first reference implementation:

- `E:/User/Agent10_CCM反激变压器计算书_数据可追溯版_20260714.md`

The framework must remain topology-neutral. Topology-specific equations belong
in a book instance or topology library, not in the generic schema validator.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/slices/S03_api_runtime_boundary_handoff.md`
- `docs/codex-workline/slices/S04_markdown_docx_derivation_links_handoff.md`
- `docs/codex-workline/slices/S05_cms_knowledge_node_workflow_handoff.md`
- `docs/codex-workline/slices/S06_public_derivation_and_focus_mode_handoff.md`
- `docs/codex-workline/slices/S07_cms_formula_authoring_examples_handoff.md`
- `lib/db.js`
- `lib/content.js`
- `lib/validators.js`
- `data/markdown-renderer.js`
- `C:/Users/OBC项目/MathCAD生成规则.json`
- `C:/Users/OBC项目/Agent0/build_aux_mathcad_calculation_book.py`
- `C:/Users/OBC项目/Agent0/build_interview_hard_switch_pfc_xmcd.py`
- `C:/Users/OBC项目/Agent0/build_pfc_interview_xmcd.py`
- `C:/Users/OBC项目/Agent0/build_pfc_mathcad_xmcd.py`
- `E:/User/AUX20260708.xmcd`
- `E:/User/Agent10_CCM反激变压器计算书_数据可追溯版_20260714.md`

The OBC files are read-only references. Do not overwrite OBC Agent0 control
files or existing MathCAD generators.

## Allowed Outputs

- `schemas/calculation-book-master.schema.json`
- `content/calculation-books/**`
- `tools/calculation-book/**`
- `scripts/test-calculation-book.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`
- `docs/codex-workline/slices/S08_calculation_book_engineering_handoff.md`
- Generated `.xmcd` and validation reports under `E:/User/` using new,
  task-specific filenames only.

Do not edit `server.js`, `admin/`, `lib/`, migrations, deployment scripts,
existing OBC files, existing `E:/User/*.xmcd` files, current database files,
runtime data, uploads, or Git state.

## Canonical JSON Master

Create a JSON Schema and a reusable local template. Each concrete calculation
book must have one canonical UTF-8 JSON file such as:

`content/calculation-books/<book-slug>/calculation-book.json`

The master is the single calculation source. MathCAD and Larkix output must be
generated from this file, not maintained as separate handwritten calculation
chains.

At minimum, the master must model:

- `schemaVersion`, `bookId`, `slug`, `title`, `revision`, topology and mode.
- Design status, confidentiality, author/reviewer fields, and generated-output
  filenames.
- Input/output rails, operating ranges, efficiency, switching frequency,
  ambient and junction limits, ripple targets, tolerances, derating rules, and
  known components.
- A source registry with stable source IDs and precise locators.
- Inputs, constants, assumptions, equations, dependency links, calculated
  results, design decisions, selected values, margins, warnings, unresolved
  items, and validation measurements.
- Formula IDs, symbols, machine-readable expressions, display expressions,
  units, validity domains, rounding policy, corner cases, source references,
  and derivation references.
- Output mappings for MathCAD regions and Larkix nodes.

## No Unsupported Values

Every externally supplied value and formula must be traceable.

- User values use a source type such as `user_input` with date and context.
- Datasheet, standard, application-note, textbook, measurement, and project
  facts must reference a source ID and locator such as page, section, table,
  figure, equation, test record, or handoff field.
- Derived values must name the equation ID and input dependencies that produce
  them.
- Pure mathematical identities may use a derivation node instead of an
  external source.
- An unverified engineering assumption must be visibly marked `assumption`,
  explain why it is needed, quantify its effect where possible, and name the
  measurement or document that will replace it.
- Missing mandatory input stays `unresolved` and blocks affected sign-off
  conclusions. Never silently invent a typical value.
- Do not convert consistency scenarios, estimates, or interview examples into
  confirmed production facts.

The validator must fail when a required numeric input, constant, equation, or
selection lacks both a valid source path and a declared assumption/derivation.

## Complete Topology Design Coverage

The generic template must provide conditional sections so a topology instance
can cover every applicable design concern:

- Operating states, waveforms, duty/transfer ratio, and mode boundaries.
- Input/output power and current closure across min/nom/max conditions.
- Inductor, coupled-inductor, or transformer sizing; ripple; peak, valley,
  average, and RMS current; turns ratio; flux density; gap; copper and core
  losses where applicable.
- Input, output, DC-link, resonant, clamp, snubber, bootstrap, and hold-up
  capacitors as applicable, including capacitance, voltage rating, ripple
  current, ESR, RMS loss, tolerance, and lifetime/temperature considerations.
- MOSFET/IGBT/GaN/diode/rectifier voltage and current stress, conduction and
  switching loss, reverse recovery, gate-drive demand, SOA, avalanche or clamp
  exposure, thermal path, and derating as applicable.
- Current sensing, voltage sensing, gate drive, dead time, soft start,
  protection thresholds, and control-loop limitations such as slope
  compensation or RHP zero where applicable.
- Worst-case corner matrix, tolerance propagation, efficiency/loss budget,
  thermal closure, component requirement table, risks, and bench verification.

If a section is not applicable, the JSON must record `not_applicable` with a
reason instead of silently omitting it.

## Calculation Depth Contract

Every formula exposed on Larkix has an explicit depth:

- `L1_design`: the main design calculation. It shows engineering inputs,
  substitutions, results, selected standard values, margins, and conclusions.
  Examples: solve L, solve C, calculate peak current, or determine voltage
  rating.
- `L2_engineering_derivation`: explains how a topology-specific design formula
  is obtained from operating states and governing laws. Example: derive the
  flyback magnetizing-inductance sizing equation from volt-second balance,
  energy transfer, boundary condition, and efficiency assumptions.
- `L3_foundation_derivation`: proves a lower-level physical or mathematical
  dependency used by L2. Examples: triangular-wave RMS, inductor constitutive
  law integration, Faraday-law flux relation, or a mathematical identity.

Each L2/L3 node must name its parent formula, prerequisites, assumptions,
validity range, derivation steps, dimensional check, and return target. A
formula jump appears only when the target derivation exists. Larkix renders the
jump as the formula-level superscript marker delivered by S07.

## MathCAD Output Contract

Generate Mathcad 15 `.xmcd` from the canonical JSON and comply with
`C:/Users/OBC项目/MathCAD生成规则.json`.

- Calculations must be real MathCAD math regions, not formula-looking text.
- Put each major calculation section in its own expanded, bordered, unlocked
  Insert Area with valid top/bottom lock IDs and adequate height.
- Use one formula row followed by one compact Chinese explanation row.
- Use literal subscripts, MathCAD built-in units, `η`, real square-root nodes,
  explicit parentheses around nested add/subtract expressions, and united
  results with units.
- Do not emit prohibited flat names, `K.sqrt2`, hard-coded 1.414 approximations,
  custom unit aliases, or ambiguous `m`-prefix units listed by the rule file.
- Include source IDs, assumption status, applicability, and unresolved warnings
  in readable MathCAD text regions near the affected calculation.
- Never overwrite the input template or an existing worksheet. Write a new
  filename under `E:/User/` and record it in the handoff.

Prefer extracting reusable XML builders from the existing OBC generator
patterns into the new task-owned tool directory instead of copying an entire
topology-specific script unchanged.

## Larkix Output Contract

Generate a source-controlled Larkix content package from the same master:

- One top-level L1 calculation-sheet node per book.
- Separate reusable L2 and L3 derivation nodes with stable ASCII slugs.
- Formula-level `{{derive:slug|label|color}}` markers mapped from JSON, not
  inserted independently by hand.
- Chinese formulas, source notes, assumptions, confidence labels, and warnings
  without mojibake.
- Canonical publication status defaults to `draft` + `private`; an isolated
  preview may override it to `published` + `unlisted` without changing the
  master.
- Stable slugs and deterministic generation so re-running updates the same
  content instead of duplicating it.

Do not expose local absolute paths, usernames, private handoff metadata, or
confidential source locations in visitor Markdown. Use safe public source
labels while retaining detailed internal locators in the private JSON master.

## Required Tooling

Implement focused tools under `tools/calculation-book/` for:

- JSON Schema and semantic validation.
- Dependency-graph and cycle checks.
- Source/assumption/derivation coverage checks.
- Unit and applicability declarations.
- Deterministic MathCAD generation and XML/rule validation.
- Deterministic Larkix content-package generation.
- Cross-output consistency reporting.

Keep formula evaluation conservative. Do not build a general `eval` engine or
execute arbitrary code from JSON. Use a whitelisted expression AST or another
structured representation with explicit supported operators/functions.

## Administrator And Expert Workflow

Create `docs/calculation-book-authoring-guide.md` in Chinese. Explain:

1. Which design inputs the administrator must collect before calculation.
2. How source IDs, assumptions, formula IDs, and L1/L2/L3 nodes are written.
3. How one JSON master generates both MathCAD and Larkix outputs.
4. How to revise a book without changing its stable book ID or slugs.
5. How to preview Larkix with isolated data and inspect MathCAD locally.
6. How to review source coverage, unit closure, margins, unresolved inputs, and
   cross-output consistency before publication.
7. That A15 handles cloud synchronization after A00 accepts the intervening
   formula-catalog management task; A13
   must not deploy or write cloud data.

## First Reference Book

Use the existing CCM flyback source to prove the framework. The first book must
retain the distinctions between confirmed facts, user-confirmed values,
consistency calculations, assumptions, and missing measurements. The 6 V,
75 percent efficiency, and reflected-voltage scenario must remain clearly
identified as a consistency scenario rather than signed-off measured data.

At minimum, prove one L1 sizing chain, one L2 topology-specific derivation, and
one L3 foundational derivation. The L2 example should include a genuine
derivation of a flyback inductance/current formula, not a formula introduction.

## Verification

- JSON Schema validation passes for the template and reference book.
- Semantic validation reports zero missing source paths for confirmed design
  values and zero undeclared assumptions.
- Formula dependency graph is acyclic and all referenced symbols are defined.
- `node --check` passes for JavaScript tools and tests.
- Python syntax checks pass for MathCAD generators when Python is used.
- Generated `.xmcd` parses as XML and passes every applicable validation rule
  from `MathCAD生成规则.json`.
- Open the generated file in Mathcad 15 when available and record whether the
  title, Areas, math regions, Chinese text, units, and results render correctly.
- Larkix package validates and imports only into an isolated temporary
  `DATA_DIR`; verify L1, L2, and L3 routes and formula superscript jumps.
- Compare at least three sentinel results across JSON, MathCAD, and Larkix and
  record exact agreement or documented display rounding.
- `npm.cmd run test:calculation-book`, `npm.cmd run test:markdown`, and
  `npm.cmd run codex:contract` pass.
- Generated visitor content contains no private absolute paths or Agent handoff
  section.

## Stop Conditions

Stop and return to A00 if the work would require a database/schema change, new
API route, current or production data write, deployment-script change, cloud
access, Git staging/commit/push, or an unsupported value that materially
changes the design cannot be obtained or declared as an assumption.

## Handoff

Write `docs/codex-workline/slices/S08_calculation_book_engineering_handoff.md`
with `status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, master JSON path, generated MathCAD path, Larkix
slugs and preview URL, source-coverage summary, L1/L2/L3 examples, sentinel
consistency results, and `next_handoff` back to A00.
