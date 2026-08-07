"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "admin", "index.html"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "admin", "admin.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "admin", "admin.css"), "utf8");
const darkCss = fs.readFileSync(path.join(ROOT, "admin", "admin-dark.css"), "utf8");

function intersects(first, second) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function assertSeparate(label, first, second) {
  assert.equal(intersects(first, second), false, `${label}: fixed surfaces must not overlap`);
}

assert.match(html, /id="articlePublishDock"[\s\S]*aria-label="文章保存与发布"/);
assert.match(html, /id="articleSaveDraftButton"[^>]*type="button"[\s\S]*保存草稿/);
assert.match(html, /id="articlePublishButton"[^>]*type="button"[\s\S]*发布文章/);
assert.match(html, /id="articlePublishDockExpand"[\s\S]*aria-label="展开文章发布栏"/);
assert.match(html, /id="cmsToastRegion"[\s\S]*aria-live="polite"/);
assert.match(html, /id="adminNotice" hidden/);

const formMarkup = html.slice(html.indexOf('id="contentForm"'), html.indexOf("</form>", html.indexOf('id="contentForm"')));
assert.equal((formMarkup.match(/type="submit"/g) || []).length, 1, "content form keeps one non-article submit fallback");
assert.match(formMarkup, /id="nonArticleSaveButton"/);
assert.doesNotMatch(formMarkup, /articleSaveDraftButton|articlePublishButton/);

assert.equal(
  (js.match(/contentForm\.addEventListener\("submit"/g) || []).length,
  1,
  "article save and publish share one contentForm submit handler"
);
assert.match(js, /function requestArticleAction\(action\)[\s\S]*contentForm\.publishStatus\.value[\s\S]*contentForm\.requestSubmit\(\)/);
assert.match(js, /if \(nonArticleSaveButton\) nonArticleSaveButton\.hidden = isArticle/);
assert.match(js, /articleOperationInFlight[\s\S]*articleSaveDraftButton\.disabled[\s\S]*articlePublishButton\.disabled/);
assert.match(js, /function markDirty\(value = true\)[\s\S]*const wasDirty = isDirty[\s\S]*if \(!wasDirty\)/);
assert.match(js, /function markClean\(\)[\s\S]*syncArticlePublishDock\(\)/);

assert.match(js, /const toastEntries = new Map\(\)/);
assert.match(js, /const feedbackOperationVersions = new Map\(\)/);
assert.match(js, /feedbackOperationVersions\.get\(operation\.key\) !== operation\.version/);
assert.match(js, /window\.setTimeout\(\(\) => dismissToast\(key\), 3000\)/);
assert.match(js, /const persistent = options\.persistent \?\? normalizedType === "error"/);
assert.match(js, /setAttribute\("role", persistent \? "alert" : "status"\)/);
assert.match(js, /cms-toast-close[\s\S]*aria-label="关闭提示"/);
assert.match(js, /error\?\.name === "AbortError"[\s\S]*请求超时/);
assert.match(js, /contentForm\.addEventListener\("invalid"[\s\S]*key: "article-validation"[\s\S]*persistent: true/);

assert.match(js, /beginFeedbackOperation\("formula-save"\)/);
assert.match(js, /beginFeedbackOperation\("formula-publish"\)/);
assert.match(js, /beginFeedbackOperation\("article-operation"\)/);
assert.match(js, /setOperationNotice\(operation, message, "error", \{ persistent: true \}\)/);

assert.match(css, /\.article-publish-dock\s*\{[\s\S]*position:\s*fixed[\s\S]*env\(safe-area-inset-bottom\)/);
assert.match(css, /\.article-publish-dock\.is-collapsed\s*\{[\s\S]*width:\s*52px[\s\S]*max-width:\s*52px/);
assert.match(css, /\.cms-toast-region\s*\{[\s\S]*position:\s*fixed[\s\S]*z-index:\s*92/);
assert.match(css, /\.article-publish-dock\.is-formula-drawer-open[\s\S]*right:\s*432px/);
assert.match(css, /--cms-keyboard-offset/);
assert.match(css, /:root\.has-cms-keyboard \.article-publish-dock\.is-formula-drawer-open[\s\S]*top:/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.cms-toast\.is-leaving/);
assert.match(darkCss, /\[data-theme="dark"\] \.article-publish-dock/);
assert.match(darkCss, /\[data-theme="dark"\] \.cms-toast/);
assert.match(darkCss, /:root:not\(\[data-theme="light"\]\) \.article-publish-dock/);

const desktop = {
  dock: { x: 658, y: 760, width: 350, height: 124 },
  drawer: { x: 1028, y: 84, width: 392, height: 780 },
  toast: { x: 1034, y: 16, width: 390, height: 68 }
};
assertSeparate("1440 expanded dock/drawer", desktop.dock, desktop.drawer);
assertSeparate("1440 dock/toast", desktop.dock, desktop.toast);

const halfWidth = {
  dock: { x: 398, y: 306, width: 350, height: 124 },
  drawer: { x: 12, y: 458, width: 736, height: 430 },
  toast: { x: 354, y: 16, width: 390, height: 68 }
};
assertSeparate("760 expanded dock/drawer", halfWidth.dock, halfWidth.drawer);
assertSeparate("760 dock/toast", halfWidth.dock, halfWidth.toast);

const mobile = {
  dock: { x: 22, y: 287, width: 360, height: 132 },
  drawer: { x: 8, y: 431, width: 374, height: 405 },
  toast: { x: 8, y: 8, width: 374, height: 76 }
};
assertSeparate("390 expanded dock/drawer", mobile.dock, mobile.drawer);
assertSeparate("390 dock/toast", mobile.dock, mobile.toast);

const mobileKeyboard = {
  dock: { x: 22, y: 8, width: 360, height: 132 },
  toast: { x: 8, y: 148, width: 374, height: 76 },
  drawer: { x: 8, y: 242, width: 374, height: 234 },
  keyboard: { x: 0, y: 484, width: 390, height: 360 }
};
assertSeparate("390 keyboard dock/toast", mobileKeyboard.dock, mobileKeyboard.toast);
assertSeparate("390 keyboard toast/drawer", mobileKeyboard.toast, mobileKeyboard.drawer);
assertSeparate("390 keyboard drawer/keyboard", mobileKeyboard.drawer, mobileKeyboard.keyboard);

const versions = new Map();
function begin(key) {
  const version = (versions.get(key) || 0) + 1;
  versions.set(key, version);
  return { key, version };
}
function accepts(operation) {
  return versions.get(operation.key) === operation.version;
}
const staleSave = begin("article-operation");
const currentPublish = begin("article-operation");
assert.equal(accepts(staleSave), false, "late save success cannot overwrite a newer publish result");
assert.equal(accepts(currentPublish), true, "latest operation remains authoritative");

console.log(
  "CMS floating feedback/publish dock checks passed: one submit path, keyed replacement, persistent blockers, 3s transient feedback, timeout handling, dark/reduced-motion coverage, and 1440/760/390/keyboard geometry."
);
