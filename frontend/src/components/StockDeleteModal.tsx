import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  AlertTriangle, 
  ShieldAlert, 
  Check, 
  ExternalLink 
} from 'lucide-react';
import { StockItem } from '../types';
import { authFetch } from '../api';

interface StockDeleteModalProps {
  isOpen: boolean;
  item: StockItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const StockDeleteModal: React.FC<StockDeleteModalProps> = ({
  isOpen,
  item,
  onClose,
  onSuccess,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresForce, setRequiresForce] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const handleDelete = async (force = false) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await authFetch('/api/stock/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_nissi: item.id_nissi,
          force: force,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir item do catálogo.');
      }

      if (data.requires_confirmation && !force) {
        setRequiresForce(true);
        setWarningMessage(data.warning || `Este item está vinculado a ${data.linked_count} anúncio(s) do Mercado Livre.`);
        return;
      }

      onSuccess(data.message || `Item ${item.id_nissi} excluído com sucesso!`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha na exclusão do item.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Excluir Peça do Estoque</h2>
              <p className="text-xs text-slate-400">Esta ação remove o registro do banco de dados.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Item details card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-black text-white">{item.id_nissi}</span>
              <span className="text-xs font-bold text-slate-400">Local: <strong className="text-sky-300">{item.local || 'S/L'}</strong></span>
            </div>
            <p className="text-xs text-slate-300">{item.descricao}</p>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              <span>Saldo Atual: <strong className="text-white">{item.saldo_atual} {item.unidade_medida}</strong></span>
              <span>Anúncios Vinculados: <strong className="text-purple-300">{item.total_anuncios_vinculados}</strong></span>
            </div>
          </div>

          {/* Linked ads alert */}
          {(item.total_anuncios_vinculados > 0 || requiresForce) && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Atenção: Peça em uso em anúncios ativos!</span>
              </div>
              <p className="text-xs text-slate-300">
                {warningMessage || `Esta peça compõe ${item.total_anuncios_vinculados} anúncio(s) do Mercado Livre. Ao confirmar a exclusão, os kits correspondentes ficarão sem esta peça.`}
              </p>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Deseja realmente prosseguir com a exclusão definitiva deste item?
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-300 transition-all"
          >
            Cancelar
          </button>

          {requiresForce || item.total_anuncios_vinculados > 0 ? (
            <button
              type="button"
              disabled={deleting}
              onClick={() => handleDelete(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-lg shadow-rose-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{deleting ? 'Excluindo...' : 'Confirmar Exclusão Forçada'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={deleting}
              onClick={() => handleDelete(false)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-lg shadow-rose-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{deleting ? 'Excluindo...' : 'Excluir Item'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
