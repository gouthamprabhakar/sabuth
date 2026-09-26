export const teamNames = ['Prabhakar', 'Preetham', 'Raghu', 'Junior2', 'Junior3'] as const;
export function canonicalName(value: unknown) {
  return typeof value === 'string' ? teamNames.find(name => name.toLowerCase() === value.trim().toLowerCase()) : undefined;
}
const encoder = new TextEncoder();
export function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}
export async function digest(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256'}, key, 256));
}
export function equalHash(a: string, b: string) {
  if (a.length !== 64 || b.length !== 64) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function sessionCookie(token: string, secure: boolean, maxAge = 604800) {
  return `sabuth_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
export function readSessionCookie(value: string | null) {
  const token = value?.split(';').map(part => part.trim()).find(part => part.startsWith('sabuth_session='))?.slice(15);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
