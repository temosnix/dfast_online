export interface Stats {
  total_anuncios: number;
  total_componentes: number;
  total_pedidos: number;
  pedidos_pendentes: number;
  pedidos_separados: number;
  pedidos_flex_hoje: number;
  itens_estoque_baixo: number;
}

export interface ComponentePedido {
  id_kit_nissi: string;
  qtd_necessaria: number;
  descricao: string;
  unidade_medida: string;
  local: string;
  saldo_atual: number;
}

export interface Pedido {
  id: number;
  order_id: string;
  ml_item_id: string;
  titulo: string;
  quantidade: number;
  comprador: string;
  data_venda: string;
  envio_tipo: 'flex' | 'coleta' | 'normal';
  envio_status: string;
  status_picking: 'pendente' | 'separado';
  separado_em: string | null;
  kit?: string;
  caixa?: string;
  componentes?: ComponentePedido[];
}

export interface RotaConsolidada {
  local: string;
  id_kit_nissi: string;
  descricao: string;
  unidade_medida: string;
  total_a_retirar: number;
  saldo_atual: number;
  pedidos_relacionados: string;
}

export interface CaixaNecessaria {
  numero_caixa: string;
  total_caixas: number;
}

export interface StockItem {
  id_nissi: string;
  descricao: string;
  unidade_medida: string;
  local: string;
  saldo_atual: number;
  estoque_minimo: number;
  total_anuncios_vinculados: number;
}

export interface PurchaseItem {
  id_nissi: string;
  descricao: string;
  unidade_medida: string;
  local: string;
  saldo_atual: number;
  estoque_minimo: number;
  demanda_pendente: number;
  sugestao_compra: number;
  urgencia: string;
}

export interface MLConfig {
  app_id: string;
  has_secret: boolean;
  seller_id: string;
  has_access_token?: boolean;
  has_refresh_token?: boolean;
  connected: boolean;
  encryption?: string;
  flex_cutoff: string;
  coleta_cutoff: string;
}
