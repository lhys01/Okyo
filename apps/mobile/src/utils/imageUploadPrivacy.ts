/**
 * The scanner uploads a freshly encoded JPEG, never the original camera or
 * library file. Strip JPEG APP and comment segments as a second, deterministic
 * guard so EXIF, GPS, XMP, IPTC, and device metadata cannot leave the device.
 */
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export const SANITIZED_SCAN_UPLOAD_FILE_NAME = 'okyo-scan-upload.jpg';

export function sanitizeJpegBase64ForUpload(base64: string | null | undefined): string | undefined {
  if (typeof base64 !== 'string') return undefined;
  const bytes = decodeBase64(base64);
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;

  const output: number[] = [0xff, 0xd8];
  let index = 2;
  while (index < bytes.length) {
    const markerStart = index;
    if (bytes[index] !== 0xff) return undefined;
    while (index < bytes.length && bytes[index] === 0xff) index += 1;
    if (index >= bytes.length) return undefined;

    const marker = bytes[index];
    index += 1;
    // Start Of Scan begins entropy-coded data, where marker-like bytes are
    // ordinary image data. Copy the remainder unchanged.
    if (marker === 0xda) {
      // A JPEG that begins a scan but never terminates is not safe to forward.
      // The EOI marker is required to keep a truncated source from bypassing
      // the structural validation above.
      if (bytes.length < markerStart + 4 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
        return undefined;
      }
      output.push(...bytes.slice(markerStart));
      return encodeBase64(new Uint8Array(output));
    }
    if (marker === 0xd9) {
      output.push(...bytes.slice(markerStart, index));
      return encodeBase64(new Uint8Array(output));
    }
    // Standalone markers do not carry a two-byte segment length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      output.push(...bytes.slice(markerStart, index));
      continue;
    }
    if (index + 1 >= bytes.length) return undefined;
    const segmentLength = (bytes[index] << 8) | bytes[index + 1];
    const segmentEnd = index + segmentLength;
    if (segmentLength < 2 || segmentEnd > bytes.length) return undefined;

    // APP0–APP15 contain JFIF/EXIF/GPS/XMP/IPTC/vendor metadata. JPEG comments
    // can also carry identifying information. Neither is required for vision.
    const isMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) output.push(...bytes.slice(markerStart, segmentEnd));
    index = segmentEnd;
  }

  return undefined;
}

export function jpegContainsMetadataSegments(base64: string): boolean | undefined {
  const bytes = decodeBase64(base64);
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let index = 2;
  while (index < bytes.length) {
    if (bytes[index] !== 0xff) return undefined;
    while (index < bytes.length && bytes[index] === 0xff) index += 1;
    if (index >= bytes.length) return undefined;
    const marker = bytes[index];
    index += 1;
    if (marker === 0xda || marker === 0xd9) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (index + 1 >= bytes.length) return undefined;
    const segmentLength = (bytes[index] << 8) | bytes[index + 1];
    const segmentEnd = index + segmentLength;
    if (segmentLength < 2 || segmentEnd > bytes.length) return undefined;
    if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) return true;
    index = segmentEnd;
  }
  return undefined;
}

function decodeBase64(value: string): Uint8Array | undefined {
  const clean = value.replace(/\s/g, '');
  if (!clean || clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return undefined;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((clean.length / 4) * 3 - padding);
  let outputIndex = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const first = BASE64_ALPHABET.indexOf(clean[index]);
    const second = BASE64_ALPHABET.indexOf(clean[index + 1]);
    const third = clean[index + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(clean[index + 2]);
    const fourth = clean[index + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(clean[index + 3]);
    if (first < 0 || second < 0 || third < 0 || fourth < 0) return undefined;
    const group = (first << 18) | (second << 12) | (third << 6) | fourth;
    if (outputIndex < bytes.length) bytes[outputIndex++] = (group >> 16) & 0xff;
    if (outputIndex < bytes.length) bytes[outputIndex++] = (group >> 8) & 0xff;
    if (outputIndex < bytes.length) bytes[outputIndex++] = group & 0xff;
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let chunk = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    chunk += BASE64_ALPHABET[first >> 2];
    chunk += BASE64_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    chunk += second === undefined ? '=' : BASE64_ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    chunk += third === undefined ? '=' : BASE64_ALPHABET[third & 0x3f];
    if (chunk.length >= 8192) {
      chunks.push(chunk);
      chunk = '';
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks.join('');
}
