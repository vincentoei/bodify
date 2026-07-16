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
  isDemo: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signInAsDemo: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_FLAG = "bodify-demo-mode";

interface BackendUser {
  id: string;
  email: string | null;
  full_name: string | null;
  is_demo: boolean;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

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
    const demoMode = typeof window !== "undefined" && localStorage.getItem(DEMO_FLAG) === "true";
    setIsDemo(demoMode);

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
        } else if (demoMode) {
          setFullName("Demo User");
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
    localStorage.removeItem(DEMO_FLAG);
    setIsDemo(false);

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
    localStorage.removeItem(DEMO_FLAG);
    setIsDemo(false);
    setFullName(fullName || null);
  };

  const signInAsDemo = async () => {
    try {
      const supabase = createClient();
      const { error, data } = await supabase.auth.signInWithPassword({
        email: "demo@bodify.app",
        password: "demobodify123",
      });
      if (!error) {
        localStorage.removeItem(DEMO_FLAG);
        setIsDemo(false);
        await loadFullName(data.session);
        return;
      }
    } catch (e) {
      // Fallback to local demo flag
    }

    localStorage.setItem(DEMO_FLAG, "true");
    setIsDemo(true);
    setFullName("Demo User");
  };

  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore
    }
    localStorage.removeItem(DEMO_FLAG);
    setIsDemo(false);
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
        isDemo,
        signInWithPassword,
        signUp,
        signInAsDemo,
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
