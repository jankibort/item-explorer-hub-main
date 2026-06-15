import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { ApiError, productQueryOptions } from "@/lib/api/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/products/$id")({
  parseParams: ({ id }) => {
    const n = Number(id);
    if (!Number.isInteger(n) || n < 1) throw notFound();
    return { id: n };
  },
  stringifyParams: ({ id }) => ({ id: String(id) }),
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(productQueryOptions(params.id));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound();
      throw error;
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `Product #${params.id} — Catalog` },
      { name: "description", content: `Details for product #${params.id}.` },
    ],
  }),
  component: ProductDetail,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Failed to load product: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Product not found.</div>,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const { data: product } = useSuspenseQuery(productQueryOptions(id));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
          </Link>
        </Button>

        <Card className="overflow-hidden">
          <div className="grid gap-6 md:grid-cols-[320px_1fr]">
            <img
              src={product.thumbnail}
              alt={product.title}
              className="w-full bg-muted object-cover"
            />
            <CardContent className="p-6">
              <h1 className="text-3xl font-bold">{product.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="capitalize">{product.category}</Badge>
                {product.brand && <Badge variant="outline">{product.brand}</Badge>}
                <Badge variant="outline">★ {product.rating.toFixed(1)}</Badge>
              </div>

              <p className="mt-6 text-sm text-muted-foreground">{product.description}</p>

              <dl className="mt-6 grid gap-3 text-sm">
                <Row label="Price" value={`$${product.price.toFixed(2)}`} />
                <Row label="Stock" value={String(product.stock)} />
                {typeof product.discountPercentage === "number" && (
                  <Row label="Discount" value={`${product.discountPercentage.toFixed(1)}%`} />
                )}
              </dl>
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
