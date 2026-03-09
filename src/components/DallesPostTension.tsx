import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, CheckCircle2, Circle, Loader2, X, Save, Layers, Trash2, Pencil } from 'lucide-react';
import { Block, Floor, Slab } from '../types';
import { STATUS_OPTIONS, cn } from '../utils';
import { motion } from 'motion/react';
import { fetchSlabs as loadSlabs, fetchBlocks as loadBlocks, fetchFloors as loadFloors, createSlab, updateSlabStatus, deleteSlab, updateSlab } from '../lib/supabaseService';

export default function DallesPostTension() {
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSlabId, setEditingSlabId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ 
    block_id: '', 
    floor_id: '', 
    name: '', 
    axes: '', 
    surface: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchSlabs();
    fetchBlocks();
    fetchFloors();
  }, []);

  const fetchSlabs = async () => { setSlabs(await loadSlabs()); };
  const fetchBlocks = async () => { setBlocks(await loadBlocks()); };
  const fetchFloors = async () => { setFloors(await loadFloors()); };

  const resetForm = () => {
    setFormData({ 
      block_id: '', floor_id: '', name: '', axes: '', surface: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0]
    });
    setIsEditMode(false);
    setEditingSlabId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode && editingSlabId) {
      await updateSlab(editingSlabId, {
        ...formData,
        block_id: parseInt(formData.block_id),
        floor_id: parseInt(formData.floor_id),
        surface: parseFloat(formData.surface)
      });
    } else {
      await createSlab({
        ...formData,
        block_id: parseInt(formData.block_id),
        floor_id: parseInt(formData.floor_id),
        surface: parseFloat(formData.surface)
      });
    }
    await fetchSlabs();
    setIsModalOpen(false);
    resetForm();
  };

  const handleEdit = (slab: Slab) => {
    setFormData({
      block_id: slab.block_id?.toString() || '',
      floor_id: slab.floor_id?.toString() || '',
      name: slab.name || '',
      axes: slab.axes || '',
      surface: slab.surface?.toString() || '',
      start_date: slab.start_date || new Date().toISOString().split('T')[0],
      end_date: slab.end_date || new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0]
    });
    setEditingSlabId(slab.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Voulez-vous vraiment supprimer cette dalle ? Cela supprimera également la tâche de planning associée.')) {
      await deleteSlab(id);
      await fetchSlabs();
    }
  };

  const updateStatus = async (id: number, field: string, currentStatus: string) => {
    const nextStatus = STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(currentStatus) + 1) % STATUS_OPTIONS.length];
    await updateSlabStatus(id, field, nextStatus);
    await fetchSlabs();
  };

  const STAGES = [
    { key: 'coffrage_status', label: 'Coffrage' },
    { key: 'ferraillage_inf_status', label: 'Ferr. Inf.' },
    { key: 'pose_gaine_status', label: 'Gaines' },
    { key: 'pose_cable_status', label: 'Câbles' },
    { key: 'renforcement_status', label: 'Renfort' },
    { key: 'coulage_status', label: 'Coulage' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#001F3F]">Dalles Post-Tension</h2>
          <p className="text-gray-500 text-sm sm:text-base">Suivi des étapes spécifiques aux dalles PT.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-[#FF851B] hover:bg-[#E76A00] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 self-start sm:self-auto text-sm sm:text-base"
        >
          <Plus size={18} />
          Ajouter une Dalle
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Rechercher une dalle..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#FF851B]" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {slabs.filter(slab => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return (
            slab.name?.toLowerCase().includes(q) ||
            slab.axes?.toLowerCase().includes(q) ||
            slab.block_name?.toLowerCase().includes(q) ||
            slab.floor_name?.toLowerCase().includes(q)
          );
        }).map((slab) => (
          <div key={slab.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:border-[#FF851B]/30 transition-all">
            <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FF851B] text-white flex items-center justify-center font-bold shadow-md">
                  <Layers size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-[#001F3F] text-lg">{slab.name}</h4>
                    <span className="text-xs font-mono text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100 uppercase tracking-tighter">{slab.axes}</span>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    {slab.block_name} • <span className="text-[#FF851B]">{slab.floor_name}</span> • {slab.surface} m²
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-2">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Avancement</p>
                  <p className="text-lg font-black text-[#001F3F]">
                    {Math.round((STAGES.filter(s => (slab as any)[s.key] === 'Terminé').length / STAGES.length) * 100)}%
                  </p>
                </div>
                <button 
                  onClick={() => handleEdit(slab)}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"
                  title="Modifier la dalle"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(slab.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  title="Supprimer la dalle"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {STAGES.map((stage) => (
                <StatusBadge 
                  key={stage.key}
                  label={stage.label} 
                  status={(slab as any)[stage.key]} 
                  onClick={() => updateStatus(slab.id, stage.key, (slab as any)[stage.key])} 
                />
              ))}
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
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="bg-[#001F3F] p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">{isEditMode ? 'Modifier la Dalle' : 'Ajouter une Dalle'}</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="hover:bg-white/10 p-1 rounded transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Nom de la dalle</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="Ex: Dalle D1" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Bloc</label>
                <select required value={formData.block_id} onChange={e => setFormData({ ...formData, block_id: e.target.value, floor_id: '' })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none">
                  <option value="">Sélectionner</option>
                  {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Étage</label>
                <select required value={formData.floor_id} onChange={e => setFormData({ ...formData, floor_id: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none">
                  <option value="">Sélectionner</option>
                  {floors.filter(f => f.block_id === parseInt(formData.block_id)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Surface (m²)</label>
                <input required type="number" step="0.01" value={formData.surface} onChange={e => setFormData({ ...formData, surface: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="Ex: 450.5" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Axes</label>
                <input type="text" value={formData.axes} onChange={e => setFormData({ ...formData, axes: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="Ex: A-3 / B-4" />
              </div>
              {!isEditMode && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Date début</label>
                    <input required type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Date fin</label>
                    <input required type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" />
                  </div>
                </>
              )}
              <div className="col-span-2 flex gap-3 pt-4">
                <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">Annuler</button>
                <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-[#FF851B] hover:bg-[#E76A00] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Save size={20} />
                  {isEditMode ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ label, status, onClick }: { label: string, status: string, onClick: () => void, key?: string }) {
  const getStatusStyles = () => {
    switch (status) {
      case 'Terminé': return 'bg-green-100 text-green-700 border-green-200';
      case 'En cours': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-400 border-gray-100';
    }
  };

  const Icon = status === 'Terminé' ? CheckCircle2 : status === 'En cours' ? Loader2 : Circle;

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 gap-1",
        getStatusStyles()
      )}
    >
      <Icon size={18} className={cn(status === 'En cours' && "animate-spin")} />
      <span className="text-[10px] font-black uppercase tracking-tighter text-center leading-tight">{label}</span>
      <span className="text-[9px] opacity-70 font-bold">{status}</span>
    </button>
  );
}
