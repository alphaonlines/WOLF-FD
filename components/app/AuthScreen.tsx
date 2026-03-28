import React, { useEffect, useRef, useState } from "react";
import type { AccessRequestProfile } from "../../types";

declare global {
  interface Window {
    google?: any;
  }
}

type AuthStage = "sign_in" | "request_access" | "pending";

export type AuthScreenProps = {
  stage: AuthStage;
  email: string;
  password: string;
  requestPhone: string;
  requestProfile: AccessRequestProfile | null;
  pending: boolean;
  error: string | null;
  googleEnabled: boolean;
  googleClientId: string;
  googleHostedDomain: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setRequestPhone: (value: string) => void;
  onLogin: () => void;
  onBackToSignIn: () => void;
  onSubmitRequestAccess: () => void;
  onGoogleCredential: (credential: string) => void;
};

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

const AuthScreen: React.FC<AuthScreenProps> = ({
  stage,
  email,
  password,
  requestPhone,
  requestProfile,
  pending,
  error,
  googleEnabled,
  googleClientId,
  googleHostedDomain,
  setEmail,
  setPassword,
  setRequestPhone,
  onLogin,
  onBackToSignIn,
  onSubmitRequestAccess,
  onGoogleCredential,
}) => {
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleCredentialHandlerRef = useRef(onGoogleCredential);
  const [googleScriptReady, setGoogleScriptReady] = useState<boolean>(() => Boolean(window.google?.accounts?.id));
  const [googleScriptError, setGoogleScriptError] = useState<string | null>(null);
  const darkness = Math.min(0.58 + email.length * 0.02, 0.9);

  googleCredentialHandlerRef.current = onGoogleCredential;

  useEffect(() => {
    if (!googleEnabled || !googleClientId) return;
    if (window.google?.accounts?.id) {
      setGoogleScriptReady(true);
      return;
    }

    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`) as HTMLScriptElement | null;
    const script = existing || document.createElement("script");

    const handleLoad = () => {
      setGoogleScriptReady(true);
      setGoogleScriptError(null);
    };
    const handleError = () => {
      setGoogleScriptReady(false);
      setGoogleScriptError("Google sign-in could not load on this page.");
    };

    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    if (!existing) {
      document.head.appendChild(script);
    } else if (window.google?.accounts?.id) {
      handleLoad();
    }

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [googleEnabled, googleClientId]);

  useEffect(() => {
    if (!googleEnabled || !googleClientId || !googleScriptReady || stage !== "sign_in") return;
    if (!googleButtonRef.current || !window.google?.accounts?.id) return;

    const callback = (response: { credential?: string }) => {
      const credential = typeof response?.credential === "string" ? response.credential.trim() : "";
      if (!credential) {
        setGoogleScriptError("Google sign-in did not return a credential.");
        return;
      }
      setGoogleScriptError(null);
      googleCredentialHandlerRef.current(credential);
    };

    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback,
      hosted_domain: googleHostedDomain || undefined,
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: "popup",
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "left",
      width: 320,
    });
  }, [googleEnabled, googleClientId, googleHostedDomain, googleScriptReady, stage]);

  const requestName = requestProfile?.name || "";
  const requestFirstName = requestProfile?.firstName || "";
  const requestLastName = requestProfile?.lastName || "";
  const requestEmail = requestProfile?.email || "";

  return (
    <div className="fixed inset-0 z-40 flex min-h-screen items-center justify-center overflow-y-auto bg-slate-950 px-4 py-8">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/94 via-slate-900/88 to-slate-800/72 backdrop-blur-md" />
      <div
        className="pointer-events-none absolute inset-0 transition-colors duration-300"
        style={{
          background: `radial-gradient(circle at center, rgba(2,6,23,0) 0px, rgba(2,6,23,0) 140px, rgba(2,6,23,${darkness}) 280px)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <style>
          {`
            @keyframes breatheGlow {
              0%, 100% { opacity: 0.35; transform: scale(0.98); }
              50% { opacity: 0.8; transform: scale(1.02); }
            }
            @keyframes orbitA {
              0%, 100% { transform: translate(-50%, -50%) rotate(0deg) translateX(12px); opacity: 0.6; }
              50% { transform: translate(-50%, -50%) rotate(180deg) translateX(24px); opacity: 0.35; }
            }
            @keyframes orbitB {
              0%, 100% { transform: translate(-50%, -50%) rotate(0deg) translateX(-14px); opacity: 0.45; }
              50% { transform: translate(-50%, -50%) rotate(-180deg) translateX(-28px); opacity: 0.7; }
            }
          `}
        </style>
        <div className="absolute -top-28 -left-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl animate-[floatY_7s_ease-in-out_infinite]" />
        <div className="absolute -bottom-28 -right-24 h-64 w-64 rounded-full bg-cyan-400/18 blur-3xl animate-[floatY_6s_ease-in-out_infinite_reverse]" />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] rounded-full border border-blue-400/20 animate-[orbitA_14s_ease-in-out_infinite]" />
        <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] rounded-full border border-cyan-300/20 animate-[orbitB_12s_ease-in-out_infinite]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-700/60 bg-slate-950/76 shadow-2xl shadow-black/45 backdrop-blur-xl">
        <div className="grid min-h-[660px] lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative overflow-hidden border-b border-slate-800/70 p-8 text-slate-100 lg:border-b-0 lg:border-r lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.14),transparent_30%)]" />
            <div className="relative z-10 flex h-full flex-col">
              <div className="mb-10 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/90 text-3xl shadow-lg">
                  🐺
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Furniture Distributors</div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">WOLF FD Dashboard</h1>
                </div>
              </div>

              <div className="max-w-xl space-y-5">
                <div className="inline-flex rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/90">
                  Employee Access
                </div>
                <h2 className="text-4xl font-semibold leading-tight text-white">
                  Secure sign-in for approved Furniture Distributors employees.
                </h2>
                <p className="text-base leading-7 text-slate-300">
                  Team members can sign in with their Google Workspace account, request dashboard access, and wait for owner approval before entering the live modules.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">Request Flow</div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Google fills the employee profile first, then the owner approves access before modules unlock.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">Role Control</div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Owners and managers can control which dashboard modules each employee is allowed to use.
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-10 text-sm text-slate-400">
                <div className="font-medium text-slate-200">What employees should expect</div>
                <ul className="mt-3 space-y-2 leading-6">
                  <li>Use your company Google account when Google Workspace sign-in is available.</li>
                  <li>Complete the access request if you have not been approved yet.</li>
                  <li>Temporary password login can still be used while rollout is in progress.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="relative flex items-center p-6 sm:p-8 lg:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,6,23,0.9))]" />
            <div className="relative z-10 w-full rounded-[1.7rem] border border-slate-800/80 bg-slate-900/82 p-6 text-slate-100 shadow-xl shadow-black/30 sm:p-7">
              {stage === "sign_in" ? (
                <>
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-white">Sign in to the dashboard</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Google Workspace is the preferred path for employee rollout. Password login stays available while we finish the transition.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Google Workspace</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Sign in with your {googleHostedDomain ? `@${googleHostedDomain}` : "company"} Google account to request or access the dashboard.
                      </p>
                      {googleEnabled ? (
                        <div className="mt-4 space-y-3">
                          <div ref={googleButtonRef} className="min-h-[44px]" />
                          {!googleScriptReady && (
                            <div className="text-xs text-slate-500">Loading Google sign-in…</div>
                          )}
                          {googleScriptError && <div className="text-xs text-amber-300">{googleScriptError}</div>}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                          Google Workspace sign-in is not configured on this environment yet.
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-800" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-slate-900 px-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Temporary fallback</span>
                      </div>
                    </div>

                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        onLogin();
                      }}
                    >
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Employee email"
                        autoFocus
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Password"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <button
                        type="submit"
                        disabled={pending}
                        className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {pending ? "Signing in..." : "Sign in with password"}
                      </button>
                    </form>
                  </div>
                </>
              ) : null}

              {stage === "request_access" ? (
                <>
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-white">Request dashboard access</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Your Google profile has been recognized. Add the best phone number to reach you and send the request to the owner queue.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">First name</div>
                        <div className="mt-1 text-sm font-medium text-slate-100">{requestFirstName || "Not provided by Google"}</div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Last name</div>
                        <div className="mt-1 text-sm font-medium text-slate-100">{requestLastName || "Not provided by Google"}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Company email</div>
                      <div className="mt-1 text-sm font-medium text-slate-100">{requestEmail}</div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Display name</div>
                      <div className="mt-1 text-sm font-medium text-slate-100">{requestName || requestEmail}</div>
                    </div>

                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        onSubmitRequestAccess();
                      }}
                    >
                      <input
                        type="tel"
                        value={requestPhone}
                        onChange={(event) => setRequestPhone(event.target.value)}
                        placeholder="Best phone number"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={onBackToSignIn}
                          className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/80"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={pending}
                          className="flex-1 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {pending ? "Sending request..." : "Request access"}
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              ) : null}

              {stage === "pending" ? (
                <>
                  <div className="mb-6">
                    <div className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">
                      Awaiting Approval
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-white">Your access request is in the owner queue</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      We have your Google account on file. Once the owner approves your dashboard access, sign in again and your modules will unlock.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Email</div>
                      <div className="mt-1 text-sm font-medium text-slate-100">{requestEmail || "Pending request"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Phone</div>
                      <div className="mt-1 text-sm font-medium text-slate-100">{requestPhone || requestProfile?.phone || "Not yet provided"}</div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={onBackToSignIn}
                      className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/80"
                    >
                      Back to sign in
                    </button>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
                      Owners can approve you from Settings → Users in the dashboard.
                    </div>
                  </div>
                </>
              ) : null}

              {error && (
                <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
