import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, PlayCircle, Plus, RefreshCw, Search, ShoppingCart, Trash2, UploadCloud, X } from "lucide-react";
import { useBotBotContext } from "./botbot/BotBotContext";
import type { ManufacturerCatalogItem, ManufacturerReferenceNote } from "../types";
import { CANONICAL_PRODUCT_MANUFACTURERS, calcSuggestedRetail, calcFloorRetail } from "../constants/productCatalog";
import { fetchManufacturerCatalog, fetchManufacturerReferenceNotes } from "../services/manufacturerPricelistApi";

type ProductSearchWorkspaceProps = {
  isDarkMode: boolean;
  onOpenUploadArea: () => void;
};

type ProductSort = "relevance" | "manufacturer" | "category" | "item" | "price_low" | "price_high";

type CartItem = { item: ManufacturerCatalogItem; qty: number };
type Cart = { id: string; name: string; items: CartItem[] };

let nextCartId = 2;

const SPLASH_JOKES = [
  "Hold on… the warehouse guys are checking the top shelves.",
  "Loading 5,000 pieces of furniture. Someone should've counted before we started.",
  "Please hold. Dave is still measuring the sectionals.",
  "Good news: we found the couch. Bad news: we sat down.",
  "One moment — we're waiting for the recliner to stop reclining.",
  "Fetching catalog… turns out the showroom floor is bigger than it looks.",
  "The forklift is running. Should only be a moment.",
  "Someone lost the scanner. We're hand-counting the recliners.",
  "This is a lot of furniture. Like, a *lot* a lot.",
  "Loading complete… just kidding, there's still more furniture.",
  "Dusting off thousands of SKUs. Bear with us.",
  "The freight elevator is slow but it gets there.",
  "Counting ottomans. Whoever ordered this many ottomans — you know who you are.",
  "We'd be done faster but someone keep re-staging the living room displays.",
  "Almost there. The sectional was harder to carry than expected.",
];

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

const ProductSearchWorkspace: React.FC<ProductSearchWorkspaceProps> = ({ isDarkMode, onOpenUploadArea }) => {
  const { setPageContext } = useBotBotContext();
  const CATALOG_FETCH_LIMIT = 5000;

  // Splash screen
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const splashJoke = useRef(SPLASH_JOKES[Math.floor(Math.random() * SPLASH_JOKES.length)]);

  useEffect(() => {
    setPageContext({
      pageName: "Product Search",
      module: "product_search",
      userRole: "Employee",
      keyMetricsVisible: [],
      suggestedActions: [],
    });
  }, [setPageContext]);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setSplashFading(true), 2400);
    const hideTimer = window.setTimeout(() => setSplashVisible(false), 3000);
    return () => { window.clearTimeout(fadeTimer); window.clearTimeout(hideTimer); };
  }, []);

  // Search filters
  const [query, setQuery] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [productType, setProductType] = useState("");
  const [featureTag, setFeatureTag] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortBy, setSortBy] = useState<ProductSort>("relevance");

  // Catalog state
  const [items, setItems] = useState<ManufacturerCatalogItem[]>([]);
  const [notes, setNotes] = useState<ManufacturerReferenceNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI toggles
  const [showCosts, setShowCosts] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
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
    ? "rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
    : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-200/70";
  const subtleTextClassName = isDarkMode ? "text-slate-400" : "text-slate-600";
  const badgeClassName = isDarkMode
    ? "rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200"
    : "rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800";
  const drawerBg = isDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200";

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

  // Data loading
  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogRows, noteRows] = await Promise.all([
        fetchManufacturerCatalog({ manufacturer: manufacturer || undefined, category: category || undefined, color: color || undefined, query: query || undefined, limit: CATALOG_FETCH_LIMIT }),
        manufacturer ? fetchManufacturerReferenceNotes(manufacturer) : Promise.resolve([]),
      ]);
      setItems(catalogRows);
      setNotes(noteRows);
      if (!selectedId || !catalogRows.some((item) => item.id === selectedId)) {
        setSelectedId(catalogRows[0]?.id ?? null);
      }
    } catch (err: any) {
      setError(String(err?.message ?? err ?? "Unable to load product catalog"));
      setItems([]); setNotes([]); setSelectedId(null);
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    const t = window.setTimeout(() => { void loadCatalog(); }, 220);
    return () => window.clearTimeout(t);
  }, [query, manufacturer, category, color]);

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

  const handleSelectItem = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header & filters */}
        <section className={`${panelClassName} p-5 md:p-6`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Product Search</div>
              <h2 className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                Search the furniture catalog
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowCosts((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
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
                className={`relative inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  cartOpen
                    ? isDarkMode ? "border border-amber-400/40 bg-amber-400/15 text-amber-200" : "border border-amber-400 bg-amber-100 text-amber-900"
                    : isDarkMode ? "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <ShoppingCart size={15} />
                Carts
                {totalCartItems > 0 && (
                  <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ${isDarkMode ? "bg-amber-400 text-slate-900" : "bg-amber-500 text-white"}`}>
                    {totalCartItems}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={onOpenUploadArea}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isDarkMode ? "border border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/18" : "border border-sky-300 bg-sky-100 text-sky-950 hover:bg-sky-200"
                }`}
              >
                <UploadCloud size={16} />
                Open Upload & Mapping
              </button>
            </div>
          </div>

          {/* Filter row 1 */}
          <div className="mt-5 grid gap-3 md:grid-cols-[2.2fr_repeat(3,minmax(0,1fr))]">
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

          {/* Filter row 2 */}
          <div className="mt-3 grid gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))]">
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
              <button type="button" onClick={() => { setProductType(""); setFeatureTag(""); setPriceMin(""); setPriceMax(""); }}
                className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${isDarkMode ? "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}>
                <X size={14} /> Clear extra filters
              </button>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className={badgeClassName}>{sortedItems.length.toLocaleString()} products</span>
            <span className={badgeClassName}>{new Set(sortedItems.map((i) => i.manufacturer).filter(Boolean)).size} manufacturers</span>
            <button type="button" onClick={() => void loadCatalog()}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${isDarkMode ? "border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {error && (
            <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${isDarkMode ? "bg-rose-500/12 text-rose-100" : "bg-rose-100 text-rose-900"}`}>{error}</div>
          )}
        </section>

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
              <p className={`text-sm ${subtleTextClassName}`}>Click any item to open the detail panel →</p>
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
                const active = item.id === selectedId;
                const inCart = isInActiveCart(item.id);
                const itemSearchUrl = buildExternalItemSearchUrl(item.sku);
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border px-4 py-3 transition ${active ? (isDarkMode ? "border-sky-400/40 bg-sky-400/10" : "border-sky-300 bg-sky-100/80") : (isDarkMode ? "border-slate-800 bg-slate-950 hover:bg-slate-900" : "border-slate-200 bg-white hover:bg-slate-50")}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      {/* Clickable area for detail */}
                      <button type="button" onClick={() => handleSelectItem(item.id)} className="flex-1 min-w-0 text-left">
                        <div className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          {item.description || item.collectionName || item.sku}
                        </div>
                        <div className={`mt-0.5 text-xs ${subtleTextClassName}`}>
                          {item.manufacturer} · {item.category || "Uncategorized"} · {item.productType || "General"}
                        </div>
                        <div className={`mt-1 text-xs ${subtleTextClassName}`}>
                          SKU {item.sku || "—"} · {formatDimensions(item)} · {item.material || item.colorFinish || "—"}
                        </div>
                      </button>
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
        </section>
      </div>

      {/* Splash screen */}
      {splashVisible && (
        <div
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 transition-opacity duration-500 ${splashFading ? "opacity-0" : "opacity-100"} ${isDarkMode ? "bg-slate-950" : "bg-white"}`}
        >
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 animate-spin rounded-full border-4 border-t-transparent ${isDarkMode ? "border-sky-400" : "border-sky-500"}`} />
            <span className={`text-2xl font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Loading Catalog…</span>
          </div>
          <p className={`max-w-sm text-center text-base leading-7 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {splashJoke.current}
          </p>
        </div>
      )}

      {/* Pull tab — always visible on right edge */}
      <button
        type="button"
        onClick={() => setDetailOpen((v) => !v)}
        className={`fixed top-1/2 right-0 z-40 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl border-y border-l px-2.5 py-5 shadow-lg transition-all ${
          isDarkMode ? "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
        title="Product Detail"
      >
        <ChevronLeft size={16} className={`transition-transform ${detailOpen ? "rotate-180" : ""}`} />
        <span className="text-xs font-bold uppercase tracking-wider [writing-mode:vertical-rl]">
          {selectedItem ? (selectedItem.sku || "Detail") : "Detail"}
        </span>
        {selectedItem && isInActiveCart(selectedItem.id) && (
          <span className={`h-2 w-2 rounded-full ${isDarkMode ? "bg-amber-400" : "bg-amber-500"}`} />
        )}
      </button>

      {/* Backdrop */}
      {detailOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={() => setDetailOpen(false)} />
      )}

      {/* Detail drawer */}
      <div className={`fixed top-0 right-0 z-50 h-full w-full max-w-lg overflow-y-auto border-l shadow-2xl transition-transform duration-300 ${drawerBg} ${detailOpen ? "translate-x-0" : "translate-x-full"}`}>
        {/* Drawer header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 ${isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-white"}`}>
          <div className="min-w-0">
            <div className={`text-base font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              {selectedItem ? (selectedItem.description || selectedItem.collectionName || selectedItem.sku) : "Product Detail"}
            </div>
            {selectedItem && (
              <div className={`text-xs ${subtleTextClassName}`}>{selectedItem.manufacturer} · SKU {selectedItem.sku || "—"}</div>
            )}
          </div>
          <button type="button" onClick={() => setDetailOpen(false)} className={`ml-3 shrink-0 rounded-full p-1.5 transition ${isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}>
            <X size={18} />
          </button>
        </div>

        {/* Drawer content */}
        <div className="p-5 space-y-5">
          {selectedItem ? (
            <>
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {buildExternalItemSearchUrl(selectedItem.sku) && (
                  <a href={buildExternalItemSearchUrl(selectedItem.sku)} target="_blank" rel="noreferrer"
                    className={`inline-flex items-center rounded-full px-3 py-2 text-sm font-semibold transition ${isDarkMode ? "border border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/18" : "border border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200"}`}>
                    Item Search: {selectedItem.sku}
                  </a>
                )}
                <button type="button"
                  onClick={() => isInActiveCart(selectedItem.id) ? removeFromCart(activeCart.id, selectedItem.id) : addToCart(selectedItem)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${isInActiveCart(selectedItem.id) ? (isDarkMode ? "border border-amber-400/40 bg-amber-400/15 text-amber-200 hover:bg-rose-400/15 hover:text-rose-300" : "border border-amber-400 bg-amber-100 text-amber-800 hover:bg-rose-100 hover:text-rose-700") : (isDarkMode ? "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-amber-400/15 hover:text-amber-300" : "border border-slate-300 bg-white text-slate-600 hover:bg-amber-100 hover:text-amber-800")}`}>
                  <ShoppingCart size={14} />
                  {isInActiveCart(selectedItem.id) ? "Remove from Cart" : `Add to ${activeCart?.name ?? "Cart"}`}
                </button>
              </div>

              {/* Description */}
              <div>
                <div className={`text-xs font-semibold uppercase tracking-[0.22em] ${isDarkMode ? "text-sky-300" : "text-sky-700"}`}>{selectedItem.manufacturer}</div>
                <div className={`mt-1 text-xl font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {selectedItem.description || selectedItem.collectionName || selectedItem.sku}
                </div>
                {selectedItem.description && selectedItem.collectionName && (
                  <div className={`mt-1 text-sm ${subtleTextClassName}`}>Collection: {selectedItem.collectionName}</div>
                )}
                <div className={`mt-1 text-sm ${subtleTextClassName}`}>Item # {selectedItem.sku || "—"} · {selectedItem.collectionCode || "—"}</div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-3">
                {calcSuggestedRetail(selectedItem.basePrice, selectedItem.manufacturerSlug) !== null && (
                  <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-emerald-800 bg-emerald-950" : "border-emerald-200 bg-emerald-50"}`}>
                    <div className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>Retail <span className="opacity-60">(60%)</span></div>
                    <div className={`mt-1 text-lg font-semibold ${isDarkMode ? "text-emerald-200" : "text-emerald-900"}`}>{formatCurrency(calcSuggestedRetail(selectedItem.basePrice, selectedItem.manufacturerSlug))}</div>
                  </div>
                )}
                {calcFloorRetail(selectedItem.basePrice, selectedItem.manufacturerSlug) !== null && (
                  <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-orange-800 bg-orange-950" : "border-orange-200 bg-orange-50"}`}>
                    <div className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-orange-400" : "text-orange-700"}`}>Floor <span className="opacity-60">(50%)</span></div>
                    <div className={`mt-1 text-lg font-semibold ${isDarkMode ? "text-orange-200" : "text-orange-900"}`}>{formatCurrency(calcFloorRetail(selectedItem.basePrice, selectedItem.manufacturerSlug))}</div>
                  </div>
                )}
                {showCosts && selectedItem.basePrice !== null && (
                  <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-sky-800 bg-sky-950" : "border-sky-200 bg-sky-50"}`}>
                    <div className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-sky-400" : "text-sky-700"}`}>Cost</div>
                    <div className={`mt-1 text-lg font-semibold ${isDarkMode ? "text-sky-200" : "text-sky-900"}`}>{formatCurrency(selectedItem.basePrice)}</div>
                  </div>
                )}
                <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs uppercase tracking-wide ${subtleTextClassName}`}>Dimensions</div>
                  <div className={`mt-1 text-base font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{formatDimensions(selectedItem)}</div>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs uppercase tracking-wide ${subtleTextClassName}`}>Color / Finish</div>
                  <div className={`mt-1 text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{selectedItem.colorFinish || selectedItem.colorFamily || "—"}</div>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs uppercase tracking-wide ${subtleTextClassName}`}>Material / Shape</div>
                  <div className={`mt-1 text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{[selectedItem.material, selectedItem.shape].filter(Boolean).join(" · ") || "—"}</div>
                </div>
              </div>

              {/* Feature tags */}
              {[...selectedItem.featureTags, ...selectedItem.searchKeywords].length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {[...selectedItem.featureTags, ...selectedItem.searchKeywords].slice(0, 16).map((tag) => (
                    <span key={tag} className={badgeClassName}>{tag}</span>
                  ))}
                </div>
              )}

              {/* Videos */}
              {productVideos.length > 0 && (
                <div className={`rounded-2xl border-2 border-amber-500/40 bg-amber-500/8 px-4 py-4`}>
                  <div className="flex items-center gap-2">
                    <PlayCircle className="text-amber-500" size={18} />
                    <div className="text-sm font-semibold uppercase tracking-wide text-amber-500">Product Demo Videos</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {productVideos.map((note) => {
                      const vid = note.videoUrl.includes("youtube.com") ? note.videoUrl.split("v=")[1]?.split("&")[0] : note.videoUrl.split("/").pop();
                      return (
                        <a key={note.id} href={`https://www.youtube.com/watch?v=${vid}`} target="_blank" rel="noreferrer"
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition hover:bg-amber-500/12 ${isDarkMode ? "border-amber-600/40 bg-amber-900/20" : "border-amber-300 bg-amber-50"}`}>
                          <PlayCircle className="text-amber-500 shrink-0" size={20} />
                          <span className={`text-sm font-semibold ${isDarkMode ? "text-amber-200" : "text-amber-900"}`}>{note.title}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Options */}
              <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                <div className={`text-xs uppercase tracking-wide ${subtleTextClassName}`}>Options</div>
                <div className={`mt-2 text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Hardware: {selectedItem.hardwareOptions.length ? selectedItem.hardwareOptions.join(", ") : "—"}</div>
                <div className={`mt-1 text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Cushions: {selectedItem.cushionOptions.length ? selectedItem.cushionOptions.join(", ") : "—"}</div>
                <div className={`mt-1 text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Upholstery: {selectedItem.upholsteryCover || "—"}</div>
              </div>

              {/* Relevant feature notes */}
              {relevantNotes.length > 0 && (
                <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs uppercase tracking-wide ${subtleTextClassName}`}>Feature Notes</div>
                  <div className="mt-2 space-y-4">
                    {relevantNotes.map((note) => {
                      const vid = note.videoUrl?.includes("youtube.com") ? note.videoUrl.split("v=")[1]?.split("&")[0] : note.videoUrl?.split("/").pop();
                      return (
                        <div key={note.id}>
                          <div className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{note.title}</div>
                          <div className={`mt-1 text-sm leading-6 ${subtleTextClassName}`}>{note.content}</div>
                          {vid && (
                            <a href={`https://www.youtube.com/watch?v=${vid}`} target="_blank" rel="noreferrer"
                              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${isDarkMode ? "border border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20" : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"}`}>
                              <PlayCircle size={13} /> Watch Video Demo
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={`rounded-2xl px-4 py-10 text-center text-sm ${subtleTextClassName}`}>
              Click any product in the list to see its detail here.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProductSearchWorkspace;
