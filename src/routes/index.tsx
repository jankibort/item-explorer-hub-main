import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Suspense, useEffect, useState } from "react";
import {
  productsQueryOptions,
  categoriesQueryOptions,
  PAGE_SIZE,
  SORT_OPTIONS,
  type Product,
  type SortKey,
} from "@/lib/api/products";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ALL = "all";
const DEBOUNCE_MS = 400;

const searchSchema = z.object({
  page: fallback(z.number().int().min(1), 1).default(1),
  q: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  sort: fallback(z.enum(SORT_OPTIONS), "title-asc").default("title-asc"),
});

type ProductSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Products — Catalog" },
      { name: "description", content: "Browse, search, and filter products from our catalog." },
    ],
  }),
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    context.queryClient.prefetchQuery(
      productsQueryOptions({
        page: deps.page,
        q: deps.q,
        category: deps.category,
        sort: deps.sort,
      }),
    );
    context.queryClient.prefetchQuery(categoriesQueryOptions());
  },
  component: ProductsPage,
  errorComponent: ({ error, reset }) => (
    <div className="container mx-auto p-8">
      <p className="text-destructive">Failed to load: {error.message}</p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">No products found.</div>,
});

function ProductsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [qInput, setQInput] = useState(search.q);
  const debouncedQ = useDebouncedValue(qInput, DEBOUNCE_MS);

  useEffect(() => {
    if (debouncedQ === search.q) return;
    navigate({
      search: (prev: ProductSearch) => ({ ...prev, q: debouncedQ, page: 1 }),
    });
  }, [debouncedQ, search.q, navigate]);

  const { data: categories } = useQuery(categoriesQueryOptions());

  const setCategory = (value: string) =>
    navigate({
      search: (prev: ProductSearch) => ({
        ...prev,
        category: value === ALL ? "" : value,
        page: 1,
      }),
    });

  const setSort = (value: string) =>
    navigate({
      search: (prev: ProductSearch) => ({ ...prev, sort: value as SortKey, page: 1 }),
    });

  const resetFilters = () => {
    setQInput("");
    navigate({ search: () => ({ page: 1, q: "", category: "", sort: "title-asc" }) });
  };

  const searchActive = qInput.trim().length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight">Product Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search, filter, and sort — all powered server-side.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Search products…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            aria-label="Search products"
          />
          <Select
            value={search.category || ALL}
            onValueChange={setCategory}
            disabled={searchActive}
          >
            <SelectTrigger aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={search.sort} onValueChange={setSort}>
            <SelectTrigger aria-label="Sort results">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title-asc">Title A–Z</SelectItem>
              <SelectItem value="title-desc">Title Z–A</SelectItem>
              <SelectItem value="price-asc">Price ↑</SelectItem>
              <SelectItem value="price-desc">Price ↓</SelectItem>
              <SelectItem value="rating-desc">Top rated</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>

        {searchActive && (
          <p className="mb-4 text-xs text-muted-foreground">
            Category filter is disabled while searching.
          </p>
        )}

        <Suspense fallback={<ResultsSkeleton />}>
          <Results />
        </Suspense>
      </main>
    </div>
  );
}

function Results() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isFetching } = useSuspenseQuery(
    productsQueryOptions({
      page: search.page,
      q: search.q,
      category: search.category,
      sort: search.sort,
    }),
  );

  if (isFetching) return <ResultsSkeleton />;

  if (data.products.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
        No products match your filters.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const goToPage = (delta: number) =>
    navigate({
      search: (prev: ProductSearch) => ({
        ...prev,
        page: Math.min(totalPages, Math.max(1, prev.page + delta)),
      }),
    });

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {data.total} results · page {search.page} of {totalPages}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.products.map((p) => (
          <li key={p.id}>
            <Link
              to="/products/$id"
              params={{ id: p.id }}
              className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ProductCard product={p} />
            </Link>
          </li>
        ))}
      </ul>

      <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
        <Button variant="outline" disabled={search.page <= 1} onClick={() => goToPage(-1)}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          {search.page} / {totalPages}
        </span>
        <Button
          variant="outline"
          disabled={search.page >= totalPages}
          onClick={() => goToPage(1)}
        >
          Next
        </Button>
      </nav>
    </>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="h-full overflow-hidden transition hover:shadow-md">
      <img
        src={product.thumbnail}
        alt={product.title}
        loading="lazy"
        className="aspect-square w-full bg-muted object-cover"
      />
      <CardContent className="p-4">
        <h2 className="truncate font-semibold">{product.title}</h2>
        <p className="truncate text-sm text-muted-foreground capitalize">{product.category}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">${product.price.toFixed(2)}</span>
          <Badge variant="outline">★ {product.rating.toFixed(1)}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <li key={i}>
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="mt-2 h-5 w-2/3" />
          <Skeleton className="mt-1 h-4 w-1/2" />
        </li>
      ))}
    </ul>
  );
}
