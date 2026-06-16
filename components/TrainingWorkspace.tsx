import React from "react";
import { BookOpen, Clock, Headphones, MessageSquare, ShieldCheck, Sofa } from "lucide-react";
import ObjectionsDrawer from "./crm/ObjectionsDrawer";

export type TrainingSubTab = "podcasts" | "objections";

type TrainingWorkspaceProps = {
  isDarkMode: boolean;
  requestedSubTab?: TrainingSubTab;
  requestedSubTabToken?: number;
  hideTabBar?: boolean;
};

const TRAINING_EPISODES = [
  {
    id: "jackson-catnapper-deep-dive",
    title: "Deep Dive: Jackson & Catnapper",
    series: "Furniture Store Training Podcast",
    description:
      "A practical floor-training episode focused on customer-safe language, cushion construction, reclining mechanics, and how to explain Jackson/Catnapper features clearly on the showroom floor.",
    duration: "20:05",
    videoSrc: "/fd/api/api/training/media/jackson-feature-catnapper.mp4",
    posterSrc: "/fd/training/media/jackson-feature-catnapper-poster.jpg",
    tags: ["Jackson", "Catnapper", "Seat Cushions", "Wallhugger", "Floor Training"],
  },
];

const TrainingWorkspace: React.FC<TrainingWorkspaceProps> = ({
  isDarkMode,
  requestedSubTab = "podcasts",
  requestedSubTabToken,
  hideTabBar = false,
}) => {
  const [subTab, setSubTab] = React.useState<TrainingSubTab>(requestedSubTab);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [pictureInPictureActive, setPictureInPictureActive] = React.useState(false);
  const [pictureInPictureError, setPictureInPictureError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSubTab(requestedSubTab);
  }, [requestedSubTab, requestedSubTabToken]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnter = () => {
      setPictureInPictureActive(true);
      setPictureInPictureError(null);
    };
    const handleLeave = () => setPictureInPictureActive(false);

    video.addEventListener("enterpictureinpicture", handleEnter);
    video.addEventListener("leavepictureinpicture", handleLeave);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnter);
      video.removeEventListener("leavepictureinpicture", handleLeave);
    };
  }, []);

  const handleTogglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (typeof document === "undefined" || !document.pictureInPictureEnabled || !video.requestPictureInPicture) {
      setPictureInPictureError("Pop out is not supported in this browser.");
      return;
    }

    setPictureInPictureError(null);

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }

      if (video.paused) {
        await video.play();
      }

      await video.requestPictureInPicture();
    } catch (error) {
      console.warn("Training podcast pop out failed", error);
      setPictureInPictureError("Click play once, then Pop out again if the browser blocks it.");
    }
  };

  const pictureInPictureSupported =
    typeof document !== "undefined" && Boolean(document.pictureInPictureEnabled);

  const episode = TRAINING_EPISODES[0];
  const pageBg = isDarkMode ? "bg-[#111827] text-slate-100" : "bg-slate-50 text-slate-900";
  const panel = isDarkMode ? "border-slate-800 bg-slate-950/78" : "border-slate-200 bg-white";
  const muted = isDarkMode ? "text-slate-400" : "text-slate-600";
  const subtlePanel = isDarkMode ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-50";
  const tabActive = isDarkMode
    ? "border-amber-400/30 bg-amber-500/12 text-amber-200"
    : "border-amber-200 bg-amber-50 text-amber-700";
  const tabInactive = isDarkMode
    ? "border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100"
    : "border-transparent text-slate-500 hover:bg-white hover:text-slate-900";

  return (
    <div className={`min-h-[calc(100vh-5rem)] ${pageBg}`}>
      {!hideTabBar && (
        <div className={`sticky top-20 z-20 border-b px-6 py-3 backdrop-blur-xl ${isDarkMode ? "border-slate-800 bg-[#121b27]/94" : "border-slate-200 bg-white/92"}`}>
          <button
            type="button"
            onClick={() => setSubTab("podcasts")}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${subTab === "podcasts" ? tabActive : tabInactive}`}
          >
            <Headphones size={15} />
            Podcasts
          </button>
          <button
            type="button"
            onClick={() => setSubTab("objections")}
            className={`ml-2 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${subTab === "objections" ? tabActive : tabInactive}`}
          >
            <MessageSquare size={15} />
            Objections
          </button>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8 lg:py-8">
        {subTab === "objections" ? (
          <ObjectionsDrawer isDarkMode={isDarkMode} mode="panel" />
        ) : (
        <section className={`overflow-hidden rounded-3xl border shadow-sm ${panel}`}>
          <div className={`grid gap-0 lg:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.85fr)]`}>
            <div className="p-5 lg:p-7">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${isDarkMode ? "border-amber-400/24 bg-amber-500/10 text-amber-200" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  <Headphones size={14} />
                  Podcasts
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${subtlePanel}`}>
                  <Clock size={14} />
                  {episode.duration}
                </span>
              </div>

              <h2 className="text-2xl font-bold tracking-tight lg:text-4xl">{episode.title}</h2>
              <p className={`mt-3 max-w-3xl text-sm leading-6 lg:text-base ${muted}`}>{episode.description}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {episode.tags.map((tag) => (
                  <span key={tag} className={`rounded-full border px-3 py-1 text-xs font-semibold ${isDarkMode ? "border-slate-700 bg-slate-900 text-slate-300" : "border-slate-200 bg-white text-slate-600"}`}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="relative mt-6 overflow-hidden rounded-2xl border border-slate-900/10 bg-black shadow-lg">
                <button
                  type="button"
                  onClick={handleTogglePictureInPicture}
                  disabled={!pictureInPictureSupported}
                  className={`absolute right-3 top-3 z-10 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] shadow-lg backdrop-blur-md transition ${
                    pictureInPictureSupported
                      ? "border-white/25 bg-black/70 text-white hover:bg-amber-500 hover:text-slate-950"
                      : "cursor-not-allowed border-white/10 bg-black/40 text-slate-500"
                  }`}
                  title="Pop the training podcast into an always-on-top Picture-in-Picture window"
                  data-training-podcast-popout-button="true"
                >
                  {pictureInPictureActive ? "Dock" : "Pop out"}
                </button>
                <video
                  ref={videoRef}
                  className="aspect-video w-full bg-black"
                  controls
                  controlsList="nodownload noremoteplayback"
                  disableRemotePlayback
                  onContextMenu={(event) => event.preventDefault()}
                  preload="metadata"
                  poster={episode.posterSrc}
                >
                  <source src={episode.videoSrc} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
              {pictureInPictureError && (
                <p className={`mt-2 text-xs font-semibold ${isDarkMode ? "text-amber-200" : "text-amber-700"}`}>
                  {pictureInPictureError}
                </p>
              )}
            </div>

            <aside className={`border-t p-5 lg:border-l lg:border-t-0 lg:p-7 ${isDarkMode ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50/70"}`}>
              <div className="flex items-center gap-3">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${isDarkMode ? "bg-amber-500/12 text-amber-200" : "bg-amber-100 text-amber-700"}`}>
                  <BookOpen size={22} />
                </span>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-500">Episode Notes</div>
                  <h3 className="text-lg font-bold">{episode.series}</h3>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  ["Training goal", "Give the floor clear product language they can use with customers today."],
                  ["Key topic", "Jackson/Catnapper cushion feel, Comfor-Gel, support, and wallhugger mechanics."],
                  ["Use on floor", "Play before a shift, then have each salesperson practice one simple customer explanation."],
                ].map(([label, body]) => (
                  <div key={label} className={`rounded-2xl border p-4 ${subtlePanel}`}>
                    <div className="text-sm font-bold">{label}</div>
                    <p className={`mt-1 text-sm leading-5 ${muted}`}>{body}</p>
                  </div>
                ))}
              </div>

              <div className={`mt-6 rounded-2xl border p-4 ${isDarkMode ? "border-emerald-500/20 bg-emerald-500/10" : "border-emerald-200 bg-emerald-50"}`}>
                <div className="flex items-center gap-2 text-sm font-bold">
                  <ShieldCheck size={16} />
                  Customer-safe line
                </div>
                <p className={`mt-2 text-sm leading-6 ${muted}`}>
                  Explain the feel first, then connect it to the construction: soft comfort on top, steady support underneath.
                </p>
              </div>

              <div className={`mt-6 rounded-2xl border p-4 ${isDarkMode ? "border-slate-800 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                  <Sofa size={16} />
                  Suggested floor prompt
                </div>
                <p className={`text-sm leading-6 ${muted}`}>
                  After watching, ask: how would you explain the cushion and wallhugger system to a customer in one sentence?
                </p>
              </div>
            </aside>
          </div>
        </section>
        )}
      </div>
    </div>
  );
};

export default TrainingWorkspace;
