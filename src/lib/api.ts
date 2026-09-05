import { auth } from './firebase';

async function getAuthHeader(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User is not authenticated. Please sign in.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function sendChatMessage(params: {
  conversationId: string;
  message: string;
  history: Array<{ role: string; content: string }>;
}): Promise<{ reply: string; modelUsed: string }> {
  const headers = await getAuthHeader();
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Reflection failed with status ${res.status}`);
  }

  return res.json();
}

export async function generateSessionSummary(params: {
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
}): Promise<{
  title: string;
  summary: string;
  keyThemes: string[];
  sentiment: string;
  growthAction: string;
  modelUsed: string;
}> {
  const headers = await getAuthHeader();
  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Summary generation failed with status ${res.status}`);
  }

  return res.json();
}

export async function runPatternCompass(params: {
  summaries: any[];
}): Promise<{
  periodDescription: string;
  recurringThemes: Array<{ theme: string; frequency: string; explanation: string }>;
  frequentlyMentionedGoals: Array<{ goal: string; evolution: string; status: string }>;
  perspectiveShifts: Array<{ shift: string; evidence: string }>;
  personalizedPrompts: string[];
  sampleSize: number;
  modelUsed: string;
}> {
  const headers = await getAuthHeader();
  const res = await fetch('/api/pattern-compass', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Pattern Compass analysis failed with status ${res.status}`);
  }

  return res.json();
}
