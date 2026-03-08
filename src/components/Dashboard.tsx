import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  Users, AlertTriangle, CheckCircle2, Clock, TrendingUp, Layers, Box, 
  Building2, Layout, Activity, Calendar, UserCheck, Timer
} from 'lucide-react';
import { DashboardStats } from '../types';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Fetch all required data in parallel from Supabase
      const [
        { data: tasks },
        { data: blocks },
        { data: teams },
        { data: verticalElements },
        { data: slabs }
      ] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('blocks').select('*'),
        supabase.from('teams').select('*, blocks(name)'),
        supabase.from('vertical_elements').select('id'),
        supabase.from('slabs').select('id')
      ]);

      const allTasks = tasks || [];
      const allBlocks = blocks || [];
      const allTeams = teams || [];
      const veCount = verticalElements?.length || 0;
      const slabCount = slabs?.length || 0;

      const today = new Date().toISOString().split('T')[0];

      // Global progress
      const totalTasks = allTasks.length;
      const finishedTasks = allTasks.filter(t => t.status === 'Terminé').length;
      const globalProgress = totalTasks > 0 ? (finishedTasks / totalTasks) * 100 : 0;

      // Delayed tasks
      const delayedTasksArr = allTasks.filter(t => t.status !== 'Terminé' && t.end_date < today);
      const delayedTasks = delayedTasksArr.length;

      // Active workers
      const activeWorkers = allTeams.reduce((sum, t) => sum + (t.workers || 0), 0);

      // Task status counts
      const statusMap = new Map<string, number>();
      allTasks.forEach(t => {
        statusMap.set(t.status, (statusMap.get(t.status) || 0) + 1);
      });
      const taskStatusCounts = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

      // Progress by block
      const progressByBlock = allBlocks.map(b => {
        const blockTasks = allTasks.filter(t => t.block_id === b.id);
        const done = blockTasks.filter(t => t.status === 'Terminé').length;
        const total = blockTasks.length;
        return { name: b.name, progress: total > 0 ? (done / total) * 100 : 0 };
      });

      // Progress by zone
      const zoneMap = new Map<string, { done: number; total: number }>();
      allBlocks.forEach(b => {
        const blockTasks = allTasks.filter(t => t.block_id === b.id);
        const prev = zoneMap.get(b.zone) || { done: 0, total: 0 };
        prev.total += blockTasks.length;
        prev.done += blockTasks.filter(t => t.status === 'Terminé').length;
        zoneMap.set(b.zone, prev);
      });
      const progressByZone = Array.from(zoneMap.entries()).map(([name, v]) => ({
        name,
        progress: v.total > 0 ? (v.done / v.total) * 100 : 0
      }));

      // Weekly progress (tasks finished in the last 7 days, grouped by block)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
      const weeklyProgress = allBlocks.map(b => {
        const completed = allTasks.filter(
          t => t.block_id === b.id && t.status === 'Terminé' && t.end_date >= sevenDaysAgoStr
        ).length;
        return { name: b.name, completed };
      });

      // Workforce distribution (workers per block)
      const workforceDistribution = allBlocks.map(b => {
        const blockTeams = allTeams.filter(t => t.block_id === b.id);
        const workers = blockTeams.reduce((sum, t) => sum + (t.workers || 0), 0);
        return { name: b.name, workers };
      }).filter(w => w.workers > 0);

      // Progress by element type
      const elementTypeMap = new Map<string, { done: number; total: number }>();
      allTasks.forEach(t => {
        if (t.element_type) {
          const prev = elementTypeMap.get(t.element_type) || { done: 0, total: 0 };
          prev.total += 1;
          if (t.status === 'Terminé') prev.done += 1;
          elementTypeMap.set(t.element_type, prev);
        }
      });
      const progressByElementType = Array.from(elementTypeMap.entries()).map(([type, v]) => ({
        type,
        progress: v.total > 0 ? (v.done / v.total) * 100 : 0
      }));

      // Delayed tasks list (top 5)
      const delayedTasksList = delayedTasksArr.slice(0, 5).map(t => {
        const block = allBlocks.find(b => b.id === t.block_id);
        const delayDays = Math.ceil((new Date().getTime() - new Date(t.end_date).getTime()) / (1000 * 60 * 60 * 24));
        return {
          element: t.element || t.name || 'Tâche',
          block: block?.name || 'Général',
          delay: delayDays > 0 ? delayDays : 0
        };
      });

      // Team productivity
      const teamProductivity = allTeams
        .filter(t => t.block_id)
        .map(team => {
          const blockName = (team as any).blocks?.name || allBlocks.find(b => b.id === team.block_id)?.name || 'N/A';
          const teamTasks = allTasks.filter(t => t.team_id === team.id);
          const assigned = teamTasks.length;
          const completed = teamTasks.filter(t => t.status === 'Terminé').length;
          return {
            block: blockName,
            team: team.name,
            workers: team.workers || 0,
            completed,
            assigned,
            productivity: assigned > 0 ? (completed / assigned) * 100 : 0
          };
        });

      setStats({
        globalProgress,
        activeWorkers,
        delayedTasks,
        totalBlocks: allBlocks.length,
        totalFloors: 0, // Not used in the UI anymore
        totalElements: veCount + slabCount,
        taskStatusCounts,
        progressByBlock,
        progressByZone,
        weeklyProgress,
        teamProductivity,
        progressByElementType,
        delayedTasksList,
        workforceDistribution
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
      {/* SECTION 1 : PROJECT OVERVIEW */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Avancement Global" 
          value={`${Math.round(stats.globalProgress)}%`} 
          icon={TrendingUp} 
          color="bg-[#001F3F]" 
          progress={stats.globalProgress}
        />
        <StatCard 
          title="Nombre de Blocs" 
          value={stats.totalBlocks.toString()} 
          icon={Building2} 
          color="bg-[#FF851B]" 
          subtitle="Structures actives"
        />
        <StatCard 
          title="Tâches en Retard" 
          value={stats.delayedTasks.toString()} 
          icon={AlertTriangle} 
          color={stats.delayedTasks > 0 ? "bg-red-500" : "bg-[#3D9970]"} 
          subtitle={stats.delayedTasks > 0 ? "Nécessitent une attention" : "Aucun retard"}
        />
        <StatCard 
          title="Total Éléments" 
          value={stats.totalElements.toString()} 
          icon={Box} 
          color="bg-indigo-600" 
          subtitle="Poteaux, voiles, dalles"
        />
      </div>

      {/* Task Status Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-1">
          <h3 className="text-lg font-bold text-[#001F3F] mb-6 flex items-center gap-2">
            <Activity className="text-[#FF851B]" size={20} />
            Statut des Tâches
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.taskStatusCounts}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                >
                  {stats.taskStatusCounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SECTION 3 : WEEKLY PROGRESS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-[#001F3F] mb-6 flex items-center gap-2">
            <Calendar className="text-[#FF851B]" size={20} />
            Progression Hebdomadaire (Tâches terminées)
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weeklyProgress}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="completed" name="Tâches terminées" fill="#001F3F" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 2 : PROGRESS BY BLOCK */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-[#001F3F] mb-6 flex items-center gap-2">
            <Layout className="text-[#FF851B]" size={20} />
            Avancement par Bloc
          </h3>
          <div className="space-y-6">
            {stats.progressByBlock.map((block, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>{block.name}</span>
                  <span className="text-[#FF851B]">{Math.round(block.progress)}%</span>
                </div>
                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${block.progress}%` }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    className="h-full bg-[#001F3F]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 7 : WORKFORCE DISTRIBUTION */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-[#001F3F] mb-6 flex items-center gap-2">
            <UserCheck className="text-[#FF851B]" size={20} />
            Distribution de la Main d'œuvre
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.workforceDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={100}
                  paddingAngle={0}
                  dataKey="workers"
                  nameKey="name"
                  label={({ name, workers }) => `${name}: ${workers}`}
                >
                  {stats.workforceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 5 : WORK BY ELEMENT TYPE */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-[#001F3F] mb-6 flex items-center gap-2">
            <Box className="text-[#FF851B]" size={20} />
            Avancement par Type d'Élément
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.progressByElementType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F3F4F6" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="type" type="category" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="progress" name="Avancement %" fill="#FF851B" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SECTION 6 : DELAY MONITORING */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-[#001F3F] mb-6 flex items-center gap-2">
            <Timer className="text-red-500" size={20} />
            Suivi des Retards
          </h3>
          <div className="space-y-4">
            {stats.delayedTasksList.length > 0 ? (
              stats.delayedTasksList.map((delay, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-red-500">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-red-900">{delay.element}</p>
                      <p className="text-xs text-red-700">{delay.block}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-red-600">+{delay.delay} jours</p>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-red-400">Retard critique</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <CheckCircle2 size={48} className="mb-2 text-green-500" />
                <p>Aucun retard critique détecté</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4 : TEAM PRODUCTIVITY */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#001F3F] flex items-center gap-2">
            <Users className="text-[#FF851B]" size={20} />
            Productivité des Équipes
          </h3>
          <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">
            Mise à jour en direct
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-bold">Bloc</th>
                <th className="px-6 py-4 font-bold">Équipe</th>
                <th className="px-6 py-4 font-bold">Ouvriers</th>
                <th className="px-6 py-4 font-bold">Tâches Term./Assig.</th>
                <th className="px-6 py-4 font-bold">Productivité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.teamProductivity.map((team, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium">{team.block}</td>
                  <td className="px-6 py-4 text-sm font-bold text-[#001F3F]">{team.team}</td>
                  <td className="px-6 py-4 text-sm">{team.workers}</td>
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
