import assert from 'node:assert/strict';
import test from 'node:test';
import {csvRows,toCsv,calculateCreatorPayout,report,hookPerformance,draftBrief,cents} from './engine.mjs';

test('CSV supports quoted cells, escaped quotes, and CRLF', () => {
  const rows = csvRows('a,b\r\n"hello, world","She said ""hi"""\r\n');
  assert.deepEqual(rows,[{a:'hello, world',b:'She said "hi"'}]);
  assert.deepEqual(csvRows(toCsv(rows,['a','b'])),rows);
});
test('CSV rejects malformed and mismatched rows', () => {
  assert.throws(()=>csvRows('a,b\n"unfinished'),/unclosed/);
  assert.throws(()=>csvRows('a,b\n1'),/wrong number/);
});
test('payout respects per-video cap and only the first seven-day snapshot', () => {
  const creator={id:'c1',name:'Creator',monthlyBaseCents:50000,bonusPer100kCents:10000,bonusCapViews:1000000,postsPerMonth:60};
  const posts=[
    {creatorId:'c1',postedAt:'2026-11-02',status:'posted',views7d:1500000,views:4000000},
    {creatorId:'c1',postedAt:'2026-11-08',status:'posted',views7d:50000,views:80000},
    {creatorId:'c1',postedAt:'2026-10-08',status:'posted',views7d:800000}
  ];
  const result=calculateCreatorPayout(creator,posts,'2026-11');
  assert.equal(result.baseCents,50000);
  assert.equal(result.bonusCents,105000);
  assert.equal(result.totalCents,155000);
  assert.equal(result.posts,2);
  assert.equal(result.ready,true);
});
test('missing 7d views blocks approval; zero views does not', () => {
  const c={id:'x',name:'X',monthlyBaseCents:0,bonusPer100kCents:10000,bonusCapViews:1000000};
  let posts=[{creatorId:'x',postedAt:'2026-11-01',status:'posted',views7d:''}];
  assert.equal(calculateCreatorPayout(c,posts,'2026-11').ready,false);
  posts[0].views7d=0;
  assert.equal(calculateCreatorPayout(c,posts,'2026-11').ready,true);
});
test('reports do not claim installs when there is no attribution', () => {
  const empty=report([], [{creatorId:'x',postedAt:'2026-11-01',status:'posted',views:1000,installs:'',paid:'',revenueCents:''}], '2026-11');
  assert.equal(empty.views,1000);
  assert.equal(empty.installs,null);
  assert.equal(empty.revenueCents,null);
});
test('hook performance ranks monthly views', () => {
  const hooks=[{id:'a',title:'A'},{id:'b',title:'B'}];
  const posts=[{hookId:'a',postedAt:'2026-11-01',status:'posted',views:300},{hookId:'b',postedAt:'2026-11-02',status:'posted',views:800}];
  assert.equal(hookPerformance(hooks,posts,'2026-11')[0].title,'B');
});
test('creator brief requires approval and truthful claims', () => {
  const s=draftBrief({name:'Sam',handle:'@sam'}, {title:'Can I make this at home?',angle:'Demo'},'2026-11-07');
  assert.match(s,/Draft only/);assert.match(s,/no invented claims/);
  assert.equal(cents('4.99'),499);
});
