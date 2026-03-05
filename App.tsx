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
  Home,
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
import type { AuthUser, UserRole } from './types';
import {
  changeCurrentPassword,
  fetchCurrentUser,
  loginWithPassword,
  logoutCurrentUser,
} from './services/authApi';
import AuthScreen from './components/app/AuthScreen';
import LoadingOverlay from './components/app/LoadingOverlay';
import NavItem from './components/app/NavItem';
import { APP_THEME_STYLES } from './components/app/themeStyles';
import { canAccessTab, getTabTitle, Tab } from './components/app/tabs';
import { DASHBOARD_CARD_PERMISSION_BY_ID, FEATURE_PERMISSION_KEYS, hasPermission } from './components/app/permissions';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
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
    let stopped = false;
    void (async () => {
      try {
        const user = await fetchCurrentUser();
        if (!stopped) setAuthUser(user);
      } catch {
        if (!stopped) setAuthUser(null);
      } finally {
        if (!stopped) setAuthReady(true);
      }
    })();
    return () => {
      stopped = true;
    };
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
    if (activeTab === Tab.DASHBOARD) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }, [activeTab]);

  const userRoles = (authUser?.roles || []) as UserRole[];
  const userPermissions = authUser?.permissions || [];
  const canUsePermission = (permissionKey: string) => hasPermission(userRoles, userPermissions, permissionKey);
  const availableTabs = (Object.values(Tab) as Tab[]).filter((tab) => canAccessTab(userRoles, userPermissions, tab));

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
      setLoginPassword('');
      setShowLoading(true);
    } catch {
      setLoginError('Login failed. Check your credentials.');
    } finally {
      setLoginPending(false);
    }
  };

  const handleLogout = async () => {
    await logoutCurrentUser();
    setAuthUser(null);
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
              if (tab === 'SALES' && canAccessTab(userRoles, userPermissions, Tab.SALES)) setActiveTab(Tab.SALES);
              if (tab === 'TASKS' && canAccessTab(userRoles, userPermissions, Tab.TASKS)) setActiveTab(Tab.TASKS);
              if (tab === 'CRM' && canAccessTab(userRoles, userPermissions, Tab.CRM)) setActiveTab(Tab.CRM);
              if (tab === 'SOCIAL' && canAccessTab(userRoles, userPermissions, Tab.SOCIAL)) setActiveTab(Tab.SOCIAL);
              if (tab === 'KIOSKS' && canAccessTab(userRoles, userPermissions, Tab.KIOSKS)) setActiveTab(Tab.KIOSKS);
              if (tab === 'UPDATE' && canUsePermission(FEATURE_PERMISSION_KEYS.UPDATE_DB_PANEL)) {
                setUpdatePanelOpen(true);
              }
            }}
          />
        );
      case Tab.SALES:
        return <SalesDashboard itemSortMetric={itemSortMetric} showTooltips={showTooltips} />;
      case Tab.CRM:
        return <CRMWorkspace authUser={authUser!} />;
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
        email={loginEmail}
        password={loginPassword}
        pending={loginPending}
        error={loginError}
        setEmail={setLoginEmail}
        setPassword={setLoginPassword}
        onLogin={handleLogin}
      />
    );
  }

  const canView = (tab: Tab) => canAccessTab(userRoles, userPermissions, tab);

  return (
    <div
      className={`min-h-screen wolf-theme font-sans ${isDarkMode ? 'dark text-slate-100' : 'text-slate-800'} ${
        isDarkMode
          ? 'bg-[linear-gradient(160deg,#0b1220_0%,#101827_52%,#0f172a_100%)]'
          : 'bg-[linear-gradient(160deg,#f8fafc_0%,#eef3fb_52%,#e6edf7_100%)]'
      }`}
    >
      <style>{APP_THEME_STYLES}</style>
      {showLoading && <LoadingOverlay darkness={0.9} />}
      <div className={`flex ${showLoading ? 'blur-md' : ''} transition-[filter] duration-500`}>
        <aside
          className={`${sidebarOpen ? 'w-64' : 'w-20'} fixed h-screen bg-slate-950/90 text-white backdrop-blur-xl border-r border-white/10 transition-all duration-300 ease-in-out z-20 flex flex-col`}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-20 w-full flex items-center justify-center border-b border-white/10 hover:bg-white/5 transition-colors"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <Sofa className="text-blue-400" />
                <div className="leading-tight text-left">
                  <div className="font-bold text-xl tracking-tight">WOLF FD</div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Furniture Distributors</div>
                  <div className="text-xs text-slate-500">Work Online · Live Free</div>
                </div>
              </div>
            ) : (
              <Sofa className="text-blue-400" size={28} />
            )}
          </button>

          <nav className="flex-1 py-6 px-3 space-y-1.5">
            {canView(Tab.DASHBOARD) && (
              <NavItem
                icon={<Home size={20} />}
                label="Dashboard"
                isActive={activeTab === Tab.DASHBOARD}
                onClick={() => setActiveTab(Tab.DASHBOARD)}
                isOpen={sidebarOpen}
              />
            )}
            {canView(Tab.SALES) && (
              <NavItem
                icon={<LayoutDashboard size={20} />}
                label="Sales Analysis"
                isActive={activeTab === Tab.SALES}
                onClick={() => setActiveTab(Tab.SALES)}
                isOpen={sidebarOpen}
              />
            )}
            {canView(Tab.CRM) && (
              <NavItem
                icon={<MessageSquare size={20} />}
                label="CRM"
                isActive={activeTab === Tab.CRM}
                onClick={() => setActiveTab(Tab.CRM)}
                isOpen={sidebarOpen}
              />
            )}
            {canView(Tab.SOCIAL) && (
              <NavItem
                icon={<Activity size={20} />}
                label="Social Posts"
                isActive={activeTab === Tab.SOCIAL}
                onClick={() => setActiveTab(Tab.SOCIAL)}
                isOpen={sidebarOpen}
              />
            )}
            {canView(Tab.TASKS) && (
              <NavItem
                icon={<CheckSquare size={20} />}
                label="Tasks"
                isActive={activeTab === Tab.TASKS}
                onClick={() => setActiveTab(Tab.TASKS)}
                isOpen={sidebarOpen}
              />
            )}
            {canView(Tab.KIOSKS) && (
              <NavItem
                icon={<Monitor size={20} />}
                label="AlphaOS"
                isActive={activeTab === Tab.KIOSKS}
                onClick={() => setActiveTab(Tab.KIOSKS)}
                isOpen={sidebarOpen}
              />
            )}
            {canView(Tab.MESSAGE_BOARD) && (
              <NavItem
                icon={<ClipboardList size={20} />}
                label="Message Board"
                isActive={activeTab === Tab.MESSAGE_BOARD}
                onClick={() => setActiveTab(Tab.MESSAGE_BOARD)}
                isOpen={sidebarOpen}
              />
            )}
            {canView(Tab.ADMIN) && (
              <NavItem
                icon={<Settings size={20} />}
                label="Settings"
                isActive={activeTab === Tab.ADMIN}
                onClick={() => setActiveTab(Tab.ADMIN)}
                isOpen={sidebarOpen}
              />
            )}
            <div className="pt-4 mt-4 border-t border-white/10" />
            <NavItem
              icon={<Activity size={20} />}
              label="AlphaPulse"
              isActive={false}
              href="https://furnituredistributors.wolf.discount/alphapulse/"
              target="_blank"
              rel="noreferrer"
              isOpen={sidebarOpen}
            />
            <NavItem
              icon={<Star size={20} />}
              label="FD Connect Reviews"
              isActive={false}
              href="https://www.furnituredistributors.net/content/connect"
              target="_blank"
              rel="noreferrer"
              isOpen={sidebarOpen}
            />
            <NavItem
              icon={<LayoutDashboard size={20} />}
              label="QuickLinks"
              isActive={false}
              href="https://sites.google.com/view/fdserver/home"
              target="_blank"
              rel="noreferrer"
              isOpen={sidebarOpen}
            />
          </nav>

          {canUsePermission(FEATURE_PERMISSION_KEYS.UPDATE_DB_PANEL) && (
            <div className="p-3 border-t border-white/10">
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
                    ? 'bg-sky-500/20 border border-sky-300/40 text-sky-100 shadow-sm'
                    : 'border border-transparent text-slate-300 hover:bg-white/8 hover:border-white/15 hover:text-white'
                } ${!sidebarOpen ? 'justify-center' : ''}`}
                title="Update database"
              >
                <UploadCloud size={20} />
                {sidebarOpen && <div className="text-sm font-medium">Update DB</div>}
              </button>
            </div>
          )}
        </aside>

        <main className={`flex-1 transition-[margin] duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
          <header className="h-20 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-10 px-6 lg:px-8 flex items-center justify-between shadow-sm">
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
                <div className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full bg-white/70 border border-slate-200 text-slate-600">
                  {activeFilterLabel}
                  <button
                    onClick={() => window.dispatchEvent(new Event('fd-clear-filters'))}
                    className="ml-1 text-slate-400 hover:text-slate-600"
                    title="Clear filters"
                  >
                    ✕
                  </button>
                </div>
              )}
              {activeTab === Tab.SALES && missingItemData && (
                <div className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Missing data for items for this date range
                </div>
              )}
              {activeTab === Tab.SALES && missingSalesData && (
                <div className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Missing sales data for this date range
                </div>
              )}
              {activeTab === Tab.SALES && (
                <button
                  onClick={() => window.dispatchEvent(new Event('fd-print-request'))}
                  className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full border transition-colors bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  title="Print full report"
                >
                  Print Report
                </button>
              )}
              {activeTab === Tab.SALES && (
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs">
                  <button
                    onClick={() => setItemSortMetric('sales')}
                    className={`px-3 py-1 rounded-full font-semibold ${
                      itemSortMetric === 'sales'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Sales $
                  </button>
                  <button
                    onClick={() => setItemSortMetric('qty')}
                    className={`px-3 py-1 rounded-full font-semibold ${
                      itemSortMetric === 'qty'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Qty
                  </button>
                </div>
              )}
              <button
                onClick={() => setIsDarkMode((prev) => !prev)}
                className="p-2 rounded-full bg-white/70 hover:bg-white shadow-sm border border-slate-200 text-slate-600"
                title="Toggle night mode"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
