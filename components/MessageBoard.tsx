import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Hash, Lock, MessageSquare, Plus, Send } from "lucide-react";
import type { AuthUser, BoardComment, BoardPost } from "../types";
import { checkPosBackendHealthy } from "../services/posBackendApi";
import {
  createBoardComment,
  createBoardPost,
  fetchBoardChannels,
  fetchBoardComments,
  fetchBoardPosts,
  type BoardChannel,
} from "../services/messageBoardApi";

type SyncMode = "POS_DB" | "LOCAL_STORAGE";

type MessageBoardProps = {
  authUser: AuthUser;
};

const LOCAL_CHANNELS: BoardChannel[] = [
  { id: "announcements", name: "announcements", isPrivate: false, count: 2 },
  { id: "sales-floor", name: "sales-floor", isPrivate: false, count: 1 },
  { id: "operations", name: "operations", isPrivate: false, count: 1 },
  { id: "inventory", name: "inventory", isPrivate: false, count: 0 },
  { id: "marketing", name: "marketing", isPrivate: false, count: 0 },
  { id: "leadership", name: "leadership", isPrivate: true, count: 1 },
];

const LOCAL_POSTS: Record<string, BoardPost[]> = {
  announcements: [
    {
      id: "local-post-1",
      channel: "announcements",
      body: "Showroom reset starts at 9:30 AM. Please confirm your section is ready before open.",
      priority: true,
      authorName: "Store Ops",
      authorEmail: "ops@furnituredistributors.wolf.discount",
      createdAt: "2026-03-04T13:10:00.000Z",
    },
    {
      id: "local-post-2",
      channel: "announcements",
      body: "Follow-up calls are due by 2 PM. Keep next-action notes updated in CRM.",
      priority: false,
      authorName: "Sales Lead",
      authorEmail: "sales@furnituredistributors.wolf.discount",
      createdAt: "2026-03-04T14:30:00.000Z",
    },
  ],
  "sales-floor": [
    {
      id: "local-post-3",
      channel: "sales-floor",
      body: "Two walk-ins waiting for mattress help at FD5.",
      priority: false,
      authorName: "Front Desk",
      authorEmail: "frontdesk@furnituredistributors.wolf.discount",
      createdAt: "2026-03-04T15:05:00.000Z",
    },
  ],
  operations: [
    {
      id: "local-post-4",
      channel: "operations",
      body: "Truck #2 loading moved to 4:00 PM due to route adjustment.",
      priority: false,
      authorName: "Dispatch",
      authorEmail: "dispatch@furnituredistributors.wolf.discount",
      createdAt: "2026-03-04T16:20:00.000Z",
    },
  ],
  inventory: [],
  marketing: [],
  leadership: [
    {
      id: "local-post-5",
      channel: "leadership",
      body: "Weekly KPI review moved to Friday at 8:15 AM.",
      priority: false,
      authorName: "Owner",
      authorEmail: "owner@furnituredistributors.wolf.discount",
      createdAt: "2026-03-04T12:00:00.000Z",
    },
  ],
};

const LOCAL_COMMENTS: Record<string, BoardComment[]> = {
  "local-post-1": [
    {
      id: "local-comment-1",
      postId: "local-post-1",
      body: "Merch team is in place and aisle markers are already set.",
      authorName: "Jane Cooper",
      authorEmail: "jane@furnituredistributors.wolf.discount",
      createdAt: "2026-03-04T13:20:00.000Z",
    },
  ],
};

const formatStamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const MessageBoard: React.FC<MessageBoardProps> = ({ authUser }) => {
  const isLeadershipUser = authUser.roles.includes("Owner") || authUser.roles.includes("Manager");

  const visibleLocalChannels = useMemo(
    () => LOCAL_CHANNELS.filter((channel) => !channel.isPrivate || isLeadershipUser),
    [isLeadershipUser]
  );

  const visibleLocalPosts = useMemo(() => {
    const next: Record<string, BoardPost[]> = {};
    for (const channel of visibleLocalChannels) {
      next[channel.id] = LOCAL_POSTS[channel.id] || [];
    }
    return next;
  }, [visibleLocalChannels]);

  const [syncMode, setSyncMode] = useState<SyncMode>("LOCAL_STORAGE");
  const [channels, setChannels] = useState<BoardChannel[]>(visibleLocalChannels);
  const [activeChannel, setActiveChannel] = useState<string>(visibleLocalChannels[0]?.id || "announcements");
  const [posts, setPosts] = useState<BoardPost[]>(visibleLocalPosts[activeChannel] || []);
  const [selectedPostId, setSelectedPostId] = useState<string>("");
  const [commentsByPost, setCommentsByPost] = useState<Record<string, BoardComment[]>>(LOCAL_COMMENTS);
  const [postDraft, setPostDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [priorityDraft, setPriorityDraft] = useState(false);
  const [posting, setPosting] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!channels.some((channel) => channel.id === activeChannel)) {
      setActiveChannel(channels[0]?.id || "announcements");
    }
  }, [channels, activeChannel]);

  useEffect(() => {
    if (!posts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(posts[0]?.id || "");
    }
  }, [posts, selectedPostId]);

  useEffect(() => {
    let stopped = false;
    let pollId: number | null = null;

    const loadLocal = () => {
      if (stopped) return;
      setSyncMode("LOCAL_STORAGE");
      setChannels(visibleLocalChannels);
      const firstChannel = visibleLocalChannels[0]?.id || "announcements";
      setActiveChannel((current) => (visibleLocalChannels.some((channel) => channel.id === current) ? current : firstChannel));
    };

    const loadChannels = async () => {
      const rows = await fetchBoardChannels();
      if (stopped) return;
      const safeRows = rows.filter((channel) => !channel.isPrivate || isLeadershipUser);
      if (!safeRows.length) {
        loadLocal();
        return;
      }
      setChannels(safeRows);
      setActiveChannel((current) => (safeRows.some((channel) => channel.id === current) ? current : safeRows[0].id));
    };

    const startSync = async () => {
      try {
        const healthy = await checkPosBackendHealthy();
        if (!healthy) {
          loadLocal();
          return;
        }
        setSyncMode("POS_DB");
        await loadChannels();
        if (stopped) return;
        pollId = window.setInterval(() => {
          void loadChannels().catch(() => {
            if (!stopped) setSyncMode("LOCAL_STORAGE");
          });
        }, 5000);
      } catch {
        loadLocal();
      }
    };

    void startSync();

    return () => {
      stopped = true;
      if (pollId !== null) window.clearInterval(pollId);
    };
  }, [isLeadershipUser, visibleLocalChannels]);

  useEffect(() => {
    let stopped = false;

    const loadPosts = async () => {
      if (!activeChannel) {
        setPosts([]);
        return;
      }

      if (syncMode === "LOCAL_STORAGE") {
        setPosts(visibleLocalPosts[activeChannel] || []);
        return;
      }

      try {
        const rows = await fetchBoardPosts(activeChannel);
        if (stopped) return;
        setPosts(rows);
      } catch (err) {
        if (stopped) return;
        console.warn("Failed to load board posts from API, switching to local fallback:", err);
        setSyncMode("LOCAL_STORAGE");
        setPosts(visibleLocalPosts[activeChannel] || []);
      }
    };

    void loadPosts();
    return () => {
      stopped = true;
    };
  }, [activeChannel, syncMode, visibleLocalPosts]);

  useEffect(() => {
    let stopped = false;
    if (!selectedPostId) return;

    const loadComments = async () => {
      if (syncMode === "LOCAL_STORAGE") {
        setCommentsByPost((current) => ({
          ...current,
          [selectedPostId]: current[selectedPostId] || LOCAL_COMMENTS[selectedPostId] || [],
        }));
        return;
      }

      try {
        const rows = await fetchBoardComments(selectedPostId);
        if (stopped) return;
        setCommentsByPost((current) => ({ ...current, [selectedPostId]: rows }));
      } catch (err) {
        if (stopped) return;
        console.warn("Failed to load board comments from API, switching to local fallback:", err);
        setSyncMode("LOCAL_STORAGE");
      }
    };

    void loadComments();
    return () => {
      stopped = true;
    };
  }, [selectedPostId, syncMode]);

  const selectedPost = posts.find((post) => post.id === selectedPostId) || null;
  const selectedComments = selectedPost ? commentsByPost[selectedPost.id] || [] : [];

  const handleCreatePost = async () => {
    const body = postDraft.trim();
    if (!body || posting) return;

    setPosting(true);
    setError(null);

    if (syncMode === "LOCAL_STORAGE") {
      const created: BoardPost = {
        id: `local-post-${Date.now()}`,
        channel: activeChannel,
        body,
        priority: priorityDraft,
        authorName: authUser.name || authUser.email,
        authorEmail: authUser.email,
        createdAt: new Date().toISOString(),
      };
      setPosts((current) => [created, ...current]);
      setSelectedPostId(created.id);
      setPostDraft("");
      setPriorityDraft(false);
      setPosting(false);
      return;
    }

    try {
      await createBoardPost({ channel: activeChannel, body, priority: priorityDraft });
      const refreshed = await fetchBoardPosts(activeChannel);
      setPosts(refreshed);
      setSelectedPostId(refreshed[0]?.id || "");
      setPostDraft("");
      setPriorityDraft(false);
    } catch {
      setError("Could not publish post right now.");
    } finally {
      setPosting(false);
    }
  };

  const handleCreateComment = async () => {
    const body = commentDraft.trim();
    if (!selectedPost || !body || commenting) return;

    setCommenting(true);
    setError(null);

    if (syncMode === "LOCAL_STORAGE") {
      const created: BoardComment = {
        id: `local-comment-${Date.now()}`,
        postId: selectedPost.id,
        body,
        authorName: authUser.name || authUser.email,
        authorEmail: authUser.email,
        createdAt: new Date().toISOString(),
      };
      setCommentsByPost((current) => ({
        ...current,
        [selectedPost.id]: [...(current[selectedPost.id] || []), created],
      }));
      setCommentDraft("");
      setCommenting(false);
      return;
    }

    try {
      await createBoardComment(selectedPost.id, body);
      const refreshed = await fetchBoardComments(selectedPost.id);
      setCommentsByPost((current) => ({ ...current, [selectedPost.id]: refreshed }));
      setCommentDraft("");
    } catch {
      setError("Could not add comment right now.");
    } finally {
      setCommenting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      <section className="xl:col-span-3 rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Coming Soon</div>
        <h2 className="mt-2 text-2xl font-semibold text-amber-950">Message board improvements are coming soon.</h2>
        <p className="mt-2 text-sm text-amber-900/80">
          This page is currently a placeholder while the full message-board workflow is being built.
        </p>
      </section>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Message Board</div>
          <div className="mt-1 text-xs text-slate-500">Team channels + thread comments</div>
          <div
            className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${
              syncMode === "POS_DB"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {syncMode === "POS_DB" ? "Live sync" : "Local fallback"}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Channels</div>
          <div className="mt-3 space-y-1">
            {channels.map((channel) => {
              const isActive = activeChannel === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setActiveChannel(channel.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {channel.isPrivate ? <Lock size={14} /> : <Hash size={14} />}
                    {channel.name}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive ? "bg-white/20" : "bg-slate-200"}`}>
                    {channel.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      <main className="space-y-4">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Channel</div>
              <h2 className="text-2xl font-semibold text-slate-900">#{activeChannel}</h2>
            </div>
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={priorityDraft}
                onChange={(event) => setPriorityDraft(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Priority post
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <input
              type="text"
              value={postDraft}
              onChange={(event) => setPostDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreatePost();
                }
              }}
              placeholder="Post an update to this channel..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleCreatePost()}
              disabled={posting}
              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              <Plus size={13} /> Post
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="space-y-3">
            {!posts.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No posts yet in this channel.
              </div>
            ) : (
              posts.map((post) => {
                const isSelected = selectedPostId === post.id;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setSelectedPostId(post.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left ${
                      isSelected ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{post.authorName}</span>
                      <span className="text-xs text-slate-400">{formatStamp(post.createdAt)}</span>
                      {post.priority && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Priority
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{post.body}</p>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </main>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <MessageSquare size={14} /> Thread
          </div>
          {!selectedPost ? (
            <p className="mt-3 text-sm text-slate-500">Select a post to view comments.</p>
          ) : (
            <>
              <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {!selectedComments.length ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                    No comments yet.
                  </div>
                ) : (
                  selectedComments.map((comment) => (
                    <div key={comment.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-xs font-semibold text-slate-800">{comment.authorName}</div>
                      <div className="mt-1 text-sm text-slate-700">{comment.body}</div>
                      <div className="mt-1 text-[11px] text-slate-400">{formatStamp(comment.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="text"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateComment();
                    }
                  }}
                  placeholder="Add a comment..."
                  className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateComment()}
                  disabled={commenting || !selectedPost}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  <Send size={13} /> Send
                </button>
              </div>
            </>
          )}
        </section>

        {error && (
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
            <div className="inline-flex items-center gap-2 font-semibold">
              <AlertCircle size={14} /> Sync warning
            </div>
            <p className="mt-1">{error}</p>
          </section>
        )}
      </aside>
    </div>
  );
};

export default MessageBoard;
