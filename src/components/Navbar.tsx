import React from 'react';
import { Sparkles, Compass, ShieldCheck, History, LogOut, HeartHandshake, User as UserIcon } from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  activeTab: 'reflect' | 'history' | 'compass' | 'privacy';
  setActiveTab: (tab: 'reflect' | 'history' | 'compass' | 'privacy') => void;
  onSignOut: () => void;
  onOpenWalkthrough: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onSignOut,
  onOpenWalkthrough,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-stone-900/90 backdrop-blur-md border-b border-stone-800 text-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div
            id="brand-logo"
            onClick={() => user && setActiveTab('reflect')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-stone-950 shadow-md shadow-teal-950/40 group-hover:scale-105 transition-transform">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight text-stone-100">EchoMind</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-mono px-2 py-0.5 rounded-full bg-stone-800 text-teal-300 border border-stone-700">
                Private Companion
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (when signed in) */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 bg-stone-950/60 p-1 rounded-xl border border-stone-800/80">
            <button
              id="nav-tab-reflect"
              onClick={() => setActiveTab('reflect')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'reflect'
                  ? 'bg-stone-800 text-stone-100 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
              }`}
            >
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>Reflection</span>
            </button>

            <button
              id="nav-tab-history"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-stone-800 text-stone-100 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
              }`}
            >
              <History className="w-4 h-4 text-stone-400" />
              <span>Sessions</span>
            </button>

            <button
              id="nav-tab-compass"
              onClick={() => setActiveTab('compass')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'compass'
                  ? 'bg-stone-800 text-stone-100 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
              }`}
            >
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Pattern Compass</span>
            </button>

            <button
              id="nav-tab-privacy"
              onClick={() => setActiveTab('privacy')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'privacy'
                  ? 'bg-stone-800 text-stone-100 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Privacy Center</span>
            </button>
          </nav>
        )}

        {/* User profile & actions */}
        <div className="flex items-center gap-2.5">
          <button
            id="walkthrough-guide-btn"
            onClick={onOpenWalkthrough}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-stone-700 bg-stone-800/80 hover:bg-stone-700 text-stone-300 transition-colors flex items-center gap-1.5"
            title="View Security & Functional Test Verification"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline">Verification Checklist</span>
          </button>

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-stone-800">
              <div className="flex items-center gap-2 text-right">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full border border-stone-700 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="hidden lg:block">
                  <p className="text-xs font-medium text-stone-200 truncate max-w-[120px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-teal-400/80 font-mono">Isolated: {user.uid.slice(0, 6)}...</p>
                </div>
              </div>

              <button
                id="signout-button"
                onClick={onSignOut}
                className="p-2 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-stone-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Encrypted</span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile navigation row */}
      {user && (
        <div className="md:hidden flex items-center justify-around py-2 px-3 border-t border-stone-800 bg-stone-950/80 text-xs">
          <button
            onClick={() => setActiveTab('reflect')}
            className={`flex flex-col items-center gap-1 py-1 px-2 ${
              activeTab === 'reflect' ? 'text-teal-400 font-semibold' : 'text-stone-400'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Reflect</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 py-1 px-2 ${
              activeTab === 'history' ? 'text-teal-400 font-semibold' : 'text-stone-400'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Sessions</span>
          </button>
          <button
            onClick={() => setActiveTab('compass')}
            className={`flex flex-col items-center gap-1 py-1 px-2 ${
              activeTab === 'compass' ? 'text-teal-400 font-semibold' : 'text-stone-400'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Compass</span>
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex flex-col items-center gap-1 py-1 px-2 ${
              activeTab === 'privacy' ? 'text-teal-400 font-semibold' : 'text-stone-400'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Privacy</span>
          </button>
        </div>
      )}
    </header>
  );
};
