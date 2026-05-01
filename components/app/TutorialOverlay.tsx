import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bot, ChevronLeft, ChevronRight, X } from 'lucide-react';

type TutorialSlide = {
  title?: string;
  description?: string;
  body?: string;
  tips?: string[];
};

interface TutorialOverlayProps {
  isDarkMode: boolean;
  onClose: () => void;
  highlightedElementRect: DOMRect | null;
  onStepChange?: (step: number) => void;
  currentStep: number;
  totalSteps: number;
  slide: TutorialSlide;
  onPrev: () => void;
  onNext: () => void;
}

const CARD_WIDTH = 390;
const CARD_MARGIN = 24;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  isDarkMode,
  onClose,
  highlightedElementRect,
  currentStep,
  totalSteps,
  slide,
  onPrev,
  onNext,
}) => {
  const cardPosition = useMemo(() => {
    if (typeof window === 'undefined') {
      return { left: CARD_MARGIN, top: CARD_MARGIN };
    }

    if (!highlightedElementRect) {
      return {
        left: clamp(window.innerWidth - CARD_WIDTH - CARD_MARGIN, CARD_MARGIN, window.innerWidth - CARD_WIDTH - CARD_MARGIN),
        top: Math.max(CARD_MARGIN, window.innerHeight - 360),
      };
    }

    const preferRight = highlightedElementRect.right + CARD_WIDTH + CARD_MARGIN < window.innerWidth;
    const preferLeft = highlightedElementRect.left - CARD_WIDTH - CARD_MARGIN > CARD_MARGIN;
    const left = preferRight
      ? highlightedElementRect.right + CARD_MARGIN
      : preferLeft
        ? highlightedElementRect.left - CARD_WIDTH - CARD_MARGIN
        : clamp(highlightedElementRect.left, CARD_MARGIN, window.innerWidth - CARD_WIDTH - CARD_MARGIN);

    const top = clamp(
      highlightedElementRect.top + highlightedElementRect.height / 2 - 130,
      CARD_MARGIN,
      Math.max(CARD_MARGIN, window.innerHeight - 320),
    );

    return { left, top };
  }, [highlightedElementRect]);

  const isFinalStep = currentStep >= totalSteps - 1;
  const description = slide.description || slide.body || 'Follow the highlighted area and BotBot will walk you through this step.';

  return (
    <motion.div
      className="fixed inset-0 z-[210] pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="fixed pointer-events-auto max-w-[calc(100vw-32px)]"
        style={{ left: cardPosition.left, top: cardPosition.top, width: CARD_WIDTH }}
      >
        <div className="relative">
          <div className={`rounded-3xl px-6 py-5 shadow-2xl ${isDarkMode ? 'bg-slate-950/95 border border-slate-700 text-white' : 'bg-white/95 border border-slate-200 text-slate-950'}`}>
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-2xl bg-sky-500 p-2.5 text-white shadow-lg shadow-sky-500/30">
                <Bot size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-semibold uppercase tracking-[0.24em] ${isDarkMode ? 'text-sky-300' : 'text-sky-600'}`}>
                  BotBot guide
                </div>
                <h3 className="mt-1 text-lg font-bold leading-tight">
                  {slide.title || `Step ${currentStep + 1}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-full p-2 transition ${isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                aria-label="Close tutorial"
              >
                <X size={18} />
              </button>
            </div>

            <p className={`mt-4 text-sm font-medium leading-relaxed ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>
              {description}
            </p>

            {Array.isArray(slide.tips) && slide.tips.length > 0 && (
              <div className={`mt-4 rounded-2xl px-4 py-3 ${isDarkMode ? 'bg-slate-900/80 text-slate-300' : 'bg-sky-50 text-slate-700'}`}>
                {slide.tips.slice(0, 2).map((tip, index) => (
                  <p key={`${tip}-${index}`} className="text-xs leading-relaxed">
                    {tip}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 rounded-full transition-all ${index === currentStep ? 'w-6 bg-sky-500' : isDarkMode ? 'w-1.5 bg-slate-700' : 'w-1.5 bg-slate-300'}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={onPrev}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <ChevronLeft size={14} />
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={onNext}
                  className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-600"
                >
                  {isFinalStep ? 'Finish' : 'Next'}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className={`mt-3 text-right text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Step {currentStep + 1} of {totalSteps}
            </div>

            <div
              className="absolute -bottom-3 right-12 h-0 w-0"
              style={{
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderTop: `12px solid ${isDarkMode ? '#020617' : '#ffffff'}`,
                filter: isDarkMode ? '' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
              }}
            />
          </div>

          <motion.div
            className="absolute -right-7 -bottom-20 z-10"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="rounded-full border-4 border-sky-400 bg-sky-500 p-4 text-white shadow-xl shadow-sky-500/30">
              <Bot size={38} />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TutorialOverlay;
