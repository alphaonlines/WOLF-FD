import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TutorialOverlay from '../app/TutorialOverlay';
import type { Tab } from '../app/tabs';

type BotBotPulseSubTab = 'sales' | 'alphaos' | 'alphapulse' | 'website' | 'reviews';
type BotBotWolfdenSubTab = 'ups' | 'crm' | 'board' | 'meeting' | 'tasks';

type AdvanceRule =
  | { type: 'manual' }
  | { type: 'state'; check: (state: BotBotTutorialState) => boolean };

export type BotBotTutorialState = {
  sidebarOpen: boolean;
  activeTab: Tab;
  requestedPulseSubTab: BotBotPulseSubTab;
  currentPulseSubTab: BotBotPulseSubTab;
  requestedWolfdenSubTab: BotBotWolfdenSubTab;
};

export type BotBotTutorialStep = {
  id: string;
  title: string;
  message: string;
  highlightId?: string;
  scope?: 'launch' | 'module';
  requiredModules?: string[];
  advanceWhen: AdvanceRule;
  primaryActionLabel?: string;
  isTerminal?: boolean;
};

type BotBotTutorialProps = {
  isDarkMode: boolean;
  userName: string;
  steps: BotBotTutorialStep[];
  state: BotBotTutorialState;
  onComplete: () => void;
  onSkip: () => void;
  onRestart?: () => void;
  onHelp?: () => void;
};

const BOTBOT_TUTORIAL_ATTEMPT_TOLERANCE = 3;
const TARGET_MISSING_MESSAGE = 'I can’t find that right now';

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
}) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [attemptedFallbacks, setAttemptedFallbacks] = useState<Record<string, number>>({});

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

  const isStepSatisfied = useMemo(() => {
    if (!activeStep) return false;
    if (activeStep.advanceWhen.type === 'manual') return false;
    return activeStep.advanceWhen.check(state);
  }, [activeStep, state]);

  const isTerminalStep = activeStep ? activeStep.isTerminal || isLastStep : false;

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

    setTargetRect(target.getBoundingClientRect());
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

    setTargetRect(target.getBoundingClientRect());
    setAttemptedFallbacks((prev) => ({
      ...prev,
      [activeStep.id]: 0,
    }));
  }, [activeStep]);

  const stepFailedAttempts = activeStep ? attemptedFallbacks[activeStep.id] || 0 : 0;
  const isWaitingForAction = activeStep?.advanceWhen.type !== 'manual' && !isStepSatisfied;
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

  const handlePrimaryAction = useCallback(() => {
    if (!activeStep) {
      onSkip();
      return;
    }

    if (isWaitingForAction && activeStep.highlightId) {
      const target = getTargetElement(activeStep.highlightId);
      if (!target) {
        setAttemptedFallbacks((prev) => ({
          ...prev,
          [activeStep.id]: (prev[activeStep.id] || 0) + 1,
        }));
        setTargetRect(null);
        return;
      }

      try {
        target.click();
      } catch {
        // Best-effort click to keep the primary button useful.
      }

      if (isStepSatisfied) {
        window.setTimeout(() => {
          advanceStep();
        }, 140);
      }
      return;
    }

    if (isWaitingForAction) {
      return;
    }

    advanceStep();
  }, [activeStep, advanceStep, isStepSatisfied, isWaitingForAction, onSkip]);

  useEffect(() => {
    if (!activeStep) return;
    if (isTerminalStep || activeStep.advanceWhen.type === 'manual') return;
    if (!isStepSatisfied) return;

    const timer = window.setTimeout(() => {
      advanceStep();
    }, 280);

    return () => window.clearTimeout(timer);
  }, [activeStep, isStepSatisfied, isTerminalStep, advanceStep]);

  const isPrimaryEnabled = isTerminalStep || activeStep?.advanceWhen.type === 'manual' || Boolean(activeStep?.highlightId);
  const primaryLabel =
    isTerminalStep ? 'Done' : activeStep?.primaryActionLabel || (isLastStep ? 'Done' : 'Next');

  const actions = useMemo(() => {
    if (!activeStep) {
      return [];
    }

    if (!activeStep || isTerminalStep || !showRecoveryActions) {
      return [
        {
          id: 'primary',
          label: primaryLabel,
          disabled: !isPrimaryEnabled,
          variant: 'primary' as const,
          onClick: handlePrimaryAction,
        },
      ];
    }

    const recoveryActions = [
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
  }, [activeStep, handlePrimaryAction, isPrimaryEnabled, isTerminalStep, onHelp, onRestart, onSkip, primaryLabel, retryTargetLookup, showEscalatedRecovery, showRecoveryActions, skipCurrentStep]);

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
      body: `Hi ${userName}, let's get started.`,
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
    />
  );
};

export default BotBotTutorial;
