import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { SovoLogo } from "./SovoLogo";
import { User } from "../types";
import { Lock, Eye, EyeOff, ArrowRight, Fingerprint, Phone } from "lucide-react";
import { sound } from "../lib/sound";
import { supabase } from "../lib/supabase";
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

interface AuthLandingProps {
  onAuthenticate: (user: User) => void;
}

/** Build or recover an app User profile from Supabase Auth session data */
async function upsertUserProfile(sbUser: { id: string; email?: string | null; user_metadata?: Record<string, any> }): Promise<User> {
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('id', sbUser.id)
    .maybeSingle();

  if (existing) return existing as User;

  // First time — create the profile
  const meta = sbUser.user_metadata || {};
  const fallbackName = meta.full_name || meta.name || sbUser.email?.split('@')[0] || "S'ovo User";
  const newUser: User = {
    id: sbUser.id,
    username: (sbUser.email?.split('@')[0] || sbUser.id).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    displayName: fallbackName,
    phoneNumber: meta.phone || '',
    avatarUrl: meta.avatar_url || meta.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=222230&color=ffd700`,
    bio: "Hey there! I am using S'ovo.",
    isOnline: true,
    lastSeen: Date.now(),
    joinedAt: new Date().toISOString(),
    devicesCount: 1,
    biometricEnabled: false,
    pinCode: '0000',
    e2eePublicKey: 'GEN_KEY',
    e2eeFingerprint: 'SOVO-E2EE-GEN',
  };

  await supabase.from('users').insert(newUser);
  return newUser;
}

export const AuthLanding: React.FC<AuthLandingProps> = ({ onAuthenticate }) => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(""); // Only for signup
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // On mount: listen for OAuth redirect (web Google sign-in) callback
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        try {
          const appUser = await upsertUserProfile(session.user);
          sound.playBiometricSuccess();
          onAuthenticate(appUser);
        } catch (err) {
          console.error('Auth state change error:', err);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) { setErrorMsg("Please enter your email and password"); return; }
    if (mode === "signup" && !displayName) { setErrorMsg("Please enter your display name"); return; }

    setErrorMsg("");
    setIsSubmitting(true);
    sound.playTap();

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: { data: { full_name: displayName } },
        });
        if (error) throw error;
        if (!data.user) throw new Error("Sign-up failed — no user returned.");

        const newUser: User = {
          id: data.user.id,
          username: identifier.split('@')[0],
          displayName,
          phoneNumber: '',
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=222230&color=ffd700`,
          bio: "Hey there! I am using S'ovo.",
          isOnline: true,
          lastSeen: Date.now(),
          joinedAt: new Date().toISOString(),
          devicesCount: 1,
          biometricEnabled: false,
          pinCode: '0000',
          e2eePublicKey: 'GEN_KEY',
          e2eeFingerprint: 'SOVO-E2EE-GEN',
        };
        await supabase.from('users').insert(newUser);
        sound.playBiometricSuccess();
        onAuthenticate(newUser);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
        if (error) throw error;
        if (!data.user) throw new Error("Sign-in failed.");

        const appUser = await upsertUserProfile(data.user);
        sound.playBiometricSuccess();
        onAuthenticate(appUser);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setErrorMsg(err.message || "An error occurred during authentication.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    sound.playTap();
    setErrorMsg("");
    setIsSubmitting(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // --- Android APK: use native Google Sign-In to get ID token ---
        await GoogleAuth.initialize({
          clientId: '480015860775-jqu81i0msjv60k47lq5v51pej3ol5ddh.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });
        const googleUser = await GoogleAuth.signIn();
        const idToken = googleUser.authentication.idToken;

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
        if (error) throw error;
        if (!data.user) throw new Error("Google sign-in failed — no user returned.");

        const appUser = await upsertUserProfile(data.user);
        sound.playBiometricSuccess();
        onAuthenticate(appUser);
      } else {
        // --- Web: OAuth redirect via Supabase ---
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
        // onAuthStateChange listener above will handle the callback
      }
    } catch (err: any) {
      console.error("Google sign-in error:", JSON.stringify(err));
      const errCode = err?.code || err?.errorCode || "unknown";
      const errMsg = err?.message || err?.errorMessage || JSON.stringify(err);
      setErrorMsg(`Sign-in failed [${errCode}]: ${errMsg}`);
      setIsSubmitting(false);
    }
  };

  const handleSocial = (_provider: string) => {
    sound.playTap();
    setErrorMsg(`${_provider} login is not yet implemented.`);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#050507] text-[#f4f4f6] relative overflow-hidden px-5 py-8" id="sovo-auth-landing">
      {/* Ambient gold background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-[#d4af37]/20 to-transparent blur-[80px]" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-gradient-to-tr from-[#c29826]/15 to-transparent blur-[100px]" />
        <svg className="absolute top-0 right-0 w-72 h-72 opacity-25" viewBox="0 0 300 300">
          <path d="M300 0 Q180 120 120 300" stroke="url(#gs1)" strokeWidth="1.5" fill="none"/>
          <path d="M270 0 Q150 130 90 300" stroke="url(#gs1)" strokeWidth="0.8" fill="none"/>
          <defs><linearGradient id="gs1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffd700" stopOpacity="0.9"/><stop offset="100%" stopColor="#d4af37" stopOpacity="0"/></linearGradient></defs>
        </svg>
        <svg className="absolute bottom-0 left-0 w-64 h-64 opacity-20" viewBox="0 0 300 300">
          <path d="M0 300 Q120 180 300 120" stroke="url(#gs2)" strokeWidth="1.5" fill="none"/>
          <defs><linearGradient id="gs2" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#ffd700" stopOpacity="0.6"/><stop offset="100%" stopColor="#d4af37" stopOpacity="0"/></linearGradient></defs>
        </svg>
      </div>

      {/* Logo */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center mb-8 relative z-10">
        <SovoLogo size="2xl" withGlow animated />
        <h1 className="text-3xl font-display font-extrabold text-gold-glossy mt-4 mb-1">Welcome to S&apos;ovo.</h1>
        <p className="text-sm text-[#888] font-medium">Privacy first. Always.</p>
      </motion.div>

      {/* Form card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="w-full max-w-sm relative z-10">
        {/* Toggle */}
        <div className="grid grid-cols-2 gap-0 mb-6 bg-[#0e0e16] rounded-2xl p-1 border border-[#222230]">
          {(["signin", "signup"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setErrorMsg(""); sound.playTap(); }}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === m ? "gold-glossy-button text-[#050507] shadow-md" : "text-[#666] hover:text-white"}`}>
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {errorMsg && <div className="mb-4 px-3 py-2 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs text-center">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div className="relative">
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display Name"
                className="w-full px-4 py-4 bg-[#0e0e16] border border-[#222230] focus:border-[#d4af37]/50 rounded-2xl text-sm text-white placeholder-[#444456] outline-none transition"/>
            </div>
          )}

          {/* Identifier */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555568]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <input type="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email address"
              className="w-full pl-11 pr-4 py-4 bg-[#0e0e16] border border-[#222230] focus:border-[#d4af37]/50 rounded-2xl text-sm text-white placeholder-[#444456] outline-none transition"/>
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555568]" />
            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              className="w-full pl-11 pr-12 py-4 bg-[#0e0e16] border border-[#222230] focus:border-[#d4af37]/50 rounded-2xl text-sm text-white placeholder-[#444456] outline-none transition"/>
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555568] hover:text-[#d4af37] transition">
              {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
            </button>
          </div>

          {mode === "signin" && (
            <div><button type="button" className="text-xs text-[#d4af37] hover:text-[#ffd700] transition font-medium">Forgot password?</button></div>
          )}

          <button type="submit" disabled={isSubmitting}
            className="w-full py-4 rounded-2xl gold-glossy-button text-[#050507] font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.98]">
            {isSubmitting ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"/> : <><span>{mode === "signin" ? "Sign In" : "Create Account"}</span><ArrowRight className="w-4 h-4"/></>}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#1a1a26]"/>
          <span className="text-xs text-[#444456]">or continue with</span>
          <div className="flex-1 h-px bg-[#1a1a26]"/>
        </div>

        {/* Google */}
        <button type="button" onClick={handleGoogleSignIn} disabled={isSubmitting}
          className="w-full py-4 px-4 mb-3 rounded-2xl bg-[#0e0e16] hover:bg-[#14141e] border border-[#222230] hover:border-[#333345] flex items-center justify-center gap-3 text-sm font-semibold text-white transition cursor-pointer">
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Apple */}
        <button type="button" onClick={() => handleSocial("Apple")}
          className="w-full py-4 px-4 mb-5 rounded-2xl bg-[#0e0e16] hover:bg-[#14141e] border border-[#222230] hover:border-[#333345] flex items-center justify-center gap-3 text-sm font-semibold text-white transition cursor-pointer">
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="white">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          <span>Continue with Apple</span>
        </button>

        <p className="text-center text-xs text-[#444456] mb-3">Other options</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button type="button" onClick={() => handleSocial("Phone")}
            className="py-3.5 px-3 rounded-2xl bg-[#0e0e16] border border-[#222230] hover:border-[#d4af37]/30 flex items-center justify-center gap-2 text-sm font-medium text-white transition cursor-pointer">
            <Phone className="w-4 h-4 text-[#d4af37]"/><span>Phone Number</span>
          </button>
          <button type="button" onClick={() => handleSocial("Biometric")}
            className="py-3.5 px-3 rounded-2xl bg-[#0e0e16] border border-[#222230] hover:border-[#d4af37]/30 flex items-center justify-center gap-2 text-sm font-medium text-white transition cursor-pointer">
            <Fingerprint className="w-4 h-4 text-[#d4af37]"/><span>Biometric Login</span>
          </button>
        </div>

        <p className="text-center text-[11px] text-[#3a3a4a] leading-relaxed">
          By continuing, you agree to S&apos;ovo&apos;s{" "}
          <span className="text-[#c9a830] cursor-pointer hover:text-[#ffd700] transition">Terms of Service</span>
          {" "}and{" "}
          <span className="text-[#c9a830] cursor-pointer hover:text-[#ffd700] transition">Privacy Policy</span>
        </p>
      </motion.div>

      {/* E2EE badge */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] text-[#555568] z-10">
        <Lock className="w-3 h-3 text-[#d4af37]"/>
        <span>End-to-end encrypted by default</span>
      </motion.div>
    </div>
  );
};
