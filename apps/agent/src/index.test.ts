import test from "node:test";
import assert from "node:assert/strict";

import {
  createReplacementStructurePatch,
  inferStructuralChanges,
  normalizeReason,
  type ReplacementPatchInput,
} from "./replacement.js";

function createOptions(rejectionReason: string): ReplacementPatchInput {
  return {
    blockId: "hero",
    targetPath: "apps/web/src/index.ts",
    suggestedPrompt: "Replace the hero block from scratch.",
    rejectedPatch: "// old patch\nconst previous = true;",
    rejectionReason,
  };
}

test("normalizeReason trims and collapses whitespace", () => {
  assert.equal(normalizeReason("  layout   is \n unclear  "), "layout is unclear");
});

test("inferStructuralChanges reacts to layout-related rejection reasons", () => {
  assert.deepEqual(inferStructuralChanges("layout hierarchy is wrong"), [
    "Rebuild the block hierarchy instead of tweaking labels in place.",
  ]);
});

test("createReplacementStructurePatch changes output based on rejection reason", () => {
  const layoutPatch = createReplacementStructurePatch(createOptions("layout hierarchy is wrong"), "gpt-test");
  const copyPatch = createReplacementStructurePatch(createOptions("copy is too generic"), "gpt-test");

  assert.notEqual(layoutPatch, copyPatch);
  assert.match(layoutPatch, /"decisionPanel"/);
  assert.match(layoutPatch, /Promote structure changes ahead of wording changes\./);
  assert.match(copyPatch, /"messageStrip"/);
  assert.match(copyPatch, /Rewrite visible strings so the replacement explains the intended action more directly\./);
});
