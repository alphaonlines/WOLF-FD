import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  Move,
  Receipt,
  Settings2,
  Star,
  UploadCloud,
  Users,
  UserCheck,
  Zap,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ORDER_STORAGE_KEY = "fd_dashboard_card_order";
const VISIBLE_STORAGE_KEY = "fd_dashboard_visible_cards";

type SnapshotCard = {
  id: string;
  title: string;
  description: string;
  details: string;
  cta: string;
  icon: React.ReactNode;
  onClick: () => void;
  module: "Dashboard" | "Den" | "Pulse" | "AMP" | "Shop" | "Tools";
  accentClass: string;
  defaultVisible?: boolean;
};

type SortableCardProps = {
  id: string;
  children: React.ReactNode;
};

type DashboardOverviewProps = {
  onNavigate: (tab: string) => void;
  canViewCard?: (cardId: string) => boolean;
  isDarkMode: boolean;
};

const SortableCard: React.FC<SortableCardProps> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate, canViewCard, isDarkMode }) => {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [visibleCardIds, setVisibleCardIds] = useState<string[] | null>(() => {
    try {
      const raw = localStorage.getItem(VISIBLE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  });
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const cards = useMemo<SnapshotCard[]>(() => {
    const openExternal = (url: string) => {
      window.open(url, "_blank", "noopener,noreferrer");
    };

    return [
      {
        id: "den-ups",
        title: "Den UPS List",
        description: "Jump straight into the active UPS queue and store coverage.",
        details: "This opens Den on the UPS list so you can see who is up, what store is selected, and where floor follow-up needs attention first.",
        cta: "Open UPS List",
        icon: <UserCheck size={22} className="text-amber-500" />,
        onClick: () => onNavigate("WOLFDEN_UPS"),
        module: "Den",
        accentClass: "from-amber-100 via-amber-50 to-white border-amber-200/80",
        defaultVisible: true,
      },
      {
        id: "den-crm",
        title: "Den CRM",
        description: "Open customer search and account follow-up inside Den.",
        details: "Use this when you want the customer side of Den without starting in the UPS queue first.",
        cta: "Open CRM",
        icon: <Users size={22} className="text-amber-500" />,
        onClick: () => onNavigate("WOLFDEN_CRM"),
        module: "Den",
        accentClass: "from-amber-100 via-amber-50 to-white border-amber-200/80",
        defaultVisible: true,
      },
      {
        id: "den-board",
        title: "Den Message Board",
        description: "See internal notes, updates, and team chatter.",
        details: "This opens Den directly on the message board so you can review new notes without navigating through other sections first.",
        cta: "Open Board",
        icon: <MessageSquare size={22} className="text-amber-500" />,
        onClick: () => onNavigate("WOLFDEN_BOARD"),
        module: "Den",
        accentClass: "from-amber-100 via-amber-50 to-white border-amber-200/80",
      },
      {
        id: "den-meeting",
        title: "Den Meeting Room",
        description: "Open the Den meeting room directly from the dashboard.",
        details: "This jumps straight into the Den meeting room so the stat meeting page is one click away from the home dashboard.",
        cta: "Open Meeting Room",
        icon: <ClipboardList size={22} className="text-amber-500" />,
        onClick: () => onNavigate("WOLFDEN_MEETING"),
        module: "Den",
        accentClass: "from-amber-100 via-amber-50 to-white border-amber-200/80",
      },
      {
        id: "den-tasks",
        title: "Den Tasks",
        description: "Open the task lane board for assignments and completion tracking.",
        details: "This goes directly to Den tasks so you can update ownership, move work between stages, and review what is due today.",
        cta: "Open Tasks",
        icon: <CheckSquare size={22} className="text-amber-500" />,
        onClick: () => onNavigate("WOLFDEN_TASKS"),
        module: "Den",
        accentClass: "from-amber-100 via-amber-50 to-white border-amber-200/80",
      },
      {
        id: "pulse-sales",
        title: "Pulse Sales Analysis",
        description: "Open the full sales dashboard inside Pulse.",
        details: "Use this card for sold dollars, units, margins, category mix, manufacturer mix, and the print-ready sales reporting workflow.",
        cta: "Open Sales",
        icon: <BarChart3 size={22} className="text-sky-500" />,
        onClick: () => onNavigate("PULSE_SALES"),
        module: "Pulse",
        accentClass: "from-sky-100 via-sky-50 to-white border-sky-200/80",
        defaultVisible: true,
      },
      {
        id: "pulse-alphaos",
        title: "Pulse AlphaOS / Kiosks",
        description: "Check kiosk health and system status from Pulse.",
        details: "This lands on the AlphaOS view in Pulse so you can see device state and store-facing system health without leaving the dashboard flow.",
        cta: "Open AlphaOS",
        icon: <Monitor size={22} className="text-sky-500" />,
        onClick: () => onNavigate("PULSE_ALPHAOS"),
        module: "Pulse",
        accentClass: "from-sky-100 via-sky-50 to-white border-sky-200/80",
        defaultVisible: true,
      },
      {
        id: "pulse-website",
        title: "Pulse Website",
        description: "Placeholder for the AlphaPulse website analytics module.",
        details: "This opens the website card inside Pulse, ready for the analytics integration once the reporting backend is wired up.",
        cta: "Open Website",
        icon: <Globe size={22} className="text-sky-500" />,
        onClick: () => onNavigate("PULSE_WEBSITE"),
        module: "Pulse",
        accentClass: "from-sky-100 via-sky-50 to-white border-sky-200/80",
      },
      {
        id: "pulse-social",
        title: "Pulse AlphaPulse",
        description: "Open the embedded AlphaPulse page inside Pulse.",
        details: "This lands on the AlphaPulse page in Pulse so the old external menu link now lives inside the module where it belongs.",
        cta: "Open AlphaPulse",
        icon: <Activity size={22} className="text-sky-500" />,
        onClick: () => onNavigate("PULSE_ALPHAPULSE"),
        module: "Pulse",
        accentClass: "from-sky-100 via-sky-50 to-white border-sky-200/80",
        defaultVisible: true,
      },
      {
        id: "pulse-reviews",
        title: "Pulse FD Connect Reviews",
        description: "Open embedded FD Connect reviews inside Pulse.",
        details: "This lands in the reviews iframe inside Pulse and still gives you the quick escape hatch to open the source in a new tab.",
        cta: "Open Reviews",
        icon: <Star size={22} className="text-sky-500" />,
        onClick: () => onNavigate("PULSE_REVIEWS"),
        module: "Pulse",
        accentClass: "from-sky-100 via-sky-50 to-white border-sky-200/80",
      },
      {
        id: "product-search",
        title: "Shop Product Search",
        description: "Search products, pricing, and inventory support tools inside Shop.",
        details: "Use this when you need catalog lookup or to get into item-level workflows without dropping into Den or Pulse first.",
        cta: "Open Shop Search",
        icon: <LayoutDashboard size={22} className="text-slate-600" />,
        onClick: () => onNavigate("SHOP_SEARCH"),
        module: "Shop",
        accentClass: "from-emerald-100 via-emerald-50 to-white border-emerald-200/80",
        defaultVisible: true,
      },
      {
        id: "shop-pos",
        title: "Shop POS",
        description: "Open the dedicated Shop POS landing page.",
        details: "This is the new home for POS-specific workflow inside Shop as we wire the live transaction and register views into the module.",
        cta: "Open Shop POS",
        icon: <Receipt size={22} className="text-emerald-500" />,
        onClick: () => onNavigate("SHOP_POS"),
        module: "Shop",
        accentClass: "from-emerald-100 via-emerald-50 to-white border-emerald-200/80",
      },
      {
        id: "amp-social",
        title: "AMP Social Posts",
        description: "Open the social posts workspace inside AMP.",
        details: "This takes you straight into the social post and ad view inside the new AMP module so the module opens on the team's current posting workflow.",
        cta: "Open AMP Social",
        icon: <Activity size={22} className="text-cyan-500" />,
        onClick: () => onNavigate("AMP_SOCIAL"),
        module: "AMP",
        accentClass: "from-cyan-100 via-cyan-50 to-white border-cyan-200/80",
        defaultVisible: true,
      },
      {
        id: "amp-bot",
        title: "AMP AI Bot",
        description: "Open the AI bot workspace inside AMP.",
        details: "This puts the bot planning and assistant management view into its own module home next to social posts.",
        cta: "Open AMP AI Bot",
        icon: <Bot size={22} className="text-cyan-500" />,
        onClick: () => onNavigate("AMP_BOT"),
        module: "AMP",
        accentClass: "from-cyan-100 via-cyan-50 to-white border-cyan-200/80",
      },
      {
        id: "social-posts",
        title: "Social Posts",
        description: "Legacy shortcut into the social workspace.",
        details: "This card now routes into AMP so older dashboard setups still land in the right module without showing a duplicate sidebar page.",
        cta: "Open AMP Social",
        icon: <Activity size={22} className="text-cyan-500" />,
        onClick: () => onNavigate("AMP_SOCIAL"),
        module: "AMP",
        accentClass: "from-cyan-100 via-cyan-50 to-white border-cyan-200/80",
      },
      {
        id: "update-db",
        title: "Update Database",
        description: "Upload new POS exports and refresh analytics data.",
        details: "This opens the update panel so recent data can be loaded into the backend and reflected across analytics-driven modules.",
        cta: "Open Update Panel",
        icon: <UploadCloud size={22} className="text-slate-600" />,
        onClick: () => onNavigate("UPDATE"),
        module: "Dashboard",
        accentClass: "from-slate-100 via-slate-50 to-white border-slate-200/80",
      },
      {
        id: "manager-specials",
        title: "Manager Specials",
        description: "Go directly to the specials upload page.",
        details: "Use this when the floor needs new specials published quickly without navigating through the app first.",
        cta: "Open Upload",
        icon: <UploadCloud size={22} className="text-slate-600" />,
        onClick: () => openExternal("https://furnituredistributors.wolf.discount/fd/manager-specials-upload.html"),
        module: "Tools",
        accentClass: "from-slate-100 via-slate-50 to-white border-slate-200/80",
      },
    ];
  }, [onNavigate]);

  const availableCards = useMemo(() => {
    if (!canViewCard) return cards;
    return cards.filter((card) => canViewCard(card.id));
  }, [cards, canViewCard]);

  const defaultVisibleIds = useMemo(
    () => availableCards.filter((card) => card.defaultVisible !== false).map((card) => card.id),
    [availableCards]
  );

  useEffect(() => {
    const availableIds = new Set(availableCards.map((card) => card.id));
    setVisibleCardIds((current) => {
      const source = current && current.length ? current : defaultVisibleIds;
      const next = source.filter((id) => availableIds.has(id));
      if (next.length === 0 && defaultVisibleIds.length) return defaultVisibleIds;
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
  }, [availableCards, defaultVisibleIds]);

  useEffect(() => {
    if (!visibleCardIds) return;
    try {
      localStorage.setItem(VISIBLE_STORAGE_KEY, JSON.stringify(visibleCardIds));
    } catch {
      // ignore storage failures
    }
  }, [visibleCardIds]);

  const selectedCards = useMemo(() => {
    const selectedIdSet = new Set((visibleCardIds && visibleCardIds.length ? visibleCardIds : defaultVisibleIds) || []);
    return availableCards.filter((card) => selectedIdSet.has(card.id));
  }, [availableCards, defaultVisibleIds, visibleCardIds]);

  const orderedCards = useMemo(() => {
    if (!order.length) return selectedCards;
    const map = new Map(selectedCards.map((card) => [card.id, card]));
    const arranged = order.map((id) => map.get(id)).filter(Boolean) as SnapshotCard[];
    const remaining = selectedCards.filter((card) => !order.includes(card.id));
    return [...arranged, ...remaining];
  }, [order, selectedCards]);

  const cardsByModule = useMemo(() => {
    const groups = new Map<string, SnapshotCard[]>();
    for (const card of availableCards) {
      const existing = groups.get(card.module) || [];
      existing.push(card);
      groups.set(card.module, existing);
    }
    return Array.from(groups.entries());
  }, [availableCards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = orderedCards.map((card) => card.id);
    const oldIndex = current.indexOf(active.id as string);
    const newIndex = current.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(current, oldIndex, newIndex);
    setOrder(next);
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
  };

  const toggleCard = (cardId: string) => {
    const activeIds = visibleCardIds && visibleCardIds.length ? visibleCardIds : defaultVisibleIds;
    const isSelected = activeIds.includes(cardId);
    const next = isSelected ? activeIds.filter((id) => id !== cardId) : [...activeIds, cardId];
    setVisibleCardIds(next);
  };

  const resetDashboard = () => {
    setVisibleCardIds(defaultVisibleIds);
    setOrder([]);
    try {
      localStorage.removeItem(ORDER_STORAGE_KEY);
      localStorage.setItem(VISIBLE_STORAGE_KEY, JSON.stringify(defaultVisibleIds));
    } catch {
      // ignore storage failures
    }
  };

  const shellClass = isDarkMode
    ? "border-slate-800 bg-slate-950/70 text-slate-100 shadow-black/20"
    : "border-slate-100 bg-white text-slate-900 shadow-slate-200/60";
  const subtlePanelClass = isDarkMode
    ? "border-slate-800 bg-slate-900/80 text-slate-200"
    : "border-slate-200 bg-slate-50/90 text-slate-700";
  const cardBaseClass = isDarkMode
    ? "border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:shadow-xl hover:shadow-black/20"
    : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-md";

  return (
    <div className="space-y-7">
      <section className={`rounded-[2rem] border p-6 shadow-sm md:p-7 ${shellClass}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
              <LayoutDashboard size={14} />
              Custom Dashboard
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Your home board</h2>
              <p className={`mt-1 max-w-2xl text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Mix cards from Den, Pulse, and shared tools. Pick what you want to see, then drag cards into the order that fits your day.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomizeOpen((open) => !open)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                isDarkMode
                  ? "border-sky-400/25 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
                  : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
              }`}
            >
              <Settings2 size={15} />
              Customize cards
            </button>
            <button
              type="button"
              onClick={resetDashboard}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                isDarkMode
                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Reset layout
            </button>
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${subtlePanelClass}`}>
              <Move size={14} />
              Drag cards to reorder
            </div>
          </div>
        </div>
        {customizeOpen && (
          <div className={`mt-5 rounded-3xl border p-5 ${subtlePanelClass}`}>
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold">Choose dashboard cards</div>
                <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Turn cards on or off by module. Your selection is saved on this device.
                </div>
              </div>
              <div className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {selectedCards.length} visible
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {cardsByModule.map(([moduleName, moduleCards]) => (
                <div
                  key={moduleName}
                  className={`rounded-2xl border p-4 ${isDarkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-white"}`}
                >
                  <div className="mb-3 text-sm font-semibold">{moduleName}</div>
                  <div className="space-y-2">
                    {moduleCards.map((card) => {
                      const selected = selectedCards.some((visibleCard) => visibleCard.id === card.id);
                      return (
                        <label
                          key={card.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2 transition-colors ${
                            selected
                              ? isDarkMode
                                ? "border-sky-400/25 bg-sky-500/10"
                                : "border-sky-200 bg-sky-50"
                              : isDarkMode
                                ? "border-slate-800 bg-slate-950/50"
                                : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleCard(card.id)}
                            className="mt-1 h-4 w-4 rounded border-slate-300"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{card.title}</span>
                            <span className={`block text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                              {card.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {orderedCards.length === 0 ? (
        <section className={`rounded-[2rem] border p-10 text-center ${shellClass}`}>
          <div className="mx-auto max-w-md">
            <div className="text-lg font-semibold">No cards selected</div>
            <p className={`mt-2 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Open Customize cards and turn on the modules you want in your dashboard.
            </p>
          </div>
        </section>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedCards.map((card) => card.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {orderedCards.map((card) => (
                <SortableCard key={card.id} id={card.id}>
                  <div
                    className={`flex h-full flex-col justify-between rounded-[2rem] border p-5 transition-all duration-200 ${cardBaseClass}`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedCardId((current) => (current === card.id ? null : card.id))}
                      className="w-full cursor-pointer border-0 bg-transparent p-0 text-left"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl border bg-gradient-to-br ${card.accentClass} ${
                              isDarkMode ? "text-slate-950" : ""
                            }`}
                          >
                            {card.icon}
                          </div>
                          <div>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                              {card.module}
                            </div>
                            <div className="text-base font-semibold">{card.title}</div>
                          </div>
                        </div>
                        <ChevronDown
                          size={18}
                          className={`shrink-0 transition-transform duration-200 ${expandedCardId === card.id ? "rotate-180" : ""} ${
                            isDarkMode ? "text-slate-500" : "text-slate-400"
                          }`}
                        />
                      </div>
                      <div className={`mt-4 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                        {card.description}
                      </div>
                      {expandedCardId === card.id && (
                        <div
                          className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                            isDarkMode
                              ? "border-slate-800 bg-slate-900/80 text-slate-300"
                              : "border-slate-200 bg-slate-50/85 text-slate-700"
                          }`}
                        >
                          {card.details}
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      className={`mt-5 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        card.module === "Den"
                          ? isDarkMode
                            ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : card.module === "Pulse"
                            ? isDarkMode
                              ? "bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                              : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                            : isDarkMode
                              ? "bg-slate-100 text-slate-950 hover:bg-white"
                              : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        card.onClick();
                      }}
                    >
                      {card.cta}
                    </button>
                  </div>
                </SortableCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default DashboardOverview;
