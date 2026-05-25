import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WolfAiShell from './WolfAiShell';
import { createConversation, fetchBotBotModels, fetchSettings, fetchTokenUsage, saveSettings, sendMessage } from '../../services/botbotApi';

vi.mock('../../services/botbotApi', () => ({
  fetchBotBotModels: vi.fn(),
  fetchTokenUsage: vi.fn(),
  fetchSettings: vi.fn(),
  saveSettings: vi.fn(),
  createConversation: vi.fn(),
  sendMessage: vi.fn(),
}));

const mockFetchBotBotModels = vi.mocked(fetchBotBotModels);
const mockFetchTokenUsage = vi.mocked(fetchTokenUsage);
const mockFetchSettings = vi.mocked(fetchSettings);
const mockSaveSettings = vi.mocked(saveSettings);
const mockCreateConversation = vi.mocked(createConversation);
const mockSendMessage = vi.mocked(sendMessage);

describe('WolfAiShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBotBotModels.mockResolvedValue([
      { modelKey: 'local', displayName: 'Local AI', provider: 'ollama', freeTokenQuota: 1000 },
    ]);
    mockFetchTokenUsage.mockResolvedValue([
      {
        modelKey: 'local',
        billingModelKey: 'local',
        displayName: 'Local AI',
        tokensUsed: 0,
        quota: 1000,
        quotaRemaining: 1000,
        pctUsed: 0,
      },
    ]);
    mockFetchSettings.mockResolvedValue({
      assistantName: 'WolfBot',
      assistantTheme: 'amber',
      tutorialCompleted: true,
      preferredModelKey: 'local',
      preferredRuntimeNode: 'alphaai',
    });
    mockSaveSettings.mockResolvedValue(undefined);
    mockCreateConversation.mockResolvedValue({
      id: 1,
      title: 'WOLF AI Playground',
      modelKey: 'local',
      contextTag: 'wolf-ai',
      updatedAt: '2026-05-24T00:00:00.000Z',
      messageCount: 0,
    });
    mockSendMessage.mockResolvedValue({
      message: {
        id: 2,
        role: 'assistant',
        content: 'Answer',
        modelKey: 'local',
        inputTokens: 1,
        outputTokens: 1,
        finishReason: 'stop',
        createdAt: '2026-05-24T00:00:00.000Z',
      },
      tokensUsed: 2,
      quota: 1000,
      quotaRemaining: 998,
    });
  });

  it('renders the WOLF AI shell, tabs, composer, and prompt chips', async () => {
    render(<WolfAiShell />);

    expect(screen.getAllByText('WOLF AI').length).toBeGreaterThan(0);
    expect(screen.getByText('Powered by Wolf Swarm AI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /playground/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /timeline/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /courses/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /leaderboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /glossary/i })).toBeInTheDocument();
    expect(screen.getByText('Test prompts. Learn by trying.')).toBeInTheDocument();
    expect(await screen.findByPlaceholderText(/ask wolfbot/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /explain simply/i })).toBeInTheDocument();
  });
});
