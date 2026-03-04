import type {
  Platform,
  PlatformFilter,
  PostRecord,
  Summary,
} from "./types";

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const safeNum = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null) return 0;
  const cleaned = String(value).replace(/,/g, "").replace(/\$/g, "").trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === "lifetime") return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;

  const [, mm, dd, yyyy, hh = "0", min = "0"] = match;
  const parsed = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min),
    0,
    0
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDayKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const platformMatch = (platform: Platform, filter: PlatformFilter): boolean => {
  if (filter === "both") return true;
  if (filter === "facebook") return platform === "Facebook";
  return platform === "Instagram";
};

export const normalizePostType = (postType: string): string => {
  const value = postType.toLowerCase();
  if (value.includes("reel") || value.includes("video")) return "Reel/Video";
  if (value.includes("carousel") || value.includes("album")) return "Carousel";
  if (value.includes("photo") || value.includes("image")) return "Photo";
  return postType || "Post";
};

export const durationBucket = (seconds: number): string => {
  if (seconds <= 10) return "0-10s";
  if (seconds <= 20) return "11-20s";
  if (seconds <= 30) return "21-30s";
  if (seconds <= 60) return "31-60s";
  return "60s+";
};

export const formatCompact = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
};

export const formatDelta = (current: number, previous: number): string => {
  if (previous <= 0) return "n/a";
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
};

export const buildPostFromRow = (row: Record<string, unknown>, fallbackId: string): PostRecord | null => {
  const hasInstagramHints = Boolean(row["Account ID"] || row["Account username"]);
  const platform: Platform = hasInstagramHints ? "Instagram" : "Facebook";

  const publishTime = parseDate(row["Publish time"]) ?? parseDate(row.Date);
  if (!publishTime) return null;

  const titleSource = platform === "Facebook" ? row.Title ?? row.Description : row.Description;
  const description = String(row.Description ?? row.Title ?? "").replace(/\s+/g, " ").trim();
  const title = String(titleSource ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  const likes = safeNum(platform === "Instagram" ? row.Likes : row.Reactions);
  const comments = safeNum(row.Comments);
  const shares = safeNum(row.Shares);
  const engagements = safeNum(row["Reactions, Comments and Shares"]) || likes + comments + shares;
  const reach = safeNum(row.Reach);
  const views = safeNum(row.Views);
  const linkClicks = safeNum(row["Link Clicks"]);
  const totalClicks = safeNum(row["Total clicks"]) || linkClicks;

  const dayKey = formatDayKey(publishTime);

  return {
    id: String(row["Post ID"] ?? fallbackId),
    platform,
    title: title || `${platform} post ${fallbackId}`,
    description,
    permalink: String(row.Permalink ?? "").trim(),
    postType: String(row["Post type"] ?? "Post").trim() || "Post",
    durationSec: safeNum(row["Duration (sec)"]),
    publishTime,
    dayKey,
    dayLabel: publishTime.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    dayOfWeek: publishTime.getDay(),
    hour: publishTime.getHours(),
    reach,
    views,
    likes,
    comments,
    shares,
    saves: safeNum(row.Saves),
    follows: safeNum(row.Follows),
    linkClicks,
    totalClicks,
    engagements,
    engagementRate: reach > 0 ? (engagements / reach) * 100 : 0,
    captionLength: description.length,
  };
};

export const dedupePosts = (records: PostRecord[]): PostRecord[] => {
  const map = new Map<string, PostRecord>();
  for (const record of records) {
    const key = `${record.platform}:${record.id}:${record.publishTime.toISOString()}`;
    if (!map.has(key)) {
      map.set(key, record);
    }
  }
  return Array.from(map.values());
};

export const summarize = (records: PostRecord[]): Summary => {
  const totals = records.reduce(
    (acc, post) => {
      acc.reach += post.reach;
      acc.views += post.views;
      acc.engagements += post.engagements;
      acc.linkClicks += post.linkClicks;
      acc.saves += post.saves;
      acc.follows += post.follows;
      return acc;
    },
    { reach: 0, views: 0, engagements: 0, linkClicks: 0, saves: 0, follows: 0 }
  );

  return {
    ...totals,
    engagementRate: totals.reach > 0 ? (totals.engagements / totals.reach) * 100 : 0,
  };
};

export const makeDemoPosts = (): PostRecord[] => {
  const seed = [
    {
      id: "ig-1001",
      platform: "Instagram" as Platform,
      title: "Weekend Sofa Promo",
      description: "Big savings and fast delivery on in-stock sectionals this weekend.",
      postType: "Reel",
      publishTime: "2026-01-02T10:30:00",
      durationSec: 14,
      reach: 6400,
      views: 9120,
      likes: 411,
      comments: 64,
      shares: 72,
      saves: 103,
      follows: 27,
      linkClicks: 0,
      totalClicks: 0,
      permalink: "#",
    },
    {
      id: "ig-1002",
      platform: "Instagram" as Platform,
      title: "Bedroom Refresh Reel",
      description: "Three fast style upgrades for a calmer bedroom setup.",
      postType: "Reel",
      publishTime: "2026-01-05T12:10:00",
      durationSec: 19,
      reach: 5200,
      views: 7740,
      likes: 322,
      comments: 37,
      shares: 58,
      saves: 96,
      follows: 22,
      linkClicks: 0,
      totalClicks: 0,
      permalink: "#",
    },
    {
      id: "fb-4001",
      platform: "Facebook" as Platform,
      title: "Tax Refund Event",
      description: "Use your tax refund to upgrade your living room with limited-time bundles.",
      postType: "Photos",
      publishTime: "2026-01-07T15:20:00",
      durationSec: 0,
      reach: 8100,
      views: 4600,
      likes: 182,
      comments: 44,
      shares: 31,
      saves: 0,
      follows: 0,
      linkClicks: 198,
      totalClicks: 356,
      permalink: "#",
    },
    {
      id: "fb-4002",
      platform: "Facebook" as Platform,
      title: "Delivery Window Update",
      description: "New same-week delivery slots are open for bedroom and dining sets.",
      postType: "Photos",
      publishTime: "2026-01-10T09:40:00",
      durationSec: 0,
      reach: 6900,
      views: 3810,
      likes: 144,
      comments: 28,
      shares: 19,
      saves: 0,
      follows: 0,
      linkClicks: 132,
      totalClicks: 241,
      permalink: "#",
    },
    {
      id: "ig-1003",
      platform: "Instagram" as Platform,
      title: "Mattress Comfort Test",
      description: "See pressure relief differences in under 30 seconds.",
      postType: "Reel",
      publishTime: "2026-01-12T18:05:00",
      durationSec: 28,
      reach: 7400,
      views: 11280,
      likes: 463,
      comments: 71,
      shares: 81,
      saves: 122,
      follows: 31,
      linkClicks: 0,
      totalClicks: 0,
      permalink: "#",
    },
    {
      id: "fb-4003",
      platform: "Facebook" as Platform,
      title: "Manager Special: Recliners",
      description: "This week only: premium recliners with free setup.",
      postType: "Video",
      publishTime: "2026-01-14T13:00:00",
      durationSec: 42,
      reach: 9300,
      views: 6220,
      likes: 257,
      comments: 66,
      shares: 47,
      saves: 0,
      follows: 0,
      linkClicks: 246,
      totalClicks: 417,
      permalink: "#",
    },
    {
      id: "ig-1004",
      platform: "Instagram" as Platform,
      title: "Clearance Carousel",
      description: "Swipe through final markdowns across living, dining, and bedroom.",
      postType: "Carousel",
      publishTime: "2026-01-17T11:25:00",
      durationSec: 0,
      reach: 4800,
      views: 5100,
      likes: 289,
      comments: 41,
      shares: 33,
      saves: 77,
      follows: 16,
      linkClicks: 0,
      totalClicks: 0,
      permalink: "#",
    },
    {
      id: "fb-4004",
      platform: "Facebook" as Platform,
      title: "Presidents Day Preview",
      description: "Early access event starts now. Shop before inventory shifts.",
      postType: "Photos",
      publishTime: "2026-01-20T16:10:00",
      durationSec: 0,
      reach: 9700,
      views: 5440,
      likes: 214,
      comments: 53,
      shares: 49,
      saves: 0,
      follows: 0,
      linkClicks: 292,
      totalClicks: 466,
      permalink: "#",
    },
    {
      id: "ig-1005",
      platform: "Instagram" as Platform,
      title: "Styled Living Room Shot",
      description: "Neutral tones + texture layering for cozy winter setups.",
      postType: "Photo",
      publishTime: "2026-01-23T09:15:00",
      durationSec: 0,
      reach: 4300,
      views: 3890,
      likes: 248,
      comments: 26,
      shares: 21,
      saves: 69,
      follows: 14,
      linkClicks: 0,
      totalClicks: 0,
      permalink: "#",
    },
    {
      id: "fb-4005",
      platform: "Facebook" as Platform,
      title: "Same Day Pickup",
      description: "Need it now? Check same-day pickup inventory by location.",
      postType: "Photos",
      publishTime: "2026-01-26T14:45:00",
      durationSec: 0,
      reach: 7600,
      views: 4280,
      likes: 163,
      comments: 35,
      shares: 29,
      saves: 0,
      follows: 0,
      linkClicks: 211,
      totalClicks: 338,
      permalink: "#",
    },
    {
      id: "ig-1006",
      platform: "Instagram" as Platform,
      title: "Quick Delivery Story Clip",
      description: "From showroom floor to your home in days, not weeks.",
      postType: "Reel",
      publishTime: "2026-01-29T19:10:00",
      durationSec: 12,
      reach: 5600,
      views: 8450,
      likes: 346,
      comments: 52,
      shares: 64,
      saves: 109,
      follows: 24,
      linkClicks: 0,
      totalClicks: 0,
      permalink: "#",
    },
  ];

  return seed.map((post) => {
    const publishTime = new Date(post.publishTime);
    const engagements = post.likes + post.comments + post.shares;
    const dayKey = formatDayKey(publishTime);
    return {
      ...post,
      publishTime,
      engagements,
      engagementRate: post.reach > 0 ? (engagements / post.reach) * 100 : 0,
      dayKey,
      dayLabel: publishTime.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      dayOfWeek: publishTime.getDay(),
      hour: publishTime.getHours(),
      captionLength: post.description.length,
    };
  });
};

export const demoPosts = makeDemoPosts();
