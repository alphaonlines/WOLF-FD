import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot } from 'lucide-react';

type BotBotTutorialProps = {
  isDarkMode: boolean;
  userName: string;
  onComplete: () => void;
  onSkip: () => void;
};

type TutorialStep = {
  spotlightX: number;
  spotlightY: number;
  spotlightSize: number;
  message: string;
  messageX: number;
  messageY: number;
};

const STEPS_LENGTH = 8;

const BotBotTutorial: React.FC<BotBotTutorialProps> = ({ isDarkMode, userName, onComplete, onSkip }) => {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [blur, setBlur] = useState(true);

  const getNavSpotlight = (
    label: string,
    fallback: Pick<TutorialStep, 'spotlightX' | 'spotlightY' | 'spotlightSize'>
  ) => {
    if (typeof document === 'undefined') return fallback;
    const sidebar = document.querySelector('aside');
    if (!sidebar) return fallback;

    const targets = Array.from(sidebar.querySelectorAll('button, a'));
    const match = targets.find((node) => {
      const text = node.textContent?.trim() ?? '';
      const title = node.getAttribute('title')?.trim() ?? '';
      return text.includes(label) || title === label;
    });

    if (!match) return fallback;

    const rect = match.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) / 2 + 20;

    return {
      spotlightX: rect.left + rect.width / 2,
      spotlightY: rect.top + rect.height / 2,
      spotlightSize: size,
    };
  };

  const STEPS: TutorialStep[] = [
    // Step 0: Intro
    {
      spotlightX: 80,
      spotlightY: 100,
      spotlightSize: 96,
      message: "Hey! I'm BotBot, your AI assistant. Click Next to start!",
      messageX: 32,
      messageY: 320,
    },
    // Step 1: Click hamburger to open sidebar
    {
      spotlightX: 64,
      spotlightY: 64,
      spotlightSize: 120,
      message: "Click the menu icon to expand the sidebar.",
      messageX: 200,
      messageY: 200,
    },
    // Step 2: Click Pulse
    {
      ...getNavSpotlight('Pulse', {
        spotlightX: 80,
        spotlightY: 260,
        spotlightSize: 100,
      }),
      message: "Now click on Pulse.",
      messageX: 200,
      messageY: 400,
    },
    // Step 3: Pulse module pages in header
    {
      spotlightX: window.innerWidth / 2 + 100,
      spotlightY: -30,
      spotlightSize: 300,
      message: "Here are your pages within the Pulse module and other tools for the module.",
      messageX: window.innerWidth / 2 - 180,
      messageY: 200,
    },
    // Step 4: Click Den
    {
      ...getNavSpotlight('Den', {
        spotlightX: 80,
        spotlightY: 240,
        spotlightSize: 100,
      }),
      message: "Now click on Den.",
      messageX: 200,
      messageY: 280,
    },
    // Step 5: Main content area
    {
      spotlightX: window.innerWidth / 2 + 150,
      spotlightY: window.innerHeight / 2,
      spotlightSize: 250,
      message: "This is where your main content lives. You can customize this later.",
      messageX: window.innerWidth / 2 - 200,
      messageY: window.innerHeight / 2 + 160,
    },
    // Step 6: BotBot position
    {
      spotlightX: window.innerWidth - 64,
      spotlightY: window.innerHeight - 64,
      spotlightSize: 100,
      message: "Click me anytime you need help!",
      messageX: window.innerWidth - 380,
      messageY: window.innerHeight - 200,
    },
    // Step 7: Theme toggle (LAST)
    {
      spotlightX: window.innerWidth - 80,
      spotlightY: 48,
      spotlightSize: 100,
      message: "Theme toggle up here to switch light/dark mode.",
      messageX: window.innerWidth - 400,
      messageY: 180,
    },
  ];

  const currentStep = STEPS[step];

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setBlur(false);
      setTimeout(onComplete, 500);
    }
  };

  const handleClickWithAction = () => {
    if (step === 0) {
      handleNext();
    } else if (step === 1) {
      // Click hamburger to open sidebar
      const menuBtn = document.querySelector('button[aria-label="Toggle sidebar"]') as HTMLButtonElement | null;
      if (menuBtn) {
        menuBtn.click();
      }
      // Wait longer for sidebar animation to complete
      setTimeout(() => {
        handleNext();
      }, 600);
    } else if (step === 2) {
      // Click Pulse - look specifically in the sidebar nav area
      const sidebar = document.querySelector('aside');
      if (sidebar) {
        const buttons = sidebar.querySelectorAll('button');
        let pulseBtn: HTMLButtonElement | null = null;
        buttons.forEach((btn) => {
          if (btn.textContent?.includes('Pulse')) {
            pulseBtn = btn as HTMLButtonElement;
          }
        });
        if (pulseBtn) {
          pulseBtn.click();
        }
      }
      // Close sidebar after clicking Pulse
      setTimeout(() => {
        const menuBtn = document.querySelector('button[aria-label="Toggle sidebar"]') as HTMLButtonElement | null;
        if (menuBtn) {
          menuBtn.click();
        }
        // After sidebar closes, advance to next step
        setTimeout(() => {
          handleNext();
        }, 400);
      }, 300);
    } else if (step === 4) {
      // First open the sidebar (it may be closed from previous steps)
      const menuBtn = document.querySelector('button[aria-label="Toggle sidebar"]') as HTMLButtonElement | null;
      if (menuBtn) {
        menuBtn.click();
      }
      // Wait for sidebar to open, then click Den
      setTimeout(() => {
        const sidebar = document.querySelector('aside');
        if (sidebar) {
          const buttons = sidebar.querySelectorAll('button');
          let denBtn: HTMLButtonElement | null = null;
          buttons.forEach((btn) => {
            if (btn.textContent?.includes('Den')) {
              denBtn = btn as HTMLButtonElement;
            }
          });
          if (denBtn) {
            denBtn.click();
          }
        }
        // Close sidebar after clicking Den
        setTimeout(() => {
          const closeBtn = document.querySelector('button[aria-label="Toggle sidebar"]') as HTMLButtonElement | null;
          if (closeBtn) {
            closeBtn.click();
          }
          // After sidebar closes, advance to next step
          setTimeout(() => {
            handleNext();
          }, 400);
        }, 300);
      }, 400);
    } else {
      handleNext();
    }
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999]"
    >
      {/* Dark overlay with circular mask cut-out */}
      {blur && (
        <svg
          className="fixed inset-0 pointer-events-none z-[500]"
          style={{
            opacity: 1,
            width: '100%',
            height: '100%',
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <motion.circle
                animate={{
                  cx: currentStep.spotlightX,
                  cy: currentStep.spotlightY,
                  r: step === 0 ? 0 : currentStep.spotlightSize,
                }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(2,6,23,0.9)"
            mask="url(#spotlight-mask)"
            pointerEvents="none"
          />
        </svg>
      )}

      {/* Clickable zone for highlighted element */}
      {currentStep && blur && (
        <motion.div
          animate={{
            width: currentStep.spotlightSize * 2 + 40,
            height: currentStep.spotlightSize * 2 + 40,
          }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed pointer-events-auto z-[1000] cursor-pointer"
          style={{
            left: currentStep.spotlightX,
            top: currentStep.spotlightY,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
          }}
          onClick={handleClickWithAction}
        />
      )}

      {/* Message bubble */}
      <motion.div
        key={`message-${step}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: blur ? 1 : 0, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
        className="fixed max-w-sm pointer-events-auto z-[1000]"
        style={{
          left: currentStep.messageX,
          top: currentStep.messageY,
        }}
      >
        <div className="relative">
          <div className={`rounded-3xl px-6 py-4 shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}>
            <p className={`text-base font-medium leading-relaxed ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {currentStep.message}
            </p>

            {/* Button */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="flex gap-2">
                {step < STEPS.length - 1 && (
                  <button
                    onClick={handleClickWithAction}
                    className="rounded-full bg-sky-500 hover:bg-sky-600 text-white px-4 py-1.5 text-xs font-semibold transition"
                  >
                    Next →
                  </button>
                )}
                <button
                  onClick={onSkip}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Skip
                </button>
              </div>
              {/* Step counter */}
              <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Step {step + 1} of {STEPS_LENGTH}
              </span>
            </div>

            {/* Tail pointer pointing down toward the orb */}
            <div
              style={{
                position: 'absolute',
                bottom: -12,
                right: 24,
                width: 0,
                height: 0,
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderTop: `12px solid ${isDarkMode ? '#0f172a' : '#ffffff'}`,
                filter: isDarkMode ? '' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
              }}
            />
          </div>
        </div>

          {/* BotBot icon at corner - same size all steps */}
          <div className="absolute -right-8 z-10" style={{ bottom: '-120px' }}>
            <div className="bg-sky-500 rounded-full shadow-xl border-4 border-sky-400 p-6">
              <Bot size={56} className="text-white" />
            </div>
          </div>
      </motion.div>

      {/* Final step: BotBot icon pulsing in bottom right */}
      {step === STEPS.length - 1 && blur && (
        <motion.div
          className="fixed bottom-8 right-8 z-[1001]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <motion.button
            onClick={handleNext}
            animate={{
              scale: [1, 1.1, 1],
              boxShadow: [
                '0 0 0 0 rgba(59,130,246,0.6)',
                '0 0 0 20px rgba(59,130,246,0)',
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg hover:shadow-xl transition-shadow"
          >
            <Bot size={32} />
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default BotBotTutorial;
