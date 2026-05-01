import React, { useEffect } from "react";
import {
  BarChart2,
  BookOpen,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Database,
  MessageSquare,
  Search,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Slide } from '../../App'; // Import Slide type from App.tsx

type Props = {
  isDarkMode: boolean;
  onClose: () => void;
  highlightedElementRect: DOMRect | null;
  onStepChange: (step: number) => void;
  currentStep: number;
  totalSteps: number;
  slide: Slide;
  onPrev: () => void;
  onNext: () => void;
};

const ACCENT_CLASSES: Record<string, { icon: string; dot: string; dotActive: string; btn: string }> = {
  sky:     { icon: "text-sky-400",     dot: "bg-slate-600",     dotActive: "bg-sky-400",     btn: "bg-sky-500 hover:bg-sky-400 text-white" },
  emerald: { icon: "text-emerald-400", dot: "bg-slate-600",     dotActive: "bg-emerald-400", btn: "bg-emerald-600 hover:bg-emerald-500 text-white" },
  violet:  { icon: "text-violet-400",  dot: "bg-slate-600",     dotActive: "bg-violet-400",  btn: "bg-violet-600 hover:bg-violet-500 text-white" },
  amber:   { icon: "text-amber-400",   dot: "bg-slate-600",     dotActive: "bg-amber-400",   btn: "bg-amber-500 hover:bg-amber-400 text-slate-900" },
  rose:    { icon: "text-rose-400",    dot: "bg-slate-600",     dotActive: "bg-rose-400",    btn: "bg-rose-600 hover:bg-rose-500 text-white" },
  teal:    { icon: "text-teal-400",    dot: "bg-slate-600",     dotActive: "bg-teal-400",    btn: "bg-teal-600 hover:bg-teal-500 text-white" },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const TutorialOverlay: React.FC<Props> = ({
  isDarkMode,
  onClose,
  highlightedElementRect,
  onStepChange,
  currentStep,
  totalSteps,
  slide,
  onPrev,
  onNext,
}) => {
  useEffect(() => {
    onStepChange(currentStep);
    // Only react to actual step changes. Including onStepChange here makes the
    // overlay re-scroll every render because the parent callback is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const accent = ACCENT_CLASSES[slide.accent] ?? ACCENT_CLASSES.sky;
  const isLast = currentStep === totalSteps - 1;

  // Keep the card in the viewport even when the highlighted area is near the
  // bottom of a long dashboard page.
  const cardWidth = Math.min(520, Math.max(320, window.innerWidth - 32));
  const estimatedCardHeight = Math.min(560, window.innerHeight - 32);
  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    width: `${cardWidth}px`,
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
    left: `${Math.max(16, (window.innerWidth - cardWidth) / 2)}px`,
    top: `${Math.max(16, (window.innerHeight - estimatedCardHeight) / 2)}px`,
    zIndex: 201, // Ensure the card is above the dimming overlays
  };

  if (highlightedElementRect) {
    const gap = 20;
    const preferredLeft = highlightedElementRect.left + highlightedElementRect.width / 2 - cardWidth / 2;
    const fitsBelow = highlightedElementRect.bottom + gap + estimatedCardHeight <= window.innerHeight;
    const fitsAbove = highlightedElementRect.top - gap - estimatedCardHeight >= 0;
    const preferredTop = fitsBelow
      ? highlightedElementRect.bottom + gap
      : fitsAbove
        ? highlightedElementRect.top - gap - estimatedCardHeight
        : (window.innerHeight - estimatedCardHeight) / 2;

    cardStyle.left = `${clamp(preferredLeft, 16, window.innerWidth - cardWidth - 16)}px`;
    cardStyle.top = `${clamp(preferredTop, 16, window.innerHeight - estimatedCardHeight - 16)}px`;
  }


  return (
    <div className={`rounded-3xl border shadow-2xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}
      style={cardStyle}>
      {/* Skip / close */}
      <button
        type="button"
        onClick={onClose}
        className={`absolute right-4 top-4 rounded-full p-1.5 transition ${isDarkMode ? "text-slate-500 hover:bg-slate-800 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
        title="Skip tutorial"
      >
        <X size={16} />
      </button>

      <div className="px-8 py-7">
        {/* Icon */}
        <div className={`mb-5 ${accent.icon}`}>{slide.icon}</div>

        {/* Title + subtitle */}
        <div className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{slide.title}</div>
        <div className={`mt-2 text-sm leading-6 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{slide.subtitle}</div>

        {/* Bullets */}
        <ul className="mt-5 space-y-3">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${accent.icon.replace("text-", "bg-")}`} />
              <span className={`text-sm leading-6 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{b}</span>
            </li>
          ))}
        </ul>

        {/* Progress dots */}
        <div className="mt-7 flex items-center justify-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onStepChange(i)} // Use onStepChange from props
              className={`h-2 rounded-full transition-all duration-200 ${i === currentStep ? `w-5 ${accent.dotActive}` : `w-2 ${accent.dot}`}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentStep === 0}
            className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-0 ${isDarkMode ? "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}
          >
            <ChevronLeft size={15} /> Back
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-bold transition ${accent.btn}`}
            >
              Let's go!
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className={`inline-flex items-center gap-1.5 rounded-2xl px-6 py-2.5 text-sm font-bold transition ${accent.btn}`}
            >
              Next <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>  );
};

export default TutorialOverlay;
