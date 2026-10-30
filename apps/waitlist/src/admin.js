const form = document.querySelector('#export');
const key = document.querySelector('#key');
const status = document.querySelector('#status');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  status.textContent = 'Preparing your download…';
  try {
    const response = await fetch('/admin/waitlist.csv', {
      headers: { Authorization: `Bearer ${key.value.trim()}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Export unavailable. Check your key and try again.');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `okyo-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    key.value = '';
    status.textContent = 'Your CSV is downloaded.';
  } catch {
    status.textContent = 'Export unavailable. Check your key and try again.';
  } finally {
    button.disabled = false;
  }
});
