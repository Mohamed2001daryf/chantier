import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, BarChart3, Users, Box, Save, X, ClipboardList, CheckSquare, Square } from 'lucide-react';
import { Block, Team, ProductivityRecord, Task } from '../types';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { fetchProductivity as loadRecords, fetchBlocks as loadBlocks, fetchTeams as loadTeams, fetchTasks as loadTasks, createProductivity } from '../lib/supabaseService';

export default function Productivite() {
  const [records, setRecords] = useState<ProductivityRecord[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [formData, setFormData] = useState({ 
    block_id: '', 
    team_id: '', 
    work_type: '', 
    workers_count: 0, 
    quantity_realized: 0, 
    date: format(new Date(), 'yyyy-MM-dd') 
  });

  useEffect(() => {
    fetchRecords();
    fetchBlocks();
    fetchTeams();
    fetchTasks();
  }, []);

  const fetchRecords = async () => { setRecords(await loadRecords()); };
  const fetchBlocks = async () => { setBlocks(await loadBlocks()); };
  const fetchTeams = async () => { setTeams(await loadTeams()); };
  const fetchTasks = async () => { setTasks(await loadTasks()); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const basePayload = {
      block_id: parseInt(formData.block_id),
      team_id: parseInt(formData.team_id),
      work_type: formData.work_type,
      workers_count: formData.workers_count,
      quantity_realized: formData.quantity_realized,
      date: formData.date
    };

    // Insert one productivity row per selected task (or one with no task if none selected)
    const taskIds = selectedTaskIds.length > 0 ? selectedTaskIds : [null];
    await Promise.all(
      taskIds.map(taskId =>
        createProductivity({ ...basePayload, task_id: taskId })
      )
    );
    await fetchRecords();
    setSelectedTaskIds([]);
    setIsModalOpen(false);
  };

  const chartData = records.map(r => ({
    name: `${r.team_name} (${r.work_type})`,
    productivity: r.workers_count > 0 ? (r.quantity_realized / r.workers_count).toFixed(2) : 0
  }));

  // Filter tasks by the block selected in the form
  const filteredTasksByBlock = formData.block_id
    ? tasks.filter(t => t.block_id?.toString() === formData.block_id)
    : tasks;

  const teamTasks = selectedTeamId 
    ? tasks.filter(t => t.team_id === parseInt(selectedTeamId))
    : [];

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Terminé': return 'bg-green-100 text-green-700';
      case 'En cours': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#001F3F]">Suivi de Productivité</h2>
          <p className="text-gray-500 text-sm sm:text-base">Analysez le rendement des équipes par type de travaux.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#FF851B] hover:bg-[#E76A00] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 self-start sm:self-auto text-sm sm:text-base"
        >
          <Plus size={18} />
          Saisir Productivité
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-[#001F3F] mb-6 flex items-center gap-2">
            <BarChart3 className="text-[#FF851B]" size={20} />
            Rendement par Équipe (Quantité / Ouvrier)
          </h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="productivity" name="Productivité" fill="#FF851B" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-[#001F3F] mb-6">Dernières Saisies</h3>
          <div className="space-y-4">
            {records.slice(-5).reverse().map((r) => (
              <div key={r.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-sm text-[#001F3F]">{r.team_name}</p>
                  <span className="text-[10px] font-black text-[#FF851B] uppercase">{r.work_type}</span>
                </div>
                {r.task_name && (
                  <p className="text-xs text-gray-500 mb-1">📋 {r.task_name}</p>
                )}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{r.workers_count} ouvriers</span>
                  <span className="font-bold text-[#001F3F]">{r.quantity_realized} réalisés</span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-[10px] text-gray-400">{r.date}</span>
                  <span className="text-xs font-black text-green-600">Prod: {(r.quantity_realized / r.workers_count).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Tasks Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#001F3F] flex items-center gap-2">
            <ClipboardList className="text-[#FF851B]" size={20} />
            Tâches par Équipe
          </h3>
          <select
            value={selectedTeamId}
            onChange={e => setSelectedTeamId(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#FF851B] min-w-[200px] font-medium"
          >
            <option value="">Sélectionner une équipe</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {!selectedTeamId ? (
          <p className="text-gray-400 text-center py-8">Sélectionnez une équipe pour voir ses tâches assignées.</p>
        ) : teamTasks.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Aucune tâche assignée à cette équipe.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamTasks.map(task => (
              <div key={task.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-[#FF851B]/30 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-sm text-[#001F3F]">{task.element}</p>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{task.block_name || 'Général'} • {task.floor_name || 'N/A'}</p>
                {task.element_type && (
                  <span className="text-[10px] font-bold text-[#FF851B] bg-[#FF851B]/10 px-2 py-0.5 rounded">{task.element_type}</span>
                )}
                <div className="mt-2 pt-2 border-t border-gray-200 text-[10px] text-gray-400">
                  {task.start_date} → {task.end_date}
                </div>
              </div>
            ))}
          </div>
        )}
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
              <h3 className="text-xl font-bold">Saisir Productivité</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Bloc</label>
                  <select required value={formData.block_id} onChange={e => { setFormData({ ...formData, block_id: e.target.value }); setSelectedTaskIds([]); }} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none">
                    <option value="">Sélectionner</option>
                    {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Équipe</label>
                  <select required value={formData.team_id} onChange={e => setFormData({ ...formData, team_id: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none">
                    <option value="">Sélectionner</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                    Tâches réalisées
                    {selectedTaskIds.length > 0 && (
                      <span className="text-[10px] font-black text-white bg-[#FF851B] px-1.5 py-0.5 rounded-md">{selectedTaskIds.length}</span>
                    )}
                  </label>
                  {filteredTasksByBlock.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedTaskIds.length === filteredTasksByBlock.length) {
                          setSelectedTaskIds([]);
                        } else {
                          setSelectedTaskIds(filteredTasksByBlock.map(t => t.id));
                        }
                      }}
                      className="text-[11px] font-bold text-[#FF851B] hover:underline"
                    >
                      {selectedTaskIds.length === filteredTasksByBlock.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                  )}
                </div>
                <div className="border border-gray-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-100">
                  {filteredTasksByBlock.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">
                      {formData.block_id ? 'Aucune tâche trouvée pour ce bloc.' : 'Sélectionnez un bloc pour voir les tâches.'}
                    </p>
                  ) : (
                    filteredTasksByBlock.map(t => {
                      const isChecked = selectedTaskIds.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-gray-50 ${
                            isChecked ? 'bg-orange-50/60' : ''
                          }`}
                        >
                          <span className="shrink-0">
                            {isChecked
                              ? <CheckSquare size={18} className="text-[#FF851B]" />
                              : <Square size={18} className="text-gray-300" />
                            }
                          </span>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedTaskIds(prev =>
                                isChecked ? prev.filter(id => id !== t.id) : [...prev, t.id]
                              );
                            }}
                          />
                          <span className="text-sm text-[#001F3F] truncate">
                            {t.element_type ? <span className="font-bold">{t.element_type}</span> : null}
                            {t.element_type ? ' — ' : ''}
                            {t.element}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Type de Travail</label>
                <input required type="text" value={formData.work_type} onChange={e => setFormData({ ...formData, work_type: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="Ex: Coffrage Voiles (m²)" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nb Ouvriers</label>
                  <input required type="number" value={formData.workers_count} onChange={e => setFormData({ ...formData, workers_count: parseInt(e.target.value) })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Quantité Réalisée</label>
                  <input required type="number" step="0.01" value={formData.quantity_realized} onChange={e => setFormData({ ...formData, quantity_realized: parseFloat(e.target.value) })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                <input required type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">Annuler</button>
                <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-[#FF851B] hover:bg-[#E76A00] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Save size={20} />
                  Enregistrer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
