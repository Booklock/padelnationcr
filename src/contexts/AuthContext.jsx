import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
    setLoading(false);
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signUp(email, password, { fullName, nickname, phone, gender, category, level, preferredSide }) {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name:        fullName,
          nickname:         nickname         || null,
          phone:            phone            || null,
          gender:           gender           || "unspecified",
          current_category: category         || null,
          current_level:    level            || null,
          preferred_side:   preferredSide    || null,
        },
      },
    });
  }

  async function signOut() {
    return supabase.auth.signOut();
  }

  async function resetPassword(email) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/actualizar-password`,
    });
  }

  const isAdmin =
    profile?.role === "admin" || profile?.role === "super_admin";
  const isCoordinatorOrAbove =
    isAdmin || profile?.role === "coordinator";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        isCoordinatorOrAbove,
        signIn,
        signUp,
        signOut,
        resetPassword,
        refreshProfile: () => user && fetchProfile(user.id),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
