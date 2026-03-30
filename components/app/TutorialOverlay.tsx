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
  }, [currentStep, onStepChange]);

  const accent = ACCENT_CLASSES[slide.accent] ?? ACCENT_CLASSES.sky;
  const isLast = currentStep === totalSteps - 1;

  // Calculate dynamic position for the tutorial card
  const cardStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 201, // Ensure the card is above the dimming overlays
  };

  if (highlightedElementRect) {
    // Basic logic to position the card below or above the highlighted element
    // Adjust as needed for more sophisticated placement
    if (highlightedElementRect.top > window.innerHeight / 2) {
      // If element is in the bottom half, place card above it
      cardStyle.bottom = `${window.innerHeight - highlightedElementRect.top + 20}px`;
      cardStyle.top = 'auto';
      cardStyle.left = `${highlightedElementRect.left + highlightedElementRect.width / 2}px`;
      cardStyle.transform = 'translateX(-50%)';
    } else {
      // If element is in the top half, place card below it
      cardStyle.top = `${highlightedElementRect.bottom + 20}px`;
      cardStyle.left = `${highlightedElementRect.left + highlightedElementRect.width / 2}px`;
      cardStyle.transform = 'translateX(-50%)';
      cardStyle.bottom = 'auto';
    }
    // Prevent card from going off screen horizontally
    if (highlightedElementRect.left + highlightedElementRect.width / 2 < window.innerWidth / 4) {
      cardStyle.left = '25%';
    } else if (highlightedElementRect.left + highlightedElementRect.width / 2 > window.innerWidth * 3 / 4) {
      cardStyle.left = '75%';
    }
  }


  return (
    <div className={`relative w-full max-w-lg rounded-3xl border shadow-2xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}
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

      <div className="px-8 py-8">
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
