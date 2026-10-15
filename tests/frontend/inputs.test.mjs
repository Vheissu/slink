import assert from 'node:assert/strict';
import test from 'node:test';
import { stubGlobal } from './helpers.mjs';
import { parseCsv, buildBulkPayload, serializeCsv } from '../../resources/js/src/utils/csv.ts';
import { normalizeUrl, parseClickLimit } from '../../resources/js/src/utils/link-input.ts';
import { quickDateRange } from '../../resources/js/src/utils/date-range.ts';
import { copyText } from '../../resources/js/src/utils/clipboard.ts';

test('CSV handles BOMs, CRLF, embedded newlines, commas, and escaped quotes', () => {
  assert.deepEqual(parseCsv('\uFEFFurl,title\r\nhttps://example.com,"A, ""quoted""\ntitle"\r\n\r\n'), [
    ['url', 'title'], ['https://example.com', 'A, "quoted"\ntitle'],
  ]);
  assert.throws(() => parseCsv('url,title\nhttps://example.com,"unfinished'), /unclosed quoted field/);
});

test('CSV imports headerless rows even if the first title is a column name', () => {
  const { payloads } = buildBulkPayload(parseCsv('example.com,Title,2026-12-10,5'));
  assert.deepEqual(payloads, [{ original_url: 'https://example.com/', title: 'Title', expires_at: '2026-12-10', max_clicks: 5 }]);
});

test('CSV supports reordered headers and reports invalid values with their row', () => {
  assert.deepEqual(buildBulkPayload(parseCsv('title,link,max_clicks\nA,example.com,3\nMissing,,\n')), {
    payloads: [{ original_url: 'https://example.com/', title: 'A', expires_at: null, max_clicks: 3 }], skipped: 1,
  });
  assert.throws(() => buildBulkPayload(parseCsv('url,max_clicks\nexample.com,nope')), /CSV row 2: Click limit/);
  assert.throws(() => buildBulkPayload(parseCsv('url\njavascript:alert(1)')), /CSV row 2: Only HTTP/);
});

test('CSV export escapes quotes and neutralizes spreadsheet formula cells', () => {
  assert.equal(serializeCsv([['a"b', '=HYPERLINK("https://example.com")', '+cmd', '@SUM(1)', 'normal', 4]]),
    '"a""b","\'=HYPERLINK(""https://example.com"")","\'+cmd","\'@SUM(1)","normal","4"');
});

test('URLs normalize hostnames and reject unsafe schemes without inventing destinations', () => {
  assert.equal(normalizeUrl(' example.com/path '), 'https://example.com/path');
  assert.equal(normalizeUrl('localhost:8080/path'), 'https://localhost:8080/path');
  assert.equal(normalizeUrl('https://example.com'), 'https://example.com/');
  for (const url of ['javascript:alert(1)', 'data:text/plain,hello', 'ftp://example.com']) {
    assert.throws(() => normalizeUrl(url), /Only HTTP/);
  }
  assert.throws(() => normalizeUrl(''), /required/);
  assert.throws(() => normalizeUrl('not a url'), /valid destination/);
});

test('click limits never silently become null or fractional values', () => {
  assert.equal(parseClickLimit(''), null);
  assert.equal(parseClickLimit('12'), 12);
  for (const value of ['0', '-1', '1.5', 'abc', 'Infinity', '9007199254740992']) assert.throws(() => parseClickLimit(value), /whole number/);
});

test('quick ranges include today exactly once, including across month boundaries', () => {
  const today = new Date(2026, 2, 2, 12);
  assert.deepEqual(quickDateRange('today', today), { from: '2026-03-02', to: '2026-03-02' });
  assert.deepEqual(quickDateRange('7d', today), { from: '2026-02-24', to: '2026-03-02' });
  assert.deepEqual(quickDateRange('30d', today), { from: '2026-02-01', to: '2026-03-02' });
  assert.deepEqual(quickDateRange('90d', today), { from: '2025-12-03', to: '2026-03-02' });
});

test('clipboard failure is reported and fallback cleanup restores focus', async (t) => {
  let removed = false;
  let restored = false;
  class Element { focus() { restored = true; } }
  const element = new Element();
  stubGlobal(t, 'HTMLElement', Element);
  stubGlobal(t, 'document', {
    activeElement: element,
    createElement: () => ({ style: {}, select() {}, remove() { removed = true; } }),
    body: { appendChild() {} },
    querySelector: () => null,
    execCommand: () => false,
  });
  await assert.rejects(copyText('https://example.com'), /Could not copy/);
  assert.equal(removed, true);
  assert.equal(restored, true);
});
