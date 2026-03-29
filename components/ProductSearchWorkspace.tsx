import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, UploadCloud } from "lucide-react";
import type { ManufacturerCatalogItem, ManufacturerReferenceNote } from "../types";
import { CANONICAL_PRODUCT_MANUFACTURERS } from "../constants/productCatalog";
import { fetchManufacturerCatalog, fetchManufacturerReferenceNotes } from "../services/manufacturerPricelistApi";

type ProductSearchWorkspaceProps = {
  isDarkMode: boolean;
  onOpenUploadArea: () => void;
};

type ProductSort =
  | "relevance"
  | "manufacturer"
  | "category"
  | "item"
  | "price_low"
  | "price_high";

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
  const normalizedSku = String(sku || "").trim();
  if (!normalizedSku) return "";
  return `https://www.furnituredistributors.net/Product/SiteSearch?search=${encodeURIComponent(normalizedSku)}`;
};

const ProductSearchWorkspace: React.FC<ProductSearchWorkspaceProps> = ({ isDarkMode, onOpenUploadArea }) => {
  const CATALOG_FETCH_LIMIT = 5000;
  const [query, setQuery] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [sortBy, setSortBy] = useState<ProductSort>("relevance");
  const [items, setItems] = useState<ManufacturerCatalogItem[]>([]);
  const [notes, setNotes] = useState<ManufacturerReferenceNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogRows, noteRows] = await Promise.all([
        fetchManufacturerCatalog({
          manufacturer: manufacturer || undefined,
          category: category || undefined,
          color: color || undefined,
          query: query || undefined,
          limit: CATALOG_FETCH_LIMIT,
        }),
        manufacturer ? fetchManufacturerReferenceNotes(manufacturer) : Promise.resolve([]),
      ]);
      setItems(catalogRows);
      setNotes(noteRows);
      setSelectedId((current) => {
        if (catalogRows.some((item) => item.id === current)) return current;
        return catalogRows[0]?.id || null;
      });
    } catch (err: any) {
      setError(String(err?.message || err || "Unable to load product catalog"));
      setItems([]);
      setNotes([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCatalog();
    }, 220);
    return () => window.clearTimeout(timeoutId);
  }, [query, manufacturer, category, color]);

  const selectedItem = items.find((item) => item.id === selectedId) || null;
  const manufacturerOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...CANONICAL_PRODUCT_MANUFACTURERS,
          ...items.map((item) => item.manufacturer).filter(Boolean),
        ])
      ).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const colorOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.colorFamily || item.colorFinish).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const sortedItems = useMemo(() => {
    const alpha = (value: string | undefined) => (value || "").trim().toLowerCase();
    return [...items].sort((left, right) => {
      if (sortBy === "relevance") return 0;
      if (sortBy === "manufacturer") {
        return (
          alpha(left.manufacturer).localeCompare(alpha(right.manufacturer)) ||
          alpha(left.description || left.collectionName || left.sku).localeCompare(
            alpha(right.description || right.collectionName || right.sku)
          )
        );
      }
      if (sortBy === "category") {
        return (
          alpha(left.category).localeCompare(alpha(right.category)) ||
          alpha(left.description || left.collectionName || left.sku).localeCompare(
            alpha(right.description || right.collectionName || right.sku)
          )
        );
      }
      if (sortBy === "item") {
        return alpha(left.sku).localeCompare(alpha(right.sku)) || alpha(left.description).localeCompare(alpha(right.description));
      }
      if (sortBy === "price_low" || sortBy === "price_high") {
        const leftPrice = left.basePrice;
        const rightPrice = right.basePrice;
        if (leftPrice === null && rightPrice === null) return alpha(left.sku).localeCompare(alpha(right.sku));
        if (leftPrice === null) return 1;
        if (rightPrice === null) return -1;
        return sortBy === "price_low" ? leftPrice - rightPrice : rightPrice - leftPrice;
      }
      return 0;
    });
  }, [items, sortBy]);

  return (
    <div className="space-y-5">
      <section className={`${panelClassName} p-5 md:p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Product Search</div>
            <h2 className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Search the furniture catalog in its own workspace
            </h2>
            <p className={`mt-2 max-w-3xl text-sm leading-6 ${subtleTextClassName}`}>
              This module is the catalog-facing side of the product system. Uploads, file cleanup, and field mapping stay in
              <span className="font-semibold"> Update Database</span> for now, while this area grows into the product and POS search experience over time.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenUploadArea}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              isDarkMode
                ? "border border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/18"
                : "border border-sky-300 bg-sky-100 text-sky-950 hover:bg-sky-200"
            }`}
          >
            <UploadCloud size={16} />
            Open Upload & Mapping
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[2.2fr_repeat(3,minmax(0,1fr))]">
          <label className="space-y-2">
            <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Search</span>
            <div className="relative">
              <Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`} size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Search by description, item number, material, finish, "round table", "sleeper", and more'
                className={`${inputClassName} w-full pl-10`}
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Manufacturer</span>
            <select value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} className={inputClassName}>
              <option value="">All manufacturers</option>
              {manufacturerOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClassName}>
              <option value="">All categories</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className={`text-xs font-semibold uppercase tracking-wide ${subtleTextClassName}`}>Color / Finish</span>
            <select value={color} onChange={(event) => setColor(event.target.value)} className={inputClassName}>
              <option value="">All colors</option>
              {colorOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className={badgeClassName}>{items.length.toLocaleString()} products</span>
          <span className={badgeClassName}>
            {new Set(items.map((item) => item.manufacturer).filter(Boolean)).size} manufacturers in current result
          </span>
          <span className={badgeClassName}>Showing up to {CATALOG_FETCH_LIMIT.toLocaleString()} products</span>
          <button
            type="button"
            onClick={() => void loadCatalog()}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              isDarkMode
                ? "border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            <RefreshCw size={14} />
            Refresh results
          </button>
        </div>

        {error ? (
          <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${isDarkMode ? "bg-rose-500/12 text-rose-100" : "bg-rose-100 text-rose-900"}`}>
            {error}
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
        <section className={`${panelClassName} p-4 md:p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Catalog Results</h3>
              <p className={`text-sm ${subtleTextClassName}`}>Dedicated search module now, inventory and POS hooks later.</p>
            </div>
            <label className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${isDarkMode ? "border border-slate-700 bg-slate-900 text-slate-300" : "border border-slate-300 bg-white text-slate-700"}`}>
              <span>Sort</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as ProductSort)}
                className={`bg-transparent text-xs font-semibold outline-none ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}
              >
                <option value="relevance">Relevance / extraction order</option>
                <option value="manufacturer">Manufacturer A-Z</option>
                <option value="category">Category A-Z</option>
                <option value="item">Item # A-Z</option>
                <option value="price_low">Price low-high</option>
                <option value="price_high">Price high-low</option>
              </select>
            </label>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className={`rounded-2xl px-4 py-6 text-sm ${subtleTextClassName}`}>Loading product catalog...</div>
            ) : sortedItems.length ? (
              sortedItems.map((item) => {
                const active = item.id === selectedId;
                const itemSearchUrl = buildExternalItemSearchUrl(item.sku);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? isDarkMode
                          ? "border-sky-400/40 bg-sky-400/10"
                          : "border-sky-300 bg-sky-100/80"
                        : isDarkMode
                          ? "border-slate-800 bg-slate-950 hover:bg-slate-900"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          {item.description || item.collectionName || item.sku}
                        </div>
                        <div className={`mt-1 text-xs ${subtleTextClassName}`}>
                          {item.manufacturer} · {item.category || "Uncategorized"} · {item.productType || "General"}
                        </div>
                      </div>
                      <div className={`text-sm font-semibold ${isDarkMode ? "text-sky-200" : "text-sky-900"}`}>{formatCurrency(item.basePrice)}</div>
                    </div>
                    <div className={`mt-2 text-xs ${subtleTextClassName}`}>
                      SKU {item.sku || "—"} · {formatDimensions(item)} · {item.material || item.colorFinish || "No finish captured"}
                    </div>
                    {itemSearchUrl ? (
                      <div className="mt-3">
                        <a
                          href={itemSearchUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            isDarkMode
                              ? "border border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/18"
                              : "border border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200"
                          }`}
                        >
                          Item Search: {item.sku}
                        </a>
                      </div>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className={`rounded-2xl px-4 py-6 text-sm ${subtleTextClassName}`}>
                No products matched that filter yet. Try a broader search or open the upload and mapping area to load a new manufacturer.
              </div>
            )}
          </div>
        </section>

        <section className={`${panelClassName} p-4 md:p-5`}>
          <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Product Detail</h3>
          {selectedItem ? (
            <div className="mt-4 space-y-4">
              {buildExternalItemSearchUrl(selectedItem.sku) ? (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildExternalItemSearchUrl(selectedItem.sku)}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center rounded-full px-3 py-2 text-sm font-semibold transition ${
                      isDarkMode
                        ? "border border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/18"
                        : "border border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200"
                    }`}
                  >
                    Open item number search for {selectedItem.sku}
                  </a>
                </div>
              ) : null}
              <div>
                <div className={`text-xs font-semibold uppercase tracking-[0.22em] ${isDarkMode ? "text-sky-300" : "text-sky-700"}`}>
                  {selectedItem.manufacturer}
                </div>
                <div className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {selectedItem.description || selectedItem.collectionName || selectedItem.sku}
                </div>
                <div className={`mt-2 text-sm ${subtleTextClassName}`}>
                  Item # {selectedItem.sku || "—"} · Collection {selectedItem.collectionName || selectedItem.collectionCode || "—"}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs uppercase tracking-wide ${subtleTextClassName}`}>Price</div>
                  <div className={`mt-1 text-lg font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{formatCurrency(selectedItem.basePrice)}</div>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs uppercase tracking-wide ${subtleTextClassName}`}>Dimensions</div>
                  <div className={`mt-1 text-lg font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{formatDimensions(selectedItem)}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs uppercase tracking-wide ${subtleTextClassName}`}>Color / Finish</div>
                  <div className={`mt-1 text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {selectedItem.colorFinish || selectedItem.colorFamily || "—"}
                  </div>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs uppercase tracking-wide ${subtleTextClassName}`}>Material / Shape</div>
                  <div className={`mt-1 text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {[selectedItem.material, selectedItem.shape].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[...selectedItem.featureTags, ...selectedItem.searchKeywords].slice(0, 12).map((tag) => (
                  <span key={tag} className={badgeClassName}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-3">
                <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs uppercase tracking-wide ${subtleTextClassName}`}>Options</div>
                  <div className={`mt-2 text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                    Hardware: {selectedItem.hardwareOptions.length ? selectedItem.hardwareOptions.join(", ") : "—"}
                  </div>
                  <div className={`mt-1 text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                    Cushions: {selectedItem.cushionOptions.length ? selectedItem.cushionOptions.join(", ") : "—"}
                  </div>
                  <div className={`mt-1 text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                    Upholstery cover: {selectedItem.upholsteryCover || "—"}
                  </div>
                </div>

                {notes.length ? (
                  <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                    <div className={`text-xs uppercase tracking-wide ${subtleTextClassName}`}>Manufacturer Notes</div>
                    <div className="mt-2 space-y-2">
                      {notes.slice(0, 3).map((note) => (
                        <div key={note.id}>
                          <div className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{note.title}</div>
                          <div className={`mt-1 text-sm leading-6 ${subtleTextClassName}`}>{note.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={`mt-4 rounded-2xl px-4 py-6 text-sm ${subtleTextClassName}`}>
              Pick a result to see the product detail, filters, and manufacturer notes here.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProductSearchWorkspace;
