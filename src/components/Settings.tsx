import React, { useState, useEffect } from 'react';
import { User, Lock, Trash2, Save, AlertTriangle, CheckCircle2, Loader2, Mail, Shield, Users, UserPlus, Crown, Eye, Calendar, Construction, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { motion } from 'motion/react';
import { fetchProjectMembers, inviteProjectMember, removeProjectMember, updateMemberRole } from '../lib/supabaseService';

const ROLES = [
  { value: 'admin', label: 'Admin', icon: Crown, desc: 'Accès complet (créer, modifier, supprimer)', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  { value: 'suivi', label: 'Suivi', icon: Construction, desc: 'Suivi des travaux + dalles (voir + modifier statut)', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'planning', label: 'Planning', icon: Calendar, desc: 'Planification (voir + gérer tâches)', color: 'text-green-600 bg-green-50 border-green-200' },
  { value: 'viewer', label: 'Lecture', icon: Eye, desc: 'Consultation uniquement (voir les données)', color: 'text-gray-600 bg-gray-50 border-gray-200' },
];

export default function Settings() {
  const { user, signOut } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Team management
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('suivi');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      setEmail(user.email || '');
      loadMembers();
    }
  }, [user]);

  const loadMembers = async () => {
    const data = await fetchProjectMembers();
    setMembers(data);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName }
    });
    if (error) showMessage('error', error.message);
    else showMessage('success', 'Profil mis à jour avec succès !');
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { showMessage('error', 'Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (newPassword !== confirmPassword) { showMessage('error', 'Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) showMessage('error', error.message);
    else { showMessage('success', 'Mot de passe modifié avec succès !'); setNewPassword(''); setConfirmPassword(''); }
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      await inviteProjectMember(inviteEmail, inviteRole);
      const roleName = ROLES.find(r => r.value === inviteRole)?.label || inviteRole;

      // Send invitation email automatically
      const siteUrl = window.location.origin;
      const ownerName = user?.user_metadata?.full_name || user?.email || 'Le chef de projet';
      try {
        const res = await fetch('/api/send-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: inviteEmail, ownerName, role: roleName, siteUrl })
        });
        if (res.ok) {
          showMessage('success', `✅ Email d'invitation envoyé à ${inviteEmail} (rôle: ${roleName})`);
        } else {
          const errData = await res.json().catch(() => ({}));
          showMessage('success', `Membre ajouté (${roleName}). Email non envoyé: ${errData.error || 'erreur serveur'}`);
        }
      } catch {
        showMessage('success', `Membre ajouté (${roleName}). Email non envoyé (API indisponible).`);
      }

      setInviteEmail('');
      await loadMembers();
    } catch (err: any) {
      showMessage('error', err.message || 'Erreur lors de l\'invitation.');
    }
    setInviteLoading(false);
  };

  const handleRemoveMember = async (id: number) => {
    if (!confirm('Retirer ce membre du projet ?')) return;
    await removeProjectMember(id);
    await loadMembers();
    showMessage('success', 'Membre retiré du projet.');
  };

  const handleRoleChange = async (id: number, newRole: string) => {
    await updateMemberRole(id, newRole);
    await loadMembers();
    showMessage('success', 'Rôle mis à jour.');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') return;
    setLoading(true);
    const uid = user?.id;
    if (uid) {
      await supabase.from('project_members').delete().eq('owner_id', uid);
      await supabase.from('productivity').delete().eq('user_id', uid);
      await supabase.from('tasks').delete().eq('user_id', uid);
      await supabase.from('vertical_elements').delete().eq('user_id', uid);
      await supabase.from('slabs').delete().eq('user_id', uid);
      await supabase.from('teams').delete().eq('user_id', uid);
      await supabase.from('floors').delete().eq('user_id', uid);
      await supabase.from('blocks').delete().eq('user_id', uid);
    }
    await signOut();
    setLoading(false);
  };

  const getRoleInfo = (role: string) => ROLES.find(r => r.value === role) || ROLES[3];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-[#001F3F]">Paramètres du Compte</h2>
        <p className="text-gray-500 text-sm sm:text-base">Gérez votre profil, équipe et sécurité.</p>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
            message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span className="text-sm font-medium">{message.text}</span>
        </motion.div>
      )}

      {/* Profil */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
          <div className="p-2 bg-[#001F3F] text-white rounded-xl"><User size={20} /></div>
          <div>
            <h3 className="font-bold text-[#001F3F]">Informations du Profil</h3>
            <p className="text-xs text-gray-400">Modifiez votre nom et vos informations</p>
          </div>
        </div>
        <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nom complet</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="Votre nom" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600">{email}</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Vérifié</span>
            </div>
          </div>
          <button type="submit" disabled={loading} className="bg-[#FF851B] hover:bg-[#E76A00] text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-60 text-sm">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Enregistrer
          </button>
        </form>
      </div>

      {/* Équipe du Projet */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
          <div className="p-2 bg-[#FF851B] text-white rounded-xl"><Users size={20} /></div>
          <div>
            <h3 className="font-bold text-[#001F3F]">Équipe du Projet</h3>
            <p className="text-xs text-gray-400">Invitez des personnes et définissez leurs rôles</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* Invite form */}
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="Email du collaborateur"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none text-sm"
              />
            </div>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none text-sm font-medium"
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button
              type="submit"
              disabled={inviteLoading}
              className="bg-[#001F3F] hover:bg-[#003366] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60 text-sm shrink-0"
            >
              {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              Inviter
            </button>
          </form>

          {/* Roles legend */}
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(r => (
              <div key={r.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${r.color}`}>
                <r.icon size={14} />
                <div>
                  <span className="font-bold">{r.label}</span>
                  <span className="ml-1 opacity-70">— {r.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Members list */}
          <div className="space-y-2">
            {/* Owner (self) */}
            <div className="flex items-center justify-between p-3 bg-[#FF851B]/5 rounded-xl border border-[#FF851B]/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#FF851B]/20 border-2 border-[#FF851B] flex items-center justify-center">
                  <span className="text-xs font-bold text-[#FF851B]">{(user?.user_metadata?.full_name || user?.email || 'U').slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#001F3F]">{user?.user_metadata?.full_name || 'Vous'}</p>
                  <p className="text-xs text-gray-400">{user?.email}</p>
                </div>
              </div>
              <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full flex items-center gap-1">
                <Crown size={12} />
                Chef de Projet
              </span>
            </div>

            {/* Invited members */}
            {members.map(m => {
              const roleInfo = getRoleInfo(m.role);
              return (
                <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-500">{m.member_email.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#001F3F]">{m.member_email}</p>
                      <p className="text-xs text-gray-400">
                        {m.status === 'pending' ? '⏳ En attente' : '✅ Accepté'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m.id, e.target.value)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border outline-none ${roleInfo.color}`}
                    >
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                      title="Retirer du projet"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {members.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Aucun membre invité. Utilisez le formulaire ci-dessus pour ajouter des collaborateurs.</p>
            )}
          </div>
        </div>
      </div>

      {/* Sécurité */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
          <div className="p-2 bg-indigo-600 text-white rounded-xl"><Lock size={20} /></div>
          <div>
            <h3 className="font-bold text-[#001F3F]">Sécurité</h3>
            <p className="text-xs text-gray-400">Modifiez votre mot de passe</p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nouveau mot de passe</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="••••••••" minLength={6} required />
            <p className="text-xs text-gray-400 mt-1">Minimum 6 caractères</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Confirmer le mot de passe</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="••••••••" minLength={6} required />
          </div>
          <button type="submit" disabled={loading} className="bg-[#001F3F] hover:bg-[#003366] text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-60 text-sm">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            Changer le mot de passe
          </button>
        </form>
      </div>

      {/* Supprimer le compte */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
        <div className="p-5 border-b border-red-100 flex items-center gap-3 bg-red-50/50">
          <div className="p-2 bg-red-500 text-white rounded-xl"><Trash2 size={20} /></div>
          <div>
            <h3 className="font-bold text-red-700">Zone Dangereuse</h3>
            <p className="text-xs text-red-400">Supprimer votre compte et toutes vos données</p>
          </div>
        </div>
        <div className="p-6">
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Cette action est <strong>irréversible</strong>.</p>
              <button onClick={() => setShowDeleteConfirm(true)} className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 text-sm shrink-0">
                <Trash2 size={16} /> Supprimer
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 font-medium">⚠️ Tapez <strong>SUPPRIMER</strong> pour confirmer.</p>
              </div>
              <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" placeholder="Tapez SUPPRIMER" />
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} className="flex-1 px-6 py-2.5 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors text-sm">Annuler</button>
                <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'SUPPRIMER' || loading} className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 text-sm">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Confirmer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
