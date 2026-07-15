"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type ActiveProduct = {
  id: string;
  title: string;
};

type AgentRouteContext =
  | { mode: "workspace" }
  | { mode: "product"; productId: string; productTitle?: string };

type AgentContextValue = {
  activeProduct: ActiveProduct | null;
  setActiveProduct: (product: ActiveProduct | null) => void;
  route: AgentRouteContext;
};

const AgentContext = createContext<AgentContextValue | null>(null);

function productIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/products\/([^/]+)\/?$/);
  return match?.[1] ?? null;
}

export function AgentContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activeProduct, setActiveProduct] = useState<ActiveProduct | null>(null);
  const pathProductId = productIdFromPathname(pathname);

  const route = useMemo<AgentRouteContext>(() => {
    if (pathProductId) {
      return {
        mode: "product",
        productId: pathProductId,
        productTitle:
          activeProduct?.id === pathProductId ? activeProduct.title : undefined,
      };
    }
    return { mode: "workspace" };
  }, [pathProductId, activeProduct]);

  const value = useMemo(
    () => ({
      activeProduct,
      setActiveProduct,
      route,
    }),
    [activeProduct, route],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgentContext() {
  const ctx = useContext(AgentContext);
  if (!ctx) {
    throw new Error("useAgentContext must be used within AgentContextProvider");
  }
  return ctx;
}

/** Syncs the active product into agent context while mounted on a product page. */
export function AgentProductSync({
  productId,
  productTitle,
}: {
  productId: string;
  productTitle: string;
}) {
  const { setActiveProduct } = useAgentContext();

  useEffect(() => {
    setActiveProduct({ id: productId, title: productTitle });
    return () => setActiveProduct(null);
  }, [productId, productTitle, setActiveProduct]);

  return null;
}
