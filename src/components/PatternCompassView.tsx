import React, { useState, useEffect } from 'react';
import {
  Compass,
  Sparkles,
  TrendingUp,
  Target,
  Lightbulb,
  ArrowRight,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Layers
} from 'lucide-react';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, sanitizePayload, handleFirestoreError } from '../lib/firebase';
import { runPatternCompass } from '../lib/api';
import { UserProfile, ConversationSummary, CompassInsight, OperationType } from '../types';

interface PatternCompassViewProps {
  user: UserProfile;
  onLaunchPrompt: (prompt: string) => void;
}

export const PatternCompassView: React.FC<PatternCompassViewProps> = ({
  user,
  onLaunchPrompt,
}) => {
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [savedInsights, setSavedInsights] = useState<CompassInsight[]>([]);
  const [activeInsight, setActiveInsight] = useState<CompassInsight | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>('gemini-3.8-flash');

  const loadUserData = async () => {
    setIsLoadingHistory(true);
    setErrorMessage(null);
    try {
      // 1. Fetch user's own saved conversation summaries
      const convsRef = collection(db, 'users', user.uid, 'conversations');
      let convsSnap;
      try {
        convsSnap = await getDocs(query(convsRef, orderBy('createdAt', 'desc')));
      } catch (err) {
        console.warn('Ordered conversations fetch fallback to direct collection list:', err);
        convsSnap = await getDocs(convsRef).catch((fetchErr) => {
          handleFirestoreError(fetchErr, OperationType.LIST, `users/${user.uid}/conversations`);
        });
      }

      const convList: ConversationSummary[] = [];
      convsSnap.forEach((d) => {
        const data = d.data();
        convList.push({
          id: d.id,
          userId: user.uid,
          title: data.title || 'Untitled',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
          summary: data.summary,
          keyThemes: data.keyThemes || [],
          sentiment: data.sentiment,
          growthAction: data.growthAction,
        });
      });
      convList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSummaries(convList);

      // 2. Fetch user's own saved Pattern Compass insights
      const insightsRef = collection(db, 'users', user.uid, 'insights');
      let insightsSnap;
      try {
        insightsSnap = await getDocs(query(insightsRef, orderBy('createdAt', 'desc')));
      } catch (err) {
        console.warn('Ordered insights fetch fallback to direct collection list:', err);
        insightsSnap = await getDocs(insightsRef).catch((fetchErr) => {
          handleFirestoreError(fetchErr, OperationType.LIST, `users/${user.uid}/insights`);
        });
      }

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
      insightList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSavedInsights(insightList);
      if (insightList.length > 0 && !activeInsight) {
        setActiveInsight(insightList[0]);
      }
    } catch (err: any) {
      console.error('Pattern Compass load error:', err);
      setErrorMessage(err.message || 'Failed to load summaries for Pattern Compass.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [user.uid]);

  const handleRunAnalysis = async () => {
    if (summaries.length === 0) {
      setErrorMessage('You need at least one completed reflection session before Pattern Compass can detect trends.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      // Send user's own summaries to Pattern Compass analysis endpoint
      const result = await runPatternCompass({
        summaries: summaries.map((s) => ({
          title: s.title,
          summary: s.summary,
          keyThemes: s.keyThemes,
          sentiment: s.sentiment,
          growthAction: s.growthAction,
        })),
      });

      setActiveModel(result.modelUsed);

      const insightId = `insight_${Date.now()}`;
      const newInsight: CompassInsight = {
        id: insightId,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        periodDescription: result.periodDescription,
        recurringThemes: result.recurringThemes,
        frequentlyMentionedGoals: result.frequentlyMentionedGoals,
        perspectiveShifts: result.perspectiveShifts,
        personalizedPrompts: result.personalizedPrompts,
        sampleSize: result.sampleSize,
      };

      // Persist to user-isolated Firestore collection: users/{uid}/insights/{insightId}
      const insightRef = doc(db, 'users', user.uid, 'insights', insightId);
      await setDoc(
        insightRef,
        sanitizePayload({
          ...newInsight,
          timestamp: serverTimestamp(),
        })
      ).catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/insights/${insightId}`);
      });

      setActiveInsight(newInsight);
      setSavedInsights((prev) => [newInsight, ...prev]);
    } catch (err: any) {
      console.error('Pattern Compass analysis error:', err);
      setErrorMessage(err.message || 'Pattern Compass analysis encountered an issue.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteInsight = async (insightId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this saved Pattern Compass analysis?')) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'insights', insightId)).catch((err) => {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/insights/${insightId}`);
      });

      setSavedInsights((prev) => prev.filter((i) => i.id !== insightId));
      if (activeInsight?.id === insightId) {
        const remaining = savedInsights.filter((i) => i.id !== insightId);
        setActiveInsight(remaining[0] || null);
      }
    } catch (err: any) {
      console.error('Error deleting insight:', err);
      setErrorMessage(err.message || 'Failed to delete insight.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 text-stone-100">
      {/* Feature header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-stone-900 via-stone-900/90 to-amber-950/30 border border-stone-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400 shadow-md">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-serif text-stone-100">Pattern Compass</h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 text-[10px] font-mono border border-amber-700/50">
                  Longitudinal Engine
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Surfacing recurrent motifs, evolving goals, and perspective shifts across your private reflections.
              </p>
            </div>
          </div>

          <button
            id="run-compass-btn"
            onClick={handleRunAnalysis}
            disabled={isAnalyzing || summaries.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs text-stone-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md shadow-amber-950/40"
          >
            {isAnalyzing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                <span>Navigating Your Patterns...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Synthesize Compass Insights</span>
              </>
            )}
          </button>
        </div>

        {/* Audit scope indicator */}
        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-stone-800 text-xs text-stone-400">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-stone-500" />
            <span>
              Available Sessions:{' '}
              <strong className="text-stone-200">{summaries.length} reflections</strong>
            </span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px]">Strictly Isolated to UID: {user.uid.slice(0, 10)}...</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-200 underline text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Historical insight selector pills */}
      {savedInsights.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs">
          <span className="text-stone-500 shrink-0 font-mono text-[11px]">Saved Insights:</span>
          {savedInsights.map((ins, idx) => (
            <button
              key={ins.id}
              onClick={() => setActiveInsight(ins)}
              className={`px-3 py-1.5 rounded-lg border shrink-0 transition-colors cursor-pointer ${
                activeInsight?.id === ins.id
                  ? 'bg-amber-950/60 border-amber-700 text-amber-200 font-medium'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              #{idx + 1} • {new Date(ins.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </button>
          ))}
        </div>
      )}

      {/* Primary Display */}
      {isLoadingHistory ? (
        <div className="p-16 text-center text-stone-400 text-xs flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing pattern records from Cloud Firestore...</span>
        </div>
      ) : activeInsight ? (
        <div className="space-y-8">
          {/* Metadata bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-stone-900/60 border border-stone-800 text-xs text-stone-400">
            <div className="flex items-center gap-2 font-mono">
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              <span>
                Generated:{' '}
                {new Date(activeInsight.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                ({activeInsight.periodDescription || `${activeInsight.sampleSize} reflections`})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-stone-500 font-mono text-[11px]">Analyzed via {activeModel}</span>
              <button
                onClick={(e) => handleDeleteInsight(activeInsight.id, e)}
                className="text-stone-500 hover:text-red-400 transition-colors p-1"
                title="Delete this insight"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 1. Recurring Themes */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-semibold text-stone-200">1. Recurring Themes</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {activeInsight.recurringThemes.map((t, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-stone-900/80 border border-stone-800 space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm text-stone-200">{t.theme}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-800 text-amber-300 border border-stone-700">
                      {t.frequency}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed">{t.explanation}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 2. Frequently Mentioned Goals */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-teal-400" />
              <h2 className="text-base font-semibold text-stone-200">2. Frequently Mentioned Goals</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeInsight.frequentlyMentionedGoals.map((g, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-stone-900/80 border border-stone-800 space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm text-stone-200">{g.goal}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-950 text-teal-300 border border-teal-800">
                      {g.status}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed italic">{g.evolution}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Changes in Perspective Over Time */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-stone-200">3. Perspective Shifts Over Time</h2>
            </div>
            <div className="space-y-2.5">
              {activeInsight.perspectiveShifts.map((s, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-stone-900/80 border border-stone-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1 max-w-xl">
                    <p className="text-sm font-semibold text-emerald-300">{s.shift}</p>
                    <p className="text-xs text-stone-400 leading-relaxed">{s.evidence}</p>
                  </div>
                  <span className="self-start sm:self-center px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-300 text-[10px] font-mono border border-emerald-800/60 shrink-0">
                    Observed Shift
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Personalized Reflection Prompts */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-semibold text-stone-200">4. Personalized Reflection Prompts</h2>
            </div>
            <p className="text-xs text-stone-400">
              Generated exclusively from your recurring themes. Click any prompt to launch a fresh reflection session:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {activeInsight.personalizedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  id={`compass-prompt-${idx}`}
                  onClick={() => onLaunchPrompt(prompt)}
                  className="p-4 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-800 hover:border-amber-600/70 text-left transition-all group flex flex-col justify-between space-y-3 cursor-pointer shadow-sm"
                >
                  <p className="text-xs text-stone-200 leading-relaxed">{prompt}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-[11px] text-amber-400 font-medium">
                    <span>Launch Reflection</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 rounded-2xl bg-stone-900/40 border border-stone-800 text-center space-y-4">
          <Compass className="w-12 h-12 text-stone-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-medium text-stone-200">No Compass Insights Synthesized Yet</h3>
            <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
              Pattern Compass analyzes your saved reflection summaries to uncover recurring themes, goal evolutions, and perspective shifts.
            </p>
          </div>

          {summaries.length > 0 ? (
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium text-stone-950 bg-amber-400 hover:bg-amber-300 transition-all cursor-pointer shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              <span>Synthesize Compass Insights Now ({summaries.length} reflections available)</span>
            </button>
          ) : (
            <div className="text-xs text-stone-500 font-mono">
              Complete your first reflection session in Reflection Space to activate Pattern Compass.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
