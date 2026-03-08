import React, { useState, useEffect, useRef } from 'react';
import { Plus, Download, Upload, Trash2, X, Save, Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Block, Floor, Task } from '../types';
import { STATUS_OPTIONS, cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';

// Aliases for automatic column detection (lowercase)
const COLUMN_ALIASES: Record<string, string[]> = {
  element: ['activity name', 'activityname', 'nom', 'tâche', 'tache', 'task', 'element', 'élément', 'activité', 'activite', 'libellé', 'libelle', 'désignation', 'designation', 'intitulé', 'intitule', 'ouvrage', 'lot', 'poste', 'wbs name'],
  description: ['description', 'détail', 'detail', 'commentaire', 'note', 'notes', 'remarque', 'obs', 'observation'],
  start_date: ['start', 'start date', 'startdate', 'date début', 'date debut', 'début', 'debut', 'date de début', 'planned start', 'early start', 'start1', 'date_debut'],
  end_date: ['finish', 'end', 'end date', 'enddate', 'date fin', 'fin', 'date de fin', 'planned finish', 'early finish', 'late finish', 'finish1', 'date_fin'],
  duration: ['duration', 'durée', 'duree', 'original duration', 'nb jours', 'jours', 'days', 'dur'],
  status: ['status', 'statut', 'état', 'etat', 'avancement', 'progress', '%'],
  block: ['bloc', 'block', 'bâtiment', 'batiment', 'immeuble', 'zone', 'building'],
  floor: ['étage', 'etage', 'floor', 'niveau', 'level', 'niv'],
  element_type: ['type élément', 'type element', 'type', 'catégorie', 'categorie', 'category', 'type élément', 'element type'],
};

const FIELD_LABELS: Record<string, string> = {
  element: 'Élément / Tâche',
  description: 'Description',
  start_date: 'Date début',
  end_date: 'Date fin',
  duration: 'Durée',
  status: 'Statut',
  block: 'Bloc',
  floor: 'Étage',
  element_type: 'Type élément',
};

// Normalize element type from Excel (lowercase) to match dropdown values
function normalizeElementType(raw: string | null | undefined): string {
  if (!raw) return '';
  const val = raw.toString().trim().toLowerCase();
  const typeMap: Record<string, string> = {
    'poteau': 'Poteau',
    'voile': 'Voile',
    'voile périphérique': 'Voile périphérique',
    'voile peripherique': 'Voile périphérique',
    'dalle': 'Dalle',
  };
  return typeMap[val] || (val.charAt(0).toUpperCase() + val.slice(1)) || '';
}

function detectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const header of headers) {
      const h = header.toLowerCase().trim();
      if (aliases.includes(h)) {
        mapping[field] = header;
        break;
      }
    }
  }
  // Fallback: if no element found, use the first text-looking column
  if (!mapping.element && headers.length > 0) {
    mapping.element = headers[0];
  }
  return mapping;
}

type ImportStatus = 'idle' | 'preview' | 'importing' | 'success' | 'error';

export default function Planning() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [formData, setFormData] = useState({ 
    block_id: '', floor_id: '', element: '', description: '', 
    start_date: format(new Date(), 'yyyy-MM-dd'), 
    end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    status: 'Non commencé',
    element_type: '',
    axes: '',
    surface: ''
  });

  const [viewDate, setViewDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedBlockFilter, setSelectedBlockFilter] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import states
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importData, setImportData] = useState<any[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] }>({ imported: 0, skipped: 0, errors: [] });
  const [importFileName, setImportFileName] = useState('');

  useEffect(() => {
    fetchTasks();
    fetchBlocks();
    fetchFloors();
  }, []);

  const fetchTasks = () => fetch('/api/tasks').then(res => res.json()).then(setTasks);
  const fetchBlocks = () => fetch('/api/blocks').then(res => res.json()).then(setBlocks);
  const fetchFloors = () => fetch('/api/floors').then(res => res.json()).then(setFloors);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = parseISO(formData.start_date);
    const end = parseISO(formData.end_date);
    const duration = differenceInDays(end, start);

    const isEditing = isEditModalOpen && selectedTask;
    const url = isEditing ? `/api/tasks/${selectedTask.id}` : '/api/tasks';
    const method = isEditing ? 'PUT' : 'POST';

    const payload = {
      block_id: formData.block_id ? parseInt(formData.block_id) : null,
      floor_id: formData.floor_id ? parseInt(formData.floor_id) : null,
      element: formData.element,
      description: formData.description,
      start_date: formData.start_date,
      end_date: formData.end_date,
      duration,
      status: formData.status,
      element_type: formData.element_type || null,
      axes: formData.axes || null,
      surface: formData.surface ? parseFloat(formData.surface) : 0
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchTasks();
        setIsModalOpen(false);
        setIsEditModalOpen(false);
        setSelectedTask(null);
      }
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
    }
  };

  const handleDelete = (id: number) => {
    fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) {
          // Optimistically update UI
          setTasks(prev => prev.filter(t => t.id !== id));
          setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
          setIsDeleteConfirmOpen(false);
          setSelectedTask(null);
        }
      })
      .catch(err => console.error("Erreur lors de la suppression:", err));
  };

  const handleBulkDelete = () => {
    fetch('/api/tasks/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds })
    })
      .then(res => {
        if (res.ok) {
          setTasks(prev => prev.filter(t => !selectedIds.includes(t.id)));
          setSelectedIds([]);
          setIsBulkDeleteConfirmOpen(false);
        }
      })
      .catch(err => console.error("Erreur lors de la suppression groupée:", err));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTasks.map(t => t.id));
    }
  };

  const toggleSelectTask = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Step 1: Read file and show preview
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportResult({ imported: 0, skipped: 0, errors: [] });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          setImportResult({ imported: 0, skipped: 0, errors: ['Le fichier est vide ou ne contient aucune donnée exploitable.'] });
          setImportStatus('error');
          return;
        }

        const headers = Object.keys(data[0]);
        const autoMapping = detectColumnMapping(headers);

        setImportHeaders(headers);
        setImportData(data);
        setColumnMapping(autoMapping);
        setImportStatus('preview');
      } catch (err) {
        setImportResult({ imported: 0, skipped: 0, errors: ['Impossible de lire le fichier. Vérifiez qu\'il s\'agit bien d\'un fichier Excel (.xlsx).'] });
        setImportStatus('error');
      }
    };
    reader.readAsBinaryString(file);
    // Reset input so same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Step 2: Confirm and import with the selected mapping
  const handleConfirmImport = async () => {
    setImportStatus('importing');
    setImportProgress(0);

    const formatDate = (date: any): string => {
      if (!date) return format(new Date(), 'yyyy-MM-dd');
      if (date instanceof Date) {
        // Check if valid date
        if (isNaN(date.getTime())) return format(new Date(), 'yyyy-MM-dd');
        return format(date, 'yyyy-MM-dd');
      }
      if (typeof date === 'number') {
        // Excel serial date number
        try {
          const excelDate = new Date((date - 25569) * 86400 * 1000);
          if (!isNaN(excelDate.getTime())) return format(excelDate, 'yyyy-MM-dd');
        } catch { /* fall through */ }
        return format(new Date(), 'yyyy-MM-dd');
      }
      if (typeof date === 'string') {
        const trimmed = date.trim();
        // Try dd/MM/yyyy format (common in French Excel)
        const frMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (frMatch) {
          const [, day, month, yearStr] = frMatch;
          const year = yearStr.length === 2 ? `20${yearStr}` : yearStr;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Try ISO format
        try { return format(parseISO(trimmed), 'yyyy-MM-dd'); } catch { /* fall through */ }
        return format(new Date(), 'yyyy-MM-dd');
      }
      return format(new Date(), 'yyyy-MM-dd');
    };

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const total = importData.length;

    for (let i = 0; i < importData.length; i++) {
      const row = importData[i];
      setImportProgress(Math.round(((i + 1) / total) * 100));

      // Get mapped values
      const elementVal = columnMapping.element ? row[columnMapping.element] : '';
      const descVal = columnMapping.description ? row[columnMapping.description] : '';
      const startVal = columnMapping.start_date ? row[columnMapping.start_date] : null;
      const endVal = columnMapping.end_date ? row[columnMapping.end_date] : null;
      const durationVal = columnMapping.duration ? row[columnMapping.duration] : null;
      const statusVal = columnMapping.status ? row[columnMapping.status] : null;
      const blockVal = columnMapping.block ? row[columnMapping.block] : null;
      const floorVal = columnMapping.floor ? row[columnMapping.floor] : null;
      const elementTypeVal = columnMapping.element_type ? row[columnMapping.element_type] : null;

      // Determine element name — skip if empty
      const elementName = (elementVal || descVal || '').toString().trim();
      if (!elementName) {
        skipped++;
        continue;
      }

      // Skip obvious header/section rows
      const headersToIgnore = ['DATES CLES', 'ETUDES', 'STRUCTURES', 'DATES CLÉS', 'ÉTUDES', 'TOTAL', 'SOMMAIRE', 'SUMMARY'];
      if (headersToIgnore.some(h => elementName.toUpperCase().includes(h))) {
        skipped++;
        continue;
      }

      // Map block/floor to IDs
      const block = blockVal ? blocks.find(b => b.name.toLowerCase() === blockVal.toString().toLowerCase().trim()) : null;
      const floor = floorVal ? floors.find(f => f.name.toLowerCase() === floorVal.toString().toLowerCase().trim()) : null;

      // Parse dates
      const startStr = formatDate(startVal);
      let endStr = formatDate(endVal);

      // If no end date but duration is available, calculate end from start
      if (!endVal && durationVal) {
        const dur = parseInt(durationVal.toString()) || 0;
        if (dur > 0) {
          try {
            endStr = format(addDays(parseISO(startStr), dur), 'yyyy-MM-dd');
          } catch { /* keep default */ }
        }
      }

      const duration = durationVal ? (parseInt(durationVal.toString()) || 0) : differenceInDays(parseISO(endStr), parseISO(startStr));

      // Map status
      let mappedStatus = 'Non commencé';
      if (statusVal) {
        const sv = statusVal.toString().toLowerCase().trim();
        if (['terminé', 'termine', 'done', 'completed', 'fini', '100%', '100'].includes(sv)) mappedStatus = 'Terminé';
        else if (['en cours', 'in progress', 'started', 'commencé', 'commence'].includes(sv) || (sv.includes('%') && sv !== '0%')) mappedStatus = 'En cours';
      }

      try {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            block_id: block?.id || null,
            floor_id: floor?.id || null,
            element: elementName,
            description: (descVal || elementName || '').toString().trim(),
            start_date: startStr,
            end_date: endStr,
            duration: Math.abs(duration) || 0,
            status: mappedStatus,
            element_type: elementTypeVal ? normalizeElementType(elementTypeVal) : null
          })
        });
        imported++;
      } catch (err) {
        errors.push(`Ligne ${i + 2}: Erreur lors de l'import de "${elementName}"`);
      }
    }

    setImportResult({ imported, skipped, errors });
    setImportStatus('success');
    fetchTasks();
  };

  const closeImportModal = () => {
    setImportStatus('idle');
    setImportData([]);
    setImportHeaders([]);
    setColumnMapping({});
    setImportProgress(0);
    setImportResult({ imported: 0, skipped: 0, errors: [] });
    setImportFileName('');
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredTasks.map(t => ({
      Bloc: t.block_name,
      Étage: t.floor_name,
      'Type élément': t.element_type || '',
      Élément: t.element,
      Description: t.description,
      'Date début': t.start_date,
      'Date fin': t.end_date,
      Statut: t.status
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planning");
    XLSX.writeFile(wb, "Planning_Chantier.xlsx");
  };

  const filteredTasks = tasks.filter(task => {
    if (selectedBlockFilter === 'all') return true;
    return task.block_id?.toString() === selectedBlockFilter;
  });

  // Gantt Chart Logic
  const daysToShow = 21; // 3 weeks
  const timelineDays = eachDayOfInterval({
    start: viewDate,
    end: addDays(viewDate, daysToShow - 1)
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#001F3F]">Planning Chantier</h2>
          <p className="text-gray-500 text-sm sm:text-base">Gérez le calendrier des travaux et importez vos plannings MS Project / Excel.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {selectedIds.length > 0 && (
            <button 
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100 transition-all text-sm"
            >
              <Trash2 size={16} />
              Supprimer ({selectedIds.length})
            </button>
          )}
          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.csv,.xml" />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-white border border-gray-200 text-gray-700 px-3 sm:px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all text-sm"
          >
            <Upload size={16} />
            Importer
          </button>
          <button 
            onClick={handleExport}
            className="bg-white border border-gray-200 text-gray-700 px-3 sm:px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all text-sm"
          >
            <Download size={16} />
            Exporter
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#FF851B] hover:bg-[#E76A00] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 text-sm sm:text-base"
          >
            <Plus size={18} />
            Nouvelle Tâche
          </button>
        </div>
      </div>

      {/* Gantt View */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4 bg-gray-50/50">
          <div className="flex items-center gap-4">
            <button onClick={() => setViewDate(addDays(viewDate, -7))} className="p-2 hover:bg-white rounded-lg border border-gray-200 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-[#001F3F] min-w-[200px] text-center">
              Semaine du {format(viewDate, 'dd MMMM yyyy', { locale: fr })}
            </span>
            <button onClick={() => setViewDate(addDays(viewDate, 7))} className="p-2 hover:bg-white rounded-lg border border-gray-200 transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Filtrer par Bloc:</label>
            <select 
              value={selectedBlockFilter} 
              onChange={(e) => setSelectedBlockFilter(e.target.value)}
              className="bg-white border border-gray-200 text-[#001F3F] px-4 py-2 rounded-xl font-bold text-sm focus:ring-2 focus:ring-[#FF851B] outline-none transition-all"
            >
              <option value="all">Tous les blocs</option>
              {blocks.map(block => (
                <option key={block.id} value={block.id.toString()}>{block.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-gray-400">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> En cours</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Terminé</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-300 rounded-sm"></div> Non commencé</div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[1200px]">
            {/* Header */}
            <div className="flex border-b border-gray-100">
              <div className="w-12 p-4 border-r border-gray-100 sticky left-0 bg-white z-[11] flex items-center justify-center">
                <input 
                  type="checkbox" 
                  checked={filteredTasks.length > 0 && selectedIds.length === filteredTasks.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-[#FF851B] focus:ring-[#FF851B]"
                />
              </div>
              <div className="w-64 p-4 font-bold text-xs uppercase text-gray-400 border-r border-gray-100 sticky left-12 bg-white z-10">Tâche / Élément</div>
              <div className="flex-1 flex">
                {timelineDays.map((day, i) => (
                  <div key={i} className={cn(
                    "flex-1 p-2 text-center border-r border-gray-50",
                    (day.getDay() === 0 || day.getDay() === 6) ? "bg-gray-50/50" : ""
                  )}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{format(day, 'EEE', { locale: fr })}</p>
                    <p className={cn("text-xs font-black", isSameDay(day, new Date()) ? "text-[#FF851B]" : "text-[#001F3F]")}>
                      {format(day, 'dd')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {filteredTasks.map((task) => {
                const start = parseISO(task.start_date);
                const end = parseISO(task.end_date);
                
                return (
                  <div key={task.id} className="flex group hover:bg-gray-50/50 transition-colors">
                    <div className="w-12 p-4 border-r border-gray-100 sticky left-0 bg-white group-hover:bg-gray-50/50 z-[11] flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(task.id)}
                        onChange={() => toggleSelectTask(task.id)}
                        className="w-4 h-4 rounded border-gray-300 text-[#FF851B] focus:ring-[#FF851B]"
                      />
                    </div>
                    <div className="w-64 p-4 border-r border-gray-100 sticky left-12 bg-white group-hover:bg-gray-50/50 z-10 flex justify-between items-center">
                      <div className="cursor-pointer flex-1" onClick={() => {
                        setSelectedTask(task);
                        setFormData({
                          block_id: task.block_id?.toString() || '',
                          floor_id: task.floor_id?.toString() || '',
                          element: task.element,
                          description: task.description,
                          start_date: task.start_date,
                          end_date: task.end_date,
                          status: task.status,
                          element_type: normalizeElementType(task.element_type),
                          axes: task.axes || '',
                          surface: task.surface?.toString() || ''
                        });
                        setIsEditModalOpen(true);
                      }}>
                        <p className="font-bold text-sm text-[#001F3F] truncate">{task.element}</p>
                        <p className="text-[10px] text-gray-400">{task.block_name || 'Général'} • {task.floor_name || 'N/A'}</p>
                      </div>
                      <button onClick={() => {
                        setSelectedTask(task);
                        setIsDeleteConfirmOpen(true);
                      }} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex-1 flex relative h-16 items-center">
                      {timelineDays.map((day, i) => (
                        <div key={i} className={cn(
                          "flex-1 h-full border-r border-gray-50/30",
                          (day.getDay() === 0 || day.getDay() === 6) ? "bg-gray-50/20" : ""
                        )}></div>
                      ))}
                      
                      {/* Task Bar */}
                      {(() => {
                        const taskStart = parseISO(task.start_date);
                        const taskEnd = parseISO(task.end_date);
                        
                        // Calculate offset and width relative to timeline
                        const offsetDays = differenceInDays(taskStart, viewDate);
                        const durationDays = differenceInDays(taskEnd, taskStart) + 1;
                        
                        if (offsetDays + durationDays < 0 || offsetDays >= daysToShow) return null;
                        
                        const left = Math.max(0, (offsetDays / daysToShow) * 100);
                        const width = Math.min(100 - left, (durationDays / daysToShow) * 100);
                        
                        return (
                          <motion.div 
                            initial={{ opacity: 0, scaleX: 0 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            className={cn(
                              "absolute h-8 rounded-lg shadow-sm flex items-center px-3 overflow-hidden cursor-pointer hover:brightness-110 transition-all",
                              task.status === 'Terminé' ? "bg-green-500" : task.status === 'En cours' ? "bg-blue-500" : "bg-gray-300"
                            )}
                          >
                            <span className="text-[10px] font-bold text-white truncate">{task.description}</span>
                          </motion.div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nouvelle Tâche / Modifier Tâche */}
      {(isModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="bg-[#001F3F] p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">{isEditModalOpen ? 'Modifier la Tâche' : 'Nouvelle Tâche'}</h3>
              <button onClick={() => {
                setIsModalOpen(false);
                setIsEditModalOpen(false);
                setSelectedTask(null);
              }} className="hover:bg-white/10 p-1 rounded transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Type élément</label>
                <select 
                  value={formData.element_type} 
                  onChange={e => setFormData({ ...formData, element_type: e.target.value })} 
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none"
                >
                  <option value="">Aucun / Autre</option>
                  <option value="Poteau">Poteau</option>
                  <option value="Voile">Voile</option>
                  <option value="Voile périphérique">Voile périphérique</option>
                  <option value="Dalle">Dalle</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Nom de l'élément / Titre</label>
                <input required type="text" value={formData.element} onChange={e => setFormData({ ...formData, element: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="Ex: Poteau P1 ou Dalle D1" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Axes</label>
                <input type="text" value={formData.axes} onChange={e => setFormData({ ...formData, axes: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="Ex: A-3" />
              </div>
              {formData.element_type === 'Dalle' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Surface (m²)</label>
                  <input type="number" step="0.01" value={formData.surface} onChange={e => setFormData({ ...formData, surface: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" placeholder="Ex: 120.5" />
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Bloc</label>
                <select required={formData.element_type === 'Dalle'} value={formData.block_id} onChange={e => setFormData({ ...formData, block_id: e.target.value, floor_id: '' })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none">
                  <option value="">Général</option>
                  {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Étage</label>
                <select required={formData.element_type === 'Dalle'} value={formData.floor_id} onChange={e => setFormData({ ...formData, floor_id: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none">
                  <option value="">N/A</option>
                  {floors.filter(f => !formData.block_id || f.block_id === parseInt(formData.block_id)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Date Début</label>
                <input required type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Date Fin</label>
                <input required type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Statut</label>
                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF851B] outline-none h-20 resize-none" placeholder="Détails de la tâche..." />
              </div>
              <div className="col-span-2 flex gap-3 pt-4">
                <button type="button" onClick={() => {
                  setIsModalOpen(false);
                  setIsEditModalOpen(false);
                  setSelectedTask(null);
                }} className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">Annuler</button>
                <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-[#FF851B] hover:bg-[#E76A00] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Save size={20} />
                  {isEditModalOpen ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal Import Preview */}
      <AnimatePresence>
      {(importStatus === 'preview' || importStatus === 'importing' || importStatus === 'success' || importStatus === 'error') && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#001F3F] p-6 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={24} />
                <div>
                  <h3 className="text-xl font-bold">Import Excel</h3>
                  <p className="text-white/60 text-sm">{importFileName}</p>
                </div>
              </div>
              <button onClick={closeImportModal} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Error State */}
              {importStatus === 'error' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-[#001F3F] mb-2">Erreur d'import</h4>
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-red-600 text-sm">{err}</p>
                  ))}
                  <button onClick={closeImportModal} className="mt-6 px-6 py-3 rounded-xl font-bold text-white bg-[#FF851B] hover:bg-[#E76A00] transition-all">
                    Fermer
                  </button>
                </div>
              )}

              {/* Success State */}
              {importStatus === 'success' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-[#001F3F] mb-2">Import terminé !</h4>
                  <div className="flex justify-center gap-6 text-sm mt-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <p className="text-green-700 font-bold text-2xl">{importResult.imported}</p>
                      <p className="text-green-600">importées</p>
                    </div>
                    {importResult.skipped > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                        <p className="text-yellow-700 font-bold text-2xl">{importResult.skipped}</p>
                        <p className="text-yellow-600">ignorées</p>
                      </div>
                    )}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-left max-h-32 overflow-y-auto">
                      <p className="text-red-700 font-bold text-sm mb-1">Erreurs :</p>
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-red-600 text-xs">{err}</p>
                      ))}
                    </div>
                  )}
                  <button onClick={closeImportModal} className="mt-6 px-6 py-3 rounded-xl font-bold text-white bg-[#FF851B] hover:bg-[#E76A00] transition-all">
                    Fermer
                  </button>
                </div>
              )}

              {/* Importing State */}
              {importStatus === 'importing' && (
                <div className="text-center py-8">
                  <Loader2 size={48} className="animate-spin text-[#FF851B] mx-auto mb-4" />
                  <h4 className="text-lg font-bold text-[#001F3F] mb-4">Import en cours...</h4>
                  <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-3 overflow-hidden">
                    <motion.div 
                      className="bg-[#FF851B] h-full rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${importProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-gray-500 text-sm mt-2">{importProgress}% — {Math.round(importData.length * importProgress / 100)} / {importData.length} lignes</p>
                </div>
              )}

              {/* Preview State */}
              {importStatus === 'preview' && (
                <>
                  {/* Column Mapping */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Correspondance des colonnes</h4>
                    <p className="text-xs text-gray-400 mb-4">Vérifiez et ajustez la correspondance automatique entre les colonnes de votre fichier et les champs de ChantierPro.</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(FIELD_LABELS).map(([field, label]) => (
                        <div key={field} className="space-y-1">
                          <label className="block text-xs font-bold text-gray-700">{label}</label>
                          <select
                            value={columnMapping[field] || ''}
                            onChange={(e) => setColumnMapping(prev => ({ ...prev, [field]: e.target.value }))}
                            className={cn(
                              "w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-[#FF851B] outline-none transition-all",
                              columnMapping[field] 
                                ? "border-green-300 bg-green-50 text-green-800" 
                                : "border-gray-200 bg-white text-gray-500"
                            )}
                          >
                            <option value="">— Ignorer —</option>
                            {importHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    {!columnMapping.element && (
                      <div className="mt-3 flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                        <AlertCircle size={16} />
                        <span>Aucune colonne «Élément / Tâche» détectée. Sélectionnez-la manuellement pour que l'import fonctionne.</span>
                      </div>
                    )}
                  </div>

                  {/* Data Preview */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Aperçu des données ({importData.length} lignes)
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-3 py-2 text-left text-xs font-bold text-gray-400 uppercase">#</th>
                            {importHeaders.slice(0, 8).map(h => (
                              <th key={h} className="px-3 py-2 text-left text-xs font-bold text-gray-400 uppercase whitespace-nowrap">
                                {h}
                                {Object.entries(columnMapping).find(([, v]) => v === h) && (
                                  <span className="ml-1 text-green-500">✓</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {importData.slice(0, 5).map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2 text-gray-400 font-mono text-xs">{i + 1}</td>
                              {importHeaders.slice(0, 8).map(h => (
                                <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                                  {row[h] instanceof Date ? format(row[h], 'dd/MM/yyyy') : (row[h]?.toString() || '—')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importData.length > 5 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">... et {importData.length - 5} lignes supplémentaires</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer Actions for Preview */}
            {importStatus === 'preview' && (
              <div className="border-t border-gray-100 p-4 flex justify-between items-center shrink-0 bg-gray-50/50">
                <button onClick={closeImportModal} className="px-6 py-3 rounded-xl font-bold text-gray-500 bg-white border border-gray-200 hover:bg-gray-100 transition-colors">
                  Annuler
                </button>
                <button 
                  onClick={handleConfirmImport}
                  disabled={!columnMapping.element}
                  className={cn(
                    "px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center gap-2",
                    columnMapping.element 
                      ? "bg-[#FF851B] hover:bg-[#E76A00]" 
                      : "bg-gray-300 cursor-not-allowed"
                  )}
                >
                  <Upload size={18} />
                  Importer {importData.length} lignes
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Modal Confirmation Suppression */}
      {isDeleteConfirmOpen && selectedTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-[#001F3F] mb-2">Supprimer cette tâche ?</h3>
              <p className="text-gray-500 mb-6">Cette action est irréversible. Voulez-vous vraiment supprimer <strong>{selectedTask.element}</strong> ?</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    // Open edit modal instead
                    setFormData({
                      block_id: selectedTask.block_id?.toString() || '',
                      floor_id: selectedTask.floor_id?.toString() || '',
                      element: selectedTask.element,
                      description: selectedTask.description,
                      start_date: selectedTask.start_date,
                      end_date: selectedTask.end_date,
                      status: selectedTask.status
                    });
                    setIsDeleteConfirmOpen(false);
                    setIsEditModalOpen(true);
                  }}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Modifier
                </button>
                <button 
                  onClick={() => handleDelete(selectedTask.id)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg transition-all active:scale-95"
                >
                  Supprimer
                </button>
              </div>
              <button 
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setSelectedTask(null);
                }}
                className="mt-4 text-sm text-gray-400 hover:text-gray-600 font-medium"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Confirmation Suppression Groupée */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-[#001F3F] mb-2">Supprimer les tâches sélectionnées ?</h3>
              <p className="text-gray-500 mb-6">Voulez-vous vraiment supprimer les <strong>{selectedIds.length}</strong> tâches sélectionnées ? Cette action est irréversible.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsBulkDeleteConfirmOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleBulkDelete}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg transition-all active:scale-95"
                >
                  Supprimer ({selectedIds.length})
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
