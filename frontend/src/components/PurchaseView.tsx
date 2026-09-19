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
  FileSpreadsheet
} from 'lucide-react';
import { PurchaseItem } from '../types';

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
  const [filterUrgencia, setFilterUrgencia] = useState<'all' | 'urgente' | 'preventiva'>('all');

  const totalItens = purchases.length;
  const urgentes = purchases.filter(p => p.urgencia.includes('URGENTE')).length;
  const preventivos = totalItens - urgentes;
  const totalPecas = purchases.reduce((acc, curr) => acc + curr.sugestao_compra, 0);

  const filteredPurchases = purchases.filter(p => {
    if (filterUrgencia === 'urgente') return p.urgencia.includes('URGENTE');
    if (filterUrgencia === 'preventiva') return p.urgencia.includes('Preventiva');
    return true;
  });

  const handleCopyWhatsApp = () => {
    let msg = `*📦 PEDIDO DE COMPRA - DFAST ONLINE*\n`;
    msg += `*Fornecedor:* ${distribuidorNome}\n`;
    msg += `*Data:* ${new Date().toLocaleDateString('pt-BR')}\n`;
    msg += `*Total de Peças Solicitadas:* ${totalPecas} un\n`;
    msg += `-------------------------------------------\n\n`;

    filteredPurchases.forEach(item => {
      msg += `🔹 *Cód. Nissi:* ${item.id_nissi}\n`;
      msg += `   *Qtd:* ${item.sugestao_compra} ${item.unidade_medida}\n`;
      msg += `   *Item:* ${item.descricao}\n`;
      if (item.urgencia.includes('URGENTE')) {
        msg += `   ⚠️ _Urgência: Falta para envio hoje!_\n`;
      }
      msg += `\n`;
    });

    msg += `-------------------------------------------\n`;
    msg += `_Favor confirmar disponibilidade e prazo de faturamento._`;

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
                  Cálculo Inteligente de Reposição
                </span>
                <h2 className="text-xl font-black text-white">{distribuidorNome}</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Itens calculados com base nas vendas do Mercado Livre e saldo mínimo de segurança.
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs">
                <span className="text-slate-300">
                  Total de Itens: <strong className="text-white font-bold">{totalItens}</strong>
                </span>
                <span className="text-slate-300">
                  Peças a Adquirir: <strong className="text-sky-400 font-extrabold">{totalPecas} un</strong>
                </span>
                <span className="text-red-400 font-semibold">
                  {urgentes} itens com falta imediata
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado para o WhatsApp!' : 'Copiar Pedido (WhatsApp)'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Cotação</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-slate-900/40 p-2 rounded-2xl border border-slate-800 no-print">
        <button
          onClick={() => setFilterUrgencia('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            filterUrgencia === 'all'
              ? 'bg-sky-500 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Todos ({totalItens})
        </button>
        <button
          onClick={() => setFilterUrgencia('urgente')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            filterUrgencia === 'urgente'
              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🚨 Falta Imediata ({urgentes})
        </button>
        <button
          onClick={() => setFilterUrgencia('preventiva')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            filterUrgencia === 'preventiva'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ⚠️ Reposição Preventiva ({preventivos})
        </button>
      </div>

      {/* Purchase Items Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredPurchases.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Check className="w-12 h-12 mx-auto text-emerald-500/40 mb-3" />
            <p className="font-semibold text-slate-300">Estoque 100% abastecido!</p>
            <p className="text-xs mt-1">Nenhum item com necessidade de compra no momento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Status / Urgência</th>
                  <th className="py-3.5 px-4">Cód. Nissi</th>
                  <th className="py-3.5 px-4">Descrição da Peça</th>
                  <th className="py-3.5 px-4 text-center">Local</th>
                  <th className="py-3.5 px-4 text-center">Saldo Atual</th>
                  <th className="py-3.5 px-4 text-center">Mínimo</th>
                  <th className="py-3.5 px-4 text-center font-extrabold text-sky-400">Sugestão de Compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredPurchases.map(item => {
                  const isUrgente = item.urgencia.includes('URGENTE');

                  return (
                    <tr key={item.id_nissi} className={`hover:bg-slate-800/40 transition-colors ${isUrgente ? 'bg-red-950/10' : ''}`}>
                      {/* Urgência */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase ${
                          isUrgente
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}>
                          {item.urgencia}
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

                      {/* Mínimo */}
                      <td className="py-4 px-4 text-center text-slate-400">
                        {item.estoque_minimo} un
                      </td>

                      {/* Sugestão de Compra */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block text-base font-black text-sky-300 bg-sky-500/10 px-3 py-1 rounded-xl border border-sky-500/30">
                          {item.sugestao_compra} {item.unidade_medida}
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
                <td className="py-2 px-2 text-center font-bold text-sm">{item.sugestao_compra}</td>
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
