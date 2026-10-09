const { test, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator });
for (const name of ['HTMLElement', 'HTMLDialogElement', 'Event', 'KeyboardEvent', 'MutationObserver']) global[name] = dom.window[name];
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
const React = require('react');
const { render, screen, waitFor, cleanup, act } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event').default;
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
const clients = [];
after(() => dom.window.close());
afterEach(() => { cleanup(); for (const client of clients) client.clear(); clients.length = 0; });

class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const pending = { id: 'payment-1', saleId: 'sale-1', companyId: 'company-a', establishmentId: 'unit-a', method: 'PIX',
  status: 'PENDING', amount: '100.00', txid: '0123456789abcdef01234567',
  payload: '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
  createdAt: '2026-10-08T12:00:00Z', confirmedAt: null, cancellationReason: null };
function harness(options = {}) {
  const state = { records: options.records ?? [], auth: { session: { company: { id: 'company-a' }, role: 'CASHIER', permissions: options.permissions ?? ['sale.create', 'order.read'] }, currentEstablishment: { id: 'unit-a' } }, createErrors: [], listError: null,
    sale: { id: 'sale-1', orderId: 'order-1', sequence: 1, status: options.records?.some(row => row.status === 'PAID') ? 'COMPLETED' : 'PENDING_PAYMENT', finalizedAt: options.finalizedAt ?? null }, finalizeErrors: [] };
  const calls = { create: [], confirm: [], cancel: [], close: [], paid: [], checkout: [], preparation: [], finalize: [], finalized: [], refund: [] };
  const api = {
    listPixPayments: async () => { if (state.listError) throw state.listError; return [...state.records]; },
    createPixPayment: async (...args) => { calls.create.push(args); if (state.createErrors.length) throw state.createErrors.shift();
      const record = { ...pending, id: `payment-${calls.create.length}` }; state.records.push(record); return record; },
    confirmPixPayment: async (...args) => { calls.confirm.push(args); state.sale.status = 'COMPLETED'; const record = { ...state.records.find(row => row.id === args[0]), status: 'PAID', confirmedAt: '2026-10-08T12:01:00Z' }; state.records = state.records.map(row => row.id === record.id ? record : row); return record; },
    cancelPixPayment: async (...args) => { calls.cancel.push(args); const record = { ...state.records.find(row => row.id === args[0]), status: 'CANCELLED', cancellationReason: args[1] }; state.records = state.records.map(row => row.id === record.id ? record : row); return record; },
  };
  const sales = {
    cancelSale: async (...args) => { calls.refund.push(args); return { ...state.sale, status: 'REFUNDED' }; },
    getSale: async () => ({ ...state.sale }),
    finalizeSale: async (...args) => { calls.finalize.push(args); if (state.finalizeErrors.length) throw state.finalizeErrors.shift(); state.sale.finalizedAt = '2026-10-08T12:02:00Z'; return { ...state.sale }; },
    checkoutOrder: async (...args) => { calls.checkout.push(args); return { id: 'legacy-sale' }; },
    prepareOrderPix: async (...args) => { calls.preparation.push(args); return { id: 'sale-1', orderId: 'order-1', status: 'PENDING_PAYMENT' }; },
  };
  const cache = new Map();
  const load = file => {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = name => {
      if (name.endsWith('.css')) return {};
      if (name.endsWith('pix.api')) return api;
      if (name.endsWith('sales.api')) return sales;
      if (name.endsWith('auth-context')) return { useAuth: () => state.auth };
      if (name.endsWith('cash.api')) return { listCashSessions: async () => [{ id: 'cash-1', cashRegister: { name: 'Caixa', code: '01', paymentMethods: [{ method: 'PIX' }, { method: 'CASH' }] } }] };
      if (name.endsWith('lib/api')) return { ApiError };
      if (name.startsWith('.')) {
        const base = path.resolve(path.dirname(file), name);
        return load(fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`);
      }
      return require(name);
    };
    vm.runInNewContext(source, { exports, require: localRequire, crypto: global.crypto, navigator: global.navigator, Intl, Date, console });
    return exports;
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } }); clients.push(client);
  const props = { saleId: 'sale-1', establishmentId: 'unit-a', initialCashSessionId: 'cash-1', onClose: () => calls.close.push(true), onPaid: row => calls.paid.push(row), onFinalized: row => calls.finalized.push(row) };
  const modal = load(path.join(__dirname, '../src/features/pix/PixPaymentModal.tsx')).PixPaymentModal;
  const show = (Component = modal, input = props) => render(React.createElement(QueryClientProvider, { client }, React.createElement(Component, input)));
  return { state, calls, client, props, show, load, user: userEvent.setup({ document: dom.window.document }) };
}

test('gera QR Code e Copia e Cola sem registrar recebimento automaticamente', async () => {
  const h = harness(); h.show();
  const qr = await screen.findByRole('img', { name: 'QR Code para pagamento Pix' });
  assert.equal(qr.tagName.toLowerCase(), 'svg'); assert.ok(qr.querySelector('path'));
  assert.equal(screen.getByLabelText('Pix Copia e Cola').value, pending.payload);
  assert.ok(screen.getByText('R$ 100,00'));
  assert.ok(screen.getByText('Confirme o recebimento do Pix na conta bancária do estabelecimento antes de finalizar a venda.'));
  assert.equal(h.calls.create.length, 1); assert.equal(h.calls.confirm.length, 0);
  assert.equal(screen.getByRole('button', { name: 'Confirmar pagamento' }).disabled, true);
});
test('retoma tentativa pendente existente sem criar outra', async () => {
  const h = harness({ records: [{ ...pending }] }); h.show();
  await screen.findByRole('img'); assert.equal(h.calls.create.length, 0); assert.equal(h.calls.confirm.length, 0);
});
test('confirma somente após conferir recebimento e revisar a ação', async () => {
  const h = harness({ records: [{ ...pending }] }); h.show(); await screen.findByRole('img');
  await h.user.click(screen.getByRole('checkbox'));
  await waitFor(() => assert.equal(screen.getByRole('button', { name: 'Confirmar pagamento' }).disabled, false));
  await h.user.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
  assert.equal(h.calls.confirm.length, 0); assert.ok(screen.getByText('Registrar recebimento de R$ 100,00?'));
  await h.user.click(screen.getByRole('button', { name: 'Registrar confirmação e finalizar' }));
  await screen.findByText('Pagamento confirmado manualmente');
  assert.equal(h.calls.confirm.length, 1); assert.equal(h.calls.confirm[0][0], pending.id); assert.equal(h.calls.confirm[0][1], 'cash-1');
  assert.equal(screen.queryByRole('img'), null);
  await waitFor(() => assert.equal(h.calls.paid.length, 1));
  await screen.findByText('Venda finalizada. Pagamento e estoque registrados.');
  assert.equal(h.calls.finalize.length, 1);
});
test('copiar usa exatamente o payload do backend e mostra feedback', async () => {
  const h = harness({ records: [{ ...pending }] }); let copied = null;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied = value; } } });
  h.show(); await screen.findByRole('img'); await h.user.click(screen.getByRole('button', { name: 'Copiar Pix' }));
  await screen.findByText('Código Pix copiado.'); assert.equal(copied, pending.payload);
});
test('falha na cópia mantém o código selecionável e informa alternativa', async () => {
  const h = harness({ records: [{ ...pending }] });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('blocked'); } } });
  h.show(); await screen.findByRole('img'); await h.user.click(screen.getByRole('button', { name: 'Copiar Pix' }));
  await screen.findByText('Não foi possível copiar automaticamente. Selecione e copie o código abaixo.');
  assert.equal(document.activeElement, screen.getByLabelText('Pix Copia e Cola'));
});
test('cancelar exige motivo, remove QR Code e preserva tentativa; nova geração é explícita', async () => {
  const h = harness({ records: [{ ...pending }] }); h.show(); await screen.findByRole('img');
  await h.user.click(screen.getByRole('button', { name: 'Cancelar tentativa' }));
  assert.equal(screen.getByRole('button', { name: 'Confirmar cancelamento' }).disabled, true);
  await h.user.type(screen.getByLabelText('Motivo do cancelamento'), 'Cliente desistiu');
  await h.user.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));
  await screen.findByText('Tentativa de pagamento cancelada'); assert.equal(screen.queryByRole('img'), null);
  assert.equal(h.calls.cancel.length, 1); assert.equal(h.calls.create.length, 0);
  await h.user.click(screen.getByRole('button', { name: 'Gerar nova tentativa' }));
  await screen.findByRole('img'); assert.equal(h.calls.create.length, 1); assert.equal(h.state.records.length, 2);
});
test('erro de geração permite repetir com a mesma chave de idempotência', async () => {
  const h = harness(); h.state.createErrors.push(new ApiError(500, 'INTERNAL_ERROR', 'Falha ao gerar Pix'));
  h.show(); await screen.findByText('Falha ao gerar Pix');
  await h.user.click(screen.getByRole('button', { name: 'Tentar gerar novamente' }));
  await screen.findByRole('img'); assert.equal(h.calls.create.length, 2); assert.equal(h.calls.create[0][1], h.calls.create[1][1]);
});
test('consulta de pagamento já confirmado mostra confirmação manual sem enviar nova confirmação', async () => {
  const h = harness({ records: [{ ...pending, status: 'PAID', confirmedAt: '2026-10-08T12:01:00Z' }] }); h.show();
  await screen.findByText('Pagamento confirmado manualmente'); assert.equal(screen.queryByRole('img'), null);
  assert.equal(h.calls.create.length, 0); assert.equal(h.calls.confirm.length, 0);
  assert.equal(h.calls.finalize.length, 0);
});
test('falta de estoque após confirmar mantém o recebimento e permite repetir só a finalização', async () => {
  const h = harness({ records: [{ ...pending }] }); h.state.finalizeErrors.push(new ApiError(409, 'INSUFFICIENT_STOCK', 'Estoque insuficiente'));
  h.show(); await screen.findByRole('img'); await h.user.click(screen.getByRole('checkbox'));
  await waitFor(() => assert.equal(screen.getByRole('button', { name: 'Confirmar pagamento' }).disabled, false));
  await h.user.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
  await h.user.click(screen.getByRole('button', { name: 'Registrar confirmação e finalizar' }));
  await screen.findByText('Estoque insuficiente'); await screen.findByText('Pagamento confirmado manualmente');
  assert.equal(h.calls.confirm.length, 1); assert.equal(h.calls.finalize.length, 1);
  await h.user.click(screen.getByRole('button', { name: 'Tentar finalizar novamente' }));
  await screen.findByText('Venda finalizada. Pagamento e estoque registrados.');
  assert.equal(h.calls.confirm.length, 1); assert.equal(h.calls.finalize.length, 2);
  assert.equal(h.calls.finalize[0][1], h.calls.finalize[1][1]);
});
test('reabrir venda finalizada não confirma nem baixa estoque novamente', async () => {
  const h = harness({ records: [{ ...pending, status: 'PAID', confirmedAt: '2026-10-08T12:01:00Z' }], finalizedAt: '2026-10-08T12:02:00Z' });
  h.show(); await screen.findByText('Venda finalizada. Pagamento e estoque registrados.');
  assert.equal(h.calls.confirm.length, 0); assert.equal(h.calls.finalize.length, 0);
  assert.equal(screen.queryByRole('button', { name: 'Finalizar venda' }), null);
});
test('recebimento já confirmado finaliza apenas por ação explícita sem confirmar de novo', async () => {
  const h = harness({ records: [{ ...pending, status: 'PAID', confirmedAt: '2026-10-08T12:01:00Z' }] });
  h.show(); await screen.findByRole('button', { name: 'Finalizar venda' });
  assert.equal(h.calls.finalize.length, 0); await h.user.click(screen.getByRole('button', { name: 'Finalizar venda' }));
  await screen.findByText('Venda finalizada. Pagamento e estoque registrados.');
  assert.equal(h.calls.finalize.length, 1); assert.equal(h.calls.confirm.length, 0);
});
test('estorno de Pix recebido exige conferência de devolução manual antes de cancelar a venda', async () => {
  const h = harness(); const Component = h.load(path.join(__dirname, '../src/features/orders/CancelOrderModal.tsx')).CancelOrderModal;
  h.show(Component, { order: { id: 'order-1', sequence: 1, establishmentId: 'unit-a', sale: { id: 'sale-1', payments: [{ method: 'PIX', pixTxid: pending.txid, status: 'APPROVED', amount: '100.00' }] } }, onClose: () => h.calls.close.push(true) });
  await h.user.type(screen.getByLabelText(/^Motivo do cancelamento/), 'Devolução ao cliente');
  assert.equal(screen.getByRole('button', { name: 'Confirmar cancelamento' }).disabled, true);
  await h.user.click(screen.getByRole('checkbox'));
  await h.user.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));
  await waitFor(() => assert.equal(h.calls.refund.length, 1));
  assert.equal(h.calls.refund[0][1].pixRefundConfirmed, true);
});
test('usuário de consulta vê QR Code mas não pode confirmar nem cancelar', async () => {
  const h = harness({ records: [{ ...pending }], permissions: ['order.read'] }); h.show();
  await screen.findByRole('img'); assert.equal(screen.queryByRole('checkbox'), null);
  assert.equal(screen.queryByRole('button', { name: 'Confirmar pagamento' }), null);
  assert.equal(h.calls.create.length, 0); assert.equal(h.calls.confirm.length, 0);
});
test('perda de acesso oculta dados previamente carregados após a consulta ser rejeitada', async () => {
  const h = harness({ records: [{ ...pending }] }); h.show(); await screen.findByRole('img');
  h.state.listError = new ApiError(403, 'FORBIDDEN', 'Acesso revogado');
  await act(() => h.client.invalidateQueries({ queryKey: ['pix-payments'] }));
  await screen.findByText(/Acesso revogado/); assert.equal(screen.queryByRole('img'), null);
  assert.equal(screen.queryByLabelText('Pix Copia e Cola'), null);
});
test('fechar uma tentativa pendente não a cancela', async () => {
  const h = harness({ records: [{ ...pending }] }); h.show(); await screen.findByRole('img');
  await h.user.click(screen.getByRole('button', { name: 'Fechar e retomar depois' }));
  assert.equal(h.calls.close.length, 1); assert.equal(h.calls.cancel.length, 0);
});
test('checkout com Pix prepara venda pendente e nunca chama o checkout que aprova Pix', async () => {
  const h = harness(); const Component = h.load(path.join(__dirname, '../src/features/sales/CheckoutModal.tsx')).CheckoutModal;
  h.show(Component, { orderId: 'order-1', total: '100.00', establishmentId: 'unit-a', onClose: () => {}, onSuccess: () => { throw new Error('Premature checkout completion'); } });
  await waitFor(() => assert.ok(screen.getByRole('option', { name: 'Caixa · 01' })));
  await h.user.selectOptions(screen.getByLabelText('Caixa aberto'), 'cash-1');
  await h.user.click(screen.getByRole('button', { name: 'Gerar QR Code Pix' }));
  await screen.findByRole('img'); assert.equal(h.calls.preparation.length, 1); assert.equal(h.calls.checkout.length, 0);
});
