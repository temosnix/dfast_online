import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  Edit3, 
  Trash2,
  Plus, 
  Layers, 
  AlertTriangle, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Box,
  PlusCircle,
  MinusCircle,
  PackageCheck,
  Building2,
  AlertCircle,
  UploadCloud
} from 'lucide-react';
import { StockItem, StockMetrics } from '../types';
import { StockModal } from './StockModal';
import { StockDeleteModal } from './StockDeleteModal';
import { ImportXmlModal } from './ImportXmlModal';
import { authFetch } from '../api';

interface StockViewProps {
  stock: StockItem[];
  metrics?: StockMetrics | null;
  onRefresh: () => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  loading: boolean;
  isMaster?: boolean;
}

type SortField = 'id_nissi' | 'descricao' | 'local' | 'saldo_atual' | 'total_anuncios_vinculados';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'low_stock' | 'unassigned_local';

export const StockView: React.FC<StockViewProps> = ({ 
  stock, 
  metrics,
  onRefresh, 
  showNotification,
  loading,
  isMaster = true
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedAisle, setSelectedAisle] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('local');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);

  // Delete Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);

  // Import XML Modal State
  const [isImportXmlOpen, setIsImportXmlOpen] = useState(false);

  // Quick Adjustment Loading State
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  // Calculated Metrics fallback
  const totalItems = metrics?.total_items ?? stock.length;
  const totalUnits = metrics?.total_units ?? stock.reduce((sum, item) => sum + (item.saldo_atual || 0), 0);
  const lowStockCount = metrics?.low_stock_count ?? stock.filter(item => (item.saldo_atual || 0) <= (item.estoque_minimo || 5)).length;
  const unassignedLocalCount = metrics?.unassigned_local_count ?? stock.filter(item => !item.local || item.local === 'S/L' || item.local.trim() === '').length;

  // Extract unique aisles from locations
  const aisles = useMemo(() => {
    return Array.from(
      new Set(
        stock
          .map(i => (i.local && typeof i.local === 'string' && i.local !== 'S/L') ? i.local.charAt(0).toUpperCase() : '')
          .filter(Boolean)
      )
    ).sort();
  }, [stock]);

  // Filtering & Sorting
  const filteredAndSortedStock = useMemo(() => {
    const q = (search || '').toLowerCase().trim();

    return stock
      .filter(item => {
        // Status filter
        if (statusFilter === 'low_stock') {
          const isLow = (item.saldo_atual || 0) <= (item.estoque_minimo || 5);
          if (!isLow) return false;
        } else if (statusFilter === 'unassigned_local') {
          const isUnassigned = !item.local || item.local === 'S/L' || item.local.trim() === '';
          if (!isUnassigned) return false;
        }

        // Aisle filter
        if (selectedAisle !== 'all') {
          const matchesAisle = Boolean(item.local) && String(item.local).toUpperCase().startsWith(selectedAisle);
          if (!matchesAisle) return false;
        }

        // Search query filter (100% null-safe)
        if (q) {
          const idStr = String(item.id_nissi ?? '').toLowerCase();
          const descStr = String(item.descricao ?? '').toLowerCase();
          const localStr = String(item.local ?? '').toLowerCase();
          if (!idStr.includes(q) && !descStr.includes(q) && !localStr.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string') {
          valA = (valA || '').toLowerCase();
          valB = (valB || '').toString().toLowerCase();
          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        } else {
          const numA = Number(valA) || 0;
          const numB = Number(valB) || 0;
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }
      });
  }, [stock, search, statusFilter, selectedAisle, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Quick Adjustment (+1 / -1)
  const handleQuickAdjust = async (item: StockItem, delta: number) => {
    setAdjustingId(item.id_nissi);
    try {
      const res = await authFetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_nissi: item.id_nissi,
          delta: delta,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.message || `Saldo de ${item.id_nissi} atualizado!`);
        onRefresh();
      } else {
        showNotification(data.error || 'Erro ao ajustar estoque.', 'error');
      }
    } catch (err) {
      showNotification('Erro de conexão ao ajustar estoque.', 'error');
    } finally {
      setAdjustingId(null);
    }
  };

  const handleOpenCreate = () => {
    setSelectedItem(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: StockItem) => {
    setSelectedItem(item);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleOpenDelete = (item: StockItem) => {
    setItemToDelete(item);
    setIsDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Total Peças Cadastradas */}
        <div 
          onClick={() => { setStatusFilter('all'); setSelectedAisle('all'); setSearch(''); }}
          className={`bg-slate-900/60 border rounded-2xl p-5 shadow-lg cursor-pointer transition-all hover:border-slate-700 ${
            statusFilter === 'all' && selectedAisle === 'all' ? 'border-sky-500/40 bg-sky-500/5' : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total no Catálogo</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-extrabold text-white">{totalItems}</h3>
            <span className="text-xs text-slate-400">itens</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Peças do Distribuidor Nissi
          </p>
        </div>

        {/* Total Unidades Físicas */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Saldo Físico Geral</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Box className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-extrabold text-emerald-300">{totalUnits}</h3>
            <span className="text-xs text-slate-400">unidades</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Estoque total contado em galpão
          </p>
        </div>

        {/* Estoque Baixo / Reposição */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'low_stock' ? 'all' : 'low_stock')}
          className={`bg-slate-900/60 border rounded-2xl p-5 shadow-lg cursor-pointer transition-all hover:border-amber-500/50 ${
            statusFilter === 'low_stock' 
              ? 'border-amber-500 bg-amber-500/10' 
              : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Estoque Baixo / Mínimo</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-extrabold text-amber-300">{lowStockCount}</h3>
            <span className="text-xs text-slate-400">itens críticos</span>
          </div>
          <p className="text-xs text-amber-300/80 mt-2 font-medium">
            {statusFilter === 'low_stock' ? '✓ Filtro ativo (clique para limpar)' : 'Clique para filtrar peças em falta'}
          </p>
        </div>

        {/* Sem Localização no Galpão */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'unassigned_local' ? 'all' : 'unassigned_local')}
          className={`bg-slate-900/60 border rounded-2xl p-5 shadow-lg cursor-pointer transition-all hover:border-purple-500/50 ${
            statusFilter === 'unassigned_local' 
              ? 'border-purple-500 bg-purple-500/10' 
              : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300">Sem Prateleira (S/L)</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-extrabold text-purple-300">{unassignedLocalCount}</h3>
            <span className="text-xs text-slate-400">sem endereço</span>
          </div>
          <p className="text-xs text-purple-300/80 mt-2 font-medium">
            {statusFilter === 'unassigned_local' ? '✓ Filtro ativo (clique para limpar)' : 'Clique para ver peças sem prateleira'}
          </p>
        </div>
      </div>

      {/* 2. Top Controls & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800 no-print">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código Nissi, descrição ou localização..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Filters & Add Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('low_stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'low_stock' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              🚨 Estoque Baixo ({lowStockCount})
            </button>
            <button
              onClick={() => setStatusFilter('unassigned_local')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'unassigned_local' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚠️ Sem Local ({unassignedLocalCount})
            </button>
          </div>

          {/* Aisle Filter */}
          {aisles.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Corredor:
              </span>
              <button
                onClick={() => setSelectedAisle('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedAisle === 'all' ? 'bg-sky-500 text-white' : 'text-slate-400'
                }`}
              >
                Todos
              </button>
              {aisles.slice(0, 6).map(aisle => (
                <button
                  key={aisle}
                  onClick={() => setSelectedAisle(aisle)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedAisle === aisle ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {aisle}
                </button>
              ))}
            </div>
          )}

          {/* Ações Exclusivas Master: Importar XML e Novo Item */}
          {isMaster && (
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                onClick={() => setIsImportXmlOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
                title="Importar unidades de estoque através do arquivo XML da NF-e do distribuidor"
              >
                <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                <span>Importar XML</span>
              </button>

              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-sky-500/20 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Novo Item</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Stock Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              <span>Itens Cadastrados no Distribuidor Nissi</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Gerencie localização no galpão, saldos físicos e estoque de segurança.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {filteredAndSortedStock.length} de {stock.length} itens listados
          </span>
        </div>

        {filteredAndSortedStock.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <Layers className="w-12 h-12 mx-auto text-slate-700 mb-3" />
            <p className="font-semibold text-slate-300">Nenhum item encontrado.</p>
            <p className="text-xs mt-1">Tente ajustar os termos da busca ou os filtros de corredor e status.</p>
            {search && (
              <button
                onClick={() => { setSearch(''); setStatusFilter('all'); setSelectedAisle('all'); }}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
              >
                Limpar Busca
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none">
                  {/* Localização */}
                  <th 
                    onClick={() => handleSort('local')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Local</span>
                      {sortField === 'local' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-400" /> : <ArrowDown className="w-3 h-3 text-sky-400" />
                      )}
                    </div>
                  </th>

                  {/* Código Nissi */}
                  <th 
                    onClick={() => handleSort('id_nissi')}
                    className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Código Nissi</span>
                      {sortField === 'id_nissi' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-400" /> : <ArrowDown className="w-3 h-3 text-sky-400" />
                      )}
                    </div>
                  </th>

                  {/* Descrição */}
                  <th 
                    onClick={() => handleSort('descricao')}
                    className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Descrição da Peça</span>
                      {sortField === 'descricao' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-400" /> : <ArrowDown className="w-3 h-3 text-sky-400" />
                      )}
                    </div>
                  </th>

                  {/* Unidade */}
                  <th className="py-3.5 px-4 text-center">Unidade</th>

                  {/* Saldo Físico (+ Rápido Ajuste) */}
                  <th 
                    onClick={() => handleSort('saldo_atual')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Saldo Físico</span>
                      {sortField === 'saldo_atual' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-400" /> : <ArrowDown className="w-3 h-3 text-sky-400" />
                      )}
                    </div>
                  </th>

                  {/* Estoque Mínimo */}
                  <th className="py-3.5 px-4 text-center">Mínimo</th>

                  {/* Anúncios ML */}
                  <th 
                    onClick={() => handleSort('total_anuncios_vinculados')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Anúncios ML</span>
                      {sortField === 'total_anuncios_vinculados' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-400" /> : <ArrowDown className="w-3 h-3 text-sky-400" />
                      )}
                    </div>
                  </th>

                  {/* Ações */}
                  {isMaster && <th className="py-3.5 px-4 text-right">Ações</th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredAndSortedStock.map(item => {
                  const isLowStock = item.saldo_atual <= item.estoque_minimo;
                  const isAdjusting = adjustingId === item.id_nissi;

                  return (
                    <tr key={item.id_nissi} className="hover:bg-slate-800/40 transition-colors group">
                      {/* Localização */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center justify-center font-mono font-black text-sm px-3 py-1.5 rounded-xl border shadow-sm ${
                          item.local && item.local !== 'S/L'
                            ? 'bg-gradient-to-r from-sky-500/20 to-emerald-500/20 text-sky-300 border-sky-500/40'
                            : 'bg-slate-950 text-slate-500 border-slate-800'
                        }`}>
                          {item.local || 'S/L'}
                        </span>
                      </td>

                      {/* Código Nissi */}
                      <td className="py-4 px-4 font-mono font-bold text-white whitespace-nowrap">
                        {item.id_nissi}
                      </td>

                      {/* Descrição */}
                      <td className="py-4 px-4 font-medium text-slate-200 max-w-md">
                        <p className="truncate" title={item.descricao}>
                          {item.descricao}
                        </p>
                      </td>

                      {/* Unidade */}
                      <td className="py-4 px-4 text-center font-bold text-slate-400">
                        {item.unidade_medida || 'UN'}
                      </td>

                      {/* Saldo Físico */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {isMaster ? (
                          <div className="inline-flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                            {/* Botão -1 */}
                            <button
                              type="button"
                              disabled={isAdjusting || item.saldo_atual <= 0}
                              onClick={() => handleQuickAdjust(item, -1)}
                              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
                              title="Subtrair 1 unidade do estoque físico"
                            >
                              <MinusCircle className="w-4 h-4 text-slate-400 hover:text-rose-400 transition-colors" />
                            </button>

                            {/* Saldo Badge */}
                            <span className={`px-2.5 py-0.5 rounded-lg font-black text-xs min-w-[50px] text-center ${
                              isLowStock
                                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}>
                              {item.saldo_atual} un
                            </span>

                            {/* Botão +1 */}
                            <button
                              type="button"
                              disabled={isAdjusting}
                              onClick={() => handleQuickAdjust(item, 1)}
                              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
                              title="Adicionar 1 unidade ao estoque físico"
                            >
                              <PlusCircle className="w-4 h-4 text-slate-400 hover:text-emerald-400 transition-colors" />
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-block px-3 py-1 rounded-lg font-black text-xs text-center ${
                            isLowStock
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}>
                            {item.saldo_atual} un
                          </span>
                        )}
                      </td>

                      {/* Estoque Mínimo */}
                      <td className="py-4 px-4 text-center font-bold text-slate-400">
                        {item.estoque_minimo} un
                      </td>

                      {/* Anúncios Vinculados */}
                      <td className="py-4 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-semibold text-[11px] border border-slate-700">
                          {item.total_anuncios_vinculados} anúncios
                        </span>
                      </td>

                      {/* Ações (Editar & Excluir) */}
                      {isMaster && (
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                              title="Editar peça completa"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                              <span>Editar</span>
                            </button>

                            <button
                              onClick={() => handleOpenDelete(item)}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition-all cursor-pointer"
                              title="Excluir peça do catálogo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Modals (Exclusivos Master) */}
      {isMaster && (
        <>
          <StockModal
            isOpen={isModalOpen}
            mode={modalMode}
            item={selectedItem}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedItem(null);
            }}
            onSuccess={(msg) => {
              showNotification(msg);
              onRefresh();
            }}
          />

          <StockDeleteModal
            isOpen={isDeleteOpen}
            item={itemToDelete}
            onClose={() => {
              setIsDeleteOpen(false);
              setItemToDelete(null);
            }}
            onSuccess={(msg) => {
              showNotification(msg);
              onRefresh();
            }}
          />

          <ImportXmlModal
            isOpen={isImportXmlOpen}
            onClose={() => setIsImportXmlOpen(false)}
            onSuccess={(msg) => {
              showNotification(msg);
              onRefresh();
            }}
          />
        </>
      )}
    </div>
  );
};
