import React, { useState } from 'react';
import { Shield, Sparkles, Compass, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

interface LandingViewProps {
  onSignIn: () => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onSignIn,
  isLoading,
  errorMessage,
}) => {
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await onSignIn();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-stone-950 text-stone-100">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-teal-900/20 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[350px] h-[250px] bg-amber-900/15 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative max-w-3xl w-full text-center space-y-8 z-10">
        {/* Calming pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-900 border border-stone-800 text-teal-300 text-xs font-medium tracking-wide shadow-sm">
          <Shield className="w-3.5 h-3.5 text-teal-400" />
          <span>Zero-Knowledge Persona • Strict User Data Isolation</span>
        </div>

        {/* Hero headline & intro */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif tracking-tight text-stone-100 leading-tight">
            A quiet, secure sanctuary for your inner dialogue.
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-stone-400 font-normal leading-relaxed">
            EchoMind is a private AI companion designed for thoughtful reflections, unhurried journaling, and longitudinal self-discovery. Unpack what matters with total peace of mind.
          </p>
        </div>

        {/* Action card */}
        <div className="max-w-md mx-auto p-6 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-xl shadow-stone-950/60 backdrop-blur-sm space-y-5">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-stone-200">Authenticate to Access Your Vault</h2>
            <p className="text-xs text-stone-400">
              Your conversations are encrypted and bound strictly to your authenticated UID.
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 text-xs text-left">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            id="google-signin-btn"
            onClick={handleSignIn}
            disabled={isLoading || signingIn}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl font-medium text-sm text-stone-950 bg-stone-100 hover:bg-stone-200 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
          >
            {isLoading || signingIn ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
                <span>Securing connection...</span>
              </div>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.97 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-stone-500 text-center">
            Sign-in happens via Google OAuth with direct token derivation.
          </p>
        </div>

        {/* Feature pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-left">
          <div className="p-5 rounded-xl bg-stone-900/60 border border-stone-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-teal-950/80 border border-teal-800/50 flex items-center justify-center text-teal-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-medium text-sm text-stone-200">Conversational Reflection</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Engage in multi-turn dialogues with contextual recall, empathetic questioning, and automated structured takeaways.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-stone-900/60 border border-stone-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-800/50 flex items-center justify-center text-amber-400">
              <Compass className="w-4 h-4" />
            </div>
            <h3 className="font-medium text-sm text-stone-200">Pattern Compass</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Detect recurring behavioral themes, goal trajectories, and cognitive perspective shifts over time from your summaries.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-stone-900/60 border border-stone-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-medium text-sm text-stone-200">Total Data Sovereignty</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Strict path isolation in Firestore (`users/{'{uid}'}/...`). You can audit, export, or permanently wipe your data at any time.
            </p>
          </div>
        </div>

        {/* Privacy guarantees */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-6 text-xs text-stone-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero hardcoded API secrets</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Bearer Token verification</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Resilient Gemini fallback engine</span>
          </div>
        </div>
      </div>
    </div>
  );
};
