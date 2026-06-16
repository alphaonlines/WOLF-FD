import type { SocialPostRecord, SocialPostStatus } from "../../services/socialApi";

export type SocialCalendarCounts = {
  total: number;
  draft: number;
  scheduled: number;
  publishing: number;
  published: number;
  failed: number;
};

export type SocialCalendarDay = {
  date: Date;
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  posts: SocialPostRecord[];
  counts: SocialCalendarCounts;
};

const STATUS_KEYS: SocialPostStatus[] = ["draft", "scheduled", "publishing", "published", "failed"];

const pad2 = (value: number) => String(value).padStart(2, "0");

export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const getPostDateKey = (post: Pick<SocialPostRecord, "scheduledFor" | "createdAt">) => {
  const rawDate = post.scheduledFor || post.createdAt;
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? toDateKey(new Date()) : toDateKey(date);
};

export const makeDefaultScheduledLocal = (dateKey: string) => `${dateKey}T09:00`;

export const comparePostsByTime = (a: SocialPostRecord, b: SocialPostRecord) => {
  const aTime = new Date(a.scheduledFor || a.createdAt).getTime();
  const bTime = new Date(b.scheduledFor || b.createdAt).getTime();
  return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
};

const emptyCounts = (): SocialCalendarCounts => ({
  total: 0,
  draft: 0,
  scheduled: 0,
  publishing: 0,
  published: 0,
  failed: 0,
});

const countPosts = (posts: SocialPostRecord[]): SocialCalendarCounts => {
  const counts = emptyCounts();
  counts.total = posts.length;
  for (const post of posts) {
    if (STATUS_KEYS.includes(post.status)) counts[post.status] += 1;
  }
  return counts;
};

export const buildSocialCalendarDays = (
  posts: SocialPostRecord[],
  visibleMonth: Date = new Date(),
  now: Date = new Date()
): SocialCalendarDay[] => {
  const month = Number.isNaN(visibleMonth.getTime()) ? new Date() : visibleMonth;
  const todayKey = toDateKey(Number.isNaN(now.getTime()) ? new Date() : now);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const postsByDay = new Map<string, SocialPostRecord[]>();
  for (const post of posts) {
    const dateKey = getPostDateKey(post);
    const current = postsByDay.get(dateKey) || [];
    current.push(post);
    postsByDay.set(dateKey, current);
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = toDateKey(date);
    const dayPosts = [...(postsByDay.get(dateKey) || [])].sort(comparePostsByTime);
    return {
      date,
      dateKey,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isToday: dateKey === todayKey,
      posts: dayPosts,
      counts: countPosts(dayPosts),
    };
  });
};
