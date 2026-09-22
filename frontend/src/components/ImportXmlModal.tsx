import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Receipt, 
  Calendar, 
  Box, 
  ArrowRight, 
  PlusCircle, 
  Check, 
  Loader2,
  DollarSign
} from 'lucide-react';
import { authFetch } from '../api';

interface ImportXmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface ParsedItem {
  cProd: string;
  xProd: string;
  uCom: string;
  quantidade: number;
  valorUnitario: number;
  cadastrado: boolean;
  descricao_cadastrada: string | null;
  local_cadastrado: string;
  saldo_atual: number;
  novo_saldo: number;
  ultimo_custo: number;
  selected?: boolean;
}

interface ParsedNota {
  nNF: string;
  emitente: string;
  cnpj: string;
  dataEmissao: string;
  total_itens: number;
  total_unidades: number;
}

export const ImportXmlModal: React.FC<ImportXmlModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState<ParsedNota | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setNota(null);
    setItems([]);
    setError(null);
    setParsing(false);
    setImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processXmlContent = async (xmlString: string) => {
    setParsing(true);
    setError(null);
    try {
      const res = await authFetch('/api/stock/parse-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: xmlString }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao analisar arquivo XML.');
      }

      setNota(data.nota);
      setItems((data.itens || []).map((i: ParsedItem) => ({ ...i, selected: true })));
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao processar o arquivo XML.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.xml')) {
      setError('Por favor, selecione um arquivo válido com extensão .xml.');
      return;
    }

    setFile(selectedFile);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        processXmlContent(content);
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo selecionado.');
    };
    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleToggleSelectAll = () => {
    const allSelected = items.every(i => i.selected);
    setItems(items.map(i => ({ ...i, selected: !allSelected })));
  };

  const handleToggleItem = (index: number) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const handleConfirmImport = async () => {
    const selectedItems = items.filter(i => i.selected);
    if (selectedItems.length === 0) {
      setError('Selecione pelo menos um item para importar.');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await authFetch('/api/stock/import-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nNF: nota?.nNF || 'S/N',
          emitente: nota?.emitente || 'Distribuidor',
          itens: selectedItems.map(i => ({
            cProd: i.cProd,
            xProd: i.xProd,
            uCom: i.uCom,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao importar itens no estoque.');
      }

      onSuccess(data.message || `NF-e ${nota?.nNF} importada com sucesso!`);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao confirmar entrada de estoque.');
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = items.filter(i => i.selected).length;
  const selectedUnits = items.filter(i => i.selected).reduce((sum, i) => sum + i.quantidade, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Entrada de Estoque via XML</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  NF-e Distribuidor
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Importe notas fiscais eletrônicas de distribuidores para adicionar peças ao saldo físico.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-xs text-rose-300">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* STEP 1: Upload File */}
          {!nota && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-500/10' 
                    : 'border-slate-700 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-950/60'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  accept=".xml" 
                  className="hidden" 
                />

                {parsing ? (
                  <>
                    <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
                    <h3 className="text-sm font-bold text-white mt-2">Processando XML da NF-e...</h3>
                    <p className="text-xs text-slate-400">Extraindo cabeçalho e itens da nota fiscal eletrônica</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Arraste o arquivo XML da NF-e aqui ou clique para selecionar
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Formatos suportados: Arquivo XML padrão SEFAZ de fornecedor (ex: Nissi Auto Peças)
                      </p>
                    </div>
                    <span className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-colors">
                      Selecionar Arquivo .XML
                    </span>
                  </>
                )}
              </div>

              {/* Informative tips */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex items-start gap-3">
                <Box className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-400 leading-relaxed">
                  <span className="font-bold text-slate-200">Como funciona:</span> O sistema lê os códigos dos produtos (<code className="text-sky-300">cProd</code>) e quantidades (<code className="text-sky-300">qCom</code>), soma automaticamente ao saldo atual de cada peça no galpão e gera registro auditável de entrada com o número da Nota Fiscal.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview and Confirmation */}
          {nota && (
            <div className="space-y-5">
              {/* NF-e Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-sky-400" /> Nota Fiscal
                  </span>
                  <div className="text-base font-extrabold text-white mt-0.5">
                    Nº {nota.nNF}
                  </div>
                  <span className="text-[11px] text-slate-400">{nota.total_itens} itens detectados</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Emitente / Distribuidor
                  </span>
                  <div className="text-xs font-bold text-slate-200 truncate mt-0.5" title={nota.emitente}>
                    {nota.emitente}
                  </div>
                  {nota.cnpj && <span className="text-[11px] text-slate-400">CNPJ: {nota.cnpj}</span>}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" /> Emissão
                  </span>
                  <div className="text-xs font-bold text-slate-200 mt-0.5">
                    {nota.dataEmissao ? new Date(nota.dataEmissao).toLocaleDateString('pt-BR') : 'Data não informada'}
                  </div>
                  <span className="text-[11px] text-slate-400">Padrão SEFAZ</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Box className="w-3.5 h-3.5 text-amber-400" /> Total na Nota
                  </span>
                  <div className="text-base font-extrabold text-emerald-400 mt-0.5">
                    +{nota.total_unidades} un
                  </div>
                  <span className="text-[11px] text-slate-400">{selectedUnits} un selecionadas</span>
                </div>
              </div>

              {/* Items Table Header & Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleSelectAll}
                    className="text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    {items.every(i => i.selected) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </button>
                  <span className="text-xs text-slate-500">|</span>
                  <span className="text-xs text-slate-400">
                    {selectedCount} de {items.length} itens marcados para entrada
                  </span>
                </div>

                <button
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Trocar Arquivo XML
                </button>
              </div>

              {/* Items Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900/90 sticky top-0 z-10 border-b border-slate-800">
                      <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={items.length > 0 && items.every(i => i.selected)}
                            onChange={handleToggleSelectAll}
                            className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                        </th>
                        <th className="p-3">Código</th>
                        <th className="p-3">Descrição da Peça</th>
                        <th className="p-3 text-center">Qtd Nota</th>
                        <th className="p-3 text-center">Saldo Atual ➔ Novo</th>
                        <th className="p-3 text-right">Custo Unitário</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {items.map((item, idx) => (
                        <tr 
                          key={idx}
                          onClick={() => handleToggleItem(idx)}
                          className={`cursor-pointer transition-colors ${
                            item.selected ? 'bg-slate-900/40 hover:bg-slate-900/80' : 'bg-slate-950/30 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!item.selected}
                              onChange={() => handleToggleItem(idx)}
                              className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-white">{item.cProd}</span>
                              {!item.cadastrado && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Novo
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500">{item.uCom}</span>
                          </td>
                          <td className="p-3 max-w-xs">
                            <div className="font-medium text-slate-200 truncate" title={item.descricao_cadastrada || item.xProd}>
                              {item.descricao_cadastrada || item.xProd}
                            </div>
                            {item.cadastrado && item.local_cadastrado && item.local_cadastrado !== 'S/L' && (
                              <span className="text-[10px] text-slate-400">Loc: {item.local_cadastrado}</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-extrabold text-emerald-400">
                            +{item.quantidade}
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-slate-400">{item.saldo_atual}</span>
                            <span className="mx-1.5 text-slate-600">➔</span>
                            <span className="font-bold text-white">{item.novo_saldo}</span>
                          </td>
                          <td className="p-3 text-right font-medium text-slate-300">
                            {item.valorUnitario > 0 
                              ? `R$ ${item.valorUnitario.toFixed(2).replace('.', ',')}` 
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {nota && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importing || selectedCount === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importando NF-e...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirmar Entrada (+{selectedUnits} un)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
