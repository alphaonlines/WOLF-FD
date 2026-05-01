import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type ModuleTourStep = {
  targetId: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
};

type Props = {
  steps: ModuleTourStep[];
  isDarkMode?: boolean;
  onClose: () => void;
  onComplete: () => void;
};

const getTargetRect = (targetId: string) => {
  if (typeof document === "undefined") return null;
  const element = document.querySelector(`[data-tour-id="${targetId}"]`);
  return element?.getBoundingClientRect() ?? null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ModuleTourOverlay: React.FC<Props> = ({ steps, isDarkMode = false, onClose, onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!step) return;
    const updateTarget = () => {
      const element = document.querySelector(`[data-tour-id="${step.targetId}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      window.setTimeout(() => setTargetRect(getTargetRect(step.targetId)), 220);
    };

    updateTarget();
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [stepIndex, step]);

  if (!step) return null;

  const fallbackRect = {
    left: window.innerWidth / 2 - 120,
    top: window.innerHeight / 2 - 80,
    right: window.innerWidth / 2 + 120,
    bottom: window.innerHeight / 2 + 80,
    width: 240,
    height: 160,
  } as DOMRect;
  const rect = targetRect ?? fallbackRect;
  const gap = 18;
  const highlightPadding = 10;
  const highlightLeft = Math.max(0, rect.left - highlightPadding);
  const highlightTop = Math.max(0, rect.top - highlightPadding);
  const highlightRight = Math.min(window.innerWidth, rect.right + highlightPadding);
  const highlightBottom = Math.min(window.innerHeight, rect.bottom + highlightPadding);
  const highlightWidth = Math.max(0, highlightRight - highlightLeft);
  const highlightHeight = Math.max(0, highlightBottom - highlightTop);
  const viewportMargin = 16;
  const cardWidth = Math.min(360, window.innerWidth - viewportMargin * 2);
  const estimatedCardHeight = Math.min(280, window.innerHeight - viewportMargin * 2);
  const cardLeft = clamp(
    rect.left + rect.width / 2 - cardWidth / 2,
    viewportMargin,
    window.innerWidth - cardWidth - viewportMargin,
  );
  const spaceBelow = window.innerHeight - rect.bottom - gap - viewportMargin;
  const spaceAbove = rect.top - gap - viewportMargin;
  const verticalTop = rect.top + rect.height / 2 - estimatedCardHeight / 2;
  const preferredTop =
    step.placement === "top" ? rect.top - estimatedCardHeight - gap :
    step.placement === "bottom" ? rect.bottom + gap :
    step.placement === "left" || step.placement === "right" ? verticalTop :
    spaceBelow >= estimatedCardHeight || spaceBelow >= spaceAbove ? rect.bottom + gap :
    rect.top - estimatedCardHeight - gap;
  const cardTop = clamp(preferredTop, viewportMargin, window.innerHeight - estimatedCardHeight - viewportMargin);

  const finish = () => {
    onComplete();
  };
  const dimPanelAnimation = "fdTutorialDimIn 220ms ease-out both";

  return (
    <div className="fixed inset-0 z-[950]">
      <style>
        {`@keyframes fdTutorialDimIn { from { opacity: 0; } to { opacity: 1; } }`}
      </style>
      <div className="absolute inset-x-0 top-0 bg-black/85 backdrop-blur-[2px]" style={{ height: highlightTop, animation: dimPanelAnimation }} />
      <div className="absolute inset-x-0 bottom-0 bg-black/85 backdrop-blur-[2px]" style={{ top: highlightBottom, animation: dimPanelAnimation }} />
      <div
        className="absolute left-0 bg-black/85 backdrop-blur-[2px]"
        style={{ top: highlightTop, width: highlightLeft, height: highlightHeight, animation: dimPanelAnimation }}
      />
      <div
        className="absolute right-0 bg-black/85 backdrop-blur-[2px]"
        style={{ top: highlightTop, left: highlightRight, height: highlightHeight, animation: dimPanelAnimation }}
      />
      <div
        className="pointer-events-none absolute rounded-2xl border-2 border-sky-300 bg-transparent shadow-[0_0_32px_rgba(56,189,248,0.55)] transition-all"
        style={{
          left: highlightLeft,
          top: highlightTop,
          width: highlightWidth,
          height: highlightHeight,
        }}
      />
      <div
        className={`absolute flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border p-5 shadow-2xl ${
          isDarkMode ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
        style={{ left: cardLeft, top: cardTop, width: cardWidth }}
      >
        <button
          type="button"
          onClick={onClose}
          className={`absolute right-3 top-3 rounded-full p-1.5 ${
            isDarkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
          }`}
          aria-label="Close tour"
        >
          <X size={16} />
        </button>
        <div className="min-h-0 overflow-y-auto pr-8">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-500">
            Step {stepIndex + 1} of {steps.length}
          </div>
          <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
          <p className={`mt-2 text-sm leading-6 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {step.body}
          </p>
        </div>
        <div className="mt-5 flex shrink-0 items-center justify-between gap-3">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-35 ${
              isDarkMode ? "border-slate-700 text-slate-200" : "border-slate-200 text-slate-700"
            }`}
          >
            <ChevronLeft size={14} /> Back
          </button>
          <button
            type="button"
            onClick={() => (isLast ? finish() : setStepIndex((current) => current + 1))}
            className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white hover:bg-sky-600"
          >
            {isLast ? "Finish" : "Next"} {!isLast && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModuleTourOverlay;
