"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartLine = {
  variantId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
  image?: string;
};

type CartValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  ready: boolean;
};

const CartContext = createContext<CartValue | null>(null);
const STORAGE_KEY = "cardamom.cart.v1";

/**
 * localStorage is attacker- and accident-controlled: it can hold any JSON, or
 * a stale shape from an older build. Anything that is not a well-formed line is
 * dropped, because CartProvider wraps the whole site and a bad value here would
 * take every page down until the visitor cleared their browser storage.
 */
function parseStoredLines(raw: string | null): CartLine[] {
  if (!raw) return [];

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  return data.flatMap((entry): CartLine[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const l = entry as Record<string, unknown>;

    const quantity = Number(l.quantity);
    const unitPrice = Number(l.unitPrice);

    if (
      typeof l.variantId !== "string" ||
      typeof l.productName !== "string" ||
      typeof l.productSlug !== "string" ||
      typeof l.variantLabel !== "string" ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0 ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return [];
    }

    return [
      {
        variantId: l.variantId,
        productName: l.productName,
        productSlug: l.productSlug,
        variantLabel: l.variantLabel,
        unitPrice,
        quantity: Math.min(Math.floor(quantity), 99),
        image: typeof l.image === "string" ? l.image : undefined,
      },
    ];
  });
}

/**
 * Cart lives in localStorage — the shop has no customer accounts, so there is
 * nothing to tie a server-side cart to. Prices are re-checked against the
 * database at checkout, so a tampered cart cannot change what is charged.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  // localStorage does not exist during server rendering, so the cart can only
  // be hydrated after mount. That means one unavoidable extra render, which is
  // what the set-state-in-effect rule is warning about; it runs once, guarded
  // by an empty dependency list, and `ready` keeps the UI from flashing an
  // empty cart in the meantime.
  useEffect(() => {
    let stored: CartLine[] = [];
    try {
      stored = parseStoredLines(localStorage.getItem(STORAGE_KEY));
    } catch {
      // storage blocked (private mode / disabled cookies) — carry on empty
    }
    /* eslint-disable react-hooks/set-state-in-effect */
    if (stored.length) setLines(stored);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // quota exceeded or storage blocked — the cart still works this session
    }
  }, [lines, ready]);

  const value = useMemo<CartValue>(() => {
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);

    return {
      lines,
      count,
      subtotal,
      ready,
      add(line, quantity = 1) {
        setLines((prev) => {
          const found = prev.find((l) => l.variantId === line.variantId);
          if (found) {
            return prev.map((l) =>
              l.variantId === line.variantId
                ? { ...l, quantity: l.quantity + quantity }
                : l,
            );
          }
          return [...prev, { ...line, quantity }];
        });
      },
      setQuantity(variantId, quantity) {
        setLines((prev) =>
          quantity <= 0
            ? prev.filter((l) => l.variantId !== variantId)
            : prev.map((l) =>
                l.variantId === variantId ? { ...l, quantity } : l,
              ),
        );
      },
      remove(variantId) {
        setLines((prev) => prev.filter((l) => l.variantId !== variantId));
      },
      clear() {
        setLines([]);
      },
    };
  }, [lines, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
