import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowUpDown, Layers, X, Save } from 'lucide-react';
import { Block, Floor } from '../types';
import { motion } from 'motion/react';
import { fetchBlocks as loadBlocks, fetchFloors as loadFloors, createFloor, deleteFloor as removeFloor } from '../lib/supabaseService';
import { useAuth } from '../auth/AuthProvider';

export default function GestionEtages() {
  const { role } = useAuth();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ block_id: '', name: '', order_number: 0, surface_totale_dalle: 0 });

  useEffect(() => {
    fetchBlocks();
    fetchFloors();
  }, []);

  const fetchBlocks = async () => { setBlocks(await loadBlocks()); };
  const fetchFloors = async () => { setFloors(await loadFloors()); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createFloor({ ...formData, block_id: parseInt(formData.block_id), surface_totale_dalle: Number(formData.surface_totale_dalle) || 0 } as any);
    await fetchFloors();
    setIsModalOpen(false);
    setFormData({ block_id: '', name: '', order_number: 0, surface_totale_dalle: 0 });
  };

  const handleDelete = async (id: number) => {
    if (confirm('Supprimer cet étage ?')) {
      await removeFloor(id);
      await fetchFloors();
    }
  };

  // Group floors by block
  const groupedFloors: Record<string, Floor[]> = floors.reduce((acc, floor) => {
    const blockName = floor.block_name || 'Inconnu';
    if (!acc[blockName]) acc[blockName] = [];
    acc[blockName].push(floor);
    return acc;
  }, {} as Record<string, Floor[]>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#001F3F]">Gestion des Étages</h2>
          <p className="text-gray-500 text-sm sm:text-base">Définissez la structure verticale de chaque bloc.</p>
        </div>
        {role !== 'viewer' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#FF851B] hover:bg-[#E76A00] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 self-start sm:self-auto text-sm sm:text-base"
          >
            <Plus size={18} />
            Ajouter un Étage
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.entries(groupedFloors).map(([blockName, blockFloors]) => (
          <div key={blockName} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="bg-[#001F3F] p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-[#FF851B]" />
                <h3 className="font-bold">{blockName}</h3>
              </div>
              <span className="text-xs bg-white/10 px-2 py-1 rounded font-mono">{blockFloors.length} niveaux</span>
            </div>
            <div className="p-2 flex-1">
              <div className="space-y-1">
                {blockFloors.sort((a, b) => b.order_number - a.order_number).map((floor) => (
                  <div key={floor.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                        {floor.order_number > 0 ? `+${floor.order_number}` : floor.order_number}
                      </div>
                      <span className="font-bold text-[#001F3F]">{floor.name} {floor.surface_totale_dalle ? `— ${floor.surface_totale_dalle} m²` : ''}</span>
                    </div>
                    {role !== 'viewer' && (
                      <button 
                        onClick={() => handleDelete(floor.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
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
              <h3 className="text-xl font-bold">Ajouter un Étage</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Bloc</label>
                <select 
                  required
                  value={formData.block_id}
                  onChange={e => setFormData({ ...formData, block_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none"
                >
                  <option value="">Sélectionner un bloc</option>
                  {blocks.map(block => <option key={block.id} value={block.id}>{block.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nom de l'étage</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none"
                  placeholder="Ex: R+1, Sous-sol, Toiture..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Ordre (Niveau)</label>
                <div className="flex items-center gap-4">
                  <input 
                    required
                    type="number" 
                    value={formData.order_number}
                    onChange={e => setFormData({ ...formData, order_number: parseInt(e.target.value) })}
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none"
                  />
                  <p className="text-xs text-gray-400 italic max-w-[150px]">Utilisé pour le tri vertical (ex: -1 pour sous-sol, 0 pour RDC)</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Surface totale dalle (m²) <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={formData.surface_totale_dalle || ''}
                  onChange={e => setFormData({ ...formData, surface_totale_dalle: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none"
                  placeholder="Ex: 850"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-[#FF851B] hover:bg-[#E76A00] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  Créer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
