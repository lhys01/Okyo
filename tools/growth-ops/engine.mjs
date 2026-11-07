// Okyo Growth Ops: pure calculations. No API calls or money movement.
export const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
export const cents = (value) => Math.round((Number(value) || 0) * 100);
export const dollars = (value) => '$' + (Number(value || 0) / 100).toFixed(2);
export const number = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0));
export const monthKey = (date) => String(date || '').slice(0, 7);
export const safeNumber = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

export function csvRows(input) {
  const rows = [];
  let row = [], value = '', quoted = false;
  const text = String(input || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') { quoted = !quoted; }
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(value); if (row.some(v => v.trim() !== '')) rows.push(row);
      row = []; value = '';
    } else value += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted cell.');
  row.push(value); if (row.some(v => v.trim() !== '')) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim());
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate headings.');
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error('Row ' + (index + 2) + ' has the wrong number of columns.');
    return Object.fromEntries(headers.map((key, i) => [key, values[i].trim()]));
  });
}

export const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
export const toCsv = (rows, fields) => [fields.join(','), ...rows.map(row => fields.map(key => csvCell(row[key])).join(','))].join('\r\n');

export function calculateCreatorPayout(creator, posts, month) {
  const activePosts = posts.filter(p => p.creatorId === creator.id && monthKey(p.postedAt) === month && p.status === 'posted');
  const baseCents = Math.round(safeNumber(creator.monthlyBaseCents));
  const bonusRateCents = safeNumber(creator.bonusPer100kCents);
  const cap = safeNumber(creator.bonusCapViews) || 1000000;
  let bonusCents = 0;
  let incomplete = 0;
  for (const p of activePosts) {
    if (p.views7d === '' || p.views7d === null || p.views7d === undefined) { incomplete++; continue; }
    bonusCents += Math.round(Math.min(safeNumber(p.views7d), cap) / 100000 * bonusRateCents);
  }
  return { creatorId: creator.id, creatorName: creator.name, posts: activePosts.length,
    expectedPosts: safeNumber(creator.postsPerMonth), baseCents,
    bonusCents, totalCents: baseCents + bonusCents,
    incomplete, ready: incomplete === 0 };
}

export function report(creators, posts, month) {
  const monthPosts = posts.filter(p => monthKey(p.postedAt) === month && p.status === 'posted');
  const sum = field => monthPosts.reduce((total, p) => total + (p[field] === '' || p[field] == null ? 0 : safeNumber(p[field])), 0);
  const attributedPosts = monthPosts.filter(p => p.installs !== '' && p.installs != null);
  const payouts = creators.filter(c => c.status === 'active').map(c => calculateCreatorPayout(c, monthPosts, month));
  const payoutCents = payouts.reduce((total, p) => total + p.totalCents, 0);
  const hasAttribution = attributedPosts.length > 0;
  return {
    posts: monthPosts.length, views: sum('views'), likes: sum('likes'),
    installs: hasAttribution ? sum('installs') : null,
    trials: hasAttribution ? sum('trials') : null, paid: hasAttribution ? sum('paid') : null,
    revenueCents: hasAttribution ? sum('revenueCents') : null,
    attributedPosts: attributedPosts.length, creatorCount: creators.filter(c => c.status === 'active').length,
    payoutCents, payouts,
    costPerInstallCents: hasAttribution && sum('installs') > 0 ? Math.round(payoutCents / sum('installs')) : null
  };
}

export function hookPerformance(hooks, posts, month) {
  return hooks.map(hook => {
    const items = posts.filter(p => p.hookId === hook.id && p.status === 'posted' && monthKey(p.postedAt) === month);
    const views = items.reduce((n, p) => n + safeNumber(p.views), 0);
    const installsItems = items.filter(p => p.installs !== '' && p.installs != null);
    return { ...hook, attempts: items.length, views,
      installs: installsItems.length ? installsItems.reduce((n, p) => n + safeNumber(p.installs), 0) : null,
      averageViews: items.length ? Math.round(views / items.length) : 0 };
  }).sort((a, b) => b.views - a.views);
}

export function draftBrief(creator, hook, date) {
  return [
    'OKYO CREATOR BRIEF — ' + date,
    'Creator: ' + creator.name + ' (' + creator.handle + ')',
    'Hook: ' + hook.title,
    'Angle: ' + (hook.angle || 'Show the result before explaining how it works.'),
    '',
    'Outline:',
    '1. First 2 seconds: deliver the hook naturally.',
    '2. Show the real Okyo app scanning or uploading a food photo.',
    '3. Reveal the generated recipe, ingredients, or estimated savings.',
    '4. Finish with an honest, natural call to action.',
    '',
    'Requirements: use real app footage; no invented claims, exact macro promises, fake testimonials or fake comments.',
    'Show the app clearly and use an appropriate sponsorship disclosure when applicable.',
    'Draft only — needs owner approval before sending.'
  ].join('\n');
}
