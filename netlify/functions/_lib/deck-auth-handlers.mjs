/* Autenticação de acesso do cliente a um deck com senha (independente da chave
   de edição). Token = "<expiry>.<hmac>", assinado com PALESTRA_EDIT_KEY como
   segredo — sem necessidade de um segredo extra. TTL de 24h. */
import { hmacHex, hmacEquals } from "./edit-key.mjs";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function issueToken(slug, secret) {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const sig = hmacHex(`${slug}:${expiry}`, secret);
  return `${expiry}.${sig}`;
}

export function verifyToken(slug, token, secret) {
  if (!secret || typeof secret !== "string") return false;
  if (!token || typeof token !== "string" || token.indexOf(".") === -1) return false;
  const [expiryStr, sig] = token.split(".");
  const expiry = Number(expiryStr);
  if (!expiry || Number.isNaN(expiry) || Date.now() > expiry) return false;
  const expected = hmacHex(`${slug}:${expiry}`, secret);
  return hmacEquals(sig, expected);
}

export function checkPassword(senha, senhaHash, secret) {
  if (!secret || typeof secret !== "string") return false;
  if (!senha || typeof senha !== "string" || !senhaHash) return false;
  return hmacEquals(hmacHex(senha, secret), senhaHash);
}
