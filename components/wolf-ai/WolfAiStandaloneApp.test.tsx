import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WolfAiStandaloneApp from './WolfAiStandaloneApp';

vi.mock('../../services/botbotApi', () => ({
  fetchBotBotModels: vi.fn().mockResolvedValue([]),
  fetchTokenUsage: vi.fn().mockResolvedValue([]),
  fetchSettings: vi.fn().mockResolvedValue(null),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  createConversation: vi.fn().mockResolvedValue({ id: 1, title: 'WOLF AI Playground', modelKey: 'local', contextTag: 'wolf-ai', updatedAt: '', messageCount: 0 }),
  sendMessage: vi.fn(),
}));

describe('WolfAiStandaloneApp', () => {
  it('renders the standalone shell inside the BotBot context provider', async () => {
    render(<WolfAiStandaloneApp />);

    expect(screen.getAllByText('WOLF AI').length).toBeGreaterThan(0);
    expect(screen.getByText('Powered by Wolf Swarm AI')).toBeInTheDocument();
    expect(await screen.findByPlaceholderText(/ask wolfbot/i)).toBeInTheDocument();
  });
});
