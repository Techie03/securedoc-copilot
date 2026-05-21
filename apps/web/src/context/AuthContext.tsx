'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, User, Workspace } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  login: (data: any) => Promise<void>;
  githubLogin: (code: string) => Promise<void>;
  signup: (data: any) => Promise<void>;
  logout: () => void;
  selectWorkspace: (workspace: Workspace) => void;
  createWorkspace: (name: string) => Promise<Workspace>;
  refreshWorkspaces: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load session from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('securedoc_token');
      if (storedToken) {
        try {
          // Verify token & fetch user profile
          const userProfile = await api.getMe(storedToken);
          setUser(userProfile);
          setToken(storedToken);

          // Fetch workspaces
          const wsList = await api.listWorkspaces();
          setWorkspaces(wsList);
          
          // Try to restore previous workspace preference
          const savedWorkspaceId = localStorage.getItem('securedoc_current_workspace_id');
          const matched = wsList.find(w => w.id === savedWorkspaceId);
          if (matched) {
            setCurrentWorkspace(matched);
          } else if (wsList.length > 0) {
            setCurrentWorkspace(wsList[0]);
            localStorage.setItem('securedoc_current_workspace_id', wsList[0].id);
          }
        } catch (error) {
          console.error('Failed to restore auth session:', error);
          // Token expired or invalid
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  // Simple route guard redirects
  useEffect(() => {
    if (loading) return;

    const publicRoutes = ['/', '/login', '/signup'];
    const isPublicRoute = publicRoutes.includes(pathname);

    if (!user && !isPublicRoute) {
      router.push('/login');
    } else if (user && (pathname === '/login' || pathname === '/signup')) {
      router.push('/dashboard');
    }
  }, [user, pathname, loading]);

  const login = async (data: any) => {
    setLoading(true);
    try {
      const tokenResp = await api.login(data);
      localStorage.setItem('securedoc_token', tokenResp.access_token);
      setToken(tokenResp.access_token);

      const userProfile = await api.getMe(tokenResp.access_token);
      setUser(userProfile);

      const wsList = await api.listWorkspaces();
      setWorkspaces(wsList);

      if (wsList.length > 0) {
        setCurrentWorkspace(wsList[0]);
        localStorage.setItem('securedoc_current_workspace_id', wsList[0].id);
      } else {
        setCurrentWorkspace(null);
      }
      
      router.push('/dashboard');
    } catch (error) {
      logout();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const githubLogin = async (code: string) => {
    setLoading(true);
    try {
      const tokenResp = await api.githubLogin(code);
      localStorage.setItem('securedoc_token', tokenResp.access_token);
      setToken(tokenResp.access_token);

      const userProfile = await api.getMe(tokenResp.access_token);
      setUser(userProfile);

      const wsList = await api.listWorkspaces();
      setWorkspaces(wsList);

      if (wsList.length > 0) {
        setCurrentWorkspace(wsList[0]);
        localStorage.setItem('securedoc_current_workspace_id', wsList[0].id);
      } else {
        setCurrentWorkspace(null);
      }
      
      router.push('/dashboard');
    } catch (error) {
      logout();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (data: any) => {
    setLoading(true);
    try {
      await api.signup(data);
      // Log in immediately after signup
      const tokenResp = await api.login({ email: data.email, password: data.password });
      localStorage.setItem('securedoc_token', tokenResp.access_token);
      setToken(tokenResp.access_token);

      const userProfile = await api.getMe(tokenResp.access_token);
      setUser(userProfile);

      // A default workspace is automatically created by backend signup
      const wsList = await api.listWorkspaces();
      setWorkspaces(wsList);

      if (wsList.length > 0) {
        setCurrentWorkspace(wsList[0]);
        localStorage.setItem('securedoc_current_workspace_id', wsList[0].id);
      }

      router.push('/dashboard');
    } catch (error) {
      logout();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('securedoc_token');
    localStorage.removeItem('securedoc_current_workspace_id');
    setUser(null);
    setToken(null);
    setWorkspaces([]);
    setCurrentWorkspace(null);
    router.push('/login');
  };

  const selectWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('securedoc_current_workspace_id', workspace.id);
  };

  const createWorkspace = async (name: string) => {
    try {
      const newWs = await api.createWorkspace(name);
      setWorkspaces(prev => [...prev, newWs]);
      selectWorkspace(newWs);
      return newWs;
    } catch (error) {
      console.error('Failed to create workspace:', error);
      throw error;
    }
  };

  const refreshWorkspaces = async () => {
    try {
      const wsList = await api.listWorkspaces();
      setWorkspaces(wsList);
      
      // Auto select if none selected
      if (wsList.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(wsList[0]);
        localStorage.setItem('securedoc_current_workspace_id', wsList[0].id);
      }
    } catch (error) {
      console.error('Failed to refresh workspaces:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        workspaces,
        currentWorkspace,
        loading,
        login,
        githubLogin,
        signup,
        logout,
        selectWorkspace,
        createWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
