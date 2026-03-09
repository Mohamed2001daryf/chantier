import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  Users, AlertTriangle, CheckCircle2, Clock, TrendingUp, Layers, Box, 
  Building2, Layout, Activity, Calendar, UserCheck, Timer, ChevronDown, ChevronRight
} from 'lucide-react';
import { DashboardStats } from '../types';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { supabase } from '../lib/supabase';
import { getActiveProjectOwnerId } from '../lib/supabaseService';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedElementBlock, setSelectedElementBlock] = useState<string>('all');
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());

  const toggleBlock = (blockId: number) => {
    setExpandedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blockId)) {
        newSet.delete(blockId);
      } else {
        newSet.add(blockId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const uid = await getActiveProjectOwnerId();
      if (!uid) return;

      const [
        { data: tasks },
        { data: blocks },
        { data: teams },
        { data: verticalElements },
        { data: slabs },
        { data: floors },
        { data: productivity }
      ] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', uid),
        supabase.from('blocks').select('*').eq('user_id', uid),
        supabase.from('teams').select('*, blocks(name)').eq('user_id', uid),
        supabase.from('vertical_elements').select('id, block_id, floor_id, type, coulage_status').eq('user_id', uid),
        supabase.from('slabs').select('id, block_id, floor_id, status').eq('user_id', uid),
        supabase.from('floors').select('id, name, order_number, block_id').eq('user_id', uid),
        supabase.from('productivity').select('*').eq('user_id', uid)
      ]);

      const allTasks = tasks || [];
      const allBlocks = blocks || [];
      const allTeams = teams || [];
      const allFloors = floors || [];
      const allElements = verticalElements || [];
      const allSlabs = slabs || [];
      const allProductivity = productivity || [];

      const today = new Date().toISOString().split('T')[0];

      // 1. KPIs
      const totalElements = allElements.length + allSlabs.length;
      const completedElements = 
        allElements.filter(e => e.coulage_status === 'Terminé' || e.coulage_status === 'termine').length + 
        allSlabs.filter(s => s.status === 'Terminé' || s.status === 'termine').length;
      
      const elementsInProgress = 
        allElements.filter(e => e.coulage_status === 'En cours' || e.coulage_status === 'en_cours').length + 
        allSlabs.filter(s => s.status === 'En cours' || s.status === 'en_cours').length;

      const globalProgress = totalElements > 0 ? (completedElements / totalElements) * 100 : 0;
      const delayedTasks = allTasks.filter(t => t.status !== 'Terminé' && t.end_date < today).length;

      const kpis = {
        globalProgress,
        elementsInProgress,
        delayedTasks,
        elementsCompleted: completedElements
      };

      // 2. Progress by Block
      const progressByBlock = allBlocks.map(b => {
        const blockElements = allElements.filter(e => e.block_id === b.id);
        const blockSlabs = allSlabs.filter(s => s.block_id === b.id);
        const total = blockElements.length + blockSlabs.length;
        const done = 
          blockElements.filter(e => e.coulage_status === 'Terminé' || e.coulage_status === 'termine').length +
          blockSlabs.filter(s => s.status === 'Terminé' || s.status === 'termine').length;
        const progress = total > 0 ? (done / total) * 100 : 0;

        const blockFloors = allFloors
          .filter(f => f.block_id === b.id)
          .sort((f1, f2) => (f1.order_number || 0) - (f2.order_number || 0))
          .map(f => {
            const floorElements = blockElements.filter(ve => ve.floor_id === f.id);
            const floorSlabs = blockSlabs.filter(s => s.floor_id === f.id);
            
            const typeMap = new Map<string, { done: number; total: number }>();
            floorElements.forEach(element => {
              if (!element.type) return;
              const type = element.type;
              const prev = typeMap.get(type) || { done: 0, total: 0 };
              prev.total += 1;
              if (element.coulage_status === 'Terminé' || element.coulage_status === 'termine') prev.done += 1;
              typeMap.set(type, prev);
            });

            if (floorSlabs.length > 0) {
              const type = 'Dalles';
              const prev = typeMap.get(type) || { done: 0, total: 0 };
              prev.total += floorSlabs.length;
              prev.done += floorSlabs.filter(s => s.status === 'Terminé' || s.status === 'termine').length;
              typeMap.set(type, prev);
            }

            const elementsList = Array.from(typeMap.entries()).map(([type, counts]) => ({
              type,
              done: counts.done,
              total: counts.total
            }));

            return {
              id: f.id,
              name: f.name,
              order_number: f.order_number || 0,
              elements: elementsList
            };
          });

        return { id: b.id, name: b.name, progress, floors: blockFloors };
      });

      // 3. Progress by Element Type
      const elementTypeMapAll = new Map<string, { done: number; total: number }>();
      const elementTypeMapByBlock = new Map<string, Map<string, { done: number; total: number }>>();

      const processType = (type: string, blockName: string, isDone: boolean) => {
        // Global
        const prevAll = elementTypeMapAll.get(type) || { done: 0, total: 0 };
        prevAll.total += 1;
        if (isDone) prevAll.done += 1;
        elementTypeMapAll.set(type, prevAll);
        
        // By Block
        if (!elementTypeMapByBlock.has(blockName)) {
          elementTypeMapByBlock.set(blockName, new Map());
        }
        const blockMap = elementTypeMapByBlock.get(blockName)!;
        const prevBlock = blockMap.get(type) || { done: 0, total: 0 };
        prevBlock.total += 1;
        if (isDone) prevBlock.done += 1;
        blockMap.set(type, prevBlock);
      };

      allElements.forEach(e => {
        if (!e.type) return;
        const blockName = allBlocks.find(b => b.id === e.block_id)?.name || 'Général';
        processType(e.type, blockName, e.coulage_status === 'Terminé' || e.coulage_status === 'termine');
      });

      allSlabs.forEach(s => {
        const blockName = allBlocks.find(b => b.id === s.block_id)?.name || 'Général';
        processType('Dalles', blockName, s.status === 'Terminé' || s.status === 'termine');
      });

      const buildProgressList = (map: Map<string, { done: number; total: number }>) => 
        Array.from(map.entries())
          .filter(([_, v]) => v.total > 0)
          .map(([type, v]) => ({ type, progress: (v.done / v.total) * 100 }));

      const byBlockObj: Record<string, { type: string; progress: number }[]> = {};
      Array.from(elementTypeMapByBlock.entries()).forEach(([blockName, blockMap]) => {
        byBlockObj[blockName] = buildProgressList(blockMap);
      });

      const progressByElementType = {
        all: buildProgressList(elementTypeMapAll),
        byBlock: byBlockObj
      };

      // 4. Delayed Tasks
      const delayedTasksList = allTasks
        .filter(t => t.status !== 'Terminé' && t.end_date < today)
        .map(t => {
          const block = allBlocks.find(b => b.id === t.block_id);
          const delayDays = Math.ceil((new Date().getTime() - new Date(t.end_date).getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: t.id,
            element: t.element || t.name || 'Tâche',
            block: block?.name || 'Général',
            delay: delayDays > 0 ? delayDays : 0
          };
        })
        .sort((a, b) => b.delay - a.delay); // Most critical first

      // 5. Team Productivity
      const todayDateObj = new Date();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(todayDateObj.getDate() - 7);
      
      const teamProductivity = allTeams.map(team => {
        const blockName = (team as any).blocks?.name || allBlocks.find(b => b.id === team.block_id)?.name || 'N/A';
        const teamProdRecords = allProductivity.filter(p => p.team_id === team.id && new Date(p.date) >= oneWeekAgo);
        
        let assigned = 0;
        let completed = 0;
        teamProdRecords.forEach(p => {
          assigned += (p.quantity_assigned || p.tasks_assigned || 0); // Handle varying column names if any
          completed += (p.quantity_realized || p.tasks_completed || 0);
        });

        // Fallback to tasks if no productivity records exist for the team
        if (assigned === 0 && completed === 0) {
          const teamTasks = allTasks.filter(t => t.team_id === team.id);
          assigned = teamTasks.length;
          completed = teamTasks.filter(t => t.status === 'Terminé').length;
        }

        return {
          block: blockName,
          team: team.name,
          workers: team.workers || 0,
          completed,
          assigned,
          progress: assigned > 0 ? (completed / assigned) * 100 : 0
        };
      }).filter(t => t.assigned > 0 || t.completed > 0);

      // 6. Progress By Floor
      const progressByFloor = allFloors.map(floor => {
        const floorBlockName = allBlocks.find(b => b.id === floor.block_id)?.name || 'Général';
        const floorVerticalElements = allElements.filter(e => e.floor_id === floor.id);
        const floorSlabs = allSlabs.filter(s => s.floor_id === floor.id);
        
        const typeMap = new Map<string, { done: number; total: number }>();
        
        floorVerticalElements.forEach(element => {
          if (!element.type) return;
          const type = element.type;
          const prev = typeMap.get(type) || { done: 0, total: 0 };
          prev.total += 1;
          if (element.coulage_status === 'Terminé' || element.coulage_status === 'termine') prev.done += 1;
          typeMap.set(type, prev);
        });

        if (floorSlabs.length > 0) {
          const type = 'Dalles';
          const prev = typeMap.get(type) || { done: 0, total: 0 };
          prev.total += floorSlabs.length;
          prev.done += floorSlabs.filter(s => s.status === 'Terminé' || s.status === 'termine').length;
          typeMap.set(type, prev);
        }

        const elementsProgress = Array.from(typeMap.entries()).map(([type, counts]) => ({
          type,
          progress: counts.total > 0 ? (counts.done / counts.total) * 100 : 0
        }));

        return {
          id: floor.id,
          blockName: floorBlockName,
          floorName: floor.name,
          order_number: floor.order_number || 0,
          elements: elementsProgress
        };
      }).filter(floor => floor.elements.length > 0)
      .sort((a, b) => a.order_number - b.order_number);

      // 7. Progress Over Time (Last 30 Days Cumulative)
      const progressOverTime = [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const finishedDates = allTasks
        .filter(t => t.status === 'Terminé' && t.end_date)
        .map(t => new Date(t.end_date).getTime());
        
      for (let i = 0; i <= 30; i++) {
        const d = new Date(thirtyDaysAgo);
        d.setDate(d.getDate() + i);
        const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        
        const completedCount = finishedDates.filter(time => time <= d.getTime()).length;
        const totalTasks = allTasks.filter(t => t.start_date && new Date(t.start_date).getTime() <= d.getTime()).length;
        // Fallback total to current totalTasks if we don't have enough start_date resolution
        const finalTotal = totalTasks > 0 ? totalTasks : allTasks.length;

        progressOverTime.push({
          date: dateStr,
          globalProgress: finalTotal > 0 ? (completedCount / finalTotal) * 100 : 0
        });
      }

      setStats({
        kpis,
        progressByBlock,
        progressByElementType,
        delayedTasksList,
        teamProductivity,
        progressByFloor,
        progressOverTime
      });
    } catch (error) {
      console.error('Erreur lors du chargement du dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#001F3F]"></div>
      <p className="text-gray-500 font-medium">Chargement des indicateurs en temps réel...</p>
    </div>
  );

  const COLORS = ['#001F3F', '#FF851B', '#3D9970', '#AAAAAA', '#FF4136'];
  const STATUS_COLORS: Record<string, string> = {
    'Terminé': '#3D9970',
    'En cours': '#FF851B',
    'Non commencé': '#AAAAAA'
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[#001F3F]">Tableau de bord</h2>
        <button 
          onClick={() => { setLoading(true); loadDashboardData(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Activity size={16} />
          Actualiser
        </button>
      </div>

      {/* SECTION 1 : KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Avancement Global" 
          value={`${Math.round(stats.kpis.globalProgress)}%`} 
          icon={TrendingUp} 
          color="bg-[#001F3F]" 
          progress={stats.kpis.globalProgress}
          subtitle="Éléments et dalles terminés"
        />
        <StatCard 
          title="Éléments en Cours" 
          value={stats.kpis.elementsInProgress.toString()} 
          icon={Timer} 
          color="bg-[#FF851B]" 
          subtitle="Coulage ou statut actif"
        />
        <StatCard 
          title="Tâches en Retard" 
          value={stats.kpis.delayedTasks.toString()} 
          icon={AlertTriangle} 
          color={stats.kpis.delayedTasks > 0 ? "bg-red-500" : "bg-[#3D9970]"} 
          subtitle={stats.kpis.delayedTasks > 0 ? "Nécessitent une attention" : "Aucun retard sur le planning"}
        />
        <StatCard 
          title="Total Terminés" 
          value={stats.kpis.elementsCompleted.toString()} 
          icon={CheckCircle2} 
          color="bg-[#3D9970]" 
          subtitle="Volume global validé"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 2 : PROGRESS BY BLOCK (ACCORDION) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold text-[#001F3F] mb-6 flex items-center gap-2">
            <Building2 className="text-[#FF851B]" size={20} />
            Avancement par Bloc
          </h3>
          <div className="space-y-4 flex-grow overflow-y-auto pr-2 max-h-[500px]">
            {stats.progressByBlock.map((block) => {
              const bProgress = Math.round(block.progress);
              return (
                <div key={block.id} className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                  <button 
                    onClick={() => toggleBlock(block.id)}
                    className="w-full flex items-center justify-between p-4 flex-wrap gap-2 transition-colors relative overflow-hidden group"
                  >
                    {/* Background Progress Bar for Block */}
                    <div 
                      className="absolute inset-0 bg-indigo-50/50 opacity-0 group-hover:opacity-100 transition-opacity" 
                      style={{ width: `${bProgress}%` }}
                    />
                    
                    <div className="flex items-center gap-3 relative z-10">
                      {expandedBlocks.has(block.id) ? <ChevronDown size={20} className="text-[#001F3F]" /> : <ChevronRight size={20} className="text-gray-400" />}
                      <span className="font-bold text-[#001F3F] text-left text-lg">📦 {block.name}</span>
                    </div>
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="flex flex-col items-end">
                        <span className={cn(
                          "text-sm font-bold",
                          bProgress === 100 ? "text-green-600" : bProgress > 0 ? "text-[#FF851B]" : "text-gray-400"
                        )}>
                          {bProgress}%
                        </span>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all duration-500", bProgress === 100 ? "bg-green-500" : "bg-[#FF851B]")} 
                            style={{ width: `${bProgress}%` }} 
                          />
                        </div>
                      </div>
                      {bProgress === 100 && <CheckCircle2 size={20} className="text-green-500" />}
                    </div>
                  </button>
                  
                  {expandedBlocks.has(block.id) && (
                    <div className="p-4 bg-gray-50/50 border-t border-gray-100 space-y-4">
                      {block.floors.map((floor, fIdx) => (
                        <div key={floor.id} className="relative pl-6">
                          {/* Tree line connector */}
                          <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200" style={{ height: fIdx === block.floors.length - 1 ? '16px' : '100%' }}></div>
                          <div className="absolute left-2 top-3 w-4 h-px bg-gray-200"></div>
                          
                          <h4 className="font-bold text-sm text-[#001F3F] mb-2">{floor.name}</h4>
                          <div className="pl-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {floor.elements.map((el, eIdx) => {
                              const isDone = el.total > 0 && el.done === el.total;
                              return (
                                <div key={eIdx} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-gray-100 shadow-sm">
                                  <span className="font-medium text-gray-700">{el.type}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "text-xs font-semibold px-2 py-0.5 rounded-full",
                                      isDone ? "bg-green-100 text-green-700" : el.done > 0 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"
                                    )}>
                                      {el.done}/{el.total}
                                    </span>
                                    {isDone && <CheckCircle2 size={14} className="text-green-500" />}
                                  </div>
                                </div>
                              );
                            })}
                            {floor.elements.length === 0 && (
                              <span className="text-xs text-gray-400 italic">Aucun élément</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {block.floors.length === 0 && (
                        <p className="text-sm text-gray-400 italic pl-6">Aucun étage défini pour ce bloc.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 3 : PROGRESS BY ELEMENT TYPE (BAR CHART) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-[#001F3F] flex items-center gap-2">
              <Layers className="text-[#FF851B]" size={20} />
              Avancement par Type
            </h3>
            <select
              value={selectedElementBlock}
              onChange={(e) => setSelectedElementBlock(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-[#001F3F] focus:outline-none focus:ring-2 focus:ring-[#FF851B]/50"
            >
              <option value="all">Tous les blocs</option>
              {stats.progressByBlock.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="h-[400px] w-full flex-grow">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={selectedElementBlock === 'all' 
                  ? stats.progressByElementType.all 
                  : (stats.progressByElementType.byBlock[selectedElementBlock] || [])}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="type" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4B5563', fontSize: 12, fontWeight: 500 }} width={100} />
                <Tooltip 
                  cursor={{ fill: '#F9FAFB' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const val = payload[0].value as number;
                      return (
                        <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100">
                          <p className="font-bold text-[#001F3F] mb-1">{payload[0].payload.type}</p>
                          <p className="text-[#FF851B] font-bold text-lg">{Math.round(val)}% terminé</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="progress" 
                  radius={[0, 4, 4, 0]} 
                  barSize={24}
                >
                  {(selectedElementBlock === 'all' ? stats.progressByElementType.all : (stats.progressByElementType.byBlock[selectedElementBlock] || [])).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={Math.round(entry.progress) === 100 ? '#3D9970' : '#FF851B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 4 : DELAYED / CRITICAL TASKS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold text-[#001F3F] mb-6 flex items-center gap-2">
            <Clock className="text-red-500" size={20} />
            Suivi des Retards (Top 10)
          </h3>
          <div className="overflow-x-auto flex-grow">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Élément / Tâche</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bloc</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Retard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.delayedTasksList.length > 0 ? (
                  stats.delayedTasksList.slice(0, 10).map((task, idx) => (
                    <tr key={task.id || idx} className="hover:bg-red-50/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-[#001F3F]">{task.element}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-md">{task.block}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {task.delay > 7 && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded uppercase tracking-wider">
                              Critique
                            </span>
                          )}
                          <span className="font-bold text-red-500">
                            {task.delay} jour{task.delay > 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-400 italic">
                      Aucun retard détecté sur le planning.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 5 : TEAM PRODUCTIVITY */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold text-[#001F3F] mb-6 flex items-center gap-2">
            <Users className="text-[#FF851B]" size={20} />
            Productivité des Équipes
          </h3>
          <div className="overflow-x-auto flex-grow">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-4 font-bold text-left text-xs text-gray-500 uppercase">Bloc</th>
                  <th className="px-6 py-4 font-bold text-left text-xs text-gray-500 uppercase">Équipe</th>
                  <th className="px-6 py-4 font-bold text-center text-xs text-gray-500 uppercase">Ouvriers</th>
                  <th className="px-6 py-4 font-bold text-center text-xs text-gray-500 uppercase">Tâches Term./Assig.</th>
                  <th className="px-6 py-4 font-bold text-left text-xs text-gray-500 uppercase">Productivité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.teamProductivity.map((team, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{team.block}</td>
                    <td className="px-6 py-4 text-sm font-bold text-[#001F3F]">{team.team}</td>
                    <td className="px-6 py-4 text-sm text-center">{team.workers}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="font-bold">{team.completed}</span>
                    <span className="text-gray-400"> / {team.assigned}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden max-w-[100px]">
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            team.productivity > 80 ? "bg-green-500" : team.productivity > 50 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${team.productivity}%` }}
                        />
                      </div>
                      <span className="text-sm font-black">{Math.round(team.productivity)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 5 : FLOOR PROGRESS (NEW CHARTS) */}
      {stats.progressByFloor.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-[#001F3F]">
            <Layers size={24} className="text-[#FF851B]" />
            Avancement par Étage
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.progressByFloor.map((floor, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
                <h3 className="text-lg font-bold text-center mb-4 text-[#001F3F]">{floor.floorName.toUpperCase()}</h3>
                <div className="flex-1 w-full h-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={floor.elements}
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                      <XAxis 
                        type="number" 
                        domain={[0, 100]} 
                        tickFormatter={(val) => `${val}%`}
                        tick={{fontSize: 12}}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="type" 
                        width={120} 
                        tick={{fontSize: 11, fill: '#4B5563'}}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`${Math.round(value)}%`, 'Avancement']}
                        cursor={{fill: '#F3F4F6'}}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar 
                        dataKey="progress" 
                        fill="#00B050" // A green matching the screenshot
                        radius={[0, 4, 4, 0]} 
                        barSize={12}
                        background={{ fill: '#F3F4F6', radius: [0, 4, 4, 0] }}
                      >
                        {floor.elements.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.progress > 0 ? '#00B050' : '#4FA0E0'} /> 
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, progress, subtitle }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h4 className="text-3xl font-black text-[#001F3F]">{value}</h4>
        </div>
        <div className={cn("p-3 rounded-xl text-white shadow-lg transition-transform group-hover:scale-110", color)}>
          <Icon size={24} />
        </div>
      </div>
      {progress !== undefined ? (
        <div className="space-y-2">
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-[#FF851B]"
            />
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Progression globale</p>
        </div>
      ) : (
        <p className="text-xs text-gray-400 font-medium">{subtitle || "Mis à jour en temps réel"}</p>
      )}
    </div>
  );
}
