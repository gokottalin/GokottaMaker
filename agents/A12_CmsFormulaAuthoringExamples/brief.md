# A12 CmsFormulaAuthoringExamples Brief

## Role

Improve CMS-side formula-node authoring and produce a visible Chinese BOOST
inductor selection calculation sheet. A12 is a narrow authoring/rendering slice
that builds on A08 APIs, A09 Markdown math/derive rendering, A10 CMS workflow,
and A11 visitor derivation pages.

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
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `derive.html`
- `post.js`
- `data/markdown-renderer.js`
- `scripts/test-markdown-renderer.js`
- `styles/20-content.css`
- `styles/30-accessibility-print.css`

## Allowed Outputs

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `data/markdown-renderer.js`
- `scripts/test-markdown-renderer.js`
- `post.js`
- `styles/20-content.css`
- `styles/30-accessibility-print.css`
- `docs/codex-workline/slices/S07_cms_formula_authoring_examples_handoff.md`

## Scope

- Make the CMS knowledge-node workflow practical for create, edit, publish,
  draft, soft-delete, restore, and revision restore during local testing.
- Add formula-authoring affordances in the admin editor, such as inline math,
  display math, derivation-jump insertion, and a small formula/snippet library.
- Ensure the admin preview renders Chinese text, formulas, and derive links
  without mojibake or layout breakage.
- Make the first visible example a calculation sheet, not a bare derivation
  graph. The top-level public node should be a Chinese engineering calculation
  note such as `boost-inductor-selection-sheet` / `BOOST 电感选型计算书`.
- In the calculation sheet, formulas may be used directly as engineering
  conclusions. Detailed derivations should be reachable from a small formula
  jump marker instead of interrupting the sheet.
- Provide a complete local-only BOOST topology inductor-design calculation
  sheet and supporting derivation nodes that can be created through the admin
  API or CMS during verification. The visible example should include Chinese
  titles/content, formulas, and linked derivation nodes, for example:
  - `boost-inductor-selection-sheet`: the first-page calculation sheet.
  - `boost-duty-cycle-ccm`: duty cycle estimate.
  - `boost-inductor-ripple`: inductor ripple current.
  - `boost-inductor-value`: inductance selection.
  - `boost-inductor-current-rating`: average/peak current and saturation
    margin.
  - `boost-inductor-options`: practical selection options and tradeoffs.
- Include at least one pure math/theory supporting node, for example
  `math-double-angle-formula`, displayed as `纯数学推导 - 二倍角公式` or an
  equivalent Chinese title.
- The example chain must be visible on the visitor derivation page after local
  isolated DATA_DIR seeding.

## Derivation Jump Marker Acceptance

- The CMS must let the editor insert and mark a formula/detail jump. The editor
  should be able to choose or type target slug, label, and visual type/color.
- The public page must render the jump as a formula-level superscript marker,
  similar to a square/power exponent attached to the formula itself. It must not
  look like a normal pill link, a card button, or a control floating at the
  corner of the whole formula block.
- For display math, the marker should sit at the upper-right of the rendered
  formula expression or formula line. For inline math, it should appear
  immediately after the formula as a superscript-like affordance.
- The visual marker should be a small circle with a return/enter-arrow meaning,
  for example a compact `↵` mark inside the circle.
- Hover/focus text should clearly say something like `纹波公式详细推导` or
  `${label}详细推导`.
- Engineering derivations can keep the existing warm/technical style.
- Pure math derivations should be visually distinguishable, for example blue,
  white, or neutral theory styling, and the page title/category should make the
  theory nature obvious.
- Print or DOCX fallback may degrade to readable text such as
  `纹波公式详细推导 [derive:boost-inductor-ripple]`.
- Prefer extending the existing `{{derive:slug|label|color}}` behavior and CMS
  insertion helpers before inventing new data fields. Stop and return to A00 if
  a backend schema/API change becomes necessary.

## Derivation Page Acceptance

- A formula jump target is a derivation page, not a formula-introduction page.
  It must answer "how is this formula derived?"
- For `boost-duty-cycle-ccm`, the target page should be titled like
  `BOOST 占空比公式推导`, not merely `BOOST 占空比公式`.
- The duty-cycle derivation page must derive the formula from CCM inductor
  volt-second balance, with steps equivalent to:
  1. During switch on-time, inductor voltage is approximately `V_L,on = V_in`.
  2. During switch off-time, inductor voltage is approximately
     `V_L,off = V_in - V_out`.
  3. Steady-state volt-second balance:
     `V_in * D * T_s + (V_in - V_out) * (1 - D) * T_s = 0`.
  4. Solve to get the ideal BOOST relation
     `V_out = V_in / (1 - D)`, therefore `D = 1 - V_in / V_out`.
  5. Explain that the calculation sheet may use the practical estimate
     `D ≈ 1 - (V_in * eta) / V_out` when efficiency is folded into the design
     estimate.
- The page should name assumptions and boundaries, such as CCM operation,
  steady state, ideal switch/diode for the ideal derivation, and efficiency
  correction as an engineering approximation.
- The same rule applies to pure math targets: `纯数学推导 - 二倍角公式` should
  show the mathematical derivation of the identity, not just define or describe
  the identity.

## Formula Acceptance

At minimum, the local example must show formulas equivalent to:

```text
D = 1 - (Vin * eta) / Vout
Delta I_L = Vin * D / (L * fs)
L >= Vin * D / (Delta I_L * fs)
I_L,avg = Iout / (1 - D)
I_L,peak = I_L,avg + Delta I_L / 2
```

Use Markdown math syntax already supported by the existing renderer, such as
inline `$...$` and display `$$...$$`.

## Chinese Compatibility Requirements

- New visible UI labels, example titles, summaries, warnings, and handoff text
  should be Chinese-friendly UTF-8 without BOM.
- Do not introduce mojibake. If a file containing Chinese is edited, verify it
  by reading it through Node with UTF-8 or by checking rendered local pages.
- Keep code identifiers ASCII.
- Do not rely on browser default encodings; preserve existing
  `<meta charset="UTF-8">` behavior.

## Forbidden

- Do not edit `server.js`, `lib/`, `tools/md2doc.js`, migrations, production
  database files, protected runtime paths, release scripts, deployment state, or
  Git state.
- Do not create or run production migrations.
- Do not write sample BOOST content into the real project database. Use only an
  isolated temporary `DATA_DIR` for preview seeding.
- Do not delete hidden pages, seed content, historical Agent docs, assets, or
  routes.
- Stop and return to A00 if the work requires new backend API fields or database
  schema changes.

## Done When

- The admin CMS can create, edit, publish/draft, soft-delete, restore, and load
  revisions for formula/derivation nodes in the current UI.
- The admin editor has usable formula and derivation-jump insertion helpers.
- A Chinese `BOOST 电感选型计算书` is seeded in an isolated local preview and
  visible through `derive.html` as the first example experience.
- The calculation sheet shows formulas first, with detailed derivations hidden
  behind formula jump markers.
- At least one engineering formula jump and one pure math formula jump are
  visible, hoverable/focusable, and route to their detailed derivation pages.
- Formula jumps are rendered as superscript-like markers attached to formulas,
  not as ordinary text links or block-level card controls.
- The `boost-duty-cycle-ccm` page derives the BOOST duty-cycle formula from CCM
  inductor volt-second balance and clearly separates ideal derivation from the
  efficiency-adjusted design estimate.
- The pure math detail page is clearly labeled, for example
  `纯数学推导 - 二倍角公式`.
- `node --check admin/admin.js` passes.
- `npm.cmd run test:markdown` passes.
- `npm.cmd run codex:contract` passes.
- A browser or HTTP smoke check confirms:
  - `/admin/` still loads.
  - `/derive.html?slug=boost-inductor-selection-sheet` or the chosen top-level
    calculation-sheet node loads.
  - Chinese text and formulas render without mojibake.
  - The formula jump marker has a tooltip/title or accessible label containing
    `详细推导`.
- The S07 handoff records status, scope, files changed, decisions, risks,
  checks, local preview URL, seeded example slugs, and next handoff back to A00.
