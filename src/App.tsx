import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  Construction, 
  Layers, 
  Box, 
  ArrowUpCircle, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  FileText,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Loader2,
  Settings as SettingsIcon,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';
import { useAuth } from './auth/AuthProvider';
import Login from './auth/Login';

// Components
import Dashboard from './components/Dashboard';
import Planning from './components/Planning';
import SuiviTravaux from './components/SuiviTravaux';
import DallesPostTension from './components/DallesPostTension';
import GestionBlocs from './components/GestionBlocs';
import GestionEtages from './components/GestionEtages';
import Equipes from './components/Equipes';
import Productivite from './components/Productivite';
import Retards from './components/Retards';
import Rapports from './components/Rapports';
import Settings from './components/Settings';
import TypesElements from './components/TypesElements';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, component: Dashboard },
  { id: 'planning', label: 'Planning', icon: Calendar, component: Planning },
  { id: 'suivi', label: 'Suivi des travaux', icon: Construction, component: SuiviTravaux },
  { id: 'dalles', label: 'Dalles post-tension', icon: Layers, component: DallesPostTension },
  { id: 'blocs', label: 'Gestion des blocs', icon: Box, component: GestionBlocs },
  { id: 'etages', label: 'Gestion des étages', icon: ArrowUpCircle, component: GestionEtages },
  { id: 'types-elements', label: 'Types d\'Éléments', icon: Tag, component: TypesElements, adminOnly: true },
  { id: 'equipes', label: 'Équipes', icon: Users, component: Equipes },
  { id: 'productivite', label: 'Productivité', icon: TrendingUp, component: Productivite },
  { id: 'retards', label: 'Retards', icon: AlertTriangle, component: Retards },
  { id: 'rapports', label: 'Rapports', icon: FileText, component: Rapports },
  { id: 'settings', label: 'Paramètres', icon: SettingsIcon, component: Settings },
];

export default function App() {
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on navigation
  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{
        background: 'linear-gradient(135deg, #001F3F 0%, #003366 50%, #001F3F 100%)'
      }}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FF851B] rounded-2xl shadow-lg shadow-[#FF851B]/30 mb-4">
            <span className="text-2xl font-black text-white">CP</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-white/60">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <Login />;
  }

  // Extract display name from user metadata or fallback to email
  const userDisplayName = user.user_metadata?.full_name || user.email || 'Utilisateur';
  
  // Filter menu items based on role
  const { role } = useAuth();
  const visibleMenuItems = MENU_ITEMS.filter(item => {
    if ((item as any).adminOnly && role !== 'admin') return false;
    return true;
  });
  const userInitials = userDisplayName.slice(0, 2).toUpperCase();

  const ActiveComponent = MENU_ITEMS.find(item => item.id === activeTab)?.component || Dashboard;

  // Sidebar content (shared between desktop and mobile)
  const sidebarContent = (isMobile: boolean) => {
    const isOpen = isMobile ? true : isSidebarOpen;
    return (
      <>
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-[#FF851B] rounded flex items-center justify-center font-bold text-white">CP</div>
              <span className="font-bold text-lg tracking-tight">ChantierPro</span>
            </motion.div>
          )}
          <button 
            onClick={() => isMobile ? setIsMobileMenuOpen(false) : setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          {visibleMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all group relative",
                activeTab === item.id 
                  ? "bg-[#FF851B] text-white shadow-lg" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon size={22} className={cn(activeTab === item.id ? "text-white" : "group-hover:text-white")} />
              {isOpen && (
                <motion.span 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-medium"
                >
                  {item.label}
                </motion.span>
              )}
              {!isOpen && activeTab === item.id && (
                <div className="absolute left-0 w-1 h-8 bg-white rounded-r-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          {isOpen ? (
              <div 
                className="flex items-center gap-3 px-2 cursor-pointer hover:bg-white/5 rounded-lg p-2 transition-colors"
                onClick={() => handleNavClick('settings')}
                title="Paramètres du compte"
              >
              <div className="w-10 h-10 rounded-full bg-[#FF851B]/20 border-2 border-[#FF851B] flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[#FF851B]">{userInitials}</span>
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-semibold truncate">{userDisplayName}</span>
                <span className="text-xs text-gray-400 italic truncate">{user.email}</span>
              </div>
              <button
                id="logout-button"
                onClick={(e) => { e.stopPropagation(); signOut(); }}
                title="Se déconnecter"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-red-400 shrink-0"
              >
                <LogOut size={18} />
              </button>
              </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#FF851B]/20 border-2 border-[#FF851B] flex items-center justify-center">
                <span className="text-xs font-bold text-[#FF851B]">{userInitials}</span>
              </div>
              <button
                onClick={signOut}
                title="Se déconnecter"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-red-400"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex h-screen bg-[#F3F4F6] font-sans text-[#1F2937]">
      {/* Desktop Sidebar — hidden on mobile */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="hidden md:flex bg-[#001F3F] text-white flex-col shadow-xl z-50 relative"
      >
        {sidebarContent(false)}
      </motion.aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] md:hidden"
            />
            {/* Slide-in Sidebar */}
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-[#001F3F] text-white flex flex-col shadow-2xl z-[100] md:hidden"
            >
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 md:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shadow-sm shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {/* Hamburger menu — visible only on mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={22} className="text-[#001F3F]" />
            </button>
            <span className="text-sm font-medium text-gray-500 hidden sm:inline">Projet: Résidence Les Horizons</span>
            <ChevronRight size={14} className="text-gray-400 hidden sm:inline" />
            <span className="text-sm font-bold text-[#001F3F] truncate">
              {MENU_ITEMS.find(i => i.id === activeTab)?.label}
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <p className="text-xs text-gray-400 font-medium hidden sm:block">Date du jour</p>
              <p className="text-xs sm:text-sm font-bold text-[#001F3F]">
                {new Date().toLocaleDateString('fr-FR', {
                  weekday: window.innerWidth >= 640 ? 'long' : 'short',
                  year: 'numeric',
                  month: window.innerWidth >= 640 ? 'long' : 'short',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
