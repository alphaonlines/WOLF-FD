import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator, PlayCircle, Plus, RefreshCw, Search, ShoppingCart, Trash2, X } from "lucide-react";
import type { ManufacturerCatalogItem, ManufacturerReferenceNote } from "../types";
import { CANONICAL_PRODUCT_MANUFACTURERS, calcSuggestedRetail, calcFloorRetail } from "../constants/productCatalog";
import { fetchManufacturerCatalog, fetchManufacturerReferenceNotes } from "../services/manufacturerPricelistApi";
import ProductPriceMatchPanel from "./ProductPriceMatchPanel";

type ProductSearchWorkspaceProps = {
  isDarkMode: boolean;
  onOpenSmartCalc?: () => void;
};

type ProductSort = "relevance" | "manufacturer" | "category" | "item" | "price_low" | "price_high";
type ItemDialogMode = "details" | "price-match";

type CartItem = { item: ManufacturerCatalogItem; qty: number };
type Cart = { id: string; name: string; items: CartItem[] };

let nextCartId = 2;

const formatCurrency = (value: number | null) =>
  value === null || Number.isNaN(value) ? "—" : value.toLocaleString(undefined, { style: "currency", currency: "USD" });

const formatDimensions = (item: ManufacturerCatalogItem) => {
  if (item.dimensionsText) return item.dimensionsText;
  const parts = [
    item.widthInches ? `W ${item.widthInches}"` : "",
    item.depthInches ? `D ${item.depthInches}"` : "",
    item.heightInches ? `H ${item.heightInches}"` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
};

const buildExternalItemSearchUrl = (sku: string) => {
  const s = String(sku || "").trim();
  if (!s) return "";
  return `https://www.furnituredistributors.net/Product/SiteSearch?search=${encodeURIComponent(s)}`;
};

const formatInventoryTimestamp = (value?: string | null) => {
  if (!value) return "Inventory timestamp pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Inventory timestamp pending";
  return `Updated ${parsed.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`;
};

const getPrimaryImageUrl = (item: ManufacturerCatalogItem) =>
  item.ezproItemImageUrl || item.imageUrls.find((url) => url.trim()) || "";

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const ProductSearchWorkspace: React.FC<ProductSearchWorkspaceProps> = ({ isDarkMode, onOpenSmartCalc }) => {
  const CATALOG_FETCH_LIMIT = 1000;
  const CATALOG_FETCH_INCREMENT = 1000;
  const CATALOG_MAX_LIMIT = 5000;

  // Search filters
  const [query, setQuery] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [productType, setProductType] = useState("");
  const [featureTag, setFeatureTag] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<ProductSort>("relevance");

  // Catalog state
  const [items, setItems] = useState<ManufacturerCatalogItem[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [catalogLimit, setCatalogLimit] = useState(CATALOG_FETCH_LIMIT);
  const [notes, setNotes] = useState<ManufacturerReferenceNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<ItemDialogMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dialogCloseRef = useRef<HTMLButtonElement | null>(null);
  const backgroundRef = useRef<HTMLDivElement | null>(null);
  const dialogOpenerRef = useRef<HTMLElement | null>(null);

  // UI toggles
  const [showCosts, setShowCosts] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // Cart state
  const [carts, setCarts] = useState<Cart[]>([{ id: "1", name: "Cart 1", items: [] }]);
  const [activeCartId, setActiveCartId] = useState("1");
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [editingCartName, setEditingCartName] = useState("");

  // Style helpers
  const panelClassName = isDarkMode
    ? "rounded-3xl border border-slate-800 bg-slate-950 shadow-[0_14px_30px_rgba(2,6,23,0.16)]"
    : "rounded-3xl border border-slate-200/80 bg-slate-50/90 shadow-sm";
  const inputClassName = isDarkMode
    ? "w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
    : "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-200/70";
  const subtleTextClassName = isDarkMode ? "text-slate-400" : "text-slate-600";
  const badgeClassName = isDarkMode
    ? "rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200"
    : "rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800";
  // Cart helpers
  const activeCart = carts.find((c) => c.id === activeCartId) ?? carts[0];
  const totalCartItems = carts.reduce((sum, c) => sum + c.items.reduce((s, i) => s + i.qty, 0), 0);
  const isInActiveCart = (itemId: string) => activeCart?.items.some((ci) => ci.item.id === itemId) ?? false;

  const addToCart = (item: ManufacturerCatalogItem) => {
    setCarts((prev) =>
      prev.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        const existing = cart.items.find((ci) => ci.item.id === item.id);
        if (existing) {
          return { ...cart, items: cart.items.map((ci) => ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci) };
        }
        return { ...cart, items: [...cart.items, { item, qty: 1 }] };
      })
    );
  };

  const removeFromCart = (cartId: string, itemId: string) => {
    setCarts((prev) =>
      prev.map((cart) => cart.id !== cartId ? cart : { ...cart, items: cart.items.filter((ci) => ci.item.id !== itemId) })
    );
  };

  const updateQty = (cartId: string, itemId: string, qty: number) => {
    if (qty < 1) { removeFromCart(cartId, itemId); return; }
    setCarts((prev) =>
      prev.map((cart) => cart.id !== cartId ? cart : { ...cart, items: cart.items.map((ci) => ci.item.id === itemId ? { ...ci, qty } : ci) })
    );
  };

  const addCart = () => {
    const id = String(nextCartId++);
    setCarts((prev) => [...prev, { id, name: `Cart ${id}`, items: [] }]);
    setActiveCartId(id);
  };

  const deleteCart = (cartId: string) => {
    setCarts((prev) => {
      const next = prev.filter((c) => c.id !== cartId);
      if (next.length === 0) { const id = String(nextCartId++); return [{ id, name: "Cart 1", items: [] }]; }
      return next;
    });
    if (activeCartId === cartId) {
      const remaining = carts.filter((c) => c.id !== cartId);
      setActiveCartId(remaining[0]?.id ?? "1");
    }
  };

  const cartTotals = (cart: Cart) => {
    let totalCost = 0, totalRetail = 0, totalFloor = 0;
    let hasCost = false, hasRetail = false, hasFloor = false;
    for (const { item, qty } of cart.items) {
      if (item.basePrice !== null) { totalCost += item.basePrice * qty; hasCost = true; }
      const retail = calcSuggestedRetail(item.basePrice, item.manufacturerSlug);
      if (retail !== null) { totalRetail += retail * qty; hasRetail = true; }
      const floor = calcFloorRetail(item.basePrice, item.manufacturerSlug);
      if (floor !== null) { totalFloor += floor * qty; hasFloor = true; }
    }
    return { totalCost: hasCost ? totalCost : null, totalRetail: hasRetail ? totalRetail : null, totalFloor: hasFloor ? totalFloor : null };
  };

  const openSmartCalcWithCart = () => {
    const { totalRetail, totalCost, totalFloor } = cartTotals(activeCart);
    if (typeof window !== "undefined") {
      if (activeCart.items.length && totalRetail !== null) {
        const transfer = {
          source: "product-search-cart",
          createdAt: new Date().toISOString(),
          cartId: activeCart.id,
          cartName: activeCart.name,
          merchandiseTotal: roundMoney(totalRetail),
          floorTotal: totalFloor === null ? null : roundMoney(totalFloor),
          costTotal: totalCost === null ? null : roundMoney(totalCost),
          itemCount: activeCart.items.reduce((sum, cartItem) => sum + cartItem.qty, 0),
          items: activeCart.items.map(({ item, qty }) => {
            const retail = calcSuggestedRetail(item.basePrice, item.manufacturerSlug);
            const floor = calcFloorRetail(item.basePrice, item.manufacturerSlug);
            return {
              id: item.id,
              sku: item.sku || "",
              manufacturer: item.manufacturer || "",
              description: item.description || item.collectionName || item.sku || "Item",
              qty,
              retailPrice: retail === null ? null : roundMoney(retail),
              retailTotal: retail === null ? null : roundMoney(retail * qty),
              floorPrice: floor === null ? null : roundMoney(floor),
              cost: item.basePrice === null ? null : roundMoney(item.basePrice),
              imageUrl: getPrimaryImageUrl(item),
            };
          }),
        };
        window.localStorage.setItem("fd-smartcalc-cart-transfer", JSON.stringify(transfer));
      } else {
        window.localStorage.removeItem("fd-smartcalc-cart-transfer");
      }
    }
    onOpenSmartCalc?.();
  };

  // Data loading
  const loadCatalog = async (nextLimit = catalogLimit, mode: "replace" | "more" = "replace") => {
    if (mode === "more") {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [catalogResult, noteRows] = await Promise.all([
        fetchManufacturerCatalog({ manufacturer: manufacturer || undefined, category: category || undefined, color: color || undefined, query: query || undefined, limit: nextLimit, inStockOnly }),
        manufacturer ? fetchManufacturerReferenceNotes(manufacturer) : Promise.resolve([]),
      ]);
      const catalogRows = catalogResult.rows;
      setItems(catalogRows);
      setCatalogTotal(catalogResult.total);
      setCatalogHasMore(catalogResult.hasMore);
      setCatalogLimit(catalogResult.limit || nextLimit);
      setNotes(noteRows);
      if (selectedId && !catalogRows.some((item) => item.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (err: any) {
      setError(String(err?.message ?? err ?? "Unable to load product catalog"));
      if (mode !== "more") {
        setItems([]); setCatalogTotal(0); setCatalogHasMore(false); setNotes([]); setSelectedId(null);
      }
    } finally {
      if (mode === "more") {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const cappedCatalogTotal = Math.min(catalogTotal || CATALOG_MAX_LIMIT, CATALOG_MAX_LIMIT);
  const canLoadMore = catalogHasMore && catalogLimit < cappedCatalogTotal;
  const nextBatchSize = Math.min(CATALOG_FETCH_INCREMENT, Math.max(cappedCatalogTotal - catalogLimit, 0));

  const openItemDialog = (itemId: string, mode: ItemDialogMode) => {
    dialogOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(itemId);
    setDialogMode(mode);
  };

  const closeItemDialog = () => {
    const opener = dialogOpenerRef.current;
    setDialogMode(null);
    setSelectedId(null);
    window.setTimeout(() => opener?.focus(), 0);
  };

  useEffect(() => {
    if (!selectedItem || !dialogMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    backgroundRef.current?.setAttribute("inert", "");
    backgroundRef.current?.setAttribute("aria-hidden", "true");
    window.setTimeout(() => dialogCloseRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeItemDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      backgroundRef.current?.removeAttribute("inert");
      backgroundRef.current?.removeAttribute("aria-hidden");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedItem, dialogMode]);

  const handleLoadMore = () => {
    if (!canLoadMore || loading || loadingMore) return;
    const nextLimit = Math.min(catalogLimit + CATALOG_FETCH_INCREMENT, cappedCatalogTotal);
    void loadCatalog(nextLimit, "more");
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadCatalog(CATALOG_FETCH_LIMIT, "replace");
    }, 220);
    return () => window.clearTimeout(t);
  }, [query, manufacturer, category, color, inStockOnly]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !canLoadMore || loading || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          handleLoadMore();
        }
      },
      { rootMargin: "700px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoadMore, loading, loadingMore, catalogLimit, catalogTotal, query, manufacturer, category, color]);

  useEffect(() => {
    const targetMfr = selectedItem?.manufacturer ?? manufacturer;
    if (targetMfr) {
      fetchManufacturerReferenceNotes(targetMfr).then(setNotes).catch(() => {});
    }
  }, [selectedId, selectedItem?.manufacturer, manufacturer]);

  // Notes matching
  const relevantNotes = selectedItem
    ? notes.filter((note) => {
        const title = note.title.toLowerCase();
        const tags = selectedItem.featureTags.map((t) => t.toLowerCase());
        const match = (patterns: string[]) => patterns.some((p) => tags.some((t) => t.includes(p)));
        if (title.includes("steel") && match(["steel", "reclin"])) return true;
        if (title.includes("power") && match(["power"])) return true;
        if (title.includes("lay flat") && match(["lay-flat"])) return true;
        if (title.includes("zero gravity") && match(["zero-gravity"])) return true;
        if (title.includes("neversfear") && match(["neversfear"])) return true;
        if (title.includes("livesmart") && match(["livesmart"])) return true;
        if ((title.includes("nanobionic") || title.includes("ionic")) && match(["ionic", "nanobionic"])) return true;
        if (title.includes("massage") && match(["massage"])) return true;
        if (title.includes("heat") && match(["heat"])) return true;
        if (title.includes("bluetooth") && match(["bluetooth"])) return true;
        if (title.includes("usb") && match(["usb"])) return true;
        return false;
      })
    : [];

  const productVideos = relevantNotes.filter((n) => n.videoUrl);

  // Derived options
  const manufacturerOptions = useMemo(
    () => Array.from(new Set([...CANONICAL_PRODUCT_MANUFACTURERS, ...items.map((i) => i.manufacturer).filter(Boolean)])).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const colorOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.colorFamily || i.colorFinish).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const productTypeOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.productType).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const featureTagOptions = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.featureTags).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const sortedItems = useMemo(() => {
    const alpha = (v: string | undefined) => (v ?? "").trim().toLowerCase();
    const minR = priceMin !== "" ? parseFloat(priceMin) : null;
    const maxR = priceMax !== "" ? parseFloat(priceMax) : null;
    let filtered = items;
    if (productType) filtered = filtered.filter((i) => i.productType === productType);
    if (featureTag) filtered = filtered.filter((i) => i.featureTags.includes(featureTag));
    if (minR !== null || maxR !== null) {
      filtered = filtered.filter((i) => {
        const r = calcSuggestedRetail(i.basePrice, i.manufacturerSlug) ?? i.basePrice;
        if (r === null) return false;
        if (minR !== null && r < minR) return false;
        if (maxR !== null && r > maxR) return false;
        return true;
      });
    }
    return [...filtered].sort((a, b) => {
      if (sortBy === "relevance") return 0;
      if (sortBy === "manufacturer") return alpha(a.manufacturer).localeCompare(alpha(b.manufacturer)) || alpha(a.description || a.collectionName || a.sku).localeCompare(alpha(b.description || b.collectionName || b.sku));
      if (sortBy === "category") return alpha(a.category).localeCompare(alpha(b.category)) || alpha(a.description || a.collectionName || a.sku).localeCompare(alpha(b.description || b.collectionName || b.sku));
      if (sortBy === "item") return alpha(a.sku).localeCompare(alpha(b.sku));
      if (sortBy === "price_low" || sortBy === "price_high") {
        if (a.basePrice === null && b.basePrice === null) return 0;
        if (a.basePrice === null) return 1;
        if (b.basePrice === null) return -1;
        return sortBy === "price_low" ? a.basePrice - b.basePrice : b.basePrice - a.basePrice;
      }
      return 0;
    });
  }, [items, sortBy, productType, featureTag, priceMin, priceMax]);

  const renderSelectedItemDetails = (detailItem: ManufacturerCatalogItem) => {
    const itemSearchUrl = buildExternalItemSearchUrl(detailItem.sku);
    const selectedRetail = calcSuggestedRetail(detailItem.basePrice, detailItem.manufacturerSlug);
    const selectedFloor = calcFloorRetail(detailItem.basePrice, detailItem.manufacturerSlug);
    const selectedCartQty = activeCart.items.find((ci) => ci.item.id === detailItem.id)?.qty ?? 0;
    const selectedImageUrl = getPrimaryImageUrl(detailItem);
    const selectedInventoryQty = detailItem.inventoryQtyAvailable ?? detailItem.inventoryQtyInStockDam ?? null;
    const selectedInventoryLocations = detailItem.inventoryLocations ?? [];
    const selectedInventoryVariants = detailItem.inventoryVariants ?? [];

    return (
      <div className={`mt-3 overflow-hidden rounded-2xl border ${isDarkMode ? "border-sky-400/30 bg-slate-950/95" : "border-sky-200 bg-white"}`}>
        <div className={`border-b px-5 py-4 ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-500">Item detail</div>
              <h3 className={`mt-1 text-lg font-bold leading-tight ${isDarkMode ? "text-white" : "text-slate-950"}`}>
                {detailItem.description || detailItem.collectionName || detailItem.sku}
              </h3>
              <div className={`mt-1 text-xs ${subtleTextClassName}`}>
                {detailItem.manufacturer} | SKU {detailItem.sku || "-"}
              </div>
            </div>
            {itemSearchUrl && (
              <a
                href={itemSearchUrl}
                target="_blank"
                rel="noreferrer"
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${isDarkMode ? "border border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/18" : "border border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200"}`}
              >
                Item Search
              </a>
            )}
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className={`flex min-h-[128px] items-center justify-center overflow-hidden rounded-2xl border ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
            {selectedImageUrl ? (
              <img src={selectedImageUrl} alt={detailItem.description || detailItem.sku || "Product"} className="max-h-44 w-full object-contain" />
            ) : (
              <div className={`px-4 text-center text-sm ${subtleTextClassName}`}>Product image will show here when image links are connected.</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-emerald-800 bg-emerald-950" : "border-emerald-200 bg-emerald-50"}`}>
              <div className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>Retail</div>
              <div className={`mt-1 text-lg font-bold ${isDarkMode ? "text-emerald-200" : "text-emerald-900"}`}>{formatCurrency(selectedRetail)}</div>
            </div>
            <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-orange-800 bg-orange-950" : "border-orange-200 bg-orange-50"}`}>
              <div className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-orange-400" : "text-orange-700"}`}>Floor</div>
              <div className={`mt-1 text-lg font-bold ${isDarkMode ? "text-orange-200" : "text-orange-900"}`}>{formatCurrency(selectedFloor)}</div>
            </div>
            {showCosts && detailItem.basePrice !== null && (
              <div className={`col-span-2 rounded-2xl border px-4 py-3 ${isDarkMode ? "border-sky-800 bg-sky-950" : "border-sky-200 bg-sky-50"}`}>
                <div className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-sky-400" : "text-sky-700"}`}>Cost</div>
                <div className={`mt-1 text-base font-bold ${isDarkMode ? "text-sky-200" : "text-sky-900"}`}>{formatCurrency(detailItem.basePrice)}</div>
              </div>
            )}
          </div>

          <div className={`rounded-2xl border p-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Add to cart</div>
                <div className={`mt-1 text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{activeCart.name}</div>
              </div>
              {selectedCartQty > 0 ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateQty(activeCart.id, detailItem.id, selectedCartQty - 1)}
                    className={`h-9 w-9 rounded-full text-lg font-bold transition ${isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>-</button>
                  <span className={`w-8 text-center text-base font-bold ${isDarkMode ? "text-amber-300" : "text-amber-700"}`}>{selectedCartQty}</span>
                  <button type="button" onClick={() => addToCart(detailItem)}
                    className={`h-9 w-9 rounded-full text-lg font-bold transition ${isDarkMode ? "bg-amber-400/15 text-amber-200 hover:bg-amber-400/25" : "bg-amber-100 text-amber-800 hover:bg-amber-200"}`}>+</button>
                </div>
              ) : (
                <button type="button" onClick={() => addToCart(detailItem)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${isDarkMode ? "bg-amber-400/15 text-amber-200 hover:bg-amber-400/25" : "bg-amber-100 text-amber-900 hover:bg-amber-200"}`}>
                  <ShoppingCart size={15} />
                  Add
                </button>
              )}
            </div>
          </div>

          <div className={`rounded-2xl border p-4 ${isDarkMode ? "border-violet-800 bg-violet-950/45" : "border-violet-200 bg-violet-50"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-wide ${isDarkMode ? "text-violet-300" : "text-violet-700"}`}>Live inventory</div>
                <div className={`mt-1 text-xs ${subtleTextClassName}`}>{formatInventoryTimestamp(detailItem.inventoryUpdatedAt)}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${detailItem.hasInventory ? (isDarkMode ? "bg-emerald-400/15 text-emerald-200" : "bg-emerald-100 text-emerald-800") : (isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600")}`}>
                {detailItem.hasInventory ? `In stock: ${selectedInventoryQty ?? 0}` : "No EZPro match"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold">
              <div className={`rounded-xl px-3 py-2 ${isDarkMode ? "bg-slate-900 text-slate-300" : "bg-white text-slate-700"}`}>Reserved: {detailItem.inventoryQtyReserved ?? 0}</div>
              <div className={`rounded-xl px-3 py-2 ${isDarkMode ? "bg-slate-900 text-slate-300" : "bg-white text-slate-700"}`}>On order: {detailItem.inventoryQtyOnorder ?? 0}</div>
            </div>
            {selectedInventoryLocations.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedInventoryLocations.slice(0, 10).map((loc) => (
                  <span key={`${loc.locationName}-${loc.qty}`} className={badgeClassName}>{loc.locationName}: {loc.qty}</span>
                ))}
              </div>
            )}
            {selectedInventoryVariants.length > 0 && (
              <div className={`mt-3 max-h-36 overflow-auto rounded-xl border text-xs ${isDarkMode ? "border-slate-800 bg-slate-950 text-slate-300" : "border-slate-200 bg-white text-slate-700"}`}>
                {selectedInventoryVariants.slice(0, 12).map((variant, idx) => (
                  <div key={`${variant.itemNumber}-${idx}`} className={`px-3 py-2 ${idx ? (isDarkMode ? "border-t border-slate-800" : "border-t border-slate-100") : ""}`}>
                    <span className="font-semibold">{variant.qtyAvailable} avail</span> · {[variant.finish, variant.fabric, variant.pillow1Set, variant.pillow2Set].filter(Boolean).join(" · ") || "base variant"}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
            <div className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Description</div>
            <div className={`mt-2 text-sm leading-6 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
              {[detailItem.collectionName, detailItem.category, detailItem.productType].filter(Boolean).join(" | ") || "No description category available."}
            </div>
            <div className={`mt-2 text-sm leading-6 ${subtleTextClassName}`}>
              {formatDimensions(detailItem)} | {detailItem.colorFinish || detailItem.colorFamily || "-"} | {[detailItem.material, detailItem.shape].filter(Boolean).join(" | ") || "-"}
            </div>
          </div>

          {[...detailItem.featureTags, ...detailItem.searchKeywords].length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...detailItem.featureTags, ...detailItem.searchKeywords].slice(0, 10).map((tag) => (
                <span key={tag} className={badgeClassName}>{tag}</span>
              ))}
            </div>
          )}

          {productVideos.length > 0 && (
            <div className={`rounded-2xl border p-4 ${isDarkMode ? "border-amber-700/50 bg-amber-950/30" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-center gap-2 text-sm font-bold text-amber-500"><PlayCircle size={17} /> Product videos</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {productVideos.map((note) => (
                  <a key={note.id} href={note.videoUrl} target="_blank" rel="noreferrer"
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${isDarkMode ? "bg-amber-400/10 text-amber-200" : "bg-white text-amber-900"}`}>
                    {note.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          {relevantNotes.length > 0 && (
            <div className={`rounded-2xl border p-4 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
              <div className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Feature notes</div>
              <div className="mt-3 space-y-3">
                {relevantNotes.map((note) => (
                  <div key={note.id}>
                    <div className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{note.title}</div>
                    <div className={`mt-1 text-sm leading-6 ${subtleTextClassName}`}>{note.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div ref={backgroundRef} className="space-y-5">
        {/* Header & filters */}
        <section className={`${panelClassName} p-4 md:p-5`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">Shop search</div>
              <h2 className={`mt-1 text-xl font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                Item lookup
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowCosts((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  showCosts
                    ? isDarkMode ? "border border-emerald-400/40 bg-emerald-400/15 text-emerald-200" : "border border-emerald-400 bg-emerald-100 text-emerald-900"
                    : isDarkMode ? "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {showCosts ? "Hide Costs" : "Show Costs"}
              </button>
              <button
                type="button"
                onClick={() => setCartOpen((v) => !v)}
                className={`relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  cartOpen
                    ? isDarkMode ? "border border-amber-400/40 bg-amber-400/15 text-amber-200" : "border border-amber-400 bg-amber-100 text-amber-900"
                    : isDarkMode ? "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <ShoppingCart size={17} />
                <span className="sr-only">Cart</span>
                {totalCartItems > 0 && (
                  <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ${isDarkMode ? "bg-amber-400 text-slate-900" : "bg-amber-500 text-white"}`}>
                    {totalCartItems}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={openSmartCalcWithCart}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  isDarkMode ? "border border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/18" : "border border-sky-300 bg-sky-100 text-sky-950 hover:bg-sky-200"
                }`}
                title="Send this cart total to Smart Calc"
              >
                <Calculator size={16} />
                Smart Calc
              </button>
            </div>
          </div>

          {/* Filter row 1 */}
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(280px,2fr)_minmax(170px,1fr)_minmax(170px,1fr)_minmax(170px,1fr)]">
            <label className="space-y-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Search</span>
              <div className="relative">
                <Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`} size={16} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Description, item #, material, finish…' className={`${inputClassName} w-full pl-10`} />
              </div>
            </label>
            <label className="space-y-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Manufacturer</span>
              <select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={inputClassName}>
                <option value="">All manufacturers</option>
                {manufacturerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClassName}>
                <option value="">All categories</option>
                {categoryOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Color / Finish</span>
              <select value={color} onChange={(e) => setColor(e.target.value)} className={inputClassName}>
                <option value="">All colors</option>
                {colorOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold ${isDarkMode ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              In stock only
            </label>
          </div>

          {/* Filter row 2 */}
          <div className="mt-3 grid gap-3 lg:grid-cols-[repeat(4,minmax(150px,1fr))]">
            <label className="space-y-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Product Type</span>
              <select value={productType} onChange={(e) => setProductType(e.target.value)} className={inputClassName}>
                <option value="">All types</option>
                {productTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Feature / Tag</span>
              <select value={featureTag} onChange={(e) => setFeatureTag(e.target.value)} className={inputClassName}>
                <option value="">All features</option>
                {featureTagOptions.map((o) => <option key={o} value={o}>{o.replace(/-/g, " ")}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Retail Min</span>
              <input type="number" min="0" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="$ min" className={inputClassName} />
            </label>
            <label className="space-y-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Retail Max</span>
              <input type="number" min="0" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="$ max" className={inputClassName} />
            </label>
          </div>

          {(productType || featureTag || priceMin || priceMax) && (
            <div className="mt-3">
              <button type="button" onClick={() => { setProductType(""); setFeatureTag(""); setPriceMin(""); setPriceMax(""); setInStockOnly(false); }}
                className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${isDarkMode ? "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}>
                <X size={14} /> Clear extra filters
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={badgeClassName}>
              Showing {sortedItems.length.toLocaleString()} of {(catalogTotal || sortedItems.length).toLocaleString()} products
            </span>
            {canLoadMore && (
              <span className={badgeClassName}>
                Scroll or load more for the next {nextBatchSize.toLocaleString()}
              </span>
            )}
            {catalogHasMore && !canLoadMore && (
              <span className={badgeClassName}>Refine search to see past {CATALOG_MAX_LIMIT.toLocaleString()}</span>
            )}
            <span className={badgeClassName}>{new Set(sortedItems.map((i) => i.manufacturer).filter(Boolean)).size} manufacturers</span>
            <span className={badgeClassName}>{sortedItems.filter((i) => i.hasInventory).length.toLocaleString()} exact EZPro stock matches</span>
            <button type="button" onClick={() => void loadCatalog(catalogLimit, "replace")}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${isDarkMode ? "border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {error && (
            <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${isDarkMode ? "bg-rose-500/12 text-rose-100" : "bg-rose-100 text-rose-900"}`}>{error}</div>
          )}
        </section>

        <div className="min-w-0 space-y-5">
        {/* Cart panel */}
        {cartOpen && (
          <section className={`${panelClassName} p-4 md:p-5`}>
            <div className="flex items-center gap-2 flex-wrap">
              {carts.map((cart) => {
                const { totalRetail } = cartTotals(cart);
                const isActive = cart.id === activeCartId;
                return (
                  <div key={cart.id} className="flex items-center gap-1">
                    <button type="button" onClick={() => setActiveCartId(cart.id)}
                      className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition ${isActive ? (isDarkMode ? "border border-amber-400/40 bg-amber-400/15 text-amber-200" : "border border-amber-400 bg-amber-100 text-amber-900") : (isDarkMode ? "border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100")}`}>
                      {editingCartId === cart.id ? (
                        <input autoFocus value={editingCartName}
                          onChange={(e) => setEditingCartName(e.target.value)}
                          onBlur={() => { if (editingCartName.trim()) setCarts((prev) => prev.map((c) => c.id === cart.id ? { ...c, name: editingCartName.trim() } : c)); setEditingCartId(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingCartId(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className={`w-24 rounded px-1 text-sm outline-none ${isDarkMode ? "bg-slate-800 text-slate-100" : "bg-white text-slate-800"}`} />
                      ) : (
                        <span onDoubleClick={(e) => { e.stopPropagation(); setEditingCartId(cart.id); setEditingCartName(cart.name); }} title="Double-click to rename">
                          {cart.name}
                        </span>
                      )}
                      {cart.items.length > 0 && <span className={`text-xs font-bold ${isActive ? (isDarkMode ? "text-amber-300" : "text-amber-700") : (isDarkMode ? "text-slate-500" : "text-slate-400")}`}>{cart.items.reduce((s, i) => s + i.qty, 0)}</span>}
                      {totalRetail !== null && <span className={`text-xs ${isActive ? (isDarkMode ? "text-emerald-300" : "text-emerald-700") : (isDarkMode ? "text-slate-500" : "text-slate-400")}`}>{formatCurrency(totalRetail)}</span>}
                    </button>
                    {carts.length > 1 && (
                      <button type="button" onClick={() => deleteCart(cart.id)} className={`rounded-full p-1 transition ${isDarkMode ? "text-slate-600 hover:text-rose-400" : "text-slate-400 hover:text-rose-600"}`}><X size={12} /></button>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={addCart}
                className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold transition ${isDarkMode ? "border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"}`}>
                <Plus size={13} /> New Cart
              </button>
            </div>

            <div className="mt-4">
              {activeCart.items.length === 0 ? (
                <div className={`rounded-2xl px-4 py-6 text-center text-sm ${subtleTextClassName}`}>Cart is empty — click the cart icon on any product to add it.</div>
              ) : (
                <div className="space-y-2">
                  {activeCart.items.map(({ item, qty }) => {
                    const retail = calcSuggestedRetail(item.basePrice, item.manufacturerSlug);
                    const floor = calcFloorRetail(item.basePrice, item.manufacturerSlug);
                    return (
                      <div key={item.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold truncate ${isDarkMode ? "text-white" : "text-slate-900"}`}>{item.description || item.collectionName || item.sku}</div>
                          <div className={`text-xs ${subtleTextClassName}`}>{item.manufacturer} · SKU {item.sku || "—"}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => updateQty(activeCart.id, item.id, qty - 1)} className={`h-7 w-7 rounded-full text-lg font-bold transition ${isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>−</button>
                          <span className={`w-6 text-center text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{qty}</span>
                          <button type="button" onClick={() => updateQty(activeCart.id, item.id, qty + 1)} className={`h-7 w-7 rounded-full text-lg font-bold transition ${isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>+</button>
                        </div>
                        <div className="text-right min-w-[110px]">
                          {showCosts && item.basePrice !== null && <div className={`text-xs ${isDarkMode ? "text-sky-300" : "text-sky-700"}`}>Cost {formatCurrency(item.basePrice * qty)}</div>}
                          {retail !== null && <div className={`text-sm font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>{formatCurrency(retail * qty)}</div>}
                          {floor !== null && <div className={`text-xs font-semibold ${isDarkMode ? "text-orange-300" : "text-orange-700"}`}>Floor {formatCurrency(floor * qty)}</div>}
                        </div>
                        <button type="button" onClick={() => removeFromCart(activeCart.id, item.id)} className={`rounded-full p-1.5 transition ${isDarkMode ? "text-slate-600 hover:text-rose-400" : "text-slate-400 hover:text-rose-600"}`}><Trash2 size={14} /></button>
                      </div>
                    );
                  })}
                  {/* Totals */}
                  {(() => {
                    const { totalCost, totalRetail, totalFloor } = cartTotals(activeCart);
                    return (
                      <div className={`flex flex-wrap items-center justify-end gap-4 rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
                        <button type="button" onClick={openSmartCalcWithCart}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${isDarkMode ? "border border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/18" : "border border-sky-300 bg-sky-100 text-sky-950 hover:bg-sky-200"}`}
                          title="Send cart merchandise total to Smart Calc">
                          <Calculator size={14} /> Smart Calc
                        </button>
                        <span className={`text-sm font-semibold ${subtleTextClassName}`}>{activeCart.items.reduce((s, i) => s + i.qty, 0)} items</span>
                        {showCosts && totalCost !== null && (
                          <div className="text-right">
                            <div className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Total Cost</div>
                            <div className={`text-base font-semibold ${isDarkMode ? "text-sky-200" : "text-sky-900"}`}>{formatCurrency(totalCost)}</div>
                          </div>
                        )}
                        {totalRetail !== null && (
                          <div className="text-right">
                            <div className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-emerald-500" : "text-emerald-600"}`}>Total Retail <span className="opacity-60">(60%)</span></div>
                            <div className={`text-lg font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>{formatCurrency(totalRetail)}</div>
                          </div>
                        )}
                        {totalFloor !== null && (
                          <div className="text-right">
                            <div className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-orange-500" : "text-orange-600"}`}>Floor Total <span className="opacity-60">(50%)</span></div>
                            <div className={`text-lg font-bold ${isDarkMode ? "text-orange-300" : "text-orange-700"}`}>{formatCurrency(totalFloor)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Catalog list — full width */}
        <section className={`${panelClassName} p-4 md:p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Catalog Results</h3>
              <p className={`text-sm ${subtleTextClassName}`}>Use Details for product information or Price Match for a one-SKU competitor check.</p>
            </div>
            <label className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${isDarkMode ? "border border-slate-700 bg-slate-900 text-slate-300" : "border border-slate-300 bg-white text-slate-700"}`}>
              <span>Sort</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as ProductSort)} className={`bg-transparent text-xs font-semibold outline-none ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
                <option value="relevance">Relevance</option>
                <option value="manufacturer">Manufacturer A-Z</option>
                <option value="category">Category A-Z</option>
                <option value="item">Item # A-Z</option>
                <option value="price_low">Price low–high</option>
                <option value="price_high">Price high–low</option>
              </select>
            </label>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className={`rounded-2xl px-4 py-6 text-sm ${subtleTextClassName}`}>Loading product catalog…</div>
            ) : sortedItems.length ? (
              sortedItems.map((item) => {
                const inCart = isInActiveCart(item.id);
                const itemSearchUrl = buildExternalItemSearchUrl(item.sku);
                const thumbnailUrl = getPrimaryImageUrl(item);
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border px-4 py-3 transition ${isDarkMode ? "border-slate-800 bg-slate-950 hover:bg-slate-900" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => openItemDialog(item.id, "details")}
                        className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border transition ${isDarkMode ? "border-slate-800 bg-slate-900 hover:border-sky-400/40" : "border-slate-200 bg-white hover:border-sky-300"}`}
                        title={thumbnailUrl ? "Open larger product image" : "Open item detail"}
                      >
                        {thumbnailUrl ? (
                          <img src={thumbnailUrl} alt={item.description || item.sku || "Product"} className="h-full w-full object-contain" loading="lazy" />
                        ) : (
                          <span className={`px-2 text-center text-[11px] font-semibold ${subtleTextClassName}`}>No image</span>
                        )}
                      </button>
                      {/* Product summary stays compact; detail actions are explicit. */}
                      <div className="flex-1 min-w-[220px] text-left">
                        <div className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          {item.description || item.collectionName || item.sku}
                        </div>
                        <div className={`mt-0.5 text-xs ${subtleTextClassName}`}>
                          {item.manufacturer} · {item.category || "Uncategorized"} · {item.productType || "General"}
                        </div>
                        <div className={`mt-1 text-xs ${subtleTextClassName}`}>
                          SKU {item.sku || "—"} · {formatDimensions(item)} · {item.material || item.colorFinish || "—"}
                        </div>
                        {item.hasInventory && (
                          <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${isDarkMode ? "bg-emerald-400/15 text-emerald-200" : "bg-emerald-100 text-emerald-800"}`}>
                            In stock: {item.inventoryQtyAvailable ?? item.inventoryQtyInStockDam ?? 0}
                          </div>
                        )}
                      </div>
                      {/* Prices + cart button */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          {showCosts && (
                            <>
                              <div className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Cost</div>
                              <div className={`text-sm font-semibold ${isDarkMode ? "text-sky-200" : "text-sky-900"}`}>{formatCurrency(item.basePrice)}</div>
                            </>
                          )}
                          {calcSuggestedRetail(item.basePrice, item.manufacturerSlug) !== null && (
                            <>
                              <div className={`${showCosts ? "mt-1 " : ""}text-xs uppercase tracking-wide ${isDarkMode ? "text-emerald-500" : "text-emerald-600"}`}>Retail</div>
                              <div className={`text-sm font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-700"}`}>{formatCurrency(calcSuggestedRetail(item.basePrice, item.manufacturerSlug))}</div>
                            </>
                          )}
                          {calcFloorRetail(item.basePrice, item.manufacturerSlug) !== null && (
                            <>
                              <div className={`mt-0.5 text-xs uppercase tracking-wide ${isDarkMode ? "text-orange-500" : "text-orange-600"}`}>Floor</div>
                              <div className={`text-sm font-semibold ${isDarkMode ? "text-orange-300" : "text-orange-700"}`}>{formatCurrency(calcFloorRetail(item.basePrice, item.manufacturerSlug))}</div>
                            </>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <button type="button" onClick={() => openItemDialog(item.id, "details")}
                            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${isDarkMode ? "border border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20" : "border border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200"}`}>
                            Details
                          </button>
                          <button type="button" onClick={() => openItemDialog(item.id, "price-match")}
                            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${isDarkMode ? "border border-violet-400/30 bg-violet-400/10 text-violet-100 hover:bg-violet-400/20" : "border border-violet-300 bg-violet-100 text-violet-900 hover:bg-violet-200"}`}>
                            Price Match
                          </button>
                        </div>
                        {inCart ? (() => {
                          const cartQty = activeCart.items.find((ci) => ci.item.id === item.id)?.qty ?? 1;
                          return (
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" onClick={() => updateQty(activeCart.id, item.id, cartQty - 1)}
                                className={`h-7 w-7 rounded-full text-base font-bold transition ${isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-rose-900 hover:text-rose-300" : "bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600"}`}
                                title={cartQty === 1 ? "Remove from cart" : "Decrease qty"}>−</button>
                              <span className={`w-6 text-center text-sm font-bold ${isDarkMode ? "text-amber-300" : "text-amber-700"}`}>{cartQty}</span>
                              <button type="button" onClick={() => addToCart(item)}
                                className={`h-7 w-7 rounded-full text-base font-bold transition ${isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-amber-400/20 hover:text-amber-300" : "bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700"}`}
                                title="Add another">+</button>
                            </div>
                          );
                        })() : (
                          <button type="button" onClick={() => addToCart(item)} title="Add to cart"
                            className={`shrink-0 rounded-xl p-2 transition ${isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-amber-400/15 hover:text-amber-300" : "bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-700"}`}>
                            <ShoppingCart size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {itemSearchUrl && (
                      <div className="mt-2">
                        <a href={itemSearchUrl} target="_blank" rel="noreferrer"
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition ${isDarkMode ? "border border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/18" : "border border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200"}`}>
                          Item Search: {item.sku}
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className={`rounded-2xl px-4 py-6 text-sm ${subtleTextClassName}`}>No products matched. Try a broader search or load a new manufacturer.</div>
            )}
          </div>
          {!loading && (canLoadMore || loadingMore || catalogHasMore) && (
            <div ref={loadMoreRef} className="mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-5 text-center">
              {canLoadMore ? (
                <>
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isDarkMode
                        ? "border border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/18"
                        : "border border-sky-300 bg-sky-100 text-sky-950 hover:bg-sky-200"
                    }`}
                  >
                    {loadingMore ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      <>
                        Load {nextBatchSize.toLocaleString()} more
                      </>
                    )}
                  </button>
                  <div className={`text-xs ${subtleTextClassName}`}>
                    Auto-loads as you scroll near the bottom.
                  </div>
                </>
              ) : (
                <div className={`text-sm ${subtleTextClassName}`}>
                  Loaded the current {CATALOG_MAX_LIMIT.toLocaleString()} item cap. Use search or filters to narrow the catalog further.
                </div>
              )}
            </div>
          )}
        </section>
        </div>
      </div>

      {selectedItem && dialogMode && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => { if (event.currentTarget === event.target) closeItemDialog(); }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-item-dialog-title"
            className={`flex h-[100dvh] w-full flex-col overflow-hidden shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-3xl sm:border ${isDarkMode ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-slate-50"}`}
          >
            <div className={`flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-6 ${isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-500">Shop item</div>
                <h2 id="shop-item-dialog-title" className={`mt-1 truncate text-lg font-bold ${isDarkMode ? "text-white" : "text-slate-950"}`}>
                  {selectedItem.description || selectedItem.collectionName || selectedItem.sku}
                </h2>
                <div className={`mt-1 text-xs ${subtleTextClassName}`}>{selectedItem.manufacturer} · SKU {selectedItem.sku || "—"}</div>
              </div>
              <button ref={dialogCloseRef} type="button" onClick={closeItemDialog} aria-label="Close item dialog"
                className={`shrink-0 rounded-full p-2 transition ${isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
                <X size={20} />
              </button>
            </div>

            <div className={`flex gap-2 border-b px-4 py-3 sm:px-6 ${isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`} role="tablist" aria-label="Item view">
              <button
                id="shop-item-details-tab"
                type="button"
                role="tab"
                aria-controls="shop-item-details-panel"
                aria-selected={dialogMode === "details"}
                tabIndex={dialogMode === "details" ? 0 : -1}
                onClick={() => setDialogMode("details")}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  setDialogMode("price-match");
                  window.requestAnimationFrame(() => document.getElementById("shop-item-price-match-tab")?.focus());
                }}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${dialogMode === "details" ? (isDarkMode ? "bg-sky-400/15 text-sky-100" : "bg-sky-100 text-sky-900") : subtleTextClassName}`}
              >
                Details
              </button>
              <button
                id="shop-item-price-match-tab"
                type="button"
                role="tab"
                aria-controls="shop-item-price-match-panel"
                aria-selected={dialogMode === "price-match"}
                tabIndex={dialogMode === "price-match" ? 0 : -1}
                onClick={() => setDialogMode("price-match")}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  setDialogMode("details");
                  window.requestAnimationFrame(() => document.getElementById("shop-item-details-tab")?.focus());
                }}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${dialogMode === "price-match" ? (isDarkMode ? "bg-violet-400/15 text-violet-100" : "bg-violet-100 text-violet-900") : subtleTextClassName}`}
              >
                Price Match
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {dialogMode === "details" ? (
                <div id="shop-item-details-panel" role="tabpanel" aria-labelledby="shop-item-details-tab">
                  {renderSelectedItemDetails(selectedItem)}
                </div>
              ) : (
                <div id="shop-item-price-match-panel" role="tabpanel" aria-labelledby="shop-item-price-match-tab">
                  <ProductPriceMatchPanel
                    item={selectedItem}
                    sellingPrice={calcSuggestedRetail(selectedItem.basePrice, selectedItem.manufacturerSlug)}
                    isDarkMode={isDarkMode}
                  />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}


    </>
  );
};

export default ProductSearchWorkspace;
