import React from 'react';
import { UploadCloud } from 'lucide-react';

const LoadingOverlay: React.FC<{ darkness: number }> = ({ darkness }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-[loadingExit_6.5s_ease-in-out_forwards] [transform-origin:left_bottom]">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-800/70 backdrop-blur-md" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, rgba(2,6,23,0) 0px, rgba(2,6,23,0) 140px, rgba(2,6,23,${darkness}) 260px)`,
        }}
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-28 -left-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl animate-[floatY_7s_ease-in-out_infinite]" />
        <div className="absolute -bottom-28 -right-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl animate-[floatY_6s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/20 animate-[spinSlow_16s_linear_infinite]" />
        <div className="absolute top-1/2 left-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-300/20 animate-[spinSlow_22s_linear_infinite_reverse]" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-5 text-white animate-[fadeIn_0.6s_ease]">
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
            @keyframes spinSlow {
              0% { transform: translate(-50%, -50%) rotate(0deg); }
              100% { transform: translate(-50%, -50%) rotate(360deg); }
            }
            @keyframes fadeIn {
              0% { opacity: 0; transform: translateY(8px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes loadingExit {
              0% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
              85% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
              100% { opacity: 0; transform: translate3d(-36vw, 32vh, 0) scale(0.25); }
            }
            @keyframes pulseRing {
              0% { transform: scale(0.92); opacity: 0.35; }
              70% { transform: scale(1.05); opacity: 0.6; }
              100% { transform: scale(1.15); opacity: 0; }
            }
            @keyframes glowText {
              0%, 100% { text-shadow: 0 0 12px rgba(59, 130, 246, 0.2); }
              50% { text-shadow: 0 0 22px rgba(96, 165, 250, 0.65); }
            }
            @keyframes floatHint {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(6px); }
            }
          `}
        </style>
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl border border-blue-300/40 shadow-[0_0_30px_rgba(59,130,246,0.45)] animate-[halo_2.6s_ease-in-out_infinite]" />
          <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-blue-500/20 via-indigo-400/10 to-transparent blur-xl" />
          <div className="w-24 h-24 rounded-3xl bg-slate-900/80 border border-slate-700 flex items-center justify-center shadow-xl text-4xl">
            🐺
          </div>
        </div>
        <div className="text-sm uppercase tracking-[0.3em] text-slate-200">WOLF FD</div>
        <div className="w-64 h-2 rounded-full bg-slate-700/80 overflow-hidden relative">
          <div className="h-full w-1/2 bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-200 animate-[loadbar_2s_linear_infinite]" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[sweep_2s_ease-in-out_infinite]" />
        </div>
        <div className="mt-2 text-center text-sm text-slate-200/90 animate-[floatHint_3s_ease-in-out_infinite]">
          <div className="font-semibold animate-[glowText_2.4s_ease-in-out_infinite]">
            Need to update data?
          </div>
          <div className="text-slate-300/80">
            Click the upload icon in the bottom-left menu to add new files.
          </div>
        </div>
      </div>
      <div className="absolute left-8 bottom-8 flex items-center gap-3 text-slate-100">
        <div className="relative">
          <div className="absolute inset-0 rounded-full border border-blue-400/70 animate-[pulseRing_2s_ease-out_infinite]" />
          <div className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center shadow-lg">
            <UploadCloud size={20} />
          </div>
        </div>
        <div className="text-sm font-medium">
          Click this to upload new files
          <div className="text-xs text-slate-400">Bottom-left menu</div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
