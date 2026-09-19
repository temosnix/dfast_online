import React from 'react';
import { 
  Package, 
  Layers, 
  ShoppingCart, 
  Settings, 
  RefreshCw, 
  Sparkles, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { MLConfig } from '../types';

interface NavbarProps {
  activeTab: 'picking' | 'stock' | 'purchases';
  setActiveTab: (tab: 'picking' | 'stock' | 'purchases') => void;
  openSettings: () => void;
  mlConfig: MLConfig | null;
  onSyncML: () => void;
  onSimulateML: () => void;
  onResetOrders: () => void;
  syncing: boolean;
  simulating: boolean;
  flexCutoff: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  openSettings,
  mlConfig,
  onSyncML,
  onSimulateML,
  onResetOrders,
  syncing,
  simulating,
  flexCutoff,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand / Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-sky-500/20">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">Dfast Online</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  HostGator Turbo
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Gestão de Estoque & Picking Mercado Livre</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('picking')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'picking'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Separação / Picking</span>
            </button>

            <button
              onClick={() => setActiveTab('stock')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'stock'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Estoque & Galpão</span>
            </button>

            <button
              onClick={() => setActiveTab('purchases')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'purchases'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Lista de Compras Nissi</span>
            </button>
          </nav>

          {/* Actions & ML Controls */}
          <div className="flex items-center gap-2">
            {/* Flex Cutoff Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Corte Flex: <strong>{flexCutoff}h</strong></span>
            </div>

            {/* Sync ML Button */}
            <button
              onClick={onSyncML}
              disabled={syncing}
              title="Buscar vendas recentes na API do Mercado Livre"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-sky-400' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sincronizar ML'}</span>
            </button>

            {/* Test Simulation Button */}
            <button
              onClick={onSimulateML}
              disabled={simulating}
              title="Simular vendas de hoje com base nos 767 anúncios reais do banco"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span className="hidden sm:inline">Simular Vendas</span>
            </button>

            {/* Clear Orders */}
            <button
              onClick={onResetOrders}
              title="Limpar pedidos do dia"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Settings */}
            <button
              onClick={openSettings}
              title="Configurações e Credenciais Mercado Livre"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-t border-slate-800 bg-slate-950 px-2 py-1 justify-around">
        <button
          onClick={() => setActiveTab('picking')}
          className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold ${
            activeTab === 'picking' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Picking</span>
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold ${
            activeTab === 'stock' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Estoque</span>
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold ${
            activeTab === 'purchases' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Compras</span>
        </button>
      </div>
    </header>
  );
};
