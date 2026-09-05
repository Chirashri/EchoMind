import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  BookOpen,
  Trash2,
  Calendar,
  Smile,
  Tag,
  MessageSquare,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Target
} from 'lucide-react';
import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { UserProfile, ConversationSummary, ReflectionMessage, OperationType } from '../types';

interface HistoryViewProps {
  user: UserProfile;
  onSelectPromptForNewSession?: (prompt: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  user,
  onSelectPromptForNewSession,
}) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ReflectionMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const convsRef = collection(db, 'users', user.uid, 'conversations');
      let snapshot;
      try {
        const q = query(convsRef, orderBy('createdAt', 'desc'));
        snapshot = await getDocs(q);
      } catch (orderErr) {
        console.warn('Ordered query fallback to direct collection list:', orderErr);
        snapshot = await getDocs(convsRef).catch((err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/conversations`);
        });
      }

      const list: ConversationSummary[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          userId: data.userId || user.uid,
          title: data.title || 'Untitled Session',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
          summary: data.summary,
          keyThemes: data.keyThemes || [],
          sentiment: data.sentiment,
          growthAction: data.growthAction,
          messageCount: data.messageCount || 0,
        });
      });

      // Guarantee descending chronological order in-memory
      list.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.updatedAt).getTime();
        const timeB = new Date(b.createdAt || b.updatedAt).getTime();
        return timeB - timeA;
      });

      setConversations(list);
    } catch (err: any) {
      console.error('Error fetching conversations:', err);
      setErrorMessage(err.message || 'Failed to load conversation history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user.uid]);

  const handleOpenConversation = async (conv: ConversationSummary) => {
    setSelectedConversation(conv);
    setIsLoadingMessages(true);
    try {
      const msgsRef = collection(db, 'users', user.uid, 'conversations', conv.id, 'messages');
      let snapshot;
      try {
        const q = query(msgsRef, orderBy('createdAt', 'asc'));
        snapshot = await getDocs(q);
      } catch {
        snapshot = await getDocs(msgsRef).catch((err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/conversations/${conv.id}/messages`);
        });
      }

      const msgs: ReflectionMessage[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        msgs.push({
          id: d.id,
          conversationId: conv.id,
          userId: user.uid,
          role: data.role,
          content: data.content,
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });

      // Guarantee ascending chronological order in-memory
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setConversationMessages(msgs);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setErrorMessage(err.message || 'Failed to load conversation messages.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this reflection session?')) return;

    setDeletingId(convId);
    try {
      // 1. Delete messages subcollection docs
      const msgsRef = collection(db, 'users', user.uid, 'conversations', convId, 'messages');
      const msgsSnap = await getDocs(msgsRef);
      for (const mDoc of msgsSnap.docs) {
        await deleteDoc(doc(db, 'users', user.uid, 'conversations', convId, 'messages', mDoc.id));
      }

      // 2. Delete parent conversation doc
      await deleteDoc(doc(db, 'users', user.uid, 'conversations', convId)).catch((err) => {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/conversations/${convId}`);
      });

      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (selectedConversation?.id === convId) {
        setSelectedConversation(null);
        setConversationMessages([]);
      }
    } catch (err: any) {
      console.error('Failed to delete conversation:', err);
      setErrorMessage(err.message || 'Failed to delete conversation.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const term = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(term) ||
      (c.summary && c.summary.toLowerCase().includes(term)) ||
      (c.keyThemes && c.keyThemes.some((t) => t.toLowerCase().includes(term)))
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 text-stone-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-stone-900/80 border border-stone-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-teal-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-stone-100">Saved Reflections Vault</h1>
            <p className="text-xs text-stone-400">
              Isolated user partition: <span className="font-mono text-teal-400/80">{user.uid}</span>
            </p>
          </div>
        </div>

        <button
          onClick={fetchConversations}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-300 bg-stone-800 hover:bg-stone-700 hover:text-stone-100 border border-stone-700 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {selectedConversation ? (
        /* Conversation Detail View */
        <div className="space-y-6">
          <button
            id="back-to-sessions-btn"
            onClick={() => setSelectedConversation(null)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-xs font-medium text-stone-300 hover:text-stone-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Sessions</span>
          </button>

          {/* Session Overview Card */}
          <div className="p-6 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-800/80">
              <span className="text-xs text-stone-400 font-mono flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                {new Date(selectedConversation.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>

              <button
                onClick={(e) => handleDeleteConversation(selectedConversation.id, e)}
                disabled={deletingId === selectedConversation.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Session</span>
              </button>
            </div>

            <h2 className="text-2xl font-serif text-stone-100">{selectedConversation.title}</h2>

            <div className="flex flex-wrap gap-2">
              {selectedConversation.sentiment && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-800 text-teal-300 text-xs font-medium border border-stone-700">
                  <Smile className="w-3 h-3 text-teal-400" />
                  {selectedConversation.sentiment}
                </span>
              )}
              {selectedConversation.keyThemes?.map((t, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-800/80 text-stone-300 text-xs border border-stone-700/60"
                >
                  <Tag className="w-3 h-3 text-stone-400" />
                  {t}
                </span>
              ))}
            </div>

            {selectedConversation.summary && (
              <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800/80 text-sm text-stone-300 leading-relaxed whitespace-pre-line">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider font-mono mb-2">
                  Session Synthesis
                </p>
                {selectedConversation.summary}
              </div>
            )}

            {selectedConversation.growthAction && (
              <div className="p-4 rounded-xl bg-teal-950/30 border border-teal-800/40 text-xs text-teal-200 space-y-1">
                <p className="font-semibold text-teal-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-teal-400" />
                  <span>Growth Action:</span>
                </p>
                <p className="italic">{selectedConversation.growthAction}</p>
              </div>
            )}
          </div>

          {/* Messages stream */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-stone-300 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-teal-400" />
              <span>Full Reflection Dialogue ({conversationMessages.length} messages)</span>
            </h3>

            {isLoadingMessages ? (
              <div className="p-8 text-center text-stone-400 text-xs flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                <span>Loading transcript from Firestore...</span>
              </div>
            ) : conversationMessages.length === 0 ? (
              <div className="p-6 rounded-xl bg-stone-900/40 border border-stone-800 text-center text-xs text-stone-400">
                No recorded messages found for this session.
              </div>
            ) : (
              <div className="space-y-3">
                {conversationMessages.map((m) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'bg-stone-800/90 text-stone-100 ml-8 border border-stone-700/60'
                          : 'bg-stone-900/90 text-stone-200 mr-8 border border-stone-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1.5 text-stone-400">
                        <span className="font-semibold text-teal-400">{isUser ? 'You' : 'EchoMind'}</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Conversations List View */
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reflections by title, theme, or content..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-900/80 border border-stone-800 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-teal-600/80 transition-all"
            />
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-stone-400 text-xs flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              <span>Retrieving your private vault from Cloud Firestore...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-12 rounded-2xl bg-stone-900/40 border border-stone-800/80 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-stone-600 mx-auto" />
              <h3 className="text-base font-medium text-stone-300">
                {searchQuery ? 'No matching reflections found' : 'Your vault is quiet'}
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try a different keyword or search query.'
                  : 'Start your first dialogue in the Reflection Space. Sessions and summaries will appear here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  id={`session-card-${conv.id}`}
                  onClick={() => handleOpenConversation(conv)}
                  className="p-5 rounded-2xl bg-stone-900/80 hover:bg-stone-900 border border-stone-800/80 hover:border-teal-800/60 transition-all cursor-pointer group space-y-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base text-stone-100 group-hover:text-teal-300 transition-colors">
                        {conv.title}
                      </h3>
                      {conv.sentiment && (
                        <span className="px-2 py-0.5 rounded-md bg-stone-800 text-teal-300 text-[10px] border border-stone-700">
                          {conv.sentiment}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-stone-400 font-mono flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-stone-500" />
                        {new Date(conv.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>

                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        disabled={deletingId === conv.id}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800 transition-colors cursor-pointer"
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {conv.summary && (
                    <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">{conv.summary}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-800/60 text-xs">
                    <div className="flex flex-wrap gap-1.5">
                      {conv.keyThemes?.slice(0, 3).map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-stone-800/80 text-stone-300 text-[10px] border border-stone-700/50"
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <span className="text-[11px] text-teal-400 font-medium group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                      <span>View Session</span>
                      <span>→</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
