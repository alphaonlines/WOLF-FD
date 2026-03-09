import React, { startTransition, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ImageUp,
  Link as LinkIcon,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import type {
  SocialAccount,
  SocialPlatform,
  SocialPostRecord,
} from "../services/socialApi";
import {
  cancelSocialPost,
  createSocialPost,
  fetchSocialAccounts,
  fetchSocialPosts,
  publishSocialPostNow,
  scheduleSocialPost,
  updateSocialPost,
  uploadSocialAsset,
  upsertSocialAccount,
} from "../services/socialApi";

type ComposerForm = {
  id: string | null;
  title: string;
  caption: string;
  scheduledForLocal: string;
  timezone: string;
  linkUrl: string;
  ctaLabel: string;
  googleTopicType: string;
  googleEventTitle: string;
  googleEventStartLocal: string;
  googleEventEndLocal: string;
  platforms: SocialPlatform[];
  platformAccountIds: Partial<Record<SocialPlatform, string>>;
  asset: {
    id: string;
    originalName: string;
    publicUrl: string;
    assetKind: string;
  } | null;
};

type AccountDraft = {
  draftKey: string;
  id: string | null;
  platform: SocialPlatform;
  label: string;
  externalId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  active: boolean;
};

const PLATFORM_OPTIONS: Array<{ id: SocialPlatform; label: string }> = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "google", label: "Google" },
];

const emptyForm = (): ComposerForm => ({
  id: null,
  title: "",
  caption: "",
  scheduledForLocal: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  linkUrl: "",
  ctaLabel: "LEARN_MORE",
  googleTopicType: "STANDARD",
  googleEventTitle: "",
  googleEventStartLocal: "",
  googleEventEndLocal: "",
  platforms: ["facebook", "instagram"],
  platformAccountIds: {},
  asset: null,
});

const toLocalInputValue = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const fromLocalInputValue = (localValue: string) => {
  if (!localValue) return null;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const formatWhen = (iso: string | null | undefined) => {
  if (!iso) return "Not scheduled";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const defaultAccountIds = (accounts: SocialAccount[]) => {
  const out: Partial<Record<SocialPlatform, string>> = {};
  for (const platform of PLATFORM_OPTIONS.map((item) => item.id)) {
    const preferred = accounts.find((item) => item.platform === platform && item.active) || accounts.find((item) => item.platform === platform);
    if (preferred?.id) out[platform] = preferred.id;
  }
  return out;
};

const makeAccountDrafts = (accounts: SocialAccount[]): AccountDraft[] => {
  const drafts = accounts.map((account) => ({
    draftKey: account.id,
    id: account.id,
    platform: account.platform,
    label: account.label || "",
    externalId: account.externalId || "",
    accessToken: "",
    refreshToken: "",
    tokenExpiresAt: toLocalInputValue(account.tokenExpiresAt || null),
    active: Boolean(account.active),
  }));

  for (const platform of ["facebook", "instagram"] as SocialPlatform[]) {
    if (!drafts.some((draft) => draft.platform === platform)) {
      drafts.push({
        draftKey: `new-${platform}`,
        id: null,
        platform,
        label: "",
        externalId: "",
        accessToken: "",
        refreshToken: "",
        tokenExpiresAt: "",
        active: false,
      });
    }
  }

  if (!drafts.some((draft) => draft.platform === "google")) {
    drafts.push({
      draftKey: "new-google-1",
      id: null,
      platform: "google",
      label: "",
      externalId: "",
      accessToken: "",
      refreshToken: "",
      tokenExpiresAt: "",
      active: false,
    });
  }

  return drafts;
};

const WorkAdvertising: React.FC = () => {
  const [posts, setPosts] = useState<SocialPostRecord[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [accountDrafts, setAccountDrafts] = useState<AccountDraft[]>(() =>
    makeAccountDrafts([])
  );
  const [form, setForm] = useState<ComposerForm>(() => emptyForm());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextPosts, nextAccounts] = await Promise.all([fetchSocialPosts(), fetchSocialAccounts()]);
      startTransition(() => {
        setPosts(nextPosts);
        setAccounts(nextAccounts);
        setAccountDrafts(makeAccountDrafts(nextAccounts));
        setForm((current) => ({
          ...current,
          platformAccountIds: {
            ...defaultAccountIds(nextAccounts),
            ...current.platformAccountIds,
          },
        }));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load social workspace.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (statusFilter !== "all" && post.status !== statusFilter) return false;
      if (platformFilter !== "all" && !post.platforms.includes(platformFilter as SocialPlatform)) return false;
      if (!q) return true;
      return `${post.title} ${post.caption}`.toLowerCase().includes(q);
    });
  }, [posts, platformFilter, query, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: posts.length,
      scheduled: posts.filter((post) => post.status === "scheduled").length,
      published: posts.filter((post) => post.status === "published").length,
      failed: posts.filter((post) => post.status === "failed").length,
    };
  }, [posts]);

  const accountsByPlatform = useMemo(
    () => ({
      facebook: accounts.filter((item) => item.platform === "facebook"),
      instagram: accounts.filter((item) => item.platform === "instagram"),
      google: accounts.filter((item) => item.platform === "google"),
    }),
    [accounts]
  );

  const accountLabelById = useMemo(
    () =>
      new Map(
        accounts.map((account) => [
          account.id,
          account.label || account.externalId || `${account.platform} connection`,
        ])
      ),
    [accounts]
  );

  const setField = <K extends keyof ComposerForm>(key: K, value: ComposerForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const replacePostInState = (next: SocialPostRecord | null) => {
    if (!next) return;
    setPosts((current) => {
      const exists = current.some((item) => item.id === next.id);
      const updated = exists ? current.map((item) => (item.id === next.id ? next : item)) : [next, ...current];
      return [...updated].sort((a, b) => {
        const aTime = new Date(a.scheduledFor || a.createdAt).getTime();
        const bTime = new Date(b.scheduledFor || b.createdAt).getTime();
        return bTime - aTime;
      });
    });
  };

  const loadPostIntoComposer = (post: SocialPostRecord) => {
    setMessage(null);
    setError(null);
    setForm({
      id: post.id,
      title: post.title,
      caption: post.caption,
      scheduledForLocal: toLocalInputValue(post.scheduledFor),
      timezone: post.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      linkUrl: post.linkUrl || "",
      ctaLabel: post.ctaLabel || "LEARN_MORE",
      googleTopicType: post.googleTopicType || "STANDARD",
      googleEventTitle: post.googleEventTitle || "",
      googleEventStartLocal: toLocalInputValue(post.googleEventStart),
      googleEventEndLocal: toLocalInputValue(post.googleEventEnd),
      platforms: post.platforms.length ? post.platforms : ["facebook"],
      platformAccountIds: post.platformAccountIds || defaultAccountIds(accounts),
      asset: post.asset
        ? {
            id: post.asset.id,
            originalName: post.asset.originalName,
            publicUrl: post.asset.publicUrl,
            assetKind: post.asset.assetKind,
          }
        : null,
    });
  };

  const resetComposer = () => {
    setForm({
      ...emptyForm(),
      platformAccountIds: defaultAccountIds(accounts),
    });
    setMessage(null);
    setError(null);
  };

  const saveDraft = async () => {
    setBusyKey("save");
    setError(null);
    setMessage(null);
    try {
      const payload = {
        title: form.title,
        caption: form.caption,
        status: "draft" as const,
        scheduledFor: fromLocalInputValue(form.scheduledForLocal),
        timezone: form.timezone,
        linkUrl: form.linkUrl,
        ctaLabel: form.ctaLabel,
        googleTopicType: form.googleTopicType,
        googleEventTitle: form.googleEventTitle,
        googleEventStart: fromLocalInputValue(form.googleEventStartLocal),
        googleEventEnd: fromLocalInputValue(form.googleEventEndLocal),
        platforms: form.platforms,
        platformAccountIds: form.platformAccountIds,
        assetId: form.asset?.id || null,
      };
      const next = form.id ? await updateSocialPost(form.id, payload) : await createSocialPost(payload);
      replacePostInState(next);
      if (next) loadPostIntoComposer(next);
      setMessage("Draft saved to your server.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save draft.");
    } finally {
      setBusyKey(null);
    }
  };

  const schedulePost = async () => {
    setBusyKey("schedule");
    setError(null);
    setMessage(null);
    try {
      const scheduledFor = fromLocalInputValue(form.scheduledForLocal);
      if (!scheduledFor) throw new Error("Choose a schedule date and time first.");
      const basePayload = {
        title: form.title,
        caption: form.caption,
        status: "draft" as const,
        scheduledFor,
        timezone: form.timezone,
        linkUrl: form.linkUrl,
        ctaLabel: form.ctaLabel,
        googleTopicType: form.googleTopicType,
        googleEventTitle: form.googleEventTitle,
        googleEventStart: fromLocalInputValue(form.googleEventStartLocal),
        googleEventEnd: fromLocalInputValue(form.googleEventEndLocal),
        platforms: form.platforms,
        platformAccountIds: form.platformAccountIds,
        assetId: form.asset?.id || null,
      };
      const draft = form.id ? await updateSocialPost(form.id, basePayload) : await createSocialPost(basePayload);
      if (!draft) throw new Error("Unable to stage draft for scheduling.");
      const next = await scheduleSocialPost(draft.id, {
        scheduledFor,
        platforms: form.platforms,
        platformAccountIds: form.platformAccountIds,
      });
      replacePostInState(next);
      if (next) loadPostIntoComposer(next);
      setMessage("Post scheduled. It will stay on your server until publish time.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to schedule post.");
    } finally {
      setBusyKey(null);
    }
  };

  const publishNow = async () => {
    setBusyKey("publish");
    setError(null);
    setMessage(null);
    try {
      const basePayload = {
        title: form.title,
        caption: form.caption,
        status: "draft" as const,
        scheduledFor: fromLocalInputValue(form.scheduledForLocal),
        timezone: form.timezone,
        linkUrl: form.linkUrl,
        ctaLabel: form.ctaLabel,
        googleTopicType: form.googleTopicType,
        googleEventTitle: form.googleEventTitle,
        googleEventStart: fromLocalInputValue(form.googleEventStartLocal),
        googleEventEnd: fromLocalInputValue(form.googleEventEndLocal),
        platforms: form.platforms,
        platformAccountIds: form.platformAccountIds,
        assetId: form.asset?.id || null,
      };
      const draft = form.id ? await updateSocialPost(form.id, basePayload) : await createSocialPost(basePayload);
      if (!draft) throw new Error("Unable to stage post for publishing.");
      const next = await publishSocialPostNow(draft.id, {
        platforms: form.platforms,
        platformAccountIds: form.platformAccountIds,
      });
      replacePostInState(next);
      if (next) loadPostIntoComposer(next);
      setMessage("Publish started. Any provider errors will show on the post card.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish now.");
    } finally {
      setBusyKey(null);
    }
  };

  const uploadAsset = async (file: File | null) => {
    if (!file) return;
    setBusyKey("asset");
    setError(null);
    setMessage(null);
    try {
      const asset = await uploadSocialAsset(file);
      if (!asset) throw new Error("Asset upload did not return a stored file.");
      setForm((current) => ({
        ...current,
        asset: {
          id: asset.id,
          originalName: asset.originalName,
          publicUrl: asset.publicUrl,
          assetKind: asset.assetKind,
        },
      }));
      setMessage(`Stored ${asset.originalName} on the server and linked it to the composer.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload asset.");
    } finally {
      setBusyKey(null);
    }
  };

  const updateAccountDraft = (draftKey: string, patch: Partial<AccountDraft>) => {
    setAccountDrafts((current) =>
      current.map((draft) => (draft.draftKey === draftKey ? { ...draft, ...patch } : draft))
    );
  };

  const addAccountDraft = (platform: SocialPlatform) => {
    setAccountDrafts((current) => [
      ...current,
      {
        draftKey: `new-${platform}-${Date.now()}`,
        id: null,
        platform,
        label: "",
        externalId: "",
        accessToken: "",
        refreshToken: "",
        tokenExpiresAt: "",
        active: false,
      },
    ]);
  };

  const saveAccount = async (draftKey: string) => {
    const draft = accountDrafts.find((item) => item.draftKey === draftKey);
    if (!draft) return;
    setBusyKey(`account-${draftKey}`);
    setError(null);
    setMessage(null);
    try {
      const next = await upsertSocialAccount({
        id: draft.id,
        platform: draft.platform,
        label: draft.label,
        externalId: draft.externalId,
        accessToken: draft.accessToken,
        refreshToken: draft.refreshToken,
        tokenExpiresAt: fromLocalInputValue(draft.tokenExpiresAt),
        active: draft.active,
        configJson: {},
      });
      if (!next) throw new Error(`Unable to save ${draft.platform} account settings.`);
      setAccounts((current) => {
        const exists = current.some((item) => item.id === next.id);
        const updated = exists ? current.map((item) => (item.id === next.id ? next : item)) : [...current, next];
        return [...updated].sort((a, b) => a.platform.localeCompare(b.platform) || a.label.localeCompare(b.label));
      });
      setAccountDrafts((current) =>
        current.map((item) =>
          item.draftKey === draftKey
            ? {
                ...item,
                draftKey: next.id,
                id: next.id,
                platform: next.platform,
                label: next.label,
                externalId: next.externalId,
                accessToken: "",
                refreshToken: "",
                tokenExpiresAt: toLocalInputValue(next.tokenExpiresAt),
                active: next.active,
              }
            : item
        )
      );
      setForm((current) => ({
        ...current,
        platformAccountIds: {
          ...current.platformAccountIds,
          ...(current.platforms.includes(next.platform) && !current.platformAccountIds[next.platform]
            ? { [next.platform]: next.id }
            : {}),
        },
      }));
      setMessage(`${draft.platform[0].toUpperCase()}${draft.platform.slice(1)} connection saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to save ${draft.platform} account.`);
    } finally {
      setBusyKey(null);
    }
  };

  const togglePlatform = (platform: SocialPlatform) => {
    setForm((current) => {
      const exists = current.platforms.includes(platform);
      const nextPlatforms = exists
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform];
      const nextPlatformAccountIds = { ...current.platformAccountIds };
      if (!exists && !nextPlatformAccountIds[platform]) {
        const preferred =
          accounts.find((item) => item.platform === platform && item.active) ||
          accounts.find((item) => item.platform === platform);
        if (preferred?.id) nextPlatformAccountIds[platform] = preferred.id;
      }
      return {
        ...current,
        platforms: nextPlatforms,
        platformAccountIds: nextPlatformAccountIds,
      };
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Social Scheduler</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Create once, store on your server, publish on schedule.</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Upload Canva images or videos, paste your copy, pick Facebook, Instagram, and Google Business Profile,
              and let WOLF FD hold the draft until the exact publish time.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              <RefreshCcw size={15} /> Refresh
            </button>
            <button
              type="button"
              onClick={resetComposer}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <UploadCloud size={15} /> New Draft
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Posts</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{summary.total}</div>
        </div>
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-blue-700">Scheduled</div>
          <div className="mt-2 text-3xl font-semibold text-blue-950">{summary.scheduled}</div>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-emerald-700">Published</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-950">{summary.published}</div>
        </div>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-rose-700">Failed</div>
          <div className="mt-2 text-3xl font-semibold text-rose-950">{summary.failed}</div>
        </div>
      </section>

      {(message || error) && (
        <section
          className={`rounded-3xl border p-4 text-sm shadow-sm ${
            error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || message}
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Composer</div>
              <h3 className="text-xl font-semibold text-slate-900">
                {form.id ? "Edit Scheduled Draft" : "Create Social Draft"}
              </h3>
            </div>
            {form.id && (
              <button
                type="button"
                onClick={resetComposer}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Clear Selection
              </button>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Title</div>
              <input
                type="text"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Weekend sofa promo"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Link URL</div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <LinkIcon size={15} className="text-slate-400" />
                <input
                  type="url"
                  value={form.linkUrl}
                  onChange={(event) => setField("linkUrl", event.target.value)}
                  placeholder="https://..."
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>
          </div>

          <label className="mt-4 block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Caption / Copy</div>
            <textarea
              value={form.caption}
              onChange={(event) => setField("caption", event.target.value)}
              placeholder="Paste your caption here..."
              rows={7}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          </label>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <CalendarClock size={15} className="text-slate-400" />
                <input
                  type="datetime-local"
                  value={form.scheduledForLocal}
                  onChange={(event) => setField("scheduledForLocal", event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Google CTA</div>
              <select
                value={form.ctaLabel}
                onChange={(event) => setField("ctaLabel", event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="LEARN_MORE">Learn More</option>
                <option value="SHOP">Shop</option>
                <option value="BOOK">Book</option>
                <option value="ORDER">Order</option>
                <option value="SIGN_UP">Sign Up</option>
                <option value="CALL">Call</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Google Post Type</div>
              <select
                value={form.googleTopicType}
                onChange={(event) => setField("googleTopicType", event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="STANDARD">Standard</option>
                <option value="EVENT">Event</option>
                <option value="OFFER">Offer</option>
                <option value="ALERT">Alert</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Timezone</div>
              <input
                type="text"
                value={form.timezone}
                onChange={(event) => setField("timezone", event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
            </label>
          </div>

          {(form.googleTopicType === "EVENT" || form.googleTopicType === "OFFER") && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Event Title</div>
                <input
                  type="text"
                  value={form.googleEventTitle}
                  onChange={(event) => setField("googleEventTitle", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Event Start</div>
                <input
                  type="datetime-local"
                  value={form.googleEventStartLocal}
                  onChange={(event) => setField("googleEventStartLocal", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Event End</div>
                <input
                  type="datetime-local"
                  value={form.googleEventEndLocal}
                  onChange={(event) => setField("googleEventEndLocal", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                />
              </label>
            </div>
          )}

          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Platforms</div>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((platform) => {
                const selected = form.platforms.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      selected
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {platform.label}
                  </button>
                );
              })}
            </div>
          </div>

          {!!form.platforms.length && (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform Destinations</div>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {form.platforms.map((platformId) => {
                  const platform = PLATFORM_OPTIONS.find((item) => item.id === platformId);
                  const options = accountsByPlatform[platformId];
                  return (
                    <label key={platformId} className="block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {platform?.label || platformId}
                      </div>
                      <select
                        value={form.platformAccountIds[platformId] || ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            platformAccountIds: {
                              ...current.platformAccountIds,
                              [platformId]: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                      >
                        <option value="">
                          {platformId === "google" ? "Choose Google account / location" : `Choose ${platform?.label || platformId} account`}
                        </option>
                        {options.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.label || account.externalId || `${platform?.label || platformId} connection`}
                            {account.active ? "" : " (inactive)"}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-xs text-slate-500">
                        {platformId === "google"
                          ? "Pick the exact Google Business Profile account and location for this post."
                          : "Pick which saved connection should publish this post."}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Media Asset</div>
                {form.asset ? (
                  <div className="mt-2">
                    <div className="text-sm font-semibold text-slate-900">{form.asset.originalName}</div>
                    <div className="text-xs text-slate-500">
                      Stored on server as {form.asset.assetKind}. Meta will fetch this public URL at publish time.
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-500">No image or video linked yet.</div>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                <ImageUp size={15} />
                {busyKey === "asset" ? "Uploading..." : "Upload Asset"}
                <input
                  type="file"
                  accept="image/*,video/*,.gif"
                  className="hidden"
                  onChange={(event) => void uploadAsset(event.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={busyKey !== null}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              <Save size={15} /> Save Draft
            </button>
            <button
              type="button"
              onClick={() => void schedulePost()}
              disabled={busyKey !== null}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Clock3 size={15} /> Schedule
            </button>
            <button
              type="button"
              onClick={() => void publishNow()}
              disabled={busyKey !== null}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Send size={15} /> Publish Now
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Settings2 size={16} className="text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-900">Platform Connections</h3>
            </div>
            <div className="mt-4 space-y-5">
              {PLATFORM_OPTIONS.map((platform) => {
                const drafts = accountDrafts.filter((item) => item.platform === platform.id);
                return (
                  <div key={platform.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{platform.label}</div>
                        <div className="text-xs text-slate-500">
                          {platform.id === "facebook" && "Use your Facebook Page ID."}
                          {platform.id === "instagram" && "Use your Instagram professional account ID."}
                          {platform.id === "google" && "Add one or more accounts/{accountId}/locations/{locationId} destinations."}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addAccountDraft(platform.id)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Add {platform.label}
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {drafts.map((draft, index) => {
                        const saved = draft.id ? accounts.find((item) => item.id === draft.id) || null : null;
                        const buttonLabel =
                          busyKey === `account-${draft.draftKey}`
                            ? "Saving..."
                            : draft.id
                              ? "Save Changes"
                              : "Save Connection";
                        return (
                          <div key={draft.draftKey} className="rounded-3xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                {platform.label} {index + 1}
                              </div>
                              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={draft.active}
                                  onChange={(event) => updateAccountDraft(draft.draftKey, { active: event.target.checked })}
                                />
                                Active
                              </label>
                            </div>

                            <div className="mt-3 space-y-3">
                              <input
                                type="text"
                                value={draft.label}
                                onChange={(event) => updateAccountDraft(draft.draftKey, { label: event.target.value })}
                                placeholder={`${platform.label} label`}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                              />
                              <input
                                type="text"
                                value={draft.externalId}
                                onChange={(event) => updateAccountDraft(draft.draftKey, { externalId: event.target.value })}
                                placeholder={
                                  platform.id === "google" ? "accounts/123/locations/456" : "External account/page ID"
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                              />
                              <input
                                type="password"
                                value={draft.accessToken}
                                onChange={(event) => updateAccountDraft(draft.draftKey, { accessToken: event.target.value })}
                                placeholder={saved?.accessTokenConfigured ? `Token saved: ${saved.tokenPreview}` : "Access token"}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                              />
                              <input
                                type="password"
                                value={draft.refreshToken}
                                onChange={(event) => updateAccountDraft(draft.draftKey, { refreshToken: event.target.value })}
                                placeholder={saved?.refreshTokenConfigured ? "Refresh token saved" : "Refresh token (optional)"}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                              />
                              <input
                                type="datetime-local"
                                value={draft.tokenExpiresAt}
                                onChange={(event) => updateAccountDraft(draft.draftKey, { tokenExpiresAt: event.target.value })}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => void saveAccount(draft.draftKey)}
                              disabled={busyKey !== null}
                              className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              <Save size={14} /> {buttonLabel}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-amber-950">Platform notes</h4>
            <div className="mt-2 space-y-2 text-sm text-amber-900/90">
              <div>Facebook supports scheduled posting and media uploads to Pages.</div>
              <div>Instagram requires a public media URL at publish time, so uploads stay on this server first.</div>
              <div>Google is treated as Google Business Profile local posts in this release.</div>
              <div>GIFs should usually be exported from Canva as MP4 if you want Instagram support.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Post Queue</div>
            <h3 className="text-xl font-semibold text-slate-900">Drafts, scheduled posts, and publish results</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="publishing">Publishing</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="all">All platforms</option>
              {PLATFORM_OPTIONS.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search drafts"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {isLoading ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Loading social scheduler...
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No posts match this view yet.
            </div>
          ) : (
            filteredPosts.map((post) => (
              <div
                key={post.id}
                className={`rounded-3xl border p-5 transition-colors ${
                  form.id === post.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                        {post.status}
                      </span>
                      {post.platforms.map((platform) => (
                        <span
                          key={`${post.id}-${platform}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {post.platforms.map((platform) => {
                        const accountId = post.platformAccountIds?.[platform];
                        if (!accountId) return null;
                        return (
                          <span
                            key={`${post.id}-${platform}-account`}
                            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                          >
                            {(PLATFORM_OPTIONS.find((item) => item.id === platform)?.label || platform)}:{" "}
                            {accountLabelById.get(accountId) || `Account ${accountId}`}
                          </span>
                        );
                      })}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{post.title || "Untitled post"}</div>
                      <div className="mt-1 line-clamp-2 max-w-3xl text-sm text-slate-600">{post.caption || "No caption yet."}</div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>Scheduled: {formatWhen(post.scheduledFor)}</span>
                      <span>Updated: {formatWhen(post.updatedAt)}</span>
                      {post.asset && <span>Asset: {post.asset.originalName}</span>}
                    </div>
                    {post.lastError && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {post.lastError}
                      </div>
                    )}
                    {post.jobs.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {post.jobs.slice(0, 4).map((job) => (
                          <span
                            key={job.id}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                          >
                            {job.platform}: {job.status}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <button
                      type="button"
                      onClick={() => loadPostIntoComposer(post)}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setBusyKey(`publish-${post.id}`);
                        setError(null);
                        setMessage(null);
                        try {
                          const next = await publishSocialPostNow(post.id, {
                            platforms: post.platforms,
                            platformAccountIds: post.platformAccountIds,
                          });
                          replacePostInState(next);
                          if (form.id === post.id && next) loadPostIntoComposer(next);
                          setMessage("Publish started. Check the job badges for live status.");
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Unable to publish post.");
                        } finally {
                          setBusyKey(null);
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      <CheckCircle2 size={14} /> Publish
                    </button>
                    {post.status === "scheduled" && (
                      <button
                        type="button"
                        onClick={async () => {
                          setBusyKey(`cancel-${post.id}`);
                          try {
                            const next = await cancelSocialPost(post.id);
                            replacePostInState(next);
                            if (form.id === post.id && next) loadPostIntoComposer(next);
                            setMessage("Scheduled publish cancelled.");
                            setError(null);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Unable to cancel schedule.");
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                        disabled={busyKey === `cancel-${post.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
                      >
                        <XCircle size={14} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default WorkAdvertising;
