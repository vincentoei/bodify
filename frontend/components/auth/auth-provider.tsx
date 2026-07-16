"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { apiGet } from "@/lib/api";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  fullName: string | null;
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface BackendUser {
  id: string;
  email: string | null;
  full_name: string | null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadFullName = async (session: Session | null) => {
    if (session?.user) {
      try {
        // Backend DB is the source of truth; it syncs from Supabase metadata
        const backendUser = await apiGet<BackendUser>("/auth/me");
        setFullName(backendUser.full_name);
      } catch {
        // Fallback to Supabase user metadata if backend is unreachable
        const metadataName = session.user.user_metadata?.full_name as string | undefined;
        setFullName(metadataName || null);
      }
    }
  };

  useEffect(() => {
    const getSession = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadFullName(session);
        }
      } catch (e) {
        setSession(null);
        setUser(null);
        setFullName(null);
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const supabase = createClient();
      const sub = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        loadFullName(session);
      });
      subscription = sub.data.subscription;
    } catch (e) {
      // Supabase not configured
    }

    return () => subscription?.unsubscribe();
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    const supabase = createClient();
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data.session?.user) {
      await loadFullName(data.session);
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/?email_confirmed=true`,
      },
    });
    if (error) throw error;
    setFullName(fullName || null);
  };

  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore
    }
    setUser(null);
    setSession(null);
    setFullName(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        fullName,
        isLoading,
        signInWithPassword,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
