import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { fetchAuthConfig, fetchCurrentUser } from '../services/authApi';

vi.mock('../services/authApi', () => ({
  changeCurrentPassword: vi.fn(),
  fetchAuthConfig: vi.fn(),
  fetchCurrentUser: vi.fn(),
  loginWithPassword: vi.fn(),
  logoutCurrentUser: vi.fn(),
  startGoogleSignIn: vi.fn(),
  submitGoogleAccessRequest: vi.fn(),
}));

vi.mock('../services/botbotApi', () => ({
  fetchSettings: vi.fn().mockResolvedValue({
    assistantName: 'BotBot',
    assistantTheme: 'sky',
    tutorialCompleted: true,
  }),
}));

vi.mock('./SalesDashboard', () => ({ default: () => 'Sales dashboard' }));
vi.mock('./WorkAdvertising', () => ({ default: () => 'Work advertising' }));
vi.mock('./UpdateDatabase', () => ({ default: () => 'Update database' }));
vi.mock('./KiosksStatus', () => ({ default: () => 'Kiosks status' }));
vi.mock('./DashboardOverview', () => ({ default: () => 'Dashboard overview' }));
vi.mock('./CRMWorkspace', () => ({ default: () => 'CRM workspace' }));
vi.mock('./ProductSearchWorkspace', () => ({ default: () => 'Product search' }));
vi.mock('./CompetitorPricingWorkspace', () => ({ default: () => 'Competitor pricing workspace' }));
vi.mock('./MessageBoard', () => ({ default: () => 'Message board' }));
vi.mock('./TaskManager', () => ({ default: () => 'Task manager' }));
vi.mock('./OwnerSettings', () => ({ default: () => 'Owner settings' }));
vi.mock('./AmpWorkspace', () => ({ default: () => 'AMP workspace' }));
vi.mock('./ShopWorkspace', () => ({ default: () => 'Shop workspace' }));
vi.mock('./WolfdenWorkspace', () => ({ default: () => 'Den workspace' }));
vi.mock('./app/AuthScreen', () => ({ default: () => 'Auth screen' }));
vi.mock('./app/LoadingOverlay', () => ({ default: () => 'Loading' }));
vi.mock('./botbot/BotBotTutorial', () => ({ default: () => 'BotBot tutorial' }));

vi.mock('./PulseWorkspace', async () => {
  const React = await import('react');
  const PulseWorkspace = ({ requestedSubTab = 'sales', onSubTabChange }: any) => {
    React.useEffect(() => {
      onSubTabChange?.(requestedSubTab);
    }, [requestedSubTab, onSubTabChange]);
    return <div>Pulse workspace: {requestedSubTab}</div>;
  };
  return { default: PulseWorkspace };
});

vi.mock('./botbot', async () => {
  const React = await import('react');
  return {
    BotBotContextProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    BotBotOrb: () => React.createElement('button', { type: 'button' }, 'BotBot'),
    BotBotChatPanel: () => null,
  };
});

describe('App sales date-basis toggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      id: 'owner-1',
      name: 'Owner User',
      email: 'owner@example.com',
      roles: ['Owner'],
      permissions: [],
      permissionMode: 'role',
      tutorialCompletedAt: '2026-06-01T00:00:00.000Z',
    });
    vi.mocked(fetchAuthConfig).mockResolvedValue({
      googleWorkspaceEnabled: false,
      googleClientId: '',
      googleHostedDomain: '',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the Competitor Pricing workspace in navigation for users with Shop access', async () => {
    const { container } = render(<App />);

    await screen.findByText('Dashboard overview');

    const pricingNav = container.querySelector('[data-tour-id="sidebar-competitor-pricing-nav-item"]');
    expect(pricingNav).toBeTruthy();
    fireEvent.click(pricingNav as HTMLElement);

    await screen.findByText('Competitor pricing workspace');
    expect(screen.getByText('Competitor Pricing')).toBeInTheDocument();
  });

  it('shows the Written/Delivered switch on the Pulse sales page and dispatches basis changes', async () => {
    const { container } = render(<App />);

    await screen.findByText('Dashboard overview');

    const pulseNav = container.querySelector('[data-tour-id="sidebar-pulse-nav-item"]');
    expect(pulseNav).toBeTruthy();
    fireEvent.click(pulseNav as HTMLElement);

    await screen.findByText('Pulse workspace: sales');

    expect(screen.getByRole('button', { name: 'Delivered' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Written' })).toBeInTheDocument();

    const basisEvents: string[] = [];
    const handler = (event: Event) => {
      basisEvents.push(((event as CustomEvent).detail || {}).basis);
    };
    window.addEventListener('fd-set-sales-basis', handler as EventListener);
    fireEvent.click(screen.getByRole('button', { name: 'Written' }));
    window.removeEventListener('fd-set-sales-basis', handler as EventListener);

    await waitFor(() => expect(basisEvents).toEqual(['written']));
  });
});
