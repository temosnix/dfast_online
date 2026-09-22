import React from 'react';
import { 
  Package, 
  Layers, 
  ShoppingCart, 
  Settings, 
  RefreshCw, 
  Trash2, 
  LogOut,
  Crown,
  User as UserIcon
} from 'lucide-react';
import { MLConfig, User as UserType } from '../types';

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
  currentUser: UserType | null;
  onLogout: () => void;
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
  currentUser,
  onLogout,
}) => {
  const isMaster = currentUser?.role?.toLowerCase() === 'master';

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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'stock'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Estoque & Galpão</span>
            </button>

            {/* Aba de Compras Nissi disponível apenas para perfil Master */}
            {isMaster && (
              <button
                onClick={() => setActiveTab('purchases')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'purchases'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Lista de Compras Nissi</span>
              </button>
            )}
          </nav>

          {/* Actions, User Profile & Controls */}
          <div className="flex items-center gap-2">
            {/* Controles exclusivos para Master */}
            {isMaster && (
              <>

                {/* Sincronização ML */}
                <button
                  onClick={onSyncML}
                  disabled={syncing}
                  title="Buscar pedidos reais diretamente na API oficial do Mercado Livre"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-white' : ''}`} />
                  <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sincronizar ML'}</span>
                </button>

                {/* Clear Orders */}
                <button
                  onClick={onResetOrders}
                  title="Limpar pedidos do dia"
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Trocar Seller */}
                <button
                  onClick={openSettings}
                  title="Trocar Seller ou Atualizar Credenciais"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95 cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span className="hidden md:inline text-xs font-semibold">Config</span>
                </button>
              </>
            )}

            {/* Divisor Visual */}
            <div className="h-6 w-px bg-slate-800 mx-1" />

            {/* Badge de Identificação do Usuário */}
            {currentUser && (
              <div 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs cursor-default ${
                  isMaster 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                    : 'bg-slate-800/90 border-slate-700 text-slate-200'
                }`}
                title={isMaster ? 'Perfil Master: Acesso Completo' : 'Perfil Básico: Visualização de Estoque & Vendas'}
              >
                {isMaster ? (
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span className="font-semibold hidden sm:inline max-w-[110px] truncate">{currentUser.nome}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                  isMaster ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-700 text-slate-300'
                }`}>
                  {currentUser.role}
                </span>
              </div>
            )}

            {/* Botão de Logout */}
            <button
              onClick={onLogout}
              title="Encerrar sessão e sair"
              className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 border border-red-500/30 transition-all active:scale-95 cursor-pointer text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-t border-slate-800 bg-slate-950 px-2 py-1 justify-around">
        <button
          onClick={() => setActiveTab('picking')}
          className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold cursor-pointer ${
            activeTab === 'picking' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Picking</span>
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold cursor-pointer ${
            activeTab === 'stock' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Estoque</span>
        </button>
        {isMaster && (
          <button
            onClick={() => setActiveTab('purchases')}
            className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold cursor-pointer ${
              activeTab === 'purchases' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Compras</span>
          </button>
        )}
      </div>
    </header>
  );
};
