import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkAdvertising from "./WorkAdvertising";
import type { AuthUser } from "../types";
import type { SocialPostRecord } from "../services/socialApi";
import { deleteSocialPost, fetchSocialAccounts, fetchSocialPosts } from "../services/socialApi";

vi.mock("../services/socialApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/socialApi")>();
  return {
    ...actual,
    cancelSocialPost: vi.fn(),
    createSocialPost: vi.fn(),
    deleteSocialPost: vi.fn().mockResolvedValue({ ok: true, id: "draft-1" }),
    fetchSocialAccounts: vi.fn(),
    fetchSocialPosts: vi.fn(),
    publishSocialPostNow: vi.fn(),
    scheduleSocialPost: vi.fn(),
    updateSocialPost: vi.fn(),
    uploadSocialAsset: vi.fn(),
  };
});

const authUser: AuthUser = {
  id: "7",
  name: "Owner",
  email: "owner@example.com",
  roles: ["Owner"],
  permissions: [],
  permissionMode: "role",
  tutorialCompletedAt: null,
};

const post = (overrides: Partial<SocialPostRecord>): SocialPostRecord => ({
  id: overrides.id || "post-1",
  title: overrides.title || "Promo",
  caption: overrides.caption || "Caption",
  status: overrides.status || "draft",
  scheduledFor: overrides.scheduledFor === undefined ? "2026-06-06T13:00:00.000Z" : overrides.scheduledFor,
  timezone: "America/New_York",
  linkUrl: "",
  ctaLabel: "LEARN_MORE",
  googleTopicType: "STANDARD",
  googleEventTitle: "",
  googleEventStart: null,
  googleEventEnd: null,
  platforms: ["facebook"],
  platformAccountIds: {},
  asset: null,
  publishedAt: null,
  lastError: "",
  createdByUserId: null,
  updatedByUserId: null,
  createdAt: "2026-06-03T14:00:00.000Z",
  updatedAt: "2026-06-03T14:00:00.000Z",
  jobs: [],
  ...overrides,
});

describe("WorkAdvertising social calendar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-06-06T16:00:00.000Z"));
    vi.mocked(fetchSocialAccounts).mockResolvedValue([]);
    vi.mocked(fetchSocialPosts).mockResolvedValue([
      post({ id: "scheduled-1", title: "Weekend sofa", status: "scheduled", scheduledFor: "2026-06-06T13:00:00.000Z" }),
      post({ id: "draft-1", title: "Recliner draft", status: "draft", scheduledFor: "2026-06-06T15:00:00.000Z" }),
    ]);
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens a day popup from the calendar and deletes a selected post", async () => {
    render(<WorkAdvertising authUser={authUser} onOpenSocialIntegrations={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: /open 2026-06-06: 2 posts/i }));

    const dialog = screen.getByRole("dialog", { name: /june 6 posts/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Weekend sofa")).toBeInTheDocument();
    expect(within(dialog).getByText("Recliner draft")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /delete recliner draft/i }));

    await waitFor(() => expect(deleteSocialPost).toHaveBeenCalledWith("draft-1"));
  });
});
