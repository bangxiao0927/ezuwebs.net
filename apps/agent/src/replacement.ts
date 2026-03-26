export interface ReplacementPatchInput {
  blockId: string;
  targetPath: string;
  suggestedPrompt: string;
  rejectedPatch: string;
  rejectionReason: string;
}

export function normalizeReason(reason: string): string {
  return reason.trim().replace(/\s+/g, " ");
}

export function inferStructuralChanges(reason: string): string[] {
  const normalizedReason = reason.toLowerCase();
  const changes: string[] = [];

  if (
    normalizedReason.includes("layout") ||
    normalizedReason.includes("结构") ||
    normalizedReason.includes("hierarchy") ||
    normalizedReason.includes("层级")
  ) {
    changes.push("Rebuild the block hierarchy instead of tweaking labels in place.");
  }

  if (
    normalizedReason.includes("copy") ||
    normalizedReason.includes("文案") ||
    normalizedReason.includes("wording") ||
    normalizedReason.includes("text")
  ) {
    changes.push("Rewrite the visible copy so the replacement communicates the requested intent directly.");
  }

  if (
    normalizedReason.includes("visual") ||
    normalizedReason.includes("style") ||
    normalizedReason.includes("颜色") ||
    normalizedReason.includes("样式")
  ) {
    changes.push("Change the visual treatment so the replacement is distinguishable from the rejected version.");
  }

  if (
    normalizedReason.includes("focus") ||
    normalizedReason.includes("emphasis") ||
    normalizedReason.includes("priority") ||
    normalizedReason.includes("突出")
  ) {
    changes.push("Reorder emphasis so the most important state or action is surfaced first.");
  }

  if (changes.length === 0) {
    changes.push("Restructure the block around the rejection reason instead of reusing the prior patch shape.");
  }

  return changes;
}

function inferReplacementSections(reason: string): string[] {
  const normalizedReason = reason.toLowerCase();
  const sections = ["statusBar", "primaryContent", "supportingMeta"];

  if (normalizedReason.includes("layout") || normalizedReason.includes("结构")) {
    return ["header", "decisionPanel", "executionRail", "supportingMeta"];
  }

  if (normalizedReason.includes("focus") || normalizedReason.includes("priority") || normalizedReason.includes("突出")) {
    return ["header", "primaryCallout", "statusRail", "supportingMeta"];
  }

  if (normalizedReason.includes("copy") || normalizedReason.includes("wording") || normalizedReason.includes("文案")) {
    return ["header", "messageStrip", "actionSummary", "supportingMeta"];
  }

  return sections;
}

function inferReasonAwareNotes(reason: string): string[] {
  const normalizedReason = reason.toLowerCase();
  const notes = ["Build a fresh replacement instead of editing around the rejected patch."];

  if (normalizedReason.includes("layout") || normalizedReason.includes("hierarchy") || normalizedReason.includes("层级")) {
    notes.push("Promote structure changes ahead of wording changes.");
  }

  if (normalizedReason.includes("copy") || normalizedReason.includes("text") || normalizedReason.includes("文案")) {
    notes.push("Rewrite visible strings so the replacement explains the intended action more directly.");
  }

  if (normalizedReason.includes("focus") || normalizedReason.includes("emphasis") || normalizedReason.includes("priority")) {
    notes.push("Move the highest-priority signal into the first visible section.");
  }

  if (normalizedReason.includes("visual") || normalizedReason.includes("style") || normalizedReason.includes("颜色")) {
    notes.push("Change styling tokens so the replacement reads as a deliberate redesign.");
  }

  return notes;
}

export function createReplacementStructurePatch(
  options: ReplacementPatchInput,
  coderModel: string,
): string {
  const normalizedReason = normalizeReason(options.rejectionReason);
  const structuralChanges = inferStructuralChanges(normalizedReason);
  const replacementSections = inferReplacementSections(normalizedReason);
  const reasonAwareNotes = inferReasonAwareNotes(normalizedReason);

  return [
    `// replacement-structure:${options.blockId}`,
    "export const replacementStructurePatchPreview = {",
    `  blockId: '${options.blockId}',`,
    `  targetPath: '${options.targetPath}',`,
    "  strategy: 'replace_structure',",
    `  rejectionReason: ${JSON.stringify(normalizedReason)},`,
    `  previousPatchSummary: ${JSON.stringify(options.rejectedPatch.split("\n")[0] ?? "")},`,
    `  replacementPrompt: ${JSON.stringify(options.suggestedPrompt)},`,
    `  replacementSections: ${JSON.stringify(replacementSections)},`,
    `  structuralChanges: ${JSON.stringify(structuralChanges)},`,
    `  reasonAwareNotes: ${JSON.stringify(reasonAwareNotes)},`,
    `  avoid: ${JSON.stringify([
      "Do not fall back to the rejected patch structure.",
      "Do not treat the replacement as a copy-only cleanup when the rejection asks for broader changes.",
    ])},`,
    `  coderModel: '${coderModel}',`,
    "};",
    "",
    "export const replacementPatchInstructions = [",
    ...structuralChanges.map((change) => `  ${JSON.stringify(change)},`),
    ...reasonAwareNotes.map((note) => `  ${JSON.stringify(note)},`),
    "];",
  ].join("\n");
}
