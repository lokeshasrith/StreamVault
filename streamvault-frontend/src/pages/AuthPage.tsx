import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, LogIn, UserPlus, Loader2, Film, Tv, Sparkles } from "lucide-react";

export default function AuthPage() {
  const { register, login } = useAuth();
  const nav = useNavigate();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setErr(null);
    setSuccess(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccess(null);
    setBusy(true);
    try {
      if (mode === "register") {
        await register({ email, password, displayName });
        setSuccess("Account created! You can now log in.");
        setMode("login");
      } else {
        await login({ email, password });
        nav("/");
      }
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <div className="auth-root min-h-screen overflow-x-hidden overflow-y-auto px-3 py-6 sm:px-4 sm:py-8" style={{
      backgroundColor: '#05070b',
      backgroundImage: `
        radial-gradient(circle at 14% 18%, rgba(255, 188, 95, 0.16), transparent 28%),
        radial-gradient(circle at 86% 12%, rgba(90, 211, 255, 0.13), transparent 24%),
        linear-gradient(180deg, #05070b 0%, #090c12 42%, #07090e 100%)
      `
    }}>
      <div className="auth-shell relative z-10 mx-auto w-full max-w-[440px]">
        {/* Branding */}
        <div className="auth-branding text-center mb-3">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, #ffe2a7 0%, #ffc562 54%, #ff9457 100%)',
              boxShadow: '0 6px 18px rgba(255, 155, 82, 0.3)'
            }}>
              <span className="text-[#07090d] font-bold text-xs tracking-wide">SV</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#f4efe6] tracking-tight" style={{ fontFamily: "'Space Grotesk', 'Poppins', system-ui, sans-serif" }}>
              StreamVault
            </h1>
          </div>

          {/* Premium kicker */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="inline-flex items-center gap-2 text-[#ffd48c] text-[0.64rem] font-bold tracking-[0.28em] uppercase">
              <span className="w-6 h-px rounded-full" style={{ background: 'linear-gradient(90deg, rgba(255,197,98,0.9), rgba(255,92,57,0.25))' }} />
              {isLogin ? "Welcome Back" : "Get Started"}
            </span>
          </div>

          <p className="text-[#8f98a8] text-xs">
            {isLogin ? "Sign in to your streaming universe." : "Create your account and start tracking."}
          </p>

          {/* Feature pills */}
          <div className="auth-pills mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {[
              { icon: Film, label: "Movies" },
              { icon: Tv, label: "TV Shows" },
              { icon: Sparkles, label: "Anime" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-semibold uppercase tracking-wide border border-white/[0.09] bg-[rgba(11,14,20,0.72)] text-[rgba(244,239,230,0.86)]">
                <Icon className="w-2.5 h-2.5 opacity-70" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="auth-card premium-panel p-3.5 sm:p-5">
          {/* Tab Switcher */}
          <div className="flex rounded-full p-1 mb-4 border border-white/[0.06] bg-[rgba(8,11,17,0.6)]">
            <button
              onClick={() => switchMode("login")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-semibold transition-all duration-300 cursor-pointer ${
                isLogin
                  ? "text-[#07090d] shadow-lg"
                  : "text-[#8f98a8] hover:text-[#f4efe6]"
              }`}
              style={isLogin ? {
                background: 'linear-gradient(135deg, #ffe2a7 0%, #ffc562 54%, #ff9457 100%)',
                boxShadow: '0 8px 24px rgba(255, 155, 82, 0.25)'
              } : {}}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
            <button
              onClick={() => switchMode("register")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-semibold transition-all duration-300 cursor-pointer ${
                !isLogin
                  ? "text-[#07090d] shadow-lg"
                  : "text-[#8f98a8] hover:text-[#f4efe6]"
              }`}
              style={!isLogin ? {
                background: 'linear-gradient(135deg, #ffe2a7 0%, #ffc562 54%, #ff9457 100%)',
                boxShadow: '0 8px 24px rgba(255, 155, 82, 0.25)'
              } : {}}
            >
              <UserPlus className="w-4 h-4" />
              Sign Up
            </button>
          </div>

          {/* Messages */}
          <AnimatePresence mode="wait">
            {err && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-2xl bg-[#ff5c39]/10 border border-[#ff5c39]/20 text-[#ff5c39] text-sm"
              >
                {err}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-2xl bg-[#6de0a1]/10 border border-[#6de0a1]/20 text-[#6de0a1] text-sm"
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-2.5">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  key="displayName"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-[11px] font-semibold text-[#8f98a8] mb-1 tracking-wide uppercase">Display Name</label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8f98a8] group-focus-within:text-[#ffc562] transition-colors" />
                    <input
                      className="w-full pl-10 pr-4 py-2.5 bg-[rgba(8,11,17,0.6)] border border-white/[0.08] rounded-xl text-sm text-[#f4efe6] placeholder:text-[#8f98a8]/40 focus:outline-none focus:border-[#ffc562]/40 focus:ring-1 focus:ring-[#ffc562]/20 transition-all duration-200"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-[11px] font-semibold text-[#8f98a8] mb-1 tracking-wide uppercase">Email</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8f98a8] group-focus-within:text-[#ffc562] transition-colors" />
                <input
                  type="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-[rgba(8,11,17,0.6)] border border-white/[0.08] rounded-xl text-sm text-[#f4efe6] placeholder:text-[#8f98a8]/40 focus:outline-none focus:border-[#ffc562]/40 focus:ring-1 focus:ring-[#ffc562]/20 transition-all duration-200"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#8f98a8] mb-1 tracking-wide uppercase">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8f98a8] group-focus-within:text-[#ffc562] transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full pl-10 pr-10 py-2.5 bg-[rgba(8,11,17,0.6)] border border-white/[0.08] rounded-xl text-sm text-[#f4efe6] placeholder:text-[#8f98a8]/40 focus:outline-none focus:border-[#ffc562]/40 focus:ring-1 focus:ring-[#ffc562]/20 transition-all duration-200"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8f98a8] hover:text-[#ffc562] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={busy}
              whileHover={{ scale: busy ? 1 : 1.02 }}
              whileTap={{ scale: busy ? 1 : 0.97 }}
              className="w-full py-2.5 rounded-full font-semibold text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-3"
              style={{
                color: '#07090d',
                background: 'linear-gradient(135deg, #ffe2a7 0%, #ffc562 54%, #ff9457 100%)',
                boxShadow: '0 18px 40px rgba(255, 155, 82, 0.2)'
              }}
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Please wait…
                </>
              ) : isLogin ? (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </>
              )}
            </motion.button>
          </form>

          {/* Footer toggle */}
          <p className="text-center text-[#8f98a8] text-xs mt-3">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => switchMode(isLogin ? "register" : "login")}
              className="text-[#ffc562] hover:text-[#ffe2a7] font-semibold transition-colors cursor-pointer"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}