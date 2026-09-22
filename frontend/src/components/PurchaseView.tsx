import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Copy, 
  Check, 
  Printer, 
  AlertCircle, 
  Sparkles, 
  Clock, 
  Building2,
  FileSpreadsheet,
  Search,
  FileText,
  Share2
} from 'lucide-react';
import { PurchaseItem } from '../types';
import { PurchaseListModal } from './PurchaseListModal';

interface PurchaseViewProps {
  purchases: PurchaseItem[];
  distribuidorNome: string;
  dataGeracao: string;
  loading: boolean;
}

export const PurchaseView: React.FC<PurchaseViewProps> = ({
  purchases,
  distribuidorNome,
  dataGeracao,
  loading,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedCodigoUnidade, setCopiedCodigoUnidade] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [filterUrgencia, setFilterUrgencia] = useState<'all' | 'zerado' | 'parcial'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getQtdComprar = (item: PurchaseItem) => {
    if (typeof item.compra_desejavel === 'number') return item.compra_desejavel;
    if (typeof item.quantidade_comprar === 'number') return item.quantidade_comprar;
    if (typeof item.sugestao_compra === 'number') return item.sugestao_compra;
    const desejavel = item.estoque_desejavel ?? item.estoque_minimo ?? 5;
    return Math.max(0, desejavel - (item.saldo_atual || 0));
  };

  const totalItens = purchases.length;
  const zerados = purchases.filter(p => (p.saldo_atual || 0) <= 0).length;
  const parciais = totalItens - zerados;
  const totalPecas = purchases.reduce((acc, curr) => acc + getQtdComprar(curr), 0);

  const filteredPurchases = purchases.filter(p => {
    const isZero = (p.saldo_atual || 0) <= 0;
    if (filterUrgencia === 'zerado' && !isZero) return false;
    if (filterUrgencia === 'parcial' && isZero) return false;

    const q = (searchQuery || '').toLowerCase().trim();
    if (!q) return true;

    const idStr = String(p.id_nissi ?? '').toLowerCase();
    const descStr = String(p.descricao ?? '').toLowerCase();
    const localStr = String(p.local ?? '').toLowerCase();

    return idStr.includes(q) || descStr.includes(q) || localStr.includes(q);
  });

  const handleCopyCodigoUnidade = () => {
    const lines = filteredPurchases
      .map(i => ({ code: i.id_nissi, qtd: getQtdComprar(i) }))
      .filter(x => x.qtd > 0)
      .map(x => `${x.code} - ${x.qtd}`)
      .join('\n');
    if (!lines) return;
    navigator.clipboard.writeText(lines);
    setCopiedCodigoUnidade(true);
    setTimeout(() => setCopiedCodigoUnidade(false), 2500);
  };

  const handleCopyWhatsApp = () => {
    let msg = `*📦 PEDIDO DE COMPRA - DFAST ONLINE*\n`;
    msg += `*Fornecedor:* ${distribuidorNome}\n`;
    msg += `*Data:* ${new Date().toLocaleDateString('pt-BR')}\n`;
    msg += `*Total de Peças:* ${totalPecas} un (${totalItens} itens)\n`;
    msg += `-------------------------------------------\n\n`;

    filteredPurchases.forEach(item => {
      const qtd = getQtdComprar(item);
      if (qtd > 0) {
        msg += `${item.id_nissi} - ${qtd}\n`;
      }
    });

    msg += `\n-------------------------------------------\n`;
    msg += `_Favor confirmar disponibilidade e faturamento._`;

    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Supplier Info & Copy Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold text-[10px] uppercase border border-sky-500/30">
                  Reposição por Unidade Desejável
                </span>
                <h2 className="text-xl font-black text-white">{distribuidorNome}</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Itens com saldo físico abaixo da unidade desejável cadastrada para reposição direta.
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs">
                <span className="text-slate-300">
                  Total de Itens: <strong className="text-white font-bold">{totalItens}</strong>
                </span>
                <span className="text-slate-300">
                  Peças a Adquirir: <strong className="text-sky-400 font-extrabold">{totalPecas} un</strong>
                </span>
                <span className="text-red-400 font-semibold">
                  {zerados} itens zerados no estoque
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsListModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs shadow-lg shadow-sky-500/20 transition-all active:scale-95 cursor-pointer"
              title="Visualizar e copiar lista de compra no formato código - unidade"
            >
              <FileText className="w-4 h-4 stroke-[2.5]" />
              <span>Gerar Lista (código - unidade)</span>
            </button>

            <button
              onClick={handleCopyCodigoUnidade}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all active:scale-95 cursor-pointer"
              title="Copiar lista pura diretamente no formato código - unidade"
            >
              {copiedCodigoUnidade ? <Check className="w-4 h-4 text-emerald-400 stroke-[3]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCodigoUnidade ? 'Lista Copiada!' : 'Copiar Rápido'}</span>
            </button>

            <button
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 stroke-[3]" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? 'Copiado para WhatsApp!' : 'WhatsApp'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-2 rounded-2xl border border-slate-800 no-print">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterUrgencia('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterUrgencia === 'all'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({totalItens})
          </button>
          <button
            onClick={() => setFilterUrgencia('zerado')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterUrgencia === 'zerado'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🚨 Zerados ({zerados})
          </button>
          <button
            onClick={() => setFilterUrgencia('parcial')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterUrgencia === 'parcial'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚠️ Saldo Parcial ({parciais})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por código Nissi, peça ou local..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-all"
          />
        </div>
      </div>

      {/* Purchase Items Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredPurchases.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Check className="w-12 h-12 mx-auto text-emerald-500/40 mb-3" />
            <p className="font-semibold text-slate-300">Estoque 100% abastecido!</p>
            <p className="text-xs mt-1">Todas as peças estão na unidade desejável. Nenhuma compra necessária.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Status / Situação</th>
                  <th className="py-3.5 px-4">Cód. Nissi</th>
                  <th className="py-3.5 px-4">Descrição da Peça</th>
                  <th className="py-3.5 px-4 text-center">Local</th>
                  <th className="py-3.5 px-4 text-center">Saldo Atual</th>
                  <th className="py-3.5 px-4 text-center">Unid. Desejável</th>
                  <th className="py-3.5 px-4 text-center font-extrabold text-sky-400">Compra Desejável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredPurchases.map(item => {
                  const isZerado = (item.saldo_atual || 0) <= 0;
                  const qtdComprar = getQtdComprar(item);

                  return (
                    <tr key={item.id_nissi} className={`hover:bg-slate-800/40 transition-colors ${isZerado ? 'bg-red-950/10' : ''}`}>
                      {/* Situação */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase ${
                          isZerado
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}>
                          {item.urgencia || (isZerado ? 'Zerado (0 un)' : 'Abaixo do Desejável')}
                        </span>
                      </td>

                      {/* Código Nissi */}
                      <td className="py-4 px-4 font-mono font-bold text-white">
                        {item.id_nissi}
                      </td>

                      {/* Descrição */}
                      <td className="py-4 px-4 font-medium text-slate-200 max-w-sm">
                        {item.descricao}
                      </td>

                      {/* Local */}
                      <td className="py-4 px-4 text-center font-mono text-slate-400">
                        {item.local || 'S/L'}
                      </td>

                      {/* Saldo Atual */}
                      <td className="py-4 px-4 text-center">
                        <span className={`font-semibold ${item.saldo_atual <= 0 ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                          {item.saldo_atual} un
                        </span>
                      </td>

                      {/* Unidade Desejável */}
                      <td className="py-4 px-4 text-center text-slate-300 font-semibold">
                        {item.estoque_desejavel ?? item.estoque_minimo} un
                      </td>

                      {/* Compra Desejável */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block text-base font-black text-sky-300 bg-sky-500/10 px-3 py-1 rounded-xl border border-sky-500/30">
                          {qtdComprar} {item.unidade_medida}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Lista de Compra no Formato codigo - unidade */}
      <PurchaseListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        purchases={filteredPurchases}
        distribuidorNome={distribuidorNome}
      />

      {/* PRINT LAYOUT FOR PURCHASE ORDER */}
      <div className="print-only">
        <div className="print-header pb-4 mb-4 border-b-2 border-black">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black">PEDIDO DE COMPRA / COTAÇÃO</h1>
              <p className="text-sm">Fornecedor: {distribuidorNome}</p>
              <p className="text-xs">Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">Total de Itens: {totalItens}</p>
              <p className="text-sm font-bold">Total Peças: {totalPecas}</p>
            </div>
          </div>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 px-2">CÓDIGO NISSI</th>
              <th className="py-2 px-2">DESCRIÇÃO DO PRODUTO</th>
              <th className="py-2 px-2 text-center">UNIDADE</th>
              <th className="py-2 px-2 text-center">QTD SOLICITADA</th>
              <th className="py-2 px-2 text-right">PREÇO UNITÁRIO</th>
              <th className="py-2 px-2 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filteredPurchases.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-300">
                <td className="py-2 px-2 font-bold font-mono">{item.id_nissi}</td>
                <td className="py-2 px-2">{item.descricao}</td>
                <td className="py-2 px-2 text-center">{item.unidade_medida}</td>
                <td className="py-2 px-2 text-center font-bold text-sm">{getQtdComprar(item)}</td>
                <td className="py-2 px-2 text-right">R$ _________</td>
                <td className="py-2 px-2 text-right">R$ _________</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
