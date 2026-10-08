import { apiRequest } from "../../lib/api";
import type { Category, OptionGroup, Product, ProductVariant } from "./catalog.types";
export const createProductVariant = (productId: string, input: {
  name: string;
  sku?: string;
  barcode?: string;
  priceAdjustment: string;
  active: boolean;
}) => apiRequest<ProductVariant>(`/v1/products/${productId}/variants`, {
  method: 'POST',
  body: JSON.stringify(input),
});
export const listProducts = (
  input: { search?: string; sku?: string; barcode?: string; categoryId?: string; active?: boolean } = {},
) => {
  const query = new URLSearchParams({ limit: "100" });
  if (input.search) query.set("search", input.search);
  if (input.sku) query.set("sku", input.sku);
  if (input.barcode) query.set("barcode", input.barcode);
  if (input.categoryId) query.set("categoryId", input.categoryId);
  if (input.active !== undefined) query.set("active", String(input.active));
  return apiRequest<Product[]>(`/v1/products?${query}`);
};
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
  apiRequest<Product>(`/v1/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
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
  apiRequest<Product>("/v1/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
