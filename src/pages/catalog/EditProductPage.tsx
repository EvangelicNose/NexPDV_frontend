import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getProduct } from "../../features/catalog/catalog.api";
import { ApiError } from "../../lib/api";
import { ProductEditor } from "./NewProductPage";

export function EditProductPage() {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["product", id],
    queryFn: () => getProduct(id),
    enabled: Boolean(id),
  });
  if (query.isLoading)
    return (
      <div className="orders-empty" role="status">
        <RefreshCw className="spin" />
        <span>Carregando produto...</span>
      </div>
    );
  if (query.isError || !query.data)
    return (
      <section className="order-not-found" role="alert">
        <strong>
          {query.error instanceof ApiError && query.error.status === 404
            ? "Produto não encontrado"
            : "Não foi possível carregar o produto"}
        </strong>
        {query.error instanceof Error && <p>{query.error.message}</p>}
        <Link className="back-link" to="/catalogo">
          <ArrowLeft size={16} /> Voltar ao catálogo
        </Link>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          Tentar novamente
        </button>
      </section>
    );
  return <ProductEditor key={id} product={query.data} />;
}
