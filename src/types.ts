export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface ReflectionMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  summary?: string;
  keyThemes?: string[];
  sentiment?: string;
  growthAction?: string;
  messageCount?: number;
}

export interface RecurringTheme {
  theme: string;
  frequency: string;
  explanation: string;
}

export interface TrackedGoal {
  goal: string;
  evolution: string;
  status: string;
}

export interface PerspectiveShift {
  shift: string;
  evidence: string;
}

export interface CompassInsight {
  id: string;
  userId: string;
  createdAt: string;
  periodDescription: string;
  recurringThemes: RecurringTheme[];
  frequentlyMentionedGoals: TrackedGoal[];
  perspectiveShifts: PerspectiveShift[];
  personalizedPrompts: string[];
  sampleSize: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
