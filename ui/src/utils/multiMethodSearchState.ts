export type MultiSearchMethod = "document_text" | "recorded_references" | "both";
export type TextResultOrder = "relevance" | "earliest_occurrence_asc" | "latest_occurrence_desc";

export function participatingSections(method: MultiSearchMethod) {
  return {
    text: method === "document_text" || method === "both",
    references: method === "recorded_references" || method === "both",
  };
}

export function isCurrentSectionRequest(
  currentGeneration: number,
  currentRequestId: number,
  responseGeneration: number,
  responseRequestId: number,
) {
  return currentGeneration === responseGeneration && currentRequestId === responseRequestId;
}

export interface TextOrderState {
  displayedSort: TextResultOrder;
  requestedSort: TextResultOrder;
  sorting: boolean;
  sortError: string | null;
}

export function beginTextOrderReplacement(state: TextOrderState, requestedSort: TextResultOrder): TextOrderState {
  return { ...state, requestedSort, sorting: true, sortError: null };
}

export function completeTextOrderReplacement(state: TextOrderState): TextOrderState {
  return { ...state, displayedSort: state.requestedSort, sorting: false, sortError: null };
}

export function failTextOrderReplacement(state: TextOrderState, sortError: string): TextOrderState {
  return { ...state, sorting: false, sortError };
}
