import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, User } from 'lucide-react';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect.'
        : error.message
      );
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        setError('Cet email est déjà utilisé. Essayez de vous connecter.');
      } else {
        setError(error.message);
      }
    } else {
      setSuccess('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
      setIsSignUp(false);
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: 'linear-gradient(135deg, #001F3F 0%, #003366 50%, #001F3F 100%)'
    }}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md mx-4"
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-[#FF851B] rounded-2xl shadow-lg shadow-[#FF851B]/30 mb-4"
          >
            <span className="text-2xl font-black text-white">CP</span>
          </motion.div>
          <h1 className="text-3xl font-black text-white tracking-tight">ChantierPro</h1>
          <p className="text-white/50 text-sm mt-1">Gestion de chantier intelligente</p>
        </div>

        {/* Login / SignUp Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="p-8">
            <h2 className="text-xl font-bold text-white mb-1">
              {isSignUp ? 'Créer un compte' : 'Connexion'}
            </h2>
            <p className="text-white/40 text-sm mb-6">
              {isSignUp 
                ? 'Remplissez le formulaire pour créer votre espace.'
                : 'Entrez vos identifiants pour accéder à votre espace.'}
            </p>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 mb-6"
              >
                <AlertCircle size={18} className="text-red-400 shrink-0" />
                <span className="text-red-300 text-sm">{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-xl px-4 py-3 mb-6"
              >
                <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                <span className="text-green-300 text-sm">{success}</span>
              </motion.div>
            )}

            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                    Nom complet
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      id="signup-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Mohamed Darif"
                      className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 outline-none focus:ring-2 focus:ring-[#FF851B] focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@entreprise.com"
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 outline-none focus:ring-2 focus:ring-[#FF851B] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 outline-none focus:ring-2 focus:ring-[#FF851B] focus:border-transparent transition-all"
                  />
                </div>
                {isSignUp && (
                  <p className="text-white/30 text-xs mt-1.5">Minimum 6 caractères</p>
                )}
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#FF851B] hover:bg-[#E76A00] text-white font-bold rounded-xl shadow-lg shadow-[#FF851B]/25 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {isSignUp ? 'Création en cours...' : 'Connexion en cours...'}
                  </>
                ) : (
                  isSignUp ? 'Créer mon compte' : 'Se connecter'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}
                className="text-sm text-[#FF851B] hover:text-[#FFB366] font-semibold transition-colors"
              >
                {isSignUp 
                  ? 'Déjà un compte ? Se connecter'
                  : "Pas de compte ? S'inscrire"
                }
              </button>
            </div>
          </div>

          <div className="bg-white/5 border-t border-white/10 px-8 py-4 text-center">
            <p className="text-white/30 text-xs">
              © {new Date().getFullYear()} ChantierPro — Tous droits réservés
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
