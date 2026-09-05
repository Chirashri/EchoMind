/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, verifyFirestoreConnection } from './lib/firebase';
import { UserProfile } from './types';
import { Navbar } from './components/Navbar';
import { LandingView } from './components/LandingView';
import { ReflectionSpace } from './components/ReflectionSpace';
import { HistoryView } from './components/HistoryView';
import { PatternCompassView } from './components/PatternCompassView';
import { PrivacyCenterView } from './components/PrivacyCenterView';
import { WalkthroughModal } from './components/WalkthroughModal';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reflect' | 'history' | 'compass' | 'privacy'>('reflect');
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState<boolean>(false);

  useEffect(() => {
    // 1. Verify Firestore connectivity at startup
    verifyFirestoreConnection().catch((err) => {
      console.warn('Initial connection probe:', err);
    });

    // 2. Subscribe to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          });
        } else {
          setUser(null);
        }
        setIsLoadingAuth(false);
      },
      (error) => {
        console.error('Auth state subscription error:', error);
        setAuthError(error.message || 'Authentication error.');
        setIsLoadingAuth(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setUser({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
        });
      }
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      // Friendly message for popup closed by user or standard auth errors
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in was cancelled. Please try again.');
      } else {
        setAuthError(err.message || 'Failed to sign in with Google.');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setActiveTab('reflect');
    } catch (err: any) {
      console.error('Sign-out error:', err);
    }
  };

  const handleLaunchPrompt = (prompt: string) => {
    setSelectedPrompt(prompt);
    setActiveTab('reflect');
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-4 text-stone-100">
        <div className="space-y-4 text-center">
          <div className="w-10 h-10 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-wide uppercase font-mono text-teal-400">
              EchoMind Security Vault
            </h2>
            <p className="text-xs text-stone-400">Verifying session state...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-teal-900 selection:text-teal-200">
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSignOut={handleSignOut}
        onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
      />

      <main className="flex-1">
        {!user ? (
          <LandingView
            onSignIn={handleSignIn}
            isLoading={false}
            errorMessage={authError}
          />
        ) : (
          <div>
            {activeTab === 'reflect' && (
              <ReflectionSpace
                user={user}
                initialPrompt={selectedPrompt}
                onJumpToCompass={() => setActiveTab('compass')}
              />
            )}
            {activeTab === 'history' && (
              <HistoryView
                user={user}
                onSelectPromptForNewSession={(p) => handleLaunchPrompt(p)}
              />
            )}
            {activeTab === 'compass' && (
              <PatternCompassView
                user={user}
                onLaunchPrompt={handleLaunchPrompt}
              />
            )}
            {activeTab === 'privacy' && (
              <PrivacyCenterView
                user={user}
                onDataPurged={() => setActiveTab('reflect')}
              />
            )}
          </div>
        )}
      </main>

      {/* Global verification walkthrough modal */}
      <WalkthroughModal
        isOpen={isWalkthroughOpen}
        onClose={() => setIsWalkthroughOpen(false)}
        user={user}
      />
    </div>
  );
}
