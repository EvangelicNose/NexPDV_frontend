import { catalogScope } from "../../features/catalog/catalog-local";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Barcode,
  Boxes,
  ImagePlus,
  LoaderCircle,
  PackagePlus,
  Tags,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/auth-context";
import {
  createProduct,
  listCategories,
  updateProduct,
  type UpdateProductInput,
} from "../../features/catalog/catalog.api";
import type { Product } from "../../features/catalog/catalog.types";
import {
  productFormSchema,
  type ProductForm,
} from "../../features/catalog/product-form.schema";
import { ApiError } from "../../lib/api";

const decimal = (value: string) => Number(value.replace(",", "."));

export function NewProductPage() {
  return <ProductEditor />;
}

export function ProductEditor({ product }: { product?: Product }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories(),
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? "",
      categoryId: product?.category?.id ?? "",
      type: product?.type ?? "STANDARD",
      description: product?.description ?? "",
      sku: product?.sku ?? "",
      barcode: product?.barcode ?? "",
      basePrice: product?.basePrice.replace(".", ",") ?? "",
      costPrice: product?.costPrice?.replace(".", ",") ?? "",
      active: product?.active ?? true,
      trackInventory: product?.trackInventory ?? false,
    },
  });

  const submit = handleSubmit(async (values) => {
    if (!session?.company?.id) return;
    try {
      if (product) {
        const original = {
          name: product.name,
          categoryId: product.category?.id ?? null,
          description: product.description ?? null,
          sku: product.sku ?? null,
          barcode: product.barcode ?? null,
          basePrice: Number(product.basePrice),
          costPrice:
            product.costPrice === null || product.costPrice === undefined
              ? null
              : Number(product.costPrice),
          type: product.type,
          active: product.active,
          trackInventory: product.trackInventory,
        };
        const next = {
          name: values.name.trim(),
          categoryId: values.categoryId || null,
          description: values.description.trim() || null,
          sku: values.sku.trim() || null,
          barcode: values.barcode.trim() || null,
          basePrice: decimal(values.basePrice),
          costPrice: values.costPrice ? decimal(values.costPrice) : null,
          type: values.type,
          active: values.active,
          trackInventory: values.trackInventory,
        };
        const changes = Object.fromEntries(
          Object.entries(next).filter(
            ([key, value]) => value !== original[key as keyof typeof original],
          ),
        ) as UpdateProductInput;
        if (Object.keys(changes).length) {
          const updated = await updateProduct(product.id, changes);
          queryClient.setQueryData(["product", product.id], updated);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["products", catalogScope()] }),
            queryClient.invalidateQueries({ queryKey: ["stock"] }),
          ]);
        }
        navigate(`/catalogo/produtos/${product.id}`, { replace: true });
        return;
      }
      const created = await createProduct({
        companyId: session.company.id,
        name: values.name.trim(),
        ...(values.categoryId && { categoryId: values.categoryId }),
        ...(values.description.trim() && {
          description: values.description.trim(),
        }),
        ...(values.sku.trim() && { sku: values.sku.trim() }),
        ...(values.barcode.trim() && { barcode: values.barcode.trim() }),
        basePrice: decimal(values.basePrice),
        ...(values.costPrice && { costPrice: decimal(values.costPrice) }),
        type: values.type,
        active: values.active,
        trackInventory: values.trackInventory,
      });
      await queryClient.invalidateQueries({ queryKey: ["products", catalogScope()] });
      navigate(`/catalogo/produtos/${created.id}`, { replace: true });
    } catch (reason) {
      setError("root.serverError", {
        message:
          reason instanceof ApiError
            ? reason.message
            : `Não foi possível ${product ? "salvar" : "criar"} o produto.`,
      });
    }
  });

  return (
    <form className="product-editor page-enter" onSubmit={submit} noValidate>
      <Link
        className="back-link"
        to={product ? `/catalogo/produtos/${product.id}` : "/catalogo"}
      >
        <ArrowLeft size={16} />{" "}
        {product ? "Voltar ao produto" : "Voltar ao catálogo"}
      </Link>
      <div className="order-editor-heading">
        <span className="eyebrow">{product ? "Catálogo" : "Cadastro"}</span>
        <h1>{product ? "Editar produto" : "Novo produto"}</h1>
        <p>
          {product
            ? "Atualize os dados comerciais e as configurações do produto."
            : "Preencha os dados comerciais e configure como o item será vendido."}
        </p>
      </div>
      {errors.root?.serverError && (
        <div className="form-error product-form-error" role="alert">
          {errors.root.serverError.message}
        </div>
      )}
      <fieldset
        disabled={isSubmitting}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <div className="product-editor-grid">
          <div className="product-editor-main">
            <section className="catalog-panel">
              <header>
                <div>
                  <span className="panel-kicker">Informações básicas</span>
                  <h2>Dados do produto</h2>
                </div>
              </header>
              <div className="product-form-grid">
                <ProductField
                  label="Nome do produto"
                  error={errors.name?.message}
                  wide
                >
                  <input
                    {...register("name")}
                    placeholder="Ex.: Hambúrguer artesanal"
                    autoFocus
                  />
                </ProductField>
                <ProductField
                  label="Categoria"
                  error={errors.categoryId?.message}
                >
                  <select
                    {...register("categoryId")}
                    disabled={categories.isLoading || categories.isError}
                  >
                    <option value="">Sem categoria</option>
                    {product?.category &&
                      !(categories.data ?? []).some(
                        (item) => item.id === product.category?.id,
                      ) && (
                        <option value={product.category.id}>
                          {product.category.name}
                        </option>
                      )}
                    {(categories.data ?? [])
                      .filter(
                        (item) =>
                          item.active || item.id === product?.category?.id,
                      )
                      .map((item) => (
                        <option value={item.id} key={item.id}>
                          {item.name}
                          {!item.active ? " (inativa)" : ""}
                        </option>
                      ))}
                  </select>
                  {categories.isError && (
                    <small className="field-error">
                      Não foi possível carregar as categorias.{" "}
                      <button
                        type="button"
                        onClick={() => void categories.refetch()}
                      >
                        Tentar novamente
                      </button>
                    </small>
                  )}
                </ProductField>
                <ProductField label="Tipo" error={errors.type?.message}>
                  <select {...register("type")}>
                    <option value="STANDARD">Produto padrão</option>
                    <option value="COMBO">Combo</option>
                  </select>
                </ProductField>
                <ProductField
                  label="Descrição"
                  error={errors.description?.message}
                  wide
                  optional
                >
                  <textarea
                    {...register("description")}
                    placeholder="Descreva o produto para a equipe e clientes"
                  />
                </ProductField>
              </div>
            </section>
            <section className="catalog-panel">
              <header>
                <div>
                  <span className="panel-kicker">Identificação</span>
                  <h2>Códigos e estoque</h2>
                </div>
              </header>
              <div className="product-form-grid">
                <ProductField label="SKU" error={errors.sku?.message} optional>
                  <div className="input-with-icon">
                    <Tags size={16} />
                    <input {...register("sku")} placeholder="SKU-001" />
                  </div>
                </ProductField>
                <ProductField
                  label="Código de barras"
                  error={errors.barcode?.message}
                  optional
                >
                  <div className="input-with-icon">
                    <Barcode size={16} />
                    <input
                      {...register("barcode")}
                      placeholder="7890000000000"
                      inputMode="numeric"
                    />
                  </div>
                </ProductField>
                <label className="toggle-row field-wide">
                  <input type="checkbox" {...register("trackInventory")} />
                  <span />
                  <div>
                    <strong>Controlar estoque</strong>
                    <small>Movimentar o saldo deste produto nas vendas.</small>
                  </div>
                </label>
                <label className="toggle-row field-wide">
                  <input type="checkbox" {...register("active")} />
                  <span />
                  <div>
                    <strong>Produto ativo</strong>
                    <small>
                      Disponibilizar o produto para venda e novos pedidos.
                    </small>
                  </div>
                </label>
              </div>
            </section>
          </div>
          <aside className="product-editor-side">
            <section className="catalog-panel product-image-upload disabled-upload">
              <ImagePlus size={28} />
              <strong>Imagem do produto</strong>
              <span>O backend ainda não possui upload de imagens.</span>
              <button type="button" disabled>
                Selecionar imagem
              </button>
            </section>
            <section className="catalog-panel">
              <header>
                <div>
                  <span className="panel-kicker">Preço base</span>
                  <h2>Valores do produto</h2>
                </div>
              </header>
              <ProductField
                label="Valor de venda"
                error={errors.basePrice?.message}
              >
                <div className="price-editor">
                  <span>R$</span>
                  <input
                    {...register("basePrice")}
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </div>
              </ProductField>
              <ProductField
                label="Custo"
                error={errors.costPrice?.message}
                optional
              >
                <div className="price-editor cost-price-editor">
                  <span>R$</span>
                  <input
                    {...register("costPrice")}
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </div>
              </ProductField>
              <button
                className="primary-button"
                disabled={isSubmitting || !session?.company?.id}
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="spin" size={18} /> Salvando
                    produto...
                  </>
                ) : (
                  <>
                    <PackagePlus size={18} />{" "}
                    {product ? "Salvar alterações" : "Salvar produto"}
                  </>
                )}
              </button>
              {product && (
                <Link
                  className="back-link"
                  to={`/catalogo/produtos/${product.id}`}
                  style={{ marginTop: 15 }}
                >
                  Cancelar edição
                </Link>
              )}
            </section>
            <div className="editor-hint">
              <Boxes size={18} />
              <span>
                Variações, adicionais e preços por unidade poderão ser
                configurados nos detalhes após salvar.
              </span>
            </div>
          </aside>
        </div>
      </fieldset>
    </form>
  );
}

function ProductField({
  label,
  optional,
  error,
  wide,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`product-field ${wide ? "field-wide" : ""} ${error ? "has-error" : ""}`}
    >
      <span>
        {label}
        {optional && <small>Opcional</small>}
      </span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
