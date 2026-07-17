// fail closed: sem PORTOBELLO_EDIT_KEY configurada, nenhuma escrita passa.
export function isValidEditKey(provided, expected) {
  return typeof expected === "string" && expected.length > 0 &&
    typeof provided === "string" && provided === expected;
}
