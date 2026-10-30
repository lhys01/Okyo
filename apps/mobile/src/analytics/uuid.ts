// ponytail: Math.random uuid v4 — fine for anonymous analytics / correlation
// ids (not security tokens). Swap to expo-crypto's randomUUID if collision
// risk ever matters. Kept dependency-free so it is importable from the
// node:test runner (no react-native / native module imports).
export function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
