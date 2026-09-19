import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  MapPin, 
  Box, 
  Zap, 
  Truck, 
  Printer, 
  Filter, 
  ArrowDownUp, 
  Clock, 
  Check, 
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  PlusCircle
} from 'lucide-react';
import { Pedido, RotaConsolidada, CaixaNecessaria, UnregisteredAd } from '../types';

interface PickingViewProps {
  pedidos: Pedido[];
  rotaConsolidada: RotaConsolidada[];
  caixasNecessarias: CaixaNecessaria[];
  onToggleStatus: (orderId: string) => void;
  loading: boolean;
  unregisteredAds?: UnregisteredAd[];
  onOpenRegisterModal?: (ad?: UnregisteredAd) => void;
}

export const PickingView: React.FC<PickingViewProps> = ({
  pedidos,
  rotaConsolidada,
  caixasNecessarias,
  onToggleStatus,
  loading,
  unregisteredAds = [],
  onOpenRegisterModal,
}) => {
  const [viewMode, setViewMode] = useState<'rota' | 'pedidos'>('rota');
  const [filterType, setFilterType] = useState<'all' | 'flex' | 'coleta'>('all');

  const totalPedidos = pedidos.length;
  const separados = pedidos.filter(p => p.status_picking === 'separado').length;
  const pendentes = totalPedidos - separados;
  const progresso = totalPedidos > 0 ? Math.round((separados / totalPedidos) * 100) : 0;
  const flexPendentes = pedidos.filter(p => p.envio_tipo === 'flex' && p.status_picking === 'pendente').length;

  const pedidosFiltrados = pedidos.filter(p => {
    if (filterType === 'flex') return p.envio_tipo === 'flex';
    if (filterType === 'coleta') return p.envio_tipo === 'coleta' || p.envio_tipo === 'normal';
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Anúncios sem Cadastro */}
      {unregisteredAds && unregisteredAds.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border-2 border-amber-500/40 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950">
                  Ação Necessária
                </span>
                <h4 className="text-sm font-bold text-amber-300">
                  {unregisteredAds.length} Anúncio{unregisteredAds.length > 1 ? 's' : ''} do Mercado Livre sem cadastro no sistema!
                </h4>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Foram vendidas peças de anúncios que ainda não têm caixa e componentes Nissi vinculados. Cadastre-os para abastecer a rota de coleta e caixas do galpão.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenRegisterModal?.()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all shrink-0 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Resolver Agora ({unregisteredAds.length})</span>
          </button>
        </div>
      )}

      {/* Top Banner & KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Total a Enviar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total a Enviar</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-extrabold text-white">{totalPedidos}</h3>
            <span className="text-xs text-slate-400">pedidos hoje</span>
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-emerald-400 font-semibold">{separados} separados</span> • 
            <span className="text-amber-400 font-semibold">{pendentes} pendentes</span>
          </p>
        </div>

        {/* Envios Flex no Mesmo Dia */}
        <div className="bg-gradient-to-br from-amber-950/40 via-slate-900/60 to-slate-900/60 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Envios Flex (Mesmo Dia)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-extrabold text-amber-300">{flexPendentes}</h3>
            <span className="text-xs text-amber-200/70">pendentes de separação</span>
          </div>
          <p className="text-xs text-amber-300/80 mt-2 font-medium">
            ⚡ Prioridade máxima para expedição
          </p>
        </div>

        {/* Progresso de Separação */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Progresso do Picking</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-extrabold text-white">{progresso}%</h3>
            <span className="text-xs text-slate-400">{separados}/{totalPedidos}</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>

        {/* Resumo de Caixas de Papelão */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Caixas Necessárias</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Box className="w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {caixasNecessarias.length > 0 ? (
              caixasNecessarias.map(c => (
                <span key={c.numero_caixa} className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200">
                  Caixa {c.numero_caixa}: <strong className="text-purple-300 font-extrabold">{c.total_caixas} un</strong>
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">Nenhum pedido pendente</span>
            )}
          </div>
        </div>
      </div>

      {/* Control Bar: View Mode Switcher, Filters, and Print Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800 no-print">
        {/* Mode Switch: Rota no Galpão vs Por Pedido */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('rota')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'rota'
                ? 'bg-sky-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Rota no Galpão (Por Prateleira)</span>
          </button>

          <button
            onClick={() => setViewMode('pedidos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'pedidos'
                ? 'bg-sky-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Por Pedido / Etiqueta</span>
          </button>
        </div>

        {/* Filters and Print */}
        <div className="flex items-center gap-2">
          {viewMode === 'pedidos' && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  filterType === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType('flex')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  filterType === 'flex' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400'
                }`}
              >
                ⚡ Só Flex
              </button>
              <button
                onClick={() => setFilterType('coleta')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  filterType === 'coleta' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400'
                }`}
              >
                🚚 Só Coleta
              </button>
            </div>
          )}

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 shadow transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Lista de Coleta</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: ROTA CONSOLIDADA NO GALPÃO (ORDENADA POR LOCAL) */}
      {viewMode === 'rota' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-sky-400" />
                <span>Sequência de Coleta Otimizada no Galpão</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Itens agrupados e organizados pelo trajeto físico mais rápido nas prateleiras (A ➔ B ➔ C).
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {rotaConsolidada.length} itens distintos a retirar
            </span>
          </div>

          {rotaConsolidada.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500/40 mb-3" />
              <p className="font-semibold text-slate-300">Tudo separado!</p>
              <p className="text-xs mt-1">Nenhum item pendente de coleta no estoque no momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 text-center">Localização</th>
                    <th className="py-3.5 px-4">Código Nissi</th>
                    <th className="py-3.5 px-4">Descrição da Peça</th>
                    <th className="py-3.5 px-4 text-center">Unidade</th>
                    <th className="py-3.5 px-4 text-center font-extrabold text-sky-300">Qtd a Retirar</th>
                    <th className="py-3.5 px-4 text-center">Saldo Físico</th>
                    <th className="py-3.5 px-4">Pedidos Atendidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {rotaConsolidada.map((item, idx) => {
                    const saldoSuficiente = item.saldo_atual >= item.total_a_retirar;
                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        {/* Localização em Destaque */}
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center font-mono font-black text-sm px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-emerald-500/20 text-sky-300 border border-sky-500/40 shadow-sm">
                            {item.local || 'S/L'}
                          </span>
                        </td>

                        {/* Código Nissi */}
                        <td className="py-4 px-4 font-mono font-bold text-slate-200">
                          {item.id_kit_nissi}
                        </td>

                        {/* Descrição */}
                        <td className="py-4 px-4 font-medium text-white max-w-xs">
                          {item.descricao}
                        </td>

                        {/* Unidade */}
                        <td className="py-4 px-4 text-center text-slate-400">
                          {item.unidade_medida}
                        </td>

                        {/* Qtd a Retirar */}
                        <td className="py-4 px-4 text-center">
                          <span className="inline-block text-lg font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/30">
                            {item.total_a_retirar}
                          </span>
                        </td>

                        {/* Saldo Atual */}
                        <td className="py-4 px-4 text-center">
                          <span className={`font-semibold ${saldoSuficiente ? 'text-slate-300' : 'text-red-400 font-bold'}`}>
                            {item.saldo_atual} un
                          </span>
                          {!saldoSuficiente && (
                            <span className="block text-[10px] text-red-400 font-bold">Falta no estoque!</span>
                          )}
                        </td>

                        {/* Pedidos Relacionados */}
                        <td className="py-4 px-4 text-slate-400 font-mono text-[11px] max-w-xs truncate" title={item.pedidos_relacionados}>
                          {item.pedidos_relacionados}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: LISTA POR PEDIDO / ETIQUETA (COM CHECKLIST) */}
      {viewMode === 'pedidos' && (
        <div className="space-y-4">
          {pedidosFiltrados.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500/40 mb-3" />
              <p className="font-semibold text-slate-300">Nenhum pedido encontrado com o filtro selecionado.</p>
            </div>
          ) : (
            pedidosFiltrados.map(pedido => {
              const isSeparado = pedido.status_picking === 'separado';
              const isFlex = pedido.envio_tipo === 'flex';

              return (
                <div 
                  key={pedido.order_id}
                  className={`border rounded-2xl p-5 transition-all shadow-md ${
                    isSeparado 
                      ? 'bg-slate-950/40 border-slate-800/80 opacity-60' 
                      : isFlex
                      ? 'bg-gradient-to-r from-amber-950/20 via-slate-900/70 to-slate-900/70 border-amber-500/40'
                      : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      {/* Interactive Toggle Checkbox */}
                      <button
                        onClick={() => onToggleStatus(pedido.order_id)}
                        className={`mt-1 w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                          isSeparado
                            ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {isSeparado ? <Check className="w-4 h-4 stroke-[3]" /> : <Circle className="w-4 h-4" />}
                      </button>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-sm text-white">#{pedido.order_id}</span>
                          
                          {/* Shipping Type Badge */}
                          {isFlex ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase">
                              <Zap className="w-3 h-3 animate-pulse" />
                              Envio Flex (Hoje)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold">
                              <Truck className="w-3 h-3" />
                              Coleta / Normal
                            </span>
                          )}

                          {/* Box Badge / Unregistered Indicator */}
                          {pedido.cadastrado === false ? (
                            <button
                              type="button"
                              onClick={() => onOpenRegisterModal?.({
                                id_ml: pedido.ml_item_id,
                                titulo: pedido.titulo,
                                total_pedidos: 1
                              })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                              title="Clique para cadastrar este anúncio e vincular peças"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>⚠️ Sem Cadastro • Cadastrar</span>
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px] font-bold">
                              Caixa {pedido.caixa || 'Padrão'}
                            </span>
                          )}

                          <span className="text-xs text-slate-400 font-medium">
                            • Comprador: <strong className="text-slate-200">{pedido.comprador}</strong>
                          </span>
                        </div>

                        <h4 className="text-sm font-semibold text-white mt-1">
                          {pedido.titulo}
                        </h4>
                      </div>
                    </div>

                    {/* Status & Quantity */}
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-xs text-slate-400">Quantidade:</span>
                        <p className="text-xl font-extrabold text-sky-400">{pedido.quantidade} un</p>
                      </div>

                      <button
                        onClick={() => onToggleStatus(pedido.order_id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          isSeparado
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                        }`}
                      >
                        {isSeparado ? 'Desmarcar' : 'Marcar Separado'}
                      </button>
                    </div>
                  </div>

                  {/* Components / Kits to Pick */}
                  <div className="bg-slate-950/70 rounded-xl p-3.5 border border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Componentes que compõem este anúncio ({pedido.componentes?.length || 0} itens):
                      </p>
                      {pedido.cadastrado === false && (
                        <button
                          type="button"
                          onClick={() => onOpenRegisterModal?.({
                            id_ml: pedido.ml_item_id,
                            titulo: pedido.titulo,
                            total_pedidos: 1
                          })}
                          className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          Configurar Peças e Caixa
                        </button>
                      )}
                    </div>
                    {(!pedido.componentes || pedido.componentes.length === 0) ? (
                      <div className="p-4 rounded-xl bg-amber-500/5 border border-dashed border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-300/90">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Este anúncio não possui componentes Nissi mapeados. O operador não sabe quais peças separar no galpão.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenRegisterModal?.({
                            id_ml: pedido.ml_item_id,
                            titulo: pedido.titulo,
                            total_pedidos: 1
                          })}
                          className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold text-xs transition-colors shrink-0"
                        >
                          Cadastrar Agora
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {pedido.componentes?.map((comp, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                {comp.local || 'S/L'}
                              </span>
                              <div>
                                <p className="text-xs font-semibold text-white truncate max-w-[170px]" title={comp.descricao}>
                                  {comp.descricao}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  Nissi: {comp.id_kit_nissi}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                              {comp.qtd_necessaria} {comp.unidade_medida}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* PRINT LAYOUT (Visible ONLY during window.print()) */}
      <div className="print-only">
        <div className="print-header pb-4 mb-4 border-b-2 border-black">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black">DFAST ONLINE - GUIA DE EXPEDIÇÃO & PICKING</h1>
              <p className="text-sm">Data de Coleta: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">Total Pedidos: {totalPedidos}</p>
              <p className="text-sm">Flex (Hoje): {flexPendentes}</p>
            </div>
          </div>
        </div>

        <h2 className="text-lg font-bold mb-3">Sequência Otimizada por Prateleira no Galpão:</h2>
        <table className="w-full border-collapse text-xs mb-8">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 px-2">LOCAL</th>
              <th className="py-2 px-2">CÓD. NISSI</th>
              <th className="py-2 px-2">DESCRIÇÃO DA PEÇA</th>
              <th className="py-2 px-2 text-center">UNIDADE</th>
              <th className="py-2 px-2 text-center">QTD TOTAL</th>
              <th className="py-2 px-2 text-center">CONFIRMADO [X]</th>
            </tr>
          </thead>
          <tbody>
            {rotaConsolidada.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-300">
                <td className="py-2 px-2 font-bold font-mono text-sm">{item.local || 'S/L'}</td>
                <td className="py-2 px-2 font-mono">{item.id_kit_nissi}</td>
                <td className="py-2 px-2">{item.descricao}</td>
                <td className="py-2 px-2 text-center">{item.unidade_medida}</td>
                <td className="py-2 px-2 text-center font-bold text-sm">{item.total_a_retirar}</td>
                <td className="py-2 px-2 text-center">[ &nbsp; &nbsp; ]</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 pt-4 border-t border-black flex justify-between text-xs">
          <p>Separado por: _________________________________________</p>
          <p>Conferido e Embalado por: _________________________________________</p>
        </div>
      </div>
    </div>
  );
};
