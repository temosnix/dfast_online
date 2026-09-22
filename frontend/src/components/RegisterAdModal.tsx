import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  Package, 
  ExternalLink, 
  Plus, 
  Trash2, 
  Check, 
  Search, 
  Layers, 
  ShoppingBag,
  Sparkles
} from 'lucide-react';
import { UnregisteredAd, StockItem } from '../types';
import { authFetch } from '../api';

interface RegisterAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  unregisteredAds: UnregisteredAd[];
  initialAd?: UnregisteredAd;
  stockList: StockItem[];
  onAdRegistered: () => void;
}

interface ComponentRow {
  id_kit_nissi: string;
  descricao: string;
  local: string;
  qtd_kit: number;
}

export const RegisterAdModal: React.FC<RegisterAdModalProps> = ({
  isOpen,
  onClose,
  unregisteredAds,
  initialAd,
  stockList,
  onAdRegistered,
}) => {
  const [selectedAd, setSelectedAd] = useState<UnregisteredAd | null>(null);
  const [caixa, setCaixa] = useState<string>('2');
  const [kit, setKit] = useState<'S' | 'N'>('S');
  const [componentes, setComponentes] = useState<ComponentRow[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inicialização do anúncio selecionado
  useEffect(() => {
    if (initialAd) {
      setSelectedAd(initialAd);
    } else if (unregisteredAds.length > 0) {
      setSelectedAd(unregisteredAds[0]);
    } else {
      setSelectedAd(null);
    }
  }, [initialAd, unregisteredAds, isOpen]);

  // Reset form when selected ad changes
  useEffect(() => {
    setCaixa('2');
    setKit('S');
    setComponentes([]);
    setSearchTerm('');
    setSuccessMessage(null);
    setErrorMessage(null);
  }, [selectedAd]);

  if (!isOpen) return null;

  const CAIXAS_SUGERIDAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  const filteredStock = stockList.filter(item => {
    const q = (searchTerm || '').toLowerCase().trim();
    if (!q) return true;
    const idStr = String(item.id_nissi ?? '').toLowerCase();
    const descStr = String(item.descricao ?? '').toLowerCase();
    const localStr = String(item.local ?? '').toLowerCase();
    return idStr.includes(q) || descStr.includes(q) || localStr.includes(q);
  }).slice(0, 15);

  const handleAddComponent = (item: StockItem) => {
    if (componentes.some(c => c.id_kit_nissi === item.id_nissi)) {
      setErrorMessage(`O componente ${item.id_nissi} já foi adicionado à lista.`);
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    setComponentes([
      ...componentes,
      {
        id_kit_nissi: item.id_nissi,
        descricao: item.descricao,
        local: item.local || 'S/L',
        qtd_kit: 1,
      }
    ]);
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleRemoveComponent = (index: number) => {
    setComponentes(componentes.filter((_, i) => i !== index));
  };

  const handleUpdateQtd = (index: number, qtd: number) => {
    const updated = [...componentes];
    updated[index].qtd_kit = Math.max(1, qtd);
    setComponentes(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAd) return;

    if (kit === 'S' && componentes.length === 0) {
      setErrorMessage('Para anúncios com kit (peças Nissi), adicione pelo menos 1 componente.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const res = await authFetch('/api/anuncios/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_ml: selectedAd.id_ml,
          caixa: caixa.trim(),
          kit: kit,
          componentes: kit === 'S' ? componentes.map(c => ({
            id_kit_nissi: c.id_kit_nissi,
            qtd_kit: c.qtd_kit,
          })) : [],
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Anúncio MLB-${selectedAd.id_ml} cadastrado com sucesso!`);
        setTimeout(() => {
          onAdRegistered();
          if (unregisteredAds.length <= 1) {
            onClose();
          }
        }, 1200);
      } else {
        setErrorMessage(data.error || 'Erro ao cadastrar anúncio.');
      }
    } catch (err: any) {
      setErrorMessage('Erro ao comunicar com o servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">Cadastrar Anúncio do Mercado Livre</h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {unregisteredAds.length} Pendente(s)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Defina o tamanho da caixa e vincule os componentes Nissi para separação imediata.
              </p>
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* Selector de Anúncios Pendentes (Tabs/Pills) */}
          {unregisteredAds.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Selecione o anúncio pendente para cadastrar:
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {unregisteredAds.map(ad => (
                  <button
                    key={ad.id_ml}
                    type="button"
                    onClick={() => setSelectedAd(ad)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-left border transition-all shrink-0 flex items-center gap-2 ${
                      selectedAd?.id_ml === ad.id_ml
                        ? 'bg-sky-500/20 border-sky-500 text-sky-200 shadow-md shadow-sky-500/10 font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span className="font-mono">MLB-{ad.id_ml}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {ad.total_pedidos}x
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedAd ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Card de Identificação do Anúncio */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-sky-500/20 text-sky-400 rounded-md border border-sky-500/30">
                      MLB-{selectedAd.id_ml}
                    </span>
                    <span className="text-xs text-slate-400">
                      {selectedAd.total_pedidos} venda(s) registrada(s) hoje
                    </span>
                  </div>
                  <a
                    href={`https://produto.mercadolivre.com.br/MLB-${selectedAd.id_ml}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors font-semibold"
                  >
                    <span>Abrir no Mercado Livre</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
                  {selectedAd.titulo}
                </h4>
              </div>

              {/* Grid: Caixa e Kit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Caixa */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Tamanho da Caixa de Envio:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={caixa}
                      onChange={e => setCaixa(e.target.value)}
                      placeholder="Ex: 2"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-semibold"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {CAIXAS_SUGERIDAS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCaixa(c)}
                        className={`px-2 py-1 text-[11px] rounded-lg font-bold border transition-all ${
                          caixa === c
                            ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        Caixa {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo de Produto / Origem: Kit (Peças Nissi) vs Sem Kit (Produção Local) */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Origem / Tipo do Anúncio:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKit('S')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 text-center ${
                        kit === 'S'
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300 ring-1 ring-sky-500/40 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <Layers className="w-4 h-4 text-sky-400" />
                        <span>Com Kit (Nissi)</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">Contém peças do distribuidor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setKit('N');
                        setComponentes([]);
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 text-center ${
                        kit === 'N'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>Sem Kit (No Local)</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">Fabricado no galpão</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    {kit === 'S' 
                      ? '📦 Flag [S]: O operador precisará retirar peças no almoxarifado Nissi.' 
                      : '🏭 Flag [N]: O item é produzido internamente. Não consome peças do almoxarifado.'}
                  </p>
                </div>
              </div>

              {/* Seção Condicional: Produção Local vs Componentes do Distribuidor Nissi */}
              {kit === 'N' ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>Produto de Fabricação Própria (Produzido no Local - Kit 'N')</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Este anúncio está configurado como <strong className="text-emerald-400">Sem Kit (Flag 'N')</strong>. Os itens são produzidos internamente e <strong className="text-white">não requerem peças do Distribuidor Nissi</strong>.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Ao salvar, o anúncio será registrado para uso da <strong>Caixa {caixa || 'Padrão'}</strong> e liberado para expedição sem pendência de almoxarifado.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <span>Componentes do Estoque (Distribuidor Nissi):</span>
                      <span className="text-[11px] text-emerald-400 font-semibold">({componentes.length} adicionados)</span>
                    </label>
                  </div>

                {/* Search / Add Component Input */}
                <div className="relative">
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus-within:border-sky-500 transition-all">
                    <Search className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => {
                        setSearchTerm(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Pesquise por código Nissi (ex: 110030P), descrição ou gaveta..."
                      className="w-full bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  {/* Dropdown Results */}
                  {showDropdown && searchTerm.trim().length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                      {filteredStock.length > 0 ? (
                        filteredStock.map(item => (
                          <div
                            key={item.id_nissi}
                            onClick={() => handleAddComponent(item)}
                            className="p-3 hover:bg-slate-800/80 cursor-pointer border-b border-slate-800/50 last:border-b-0 transition-colors flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-sky-400">{item.id_nissi}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                                  {item.local || 'Sem local'}
                                </span>
                                <span className="text-[10px] text-slate-500">Saldo: {item.saldo_atual}</span>
                              </div>
                              <p className="text-xs text-slate-300 truncate mt-0.5">{item.descricao}</p>
                            </div>
                            <button
                              type="button"
                              className="px-2.5 py-1 bg-sky-500/20 text-sky-300 rounded-lg text-xs font-bold hover:bg-sky-500 hover:text-slate-950 transition-colors shrink-0"
                            >
                              + Adicionar
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500">
                          Nenhum componente Nissi encontrado com o termo "{searchTerm}".
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tabela de Componentes Adicionados */}
                {componentes.length > 0 ? (
                  <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2.5">Código Nissi</th>
                          <th className="px-3 py-2.5">Descrição</th>
                          <th className="px-3 py-2.5">Local Galpão</th>
                          <th className="px-3 py-2.5 w-24 text-center">Qtd no Kit</th>
                          <th className="px-3 py-2.5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {componentes.map((c, idx) => (
                          <tr key={c.id_kit_nissi} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-3 py-2.5 font-mono font-bold text-sky-300">{c.id_kit_nissi}</td>
                            <td className="px-3 py-2.5 text-slate-200 max-w-xs truncate" title={c.descricao}>{c.descricao}</td>
                            <td className="px-3 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[11px]">
                                {c.local || 'Sem local'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="number"
                                min="1"
                                max="50"
                                value={c.qtd_kit}
                                onChange={e => handleUpdateQtd(idx, parseInt(e.target.value || '1', 10))}
                                className="w-14 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-center text-xs font-bold text-white focus:outline-none focus:border-sky-500"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveComponent(idx)}
                                className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Remover componente"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-xs">
                    Nenhum componente vinculado a este anúncio ainda. Pesquise e adicione as peças Nissi acima.
                  </div>
                )}
              </div>
              )}

              {/* Mensagens de Feedback */}
              {errorMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || (kit === 'S' && componentes.length === 0)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Gravando no SQLite...' : 'Salvar Cadastro no Banco'}</span>
                </button>
              </div>

            </form>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="font-bold text-white">Todos os anúncios vendidos estão devidamente cadastrados!</p>
              <p className="text-xs text-slate-500 mt-1">Nenhum anúncio pendente no momento.</p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
