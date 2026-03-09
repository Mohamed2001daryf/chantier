import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Loader2, Save, Filter } from 'lucide-react';
import { ElementType } from '../types';
import { fetchElementTypes, createElementType, deleteElementType } from '../lib/supabaseService';
import { useAuth } from '../auth/AuthProvider';

export default function TypesElements() {
  const { role } = useAuth();
  const [elementTypes, setElementTypes] = useState<ElementType[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCategory, setNewTypeCategory] = useState<'suivi' | 'planning' | 'les deux'>('les deux');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    setLoading(true);
    const types = await fetchElementTypes();
    setElementTypes(types);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    
    setActionLoading(true);
    try {
      await createElementType(newTypeName, newTypeCategory);
      setNewTypeName('');
      setNewTypeCategory('les deux');
      await loadTypes();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la création');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Supprimer le type "${name}" ? \n\nLes éléments existants qui utilisent ce type ne seront pas affectés, mais ce type ne sera plus proposé dans les menus.`)) return;
    
    setActionLoading(true);
    try {
      await deleteElementType(id);
      await loadTypes();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
    } finally {
      setActionLoading(false);
    }
  };

  if (role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <Tag size={32} />
        </div>
        <h2 className="text-xl font-bold text-[#001F3F] mb-2">Accès restreint</h2>
        <p className="text-gray-500 max-w-md">
          Seul l'administrateur du projet peut gérer les types d'éléments personnalisés.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#001F3F]">Types d'Éléments</h2>
        <p className="text-gray-500">Configurez les types d'éléments disponibles pour le Suivi des Travaux et le Planning.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header & Add Form */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-700 mb-1">Nom du type</label>
              <input 
                type="text" 
                value={newTypeName} 
                onChange={e => setNewTypeName(e.target.value)} 
                placeholder="ex: Semelles, Acrotères, Poutres..." 
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF851B] outline-none"
                required 
              />
            </div>
            <div className="w-full sm:w-64 shrink-0">
              <label className="block text-sm font-bold text-gray-700 mb-1">Catégorie</label>
              <select 
                value={newTypeCategory} 
                onChange={e => setNewTypeCategory(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF851B] outline-none bg-white"
              >
                <option value="les deux">Les deux modules</option>
                <option value="suivi">Suivi des Travaux uniquement</option>
                <option value="planning">Planning uniquement</option>
              </select>
            </div>
            <button 
              type="submit" 
              disabled={actionLoading || !newTypeName.trim()} 
              className="w-full sm:w-auto bg-[#FF851B] hover:bg-[#E76A00] text-white px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-60 whitespace-nowrap h-[42px]"
            >
              {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Ajouter
            </button>
          </form>
        </div>

        {/* List */}
        <div className="p-0">
          {loading ? (
            <div className="p-12 flex justify-center text-[#FF851B]">
              <Loader2 size={32} className="animate-spin" />
            </div>
          ) : elementTypes.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Aucun type d'élément configuré.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {elementTypes.map((type) => (
                <div key={type.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <span className="font-bold text-gray-800">{type.name}</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                      <Filter size={12} />
                      {type.category === 'les deux' ? 'Suivi & Planning' : 
                       type.category === 'suivi' ? 'Suivi Travaux' : 'Planning'}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleDelete(type.id, type.name)}
                    disabled={actionLoading}
                    className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    title="Supprimer ce type"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
