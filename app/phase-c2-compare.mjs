import {
  buildComparisonObservation as buildGenericComparisonObservation,
  collectImportantTokens,
  normalizeComparisonText,
  tokenizeComparisonText,
} from "./processing-comparison.mjs";

export {
  collectImportantTokens,
  normalizeComparisonText,
  tokenizeComparisonText,
};

export function buildComparisonObservation({ leftEngine, rightEngine, leftText, rightText }) {
  const observation = buildGenericComparisonObservation({
    leftLabel: leftEngine,
    rightLabel: rightEngine,
    leftText,
    rightText,
  });
  return {
    engines: observation.labels,
    ...observation,
  };
}
