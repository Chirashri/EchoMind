import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Trash2,
  Download,
  AlertTriangle,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  FileText
} from 'lucide-react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { UserProfile, ConversationSummary, CompassInsight, OperationType } from '../types';

interface PrivacyCenterViewProps {
  user: UserProfile;
  onDataPurged?: () => void;
}

export const PrivacyCenterView: React.FC<PrivacyCenterViewProps> = ({
  user,
  onDataPurged,
}) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [insights, setInsights] = useState<CompassInsight[]>([]);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState<boolean>(false);

  const loadAuditData = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      // 1. Fetch conversations
      const convsRef = collection(db, 'users', user.uid, 'conversations');
      const convsSnap = await getDocs(convsRef).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/conversations`);
      });

      const convList: ConversationSummary[] = [];
      let totalMsgs = 0;

      for (const d of convsSnap.docs) {
        const data = d.data();
        convList.push({
          id: d.id,
          userId: user.uid,
          title: data.title || 'Untitled Session',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          summary: data.summary,
          keyThemes: data.keyThemes || [],
          sentiment: data.sentiment,
          growthAction: data.growthAction,
          messageCount: data.messageCount || 0,
        });

        // Count messages
        const msgsRef = collection(db, 'users', user.uid, 'conversations', d.id, 'messages');
        const msgsSnap = await getDocs(msgsRef).catch(() => ({ size: 0 }));
        totalMsgs += msgsSnap.size;
      }
      setConversations(convList);
      setTotalMessages(totalMsgs);

      // 2. Fetch insights
      const insightsRef = collection(db, 'users', user.uid, 'insights');
      const insightsSnap = await getDocs(insightsRef).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/insights`);
      });

      const insightList: CompassInsight[] = [];
      insightsSnap.forEach((d) => {
        const data = d.data();
        insightList.push({
          id: d.id,
          userId: user.uid,
          createdAt: data.createdAt || new Date().toISOString(),
          periodDescription: data.periodDescription || '',
          recurringThemes: data.recurringThemes || [],
          frequentlyMentionedGoals: data.frequentlyMentionedGoals || [],
          perspectiveShifts: data.perspectiveShifts || [],
          personalizedPrompts: data.personalizedPrompts || [],
          sampleSize: data.sampleSize || 0,
        });
      });
      setInsights(insightList);
    } catch (err: any) {
      console.error('Privacy audit error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load privacy audit information.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, [user.uid]);

  const handleDeleteConversation = async (convId: string) => {
    if (!window.confirm('Permanently delete this conversation and its associated messages?')) return;
    try {
      const msgsRef = collection(db, 'users', user.uid, 'conversations', convId, 'messages');
      const msgsSnap = await getDocs(msgsRef);
      for (const m of msgsSnap.docs) {
        await deleteDoc(doc(db, 'users', user.uid, 'conversations', convId, 'messages', m.id));
      }
      await deleteDoc(doc(db, 'users', user.uid, 'conversations', convId)).catch((err) => {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/conversations/${convId}`);
      });

      setConversations((prev) => prev.filter((c) => c.id !== convId));
      setFeedback({ type: 'success', message: 'Conversation permanently deleted.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete conversation.' });
    }
  };

  const handleDeleteInsight = async (insightId: string) => {
    if (!window.confirm('Permanently delete this Pattern Compass insight?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'insights', insightId)).catch((err) => {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/insights/${insightId}`);
      });

      setInsights((prev) => prev.filter((i) => i.id !== insightId));
      setFeedback({ type: 'success', message: 'Pattern Compass insight permanently deleted.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete insight.' });
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Gather full transcripts
      const fullExport: any = {
        metadata: {
          exportedAt: new Date().toISOString(),
          userId: user.uid,
          email: user.email,
          description: 'EchoMind Private Archive',
        },
        conversations: [] as any[],
        insights: insights,
      };

      for (const conv of conversations) {
        const msgsRef = collection(db, 'users', user.uid, 'conversations', conv.id, 'messages');
        const msgsSnap = await getDocs(msgsRef);
        const msgs = msgsSnap.docs.map((d) => d.data());
        fullExport.conversations.push({
          ...conv,
          messages: msgs,
        });
      }

      const blob = new Blob([JSON.stringify(fullExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `echomind_vault_${user.uid.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setFeedback({ type: 'success', message: 'Personal vault archive downloaded successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to export archive.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePurgeAllData = async () => {
    setIsPurging(true);
    setFeedback(null);
    try {
      // 1. Delete all conversations & messages
      for (const conv of conversations) {
        const msgsRef = collection(db, 'users', user.uid, 'conversations', conv.id, 'messages');
        const msgsSnap = await getDocs(msgsRef);
        for (const m of msgsSnap.docs) {
          await deleteDoc(doc(db, 'users', user.uid, 'conversations', conv.id, 'messages', m.id));
        }
        await deleteDoc(doc(db, 'users', user.uid, 'conversations', conv.id));
      }

      // 2. Delete all insights
      for (const ins of insights) {
        await deleteDoc(doc(db, 'users', user.uid, 'insights', ins.id));
      }

      setConversations([]);
      setInsights([]);
      setTotalMessages(0);
      setShowPurgeConfirm(false);
      setFeedback({ type: 'success', message: 'All personal data has been completely and irrevocably purged from Firestore.' });
      if (onDataPurged) onDataPurged();
    } catch (err: any) {
      console.error('Data purge error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to complete complete data purge.' });
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 text-stone-100">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-serif text-stone-100">Privacy & Data Sovereignty Center</h1>
              <p className="text-xs text-stone-400 mt-0.5">
                Audit, manage, export, and delete your private reflection data at any time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportData}
              disabled={isExporting || (conversations.length === 0 && insights.length === 0)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-stone-200 bg-stone-800 hover:bg-stone-700 border border-stone-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>{isExporting ? 'Packaging Archive...' : 'Export Vault (JSON)'}</span>
            </button>

            <button
              onClick={loadAuditData}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors cursor-pointer"
              title="Refresh Audit Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center justify-between gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-200'
                : 'bg-red-950/60 border border-red-800 text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="underline hover:opacity-80 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Metrics Audit Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-stone-900/70 border border-stone-800 space-y-1">
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Verified User ID</p>
          <p className="text-sm font-mono text-teal-300 truncate" title={user.uid}>
            {user.uid}
          </p>
          <p className="text-[10px] text-stone-500">Derived strictly from Google Auth JWT</p>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/70 border border-stone-800 space-y-1">
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Stored Sessions</p>
          <p className="text-2xl font-serif text-stone-100">{conversations.length}</p>
          <p className="text-[10px] text-stone-500">At path users/{user.uid.slice(0, 6)}.../conversations</p>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/70 border border-stone-800 space-y-1">
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Dialogue Messages</p>
          <p className="text-2xl font-serif text-stone-100">{totalMessages}</p>
          <p className="text-[10px] text-stone-500">Individual reflection turns stored</p>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/70 border border-stone-800 space-y-1">
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Compass Insights</p>
          <p className="text-2xl font-serif text-stone-100">{insights.length}</p>
          <p className="text-[10px] text-stone-500">At path users/{user.uid.slice(0, 6)}.../insights</p>
        </div>
      </div>

      {/* Architecture Verification Explainer */}
      <div className="p-6 rounded-2xl bg-stone-900/40 border border-stone-800/80 space-y-3">
        <div className="flex items-center gap-2 text-stone-200 font-semibold text-sm">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>Strict User-Bound Data Isolation Architecture</span>
        </div>
        <p className="text-xs text-stone-400 leading-relaxed">
          EchoMind implements a Zero-Trust data model. All records in Cloud Firestore are stored within subpaths under your verified User ID. The Firestore security rules mathematically reject any read, write, update, or delete request if <code className="text-teal-300 font-mono text-[11px]">request.auth.uid != userId</code>.
        </p>
        <div className="p-3 rounded-xl bg-stone-950 font-mono text-xs text-stone-300 border border-stone-800 space-y-1">
          <div className="text-emerald-400">✓ users/{user.uid}/conversations/{'{conversationId}'}</div>
          <div className="text-emerald-400">✓ users/{user.uid}/conversations/{'{conversationId}'}/messages/{'{messageId}'}</div>
          <div className="text-emerald-400">✓ users/{user.uid}/insights/{'{insightId}'}</div>
        </div>
      </div>

      {/* Itemized Management Tabs */}
      <div className="space-y-6">
        {/* Saved Conversations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-400" />
              <span>Saved Conversations ({conversations.length})</span>
            </h2>
          </div>

          {conversations.length === 0 ? (
            <div className="p-6 rounded-xl bg-stone-900/40 border border-stone-800 text-center text-xs text-stone-400">
              No saved conversations currently stored in your vault.
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="p-3.5 rounded-xl bg-stone-900/70 border border-stone-800/90 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 truncate">
                    <p className="font-medium text-stone-200 truncate">{conv.title}</p>
                    <p className="text-[11px] text-stone-500 font-mono">
                      ID: {conv.id} • Created: {new Date(conv.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteConversation(conv.id)}
                    className="p-2 rounded-lg text-stone-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                    title="Permanently delete this conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Saved Pattern Compass Insights */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              <span>Saved Pattern Compass Insights ({insights.length})</span>
            </h2>
          </div>

          {insights.length === 0 ? (
            <div className="p-6 rounded-xl bg-stone-900/40 border border-stone-800 text-center text-xs text-stone-400">
              No generated Pattern Compass insights stored in your vault.
            </div>
          ) : (
            <div className="space-y-2">
              {insights.map((ins) => (
                <div
                  key={ins.id}
                  className="p-3.5 rounded-xl bg-stone-900/70 border border-stone-800/90 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 truncate">
                    <p className="font-medium text-stone-200 truncate">
                      Longitudinal Synthesis ({ins.periodDescription || `${ins.sampleSize} reflections`})
                    </p>
                    <p className="text-[11px] text-stone-500 font-mono">
                      ID: {ins.id} • Generated: {new Date(ins.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteInsight(ins.id)}
                    className="p-2 rounded-lg text-stone-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                    title="Permanently delete this insight"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone: Purge All Personal Data */}
      <div className="p-6 rounded-2xl bg-red-950/20 border border-red-800/50 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-red-300">Danger Zone: Irrevocable Data Purge</h2>
            <p className="text-xs text-stone-400 leading-relaxed">
              Permanently and completely remove all your stored reflection conversations, message transcripts, and Pattern Compass insights from Cloud Firestore. This operation cannot be undone.
            </p>
          </div>
        </div>

        {showPurgeConfirm ? (
          <div className="p-4 rounded-xl bg-red-950/50 border border-red-800 space-y-3">
            <p className="text-xs font-semibold text-red-200">
              Are you completely certain? All data under path <code className="font-mono">users/{user.uid}</code> will be deleted immediately.
            </p>
            <div className="flex items-center gap-3">
              <button
                id="confirm-purge-btn"
                onClick={handlePurgeAllData}
                disabled={isPurging}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-stone-100 font-semibold text-xs cursor-pointer shadow-md disabled:opacity-50"
              >
                {isPurging ? 'Purging Everything...' : 'Yes, Permanently Purge My Data'}
              </button>
              <button
                onClick={() => setShowPurgeConfirm(false)}
                disabled={isPurging}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            id="start-purge-btn"
            onClick={() => setShowPurgeConfirm(true)}
            className="px-4 py-2 rounded-xl border border-red-800 text-red-400 hover:bg-red-950/40 text-xs font-medium transition-colors cursor-pointer"
          >
            Purge All Personal Data
          </button>
        )}
      </div>
    </div>
  );
};
