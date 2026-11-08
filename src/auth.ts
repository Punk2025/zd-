const COOKIE = "geo_panel_session";

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(sig);
}

export async function createSessionCookie(password: string, secure = true): Promise<string> {
  const exp = Date.now() + 7 * 24 * 3600_000;
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ exp })));
  const sig = await hmacSign(password, payload);
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${secure ? "; Secure" : ""}`;
  return `${COOKIE}=${payload}.${sig}; ${flags}`;
}

export function clearSessionCookie(secure = true): string {
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
  return `${COOKIE}=; ${flags}`;
}

export async function isAuthed(request: Request, password: string | undefined): Promise<boolean> {
  if (!password) return false;
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match?.[1]) return false;
  const [payload, sig] = match[1].split(".");
  if (!payload || !sig) return false;
  const expected = await hmacSign(password, payload);
  if (!timingSafeEqual(sig, expected)) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as { exp?: number };
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa[i]! ^ bb[i]!;
  return out === 0;
}

export { COOKIE };
