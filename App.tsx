import React, { useEffect, useState } from 'react';
import { LayoutDashboard, CheckSquare, MessageSquare, Menu, Bell, Sofa, Search, Activity, Star } from 'lucide-react';
import SalesDashboard from './components/SalesDashboard';
import TaskManager from './components/TaskManager';
import WorkAdvertising from './components/WorkAdvertising';

enum Tab {
  OVERVIEW = 'OVERVIEW',
  TASKS = 'TASKS',
  SOCIAL = 'SOCIAL',
}

const PASSWORD = "1111";
const STORAGE_KEY = "fd_app_unlocked";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.OVERVIEW);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!showLoading) return;
    const t = window.setTimeout(() => setShowLoading(false), 2000);
    return () => window.clearTimeout(t);
  }, [showLoading]);

  const handleUnlock = () => {
    if (passwordInput === PASSWORD) {
      setIsUnlocked(true);
      setPasswordInput("");
      setPasswordError(null);
      setShowLoading(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // Ignore storage failures.
      }
      return;
    }
    setPasswordError("Incorrect password.");
  };

  const renderContent = () => {
    switch(activeTab) {
      case Tab.OVERVIEW: return <SalesDashboard />;
      case Tab.TASKS: return <TaskManager />;
      case Tab.SOCIAL: return <WorkAdvertising />;
      default: return <SalesDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {!isUnlocked && <LockScreen passwordInput={passwordInput} setPasswordInput={setPasswordInput} passwordError={passwordError} onUnlock={handleUnlock} />}
      {showLoading && <LoadingOverlay />}
      <div className={`flex ${!isUnlocked || showLoading ? 'blur-md' : ''} transition-[filter] duration-500`}>
      
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-64' : 'w-20'} fixed h-screen bg-slate-900 text-white transition-all duration-300 ease-in-out z-20 flex flex-col`}
      >
        <div className="h-20 flex items-center justify-center border-b border-slate-800">
           {sidebarOpen ? (
             <div className="flex items-center gap-3">
               <Sofa className="text-blue-400" />
               <div className="leading-tight">
                 <div className="font-bold text-xl tracking-tight">WOLF FD</div>
                 <div className="text-xs text-slate-400">Work Online. Live Free. Furniture Distributors</div>
               </div>
             </div>
           ) : (
             <Sofa className="text-blue-400" size={28} />
           )}
        </div>

        <nav className="flex-1 py-8 px-4 space-y-2">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            isActive={activeTab === Tab.OVERVIEW} 
            onClick={() => setActiveTab(Tab.OVERVIEW)}
            isOpen={sidebarOpen}
          />
          <NavItem 
            icon={<CheckSquare size={20} />} 
            label="Tasks" 
            isActive={activeTab === Tab.TASKS} 
            onClick={() => setActiveTab(Tab.TASKS)}
            isOpen={sidebarOpen}
          />
          <NavItem 
            icon={<MessageSquare size={20} />} 
            label="Work Advertising" 
            isActive={activeTab === Tab.SOCIAL} 
            onClick={() => setActiveTab(Tab.SOCIAL)}
            isOpen={sidebarOpen}
          />
          <div className="pt-4 mt-4 border-t border-slate-800" />
          <NavItem
            icon={<Activity size={20} />}
            label="AlphaPulse"
            isActive={false}
            href="https://alphaonlines.github.io/AlphaPulse/"
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
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              OD
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">Owner Dashboard</p>
                <p className="text-xs text-slate-400 truncate">admin@furnituredist.com</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-10 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-semibold text-slate-800">
              {activeTab === Tab.OVERVIEW && 'Business Overview'}
              {activeTab === Tab.TASKS && 'Team Tasks'}
              {activeTab === Tab.SOCIAL && 'Work Advertising'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all"
              />
            </div>
            <button className="relative p-2 hover:bg-slate-100 rounded-full text-slate-500">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="p-8">
          {renderContent()}
        </div>

      </main>
      </div>
    </div>
  );
};

const LoadingOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-800/70 backdrop-blur-md" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -left-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl animate-[floatY_7s_ease-in-out_infinite]" />
        <div className="absolute -bottom-28 -right-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl animate-[floatY_6s_ease-in-out_infinite_reverse]" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-5 text-white">
        <style>
          {`
            @keyframes loadbar {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
            @keyframes floatY {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(16px); }
            }
            @keyframes halo {
              0%, 100% { opacity: 0.35; transform: scale(0.96); }
              50% { opacity: 0.7; transform: scale(1.04); }
            }
            @keyframes sweep {
              0% { transform: translateX(-60%); opacity: 0; }
              30% { opacity: 0.6; }
              100% { transform: translateX(60%); opacity: 0; }
            }
          `}
        </style>
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl border border-blue-300/40 shadow-[0_0_30px_rgba(59,130,246,0.45)] animate-[halo_2.6s_ease-in-out_infinite]" />
          <div className="w-24 h-24 rounded-3xl bg-slate-900/80 border border-slate-700 flex items-center justify-center shadow-xl text-4xl">
            🐺
          </div>
        </div>
        <div className="text-sm uppercase tracking-[0.3em] text-slate-200">Wolf FD</div>
        <div className="w-64 h-2 rounded-full bg-slate-700/80 overflow-hidden relative">
          <div className="h-full w-1/2 bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-200 animate-[loadbar_2s_linear_infinite]" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[sweep_2s_ease-in-out_infinite]" />
        </div>
        <div className="text-xs text-slate-300/80 tracking-[0.25em] uppercase">Loading Dashboard</div>
      </div>
    </div>
  );
};

type LockScreenProps = {
  passwordInput: string;
  setPasswordInput: (value: string) => void;
  passwordError: string | null;
  onUnlock: () => void;
};

const LockScreen: React.FC<LockScreenProps> = ({ passwordInput, setPasswordInput, passwordError, onUnlock }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-white/95 border border-slate-200 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-2xl">
            🐺
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Wolf FD Locked</h2>
            <p className="text-sm text-slate-500">Enter the passcode to continue.</p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onUnlock();
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder="Passcode"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium"
          >
            Unlock
          </button>
          {passwordError && <div className="text-xs text-red-600">{passwordError}</div>}
        </form>
      </div>
    </div>
  );
};

// Helper Component for Navigation Items
type NavItemProps = {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isOpen: boolean;
} & (
  | {
      onClick: () => void;
      href?: never;
      target?: never;
      rel?: never;
    }
  | {
      href: string;
      target?: string;
      rel?: string;
      onClick?: never;
    }
);

const NavItem: React.FC<NavItemProps> = (props) => {
  const { icon, label, isActive, isOpen } = props;
  const className = `
        w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all
        ${isActive 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }
        ${!isOpen && 'justify-center'}
      `;

  if ('href' in props) {
    return (
      <a
        href={props.href}
        target={props.target}
        rel={props.rel}
        className={className}
        title={!isOpen ? label : ''}
      >
        {icon}
        {isOpen && <span className="font-medium text-sm">{label}</span>}
      </a>
    );
  }

  return (
    <button
      onClick={props.onClick}
      className={className}
      title={!isOpen ? label : ''}
    >
      {icon}
      {isOpen && <span className="font-medium text-sm">{label}</span>}
    </button>
  );
};

export default App;
