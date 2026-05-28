import React from "react";
import { Calculator, ExternalLink, HelpCircle } from "lucide-react";
import { APP_VERSION } from "../constants";

type SmartPricingCalculatorPageProps = {
  isDarkMode: boolean;
};

const SMART_CALC_TOOL_URL = `${import.meta.env.BASE_URL}tools/smart-pricing-calculator.html`;
const SMART_CALC_VERSION_MANIFEST_URL = `${import.meta.env.BASE_URL}smartcalc/version.json`;

function smartCalcUrlForVersion(version: string): string {
  return `${SMART_CALC_TOOL_URL}?v=${encodeURIComponent(version)}`;
}

function cleanManifestVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const SmartPricingCalculatorPage: React.FC<SmartPricingCalculatorPageProps> = ({ isDarkMode }) => {
  const [calculatorUrl, setCalculatorUrl] = React.useState(() => smartCalcUrlForVersion(APP_VERSION));
  const calculatorFrameRef = React.useRef<HTMLIFrameElement | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const fallbackUrl = smartCalcUrlForVersion(APP_VERSION);
    const manifestUrl = `${SMART_CALC_VERSION_MANIFEST_URL}?ts=${Date.now()}`;

    fetch(manifestUrl, { cache: "no-store", credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(`Smart Calc manifest returned ${response.status}`);
        return response.json() as Promise<{ version?: unknown; displayVersion?: unknown }>;
      })
      .then((manifest) => {
        const runtimeVersion = cleanManifestVersion(manifest.version) ?? cleanManifestVersion(manifest.displayVersion) ?? APP_VERSION;
        if (!cancelled) setCalculatorUrl(smartCalcUrlForVersion(runtimeVersion));
      })
      .catch(() => {
        if (!cancelled) setCalculatorUrl(fallbackUrl);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const startTutorial = () => {
    calculatorFrameRef.current?.contentWindow?.postMessage(
      { type: "FD_SMART_CALC_START_TUTORIAL" },
      window.location.origin,
    );
  };
  const mutedClassName = isDarkMode ? "text-slate-400" : "text-slate-600";
  const headingClassName = isDarkMode ? "text-white" : "text-slate-950";
  const iconClassName = isDarkMode
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const frameClassName = isDarkMode
    ? "border-slate-800 bg-slate-950 shadow-[0_18px_45px_rgba(2,6,23,0.28)]"
    : "border-slate-200 bg-white shadow-sm";
  const toolbarClassName = isDarkMode
    ? "border-slate-800 bg-slate-950/95"
    : "border-slate-200 bg-white/95";
  const actionClassName = isDarkMode
    ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white";

  return (
    <div className="p-2 sm:p-3 lg:p-0">
      <section className={`flex h-[calc(100vh-8rem)] min-h-[760px] w-full flex-col overflow-hidden rounded-lg border lg:h-[calc(100vh-8.5rem)] lg:min-h-[860px] ${frameClassName}`}>
        <div className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${toolbarClassName}`}>
          <div className="flex min-w-0 items-center gap-3">
            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${iconClassName}`}>
              <Calculator size={18} />
            </span>
            <div className="min-w-0">
              <h2 className={`text-base font-semibold ${headingClassName}`}>Smart Calc</h2>
              <p className={`text-xs ${mutedClassName}`}>Cost, margin, delivery, tax, protection, and financing.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="smartcalc-parent-tutorial-btn"
              type="button"
              onClick={startTutorial}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${actionClassName}`}
            >
              <HelpCircle size={14} />
              Start guided tutorial
            </button>
            <a
              href={calculatorUrl}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${actionClassName}`}
            >
              <ExternalLink size={14} />
              Open full page
            </a>
          </div>
        </div>
        <iframe
          ref={calculatorFrameRef}
          title="Smart Calc"
          src={calculatorUrl}
          data-smartcalc-runtime-manifest="true"
          className="min-h-0 w-full flex-1 border-0"
        />
      </section>
    </div>
  );
};

export default SmartPricingCalculatorPage;
