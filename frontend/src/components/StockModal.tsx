import React, { useState, useEffect } from 'react';
import { 
  X, 
  Layers, 
  Check, 
  MapPin, 
  Box, 
  AlertTriangle, 
  Tag, 
  Hash, 
  ShieldCheck,
  Plus
} from 'lucide-react';
import { StockItem } from '../types';

interface StockModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  item?: StockItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const UNIDADES_COMUNS = [
  { value: 'UNIDADE', label: 'UNIDADE (Peça Única)' },
  { value: 'PAR', label: 'PAR (Jogo / Par)' },
];

export const StockModal: React.FC<StockModalProps> = ({
  isOpen,
  mode,
  item,
  onClose,
  onSuccess,
}) => {
  const [idNissi, setIdNissi] = useState('');
  const [descricao, setDescricao] = useState('');
  const [unidade, setUnidade] = useState('UNIDADE');
  const [local, setLocal] = useState('');
  const [saldo, setSaldo] = useState<number>(10);
  const [minimo, setMinimo] = useState<number>(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && item) {
      setIdNissi(item.id_nissi);
      setDescricao(item.descricao);
      setUnidade((item.unidade_medida && item.unidade_medida.toUpperCase() === 'PAR') ? 'PAR' : 'UNIDADE');
      setLocal(item.local === 'S/L' ? '' : (item.local || ''));
      setSaldo(item.saldo_atual);
      setMinimo(item.estoque_minimo);
    } else {
      setIdNissi('');
      setDescricao('');
      setUnidade('UNIDADE');
      setLocal('');
      setSaldo(10);
      setMinimo(5);
    }
    setError(null);
  }, [mode, item, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = idNissi.trim().toUpperCase();
    const cleanDesc = descricao.trim();
    const cleanLocal = local.trim().toUpperCase() || 'S/L';

    if (!cleanId) {
      setError('O código Nissi é obrigatório.');
      return;
    }
    if (!cleanDesc) {
      setError('A descrição da peça é obrigatória.');
      return;
    }

    setSaving(true);
    try {
      const endpoint = mode === 'create' ? '/api/stock/create' : '/api/stock/update';
      const body = {
        id_nissi: cleanId,
        descricao: cleanDesc,
        unidade_medida: unidade,
        local: cleanLocal,
        saldo_atual: Math.max(0, Number(saldo) || 0),
        estoque_minimo: Math.max(0, Number(minimo) || 0),
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar item no estoque.');
      }

      onSuccess(data.message || (mode === 'create' ? 'Item cadastrado com sucesso!' : 'Item atualizado com sucesso!'));
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar dados de estoque.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              {mode === 'create' ? <Plus className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                {mode === 'create' ? 'Novo Item no Estoque Nissi' : `Editar Peça ${item?.id_nissi}`}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'create' 
                  ? 'Cadastre uma nova peça com endereço no galpão e saldos de reposição.'
                  : 'Altere a descrição, prateleira ou níveis de estoque desta peça.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Código Nissi & Unidade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Código Nissi <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  disabled={mode === 'edit'}
                  value={idNissi}
                  onChange={e => setIdNissi(e.target.value.toUpperCase())}
                  placeholder="Ex: NS-4015"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-mono font-bold text-white border transition-all ${
                    mode === 'edit'
                      ? 'bg-slate-950/40 border-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-950 border-slate-700 focus:border-sky-500 focus:outline-none'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Unidade
              </label>
              <select
                value={unidade}
                onChange={e => setUnidade(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
              >
                {UNIDADES_COMUNS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Descrição Completa da Peça <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Batente Traseiro Sandero 2008 a 2013"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-sky-500 transition-all"
            />
          </div>

          {/* Localização no Galpão */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Localização Física / Prateleira
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={local}
                onChange={e => setLocal(e.target.value.toUpperCase())}
                placeholder="Ex: A14, B02, C10 (ou deixe em branco para S/L)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-sky-300 focus:outline-none focus:border-sky-500 transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              A primeira letra (A, B, C...) define o corredor para a rota otimizada de coleta.
            </p>
          </div>

          {/* Saldo Físico & Estoque Mínimo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Saldo Físico Atual
              </label>
              <div className="relative">
                <Box className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  required
                  value={saldo}
                  onChange={e => setSaldo(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-extrabold text-white focus:outline-none focus:border-sky-500 transition-all"
                />
              </div>
              <span className="text-[11px] text-slate-500">Unidades contadas em prateleira.</span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Estoque Mínimo de Segurança
              </label>
              <div className="relative">
                <AlertTriangle className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  required
                  value={minimo}
                  onChange={e => setMinimo(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-extrabold text-amber-300 focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>
              <span className="text-[11px] text-slate-500">Dispara alerta para compra se atingido.</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-300 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{saving ? 'Salvando...' : (mode === 'create' ? 'Cadastrar Peça' : 'Salvar Alterações')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
