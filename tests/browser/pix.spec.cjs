const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { installPixFixture, openPix, payload, ids } = require('./pix-fixture.cjs');

test('Novo pedido com venda rápida Pix prepara a venda e abre QR Code sem usar o endpoint antigo', async ({ page }) => {
  const state = await installPixFixture(page, { catalog: true });
  await page.goto('/pedidos/novo');
  await page.getByRole('radio', { name: 'Balcão', exact: true }).check();
  await page.locator('label.quick-sale-toggle').click();
  await expect(page.getByRole('checkbox', { name: /Venda rápida/ })).toBeChecked();
  await page.getByLabel('Caixa que receberá a venda').selectOption(ids.cash);
  await page.getByRole('button', { name: /Produto de teste/ }).click();
  await page.getByRole('button', { name: 'Gerar QR Code Pix' }).click();
  await expect(page.getByRole('img', { name: 'QR Code para pagamento Pix' })).toBeVisible();
  expect(state.calls.quickPix).toHaveLength(1); expect(state.calls.quickLegacy).toHaveLength(0);
  expect(state.calls.confirm).toHaveLength(0); expect(state.calls.finalize).toHaveLength(0);
  await expect(page.getByText('Venda concluída', { exact: true })).not.toBeVisible();
});

test('QR Code renderizado é decodificável e Copia e Cola preserva o payload; exibir não confirma', async ({ page, context }) => {
  const state = await installPixFixture(page); let release;
  state.gate = new Promise(resolve => { release = resolve; });
  await openPix(page); await expect(page.getByText('Gerando Pix...', { exact: true })).toBeVisible();
  expect(state.calls.confirm).toHaveLength(0); release();
  await expect(page.getByRole('img', { name: 'QR Code para pagamento Pix' })).toBeVisible();
  await page.addScriptTag({ path: require.resolve('jsqr') });
  const decoded = await page.evaluate(async () => {
    const svg = document.querySelector('dialog.pix-modal svg[role="img"]');
    const image = new Image(); const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    try {
      image.src = url; await image.decode(); const canvas = document.createElement('canvas');
      const box = svg.getBoundingClientRect(); canvas.width = Math.round(box.width); canvas.height = Math.round(box.height);
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      return window.jsQR(pixels.data, canvas.width, canvas.height)?.data;
    } finally { URL.revokeObjectURL(url); }
  });
  expect(decoded).toBe(payload); await expect(page.getByLabel('Pix Copia e Cola')).toHaveValue(payload);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copiar Pix' }).click();
  await expect(page.getByText('Código Pix copiado.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(payload);
  expect(state.calls.confirm).toHaveLength(0); expect(state.calls.finalize).toHaveLength(0); expect(state.calls.unexpected).toEqual([]);
});

test('modal mantém foco por teclado e Escape fecha sem cancelar o pagamento', async ({ page }) => {
  const state = await installPixFixture(page, { prepared: true }); await openPix(page, true);
  await expect(page.getByRole('img')).toBeVisible();
  for (let step = 0; step < 14; step++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({ inside: Boolean(document.activeElement?.closest('dialog.pix-modal')), tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label') }));
    expect(focus.inside, `Tab ${step + 1}: ${JSON.stringify(focus)}`).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog.pix-modal')))).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.locator('dialog.pix-modal')).not.toBeVisible();
  expect(state.calls.cancel).toHaveLength(0); expect(state.calls.confirm).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Retomar pagamento Pix' })).toBeVisible();
});

test('layout cabe no viewport e modal pendente passa a análise de acessibilidade', async ({ page }, info) => {
  await installPixFixture(page, { prepared: true }); await openPix(page, true);
  await expect(page.getByRole('img')).toBeVisible(); const dialog = page.locator('dialog.pix-modal');
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  const box = await dialog.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  const results = await new AxeBuilder({ page }).include('dialog.pix-modal').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  await dialog.screenshot({ path: info.outputPath('pix-pending.png') });
});

test('confirmação em duas etapas preserva recebimento após erro e repete só a finalização', async ({ page }) => {
  const state = await installPixFixture(page, { failFinalization: true }); await openPix(page);
  await expect(page.getByRole('img')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar pagamento', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Conferi o recebimento na conta bancária do estabelecimento.' }).check();
  await page.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  expect(state.calls.confirm).toHaveLength(0);
  await page.getByRole('button', { name: 'Registrar confirmação e finalizar' }).click();
  await expect(page.getByText('Estoque insuficiente', { exact: true })).toBeVisible();
  await expect(page.getByText('Pagamento confirmado manualmente', { exact: true })).toBeVisible();
  expect(state.calls.confirm).toEqual([{ received: true, cashRegisterSessionId: ids.cash }]);
  await page.getByRole('button', { name: 'Tentar finalizar novamente' }).click();
  await expect(page.locator('dialog.pix-modal')).not.toBeVisible(); await expect(page.getByText('Entregue', { exact: true })).toBeVisible();
  expect(state.calls.confirm).toHaveLength(1); expect(state.calls.finalize).toHaveLength(2);
  expect(state.calls.finalize[0]).toBe(state.calls.finalize[1]); expect(state.calls.unexpected).toEqual([]);
});

test('cancelamento exige motivo e oculta QR Code sem recriar tentativa automaticamente', async ({ page }) => {
  const state = await installPixFixture(page, { prepared: true }); await openPix(page, true);
  await expect(page.getByRole('img')).toBeVisible(); await page.getByRole('button', { name: 'Cancelar tentativa' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar cancelamento' })).toBeDisabled();
  await page.getByLabel('Motivo do cancelamento').fill('Cliente desistiu');
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByText('Tentativa de pagamento cancelada')).toBeVisible(); await expect(page.getByRole('img')).not.toBeVisible();
  expect(state.calls.create).toHaveLength(0); expect(state.calls.cancel).toEqual([{ reason: 'Cliente desistiu' }]); expect(state.calls.confirm).toHaveLength(0);
});

test('usuário de consulta não escreve e perda de acesso remove o código anteriormente exibido', async ({ page }) => {
  await page.clock.install(); const state = await installPixFixture(page, { prepared: true, readOnly: true }); await openPix(page, true);
  await expect(page.getByRole('img')).toBeVisible(); await expect(page.getByRole('checkbox')).toHaveCount(0);
  expect(state.calls.create).toHaveLength(0); state.denied = true;
  await page.clock.fastForward(10000);
  await expect(page.getByText('Acesso revogado', { exact: false })).toBeVisible();
  await expect(page.getByRole('img')).not.toBeVisible(); await expect(page.getByLabel('Pix Copia e Cola')).toHaveCount(0);
  expect(state.calls.confirm).toHaveLength(0); expect(state.calls.cancel).toHaveLength(0);
});
