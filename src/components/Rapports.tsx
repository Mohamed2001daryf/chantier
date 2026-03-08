import React, { useState, useEffect } from 'react';
import { FileText, Download, Printer, FileSpreadsheet, FilePieChart, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Task, Slab, Block, ProductivityRecord, VerticalElement } from '../types';
import { format, parseISO, isWithinInterval, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { fetchTasks as loadTasks, fetchSlabs as loadSlabs, fetchBlocks as loadBlocks, fetchProductivity as loadProductivity, fetchVerticalElements as loadVerticalElements } from '../lib/supabaseService';

export default function Rapports() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [productivity, setProductivity] = useState<ProductivityRecord[]>([]);
  const [verticalElements, setVerticalElements] = useState<VerticalElement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksRes, slabsRes, blocksRes, prodRes, veRes] = await Promise.all([
          loadTasks(),
          loadSlabs(),
          loadBlocks(),
          loadProductivity(),
          loadVerticalElements()
        ]);
        setTasks(tasksRes);
        setSlabs(slabsRes);
        setBlocks(blocksRes);
        setProductivity(prodRes);
        setVerticalElements(veRes);
      } catch (error) {
        console.error("Erreur lors du chargement des données pour les rapports:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const generatePDF = (id: string, title: string) => {
    const doc = new jsPDF();
    const projectName = "ChantierPro Suite - projet-01";
    const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: fr });

    // Filename mapping
    const filenameMap: Record<string, string> = {
      'hebdo': 'rapport_hebdomadaire.pdf',
      'prod': 'rapport_productivite.pdf',
      'avancement': 'rapport_avancement.pdf',
      'retards': 'rapport_retards.pdf'
    };

    // Header
    doc.setFillColor(0, 31, 63); // #001F3F
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(projectName, 20, 20);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(title, 20, 30);
    doc.text(`Date du rapport: ${dateStr}`, 140, 30);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    // Common Planning Summary
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Terminé').length;
    const inProgressTasks = tasks.filter(t => t.status === 'En cours').length;
    const notStartedTasks = tasks.filter(t => t.status === 'Non commencé').length;
    const delayedTasksCount = tasks.filter(t => t.status !== 'Terminé' && parseISO(t.end_date) < new Date()).length;
    const globalProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    if (id === 'hebdo') {
      doc.setFont("helvetica", "bold");
      doc.text("Résumé du Planning Global", 20, 50);
      doc.setFont("helvetica", "normal");
      doc.text(`Progression globale: ${globalProgress}%`, 20, 57);
      doc.text(`Tâches terminées: ${completedTasks} / ${totalTasks}`, 20, 64);
      doc.text(`Tâches en cours: ${inProgressTasks}`, 100, 64);
      doc.text(`Tâches en retard: ${delayedTasksCount}`, 20, 71);

      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      
      const weeklyTasks = tasks.filter(t => {
        const start = parseISO(t.start_date);
        const end = parseISO(t.end_date);
        return isWithinInterval(start, { start: weekStart, end: weekEnd }) || 
               isWithinInterval(end, { start: weekStart, end: weekEnd }) ||
               (start < weekStart && end > weekEnd);
      });

      doc.setFont("helvetica", "bold");
      doc.text("Activités de la Semaine", 20, 85);
      
      autoTable(doc, {
        startY: 90,
        head: [['Élément', 'Bloc', 'Étage', 'Début', 'Fin', 'Statut']],
        body: weeklyTasks.map(t => [
          t.element,
          t.block_name || 'Général',
          t.floor_name || 'N/A',
          format(parseISO(t.start_date), 'dd/MM/yy'),
          format(parseISO(t.end_date), 'dd/MM/yy'),
          t.status
        ]),
        headStyles: { fillColor: [0, 31, 63] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

    } else if (id === 'prod') {
      doc.setFont("helvetica", "bold");
      doc.text("Productivité des Équipes", 20, 50);
      doc.setFont("helvetica", "normal");
      
      autoTable(doc, {
        startY: 55,
        head: [['Date', 'Équipe', 'Bloc', 'Type Travail', 'Effectif', 'Quantité']],
        body: productivity.map(p => [
          format(parseISO(p.date), 'dd/MM/yy'),
          p.team_name,
          p.block_name,
          p.work_type,
          p.workers_count,
          p.quantity_realized
        ]),
        headStyles: { fillColor: [255, 133, 27] }, // #FF851B
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

    } else if (id === 'avancement') {
      doc.setFont("helvetica", "bold");
      doc.text("Progression par Bloc", 20, 50);
      doc.setFont("helvetica", "normal");

      const blockProgress = blocks.map(b => {
        const blockTasks = tasks.filter(t => t.block_id === b.id);
        const done = blockTasks.filter(t => t.status === 'Terminé').length;
        const total = blockTasks.length;
        const prog = total > 0 ? Math.round((done / total) * 100) : 0;
        return [b.name, b.zone, `${prog}%`, `${done}/${total}`];
      });

      autoTable(doc, {
        startY: 55,
        head: [['Bloc', 'Zone', 'Progression', 'Tâches Terminées']],
        body: blockProgress,
        headStyles: { fillColor: [0, 31, 63] },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 60;
      const nextY = finalY + 15;
      doc.setFont("helvetica", "bold");
      doc.text("Détail Dalles Post-Tension", 20, nextY);
      
      autoTable(doc, {
        startY: nextY + 5,
        head: [['Dalle', 'Bloc', 'Étage', 'Surface', 'Statut', 'Coulage']],
        body: slabs.map(s => [
          s.name,
          s.block_name,
          s.floor_name,
          `${s.surface} m²`,
          s.status,
          s.coulage_status
        ]),
        headStyles: { fillColor: [0, 31, 63] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

    } else if (id === 'retards') {
      const delayedTasks = tasks.filter(t => {
        if (t.status === 'Terminé') return false;
        return parseISO(t.end_date) < new Date();
      });

      doc.setTextColor(220, 38, 38); // Red
      doc.setFont("helvetica", "bold");
      doc.text(`ALERTE: ${delayedTasks.length} tâches en retard`, 20, 50);
      doc.setTextColor(0, 0, 0);
      
      autoTable(doc, {
        startY: 55,
        head: [['Élément', 'Bloc', 'Étage', 'Date Prévue', 'Retard (jours)']],
        body: delayedTasks.map(t => {
          const delay = Math.ceil((new Date().getTime() - parseISO(t.end_date).getTime()) / (1000 * 60 * 60 * 24));
          return [
            t.element,
            t.block_name || 'Général',
            t.floor_name || 'N/A',
            format(parseISO(t.end_date), 'dd/MM/yy'),
            delay > 0 ? delay.toString() : '0'
          ];
        }),
        headStyles: { fillColor: [220, 38, 38] },
        alternateRowStyles: { fillColor: [254, 242, 242] },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`ChantierPro Suite - Rapport de Chantier - Page ${i} sur ${pageCount}`, 105, 285, { align: 'center' });
    }
    
    doc.save(filenameMap[id] || `rapport_${id}.pdf`);
  };

  const REPORT_TYPES = [
    { id: 'hebdo', title: 'Rapport Hebdomadaire', icon: FileText, desc: 'Résumé complet de la semaine écoulée.' },
    { id: 'prod', title: 'Rapport Productivité', icon: FilePieChart, desc: 'Analyse détaillée du rendement des équipes.' },
    { id: 'avancement', title: 'Rapport Avancement', icon: FileSpreadsheet, desc: 'État des lieux global par bloc et zone.' },
    { id: 'retards', title: 'Rapport Retards', icon: Printer, desc: 'Liste des tâches critiques et impacts planning.' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-[#FF851B]" size={48} />
        <p className="text-gray-500 font-bold">Préparation du centre de rapports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-[#001F3F]">Centre de Rapports</h2>
        <p className="text-gray-500 text-sm sm:text-base">Générez et exportez des rapports professionnels pour vos réunions de chantier.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {REPORT_TYPES.map((report) => (
          <div key={report.id} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between hover:border-[#FF851B]/50 transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 text-[#001F3F] flex items-center justify-center group-hover:bg-[#001F3F] group-hover:text-white transition-all">
                <report.icon size={32} />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => generatePDF(report.id, report.title)}
                  className="p-2 text-gray-400 hover:text-[#001F3F] hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Printer size={20} />
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-black text-[#001F3F] mb-2">{report.title}</h3>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">{report.desc}</p>
              <button 
                onClick={() => generatePDF(report.id, report.title)}
                className="w-full bg-[#001F3F] hover:bg-[#002F5F] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
              >
                <Download size={20} />
                Générer PDF
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#001F3F] p-8 rounded-3xl text-white relative overflow-hidden">
        <div className="relative z-10 max-w-lg">
          <h3 className="text-2xl font-black mb-2">Besoin d'un rapport personnalisé ?</h3>
          <p className="text-white/60 mb-6">Notre équipe peut configurer des extractions de données spécifiques à vos besoins contractuels.</p>
          <button className="bg-[#FF851B] hover:bg-[#E76A00] text-white px-8 py-3 rounded-xl font-bold transition-all">
            Contacter le Support
          </button>
        </div>
        <FileText size={200} className="absolute -right-10 -bottom-10 text-white/5 rotate-12" />
      </div>
    </div>
  );
}
