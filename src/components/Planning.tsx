import React, { useState, useEffect, useRef } from 'react';
import { Plus, Download, Upload, Trash2, X, Save, Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Block, Floor, Task } from '../types';
import { STATUS_OPTIONS, cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { fetchTasks as loadTasks, fetchBlocks as loadBlocks, fetchFloors as loadFloors, createTask as svcCreateTask, updateTask as svcUpdateTask, deleteTask as svcDeleteTask, bulkDeleteTasks as svcBulkDeleteTasks, fetchElementTypes } from '../lib/supabaseService';
import { useAuth } from '../auth/AuthProvider';

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
  const { role } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [elementTypes, setElementTypes] = useState<{id: number, name: string}[]>([]);

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

  const today = new Date();
  today.setHours(0,0,0,0);
  const [viewStartDate, setViewStartDate] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [selectedBlockFilter, setSelectedBlockFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ganttScrollRef = useRef<HTMLDivElement>(null);
  const leftTableScrollRef = useRef<HTMLDivElement>(null);

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

  const fetchTasks = async () => { setTasks(await loadTasks()); };
  const fetchBlocks = async () => { setBlocks(await loadBlocks()); };
  const fetchFloors = async () => { setFloors(await loadFloors()); };

  const loadTypes = async () => {
    const allTypes = await fetchElementTypes();
    const types = allTypes.filter((t: any) => t.category === 'planning' || t.category === 'les deux');
    setElementTypes(types);
  };

  useEffect(() => {
    if (isModalOpen || isEditModalOpen) {
      loadTypes();
    }
  }, [isModalOpen, isEditModalOpen]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = parseISO(formData.start_date);
    const end = parseISO(formData.end_date);
    const duration = differenceInDays(end, start);

    const isEditing = isEditModalOpen && selectedTask;

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
      if (isEditing) {
        await svcUpdateTask(selectedTask.id, payload);
      } else {
        await svcCreateTask(payload);
      }
      await fetchTasks();
      setIsModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedTask(null);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await svcDeleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      setIsDeleteConfirmOpen(false);
      setSelectedTask(null);
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await svcBulkDeleteTasks(selectedIds);
      setTasks(prev => prev.filter(t => !selectedIds.includes(t.id)));
      setSelectedIds([]);
      setIsBulkDeleteConfirmOpen(false);
    } catch (err) {
      console.error("Erreur lors de la suppression groupée:", err);
    }
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
        await svcCreateTask({
            block_id: block?.id || null,
            floor_id: floor?.id || null,
            element: elementName,
            description: (descVal || elementName || '').toString().trim(),
            start_date: startStr,
            end_date: endStr,
            duration: Math.abs(duration) || 0,
            status: mappedStatus,
            element_type: elementTypeVal ? normalizeElementType(elementTypeVal) : null
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
    if (selectedBlockFilter !== 'all' && task.block_id?.toString() !== selectedBlockFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        task.element?.toLowerCase().includes(q) ||
        task.description?.toLowerCase().includes(q) ||
        task.block_name?.toLowerCase().includes(q) ||
        task.element_type?.toLowerCase().includes(q) ||
        task.floor_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Gantt Chart Logic (MS Project Style)
  const COL_WIDTH = 32; // px par jour
  const daysToShow = 180; // 6 mois affichés
  const timelineDays = eachDayOfInterval({
    start: viewStartDate,
    end: addDays(viewStartDate, daysToShow - 1)
  });

  // Group days by Month for Header 1
  const months: { name: string; colSpan: number }[] = [];
  let currentMonth = '';
  let colSpan = 0;
  timelineDays.forEach(day => {
    const m = format(day, 'MMMM yyyy', { locale: fr });
    const Name = m.charAt(0).toUpperCase() + m.slice(1);
    if (Name !== currentMonth) {
      if (currentMonth) months.push({ name: currentMonth, colSpan });
      currentMonth = Name;
      colSpan = 1;
    } else {
      colSpan++;
    }
  });
  if (currentMonth) months.push({ name: currentMonth, colSpan });

  const handleScrollToToday = () => {
    if (ganttScrollRef.current) {
      const offsetDays = differenceInDays(today, viewStartDate);
      const scrollPos = Math.max(0, offsetDays * COL_WIDTH - ganttScrollRef.current.clientWidth / 2);
      ganttScrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
    }
  };

  const syncScrollLeftToRight = (e: React.UIEvent<HTMLDivElement>) => {
    if (ganttScrollRef.current) {
      ganttScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const syncScrollRightToLeft = (e: React.UIEvent<HTMLDivElement>) => {
    if (leftTableScrollRef.current) {
      leftTableScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  useEffect(() => {
    if (tasks.length > 0) {
      setTimeout(() => {
        handleScrollToToday();
        console.log('ganttRef width:', ganttScrollRef.current?.scrollWidth);
        console.log('today offset:', differenceInDays(new Date(), viewStartDate) * COL_WIDTH);
      }, 100);
    }
  }, [tasks, viewStartDate]);

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-100px)]">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#001F3F]">Planning Chantier</h2>
          <p className="text-gray-500 text-sm sm:text-base">Gérez le calendrier des travaux et importez vos plannings MS Project / Excel.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {selectedIds.length > 0 && role !== 'viewer' && (
            <button 
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100 transition-all text-sm"
            >
              <Trash2 size={16} />
              Supprimer ({selectedIds.length})
            </button>
          )}
          {role !== 'viewer' && (
            <>
              <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.csv,.xml" />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white border border-gray-200 text-gray-700 px-3 sm:px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all text-sm"
              >
                <Upload size={16} />
                Importer
              </button>
            </>
          )}
          <button 
            onClick={handleExport}
            className="bg-white border border-gray-200 text-gray-700 px-3 sm:px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all text-sm"
          >
            <Download size={16} />
            Exporter
          </button>
          {role !== 'viewer' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-[#FF851B] hover:bg-[#E76A00] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 text-sm sm:text-base"
            >
              <Plus size={18} />
              Nouvelle Tâche
            </button>
          )}
        </div>
      </div>

      {/* GANTT VIEW MS PROJECT */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 overflow-hidden min-h-0">
        
        {/* Gantt Tools Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setViewStartDate(addDays(viewStartDate, -7))} className="p-2 hover:bg-white rounded-lg border border-gray-200 transition-colors text-gray-600">
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={handleScrollToToday}
              className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#001F3F] font-bold hover:bg-gray-50 transition-colors shadow-sm"
            >
              Aujourd'hui
            </button>
            <button onClick={() => setViewStartDate(addDays(viewStartDate, 7))} className="p-2 hover:bg-white rounded-lg border border-gray-200 transition-colors text-gray-600">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider hidden md:block">Filtrer :</label>
            <select 
              value={selectedBlockFilter} 
              onChange={(e) => setSelectedBlockFilter(e.target.value)}
              className="bg-white border border-gray-200 text-[#001F3F] px-3 py-1.5 rounded-xl font-bold text-sm focus:ring-2 focus:ring-[#FF851B] outline-none"
            >
              <option value="all">Tous les blocs</option>
              {blocks.map(block => (
                <option key={block.id} value={block.id.toString()}>{block.name}</option>
              ))}
            </select>
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="bg-white border border-gray-200 text-[#001F3F] px-4 py-1.5 rounded-xl text-sm focus:ring-2 focus:ring-[#FF851B] outline-none w-[150px] md:w-[200px]" 
            />
          </div>

          <div className="flex items-center gap-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#3B82F6] rounded-sm shadow-sm"></div> En cours</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#22C55E] rounded-sm shadow-sm"></div> Terminé</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#CBD5E1] rounded-sm shadow-sm"></div> Non commencé</div>
          </div>
        </div>

        {/* SPLIT LAYOUT TABLE + GANTT GRID */}
        <div className="flex-1 overflow-hidden flex relative bg-white">
          
          {/* LEFT TABLE */}
          <div className="w-[350px] md:w-[450px] lg:w-[500px] flex-shrink-0 border-r border-gray-200 flex flex-col z-20 shadow-[2px_0_10px_rgba(0,0,0,0.03)] bg-white">
            
            {/* Headers Left */}
            <div className="flex bg-gray-50 border-b border-gray-200 text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0" style={{ height: '72px' }}>
              {role !== 'viewer' && (
                <div className="w-10 flex items-center justify-center border-r border-gray-200 shrink-0">
                  <input type="checkbox" checked={filteredTasks.length > 0 && selectedIds.length === filteredTasks.length} onChange={toggleSelectAll} className="w-3.5 h-3.5 rounded border-gray-300 text-[#FF851B] focus:ring-[#FF851B]"/>
                </div>
              )}
              <div className="flex-1 p-2 flex items-center border-r border-gray-200 min-w-[120px]">Tâche</div>
              <div className="w-16 md:w-20 p-2 flex items-center border-r border-gray-200 truncate hidden md:flex">Bloc</div>
              <div className="w-16 p-2 flex items-center border-r border-gray-200 truncate">Début</div>
              <div className="w-16 p-2 flex items-center border-r border-gray-200 truncate">Fin</div>
              <div className="w-12 md:w-16 p-2 flex items-center truncate">Durée</div>
            </div>

            {/* Rows Left Scrollable */}
            <div 
              className="flex-1 overflow-y-auto no-scrollbar" 
              ref={leftTableScrollRef} 
              onScroll={syncScrollLeftToRight}
            >
              {filteredTasks.map((task, i) => {
                const start = parseISO(task.start_date);
                const end = parseISO(task.end_date);
                const duration = Math.abs(differenceInDays(end, start)) + 1;
                return (
                  <div key={task.id} className="flex h-10 border-b border-gray-100 hover:bg-gray-50/80 transition-colors text-xs text-[#001F3F] group">
                    {role !== 'viewer' && (
                      <div className="w-10 flex items-center justify-center border-r border-gray-100 shrink-0">
                        <input type="checkbox" checked={selectedIds.includes(task.id)} onChange={() => toggleSelectTask(task.id)} className="w-3.5 h-3.5 rounded border-gray-300 text-[#FF851B] focus:ring-[#FF851B]"/>
                      </div>
                    )}
                    <div className="flex-1 p-2 border-r border-gray-100 flex items-center justify-between min-w-[120px] bg-white group-hover:bg-gray-50/80">
                      <span 
                        className={cn("font-bold truncate", role !== 'viewer' && "cursor-pointer hover:underline")}
                        onClick={() => {
                          if (role === 'viewer') return;
                          setSelectedTask(task);
                          setFormData({
                            block_id: task.block_id?.toString() || '',
                            floor_id: task.floor_id?.toString() || '',
                            element: task.element,
                            description: task.description,
                            start_date: task.start_date,
                            end_date: task.end_date,
                            status: task.status,
                            element_type: task.element_type || '',
                            axes: task.axes || '',
                            surface: task.surface?.toString() || ''
                          });
                          setIsEditModalOpen(true);
                        }}
                      >{task.element}</span>
                      {role !== 'viewer' && (
                        <button onClick={() => { setSelectedTask(task); setIsDeleteConfirmOpen(true); }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <div className="w-16 md:w-20 p-2 border-r border-gray-100 flex items-center truncate text-gray-500 hidden md:flex">{task.block_name || '-'}</div>
                    <div className="w-16 p-2 border-r border-gray-100 flex items-center truncate text-gray-600">{format(start, 'dd/MM')}</div>
                    <div className="w-16 p-2 border-r border-gray-100 flex items-center truncate text-gray-600">{format(end, 'dd/MM')}</div>
                    <div className="w-12 md:w-16 p-2 flex items-center font-bold text-gray-700">{duration} j</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT GANTT */}
          <div 
            className="flex-1 overflow-x-auto overflow-y-auto bg-white relative"
            ref={ganttScrollRef}
            onScroll={syncScrollRightToLeft}
            style={{ overflowX: 'auto', width: '100%' }}
          >
            <div style={{ width: `${timelineDays.length * COL_WIDTH}px`, position: 'relative' }} className="min-w-max">
              
              {/* Timeline Headers (Sticky Top) */}
              <div className="sticky top-0 z-[15] bg-white pointer-events-none">
                {/* Ligne 1 : Mois */}
                <div className="flex h-9 border-b border-gray-200 bg-gray-50 shadow-sm relative z-20">
                  {months.map((m, i) => (
                    <div key={i} className="flex border-r border-gray-200 items-center pl-3" style={{ width: `${m.colSpan * COL_WIDTH}px` }}>
                      <span className="text-xs font-bold text-gray-600 tracking-wide sticky left-2">{m.name}</span>
                    </div>
                  ))}
                </div>
                {/* Ligne 2 : Jours */}
                <div className="flex h-9 text-[10px] bg-white border-b border-gray-200 shadow-sm relative z-20">
                  {timelineDays.map((day, i) => {
                    const isWE = day.getDay() === 0 || day.getDay() === 6;
                    const isToday = isSameDay(day, today);
                    return (
                      <div key={i} className={cn(
                        "flex flex-col items-center justify-center border-r border-gray-100 shrink-0",
                        isToday ? "bg-[#FFF7ED]" : isWE ? "bg-[#F8FAFC]" : ""
                      )} style={{ width: `${COL_WIDTH}px` }}>
                        <span className={isToday ? "text-[#F97316] font-bold" : "text-gray-400"}>{format(day, 'E', {locale: fr}).charAt(0).toUpperCase()}</span>
                        <span className={isToday ? "text-[#F97316] font-black" : "text-gray-600 font-medium"}>{format(day, 'dd')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vertical Today Line & Weekend Backgrounds (Absolute over entire grid) */}
              <div className="absolute top-[72px] bottom-0 left-0 flex pointer-events-none z-0" style={{ width: `${timelineDays.length * COL_WIDTH}px` }}>
                {timelineDays.map((day, i) => {
                  const isWE = day.getDay() === 0 || day.getDay() === 6;
                  const isToday = isSameDay(day, today);
                  return (
                    <div key={i} className={cn(
                      "h-full border-r border-dashed border-gray-100/50 shrink-0 relative",
                      isWE ? "bg-[#F8FAFC]/50" : ""
                    )} style={{ width: `${COL_WIDTH}px` }}>
                      {isToday && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-red-400" style={{ transform: 'translateX(-50%)' }}></div>}
                    </div>
                  );
                })}
              </div>

              {/* Gantt Task Bars */}
              <div className="relative z-10">
                {filteredTasks.map((task) => {
                  const tStart = parseISO(task.start_date);
                  const tEnd = parseISO(task.end_date);
                  
                  const offsetDays = differenceInDays(tStart, viewStartDate);
                  const durationDays = differenceInDays(tEnd, tStart) + 1;
                  
                  // Calcul en pixels
                  const barLeft = offsetDays * COL_WIDTH;
                  const barWidth = Math.max(durationDays * COL_WIDTH, COL_WIDTH); // minimum 1 jour (1 colonne)

                  let bgColor = '#CBD5E1'; // non_commence gris clair
                  if (task.status === 'En cours') bgColor = '#3B82F6';
                  if (task.status === 'Terminé') bgColor = '#22C55E';

                  const isVisible = (barLeft + barWidth > 0) && (barLeft < timelineDays.length * COL_WIDTH);

                  return (
                    <div key={task.id} className="h-10 border-b border-gray-50 flex items-center relative hover:bg-amber-50/20 w-full group">
                      {isVisible && (
                        <div 
                          className="absolute h-[22px] rounded md:rounded-md shadow-sm overflow-hidden flex items-center px-2 cursor-pointer transition-all hover:brightness-110 hover:shadow-md"
                          style={{
                            left: `${Math.max(0, barLeft)}px`,
                            width: `${Math.min(barWidth, barWidth + barLeft)}px`, 
                            backgroundColor: bgColor
                          }}
                          onClick={() => {
                            if (role === 'viewer') return;
                            setSelectedTask(task);
                            setFormData({
                              block_id: task.block_id?.toString() || '',
                              floor_id: task.floor_id?.toString() || '',
                              element: task.element,
                              description: task.description,
                              start_date: task.start_date,
                              end_date: task.end_date,
                              status: task.status,
                              element_type: task.element_type || '',
                              axes: task.axes || '',
                              surface: task.surface?.toString() || ''
                            });
                            setIsEditModalOpen(true);
                          }}
                          title={`${task.element} - ${task.status} (${durationDays} jours)`}
                        >
                          <span className="text-[10px] md:text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis drop-shadow-sm select-none">
                            {task.element}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

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
                  {elementTypes.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
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
