import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Barcode,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../features/auth/auth-context";
import { listProducts } from "../../features/catalog/catalog.api";
import type {
  Product,
  ProductVariant,
} from "../../features/catalog/catalog.types";
import { listCashSessions } from "../../features/cash/cash.api";
import {
  createQuickSale,
  prepareQuickPix,
  type QuickSaleInput,
} from "../../features/sales/sales.api";
import { PixPaymentModal } from '../../features/pix/PixPaymentModal';
import {
  paymentMethodLabels,
  type PaymentMethod,
  type Sale,
} from "../../features/sales/sales.types";
import { ApiError } from "../../lib/api";
import "./sale.css";

type Line = {
  key: string;
  product: Product;
  variant?: ProductVariant;
  sku: string;
  quantity: number;
  unitCents: number;
};
type Submission = { input: QuickSaleInput; key: string };
const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
function unitPrice(
  product: Product,
  variant: ProductVariant | undefined,
  establishmentId: string,
) {
  const now = Date.now();
  const prices = product.prices
    .filter(
      (price) =>
        price.active &&
        (!price.establishmentId || price.establishmentId === establishmentId) &&
        (!price.productVariantId || price.productVariantId === variant?.id) &&
        (!price.startsAt || Date.parse(price.startsAt) <= now) &&
        (!price.endsAt || Date.parse(price.endsAt) > now),
    )
    .sort(
      (a, b) =>
        Number(b.productVariantId === variant?.id) -
          Number(a.productVariantId === variant?.id) ||
        Number(b.establishmentId === establishmentId) -
          Number(a.establishmentId === establishmentId),
    );
  return Math.round(
    (prices[0]
      ? Number(prices[0].amount)
      : Number(product.basePrice) + Number(variant?.priceAdjustment ?? 0)) *
      100,
  );
}

export function SalePage() {
  const { currentEstablishment } = useAuth();
  return currentEstablishment ? (
    <SaleTerminal
      key={currentEstablishment.id}
      establishmentId={currentEstablishment.id}
    />
  ) : (
    <p>Selecione uma unidade para iniciar a venda.</p>
  );
}

function SaleTerminal({ establishmentId }: { establishmentId: string }) {
  const client = useQueryClient();
  const skuInput = useRef<HTMLInputElement>(null);
  const addingRef = useRef(false);
  const submittingRef = useRef(false);
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [lines, setLines] = useState<Line[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [paying, setPaying] = useState(false);
  const [completed, setCompleted] = useState<Sale | null>(null);
  const [pixSale, setPixSale] = useState<Sale | null>(null);
  const [pixReceived, setPixReceived] = useState(false);
  const [pixFinalized, setPixFinalized] = useState(false);
  const [pixOrder, setPixOrder] = useState<{ id: string; received: boolean } | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const sessions = useQuery({
    queryKey: ["cash-sessions", "open", establishmentId],
    queryFn: () => listCashSessions(establishmentId, "OPEN"),
  });
  const available = sessions.data ?? [];
  const selected = available.find((session) => session.id === sessionId);
  const methods = selected?.cashRegister.paymentMethods ?? [];
  const total = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitCents,
    0,
  );
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  const sale = useMutation({
    mutationFn: (request: Submission) =>
      createQuickSale(request.input, request.key),
    onSuccess: (result) => {
      setCompleted(result);
      setSku("");
      setQuantity("1");
      setLines([]);
      setPaying(false);
      setSubmission(null);
      setMethod("");
      setError("");
      requestAnimationFrame(() => skuInput.current?.focus());
      for (const key of [
        "cash-sessions",
        "cash-session",
        "stock",
        "orders",
        "reports",
        "dashboard",
      ])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
  const preparation = useMutation({ mutationFn: (request: Submission) => prepareQuickPix(request.input, request.key),
    onSuccess: result => { setPixSale(result); setPixReceived(false); setPixFinalized(false); setPaying(false); setSubmission(null); void client.invalidateQueries({ queryKey: ['orders'] }) },
  });
  const locked = sale.isPending || preparation.isPending || submission !== null || pixSale !== null;
  const closePix = () => {
    if (!pixSale) return;
    setPixOrder(pixFinalized ? null : { id: pixSale.orderId, received: pixReceived }); setPixSale(null);
    setLines([]); setSku(''); setQuantity('1'); setMethod(''); setError(''); setSubmission(null);
    requestAnimationFrame(() => skuInput.current?.focus());
  };

  async function addProduct(event: FormEvent) {
    event.preventDefault();
    if (addingRef.current || locked || paying) return;
    const count = Number(quantity);
    if (
      !sku.trim() ||
      !Number.isSafeInteger(count) ||
      count < 1 ||
      count > 999999
    ) {
      setError(
        "Informe o SKU ou código de barras e uma quantidade inteira entre 1 e 999999.",
      );
      return;
    }
    addingRef.current = true;
    setAdding(true);
    setError("");
    setCompleted(null);
    try {
      const code = sku.trim().toLocaleLowerCase();
      const results = await Promise.all([
        listProducts({ sku: sku.trim(), active: true }),
        listProducts({ barcode: sku.trim(), active: true }),
      ]);
      const products = [
        ...new Map(
          results.flat().map((product) => [product.id, product]),
        ).values(),
      ];
      const matches = products.flatMap((product) => [
        ...(product.sku?.toLocaleLowerCase() === code ||
        product.barcode === sku.trim()
          ? [{ product, variant: undefined as ProductVariant | undefined }]
          : []),
        ...product.variants
          .filter(
            (variant) =>
              variant.active &&
              (variant.sku?.toLocaleLowerCase() === code ||
                variant.barcode === sku.trim()),
          )
          .map((variant) => ({ product, variant })),
      ]);
      if (!matches.length)
        throw new Error(
          "Nenhum produto ativo encontrado com esse SKU ou código de barras.",
        );
      if (matches.length > 1)
        throw new Error(
          "Esse código está cadastrado em mais de um item. Corrija o cadastro para continuar.",
        );
      const { product, variant } = matches[0]!;
      if (
        product.optionGroups.some(
          (group) =>
            group.active && (group.required || group.minSelections > 0),
        )
      )
        throw new Error(
          "Este produto exige adicionais. Utilize a tela de novo pedido para escolher as opções.",
        );
      const key = `${product.id}:${variant?.id ?? ""}`;
      const existing = lines.find((line) => line.key === key);
      if (existing && existing.quantity + count > 999999)
        throw new Error("A quantidade máxima por item é 999999.");
      if (!existing && lines.length >= 100)
        throw new Error("A venda permite até 100 produtos diferentes.");
      const unitCents = unitPrice(product, variant, establishmentId);
      if (!Number.isFinite(unitCents) || unitCents < 0)
        throw new Error("O produto não possui um preço válido.");
      setLines((current) =>
        existing
          ? current.map((line) =>
              line.key === key
                ? { ...line, quantity: line.quantity + count }
                : line,
            )
          : [
              ...current,
              {
                key,
                product,
                variant,
                sku: variant?.sku ?? product.sku ?? sku.trim(),
                quantity: count,
                unitCents,
              },
            ],
      );
      setSku("");
      setQuantity("1");
    } catch (failure) {
      setError(message(failure));
    } finally {
      addingRef.current = false;
      setAdding(false);
      requestAnimationFrame(() => skuInput.current?.focus());
    }
  }

  async function finish(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (
      !submission &&
      (!selected ||
        !methods.some((item) => item.method === method) ||
        !lines.length ||
        total <= 0)
    ) {
      setError("Selecione um caixa aberto e um meio de pagamento disponível.");
      return;
    }
    const request = submission ?? {
      key: crypto.randomUUID(),
      input: {
        establishmentId,
        items: lines.map((line) => ({
          productId: line.product.id,
          productVariantId: line.variant?.id,
          quantity: line.quantity,
          options: [] as never[],
          discount: 0,
        })),
        discount: 0,
        fees: 0,
        payments: [
          {
            method: method as PaymentMethod,
            amount: (total / 100).toFixed(2),
            cashRegisterSessionId: sessionId,
          },
        ],
      },
    };
    submittingRef.current = true;
    setSubmission(request);
    setError("");
    try {
      if (request.input.payments.some(payment => payment.method === 'PIX')) await preparation.mutateAsync(request);
      else await sale.mutateAsync(request);
    } catch (failure) {
      setError(message(failure));
      // Keep the same payload and key after an uncertain response so retrying cannot duplicate a sale.
      if (
        failure instanceof ApiError &&
        failure.status < 500 &&
        failure.code !== "IDEMPOTENCY_IN_PROGRESS"
      )
        setSubmission(null);
      void sessions.refetch();
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <section className="pos-page">
      <header className="pos-heading">
        <div>
          <span className="eyebrow">Frente de caixa</span>
          <h1>Venda</h1>
          <p>
            Informe o SKU ou código de barras, adicione os produtos e conclua o
            pagamento.
          </p>
        </div>
        <span className="pos-badge">
          <ShoppingCart size={17} /> {units}{" "}
          {units === 1 ? "unidade" : "unidades"}
        </span>
      </header>
      {completed && (
        <div className="pos-success" role="status">
          <CheckCircle2 size={23} />
          <div>
            <strong>Venda #{completed.sequence} concluída</strong>
            <span>
              Pagamento de {money(Math.round(Number(completed.total) * 100))}{" "}
              registrado. Pronto para a próxima venda.
            </span>
          </div>
          <Link to={`/pedidos/${completed.orderId}`}>Ver venda</Link>
        </div>
      )}
      {pixOrder && <div className="pos-success" role="status"><CreditCard size={23}/><div><strong>{pixOrder.received ? 'Pix confirmado manualmente' : 'Pagamento Pix pendente'}</strong><span><Link to={`/pedidos/${pixOrder.id}`}>{pixOrder.received ? 'Ver pedido para finalização' : 'Retomar pagamento no pedido'}</Link></span></div></div>}
      {error && (
        <div className="pos-error" role="alert">
          {error}
        </div>
      )}
      <div className="pos-grid">
        <div className="pos-main">
          <form
            className="pos-scan"
            onSubmit={(event) => void addProduct(event)}
          >
            <label className="pos-sku">
              <span>SKU ou código de barras</span>
              <div>
                <Barcode size={23} />
                <input
                  ref={skuInput}
                  autoFocus
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                  placeholder="Digite ou escaneie o código"
                  autoComplete="off"
                  disabled={adding || locked || paying}
                />
              </div>
            </label>
            <label>
              <span>Quantidade (un)</span>
              <input
                type="number"
                min="1"
                max="999999"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                disabled={adding || locked || paying}
              />
            </label>
            <button
              className="primary-button"
              disabled={adding || locked || paying || !sku.trim()}
            >
              {adding ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Plus size={18} />
              )}{" "}
              Adicionar
            </button>
            <small>
              Pressione Enter para adicionar. A quantidade volta para 1 após
              cada lançamento.
            </small>
          </form>
          <div className="pos-list">
            <header>
              <h2>Produtos da venda</h2>
              <span>
                {lines.length} {lines.length === 1 ? "item" : "itens"}
              </span>
            </header>
            {!lines.length ? (
              <div className="pos-empty">
                <Barcode size={42} />
                <strong>Aguardando o primeiro produto</strong>
                <p>
                  Informe o SKU ou código de barras no campo acima para começar.
                </p>
              </div>
            ) : (
              <div className="pos-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Produto / SKU</th>
                      <th>Valor unitário</th>
                      <th>Quantidade</th>
                      <th>Total</th>
                      <th>
                        <span className="sr-only">Remover</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.key}>
                        <td>
                          <strong>{line.product.name}</strong>
                          <small>
                            {line.variant?.name
                              ? `${line.variant.name} · `
                              : ""}
                            {line.sku}
                          </small>
                        </td>
                        <td>{money(line.unitCents)}</td>
                        <td>
                          <input
                            aria-label={`Quantidade de ${line.product.name} ${line.variant?.name ?? ""}`}
                            type="number"
                            min="1"
                            max="999999"
                            step="1"
                            value={line.quantity}
                            disabled={adding || locked || paying}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              if (
                                Number.isSafeInteger(value) &&
                                value >= 1 &&
                                value <= 999999
                              ) {
                                setLines((current) =>
                                  current.map((item) =>
                                    item.key === line.key
                                      ? { ...item, quantity: value }
                                      : item,
                                  ),
                                );
                                setError("");
                              }
                            }}
                          />
                        </td>
                        <td>
                          <strong>
                            {money(line.quantity * line.unitCents)}
                          </strong>
                        </td>
                        <td>
                          <button
                            className="pos-remove"
                            aria-label={`Remover ${line.product.name}`}
                            disabled={adding || locked || paying}
                            onClick={() => {
                              setLines((current) =>
                                current.filter((item) => item.key !== line.key),
                              );
                              setError("");
                            }}
                          >
                            <Trash2 size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <aside className="pos-summary">
          <span className="eyebrow">Resumo da venda</span>
          <h2>Caixa utilizado</h2>
          <label className="pos-register-label">
            <span>Selecione um caixa aberto</span>
            <select
              value={sessionId}
              disabled={locked || paying}
              onChange={(event) => {
                setSessionId(event.target.value);
                setMethod("");
                setError("");
              }}
            >
              <option value="">Selecione o caixa</option>
              {available.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.cashRegister.name} · {session.cashRegister.code}
                </option>
              ))}
            </select>
          </label>
          {sessions.isLoading && <p role="status">Carregando caixas...</p>}
          {sessions.isError && (
            <p className="pos-inline-error">
              Não foi possível carregar os caixas.{" "}
              <button onClick={() => void sessions.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {!sessions.isLoading && !sessions.isError && !available.length && (
            <p className="pos-inline-error">
              Nenhum caixa aberto. <Link to="/caixa/abrir">Abrir caixa</Link>
            </p>
          )}
          {selected && !methods.length && (
            <p className="pos-inline-error">
              Este caixa não possui meios de pagamento configurados.
            </p>
          )}
          <dl>
            <div>
              <dt>Produtos</dt>
              <dd>{lines.length}</dd>
            </div>
            <div>
              <dt>Unidades</dt>
              <dd>{units}</dd>
            </div>
          </dl>
          <div className="pos-total">
            <span>Total a pagar</span>
            <strong>{money(total)}</strong>
          </div>
          <button
            className="primary-button pos-checkout"
            disabled={
              !lines.length ||
              total <= 0 ||
              !selected ||
              !methods.length ||
              adding ||
              locked ||
              paying
            }
            onClick={() => {
              setPaying(true);
              setError("");
              setMethod("");
              void sessions.refetch();
            }}
          >
            <CreditCard size={19} /> Concluir venda
          </button>
          <small className="pos-summary-note">
            O estoque e o pagamento são registrados ao confirmar a venda.
          </small>
        </aside>
      </div>
      {paying && (
        <dialog
          className="pos-modal-backdrop"
          aria-labelledby="pos-payment-title"
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          onCancel={(event) => {
            event.preventDefault();
            if (!locked) {
              setPaying(false);
              setError("");
            }
          }}
        >
          <section className="pos-payment">
            <header>
              <div>
                <span className="eyebrow">Finalização</span>
                <h2 id="pos-payment-title">Meio de pagamento</h2>
              </div>
              <button
                aria-label="Voltar à venda"
                disabled={locked}
                onClick={() => {
                  setPaying(false);
                  setError("");
                  requestAnimationFrame(() => skuInput.current?.focus());
                }}
              >
                <X size={21} />
              </button>
            </header>
            <p>
              {selected?.cashRegister.name ?? "Caixa indisponível"} · {units}{" "}
              unidades
            </p>
            <div className="pos-payment-total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            <form onSubmit={(event) => void finish(event)}>
              <fieldset disabled={locked}>
                <legend>Selecione como o cliente vai pagar</legend>
                <div className="pos-methods">
                  {methods.map((item) => (
                    <label
                      className={method === item.method ? "selected" : ""}
                      key={item.method}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={item.method}
                        checked={method === item.method}
                        onChange={() => {
                          setMethod(item.method);
                          setError("");
                        }}
                      />
                      <CreditCard size={18} />
                      {paymentMethodLabels[item.method]}
                    </label>
                  ))}
                </div>
              </fieldset>
              {error && (
                <p className="pos-error" role="alert">
                  {error}
                </p>
              )}
              {submission && !sale.isPending && (
                <p>
                  A confirmação não foi recebida. Tente novamente para consultar
                  ou concluir a mesma venda.
                </p>
              )}
              {!selected && (
                <p className="pos-inline-error">
                  O caixa não está mais aberto. Volte à venda e selecione outro
                  caixa.
                </p>
              )}
              <button
                autoFocus
                className="primary-button pos-checkout"
                disabled={
                  sale.isPending || preparation.isPending ||
                  (!submission &&
                    (!method ||
                      !selected ||
                      !methods.some((item) => item.method === method)))
                }
              >
                {sale.isPending || preparation.isPending ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}{" "}
                {preparation.isPending ? 'Preparando Pix...' : method === 'PIX' && !submission ? 'Gerar QR Code Pix' : sale.isPending
                  ? "Concluindo venda..."
                  : submission
                    ? "Tentar confirmar novamente"
                    : "Confirmar pagamento e venda"}
              </button>
            </form>
          </section>
        </dialog>
      )}
      {pixSale && <PixPaymentModal saleId={pixSale.id} establishmentId={establishmentId} initialCashSessionId={sessionId} onClose={closePix} onPaid={() => setPixReceived(true)} onFinalized={sale => { setPixFinalized(true); setCompleted(sale) }}/>}
    </section>
  );
}
