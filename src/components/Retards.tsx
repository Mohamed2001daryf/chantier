import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Calendar, Box, ArrowRight } from 'lucide-react';
import { Task } from '../types';
import { differenceInDays, parseISO, format } from 'date-fns';
import { cn } from '../utils';

export default function Retards() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetch('/api/tasks').then(res => res.json()).then(setTasks);
  }, []);

  const delayedTasks = tasks.filter(t => {
    if (t.status === 'Terminé') return false;
    const endDate = parseISO(t.end_date);
    return endDate < new Date();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#001F3F]">Suivi des Retards</h2>
          <p className="text-gray-500 text-sm sm:text-base">Comparez le planning prévisionnel avec l'avancement réel.</p>
        </div>
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded-xl font-black flex items-center gap-2 border border-red-200 self-start sm:self-auto text-sm">
          <AlertTriangle size={18} />
          {delayedTasks.length} Tâches Critiques
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {delayedTasks.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-[#001F3F]">Aucun retard détecté</h3>
            <p className="text-gray-500">Toutes les tâches sont dans les délais ou terminées.</p>
          </div>
        ) : (
          delayedTasks.map((task) => {
            const delay = differenceInDays(new Date(), parseISO(task.end_date));
            return (
              <div key={task.id} className="bg-white p-6 rounded-2xl shadow-sm border-l-8 border-red-500 border-y border-r border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center font-bold">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-[#001F3F] text-lg">{task.element}</h4>
                    <p className="text-sm text-gray-500 font-medium">
                      {task.block_name} • <span className="text-[#FF851B]">{task.floor_name || 'N/A'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-8 items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Date Prévue</span>
                    <span className="text-sm font-bold text-gray-700">{format(parseISO(task.end_date), 'dd/MM/yyyy')}</span>
                  </div>
                  <ArrowRight className="text-gray-300 hidden md:block" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Date Réelle</span>
                    <span className="text-sm font-bold text-red-600">{format(new Date(), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="bg-red-50 px-4 py-2 rounded-xl border border-red-100">
                    <span className="text-[10px] uppercase tracking-widest text-red-400 font-bold block">Retard</span>
                    <span className="text-xl font-black text-red-600">{delay} Jours</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import { CheckCircle2 } from 'lucide-react';
