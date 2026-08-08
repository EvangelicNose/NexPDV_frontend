import { apiRequest } from "../../lib/api";
import type { Category, OptionGroup, Product } from "./catalog.types";
export const listProducts = (
  input: { search?: string; categoryId?: string; active?: boolean } = {},
) => {
  const query = new URLSearchParams({ limit: "100" });
  if (input.search) query.set("search", input.search);
  if (input.categoryId) query.set("categoryId", input.categoryId);
  if (input.active !== undefined) query.set("active", String(input.active));
  return apiRequest<Product[]>(`/v1/products?${query}`);
};
export const getProduct = (id: string) =>
  apiRequest<Product>(`/v1/products/${id}`);
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
