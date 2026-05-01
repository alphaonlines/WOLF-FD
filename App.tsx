import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  LayoutDashboard,
  Sofa,
  Activity,
  Star,
  Moon,
  Sun,
  UploadCloud,
  ClipboardList,
  Bot,
  LogOut,
  Settings,
  Inbox,
  Zap,
  UserCheck,
  Users,
  MessageSquare,
  Calendar,
  Link2,
  ShoppingCart,
  Globe,
  Tv,
  Share2,
  FolderSearch,
} from 'lucide-react';
import SalesDashboard from './components/SalesDashboard';
import WorkAdvertising from './components/WorkAdvertising';
import UpdateDatabase from './components/UpdateDatabase';
import KiosksStatus from './components/KiosksStatus';
import DashboardOverview from './components/DashboardOverview';
import CRMWorkspace from './components/CRMWorkspace';
import ProductSearchWorkspace from './components/ProductSearchWorkspace';
import MessageBoard from './components/MessageBoard';
import TaskManager from './components/TaskManager';
import OwnerSettings from './components/OwnerSettings';
import PulseWorkspace from './components/PulseWorkspace';
import AmpWorkspace, { AmpSubTab } from './components/AmpWorkspace';
import ShopWorkspace, { ShopSubTab } from './components/ShopWorkspace';
import WolfdenWorkspace, { WolfdenSubTab } from './components/WolfdenWorkspace';
import { PulseSubTab } from './components/PulseWorkspace';
import { BotBotOrb, BotBotChatPanel, BotBotContextProvider } from './components/botbot';
import BotBotTutorial, { BotBotTutorialStep } from './components/botbot/BotBotTutorial';
import type { AccessRequestProfile, AuthConfig, AuthUser, UserRole } from './types';
import { APP_VERSION } from './constants';
import {
  changeCurrentPassword,
  fetchAuthConfig,
  fetchCurrentUser,
  loginWithPassword,
  logoutCurrentUser,
  startGoogleSignIn,
  submitGoogleAccessRequest,
} from './services/authApi';
import { getPosApiBaseUrl } from './services/posBackendApi';
import AuthScreen from './components/app/AuthScreen';
import LoadingOverlay from './components/app/LoadingOverlay';
import NavItem from './components/app/NavItem'; // Added NavItem import
import { APP_THEME_STYLES } from './components/app/themeStyles';
import { canAccessTab, getTabTitle, Tab } from './components/app/tabs';
import { DASHBOARD_CARD_PERMISSION_BY_ID, FEATURE_PERMISSION_KEYS, MODULE_PERMISSION_KEYS, hasPermission } from './components/app/permissions';

const buildBotBotTutorialSteps = ({
  canOpenPulse,
  canOpenDen,
  canOpenSales,
  canOpenShop,
  canOpenProductSearch,
  canOpenCrm,
  hasSettingsPanel,
}: {
  canOpenPulse: boolean;
  canOpenDen: boolean;
  canOpenSales: boolean;
  canOpenShop: boolean;
  canOpenProductSearch: boolean;
  canOpenCrm: boolean;
  hasSettingsPanel: boolean;
}): BotBotTutorialStep[] => {
  const steps: BotBotTutorialStep[] = [
    {
      id: 'botbot-intro',
      title: 'Welcome to BotBot',
      message: 'Hi, I’m your guide for getting started. I’ll wait and only move when you are ready.',
      advanceWhen: { type: 'manual' },
      primaryActionLabel: 'Let’s go',
    },
    {
      id: 'botbot-open-sidebar',
      title: 'Open the navigation',
      message: 'Open the sidebar to see every module I can help you with.',
      highlightId: 'sidebar-toggle',
      scope: 'launch',
      requiredModules: [],
      advanceWhen: {
        type: 'state',
        check: (state) => state.sidebarOpen,
      },
      primaryActionLabel: 'Next',
    },
  ];

  if (canOpenPulse) {
    steps.push({
      id: 'botbot-open-pulse',
      title: 'Open Pulse',
      message: 'Use Pulse to get a fast sales view. Start in Sales first.',
      highlightId: 'sidebar-pulse-nav-item',
      scope: 'module',
      requiredModules: [MODULE_PERMISSION_KEYS.PULSE],
      advanceWhen: {
        type: 'state',
        check: (state) => state.activeTab === Tab.PULSE,
      },
      primaryActionLabel: 'Next',
    });
  } else if (canOpenDen) {
    steps.push({
      id: 'botbot-open-den-ups',
      title: 'Open Den',
      message: 'Go to Den, then open UPS first.',
      highlightId: 'sidebar-wolfden-nav-item',
      scope: 'module',
      requiredModules: [MODULE_PERMISSION_KEYS.WOLFDEN],
      advanceWhen: {
        type: 'state',
        check: (state) => state.activeTab === Tab.WOLFDEN,
      },
      primaryActionLabel: 'Next',
    });
    steps.push({
      id: 'botbot-open-den-ups-final',
      title: 'Open UPS',
      message: 'Inside Den, open UPS so your help starts from the floor queue.',
      highlightId: 'den-tab-ups',
      scope: 'module',
      requiredModules: [MODULE_PERMISSION_KEYS.WOLFDEN],
      advanceWhen: {
        type: 'state',
        check: (state) => state.activeTab === Tab.WOLFDEN && state.requestedWolfdenSubTab === 'ups',
      },
      primaryActionLabel: 'Next',
    });
  } else if (canOpenSales) {
    steps.push({
      id: 'botbot-open-sales',
      title: 'Open Sales',
      message: 'Open Sales to see your daily and weekly performance.',
      highlightId: 'sidebar-dashboard-nav-item',
      scope: 'module',
      requiredModules: [MODULE_PERMISSION_KEYS.SALES],
      advanceWhen: {
        type: 'state',
        check: (state) => state.activeTab === Tab.SALES,
      },
      primaryActionLabel: 'Next',
    });
  } else if (canOpenCrm) {
    steps.push({
      id: 'botbot-open-crm',
      title: 'Open CRM',
      message: 'Open CRM to manage customers and work your queue.',
      highlightId: 'sidebar-wolfden-nav-item',
      scope: 'module',
      requiredModules: [MODULE_PERMISSION_KEYS.CRM],
      advanceWhen: {
        type: 'state',
        check: (state) => state.activeTab === Tab.CRM,
      },
      primaryActionLabel: 'Next',
    });
  } else if (canOpenProductSearch) {
    steps.push({
      id: 'botbot-open-product-search',
      title: 'Open Product Search',
      message: 'Use Product Search for catalog lookups while helping customers.',
      highlightId: 'sidebar-shop-nav-item',
      scope: 'module',
      requiredModules: [MODULE_PERMISSION_KEYS.PRODUCT_SEARCH],
      advanceWhen: {
        type: 'state',
        check: (state) => state.activeTab === Tab.PRODUCT_SEARCH,
      },
      primaryActionLabel: 'Next',
    });
  } else if (canOpenShop) {
    steps.push({
      id: 'botbot-open-shop',
      title: 'Open Shop',
      message: 'Go to Shop for product workflows and POS tools.',
      highlightId: 'sidebar-shop-nav-item',
      scope: 'module',
      requiredModules: [MODULE_PERMISSION_KEYS.SHOP],
      advanceWhen: {
        type: 'state',
        check: (state) => state.activeTab === Tab.SHOP,
      },
      primaryActionLabel: 'Next',
    });
  }

  steps.push({
    id: 'botbot-main-content',
    title: 'Your main workspace',
    message: 'This is where your main content lives. I’ll wait while you explore this dashboard.',
    highlightId: 'botbot-main-content',
    scope: 'launch',
    requiredModules: [],
    advanceWhen: {
      type: 'manual',
    },
    primaryActionLabel: 'Next',
  });

  steps.push({
    id: 'botbot-find-help',
    title: 'BotBot settings and help',
    message: hasSettingsPanel
      ? 'Open Settings when you need walkthroughs, resets, or BotBot preferences.'
      : 'Ask an owner or manager to open Settings for BotBot control options.',
    highlightId: hasSettingsPanel ? 'sidebar-settings-nav-item' : undefined,
    scope: 'launch',
    requiredModules: hasSettingsPanel ? [MODULE_PERMISSION_KEYS.SETTINGS] : [],
    advanceWhen: hasSettingsPanel
      ? {
          type: 'state',
          check: (state) => state.activeTab === Tab.ADMIN,
        }
      : {
          type: 'manual',
        },
    primaryActionLabel: 'Done',
    isTerminal: true,
  });

  return steps;
};

const DASHBOARD_LOCKED = false;
const DASHBOARD_NOTICE = 'System down until further notice.';
const MAINTENANCE_TRACKING_SITE = 'wolf-fd-dashboard-maintenance';
const MAINTENANCE_VISITOR_KEY = 'wolf_fd_maintenance_visitor_id';
const MAINTENANCE_SESSION_KEY = 'wolf_fd_maintenance_session_id';

const makeTrackingId = (prefix: string) => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    // fall through to timestamp/random fallback
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const getStoredTrackingId = (storage: Storage | undefined, key: string, prefix: string) => {
  if (!storage) return makeTrackingId(prefix);
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const next = makeTrackingId(prefix);
    storage.setItem(key, next);
    return next;
  } catch {
    return makeTrackingId(prefix);
  }
};

const getMaintenanceTrackingUrl = () => {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/fd')) {
    return `${window.location.origin}/fd/api/public/tracking/event`;
  }
  return `${getPosApiBaseUrl()}/public/tracking/event`;
};

const EXPERIENCE_RESET_ID_BY_EMAIL: Record<string, string> = {
  "anthony@furnituredistributors.net": "reset-20260428-1505",
};

const getExperienceResetId = (user?: AuthUser | null) => {
  if (user?.tutorialResetAt) return `reset-${user.tutorialResetAt.replace(/[^0-9A-Za-z_-]/g, '')}`;
  return user?.email ? EXPERIENCE_RESET_ID_BY_EMAIL[user.email.toLowerCase()] || null : null;
};

const getExperienceResetStorageKey = (user?: AuthUser | null) => {
  const resetId = getExperienceResetId(user);
  return resetId ? `fd-experience-reset:${user?.id || 'local'}:${resetId}` : null;
};

const getModuleTourStorageKey = (module: string, user?: AuthUser | null) => {
  const baseKey = `fd-tour-${module}:${user?.id || 'local'}`;
  const resetId = getExperienceResetId(user);
  return resetId ? `${baseKey}:${resetId}` : baseKey;
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [requestedWolfdenSubTab, setRequestedWolfdenSubTab] = useState<WolfdenSubTab>('ups');
  const [requestedWolfdenSubTabToken, setRequestedWolfdenSubTabToken] = useState(0);
  const [requestedPulseSubTab, setRequestedPulseSubTab] = useState<'sales' | 'alphaos' | 'alphapulse' | 'website' | 'reviews'>('sales');
  const [requestedPulseSubTabToken, setRequestedPulseSubTabToken] = useState(0);
  const [currentPulseSubTab, setCurrentPulseSubTab] = useState<'sales' | 'alphaos' | 'alphapulse' | 'website' | 'reviews'>('sales');
  const [requestedAmpSubTab, setRequestedAmpSubTab] = useState<AmpSubTab>('social');
  const [requestedAmpSubTabToken, setRequestedAmpSubTabToken] = useState(0);
  const [requestedShopSubTab, setRequestedShopSubTab] = useState<'search' | 'pos'>('search');
  const [requestedShopSubTabToken, setRequestedShopSubTabToken] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  type ThemeMode = 'light' | 'live' | 'dark';
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('fd_theme_mode');
      if (stored === 'light' || stored === 'live' || stored === 'dark') return stored;
      return 'dark';
    } catch {
      return 'dark';
    }
  });
  const [liveWeatherCondition, setLiveWeatherCondition] = useState<string | null>(null);
  const parseWeather = (cond: string | null) => {
    if (!cond) return { code: -1, isDay: true };
    const parts = cond.split(':');
    return { code: Number(parts[0]) || 0, isDay: parts[1] === '1' };
  };
  const { code: weatherCode, isDay: isWeatherDay } = parseWeather(liveWeatherCondition);
  const isDarkMode = themeMode === 'dark' || (themeMode === 'live' && (!isWeatherDay || weatherCode > 3));
  const weatherEffectClass = themeMode === 'live' && liveWeatherCondition !== null ? (
    isWeatherDay ? (
      weatherCode <= 1 ? 'weather-sunny' :
      weatherCode <= 3 ? 'weather-partly-cloudy' :
      weatherCode <= 48 ? 'weather-cloudy' :
      weatherCode <= 67 ? 'weather-rainy' :
      weatherCode <= 77 ? 'weather-snowy' :
      'weather-stormy'
    ) : (
      weatherCode <= 1 ? 'weather-clear-night' :
      weatherCode <= 3 ? 'weather-partly-cloudy-night' :
      weatherCode <= 48 ? 'weather-cloudy' :
      weatherCode <= 67 ? 'weather-rainy' :
      weatherCode <= 77 ? 'weather-snowy' :
      'weather-stormy'
    )
  ) : '';
  const getWeatherLabel = (code: number, isDay: boolean) => {
    if (code <= 1) return isDay ? 'Sunny' : 'Clear';
    if (code <= 3) return isDay ? 'Partly Cloudy' : 'Partly Cloudy';
    if (code <= 48) return 'Cloudy';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    return 'Storm';
  };
  const weatherLabel = themeMode === 'live' && liveWeatherCondition !== null ? getWeatherLabel(weatherCode, isWeatherDay) : null;
  const elementRefs = useRef<Map<string, HTMLElement | null>>(new Map());

  const [authReady, setAuthReady] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({
    googleWorkspaceEnabled: false,
    googleClientId: '',
    googleHostedDomain: '',
  });
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authStage, setAuthStage] = useState<'sign_in' | 'request_access' | 'pending'>('sign_in');
  const [requestProfile, setRequestProfile] = useState<AccessRequestProfile | null>(null);
  const [requestPhone, setRequestPhone] = useState('');
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [headerSearch, setHeaderSearch] = useState('');
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);
  const [showRange, setShowRange] = useState(false);
  const [itemSortMetric, setItemSortMetric] = useState<'sales' | 'qty'>('sales');
  const [updatePanelOpen, setUpdatePanelOpen] = useState(false);
  const [updatePanelClosing, setUpdatePanelClosing] = useState(false);
  const [missingItemData, setMissingItemData] = useState(false);
  const [missingSalesData, setMissingSalesData] = useState(false);
  const [activeFilterLabel, setActiveFilterLabel] = useState<string | null>(null);
  const [botbotOpen, setBotbotOpen] = useState(false);
  const [botbotAssistantName, setBotbotAssistantName] = useState('BotBot');
  const [botbotTheme, setBotbotTheme] = useState('sky');
  const [showBotBotTutorial, setShowBotBotTutorial] = useState(false);
  const [pendingBotBotTutorial, setPendingBotBotTutorial] = useState(false);
  const [botBotTutorialRunKey, setBotBotTutorialRunKey] = useState(0);

  const completeBotBotTutorial = async () => {
    setShowBotBotTutorial(false);
    setPendingBotBotTutorial(false);
    try {
      const { saveSettings } = await import('./services/botbotApi');
      await saveSettings({ tutorialCompleted: true });
    } catch (err) {
      console.error('Failed to save BotBot tutorial completion:', err);
    }
  };
  const skipBotBotTutorial = async () => {
    await completeBotBotTutorial();
  };
  const handleStartBotBotTutorial = () => {
    setBotBotTutorialRunKey((value) => value + 1);
    setShowBotBotTutorial(true);
    setPendingBotBotTutorial(false);
  };
  const handleRestartBotBotTutorial = () => {
    setBotBotTutorialRunKey((value) => value + 1);
    setShowBotBotTutorial(true);
    setPendingBotBotTutorial(false);
  };
  const handleBotBotTutorialHelp = () => {
    setShowBotBotTutorial(false);
    setActiveTab(Tab.ADMIN);
    setRequestedSettingsPanel('permissions');
    setBotbotOpen(true);
    setBotBotTutorialRunKey((value) => value + 1);
  };
  const [showTooltips, setShowTooltips] = useState(() => {
    try {
      const v = localStorage.getItem('fd_tooltips_enabled');
      return v ? v === 'true' : false;
    } catch {
      return false;
    }
  });
  const [requestedSettingsPanel, setRequestedSettingsPanel] = useState<'users' | 'employees' | 'permissions' | 'social' | null>(null);

  useEffect(() => {
    if (themeMode !== 'live') return;
    let stopped = false;
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=34.72&longitude=-76.73&current=weather_code,is_day&timezone=auto');
        if (stopped || !res.ok) return;
        const data = await res.json();
        if (stopped) return;
        const code = data.current?.weather_code;
        const isDay = data.current?.is_day;
        const condition = code !== undefined && isDay !== undefined ? `${code}:${isDay}` : null;
        setLiveWeatherCondition(condition);
      } catch { }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 300000);
    return () => { stopped = true; clearInterval(interval); };
  }, [themeMode]);

  useEffect(() => {
    if (DASHBOARD_LOCKED) {
      setAuthReady(true);
      return;
    }
    let stopped = false;
    void (async () => {
      try {
        const [userResult, configResult] = await Promise.allSettled([fetchCurrentUser(), fetchAuthConfig()]);
        if (stopped) return;

        if (userResult.status === 'fulfilled') {
          setAuthUser(userResult.value);
        } else {
          setAuthUser(null);
        }

        if (configResult.status === 'fulfilled') {
          setAuthConfig(configResult.value);
        }
      } finally {
        if (!stopped) setAuthReady(true);
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    if (!DASHBOARD_LOCKED || typeof window === 'undefined') return;

    const visitorId = getStoredTrackingId(window.localStorage, MAINTENANCE_VISITOR_KEY, 'visitor');
    const sessionId = getStoredTrackingId(window.sessionStorage, MAINTENANCE_SESSION_KEY, 'session');
    const payload = {
      site: MAINTENANCE_TRACKING_SITE,
      pagePath: window.location.pathname,
      pageUrl: window.location.href,
      pageTitle: document.title || 'WOLF FD Dashboard',
      eventType: 'pageview',
      eventName: 'maintenance_view',
      referrer: document.referrer || '',
      visitorId,
      sessionId,
      meta: {
        mode: 'maintenance',
        locked: true,
      },
    };
    const body = JSON.stringify(payload);
    const trackingUrl = getMaintenanceTrackingUrl();

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(trackingUrl, blob);
        return;
      }
    } catch {
      // fall back to fetch
    }

    void fetch(trackingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'include',
    }).catch(() => {
      // best-effort visit logging only
    });
  }, []);

  // Load BotBot settings and check if tutorial should show
  useEffect(() => {
    if (!authUser) return;

    const loadBotBotSettings = async () => {
      const resetStorageKey = getExperienceResetStorageKey(authUser);
      const shouldRunReset = Boolean(resetStorageKey && !localStorage.getItem(resetStorageKey));
      try {
        const { fetchSettings } = await import('./services/botbotApi');
        const settings = await fetchSettings();
        const needsTutorial = !settings || !settings.tutorialCompleted || shouldRunReset;

        if (settings) {
          setBotbotAssistantName(settings.assistantName);
          setBotbotTheme(settings.assistantTheme);
        }

        setPendingBotBotTutorial(needsTutorial);
        if (!needsTutorial) {
          return;
        }
      } catch (err) {
        console.error('Failed to load BotBot settings:', err);
        setPendingBotBotTutorial(true);
      }
    };

    loadBotBotSettings();
  }, [authUser]);

  useEffect(() => {
    if (!pendingBotBotTutorial || !authUser) return;
    const resetStorageKey = getExperienceResetStorageKey(authUser);
    if (resetStorageKey) {
      try {
        localStorage.setItem(resetStorageKey, new Date().toISOString());
      } catch {
        // If storage is blocked, the tutorial still opens for this session.
      }
    }
    setBotBotTutorialRunKey((value) => value + 1);
    setShowBotBotTutorial(true);
    setPendingBotBotTutorial(false);
  }, [authUser, pendingBotBotTutorial]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { label?: string } | undefined;
      if (detail?.label) setRangeLabel(detail.label);
    };
    window.addEventListener('fd-range', handler as EventListener);
    return () => window.removeEventListener('fd-range', handler as EventListener);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowRange(window.scrollY > 260);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { missing?: boolean } | undefined;
      setMissingItemData(Boolean(detail?.missing));
    };
    window.addEventListener('fd-items-missing', handler as EventListener);
    return () => window.removeEventListener('fd-items-missing', handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { missing?: boolean } | undefined;
      setMissingSalesData(Boolean(detail?.missing));
    };
    window.addEventListener('fd-sales-missing', handler as EventListener);
    return () => window.removeEventListener('fd-sales-missing', handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { salesperson?: string; store?: string } | undefined;
      const salesperson = detail?.salesperson?.trim() || '';
      const store = detail?.store?.trim() || '';
      const label = salesperson && store
        ? `Salesperson: ${salesperson} · Store: ${store}`
        : salesperson
          ? `Salesperson: ${salesperson}`
          : store
            ? `Store: ${store}`
            : '';
      setActiveFilterLabel(label || null);
    };
    window.addEventListener('fd-filter', handler as EventListener);
    return () => window.removeEventListener('fd-filter', handler as EventListener);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('fd_tooltips_enabled', String(showTooltips));
    } catch {
      // ignore storage failures
    }
  }, [showTooltips]);

  useEffect(() => {
    try {
      localStorage.setItem('fd_theme_dark', String(isDarkMode));
    } catch {
      // ignore storage failures
    }
  }, [isDarkMode]);

  const userRoles = (authUser?.roles || []) as UserRole[];
  const userPermissions = authUser?.permissions || [];
  const permissionMode = authUser?.permissionMode;
  const canUsePermission = (permissionKey: string) =>
    hasPermission(userRoles, userPermissions, permissionMode, permissionKey);
  const availableTabs = (Object.values(Tab) as Tab[]).filter((tab) =>
    canAccessTab(userRoles, userPermissions, permissionMode, tab)
  );
  const isSalesHeaderView = activeTab === Tab.SALES || (activeTab === Tab.PULSE && currentPulseSubTab === 'sales');
  const botBotTutorialSteps = useMemo(
    () =>
      buildBotBotTutorialSteps({
        canOpenPulse: canAccessTab(userRoles, userPermissions, permissionMode, Tab.PULSE),
        canOpenDen: canAccessTab(userRoles, userPermissions, permissionMode, Tab.WOLFDEN),
        canOpenSales: canAccessTab(userRoles, userPermissions, permissionMode, Tab.SALES),
        canOpenShop: canAccessTab(userRoles, userPermissions, permissionMode, Tab.SHOP),
        canOpenProductSearch: canAccessTab(userRoles, userPermissions, permissionMode, Tab.PRODUCT_SEARCH),
        canOpenCrm: canAccessTab(userRoles, userPermissions, permissionMode, Tab.CRM),
        hasSettingsPanel: canAccessTab(userRoles, userPermissions, permissionMode, Tab.ADMIN),
      }),
    [userRoles, userPermissions, permissionMode]
  );
  const botBotTutorialActiveSteps = useMemo(
    () =>
      botBotTutorialSteps.filter(
        (step) =>
          !step.requiredModules ||
          step.requiredModules.length === 0 ||
          step.requiredModules.every((permissionKey) => canUsePermission(permissionKey))
      ),
    [botBotTutorialSteps, canUsePermission, userRoles, userPermissions, permissionMode]
  );

  const botBotTutorialState = useMemo(
    () => ({
      sidebarOpen,
      activeTab,
      requestedPulseSubTab,
      currentPulseSubTab,
      requestedWolfdenSubTab,
    }),
    [sidebarOpen, activeTab, requestedPulseSubTab, currentPulseSubTab, requestedWolfdenSubTab]
  );

  const isBotBotTutorialBlockingTours = Boolean(authUser && (pendingBotBotTutorial || showBotBotTutorial));

  useEffect(() => {
    if (!authUser) return;
    if (availableTabs.includes(activeTab)) return;
    setActiveTab(availableTabs[0] || Tab.DASHBOARD);
  }, [authUser, activeTab, availableTabs]);

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Email and password are required.');
      return;
    }
    setLoginPending(true);
    setLoginError(null);
    try {
      const user = await loginWithPassword(loginEmail.trim(), loginPassword);
      setAuthUser(user);
      setAuthStage('sign_in');
      setRequestProfile(null);
      setRequestPhone('');
      setPendingGoogleCredential('');
      setLoginPassword('');
    } catch (error: any) {
      setLoginError(String(error?.message || error || 'Login failed. Check your credentials.'));
    } finally {
      setLoginPending(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    if (!credential) {
      setLoginError('Google sign-in did not return a valid credential.');
      return;
    }
    setLoginPending(true);
    setLoginError(null);
    try {
      const result = await startGoogleSignIn(credential);
      if (result.status === 'approved' && result.user) {
        setAuthUser(result.user);
        setAuthStage('sign_in');
        setRequestProfile(null);
        setRequestPhone('');
        setPendingGoogleCredential('');
      }

      setPendingGoogleCredential(credential);
      setRequestProfile(result.requestProfile);
      setRequestPhone(result.requestProfile?.phone || '');
      if (result.status === 'pending' && (result.requestProfile?.phone || '').trim()) {
        setAuthStage('pending');
      } else {
        setAuthStage('request_access');
      }
    } catch (error: any) {
      setLoginError(String(error?.message || error || 'Google sign-in failed.'));
    } finally {
      setLoginPending(false);
    }
  };

  const handleSubmitRequestAccess = async () => {
    if (!pendingGoogleCredential) {
      setLoginError('Please start with Google sign-in again before requesting access.');
      setAuthStage('sign_in');
      return;
    }
    if (!requestPhone.trim()) {
      setLoginError('Phone number is required so the owner can reach you.');
      return;
    }

    setLoginPending(true);
    setLoginError(null);
    try {
      const result = await submitGoogleAccessRequest(pendingGoogleCredential, requestPhone.trim());
      if (result.status === 'approved' && result.user) {
        setAuthUser(result.user);
        setAuthStage('sign_in');
        setRequestProfile(null);
        setRequestPhone('');
        setPendingGoogleCredential('');
      }
      setRequestProfile(result.requestProfile);
      setRequestPhone(result.requestProfile?.phone || requestPhone.trim());
      setAuthStage('pending');
    } catch (error: any) {
      setLoginError(String(error?.message || error || 'Unable to submit access request.'));
    } finally {
      setLoginPending(false);
    }
  };

  const handleBackToSignIn = () => {
    setAuthStage('sign_in');
    setLoginError(null);
  };

  const handleLogout = async () => {
    await logoutCurrentUser();
    setAuthUser(null);
    setAuthStage('sign_in');
    setRequestProfile(null);
    setRequestPhone('');
    setPendingGoogleCredential('');
    setLoginPassword('');
    setLoginError(null);
    setPasswordModalOpen(false);
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setPasswordMessage(null);
    setPasswordError(null);
    setUpdatePanelOpen(false);
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);
    setPasswordError(null);
    if (!currentPasswordInput || !newPasswordInput) {
      setPasswordError('Current and new password are required.');
      return;
    }
    if (newPasswordInput.length < 4) {
      setPasswordError('New password must be at least 4 characters.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('New password confirmation does not match.');
      return;
    }
    setPasswordBusy(true);
    try {
      await changeCurrentPassword(currentPasswordInput, newPasswordInput);
      setPasswordMessage('Password updated.');
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      window.setTimeout(() => setPasswordModalOpen(false), 700);
    } catch {
      setPasswordError('Unable to change password. Verify your current password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const openChangePasswordModal = () => {
    setPasswordModalOpen(true);
    setPasswordMessage(null);
    setPasswordError(null);
  };

  const closeUpdatePanel = () => {
    setUpdatePanelClosing(true);
    window.setTimeout(() => {
      setUpdatePanelOpen(false);
      setUpdatePanelClosing(false);
    }, 220);
  };

  const openWolfdenSubTab = (subTab: WolfdenSubTab) => {
    setRequestedWolfdenSubTab(subTab);
    setRequestedWolfdenSubTabToken((current) => current + 1);
    setActiveTab(Tab.WOLFDEN);
  };

  const openPulseSubTab = (subTab: 'sales' | 'alphaos' | 'alphapulse' | 'website' | 'reviews') => {
    setRequestedPulseSubTab(subTab);
    setRequestedPulseSubTabToken((current) => current + 1);
    setActiveTab(Tab.PULSE);
  };

  const openAmpSubTab = (subTab: AmpSubTab) => {
    setRequestedAmpSubTab(subTab);
    setRequestedAmpSubTabToken((current) => current + 1);
    setActiveTab(Tab.AMP);
  };

  const openShopSubTab = (subTab: 'search' | 'pos') => {
    setRequestedShopSubTab(subTab);
    setRequestedShopSubTabToken((current) => current + 1);
    setActiveTab(Tab.SHOP);
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.DASHBOARD:
        return (
          <div ref={(el) => elementRefs.current.set('dashboard-overview', el)} className="h-full">
            <DashboardOverview
              isDarkMode={isDarkMode}
              canViewCard={(cardId) => {
                const permissionKey = DASHBOARD_CARD_PERMISSION_BY_ID[cardId];
                if (!permissionKey) return true;
                return canUsePermission(permissionKey);
              }}
              onNavigate={(tab) => {
                if (tab === 'SALES' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.PULSE)) openPulseSubTab('sales');
                if (tab === 'TASKS' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.TASKS)) setActiveTab(Tab.TASKS);
                if (tab === 'CRM' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.CRM)) setActiveTab(Tab.CRM);
                if (tab === 'SOCIAL' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.AMP)) openAmpSubTab('social');
                if (tab === 'KIOSKS' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.PULSE)) openPulseSubTab('alphaos');
                if (tab === 'PRODUCT_SEARCH' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.SHOP)) openShopSubTab('search');
                if (tab === 'WOLFDEN_UPS' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.WOLFDEN)) openWolfdenSubTab('ups');
                if (tab === 'WOLFDEN_CRM' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.WOLFDEN)) openWolfdenSubTab('crm');
                if (tab === 'WOLFDEN_BOARD' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.WOLFDEN)) openWolfdenSubTab('board');
                if (tab === 'WOLFDEN_MEETING' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.WOLFDEN)) openWolfdenSubTab('meeting');
                if (tab === 'WOLFDEN_TASKS' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.WOLFDEN)) openWolfdenSubTab('tasks');
                if (tab === 'WOLFDEN_QUICKLINKS') window.open('https://sites.google.com/view/fdserver/home', '_blank', 'noopener,noreferrer');
                if (tab === 'PULSE_SALES' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.PULSE)) openPulseSubTab('sales');
                if (tab === 'PULSE_ALPHAOS' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.PULSE)) openPulseSubTab('alphaos');
                if (tab === 'PULSE_ALPHAPULSE') window.open('https://furnituredistributors.wolf.discount/alphapulse/', '_blank', 'noopener,noreferrer');
                if (tab === 'PULSE_WEBSITE' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.PULSE)) openPulseSubTab('website');
                if (tab === 'PULSE_REVIEWS') window.open('https://www.furnituredistributors.net/content/connect', '_blank', 'noopener,noreferrer');
                if (tab === 'AMP_SOCIAL' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.AMP)) openAmpSubTab('social');
                if (tab === 'AMP_BOT' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.AMP)) openAmpSubTab('bot');
                if (tab === 'SHOP_SEARCH' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.SHOP)) openShopSubTab('search');
                if (tab === 'SHOP_POS' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.SHOP)) openShopSubTab('pos');
                if (tab === 'UPDATE' && canUsePermission(FEATURE_PERMISSION_KEYS.UPDATE_DB_PANEL)) {
                  setUpdatePanelOpen(true);
                }
              }}
            />
          </div>
        );
      case Tab.SALES:
        return (
          <SalesDashboard
            isDarkMode={isDarkMode}
            itemSortMetric={itemSortMetric}
            showTooltips={showTooltips}
            tourStorageKey={getModuleTourStorageKey('sales-analysis', authUser)}
            enableTourAutoStart={!isBotBotTutorialBlockingTours}
          />
        );
      case Tab.PRODUCT_SEARCH:
        return <ProductSearchWorkspace isDarkMode={isDarkMode} onOpenUploadArea={() => setUpdatePanelOpen(true)} />;
      case Tab.CRM:
        return <CRMWorkspace authUser={authUser!} isDarkMode={isDarkMode} />;
      case Tab.SOCIAL:
        return (
          <WorkAdvertising
            authUser={authUser!}
            onOpenSocialIntegrations={() => {
              setRequestedSettingsPanel('social');
              setActiveTab(Tab.ADMIN);
            }}
          />
        );
      case Tab.KIOSKS:
        return <KiosksStatus />;
      case Tab.MESSAGE_BOARD:
        return <MessageBoard authUser={authUser!} />;
      case Tab.TASKS:
        return <TaskManager />;
      case Tab.ADMIN:
        return (
      <OwnerSettings
            onOpenChangePassword={openChangePasswordModal}
            requestedPanel={requestedSettingsPanel}
            onConsumeRequestedPanel={() => setRequestedSettingsPanel(null)}
            onStartTutorial={handleStartBotBotTutorial} // Pass the function to start tutorial
          />
        );
      case Tab.WOLFDEN:
        return (
          <WolfdenWorkspace
            authUser={authUser!}
            isDarkMode={isDarkMode}
            requestedSubTab={requestedWolfdenSubTab}
            requestedSubTabToken={requestedWolfdenSubTabToken}
            hideTabBar={true}
            tourStorageKey={getModuleTourStorageKey('den', authUser)}
            enableTourAutoStart={!isBotBotTutorialBlockingTours}
          />
        );
      case Tab.PULSE:
        return (
          <PulseWorkspace
            isDarkMode={isDarkMode}
            requestedSubTab={requestedPulseSubTab}
            requestedSubTabToken={requestedPulseSubTabToken}
            onSubTabChange={setCurrentPulseSubTab}
            itemSortMetric={itemSortMetric}
            showTooltips={showTooltips}
            hideTabBar={true}
          />
        );
      case Tab.AMP:
        return (
          <AmpWorkspace
            authUser={authUser!}
            isDarkMode={isDarkMode}
            requestedSubTab={requestedAmpSubTab}
            requestedSubTabToken={requestedAmpSubTabToken}
            onOpenSocialIntegrations={() => {
              setRequestedSettingsPanel('social');
              setActiveTab(Tab.ADMIN);
            }}
            hideTabBar={true}
          />
        );
      case Tab.SHOP:
        return (
          <ShopWorkspace
            isDarkMode={isDarkMode}
            requestedSubTab={requestedShopSubTab}
            requestedSubTabToken={requestedShopSubTabToken}
            onOpenUploadArea={() => setUpdatePanelOpen(true)}
            hideTabBar={true}
          />
        );
      default:
        return <SalesDashboard isDarkMode={isDarkMode} itemSortMetric={itemSortMetric} showTooltips={showTooltips} tourStorageKey={getModuleTourStorageKey('sales-analysis', authUser)} />;
    }
  };

  if (DASHBOARD_LOCKED) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3b0f12_0%,rgba(59,15,18,0)_32%),linear-gradient(180deg,#0f0f12_0%,#191217_50%,#0d0d10_100%)] text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-16">
          <div className="w-full rounded-[2rem] border border-rose-500/20 bg-slate-950/70 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-xl md:p-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-rose-400/20 bg-rose-500/10 text-4xl shadow-lg shadow-rose-950/40">
              🐺
            </div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-rose-300/80">
              WOLF FD Dashboard
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
              {DASHBOARD_NOTICE}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              Dashboard access has been temporarily disabled. No dashboard pages, login access, or operational views are available at this time.
            </p>
            <div className="mt-8 inline-flex items-center rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-100">
              Access restricted
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950">
        <LoadingOverlay darkness={0.84} />
      </div>
    );
  }

  if (!authUser) {
    return (
      <AuthScreen
        stage={authStage}
        email={loginEmail}
        password={loginPassword}
        requestPhone={requestPhone}
        requestProfile={requestProfile}
        pending={loginPending}
        error={loginError}
        googleEnabled={authConfig.googleWorkspaceEnabled}
        googleClientId={authConfig.googleClientId}
        googleHostedDomain={authConfig.googleHostedDomain}
        setEmail={setLoginEmail}
        setPassword={setLoginPassword}
        setRequestPhone={setRequestPhone}
        onLogin={handleLogin}
        onBackToSignIn={handleBackToSignIn}
        onSubmitRequestAccess={handleSubmitRequestAccess}
        onGoogleCredential={handleGoogleCredential}
      />
    );
  }

  const canView = (tab: Tab) => canAccessTab(userRoles, userPermissions, permissionMode, tab);

  return (
    <div
      className={`min-h-screen wolf-theme font-sans ${isDarkMode ? 'dark text-slate-100' : 'text-slate-800'} ${weatherEffectClass} ${
        themeMode === 'live' && liveWeatherCondition !== null
          ? (isWeatherDay ? (
              weatherCode <= 1 ? 'bg-[linear-gradient(160deg,#fef9e7_0%,#fdeaa8_50%,#f7e89e_100%)]' :
              weatherCode <= 3 ? 'bg-[linear-gradient(160deg,#e8f4fc_0%,#c5dff0_50%,#a8d0ec_100%)]' :
              weatherCode <= 48 ? 'bg-[linear-gradient(160deg,#d4dbe0_0%,#b8c0cc_50%,#aab8c4_100%)]' :
              weatherCode <= 67 ? 'bg-[linear-gradient(160deg,#d3dce6_0%,#b5c5d4_50%,#9fb5c8_100%)]' :
              weatherCode <= 77 ? 'bg-[linear-gradient(160deg,#e8ecf0_0%,#d0dae6_50%,#c0cfde_100%)]' :
              'bg-[linear-gradient(160deg,#4a5568_0%,#2d3748_50%,#1a202c_100%)]'
            ) : (
              weatherCode <= 1 ? 'bg-[linear-gradient(160deg,#0f1722_0%,#1e293b_50%,#334155_100%)]' :
              weatherCode <= 3 ? 'bg-[linear-gradient(160deg,#1e293b_0%,#334155_50%,#475569_100%)]' :
              weatherCode <= 48 ? 'bg-[linear-gradient(160deg,#374151_0%,#4b5563_50%,#6b7280_100%)]' :
              weatherCode <= 67 ? 'bg-[linear-gradient(160deg,#1f2937_0%,#374151_50%,#4b5563_100%)]' :
              weatherCode <= 77 ? 'bg-[linear-gradient(160deg,#374151_0%,#4b5563_50%,#6b7280_100%)]' :
              'bg-[linear-gradient(160deg,#0f1722_0%,#1e293b_50%,#0f1722_100%)]'
            ))
          : isDarkMode
            ? 'bg-[radial-gradient(circle_at_top,#24344a_0%,rgba(36,52,74,0)_28%),linear-gradient(160deg,#0f1722_0%,#162131_48%,#111a27_100%)]'
            : 'bg-[linear-gradient(160deg,#e9f0f8_0%,#dde7f3_52%,#d2dfee_100%)]'
      }`}
    >
      <style>{APP_THEME_STYLES}
        {themeMode === 'live' && liveWeatherCondition !== null && weatherCode >= 51 && weatherCode <= 67 ? `
          .weather-rainy::before { content: ''; position: fixed; inset: 0; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='20' viewBox='0 0 4 20'%3E%3Cline x1='2' y1='0' x2='2' y2='20' stroke='%236b7280' stroke-width='2' opacity='0.3'/%3E%3C/svg%3E"); animation: rain 0.5s linear infinite; opacity: 0.4; }
          @keyframes rain { from { background-position: 0 0; } to { background-position: 10px 20px; } }
        ` : ''}
        {themeMode === 'live' && liveWeatherCondition !== null && weatherCode >= 71 && weatherCode <= 77 ? `
          .weather-snowy::before { content: ''; position: fixed; inset: 0; pointer-events: none; background-image: radial-gradient(2px 2px at 20px 30px, white, transparent), radial-gradient(2px 2px at 40px 70px, white, transparent), radial-gradient(2px 2px at 50px 160px, white, transparent), radial-gradient(2px 2px at 90px 40px, white, transparent), radial-gradient(2px 2px at 130px 80px, white, transparent); background-size: 200px 200px; animation: snow 3s linear infinite; opacity: 0.5; }
          @keyframes snow { from { background-position: 0 0; } to { background-position: 200px 200px; } }
        ` : ''}
        {themeMode === 'live' && liveWeatherCondition !== null && !isWeatherDay ? `
          .weather-clear-night::before, .weather-partly-cloudy-night::before { content: ''; position: fixed; inset: 0; pointer-events: none; background-image: radial-gradient(1px 1px at 10% 20%, white 100%, transparent), radial-gradient(1.5px 1.5px at 30% 10%, white 100%, transparent), radial-gradient(1px 1px at 50% 35%, white 100%, transparent), radial-gradient(1.5px 1.5px at 70% 15%, white 100%, transparent), radial-gradient(1px 1px at 90% 40%, white 100%, transparent), radial-gradient(1px 1px at 15% 55%, white 100%, transparent), radial-gradient(1.5px 1.5px at 35% 50%, white 100%, transparent), radial-gradient(1px 1px at 55% 70%, white 100%, transparent), radial-gradient(1px 1px at 75% 65%, white 100%, transparent), radial-gradient(1.5px 1.5px at 95% 80%, white 100%, transparent), radial-gradient(1px 1px at 20% 85%, white 100%, transparent), radial-gradient(1px 1px at 40% 90%, white 100%, transparent), radial-gradient(1px 1px at 60% 95%, white 100%, transparent), radial-gradient(1.5px 1.5px at 80% 75%, white 100%, transparent), radial-gradient(1px 1px at 25% 30%, white 100%, transparent), radial-gradient(1px 1px at 65% 25%, white 100%, transparent); background-size: 100% 100%; animation: twinkle 4s ease-in-out infinite; opacity: 0.7; }
          @keyframes twinkle { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        ` : ''}
      </style>
      <div className="flex transition-[filter] duration-500">
        <aside
          className={`${sidebarOpen ? 'w-64' : 'w-20'} fixed h-screen border-r text-white backdrop-blur-xl transition-all duration-300 ease-in-out z-20 flex flex-col ${
            isDarkMode
              ? 'bg-[#101825]/94 border-white/6'
              : 'bg-white/88 border-slate-200/80 text-slate-900'
          }`}
        >
          <button
            data-tour-id="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`h-24 w-full flex items-center justify-center border-b transition-colors ${
              isDarkMode ? 'border-white/6 hover:bg-white/5' : 'border-slate-200/80 hover:bg-slate-50/90'
            }`}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <Sofa className="text-blue-400" />
                <div className="leading-tight text-left">
                  <div className={`font-bold text-2xl tracking-tight ${isDarkMode ? 'text-slate-50' : 'text-slate-900'}`}>WOLF FD</div>
                  <div className={`text-sm uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Furniture Distributors</div>
                  <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Work Online · Live Free</div>
                </div>
              </div>
            ) : (
              <Sofa className="text-blue-400" size={32} />
            )}
          </button>

          <nav className="flex-1 py-6 px-3 space-y-1.5">
            {canView(Tab.DASHBOARD) && (
              <NavItem
                ref={(el) => elementRefs.current.set('sidebar-dashboard-nav-item', el)}
                tourId="sidebar-dashboard-nav-item"
                icon={<LayoutDashboard size={24} />}
                label="Dashboard"
                isActive={activeTab === Tab.DASHBOARD}
                onClick={() => {
                  setActiveTab(Tab.DASHBOARD);
                }}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
            {canView(Tab.WOLFDEN) && (
              <NavItem
                ref={(el) => elementRefs.current.set('sidebar-wolfden-nav-item', el)}
                tourId="sidebar-wolfden-nav-item"
                icon={<Inbox size={24} />}
                label="Den"
                isActive={activeTab === Tab.WOLFDEN}
                onClick={() => openWolfdenSubTab('ups')}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
            {canView(Tab.PULSE) && (
              <NavItem
                tourId="sidebar-pulse-nav-item"
                icon={<Zap size={24} />}
                label="Pulse"
                isActive={activeTab === Tab.PULSE}
                onClick={() => openPulseSubTab('sales')}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
            {canView(Tab.AMP) && (
              <NavItem
                tourId="sidebar-amp-nav-item"
                icon={<Bot size={24} />}
                label="AMP"
                isActive={activeTab === Tab.AMP}
                onClick={() => setActiveTab(Tab.AMP)}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
            {canView(Tab.SHOP) && (
              <NavItem
                ref={(el) => elementRefs.current.set('sidebar-shop-nav-item', el)}
                tourId="sidebar-shop-nav-item"
                icon={<ClipboardList size={24} />}
                label="Shop"
                isActive={activeTab === Tab.SHOP}
                onClick={() => setActiveTab(Tab.SHOP)}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
          </nav>

          <div className="px-3 pb-1">
              {canView(Tab.ADMIN) && (
              <button
                ref={(el) => elementRefs.current.set('sidebar-settings-nav-item', el)}
                data-tour-id="sidebar-settings-nav-item"
                onClick={() => { setActiveTab(Tab.ADMIN); }}
                className={`w-full flex items-center gap-3 px-3 py-4 h-14 rounded-2xl cursor-pointer transition-all ${
                  activeTab === Tab.ADMIN
                    ? isDarkMode
                      ? 'bg-sky-400/12 border border-sky-300/28 text-slate-50 shadow-sm'
                      : 'bg-sky-50 border border-sky-200 text-sky-700 shadow-sm'
                    : isDarkMode
                      ? 'border border-transparent text-slate-300 hover:bg-white/6 hover:border-white/8 hover:text-slate-50'
                      : 'border border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200 hover:text-slate-900'
                } ${!sidebarOpen ? 'justify-center' : ''}`}
              >
                <Settings size={24} />
                {sidebarOpen && <span className="font-medium text-base">Settings</span>}
              </button>
            )}
            <button
              onClick={() => { handleLogout(); }}
              className={`w-full flex items-center gap-3 px-3 py-4 h-14 rounded-2xl cursor-pointer transition-all ${
                isDarkMode
                  ? 'border border-transparent text-slate-300 hover:bg-white/6 hover:border-white/8 hover:text-slate-50'
                  : 'border border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200 hover:text-slate-900'
              } ${!sidebarOpen ? 'justify-center' : ''}`}
            >
              <LogOut size={24} />
              {sidebarOpen && <span className="font-medium text-base">Sign out</span>}
            </button>
          </div>

          {canUsePermission(FEATURE_PERMISSION_KEYS.UPDATE_DB_PANEL) && (
            <div className={`p-3 border-t ${isDarkMode ? 'border-white/6' : 'border-slate-200/80'}`}>
              <button
                ref={(el) => elementRefs.current.set('sidebar-update-db-panel', el)}
                onClick={() => {
                  if (updatePanelOpen) {
                    closeUpdatePanel();
                  } else {
                    setUpdatePanelOpen(true);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-4 h-14 rounded-2xl transition-all ${
                  updatePanelOpen
                    ? isDarkMode
                      ? 'bg-sky-400/12 border border-sky-300/28 text-slate-50 shadow-sm'
                      : 'bg-slate-900 border border-slate-900 text-white shadow-sm'
                    : isDarkMode
                      ? 'border border-transparent text-slate-300 hover:bg-white/6 hover:border-white/8 hover:text-slate-50'
                      : 'border border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200 hover:text-slate-900'
                } ${!sidebarOpen ? 'justify-center' : ''}`}
                title="Update database"
              >
                <UploadCloud size={24} />
                {sidebarOpen && <div className="text-base font-medium">Update DB</div>}
              </button>
            </div>
          )}

          <div
            className={`px-3 pb-4 pt-2 text-[11px] tracking-[0.18em] uppercase ${
              isDarkMode ? 'text-slate-500' : 'text-slate-400'
            } ${sidebarOpen ? 'text-left' : 'text-center'}`}
            title={`Dashboard version ${APP_VERSION}`}
          >
            {sidebarOpen ? `Version ${APP_VERSION}` : `v${APP_VERSION}`}
          </div>
        </aside>

      <main className={`flex-1 transition-[margin] duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <header className={`h-20 backdrop-blur-xl sticky top-0 z-10 px-6 lg:px-8 flex items-center justify-between shadow-sm border-b ${
            isDarkMode
              ? 'bg-[#121b27]/78 border-slate-700/60'
              : 'bg-white/70 border-slate-200/60'
          }`}>
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <span>{getTabTitle(activeTab)}</span>
              </h1>
              {authUser && (
                <span className={`hidden md:inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                  isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                }`}>
                  {(() => {
                    const parts = authUser.name.trim().split(' ');
                    const firstName = parts[0] || '';
                    const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : '';
                    return lastInitial ? `${firstName} ${lastInitial}.` : firstName;
                  })()}
                </span>
              )}
            </div>

            {/* Sub-tabs for modules */}
            {activeTab === Tab.WOLFDEN && (
              <div className="hidden md:flex items-center gap-1 ml-6">
                <button
                  data-tour-id="den-tab-ups"
                  onClick={() => openWolfdenSubTab('ups')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedWolfdenSubTab === 'ups' ? (isDarkMode ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-50 text-amber-600 border border-amber-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><UserCheck size={13} className="inline mr-1.5" />UPS</button>
                <button
                  data-tour-id="den-tab-crm"
                  onClick={() => openWolfdenSubTab('crm')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedWolfdenSubTab === 'crm' ? (isDarkMode ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-50 text-amber-600 border border-amber-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><Users size={13} className="inline mr-1.5" />CRM</button>
                <button
                  data-tour-id="den-tab-board"
                  onClick={() => openWolfdenSubTab('board')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedWolfdenSubTab === 'board' ? (isDarkMode ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-50 text-amber-600 border border-amber-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><MessageSquare size={13} className="inline mr-1.5" />Board</button>
                <button
                  data-tour-id="den-tab-meeting"
                  onClick={() => openWolfdenSubTab('meeting')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedWolfdenSubTab === 'meeting' ? (isDarkMode ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-50 text-amber-600 border border-amber-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><Calendar size={13} className="inline mr-1.5" />Meeting</button>
                <button
                  data-tour-id="den-tab-tasks"
                  onClick={() => openWolfdenSubTab('tasks')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedWolfdenSubTab === 'tasks' ? (isDarkMode ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-50 text-amber-600 border border-amber-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><ClipboardList size={13} className="inline mr-1.5" />Tasks</button>
                <a data-tour-id="den-quicklinks" href="https://sites.google.com/view/fdserver/home" target="_blank" rel="noreferrer" className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><Link2 size={13} className="inline mr-1.5" />QuickLinks</a>
              </div>
            )}
            {activeTab === Tab.PULSE && (
              <div className="hidden md:flex items-center gap-1 ml-6">
                <button data-tour-id="pulse-tab-sales" onClick={() => openPulseSubTab('sales')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedPulseSubTab === 'sales' ? (isDarkMode ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-sky-50 text-sky-600 border border-sky-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><Activity size={13} className="inline mr-1.5" />Sales</button>
                <button data-tour-id="pulse-tab-alphaos" onClick={() => openPulseSubTab('alphaos')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedPulseSubTab === 'alphaos' ? (isDarkMode ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-sky-50 text-sky-600 border border-sky-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><Tv size={13} className="inline mr-1.5" />AlphaOS</button>
                <button data-tour-id="pulse-tab-alphapulse" onClick={() => openPulseSubTab('alphapulse')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedPulseSubTab === 'alphapulse' ? (isDarkMode ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-sky-50 text-sky-600 border border-sky-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><Share2 size={13} className="inline mr-1.5" />AlphaPulse</button>
                <button data-tour-id="pulse-tab-website" onClick={() => openPulseSubTab('website')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedPulseSubTab === 'website' ? (isDarkMode ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-sky-50 text-sky-600 border border-sky-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><Globe size={13} className="inline mr-1.5" />Website</button>
                <button data-tour-id="pulse-tab-reviews" onClick={() => openPulseSubTab('reviews')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedPulseSubTab === 'reviews' ? (isDarkMode ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-sky-50 text-sky-600 border border-sky-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><Star size={13} className="inline mr-1.5" />Reviews</button>
              </div>
            )}
            {activeTab === Tab.AMP && (
              <div className="hidden md:flex items-center gap-1 ml-6">
                <button onClick={() => openAmpSubTab('social')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedAmpSubTab === 'social' ? (isDarkMode ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><Share2 size={13} className="inline mr-1.5" />Social</button>
                <button onClick={() => openAmpSubTab('bot')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedAmpSubTab === 'bot' ? (isDarkMode ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><Bot size={13} className="inline mr-1.5" />AI Bot</button>
                <button onClick={() => openAmpSubTab('tycoon')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedAmpSubTab === 'tycoon' ? (isDarkMode ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><Sofa size={13} className="inline mr-1.5" />Tycoon</button>
              </div>
            )}
            {activeTab === Tab.SHOP && (
              <div className="hidden md:flex items-center gap-1 ml-6">
                <button onClick={() => openShopSubTab('search')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedShopSubTab === 'search' ? (isDarkMode ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30' : 'bg-violet-50 text-violet-600 border border-violet-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><FolderSearch size={13} className="inline mr-1.5" />Search</button>
                <button onClick={() => openShopSubTab('pos')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  requestedShopSubTab === 'pos' ? (isDarkMode ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30' : 'bg-violet-50 text-violet-600 border border-violet-200') : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}><ShoppingCart size={13} className="inline mr-1.5" />POS</button>
              </div>
            )}

            <div className="flex items-center gap-4">
              {isSalesHeaderView && showRange && rangeLabel && (
                <button
                  onClick={() => window.dispatchEvent(new Event('fd-open-range'))}
                  className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full bg-white/70 border border-slate-200 text-slate-600 hover:bg-white"
                  title="Change date range"
                >
                  Range: {rangeLabel}
                  <span className="text-slate-400">Edit</span>
                </button>
              )}
              {isSalesHeaderView && activeFilterLabel && (
                <div className={`hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full border ${
                  isDarkMode
                    ? 'bg-slate-900/80 border-slate-700 text-slate-300'
                    : 'bg-white/70 border-slate-200 text-slate-600'
                }`}>
                  {activeFilterLabel}
                  <button
                    onClick={() => window.dispatchEvent(new Event('fd-clear-filters'))}
                    className={`ml-1 ${isDarkMode ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Clear filters"
                  >
                    ✕
                  </button>
                </div>
              )}
              {isSalesHeaderView && missingItemData && (
                <div className={`hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full border ${
                  isDarkMode
                    ? 'bg-amber-500/10 text-amber-200 border-amber-500/30'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}>
                  Missing data for items for this date range
                </div>
              )}
              {isSalesHeaderView && missingSalesData && (
                <div className={`hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full border ${
                  isDarkMode
                    ? 'bg-amber-500/10 text-amber-200 border-amber-500/30'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}>
                  Missing sales data for this date range
                </div>
              )}
              {isSalesHeaderView && (
                <button
                  onClick={() => window.dispatchEvent(new Event('fd-print-request'))}
                  className={`hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full border transition-colors ${
                    isDarkMode
                      ? 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Print full report"
                >
                  Print Report
                </button>
              )}
              {isSalesHeaderView && (
                <div className={`inline-flex items-center gap-1 rounded-full p-1 text-xs ${
                  isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-slate-100'
                }`}>
                  <button
                    onClick={() => setItemSortMetric('sales')}
                    className={`px-3 py-1 rounded-full font-semibold ${
                      itemSortMetric === 'sales'
                        ? isDarkMode
                          ? 'bg-slate-100 text-slate-950 shadow-sm'
                          : 'bg-white text-slate-900 shadow-sm'
                        : isDarkMode
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Sales $
                  </button>
                  <button
                    onClick={() => setItemSortMetric('qty')}
                    className={`px-3 py-1 rounded-full font-semibold ${
                      itemSortMetric === 'qty'
                        ? isDarkMode
                          ? 'bg-slate-100 text-slate-950 shadow-sm'
                          : 'bg-white text-slate-900 shadow-sm'
                        : isDarkMode
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Qty
                  </button>
                </div>
)}
              {weatherLabel && (
                <div className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                  isWeatherDay
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {isWeatherDay ? <Sun size={12} /> : <Moon size={12} />}
                  {weatherLabel}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => { setThemeMode('light'); localStorage.setItem('fd_theme_mode', 'light'); }}
                  className={`p-1.5 rounded-full transition-all ${
                    themeMode === 'light'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Light"
                >
                  <Sun size={16} />
                </button>
                <button
                  onClick={() => { setThemeMode('live'); localStorage.setItem('fd_theme_mode', 'live'); }}
                  className={`p-1.5 rounded-full transition-all ${
                    themeMode === 'live'
                      ? 'bg-gradient-to-r from-blue-400 to-cyan-300 text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Live"
                >
                  <Activity size={16} />
                </button>
                <button
                  onClick={() => { setThemeMode('dark'); localStorage.setItem('fd_theme_mode', 'dark'); }}
                  className={`p-1.5 rounded-full transition-all ${
                    themeMode === 'dark'
                      ? 'bg-slate-700 text-slate-100 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Dark"
                >
                  <Moon size={16} />
                </button>
              </div>
            </div>
          </header>

          <div className="p-5 lg:p-7">
            <div data-tour-id="botbot-main-content">
            {renderContent()}
            </div>
          </div>
        </main>

        {isSalesHeaderView && (
          <button
            type="button"
            onClick={() => setShowTooltips((prev) => !prev)}
            className={`fixed bottom-24 right-6 z-40 h-12 w-12 rounded-full shadow-lg border text-lg font-bold transition-colors ${
              showTooltips
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title={showTooltips ? 'Tooltips on' : 'Tooltips off'}
          >
            ?
          </button>
        )}
        {passwordModalOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setPasswordModalOpen(false)}
            />
            <div className="fixed left-1/2 top-1/2 z-40 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-slate-900">Change Password</h3>
              <p className="mt-1 text-sm text-slate-500">Update your employee password.</p>
              <div className="mt-4 space-y-2">
                <input
                  type="password"
                  value={currentPasswordInput}
                  onChange={(event) => setCurrentPasswordInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Current password"
                />
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(event) => setNewPasswordInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="New password"
                />
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(event) => setConfirmPasswordInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Confirm new password"
                />
              </div>
              {passwordMessage && (
                <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{passwordMessage}</div>
              )}
              {passwordError && (
                <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{passwordError}</div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={passwordBusy}
                  onClick={() => void handleChangePassword()}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {passwordBusy ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </div>
          </>
        )}
        {updatePanelOpen && canUsePermission(FEATURE_PERMISSION_KEYS.UPDATE_DB_PANEL) && (
          <>
            <div
              className={`fixed inset-0 z-20 backdrop-blur-sm animate-[overlayDarken_1.6s_ease_forwards] ${
                updatePanelClosing ? 'opacity-0 transition-opacity duration-200' : ''
              }`}
              onClick={closeUpdatePanel}
            />
            <div
              className={`fixed inset-x-4 bottom-6 z-30 max-h-[78vh] overflow-y-auto transition-all duration-200 sm:right-6 ${
                sidebarOpen ? 'lg:left-72' : 'lg:left-24'
              } ${updatePanelClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
              onClick={(event) => event.stopPropagation()}
            >
              <UpdateDatabase
                onUploadComplete={() => {
                  window.dispatchEvent(new Event('fd-refresh-data'));
                }}
                onOpenProductSearch={
                  canView(Tab.PRODUCT_SEARCH)
                    ? () => {
                        setActiveTab(Tab.PRODUCT_SEARCH);
                        closeUpdatePanel();
                      }
                    : undefined
                }
              />
            </div>
          </>
        )}

      </div>

      {authUser && (
        <BotBotContextProvider userRole={userRoles[0] || 'Employee'}>
          {botbotOpen && (
            <BotBotChatPanel
              authUser={authUser}
              isDarkMode={isDarkMode}
              onClose={() => setBotbotOpen(false)}
            />
          )}
          <BotBotOrb
            isExpanded={botbotOpen}
            isThinking={false}
            hasNotification={false}
            assistantName="BotBot"
            theme="sky"
            isDarkMode={isDarkMode}
            onToggle={() => setBotbotOpen(!botbotOpen)}
          />
        </BotBotContextProvider>
      )}

      {/* BotBot Tutorial - spotlight intro on first login */}
      {authUser && showBotBotTutorial && (
        <BotBotTutorial
          key={`botbot-tutorial-${botBotTutorialRunKey}`}
          isDarkMode={isDarkMode}
          steps={botBotTutorialActiveSteps}
          state={botBotTutorialState}
          userName={authUser.name || 'Friend'}
          onComplete={completeBotBotTutorial}
          onSkip={skipBotBotTutorial}
          onRestart={handleRestartBotBotTutorial}
          onHelp={handleBotBotTutorialHelp}
        />
      )}
    </div>
  );
};

export default App;
