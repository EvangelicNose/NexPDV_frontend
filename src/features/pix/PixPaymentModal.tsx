import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, CircleAlert, QrCode, RefreshCw, X } from "lucide-react";
import { useAuth } from "../auth/auth-context";
import { listCashSessions } from "../cash/cash.api";
import { ApiError } from "../../lib/api";
import {
  createPixPayment,
  confirmPixPayment,
  cancelPixPayment,
  listPixPayments,
  type PixPayment,
} from "./pix.api";
import { PixCopyPaste } from "./PixCopyPaste";
import { getSale, finalizeSale } from "../sales/sales.api";
import type { Sale } from "../sales/sales.types";
import "./pix.css";

const money = (value: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value),
  );
const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

export function PixPaymentModal({
  saleId,
  establishmentId,
  initialCashSessionId = "",
  onClose,
  onPaid,
  onFinalized,
}: {
  saleId: string;
  establishmentId: string;
  initialCashSessionId?: string;
  onClose: () => void;
  onPaid?: (payment: PixPayment) => void;
  onFinalized?: (sale: Sale) => void;
}) {
  const { session } = useAuth();
  const companyId = session?.company?.id;
  const canWrite =
    session?.role === "PLATFORM_ADMIN" ||
    Boolean(session?.permissions?.includes("sale.create"));
  const canRead =
    session?.role === "PLATFORM_ADMIN" ||
    Boolean(session?.permissions?.includes("order.read"));
  const client = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const started = useRef(false);
  const notified = useRef("");
  const createKey = useRef(crypto.randomUUID());
  const confirmKey = useRef(crypto.randomUUID());
  const cancelKey = useRef(crypto.randomUUID());
  const finalizationKey = useRef(crypto.randomUUID());
  const finalizedNotification = useRef("");
  const [cashSessionId, setCashSessionId] = useState(initialCashSessionId);
  const [checked, setChecked] = useState(false);
  const [review, setReview] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const queryKey = ["pix-payments", companyId, establishmentId, saleId];
  const query = useQuery({
    queryKey,
    queryFn: () => listPixPayments(saleId),
    enabled: canRead && Boolean(companyId),
    staleTime: 0,
    refetchInterval: (data) =>
      data.state.data?.some((payment) => payment.status === "PENDING")
        ? 5000
        : false,
  });
  const accessDenied =
    !canRead ||
    (query.error instanceof ApiError &&
      [401, 403, 404].includes(query.error.status));
  const payments = accessDenied ? [] : (query.data ?? []);
  const current =
    payments.find((payment) => payment.status === "PENDING") ?? payments.at(-1);
  const paymentId = current?.id;
  useEffect(() => {
    if (paymentId) {
      confirmKey.current = crypto.randomUUID();
      cancelKey.current = crypto.randomUUID();
      setChecked(false);
      setReview(false);
      setCancelling(false);
    }
  }, [paymentId]);
  const saleQueryKey = ["sale", companyId, establishmentId, saleId];
  const saleQuery = useQuery({
    queryKey: saleQueryKey,
    queryFn: () => getSale(saleId),
    enabled: canRead && Boolean(companyId) && !accessDenied,
    staleTime: 0,
  });
  const isFinalized = Boolean(saleQuery.data?.finalizedAt);
  const sessions = useQuery({
    queryKey: ["cash-sessions", "pix", companyId, establishmentId],
    queryFn: () => listCashSessions(establishmentId, "OPEN"),
    enabled: canWrite && current?.status === "PENDING",
  });
  const available =
    sessions.data?.filter((item) =>
      item.cashRegister.paymentMethods.some(
        (method) => method.method === "PIX",
      ),
    ) ?? [];
  const update = (payment: PixPayment) => {
    client.setQueryData<PixPayment[]>(queryKey, (existing) => [
      ...(existing ?? []).filter((item) => item.id !== payment.id),
      payment,
    ]);
    void client.invalidateQueries({ queryKey });
    for (const key of [
      "order",
      "orders",
      "orders-board",
      "cash-sessions",
      "cash-session",
      "reports-overview",
    ])
      void client.invalidateQueries({ queryKey: [key] });
    setChecked(false);
    setReview(false);
    setCancelling(false);
  };
  const create = useMutation({
    mutationFn: () => createPixPayment(saleId, createKey.current),
    onSuccess: update,
    onError: () => {
      void query.refetch();
    },
  });
  const finalization = useMutation({
    mutationFn: () => finalizeSale(saleId, finalizationKey.current),
    onSuccess: (sale) => {
      client.setQueryData(saleQueryKey, sale);
      for (const key of [
        "order",
        "orders",
        "orders-board",
        "stock",
        "stock-movements",
        "tabs",
        "tables",
        "reports-overview",
        "cash-sessions",
      ])
        void client.invalidateQueries({ queryKey: [key] });
    },
    onError: () => {
      void saleQuery.refetch();
    },
  });
  const confirm = useMutation({
    mutationFn: () =>
      confirmPixPayment(current!.id, cashSessionId, confirmKey.current),
    onSuccess: update,
    onError: () => {
      void query.refetch();
      void sessions.refetch();
    },
  });
  const cancel = useMutation({
    mutationFn: () =>
      cancelPixPayment(current!.id, reason.trim(), cancelKey.current),
    onSuccess: update,
    onError: () => {
      void query.refetch();
    },
  });
  const busy =
    processing ||
    create.isPending ||
    confirm.isPending ||
    cancel.isPending ||
    finalization.isPending;
  const startCreation = create.mutate;
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (
      query.isSuccess &&
      canRead &&
      !payments.length &&
      canWrite &&
      !started.current
    ) {
      started.current = true;
      startCreation();
    }
  }, [query.isSuccess, payments.length, canRead, canWrite, startCreation]);
  useEffect(() => {
    if (current?.status === "PAID" && notified.current !== current.id) {
      notified.current = current.id;
      onPaid?.(current);
    }
  }, [current, onPaid]);
  useEffect(() => {
    if (
      saleQuery.data?.finalizedAt &&
      finalizedNotification.current !== saleQuery.data.id
    ) {
      finalizedNotification.current = saleQuery.data.id;
      onFinalized?.(saleQuery.data);
    }
  }, [saleQuery.data, onFinalized]);
  const confirmAndFinalize = async () => {
    setProcessing(true);
    try {
      await confirm.mutateAsync();
      const result = await saleQuery.refetch();
      if (result.data?.status === "COMPLETED") await finalization.mutateAsync();
    } catch {
      /* The registered receipt remains visible; retry finalization without confirming again. */
    } finally {
      setProcessing(false);
    }
  };
  const resetErrors = () => {
    create.reset();
    confirm.reset();
    cancel.reset();
  };
  const mutationError =
    create.error ?? confirm.error ?? cancel.error ?? finalization.error;
  const generate = () => {
    resetErrors();
    createKey.current = crypto.randomUUID();
    create.mutate();
  };
  return (
    <dialog
      ref={dialog}
      className="pix-modal ml-auto mr-auto"
      aria-labelledby="pix-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) {
          event.preventDefault();
          event.currentTarget.focus();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <span>
          <QrCode size={23} />
        </span>
        <div>
          <h2 id="pix-title">Pagamento Pix</h2>
          <p>Recebimento com confirmação manual.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Fechar Pix"
        >
          <X size={20} />
        </button>
      </header>
      <div className="pix-body">
        <div className="pix-warning">
          <CircleAlert size={21} />
          <p>
            Confirme o recebimento do Pix na conta bancária do estabelecimento
            antes de finalizar a venda.
          </p>
        </div>
        {!canRead && (
          <p className="form-error" role="alert">
            Você não tem permissão para consultar os pagamentos desta venda.
          </p>
        )}
        {(query.isLoading || create.isPending) && (
          <p className="pix-loading" role="status">
            <RefreshCw className="spin" size={20} />{" "}
            {create.isPending ? "Gerando Pix..." : "Carregando pagamento..."}
          </p>
        )}
        {query.isError && (
          <div className="form-error" role="alert">
            {message(query.error)}{" "}
            <button type="button" onClick={() => void query.refetch()}>
              Tentar consultar novamente
            </button>
          </div>
        )}
        {mutationError && (
          <div className="form-error" role="alert">
            {message(mutationError)}
            {create.isError && !current && (
              <button
                type="button"
                disabled={busy}
                onClick={() => create.mutate()}
              >
                Tentar gerar novamente
              </button>
            )}
          </div>
        )}
        {current && (
          <>
            <div className="pix-amount">
              <small>Valor do Pix</small>
              <strong>{money(current.amount)}</strong>
            </div>
            <p
              className={`pix-status ${current.status.toLowerCase()}`}
              role="status"
            >
              {current.status === "PENDING"
                ? "Aguardando pagamento · confirmação manual"
                : current.status === "PAID"
                  ? "Pagamento confirmado manualmente"
                  : "Tentativa de pagamento cancelada"}
            </p>
            {current.status === "PENDING" && (
              <>
                <div className="pix-qr">
                  <QRCodeSVG
                    value={current.payload}
                    size={256}
                    marginSize={4}
                    level="M"
                    title="QR Code para pagamento Pix"
                    role="img"
                  />
                </div>
                <p className="pix-instructions">
                  Escaneie com o aplicativo do banco ou use o Pix Copia e Cola.
                </p>
                <PixCopyPaste payload={current.payload} />
                <small className="pix-txid">
                  Identificador: {current.txid}
                </small>
                {canWrite && (
                  <>
                    <label className="pix-session">
                      Caixa para registrar o recebimento
                      <select
                        value={cashSessionId}
                        disabled={busy}
                        onChange={(event) => {
                          setCashSessionId(event.target.value);
                          confirmKey.current = crypto.randomUUID();
                          resetErrors();
                        }}
                      >
                        <option value="">Selecione o caixa</option>
                        {available.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.cashRegister.name} · {item.cashRegister.code}
                          </option>
                        ))}
                      </select>
                    </label>
                    {sessions.isError && (
                      <p className="form-error" role="alert">
                        Não foi possível consultar os caixas.{" "}
                        <button
                          type="button"
                          onClick={() => void sessions.refetch()}
                        >
                          Tentar novamente
                        </button>
                      </p>
                    )}
                    {!sessions.isLoading &&
                      !sessions.isError &&
                      !available.length && (
                        <p className="form-error">
                          Abra um caixa com Pix configurado para registrar o
                          recebimento.
                        </p>
                      )}
                    {!review && !cancelling && (
                      <>
                        <label className="pix-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy}
                            onChange={(event) =>
                              setChecked(event.target.checked)
                            }
                          />
                          <span>
                            Conferi o recebimento na conta bancária do
                            estabelecimento.
                          </span>
                        </label>
                        <div className="pix-actions">
                          <button
                            type="button"
                            className="secondary-button p-2"
                            disabled={busy}
                            onClick={() => {
                              resetErrors();
                              setCancelling(true);
                            }}
                          >
                            Cancelar tentativa
                          </button>
                          <button
                            type="button"
                            className="primary-button p-2"
                            disabled={
                              busy ||
                              !checked ||
                              !available.some(
                                (item) => item.id === cashSessionId,
                              )
                            }
                            onClick={() => {
                              resetErrors();
                              setReview(true);
                            }}
                          >
                            Confirmar pagamento
                          </button>
                        </div>
                      </>
                    )}
                    {review && (
                      <section
                        className="pix-review"
                        aria-label="Confirmação manual"
                      >
                        <h3>
                          Registrar recebimento de {money(current.amount)}?
                        </h3>
                        <p>
                          Esta ação registra sua confirmação manual e finaliza a
                          venda após validar o saldo e o estoque. Confira a
                          conta bancária antes de prosseguir.
                        </p>
                        <div className="pix-actions">
                          <button
                            type="button"
                            className="secondary-button p-2"
                            disabled={busy}
                            onClick={() => setReview(false)}
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            className="primary-button p-2"
                            disabled={
                              busy ||
                              !checked ||
                              !available.some(
                                (item) => item.id === cashSessionId,
                              )
                            }
                            onClick={() => void confirmAndFinalize()}
                          >
                            {confirm.isPending && (
                              <RefreshCw size={17} className="spin" />
                            )}{" "}
                            Registrar confirmação e finalizar
                          </button>
                        </div>
                      </section>
                    )}
                    {cancelling && (
                      <form
                        className="pix-review"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!busy && reason.trim().length >= 3)
                            cancel.mutate();
                        }}
                      >
                        <label>
                          Motivo do cancelamento
                          <textarea
                            autoFocus
                            required
                            minLength={3}
                            maxLength={500}
                            value={reason}
                            disabled={busy}
                            onChange={(event) => {
                              setReason(event.target.value);
                              cancelKey.current = crypto.randomUUID();
                              cancel.reset();
                            }}
                          />
                        </label>
                        <p>
                          Cancelar esta tentativa não cancela um Pix realizado
                          no banco.
                        </p>
                        <div className="pix-actions">
                          <button
                            type="button"
                            className="secondary-button p-2"
                            disabled={busy}
                            onClick={() => setCancelling(false)}
                          >
                            Voltar
                          </button>
                          <button
                            type="submit"
                            className="cancel-order-button p-2"
                            disabled={busy || reason.trim().length < 3}
                          >
                            {cancel.isPending && (
                              <RefreshCw size={17} className="spin" />
                            )}{" "}
                            Confirmar cancelamento
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </>
            )}
            {current.status === "PAID" && (
              <div className="pix-done">
                <CheckCircle2 size={26} />
                <p>
                  {isFinalized
                    ? "Venda finalizada. Pagamento e estoque registrados."
                    : "Recebimento registrado. O pedido está pronto para finalização."}
                </p>
                {current.confirmedAt && (
                  <small>
                    Confirmado em{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(current.confirmedAt))}
                  </small>
                )}
                {saleQuery.isLoading && (
                  <p role="status">Consultando finalização...</p>
                )}
                {saleQuery.isError && (
                  <p className="form-error" role="alert">
                    {message(saleQuery.error)}{" "}
                    <button
                      type="button"
                      onClick={() => void saleQuery.refetch()}
                    >
                      Consultar venda novamente
                    </button>
                  </p>
                )}
                {!isFinalized &&
                  canWrite &&
                  saleQuery.data?.status === "COMPLETED" && (
                    <button
                      type="button"
                      className="primary-button p-2"
                      disabled={busy}
                      onClick={() => finalization.mutate()}
                    >
                      {finalization.isPending && (
                        <RefreshCw size={17} className="spin" />
                      )}{" "}
                      {finalization.isPending
                        ? "Finalizando venda..."
                        : finalization.isError
                          ? "Tentar finalizar novamente"
                          : "Finalizar venda"}
                    </button>
                  )}
                {canWrite && saleQuery.data?.status === "PARTIALLY_PAID" && (
                  <button
                    type="button"
                    className="primary-button p-2"
                    disabled={busy}
                    onClick={generate}
                  >
                    Gerar Pix para saldo restante
                  </button>
                )}
              </div>
            )}
            {current.status === "CANCELLED" && (
              <div className="pix-done">
                <p>{current.cancellationReason}</p>
                {canWrite && (
                  <button
                    type="button"
                    className="primary-button p-2"
                    disabled={busy}
                    onClick={generate}
                  >
                    Gerar nova tentativa
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {query.isSuccess && !current && !canWrite && (
          <p>Nenhuma tentativa Pix registrada para esta venda.</p>
        )}
        <p className="pix-local-status">
          O status mostra os registros do NexPDV. Não há detecção automática do
          banco.
        </p>
      </div>
      <footer>
        <button
          type="button"
          className="secondary-button p-2"
          disabled={busy}
          onClick={onClose}
        >
          {current?.status === "PENDING" ? "Fechar e retomar depois" : "Fechar"}
        </button>
      </footer>
    </dialog>
  );
}
