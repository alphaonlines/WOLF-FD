import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TutorialOverlay from '../app/TutorialOverlay';
import type { Tab } from '../app/tabs';

type BotBotPulseSubTab = 'sales' | 'alphaos' | 'alphapulse' | 'website' | 'reviews';
type BotBotWolfdenSubTab = 'ups' | 'crm' | 'board' | 'meeting' | 'tasks';

type AdvanceRule =
  | { type: 'manual' }
  | { type: 'state'; check: (state: BotBotTutorialState) => boolean };

export type BotBotTutorialState = {
  sidebarOpen?: boolean;
  activeTab?: Tab;
  requestedPulseSubTab?: BotBotPulseSubTab;
  currentPulseSubTab?: BotBotPulseSubTab;
  requestedWolfdenSubTab?: BotBotWolfdenSubTab;
  [key: string]: unknown;
};

export type BotBotTutorialStep = {
  id: string;
  title: string;
  message: string;
  highlightId?: string;
  actionTargetId?: string;
  highlightOnAction?: boolean;
  pulseHighlight?: boolean;
  advanceOnHighlightClick?: boolean;
  suppressWaitingCopy?: boolean;
  scope?: 'launch' | 'module';
  requiredModules?: string[];
  advanceWhen: AdvanceRule;
  primaryActionLabel?: string;
  isTerminal?: boolean;
};

type BotBotTutorialProps = {
  isDarkMode: boolean;
  userName?: string;
  steps: BotBotTutorialStep[];
  state: BotBotTutorialState;
  onComplete: () => void;
  onSkip: () => void;
  onRestart?: () => void;
  onHelp?: () => void;
  eyebrowLabel?: string;
};

const BOTBOT_TUTORIAL_ATTEMPT_TOLERANCE = 3;
const TARGET_MISSING_MESSAGE = 'I can’t find that right now';
const BOTBOT_MAIN_CONTENT_HIGHLIGHT_ID = 'botbot-main-content';
const MAX_TARGET_HEIGHT_RATIO = 0.72;
const MAX_TARGET_WIDTH_RATIO = 0.88;
const MAIN_CONTENT_MAX_TARGET_HEIGHT_RATIO = 0.5;
const MAIN_CONTENT_MAX_TARGET_WIDTH_RATIO = 0.72;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const buildTargetRect = (rect: DOMRect, highlightId?: string): DOMRect => {
  if (typeof window === 'undefined') {
    return rect;
  }

  const isMainContentStep = highlightId === BOTBOT_MAIN_CONTENT_HIGHLIGHT_ID;
  const maxHeight = Math.max(
    120,
    window.innerHeight * (isMainContentStep ? MAIN_CONTENT_MAX_TARGET_HEIGHT_RATIO : MAX_TARGET_HEIGHT_RATIO),
  );
  const maxWidth = Math.max(
    140,
    window.innerWidth * (isMainContentStep ? MAIN_CONTENT_MAX_TARGET_WIDTH_RATIO : MAX_TARGET_WIDTH_RATIO),
  );

  const nextHeight = Math.min(rect.height, maxHeight);
  const nextWidth = Math.min(rect.width, maxWidth);
  const verticalOffset = isMainContentStep ? 0.1 : 0.2;
  const adjustedTop = rect.top + (rect.height - nextHeight) * verticalOffset;
  const adjustedLeft = rect.left + (rect.width - nextWidth) / 2;

  return new DOMRect(
    clamp(adjustedLeft, 12, Math.max(12, window.innerWidth - nextWidth - 12)),
    clamp(adjustedTop, 12, Math.max(12, window.innerHeight - nextHeight - 12)),
    nextWidth,
    nextHeight,
  );
};

const getTargetElement = (highlightId?: string): HTMLElement | null => {
  if (typeof document === 'undefined' || !highlightId) return null;

  const byDataTour = document.querySelector(`[data-tour-id="${highlightId}"]`) as HTMLElement | null;
  if (byDataTour) return byDataTour;

  const byId = document.getElementById(highlightId) as HTMLElement | null;
  return byId;
};

const BotBotTutorial: React.FC<BotBotTutorialProps> = ({
  isDarkMode,
  userName,
  steps,
  state,
  onComplete,
  onSkip,
  onRestart,
  onHelp,
  eyebrowLabel = 'Tutorial',
}) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [attemptedFallbacks, setAttemptedFallbacks] = useState<Record<string, number>>({});
  const latestStateRef = useRef(state);
  const suppressAutoAdvanceStepIdRef = useRef<string | null>(null);

  const filteredSteps = useMemo(() => steps.filter(Boolean), [steps]);

  useEffect(() => {
    if (filteredSteps.length === 0) {
      onSkip();
      return;
    }
  }, [filteredSteps.length, onSkip]);

  const activeStep = filteredSteps[activeStepIndex];
  const isLastStep = activeStepIndex >= filteredSteps.length - 1;
  const activeStepId = activeStep?.id;

  useEffect(() => {
    if (!filteredSteps.length) return;
    if (activeStepIndex >= filteredSteps.length) {
      setActiveStepIndex(filteredSteps.length - 1);
    }
  }, [activeStepIndex, filteredSteps.length]);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  const isCurrentStateSatisfied = useCallback((step: BotBotTutorialStep | null, stateValue = latestStateRef.current) => {
    if (!step || step.advanceWhen.type === 'manual') {
      return false;
    }

    return step.advanceWhen.check(stateValue);
  }, []);

  const isStepSatisfied = useMemo(() => {
    return isCurrentStateSatisfied(activeStep);
  }, [activeStep, isCurrentStateSatisfied]);

  const isActionStep = activeStep?.advanceWhen.type === 'state';
  const isTerminalStep = activeStep ? activeStep.isTerminal || isLastStep : false;
  const isInteractiveActionStep = isActionStep || Boolean(activeStep?.highlightOnAction);
  const isWaitingForAction = isInteractiveActionStep && (isActionStep ? !isStepSatisfied : true);

  const markTargetAndState = useCallback(() => {
    if (!activeStep?.highlightId) {
      setTargetRect(null);
      return;
    }

    const target = getTargetElement(activeStep.highlightId);
    if (!target) {
      setTargetRect(null);
      return;
    }

    setTargetRect(buildTargetRect(target.getBoundingClientRect(), activeStep?.highlightId));
  }, [activeStep]);

  useEffect(() => {
    markTargetAndState();

    const handleRectRefresh = () => markTargetAndState();
    window.addEventListener('resize', handleRectRefresh);
    window.addEventListener('scroll', handleRectRefresh, true);

    const interval = window.setInterval(handleRectRefresh, 550);
    return () => {
      window.removeEventListener('resize', handleRectRefresh);
      window.removeEventListener('scroll', handleRectRefresh, true);
      window.clearInterval(interval);
    };
  }, [activeStepIndex, activeStep, markTargetAndState]);

  useEffect(() => {
    if (!activeStepId) return;
    setAttemptedFallbacks((prev) => ({
      ...prev,
      [activeStepId]: 0,
    }));
  }, [activeStepId]);

  const isTargetMissing = Boolean(activeStep?.highlightId) && targetRect === null;

  const runTargetAction = useCallback(() => {
    const targetId = activeStep?.actionTargetId || activeStep?.highlightId;
    if (!activeStep || !targetId) {
      return false;
    }

    const target = getTargetElement(targetId);
    if (!target) {
      setAttemptedFallbacks((prev) => ({
        ...prev,
        [activeStep.id]: (prev[activeStep.id] || 0) + 1,
      }));
      setTargetRect(null);
      return false;
    }

    try {
      target.click();
    } catch {
      // Keep the click handling best-effort for tutorials.
    }

    return true;
  }, [activeStep]);

  useEffect(() => {
    if (!isTargetMissing) return;
    const stepId = activeStep?.id;
    if (!stepId) return;

    const timer = window.setTimeout(() => {
      setAttemptedFallbacks((prev) => ({
        ...prev,
        [stepId]: Math.min((prev[stepId] || 0) + 1, BOTBOT_TUTORIAL_ATTEMPT_TOLERANCE),
      }));
    }, 900);

    return () => window.clearTimeout(timer);
  }, [isTargetMissing, activeStep?.id]);

  const retryTargetLookup = useCallback(() => {
    if (!activeStep?.highlightId) return;

    const target = getTargetElement(activeStep.highlightId);
    if (!target) {
      setAttemptedFallbacks((prev) => ({
        ...prev,
        [activeStep.id]: (prev[activeStep.id] || 0) + 1,
      }));
      setTargetRect(null);
      return;
    }

    setTargetRect(buildTargetRect(target.getBoundingClientRect(), activeStep?.highlightId));
    setAttemptedFallbacks((prev) => ({
      ...prev,
      [activeStep.id]: 0,
    }));
  }, [activeStep]);

  const stepFailedAttempts = activeStep ? attemptedFallbacks[activeStep.id] || 0 : 0;
  const showRecoveryActions = Boolean(activeStep?.highlightId) && isTargetMissing;
  const showEscalatedRecovery = stepFailedAttempts >= 2;

  const advanceStep = useCallback(() => {
    if (!activeStep) return;

    if (isTerminalStep || isLastStep) {
      onComplete();
      return;
    }

    setActiveStepIndex((current) => Math.min(current + 1, filteredSteps.length - 1));
  }, [activeStep, filteredSteps.length, isLastStep, onComplete]);

  const skipCurrentStep = useCallback(() => {
    if (!activeStep) {
      onSkip();
      return;
    }

    if (isTerminalStep || isLastStep) {
      onSkip();
      return;
    }

    setActiveStepIndex((current) => Math.min(current + 1, filteredSteps.length - 1));
  }, [activeStep, isLastStep, onSkip, filteredSteps.length]);

  const goBackStep = useCallback(() => {
    setActiveStepIndex((current) => {
      const nextIndex = Math.max(current - 1, 0);
      suppressAutoAdvanceStepIdRef.current = filteredSteps[nextIndex]?.id || null;
      return nextIndex;
    });
  }, [filteredSteps]);

  const handlePrimaryAction = useCallback(() => {
    if (!activeStep) {
      onSkip();
      return;
    }
    suppressAutoAdvanceStepIdRef.current = null;

    if (isTerminalStep) {
      onComplete();
      return;
    }

    if (isInteractiveActionStep) {
      const didAction = runTargetAction();
      if (!didAction) {
        return;
      }

      window.setTimeout(() => {
        if (isActionStep) {
          if (isCurrentStateSatisfied(activeStep)) {
            advanceStep();
          }
          return;
        }

        advanceStep();
      }, 240);
      return;
    }

    advanceStep();
  }, [
    activeStep,
    advanceStep,
    isActionStep,
    isInteractiveActionStep,
    isTerminalStep,
    isCurrentStateSatisfied,
    onSkip,
    onComplete,
    runTargetAction,
  ]);

  useEffect(() => {
    const targetId = activeStep?.actionTargetId || activeStep?.highlightId;
    if (!activeStep?.highlightOnAction || !targetId || activeStep.advanceWhen.type !== 'manual') {
      return;
    }

    const target = getTargetElement(targetId);
    if (!target) {
      return;
    }

    const handleTargetClick = () => {
      window.setTimeout(() => {
        advanceStep();
      }, 180);
    };

    target.addEventListener('click', handleTargetClick);
    return () => {
      target.removeEventListener('click', handleTargetClick);
    };
  }, [activeStep, advanceStep]);

  useEffect(() => {
    if (!activeStep) return;
    if (isTerminalStep || activeStep.advanceWhen.type === 'manual') return;
    if (!isStepSatisfied) return;
    if (suppressAutoAdvanceStepIdRef.current === activeStep.id) return;

    const timer = window.setTimeout(() => {
      advanceStep();
    }, 280);

    return () => window.clearTimeout(timer);
  }, [activeStep, isStepSatisfied, isTerminalStep, advanceStep]);

  const isPrimaryEnabled = isTerminalStep || activeStep?.advanceWhen.type === 'manual' || Boolean(activeStep?.highlightId || activeStep?.actionTargetId);
  const primaryLabel =
    isTerminalStep ? 'Done' : activeStep?.primaryActionLabel || (isLastStep ? 'Done' : 'Next');
  const showBackAction = activeStepIndex > 0;

  const actions = useMemo(() => {
    if (!activeStep) {
      return [];
    }

    if (!activeStep || isTerminalStep || !showRecoveryActions) {
      const baseActions = [
        {
          id: 'primary',
          label: primaryLabel,
          disabled: !isPrimaryEnabled,
          variant: 'primary' as const,
          onClick: handlePrimaryAction,
        },
      ];

      if (showBackAction) {
        baseActions.unshift({
          id: 'back',
          label: 'Back',
          variant: 'secondary' as const,
          onClick: goBackStep,
        });
      }

      return baseActions;
    }

    const recoveryActions = [
      ...(showBackAction
        ? [{
            id: 'back',
            label: 'Back',
            variant: 'secondary' as const,
            onClick: goBackStep,
          }]
        : []),
      {
        id: 'retry',
        label: 'Try again',
        variant: 'primary' as const,
        onClick: retryTargetLookup,
      },
      {
        id: 'skip-step',
        label: 'Skip this step',
        variant: 'secondary' as const,
        onClick: skipCurrentStep,
      },
      {
        id: 'skip-tour',
        label: 'Skip tour for now',
        variant: 'secondary' as const,
        onClick: onSkip,
      },
    ];

    if (showEscalatedRecovery && onRestart) {
      recoveryActions.push({
        id: 'restart',
        label: 'Restart tutorials',
        variant: 'secondary' as const,
        onClick: onRestart,
      });
    }

    if (showEscalatedRecovery && onHelp) {
      recoveryActions.push({
        id: 'help',
        label: 'Need help?',
        variant: 'secondary' as const,
        onClick: onHelp,
      });
    }

    return recoveryActions;
  }, [activeStep, goBackStep, handlePrimaryAction, isPrimaryEnabled, isTerminalStep, onHelp, onRestart, onSkip, primaryLabel, retryTargetLookup, showBackAction, showEscalatedRecovery, showRecoveryActions, skipCurrentStep]);

  const slideMessage = useMemo(() => {
    if (!activeStep) return '';
    if (showRecoveryActions && isTargetMissing) {
      return `${activeStep.message} ${TARGET_MISSING_MESSAGE}`;
    }
    return activeStep.message;
  }, [activeStep, isTargetMissing, showRecoveryActions]);

  const currentSlide = activeStep
    ? {
      title: activeStep.title,
      description: slideMessage,
      body: userName ? `Hi ${userName}, let's get started.` : 'Let’s walk through this together.',
      tips: isWaitingForAction
        ? ['Click the highlighted item to continue', 'If you get stuck, use the recovery buttons below.']
        : undefined,
    }
    : {
      title: 'BotBot',
      description: 'Ready when you are.',
    };

  if (!activeStep) return null;

  return (
    <TutorialOverlay
      isDarkMode={isDarkMode}
      onClose={onSkip}
      highlightedElementRect={targetRect}
      currentStep={activeStepIndex}
      totalSteps={Math.max(filteredSteps.length, 1)}
      slide={currentSlide}
      actions={actions}
      isAwaitingAction={isWaitingForAction}
      eyebrowLabel={eyebrowLabel}
      suppressWaitingCopy={Boolean(activeStep?.suppressWaitingCopy)}
      forceTargetPulse={Boolean(activeStep?.pulseHighlight)}
      onHighlightedAreaClick={activeStep?.advanceOnHighlightClick ? handlePrimaryAction : undefined}
    />
  );
};

export default BotBotTutorial;
