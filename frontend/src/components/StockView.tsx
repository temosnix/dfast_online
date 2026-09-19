import React, { useState } from 'react';
import { 
  Search, 
  MapPin, 
  Edit3, 
  Check, 
  X, 
  AlertTriangle, 
  Layers, 
  Tag, 
  ArrowUpDown,
  Filter
} from 'lucide-react';
import { StockItem } from '../types';

interface StockViewProps {
  stock: StockItem[];
  onUpdateStock: (idNissi: string, saldo: number, minimo: number, local: string) => Promise<void>;
  loading: boolean;
}

export const StockView: React.FC<StockViewProps> = ({ stock, onUpdateStock, loading }) => {
  const [search, setSearch] = useState('');
  const [selectedAisle, setSelectedAisle] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editForm, setEditForm] = useState({
    saldo_atual: 0,
    estoque_minimo: 5,
    local: '',
  });
  const [saving, setSaving] = useState(false);

  // Extract unique aisles from locations (e.g., 'A' from 'A13', 'B' from 'B26')
  const aisles = Array.from(
    new Set(
      stock
        .map(i => (i.local && typeof i.local === 'string') ? i.local.charAt(0).toUpperCase() : '')
        .filter(Boolean)
    )
  ).sort();

  const filteredStock = stock.filter(item => {
    const q = (search || '').toLowerCase().trim();
    const idStr = String(item.id_nissi ?? '').toLowerCase();
    const descStr = String(item.descricao ?? '').toLowerCase();
    const localStr = String(item.local ?? '').toLowerCase();

    const matchesSearch = !q || idStr.includes(q) || descStr.includes(q) || localStr.includes(q);

    const matchesAisle = 
      selectedAisle === 'all' || 
      (Boolean(item.local) && String(item.local).toUpperCase().startsWith(selectedAisle));

    return matchesSearch && matchesAisle;
  });

  const handleStartEdit = (item: StockItem) => {
    setEditingItem(item);
    setEditForm({
      saldo_atual: item.saldo_atual,
      estoque_minimo: item.estoque_minimo,
      local: item.local || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      await onUpdateStock(
        editingItem.id_nissi,
        editForm.saldo_atual,
        editForm.estoque_minimo,
        editForm.local
      );
      setEditingItem(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Search & Aisle Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código Nissi, descrição ou gaveta..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Aisle Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Corredor:
          </span>
          <button
            onClick={() => setSelectedAisle('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedAisle === 'all'
                ? 'bg-sky-500 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todos
          </button>
          {aisles.map(aisle => (
            <button
              key={aisle}
              onClick={() => setSelectedAisle(aisle)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedAisle === aisle
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Corredor {aisle}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              <span>Itens Cadastrados no Distribuidor Nissi</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Localização física no galpão, saldos e ponto de pedido de reposição.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {filteredStock.length} itens listados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4 text-center">Localização</th>
                <th className="py-3.5 px-4">Código Nissi</th>
                <th className="py-3.5 px-4">Descrição da Peça</th>
                <th className="py-3.5 px-4 text-center">Unidade</th>
                <th className="py-3.5 px-4 text-center">Saldo Físico</th>
                <th className="py-3.5 px-4 text-center">Estoque Mínimo</th>
                <th className="py-3.5 px-4 text-center">Anúncios ML</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredStock.map(item => {
                const isEditing = editingItem?.id_nissi === item.id_nissi;
                const isLowStock = item.saldo_atual <= item.estoque_minimo;

                return (
                  <tr key={item.id_nissi} className="hover:bg-slate-800/40 transition-colors">
                    {/* Localização */}
                    <td className="py-4 px-4 text-center">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.local}
                          onChange={e => setEditForm({ ...editForm, local: e.target.value })}
                          className="w-20 px-2 py-1 bg-slate-950 border border-sky-500 rounded text-center text-xs font-mono text-sky-300 font-bold"
                        />
                      ) : (
                        <span className="inline-flex items-center justify-center font-mono font-black text-sm px-3 py-1.5 rounded-xl bg-slate-950 text-sky-300 border border-slate-800 shadow-sm">
                          {item.local || 'S/L'}
                        </span>
                      )}
                    </td>

                    {/* Código Nissi */}
                    <td className="py-4 px-4 font-mono font-bold text-white">
                      {item.id_nissi}
                    </td>

                    {/* Descrição */}
                    <td className="py-4 px-4 font-medium text-slate-200 max-w-sm">
                      {item.descricao}
                    </td>

                    {/* Unidade */}
                    <td className="py-4 px-4 text-center text-slate-400">
                      {item.unidade_medida}
                    </td>

                    {/* Saldo Físico */}
                    <td className="py-4 px-4 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.saldo_atual}
                          onChange={e => setEditForm({ ...editForm, saldo_atual: parseInt(e.target.value, 10) || 0 })}
                          className="w-20 px-2 py-1 bg-slate-950 border border-sky-500 rounded text-center text-xs font-bold text-white"
                        />
                      ) : (
                        <span className={`inline-flex items-center gap-1 font-extrabold text-sm px-2.5 py-1 rounded-lg ${
                          isLowStock 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30' 
                            : 'text-slate-200'
                        }`}>
                          {item.saldo_atual} un
                          {isLowStock && <AlertTriangle className="w-3.5 h-3.5 text-red-400 inline" />}
                        </span>
                      )}
                    </td>

                    {/* Estoque Mínimo */}
                    <td className="py-4 px-4 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.estoque_minimo}
                          onChange={e => setEditForm({ ...editForm, estoque_minimo: parseInt(e.target.value, 10) || 0 })}
                          className="w-16 px-2 py-1 bg-slate-950 border border-sky-500 rounded text-center text-xs font-bold text-white"
                        />
                      ) : (
                        <span className="text-slate-400 font-medium">
                          {item.estoque_minimo} un
                        </span>
                      )}
                    </td>

                    {/* Anúncios Vinculados */}
                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-semibold text-[11px] border border-slate-700">
                        {item.total_anuncios_vinculados} anúncios
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="py-4 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="p-1.5 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold transition-all"
                            title="Salvar alterações"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>
                          <button
                            onClick={() => setEditingItem(null)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                          <span>Editar</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
