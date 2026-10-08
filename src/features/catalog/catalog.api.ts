import { apiRequest } from "../../lib/api";
import { catalogScope, localProducts, updateLocalProduct, expireLocalCatalog, type ProductFilters } from "./catalog-local";
import type { Category, OptionGroup, Product, ProductVariant } from "./catalog.types";
export const createProductVariant = (productId: string, input: {
  name: string;
  sku?: string;
  barcode?: string;
  priceAdjustment: string;
  active: boolean;
}) => mutateVariant(productId, () => apiRequest<ProductVariant>(`/v1/products/${productId}/variants`, {
  method: 'POST',
  body: JSON.stringify(input),
}));
export const listProducts = (input: ProductFilters = {}, force = false) => localProducts(input, force);
export const getProduct = (id: string) =>
  apiRequest<Product>(`/v1/products/${id}`);
export type UpdateProductInput = Partial<{
  name: string;
  categoryId: string | null;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  basePrice: number;
  costPrice: number | null;
  type: Product['type'];
  active: boolean;
  trackInventory: boolean;
}>;
export const updateProduct = (id: string, input: UpdateProductInput) =>
  mutateProduct(() => apiRequest<Product>(`/v1/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }));
export const listCategories = (search?: string) =>
  apiRequest<Category[]>(
    `/v1/categories${search ? `?search=${encodeURIComponent(search)}` : ""}`,
  );
export const listOptionGroups = () =>
  apiRequest<OptionGroup[]>("/v1/products/option-groups");
export const createProduct = (input: {
  categoryId?: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  basePrice: number;
  costPrice?: number;
  type: "STANDARD" | "COMBO";
  active: boolean;
  trackInventory: boolean;
  companyId: string;
}) =>
  mutateProduct(() => apiRequest<Product>("/v1/products", {
    method: "POST",
    body: JSON.stringify(input),
  }));

async function mutateProduct(request: () => Promise<Product>) {
  const scope = catalogScope();
  const product = await request();
  await updateLocalProduct(scope, product);
  return product;
}
async function mutateVariant(productId: string, request: () => Promise<ProductVariant>) {
  const scope = catalogScope();
  const variant = await request();
  await expireLocalCatalog(scope);
  if (catalogScope() === scope) {
    try { await updateLocalProduct(scope, await getProduct(productId)); }
    catch { /* Creation succeeded; the next synchronization will update the cache. */ }
  }
  return variant;
}
