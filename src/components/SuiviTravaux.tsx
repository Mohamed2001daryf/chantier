import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, CheckCircle2, Circle, Loader2, Edit3, X, Users } from 'lucide-react';
import { Block, Floor, VerticalElement, Team, Task } from '../types';
import { ELEMENT_TYPES, STATUS_OPTIONS, cn } from '../utils';
import { motion } from 'motion/react';
import { fetchVerticalElements as loadElements, fetchBlocks as loadBlocks, fetchFloors as loadFloors, fetchTeams as loadTeams, fetchTasks as loadTasks, createVerticalElement, deleteVerticalElement, updateVerticalElementStatus } from '../lib/supabaseService';

export default function SuiviTravaux() {
  const [elements, setElements] = useState<VerticalElement[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    block_id: '', 
    floor_id: '', 
    type: ELEMENT_TYPES[0], 
    name: '', 
    axes: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0]
  });
  const [filterBlock, setFilterBlock] = useState('');
  const [filterTeam, setFilterTeam] = useState('');

  useEffect(() => {
    fetchElements();
    fetchBlocks();
    fetchFloors();
    fetchTeams();
    fetchTasks();
  }, []);

  const fetchElements = async () => { setElements(await loadElements()); };
  const fetchBlocks = async () => { setBlocks(await loadBlocks()); };
  const fetchFloors = async () => { setFloors(await loadFloors()); };
  const fetchTeams = async () => { setTeams(await loadTeams()); };
  const fetchTasks = async () => { setTasks(await loadTasks()); };

  const handleDelete = async (id: number) => {
    if (confirm('Voulez-vous vraiment supprimer cet élément ? Cela supprimera également la tâche de planning associée.')) {
      await deleteVerticalElement(id);
      await fetchElements();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createVerticalElement({
      ...formData,
      block_id: parseInt(formData.block_id),
      floor_id: parseInt(formData.floor_id)
    });
    await fetchElements();
    setIsModalOpen(false);
  };

  const updateStatus = async (id: number, field: string, currentStatus: string) => {
    const nextStatus = STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(currentStatus) + 1) % STATUS_OPTIONS.length];
    await updateVerticalElementStatus(id, field, nextStatus);
    await fetchElements();
  };

  // Build a map of element_id -> team_name from tasks
  const elementTeamMap = new Map<number, string>();
  tasks.forEach(t => {
    if (t.element_id && t.team_name) {
      elementTeamMap.set(t.element_id, t.team_name);
    }
  });

  // Build set of element IDs that belong to selected team
  const teamElementIds = filterTeam 
    ? new Set(tasks.filter(t => t.team_id === parseInt(filterTeam) && t.element_id).map(t => t.element_id!))
    : null;

  let filteredElements = elements;
  if (filterBlock) {
    filteredElements = filteredElements.filter(e => e.block_id === parseInt(filterBlock));
  }
  if (teamElementIds) {
    filteredElements = filteredElements.filter(e => teamElementIds.has(e.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#001F3F]">Suivi des Éléments Verticaux</h2>
          <p className="text-gray-500 text-sm sm:text-base">Suivez l'avancement du ferraillage, coffrage et coulage.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#FF851B] hover:bg-[#E76A00] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 self-start sm:self-auto text-sm sm:text-base"
        >
          <Plus size={18} />
          Ajouter Élément
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Rechercher un élément..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#FF851B]" />
        </div>
        <select 
          value={filterBlock}
          onChange={e => setFilterBlock(e.target.value)}
          className="px-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#FF851B] min-w-[150px]"
        >
          <option value="">Tous les blocs</option>
          {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select 
          value={filterTeam}
          onChange={e => setFilterTeam(e.target.value)}
          className="px-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#FF851B] min-w-[150px]"
        >
          <option value="">Toutes les équipes</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredElements.map((el) => (
          <div key={el.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-[#FF851B]/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#001F3F] text-white flex items-center justify-center font-bold shadow-md">
                {el.type[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-[#001F3F] text-lg">{el.name}</h4>
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded uppercase tracking-tighter">{el.axes}</span>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  {el.block_name} • <span className="text-[#FF851B]">{el.floor_name}</span> • {el.type}
                  {elementTeamMap.has(el.id) && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-[#001F3F] bg-blue-50 px-2 py-0.5 rounded-lg">
                      <Users size={10} />
                      {elementTeamMap.get(el.id)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex gap-2">
                <StatusBadge 
                  label="Ferraillage" 
                  status={el.ferraillage_status} 
                  onClick={() => updateStatus(el.id, 'ferraillage_status', el.ferraillage_status)} 
                />
                <StatusBadge 
                  label="Coffrage" 
                  status={el.coffrage_status} 
                  onClick={() => updateStatus(el.id, 'coffrage_status', el.coffrage_status)} 
                />
                <StatusBadge 
                  label="Coulage" 
                  status={el.coulage_status} 
                  onClick={() => updateStatus(el.id, 'coulage_status', el.coulage_status)} 
                />
              </div>
              <button 
                onClick={() => handleDelete(el.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                title="Supprimer l'élément"
              >
                <X size={20} />
              </button>
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
              <h3 className="text-xl font-bold">Ajouter Élément Vertical</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Nom de l'élément</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="Ex: Poteau P1" />
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
                <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                <select required value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none">
                  {ELEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Axes</label>
                <input type="text" value={formData.axes} onChange={e => setFormData({ ...formData, axes: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="Ex: A-3" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Date début</label>
                <input required type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Date fin</label>
                <input required type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" />
              </div>
              <div className="col-span-2 flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">Annuler</button>
                <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-[#FF851B] hover:bg-[#E76A00] shadow-lg transition-all active:scale-95">Créer</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ label, status, onClick }: { label: string, status: string, onClick: () => void }) {
  const getStatusStyles = () => {
    switch (status) {
      case 'Terminé': return 'bg-green-100 text-green-700 border-green-200';
      case 'En cours': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-400 border-gray-200';
    }
  };

  const Icon = status === 'Terminé' ? CheckCircle2 : status === 'En cours' ? Loader2 : Circle;

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95",
        getStatusStyles()
      )}
    >
      <Icon size={14} className={cn(status === 'En cours' && "animate-spin")} />
      <div className="flex flex-col items-start">
        <span className="opacity-60 text-[10px] uppercase tracking-wider">{label}</span>
        <span>{status}</span>
      </div>
    </button>
  );
}
