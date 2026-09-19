import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { PickingView } from './components/PickingView';
import { StockView } from './components/StockView';
import { PurchaseView } from './components/PurchaseView';
import { SettingsModal } from './components/SettingsModal';
import { AuditModal } from './components/AuditModal';
import { 
  Stats, 
  Pedido, 
  RotaConsolidada, 
  CaixaNecessaria, 
  StockItem, 
  PurchaseItem, 
  MLConfig 
} from './types';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'picking' | 'stock' | 'purchases'>('picking');
  const [stats, setStats] = useState<Stats | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [rotaConsolidada, setRotaConsolidada] = useState<RotaConsolidada[]>([]);
  const [caixasNecessarias, setCaixasNecessarias] = useState<CaixaNecessaria[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [distribuidorNome, setDistribuidorNome] = useState('Distribuidor Nissi');
  const [dataGeracao, setDataGeracao] = useState('');
  const [mlConfig, setMlConfig] = useState<MLConfig | null>(null);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      const [statsRes, pickingRes, mlConfigRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/picking'),
        fetch('/api/mercadolivre/config'),
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
      }

      if (mlConfigRes.ok) {
        const d = await mlConfigRes.json();
        setMlConfig(d.config);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStock = async () => {
    try {
      const res = await fetch('/api/stock');
      if (res.ok) {
        const d = await res.json();
        setStock(d.stock || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadPurchases = async () => {
    try {
      const res = await fetch('/api/purchases');
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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'stock') loadStock();
    if (activeTab === 'purchases') loadPurchases();
    if (activeTab === 'picking') loadData();
  }, [activeTab]);

  const handleToggleStatus = async (orderId: string) => {
    try {
      const res = await fetch('/api/picking/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      showNotification('Falha ao alternar status do pedido', 'error');
    }
  };

  const handleUpdateStock = async (idNissi: string, saldo: number, minimo: number, local: string) => {
    try {
      const res = await fetch('/api/stock/update', {
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
      }
    } catch (err) {
      showNotification('Erro ao salvar dados de estoque', 'error');
    }
  };

  const handleSyncML = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/mercadolivre/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`Sincronização concluída! ${data.items_imported} novos itens prontos para expedição.`);
        loadData();
      } else {
        showNotification(data.error || 'Configure suas credenciais em Configurações para sincronizar com o ML.', 'error');
        setIsSettingsOpen(true);
      }
    } catch (err) {
      showNotification('Erro ao comunicar com a API do Mercado Livre', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleResetOrders = async () => {
    if (!confirm('Deseja realmente limpar todos os pedidos da lista do dia?')) return;
    try {
      await fetch('/api/orders/reset', { method: 'POST' });
      showNotification('Fila de pedidos limpa com sucesso!');
      loadData();
    } catch (err) {
      showNotification('Erro ao limpar pedidos', 'error');
    }
  };

  const handleSaveConfig = async (form: any) => {
    const res = await fetch('/api/mercadolivre/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      showNotification('Credenciais salvas com segurança no banco!');
      loadData();
    } else {
      showNotification('Erro ao salvar credenciais', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openSettings={() => setIsSettingsOpen(true)}
        onOpenAudit={() => setIsAuditOpen(true)}
        mlConfig={mlConfig}
        onSyncML={handleSyncML}
        onResetOrders={handleResetOrders}
        syncing={syncing}
        flexCutoff={mlConfig?.flex_cutoff || '14:00'}
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
        {loading ? (
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
              />
            )}

            {activeTab === 'stock' && (
              <StockView
                stock={stock}
                onUpdateStock={handleUpdateStock}
                loading={loading}
              />
            )}

            {activeTab === 'purchases' && (
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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={mlConfig}
        onOpenAudit={() => setIsAuditOpen(true)}
        onSaveConfig={handleSaveConfig}
      />

      {/* Security Audit Modal */}
      <AuditModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />
    </div>
  );
}
