const pages = [
  ['https://okyoapp.com/privacy', 'Privacy Policy'],
  ['https://okyoapp.com/terms', 'Terms of Service'],
  ['https://okyoapp.com/support', 'support.okyo@gmail.com'],
  ['https://okyoapp.com/delete-account', 'Delete your Okyo account or data'],
];
let failed = false;
for (const [url, expected] of pages) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const html = await response.text();
    if (!response.ok || !response.url.startsWith('https://') ||
        !response.headers.get('content-type')?.includes('text/html') ||
        !html.includes(expected) || /sign in to continue|data-draft="legal"|not yet in effect/i.test(html)) {
      throw new Error('Public page does not meet the release requirements');
    }
    console.log(`Public HTTPS page verified: ${url}`);
  } catch {
    failed = true;
    console.error(`Cannot verify the public release page without login: ${url}`);
  }
}
if (failed) process.exitCode = 1;
