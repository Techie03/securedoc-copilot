const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    if (process.env.NEXT_PUBLIC_API_URL.endsWith('/api')) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    return process.env.NEXT_PUBLIC_API_URL + '/api';
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8000/api`;
  }
  return 'http://127.0.0.1:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentResponse {
  id: string;
  workspace_id: string;
  uploaded_by?: string;
  filename: string;
  file_type: string;
  storage_url: string;
  status: string; // 'processing' | 'ready' | 'error'
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface ChatSession {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface ChatRun {
  id: string;
  route?: string;
  model?: string;
  latency_ms?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  estimated_cost?: number;
  confidence?: number;
  created_at: string;
}

export interface EvaluationScore {
  id: string;
  faithfulness?: number;
  relevance?: number;
  citation_accuracy?: number;
  hallucination_risk?: number;
  route_accuracy?: number;
  created_at: string;
}

export interface Citation {
  filename: string;
  document_id: string;
  page_number?: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  mode?: string;
  sources_json?: Citation[];
  created_at: string;
  chat_run?: ChatRun;
  evaluation_scores?: EvaluationScore;
}

export interface Memory {
  id: string;
  user_id?: string;
  workspace_id?: string;
  memory_key: string;
  memory_value: string;
  visibility: string; // 'private' | 'workspace'
  type: string; // 'user' | 'workspace'
  created_at: string;
}

export interface EvaluationLog {
  run_id: string;
  message_id: string;
  query?: string;
  route?: string;
  model?: string;
  latency_ms?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  estimated_cost?: number;
  confidence?: number;
  created_at: string;
  evaluation?: {
    id: string;
    faithfulness?: number;
    relevance?: number;
    citation_accuracy?: number;
    hallucination_risk?: number;
    route_accuracy?: number;
    created_at: string;
  };
}

export interface Connector {
  id: string;
  workspace_id: string;
  provider: string;
  status: string;
  config?: any;
  created_at: string;
  doc_count?: number;
  latest_sync?: {
    id: string;
    status: string;
    started_at: string;
    completed_at?: string;
    logs?: string;
  };
}

export interface KnowledgeTriple {
  id: string;
  subject: string;
  predicate: string;
  object_entity: string;
  confidence: number;
  document_id?: string;
  created_at: string;
}

class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.name = 'ApiError';
  }
}

// Helper to get authorization headers
function getHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('securedoc_token') : null);
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  return headers;
}

// Generic request helper
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let errorMessage = 'An error occurred';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new ApiError(response.status, errorMessage);
    }

    // For 204 No Content, return null as T
    if (response.status === 204) {
      return null as unknown as T;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error instanceof Error ? error.message : 'Network error');
  }
}

export const api = {
  // Auth API
  async signup(data: any): Promise<User> {
    return request<User>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        full_name: data.fullName,
        password: data.password,
      }),
    });
  },

  async login(data: any): Promise<{ access_token: string }> {
    return request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async githubLogin(code: string): Promise<{ access_token: string }> {
    return request<{ access_token: string }>('/auth/github', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async googleLogin(code: string, redirectUri: string): Promise<{ access_token: string }> {
    return request<{ access_token: string }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
  },

  async getMe(token?: string): Promise<User> {
    return request<User>('/auth/me', {
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
  },

  // Workspace API
  async listWorkspaces(): Promise<Workspace[]> {
    return request<Workspace[]>('/workspaces', {
      method: 'GET',
    });
  },

  async createWorkspace(name: string): Promise<Workspace> {
    return request<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  
  async getWorkspaceGraph(workspaceId: string): Promise<KnowledgeTriple[]> {
    return request<KnowledgeTriple[]>(`/workspaces/${workspaceId}/graph`, {
      method: 'GET',
    });
  },
  
  async syncGithubConnector(workspaceId: string, repoUrl: string): Promise<{ detail: string, document_id: string }> {
    return request<{ detail: string, document_id: string }>(`/workspaces/${workspaceId}/connectors/github/sync`, {
      method: 'POST',
      body: JSON.stringify({ repo_url: repoUrl }),
    });
  },
  
  // Document API
  async uploadDocument(workspaceId: string, file: File): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const headers = getHeaders() as Record<string, string>;
    delete headers['Content-Type']; // Let the browser set the boundary automatically

    return request<DocumentResponse>(`/workspaces/${workspaceId}/documents`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });
  },

  async listDocuments(workspaceId: string): Promise<DocumentResponse[]> {
    return request<DocumentResponse[]>(`/workspaces/${workspaceId}/documents`, {
      method: 'GET',
    });
  },

  async deleteDocument(workspaceId: string, documentId: string): Promise<void> {
    return request<void>(`/workspaces/${workspaceId}/documents/${documentId}`, {
      method: 'DELETE',
    });
  },
  
  // Chat API
  async listChatSessions(workspaceId: string): Promise<ChatSession[]> {
    return request<ChatSession[]>(`/workspaces/${workspaceId}/chats`, {
      method: 'GET',
    });
  },

  async createChatSession(workspaceId: string, title?: string): Promise<ChatSession> {
    return request<ChatSession>(`/workspaces/${workspaceId}/chats`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  async deleteChatSession(workspaceId: string, sessionId: string): Promise<void> {
    return request<void>(`/workspaces/${workspaceId}/chats/${sessionId}`, {
      method: 'DELETE',
    });
  },

  async listChatMessages(workspaceId: string, sessionId: string): Promise<ChatMessage[]> {
    return request<ChatMessage[]>(`/workspaces/${workspaceId}/chats/${sessionId}/messages`, {
      method: 'GET',
    });
  },

  async sendChatMessage(workspaceId: string, sessionId: string, content: string, mode: string = 'auto'): Promise<ChatMessage> {
    return request<ChatMessage>(`/workspaces/${workspaceId}/chats/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, mode }),
    });
  },

  // Memory API
  async listMemories(workspaceId: string): Promise<Memory[]> {
    return request<Memory[]>(`/workspaces/${workspaceId}/memories`, {
      method: 'GET',
    });
  },

  async createMemory(workspaceId: string, data: { memory_key: string; memory_value: string; visibility?: string }): Promise<Memory> {
    return request<Memory>(`/workspaces/${workspaceId}/memories`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteMemory(workspaceId: string, memoryId: string): Promise<void> {
    return request<void>(`/workspaces/${workspaceId}/memories/${memoryId}`, {
      method: 'DELETE',
    });
  },

  // Evaluations API
  async listEvaluations(workspaceId: string, limit: number = 50): Promise<EvaluationLog[]> {
    return request<EvaluationLog[]>(`/workspaces/${workspaceId}/evaluations?limit=${limit}`, {
      method: 'GET',
    });
  },

  // Connectors API
  async createGithubConnector(workspaceId: string, data: { owner: string; repo: string; branch?: string; github_token?: string }): Promise<Connector> {
    return request<Connector>(`/workspaces/${workspaceId}/connectors/github`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createGdriveConnector(workspaceId: string): Promise<Connector> {
    return request<Connector>(`/workspaces/${workspaceId}/connectors/gdrive`, {
      method: 'POST',
    });
  },

  async listConnectors(workspaceId: string): Promise<Connector[]> {
    return request<Connector[]>(`/workspaces/${workspaceId}/connectors`, {
      method: 'GET',
    });
  },

  async syncConnector(workspaceId: string, connectorId: string): Promise<{ message: string; connector_id: string }> {
    return request<{ message: string; connector_id: string }>(`/workspaces/${workspaceId}/connectors/${connectorId}/sync`, {
      method: 'POST',
    });
  },

  async deleteConnector(workspaceId: string, connectorId: string): Promise<void> {
    return request<void>(`/workspaces/${workspaceId}/connectors/${connectorId}`, {
      method: 'DELETE',
    });
  },

  // Health
  async getHealth(): Promise<{ status: string; service: string }> {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    if (!response.ok) {
      throw new Error('Health check failed');
    }
    return response.json();
  }
};
