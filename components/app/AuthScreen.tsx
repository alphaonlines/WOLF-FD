import React from 'react';

export type AuthScreenProps = {
  email: string;
  password: string;
  pending: boolean;
  error: string | null;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  onLogin: () => void;
};

const AuthScreen: React.FC<AuthScreenProps> = ({
  email,
  password,
  pending,
  error,
  setEmail,
  setPassword,
  onLogin,
}) => {
  const darkness = Math.min(0.64 + email.length * 0.02, 0.92);

  return (
    <div className="min-h-screen fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-800/70 backdrop-blur-md" />
      <div
        className="absolute inset-0 transition-colors duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, rgba(2,6,23,0) 0px, rgba(2,6,23,0) 140px, rgba(2,6,23,${darkness}) 260px)`,
        }}
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <style>
          {`
            @keyframes breatheGlow {
              0%, 100% { opacity: 0.35; transform: scale(0.98); }
              50% { opacity: 0.8; transform: scale(1.02); }
            }
            @keyframes orbitA {
              0%, 100% { transform: translate(-50%, -50%) rotate(0deg) translateX(10px); opacity: 0.6; }
              50% { transform: translate(-50%, -50%) rotate(180deg) translateX(22px); opacity: 0.35; }
            }
            @keyframes orbitB {
              0%, 100% { transform: translate(-50%, -50%) rotate(0deg) translateX(-14px); opacity: 0.45; }
              50% { transform: translate(-50%, -50%) rotate(-180deg) translateX(-26px); opacity: 0.7; }
            }
          `}
        </style>
        <div className="absolute -top-28 -left-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl animate-[floatY_7s_ease-in-out_infinite]" />
        <div className="absolute -bottom-28 -right-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl animate-[floatY_6s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-1/2 left-1/2 h-[520px] w-[520px] rounded-full border border-blue-400/20 animate-[orbitA_14s_ease-in-out_infinite]" />
        <div className="absolute top-1/2 left-1/2 h-[360px] w-[360px] rounded-full border border-indigo-300/25 animate-[orbitB_12s_ease-in-out_infinite]" />
      </div>
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl text-slate-100">
        <div className="absolute -inset-2 rounded-[28px] bg-blue-500/20 blur-2xl animate-[breatheGlow_3.8s_ease-in-out_infinite] pointer-events-none" />
        <div className="absolute -inset-1 rounded-[26px] border border-blue-400/30 animate-[breatheGlow_3.8s_ease-in-out_infinite] pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-slate-950/90 border border-slate-700 text-white flex items-center justify-center text-2xl shadow-lg">
            🐺
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">WOLF FD Employee Login</h2>
            <p className="text-sm text-slate-400">Sign in with your employee account.</p>
          </div>
        </div>
        <form
          className="relative z-10 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin();
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            autoFocus
            className="px-3 py-2 rounded-lg text-sm bg-slate-950/70 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="px-3 py-2 rounded-lg text-sm bg-slate-950/70 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 bg-white text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? 'Signing in...' : 'Sign in'}
          </button>
          {error && <div className="text-xs text-rose-300">{error}</div>}
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;
