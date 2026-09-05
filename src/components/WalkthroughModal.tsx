import React, { useState } from 'react';
import { X, CheckCircle2, ShieldCheck, Play, ArrowRight } from 'lucide-react';
import { UserProfile } from '../types';

interface WalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

interface TestCase {
  id: string;
  category: string;
  title: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  interactiveAction?: string;
}

const TEST_CASES: TestCase[] = [
  {
    id: 'AUTH-01',
    category: '1. Authentication Testing',
    title: 'Google Sign-In via Firebase Auth',
    preconditions: 'User is on the Landing Page in unauthenticated state.',
    steps: [
      'Click the "Continue with Google" button on the landing page.',
      'Authenticate with a valid Google account in the popup.',
      'Verify that upon successful callback, the dashboard loads instantly.',
    ],
    expectedResult:
      'Firebase Auth token is issued, client state updates with UserProfile, and the private dashboard displays with the authenticated user avatar and derived UID.',
  },
  {
    id: 'AUTH-02',
    category: '1. Authentication Testing',
    title: 'Sign Out & Session Invalidation',
    preconditions: 'User is authenticated and inside the dashboard.',
    steps: [
      'Click the Sign Out icon button in the top right corner of the navbar.',
      'Observe the application state transition.',
    ],
    expectedResult:
      'Firebase Auth session is terminated, cached token is cleared, and user is redirected immediately to the Landing Page. No private data remains in view.',
  },
  {
    id: 'CONV-01',
    category: '2. Multi-turn Gemini Conversation Testing',
    title: 'Multi-turn Contextual Reflection',
    preconditions: 'User is in the Reflection Space.',
    steps: [
      'Select a starter prompt or type "I am feeling overwhelmed with my workload."',
      'Click "Reflect" or press Enter.',
      'Wait for EchoMind reply containing empathetic reflection and an inquiry.',
      'Type a follow-up response referencing the reply: "The biggest bottleneck is saying yes to everyone."',
      'Send the message.',
    ],
    expectedResult:
      'EchoMind demonstrates conversational memory of the previous turn, acknowledging the workload dilemma while exploring the difficulty in setting boundaries.',
  },
  {
    id: 'CONV-02',
    category: '2. Multi-turn Gemini Conversation Testing',
    title: 'Automated Session Summary Synthesis',
    preconditions: 'Active conversation with at least 2 exchanges exists.',
    steps: [
      'Click the "End & Synthesize Session" button in the status bar.',
      'Wait for Gemini summary generation.',
    ],
    expectedResult:
      'A structured synthesis card appears containing a 3-6 word Title, Emotional Sentiment badge, Key Themes pills, 2-paragraph Synthesis, and a tailored Micro-Growth Action.',
  },
  {
    id: 'DATA-01',
    category: '3. Firestore Persistence Testing',
    title: 'Input-to-Save Verification & Undefined Stripping',
    preconditions: 'User sends a message or synthesizes a session.',
    steps: [
      'Send a message in the Reflection Space.',
      'Navigate to the "Sessions" tab.',
      'Locate the newly created reflection card.',
      'Click the card to inspect full message history.',
    ],
    expectedResult:
      'All user messages, model replies, and structured summary data are retrieved successfully from Firestore path users/{uid}/conversations/{convId}. No payload crash occurs.',
  },
  {
    id: 'ISOL-01',
    category: '4. Cross-User Data Isolation Testing',
    title: 'Strict UID Path Scoping & Server Token Verification',
    preconditions: 'Authenticated session active.',
    steps: [
      'Inspect Network tab on any API request (/api/chat, /api/summarize, /api/pattern-compass).',
      'Verify request sends only "Authorization: Bearer <token>" with no client-asserted UID in the payload body.',
      'Review Firestore rules ensuring only request.auth.uid == userId can read or write documents.',
    ],
    expectedResult:
      'Backend derives the user ID strictly from the verified JWT. Cross-user data access is structurally impossible and rejected by firestore.rules.',
  },
  {
    id: 'ERR-01',
    category: '5. Error Handling & Fallback Ladder Testing',
    title: 'Model Fallback & Buffer Preservation on Network Interruption',
    preconditions: 'User has drafted thoughts in the reflection input box.',
    steps: [
      'Type a long reflection thought into the input box.',
      'Simulate an error or oversized text or API rate-limit.',
      'Observe UI behavior.',
    ],
    expectedResult:
      'If an API error or network glitch occurs, the user input buffer is NOT cleared or lost. A clear error notification appears with an option to retry or dismiss.',
  },
  {
    id: 'COMP-01',
    category: '6. Pattern Compass Privacy Testing',
    title: 'Longitudinal Analysis of Authenticated User Data Only',
    preconditions: 'User has at least 1 saved session summary.',
    steps: [
      'Navigate to the "Pattern Compass" tab.',
      'Click "Synthesize Compass Insights".',
      'Observe the resulting analysis.',
      'Click one of the generated Personalized Reflection Prompts.',
    ],
    expectedResult:
      'Pattern Compass extracts trends solely from the current user\'s past reflections. Clicking a tailored prompt redirects to the Reflection Space with that prompt pre-populated.',
  },
  {
    id: 'PRIV-01',
    category: '7. Privacy Center & Complete Data Purge Testing',
    title: 'Selective Deletion & Full Vault Purge',
    preconditions: 'Saved conversations exist in the user vault.',
    steps: [
      'Navigate to the "Privacy Center" tab.',
      'Verify real-time audit counts of conversations, messages, and insights.',
      'Click "Export Vault (JSON)" to download the backup archive.',
      'Click the trash icon to delete an individual conversation.',
      'Click "Purge All Personal Data", confirm the irreversible purge prompt.',
    ],
    expectedResult:
      'Exported JSON accurately matches stored records. Individual deletions remove records from Firestore. Full purge cleanses all documents under users/{uid} immediately.',
  },
];

export const WalkthroughModal: React.FC<WalkthroughModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const [completedTests, setCompletedTests] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const toggleTest = (id: string) => {
    setCompletedTests((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const completedCount = Object.values(completedTests).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col rounded-2xl bg-stone-900 border border-stone-800 text-stone-100 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-stone-800 flex items-center justify-between gap-4 bg-stone-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-950/80 border border-teal-800/60 flex items-center justify-center text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-100">
                Functional & Security Verification Walkthrough
              </h2>
              <p className="text-xs text-stone-400">
                Directive 6 Test Plan: {completedCount}/{TEST_CASES.length} Cases Verified
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="w-full bg-stone-800 h-1.5">
          <div
            className="bg-teal-400 h-1.5 transition-all duration-300"
            style={{ width: `${(completedCount / TEST_CASES.length) * 100}%` }}
          />
        </div>

        {/* Test Cases List */}
        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-xs text-stone-300 leading-relaxed">
            This verification plan details every interaction, multi-turn dialogue, persistence guarantee, and privacy boundary implemented in EchoMind. Automated testing frameworks or QA engineers can run through these test cases sequentially:
          </p>

          <div className="space-y-3">
            {TEST_CASES.map((tc) => {
              const isDone = !!completedTests[tc.id];
              return (
                <div
                  key={tc.id}
                  onClick={() => toggleTest(tc.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isDone
                      ? 'bg-stone-950/40 border-emerald-800/60'
                      : 'bg-stone-950/60 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isDone
                            ? 'bg-emerald-500 text-stone-950'
                            : 'border border-stone-700 bg-stone-800 text-transparent'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-800 text-teal-300 border border-stone-700">
                            {tc.id}
                          </span>
                          <span className="text-xs text-stone-400 font-mono">{tc.category}</span>
                        </div>

                        <h3 className="text-sm font-semibold text-stone-200">{tc.title}</h3>

                        <div className="text-xs text-stone-400 space-y-1 pt-1">
                          <p>
                            <strong className="text-stone-300">Preconditions:</strong> {tc.preconditions}
                          </p>
                          <div>
                            <strong className="text-stone-300">Steps:</strong>
                            <ol className="list-decimal list-inside pl-1 space-y-0.5 text-stone-400 mt-0.5">
                              {tc.steps.map((s, idx) => (
                                <li key={idx}>{s}</li>
                              ))}
                            </ol>
                          </div>
                          <p className="pt-1 text-emerald-300/90">
                            <strong>Expected Result:</strong> {tc.expectedResult}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/40 flex items-center justify-between">
          <span className="text-xs text-stone-400 font-mono">
            Current Session UID: {user ? user.uid : 'Unauthenticated'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-stone-950 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            Close Checklist
          </button>
        </div>
      </div>
    </div>
  );
};
