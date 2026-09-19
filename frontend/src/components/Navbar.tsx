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
  AlertCircle,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { MLConfig } from '../types';

interface NavbarProps {
  activeTab: 'picking' | 'stock' | 'purchases';
  setActiveTab: (tab: 'picking' | 'stock' | 'purchases') => void;
  openSettings: () => void;
  onOpenAudit: () => void;
  mlConfig: MLConfig | null;
  onSyncML: () => void;
  onResetOrders: () => void;
  syncing: boolean;
  flexCutoff: string;
  unregisteredCount?: number;
  onOpenRegisterModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  openSettings,
  onOpenAudit,
  mlConfig,
  onSyncML,
  onResetOrders,
  syncing,
  flexCutoff,
  unregisteredCount = 0,
  onOpenRegisterModal,
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
            {/* Active ML Token Status Pill */}
            {mlConfig?.has_access_token ? (
              <div 
                className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold cursor-default"
                title="Token oficial ativo com AES-256-GCM lido do banco de dados."
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Token Ativo (6h)</span>
                {mlConfig.token_expires_at && (
                  <span className="text-[10px] text-emerald-200/70 font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded">
                    Até {new Date(mlConfig.token_expires_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ) : (
              <div 
                className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 text-xs cursor-default"
                title="Nenhum token ativo no momento no banco de dados"
              >
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                <span>Token Inativo</span>
              </div>
            )}

            {/* Flex Cutoff Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Corte Flex: <strong>{flexCutoff}h</strong></span>
            </div>

            {/* Security Audit Button */}
            <button
              onClick={onOpenAudit}
              title="Abrir Trilha de Auditoria de Segurança & LGPD (Mercado Livre Developers)"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-emerald-200 text-xs font-semibold border border-emerald-500/30 transition-all active:scale-95"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Auditoria</span>
            </button>

            {/* Unregistered Ads Alert Badge */}
            {unregisteredCount > 0 && onOpenRegisterModal && (
              <button
                onClick={onOpenRegisterModal}
                title={`Atenção: Existem ${unregisteredCount} anúncios vendidos sem cadastro no banco! Clique para cadastrar agora.`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all animate-pulse active:scale-95 shadow-lg shadow-amber-500/10"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{unregisteredCount} Sem Cadastro</span>
              </button>
            )}

            {/* Sincronização em Tempo Real com Dados Reais da API do ML */}
            <button
              onClick={onSyncML}
              disabled={syncing}
              title="Buscar pedidos reais e pendentes diretamente na API oficial do Mercado Livre usando as credenciais do banco"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-white' : ''}`} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar ML'}</span>
            </button>

            {/* Clear Orders */}
            <button
              onClick={onResetOrders}
              title="Limpar pedidos do dia"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Trocar Seller */}
            <button
              onClick={openSettings}
              title="Trocar Seller ou Atualizar Credenciais do Banco de Dados"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="hidden md:inline text-xs font-semibold">Trocar Seller</span>
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
