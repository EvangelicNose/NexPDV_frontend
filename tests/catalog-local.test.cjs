const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/catalog/catalog-local.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const product = (id, extra = {}) => ({ id, name: `Produto ${id}`, active: true, basePrice: '10.00', variants: [], prices: [], ...extra });
function harness(api, indexedDB) {
  const state = { session: { company: { id: 'company-a' }, user: { id: 'user-a' }, role: 'OWNER', establishments: [{ id: 'unit-a' }] }, calls: [], events: [] };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    indexedDB,
    Blob,
    require: () => ({ readSession: () => state.session, apiRequest: async (url) => { state.calls.push(url); return api(url, state); } }),
    window: { dispatchEvent: (event) => state.events.push(event) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  });
  return { ...exports, state };
}

test('downloads every page and performs subsequent filtered searches locally', async () => {
  const h = harness(async (url) => url.endsWith('page=1') ? Array.from({ length: 100 }, (_, i) => product(String(i))) : [product('last', { name: 'Chocolate', category: { id: 'desserts', name: 'Sobremesas' } })]);
  assert.equal((await h.localProducts()).length, 101);
  assert.equal(h.state.calls.length, 2);
  const results = await h.localProducts({ search: 'choco', categoryId: 'desserts', active: true });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'last');
  assert.equal(h.state.calls.length, 2);
});

test('persists the catalog and loads it in a new app instance without the API', async () => {
  const stored = new Map();
  const indexedDB = { open() {
    const request = {};
    queueMicrotask(() => {
      request.result = { close() {}, transaction() {
        const transaction = { objectStore() { return {
          put(snapshot) { stored.set(snapshot.scope, structuredClone(snapshot)); queueMicrotask(() => transaction.oncomplete?.()); },
          delete(scope) { stored.delete(scope); queueMicrotask(() => transaction.oncomplete?.()); },
          get(scope) { const result = {}; queueMicrotask(() => { result.result = stored.get(scope); result.onsuccess?.(); }); return result; },
        }; } };
        return transaction;
      } };
      request.onsuccess?.();
    });
    return request;
  } };
  const first = harness(async () => [product('persistent', { variants: [{ id: 'v', active: true, name: 'Grande', priceAdjustment: '5.00' }], prices: [{ id: 'price', establishmentId: 'unit-a', amount: '15.00' }] })], indexedDB);
  await first.localProducts();
  assert.equal(stored.size, 1);
  const second = harness(async () => { throw new Error('API must not be called'); }, indexedDB);
  const restored = await second.localProducts();
  assert.equal(restored[0].id, 'persistent');
  assert.equal(restored[0].variants[0].priceAdjustment, '5.00');
  assert.equal(restored[0].prices[0].amount, '15.00');
  assert.equal(second.state.calls.length, 0);
  await second.clearLocalCatalog(second.catalogScope());
  assert.equal(stored.size, 0);
  assert.equal((await second.localCatalogStats(second.catalogScope())).hasCatalog, false);
});

test('reports catalog size and preserves last synchronization after a product update', async () => {
  const h = harness(async () => [product('a', { variants: [{ id: 'v', active: true, name: 'Grande' }] })]);
  await h.localProducts();
  const scope = h.catalogScope();
  const before = await h.localCatalogStats(scope);
  assert.equal(before.products, 1);
  assert.equal(before.variants, 1);
  assert.ok(before.bytes > 0);
  assert.ok(before.lastSyncedAt > 0);
  assert.equal(before.persistent, false);
  await h.updateLocalProduct(scope, product('a'));
  assert.equal((await h.localCatalogStats(scope)).lastSyncedAt, before.lastSyncedAt);
});

test('clears only the selected scope and prevents a pending download from restoring it', async () => {
  let delayed = false;
  let release;
  const h = harness(async () => delayed ? new Promise((resolve) => { release = resolve; }) : [product('a')]);
  await h.localProducts();
  const firstScope = h.catalogScope();
  h.state.session.company.id = 'company-b';
  await h.localProducts();
  const secondScope = h.catalogScope();
  delayed = true;
  const refresh = h.localProducts({}, true);
  await new Promise((resolve) => setImmediate(resolve));
  const clearing = h.clearLocalCatalog(secondScope);
  await assert.rejects(h.localProducts(), /limpo/);
  release([product('late')]);
  await Promise.all([refresh, clearing]);
  assert.equal((await h.localCatalogStats(secondScope)).hasCatalog, false);
  assert.equal((await h.localCatalogStats(firstScope)).hasCatalog, true);
  assert.equal(h.state.events.at(-1).type, h.CATALOG_CLEARED);
});

test('matches active variant codes and excludes inactive products and variants', async () => {
  const h = harness(async () => [product('a', { variants: [
    { id: 'v1', name: 'Grande', sku: 'SKU-G', barcode: '789123', active: true, priceAdjustment: '2.00' },
    { id: 'v2', name: 'Antiga', sku: 'OLD', active: false },
  ] }), product('b', { active: false, sku: 'SKU-G' })]);
  assert.equal((await h.localProducts({ sku: 'sku-g', active: true })).length, 1);
  assert.equal((await h.localProducts({ barcode: '789123' })).length, 1);
  assert.equal((await h.localProducts({ sku: 'OLD' })).length, 0);
  assert.equal((await h.localProducts({ search: 'grande' })).length, 1);
});

test('offline queries retain the last complete catalog, while explicit refresh reports failure', async () => {
  let offline = false;
  const h = harness(async () => { if (offline) throw new Error('offline'); return [product('a')]; });
  await h.localProducts();
  offline = true;
  await h.expireLocalCatalog(h.catalogScope());
  assert.equal((await h.localProducts()).length, 1);
  await assert.rejects(h.localProducts({}, true), /offline/);
  assert.equal((await h.localProducts({ active: true })).length, 1);
});

test('isolates catalogs across companies, units and users', async () => {
  const h = harness(async () => [product(h.state.session.company.id + h.state.session.establishments[0].id + h.state.session.user.id)]);
  const first = (await h.localProducts())[0].id;
  h.state.session.company.id = 'company-b';
  assert.notEqual((await h.localProducts())[0].id, first);
  h.state.session.establishments[0].id = 'unit-b';
  await h.localProducts();
  h.state.session.user.id = 'user-b';
  await h.localProducts();
  assert.equal(h.state.calls.length, 4);
  h.state.session = null;
  await assert.rejects(h.localProducts(), /empresa/);
});

test('deduplicates concurrent synchronizations', async () => {
  const h = harness(async () => [product('a')]);
  await Promise.all([h.localProducts(), h.localProducts(), h.localProducts()]);
  assert.equal(h.state.calls.length, 1);
});

test('does not overwrite a locally updated product with an older in-flight response', async () => {
  let release;
  let delayed = false;
  const h = harness(async () => delayed ? new Promise((resolve) => { release = resolve; }) : [product('a')]);
  await h.localProducts();
  delayed = true;
  const refresh = h.localProducts({}, true);
  await new Promise((resolve) => setImmediate(resolve));
  await h.updateLocalProduct(h.catalogScope(), product('a', { name: 'Atualizado', basePrice: '25.00' }));
  release([product('a')]);
  const results = await refresh;
  assert.equal(results[0].name, 'Atualizado');
  assert.equal(results[0].basePrice, '25.00');
});

test('a failed later page never replaces the previous complete snapshot', async () => {
  let failing = false;
  const h = harness(async (url) => {
    if (!failing) return [product('original')];
    if (url.endsWith('page=1')) return Array.from({ length: 100 }, (_, i) => product(String(i)));
    throw new Error('page failed');
  });
  await h.localProducts();
  failing = true;
  await assert.rejects(h.localProducts({}, true), /page failed/);
  assert.equal((await h.localProducts())[0].id, 'original');
});
