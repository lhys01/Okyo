# Image upload privacy controls

Engineering evidence only. This note does not make a vendor-retention claim or
replace a privacy policy.

Before a food image is uploaded, Okyo uses Expo Image Manipulator to produce a
bounded JPEG (maximum width 1280 on the first pass, with progressively smaller
fallbacks). It then scans the JPEG structure and removes every APP0–APP15 and
COM segment before accepting the bytes for the outbound data URL. This removes
EXIF, GPS, XMP, IPTC, JFIF/vendor application blocks, JPEG comments, and any
original filename stored in those segments. Entropy-coded image data, dimensions
and JPEG quality are otherwise not changed by the sanitizer.

If the output is malformed or cannot be sanitized, the client omits the image
payload and reports a friendly recoverable processing error instead of sending
the original file. Scan request serialization also excludes the local URI,
original filename, and original file size. The only scanner filename retained
in local metadata is `okyo-scan-upload.jpg`.

The regression fixture in
`apps/mobile/src/utils/imageUploadPrivacy.test.ts` includes EXIF/GPS-like and
device-comment payloads. It proves that the accepted upload contains neither
metadata segment and none of the fixture strings.

This describes the app-to-Okyo-service boundary. It does not establish how the
service, any configured AI provider, device backups, or a user-saved recipe
retain data. Those points require the corresponding deployment, vendor, and
legal review.
