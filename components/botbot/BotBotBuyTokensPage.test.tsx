import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BotBotBuyTokensPage from './BotBotBuyTokensPage';
import { createBotBotTokenCheckout, fetchTokenUsage, redeemShopifyTokenClaim } from '../../services/botbotApi';
import type { BotBotTokenPack } from '../../constants';

vi.mock('../../services/botbotApi', () => ({
  fetchTokenUsage: vi.fn(),
  redeemShopifyTokenClaim: vi.fn(),
  createBotBotTokenCheckout: vi.fn(),
}));

const mockFetchTokenUsage = vi.mocked(fetchTokenUsage);
const mockRedeemShopifyTokenClaim = vi.mocked(redeemShopifyTokenClaim);
const mockCreateBotBotTokenCheckout = vi.mocked(createBotBotTokenCheckout);

const testPacks: BotBotTokenPack[] = [
  {
    id: 'botbot-1',
    label: '$1 Starter',
    tokens: 10000,
    priceUsd: 1,
    priceLabel: '$1',
    description: 'A small pack for testing.',
    modelKey: 'local',
  },
  {
    id: 'botbot-25',
    label: '$25 Team Pack',
    tokens: 250000,
    priceUsd: 25,
    priceLabel: '$25',
    description: 'A larger pack with Stripe Checkout.',
    modelKey: 'local',
    featured: true,
  },
];

describe('BotBotBuyTokensPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTokenUsage.mockResolvedValue([
      {
        modelKey: 'local',
        billingModelKey: 'local',
        displayName: 'Local AI',
        tokensUsed: 250,
        quota: 1250,
        quotaRemaining: 1000,
        pctUsed: 20,
      },
    ]);
    mockCreateBotBotTokenCheckout.mockResolvedValue({
      ok: true,
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
      sessionId: 'cs_test_123',
    });
    Object.defineProperty(window, 'location', {
      value: { assign: vi.fn() },
      writable: true,
    });
  });

  it('renders the page title, $1/$25 packs, usage, and claim-code input', async () => {
    render(<BotBotBuyTokensPage isDarkMode={false} tokenPacks={testPacks} />);

    expect(screen.getByRole('heading', { name: /buy botbot tokens/i })).toBeInTheDocument();
    expect(await screen.findByText('10,000')).toBeInTheDocument();
    expect(screen.getByText('$1 Starter')).toBeInTheDocument();
    expect(screen.getByText('$25 Team Pack')).toBeInTheDocument();
    expect(screen.getByLabelText(/claim code/i)).toBeInTheDocument();
  });

  it('explains Stripe checkout, $1 to 10,000-token pricing, paid-model burn rates, and the capped free lane', async () => {
    render(<BotBotBuyTokensPage isDarkMode={false} tokenPacks={testPacks} />);

    await screen.findByText('$1 Starter');
    expect(screen.getByText(/Stripe handles checkout/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\$1 = 10,000 BotBot tokens/i).length).toBeGreaterThan(0);
    expect(screen.getByText('$1–$250')).toBeInTheDocument();
    expect(screen.getByText('openai/gpt-5.5')).toBeInTheDocument();
    expect(screen.getByText('53 tokens')).toBeInTheDocument();
    expect(screen.getByText(/50 free-model requests per day/i)).toBeInTheDocument();
    expect(screen.getByText(/combined 25-prompt daily cap/i)).toBeInTheDocument();
    expect(screen.getByText('deepseek/deepseek-v4-flash:free')).toBeInTheDocument();
    expect(screen.getByText('qwen/qwen3-coder:free')).toBeInTheDocument();
    expect(screen.getByText('meta-llama/llama-3.3-70b-instruct:free')).toBeInTheDocument();
  });

  it('starts Stripe Checkout for the selected server-owned pack', async () => {
    render(<BotBotBuyTokensPage isDarkMode={false} tokenPacks={testPacks} />);

    await userEvent.click(await screen.findByRole('button', { name: /buy \$25 team pack with stripe/i }));

    await waitFor(() => {
      expect(mockCreateBotBotTokenCheckout).toHaveBeenCalledWith('botbot-25');
    });
    expect(window.location.assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_123');
  });

  it('shows a checkout error when Stripe session creation fails', async () => {
    const err: any = new Error('checkout failed');
    err.body = { error: 'stripe_not_configured' };
    mockCreateBotBotTokenCheckout.mockRejectedValue(err);

    render(<BotBotBuyTokensPage isDarkMode={false} tokenPacks={testPacks} />);

    await userEvent.click(await screen.findByRole('button', { name: /buy \$1 starter with stripe/i }));

    expect(await screen.findByText(/Stripe is not configured yet/i)).toBeInTheDocument();
  });

  it('submits a claim code, shows success, and refreshes usage', async () => {
    mockRedeemShopifyTokenClaim.mockResolvedValue({
      ok: true,
      claim_code: 'BOTP-ABC123',
      status: 'redeemed',
      credits_by_model: { local: 1000 },
    });

    render(<BotBotBuyTokensPage isDarkMode={false} tokenPacks={testPacks} />);

    await userEvent.type(screen.getByLabelText(/claim code/i), 'BOTP-ABC123');
    await userEvent.click(screen.getByRole('button', { name: /redeem claim code/i }));

    await waitFor(() => {
      expect(mockRedeemShopifyTokenClaim).toHaveBeenCalledWith('BOTP-ABC123');
    });
    expect(await screen.findByText(/claim code redeemed/i)).toBeInTheDocument();
    expect(mockFetchTokenUsage).toHaveBeenCalledTimes(2);
  });

  it('shows backend claim errors in plain English', async () => {
    const err: any = new Error('claim failed');
    err.body = { error: 'claim_email_mismatch' };
    mockRedeemShopifyTokenClaim.mockRejectedValue(err);

    render(<BotBotBuyTokensPage isDarkMode={false} tokenPacks={testPacks} />);

    await userEvent.type(screen.getByLabelText(/claim code/i), 'BOTP-WRONG');
    await userEvent.click(screen.getByRole('button', { name: /redeem claim code/i }));

    expect(await screen.findByText(/does not match your dashboard login/i)).toBeInTheDocument();
  });
});
