import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Calendar,
  FileUp,
  Filter,
  Flame,
  LayoutList,
  LineChart as LineChartIcon,
  Search,
  Sparkles,
  Star,
  Tag,
  UploadCloud,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import type {
  PendingUpload,
  PlatformFilter,
  PostRecord,
  TabKey,
  TrendMetric,
} from "./workAdvertising/types";
import {
  buildPostFromRow,
  DAY_NAMES,
  dedupePosts,
  demoPosts,
  durationBucket,
  formatCompact,
  formatDayKey,
  formatDelta,
  normalizePostType,
  platformMatch,
  summarize,
} from "./workAdvertising/utils";

const WorkAdvertising: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [allPosts, setAllPosts] = useState<PostRecord[]>(demoPosts);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("both");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [topPerformersOnly, setTopPerformersOnly] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [combineUpload, setCombineUpload] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [postMeta, setPostMeta] = useState<Record<string, { tags: string; notes: string }>>({});
  const [trendMetrics, setTrendMetrics] = useState<Record<TrendMetric, boolean>>({
    reach: true,
    engagements: true,
    engagementRate: false,
    views: true,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const globalRange = useMemo(() => {
    if (!allPosts.length) return { min: "", max: "" };
    const keys = allPosts.map((post) => post.dayKey).sort();
    return { min: keys[0], max: keys[keys.length - 1] };
  }, [allPosts]);

  useEffect(() => {
    if (!globalRange.min || !globalRange.max) return;
    setStartDate((current) => (current ? current : globalRange.min));
    setEndDate((current) => (current ? current : globalRange.max));
  }, [globalRange.min, globalRange.max]);

  const typeOptions = useMemo(() => {
    const types = new Set<string>();
    for (const post of allPosts) {
      types.add(normalizePostType(post.postType));
    }
    return Array.from(types).sort();
  }, [allPosts]);

  const nonDateFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPosts.filter((post) => {
      if (!platformMatch(post.platform, platformFilter)) return false;
      if (typeFilter !== "all" && normalizePostType(post.postType) !== typeFilter) return false;
      if (q) {
        const text = `${post.title} ${post.description}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [allPosts, platformFilter, typeFilter, searchQuery]);

  const baseFiltered = useMemo(() => {
    return nonDateFiltered.filter((post) => {
      if (startDate && post.dayKey < startDate) return false;
      if (endDate && post.dayKey > endDate) return false;
      return true;
    });
  }, [nonDateFiltered, startDate, endDate]);

  const averageEngagementRate = useMemo(() => {
    if (!baseFiltered.length) return 0;
    const total = baseFiltered.reduce((sum, post) => sum + post.engagementRate, 0);
    return total / baseFiltered.length;
  }, [baseFiltered]);

  const filteredPosts = useMemo(() => {
    const sorted = [...baseFiltered].sort((a, b) => b.publishTime.getTime() - a.publishTime.getTime());
    if (!topPerformersOnly) return sorted;
    return sorted.filter((post) => post.engagementRate >= averageEngagementRate);
  }, [baseFiltered, topPerformersOnly, averageEngagementRate]);

  const periodDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return Math.max(diff, 1);
  }, [startDate, endDate]);

  const previousRange = useMemo(() => {
    if (!startDate || !periodDays) return null;
    const start = new Date(`${startDate}T12:00:00`);
    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - (periodDays - 1));
    return {
      start: formatDayKey(previousStart),
      end: formatDayKey(previousEnd),
    };
  }, [startDate, periodDays]);

  const previousPosts = useMemo(() => {
    if (!previousRange) return [] as PostRecord[];
    const records = nonDateFiltered.filter((post) => {
      if (post.dayKey < previousRange.start) return false;
      if (post.dayKey > previousRange.end) return false;
      return true;
    });
    if (!topPerformersOnly) return records;
    const prevAvg = records.length
      ? records.reduce((sum, post) => sum + post.engagementRate, 0) / records.length
      : 0;
    return records.filter((post) => post.engagementRate >= prevAvg);
  }, [nonDateFiltered, previousRange, topPerformersOnly]);

  const currentSummary = useMemo(() => summarize(filteredPosts), [filteredPosts]);
  const previousSummary = useMemo(() => summarize(previousPosts), [previousPosts]);

  const dayKeysInRange = useMemo(() => {
    if (startDate && endDate) {
      const keys: string[] = [];
      const cursor = new Date(`${startDate}T12:00:00`);
      const end = new Date(`${endDate}T12:00:00`);
      while (cursor.getTime() <= end.getTime()) {
        keys.push(formatDayKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return keys;
    }
    return Array.from(new Set(filteredPosts.map((post) => post.dayKey))).sort();
  }, [filteredPosts, startDate, endDate]);

  const trendsData = useMemo(() => {
    return dayKeysInRange.map((key) => {
      const dayPosts = filteredPosts.filter((post) => post.dayKey === key);
      const daySummary = summarize(dayPosts);
      const topPost = [...dayPosts].sort((a, b) => b.engagements - a.engagements)[0];
      const date = new Date(`${key}T12:00:00`);
      return {
        key,
        day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        reach: Math.round(daySummary.reach),
        engagements: Math.round(daySummary.engagements),
        engagementRate: Number(daySummary.engagementRate.toFixed(2)),
        views: Math.round(daySummary.views),
        topPostTitle: topPost ? topPost.title : "No posts",
      };
    });
  }, [dayKeysInRange, filteredPosts]);

  const topPosts = useMemo(() => {
    return [...filteredPosts]
      .sort((a, b) => b.engagements - a.engagements)
      .slice(0, 20);
  }, [filteredPosts]);

  const benchmark = useMemo(() => {
    if (!filteredPosts.length) {
      return {
        shares: 0,
        saves: 0,
        views: 0,
        clicks: 0,
        engagementRate: 0,
      };
    }
    const total = filteredPosts.reduce(
      (acc, post) => {
        acc.shares += post.shares;
        acc.saves += post.saves;
        acc.views += post.views;
        acc.clicks += post.linkClicks;
        acc.engagementRate += post.engagementRate;
        return acc;
      },
      { shares: 0, saves: 0, views: 0, clicks: 0, engagementRate: 0 }
    );

    const count = filteredPosts.length;
    return {
      shares: total.shares / count,
      saves: total.saves / count,
      views: total.views / count,
      clicks: total.clicks / count,
      engagementRate: total.engagementRate / count,
    };
  }, [filteredPosts]);

  const getWhyWorkedTags = useCallback(
    (post: PostRecord): string[] => {
      const tags: string[] = [];
      if (post.shares >= benchmark.shares * 1.35 && post.shares > 0) tags.push("High share rate");
      if (post.saves >= benchmark.saves * 1.35 && post.saves > 0) tags.push("Strong saves");
      if (post.views >= benchmark.views * 1.3 && post.durationSec > 0) tags.push("Above avg watch time");
      if (post.linkClicks >= benchmark.clicks * 1.35 && post.linkClicks > 0) tags.push("Clicks heavy");
      if (post.engagementRate >= benchmark.engagementRate * 1.3 && post.reach < currentSummary.reach / Math.max(filteredPosts.length, 1)) {
        tags.push("Late bloomer");
      }
      return tags.slice(0, 3);
    },
    [benchmark, currentSummary.reach, filteredPosts.length]
  );

  const typeComparison = useMemo(() => {
    const buckets = new Map<string, { count: number; reach: number; engagementRate: number }>();
    for (const post of filteredPosts) {
      const key = normalizePostType(post.postType);
      const current = buckets.get(key) ?? { count: 0, reach: 0, engagementRate: 0 };
      current.count += 1;
      current.reach += post.reach;
      current.engagementRate += post.engagementRate;
      buckets.set(key, current);
    }
    return Array.from(buckets.entries()).map(([type, value]) => ({
      type,
      avgReach: Math.round(value.reach / Math.max(value.count, 1)),
      avgEngagementRate: Number((value.engagementRate / Math.max(value.count, 1)).toFixed(2)),
    }));
  }, [filteredPosts]);

  const durationComparison = useMemo(() => {
    const buckets = new Map<string, { count: number; engagementRate: number }>();
    for (const post of filteredPosts.filter((item) => item.durationSec > 0)) {
      const key = durationBucket(post.durationSec);
      const current = buckets.get(key) ?? { count: 0, engagementRate: 0 };
      current.count += 1;
      current.engagementRate += post.engagementRate;
      buckets.set(key, current);
    }

    const order = ["0-10s", "11-20s", "21-30s", "31-60s", "60s+"];
    return order
      .map((bucket) => {
        const value = buckets.get(bucket);
        return {
          bucket,
          avgEngagementRate: value ? Number((value.engagementRate / value.count).toFixed(2)) : 0,
        };
      })
      .filter((item) => item.avgEngagementRate > 0);
  }, [filteredPosts]);

  const funnelData = useMemo(() => {
    const intentValue =
      platformFilter === "instagram"
        ? currentSummary.follows + currentSummary.saves
        : currentSummary.linkClicks;
    const intentLabel = platformFilter === "instagram" ? "Follows + Saves" : "Link Clicks";
    return [
      { stage: "Reach", value: currentSummary.reach },
      { stage: "Engagement", value: currentSummary.engagements },
      { stage: intentLabel, value: intentValue },
    ];
  }, [currentSummary, platformFilter]);

  const heatMap = useMemo(() => {
    const matrix = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ total: 0, count: 0 }))
    );

    for (const post of filteredPosts) {
      const slot = matrix[post.dayOfWeek][post.hour];
      slot.total += post.engagementRate;
      slot.count += 1;
    }

    return matrix.map((row) => row.map((cell) => (cell.count ? cell.total / cell.count : 0)));
  }, [filteredPosts]);

  const heatMax = useMemo(() => {
    return heatMap.reduce((max, row) => {
      const localMax = row.reduce((a, b) => Math.max(a, b), 0);
      return Math.max(max, localMax);
    }, 0);
  }, [heatMap]);

  const recommendations = useMemo(() => {
    if (filteredPosts.length < 4) {
      return ["Upload a little more data to unlock recommendation rules."];
    }

    const insights: string[] = [];

    const short = filteredPosts.filter((post) => post.captionLength > 0 && post.captionLength <= 120);
    const long = filteredPosts.filter((post) => post.captionLength > 120);
    if (short.length >= 2 && long.length >= 2) {
      const shortEr = short.reduce((sum, post) => sum + post.engagementRate, 0) / short.length;
      const longEr = long.reduce((sum, post) => sum + post.engagementRate, 0) / long.length;
      if (shortEr > longEr * 1.12) {
        insights.push(`Posts under 120 chars are outperforming longer captions by ${(shortEr - longEr).toFixed(1)} engagement-rate points.`);
      }
    }

    const wedToFri = filteredPosts.filter((post) => [3, 4, 5].includes(post.dayOfWeek));
    const monday = filteredPosts.filter((post) => post.dayOfWeek === 1);
    if (wedToFri.length >= 2 && monday.length >= 2) {
      const wedFriReach = wedToFri.reduce((sum, post) => sum + post.reach, 0) / wedToFri.length;
      const mondayReach = monday.reduce((sum, post) => sum + post.reach, 0) / monday.length;
      if (wedFriReach > mondayReach * 1.15) {
        insights.push(`Wed-Fri posts are averaging ${Math.round(wedFriReach - mondayReach)} more reach than Monday posts.`);
      }
    }

    const priceLanguage = filteredPosts.filter((post) => /sale|off|%|clearance|deal|save/i.test(`${post.title} ${post.description}`));
    const plainLanguage = filteredPosts.filter((post) => !/sale|off|%|clearance|deal|save/i.test(`${post.title} ${post.description}`));
    if (priceLanguage.length >= 2 && plainLanguage.length >= 2) {
      const promoClicks = priceLanguage.reduce((sum, post) => sum + post.linkClicks, 0) / priceLanguage.length;
      const plainClicks = plainLanguage.reduce((sum, post) => sum + post.linkClicks, 0) / plainLanguage.length;
      if (promoClicks > plainClicks * 1.2) {
        insights.push(`Pricing language is driving stronger click intent (+${(promoClicks - plainClicks).toFixed(1)} link clicks per post).`);
      }
    }

    return insights.length ? insights : ["No strong pattern yet. Keep uploading monthly exports to improve recommendations."];
  }, [filteredPosts]);

  const campaignData = useMemo(() => {
    const groups = new Map<string, PostRecord[]>();

    for (const post of filteredPosts) {
      const rawTags = postMeta[post.id]?.tags ?? "";
      const tags = rawTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      for (const tag of tags) {
        const current = groups.get(tag) ?? [];
        current.push(post);
        groups.set(tag, current);
      }
    }

    return Array.from(groups.entries())
      .map(([name, posts]) => {
        const summary = summarize(posts);
        const best = [...posts].sort((a, b) => b.engagementRate - a.engagementRate)[0];
        return {
          name,
          posts: posts.length,
          reach: summary.reach,
          engagements: summary.engagements,
          bestPost: best?.title ?? "",
        };
      })
      .sort((a, b) => b.reach - a.reach);
  }, [filteredPosts, postMeta]);

  const selectedPost = useMemo(() => {
    if (!selectedPostId) return null;
    return allPosts.find((post) => post.id === selectedPostId) ?? null;
  }, [allPosts, selectedPostId]);

  const updateSelectedPostMeta = (field: "tags" | "notes", value: string) => {
    if (!selectedPost) return;
    setPostMeta((current) => {
      const existing = current[selectedPost.id] ?? { tags: "", notes: "" };
      return {
        ...current,
        [selectedPost.id]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const parseUploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const parsed: PostRecord[] = [];

      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        rows.forEach((row, index) => {
          const mapped = buildPostFromRow(row, `${file.name}-${index}`);
          if (mapped) parsed.push(mapped);
        });
      }

      const deduped = dedupePosts(parsed);
      const missingPermalink = deduped.filter((post) => !post.permalink).length;
      const fileNames = files.map((file) => file.name);
      const platforms = Array.from(new Set(deduped.map((post) => post.platform)));

      let rangeLabel = "No valid dates found";
      if (deduped.length) {
        const keys = deduped.map((post) => post.dayKey).sort();
        rangeLabel = `${keys[0]} to ${keys[keys.length - 1]}`;
      }

      const existingRange = allPosts.length
        ? {
            min: allPosts.map((post) => post.dayKey).sort()[0],
            max: allPosts.map((post) => post.dayKey).sort().slice(-1)[0],
          }
        : null;

      const overlap = Boolean(
        existingRange &&
          deduped.length &&
          deduped.some((post) => post.dayKey >= existingRange.min && post.dayKey <= existingRange.max)
      );

      setPendingUpload({
        records: deduped,
        fileNames,
        platforms,
        rangeLabel,
        issues: {
          missingPermalink,
          duplicates: parsed.length - deduped.length,
          overlap,
        },
      });
      setActiveTab("upload");
    },
    [allPosts]
  );

  const applyUpload = () => {
    if (!pendingUpload) return;
    const next = combineUpload ? dedupePosts([...allPosts, ...pendingUpload.records]) : pendingUpload.records;
    setAllPosts(next);
    setPendingUpload(null);
  };

  const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files).filter((file) => file.name.toLowerCase().endsWith(".csv"));
    await parseUploadFiles(files);
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.name.toLowerCase().endsWith(".csv"));
    await parseUploadFiles(files);
    event.target.value = "";
  };

  const toggleTrendMetric = (metric: TrendMetric) => {
    setTrendMetrics((current) => {
      const activeCount = Object.values(current).filter(Boolean).length;
      if (current[metric] && activeCount === 1) return current;
      return { ...current, [metric]: !current[metric] };
    });
  };

  const kpis = [
    {
      label: "Reach",
      value: formatCompact(currentSummary.reach),
      delta: formatDelta(currentSummary.reach, previousSummary.reach),
    },
    {
      label: "Views / Plays",
      value: formatCompact(currentSummary.views),
      delta: formatDelta(currentSummary.views, previousSummary.views),
    },
    {
      label: "Engagements",
      value: formatCompact(currentSummary.engagements),
      delta: formatDelta(currentSummary.engagements, previousSummary.engagements),
    },
    {
      label: "Engagement Rate",
      value: `${currentSummary.engagementRate.toFixed(2)}%`,
      delta: formatDelta(currentSummary.engagementRate, previousSummary.engagementRate),
    },
    {
      label: "Link Clicks",
      value: formatCompact(currentSummary.linkClicks),
      delta: formatDelta(currentSummary.linkClicks, previousSummary.linkClicks),
    },
    {
      label: "Saves",
      value: formatCompact(currentSummary.saves),
      delta: formatDelta(currentSummary.saves, previousSummary.saves),
    },
    {
      label: "Follows Gained",
      value: formatCompact(currentSummary.follows),
      delta: formatDelta(currentSummary.follows, previousSummary.follows),
    },
  ];

  const heatColor = (value: number): string => {
    if (value <= 0 || heatMax <= 0) return "rgba(148, 163, 184, 0.18)";
    const intensity = Math.min(value / heatMax, 1);
    const alpha = 0.22 + intensity * 0.72;
    return `rgba(15,118,110,${alpha.toFixed(2)})`;
  };

  const metricButtons: Array<{ key: TrendMetric; label: string }> = [
    { key: "reach", label: "Reach" },
    { key: "engagements", label: "Engagements" },
    { key: "engagementRate", label: "Engagement rate" },
    { key: "views", label: "Views" },
  ];

  const renderTabButton = (key: TabKey, label: string, icon: React.ReactNode) => (
    <button
      key={key}
      type="button"
      onClick={() => setActiveTab(key)}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        activeTab === key
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Social Media Command Center</div>
            <h2 className="text-2xl font-semibold text-slate-900">Social Posts Planner</h2>
            <p className="text-sm text-slate-500">
              Premium front-end analytics: upload exports, track trends, and spot what content converts.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <UploadCloud size={16} /> Upload Data
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
            >
              <FileUp size={16} /> Quick CSV Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Date Range</div>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <Calendar size={14} />
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="bg-transparent outline-none"
                />
              </label>
              <span className="text-xs text-slate-400">to</span>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <Calendar size={14} />
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="bg-transparent outline-none"
                />
              </label>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Compared to previous {periodDays || 0} day{periodDays === 1 ? "" : "s"}.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Platform View</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { key: "both", label: "Both" },
                { key: "facebook", label: "Facebook" },
                { key: "instagram", label: "Instagram" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPlatformFilter(item.key as PlatformFilter)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    platformFilter === item.key
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto_auto]">
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <Filter size={14} />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="w-full bg-transparent outline-none"
            >
              <option value="all">All post types</option>
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <Search size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search titles or captions"
              className="w-full bg-transparent outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => setTopPerformersOnly((current) => !current)}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              topPerformersOnly
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Flame size={14} />
            Only top performers
          </button>

          <button
            type="button"
            onClick={() => {
              setTypeFilter("all");
              setSearchQuery("");
              setTopPerformersOnly(false);
            }}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">{kpi.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{kpi.value}</div>
            <div className="mt-2 text-xs text-slate-500">{kpi.delta} vs previous period</div>
          </div>
        ))}
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
        <div className="flex flex-wrap gap-2">
          {renderTabButton("overview", "Overview", <Sparkles size={15} />)}
          {renderTabButton("trends", "Trends", <LineChartIcon size={15} />)}
          {renderTabButton("library", "Content Library", <LayoutList size={15} />)}
          {renderTabButton("timing", "Timing & Insights", <BarChart3 size={15} />)}
          {renderTabButton("campaigns", "Campaigns", <Tag size={15} />)}
          {renderTabButton("upload", "Upload & Data", <UploadCloud size={15} />)}
        </div>
      </section>

      {activeTab === "overview" && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Reach + Engagement Trend</h3>
              <span className="text-xs text-slate-500">Hover to see the top post that day</span>
            </div>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0].payload as {
                        topPostTitle: string;
                        reach: number;
                        engagements: number;
                      };
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg">
                          <div className="font-semibold text-slate-900">{label}</div>
                          <div className="mt-1 text-slate-600">Reach: {point.reach.toLocaleString()}</div>
                          <div className="text-slate-600">Engagements: {point.engagements.toLocaleString()}</div>
                          <div className="mt-2 text-slate-500">Top post: {point.topPostTitle}</div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="reach" stroke="#0f172a" strokeWidth={2} dot={false} name="Reach" />
                  <Line
                    type="monotone"
                    dataKey="engagements"
                    stroke="#0d9488"
                    strokeWidth={2}
                    dot={false}
                    name="Engagements"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Stars Leaderboard</h4>
                <Star size={15} className="text-amber-500" />
              </div>
              <div className="mt-3 space-y-3">
                {topPosts.slice(0, 5).map((post, index) => (
                  <button
                    key={`${post.id}-${index}`}
                    type="button"
                    onClick={() => {
                      setSelectedPostId(post.id);
                      setActiveTab("library");
                    }}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-slate-300"
                  >
                    <div className="text-xs text-slate-500">#{index + 1} · {post.platform}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{post.title}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {post.engagements.toLocaleString()} engagements · {post.engagementRate.toFixed(2)}% ER
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Intent Funnel</h4>
                <BarChart3 size={15} className="text-slate-500" />
              </div>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "trends" && (
        <section className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Metric Trends Over Time</h3>
              <div className="flex flex-wrap gap-2">
                {metricButtons.map((metric) => (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => toggleTrendMetric(metric.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      trendMetrics[metric.key]
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {trendMetrics.reach && (
                    <Line type="monotone" dataKey="reach" stroke="#0f172a" strokeWidth={2} dot={false} name="Reach" />
                  )}
                  {trendMetrics.engagements && (
                    <Line
                      type="monotone"
                      dataKey="engagements"
                      stroke="#0d9488"
                      strokeWidth={2}
                      dot={false}
                      name="Engagements"
                    />
                  )}
                  {trendMetrics.engagementRate && (
                    <Line
                      type="monotone"
                      dataKey="engagementRate"
                      stroke="#ea580c"
                      strokeWidth={2}
                      dot={false}
                      name="Engagement rate"
                    />
                  )}
                  {trendMetrics.views && (
                    <Line type="monotone" dataKey="views" stroke="#7c3aed" strokeWidth={2} dot={false} name="Views" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
              <h4 className="text-md font-semibold text-slate-900">Content Type Comparison</h4>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgReach" fill="#0f172a" radius={[6, 6, 0, 0]} name="Avg reach" />
                    <Bar dataKey="avgEngagementRate" fill="#0d9488" radius={[6, 6, 0, 0]} name="Avg ER" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
              <h4 className="text-md font-semibold text-slate-900">Video Duration Buckets</h4>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={durationComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="avgEngagementRate" fill="#ea580c" radius={[6, 6, 0, 0]} name="Avg ER" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {durationComparison.length > 0 && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {(() => {
                    const top = [...durationComparison].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];
                    return `${top.bucket} videos are currently your top performer.`;
                  })()}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === "library" && (
        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Top Content Library</h3>
            <span className="text-xs text-slate-500">Click a row to open post detail drawer</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Post</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Reach</th>
                  <th className="py-2 pr-3">Engagements</th>
                  <th className="py-2 pr-3">ER</th>
                  <th className="py-2 pr-3">Clicks</th>
                  <th className="py-2 pr-3">Saves</th>
                  <th className="py-2 pr-3">Follows</th>
                  <th className="py-2">Why it worked</th>
                </tr>
              </thead>
              <tbody>
                {topPosts.map((post) => {
                  const tags = getWhyWorkedTags(post);
                  const barWidth =
                    topPosts.length > 0
                      ? (post.engagements / Math.max(...topPosts.map((item) => item.engagements), 1)) * 100
                      : 0;
                  return (
                    <tr
                      key={`${post.id}-${post.dayKey}`}
                      className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                      onClick={() => setSelectedPostId(post.id)}
                    >
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-900">{post.title}</div>
                        <div className="text-xs text-slate-500">{post.platform}</div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{post.dayKey}</td>
                      <td className="py-3 pr-3 text-slate-600">{normalizePostType(post.postType)}</td>
                      <td className="py-3 pr-3 text-slate-600">{post.reach.toLocaleString()}</td>
                      <td className="py-3 pr-3">
                        <div className="text-slate-600">{post.engagements.toLocaleString()}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                          <div className="h-1.5 rounded-full bg-slate-900" style={{ width: `${barWidth}%` }} />
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{post.engagementRate.toFixed(2)}%</td>
                      <td className="py-3 pr-3 text-slate-600">{post.linkClicks.toLocaleString()}</td>
                      <td className="py-3 pr-3 text-slate-600">{post.saves.toLocaleString()}</td>
                      <td className="py-3 pr-3 text-slate-600">{post.follows.toLocaleString()}</td>
                      <td className="py-3 text-slate-600">
                        <div className="flex flex-wrap gap-1">
                          {tags.length ? (
                            tags.map((tag) => (
                              <span
                                key={`${post.id}-${tag}`}
                                className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">No standout rule yet</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "timing" && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900">Best Time to Post Heatmap</h3>
            <p className="text-sm text-slate-500">Day of week vs posting hour (color = average engagement rate)</p>
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[880px] space-y-2">
                <div className="grid grid-cols-[68px_repeat(24,minmax(0,1fr))] gap-1 text-[10px] text-slate-400">
                  <div />
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <div key={`hour-label-${hour}`} className="text-center">
                      {hour}
                    </div>
                  ))}
                </div>
                {heatMap.map((row, day) => (
                  <div key={`day-${DAY_NAMES[day]}`} className="grid grid-cols-[68px_repeat(24,minmax(0,1fr))] gap-1">
                    <div className="flex items-center text-xs font-semibold text-slate-600">{DAY_NAMES[day]}</div>
                    {row.map((value, hour) => (
                      <div
                        key={`cell-${day}-${hour}`}
                        className="h-7 rounded"
                        style={{ backgroundColor: heatColor(value) }}
                        title={`${DAY_NAMES[day]} ${hour}:00 · ${value.toFixed(2)}% avg ER`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <h4 className="text-sm font-semibold text-slate-900">Rule-Based Recommendations</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {recommendations.map((insight, index) => (
                  <div key={`insight-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    {insight}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
              <h4 className="text-sm font-semibold text-slate-900">Stars Scoreboard</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {topPosts.slice(0, 5).map((post) => (
                  <div key={`score-${post.id}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="font-semibold text-slate-900">{post.title}</div>
                    <div className="text-xs text-slate-500">
                      {post.reach.toLocaleString()} reach · {post.comments.toLocaleString()} comments · {post.shares.toLocaleString()} shares
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "campaigns" && (
        <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Campaign Tracking</h3>
            <div className="text-xs text-slate-500">Use post tags in the detail drawer to build campaign rollups</div>
          </div>

          {campaignData.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No campaign tags yet. Open a post from Content Library and add tags like
              <span className="font-semibold"> Presidents Day</span>,
              <span className="font-semibold"> Clearance</span>, or
              <span className="font-semibold"> Tax + Delivery</span>.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {campaignData.map((campaign) => (
                <div key={campaign.name} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">{campaign.name}</h4>
                    <span className="text-xs text-slate-500">{campaign.posts} posts</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">Reach: {campaign.reach.toLocaleString()}</div>
                  <div className="text-xs text-slate-600">Engagements: {campaign.engagements.toLocaleString()}</div>
                  <div className="mt-2 text-xs text-slate-500">Best post: {campaign.bestPost}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "upload" && (
        <section className="space-y-6">
          <div
            className={`rounded-3xl border-2 border-dashed p-8 text-center transition-colors ${
              isDragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            <UploadCloud className="mx-auto text-slate-500" size={30} />
            <h3 className="mt-3 text-lg font-semibold text-slate-900">Upload Social Export CSVs</h3>
            <p className="mt-1 text-sm text-slate-500">
              Drag and drop files here, or choose files manually. We auto-detect platform + date range.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <FileUp size={15} /> Select CSV Files
            </button>
          </div>

          {pendingUpload && (
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="text-md font-semibold text-slate-900">Upload Preview</h4>
                  <div className="mt-1 text-sm text-slate-600">
                    Files: {pendingUpload.fileNames.join(", ")}
                  </div>
                  <div className="text-sm text-slate-600">
                    Platforms: {pendingUpload.platforms.join(", ") || "Unknown"} · Range: {pendingUpload.rangeLabel} · Posts: {pendingUpload.records.length}
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={combineUpload}
                    onChange={(event) => setCombineUpload(event.target.checked)}
                  />
                  Combine with existing data
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Missing permalink</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">{pendingUpload.issues.missingPermalink}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Duplicate rows</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">{pendingUpload.issues.duplicates}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Date overlap</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {pendingUpload.issues.overlap ? "Yes" : "No"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyUpload}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Apply Upload
                </button>
                <button
                  type="button"
                  onClick={() => setPendingUpload(null)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Clear Preview
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {selectedPost && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30">
          <div className="h-full w-full max-w-md bg-white border-l border-slate-200 shadow-xl p-5 overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Post Detail</div>
                <h4 className="text-lg font-semibold text-slate-900">{selectedPost.title}</h4>
                <div className="text-xs text-slate-500">
                  {selectedPost.platform} · {selectedPost.dayKey} · {normalizePostType(selectedPost.postType)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPostId(null)}
                className="rounded-full border border-slate-200 p-1 text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">Reach: {selectedPost.reach.toLocaleString()}</div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                Engagements: {selectedPost.engagements.toLocaleString()}
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">ER: {selectedPost.engagementRate.toFixed(2)}%</div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                Link clicks: {selectedPost.linkClicks.toLocaleString()}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
              {selectedPost.description || "No description captured from export."}
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-xs uppercase tracking-wide text-slate-500">Campaign tags (comma separated)</label>
              <input
                type="text"
                value={postMeta[selectedPost.id]?.tags ?? ""}
                onChange={(event) => updateSelectedPostMeta("tags", event.target.value)}
                placeholder="Presidents Day, Clearance, Lifestyle"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-xs uppercase tracking-wide text-slate-500">Notes</label>
              <textarea
                value={postMeta[selectedPost.id]?.notes ?? ""}
                onChange={(event) => updateSelectedPostMeta("notes", event.target.value)}
                placeholder="Boosted $20, in-store photo, promo language, etc."
                rows={4}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>

            {selectedPost.permalink && (
              <a
                href={selectedPost.permalink}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Open post link
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkAdvertising;
