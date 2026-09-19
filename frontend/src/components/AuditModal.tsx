import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  X, 
  RefreshCw, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Activity,
  Terminal,
  ShieldAlert
} from 'lucide-react';
import { AuditLog } from '../types';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditModal: React.FC<AuditModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'token' | 'csrf' | 'orders'>('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mercadolivre/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Erro ao carregar logs de auditoria:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    if (filter === 'token') return log.evento.includes('TOKEN') || log.evento.includes('OAUTH');
    if (filter === 'csrf') return log.evento.includes('CSRF');
    if (filter === 'orders') return log.evento.includes('ORDERS') || log.evento.includes('RATE');
    return true;
  });

  const getEventBadge = (evento: string) => {
    if (evento.includes('FAILED') || evento.includes('EXCEEDED')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert className="w-3 h-3" />
          {evento}
        </span>
      );
    }
    if (evento.includes('SUCCESS') || evento.includes('GENERATION')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" />
          {evento}
        </span>
      );
    }
    if (evento.includes('BACKOFF')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3 h-3" />
          {evento}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/10 text-sky-400 border border-sky-500/20">
        <Activity className="w-3 h-3" />
        {evento}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl relative max-h-[85vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-5 pr-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Trilha de Auditoria de Segurança</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  AES-256-GCM
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Registro de eventos em conformidade com as diretrizes do Mercado Libre Developers & LGPD
              </p>
            </div>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Security Badges */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block mb-0.5">Criptografia em Repouso</span>
            <span className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
              <Lock className="w-3.5 h-3.5" /> AES-256-GCM
            </span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block mb-0.5">Proteção OAuth 2.0</span>
            <span className="text-xs font-bold text-sky-400 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> CSRF State 128-bit
            </span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block mb-0.5">Ciclo do Token</span>
            <span className="text-xs font-bold text-amber-400 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Auto-Refresh 6h
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            Todos ({logs.length})
          </button>
          <button
            onClick={() => setFilter('token')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'token'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            Tokens & OAuth
          </button>
          <button
            onClick={() => setFilter('csrf')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'csrf'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            Defesa Anti-CSRF
          </button>
          <button
            onClick={() => setFilter('orders')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'orders'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            Sincronização & Rate Limit
          </button>
        </div>

        {/* Logs Table / List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs">
          {loading && logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
              <p>Carregando registros de auditoria...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Terminal className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p>Nenhum registro encontrado para este filtro.</p>
            </div>
          ) : (
            filteredLogs.map(log => (
              <div
                key={log.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold">#{log.id}</span>
                    {getEventBadge(log.evento)}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-sans">
                    <span>IP: <strong className="text-slate-300 font-mono">{log.ip_origem}</strong></span>
                    <span>•</span>
                    <span>{log.criado_em}</span>
                  </div>
                </div>
                <p className="text-slate-300 font-sans text-xs leading-relaxed pl-1">
                  {log.detalhes}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Banco de Dados SQLite: <strong className="text-slate-300 font-mono">ml_audit_log</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
