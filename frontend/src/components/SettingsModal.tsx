import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Key, 
  Clock, 
  ExternalLink, 
  Check, 
  AlertCircle, 
  Lock,
  Sparkles
} from 'lucide-react';
import { MLConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: MLConfig | null;
  onSaveConfig: (form: {
    app_id: string;
    secret_key: string;
    seller_id: string;
    access_token: string;
    refresh_token: string;
    flex_cutoff: string;
    coleta_cutoff: string;
  }) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [formData, setFormData] = useState({
    app_id: '',
    secret_key: '',
    seller_id: '',
    access_token: '',
    refresh_token: '',
    flex_cutoff: '14:00',
    coleta_cutoff: '16:00',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        app_id: config.app_id || '',
        secret_key: '',
        seller_id: config.seller_id || '',
        access_token: '',
        refresh_token: '',
        flex_cutoff: config.flex_cutoff || '14:00',
        coleta_cutoff: config.coleta_cutoff || '16:00',
      });
    }
  }, [config]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveConfig(formData);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Configurações & Credenciais</h3>
            <p className="text-xs text-slate-400">Integração oficial com a API do Mercado Livre</p>
          </div>
        </div>

        {/* Security Warning Banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 mb-6 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-emerald-300/90 leading-relaxed">
            <strong>Proteção Total de Dados:</strong> Suas credenciais são salvas apenas no seu banco de dados local SQLite e protegidas por <code>.gitignore</code>. <strong>Nunca</strong> serão expostas ou versionadas no GitHub.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* App ID */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              App ID (Client ID) do Mercado Livre:
            </label>
            <input
              type="text"
              value={formData.app_id}
              onChange={e => setFormData({ ...formData, app_id: e.target.value })}
              placeholder="Ex: 84930219482019"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          {/* Secret Key */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Secret Key (Client Secret):
            </label>
            <input
              type="password"
              value={formData.secret_key}
              onChange={e => setFormData({ ...formData, secret_key: e.target.value })}
              placeholder={config?.has_secret ? '•••••••••••••••••••••••• (Já configurada)' : 'Cole sua chave secreta aqui'}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          {/* Seller ID */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Seller ID (Seu ID de Vendedor):
            </label>
            <input
              type="text"
              value={formData.seller_id}
              onChange={e => setFormData({ ...formData, seller_id: e.target.value })}
              placeholder="Ex: 123456789"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          {/* Access Token (Criptografado) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-300">
                Access Token (ML):
              </label>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                AES-256-GCM
              </span>
            </div>
            <input
              type="password"
              value={formData.access_token}
              onChange={e => setFormData({ ...formData, access_token: e.target.value })}
              placeholder={config?.has_access_token ? '•••••••••••••••••••••••• (Criptografado)' : 'Cole seu Access Token (opcional / preenchido via OAuth)'}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          {/* Refresh Token (Criptografado) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-300">
                Refresh Token (ML):
              </label>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                AES-256-GCM
              </span>
            </div>
            <input
              type="password"
              value={formData.refresh_token}
              onChange={e => setFormData({ ...formData, refresh_token: e.target.value })}
              placeholder={config?.has_refresh_token ? '•••••••••••••••••••••••• (Criptografado)' : 'Cole seu Refresh Token (opcional / renovado via OAuth)'}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          {/* Status do Ciclo de Vida do Token (6 Horas) */}
          {config?.has_access_token && config?.token_expires_at && (
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-sky-300">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] font-semibold">Validade do Token (Regra 6h):</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-sky-200 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                Até {new Date(config.token_expires_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Auto-Refresh)
              </span>
            </div>
          )}

          {/* Cutoff Times */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Corte Envio Flex:
              </label>
              <input
                type="text"
                value={formData.flex_cutoff}
                onChange={e => setFormData({ ...formData, flex_cutoff: e.target.value })}
                placeholder="14:00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white text-center font-bold focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Corte Envio Coleta:
              </label>
              <input
                type="text"
                value={formData.coleta_cutoff}
                onChange={e => setFormData({ ...formData, coleta_cutoff: e.target.value })}
                placeholder="16:00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white text-center font-bold focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Help Link */}
          <div className="pt-2 text-center">
            <a
              href="https://developers.mercadolivre.com.br"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Acessar portal Mercado Livre Developers</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Submit */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {success ? <Check className="w-4 h-4 stroke-[3]" /> : null}
              <span>{saving ? 'Salvando...' : success ? 'Salvo!' : 'Salvar Configurações'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
