import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  Users, AlertTriangle, CheckCircle2, Clock, TrendingUp, Layers,
  Activity, Timer, Building2
} from 'lucide-react';
import { parseISO } from 'date-fns';
import { DashboardStats } from '../types';
import { supabase } from '../lib/supabase';
import { getActiveProjectOwnerId } from '../lib/supabaseService';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedElementBlock, setSelectedElementBlock] = useState<string>('all');

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      loadDashboardData();
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const ownerId = await getActiveProjectOwnerId();
      if (!ownerId) return;

      const [
        { data: blocksData },
        { data: floorsData },
        { data: verticalElementsData },
        { data: slabsData },
        { data: tasksData },
        { data: teamsData },
        { data: productivityData }
      ] = await Promise.all([
        supabase.from('blocks').select('*').eq('user_id', ownerId),
        supabase.from('floors').select('*').eq('user_id', ownerId),
        supabase.from('vertical_elements').select('*').eq('user_id', ownerId),
        supabase.from('slabs').select('*').eq('user_id', ownerId),
        supabase.from('tasks').select('*').eq('user_id', ownerId),
        supabase.from('teams').select('*').eq('user_id', ownerId),
        supabase.from('productivity').select('*').eq('user_id', ownerId)
      ]);

      const blocks = blocksData || [];
      const floors = floorsData || [];
      const verticalElements = verticalElementsData || [];
      const slabs = slabsData || [];
      const tasks = tasksData || [];
      const teams = teamsData || [];
      const productivity = productivityData || [];

      // Normalisation des types (OBLIGATOIRE)
      const normalizeType = (type?: string) => {
        const t = type?.trim().toLowerCase();
        if (t === 'poteau') return 'Poteaux';
        if (t === 'voile') return 'Voiles';
        if (t === 'dalle') return 'Dalles';
        return type?.trim() || 'Inconnu';
      };

      const allElements = [
        ...verticalElements.map(e => ({ ...e, normalizedType: normalizeType(e.type), unifiedStatus: e.coulage_status })),
        ...slabs.map(s => ({ ...s, normalizedType: 'Dalles', unifiedStatus: s.status }))
      ];

      // Effectuer les calculs mixtes (Unités pour verticaux, Surface pour dalles)
      let totalWeight = 0;
      let completedWeight = 0;
      let elementsInProgressCount = 0;
      let terminatedElementsCount = 0;

      allElements.forEach(e => {
        const isCompleted = e.unifiedStatus === 'termine' || e.unifiedStatus === 'Terminé';
        const isInProgress = e.unifiedStatus === 'en_cours' || e.unifiedStatus === 'En cours';

        if (isCompleted) terminatedElementsCount++;
        if (isInProgress) elementsInProgressCount++;

        if (e.normalizedType === 'Dalles') {
          const s = e as any;
          const totalS = parseFloat(s.surface) || 0;
          const couleeS = parseFloat(s.surface_coulee) || 0;
          totalWeight += totalS;
          completedWeight += (isCompleted ? totalS : couleeS);
        } else {
          totalWeight += 1;
          completedWeight += isCompleted ? 1 : 0;
        }
      });

      const globalProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

      // Calcul retards
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const delayedTasksData = tasks.filter(t => t.end_date && parseISO(t.end_date) < today && t.status !== 'termine' && t.status !== 'Terminé').map(t => {
        const tEnd = parseISO(t.end_date);
        tEnd.setHours(0, 0, 0, 0);
        return {
          ...t,
          joursRetard: Math.floor((today.getTime() - tEnd.getTime()) / (1000 * 60 * 60 * 24))
        };
      }).sort((a, b) => b.joursRetard - a.joursRetard);

      const kpis = {
        globalProgress,
        elementsCompleted: terminatedElementsCount,
        delayedTasks: delayedTasksData.length,
        elementsInProgress: elementsInProgressCount
      };

      // Statut des Tâches (Pie)
      const taskStatusPie = {
        not_started: allElements.filter(e => !e.unifiedStatus || e.unifiedStatus === 'non_commence' || e.unifiedStatus === 'Non commencé').length,
        started: elementsInProgressCount,
        completed: terminatedElementsCount
      };

      // Avancement par Bloc
      const progressByBlock = blocks.map(b => {
        const bElements = allElements.filter(e => e.block_id === b.id);
        const bTotal = bElements.length;
        const bDone = bElements.filter(e => e.unifiedStatus === 'termine' || e.unifiedStatus === 'Terminé').length;
        return {
          name: b.name,
          progress: bTotal > 0 ? Math.round((bDone / bTotal) * 100) : 0
        };
      });

      // Avancement par Type d'Élément
      const typeMapAll = new Map<string, { done: number; total: number }>();
      const typeMapByBlock = new Map<string, Map<string, { done: number; total: number }>>();

      allElements.forEach(e => {
        const type = e.normalizedType;
        const blockName = blocks.find(b => b.id === e.block_id)?.name || 'Général';
        const isDone = e.unifiedStatus === 'termine' || e.unifiedStatus === 'Terminé';

        const pAll = typeMapAll.get(type) || { done: 0, total: 0 };
        pAll.total++;
        if (isDone) pAll.done++;
        typeMapAll.set(type, pAll);

        if (!typeMapByBlock.has(blockName)) typeMapByBlock.set(blockName, new Map());
        const bMap = typeMapByBlock.get(blockName)!;
        const pBlock = bMap.get(type) || { done: 0, total: 0 };
        pBlock.total++;
        if (isDone) pBlock.done++;
        bMap.set(type, pBlock);
      });

      const mapToProgress = (m: Map<string, { done: number; total: number }>) =>
        Array.from(m.entries()).filter(([_, v]) => v.total > 0).map(([t, v]) => ({ type: t, progress: Math.round((v.done / v.total) * 100) }));

      const progressByElementType = {
        all: mapToProgress(typeMapAll),
        byBlock: Object.fromEntries(Array.from(typeMapByBlock.entries()).map(([b, m]) => [b, mapToProgress(m)]))
      };

      // Liste des retards
      const delayedTasksList = delayedTasksData.map(t => ({
        id: t.id,
        name: t.element || 'Tâche',
        block: blocks.find(b => b.id === t.block_id)?.name || 'Général',
        joursRetard: t.joursRetard
      }));

      // Avancement par Étage
      const progressByFloor = floors.map(f => {
        const fBlock = blocks.find(b => b.id === f.block_id)?.name || 'Général';
        const fElements = allElements.filter(e => e.floor_id === f.id);
        const fTypeMap = new Map<string, { done: number; total: number, isSurface: boolean }>();

        // Pré-définir le total Dalles depuis surface_totale_dalle si disponible (UNE seule fois, avant la boucle)
        const surfaceTotaleDalle = (f as any).surface_totale_dalle;
        if (surfaceTotaleDalle && surfaceTotaleDalle > 0) {
          fTypeMap.set('Dalles', { done: 0, total: surfaceTotaleDalle, isSurface: true });
        }

        fElements.forEach(e => {
          const isDone = e.unifiedStatus === 'termine' || e.unifiedStatus === 'Terminé';
          const p = fTypeMap.get(e.normalizedType) || { done: 0, total: 0, isSurface: e.normalizedType === 'Dalles' };

          if (e.normalizedType === 'Dalles') {
            const s = e as any;
            const tSurf = parseFloat(s.surface) || 0;
            const cSurf = parseFloat(s.surface_coulee) || 0;
            // Si surface_totale_dalle override → on cumule uniquement les m² coulés (le total est déjà fixé)
            // Sinon → on cumule aussi le total par dalle individuelle
            if (!(surfaceTotaleDalle && surfaceTotaleDalle > 0)) {
              p.total += tSurf;
            }
            p.done += isDone ? tSurf : cSurf;
          } else {
            p.total++;
            if (isDone) p.done++;
          }

          fTypeMap.set(e.normalizedType, p);
        });
        return {
          id: f.id,
          floorName: f.name,
          blockName: fBlock,
          order_number: f.order_number || 0,
          elements: Array.from(fTypeMap.entries()).filter(([_, v]) => v.total > 0).map(([t, v]) => ({
            type: t,
            done: Math.round(v.done * 100) / 100,
            total: v.total,
            isSurface: v.isSurface
          }))
        }
      }).filter(f => f.elements.length > 0)
        .sort((a, b) => a.order_number - b.order_number);

      // Productivité des Équipes
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(today.getDate() - 7);

      const teamProductivity = teams.map(team => {
        const teamBlock = blocks.find(b => b.id === team.block_id)?.name || 'Général';
        const prod = productivity.filter(p => p.team_id === team.id && new Date(p.date) >= oneWeekAgo);

        let assigned = 0;
        let completed = 0;
        prod.forEach(p => {
          assigned += (p.quantity_assigned || p.tasks_assigned || 0);
          completed += (p.quantity_realized || p.tasks_completed || 0);
        });

        return {
          block: teamBlock,
          team: team.name,
          workers: team.workers || 0,
          assigned,
          completed,
          productivity: assigned > 0 ? Math.round((completed / assigned) * 100) : 0
        };
      }).filter(t => t.assigned > 0 || t.completed > 0);

      // Courbe d'Avancement Cumulé global (30 derniers jours)
      const progressOverTime = [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const termineDates = allElements.filter(e => (e.unifiedStatus === 'termine' || e.unifiedStatus === 'Terminé') && e.updated_at)
        .map(e => new Date(e.updated_at).getTime());

      for (let i = 0; i <= 30; i++) {
        const d = new Date(thirtyDaysAgo);
        d.setDate(d.getDate() + i);
        const completedCount = termineDates.filter(t => t <= d.getTime()).length;
        progressOverTime.push({
          date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
          globalProgress: allElements.length > 0 ? Math.round((completedCount / allElements.length) * 100) : 0
        });
      }

      setStats({
        kpis,
        taskStatusPie,
        progressByBlock,
        progressByElementType,
        delayedTasksList,
        progressByFloor,
        teamProductivity,
        progressOverTime
      });

    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="bg-[#F1F5F9] min-h-screen p-8 animate-pulse">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="h-10 w-48 bg-gray-200 rounded-lg"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="h-[300px] bg-gray-200 rounded-2xl"></div>
            <div className="h-[300px] bg-gray-200 rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  // Couleurs principales
  const COLOR_ORANGE = '#F97316';
  const COLOR_BLUE = '#1E293B';
  const COLOR_GREEN = '#22C55E';
  const COLOR_RED = '#EF4444';
  const COLOR_GRAY = '#9CA3AF'; // Non commencé

  const pieData = [
    { name: 'Non commencé', value: stats.taskStatusPie.not_started, color: COLOR_GRAY },
    { name: 'En cours', value: stats.taskStatusPie.started, color: COLOR_ORANGE },
    { name: 'Terminé', value: stats.taskStatusPie.completed, color: COLOR_GREEN }
  ];

  return (
    <div className="bg-[#F1F5F9] min-h-screen pb-12">
      <div className="max-w-7xl mx-auto space-y-8 text-[#1E293B]">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 pt-4">
          <h2 className="text-2xl font-bold">Tableau de Bord</h2>
          <button
            onClick={() => { setLoading(true); loadDashboardData(); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm text-[#1E293B]"
          >
            <Activity size={16} />
            Actualiser
          </button>
        </div>

        {/* LIGNE 1 : KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-3xl font-black">{stats.kpis.globalProgress}%</h4>
              <TrendingUp size={24} className="text-[#1E293B]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E293B] mb-2">Avancement Global</p>
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#1E293B]" style={{ width: `${stats.kpis.globalProgress}%` }}></div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-3xl font-black">{stats.kpis.elementsCompleted}</h4>
              <CheckCircle2 size={24} className="text-[#22C55E]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E293B] mb-1">Éléments Terminés</p>
              <p className="text-xs text-gray-500">Totalité des éléments validés</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-3xl font-black">{stats.kpis.delayedTasks}</h4>
              <AlertTriangle size={24} className={stats.kpis.delayedTasks > 0 ? "text-[#EF4444]" : "text-[#22C55E]"} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E293B] mb-1">Tâches en Retard</p>
              <p className="text-xs text-gray-500">Retard identifié sur le planning</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-3xl font-black">{stats.kpis.elementsInProgress}</h4>
              <Timer size={24} className="text-[#F97316]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E293B] mb-1">Éléments En Cours</p>
              <p className="text-xs text-gray-500">Chantiers actifs actuellement</p>
            </div>
          </div>
        </div>

        {/* LIGNE 2 : GRAPHIQUES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* GAUCHE : DONUT CHART STATUT */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="text-lg font-bold mb-4 text-[#1E293B]">Statut des Tâches</h3>
            {stats.taskStatusPie.completed === 0 && stats.taskStatusPie.not_started === 0 && stats.taskStatusPie.started === 0 ? (
              <p className="flex-1 flex items-center justify-center italic text-gray-400">Aucune donnée disponible</p>
            ) : (
              <div className="w-full h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* DROITE : AVANCEMENT PAR BLOC */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="text-lg font-bold mb-4 text-[#1E293B]">Avancement par Bloc</h3>
            {stats.progressByBlock.length === 0 ? (
              <p className="flex-1 flex items-center justify-center italic text-gray-400">Aucune donnée disponible</p>
            ) : (
              <div className="w-full h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.progressByBlock} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(val: number) => [`${val}%`, 'Avancement']} />
                    <Bar dataKey="progress" radius={[0, 4, 4, 0]} barSize={20}>
                      {stats.progressByBlock.map((entry, index) => (
                        <Cell key={index} fill={entry.progress === 100 ? COLOR_GREEN : COLOR_ORANGE} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* LIGNE 3 : CÔTE À CÔTE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* GAUCHE : TYPE ÉLÉMENT */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[#1E293B]">Avancement par Type d'Élément</h3>
              <select
                value={selectedElementBlock}
                onChange={(e) => setSelectedElementBlock(e.target.value)}
                className="px-3 py-1.5 bg-[#F1F5F9] border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              >
                <option value="all">Tous les blocs</option>
                {Object.keys(stats.progressByElementType.byBlock).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {stats.progressByElementType.all.length === 0 ? (
              <p className="flex-1 flex items-center justify-center italic text-gray-400">Aucune donnée disponible</p>
            ) : (
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={selectedElementBlock === 'all' ? stats.progressByElementType.all : (stats.progressByElementType.byBlock[selectedElementBlock] || [])}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="type" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(val: number) => [`${val}%`, 'Avancement']} />
                    <Bar dataKey="progress" radius={[0, 4, 4, 0]} barSize={20}>
                      {(selectedElementBlock === 'all' ? stats.progressByElementType.all : (stats.progressByElementType.byBlock[selectedElementBlock] || [])).map((entry, index) => (
                        <Cell key={index} fill={entry.progress === 100 ? COLOR_GREEN : COLOR_ORANGE} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* DROITE : RETARDS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#1E293B]">
              <Clock className="text-[#EF4444]" size={20} />
              Suivi des Retards
            </h3>
            <div className="overflow-y-auto max-h-[300px] flex-grow pr-2">
              {stats.delayedTasksList.length > 0 ? (
                <ul className="space-y-3">
                  {stats.delayedTasksList.map(task => (
                    <li key={task.id} className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-[#F8FAFC] border border-gray-100">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-[#1E293B]">{task.name}</span>
                        <span className="text-xs text-gray-500">Bloc {task.block}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[#EF4444] text-sm">
                          {task.joursRetard} jr{task.joursRetard > 1 ? 's' : ''} de retard
                        </span>
                        {task.joursRetard > 7 ? (
                          <span className="px-2 py-1 bg-[#EF4444] text-white text-[10px] font-bold rounded">CRITIQUE</span>
                        ) : (
                          <span className="px-2 py-1 bg-[#F97316] text-white text-[10px] font-bold rounded">ATTENTION</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-2 py-8">
                  <CheckCircle2 size={40} className="text-[#22C55E]" />
                  <p className="text-[#22C55E] font-medium text-sm">✅ Aucun retard</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* LIGNE 4 : AVANCEMENT PAR ÉTAGE */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#1E293B]">
            <Layers className="text-[#1E293B]" size={20} />
            Avancement par Étage
          </h3>

          {stats.progressByFloor.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.progressByFloor.map(floor => (
                <div key={floor.id} className="p-5 rounded-xl border border-gray-100 bg-[#F8FAFC]">
                  <h4 className="font-bold text-sm mb-4 text-[#1E293B] uppercase">
                    {floor.blockName} — {floor.floorName}
                  </h4>
                  <div className="space-y-4">
                    {floor.elements.map((el, i) => {
                      const pct = el.total > 0 ? Math.round((el.done / el.total) * 100) : 0;
                      const barColor = pct === 100 ? 'bg-[#22C55E]' : pct > 0 ? 'bg-[#F97316]' : 'bg-[#9CA3AF]';

                      const displayDone = el.isSurface ? `${el.done} m²` : el.done;
                      const displayTotal = el.isSurface ? `${el.total} m²` : el.total;

                      return (
                        <div key={i} className="flex flex-col text-sm">
                          <div className="flex justify-between font-medium mb-1">
                            <span className="text-gray-700">{el.type}</span>
                            <span className={pct === 100 ? "text-[#22C55E]" : "text-gray-500"}>
                              {displayDone} / {displayTotal} — {pct}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="italic text-gray-400 py-8 text-center">Aucune donnée d'étage disponible.</p>
          )}
        </div>

        {/* LIGNE 5 : PRODUCTIVITÉ DES ÉQUIPES */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#1E293B]">
            <Users className="text-[#1E293B]" size={20} />
            Productivité des Équipes
          </h3>
          {stats.teamProductivity.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="pb-3 px-4 font-medium">Bloc</th>
                    <th className="pb-3 px-4 font-medium">Équipe</th>
                    <th className="pb-3 px-4 font-medium text-center">Ouvriers</th>
                    <th className="pb-3 px-4 font-medium text-center">Tâches Term./Assig.</th>
                    <th className="pb-3 px-4 font-medium">Productivité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.teamProductivity.map((team, idx) => (
                    <tr key={idx} className="hover:bg-[#F8FAFC]">
                      <td className="py-4 px-4">{team.block}</td>
                      <td className="py-4 px-4 font-bold text-[#1E293B]">{team.team}</td>
                      <td className="py-4 px-4 text-center">{team.workers}</td>
                      <td className="py-4 px-4 text-center">{team.completed} / {team.assigned}</td>
                      <td className="py-4 px-4 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${team.productivity >= 75 ? 'bg-[#22C55E]' : team.productivity >= 50 ? 'bg-[#F97316]' : 'bg-[#EF4444]'}`}
                              style={{ width: `${team.productivity}%` }}
                            />
                          </div>
                          <span className="font-bold text-xs w-10 text-right text-[#1E293B]">{team.productivity}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="italic text-gray-400 py-8 text-center">Aucune donnée de productivité cette semaine</p>
          )}
        </div>

        {/* LIGNE 6 : COURBE D'AVANCEMENT CUMULÉ */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#1E293B] z-10">
            <TrendingUp className="text-[#F97316]" size={20} />
            Courbe d'Avancement Cumulé (30 derniers jours)
          </h3>
          {stats.progressOverTime.length > 0 ? (
            <div className="w-full h-[300px] z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.progressOverTime} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value}%`, 'Avancement cumulé']}
                  />
                  <Area type="monotone" dataKey="globalProgress" stroke="#F97316" strokeWidth={3} fillOpacity={1} fill="url(#colorProgress)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="italic text-gray-400 py-8 text-center z-10">Aucune donnée d'avancement disponible.</p>
          )}
        </div>

      </div>
    </div>
  );
}
