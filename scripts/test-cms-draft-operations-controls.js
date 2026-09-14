"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("admin/index.html");
const js = read("admin/admin.js");
const css = read("admin/admin.css");
const dark = read("admin/admin-dark.css");

function contains(source, pattern, label) {
  assert.match(source, pattern, label);
}

contains(js, /larkixmaker_admin_autodraft_v2/, "draft storage is versioned");
contains(js, /draftStorageKey\(kind, identity\)/, "draft key includes content kind and identity");
contains(js, /stableDraftId\("new-article"\)/, "new articles receive stable draft identities");
contains(js, /stableDraftId\("new-formula"\)/, "new formulas receive stable draft identities");
contains(js, /contentBaselineToken\("article", item\)/, "article draft records a server baseline");
contains(js, /contentBaselineToken\("formula", card\)/, "formula draft records a revision baseline");
contains(js, /pendingArticleDraftConflict/, "article conflict has explicit state");
contains(js, /pendingFormulaDraftConflict/, "formula conflict has explicit state");
contains(html, /保留服务器内容（安全默认）/, "conflict UI states the safe default");
contains(js, /pendingArticleDraftConflict\.record\?\.identity === draft\.identity[\s\S]*baseToken === draft\.baseToken/, "article conflict uses stable value equality");
contains(js, /pendingFormulaDraftConflict\.record\?\.identity === draft\.identity[\s\S]*baseToken === draft\.baseToken/, "formula conflict uses stable value equality");
contains(js, /pendingArticleDraftConflict\?\.record\?\.identity === identity[\s\S]*saveConflictServerEdit\("article"/, "article conflict writes server-side edits to an independent working identity");
contains(js, /pendingFormulaDraftConflict\?\.record\?\.identity === identity[\s\S]*saveConflictServerEdit\("formula"/, "formula conflict writes server-side edits to an independent working identity");
contains(js, /function preserveConflictLocalSide[\s\S]*conflictRole: "preserved-local"/, "conflict local side can be preserved under an independent recovery identity");
contains(js, /keepServerDraftButton[\s\S]*preserveConflictLocalSide\("article"[\s\S]*conflict\.workingIdentity/, "article keep-server preserves both conflict sides");
contains(js, /keepServerFormulaDraftButton[\s\S]*preserveConflictLocalSide\("formula"[\s\S]*conflict\.workingIdentity/, "formula keep-server preserves both conflict sides");
contains(js, /restoreSelectedArticleDraftButton[\s\S]*restoreDraft: false[\s\S]*applySnapshotToForm\(record\.snapshot/, "article picker explicitly applies the selected conflict branch");
contains(js, /restoreSelectedFormulaDraftButton[\s\S]*restoreDraft: false[\s\S]*applyFormulaDraftSnapshot\(record\.snapshot/, "formula picker explicitly applies the selected conflict branch");
contains(js, /window\.addEventListener\("beforeunload"/, "tab close and refresh are guarded");
contains(js, /window\.addEventListener\("popstate"/, "browser back is guarded");
contains(js, /function replaceAdminViewHash[\s\S]*window\.history\.replaceState[\s\S]*window\.location\.pathname[\s\S]*window\.location\.search/, "internal draft restoration replaces the editor hash without creating a navigation event");
contains(js, /applyItemToForm\("post", serverItem, \{ confirm: false, restoreDraft: true, internalRestoreNavigation: true \}\)/, "existing-article startup restoration uses internal hash replacement");
contains(js, /已自动恢复新建文章表单[\s\S]*replaceAdminViewHash\("editor"\)/, "new-article startup restoration uses internal hash replacement");
contains(js, /if \(internalRestoreNavigation\) replaceAdminViewHash\("editor"\);[\s\S]*else window\.location\.hash = "editor"/, "ordinary editor navigation retains its normal route behavior");
contains(js, /document\.addEventListener\("click"[\s\S]*本地草稿会保留/, "in-site navigation is guarded");
contains(js, /if \(isDirty\) saveDraft\(\);\s*if \(formulaDirty\) saveFormulaDraft\(\);/, "each editor persists only its own dirty state");
assert.doesNotMatch(js, /saveDraft\(\);\s*saveFormulaDraft\(\);/, "cross-editor navigation never overwrites an unrelated draft");
contains(js, /clearFormulaDraft\(savedDraftIdentity\)[\s\S]*populateFormulaEditor/, "formula draft clears only after successful request");
contains(js, /const result = await request\(endpoint[\s\S]*clearDraft\(\)/, "article draft clears only after successful request");
contains(js, /saveFormulaDraft\(\)[\s\S]*request\(endpoint/, "formula validation and request failures retain a local copy");

for (const type of ["article", "project", "formula", "derivation", "focus", "miniapp"]) {
  contains(js, new RegExp(`${type.replace("-", "\\-")}:`), `${type} common-level control is declared`);
}
contains(js, /\/api\/admin\/discovery\/common-level/, "common levels use the S63 authority endpoint");
contains(js, /commonLevel: input\.value/, "blank and invalid values are sent to S63 without duplicated normalization");
assert.doesNotMatch(js, /commonLevel\s*\?\?\s*5/, "CMS consumes the S63 common-level DTO without duplicating its default");
contains(js, /min="1" max="10" step="1"/, "level inputs expose the S63 integer boundary");

contains(html, /data-admin-nav="operations"/, "operations has a stable CMS navigation entry");
contains(js, /"formulas", "operations", "carousel"/, "operations is accepted by the CMS view router");
contains(html, /id="homepageFocusSlots"/, "homepage focus has a dedicated editor");
contains(js, /\["large", "small-1", "small-2"\]/, "three stable homepage slots are explicit");
contains(js, /new Set\(slots\.map\(\(item\) => item\.postId\)\)\.size !== 3/, "duplicate focus posts are blocked");
contains(js, /publishStatus === "published"/, "focus choices filter to published articles");
contains(js, /\/api\/admin\/homepage-focus/, "focus save uses S63 authority");
assert.doesNotMatch(js, /heroCarousel[\s\S]{0,120}saveHomepageFocus/, "focus save does not modify Hero state");

contains(html, /id="removeDerivationCoverButton"/, "derivation cover can be unlinked");
contains(html, /公开端回退预览/, "missing cover clearly previews the public fallback");
contains(js, /上传文件不会被物理删除/, "cover unlink explains non-destructive behavior");
contains(js, /isKnowledgeType\(getType\(\)\)/, "cover control is scoped to derivation nodes");

contains(css, /\.common-level-manager[\s\S]*min-width: 0/, "operations layout resists horizontal overflow");
contains(css, /@media \(max-width: 760px\)[\s\S]*common-level-manager/, "operations layout is responsive");
contains(dark, /draft-status\.is-conflict/, "draft conflict has a dark-theme treatment");

console.log("S64 CMS draft and operations static checks passed: isolated versioned drafts, conflict gates, six levels, derivation cover fallback, three focus slots, responsive themes");
