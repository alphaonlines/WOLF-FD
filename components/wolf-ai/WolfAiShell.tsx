import { AI_BRAND } from '../../constants/aiBranding';
import WolfAiComposer from './WolfAiComposer';

const TABS = ['Playground', 'Overview', 'Timeline', 'Courses', 'Leaderboard', 'Glossary'] as const;
const THEMES = ['Ivory', 'Forest', 'Sunset'] as const;

const WolfAiShell = () => {
  return (
    <main className="min-h-screen bg-[#f7efe2] text-stone-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <aside className="hidden w-60 shrink-0 flex-col rounded-[2rem] border border-orange-100 bg-[#fffaf0] p-5 shadow-xl shadow-orange-900/5 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-950 text-lg font-black text-white">W</div>
            <div>
              <p className="text-lg font-black tracking-tight">{AI_BRAND.productName}</p>
              <p className="text-xs font-bold text-orange-700">{AI_BRAND.assistantDefaultName}</p>
            </div>
          </div>

          <div className="mt-8 space-y-3 text-sm font-bold text-stone-600">
            <p className="rounded-2xl bg-orange-50 px-4 py-3 text-orange-800">Playground</p>
            <p className="rounded-2xl px-4 py-3">Prompt lab</p>
            <p className="rounded-2xl px-4 py-3">Swarm skills</p>
            <p className="rounded-2xl px-4 py-3">Learning path</p>
          </div>

          <div className="mt-auto rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-black">Unified backend</p>
            <p className="mt-1 text-xs font-semibold opacity-80">Public WOLF AI surface, canonical Wolf Swarm routing.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="rounded-[2rem] border border-orange-100 bg-[#fffaf0]/95 p-4 shadow-xl shadow-orange-900/5 backdrop-blur">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {TABS.map(tab => (
                  <button
                    key={tab}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-black transition ${tab === 'Playground' ? 'bg-stone-950 text-white shadow-lg shadow-stone-950/10' : 'bg-white text-stone-600 hover:text-stone-950'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {THEMES.map(theme => (
                  <button
                    key={theme}
                    type="button"
                    className="rounded-full border border-orange-100 bg-white px-3 py-2 text-xs font-black text-stone-600 transition hover:border-orange-300 hover:text-orange-800"
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="py-10 text-center">
            <p className="text-xs font-black uppercase tracking-[0.4em] text-orange-700">{AI_BRAND.engineName}</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-stone-950 sm:text-6xl">Test prompts. Learn by trying.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-stone-600">
              A warm WOLF AI playground wired into the existing Wolf Swarm backend surface.
            </p>
          </div>

          <WolfAiComposer />

          <footer className="py-8 text-center text-xs font-black uppercase tracking-[0.3em] text-stone-400">
            {AI_BRAND.poweredBy}
          </footer>
        </section>
      </div>
    </main>
  );
};

export default WolfAiShell;
