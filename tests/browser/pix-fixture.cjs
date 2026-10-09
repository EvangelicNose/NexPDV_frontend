const { randomUUID } = require('node:crypto');
const ids = { company: '11111111-1111-4111-8111-111111111111', unit: '22222222-2222-4222-8222-222222222222',
  order: '33333333-3333-4333-8333-333333333333', sale: '44444444-4444-4444-8444-444444444444', cash: '55555555-5555-4555-8555-555555555555' };
// Fictitious key. Never use these mock fixtures for a real transfer.
const payload = '00020126370014br.gov.bcb.pix0115pix@example.com5204000053039865406100.005802BR5910LOJA TESTE6009SAO PAULO622805240123456789abcdef0123456763041715';
const payment = () => ({ id: randomUUID(), saleId: ids.sale, companyId: ids.company, establishmentId: ids.unit, method: 'PIX',
  status: 'PENDING', txid: '0123456789abcdef01234567', payload, amount: '100.00', operationFee: '0.00', netAmount: '100.00',
  createdAt: '2026-10-08T12:00:00Z', confirmedAt: null, confirmedByUserId: null, cancellationReason: null });
async function installPixFixture(page, options = {}) {
  const state = { prepared: Boolean(options.prepared), records: options.prepared ? [payment()] : [], finalized: false, denied: false,
    failFinalization: Boolean(options.failFinalization), gate: null, calls: { create: [], confirm: [], cancel: [], finalize: [], unexpected: [], quickPix: [], quickLegacy: [] } };
  const sale = () => ({ id: ids.sale, orderId: ids.order, companyId: ids.company, establishmentId: ids.unit, sequence: 1,
    status: state.records.some(row => row.status === 'PAID') ? 'COMPLETED' : 'PENDING_PAYMENT', total: '100.00', subtotal: '100.00', additions: '0.00', discount: '0.00', fees: '0.00', refundedAmount: '0.00',
    finalizedAt: state.finalized ? '2026-10-08T12:02:00Z' : null, finalizedByUserId: state.finalized ? ids.company : null,
    createdAt: '2026-10-08T12:00:00Z', payments: state.records.map(row => ({ ...row, status: row.status === 'PAID' ? 'APPROVED' : row.status, pixTxid: row.txid })), items: [] });
  const order = () => ({ id: ids.order, establishmentId: ids.unit, sequence: 1, status: state.finalized ? 'DELIVERED' : 'READY', type: 'COUNTER',
    total: '100.00', subtotal: '100.00', additions: '0.00', discount: '0.00', fees: '0.00', createdAt: '2026-10-08T12:00:00Z',
    items: [{ id: 'item', productNameSnapshot: 'Produto de teste', quantity: '1.000', unitPrice: '100.00', total: '100.00', options: [] }],
    sale: state.prepared ? sale() : null });
  await page.addInitScript(session => sessionStorage.setItem('nexpdv.session', JSON.stringify(session)), {
    accessToken: 'browser-test-token', user: { id: ids.company, name: 'Operador de teste', email: 'operator@example.com' },
    company: { id: ids.company, tradeName: 'Estabelecimento de teste' }, establishments: [{ id: ids.unit, name: 'Unidade de teste' }], activeEstablishmentId: ids.unit,
    role: 'CASHIER', permissions: options.readOnly ? ['order.read'] : ['order.read', 'sale.create'],
  });
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/v1/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) });
    const fail = (code, message, status = 409) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code, message } }) });
    if (path.startsWith('/v1/products')) return reply(options.catalog ? [{ id: '66666666-6666-4666-8666-666666666666', name: 'Produto de teste', active: true, basePrice: '100.00', variants: [], prices: [], category: null }] : []);
    if (path === '/v1/tabs') return reply([]);
    if (path === '/v1/sales/quick/pix') { state.calls.quickPix.push(request.postDataJSON()); state.prepared = true; return reply(sale(), 201); }
    if (path === '/v1/sales/quick') { state.calls.quickLegacy.push(request.postDataJSON()); return fail('PIX_MANUAL_FLOW_REQUIRED', 'Pix enviado ao fluxo antigo', 422); }
    if (path.startsWith('/v1/cash-registers/sessions')) return reply([{ id: ids.cash, status: 'OPEN', cashRegister: { id: ids.cash, name: 'Caixa teste', code: '01', paymentMethods: [{ method: 'PIX' }] } }]);
    if (path === `/v1/orders/${ids.order}` && method === 'GET') return reply(order());
    if (path === `/v1/orders/${ids.order}/pix-sale`) { state.prepared = true; return reply(sale(), 201); }
    if (path === `/v1/sales/${ids.sale}` && method === 'GET') return state.denied ? fail('FORBIDDEN', 'Acesso revogado', 403) : reply(sale());
    if (path === `/v1/sales/${ids.sale}/payments/pix`) {
      if (state.denied) return fail('FORBIDDEN', 'Acesso revogado', 403);
      if (method === 'GET') return reply(state.records);
      state.calls.create.push(request.headers()['idempotency-key']);
      if (state.gate) await state.gate;
      const record = payment(); state.records.push(record); return reply(record, 201);
    }
    if (path.endsWith('/confirm')) {
      state.calls.confirm.push(request.postDataJSON());
      if (request.postDataJSON().received !== true) return fail('VALIDATION_ERROR', 'Confirmação obrigatória', 422);
      const record = state.records.at(-1); record.status = 'PAID'; record.confirmedAt = '2026-10-08T12:01:00Z'; record.confirmedByUserId = ids.company;
      return reply(record);
    }
    if (path.endsWith('/cancel')) {
      state.calls.cancel.push(request.postDataJSON()); const record = state.records.at(-1);
      record.status = 'CANCELLED'; record.cancellationReason = request.postDataJSON().reason; return reply(record);
    }
    if (path.endsWith('/finalize')) {
      state.calls.finalize.push(request.headers()['idempotency-key']);
      if (state.failFinalization) { state.failFinalization = false; return fail('INSUFFICIENT_STOCK', 'Estoque insuficiente'); }
      state.finalized = true; return reply(sale());
    }
    state.calls.unexpected.push(`${method} ${path}`); return fail('TEST_UNEXPECTED_REQUEST', `Requisição inesperada ${path}`, 404);
  });
  return state;
}
async function openPix(page, prepared = false) {
  await page.goto(`/pedidos/${ids.order}`);
  await page.getByRole('button', { name: prepared ? 'Retomar pagamento Pix' : 'Receber e finalizar' }).click();
  if (!prepared) {
    await page.getByLabel('Caixa aberto').selectOption(ids.cash);
    await page.getByRole('button', { name: 'Gerar QR Code Pix' }).click();
  }
}
module.exports = { installPixFixture, openPix, payload, ids };
