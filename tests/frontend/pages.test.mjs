import assert from 'node:assert/strict';
import test from 'node:test';
import { LinksPage } from '../../resources/js/src/pages/links/links-page.ts';
import { AnalyticsPage } from '../../resources/js/src/pages/analytics/analytics-page.ts';
import { SettingsPage } from '../../resources/js/src/pages/settings/settings-page.ts';
import { LatestRequest } from '../../resources/js/src/utils/latest-request.ts';
import { deferred, stubGlobal } from './helpers.mjs';

const auth = { hasToken: () => true, getToken: () => 'token' };
const actions = { onAction: () => () => {}, consume: () => null };
const link = { id: '1', slug: 'first', original_url: 'https://example.com/', title: 'First', clicks_count: 42, is_active: true, expires_at: '2026-12-01T16:30:00Z' };
const pageData = (links = [link], page = 1, lastPage = 1) => ({ data: links, current_page: page, last_page: lastPage, per_page: 20, from: links.length ? 1 : null, to: links.length || null, total: links.length });
const analyticsData = (total) => ({ stats: { total, by_country: [], by_device: [], by_browser: [], by_referrer: [] }, scope: { mode: 'global', query: null, matched_links: 1 }, range: { from: '2026-01-01', to: '2026-01-07', granularity: 'day', include_bots: false }, series: [] });

test('superseded requests and detached components cannot apply responses', () => {
  const guard = new LatestRequest();
  const first = guard.start();
  const second = guard.start();
  assert.equal(first(), false);
  assert.equal(second(), true);
  guard.cancel();
  assert.equal(second(), false);
});

test('link filtering ignores old responses and old failures', async () => {
  const old = deferred();
  const next = deferred();
  let count = 0;
  const page = new LinksPage({ listLinksPage: () => (++count === 1 ? old.promise : next.promise) }, actions, auth);
  const first = page.loadLinks();
  const second = page.loadLinks();
  next.resolve(pageData([{ ...link, title: 'New' }]));
  await second;
  old.reject(new Error('Old request failed'));
  await first;
  assert.equal(page.links[0].title, 'New');
  assert.equal(page.loadError, '');
  assert.equal(page.isLoading, false);
});

test('deleting the last link on a page reloads the last valid page with the same filters', async () => {
  const calls = [];
  const page = new LinksPage({ listLinksPage: async (params) => {
    calls.push(params);
    return calls.length === 1 ? pageData([], 3, 2) : pageData([link], 2, 2);
  } }, actions, auth);
  page.searchQuery = 'campaign';
  await page.loadLinks(3);
  assert.equal(page.page, 2);
  assert.deepEqual(calls.map((call) => [call.page, call.search]), [[3, 'campaign'], [2, 'campaign']]);
});

test('creating and importing links reload the filtered page instead of guessing its total', async () => {
  const filters = [];
  const page = new LinksPage({
    createLink: async () => link,
    bulkCreateLinks: async () => ({ data: [link] }),
    listLinksPage: async (params) => { filters.push(params); return pageData([]); },
  }, actions, auth);
  page.statusFilter = 'inactive';
  page.newUrl = 'example.com';
  await page.createLink();
  assert.equal(page.total, 0);
  assert.equal(page.createdLink.id, link.id);
  const input = { files: [{ text: async () => 'url\nexample.com' }], value: 'file.csv' };
  await page.handleCsvChange({ target: input });
  assert.equal(page.total, 0);
  assert.equal(input.value, '');
  assert.deepEqual(filters.map((params) => params.status), ['inactive', 'inactive']);
});

test('saving metadata preserves click counts and the existing expiry time', async () => {
  let sent;
  const page = new LinksPage({
    updateLink: async (_id, payload) => { sent = payload; return { id: link.id, title: payload.title }; },
    listLinksPage: async () => pageData([{ ...link, title: 'Renamed' }]),
  }, actions, auth);
  page.activeLink = link;
  page.editOriginalUrl = link.original_url;
  page.editTitle = 'Renamed';
  page.editExpiresAt = '2026-12-01';
  await page.saveDetails();
  assert.equal(page.activeLink.clicks_count, 42);
  assert.equal(page.links[0].clicks_count, 42);
  assert.equal(sent.expires_at, '2026-12-01T16:30:00Z');
  assert.equal(page.detailStatus, 'Changes saved.');
});

test('a save completing after switching details cannot overwrite the new drawer', async () => {
  const pending = deferred();
  const page = new LinksPage({ updateLink: () => pending.promise, listLinksPage: async () => pageData() }, actions, auth);
  page.activeLink = link;
  page.editOriginalUrl = link.original_url;
  const save = page.saveDetails();
  page.activeLink = { ...link, id: '2', title: 'Second' };
  pending.resolve({ ...link, title: 'Saved first' });
  await save;
  assert.equal(page.activeLink.id, '2');
  assert.equal(page.detailStatus, '');
});

test('bulk actions cannot submit twice while in flight', async () => {
  const pending = deferred();
  let count = 0;
  const page = new LinksPage({ bulkActionLinks: () => { count += 1; return pending.promise; }, listLinksPage: async () => pageData() }, actions, auth);
  page.isLoading = false;
  page.selectedIds = ['1'];
  const first = page.bulkAction('deactivate');
  await page.bulkAction('activate');
  assert.equal(count, 1);
  assert.equal(page.isBulkUpdating, true);
  pending.resolve({ affected: 1 });
  await first;
  assert.equal(page.isBulkUpdating, false);
  assert.equal(page.bulkActionStatus, '1 link updated.');
});

test('analytics ignores late results and recovers from a destroyed chart after failure', async () => {
  const pending = deferred();
  let count = 0;
  const page = new AnalyticsPage({ getAnalytics: () => ++count === 1 ? pending.promise : Promise.resolve(analyticsData(2)) }, auth);
  const old = page.fetchStats();
  await page.fetchStats();
  pending.resolve(analyticsData(1));
  await old;
  assert.equal(page.stats.total, 2);

  let destroyed = 0;
  page.chart = { destroy() { destroyed += 1; } };
  page.api.getAnalytics = async () => { throw new Error('Offline'); };
  await page.fetchStats();
  assert.equal(destroyed, 1);
  assert.equal(page.chart, undefined);
  assert.equal(page.stats, null);
  page.api.getAnalytics = async () => analyticsData(3);
  await page.fetchStats();
  assert.equal(page.error, '');
  assert.equal(page.stats.total, 3);
});

test('clearing a token prevents old audit results from reappearing', async () => {
  const pending = deferred();
  let token = 'saved';
  const page = new SettingsPage({ getToken: () => token }, { listAuditLogs: () => pending.promise });
  const old = page.loadAuditLogs();
  token = null;
  await page.loadAuditLogs();
  pending.resolve([{ id: 'old-account-entry' }]);
  await old;
  assert.deepEqual(page.auditLogs, []);
  assert.equal(page.isLoadingAudit, false);
});

test('detaching cancels requests without updating removed views', async (t) => {
  stubGlobal(t, 'document', { body: { classList: { remove() {} } } });
  const pending = deferred();
  const page = new LinksPage({ listLinksPage: () => pending.promise }, actions, auth);
  const load = page.loadLinks();
  page.detaching();
  pending.resolve(pageData());
  await load;
  assert.deepEqual(page.links, []);
});
