export function shouldRestartTextSearchForSort({
  initialSearchPending,
  submittedMode,
}: {
  initialSearchPending: boolean;
  submittedMode: "reference" | "text" | null;
}) {
  return !initialSearchPending && submittedMode === "text";
}
