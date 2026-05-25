import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WolfAiComposer from './WolfAiComposer';
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

describe('WolfAiComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBotBotModels.mockResolvedValue([
      { modelKey: 'local', displayName: 'Local AI', provider: 'ollama', freeTokenQuota: 1000 },
      { modelKey: 'pro', displayName: 'Pro Swarm', provider: 'openrouter', freeTokenQuota: 5000 },
    ]);
    mockFetchTokenUsage.mockResolvedValue([
      {
        modelKey: 'local',
        billingModelKey: 'local',
        displayName: 'Local AI',
        tokensUsed: 125,
        quota: 1000,
        quotaRemaining: 875,
        pctUsed: 12.5,
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
      id: 42,
      title: 'WOLF AI Playground',
      modelKey: 'local',
      contextTag: 'wolf-ai',
      updatedAt: '2026-05-24T00:00:00.000Z',
      messageCount: 0,
    });
    mockSendMessage.mockResolvedValue({
      message: {
        id: 43,
        role: 'assistant',
        content: 'Here is a useful answer.',
        modelKey: 'local',
        inputTokens: 10,
        outputTokens: 20,
        finishReason: 'stop',
        createdAt: '2026-05-24T00:00:01.000Z',
      },
      tokensUsed: 155,
      quota: 1000,
      quotaRemaining: 845,
    });
  });

  it('renders models, token usage, and status after loading', async () => {
    render(<WolfAiComposer />);

    expect(await screen.findByText('Local AI')).toBeInTheDocument();
    expect(screen.getByText(/125 used/i)).toBeInTheDocument();
    expect(screen.getByText(/875 remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/WolfBot ready/i)).toBeInTheDocument();
  });

  it('shows WOLF AI sign-in copy instead of internal BotBot API errors', async () => {
    const unauthorizedError: any = new Error('BotBot API 401 for /api/botbot/models');
    unauthorizedError.status = 401;
    mockFetchBotBotModels.mockRejectedValueOnce(unauthorizedError);

    render(<WolfAiComposer />);

    expect(await screen.findByText(/Sign in to use WOLF AI/i)).toBeInTheDocument();
    expect(screen.queryByText(/BotBot API/i)).not.toBeInTheDocument();
  });

  it('fills the textbox when a prompt chip is clicked without sending', async () => {
    render(<WolfAiComposer />);

    await screen.findByText('Local AI');
    await userEvent.click(screen.getByRole('button', { name: /build plan/i }));

    expect(screen.getByPlaceholderText(/ask wolfbot/i)).toHaveValue('Build plan');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('creates a new WOLF AI conversation when New Chat is clicked', async () => {
    render(<WolfAiComposer />);

    await userEvent.click(await screen.findByRole('button', { name: /new chat/i }));

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith('local', 'WOLF AI Playground', 'wolf-ai');
    });
  });

  it('creates a conversation, sends the prompt, renders the answer, and refreshes usage', async () => {
    render(<WolfAiComposer />);

    await userEvent.type(await screen.findByPlaceholderText(/ask wolfbot/i), 'What should I try first?');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith('local', 'WOLF AI Playground', 'wolf-ai');
      expect(mockSendMessage).toHaveBeenCalledWith(
        42,
        'What should I try first?',
        expect.objectContaining({ module: 'wolf-ai', pageName: 'WOLF AI Playground' })
      );
    });
    expect(await screen.findByText('Here is a useful answer.')).toBeInTheDocument();
    expect(mockFetchTokenUsage).toHaveBeenCalledTimes(2);
  });

  it('locks model selection once a conversation exists so usage display stays honest', async () => {
    render(<WolfAiComposer />);

    await userEvent.click(await screen.findByRole('button', { name: /new chat/i }));

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith('local', 'WOLF AI Playground', 'wolf-ai');
    });
    expect(screen.getByLabelText(/wolf ai model/i)).toBeDisabled();
    expect(screen.getByText(/Conversation locked to Local AI/i)).toBeInTheDocument();
  });

  it('does not leave a failed optimistic user message in the transcript', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('provider offline'));
    render(<WolfAiComposer />);

    await userEvent.type(await screen.findByPlaceholderText(/ask wolfbot/i), 'This should fail');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(/provider offline/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('WOLF AI messages')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask wolfbot/i)).toHaveValue('This should fail');
  });

  it('disables send while initial model and usage data is loading', () => {
    mockFetchBotBotModels.mockReturnValue(new Promise(() => {}));
    render(<WolfAiComposer />);

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('shows a readable error when New Chat fails', async () => {
    mockCreateConversation.mockRejectedValueOnce(new Error('conversation failed'));
    render(<WolfAiComposer />);

    await userEvent.click(await screen.findByRole('button', { name: /new chat/i }));

    expect(await screen.findByText(/conversation failed/i)).toBeInTheDocument();
  });

  it('keeps a successful answer visible if token usage refresh fails afterward', async () => {
    mockFetchTokenUsage
      .mockResolvedValueOnce([
        {
          modelKey: 'local',
          billingModelKey: 'local',
          displayName: 'Local AI',
          tokensUsed: 125,
          quota: 1000,
          quotaRemaining: 875,
          pctUsed: 12.5,
        },
      ])
      .mockRejectedValueOnce(new Error('usage offline'));

    render(<WolfAiComposer />);

    await userEvent.type(await screen.findByPlaceholderText(/ask wolfbot/i), 'Still send this');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('Here is a useful answer.')).toBeInTheDocument();
    expect(await screen.findByText(/answer was sent, but token usage could not refresh/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask wolfbot/i)).toHaveValue('');
  });
});
