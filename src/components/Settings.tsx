import React, { useState, useEffect } from 'react';
import { User, Lock, Trash2, Save, AlertTriangle, CheckCircle2, Loader2, Mail, Shield, Users, UserPlus, Crown, Eye, Calendar, Construction, X, Copy, Share2, MessageCircle, Link, Layers, Box, Plus } from 'lucide-react';
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
  const { user, role, signOut } = useAuth();
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
  const [shareModal, setShareModal] = useState<{ email: string; role: string } | null>(null);



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

  const getInviteMessage = (emailTo: string, roleName: string) => {
    const siteUrl = window.location.origin;
    const ownerName = user?.user_metadata?.full_name || user?.email || 'Le chef de projet';
    return `Bonjour !\n\n${ownerName} vous invite à rejoindre son projet sur ChantierPro (rôle: ${roleName}).\n\n1. Allez sur ${siteUrl}\n2. Créez un compte avec l'email : ${emailTo}\n3. Vous aurez automatiquement accès au projet\n\nCordialement, ChantierPro`;
  };

  const handleShareEmail = () => {
    if (!shareModal) return;
    const msg = getInviteMessage(shareModal.email, shareModal.role);
    const subject = encodeURIComponent('Invitation ChantierPro - Rejoignez le projet');
    const body = encodeURIComponent(msg);
    window.open(`mailto:${shareModal.email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleShareWhatsApp = () => {
    if (!shareModal) return;
    const msg = getInviteMessage(shareModal.email, shareModal.role);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCopyLink = () => {
    if (!shareModal) return;
    const msg = getInviteMessage(shareModal.email, shareModal.role);
    navigator.clipboard.writeText(msg);
    showMessage('success', '✅ Message copié !');
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      await inviteProjectMember(inviteEmail, inviteRole);
      const roleName = ROLES.find(r => r.value === inviteRole)?.label || inviteRole;
      setShareModal({ email: inviteEmail, role: roleName });
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
    <>
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
        <div className="p-6 space-y-6">
          {/* Invite form - only visible to admins */}
          {role === 'admin' ? (
            <div className="p-6 bg-gray-50 border-t border-gray-100 mt-4 rounded-b-2xl">
              <form onSubmit={handleInvite} className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="Email du collaborateur..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF851B] outline-none"
                  required
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none bg-white font-medium"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="bg-[#001F3F] hover:bg-[#003366] text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60 text-sm shrink-0"
                >
                  {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  Inviter
                </button>
              </form>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 text-center">
              Seuls les administrateurs peuvent inviter de nouveaux membres.
            </div>
          )}

          {/* Roles legend */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ROLES.map(r => (
              <div key={r.value} className={`flex items-center gap-3 p-3 rounded-xl border ${r.color}`}>
                <div className={`p-2 rounded-lg bg-white/50`}>
                  <r.icon size={18} />
                </div>
                <div>
                  <p className="font-bold text-sm">{r.label}</p>
                  <p className="text-[10px] opacity-80 uppercase tracking-wider">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Members list */}
          <div className="space-y-3">
            {/* Self */}
            <div className={`flex items-center justify-between p-3 rounded-xl border ${role === 'admin' ? 'bg-[#FF851B]/5 border-[#FF851B]/20' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${role === 'admin' ? 'bg-[#FF851B]/20 border-[#FF851B]' : 'bg-gray-200 border-gray-300'}`}>
                  <span className={`text-xs font-bold ${role === 'admin' ? 'text-[#FF851B]' : 'text-gray-500'}`}>{(user?.user_metadata?.full_name || user?.email || 'U').slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#001F3F]">{user?.user_metadata?.full_name || 'Vous'}</p>
                  <p className="text-xs text-gray-400">{user?.email}</p>
                </div>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${getRoleInfo(role).color}`}>
                {role === 'admin' ? <Crown size={12} /> : null}
                {role === 'admin' ? 'Chef de Projet / Admin' : getRoleInfo(role).label}
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
                    {role === 'admin' ? (
                      <>
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
                      </>
                    ) : (
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {members.length === 0 && (
              <div className="text-center p-8 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                <Users size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 font-medium">Aucun membre dans l'équipe</p>
                <p className="text-xs text-gray-400 mt-1">Invitez des collaborateurs pour commencer à travailler ensemble.</p>
              </div>
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
      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShareModal(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#001F3F] flex items-center gap-2">
                <Share2 size={20} className="text-[#FF851B]" />
                Partager l'invitation
              </h3>
              <button onClick={() => setShareModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-sm text-green-700">
                ✅ <strong>{shareModal.email}</strong> a été ajouté comme <strong>{shareModal.role}</strong>
              </p>
            </div>

            <p className="text-sm text-gray-500">Envoyez-lui l'invitation pour qu'il crée son compte :</p>

            <div className="space-y-2">
              <button
                onClick={handleShareWhatsApp}
                className="w-full flex items-center gap-3 px-4 py-3 bg-[#25D366] hover:bg-[#1DA855] text-white rounded-xl font-bold transition-all active:scale-[0.98]"
              >
                <MessageCircle size={20} />
                Envoyer via WhatsApp
              </button>

              <button
                onClick={handleShareEmail}
                className="w-full flex items-center gap-3 px-4 py-3 bg-[#001F3F] hover:bg-[#003366] text-white rounded-xl font-bold transition-all active:scale-[0.98]"
              >
                <Mail size={20} />
                Envoyer par Email
              </button>

              <button
                onClick={() => { handleCopyLink(); setShareModal(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all active:scale-[0.98]"
              >
                <Copy size={20} />
                Copier le message
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
    </>
  );
}
