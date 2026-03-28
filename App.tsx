import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  MessageSquare,
  Sofa,
  Search,
  Activity,
  Star,
  Moon,
  Sun,
  UploadCloud,
  Monitor,
  ClipboardList,
  Bot,
  LogOut,
  Settings,
} from 'lucide-react';
import SalesDashboard from './components/SalesDashboard';
import WorkAdvertising from './components/WorkAdvertising';
import UpdateDatabase from './components/UpdateDatabase';
import KiosksStatus from './components/KiosksStatus';
import DashboardOverview from './components/DashboardOverview';
import CRMWorkspace from './components/CRMWorkspace';
import MessageBoard from './components/MessageBoard';
import WolfBot from './components/WolfBot';
import TaskManager from './components/TaskManager';
import OwnerSettings from './components/OwnerSettings';
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
import NavItem from './components/app/NavItem';
import { APP_THEME_STYLES } from './components/app/themeStyles';
import { canAccessTab, getTabTitle, Tab } from './components/app/tabs';
import { DASHBOARD_CARD_PERMISSION_BY_ID, FEATURE_PERMISSION_KEYS, hasPermission } from './components/app/permissions';

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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CRM);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem('fd_theme_dark');
      return stored ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const [showLoading, setShowLoading] = useState(false);
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
  const [wolfbotOpen, setWolfbotOpen] = useState(false);
  const [showTooltips, setShowTooltips] = useState(() => {
    try {
      const v = localStorage.getItem('fd_tooltips_enabled');
      return v ? v === 'true' : false;
    } catch {
      return false;
    }
  });

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

  useEffect(() => {
    if (!showLoading) return;
    const t = window.setTimeout(() => setShowLoading(false), 6500);
    return () => window.clearTimeout(t);
  }, [showLoading]);

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

  useEffect(() => {
    if (activeTab === Tab.DASHBOARD) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }, [activeTab]);

  const userRoles = (authUser?.roles || []) as UserRole[];
  const userPermissions = authUser?.permissions || [];
  const permissionMode = authUser?.permissionMode;
  const canUsePermission = (permissionKey: string) =>
    hasPermission(userRoles, userPermissions, permissionMode, permissionKey);
  const availableTabs = (Object.values(Tab) as Tab[]).filter((tab) =>
    canAccessTab(userRoles, userPermissions, permissionMode, tab)
  );

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
      setShowLoading(true);
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
        setShowLoading(true);
        return;
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
        setShowLoading(true);
        return;
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
    setWolfbotOpen(false);
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

  const renderContent = () => {
    switch (activeTab) {
      case Tab.DASHBOARD:
        return (
          <DashboardOverview
            canViewCard={(cardId) => {
              const permissionKey = DASHBOARD_CARD_PERMISSION_BY_ID[cardId];
              if (!permissionKey) return true;
              return canUsePermission(permissionKey);
            }}
            onNavigate={(tab) => {
              if (tab === 'SALES' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.SALES)) setActiveTab(Tab.SALES);
              if (tab === 'TASKS' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.TASKS)) setActiveTab(Tab.TASKS);
              if (tab === 'CRM' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.CRM)) setActiveTab(Tab.CRM);
              if (tab === 'SOCIAL' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.SOCIAL)) setActiveTab(Tab.SOCIAL);
              if (tab === 'KIOSKS' && canAccessTab(userRoles, userPermissions, permissionMode, Tab.KIOSKS)) setActiveTab(Tab.KIOSKS);
              if (tab === 'UPDATE' && canUsePermission(FEATURE_PERMISSION_KEYS.UPDATE_DB_PANEL)) {
                setUpdatePanelOpen(true);
              }
            }}
          />
        );
      case Tab.SALES:
        return <SalesDashboard itemSortMetric={itemSortMetric} showTooltips={showTooltips} />;
      case Tab.CRM:
        return <CRMWorkspace authUser={authUser!} isDarkMode={isDarkMode} />;
      case Tab.SOCIAL:
        return <WorkAdvertising />;
      case Tab.KIOSKS:
        return <KiosksStatus />;
      case Tab.MESSAGE_BOARD:
        return <MessageBoard authUser={authUser!} />;
      case Tab.TASKS:
        return <TaskManager />;
      case Tab.ADMIN:
        return <OwnerSettings onOpenChangePassword={openChangePasswordModal} />;
      default:
        return <SalesDashboard itemSortMetric={itemSortMetric} showTooltips={showTooltips} />;
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
      className={`min-h-screen wolf-theme font-sans ${isDarkMode ? 'dark text-slate-100' : 'text-slate-800'} ${
        isDarkMode
          ? 'bg-[radial-gradient(circle_at_top,#24344a_0%,rgba(36,52,74,0)_28%),linear-gradient(160deg,#0f1722_0%,#162131_48%,#111a27_100%)]'
          : 'bg-[linear-gradient(160deg,#e9f0f8_0%,#dde7f3_52%,#d2dfee_100%)]'
      }`}
    >
      <style>{APP_THEME_STYLES}</style>
      {showLoading && <LoadingOverlay darkness={0.9} />}
      <div className={`flex ${showLoading ? 'blur-md' : ''} transition-[filter] duration-500`}>
        <aside
          className={`${sidebarOpen ? 'w-64' : 'w-20'} fixed h-screen border-r text-white backdrop-blur-xl transition-all duration-300 ease-in-out z-20 flex flex-col ${
            isDarkMode
              ? 'bg-[#101825]/94 border-white/6'
              : 'bg-white/88 border-slate-200/80 text-slate-900'
          }`}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`h-20 w-full flex items-center justify-center border-b transition-colors ${
              isDarkMode ? 'border-white/6 hover:bg-white/5' : 'border-slate-200/80 hover:bg-slate-50/90'
            }`}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <Sofa className="text-blue-400" />
                <div className="leading-tight text-left">
                  <div className={`font-bold text-xl tracking-tight ${isDarkMode ? 'text-slate-50' : 'text-slate-900'}`}>WOLF FD</div>
                  <div className={`text-[11px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Furniture Distributors</div>
                  <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Work Online · Live Free</div>
                </div>
              </div>
            ) : (
              <Sofa className="text-blue-400" size={28} />
            )}
          </button>

          <nav className="flex-1 py-6 px-3 space-y-1.5">
            {canView(Tab.CRM) && (
              <NavItem
                icon={<MessageSquare size={20} />}
                label="AP CRM"
                isActive={activeTab === Tab.CRM}
                onClick={() => setActiveTab(Tab.CRM)}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
            {canView(Tab.SALES) && (
              <NavItem
                icon={<LayoutDashboard size={20} />}
                label="Sales Analysis"
                isActive={activeTab === Tab.SALES}
                onClick={() => setActiveTab(Tab.SALES)}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
            {canView(Tab.SOCIAL) && (
              <NavItem
                icon={<Activity size={20} />}
                label="Social Posts"
                isActive={activeTab === Tab.SOCIAL}
                onClick={() => setActiveTab(Tab.SOCIAL)}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
            {canView(Tab.TASKS) && (
              <NavItem
                icon={<CheckSquare size={20} />}
                label="Tasks"
                isActive={activeTab === Tab.TASKS}
                onClick={() => setActiveTab(Tab.TASKS)}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
            {canView(Tab.KIOSKS) && (
              <NavItem
                icon={<Monitor size={20} />}
                label="AlphaOS"
                isActive={activeTab === Tab.KIOSKS}
                onClick={() => setActiveTab(Tab.KIOSKS)}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
            {canView(Tab.MESSAGE_BOARD) && (
              <NavItem
                icon={<ClipboardList size={20} />}
                label="Message Board"
                isActive={activeTab === Tab.MESSAGE_BOARD}
                onClick={() => setActiveTab(Tab.MESSAGE_BOARD)}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
            {canView(Tab.ADMIN) && (
              <NavItem
                icon={<Settings size={20} />}
                label="Settings"
                isActive={activeTab === Tab.ADMIN}
                onClick={() => setActiveTab(Tab.ADMIN)}
                isOpen={sidebarOpen}
                isDarkMode={isDarkMode}
              />
            )}
            <div className={`pt-4 mt-4 border-t ${isDarkMode ? 'border-white/6' : 'border-slate-200/80'}`} />
            <NavItem
              icon={<Activity size={20} />}
              label="AlphaPulse"
              isActive={false}
              href="https://furnituredistributors.wolf.discount/alphapulse/"
              target="_blank"
              rel="noreferrer"
              isOpen={sidebarOpen}
              isDarkMode={isDarkMode}
            />
            <NavItem
              icon={<Star size={20} />}
              label="FD Connect Reviews"
              isActive={false}
              href="https://www.furnituredistributors.net/content/connect"
              target="_blank"
              rel="noreferrer"
              isOpen={sidebarOpen}
              isDarkMode={isDarkMode}
            />
            <NavItem
              icon={<LayoutDashboard size={20} />}
              label="QuickLinks"
              isActive={false}
              href="https://sites.google.com/view/fdserver/home"
              target="_blank"
              rel="noreferrer"
              isOpen={sidebarOpen}
              isDarkMode={isDarkMode}
            />
          </nav>

          {canUsePermission(FEATURE_PERMISSION_KEYS.UPDATE_DB_PANEL) && (
            <div className={`p-3 border-t ${isDarkMode ? 'border-white/6' : 'border-slate-200/80'}`}>
              <button
                onClick={() => {
                  if (updatePanelOpen) {
                    closeUpdatePanel();
                  } else {
                    setUpdatePanelOpen(true);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
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
                <UploadCloud size={20} />
                {sidebarOpen && <div className="text-sm font-medium">Update DB</div>}
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
                {activeTab === Tab.SALES && showRange && rangeLabel && (
                  <span className="text-sm font-semibold text-slate-400">({rangeLabel})</span>
                )}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {activeTab === Tab.SALES && (
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search salesperson or store..."
                    value={headerSearch}
                    onChange={(e) => setHeaderSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const query = headerSearch.trim();
                        if (query) {
                          window.dispatchEvent(new CustomEvent('fd-search', { detail: { query } }));
                          setHeaderSearch('');
                        }
                      }
                    }}
                    className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all"
                  />
                </div>
              )}
              {activeTab === Tab.SALES && showRange && rangeLabel && (
                <button
                  onClick={() => window.dispatchEvent(new Event('fd-open-range'))}
                  className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full bg-white/70 border border-slate-200 text-slate-600 hover:bg-white"
                  title="Change date range"
                >
                  Range: {rangeLabel}
                  <span className="text-slate-400">Edit</span>
                </button>
              )}
              {activeTab === Tab.SALES && activeFilterLabel && (
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
              {activeTab === Tab.SALES && missingItemData && (
                <div className={`hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full border ${
                  isDarkMode
                    ? 'bg-amber-500/10 text-amber-200 border-amber-500/30'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}>
                  Missing data for items for this date range
                </div>
              )}
              {activeTab === Tab.SALES && missingSalesData && (
                <div className={`hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full border ${
                  isDarkMode
                    ? 'bg-amber-500/10 text-amber-200 border-amber-500/30'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}>
                  Missing sales data for this date range
                </div>
              )}
              {activeTab === Tab.SALES && (
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
              {activeTab === Tab.SALES && (
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
              <button
                onClick={() => setIsDarkMode((prev) => !prev)}
                className={`p-2 rounded-full shadow-sm border transition-colors ${
                  isDarkMode
                    ? 'bg-slate-100 hover:bg-white border-slate-300 text-slate-950'
                    : 'bg-white/70 hover:bg-white border-slate-200 text-slate-600'
                }`}
                title="Toggle night mode"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={handleLogout}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title={`Signed in as ${authUser.email}`}
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </header>

          <div className="p-5 lg:p-7">{renderContent()}</div>
        </main>

        {!showLoading && (
          <>
            <button
              type="button"
              onClick={() => setWolfbotOpen((open) => !open)}
              className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-900 text-white shadow-xl transition-colors hover:bg-slate-800"
              title="Open WOLFbot assistant"
            >
              <Bot size={20} />
            </button>

            {wolfbotOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-[2px]"
                  onClick={() => setWolfbotOpen(false)}
                />
                <div className="fixed bottom-24 right-6 z-50 h-[80vh] w-[min(980px,calc(100vw-3rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Assistant</div>
                      <div className="text-sm font-semibold text-slate-900">WOLFbot</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWolfbotOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      title="Close WOLFbot"
                    >
                      ×
                    </button>
                  </div>
                  <div className="h-[calc(80vh-57px)] overflow-y-auto p-4">
                    <WolfBot />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === Tab.SALES && (
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
              className={`fixed bottom-6 z-30 w-[320px] sm:w-[420px] max-h-[70vh] overflow-y-auto transition-transform duration-200 ${
                sidebarOpen ? 'left-72' : 'left-24'
              } ${updatePanelClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
              onClick={(event) => event.stopPropagation()}
            >
              <UpdateDatabase
                onUploadComplete={() => {
                  window.dispatchEvent(new Event('fd-refresh-data'));
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
