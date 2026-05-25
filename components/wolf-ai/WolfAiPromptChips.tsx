export const WOLF_AI_PROMPTS = [
  'Explain simply',
  'Prompt upgrade',
  'Compare answers',
  'Build plan',
  'Explain this page',
  'Coach my next step',
  'Find risks',
] as const;

export const WOLF_AI_FOLLOW_UP_PROMPTS = [
  'Make it simpler',
  'Turn it into a checklist',
  'Give me the next 3 steps',
  'Write this as a message I can send',
] as const;

type WolfAiPromptChipsProps = {
  onSelectPrompt: (prompt: string) => void;
  showFollowUps?: boolean;
};

const WolfAiPromptChips = ({ onSelectPrompt, showFollowUps = false }: WolfAiPromptChipsProps) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2" aria-label="Suggested WOLF AI prompts">
        {WOLF_AI_PROMPTS.map(prompt => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            className="rounded-full border border-orange-200 bg-white/85 px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-900"
          >
            {prompt}
          </button>
        ))}
      </div>

      {showFollowUps && (
        <div className="flex flex-wrap justify-center gap-2" aria-label="Follow-up WOLF AI prompts">
          {WOLF_AI_FOLLOW_UP_PROMPTS.map(prompt => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelectPrompt(prompt)}
              className="rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default WolfAiPromptChips;
