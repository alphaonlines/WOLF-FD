import { describe, expect, it } from "vitest";
import type { SocialPostRecord } from "../../services/socialApi";
import { buildSocialCalendarDays, getPostDateKey, makeDefaultScheduledLocal } from "./socialCalendar";

const basePost = (overrides: Partial<SocialPostRecord>): SocialPostRecord => ({
  id: overrides.id || "post-1",
  title: overrides.title || "Test post",
  caption: overrides.caption || "Caption",
  status: overrides.status || "draft",
  scheduledFor: overrides.scheduledFor === undefined ? null : overrides.scheduledFor,
  timezone: "America/New_York",
  linkUrl: "",
  ctaLabel: "LEARN_MORE",
  googleTopicType: "STANDARD",
  googleEventTitle: "",
  googleEventStart: null,
  googleEventEnd: null,
  platforms: overrides.platforms || ["facebook"],
  platformAccountIds: {},
  asset: null,
  publishedAt: null,
  lastError: "",
  createdByUserId: null,
  updatedByUserId: null,
  createdAt: overrides.createdAt || "2026-06-03T14:00:00.000Z",
  updatedAt: overrides.updatedAt || "2026-06-03T14:00:00.000Z",
  jobs: [],
  ...overrides,
});

describe("social calendar helpers", () => {
  it("groups scheduled posts onto the clicked local day and counts statuses", () => {
    const days = buildSocialCalendarDays(
      [
        basePost({ id: "scheduled-1", status: "scheduled", scheduledFor: "2026-06-06T13:00:00.000Z" }),
        basePost({ id: "draft-1", status: "draft", scheduledFor: "2026-06-06T16:00:00.000Z" }),
        basePost({ id: "published-1", status: "published", scheduledFor: "2026-06-07T16:00:00.000Z" }),
      ],
      new Date("2026-06-15T12:00:00.000Z"),
      new Date("2026-06-06T12:00:00.000Z")
    );

    const juneSix = days.find((day) => day.dateKey === "2026-06-06");
    expect(juneSix?.posts.map((post) => post.id)).toEqual(["scheduled-1", "draft-1"]);
    expect(juneSix?.counts).toMatchObject({ total: 2, scheduled: 1, draft: 1, published: 0, failed: 0 });
    expect(juneSix?.isToday).toBe(true);
  });

  it("uses createdAt as the calendar date for unscheduled drafts", () => {
    expect(getPostDateKey(basePost({ scheduledFor: null, createdAt: "2026-06-09T10:30:00.000Z" }))).toBe("2026-06-09");
  });

  it("pre-fills a new day post at 9 AM local time", () => {
    expect(makeDefaultScheduledLocal("2026-06-10")).toBe("2026-06-10T09:00");
  });
});
