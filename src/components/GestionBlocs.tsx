import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Search, Filter } from 'lucide-react';
import { Block } from '../types';
import { ZONES, cn } from '../utils';
import { motion } from 'motion/react';
import { fetchBlocks as loadBlocks, createBlock, updateBlock, deleteBlock as removeBlock } from '../lib/supabaseService';

export default function GestionBlocs() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [formData, setFormData] = useState({ name: '', zone: ZONES[0], description: '' });

  useEffect(() => {
    fetchBlocks();
  }, []);

  const fetchBlocks = async () => {
    const data = await loadBlocks();
    setBlocks(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBlock) {
      await updateBlock(editingBlock.id, formData);
    } else {
      await createBlock(formData);
    }
    await fetchBlocks();
    closeModal();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce bloc ?')) {
      await removeBlock(id);
      await fetchBlocks();
    }
  };

  const openModal = (block?: Block) => {
    if (block) {
      setEditingBlock(block);
      setFormData({ name: block.name, zone: block.zone, description: block.description });
    } else {
      setEditingBlock(null);
      setFormData({ name: '', zone: ZONES[0], description: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBlock(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#001F3F]">Gestion des Blocs</h2>
          <p className="text-gray-500 text-sm sm:text-base">Configurez les structures principales de votre chantier.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-[#FF851B] hover:bg-[#E76A00] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 self-start sm:self-auto text-sm sm:text-base"
        >
          <Plus size={18} />
          Ajouter un Bloc
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un bloc..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF851B] focus:border-transparent"
            />
          </div>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <Filter size={20} />
          </button>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-bold">
              <th className="px-6 py-4">Nom du Bloc</th>
              <th className="px-6 py-4">Zone</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {blocks.map((block) => (
              <tr key={block.id} className="hover:bg-gray-50/80 transition-colors group">
                <td className="px-6 py-4 font-bold text-[#001F3F]">{block.name}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold",
                    block.zone === "Zone Logement" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                  )}>
                    {block.zone}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 text-sm italic">{block.description}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openModal(block)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(block.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="bg-[#001F3F] p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingBlock ? 'Modifier le Bloc' : 'Ajouter un Bloc'}</h3>
              <button onClick={closeModal} className="hover:bg-white/10 p-1 rounded transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nom du Bloc</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none"
                  placeholder="Ex: Bloc A"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Zone</label>
                <select 
                  value={formData.zone}
                  onChange={e => setFormData({ ...formData, zone: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none"
                >
                  {ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none h-24 resize-none"
                  placeholder="Détails du bâtiment..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-[#FF851B] hover:bg-[#E76A00] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {editingBlock ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
