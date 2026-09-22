import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ShoppingCart, 
  Download, 
  Share2, 
  Box, 
  Building2, 
  FileText,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { PurchaseItem } from '../types';
import { authFetch } from '../api';

interface PurchaseListModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchases?: PurchaseItem[];
  distribuidorNome?: string;
}

export const PurchaseListModal: React.FC<PurchaseListModalProps> = ({
  isOpen,
  onClose,
  purchases: initialPurchases,
  distribuidorNome = 'Distribuidor Nissi',
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>(initialPurchases || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialPurchases && initialPurchases.length > 0) {
      setItems(initialPurchases);
    } else {
      // Fetch latest from API
      setLoading(true);
      setError(null);
      authFetch('/api/purchases')
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.itens)) {
            setItems(data.itens);
          } else {
            setError(data.error || 'Não foi possível carregar a lista de compras.');
          }
        })
        .catch(() => setError('Erro de conexão ao buscar itens para compra.'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, initialPurchases]);

  if (!isOpen) return null;

  // Formatar no formato exato solicitado: codigo - unidade
  const formatCodigoUnidade = () => {
    return items
      .filter(i => (i.sugestao_compra || 0) > 0)
      .map(i => `${i.id_nissi} - ${i.sugestao_compra}`)
      .join('\n');
  };

  const listaTexto = formatCodigoUnidade();
  const totalItens = items.length;
  const totalUnidades = items.reduce((sum, i) => sum + (i.sugestao_compra || 0), 0);

  const handleCopyCodigoUnidade = () => {
    if (!listaTexto) return;
    navigator.clipboard.writeText(listaTexto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyWhatsApp = () => {
    if (!listaTexto) return;
    let msg = `*📦 PEDIDO DE COMPRA - DFAST ONLINE*\n`;
    msg += `*Fornecedor:* ${distribuidorNome}\n`;
    msg += `*Data:* ${new Date().toLocaleDateString('pt-BR')}\n`;
    msg += `*Total de Peças:* ${totalUnidades} un (${totalItens} itens)\n`;
    msg += `-------------------------------------------\n\n`;
    msg += listaTexto + `\n\n`;
    msg += `-------------------------------------------\n`;
    msg += `_Favor confirmar disponibilidade e faturamento._`;

    navigator.clipboard.writeText(msg);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2500);
  };

  const handleDownloadTxt = () => {
    if (!listaTexto) return;
    const blob = new Blob([listaTexto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `pedido_compra_nissi_${dateStr}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Lista de Compra para Distribuidor</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                  codigo - unidade
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Itens abaixo da unidade desejável formatados para envio direto ao fornecedor.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-3" />
              <p className="text-xs font-medium">Calculando itens abaixo da unidade desejável...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Check className="w-12 h-12 mx-auto text-emerald-500/40 mb-3" />
              <p className="font-bold text-white text-sm">Estoque 100% abastecido!</p>
              <p className="text-xs text-slate-400 mt-1">
                Todas as peças estão iguais ou acima da unidade desejável. Nenhuma compra necessária.
              </p>
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Itens a Comprar</span>
                  <div className="text-xl font-extrabold text-white mt-0.5">{totalItens}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Unidades</span>
                  <div className="text-xl font-extrabold text-sky-400 mt-0.5">{totalUnidades} un</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Fornecedor</span>
                  <div className="text-xs font-bold text-slate-200 mt-1 truncate" title={distribuidorNome}>
                    {distribuidorNome}
                  </div>
                </div>
              </div>

              {/* Text Area in format 'codigo - unidade' */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    <span>Lista Pronta para Envio (código - unidade):</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {totalItens} linhas geradas
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    readOnly
                    value={listaTexto}
                    rows={Math.min(14, Math.max(6, items.length))}
                    className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono text-emerald-300 leading-relaxed focus:outline-none focus:border-sky-500 select-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Dica: Clique no botão abaixo para copiar instantaneamente ou clique na caixa para selecionar tudo.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>

          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
                title="Baixar arquivo de texto .txt"
              >
                <Download className="w-4 h-4" />
                <span>Baixar .TXT</span>
              </button>

              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xs border border-emerald-500/40 transition-all cursor-pointer"
                title="Copiar com cabeçalho formatado para WhatsApp"
              >
                {copiedWhatsApp ? <Check className="w-4 h-4 text-emerald-400 stroke-[3]" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedWhatsApp ? 'Copiado p/ WhatsApp!' : 'WhatsApp'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyCodigoUnidade}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-sky-500/20 transition-all active:scale-95 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Lista Copiada!' : 'Copiar (código - unidade)'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
