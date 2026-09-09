import { createHmac, timingSafeEqual } from "node:crypto";

// fail closed: sem chave de edição configurada, nenhuma escrita passa.
export function isValidEditKey(provided, expected) {
  return typeof expected === "string" && expected.length > 0 &&
    typeof provided === "string" && provided === expected;
}

export function hmacHex(value, secret) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function hmacEquals(a, b) {
  const bufA = Buffer.from(a || "", "hex");
  const bufB = Buffer.from(b || "", "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
