// Dados mockados para o sistema de roteirização

// Tipos de OS - inclui versões com e sem acentos para compatibilidade
export type TipoOS = 
  | "CORTE" 
  | "RELIGA" 
  | "INSPEÇÃO" | "INSPECAO"
  | "LIGAÇÃO" | "LIGACAO"
  | "MANUTENÇÃO" | "MANUTENCAO"
  | "TROCA_MEDIDOR";

export interface OrdemServico {
  id: string;
  numero: string;
  tipo: TipoOS;
  endereco: string;
  latitude: number;
  longitude: number;
  prazo: Date | null; // Data/hora limite
  valor: number;
  tempoExecucao: number; // em minutos
  regulada: boolean;
  prioridade: "ALTA" | "NORMAL";
  // Campos opcionais para filtros avançados
  status?: string;
  contrato_id?: string | null;
  contrato_codigo?: string | null;
  contrato_nome?: string | null;
  centro_custo_id?: string | null;
  centro_custo_codigo?: string | null;
  centro_custo_nome?: string | null;
  municipio?: string | null;
  bairro?: string | null;
}

export interface Localizacao {
  lat: number;
  lng: number;
}

export interface ConfigAlmoco {
  duracao: number; // em minutos
  janelaInicio: string; // ex: "11:00"
  janelaFim: string; // ex: "14:00"
}

export interface Equipe {
  id: string;
  codigo: string;
  tecnico: string;
  latitude: number; // Ponto de saída/base (compatibilidade)
  longitude: number; // Ponto de saída/base (compatibilidade)
  localPartida?: Localizacao; // Casa do técnico (opcional, usa latitude/longitude se não definido)
  localChegada?: Localizacao; // Ponto de retorno (opcional, usa localPartida se não definido)
  habilidades: TipoOS[];
  skills: TipoOS[]; // Alias para habilidades (compatibilidade)
  jornadaHoras: number; // Horas disponíveis por dia (padrão 8)
  maxHorasTrabalho: number; // Capacidade máxima (ex: 10h)
  horaInicio: string; // ex: "07:30"
  almoco?: ConfigAlmoco; // Configuração de almoço (opcional)
  color: string; // Cor hexadecimal para visualização no mapa
}

// Coordenadas base (Vitória da Conquista, BA)
const BASE_LAT = -14.8661;
const BASE_LNG = -40.8394;

const tipoDuracao: Partial<Record<TipoOS, number>> = {
  CORTE: 15,
  RELIGA: 10,
  INSPEÇÃO: 30,
  INSPECAO: 30,
  LIGAÇÃO: 20,
  LIGACAO: 20,
  MANUTENÇÃO: 25,
  MANUTENCAO: 25,
  TROCA_MEDIDOR: 30,
};

// Helpers para gerar dados
function gerarPrazoHojeAleatorio(): Date {
  const hoje = new Date();
  const hora = 10 + Math.floor(Math.random() * 9); // 10..18
  const minuto = Math.floor(Math.random() * 60);
  const prazo = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate(),
    hora,
    minuto,
    0,
    0
  );
  return prazo;
}

function gerarCoordenadaProxima(): [number, number] {
  const latOffset = (Math.random() - 0.5) * 0.05; // ~5km de variação
  const lngOffset = (Math.random() - 0.5) * 0.05;
  return [BASE_LAT + latOffset, BASE_LNG + lngOffset];
}

function gerarOrdem(idx: number, comPrazo: boolean): OrdemServico {
  const tipos: TipoOS[] = ["CORTE", "RELIGA", "INSPEÇÃO"];
  const tipo = tipos[idx % tipos.length];
  const [lat, lng] = gerarCoordenadaProxima();
  const prazo = comPrazo ? gerarPrazoHojeAleatorio() : null;
  const valorBase = tipo === "INSPEÇÃO" ? 80 : tipo === "CORTE" ? 60 : 50;
  const valor = valorBase + Math.round(Math.random() * 40); // 50-120

  return {
    id: `os-${String(idx + 1).padStart(3, "0")}`,
    numero: `#${45820 + idx}`,
    tipo,
    endereco: `Endereço ${idx + 1} - Bairro ${((idx % 10) + 1)
      .toString()
      .padStart(2, "0")}`,
    latitude: lat,
    longitude: lng,
    prazo,
    valor,
    tempoExecucao: tipoDuracao[tipo] || 30,
    regulada: comPrazo || Math.random() < 0.15,
    prioridade: comPrazo ? "ALTA" : "NORMAL",
  };
}

// 100 Ordens de Serviço mockadas (20 com prazo hoje, 80 backlog)
const ordensPrioritarias: OrdemServico[] = Array.from({ length: 20 }).map((_, i) =>
  gerarOrdem(i, true)
);
const ordensNormais: OrdemServico[] = Array.from({ length: 80 }).map((_, i) =>
  gerarOrdem(i + 20, false)
);

export const ordensServicoMock: OrdemServico[] = [...ordensPrioritarias, ...ordensNormais];

// 5 Equipes mockadas com hora de início e capacidade estendida
export const equipesMock: Equipe[] = [
  {
    id: "eq-001",
    codigo: "EQ-001",
    tecnico: "João Silva",
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    habilidades: ["CORTE", "RELIGA", "INSPEÇÃO"],
    skills: ["CORTE", "RELIGA", "INSPEÇÃO"],
    jornadaHoras: 8,
    maxHorasTrabalho: 10,
    horaInicio: "07:30",
    color: "#3b82f6", // Azul
  },
  {
    id: "eq-002",
    codigo: "EQ-002",
    tecnico: "Pedro Costa",
    latitude: BASE_LAT + 0.005,
    longitude: BASE_LNG + 0.005,
    habilidades: ["CORTE", "RELIGA"],
    skills: ["CORTE", "RELIGA"],
    jornadaHoras: 8,
    maxHorasTrabalho: 10,
    horaInicio: "07:30",
    color: "#10b981", // Verde
  },
  {
    id: "eq-003",
    codigo: "EQ-003",
    tecnico: "Maria Santos",
    latitude: BASE_LAT - 0.005,
    longitude: BASE_LNG + 0.005,
    habilidades: ["CORTE", "INSPEÇÃO"],
    skills: ["CORTE", "INSPEÇÃO"],
    jornadaHoras: 8,
    maxHorasTrabalho: 10,
    horaInicio: "07:30",
    color: "#f59e0b", // Amarelo/Laranja
  },
  {
    id: "eq-004",
    codigo: "EQ-004",
    tecnico: "Carlos Oliveira",
    latitude: BASE_LAT + 0.01,
    longitude: BASE_LNG - 0.005,
    habilidades: ["RELIGA", "INSPEÇÃO"],
    skills: ["RELIGA", "INSPEÇÃO"],
    jornadaHoras: 8,
    maxHorasTrabalho: 10,
    horaInicio: "07:30",
    color: "#ef4444", // Vermelho
  },
  {
    id: "eq-005",
    codigo: "EQ-005",
    tecnico: "Ana Paula",
    latitude: BASE_LAT - 0.01,
    longitude: BASE_LNG - 0.005,
    habilidades: ["CORTE", "RELIGA", "INSPEÇÃO"],
    skills: ["CORTE", "RELIGA", "INSPEÇÃO"],
    jornadaHoras: 8,
    maxHorasTrabalho: 10,
    horaInicio: "07:30",
    color: "#8b5cf6", // Roxo
  },
];

