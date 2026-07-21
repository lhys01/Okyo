export type ShareLifecycle = 'ready' | 'preparing' | 'shared' | 'copied' | 'cancelled' | 'failed';

export function getShareStatusCopy(state: ShareLifecycle) {
  switch (state) {
    case 'preparing': return { title: 'Preparing your card', body: 'Okyo is making a crisp image for the share sheet.' };
    case 'shared': return { title: 'Share complete', body: 'Your Okyo card was handed off successfully.' };
    case 'copied': return { title: 'Caption copied', body: 'It is ready to paste wherever you share.' };
    case 'cancelled': return { title: 'Share cancelled', body: 'Nothing was posted. Your preview is still here.' };
    case 'failed': return { title: 'Could not share yet', body: 'Your preview is safe. Try again or copy the caption instead.' };
    case 'ready':
    default: return { title: 'Ready to share', body: 'Choose an image or copy the caption.' };
  }
}
