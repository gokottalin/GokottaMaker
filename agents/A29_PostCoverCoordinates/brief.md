# A29 Post Cover Coordinates Brief

## Role

Temporary reversible article-cover crop workbench.

Chinese role note:
`文章封面坐标：用可拖动、四角等比缩放的 16:9 框保存可还原坐标，并在网页无失真回放`.

## Mission

Implement `REQ-20260728-001` after A00 accepts S21. Replace the current
destructive canvas-to-JPEG crop upload with a reversible coordinate model:
retain the original image, store normalized crop coordinates, and replay the
same 16:9 source region across CMS and public article surfaces without image
distortion.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/active/REQ-20260728-001.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- `docs/codex-workline/slices/S21_legacy_formula_migration_safety_handoff.md`
- `migrations/001_initial_schema.js`
- `migrations/007_content_revisions.js`
- `lib/content.js`
- `lib/validators.js`
- `data/media.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `main.js`
- `category-page.js`
- `post.js`
- `agents/A29_PostCoverCoordinates/brief.md`

## Allowed Edits

- `migrations/024_post_cover_coordinates.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `data/media.js`
- `styles.css`
- `styles/25-cover-crop.css`
- `main.js`
- `category-page.js`
- `post.js`
- `scripts/test-post-cover-coordinates.js`
- `package.json`
- `docs/post-cover-coordinates.md`
- `docs/codex-workline/slices/S22_post_cover_coordinates_handoff.md`

Do not edit `styles/20-content.css`; it contains pre-existing work and remains
reserved for its later owner.

## Data Contract

- Migration `024` adds nullable normalized crop coordinates and the source
  intrinsic width/height needed to validate and replay a 16:9 source region.
- Public/admin post DTOs use one object:
  `coverCrop: { x, y, width, height, sourceWidth, sourceHeight }`, or `null`.
- Coordinates are finite normalized values in `[0, 1]`; width and height are
  positive, the rectangle stays inside the image, source dimensions are
  positive bounded integers, and the source-pixel rectangle is 16:9 within a
  documented tolerance.
- All crop fields are null together or valid together. Old posts safely return
  `coverCrop: null`.
- Post saves, revisions, restores, export, local drafts, and API responses
  preserve the object exactly. Resetting crop sets only the crop fields to null
  and does not change the original cover URL.

## CMS Interaction

- Selecting a new image opens the crop editor using the original local image.
  Applying uploads that original file once and stores only its URL plus crop
  coordinates. Never call `canvas.toDataURL` to create a cropped replacement.
- Existing article covers can reopen with saved coordinates, be adjusted, and
  be reset to full original image without uploading or deleting the original.
- Show the whole source image in a stable stage. The 16:9 frame is visible,
  movable by dragging its body, and resizable from all four corners while
  preserving 16:9 and staying inside the valid image bounds.
- Outside the frame is grayscale and Gaussian-blurred; inside remains clear and
  full color. The saved-preview region must match the frame.
- Pointer, touch, keyboard, Escape/cancel, focus restoration, and unsaved draft
  behavior are deterministic. Save/publish controls remain operable.

## Public Rendering

- Extend the shared media helper instead of duplicating crop math in each page.
- Homepage post cards, lesson/focus entries, category post cards, and the post
  hero consume the same coordinates.
- The crop is replayed from the original image at desktop, half-width, and
  mobile sizes. Do not stretch or squash the image.
- Existing no-crop posts, optimized picture sources, projects, derivation
  covers, and non-16:9 focused-card containers remain compatible. Do not force
  every focused card to become 16:9.

## Verification

- Add and run `npm.cmd run test:post-cover-coordinates`.
- Prove migration 024 is additive and old posts remain valid.
- Test validator all-or-none behavior, finite/bounds/aspect checks, round-trip,
  revision/restore, reset, and malformed payload rejection.
- Compare original upload URL and bytes before/after crop save and adjustment;
  no new cropped image or original overwrite/delete is allowed.
- Browser-test horizontal, vertical, square, and ultra-wide images; frame move,
  all four corner resizes, edge clamps, reopen, reset, desktop, 50% width, and
  mobile layouts.
- Pixel-check frame ratio and clear/colored interior versus grayscale/blurred
  exterior, plus public no-distortion replay and no horizontal overflow.
- Run API, relevant post/content/media, Markdown, formula, and contract
  regressions. Record console and network errors.

## Forbidden

- Cropped image generation, `canvas.toDataURL` upload, original overwrite, or
  original deletion.
- Project/knowledge-node crop schema or forced 16:9 focused-card redesign.
- Legacy cleanup, reading-time, inline-math, media-fit, dark-theme, or unrelated
  refactors.
- `styles/20-content.css`.
- Current/production data, cloud, deployment, restore, rollback, Git staging,
  commit, push, or branch/remote changes.

## Handoff

Write `docs/codex-workline/slices/S22_post_cover_coordinates_handoff.md` in
Chinese with status, schema, coordinate math, image-byte preservation proof,
interaction matrix, responsive/pixel evidence, files, commands, risks,
protected boundaries, and direct `next_handoff` to `A00_ProjectDirector`.
