import test from "node:test";
import assert from "node:assert/strict";

import { createReplacementPrompt } from "./replacement.js";

test("createReplacementPrompt injects rejection reason and replacement constraints", () => {
  const prompt = createReplacementPrompt(
    "Update page block hero at main > header.topbar.",
    "layout hierarchy is confusing",
  );

  assert.match(prompt, /Rejected because: layout hierarchy is confusing\./);
  assert.match(prompt, /Redo the patch from scratch based on that rejection reason\./);
  assert.match(prompt, /Do not reuse the previous structure if it conflicts with the rejection reason\./);
});
