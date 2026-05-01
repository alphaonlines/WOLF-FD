import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bot, ChevronRight, X } from 'lucide-react';

type TutorialSlide = {
  title?: string;
  description?: string;
  body?: string;
  tips?: string[];
};

export type TutorialAction = {
  id: string;
  label: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
};

interface TutorialOverlayProps {
  isDarkMode: boolean;
  onClose: () => void;
  highlightedElementRect: DOMRect | null;
  currentStep: number;
  totalSteps: number;
  slide: TutorialSlide;
  actions: TutorialAction[];
  isAwaitingAction?: boolean;
  eyebrowLabel?: string;
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
  actions,
  isAwaitingAction = false,
  eyebrowLabel = 'Tutorial',
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
    const centerX = highlightedElementRect.left + highlightedElementRect.width / 2;
    const left = preferRight
      ? highlightedElementRect.right + CARD_MARGIN
      : preferLeft
        ? highlightedElementRect.left - CARD_WIDTH - CARD_MARGIN
        : clamp(
            centerX - CARD_WIDTH / 2,
            CARD_MARGIN,
            window.innerWidth - CARD_WIDTH - CARD_MARGIN,
          );

    const visibleTop = Math.max(highlightedElementRect.top, CARD_MARGIN);
    const visibleBottom = Math.min(highlightedElementRect.bottom, window.innerHeight - CARD_MARGIN);
    const visibleHeight = Math.max(visibleBottom - visibleTop, 0);
    const anchorY = visibleHeight > 0
      ? visibleTop + visibleHeight / 2
      : highlightedElementRect.top + highlightedElementRect.height / 2;

    const isLargeTarget = highlightedElementRect.height > window.innerHeight * 0.75;
    const visibleTopClamp = Math.max(highlightedElementRect.top, CARD_MARGIN);
    const topAlignedAnchor = isLargeTarget
      ? visibleTopClamp + Math.min(visibleHeight * 0.18, 140)
      : anchorY;
    const adjustedAnchorY = isLargeTarget
      ? clamp(topAlignedAnchor, CARD_MARGIN + 40, window.innerHeight - 220)
      : anchorY;

    const top = clamp(
      adjustedAnchorY - 130,
      CARD_MARGIN,
      Math.max(CARD_MARGIN, window.innerHeight - 320),
    );

    return { left, top };
  }, [highlightedElementRect]);

  const description = slide.description || slide.body || 'Follow the highlighted area and BotBot will walk you through this step.';
  const actionCount = actions.length;
  const shouldShowTargetPulse = Boolean(highlightedElementRect);
  const shouldPulseTarget = isAwaitingAction && shouldShowTargetPulse;

  return (
    <motion.div
      className="fixed inset-0 z-[210] pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {highlightedElementRect ? (
        <>
          <div
            className="fixed inset-x-0 top-0 bg-slate-950/90 backdrop-blur-md"
            style={{ height: Math.max(0, highlightedElementRect.top - 18) }}
          />
          <div
            className="fixed left-0 bg-slate-950/90 backdrop-blur-md"
            style={{
              top: Math.max(0, highlightedElementRect.top - 18),
              width: Math.max(0, highlightedElementRect.left - 18),
              height: (highlightedElementRect.height || 0) + 36,
            }}
          />
          <div
            className="fixed right-0 bg-slate-950/90 backdrop-blur-md"
            style={{
              top: Math.max(0, highlightedElementRect.top - 18),
              width: Math.max(0, window.innerWidth - highlightedElementRect.right - 18),
              height: (highlightedElementRect.height || 0) + 36,
            }}
          />
          <div
            className="fixed inset-x-0 bottom-0 bg-slate-950/95 backdrop-blur-md"
            style={{ top: highlightedElementRect.bottom + 18 }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/95 to-slate-950/98 backdrop-blur-lg" />
      )}

      {shouldShowTargetPulse && (
        <motion.div
          key={`botbot-tutorial-target-${Math.round(highlightedElementRect?.top || 0)}-${Math.round(highlightedElementRect?.left || 0)}`}
          className="fixed rounded-2xl border-2 border-sky-300/95 bg-sky-500/20 pointer-events-none z-[211]"
          style={{
            left: (highlightedElementRect?.left || 0) - 8,
            top: (highlightedElementRect?.top || 0) - 8,
            width: (highlightedElementRect?.width || 0) + 16,
            height: (highlightedElementRect?.height || 0) + 16,
          }}
          initial={{ opacity: 0.35, scale: 0.985, boxShadow: '0 0 0 0 rgba(56,189,248,0)' }}
        animate={shouldPulseTarget
          ? {
                opacity: [0.4, 0.82, 0.4],
                scale: [0.985, 1.025, 0.985],
                boxShadow: [
                  '0 0 0 0 rgba(56,189,248,0.4)',
                  '0 0 0 18px rgba(56,189,248,0.15)',
                  '0 0 0 0 rgba(56,189,248,0)',
                ],
            }
          : {
                opacity: 0.52,
                scale: 1,
                boxShadow: '0 0 0 0 rgba(56,189,248,0.3)',
              }}
          transition={shouldPulseTarget ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
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
                  {eyebrowLabel}
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
              {isAwaitingAction ? `${description} I’m waiting for you.` : description}
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
                {actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={action.disabled}
                    onClick={action.onClick}
                    className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                      action.variant === 'danger'
                        ? isDarkMode
                          ? 'bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50'
                          : 'bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-50'
                        : action.variant === 'secondary'
                          ? isDarkMode
                            ? 'border border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800'
                            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                          : isDarkMode
                            ? 'bg-sky-500 hover:bg-sky-400 text-white disabled:opacity-50'
                            : 'bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50'
                    }`}
                  >
                    {action.label}
                    {!action.disabled && action.variant === 'primary' && <ChevronRight size={14} />}
                  </button>
                ))}
                {actionCount === 0 && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Close
                  </button>
                )}
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

        </div>
      </motion.div>
    </motion.div>
  );
};

export default TutorialOverlay;
