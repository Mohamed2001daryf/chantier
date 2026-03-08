import React, { useState, useEffect } from 'react';
import { Plus, Users, Briefcase, Box, Trash2, X, Save, Pencil } from 'lucide-react';
import { Block, Team } from '../types';
import { motion } from 'motion/react';

export default function Equipes() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({ name: '', speciality: '', block_id: '', workers: 0 });

  useEffect(() => {
    fetchTeams();
    fetchBlocks();
  }, []);

  const fetchTeams = () => fetch('/api/teams').then(res => res.json()).then(setTeams);
  const fetchBlocks = () => fetch('/api/blocks').then(res => res.json()).then(setBlocks);

  const resetForm = () => {
    setFormData({ name: '', speciality: '', block_id: '', workers: 0 });
    setSelectedTeam(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEditing = isEditModalOpen && selectedTeam;
    const url = isEditing ? `/api/teams/${selectedTeam.id}` : '/api/teams';
    const method = isEditing ? 'PUT' : 'POST';

    const payload = {
      name: formData.name,
      speciality: formData.speciality,
      block_id: formData.block_id ? parseInt(formData.block_id) : null,
      workers: formData.workers
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchTeams();
        setIsModalOpen(false);
        setIsEditModalOpen(false);
        resetForm();
      }
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
    }
  };

  const handleDelete = async () => {
    if (!selectedTeam) return;
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchTeams();
        setIsDeleteConfirmOpen(false);
        setSelectedTeam(null);
      }
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
    }
  };

  const openEditModal = (team: Team) => {
    setSelectedTeam(team);
    setFormData({
      name: team.name,
      speciality: team.speciality,
      block_id: team.block_id?.toString() || '',
      workers: team.workers
    });
    setIsEditModalOpen(true);
  };

  const SPECIALITIES = ["Ferraillage", "Coffrage", "Béton", "Post-Tension", "Maçonnerie", "Électricité", "Plomberie", "Second Œuvre"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#001F3F]">Gestion des Équipes</h2>
          <p className="text-gray-500 text-sm sm:text-base">Gérez les effectifs et les spécialités par bloc.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-[#FF851B] hover:bg-[#E76A00] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 self-start sm:self-auto text-sm sm:text-base"
        >
          <Plus size={18} />
          Ajouter une Équipe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div key={team.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:border-[#FF851B]/30 transition-all">
            <div className="p-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-[#001F3F]">
                  <Users size={24} />
                </div>
                <div>
                  <h4 className="font-black text-[#001F3F]">{team.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider">
                    <Briefcase size={12} />
                    {team.speciality}
                  </div>
                </div>
              </div>
              <div className="bg-[#FF851B]/10 text-[#FF851B] px-3 py-1 rounded-lg text-sm font-black">
                {team.workers} ouvriers
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-between border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                <Box size={14} />
                Affectation: <span className="text-[#001F3F]">{team.block_name || 'Non affecté'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(team)}
                  className="text-gray-400 hover:text-[#FF851B] transition-colors p-1"
                  title="Modifier"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => { setSelectedTeam(team); setIsDeleteConfirmOpen(true); }}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Ajouter / Modifier */}
      {(isModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="bg-[#001F3F] p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">{isEditModalOpen ? 'Modifier Équipe' : 'Ajouter une Équipe'}</h3>
              <button onClick={() => { setIsModalOpen(false); setIsEditModalOpen(false); resetForm(); }} className="hover:bg-white/10 p-1 rounded transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nom de l'équipe</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="Ex: Équipe Alpha" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Spécialité</label>
                <select required value={formData.speciality} onChange={e => setFormData({ ...formData, speciality: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none">
                  <option value="">Sélectionner</option>
                  {SPECIALITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Bloc Affecté</label>
                <select value={formData.block_id} onChange={e => setFormData({ ...formData, block_id: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none">
                  <option value="">Non affecté</option>
                  {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre d'ouvriers</label>
                <input required type="number" value={formData.workers} onChange={e => setFormData({ ...formData, workers: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setIsModalOpen(false); setIsEditModalOpen(false); resetForm(); }} className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">Annuler</button>
                <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-[#FF851B] hover:bg-[#E76A00] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Save size={20} />
                  {isEditModalOpen ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Confirmation suppression */}
      {isDeleteConfirmOpen && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} />
              </div>
              <h4 className="text-lg font-bold text-[#001F3F] mb-2">Supprimer l'équipe ?</h4>
              <p className="text-gray-500 text-sm mb-6">
                Voulez-vous vraiment supprimer <strong>{selectedTeam.name}</strong> ? Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setIsDeleteConfirmOpen(false); setSelectedTeam(null); }} className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">Annuler</button>
                <button onClick={handleDelete} className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-all active:scale-95">Supprimer</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
