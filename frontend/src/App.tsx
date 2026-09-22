import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { PickingView } from './components/PickingView';
import { StockView } from './components/StockView';
import { PurchaseView } from './components/PurchaseView';
import { SettingsModal } from './components/SettingsModal';
import { AuditModal } from './components/AuditModal';
import { RegisterAdModal } from './components/RegisterAdModal';
import { LoginView } from './components/LoginView';
import { 
  Stats, 
  Pedido, 
  RotaConsolidada, 
  CaixaNecessaria, 
  StockItem, 
  StockMetrics,
  PurchaseItem, 
  MLConfig,
  UnregisteredAd,
  PickingCounts,
  SlaOption,
  User
} from './types';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('dfast_auth_token'));
  const [authChecking, setAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState<'picking' | 'stock' | 'purchases'>('picking');
  const [stats, setStats] = useState<Stats | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [rotaConsolidada, setRotaConsolidada] = useState<RotaConsolidada[]>([]);
  const [caixasNecessarias, setCaixasNecessarias] = useState<CaixaNecessaria[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [stockMetrics, setStockMetrics] = useState<StockMetrics | null>(null);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [unregisteredAds, setUnregisteredAds] = useState<UnregisteredAd[]>([]);
  const [distribuidorNome, setDistribuidorNome] = useState('Distribuidor Nissi');
  const [dataGeracao, setDataGeracao] = useState('');
  const [mlConfig, setMlConfig] = useState<MLConfig | null>(null);
  const [tipoOrigem, setTipoOrigem] = useState<'nissi' | 'producao' | 'todos'>('nissi');
  const [selectedSla, setSelectedSla] = useState<string>('todos');
  const [availableSlas, setAvailableSlas] = useState<SlaOption[]>([]);
  const [pickingCounts, setPickingCounts] = useState<PickingCounts>({ nissi: 0, producao: 0, todos: 0 });

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedAdToRegister, setSelectedAdToRegister] = useState<UnregisteredAd | undefined>(undefined);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isMaster = currentUser?.role?.toLowerCase() === 'master';

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Helper para requisições autenticadas
  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    const token = authToken || localStorage.getItem('dfast_auth_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  };

  // 1. Verificação inicial de sessão
  useEffect(() => {
    const verifyExistingAuth = async () => {
      const token = localStorage.getItem('dfast_auth_token');
      if (!token) {
        setAuthChecking(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setCurrentUser(data.user);
            setAuthToken(token);
          } else {
            localStorage.removeItem('dfast_auth_token');
            setAuthToken(null);
            setCurrentUser(null);
          }
        } else {
          localStorage.removeItem('dfast_auth_token');
          setAuthToken(null);
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Falha ao verificar autenticação:', err);
      } finally {
        setAuthChecking(false);
      }
    };

    verifyExistingAuth();
  }, []);

  const handleLoginSuccess = (user: User, token: string) => {
    localStorage.setItem('dfast_auth_token', token);
    setAuthToken(token);
    setCurrentUser(user);
    if (user.role === 'basico' && activeTab === 'purchases') {
      setActiveTab('picking');
    }
    showNotification(`Bem-vindo, ${user.nome}! Conectado como ${user.role}.`);
  };

  const handleLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      // Silencioso
    }
    localStorage.removeItem('dfast_auth_token');
    setAuthToken(null);
    setCurrentUser(null);
    showNotification('Sessão encerrada com sucesso.');
  };

  const handleOpenRegisterModal = (ad?: UnregisteredAd) => {
    if (!isMaster) return;
    setSelectedAdToRegister(ad);
    setIsRegisterOpen(true);
  };

  const loadData = async (tipo: 'nissi' | 'producao' | 'todos' = tipoOrigem, sla: string = selectedSla) => {
    setLoading(true);
    try {
      const [statsRes, pickingRes, mlConfigRes, unregRes, stockRes] = await Promise.all([
        authFetch('/api/stats'),
        authFetch(`/api/picking?tipo=${tipo}&sla=${sla}`),
        authFetch('/api/mercadolivre/config'),
        authFetch('/api/anuncios/unregistered'),
        authFetch('/api/stock'),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.stats);
      }

      if (pickingRes.ok) {
        const d = await pickingRes.json();
        setPedidos(d.pedidos || []);
        setRotaConsolidada(d.rota_consolidada || []);
        setCaixasNecessarias(d.caixas_necessarias || []);
        if (d.counts) setPickingCounts(d.counts);
        if (d.available_slas) setAvailableSlas(d.available_slas);
      }

      if (mlConfigRes.ok) {
        const d = await mlConfigRes.json();
        setMlConfig(d.config);
      }

      if (unregRes.ok) {
        const d = await unregRes.json();
        setUnregisteredAds(d.unregistered || d.anuncios || []);
      }

      if (stockRes.ok) {
        const d = await stockRes.json();
        setStock(d.stock || []);
        if (d.metrics) setStockMetrics(d.metrics);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStock = async () => {
    try {
      const res = await authFetch('/api/stock');
      if (res.ok) {
        const d = await res.json();
        setStock(d.stock || []);
        if (d.metrics) setStockMetrics(d.metrics);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadPurchases = async () => {
    if (!isMaster) return;
    try {
      const res = await authFetch('/api/purchases');
      if (res.ok) {
        const d = await res.json();
        setPurchases(d.itens || []);
        setDistribuidorNome(d.distribuidor || 'Distribuidor Nissi');
        setDataGeracao(d.data_geracao || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Carregar dados quando o usuário estiver autenticado
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    if (activeTab === 'stock') loadStock();
    if (activeTab === 'purchases' && isMaster) loadPurchases();
    if (activeTab === 'picking') loadData();
  }, [activeTab]);

  const handleChangeTipoOrigem = async (novoTipo: 'nissi' | 'producao' | 'todos') => {
    setTipoOrigem(novoTipo);
    try {
      const pickingRes = await authFetch(`/api/picking?tipo=${novoTipo}&sla=${selectedSla}`);
      if (pickingRes.ok) {
        const d = await pickingRes.json();
        setPedidos(d.pedidos || []);
        setRotaConsolidada(d.rota_consolidada || []);
        setCaixasNecessarias(d.caixas_necessarias || []);
        if (d.counts) setPickingCounts(d.counts);
        if (d.available_slas) setAvailableSlas(d.available_slas);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangeSla = async (novoSla: string) => {
    setSelectedSla(novoSla);
    try {
      const pickingRes = await authFetch(`/api/picking?tipo=${tipoOrigem}&sla=${novoSla}`);
      if (pickingRes.ok) {
        const d = await pickingRes.json();
        setPedidos(d.pedidos || []);
        setRotaConsolidada(d.rota_consolidada || []);
        setCaixasNecessarias(d.caixas_necessarias || []);
        if (d.counts) setPickingCounts(d.counts);
        if (d.available_slas) setAvailableSlas(d.available_slas);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (orderId: string) => {
    try {
      const res = await authFetch('/api/picking/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (res.ok) {
        loadData(tipoOrigem);
      } else {
        const d = await res.json();
        showNotification(d.error || 'Falha ao alternar status do pedido', 'error');
      }
    } catch (err) {
      showNotification('Falha ao alternar status do pedido', 'error');
    }
  };

  const handleUpdateStock = async (idNissi: string, saldo: number, minimo: number, local: string) => {
    if (!isMaster) return;
    try {
      const res = await authFetch('/api/stock/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_nissi: idNissi,
          saldo_atual: saldo,
          estoque_minimo: minimo,
          local: local,
        }),
      });
      if (res.ok) {
        showNotification(`Item ${idNissi} atualizado com sucesso!`);
        loadStock();
      } else {
        const d = await res.json();
        showNotification(d.error || 'Erro ao salvar dados de estoque', 'error');
      }
    } catch (err) {
      showNotification('Erro ao salvar dados de estoque', 'error');
    }
  };

  const handleSyncML = async () => {
    if (!isMaster) return;
    setSyncing(true);
    try {
      const res = await authFetch('/api/mercadolivre/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.unregistered_count > 0) {
          showNotification(`Atenção: ${data.unregistered_count} anúncio(s) novo(s) importado(s) ainda não possuem cadastro no banco!`, 'error');
          setIsRegisterOpen(true);
        } else {
          showNotification(data.message || `Sincronização concluída! ${data.items_imported} novos itens prontos para expedição.`);
        }
        loadData();
      } else {
        showNotification(data.error || 'Erro ao sincronizar com o Mercado Livre.', 'error');
      }
    } catch (err) {
      showNotification('Erro ao comunicar com a API do Mercado Livre', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleResetOrders = async () => {
    if (!isMaster) return;
    if (!confirm('Deseja realmente limpar todos os pedidos da lista do dia?')) return;
    try {
      const res = await authFetch('/api/orders/reset', { method: 'POST' });
      if (res.ok) {
        showNotification('Fila de pedidos limpa com sucesso!');
        loadData();
      }
    } catch (err) {
      showNotification('Erro ao limpar pedidos', 'error');
    }
  };

  const handleSaveConfig = async (form: any) => {
    if (!isMaster) return;
    try {
      const res = await authFetch('/api/mercadolivre/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        showNotification('Credenciais salvas com segurança no banco!');
        loadData();
      } else {
        const d = await res.json();
        showNotification(d.error || 'Erro ao salvar credenciais', 'error');
      }
    } catch (err) {
      showNotification('Erro ao salvar credenciais', 'error');
    }
  };

  // Se estiver verificando autenticação na inicialização
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-sky-400 mb-4" />
        <p className="text-sm font-medium">Verificando sessão de acesso...</p>
      </div>
    );
  }

  // Se não estiver autenticado, exibe a tela de Login moderna
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openSettings={() => isMaster && setIsSettingsOpen(true)}
        onOpenAudit={() => isMaster && setIsAuditOpen(true)}
        mlConfig={mlConfig}
        onSyncML={handleSyncML}
        onResetOrders={handleResetOrders}
        syncing={syncing}
        flexCutoff={mlConfig?.flex_cutoff || '14:00'}
        unregisteredCount={unregisteredAds.length}
        onOpenRegisterModal={() => handleOpenRegisterModal()}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Floating Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-5 duration-200 ${
          notification.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
            : 'bg-red-950/90 border-red-500/50 text-red-200'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
          <span className="text-xs font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && !pedidos.length && !stock.length ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-3" />
            <p className="text-sm font-medium">Carregando dados do estoque...</p>
          </div>
        ) : (
          <>
            {activeTab === 'picking' && (
              <PickingView
                pedidos={pedidos}
                rotaConsolidada={rotaConsolidada}
                caixasNecessarias={caixasNecessarias}
                onToggleStatus={handleToggleStatus}
                loading={loading}
                unregisteredAds={unregisteredAds}
                onOpenRegisterModal={handleOpenRegisterModal}
                tipoOrigem={tipoOrigem}
                onChangeTipoOrigem={handleChangeTipoOrigem}
                pickingCounts={pickingCounts}
                stats={stats}
                availableSlas={availableSlas}
                selectedSla={selectedSla}
                onChangeSla={handleChangeSla}
                isMaster={isMaster}
              />
            )}

            {activeTab === 'stock' && (
              <StockView
                stock={stock}
                metrics={stockMetrics}
                onRefresh={loadStock}
                showNotification={showNotification}
                loading={loading}
                isMaster={isMaster}
              />
            )}

            {activeTab === 'purchases' && isMaster && (
              <PurchaseView
                purchases={purchases}
                distribuidorNome={distribuidorNome}
                dataGeracao={dataGeracao}
                loading={loading}
              />
            )}
          </>
        )}
      </main>

      {/* Modals - Exclusivos Master */}
      {isMaster && (
        <>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            config={mlConfig}
            onOpenAudit={() => setIsAuditOpen(true)}
            onSaveConfig={handleSaveConfig}
          />

          <AuditModal
            isOpen={isAuditOpen}
            onClose={() => setIsAuditOpen(false)}
          />

          <RegisterAdModal
            isOpen={isRegisterOpen}
            onClose={() => {
              setIsRegisterOpen(false);
              setSelectedAdToRegister(undefined);
            }}
            unregisteredAds={unregisteredAds}
            initialAd={selectedAdToRegister}
            stockList={stock}
            onAdRegistered={() => {
              loadData();
              showNotification('Anúncio cadastrado e integrado com sucesso!');
            }}
          />
        </>
      )}
    </div>
  );
}
