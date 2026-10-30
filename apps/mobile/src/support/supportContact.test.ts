import assert from 'node:assert/strict';
import test from 'node:test';

import { openSupportEmail, SUPPORT_EMAIL, SUPPORT_MAILTO_URL } from './supportContact';

test('support contact opens the official address with a mailto URL', async () => {
  assert.equal(SUPPORT_EMAIL, 'support.okyo@gmail.com');
  assert.equal(SUPPORT_MAILTO_URL, 'mailto:support.okyo@gmail.com');

  const opened: string[] = [];
  await openSupportEmail(async (url) => { opened.push(url); });
  assert.deepEqual(opened, ['mailto:support.okyo@gmail.com']);
});
