import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, ChevronLeft, ChevronRight, X } from 'lucide-react';

// Legacy module overlay retained for reference. Live tours now use the shared BotBotTutorial engine.
export type ModuleTourStep = {
  target?: string;
  targetSelector?: string;
  selector?: string;
  title?: string;
  description?: string;
  body?: string;
  placement?: 'top' | 'right' | 'bottom' | 'left' | 'center';
};

interface ModuleTourOverlayProps {
  steps: ModuleTourStep[];
  isDarkMode: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const CARD_WIDTH = 390;
const CARD_MARGIN = 24;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getStepTarget = (step: ModuleTourStep) => step.targetSelector || step.selector || step.target || '';

const ModuleTourOverlay: React.FC<ModuleTourOverlayProps> = ({ steps, isDarkMode, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = steps[currentStep] || steps[0];
  const totalSteps = Math.max(steps.length, 1);
  const isFinalStep = currentStep >= totalSteps - 1;

  useEffect(() => {
    if (!step || typeof window === 'undefined') {
      setTargetRect(null);
      return;
    }

    const selector = getStepTarget(step);
    const target = selector ? document.querySelector(selector) : null;

    if (!target) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => setTargetRect(target.getBoundingClientRect());
    updateRect();
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [step]);

  const highlightRect = useMemo(() => {
    if (!targetRect) return null;
    const padding = 10;
    return {
      top: Math.max(0, targetRect.top - padding),
      left: Math.max(0, targetRect.left - padding),
      right: Math.min(window.innerWidth, targetRect.right + padding),
      bottom: Math.min(window.innerHeight, targetRect.bottom + padding),
    };
  }, [targetRect]);

  const cardPosition = useMemo(() => {
    if (typeof window === 'undefined') {
      return { left: CARD_MARGIN, top: CARD_MARGIN };
    }

    if (!targetRect || step?.placement === 'center') {
      return {
        left: clamp((window.innerWidth - CARD_WIDTH) / 2, CARD_MARGIN, window.innerWidth - CARD_WIDTH - CARD_MARGIN),
        top: clamp(window.innerHeight * 0.5 - 160, CARD_MARGIN, window.innerHeight - 340),
      };
    }

    const placement = step?.placement;
    const canRight = targetRect.right + CARD_WIDTH + CARD_MARGIN < window.innerWidth;
    const canLeft = targetRect.left - CARD_WIDTH - CARD_MARGIN > CARD_MARGIN;
    const canBottom = targetRect.bottom + 300 < window.innerHeight;

    if (placement === 'left' && canLeft) {
      return { left: targetRect.left - CARD_WIDTH - CARD_MARGIN, top: clamp(targetRect.top, CARD_MARGIN, window.innerHeight - 340) };
    }

    if (placement === 'bottom' && canBottom) {
      return { left: clamp(targetRect.left, CARD_MARGIN, window.innerWidth - CARD_WIDTH - CARD_MARGIN), top: targetRect.bottom + CARD_MARGIN };
    }

    if ((placement === 'right' || !placement) && canRight) {
      return { left: targetRect.right + CARD_MARGIN, top: clamp(targetRect.top, CARD_MARGIN, window.innerHeight - 340) };
    }

    if (canLeft) {
      return { left: targetRect.left - CARD_WIDTH - CARD_MARGIN, top: clamp(targetRect.top, CARD_MARGIN, window.innerHeight - 340) };
    }

    return {
      left: clamp(targetRect.left, CARD_MARGIN, window.innerWidth - CARD_WIDTH - CARD_MARGIN),
      top: canBottom ? targetRect.bottom + CARD_MARGIN : clamp(targetRect.top - 300, CARD_MARGIN, window.innerHeight - 340),
    };
  }, [targetRect, step]);

  const handleNext = () => {
    if (isFinalStep) {
      onComplete();
      return;
    }
    setCurrentStep((value) => Math.min(value + 1, totalSteps - 1));
  };

  const handlePrev = () => setCurrentStep((value) => Math.max(value - 1, 0));
  const description = step?.description || step?.body || 'BotBot will walk you through this part of the workspace.';

  if (!step) return null;

  return (
      <motion.div
        className="fixed inset-0 z-[240] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
      <div className="fixed inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/92 to-slate-950/94 backdrop-blur-md" />

      {highlightRect && (
        <div
          className="fixed rounded-3xl border-2 border-sky-300 shadow-[0_0_34px_rgba(56,189,248,0.65)]"
          style={{
            left: highlightRect.left,
            top: highlightRect.top,
            width: highlightRect.right - highlightRect.left,
            height: highlightRect.bottom - highlightRect.top,
          }}
        />
      )}

      {highlightRect && (
        <motion.div
          className="fixed rounded-3xl border border-sky-300/40"
          style={{
            left: Math.max(0, highlightRect.left - 12),
            top: Math.max(0, highlightRect.top - 12),
            width: highlightRect.width + 24,
            height: highlightRect.height + 24,
          }}
          initial={{ opacity: 0.2, scale: 0.985, boxShadow: '0 0 0 0 rgba(56,189,248,0)' }}
          animate={{
            opacity: [0.2, 0.48, 0.2],
            scale: [0.985, 1.02, 0.985],
            boxShadow: [
              '0 0 0 0 rgba(56,189,248,0.22)',
              '0 0 0 20px rgba(56,189,248,0.12)',
              '0 0 0 0 rgba(56,189,248,0)',
            ],
          }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

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
                  BotBot module guide
                </div>
                <h3 className="mt-1 text-lg font-bold leading-tight">
                  {step.title || `Step ${currentStep + 1}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-full p-2 transition ${isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                aria-label="Close module tour"
              >
                <X size={18} />
              </button>
            </div>

            <p className={`mt-4 text-sm font-medium leading-relaxed ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>
              {description}
            </p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {steps.map((_, index) => (
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
                    onClick={handlePrev}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <ChevronLeft size={14} />
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
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

export default ModuleTourOverlay;
