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

function toIdentifierSegment(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function createBlueprintName(blockId: string): string {
  const normalized = toIdentifierSegment(blockId);
  return normalized ? `${normalized}ReplacementBlueprint` : "ReplacementBlueprint";
}

function inferSectionTone(section: string, reason: string): string {
  const normalizedReason = reason.toLowerCase();

  if (section === "decisionPanel") {
    return "Create an explicit decision surface that replaces the rejected flat layout.";
  }

  if (section === "primaryCallout") {
    return "Lead with the highest-priority signal so the user sees the key state first.";
  }

  if (section === "messageStrip") {
    return "Use tighter copy and make the action intent legible without scanning supporting details.";
  }

  if (normalizedReason.includes("visual") || normalizedReason.includes("style") || normalizedReason.includes("颜色")) {
    return `Restyle ${section} so it looks intentionally different from the rejected version.`;
  }

  return `Rebuild ${section} around the rejection reason instead of inheriting the previous patch structure.`;
}

function inferSectionContent(section: string, reason: string): string[] {
  const normalizedReason = reason.toLowerCase();

  if (section === "header") {
    return [
      "Show the replacement goal in the title row.",
      `Reference the reject reason: ${reason}.`,
    ];
  }

  if (section === "decisionPanel") {
    return [
      "Split summary, next action, and rationale into separate rows.",
      "Make the replacement path visually dominant over supporting metadata.",
    ];
  }

  if (section === "executionRail") {
    return [
      "Expose current status, active step, and follow-up action in a vertical rail.",
      "Avoid collapsing execution details into a single generic paragraph.",
    ];
  }

  if (section === "primaryCallout") {
    return [
      "Place the most important status and CTA in one large callout block.",
      "Demote secondary context into a lighter supporting row.",
    ];
  }

  if (section === "statusRail") {
    return [
      "Stack state pills and timestamps beside the callout instead of beneath it.",
      "Keep the user eye-line on the primary state change.",
    ];
  }

  if (section === "messageStrip") {
    return [
      "Rewrite the message into one direct headline and one supporting sentence.",
      "Remove filler wording carried over from the rejected patch.",
    ];
  }

  if (section === "actionSummary") {
    return [
      "Summarize exactly what changed in the replacement patch.",
      "Tie each summary line back to the reject reason.",
    ];
  }

  if (normalizedReason.includes("copy") || normalizedReason.includes("wording") || normalizedReason.includes("文案")) {
    return [
      `Rewrite ${section} copy with shorter labels and direct action language.`,
      "Reduce generic phrasing and repeated explanatory text.",
    ];
  }

  return [
    `Restructure ${section} so it responds directly to the reject reason.`,
    "Keep the replacement visibly distinct from the superseded patch.",
  ];
}

function renderBlueprintSections(sections: string[], reason: string): string[] {
  return sections.flatMap((section) => [
    "  {",
    `    id: ${JSON.stringify(section)},`,
    `    title: ${JSON.stringify(toIdentifierSegment(section) || section)},`,
    `    tone: ${JSON.stringify(inferSectionTone(section, reason))},`,
    `    content: ${JSON.stringify(inferSectionContent(section, reason))},`,
    "  },",
  ]);
}

function renderBlueprintMarkup(sections: string[]): string[] {
  return [
    "export function renderReplacementStructure() {",
    "  return [",
    ...sections.map(
      (section) =>
        `    ${JSON.stringify(`<section class="replacement-${section}">${toIdentifierSegment(section) || section}</section>`)},`,
    ),
    "  ].join(\"\\n\");",
    "}",
  ];
}

export function createReplacementStructurePatch(
  options: ReplacementPatchInput,
  coderModel: string,
): string {
  const normalizedReason = normalizeReason(options.rejectionReason);
  const structuralChanges = inferStructuralChanges(normalizedReason);
  const replacementSections = inferReplacementSections(normalizedReason);
  const reasonAwareNotes = inferReasonAwareNotes(normalizedReason);
  const blueprintName = createBlueprintName(options.blockId);

  return [
    `// replacement-structure:${options.blockId}`,
    `export const ${blueprintName} = {`,
    `  blockId: '${options.blockId}',`,
    `  targetPath: '${options.targetPath}',`,
    "  strategy: 'replace_structure',",
    `  rejectionReason: ${JSON.stringify(normalizedReason)},`,
    `  previousPatchSummary: ${JSON.stringify(options.rejectedPatch.split("\n")[0] ?? "")},`,
    `  replacementPrompt: ${JSON.stringify(options.suggestedPrompt)},`,
    `  structuralChanges: ${JSON.stringify(structuralChanges)},`,
    `  reasonAwareNotes: ${JSON.stringify(reasonAwareNotes)},`,
    "  sections: [",
    ...renderBlueprintSections(replacementSections, normalizedReason),
    "  ],",
    `  avoid: ${JSON.stringify([
      "Do not fall back to the rejected patch structure.",
      "Do not treat the replacement as a copy-only cleanup when the rejection asks for broader changes.",
    ])},`,
    `  coderModel: '${coderModel}',`,
    "};",
    "",
    `export const ${blueprintName}Title = ${JSON.stringify(
      `${options.blockId} replacement derived from reject reason`,
    )};`,
    "",
    "export const replacementPatchInstructions = [",
    ...structuralChanges.map((change) => `  ${JSON.stringify(change)},`),
    ...reasonAwareNotes.map((note) => `  ${JSON.stringify(note)},`),
    "];",
    "",
    ...renderBlueprintMarkup(replacementSections),
  ].join("\n");
}
