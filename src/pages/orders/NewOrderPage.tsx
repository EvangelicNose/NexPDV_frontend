import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  PackageSearch,
  Plus,
  ShoppingBasket,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/auth-context";
import { listProducts } from "../../features/catalog/catalog.api";
import { listCashSessions } from "../../features/cash/cash.api";
import {
  orderFormSchema,
  type OrderForm,
} from "../../features/orders/order-form.schema";
import { createOrder, listOpenTabs } from "../../features/orders/orders.api";
import { createQuickSale } from "../../features/sales/sales.api";
import { paymentMethodLabels, type PaymentMethod } from "../../features/sales/sales.types";
import { ApiError } from "../../lib/api";
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
const parsePaymentAmount = (value: string) => {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN;
};
export function NewOrderPage() {
  const { currentEstablishment } = useAuth();
  const establishmentId = currentEstablishment?.id;
  const navigate = useNavigate();
  const client = useQueryClient();
  const products = useQuery({
    queryKey: ["products", "order-form"],
    queryFn: () => listProducts({ active: true }),
  });
  const tabs = useQuery({
    queryKey: ["tabs", "open", establishmentId],
    queryFn: () => listOpenTabs(establishmentId!),
    enabled: Boolean(establishmentId),
  });
  const cashSessions = useQuery({
    queryKey: ["cash-sessions", "open", establishmentId],
    queryFn: () => listCashSessions(establishmentId!, "OPEN"),
    enabled: Boolean(establishmentId),
  });
  const [quickSale, setQuickSale] = useState(false);
  const [quickPayment, setQuickPayment] = useState({
    receivedAmount: "",
    method: "" as PaymentMethod | "",
    cashRegisterSessionId: "",
  });
  const [quickSaleError, setQuickSaleError] = useState("");
  const [completedQuickSale, setCompletedQuickSale] = useState<{ orderId: string; sequence: number } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrderForm>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      type: "DINE_IN",
      tabId: "",
      customerName: "",
      customerPhone: "",
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      notes: "",
      items: [
        { productId: "", productVariantId: "", quantity: "1", notes: "" },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const type = useWatch({ control, name: "type" });
  const items = useWatch({ control, name: "items" });
  const quickSaleAvailable = type === "COUNTER" || type === "TAKEAWAY";
  const total = (items ?? []).reduce((sum, item) => {
    const product = products.data?.find((entry) => entry.id === item.productId);
    const variant = product?.variants.find(
      (entry) => entry.id === item.productVariantId,
    );
    return (
      sum +
      (Number(product?.basePrice ?? 0) +
        Number(variant?.priceAdjustment ?? 0)) *
        Number(item.quantity.replace(",", ".") || 0)
    );
  }, 0);
  const selectedCashSession = cashSessions.data?.find(
    (session) => session.id === quickPayment.cashRegisterSessionId,
  );
  const configuredMethods = useMemo(
    () => selectedCashSession?.cashRegister.paymentMethods ?? [],
    [selectedCashSession],
  );
  useEffect(() => {
    if (quickSaleAvailable) return;
    setQuickSale(false);
    setQuickSaleError("");
  }, [quickSaleAvailable]);
  useEffect(() => {
    if (quickPayment.method && configuredMethods.some((item) => item.method === quickPayment.method)) return;
    setQuickPayment((current) => ({ ...current, method: configuredMethods[0]?.method ?? "" }));
  }, [configuredMethods, quickPayment.method]);
  const submit = handleSubmit(async (values) => {
    if (!establishmentId) return;
    setQuickSaleError("");
    try {
      if (quickSale && quickSaleAvailable) {
        if (!quickPayment.cashRegisterSessionId) {
          setQuickSaleError("Selecione qual caixa aberto receberá a venda.");
          return;
        }
        if (!quickPayment.method) {
          setQuickSaleError("Selecione um meio de pagamento configurado no terminal.");
          return;
        }
        if (quickPayment.method === "CASH") {
          const receivedAmount = parsePaymentAmount(quickPayment.receivedAmount);
          if (!Number.isFinite(receivedAmount) || receivedAmount < total) {
            setQuickSaleError("O valor recebido em dinheiro deve ser igual ou maior que o total da venda.");
            return;
          }
        }
        const sale = await createQuickSale({
          establishmentId,
          items: values.items.map((item) => ({
            productId: item.productId,
            ...(item.productVariantId && { productVariantId: item.productVariantId }),
            quantity: Number(item.quantity.replace(",", ".")),
            options: [],
            discount: 0,
          })),
          payments: [{
            method: quickPayment.method,
            amount: total.toFixed(2),
            cashRegisterSessionId: quickPayment.cashRegisterSessionId,
          }],
          discount: 0,
          fees: 0,
        });
        await Promise.all([
          client.invalidateQueries({ queryKey: ["orders"] }),
          client.invalidateQueries({ queryKey: ["cash-sessions"] }),
          client.invalidateQueries({ queryKey: ["stock"] }),
        ]);
        setCompletedQuickSale({ orderId: sale.orderId, sequence: sale.sequence });
        return;
      }
      const order = await createOrder({
        establishmentId,
        type: values.type,
        ...(values.tabId && { tabId: values.tabId }),
        ...(values.notes && { notes: values.notes }),
        ...(values.customerName && {
          customer: {
            name: values.customerName,
            ...(values.customerPhone && { phone: values.customerPhone }),
          },
        }),
        ...(values.type === "DELIVERY" && {
          deliveryAddress: {
            street: values.street,
            number: values.number,
            neighborhood: values.neighborhood,
            city: values.city,
          },
        }),
        discount: 0,
        fees: 0,
        items: values.items.map((item) => ({
          productId: item.productId,
          ...(item.productVariantId && {
            productVariantId: item.productVariantId,
          }),
          quantity: Number(item.quantity.replace(",", ".")),
          options: [],
          discount: 0,
          ...(item.notes && { notes: item.notes }),
        })),
      });
      await client.invalidateQueries({ queryKey: ["orders"] });
      navigate(`/pedidos/${order.id}`, { replace: true });
    } catch (reason) {
      setValue("root.serverError", {
        type: "server",
        message:
          reason instanceof ApiError
            ? reason.message
            : "Não foi possível criar o pedido.",
      });
    }
  });
  const startAnotherQuickSale = () => {
    reset({
      type: quickSaleAvailable ? type : "COUNTER",
      tabId: "",
      customerName: "",
      customerPhone: "",
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      notes: "",
      items: [{ productId: "", productVariantId: "", quantity: "1", notes: "" }],
    });
    setQuickPayment((current) => ({ ...current, receivedAmount: "" }));
    setQuickSaleError("");
    setCompletedQuickSale(null);
  };
  return (
    <>
    <form className="order-editor page-enter" onSubmit={submit} noValidate>
      <Link className="back-link" to="/pedidos">
        <ArrowLeft size={16} /> Voltar aos pedidos
      </Link>
      <div className="order-editor-heading">
        <span className="eyebrow">Novo atendimento</span>
        <h1>Novo pedido</h1>
        <p>Monte o pedido e revise os valores antes de confirmar.</p>
      </div>
      {(errors.root?.serverError || quickSaleError) && (
        <div className="form-error" role="alert">
          {errors.root?.serverError?.message || quickSaleError}
        </div>
      )}
      <div className="order-editor-grid">
        <div className="order-builder">
          <section>
            <header>
              <span>
                <UserRound size={18} />
              </span>
              <div>
                <strong>1. Atendimento</strong>
                <small>Canal, cliente, mesa ou endereço</small>
              </div>
            </header>
            <div className="order-type-options">
              {(["DINE_IN", "COUNTER", "TAKEAWAY", "DELIVERY"] as const).map(
                (value) => (
                  <label
                    className={type === value ? "selected" : ""}
                    key={value}
                  >
                    <input type="radio" value={value} {...register("type")} />
                    {value === "DINE_IN"
                      ? "Salão"
                      : value === "COUNTER"
                        ? "Balcão"
                        : value === "TAKEAWAY"
                          ? "Retirada"
                          : "Delivery"}
                  </label>
                ),
              )}
            </div>
            {type === "DINE_IN" && (
              <label className="builder-field">
                Comanda aberta
                <select {...register("tabId")}>
                  <option value="">Selecione uma comanda</option>
                  {(tabs.data ?? []).map((tab) => (
                    <option value={tab.id} key={tab.id}>
                      {tab.label || `Comanda ${tab.id.slice(0, 8)}`}
                      {tab.table?.number ? ` · Mesa ${tab.table.number}` : ""}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.tabId?.message} />
              </label>
            )}
            <div className="customer-fields">
              <label className="builder-field">
                Cliente <small>Opcional</small>
                <input
                  {...register("customerName")}
                  placeholder="Nome do cliente"
                />
              </label>
              <label className="builder-field">
                Telefone <small>Opcional</small>
                <input
                  {...register("customerPhone")}
                  placeholder="(00) 00000-0000"
                />
              </label>
            </div>
            {quickSaleAvailable && (
              <div className="quick-sale-block">
                <label className="quick-sale-toggle">
                  <input
                    type="checkbox"
                    checked={quickSale}
                    onChange={(event) => {
                      setQuickSale(event.target.checked);
                      setQuickSaleError("");
                    }}
                  />
                  <span aria-hidden="true" />
                  <div>
                    <strong><Zap size={15} /> Venda rápida</strong>
                    <small>Recebe o pagamento e conclui a venda imediatamente.</small>
                  </div>
                </label>
                {quickSale && (
                  <div className="quick-sale-fields">
                    <label className="builder-field">
                      Caixa que receberá a venda
                      <select
                        value={quickPayment.cashRegisterSessionId}
                        onChange={(event) => {
                          setQuickPayment({ ...quickPayment, cashRegisterSessionId: event.target.value, method: "" });
                          setQuickSaleError("");
                        }}
                      >
                        <option value="">Selecione o caixa aberto</option>
                        {(cashSessions.data ?? []).map((session) => (
                          <option value={session.id} key={session.id}>
                            {session.cashRegister.name} · {session.cashRegister.code}
                          </option>
                        ))}
                      </select>
                      {!cashSessions.isLoading && !cashSessions.data?.length && (
                        <small>Nenhuma sessão de caixa aberta nesta unidade.</small>
                      )}
                    </label>
                    <label className="builder-field">
                      Meio de pagamento
                      <select
                        value={quickPayment.method}
                        disabled={!quickPayment.cashRegisterSessionId}
                        onChange={(event) => {
                          const method = event.target.value as PaymentMethod;
                          setQuickPayment({ ...quickPayment, method, receivedAmount: method === "CASH" ? quickPayment.receivedAmount : "" });
                          setQuickSaleError("");
                        }}
                      >
                        <option value="">Selecione o meio</option>
                        {configuredMethods.map((item) => (
                          <option value={item.method} key={item.method}>
                            {paymentMethodLabels[item.method]}
                            {item.operationFeePercent != null ? ` · taxa ${Number(item.operationFeePercent).toLocaleString("pt-BR")}%` : ""}
                          </option>
                        ))}
                      </select>
                      {quickPayment.cashRegisterSessionId && !configuredMethods.length && (
                        <small>Este terminal não possui meios de pagamento configurados.</small>
                      )}
                    </label>
                    {quickPayment.method === "CASH" && <div className="quick-sale-cash">
                      <label className="builder-field">
                        Valor recebido
                        <div className="quick-sale-money">
                          <span>R$</span>
                          <input
                            inputMode="decimal"
                            value={quickPayment.receivedAmount}
                            onChange={(event) => {
                              setQuickPayment({ ...quickPayment, receivedAmount: event.target.value });
                              setQuickSaleError("");
                            }}
                            placeholder="0,00"
                          />
                        </div>
                      </label>
                      <div className="quick-sale-change">
                        <span>Troco</span>
                        <strong>{(() => {
                          const received = parsePaymentAmount(quickPayment.receivedAmount);
                          return Number.isFinite(received) && received >= total ? money(received - total) : "—";
                        })()}</strong>
                      </div>
                    </div>}
                  </div>
                )}
              </div>
            )}
            {type === "DELIVERY" && (
              <div className="delivery-fields">
                <label className="builder-field field-wide">
                  <MapPin size={15} /> Rua
                  <input {...register("street")} placeholder="Nome da rua" />
                  <FieldError message={errors.street?.message} />
                </label>
                <label className="builder-field">
                  Número
                  <input {...register("number")} placeholder="123" />
                  <FieldError message={errors.number?.message} />
                </label>
                <label className="builder-field">
                  Bairro
                  <input {...register("neighborhood")} placeholder="Bairro" />
                  <FieldError message={errors.neighborhood?.message} />
                </label>
                <label className="builder-field">
                  Cidade
                  <input {...register("city")} placeholder="Cidade" />
                  <FieldError message={errors.city?.message} />
                </label>
              </div>
            )}
          </section>
          <section>
            <header>
              <span>
                <PackageSearch size={18} />
              </span>
              <div>
                <strong>2. Produtos</strong>
                <small>Itens e variações do catálogo</small>
              </div>
            </header>
            <div className="order-items-form">
              {fields.map((field, index) => {
                const product = products.data?.find(
                  (item) => item.id === items?.[index]?.productId,
                );
                return (
                  <article key={field.id}>
                    <div className="item-line">
                      <label className="builder-field">
                        Produto
                        <select
                          {...register(`items.${index}.productId`)}
                          onChange={(event) => {
                            setValue(
                              `items.${index}.productId`,
                              event.target.value,
                              { shouldValidate: true },
                            );
                            setValue(`items.${index}.productVariantId`, "");
                          }}
                        >
                          <option value="">Selecione o produto</option>
                          {(products.data ?? []).map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.name} · {money(Number(item.basePrice))}
                            </option>
                          ))}
                        </select>
                        <FieldError
                          message={errors.items?.[index]?.productId?.message}
                        />
                      </label>
                      <label className="builder-field">
                        Variação
                        <select
                          {...register(`items.${index}.productVariantId`)}
                          disabled={!product?.variants.length}
                        >
                          <option value="">Padrão</option>
                          {product?.variants
                            .filter((item) => item.active)
                            .map((item) => (
                              <option value={item.id} key={item.id}>
                                {item.name} (
                                {Number(item.priceAdjustment) >= 0 ? "+ " : ""}
                                {money(Number(item.priceAdjustment))})
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="builder-field quantity-field">
                        Quantidade
                        <input
                          {...register(`items.${index}.quantity`)}
                          inputMode="decimal"
                        />
                        <FieldError
                          message={errors.items?.[index]?.quantity?.message}
                        />
                      </label>
                      <button
                        type="button"
                        className="remove-item"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <label className="builder-field">
                      Observação do item <small>Opcional</small>
                      <input
                        {...register(`items.${index}.notes`)}
                        placeholder="Ex.: sem cebola"
                      />
                    </label>
                  </article>
                );
              })}
            </div>
            <button
              type="button"
              className="add-item-button"
              onClick={() =>
                append({
                  productId: "",
                  productVariantId: "",
                  quantity: "1",
                  notes: "",
                })
              }
            >
              <Plus size={16} /> Adicionar outro item
            </button>
          </section>
          <label className="builder-field order-notes-field">
            Observações gerais <small>Opcional</small>
            <textarea
              {...register("notes")}
              placeholder="Informações para a cozinha ou atendimento"
            />
          </label>
        </div>
        <aside className="order-summary">
          <header>
            <ShoppingBasket size={19} />
            <strong>Resumo do pedido</strong>
          </header>
          <div className="summary-items">
            {items
              ?.filter((item) => item.productId)
              .map((item, index) => {
                const product = products.data?.find(
                  (entry) => entry.id === item.productId,
                );
                return (
                  <div key={`${item.productId}-${index}`}>
                    <span>
                      {item.quantity}× {product?.name}
                    </span>
                    <strong>
                      {money(
                        (Number(product?.basePrice ?? 0) +
                          Number(
                            product?.variants.find(
                              (entry) => entry.id === item.productVariantId,
                            )?.priceAdjustment ?? 0,
                          )) *
                          Number(item.quantity.replace(",", ".") || 0),
                      )}
                    </strong>
                  </div>
                );
              })}
          </div>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{money(total)}</dd>
            </div>
            <div>
              <dt>Adicionais</dt>
              <dd>R$ 0,00</dd>
            </div>
            <div>
              <dt>Descontos</dt>
              <dd>R$ 0,00</dd>
            </div>
            <div className="summary-total">
              <dt>Total</dt>
              <dd>{money(total)}</dd>
            </div>
          </dl>
          <button
            className="primary-button"
            disabled={isSubmitting || !establishmentId}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="spin" size={18} /> {quickSale ? "Concluindo venda..." : "Criando pedido..."}
              </>
            ) : (
              <>
                {quickSale ? "Concluir venda rápida" : "Confirmar pedido"} {quickSale ? <Zap size={18} /> : <ShoppingBasket size={18} />}
              </>
            )}
          </button>
        </aside>
      </div>
    </form>
    {completedQuickSale && (
      <div className="quick-sale-success-backdrop" role="presentation">
        <section className="quick-sale-success-modal" role="dialog" aria-modal="true" aria-labelledby="quick-sale-success-title">
          <span className="quick-sale-success-icon"><CheckCircle2 size={28} /></span>
          <span className="eyebrow">Venda concluída</span>
          <h2 id="quick-sale-success-title">Venda #{String(completedQuickSale.sequence).padStart(4, "0")} realizada com sucesso</h2>
          <p>O pagamento foi registrado e o estoque atualizado.</p>
          <div>
            <button type="button" className="secondary-button" onClick={() => navigate(`/pedidos/${completedQuickSale.orderId}`)}>
              Ver detalhes
            </button>
            <button type="button" className="primary-button" onClick={startAnotherQuickSale}>
              <Zap size={17} /> Fazer outra venda
            </button>
          </div>
        </section>
      </div>
    )}
    </>
  );
}
function FieldError({ message }: { message?: string }) {
  return message ? <small className="field-error">{message}</small> : null;
}
