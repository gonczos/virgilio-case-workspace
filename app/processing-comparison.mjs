import crypto from "node:crypto";

export const DEFAULT_COMPARISON_KIND = "normalized_text";

export function normalizeComparisonText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .replace(/\r\n?/gu, "\n")
    .replace(/\u00a0/gu, " ")
    .replace(/[ \t\f\v]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function tokenizeComparisonText(value) {
  return normalizeComparisonText(value)
    .toLowerCase()
    .match(/[\p{L}\p{N}./:-]+/gu) ?? [];
}

export function collectImportantTokens(value) {
  const matches = normalizeComparisonText(value).match(/\b[\p{L}\p{N}./:-]*\d[\p{L}\p{N}./:-]*\b/gu) ?? [];
  return [...new Set(matches)].sort();
}

function buildTokenSet(tokens) {
  return new Set(tokens);
}

function jaccard(leftTokens, rightTokens) {
  const left = buildTokenSet(leftTokens);
  const right = buildTokenSet(rightTokens);
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function stableHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function firstDifferentLine(leftText, rightText) {
  const leftLines = normalizeComparisonText(leftText).split("\n");
  const rightLines = normalizeComparisonText(rightText).split("\n");
  const maxLength = Math.max(leftLines.length, rightLines.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftLine = leftLines[index] ?? "";
    const rightLine = rightLines[index] ?? "";
    if (leftLine !== rightLine) {
      return {
        line_no: index + 1,
        left: leftLine,
        right: rightLine,
      };
    }
  }
  return null;
}

export function canonicalizeComparisonPair(leftRepresentationId, rightRepresentationId) {
  if (leftRepresentationId === rightRepresentationId) {
    throw new Error("Cannot compare a representation to itself");
  }
  const leftValue = BigInt(leftRepresentationId);
  const rightValue = BigInt(rightRepresentationId);
  return leftValue < rightValue
    ? [leftRepresentationId, rightRepresentationId]
    : [rightRepresentationId, leftRepresentationId];
}

export function buildComparisonObservation({
  leftLabel,
  rightLabel,
  leftText,
  rightText,
}) {
  const normalizedLeft = normalizeComparisonText(leftText);
  const normalizedRight = normalizeComparisonText(rightText);
  const leftTokens = tokenizeComparisonText(normalizedLeft);
  const rightTokens = tokenizeComparisonText(normalizedRight);
  const leftImportant = collectImportantTokens(normalizedLeft);
  const rightImportant = collectImportantTokens(normalizedRight);
  const leftImportantSet = new Set(leftImportant);
  const rightImportantSet = new Set(rightImportant);
  const onlyLeftImportant = leftImportant.filter((token) => !rightImportantSet.has(token)).slice(0, 25);
  const onlyRightImportant = rightImportant.filter((token) => !leftImportantSet.has(token)).slice(0, 25);
  const exactNormalizedMatch = normalizedLeft === normalizedRight;
  const tokenJaccard = jaccard(leftTokens, rightTokens);
  const charLengthDelta = Math.abs(normalizedLeft.length - normalizedRight.length);
  const charLengthRatio = Math.max(normalizedLeft.length, normalizedRight.length) === 0
    ? 1
    : Math.min(normalizedLeft.length, normalizedRight.length) / Math.max(normalizedLeft.length, normalizedRight.length);

  let disagreementLevel = "low";
  if (!exactNormalizedMatch && (tokenJaccard < 0.85 || charLengthRatio < 0.85 || onlyLeftImportant.length || onlyRightImportant.length)) {
    disagreementLevel = "high";
  } else if (!exactNormalizedMatch && (tokenJaccard < 0.97 || charLengthDelta > 250)) {
    disagreementLevel = "medium";
  }

  return {
    labels: [leftLabel, rightLabel],
    exact_normalized_match: exactNormalizedMatch,
    normalized_sha256: {
      [leftLabel]: stableHash(normalizedLeft),
      [rightLabel]: stableHash(normalizedRight),
    },
    normalized_char_count: {
      [leftLabel]: normalizedLeft.length,
      [rightLabel]: normalizedRight.length,
    },
    normalized_token_count: {
      [leftLabel]: leftTokens.length,
      [rightLabel]: rightTokens.length,
    },
    token_jaccard: Number(tokenJaccard.toFixed(6)),
    char_length_ratio: Number(charLengthRatio.toFixed(6)),
    disagreement_level: disagreementLevel,
    important_tokens_only: {
      [leftLabel]: onlyLeftImportant,
      [rightLabel]: onlyRightImportant,
    },
    first_different_line: firstDifferentLine(normalizedLeft, normalizedRight),
  };
}
