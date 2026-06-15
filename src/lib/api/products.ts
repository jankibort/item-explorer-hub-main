import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { z } from "zod";

const BASE_URL = "https://dummyjson.com";

export const PAGE_SIZE = 12;

export const SORT_OPTIONS = [
  "title-asc",
  "title-desc",
  "price-asc",
  "price-desc",
  "rating-desc",
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number];

const sortFieldMap: Record<SortKey, { sortBy: string; order: "asc" | "desc" }> = {
  "title-asc": { sortBy: "title", order: "asc" },
  "title-desc": { sortBy: "title", order: "desc" },
  "price-asc": { sortBy: "price", order: "asc" },
  "price-desc": { sortBy: "price", order: "desc" },
  "rating-desc": { sortBy: "rating", order: "desc" },
};

const productSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  price: z.number(),
  discountPercentage: z.number().optional(),
  rating: z.number(),
  stock: z.number(),
  brand: z.string().optional(),
  thumbnail: z.string().url(),
  images: z.array(z.string().url()).default([]),
});

const paginatedProductsSchema = z.object({
  products: z.array(productSchema),
  total: z.number(),
  skip: z.number(),
  limit: z.number(),
});

const categorySchema = z.object({
  slug: z.string(),
  name: z.string(),
});

const categoriesSchema = z.array(categorySchema);

export type Product = z.infer<typeof productSchema>;
export type PaginatedProducts = z.infer<typeof paginatedProductsSchema>;
export type Category = z.infer<typeof categorySchema>;

export interface ProductFilters {
  page: number;
  q: string;
  category: string;
  sort: SortKey;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function http<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { signal, headers: { accept: "application/json" } });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }
    throw new ApiError("Network error: unable to reach the API.", 0, error);
  }

  if (!res.ok) {
    const message =
      res.status >= 500
        ? "The API is temporarily unavailable. Please try again."
        : res.status === 429
          ? "Too many requests. Please slow down and retry."
          : res.status === 404
            ? "Resource not found."
            : `Request failed (${res.status} ${res.statusText}).`;
    throw new ApiError(message, res.status);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (error) {
    throw new ApiError("Invalid JSON response from the API.", res.status, error);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError("Unexpected response shape from the API.", res.status, parsed.error);
  }
  return parsed.data;
}

const shouldRetry = (failureCount: number, error: unknown) => {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
};

function buildProductsPath({ page, q, category, sort }: ProductFilters): string {
  const { sortBy, order } = sortFieldMap[sort];
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    skip: String((page - 1) * PAGE_SIZE),
    sortBy,
    order,
  });

  const trimmedQ = q.trim();
  if (trimmedQ) {
    params.set("q", trimmedQ);
    return `/products/search?${params.toString()}`;
  }
  if (category) {
    return `/products/category/${encodeURIComponent(category)}?${params.toString()}`;
  }
  return `/products?${params.toString()}`;
}

export const productsQueryOptions = (filters: ProductFilters) =>
  queryOptions({
    queryKey: ["products", filters] as const,
    queryFn: ({ signal }) =>
      http(buildProductsPath(filters), paginatedProductsSchema, signal),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: shouldRetry,
  });

export const productQueryOptions = (id: number) =>
  queryOptions({
    queryKey: ["product", id] as const,
    queryFn: ({ signal }) => http(`/products/${id}`, productSchema, signal),
    staleTime: 60_000,
    retry: shouldRetry,
  });

export const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: ["product-categories"] as const,
    queryFn: ({ signal }) => http(`/products/categories`, categoriesSchema, signal),
    staleTime: 24 * 60 * 60 * 1000,
    retry: shouldRetry,
  });
