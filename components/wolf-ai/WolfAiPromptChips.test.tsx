import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import WolfAiPromptChips from './WolfAiPromptChips';

describe('WolfAiPromptChips', () => {
  it('calls onSelectPrompt when a suggested prompt is clicked', async () => {
    const onSelectPrompt = vi.fn();

    render(<WolfAiPromptChips onSelectPrompt={onSelectPrompt} />);

    await userEvent.click(screen.getByRole('button', { name: /explain simply/i }));

    expect(onSelectPrompt).toHaveBeenCalledWith('Explain simply');
  });

  it('hides follow-up chips by default and shows them when requested', () => {
    const { rerender } = render(<WolfAiPromptChips onSelectPrompt={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /make it simpler/i })).not.toBeInTheDocument();

    rerender(<WolfAiPromptChips onSelectPrompt={vi.fn()} showFollowUps />);

    expect(screen.getByRole('button', { name: /make it simpler/i })).toBeInTheDocument();
  });
});
