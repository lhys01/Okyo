import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SANITIZED_SCAN_UPLOAD_FILE_NAME,
  jpegContainsMetadataSegments,
  sanitizeJpegBase64ForUpload,
} from './imageUploadPrivacy';

function metadataFixtureBase64(): string {
  const bytes = Uint8Array.from([
    0xff, 0xd8,
    // APP1: EXIF/GPS-like payload.
    0xff, 0xe1, 0x00, 0x11, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x47, 0x50, 0x53, 0x3d, 0x33, 0x37, 0x2e, 0x37, 0x37,
    // COM: device-like payload.
    0xff, 0xfe, 0x00, 0x0d, 0x69, 0x50, 0x68, 0x6f, 0x6e, 0x65, 0x2d, 0x31, 0x35, 0x2d, 0x50,
    // A minimal non-metadata DQT segment followed by scan data.
    0xff, 0xdb, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x01, 0x02, 0xff, 0x00, 0x03, 0xff, 0xd9,
  ]);
  return Buffer.from(bytes).toString('base64');
}

test('sanitized upload JPEG removes EXIF/GPS, comments, and original filename metadata', () => {
  const fixture = metadataFixtureBase64();
  assert.equal(jpegContainsMetadataSegments(fixture), true);

  const sanitized = sanitizeJpegBase64ForUpload(fixture);
  assert.ok(sanitized);
  assert.equal(jpegContainsMetadataSegments(sanitized), false);

  const payloadText = Buffer.from(sanitized, 'base64').toString('latin1');
  assert.doesNotMatch(payloadText, /Exif|GPS=|iPhone-15-P/);
  assert.equal(SANITIZED_SCAN_UPLOAD_FILE_NAME, 'okyo-scan-upload.jpg');
});

test('malformed JPEG input is rejected instead of being uploaded unsanitized', () => {
  assert.equal(sanitizeJpegBase64ForUpload('not-a-jpeg'), undefined);
  assert.equal(sanitizeJpegBase64ForUpload(''), undefined);
  const truncated = Buffer.from(metadataFixtureBase64(), 'base64').subarray(0, -2).toString('base64');
  assert.equal(sanitizeJpegBase64ForUpload(truncated), undefined);
});
