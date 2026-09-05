import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  BookOpen,
  ArrowRight,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  Compass,
  Tag,
  Smile,
  Target
} from 'lucide-react';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, sanitizePayload, handleFirestoreError } from '../lib/firebase';
import { sendChatMessage, generateSessionSummary } from '../lib/api';
import { UserProfile, ReflectionMessage, ConversationSummary, OperationType } from '../types';

interface ReflectionSpaceProps {
  user: UserProfile;
  initialPrompt?: string;
  onJumpToCompass?: () => void;
}

const INSPIRATIONAL_PROMPTS = [
  'What thought or decision has been quietly draining your energy lately?',
  'Where in your life did you notice friction or resistance this week?',
  'What is a boundary you wish you had held more firmly?',
  'What unexpected moment gave you a spark of genuine gratitude or relief?',
  'If you removed the need for outside approval, what step would you take next?',
];

export const ReflectionSpace: React.FC<ReflectionSpaceProps> = ({
  user,
  initialPrompt,
  onJumpToCompass,
}) => {
  const [conversationId, setConversationId] = useState<string>(() => `conv_${Date.now()}`);
  const [messages, setMessages] = useState<ReflectionMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>(initialPrompt || '');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [sessionSummary, setSessionSummary] = useState<ConversationSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>('gemini-3.8-flash');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setInputMessage(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleStartNewSession = () => {
    setConversationId(`conv_${Date.now()}`);
    setMessages([]);
    setInputMessage('');
    setSessionSummary(null);
    setErrorMessage(null);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed || isSending || isSummarizing) return;

    setErrorMessage(null);
    setIsSending(true);

    const userMessageId = `msg_${Date.now()}_u`;
    const userMsg: ReflectionMessage = {
      id: userMessageId,
      conversationId,
      userId: user.uid,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    // Optimistically hold user input buffer; if persist fails, we preserve input
    const previousMessages = [...messages];
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    try {
      // 1. Persist User Message to strict user-isolated Firestore path
      const userMsgRef = doc(db, 'users', user.uid, 'conversations', conversationId, 'messages', userMessageId);
      const conversationRef = doc(db, 'users', user.uid, 'conversations', conversationId);

      // Ensure conversation doc exists
      await setDoc(
        conversationRef,
        sanitizePayload({
          id: conversationId,
          userId: user.uid,
          title: updatedMessages[0]?.content.slice(0, 50) || 'Active Reflection',
          createdAt: updatedMessages[0]?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedTimestamp: serverTimestamp(),
          messageCount: updatedMessages.length,
        }),
        { merge: true }
      ).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/conversations/${conversationId}`);
      });

      await setDoc(
        userMsgRef,
        sanitizePayload({
          ...userMsg,
          timestamp: serverTimestamp(),
        })
      ).catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/conversations/${conversationId}/messages/${userMessageId}`);
      });

      // Clear input only upon successful persist initiation
      setInputMessage('');

      // 2. Call Multi-turn Gemini Reflection Chat
      const chatHistory = previousMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendChatMessage({
        conversationId,
        message: trimmed,
        history: chatHistory,
      });

      setActiveModel(res.modelUsed);

      // 3. Persist Model Response
      const modelMessageId = `msg_${Date.now()}_m`;
      const modelMsg: ReflectionMessage = {
        id: modelMessageId,
        conversationId,
        userId: user.uid,
        role: 'model',
        content: res.reply,
        createdAt: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, modelMsg];
      setMessages(finalMessages);

      const modelMsgRef = doc(db, 'users', user.uid, 'conversations', conversationId, 'messages', modelMessageId);
      await setDoc(
        modelMsgRef,
        sanitizePayload({
          ...modelMsg,
          timestamp: serverTimestamp(),
        })
      ).catch((err) => {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/conversations/${conversationId}/messages/${modelMessageId}`);
      });

      // Update conversation metadata
      await updateDoc(
        conversationRef,
        sanitizePayload({
          updatedAt: new Date().toISOString(),
          updatedTimestamp: serverTimestamp(),
          messageCount: finalMessages.length,
        })
      ).catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/conversations/${conversationId}`);
      });
    } catch (err: any) {
      console.error('Reflection interaction failed:', err);
      setErrorMessage(err.message || 'Failed to complete reflection step. Your input has been saved.');
      // Restore input text so user does not lose thoughts
      setInputMessage(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const handleSynthesizeSession = async () => {
    if (messages.length === 0 || isSummarizing) return;
    setErrorMessage(null);
    setIsSummarizing(true);

    try {
      const summaryResult = await generateSessionSummary({
        conversationId,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      setActiveModel(summaryResult.modelUsed);

      const convSummary: ConversationSummary = {
        id: conversationId,
        userId: user.uid,
        title: summaryResult.title,
        createdAt: messages[0]?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        summary: summaryResult.summary,
        keyThemes: summaryResult.keyThemes,
        sentiment: summaryResult.sentiment,
        growthAction: summaryResult.growthAction,
        messageCount: messages.length,
      };

      // Persist structured summary to Firestore
      const conversationRef = doc(db, 'users', user.uid, 'conversations', conversationId);
      await setDoc(conversationRef, sanitizePayload(convSummary), { merge: true }).catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/conversations/${conversationId}`);
      });

      setSessionSummary(convSummary);
    } catch (err: any) {
      console.error('Session synthesis error:', err);
      setErrorMessage(err.message || 'Failed to generate session summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Session status banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-stone-900/80 border border-stone-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-950/80 border border-teal-800/60 flex items-center justify-center text-teal-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-stone-100">Reflection Sanctuary</h1>
            <p className="text-xs text-stone-400">
              Session ID: <span className="font-mono text-stone-300">{conversationId.slice(-8)}</span> • Verified UID:{' '}
              <span className="font-mono text-teal-400/80">{user.uid.slice(0, 8)}...</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && !sessionSummary && (
            <button
              id="end-synthesize-btn"
              onClick={handleSynthesizeSession}
              disabled={isSummarizing || isSending}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-stone-950 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
            >
              {isSummarizing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>End & Synthesize Session</span>
                </>
              )}
            </button>
          )}

          <button
            id="new-reflection-btn"
            onClick={handleStartNewSession}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-stone-300 bg-stone-800/80 hover:bg-stone-700 hover:text-stone-100 border border-stone-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="flex items-start justify-between gap-3 p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Persistence Notice</p>
              <p className="text-red-300/90">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-200 text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Synthesis Card (if session completed) */}
      {sessionSummary && (
        <div className="p-6 rounded-2xl bg-gradient-to-b from-stone-900 to-stone-900/90 border border-teal-800/50 shadow-xl shadow-teal-950/20 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
                Session Synthesized & Saved to Firestore
              </span>
            </div>
            <span className="text-xs text-stone-400 font-mono flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              {new Date(sessionSummary.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-serif text-stone-100">{sessionSummary.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {sessionSummary.sentiment && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-800 text-teal-300 text-xs font-medium border border-stone-700">
                  <Smile className="w-3 h-3 text-teal-400" />
                  {sessionSummary.sentiment}
                </span>
              )}
              {sessionSummary.keyThemes?.map((theme, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-800/80 text-stone-300 text-xs border border-stone-700/60"
                >
                  <Tag className="w-3 h-3 text-stone-400" />
                  {theme}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3 text-stone-300 text-sm leading-relaxed whitespace-pre-line bg-stone-950/40 p-4 rounded-xl border border-stone-800/80">
            {sessionSummary.summary}
          </div>

          {sessionSummary.growthAction && (
            <div className="p-4 rounded-xl bg-teal-950/40 border border-teal-800/40 text-xs text-teal-200 space-y-1">
              <p className="font-semibold text-teal-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-teal-400" />
                <span>Suggested Micro-Growth Inquiry:</span>
              </p>
              <p className="italic">{sessionSummary.growthAction}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-stone-400">
              Analyzed via <span className="font-mono text-stone-300">{activeModel}</span>
            </p>
            {onJumpToCompass && (
              <button
                id="jump-to-compass-btn"
                onClick={onJumpToCompass}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
              >
                <span>View Longitudinal Trends in Pattern Compass</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Conversation Canvas */}
      <div className="min-h-[380px] max-h-[550px] overflow-y-auto p-4 sm:p-6 rounded-2xl bg-stone-950/60 border border-stone-800/80 flex flex-col space-y-4">
        {messages.length === 0 ? (
          <div className="my-auto text-center space-y-6 max-w-lg mx-auto py-8">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-teal-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-stone-200">What would you like to reflect upon?</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                EchoMind listens without judgment, remembers your context throughout this session, and helps surface clarity.
              </p>
            </div>

            {/* Prompt suggestions */}
            <div className="space-y-2 text-left">
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider font-mono">
                Gentle Starters
              </p>
              <div className="grid grid-cols-1 gap-2">
                {INSPIRATIONAL_PROMPTS.slice(0, 3).map((prompt, idx) => (
                  <button
                    key={idx}
                    id={`starter-prompt-${idx}`}
                    onClick={() => setInputMessage(prompt)}
                    className="p-3 rounded-xl bg-stone-900/90 hover:bg-stone-800/90 border border-stone-800 text-xs text-stone-300 text-left transition-all hover:border-teal-800/60 cursor-pointer flex items-center justify-between group"
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-500 group-hover:text-teal-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                    isUser
                      ? 'bg-stone-700 text-stone-200'
                      : 'bg-teal-950 border border-teal-700/60 text-teal-300'
                  }`}
                >
                  {isUser ? 'You' : 'EM'}
                </div>

                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed space-y-1.5 shadow-sm ${
                    isUser
                      ? 'bg-stone-800 text-stone-100 rounded-tr-none'
                      : 'bg-stone-900/90 border border-stone-800 text-stone-200 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <div className="flex items-center justify-between gap-4 pt-1 text-[10px] text-stone-500 font-mono">
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!isUser && <span>Reflective Companion</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {isSending && (
          <div className="flex gap-3 mr-auto max-w-[85%]">
            <div className="w-7 h-7 rounded-full bg-teal-950 border border-teal-700/60 text-teal-300 flex items-center justify-center text-xs font-semibold shrink-0">
              EM
            </div>
            <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 text-stone-400 text-xs rounded-tl-none flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>EchoMind is listening and formulating thoughts...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSendMessage} className="space-y-2">
        <div className="relative rounded-2xl bg-stone-900/90 border border-stone-800 focus-within:border-teal-600/80 transition-all p-2 shadow-lg shadow-stone-950/40">
          <textarea
            id="reflection-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Write freely... What is present for you right now? (Shift+Enter for newline)"
            rows={3}
            disabled={isSending || isSummarizing}
            className="w-full bg-transparent border-0 resize-none text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-0 p-2"
          />

          <div className="flex items-center justify-between pt-2 border-t border-stone-800/80 px-2">
            <div className="flex items-center gap-2 text-[11px] text-stone-500">
              <span>{inputMessage.length}/5000 chars</span>
              <span>•</span>
              <span className="font-mono text-teal-500/80">Private Vault Storage</span>
            </div>

            <button
              id="send-reflection-btn"
              type="submit"
              disabled={!inputMessage.trim() || isSending || isSummarizing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-stone-950 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
            >
              <span>Reflect</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
