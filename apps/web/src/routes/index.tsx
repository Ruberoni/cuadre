import { createFileRoute, redirect } from "@tanstack/react-router";
import { defaultProductsSearch } from "@/features/products/search";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/productos", search: defaultProductsSearch, replace: true });
  },
});
