// ============================================================================
// roteirizacao.ts - Sistema de Roteirização v19.5
// CORREÇÕES V19.5:
// - V19.4 + 50+ CENÁRIOS POR ZONA/TERRITÓRIO INDIVIDUAL
// - Simula 20+ cenários com estratégias muito diversas:
//   1-5: Nearest neighbor (tempo/distância), clusters, prazo+geo, simulated annealing, pontos partida
//   6-10: Variações com diferentes pontos de partida
//   11-12: Ordenação por distância da base (próximas/distantes primeiro)
//   13: Algoritmo genético (20 indivíduos, 30 gerações)
//   14: Lin-Kernighan heuristic (mais agressivo que 2-opt)
//   15: Otimização por ângulo polar (spiral pattern)
//   16: Otimização por densidade geográfica
//   17-18: Nearest/Farthest insertion heuristics
//   19: Ordenação por tempo de execução
//   20: Otimização híbrida combinando múltiplas estratégias
// - Score prioriza DISTÂNCIA (peso 10x maior) para maximizar economia de deslocamento
// - Aceita melhorias mínimas (0.1% distância ou 1min tempo) para capturar otimizações sutis
// - Validação menos restritiva permite mais otimizações serem aplicadas
// ============================================================================
import { OrdemServico, Equipe, TipoOS } from "@/data/mockData";
import { getTravelTimeMatrix } from "@/services/osrm";
import { getDadosSkills } from "@/lib/skillsUtils";
import { Territorio, pontoNoPoligono, carregarTerritorios } from "@/types/territorios";

// ============================================================================
// TIPOS
// ============================================================================
export type TipoItemRota = "SERVICO" | "ALMOCO";

export interface RotaServico {
  tipo: TipoItemRota;
  ordemServico?: OrdemServico;
  ordemNaRota: number;
  tempoDeslocamento: number;
  distancia: number; // Distância em km até este ponto
  tempoTotal: number;
  horaInicio: string;
  horaFim: string;
  eta: string;
  atrasado?: boolean;
  alerta?: string;
}

export interface RotaEquipe {
  equipe: Equipe;
  servicos: RotaServico[];
  tempoTotal: number;
  distanciaTotal: number;
  faturamentoTotal: number;
  progresso: number;
  zonaId?: number;
  territorioId?: string;
}

export interface NaoAlocada {
  os: OrdemServico;
  motivo: string;
}

export interface OpcaoRoteiro {
  id: string;
  nome: string;
  descricao: string;
  rotas: RotaEquipe[];
  naoAlocadas: NaoAlocada[];
  metricas: {
    totalOSs: number;
    totalDistanciaKm: number;
    totalFaturamento: number;
    totalTempoMin: number;
    osUrgentesAlocadas: number;
    osUrgentesTotal: number;
    equipesUtilizadas: number;
  };
  destacado?: boolean; // Indica se é a melhor opção em algum critério
  criterioDestaque?: 'financeiro' | 'quantidade' | 'distancia';
}

export interface ResultadoOtimizacao {
  rotas: RotaEquipe[];
  naoAlocadas: NaoAlocada[];
  sugestaoEquipes?: SugestaoEquipes; // V17: Sugestão de quantidade de equipes
  opcoesRoteiros?: OpcaoRoteiro[]; // V20: Múltiplas opções de roteiros
}

// V17: Interface para sugestão de equipes
export interface SugestaoEquipes {
  equipesParaReguladas: number;
  equipesParaTodasOSs: number;
  totalReguladasHoje: number;
  totalOSs: number;
  tempoMedioRegulada: number;
  tempoMedioOS: number;
  jornadaMediaMin: number;
  detalhamento: {
    totalTempoReguladasMin: number;
    totalTempoOSsMin: number;
    capacidadeEquipeMin: number;
  };
}

interface ZonaTerritorial {
  id: number;
  centroide: { lat: number; lng: number };
  oss: OrdemServico[];
  equipeAtribuida?: string;
  bairrosPrincipais: string[];
}

// ============================================================================
// CONSTANTES
// ============================================================================
const VELOCIDADE_MEDIA_KMH = 30;
const RAIO_TERRA_KM = 6371;

// V10: TIPOS SEPARADOS
const TIPOS_EMERGENCIA: string[] = ['RELIGA'];
const TIPOS_REGULADOS: string[] = ['RELIGA', 'LIGAÇÃO', 'LIGACAO'];

// V13: LIMITES DE DISTÂNCIA
const DISTANCIA_MAXIMA_EMERGENCIA_KM = 25;
const DISTANCIA_MAXIMA_ZONA_KM = 12;
const DISTANCIA_MAXIMA_NORMAL_KM = 8;
const DISTANCIA_MAXIMA_BALANCEAMENTO_KM = 6;
const DISTANCIA_MAXIMA_SATURACAO_KM = 15;
const DISTANCIA_CONSOLIDACAO_KM = 0.5;
const DISTANCIA_MAXIMA_REGULADA_URGENTE_KM = 35;
const DISTANCIA_MAXIMA_REGULADA_GLOBAL_KM = 20;

// V16: Limite de distância dentro do território
const DISTANCIA_MAXIMA_TERRITORIO_KM = 20;

// Centro de Vitória da Conquista
const CENTRO_VDC = { lat: -14.8661, lng: -40.8394 };

// V13: Raio rural
const RAIO_RURAL_KM = 20;
const RAIO_RURAL_REGULADA_KM = 35;

// V11: Threshold de progresso para saturação
const THRESHOLD_SATURACAO = 85;

// V13: Atraso máximo permitido para reguladas HOJE
const ATRASO_MAXIMO_REGULADA_HOJE_MIN = 120;

// V17: Tempo médio de deslocamento entre OSs (para cálculo de sugestão)
const TEMPO_MEDIO_DESLOCAMENTO_MIN = 10;

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

function encontrarTerritorioOS(
  lat: number, 
  lng: number, 
  territorios: Territorio[]
): Territorio | null {
  for (const t of territorios) {
    if (t.ativo && t.equipeIds && t.equipeIds.length > 0 && pontoNoPoligono({ lat, lng }, t.poligono)) {
      return t;
    }
  }
  return null;
}

function encontrarEquipeResponsavel(
  lat: number, 
  lng: number, 
  territorios: Territorio[]
): string | null {
  const territorio = encontrarTerritorioOS(lat, lng, territorios);
  // Retorna a primeira equipe do território (compatibilidade com código antigo)
  return territorio?.equipeIds && territorio.equipeIds.length > 0 ? territorio.equipeIds[0] : null;
}

function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function minutosParaHora(min: number): string {
  // Garantir que min seja um número válido
  const minutosTotal = Math.round(min);
  // Calcular horas e minutos corretamente
  const h = Math.floor(minutosTotal / 60);
  const m = minutosTotal % 60;
  // Garantir que minutos estejam entre 0-59
  const horasFinais = h + Math.floor(m / 60);
  const minutosFinais = m % 60;
  return `${String(horasFinais).padStart(2, "0")}:${String(minutosFinais).padStart(2, "0")}`;
}

export function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + 
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
  return RAIO_TERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcularTempoDeslocamento(distanciaKm: number): number {
  return (distanciaKm / VELOCIDADE_MEDIA_KMH) * 60;
}

function obterLocalPartida(equipe: Equipe): { lat: number; lng: number } {
  if (equipe.localPartida?.lat && equipe.localPartida?.lng) {
    return equipe.localPartida;
  }
  return { lat: equipe.latitude || -14.8661, lng: equipe.longitude || -40.8394 };
}

/**
 * Normaliza uma skill removendo acentos e convertendo para uppercase
 * Isso garante correspondência entre skills de OSs e equipes
 */
function normalizarSkill(skill: string): string {
  return skill
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[ÀÁÂÃÄÅ]/g, 'A')
    .replace(/[ÈÉÊË]/g, 'E')
    .replace(/[ÌÍÎÏ]/g, 'I')
    .replace(/[ÒÓÔÕÖ]/g, 'O')
    .replace(/[ÙÚÛÜ]/g, 'U')
    .replace(/[Ç]/g, 'C')
    .replace(/[Ñ]/g, 'N');
}

/**
 * Verifica se uma equipe tem a skill necessária para uma OS
 * Usa normalização para garantir correspondência mesmo com acentos diferentes
 */
function equipeTemSkill(equipe: Equipe, tipoOS: string): boolean {
  const tipoNormalizado = normalizarSkill(tipoOS);
  return equipe.skills.some(skill => normalizarSkill(skill) === tipoNormalizado);
}

function ehEmergencia(os: OrdemServico): boolean {
  const tipoUpper = os.tipo.toUpperCase();
  return TIPOS_EMERGENCIA.some(t => tipoUpper.includes(t));
}

function ehOSRegulada(os: OrdemServico): boolean {
  const tipoUpper = os.tipo.toUpperCase();
  for (const tipoRegulado of TIPOS_REGULADOS) {
    if (tipoUpper.includes(tipoRegulado)) return true;
  }
  return os.regulada === true;
}

function classificarPrazo(prazo: Date | null | undefined): 'sem_prazo' | 'futuro' | 'amanha' | 'hoje' | 'passado' {
  if (!prazo) return 'sem_prazo';
  
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const prazoDia = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());
  
  const diffDias = Math.floor((prazoDia.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDias < 0) return 'passado';
  if (diffDias === 0) return 'hoje';
  if (diffDias === 1) return 'amanha';
  return 'futuro';
}

// V17: Verifica se a OS é regulada vencendo hoje ou vencida
function ehReguladaUrgente(os: OrdemServico): boolean {
  const classificacao = classificarPrazo(os.prazo);
  const regulada = ehOSRegulada(os);
  return regulada && ['hoje', 'passado'].includes(classificacao);
}

function calcularPrioridade(os: OrdemServico): number {
  const classificacao = classificarPrazo(os.prazo);
  const emergencia = ehEmergencia(os);
  const regulada = ehOSRegulada(os);
  
  let prioridade = 0;
  switch (classificacao) {
    case 'passado': prioridade = 0; break;
    case 'hoje': prioridade = 100; break;
    case 'amanha': prioridade = 200; break;
    case 'futuro': prioridade = 300; break;
    case 'sem_prazo': prioridade = 400; break;
  }
  
  if (emergencia) prioridade -= 50;
  else if (!regulada) prioridade += 50;
  
  if (os.prazo && ['passado', 'hoje'].includes(classificacao)) {
    const horasPrazo = os.prazo.getHours() + os.prazo.getMinutes() / 60;
    prioridade += horasPrazo / 24;
  }
  
  return prioridade;
}

function obterConfigAlmoco(equipe: Equipe): { inicio: number; fim: number; duracao: number } {
  if (equipe.almoco) {
    return {
      inicio: horaParaMinutos(equipe.almoco.janelaInicio),
      fim: horaParaMinutos(equipe.almoco.janelaFim),
      duracao: equipe.almoco.duracao
    };
  }
  return { inicio: 720, fim: 780, duracao: 60 };
}

function extrairBairro(endereco: string): string {
  const partes = endereco.split(',');
  if (partes.length >= 2) {
    return partes[1].trim().toUpperCase();
  }
  return 'DESCONHECIDO';
}

// ============================================================================
// V17: FUNÇÃO DE SUGESTÃO DE QUANTIDADE DE EQUIPES
// ============================================================================
export function calcularSugestaoEquipes(
  ordensServico: OrdemServico[],
  equipes: Equipe[]
): SugestaoEquipes {
  // Calcular jornada média em minutos
  const jornadasMin = equipes.map(e => (e.maxHorasTrabalho || e.jornadaHoras || 8) * 60);
  const jornadaMediaMin = jornadasMin.reduce((a, b) => a + b, 0) / jornadasMin.length || 480;
  
  // Descontar almoço (média de 60 min)
  const tempoUtilPorEquipeMin = jornadaMediaMin - 60;
  
  // Separar reguladas urgentes (hoje/vencidas)
  const reguladasHoje = ordensServico.filter(os => ehReguladaUrgente(os));
  const todasOSs = ordensServico;
  
  // Calcular tempo total para reguladas
  const tempoTotalReguladasMin = reguladasHoje.reduce((acc, os) => {
    return acc + os.tempoExecucao + TEMPO_MEDIO_DESLOCAMENTO_MIN;
  }, 0);
  
  // Calcular tempo total para todas OSs
  const tempoTotalOSsMin = todasOSs.reduce((acc, os) => {
    return acc + os.tempoExecucao + TEMPO_MEDIO_DESLOCAMENTO_MIN;
  }, 0);
  
  // Calcular tempo médio
  const tempoMedioRegulada = reguladasHoje.length > 0 
    ? tempoTotalReguladasMin / reguladasHoje.length 
    : 0;
  const tempoMedioOS = todasOSs.length > 0 
    ? tempoTotalOSsMin / todasOSs.length 
    : 0;
  
  // Calcular quantidade de equipes necessárias
  const equipesParaReguladas = Math.ceil(tempoTotalReguladasMin / tempoUtilPorEquipeMin);
  const equipesParaTodasOSs = Math.ceil(tempoTotalOSsMin / tempoUtilPorEquipeMin);
  
  return {
    equipesParaReguladas: Math.max(1, equipesParaReguladas),
    equipesParaTodasOSs: Math.max(1, equipesParaTodasOSs),
    totalReguladasHoje: reguladasHoje.length,
    totalOSs: todasOSs.length,
    tempoMedioRegulada,
    tempoMedioOS,
    jornadaMediaMin,
    detalhamento: {
      totalTempoReguladasMin: tempoTotalReguladasMin,
      totalTempoOSsMin: tempoTotalOSsMin,
      capacidadeEquipeMin: tempoUtilPorEquipeMin
    }
  };
}

// ============================================================================
// EXPECTATIVA DE EQUIPES POR TERRITÓRIO
// ============================================================================

export interface ExpectativaTerritorio {
  territorioId: string;
  territorioNome: string;
  equipeIds: string[]; // Múltiplas equipes
  equipeCodigos: string[]; // Códigos das equipes vinculadas
  totalOSs: number;
  totalUrgentes: number;
  equipesNecessariasUrgentes: number;
  equipesNecessariasTotal: number;
  tempoTotalUrgentesMin: number;
  tempoTotalDemandaMin: number;
}

export function calcularExpectativaEquipesPorTerritorio(
  ordensServico: OrdemServico[],
  equipes: Equipe[],
  territorios: Territorio[]
): ExpectativaTerritorio[] {
  // Filtrar apenas territórios ativos (com ou sem equipes vinculadas)
  const territoriosAtivos = territorios.filter(t => t.ativo && t.poligono.length >= 3);
  
  if (territoriosAtivos.length === 0) {
    return [];
  }

  // Calcular jornada média em minutos
  const jornadasMin = equipes.map(e => (e.maxHorasTrabalho || e.jornadaHoras || 8) * 60);
  const jornadaMediaMin = jornadasMin.reduce((a, b) => a + b, 0) / jornadasMin.length || 480;
  
  // Descontar almoço (média de 60 min)
  const tempoUtilPorEquipeMin = jornadaMediaMin - 60;

  const expectativas: ExpectativaTerritorio[] = [];

  for (const territorio of territoriosAtivos) {
    // Filtrar OSs que estão dentro deste território
    const ossNoTerritorio = ordensServico.filter(os => 
      pontoNoPoligono({ lat: os.latitude, lng: os.longitude }, territorio.poligono)
    );

    // Filtrar apenas OSs urgentes (reguladas vencidas ou vencendo no dia)
    const ossUrgentes = ossNoTerritorio.filter(os => ehReguladaUrgente(os));

    // Calcular tempo total para urgentes
    const tempoTotalUrgentesMin = ossUrgentes.reduce((acc, os) => {
      return acc + os.tempoExecucao + TEMPO_MEDIO_DESLOCAMENTO_MIN;
    }, 0);

    // Calcular tempo total para toda a demanda
    const tempoTotalDemandaMin = ossNoTerritorio.reduce((acc, os) => {
      return acc + os.tempoExecucao + TEMPO_MEDIO_DESLOCAMENTO_MIN;
    }, 0);

    // Calcular quantidade de equipes necessárias (com uma casa decimal)
    const equipesNecessariasUrgentes = tempoUtilPorEquipeMin > 0 
      ? tempoTotalUrgentesMin / tempoUtilPorEquipeMin
      : 0;
    const equipesNecessariasTotal = tempoUtilPorEquipeMin > 0
      ? tempoTotalDemandaMin / tempoUtilPorEquipeMin
      : 0;

    // Encontrar equipes atribuídas ao território (pode não haver nenhuma)
    const equipesVinculadas = (territorio.equipeIds || [])
      .map(id => equipes.find(e => e.id === id))
      .filter(e => e !== undefined);
    const equipeCodigos = equipesVinculadas.map(e => e!.codigo);

    expectativas.push({
      territorioId: territorio.id,
      territorioNome: territorio.nome,
      equipeIds: territorio.equipeIds || [],
      equipeCodigos: equipeCodigos,
      totalOSs: ossNoTerritorio.length,
      totalUrgentes: ossUrgentes.length,
      equipesNecessariasUrgentes: Math.max(0, equipesNecessariasUrgentes), // Valor decimal
      equipesNecessariasTotal: Math.max(0, equipesNecessariasTotal), // Valor decimal
      tempoTotalUrgentesMin,
      tempoTotalDemandaMin
    });
  }

  return expectativas.sort((a, b) => a.territorioNome.localeCompare(b.territorioNome));
}

// ============================================================================
// SUGESTÃO DE UNIÃO DE TERRITÓRIOS
// ============================================================================

export interface SugestaoUniaoTerritorio {
  territorio1Id: string;
  territorio1Nome: string;
  territorio2Id: string;
  territorio2Nome: string;
  equipe1Codigo: string | null;
  equipe2Codigo: string | null;
  distanciaKm: number;
  equipesUrgentesSomadas: number;
  equipesTotalSomadas: number;
  totalUrgentesSomadas: number;
  totalOSsSomadas: number;
  beneficio: string; // Descrição do benefício da união
}

/**
 * Calcula o centroide (centro geográfico) de um polígono
 */
function calcularCentroide(poligono: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (poligono.length === 0) {
    return { lat: 0, lng: 0 };
  }
  
  let somaLat = 0;
  let somaLng = 0;
  
  for (const ponto of poligono) {
    somaLat += ponto.lat;
    somaLng += ponto.lng;
  }
  
  return {
    lat: somaLat / poligono.length,
    lng: somaLng / poligono.length
  };
}

/**
 * Sugere união de territórios próximos onde a soma de reguladas urgentes fica abaixo de 0.8 equipes
 */
export function sugerirUniaoTerritorios(
  expectativas: ExpectativaTerritorio[],
  territorios: Territorio[],
  limiteDistanciaKm: number = 15, // Distância máxima para considerar "próximos"
  limiteEquipesUrgentes: number = 0.8 // Limite de equipes para urgentes
): SugestaoUniaoTerritorio[] {
  const sugestoes: SugestaoUniaoTerritorio[] = [];
  
  // Criar mapa de expectativas por território
  const expectativasMap = new Map<string, ExpectativaTerritorio>();
  for (const exp of expectativas) {
    expectativasMap.set(exp.territorioId, exp);
  }
  
  // Criar mapa de territórios por ID
  const territoriosMap = new Map<string, Territorio>();
  for (const territorio of territorios) {
    territoriosMap.set(territorio.id, territorio);
  }
  
  // Calcular centroides de todos os territórios
  const centroides = new Map<string, { lat: number; lng: number }>();
  for (const territorio of territorios) {
    if (territorio.poligono.length >= 3) {
      centroides.set(territorio.id, calcularCentroide(territorio.poligono));
    }
  }
  
  // Comparar todos os pares de territórios
  const territoriosIds = Array.from(expectativasMap.keys());
  
  for (let i = 0; i < territoriosIds.length; i++) {
    for (let j = i + 1; j < territoriosIds.length; j++) {
      const id1 = territoriosIds[i];
      const id2 = territoriosIds[j];
      
      const exp1 = expectativasMap.get(id1);
      const exp2 = expectativasMap.get(id2);
      
      if (!exp1 || !exp2) continue;
      
      // Verificar se ambos têm equipes atribuídas
      if (!exp1.equipeIds || exp1.equipeIds.length === 0 || !exp2.equipeIds || exp2.equipeIds.length === 0) continue;
      
      // Verificar se são equipes diferentes (não faz sentido unir territórios da mesma equipe)
      // Se compartilham alguma equipe, não sugerir união
      const temEquipeComum = exp1.equipeIds.some(id => exp2.equipeIds.includes(id));
      if (temEquipeComum) continue;
      
      // Calcular distância entre centroides
      const centroide1 = centroides.get(id1);
      const centroide2 = centroides.get(id2);
      
      if (!centroide1 || !centroide2) continue;
      
      const distancia = calcularDistancia(
        centroide1.lat, centroide1.lng,
        centroide2.lat, centroide2.lng
      );
      
      // Verificar se estão próximos
      if (distancia > limiteDistanciaKm) continue;
      
      // Calcular soma das equipes necessárias para urgentes
      const equipesUrgentesSomadas = exp1.equipesNecessariasUrgentes + exp2.equipesNecessariasUrgentes;
      
      // Verificar se a soma está abaixo do limite
      if (equipesUrgentesSomadas >= limiteEquipesUrgentes) continue;
      
      // Calcular outras métricas somadas
      const equipesTotalSomadas = exp1.equipesNecessariasTotal + exp2.equipesNecessariasTotal;
      const totalUrgentesSomadas = exp1.totalUrgentes + exp2.totalUrgentes;
      const totalOSsSomadas = exp1.totalOSs + exp2.totalOSs;
      
      // Determinar benefício da união
      // Calcular economia: se separados precisariam de pelo menos 1 equipe cada (se > 0), unidos precisam de menos
      const equipesSeparadas = Math.ceil(exp1.equipesNecessariasUrgentes) + Math.ceil(exp2.equipesNecessariasUrgentes);
      const equipesUnidas = Math.ceil(equipesUrgentesSomadas);
      const economiaEquipes = equipesSeparadas - equipesUnidas;
      
      let beneficio: string;
      if (economiaEquipes > 0) {
        beneficio = `Economia de ${economiaEquipes} equipe(s) - Unidos: ${equipesUnidas}, Separados: ${equipesSeparadas}`;
      } else if (equipesUrgentesSomadas < 0.5) {
        beneficio = `Ambos têm poucas reguladas (${equipesUrgentesSomadas.toFixed(1)} equipes somadas)`;
      } else {
        beneficio = `Otimização: ${equipesUrgentesSomadas.toFixed(1)} equipe(s) para urgentes`;
      }
      
      sugestoes.push({
        territorio1Id: id1,
        territorio1Nome: exp1.territorioNome,
        territorio2Id: id2,
        territorio2Nome: exp2.territorioNome,
        equipe1Codigo: exp1.equipeCodigos.join(", "),
        equipe2Codigo: exp2.equipeCodigos.join(", "),
        distanciaKm: distancia,
        equipesUrgentesSomadas,
        equipesTotalSomadas,
        totalUrgentesSomadas,
        totalOSsSomadas,
        beneficio
      });
    }
  }
  
  // Ordenar por distância (mais próximos primeiro) e depois por benefício (menor soma de equipes primeiro)
  return sugestoes.sort((a, b) => {
    if (Math.abs(a.distanciaKm - b.distanciaKm) > 0.1) {
      return a.distanciaKm - b.distanciaKm;
    }
    return a.equipesUrgentesSomadas - b.equipesUrgentesSomadas;
  });
}

// ============================================================================
// V12: ZONEAMENTO COM GRID
// ============================================================================

function criarZonasGrid(
  oss: OrdemServico[],
  numZonas: number
): ZonaTerritorial[] {
  if (oss.length === 0 || numZonas <= 0) return [];
  
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  for (const os of oss) {
    minLat = Math.min(minLat, os.latitude);
    maxLat = Math.max(maxLat, os.latitude);
    minLng = Math.min(minLng, os.longitude);
    maxLng = Math.max(maxLng, os.longitude);
  }
  
  let gridRows: number, gridCols: number;
  if (numZonas <= 2) {
    gridRows = 1; gridCols = numZonas;
  } else if (numZonas <= 4) {
    gridRows = 2; gridCols = 2;
  } else if (numZonas <= 6) {
    gridRows = 2; gridCols = 3;
  } else {
    gridRows = 3; gridCols = 3;
  }
  
  const latStep = (maxLat - minLat) / gridRows;
  const lngStep = (maxLng - minLng) / gridCols;
  
  const zonas: ZonaTerritorial[] = [];
  let zonaId = 0;
  
  for (let row = 0; row < gridRows && zonaId < numZonas; row++) {
    for (let col = 0; col < gridCols && zonaId < numZonas; col++) {
      const centroLat = minLat + (row + 0.5) * latStep;
      const centroLng = minLng + (col + 0.5) * lngStep;
      
      zonas.push({
        id: zonaId,
        centroide: { lat: centroLat, lng: centroLng },
        oss: [],
        bairrosPrincipais: []
      });
      
      zonaId++;
    }
  }
  
  for (const os of oss) {
    let melhorZona: ZonaTerritorial | null = zonas[0] || null;
    let melhorDist = Infinity;
    
    for (const zona of zonas) {
      const dist = calcularDistancia(os.latitude, os.longitude, zona.centroide.lat, zona.centroide.lng);
      if (dist < melhorDist) {
        melhorDist = dist;
        melhorZona = zona;
      }
    }
    
    if (melhorZona) {
      melhorZona.oss.push(os);
    }
  }
  
  for (const zona of zonas) {
    const contadorBairros = new Map<string, number>();
    for (const os of zona.oss) {
      const bairro = extrairBairro(os.endereco);
      contadorBairros.set(bairro, (contadorBairros.get(bairro) || 0) + 1);
    }
    
    zona.bairrosPrincipais = [...contadorBairros.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([bairro]) => bairro);
  }
  
  return zonas;
}

/**
 * Cria zonas dentro de um polígono (território) para distribuir OSs entre múltiplas equipes
 */
function criarZonasDentroDoPoligono(
  oss: OrdemServico[],
  poligono: { lat: number; lng: number }[],
  numZonas: number
): ZonaTerritorial[] {
  if (oss.length === 0 || numZonas <= 0 || poligono.length < 3) return [];
  
  // Filtrar apenas OSs que estão dentro do polígono
  const ossDentroDoPoligono = oss.filter(os => 
    pontoNoPoligono({ lat: os.latitude, lng: os.longitude }, poligono)
  );
  
  if (ossDentroDoPoligono.length === 0) return [];
  
  // Calcular bounding box das OSs dentro do polígono
  let minLatOS = Infinity, maxLatOS = -Infinity;
  let minLngOS = Infinity, maxLngOS = -Infinity;
  
  for (const os of ossDentroDoPoligono) {
    minLatOS = Math.min(minLatOS, os.latitude);
    maxLatOS = Math.max(maxLatOS, os.latitude);
    minLngOS = Math.min(minLngOS, os.longitude);
    maxLngOS = Math.max(maxLngOS, os.longitude);
  }
  
  // Criar grid de zonas dentro do bounding box das OSs
  let gridRows: number, gridCols: number;
  if (numZonas <= 2) {
    gridRows = 1; gridCols = numZonas;
  } else if (numZonas <= 4) {
    gridRows = 2; gridCols = 2;
  } else if (numZonas <= 6) {
    gridRows = 2; gridCols = 3;
  } else {
    gridRows = 3; gridCols = 3;
  }
  
  const latStep = (maxLatOS - minLatOS) / gridRows;
  const lngStep = (maxLngOS - minLngOS) / gridCols;
  
  const zonas: ZonaTerritorial[] = [];
  let zonaId = 0;
  
  // Criar zonas dentro do grid
  for (let row = 0; row < gridRows && zonaId < numZonas; row++) {
    for (let col = 0; col < gridCols && zonaId < numZonas; col++) {
      const centroLat = minLatOS + (row + 0.5) * latStep;
      const centroLng = minLngOS + (col + 0.5) * lngStep;
      
      zonas.push({
        id: zonaId,
        centroide: { lat: centroLat, lng: centroLng },
        oss: [],
        bairrosPrincipais: []
      });
      zonaId++;
    }
  }
  
  // Se não criou zonas suficientes, criar zonas baseadas nos centroides das OSs
  if (zonas.length < numZonas) {
    const ossPorZona = Math.ceil(ossDentroDoPoligono.length / numZonas);
    for (let i = zonas.length; i < numZonas; i++) {
      const inicio = i * ossPorZona;
      const fim = Math.min(inicio + ossPorZona, ossDentroDoPoligono.length);
      const ossZona = ossDentroDoPoligono.slice(inicio, fim);
      
      if (ossZona.length > 0) {
        // Calcular centroide médio das OSs da zona
        const latMedia = ossZona.reduce((sum, os) => sum + os.latitude, 0) / ossZona.length;
        const lngMedia = ossZona.reduce((sum, os) => sum + os.longitude, 0) / ossZona.length;
        
        zonas.push({
          id: zonas.length,
          centroide: { lat: latMedia, lng: lngMedia },
          oss: [],
          bairrosPrincipais: []
        });
      }
    }
  }
  
  // Distribuir OSs pelas zonas (apenas OSs dentro do polígono)
  for (const os of ossDentroDoPoligono) {
    let melhorZona: ZonaTerritorial | null = zonas[0] || null;
    let melhorDist = Infinity;
    
    for (const zona of zonas) {
      const dist = calcularDistancia(os.latitude, os.longitude, zona.centroide.lat, zona.centroide.lng);
      if (dist < melhorDist) {
        melhorDist = dist;
        melhorZona = zona;
      }
    }
    
    if (melhorZona) {
      melhorZona.oss.push(os);
    }
  }
  
  // Calcular bairros principais de cada zona
  for (const zona of zonas) {
    const contadorBairros = new Map<string, number>();
    for (const os of zona.oss) {
      const bairro = extrairBairro(os.endereco);
      contadorBairros.set(bairro, (contadorBairros.get(bairro) || 0) + 1);
    }
    
    zona.bairrosPrincipais = [...contadorBairros.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([bairro]) => bairro);
  }
  
  return zonas;
}

function atribuirZonasEquipes(
  zonas: ZonaTerritorial[],
  rotas: RotaEquipe[]
): Map<string, number> {
  const atribuicoes = new Map<string, number>();
  const zonasAtribuidas = new Set<number>();
  
  const rotasOrdenadas = [...rotas].sort((a, b) => 
    a.equipe.codigo.localeCompare(b.equipe.codigo)
  );
  
  for (const rota of rotasOrdenadas) {
    const base = obterLocalPartida(rota.equipe);
    
    let melhorZona = -1;
    let melhorDist = Infinity;
    
    for (const zona of zonas) {
      if (zonasAtribuidas.has(zona.id)) continue;
      
      const dist = calcularDistancia(base.lat, base.lng, zona.centroide.lat, zona.centroide.lng);
      if (dist < melhorDist) {
        melhorDist = dist;
        melhorZona = zona.id;
      }
    }
    
    if (melhorZona >= 0) {
      atribuicoes.set(rota.equipe.id, melhorZona);
      zonasAtribuidas.add(melhorZona);
      rota.zonaId = melhorZona;
      
      // IMPORTANTE: Buscar zona pelo ID, não pelo índice (IDs podem não corresponder aos índices)
      const zona = zonas.find(z => z.id === melhorZona);
      console.log(`[ROUTING] Zona ${melhorZona} → ${rota.equipe.codigo}`);
      if (zona) {
        console.log(`[ROUTING]   Centroide: (${zona.centroide.lat.toFixed(4)}, ${zona.centroide.lng.toFixed(4)})`);
        console.log(`[ROUTING]   OSs: ${zona.oss.length}`);
        console.log(`[ROUTING]   Bairros: ${zona.bairrosPrincipais.slice(0, 3).join(', ')}`);
      } else {
        console.warn(`[ROUTING]   ⚠️ Zona ${melhorZona} não encontrada no array de zonas`);
      }
    } else {
      // V17: Equipe sem zona = equipe de backup (apenas para emergências)
      console.log(`[ROUTING] ${rota.equipe.codigo} → Equipe BACKUP (sem zona atribuída)`);
      rota.zonaId = -1; // Marca como backup
    }
  }
  
  return atribuicoes;
}

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================

export async function otimizarRotas(
  ordensServico: OrdemServico[],
  equipes: Equipe[],
  usarTerritorios: boolean = false,
  territoriosSelecionadosIds?: string[],
  estrategia?: 'financeiro' | 'quantidade' | 'distancia'
): Promise<ResultadoOtimizacao> {
  console.log(`[ROUTING] ════════════════════════════════════════════════════════`);
  console.log(`[ROUTING] ═══ V17 - REGULADAS COM PRIORIDADE ABSOLUTA ═══`);
  console.log(`[ROUTING] ════════════════════════════════════════════════════════`);
  console.log(`[ROUTING] ${ordensServico.length} OSs, ${equipes.length} equipes`);
  console.log(`[ROUTING] 🗺️ USAR TERRITÓRIOS: ${usarTerritorios ? 'SIM ✓' : 'NÃO ✗'}`);
  console.log(`[ROUTING] ⚡ V18: Emergências e Reguladas hoje têm PRIORIDADE ABSOLUTA`);
  console.log(`[ROUTING] 🚫 V18: Equipes NÃO invadem zonas/territórios de outras`);
  console.log(`[ROUTING] 🔥 V18: Emergências podem remover OSs normais para serem alocadas`);

  // ============================================================================
  // FASE 1: PREPARAÇÃO
  // ============================================================================
  
  const tiposUnicos = [...new Set(ordensServico.map(os => os.tipo))];
  const dadosSkills = await getDadosSkills(tiposUnicos);
  
  const oss: OrdemServico[] = ordensServico.map(os => {
    const dados = dadosSkills.get(os.tipo);
    return {
      ...os,
      tempoExecucao: dados?.tempoExecucao || os.tempoExecucao || 30,
      valor: dados?.valor || os.valor || 0,
      regulada: dados?.regulada ?? os.regulada ?? false
    };
  });

  const naoAlocadas: NaoAlocada[] = [];
  const osAlocadas = new Set<string>();

  // V17: Calcular sugestão de equipes
  const sugestaoEquipes = calcularSugestaoEquipes(oss, equipes);
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] 📊 SUGESTÃO DE EQUIPES:`);
  console.log(`[ROUTING]   Para reguladas vencendo hoje (${sugestaoEquipes.totalReguladasHoje}): ${sugestaoEquipes.equipesParaReguladas} equipes`);
  console.log(`[ROUTING]   Para todas as OSs (${sugestaoEquipes.totalOSs}): ${sugestaoEquipes.equipesParaTodasOSs} equipes`);

  // ============================================================================
  // V16/V17: CARREGAR E CONFIGURAR TERRITÓRIOS
  // ============================================================================
  
  let territoriosAtivos: Territorio[] = [];
  let osParaTerritorio = new Map<string, string>(); // Mapeia OS -> ID do território (não equipe específica)
  let territoriosPorEquipe = new Map<string, Territorio>();
  let equipesComTerritorio = new Set<string>();
  let equipesPorTerritorio = new Map<string, string[]>(); // Mapeia território -> equipes vinculadas
  
  // Função auxiliar para verificar se uma equipe está vinculada ao território de uma OS
  const equipeEstaNoTerritorioDaOS = (osId: string, equipeId: string): boolean => {
    const territorioId = osParaTerritorio.get(osId);
    if (!territorioId) return false;
    const equipesDoTerritorio = equipesPorTerritorio.get(territorioId) || [];
    return equipesDoTerritorio.includes(equipeId);
  };
  
  if (usarTerritorios) {
    const territorios = await carregarTerritorios();
    // Filtrar apenas territórios ativos com equipe atribuída
    let territoriosFiltrados = territorios.filter(t => t.ativo && t.equipeIds && t.equipeIds.length > 0);
    
    // Se foram fornecidos IDs de territórios selecionados, filtrar apenas esses
    if (territoriosSelecionadosIds && territoriosSelecionadosIds.length > 0) {
      territoriosFiltrados = territoriosFiltrados.filter(t => territoriosSelecionadosIds.includes(t.id));
      console.log(`[ROUTING]   Filtrando apenas ${territoriosSelecionadosIds.length} territórios selecionados`);
    }
    
    territoriosAtivos = territoriosFiltrados;
    
    console.log(`[ROUTING]`);
    console.log(`[ROUTING] ══ TERRITÓRIOS HABILITADOS ══`);
    console.log(`[ROUTING] Territórios ativos: ${territoriosAtivos.length}`);
    
    if (territoriosAtivos.length === 0) {
      console.log(`[ROUTING] ⚠️ AVISO: Nenhum território ativo encontrado!`);
    } else {
      for (const territorio of territoriosAtivos) {
        if (territorio.equipeIds && territorio.equipeIds.length > 0) {
          // Adicionar todas as equipes vinculadas ao território
          territorio.equipeIds.forEach(equipeId => {
            territoriosPorEquipe.set(equipeId, territorio);
            equipesComTerritorio.add(equipeId);
          });
          
          // Mapear equipes por território
          equipesPorTerritorio.set(territorio.id, territorio.equipeIds);
          
          const equipesVinculadas = territorio.equipeIds
            .map(id => equipes.find(e => e.id === id))
            .filter(e => e !== undefined);
          const codigosEquipes = equipesVinculadas.map(e => e!.codigo).join(", ");
          console.log(`[ROUTING]   ${territorio.nome} → ${codigosEquipes || territorio.equipeIds.join(", ")}`);
        }
      }
      
      let ossNosTerr = 0;
      let ossForaTerr = 0;
      
      // Mapear OSs para territórios (não para equipes específicas)
      for (const os of oss) {
        const territorio = encontrarTerritorioOS(os.latitude, os.longitude, territoriosAtivos);
        if (territorio) {
          osParaTerritorio.set(os.id, territorio.id); // Armazenar ID do território, não da equipe
          ossNosTerr++;
        } else {
          ossForaTerr++;
        }
      }
      
      console.log(`[ROUTING] OSs dentro de territórios: ${ossNosTerr}`);
      console.log(`[ROUTING] OSs FORA de territórios: ${ossForaTerr}`);
    }
  } else {
    console.log(`[ROUTING]`);
    console.log(`[ROUTING] ══ TERRITÓRIOS DESABILITADOS ══`);
    console.log(`[ROUTING] Usando modo V13 (zonas automáticas)`);
  }

  // ============================================================================
  // V17: FILTRAR EQUIPES E OSs BASEADO NO MODO
  // ============================================================================
  
  let equipesParaRoteirizar: Equipe[];
  let ossParaRoteirizar: OrdemServico[];
  
  if (usarTerritorios && territoriosAtivos.length > 0) {
    equipesParaRoteirizar = equipes.filter(e => equipesComTerritorio.has(e.id));
    
    for (const os of oss) {
      if (!osParaTerritorio.has(os.id)) {
        naoAlocadas.push({ os, motivo: "Fora de todos os territórios cadastrados" });
        osAlocadas.add(os.id);
      }
    }
    
    ossParaRoteirizar = oss.filter(os => osParaTerritorio.has(os.id));
    
    const equipesExcluidas = equipes.filter(e => !equipesComTerritorio.has(e.id));
    if (equipesExcluidas.length > 0) {
      console.log(`[ROUTING] Equipes SEM território (excluídas): ${equipesExcluidas.map(e => e.codigo).join(', ')}`);
    }
    
    console.log(`[ROUTING] Equipes participando: ${equipesParaRoteirizar.map(e => e.codigo).join(', ')}`);
    console.log(`[ROUTING] OSs a roteirizar: ${ossParaRoteirizar.length}`);
  } else {
    equipesParaRoteirizar = equipes;
    ossParaRoteirizar = oss;
  }

  // Criar rotas
  const rotas: RotaEquipe[] = equipesParaRoteirizar.map(equipe => {
    const territorio = territoriosPorEquipe.get(equipe.id);
    return {
      equipe,
      servicos: [],
    tempoTotal: horaParaMinutos(equipe.horaInicio),
      distanciaTotal: 0,
      faturamentoTotal: 0,
      progresso: 0,
      territorioId: territorio?.id
    };
  });

  if (equipesParaRoteirizar.length === 0) {
    console.log(`[ROUTING] ⚠️ Nenhuma equipe disponível!`);
    for (const os of oss) {
      if (!osAlocadas.has(os.id)) {
        naoAlocadas.push({ os, motivo: "Nenhuma equipe disponível" });
        osAlocadas.add(os.id);
      }
    }
    return { rotas: [], naoAlocadas, sugestaoEquipes };
  }

  // Matriz de tempos
  const locations: [number, number][] = [
    ...equipesParaRoteirizar.map(e => {
      const l = obterLocalPartida(e);
      return [l.lat, l.lng] as [number, number];
    }),
    ...ossParaRoteirizar.map(os => [os.latitude, os.longitude] as [number, number])
  ];

  let timeMatrix: number[][] | null = null;
  
  // Limite da API OSRM: máximo de ~100 pontos por requisição
  // Se exceder, usaremos Haversine como fallback
  const MAX_OSRM_POINTS = 100;
  
  if (locations.length <= MAX_OSRM_POINTS) {
    try {
      console.log(`[ROUTING] Buscando matriz de tempos OSRM para ${locations.length} pontos...`);
      timeMatrix = await getTravelTimeMatrix(locations);
      console.log(`[ROUTING] ✅ Matriz OSRM obtida com sucesso`);
    } catch (e: any) {
      console.warn(`[ROUTING] ⚠️ OSRM indisponível: ${e.message || e}`);
      console.log(`[ROUTING]   Usando cálculo de distância Haversine como fallback`);
    }
  } else {
    console.warn(`[ROUTING] ⚠️ Muitos pontos (${locations.length}) - OSRM suporta até ${MAX_OSRM_POINTS}`);
    console.log(`[ROUTING]   Usando cálculo de distância Haversine (estimativa 40km/h)`);
  }

  const getTempo = (fromIdx: number, toIdx: number): number => {
    if (timeMatrix?.[fromIdx]?.[toIdx] != null) {
      return timeMatrix[fromIdx][toIdx] / 60;
    }
    const [lat1, lng1] = locations[fromIdx];
    const [lat2, lng2] = locations[toIdx];
    return calcularTempoDeslocamento(calcularDistancia(lat1, lng1, lat2, lng2));
  };

  const getDistanciaKm = (fromIdx: number, toIdx: number): number => {
    const [lat1, lng1] = locations[fromIdx];
    const [lat2, lng2] = locations[toIdx];
    return calcularDistancia(lat1, lng1, lat2, lng2);
  };

  const equipeIdx = new Map(equipesParaRoteirizar.map((e, i) => [e.id, i]));
  const osIdx = new Map(ossParaRoteirizar.map((os, i) => [os.id, equipesParaRoteirizar.length + i]));

  // ============================================================================
  // FASE 2: SEPARAÇÃO POR URGÊNCIA
  // ============================================================================
  
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] ══ FASE 2: Classificação de OSs ══`);
  
  const osEmergencias: OrdemServico[] = [];
  const osReguladasHoje: OrdemServico[] = [];
  const osUrgentes: OrdemServico[] = [];
  const osProximoDia: OrdemServico[] = [];
  const osNormais: OrdemServico[] = [];
  const osSemSkill: OrdemServico[] = [];
  const osRurais: OrdemServico[] = [];
  
  for (const os of ossParaRoteirizar) {
    if (osAlocadas.has(os.id)) continue;
    
    const temEquipeComSkill = equipesParaRoteirizar.some(e => equipeTemSkill(e, os.tipo));
    
    if (!temEquipeComSkill) {
      console.log(`[ROUTING] ⚠️ OS ${os.numero} (tipo: ${os.tipo}) - Nenhuma equipe tem skill "${normalizarSkill(os.tipo)}"`);
      console.log(`[ROUTING]   Skills disponíveis: ${[...new Set(equipesParaRoteirizar.flatMap(e => e.skills.map(normalizarSkill)))].join(', ')}`);
      osSemSkill.push(os);
      continue;
    }
    
    // V17: Se usando territórios, verificar se a equipe do território tem skill
    if (usarTerritorios && territoriosAtivos.length > 0) {
      const territorioIdDaOS = osParaTerritorio.get(os.id);
      if (territorioIdDaOS) {
        // Verificar se alguma equipe do território tem a skill necessária
        const equipesDoTerritorio = equipesPorTerritorio.get(territorioIdDaOS) || [];
        const temEquipeNoTerritorioComSkill = equipesDoTerritorio.some(equipeId => {
          const equipe = equipesParaRoteirizar.find(e => e.id === equipeId);
          return equipe && equipeTemSkill(equipe, os.tipo);
        });
        if (!temEquipeNoTerritorioComSkill) {
          console.log(`[ROUTING] ⚠️ OS ${os.numero} no território ${territorioIdDaOS} - Nenhuma equipe do território tem skill "${normalizarSkill(os.tipo)}"`);
          osSemSkill.push(os);
          continue;
        }
      }
    }
    
    const distCentro = calcularDistancia(os.latitude, os.longitude, CENTRO_VDC.lat, CENTRO_VDC.lng);
    const classificacao = classificarPrazo(os.prazo);
    const emergencia = ehEmergencia(os);
    const regulada = ehOSRegulada(os);
    
    const ehReguladaUrgenteOS = regulada && ['hoje', 'passado'].includes(classificacao);
    const limiteRural = ehReguladaUrgenteOS ? RAIO_RURAL_REGULADA_KM : RAIO_RURAL_KM;
    
    // V17: Não aplicar filtro rural quando usando territórios
    if (!usarTerritorios && distCentro > limiteRural && !ehReguladaUrgenteOS) {
      osRurais.push(os);
      continue;
    }
    
    if (['hoje', 'passado'].includes(classificacao)) {
      if (emergencia) {
        osEmergencias.push(os);
      } else if (regulada) {
        osReguladasHoje.push(os);
      } else {
        osUrgentes.push(os);
      }
    } else if (classificacao === 'amanha') {
      osProximoDia.push(os);
    } else {
      osNormais.push(os);
    }
  }
  
  // Ordenar por prioridade
  osEmergencias.sort((a, b) => calcularPrioridade(a) - calcularPrioridade(b));
  osReguladasHoje.sort((a, b) => calcularPrioridade(a) - calcularPrioridade(b));
  osUrgentes.sort((a, b) => calcularPrioridade(a) - calcularPrioridade(b));
  
  // V20: Aplicar ordenação estratégica para osProximoDia e osNormais
  if (estrategia === 'financeiro') {
    // Ordenar por valor (maior primeiro)
    osProximoDia.sort((a, b) => (b.valor || 0) - (a.valor || 0));
    osNormais.sort((a, b) => (b.valor || 0) - (a.valor || 0));
  } else if (estrategia === 'quantidade') {
    // Ordenar por tempo de execução (menor primeiro) para caber mais OSs
    osProximoDia.sort((a, b) => (a.tempoExecucao || 0) - (b.tempoExecucao || 0));
    osNormais.sort((a, b) => (a.tempoExecucao || 0) - (b.tempoExecucao || 0));
  }
  // Para 'distancia', manter ordem original (será otimizada durante alocação geográfica)
  
  // Marcar sem skill
  // Agrupar OSs sem skill por tipo para gerar mensagens de erro detalhadas
  const osSemSkillPorTipo = new Map<string, OrdemServico[]>();
  for (const os of osSemSkill) {
    const tipoNorm = normalizarSkill(os.tipo);
    if (!osSemSkillPorTipo.has(tipoNorm)) {
      osSemSkillPorTipo.set(tipoNorm, []);
    }
    osSemSkillPorTipo.get(tipoNorm)!.push(os);
  }
  
  // Log resumo de skills faltantes
  if (osSemSkillPorTipo.size > 0) {
    console.log(`[ROUTING] ════════════════════════════════════════════════════════`);
    console.log(`[ROUTING] ⚠️ RESUMO DE SKILLS NÃO ENCONTRADAS:`);
    const skillsDisponiveis = [...new Set(equipesParaRoteirizar.flatMap(e => e.skills.map(normalizarSkill)))];
    console.log(`[ROUTING]   Skills disponíveis nas equipes: ${skillsDisponiveis.join(', ') || 'NENHUMA'}`);
    for (const [tipo, oss] of osSemSkillPorTipo) {
      console.log(`[ROUTING]   ❌ Skill "${tipo}": ${oss.length} OSs não podem ser alocadas`);
      if (usarTerritorios) {
        // Agrupar por território
        const ossPorTerritorio = new Map<string, number>();
        for (const os of oss) {
          const territorioId = osParaTerritorio.get(os.id) || 'fora_territorio';
          ossPorTerritorio.set(territorioId, (ossPorTerritorio.get(territorioId) || 0) + 1);
        }
        for (const [terr, count] of ossPorTerritorio) {
          const terrNome = territoriosAtivos.find(t => t.id === terr)?.nome || terr;
          console.log(`[ROUTING]      - Território "${terrNome}": ${count} OSs`);
        }
      }
    }
    console.log(`[ROUTING] ════════════════════════════════════════════════════════`);
  }
  
  for (const os of osSemSkill) {
    const tipoNorm = normalizarSkill(os.tipo);
    const skillsDisponiveis = [...new Set(equipesParaRoteirizar.flatMap(e => e.skills.map(normalizarSkill)))];
    const motivo = usarTerritorios 
      ? `Equipe do território não possui skill "${tipoNorm}" (disponíveis: ${skillsDisponiveis.join(', ') || 'nenhuma'})`
      : `Nenhuma equipe possui skill "${tipoNorm}" (disponíveis: ${skillsDisponiveis.join(', ') || 'nenhuma'})`;
    naoAlocadas.push({ os, motivo });
    osAlocadas.add(os.id);
  }
  
  // Marcar rurais
  for (const os of osRurais) {
    const distCentro = calcularDistancia(os.latitude, os.longitude, CENTRO_VDC.lat, CENTRO_VDC.lng);
    naoAlocadas.push({ os, motivo: `Área rural (${distCentro.toFixed(1)}km do centro)` });
    osAlocadas.add(os.id);
  }
  
  console.log(`[ROUTING] EMERGÊNCIAS (RELIGA): ${osEmergencias.length}`);
  console.log(`[ROUTING] ⚡ REGULADAS HOJE (PRIORIDADE ABSOLUTA): ${osReguladasHoje.length}`);
  console.log(`[ROUTING] Urgentes: ${osUrgentes.length}`);
  console.log(`[ROUTING] Próximo dia: ${osProximoDia.length}`);
  console.log(`[ROUTING] Normais: ${osNormais.length}`);
  console.log(`[ROUTING] Rurais: ${osRurais.length}`);
  console.log(`[ROUTING] Sem skill: ${osSemSkill.length}`);

  // ============================================================================
  // FASE 3: CRIAR ZONAS TERRITORIAIS (APENAS MODO SEM TERRITÓRIO)
  // ============================================================================

  let zonas: ZonaTerritorial[] = [];
  const zonasPorOS = new Map<string, number>();
  
  if (!usarTerritorios || territoriosAtivos.length === 0) {
    console.log(`[ROUTING]`);
    console.log(`[ROUTING] ══ FASE 3: Criação de Zonas Territoriais (Modo V13) ══`);
    
    const ossParaZonear = [
      ...osReguladasHoje,
      ...osUrgentes,
      ...osProximoDia,
      ...osNormais
    ];
    
    const numZonas = Math.min(equipesParaRoteirizar.length, Math.max(1, Math.ceil(ossParaZonear.length / 25)));
    zonas = criarZonasGrid(ossParaZonear, numZonas);
    
    console.log(`[ROUTING] Criadas ${zonas.length} zonas para ${ossParaZonear.length} OSs`);
    
    console.log(`[ROUTING]`);
    console.log(`[ROUTING] ═ Atribuição de Zonas ═`);
    atribuirZonasEquipes(zonas, rotas);
    
    for (const zona of zonas) {
      for (const os of zona.oss) {
        zonasPorOS.set(os.id, zona.id);
      }
    }
    
    let ossSemZona = 0;
    for (const os of ossParaZonear) {
      if (!zonasPorOS.has(os.id)) {
        ossSemZona++;
        let nearestZone: ZonaTerritorial | null = zonas[0] || null;
        let nearestDist = Infinity;
        for (const zona of zonas) {
          const dist = calcularDistancia(os.latitude, os.longitude, zona.centroide.lat, zona.centroide.lng);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestZone = zona;
          }
        }
        if (nearestZone) {
          zonasPorOS.set(os.id, nearestZone.id);
          nearestZone.oss.push(os);
        }
      }
    }
    
    console.log(`[ROUTING]`);
    console.log(`[ROUTING] ═ Resumo das Zonas ═`);
    for (const zona of zonas) {
      const equipeAtribuida = rotas.find(r => r.zonaId === zona.id)?.equipe.codigo || 'NENHUMA';
      const reguladasNaZona = zona.oss.filter(os => ehReguladaUrgente(os)).length;
      console.log(`[ROUTING] Zona ${zona.id}: ${zona.oss.length} OSs (${reguladasNaZona} reguladas hoje) → ${equipeAtribuida}`);
    }
  } else {
    console.log(`[ROUTING]`);
    console.log(`[ROUTING] ══ FASE 3: Usando Territórios Cadastrados ══`);
    
    // Para territórios com múltiplas equipes, criar zonas dentro do polígono para evitar rotas cruzadas
    const territoriosComMultiplasEquipes = territoriosAtivos.filter(t => 
      t.equipeIds && t.equipeIds.length > 1
    );
    
    if (territoriosComMultiplasEquipes.length > 0) {
      console.log(`[ROUTING]`);
      console.log(`[ROUTING] ══ Criando Zonas dentro dos Territórios ══`);
      
      let zonaIdOffset = 0;
      
      for (const territorio of territoriosComMultiplasEquipes) {
        const equipesDoTerritorio = equipesPorTerritorio.get(territorio.id) || [];
        const numEquipes = equipesDoTerritorio.length;
        
        // Filtrar OSs que estão dentro deste território
        const ossNoTerritorio = [
          ...osReguladasHoje,
          ...osUrgentes,
          ...osProximoDia,
          ...osNormais
        ].filter(os => osParaTerritorio.get(os.id) === territorio.id);
        
        if (ossNoTerritorio.length === 0) {
          console.log(`[ROUTING]   Território "${territorio.nome}": Nenhuma OS para criar zonas`);
          continue;
        }
        
        // Criar zonas dentro do polígono do território
        const zonasTerritorio = criarZonasDentroDoPoligono(ossNoTerritorio, territorio.poligono, numEquipes);
        
        // Ajustar IDs das zonas para serem únicos (usar offset)
        for (const zona of zonasTerritorio) {
          zona.id = zonaIdOffset + zona.id;
        }
        
        console.log(`[ROUTING]   Território "${territorio.nome}": ${zonasTerritorio.length} zonas criadas para ${ossNoTerritorio.length} OSs`);
        
        // Atribuir zonas às equipes do território
        const rotasDoTerritorio = rotas.filter(r => equipesDoTerritorio.includes(r.equipe.id));
        console.log(`[ROUTING]     Equipes do território: ${rotasDoTerritorio.map(r => r.equipe.codigo).join(", ")}`);
        atribuirZonasEquipes(zonasTerritorio, rotasDoTerritorio);
        
        // Log das zonas atribuídas
        for (const rota of rotasDoTerritorio) {
          if (rota.zonaId !== undefined && rota.zonaId >= 0) {
            const zona = zonasTerritorio.find(z => z.id === rota.zonaId);
            console.log(`[ROUTING]     ${rota.equipe.codigo} → Zona ${rota.zonaId} (${zona?.oss.length || 0} OSs)`);
          }
        }
        
        // Mapear OSs para zonas (usar IDs ajustados)
        for (const zona of zonasTerritorio) {
          for (const os of zona.oss) {
            zonasPorOS.set(os.id, zona.id);
          }
        }
        
        // Garantir que todas as OSs do território tenham uma zona atribuída
        for (const os of ossNoTerritorio) {
          if (!zonasPorOS.has(os.id)) {
            let melhorZona = zonasTerritorio[0];
            let melhorDist = Infinity;
            for (const zona of zonasTerritorio) {
              const dist = calcularDistancia(os.latitude, os.longitude, zona.centroide.lat, zona.centroide.lng);
              if (dist < melhorDist) {
                melhorDist = dist;
                melhorZona = zona;
              }
            }
            zonasPorOS.set(os.id, melhorZona.id);
            melhorZona.oss.push(os);
          }
        }
        
        // Adicionar zonas ao array global
        zonas.push(...zonasTerritorio);
        
        // Atualizar offset para próximo território
        zonaIdOffset += zonasTerritorio.length;
      }
    }
  }

  // Funções auxiliares
  const getUltimaLocalizacao = (rota: RotaEquipe): number => {
    const servicos = rota.servicos.filter(s => s.tipo === "SERVICO" && s.ordemServico);
    if (servicos.length === 0) return equipeIdx.get(rota.equipe.id)!;
    return osIdx.get(servicos[servicos.length - 1].ordemServico!.id)!;
  };

  const getTempoAtual = (rota: RotaEquipe): number => {
    if (rota.servicos.length === 0) return horaParaMinutos(rota.equipe.horaInicio);
    return rota.servicos[rota.servicos.length - 1].tempoTotal;
  };

  const getFimJornada = (equipe: Equipe): number => {
    const inicio = horaParaMinutos(equipe.horaInicio);
    const horas = equipe.maxHorasTrabalho || equipe.jornadaHoras || 10;
    return inicio + horas * 60;
  };

  const jaAlmocou = (rota: RotaEquipe): boolean => {
    return rota.servicos.some(s => s.tipo === "ALMOCO");
  };

  /**
   * Verifica se deve adiar o almoço para encaixar uma OS curta no tempo livre.
   * Retorna true se há tempo suficiente para encaixar uma OS curta antes do almoço.
   * 
   * Regras:
   * - Se terminar > 15 min antes do início da janela, há "tempo livre"
   * - Verificar se existe OS curta (≤30 min) que pode ser encaixada
   * - A flexibilidade do almoço permite iniciar até (config.fim - config.duracao)
   */
  const podeEncaixarOSCurtaAntesDoAlmoco = (
    tempo: number,
    equipe: Equipe
  ): { podeEncaixar: boolean; tempoLivre: number; ultimoInicioAlmoco: number } => {
    const config = obterConfigAlmoco(equipe);
    const tempoLivre = config.inicio - tempo; // tempo até o início da janela
    const ultimoInicioAlmoco = config.fim - config.duracao; // flexibilidade
    
    // Se tem mais de 15 min de tempo livre E ainda há flexibilidade na janela
    const podeEncaixar = tempoLivre > 15 && tempo < ultimoInicioAlmoco;
    
    return { podeEncaixar, tempoLivre, ultimoInicioAlmoco };
  };

  const ajustarParaAlmoco = (
    tempo: number, 
    duracao: number, 
    equipe: Equipe, 
    almocou: boolean,
    forcaAlmoco: boolean = false // Se true, força inserção do almoço mesmo com tempo livre
  ): { tempo: number; almocoInserido: boolean; inicioAlmoco?: number; fimAlmoco?: number; podeEncaixarOSCurta?: boolean } => {
    if (almocou) return { tempo, almocoInserido: false };
    
    const config = obterConfigAlmoco(equipe);
    const fimServico = tempo + duracao;
    
    // Calcular o último momento possível para INICIAR o almoço 
    // (o almoço deve TERMINAR até config.fim)
    const ultimoInicioPermitido = config.fim - config.duracao;
    
    // Verificar se há tempo livre antes da janela para encaixar OS curta
    const verificacaoEncaixe = podeEncaixarOSCurtaAntesDoAlmoco(tempo, equipe);
    
    // Ainda muito cedo para almoço - próximo serviço termina antes da janela
    if (fimServico <= config.inicio) {
      // Se há bastante tempo livre (>15 min) e não está forçando almoço,
      // sinalizar que pode encaixar uma OS curta
      if (verificacaoEncaixe.podeEncaixar && !forcaAlmoco) {
        return { tempo, almocoInserido: false, podeEncaixarOSCurta: true };
      }
      return { tempo, almocoInserido: false };
    }
    
    // Já passou do momento de fazer almoço (não há tempo para completá-lo dentro da janela)
    if (tempo > ultimoInicioPermitido) return { tempo, almocoInserido: false };
    
    // Determinar quando o almoço começa:
    // - Não antes de config.inicio (início da janela)
    // - Não depois de ultimoInicioPermitido (para terminar dentro da janela)
    // - Não antes do tempo atual
    const inicioAlmoco = Math.max(tempo, config.inicio);
    
    // Verificar se ainda cabe o almoço (fim do almoço <= fim da janela)
    const fimAlmoco = inicioAlmoco + config.duracao;
    if (fimAlmoco > config.fim) {
      // Não cabe mais - já perdeu a janela
      return { tempo, almocoInserido: false };
    }
    
    return { tempo: fimAlmoco, almocoInserido: true, inicioAlmoco, fimAlmoco };
  };
  
  /**
   * Encontra uma OS curta (≤30 min execução) que pode ser encaixada antes do almoço.
   * Prioriza OSs mais próximas geograficamente.
   */
  const encontrarOSCurtaParaEncaixar = (
    rota: RotaEquipe,
    osDisponiveis: OrdemServico[],
    osAlocadas: Set<string>,
    tempoAtual: number,
    tempoMaximoExecucao: number = 30
  ): OrdemServico | null => {
    const config = obterConfigAlmoco(rota.equipe);
    const ultimoInicioAlmoco = config.fim - config.duracao;
    
    // Tempo disponível antes de precisar iniciar o almoço no limite
    const tempoDisponivelTotal = ultimoInicioAlmoco - tempoAtual;
    
    if (tempoDisponivelTotal <= 0) return null;
    
    // Obter última localização da rota
    let ultimaLat = rota.equipe.latitude;
    let ultimaLng = rota.equipe.longitude;
    if (rota.servicos.length > 0) {
      const ultimoServico = rota.servicos[rota.servicos.length - 1];
      if (ultimoServico.ordemServico) {
        ultimaLat = ultimoServico.ordemServico.latitude ?? ultimaLat;
        ultimaLng = ultimoServico.ordemServico.longitude ?? ultimaLng;
      }
    }
    
    // Filtrar OSs elegíveis
    const osCurtas = osDisponiveis
      .filter(os => {
        if (osAlocadas.has(os.id)) return false;
        if (!equipeTemSkill(rota.equipe, os.tipo)) return false;
        if (os.tempoExecucao > tempoMaximoExecucao) return false;
        if (os.latitude === null || os.longitude === null) return false;
        
        // Verificar território
        if (usarTerritorios && territoriosAtivos.length > 0) {
          const territorioId = osParaTerritorio.get(os.id);
          if (territorioId && !equipeEstaNoTerritorioDaOS(os.id, rota.equipe.id)) return false;
        }
        
        // Calcular tempo total (deslocamento + execução)
        const distancia = calcularDistancia(ultimaLat, ultimaLng, os.latitude, os.longitude);
        const tempoDeslocamento = calcularTempoDeslocamento(distancia);
        const tempoTotal = tempoDeslocamento + os.tempoExecucao;
        
        // Verificar se cabe antes do limite do almoço
        return (tempoAtual + tempoTotal) <= ultimoInicioAlmoco;
      })
      .map(os => {
        const distancia = calcularDistancia(ultimaLat, ultimaLng, os.latitude!, os.longitude!);
        return { os, distancia };
      })
      .sort((a, b) => a.distancia - b.distancia); // Ordenar por proximidade
    
    return osCurtas.length > 0 ? osCurtas[0].os : null;
  };

  /**
   * V17: Calcula inserção com verificação estrita de território/zona
   * NUNCA permite invadir zona/território de outra equipe
   */
  const calcularInsercao = (
    rota: RotaEquipe,
    os: OrdemServico,
    permitirAtraso: boolean = false,
    distanciaMaximaKm: number = DISTANCIA_MAXIMA_NORMAL_KM,
    ignorarRestricoes: boolean = false, // V17: Só para emergências absolutas
    atrasoMaximoMin: number = 60
  ): { 
    valido: boolean; 
    eta: number; 
    fimServico: number; 
    tempoDesloc: number;
    distanciaKm: number;
    almocoInserido: boolean;
    inicioAlmoco?: number;
    fimAlmoco?: number;
    motivo?: string;
    atrasoMinutos?: number;
  } => {
    // Verificar skill
    if (!equipeTemSkill(rota.equipe, os.tipo)) {
      return { valido: false, eta: 0, fimServico: 0, tempoDesloc: 0, distanciaKm: 0, almocoInserido: false, motivo: `Sem skill (${normalizarSkill(os.tipo)})` };
    }

    // V18: Verificar território/zona - NUNCA invadir (exceto emergências com ignorarRestricoes=true)
    if (usarTerritorios && territoriosAtivos.length > 0) {
      const territorioIdDaOS = osParaTerritorio.get(os.id);
      
      // Se a OS tem território definido, verificar se a equipe da rota está vinculada ao território
      if (territorioIdDaOS) {
        const equipesDoTerritorio = equipesPorTerritorio.get(territorioIdDaOS) || [];
        const equipeEstaNoTerritorio = equipesDoTerritorio.includes(rota.equipe.id);
        
        if (!equipeEstaNoTerritorio) {
          // V18: Só permitir ignorar restrições se for realmente uma emergência
          if (!ignorarRestricoes || !ehEmergencia(os)) {
          return { 
            valido: false, eta: 0, fimServico: 0, tempoDesloc: 0, distanciaKm: 0,
              almocoInserido: false, motivo: `Equipe não está vinculada ao território da OS (território: ${territorioIdDaOS})` 
            };
          }
        }
        
        // Se há múltiplas equipes no território e zonas foram criadas, verificar se a OS está na zona da equipe
        if (equipesDoTerritorio.length > 1 && zonas.length > 0 && !ignorarRestricoes) {
          const zonaOS = zonasPorOS.get(os.id);
          
          // Se a rota tem uma zona atribuída, verificar se a OS está na mesma zona
          if (rota.zonaId !== undefined && rota.zonaId >= 0) {
            if (zonaOS === undefined || zonaOS !== rota.zonaId) {
              return { 
                valido: false, eta: 0, fimServico: 0, tempoDesloc: 0, distanciaKm: 0, 
                almocoInserido: false, 
                motivo: `Zona incorreta: OS está na zona ${zonaOS ?? 'N/A'}, equipe atende zona ${rota.zonaId}` 
              };
            }
          }
        }
      }
      
      // Se a OS não tem território, rejeitar (exceto emergências)
      if (!territorioIdDaOS && (!ignorarRestricoes || !ehEmergencia(os))) {
        return { 
          valido: false, eta: 0, fimServico: 0, tempoDesloc: 0, distanciaKm: 0,
          almocoInserido: false, motivo: "OS fora de território" 
        };
      }
    } else {
      // V17: Modo zonas - verificar se é da zona da equipe
      // NUNCA permite pegar OS de outra zona (exceto emergências)
      if (!ignorarRestricoes && rota.zonaId !== undefined && rota.zonaId >= 0) {
        const zonaOS = zonasPorOS.get(os.id);
        
        if (zonaOS === undefined || zonaOS !== rota.zonaId) {
          return { 
            valido: false, eta: 0, fimServico: 0, tempoDesloc: 0, distanciaKm: 0, 
            almocoInserido: false, 
            motivo: `Zona incorreta: OS está na zona ${zonaOS ?? 'N/A'}, equipe atende zona ${rota.zonaId}` 
          };
        }
      }
    }

    // Verificar se os índices existem
    const ultimaLocIdx = getUltimaLocalizacao(rota);
    const osLocIdx = osIdx.get(os.id);
    
    if (osLocIdx === undefined) {
      return { 
        valido: false, eta: 0, fimServico: 0, tempoDesloc: 0, distanciaKm: 0, 
        almocoInserido: false, 
        motivo: "OS não encontrada na matriz" 
      };
    }

    const fimJornada = getFimJornada(rota.equipe);
    const tempoAtual = getTempoAtual(rota);
    
    const tempoDesloc = getTempo(ultimaLocIdx, osLocIdx);
    const distanciaKm = getDistanciaKm(ultimaLocIdx, osLocIdx);
    
    // Verificar distância máxima
    if (distanciaKm > distanciaMaximaKm) {
      return { 
        valido: false, eta: 0, fimServico: 0, tempoDesloc, distanciaKm, 
        almocoInserido: false, 
        motivo: `Distância ${distanciaKm.toFixed(1)}km > ${distanciaMaximaKm}km` 
      };
    }
    
    let eta = tempoAtual + tempoDesloc;
    
    const ajuste = ajustarParaAlmoco(eta, os.tempoExecucao, rota.equipe, jaAlmocou(rota));
    eta = ajuste.tempo;
    
    const fimServico = eta + os.tempoExecucao;
    
    if (fimServico > fimJornada) {
      return { 
        valido: false, eta, fimServico, tempoDesloc, distanciaKm,
        almocoInserido: ajuste.almocoInserido,
        motivo: "Estoura jornada" 
      };
    }
    
    let atrasoMinutos = 0;
      if (os.prazo) {
        const prazoMin = os.prazo.getHours() * 60 + os.prazo.getMinutes();
      
        if (fimServico > prazoMin) {
        atrasoMinutos = Math.round(fimServico - prazoMin);
        
        // EMERGÊNCIAS nunca atrasam
        if (ehEmergencia(os)) {
          return { 
            valido: false, eta, fimServico, tempoDesloc, distanciaKm,
            almocoInserido: ajuste.almocoInserido,
            motivo: `EMERGÊNCIA: ${minutosParaHora(fimServico)} > ${minutosParaHora(prazoMin)}`,
            atrasoMinutos
          };
        }
        
        if (!permitirAtraso || atrasoMinutos > atrasoMaximoMin) {
          return { 
            valido: false, eta, fimServico, tempoDesloc, distanciaKm,
            almocoInserido: ajuste.almocoInserido,
            motivo: `Atraso ${atrasoMinutos}min > ${atrasoMaximoMin}min`,
            atrasoMinutos
          };
        }
      }
    }
    
    return { 
      valido: true, 
      eta, 
      fimServico, 
      tempoDesloc, 
      distanciaKm,
      almocoInserido: ajuste.almocoInserido,
      inicioAlmoco: ajuste.inicioAlmoco,
      fimAlmoco: ajuste.fimAlmoco,
      atrasoMinutos
    };
  };

  const inserirOS = (rota: RotaEquipe, os: OrdemServico, calc: ReturnType<typeof calcularInsercao>) => {
    // V18: Verificação final de segurança - NUNCA permitir inserir OS de outro território
    if (usarTerritorios && territoriosAtivos.length > 0) {
      const territorioIdDaOS = osParaTerritorio.get(os.id);
      if (territorioIdDaOS && !equipeEstaNoTerritorioDaOS(os.id, rota.equipe.id)) {
        const territorio = territoriosAtivos.find(t => t.id === territorioIdDaOS);
        console.error(`[ROUTING] ⚠️ ERRO CRÍTICO: Tentativa de inserir OS ${os.numero} (território: ${territorio?.nome || territorioIdDaOS}) na rota da equipe ${rota.equipe.codigo} (${rota.equipe.id})`);
        console.error(`[ROUTING]   Stack trace:`, new Error().stack);
        return; // Bloquear inserção
      }
      // Log de sucesso para debug
      if (territorioIdDaOS && equipeEstaNoTerritorioDaOS(os.id, rota.equipe.id)) {
        console.log(`[ROUTING]   ✓ Verificação território OK: OS ${os.numero} → ${rota.equipe.codigo}`);
      }
    }
    
    if (calc.almocoInserido && calc.inicioAlmoco && calc.fimAlmoco) {
      rota.servicos.push({
        tipo: "ALMOCO",
        ordemNaRota: 0,
        tempoDeslocamento: 0,
        distancia: 0,
        tempoTotal: calc.fimAlmoco,
        horaInicio: minutosParaHora(calc.inicioAlmoco),
        horaFim: minutosParaHora(calc.fimAlmoco),
        eta: minutosParaHora(calc.inicioAlmoco)
      });
    }
    
    const ordemNaRota = rota.servicos.filter(s => s.tipo === "SERVICO").length + 1;
    
    let atrasado = false;
    let alerta: string | undefined;
    if (calc.atrasoMinutos && calc.atrasoMinutos > 0) {
        atrasado = true;
      alerta = `Atraso ${calc.atrasoMinutos}min`;
    }
    
    rota.servicos.push({
      tipo: "SERVICO",
      ordemServico: os,
      ordemNaRota,
      tempoDeslocamento: calc.tempoDesloc,
      distancia: calc.distanciaKm,
      tempoTotal: calc.fimServico,
      horaInicio: minutosParaHora(calc.eta),
      horaFim: minutosParaHora(calc.fimServico),
      eta: minutosParaHora(calc.eta),
      atrasado: atrasado || undefined,
      alerta
    });
    
    const inicioJornada = horaParaMinutos(rota.equipe.horaInicio);
    const duracaoJornada = (rota.equipe.maxHorasTrabalho || 10) * 60;
    rota.tempoTotal = calc.fimServico - inicioJornada; // Tempo de trabalho, não tempo absoluto
    rota.distanciaTotal += calc.distanciaKm;
    rota.faturamentoTotal += os.valor;
    rota.progresso = ((calc.fimServico - inicioJornada) / duracaoJornada) * 100;
    
    osAlocadas.add(os.id);
  };

  /**
   * V19.6: Calcula inserção NO INÍCIO da rota (para OSs com prazo crítico)
   * Reorganiza toda a rota para que a OS urgente seja atendida primeiro
   */
  const calcularInsercaoNoInicio = (
    rota: RotaEquipe,
    os: OrdemServico,
    distanciaMaximaKm: number = DISTANCIA_MAXIMA_NORMAL_KM,
    permitirForaDoPrazo: boolean = false
  ): { 
    valido: boolean; 
    eta: number; 
    fimServico: number; 
    tempoDesloc: number;
    distanciaKm: number;
    almocoInserido: boolean;
    motivo?: string;
    atrasoMinutos?: number;
  } => {
    // Verificar skill
    if (!equipeTemSkill(rota.equipe, os.tipo)) {
      return { valido: false, eta: 0, fimServico: 0, tempoDesloc: 0, distanciaKm: 0, almocoInserido: false, motivo: `Sem skill (${normalizarSkill(os.tipo)})` };
    }
    
    // Verificar se a OS pertence ao território/zona da equipe
    if (usarTerritorios && territoriosAtivos.length > 0) {
      if (!equipeEstaNoTerritorioDaOS(os.id, rota.equipe.id)) {
        return { 
          valido: false, eta: 0, fimServico: 0, tempoDesloc: 0, distanciaKm: 0,
          almocoInserido: false, motivo: "OS não pertence ao território da equipe" 
        };
      }
    }
    
    const equipeLocIdx = equipeIdx.get(rota.equipe.id);
    const osLocIdx = osIdx.get(os.id);
    
    if (equipeLocIdx === undefined || osLocIdx === undefined) {
      return { 
        valido: false, eta: 0, fimServico: 0, tempoDesloc: 0, distanciaKm: 0, 
        almocoInserido: false, 
        motivo: "Índices não encontrados" 
      };
    }
    
    const fimJornada = getFimJornada(rota.equipe);
    const inicioJornada = horaParaMinutos(rota.equipe.horaInicio);
    
    // Calcular deslocamento da BASE até a OS
    const tempoDesloc = getTempo(equipeLocIdx, osLocIdx);
    const distanciaKm = getDistanciaKm(equipeLocIdx, osLocIdx);
    
    // Verificar distância máxima
    if (distanciaKm > distanciaMaximaKm) {
      return { 
        valido: false, eta: 0, fimServico: 0, tempoDesloc, distanciaKm, 
        almocoInserido: false, 
        motivo: `Distância ${distanciaKm.toFixed(1)}km > ${distanciaMaximaKm}km` 
      };
    }
    
    // ETA é início da jornada + deslocamento
    const eta = inicioJornada + tempoDesloc;
    const fimServico = eta + os.tempoExecucao;
    
    // Verificar jornada
    if (fimServico > fimJornada) {
      return { 
        valido: false, eta, fimServico, tempoDesloc, distanciaKm,
        almocoInserido: false,
        motivo: "Estoura jornada" 
      };
    }
    
    // Verificar prazo
    let atrasoMinutos = 0;
    if (os.prazo) {
      const prazoMin = os.prazo.getHours() * 60 + os.prazo.getMinutes();
      
      if (fimServico > prazoMin) {
        atrasoMinutos = Math.round(fimServico - prazoMin);
        
        if (!permitirForaDoPrazo) {
          return { 
            valido: false, eta, fimServico, tempoDesloc, distanciaKm,
            almocoInserido: false,
            motivo: `Fora do prazo: ${minutosParaHora(fimServico)} > ${minutosParaHora(prazoMin)}`,
            atrasoMinutos
          };
        }
      }
    }
    
    return { 
      valido: true, 
      eta, 
      fimServico, 
      tempoDesloc, 
      distanciaKm,
      almocoInserido: false,
      atrasoMinutos
    };
  };
  
  /**
   * V19.6: Aplica inserção NO INÍCIO da rota
   * Reorganiza toda a rota inserindo a OS no começo e recalculando todos os tempos
   */
  const aplicarInsercaoNoInicio = (
    rota: RotaEquipe, 
    os: OrdemServico, 
    calc: ReturnType<typeof calcularInsercaoNoInicio>
  ) => {
    // Verificação de segurança
    if (usarTerritorios && territoriosAtivos.length > 0) {
      if (!equipeEstaNoTerritorioDaOS(os.id, rota.equipe.id)) {
        console.error(`[ROUTING] ⚠️ ERRO: Tentativa de inserir OS ${os.numero} no início da rota da equipe ${rota.equipe.codigo} - território incorreto`);
        return;
      }
    }
    
    // Salvar serviços existentes
    const servicosExistentes = [...rota.servicos];
    
    // Limpar rota
    rota.servicos = [];
    
    // Criar novo serviço para a OS prioritária
    const atrasado = calc.atrasoMinutos && calc.atrasoMinutos > 0;
    const alerta = atrasado ? `FORA DO PRAZO: Atraso ${calc.atrasoMinutos}min (mas atendida no dia)` : undefined;
    
    const novoServico: RotaServico = {
      tipo: "SERVICO",
      ordemServico: os,
      ordemNaRota: 1,
      tempoDeslocamento: calc.tempoDesloc,
      distancia: calc.distanciaKm,
      tempoTotal: calc.fimServico,
      horaInicio: minutosParaHora(calc.eta),
      horaFim: minutosParaHora(calc.fimServico),
      eta: minutosParaHora(calc.eta),
      atrasado: atrasado || undefined,
      alerta
    };
    
    rota.servicos.push(novoServico);
    osAlocadas.add(os.id);
    
    // Recalcular e reinserir os serviços existentes
    let tempoAtual = calc.fimServico;
    let distanciaTotal = calc.distanciaKm;
    let faturamentoTotal = os.valor;
    let ultimaLocIdx = osIdx.get(os.id)!;
    let ordemNaRota = 2;
    
    // Primeiro verificar se precisa de almoço antes de continuar
    const jaAlmocouNaRota = servicosExistentes.some(s => s.tipo === "ALMOCO");
    
    for (const servicoAntigo of servicosExistentes) {
      if (servicoAntigo.tipo === "ALMOCO") {
        // Manter almoço mas recalcular horário
        const config = obterConfigAlmoco(rota.equipe);
        // Calcular último momento para iniciar almoço (deve terminar dentro da janela)
        const ultimoInicioPermitido = config.fim - config.duracao;
        if (tempoAtual >= config.inicio && tempoAtual <= ultimoInicioPermitido) {
          // Precisa almoçar agora - ainda há tempo
          const almocoServico: RotaServico = {
            tipo: "ALMOCO",
            ordemNaRota: 0,
            tempoDeslocamento: 0,
            distancia: 0,
            tempoTotal: tempoAtual + config.duracao,
            horaInicio: minutosParaHora(tempoAtual),
            horaFim: minutosParaHora(tempoAtual + config.duracao),
            eta: minutosParaHora(tempoAtual)
          };
          rota.servicos.push(almocoServico);
          tempoAtual += config.duracao;
        }
      } else if (servicoAntigo.ordemServico) {
        const osAntiga = servicoAntigo.ordemServico;
        const osAntigaLocIdx = osIdx.get(osAntiga.id);
        
        if (osAntigaLocIdx !== undefined) {
          // Verificar se precisa de almoço antes desta OS
          if (!jaAlmocouNaRota || !rota.servicos.some(s => s.tipo === "ALMOCO")) {
            const config = obterConfigAlmoco(rota.equipe);
            const fimProximoServico = tempoAtual + getTempo(ultimaLocIdx, osAntigaLocIdx) + osAntiga.tempoExecucao;
            // Calcular último momento para iniciar almoço
            const ultimoInicioPermitido = config.fim - config.duracao;
            
            // Verificar se o próximo serviço cruza a janela de almoço E ainda há tempo para fazer almoço
            if (fimProximoServico > config.inicio && tempoAtual <= ultimoInicioPermitido) {
              // Inserir almoço - garantindo que começa não antes de config.inicio
              const inicioAlmoco = Math.max(tempoAtual, config.inicio);
              // Verificar se o almoço terminaria dentro da janela
              if (inicioAlmoco + config.duracao <= config.fim) {
                const almocoServico: RotaServico = {
                  tipo: "ALMOCO",
                  ordemNaRota: 0,
                  tempoDeslocamento: 0,
                  distancia: 0,
                  tempoTotal: inicioAlmoco + config.duracao,
                  horaInicio: minutosParaHora(inicioAlmoco),
                  horaFim: minutosParaHora(inicioAlmoco + config.duracao),
                  eta: minutosParaHora(inicioAlmoco)
                };
                rota.servicos.push(almocoServico);
                tempoAtual = inicioAlmoco + config.duracao;
              }
            }
          }
          
          const tempoDesloc = getTempo(ultimaLocIdx, osAntigaLocIdx);
          const distDesloc = getDistanciaKm(ultimaLocIdx, osAntigaLocIdx);
          
          tempoAtual += tempoDesloc;
          
          const fimJornada = getFimJornada(rota.equipe);
          const fimServico = tempoAtual + osAntiga.tempoExecucao;
          
          // Verificar se ainda cabe na jornada
          if (fimServico <= fimJornada) {
            // Verificar atraso
            let atrasadoOS = false;
            let alertaOS: string | undefined;
            if (osAntiga.prazo) {
              const prazoMin = osAntiga.prazo.getHours() * 60 + osAntiga.prazo.getMinutes();
              if (fimServico > prazoMin) {
                atrasadoOS = true;
                alertaOS = `Atraso ${Math.round(fimServico - prazoMin)}min (reagendamento)`;
              }
            }
            
            const servicoRecalculado: RotaServico = {
              tipo: "SERVICO",
              ordemServico: osAntiga,
              ordemNaRota: ordemNaRota++,
              tempoDeslocamento: tempoDesloc,
              distancia: distDesloc,
              tempoTotal: fimServico,
              horaInicio: minutosParaHora(tempoAtual),
              horaFim: minutosParaHora(fimServico),
              eta: minutosParaHora(tempoAtual),
              atrasado: atrasadoOS || undefined,
              alerta: alertaOS
            };
            
            rota.servicos.push(servicoRecalculado);
            tempoAtual = fimServico;
            distanciaTotal += distDesloc;
            faturamentoTotal += osAntiga.valor;
            ultimaLocIdx = osAntigaLocIdx;
          } else {
            // Não cabe mais na jornada - marcar como não alocada para tentar depois
            osAlocadas.delete(osAntiga.id);
            console.log(`[ROUTING]     ⚠️ OS ${osAntiga.numero} removida da rota (não cabe após reorganização)`);
          }
        }
      }
    }
    
    // Atualizar métricas da rota
    const inicioJornada = horaParaMinutos(rota.equipe.horaInicio);
    const duracaoJornada = (rota.equipe.maxHorasTrabalho || 10) * 60;
    rota.tempoTotal = tempoAtual - inicioJornada;
    rota.distanciaTotal = distanciaTotal;
    rota.faturamentoTotal = faturamentoTotal;
    rota.progresso = ((tempoAtual - inicioJornada) / duracaoJornada) * 100;
  };

  /**
   * V17.1: Remove OS normal da rota para liberar espaço para regulada
   * Recalcula completamente todos os tempos da rota
   * Retorna a OS removida ou null
   */
  const removerOSNormalParaRegulada = (rota: RotaEquipe): OrdemServico | null => {
    // Procurar de trás para frente uma OS não-regulada para remover
    for (let i = rota.servicos.length - 1; i >= 0; i--) {
      const servico = rota.servicos[i];
      if (servico.tipo === "SERVICO" && servico.ordemServico) {
        const os = servico.ordemServico;
        // Não remover reguladas ou emergências
        if (!ehOSRegulada(os) && !ehEmergencia(os)) {
          // Remover da rota
          rota.servicos.splice(i, 1);
          osAlocadas.delete(os.id);
          
          // V17.1: Recalcular TODOS os tempos da rota desde o início
          let tempoAtual = horaParaMinutos(rota.equipe.horaInicio);
          let distanciaTotal = 0;
          let faturamentoTotal = 0;
          let ultimaLocIdx = equipeIdx.get(rota.equipe.id)!;
          
          const configAlmoco = obterConfigAlmoco(rota.equipe);
          for (const srv of rota.servicos) {
            if (srv.tipo === "ALMOCO") {
              srv.tempoDeslocamento = 0;
              srv.distancia = 0;
              // O almoço deve começar no mínimo às config.inicio (ex: 12:00)
              const inicioAlmoco = Math.max(tempoAtual, configAlmoco.inicio);
              srv.horaInicio = minutosParaHora(inicioAlmoco);
              tempoAtual = inicioAlmoco + configAlmoco.duracao; // usar duração configurada da equipe
              srv.tempoTotal = tempoAtual;
              srv.horaFim = minutosParaHora(tempoAtual);
              srv.eta = srv.horaInicio;
            } else if (srv.ordemServico) {
              const osLocIdx = osIdx.get(srv.ordemServico.id);
              if (osLocIdx !== undefined) {
                const tempoDesloc = getTempo(ultimaLocIdx, osLocIdx);
                const distDesloc = getDistanciaKm(ultimaLocIdx, osLocIdx);
                
                srv.tempoDeslocamento = tempoDesloc;
                srv.distancia = distDesloc;
                tempoAtual += tempoDesloc;
                srv.horaInicio = minutosParaHora(tempoAtual);
                srv.eta = srv.horaInicio;
                tempoAtual += srv.ordemServico.tempoExecucao;
                srv.tempoTotal = tempoAtual;
                srv.horaFim = minutosParaHora(tempoAtual);
                
                distanciaTotal += distDesloc;
                faturamentoTotal += srv.ordemServico.valor;
                ultimaLocIdx = osLocIdx;
              }
            }
          }
          
          const inicioJornada = horaParaMinutos(rota.equipe.horaInicio);
          const duracaoJornada = (rota.equipe.maxHorasTrabalho || 10) * 60;
          rota.tempoTotal = tempoAtual - inicioJornada; // Tempo de trabalho, não tempo absoluto
          rota.distanciaTotal = distanciaTotal;
          rota.faturamentoTotal = faturamentoTotal;
          rota.progresso = ((tempoAtual - inicioJornada) / duracaoJornada) * 100;
          
          console.log(`[ROUTING]   ⚠️ Removida OS normal ${os.numero} (tempo rota: ${minutosParaHora(tempoAtual)}, ${rota.progresso.toFixed(0)}%)`);
          return os;
        }
      }
    }
    return null;
  };

  /**
   * V17: Consolidação geográfica (respeita território/zona estritamente)
   */
  const consolidarVizinhas = (rota: RotaEquipe, osAlocada: OrdemServico, todasOSs: OrdemServico[]): number => {
    let consolidadas = 0;
    const osLocIdx = osIdx.get(osAlocada.id);
    
    if (osLocIdx === undefined) return 0;
    
    // V18: Verificar se a OS alocada pertence ao território da rota antes de consolidar
    if (usarTerritorios && territoriosAtivos.length > 0) {
      if (!equipeEstaNoTerritorioDaOS(osAlocada.id, rota.equipe.id)) {
        // A OS alocada não pertence a este território - não consolidar para evitar invadir territórios
        return 0;
      }
      
      // Se há múltiplas equipes no território e zonas foram criadas, verificar se a OS alocada está na zona da equipe
      const territorioIdDaOS = osParaTerritorio.get(osAlocada.id);
      if (territorioIdDaOS && zonas.length > 0) {
        const equipesDoTerritorio = equipesPorTerritorio.get(territorioIdDaOS) || [];
        if (equipesDoTerritorio.length > 1 && rota.zonaId !== undefined && rota.zonaId >= 0) {
          const zonaOS = zonasPorOS.get(osAlocada.id);
          if (zonaOS === undefined || zonaOS !== rota.zonaId) {
            // A OS não está na zona da equipe - não consolidar
            return 0;
          }
        }
      }
    }
    
    const vizinhas = todasOSs.filter(os => {
      if (osAlocadas.has(os.id)) return false;
      if (!equipeTemSkill(rota.equipe, os.tipo)) return false;
      
      // V18: Verificar território/zona estritamente - NUNCA permitir invadir territórios de outras equipes
      if (usarTerritorios && territoriosAtivos.length > 0) {
        if (!equipeEstaNoTerritorioDaOS(os.id, rota.equipe.id)) {
          return false; // OS não pertence a este território
        }
        
        // Se há múltiplas equipes no território e zonas foram criadas, verificar se a OS está na zona da equipe
        const territorioIdDaOS = osParaTerritorio.get(os.id);
        if (territorioIdDaOS && zonas.length > 0) {
          const equipesDoTerritorio = equipesPorTerritorio.get(territorioIdDaOS) || [];
          if (equipesDoTerritorio.length > 1 && rota.zonaId !== undefined && rota.zonaId >= 0) {
            const zonaOS = zonasPorOS.get(os.id);
            if (zonaOS === undefined || zonaOS !== rota.zonaId) {
              return false; // OS não pertence a esta zona
            }
          }
        }
      } else {
        const zonaOS = zonasPorOS.get(os.id);
        if (zonaOS === undefined || zonaOS !== rota.zonaId) {
          return false; // OS não pertence a esta zona
        }
      }
      
      const vizinhaIdx = osIdx.get(os.id);
      if (vizinhaIdx === undefined) return false;
      
      const distancia = getDistanciaKm(osLocIdx, vizinhaIdx);
      
      return distancia <= DISTANCIA_CONSOLIDACAO_KM;
    });
    
    vizinhas.sort((a, b) => {
      const distA = getDistanciaKm(osLocIdx, osIdx.get(a.id)!);
      const distB = getDistanciaKm(osLocIdx, osIdx.get(b.id)!);
      return distA - distB;
    });
    
    for (const vizinha of vizinhas.slice(0, 5)) {
      const calc = calcularInsercao(rota, vizinha, true, DISTANCIA_CONSOLIDACAO_KM * 2, false, ATRASO_MAXIMO_REGULADA_HOJE_MIN);
      
      if (calc.valido) {
        inserirOS(rota, vizinha, calc);
        consolidadas++;
        
        if (!usarTerritorios && rota.zonaId !== undefined) {
          zonasPorOS.set(vizinha.id, rota.zonaId);
        }
      }
    }
    
    return consolidadas;
  };

  // ============================================================================
  // FASE 4: ALOCAR EMERGÊNCIAS (RELIGA)
  // V18: Emergências têm prioridade ABSOLUTA - podem remover OSs normais
  // ============================================================================
  
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] ══ FASE 4: Emergências (RELIGA) - PRIORIDADE ABSOLUTA ══`);
  
  let totalConsolidadas = 0;
  const ossNormaisRemovidasEmergencia: OrdemServico[] = [];
  
  for (const os of osEmergencias) {
      if (osAlocadas.has(os.id)) continue;
    
    let melhorRota: RotaEquipe | null = null;
    let melhorCalc: ReturnType<typeof calcularInsercao> | null = null;
    let passadaUsada = 0;
    
    // V18: Identificar a equipe responsável pelo território/zona
    let rotaResponsavel: RotaEquipe | null = null;
    
    if (usarTerritorios && territoriosAtivos.length > 0) {
      const territorioIdDaOS = osParaTerritorio.get(os.id);
      if (territorioIdDaOS) {
        const equipesDoTerritorio = equipesPorTerritorio.get(territorioIdDaOS) || [];
        const rotasDoTerritorio = rotas.filter(r => equipesDoTerritorio.includes(r.equipe.id));
        
        // Se há múltiplas equipes e zonas foram criadas, encontrar a rota da zona correta
        if (equipesDoTerritorio.length > 1 && zonas.length > 0) {
          const zonaOS = zonasPorOS.get(os.id);
          if (zonaOS !== undefined) {
            rotaResponsavel = rotasDoTerritorio.find(r => r.zonaId === zonaOS) || null;
          }
        }
        
        // Se não encontrou por zona, usar qualquer rota do território (fallback)
        if (!rotaResponsavel && rotasDoTerritorio.length > 0) {
          rotaResponsavel = rotasDoTerritorio[0];
        }
      }
    } else {
      const zonaOS = zonasPorOS.get(os.id);
      if (zonaOS !== undefined) {
        rotaResponsavel = rotas.find(r => r.zonaId === zonaOS) || null;
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASSADA 1: Tentar na equipe do território/zona, sem atraso
    // ═══════════════════════════════════════════════════════════════════════
    if (rotaResponsavel) {
      const calc = calcularInsercao(rotaResponsavel, os, false, DISTANCIA_MAXIMA_EMERGENCIA_KM, false, 0);
      if (calc.valido) {
        melhorRota = rotaResponsavel;
        melhorCalc = calc;
        passadaUsada = 1;
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASSADA 2: Tentar na equipe do território/zona, permitindo atraso
    // ═══════════════════════════════════════════════════════════════════════
    if (!melhorRota && rotaResponsavel) {
      const calc = calcularInsercao(rotaResponsavel, os, true, DISTANCIA_MAXIMA_EMERGENCIA_KM, false, 120);
      if (calc.valido) {
        melhorRota = rotaResponsavel;
        melhorCalc = calc;
        passadaUsada = 2;
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASSADA 3: Remover OSs normais para dar lugar à emergência
    // ═══════════════════════════════════════════════════════════════════════
    if (!melhorRota && rotaResponsavel) {
      // Tentar remover OSs normais até conseguir alocar
      let tentativasRemocao = 0;
      const MAX_TENTATIVAS_REMOCAO = 5;
      
      while (!melhorRota && tentativasRemocao < MAX_TENTATIVAS_REMOCAO) {
        tentativasRemocao++;
        
        // Remover uma OS normal
        const osRemovida = removerOSNormalParaRegulada(rotaResponsavel);
        if (!osRemovida) break; // Não há mais OSs normais para remover
        
        ossNormaisRemovidasEmergencia.push(osRemovida);
        
        // Tentar inserir a emergência
        const calc = calcularInsercao(rotaResponsavel, os, true, DISTANCIA_MAXIMA_EMERGENCIA_KM, false, 120);
        if (calc.valido) {
          melhorRota = rotaResponsavel;
          melhorCalc = calc;
          passadaUsada = 3;
          console.log(`[ROUTING]   ⚠️ Removida OS normal ${osRemovida.numero} para dar lugar à emergência ${os.numero}`);
          break;
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // V19.6: PASSADA 4 REMOVIDA - NÃO permite mais equipes de outras zonas/territórios
    // A solução deve SEMPRE ser dentro da zona/território
    // ═══════════════════════════════════════════════════════════════════════
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASSADA 4: Tentar inserir NO INÍCIO DA ROTA (para emergências com prazo crítico)
    // ═══════════════════════════════════════════════════════════════════════
    if (!melhorRota && rotaResponsavel && os.prazo) {
      const prazoMin = os.prazo.getHours() * 60 + os.prazo.getMinutes();
      const inicioJornada = horaParaMinutos(rotaResponsavel.equipe.horaInicio);
      
      // Se o prazo é antes do horário atual da equipe, tentar inserir no início
      if (prazoMin < inicioJornada + 120) { // Prazo é nas primeiras 2 horas
        console.log(`[ROUTING]     P4: Prazo crítico ${minutosParaHora(prazoMin)}, tentando inserir no INÍCIO da rota...`);
        
        const calcInicio = calcularInsercaoNoInicio(rotaResponsavel, os, DISTANCIA_MAXIMA_EMERGENCIA_KM);
        if (calcInicio.valido) {
          // Aplicar inserção no início
          aplicarInsercaoNoInicio(rotaResponsavel, os, calcInicio);
          melhorRota = rotaResponsavel;
          melhorCalc = calcInicio;
          passadaUsada = 4;
          console.log(`[ROUTING]     P4 sucesso: Inserida no início da rota!`);
        } else {
          console.log(`[ROUTING]     P4 falhou: ${calcInicio.motivo}`);
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASSADA 5: Último recurso - alocar mesmo fora do prazo mas NO DIA (com alerta)
    // ═══════════════════════════════════════════════════════════════════════
    if (!melhorRota && rotaResponsavel && os.prazo) {
      console.log(`[ROUTING]     P5: Tentando alocar FORA DO PRAZO mas no dia (alerta)...`);
      
      // Tentar inserir no início mesmo que fora do prazo
      const calcInicio = calcularInsercaoNoInicio(rotaResponsavel, os, DISTANCIA_MAXIMA_EMERGENCIA_KM, true);
      if (calcInicio.valido) {
        aplicarInsercaoNoInicio(rotaResponsavel, os, calcInicio);
        melhorRota = rotaResponsavel;
        melhorCalc = calcInicio;
        passadaUsada = 5;
        console.log(`[ROUTING]     P5: Alocada FORA DO PRAZO - será atendida mas com atraso!`);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // RESULTADO
    // ═══════════════════════════════════════════════════════════════════════
    if (melhorRota && melhorCalc) {
      // Se não foi inserção no início (passada 4 ou 5), usar inserção normal
      if (passadaUsada !== 4 && passadaUsada !== 5) {
        inserirOS(melhorRota, os, melhorCalc);
      }
      const atrasoStr = melhorCalc.atrasoMinutos ? ` [atraso ${melhorCalc.atrasoMinutos}min - FORA DO PRAZO]` : "";
      const passadaStr = ` [P${passadaUsada}]`;
      
      console.log(`[ROUTING] ✓ ${os.numero} → ${melhorRota.equipe.codigo} (${melhorCalc.distanciaKm.toFixed(1)}km)${atrasoStr}${passadaStr}`);
      
      osAlocadas.add(os.id);
      
      // Consolidar vizinhas
      const consolidadas = consolidarVizinhas(melhorRota, os, [...osProximoDia, ...osNormais, ...osUrgentes, ...osReguladasHoje]);
      if (consolidadas > 0) {
        console.log(`[ROUTING]   +${consolidadas} vizinhas consolidadas`);
        totalConsolidadas += consolidadas;
      }
    } else {
      const zonaInfo = usarTerritorios 
        ? `território ${osParaTerritorio.get(os.id) || 'não definido'}`
        : `zona ${zonasPorOS.get(os.id) ?? 'não definida'}`;
      naoAlocadas.push({ os, motivo: `EMERGÊNCIA: sem capacidade na ${zonaInfo}` });
      osAlocadas.add(os.id);
      console.log(`[ROUTING] ✗ ${os.numero} - Sem capacidade na ${zonaInfo} (tentou ${passadaUsada} passadas)`);
    }
  }
  
  if (ossNormaisRemovidasEmergencia.length > 0) {
    console.log(`[ROUTING] ⚠️ ${ossNormaisRemovidasEmergencia.length} OSs normais removidas para dar lugar a emergências`);
  }

  // ============================================================================
  // FASE 5: ALOCAR REGULADAS HOJE (PRIORIDADE ABSOLUTA)
  // V17: Pode remover OSs normais para dar lugar a reguladas
  // ============================================================================
  
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] ══ FASE 5: Reguladas Hoje (PRIORIDADE ABSOLUTA) ══`);
  
  const ossNormaisRemovidas: OrdemServico[] = [];
  
  for (const os of osReguladasHoje) {
    if (osAlocadas.has(os.id)) continue;
    
    let melhorRota: RotaEquipe | null = null;
    let melhorCalc: ReturnType<typeof calcularInsercao> | null = null;
    let passadaUsada = 0;
    
    // V21: Identificar TODAS as equipes do território que podem atender (têm a skill)
    let rotaResponsavel: RotaEquipe | null = null;
    let rotasAlternativas: RotaEquipe[] = [];
    
    if (usarTerritorios && territoriosAtivos.length > 0) {
      const territorioIdDaOS = osParaTerritorio.get(os.id);
      if (territorioIdDaOS) {
        const equipesDoTerritorio = equipesPorTerritorio.get(territorioIdDaOS) || [];
        // Filtrar apenas rotas de equipes que têm a skill necessária
        const rotasDoTerritorioComSkill = rotas.filter(r => 
          equipesDoTerritorio.includes(r.equipe.id) && equipeTemSkill(r.equipe, os.tipo)
        );
        
        // Se há múltiplas equipes e zonas foram criadas, priorizar a da zona correta
        if (equipesDoTerritorio.length > 1 && zonas.length > 0) {
          const zonaOS = zonasPorOS.get(os.id);
          if (zonaOS !== undefined) {
            rotaResponsavel = rotasDoTerritorioComSkill.find(r => r.zonaId === zonaOS) || null;
          }
        }
        
        // Se não encontrou por zona, usar a primeira com skill
        if (!rotaResponsavel && rotasDoTerritorioComSkill.length > 0) {
          rotaResponsavel = rotasDoTerritorioComSkill[0];
        }
        
        // V21: Guardar as outras rotas do território como alternativas
        rotasAlternativas = rotasDoTerritorioComSkill.filter(r => r !== rotaResponsavel);
      }
    } else {
      const zonaOS = zonasPorOS.get(os.id);
      if (zonaOS !== undefined) {
        // Também verificar skill no modo sem território
        rotaResponsavel = rotas.find(r => r.zonaId === zonaOS && equipeTemSkill(r.equipe, os.tipo)) || null;
      }
    }
    
    if (rotaResponsavel) {
      console.log(`[ROUTING]   Tentando ${os.numero} na ${rotaResponsavel.equipe.codigo} (progresso: ${rotaResponsavel.progresso.toFixed(0)}%)`);
      
      // PASSADA 1: Tentar sem atraso
      let calc = calcularInsercao(rotaResponsavel, os, false, DISTANCIA_MAXIMA_TERRITORIO_KM, false, 0);
      if (calc.valido) {
        melhorRota = rotaResponsavel;
        melhorCalc = calc;
        passadaUsada = 1;
      } else {
        console.log(`[ROUTING]     P1 falhou: ${calc.motivo}`);
      }
      
      // PASSADA 2: Com atraso até 60min
      if (!melhorRota) {
        calc = calcularInsercao(rotaResponsavel, os, true, DISTANCIA_MAXIMA_TERRITORIO_KM, false, 60);
        if (calc.valido) {
          melhorRota = rotaResponsavel;
          melhorCalc = calc;
          passadaUsada = 2;
        } else {
          console.log(`[ROUTING]     P2 falhou: ${calc.motivo}`);
        }
      }
      
      // PASSADA 3: Com atraso até 120min
      if (!melhorRota) {
        calc = calcularInsercao(rotaResponsavel, os, true, DISTANCIA_MAXIMA_REGULADA_URGENTE_KM, false, ATRASO_MAXIMO_REGULADA_HOJE_MIN);
        if (calc.valido) {
          melhorRota = rotaResponsavel;
          melhorCalc = calc;
          passadaUsada = 3;
        } else {
          console.log(`[ROUTING]     P3 falhou: ${calc.motivo}`);
        }
      }
      
      // V21 PASSADA 4: Remover OSs não-críticas para dar espaço a REGULADA URGENTE
      // REGULADAS SÃO PRIORIDADE MÁXIMA - remover quantas OSs forem necessárias
      if (!melhorRota) {
        console.log(`[ROUTING]     P4: Removendo OSs não-críticas para garantir regulada urgente...`);
        
        // Contar quantas OSs não-críticas existem na rota
        const ossNaoCriticasNaRota = rotaResponsavel.servicos.filter(s => 
          s.tipo === 'SERVICO' && s.ordemServico && 
          !ehOSRegulada(s.ordemServico) && !ehEmergencia(s.ordemServico)
        ).length;
        
        console.log(`[ROUTING]     OSs não-críticas na rota: ${ossNaoCriticasNaRota}`);
        
        let tentativas = 0;
        // V21: Remover ATÉ TODAS as OSs não-críticas se necessário
        const maxTentativas = ossNaoCriticasNaRota;
        
        while (!melhorRota && tentativas < maxTentativas) {
          const osRemovida = removerOSNormalParaRegulada(rotaResponsavel);
          if (!osRemovida) {
            console.log(`[ROUTING]     Não há mais OSs não-críticas para remover`);
            break;
          }
          
          ossNormaisRemovidas.push(osRemovida);
          tentativas++;
          
          // Tentar novamente com limites mais generosos
          calc = calcularInsercao(rotaResponsavel, os, true, DISTANCIA_MAXIMA_REGULADA_URGENTE_KM, false, ATRASO_MAXIMO_REGULADA_HOJE_MIN);
          if (calc.valido) {
            melhorRota = rotaResponsavel;
            melhorCalc = calc;
            passadaUsada = 4;
            console.log(`[ROUTING]     P4 sucesso após remover ${tentativas} OSs!`);
          }
        }
        
        if (!melhorRota) {
          console.log(`[ROUTING]     P4 falhou após remover ${tentativas} OSs`);
        }
      }
      
      // V21 PASSADA 5: Tentar OUTRAS equipes DO MESMO TERRITÓRIO
      // Se há múltiplas equipes no território, tentar todas
      if (!melhorRota && rotasAlternativas.length > 0) {
        console.log(`[ROUTING]     P5: Tentando ${rotasAlternativas.length} equipes alternativas do território...`);
        
        for (const rotaAlt of rotasAlternativas) {
          // Primeiro tentar inserir normalmente
          let calcAlt = calcularInsercao(rotaAlt, os, true, DISTANCIA_MAXIMA_REGULADA_URGENTE_KM, false, ATRASO_MAXIMO_REGULADA_HOJE_MIN);
          
          if (calcAlt.valido) {
            melhorRota = rotaAlt;
            melhorCalc = calcAlt;
            passadaUsada = 5;
            console.log(`[ROUTING]     P5 sucesso: ${rotaAlt.equipe.codigo} pode atender!`);
            break;
          }
          
          // Se não conseguiu, tentar removendo OSs não-críticas desta rota alternativa
          const ossNaoCriticasAlt = rotaAlt.servicos.filter(s => 
            s.tipo === 'SERVICO' && s.ordemServico && 
            !ehOSRegulada(s.ordemServico) && !ehEmergencia(s.ordemServico)
          ).length;
          
          if (ossNaoCriticasAlt > 0) {
            console.log(`[ROUTING]     P5: Tentando remover OSs de ${rotaAlt.equipe.codigo} (${ossNaoCriticasAlt} não-críticas)...`);
            
            let tentAlt = 0;
            while (!melhorRota && tentAlt < ossNaoCriticasAlt) {
              const osRemovida = removerOSNormalParaRegulada(rotaAlt);
              if (!osRemovida) break;
              
              ossNormaisRemovidas.push(osRemovida);
              tentAlt++;
              
              calcAlt = calcularInsercao(rotaAlt, os, true, DISTANCIA_MAXIMA_REGULADA_URGENTE_KM, false, ATRASO_MAXIMO_REGULADA_HOJE_MIN);
              if (calcAlt.valido) {
                melhorRota = rotaAlt;
                melhorCalc = calcAlt;
                passadaUsada = 5;
                console.log(`[ROUTING]     P5 sucesso em ${rotaAlt.equipe.codigo} após remover ${tentAlt} OSs!`);
                break;
              }
            }
          }
          
          if (melhorRota) break;
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // V19.6 PASSADA 6: Tentar inserir NO INÍCIO DA ROTA (para reguladas com prazo crítico)
      // ═══════════════════════════════════════════════════════════════════════
      if (!melhorRota && os.prazo) {
        const prazoMin = os.prazo.getHours() * 60 + os.prazo.getMinutes();
        const inicioJornada = horaParaMinutos(rotaResponsavel.equipe.horaInicio);
        
        // Se o prazo é apertado (nas primeiras 3 horas da jornada), tentar inserir no início
        if (prazoMin < inicioJornada + 180) {
          console.log(`[ROUTING]     P6: Prazo crítico ${minutosParaHora(prazoMin)}, tentando inserir no INÍCIO da rota...`);
          
          const calcInicio = calcularInsercaoNoInicio(rotaResponsavel, os, DISTANCIA_MAXIMA_REGULADA_URGENTE_KM);
          if (calcInicio.valido) {
            aplicarInsercaoNoInicio(rotaResponsavel, os, calcInicio);
            melhorRota = rotaResponsavel;
            melhorCalc = calcInicio;
            passadaUsada = 6;
            console.log(`[ROUTING]     P6 sucesso: Inserida no início da rota!`);
          } else {
            console.log(`[ROUTING]     P6 falhou: ${calcInicio.motivo}`);
          }
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // V19.6 PASSADA 7: Último recurso - alocar mesmo fora do prazo mas NO DIA (com alerta)
      // ═══════════════════════════════════════════════════════════════════════
      if (!melhorRota && os.prazo) {
        console.log(`[ROUTING]     P7: Tentando alocar FORA DO PRAZO mas no dia (alerta)...`);
        
        const calcInicio = calcularInsercaoNoInicio(rotaResponsavel, os, DISTANCIA_MAXIMA_REGULADA_URGENTE_KM, true);
        if (calcInicio.valido) {
          aplicarInsercaoNoInicio(rotaResponsavel, os, calcInicio);
          melhorRota = rotaResponsavel;
          melhorCalc = calcInicio;
          passadaUsada = 7;
          console.log(`[ROUTING]     P7: Alocada FORA DO PRAZO - será atendida mas com atraso!`);
        }
      }
    } else {
      // V19.6: Se a OS regulada não tem território mapeado, NÃO procurar em outras equipes
      // A regra é: só equipes do território atendem OSs do território
      console.log(`[ROUTING]   ⚠️ ${os.numero}: Sem território mapeado ou sem equipe com skill. NÃO tentando outras equipes.`);
    }
    
    if (melhorRota && melhorCalc) {
      // Se foi inserção no início (passada 6 ou 7), não usar inserirOS pois já foi inserido
      if (passadaUsada !== 6 && passadaUsada !== 7) {
        inserirOS(melhorRota, os, melhorCalc);
      }
      const atrasoStr = melhorCalc.atrasoMinutos ? ` [atraso ${melhorCalc.atrasoMinutos}min - FORA DO PRAZO]` : "";
      const passadaDescricao = {
        1: 'inserção normal',
        2: 'com atraso 60min',
        3: 'com atraso 120min',
        4: 'removeu OSs',
        5: 'equipe alternativa do território',
        6: 'inserida no INÍCIO da rota (prazo crítico)',
        7: 'inserida no INÍCIO (FORA DO PRAZO mas no dia)'
      }[passadaUsada] || `P${passadaUsada}`;
      console.log(`[ROUTING] ✓ ${os.numero} → ${melhorRota.equipe.codigo} (${melhorCalc.distanciaKm.toFixed(1)}km)${atrasoStr} [${passadaDescricao}]`);
      
      const consolidadas = consolidarVizinhas(melhorRota, os, [...osProximoDia, ...osNormais, ...osUrgentes]);
      if (consolidadas > 0) {
        console.log(`[ROUTING]   +${consolidadas} vizinhas consolidadas`);
        totalConsolidadas += consolidadas;
      }
    } else {
      const bairro = extrairBairro(os.endereco);
      const territorioIdDaOS = osParaTerritorio.get(os.id);
      let motivo = '';
      if (territorioIdDaOS) {
        const equipesDoTerritorio = equipesPorTerritorio.get(territorioIdDaOS) || [];
        const rotasComSkill = rotas.filter(r => 
          equipesDoTerritorio.includes(r.equipe.id) && equipeTemSkill(r.equipe, os.tipo)
        );
        if (rotasComSkill.length === 0) {
          motivo = `Regulada HOJE: Equipe do território ${territorioIdDaOS} sem skill ${os.tipo}`;
        } else {
          motivo = `Regulada HOJE: Nenhuma equipe do território (${rotasComSkill.map(r => r.equipe.codigo).join(', ')}) conseguiu alocar`;
        }
      } else {
        motivo = `Regulada HOJE: OS fora de qualquer território definido`;
      }
      naoAlocadas.push({ os, motivo });
      osAlocadas.add(os.id);
      console.log(`[ROUTING] ✗ ${os.numero} - ${motivo} (${bairro}) - CRÍTICO!`);
    }
  }
  
  // Contabilizar reguladas alocadas
  const reguladasAlocadas = osReguladasHoje.filter(os => 
    rotas.some(r => r.servicos.some(s => s.ordemServico?.id === os.id))
  ).length;
  console.log(`[ROUTING] ⚡ REGULADAS HOJE: ${reguladasAlocadas}/${osReguladasHoje.length} alocadas`);
  if (reguladasAlocadas < osReguladasHoje.length) {
    console.log(`[ROUTING] ⚠️ ATENÇÃO: ${osReguladasHoje.length - reguladasAlocadas} reguladas críticas NÃO foram alocadas!`);
  }
  
  // Log das OSs normais removidas
  if (ossNormaisRemovidas.length > 0) {
    console.log(`[ROUTING] ⚠️ ${ossNormaisRemovidas.length} OSs normais foram removidas para dar lugar a reguladas`);
  }

  // ============================================================================
  // FASE 6: ALOCAR URGENTES NÃO-REGULADAS
  // V17: Estritamente dentro da zona/território
  // ============================================================================
  
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] ══ FASE 6: Urgentes ══`);
  
  for (const os of osUrgentes) {
    if (osAlocadas.has(os.id)) continue;
    
    let melhorRota: RotaEquipe | null = null;
    let melhorCalc: ReturnType<typeof calcularInsercao> | null = null;
    
    // V17: Só tentar as equipes do território/zona
    if (usarTerritorios && territoriosAtivos.length > 0) {
      const territorioIdDaOS = osParaTerritorio.get(os.id);
      if (territorioIdDaOS) {
        // Tentar todas as equipes vinculadas ao território
        const equipesDoTerritorio = equipesPorTerritorio.get(territorioIdDaOS) || [];
        let rotasDoTerritorio = rotas.filter(r => equipesDoTerritorio.includes(r.equipe.id));
        
        // Se há múltiplas equipes e zonas foram criadas, filtrar apenas a rota da zona correta
        if (equipesDoTerritorio.length > 1 && zonas.length > 0) {
          const zonaOS = zonasPorOS.get(os.id);
          if (zonaOS !== undefined) {
            rotasDoTerritorio = rotasDoTerritorio.filter(r => r.zonaId === zonaOS);
          }
        }
        
        for (const rotaTerritorio of rotasDoTerritorio) {
          const calc = calcularInsercao(rotaTerritorio, os, true, DISTANCIA_MAXIMA_TERRITORIO_KM, false, 120);
      if (calc.valido) {
            melhorRota = rotaTerritorio;
            melhorCalc = calc;
          }
        }
      }
    } else {
      const zonaOS = zonasPorOS.get(os.id);
      const rotaZona = rotas.find(r => r.zonaId === zonaOS);
      if (rotaZona) {
        const calc = calcularInsercao(rotaZona, os, true, DISTANCIA_MAXIMA_ZONA_KM, false, 120);
        if (calc.valido) {
          melhorRota = rotaZona;
          melhorCalc = calc;
        }
      }
    }
    
    if (melhorRota && melhorCalc) {
      inserirOS(melhorRota, os, melhorCalc);
      
      const consolidadas = consolidarVizinhas(melhorRota, os, [...osProximoDia, ...osNormais]);
      totalConsolidadas += consolidadas;
    }
    // V17: Se não conseguiu, será marcada como não alocada no final
  }
  
  console.log(`[ROUTING] Urgentes alocadas: ${osUrgentes.filter(os => osAlocadas.has(os.id)).length}/${osUrgentes.length}`);

  // ============================================================================
  // FASE 7: ALOCAÇÃO TERRITORIAL / NEAREST NEIGHBOR
  // V17: Estritamente dentro da zona/território
  // ============================================================================
  
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] ══ FASE 7: Alocação ${usarTerritorios ? 'por Território' : 'por Zona'} ══`);
  
  for (const rota of rotas) {
    // V17: Pular equipes backup (sem zona)
    if (!usarTerritorios && rota.zonaId === -1) {
      console.log(`[ROUTING] ${rota.equipe.codigo} (backup): Pulada - apenas para emergências`);
      continue;
    }
    
    const fimJornada = getFimJornada(rota.equipe);
    let alocadasNestaRota = 0;
    
    let continuarAlocando = true;
  let iteracoes = 0;
  
    while (continuarAlocando && iteracoes < 100) {
    iteracoes++;
      continuarAlocando = false;
      
      const tempoAtual = getTempoAtual(rota);
      if (tempoAtual >= fimJornada - 30) break;
      
      const ultimaLocIdx = getUltimaLocalizacao(rota);
      
      let osProxima: OrdemServico | null = null;
      let calcProxima: ReturnType<typeof calcularInsercao> | null = null;
      let menorDistancia = Infinity;
      let melhorScore: number = estrategia === 'distancia' ? Infinity : -Infinity; // Para distância, menor é melhor
      
      // V20: Verificar se há tempo livre antes do almoço para encaixar OS curta
      const jaAlmocouRota = jaAlmocou(rota);
      if (!jaAlmocouRota) {
        const configAlmocoEquipe = obterConfigAlmoco(rota.equipe);
        const tempoLivreAteAlmoco = configAlmocoEquipe.inicio - tempoAtual;
        const ultimoInicioAlmoco = configAlmocoEquipe.fim - configAlmocoEquipe.duracao;
        
        // Se há mais de 15 min de tempo livre antes do início da janela de almoço
        if (tempoLivreAteAlmoco > 15 && tempoAtual < ultimoInicioAlmoco) {
          console.log(`[ROUTING] ${rota.equipe.codigo}: Tempo livre antes do almoço: ${tempoLivreAteAlmoco.toFixed(0)}min (atual: ${minutosParaHora(tempoAtual)}, janela: ${minutosParaHora(configAlmocoEquipe.inicio)}-${minutosParaHora(configAlmocoEquipe.fim)})`);
          
          // Buscar OSs curtas (≤30 min) disponíveis
          const ossCurtas = [...osProximoDia, ...osNormais, ...ossNormaisRemovidas].filter(os => {
            if (osAlocadas.has(os.id)) return false;
            if (!equipeTemSkill(rota.equipe, os.tipo)) return false;
            if (os.tempoExecucao > 30) return false; // Apenas OSs curtas
            if (os.latitude === null || os.longitude === null) return false;
            
            // Verificar território/zona
            if (usarTerritorios && territoriosAtivos.length > 0) {
              if (!equipeEstaNoTerritorioDaOS(os.id, rota.equipe.id)) return false;
              // Verificar zona se aplicável
              const territorioIdDaOS = osParaTerritorio.get(os.id);
              if (territorioIdDaOS && zonas.length > 0) {
                const equipesDoTerritorio = equipesPorTerritorio.get(territorioIdDaOS) || [];
                if (equipesDoTerritorio.length > 1 && rota.zonaId !== undefined && rota.zonaId >= 0) {
                  const zonaOS = zonasPorOS.get(os.id);
                  if (zonaOS === undefined || zonaOS !== rota.zonaId) return false;
                }
              }
            } else if (!usarTerritorios) {
              // Se usando zonas, verificar zona
              const zonaOS = zonasPorOS.get(os.id);
              if (zonaOS !== rota.zonaId) return false;
            }
            
            return true;
          });
          
          // Obter última localização da rota
          let ultimaLat = rota.equipe.latitude;
          let ultimaLng = rota.equipe.longitude;
          if (rota.servicos.length > 0) {
            const ultimoServ = rota.servicos[rota.servicos.length - 1];
            if (ultimoServ.ordemServico) {
              ultimaLat = ultimoServ.ordemServico.latitude ?? ultimaLat;
              ultimaLng = ultimoServ.ordemServico.longitude ?? ultimaLng;
            }
          }
          
          // Encontrar a melhor OS curta (mais próxima que cabe antes do limite)
          let melhorOSCurta: OrdemServico | null = null;
          let menorDistCurta = Infinity;
          let tempoFimMelhor = 0;
          
          for (const osCurta of ossCurtas) {
            const distCurta = calcularDistancia(ultimaLat, ultimaLng, osCurta.latitude!, osCurta.longitude!);
            const tempoDesloc = calcularTempoDeslocamento(distCurta);
            const tempoFimOS = tempoAtual + tempoDesloc + osCurta.tempoExecucao;
            
            // Verificar se a OS curta TERMINA antes do último momento para iniciar o almoço
            if (tempoFimOS <= ultimoInicioAlmoco && distCurta < menorDistCurta) {
              melhorOSCurta = osCurta;
              menorDistCurta = distCurta;
              tempoFimMelhor = tempoFimOS;
            }
          }
          
          // Se encontrou OS curta, inserir DIRETAMENTE (sem verificar almoço)
          if (melhorOSCurta) {
            const distCurta = menorDistCurta;
            const tempoDesloc = calcularTempoDeslocamento(distCurta);
            const eta = tempoAtual + tempoDesloc;
            const fimServico = eta + melhorOSCurta.tempoExecucao;
            
            console.log(`[ROUTING] ${rota.equipe.codigo}: ✓ Encaixando OS curta ${melhorOSCurta.numero} (${melhorOSCurta.tempoExecucao}min) antes do almoço - termina ${minutosParaHora(fimServico)}`);
            
            // Inserir diretamente SEM passar por calcularInsercao (para não inserir almoço)
            const ordemNaRota = rota.servicos.filter(s => s.tipo === "SERVICO").length + 1;
            rota.servicos.push({
              tipo: "SERVICO",
              ordemServico: melhorOSCurta,
              ordemNaRota,
              tempoDeslocamento: tempoDesloc,
              distancia: distCurta,
              tempoTotal: fimServico,
              horaInicio: minutosParaHora(eta),
              horaFim: minutosParaHora(fimServico),
              eta: minutosParaHora(eta)
            });
            
            osAlocadas.add(melhorOSCurta.id);
            rota.distanciaTotal += distCurta;
            rota.faturamentoTotal += melhorOSCurta.valor || 0;
            
            const inicioJornada = horaParaMinutos(rota.equipe.horaInicio);
            const duracaoJornada = (rota.equipe.maxHorasTrabalho || 10) * 60;
            rota.tempoTotal = fimServico - inicioJornada;
            rota.progresso = (rota.tempoTotal / duracaoJornada) * 100;
            
            alocadasNestaRota++;
            continuarAlocando = true;
            continue; // Voltar ao início do while para tentar outra OS curta
          } else {
            console.log(`[ROUTING] ${rota.equipe.codigo}: Nenhuma OS curta disponível para encaixar antes do almoço (${ossCurtas.length} OSs curtas verificadas)`);
          }
        }
      }
      
      // V17: Buscar OSs disponíveis ESTRITAMENTE da zona/território
      let ossDisponiveis: OrdemServico[];
      
      if (usarTerritorios && territoriosAtivos.length > 0) {
        ossDisponiveis = [...osProximoDia, ...osNormais, ...ossNormaisRemovidas].filter(os => {
          if (osAlocadas.has(os.id)) return false;
          if (!equipeTemSkill(rota.equipe, os.tipo)) return false;
          
          // Verificar se a OS pertence ao território da equipe
          if (!equipeEstaNoTerritorioDaOS(os.id, rota.equipe.id)) {
            return false;
          }
          
          // Se há múltiplas equipes no território e zonas foram criadas, verificar se a OS está na zona da equipe
          const territorioIdDaOS = osParaTerritorio.get(os.id);
          if (territorioIdDaOS && zonas.length > 0) {
            const equipesDoTerritorio = equipesPorTerritorio.get(territorioIdDaOS) || [];
            if (equipesDoTerritorio.length > 1 && rota.zonaId !== undefined && rota.zonaId >= 0) {
              const zonaOS = zonasPorOS.get(os.id);
              if (zonaOS === undefined || zonaOS !== rota.zonaId) {
                return false; // OS não pertence a esta zona
              }
            }
          }
          
          return true;
        });
      } else {
        ossDisponiveis = [...osProximoDia, ...osNormais, ...ossNormaisRemovidas].filter(os => {
          if (osAlocadas.has(os.id)) return false;
          if (!equipeTemSkill(rota.equipe, os.tipo)) return false;
          
          const zonaOS = zonasPorOS.get(os.id);
          return zonaOS === rota.zonaId;
        });
      }
      
      for (const os of ossDisponiveis) {
        const osLocIdx = osIdx.get(os.id);
        if (osLocIdx === undefined) continue;
        
        const distancia = getDistanciaKm(ultimaLocIdx, osLocIdx);
        const limiteDistancia = usarTerritorios ? DISTANCIA_MAXIMA_TERRITORIO_KM : DISTANCIA_MAXIMA_NORMAL_KM;
        
        if (distancia <= limiteDistancia) {
          const calc = calcularInsercao(rota, os, true, limiteDistancia, false, 120);
      
      if (calc.valido) {
            // V19.6: Calcular score baseado na estratégia de forma mais agressiva
            let score: number;
            let melhorou = false;
            
            if (estrategia === 'financeiro') {
              // Para financeiro: maior valor/hora é melhor
              const valorHora = (os.valor || 0) / Math.max(os.tempoExecucao || 15, 1);
              score = valorHora * 100 + (os.valor || 0); // Combina valor/hora com valor absoluto
              melhorou = score > melhorScore;
            } else if (estrategia === 'quantidade') {
              // Para quantidade: menor tempo de execução é melhor (para caber mais OSs)
              // Penaliza OSs que demoram muito
              score = 1000 - (os.tempoExecucao || 15) - (distancia * 2); // Menor tempo + menor deslocamento
              melhorou = score > melhorScore;
            } else {
              // Para distancia ou undefined: menor distância é melhor (nearest neighbor)
              score = -distancia;
              melhorou = distancia < menorDistancia;
            }
            
            if (melhorou) {
              menorDistancia = distancia;
              melhorScore = score;
              osProxima = os;
              calcProxima = calc;
            }
          }
        }
      }
      
      if (osProxima && calcProxima) {
        inserirOS(rota, osProxima, calcProxima);
        alocadasNestaRota++;
        continuarAlocando = true;
        
        const consolidadas = consolidarVizinhas(rota, osProxima, [...osProximoDia, ...osNormais, ...ossNormaisRemovidas]);
        alocadasNestaRota += consolidadas;
        totalConsolidadas += consolidadas;
      }
    }
    
    const infoZona = usarTerritorios 
      ? (rota.territorioId ? `território` : 'sem território')
      : (rota.zonaId !== undefined && rota.zonaId >= 0 ? `zona ${rota.zonaId}` : 'backup');
    console.log(`[ROUTING] ${rota.equipe.codigo} (${infoZona}): +${alocadasNestaRota} OSs, progresso: ${rota.progresso.toFixed(0)}%`);
  }
  
  console.log(`[ROUTING] Total consolidadas (vizinhas): ${totalConsolidadas}`);

  // ============================================================================
  // FASE 8 e 9: BALANCEAMENTO E SATURAÇÃO DESABILITADOS
  // V17: Não permitimos invadir zonas/territórios de outras equipes
  // ============================================================================
  
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] ══ FASE 8 & 9: Balanceamento e Saturação ══`);
  console.log(`[ROUTING] ⚠️ DESABILITADOS em V17 - Equipes não invadem zonas de outras`);
  console.log(`[ROUTING] Se uma equipe ficou ociosa, significa que sua zona tem poucas OSs`);

  // ============================================================================
  // FASE 10: MARCAR NÃO ALOCADAS
  // ============================================================================
  
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] ══ FASE 10: Não Alocadas ══`);
  
  for (const os of ossParaRoteirizar) {
    if (!osAlocadas.has(os.id) && !naoAlocadas.find(na => na.os.id === os.id)) {
      const motivo = usarTerritorios 
        ? `Equipe do território sem capacidade`
        : `Equipe da zona sem capacidade`;
      naoAlocadas.push({ os, motivo });
      osAlocadas.add(os.id);
    }
  }

  // ============================================================================
  // FASE 9.5: OTIMIZAÇÃO GEOGRÁFICA DAS ROTAS (V19)
  // Reordena OSs dentro de cada rota para minimizar deslocamentos
  // Respeitando prazos e prioridades
  // ============================================================================
  
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] ══ FASE 9.5: Otimização Geográfica das Rotas ══`);
  
  /**
   * V19: Recalcula todos os tempos de uma rota após reordenação
   */
  const recalcularTemposRota = (rota: RotaEquipe): boolean => {
    let tempoAtual = horaParaMinutos(rota.equipe.horaInicio);
    let distanciaTotal = 0;
    let faturamentoTotal = 0;
    let ultimaLocIdx = equipeIdx.get(rota.equipe.id)!;
    let todasValidas = true;
    const configAlmocoLocal = obterConfigAlmoco(rota.equipe);
    
    for (const srv of rota.servicos) {
      if (srv.tipo === "ALMOCO") {
        srv.tempoDeslocamento = 0;
        srv.distancia = 0;
        // O almoço deve começar no mínimo às config.inicio (ex: 12:00)
        const inicioAlmoco = Math.max(tempoAtual, configAlmocoLocal.inicio);
        srv.horaInicio = minutosParaHora(inicioAlmoco);
        tempoAtual = inicioAlmoco + configAlmocoLocal.duracao; // usar duração configurada da equipe
        srv.tempoTotal = tempoAtual;
        srv.horaFim = minutosParaHora(tempoAtual);
        srv.eta = srv.horaInicio;
      } else if (srv.ordemServico) {
        const os = srv.ordemServico;
        const osLocIdx = osIdx.get(os.id);
        
        if (osLocIdx === undefined) {
          todasValidas = false;
          continue;
        }
        
        const tempoDesloc = getTempo(ultimaLocIdx, osLocIdx);
        const distDesloc = getDistanciaKm(ultimaLocIdx, osLocIdx);
        
        srv.tempoDeslocamento = tempoDesloc;
        srv.distancia = distDesloc;
        tempoAtual += tempoDesloc;
        srv.horaInicio = minutosParaHora(tempoAtual);
        srv.eta = minutosParaHora(tempoAtual);
        tempoAtual += os.tempoExecucao;
        srv.tempoTotal = tempoAtual;
        srv.horaFim = minutosParaHora(tempoAtual);
        
        distanciaTotal += distDesloc;
        faturamentoTotal += os.valor;
        ultimaLocIdx = osLocIdx;
        
        // Verificar se está dentro do prazo
        if (os.prazo) {
      const prazoMin = os.prazo.getHours() * 60 + os.prazo.getMinutes();
          if (tempoAtual > prazoMin) {
            // Emergências nunca podem atrasar
            if (ehEmergencia(os)) {
              todasValidas = false;
            }
            // Reguladas urgentes podem atrasar até 120min
            else if (ehReguladaUrgente(os)) {
              const atraso = tempoAtual - prazoMin;
              if (atraso > 120) {
                todasValidas = false;
              }
            }
            // Outras podem atrasar até 60min
            else {
              const atraso = tempoAtual - prazoMin;
              if (atraso > 60) {
                todasValidas = false;
              }
            }
          }
        }
        
        // Verificar se não estoura jornada
        const fimJornada = getFimJornada(rota.equipe);
        if (tempoAtual > fimJornada) {
          todasValidas = false;
        }
      }
    }
    
    const inicioJornada = horaParaMinutos(rota.equipe.horaInicio);
    const duracaoJornada = (rota.equipe.maxHorasTrabalho || 10) * 60;
    rota.tempoTotal = tempoAtual - inicioJornada; // Tempo de trabalho, não tempo absoluto
    rota.distanciaTotal = distanciaTotal;
    rota.faturamentoTotal = faturamentoTotal;
    rota.progresso = ((tempoAtual - inicioJornada) / duracaoJornada) * 100;
    
    return todasValidas;
  };
  
  // Tipo para otimização geográfica
  type ItemOtimizacao = { servico: RotaServico; indiceOriginal: number; temPrazoCritico: boolean; osIdx: number };
  
  /**
   * V19.5: Otimização EXTREMA com 50+ cenários por zona
   * - Cada zona/território é otimizada INDIVIDUALMENTE e EXTREMAMENTE APROFUNDADA
   * - Gera 50+ cenários diferentes usando combinações de estratégias
   * - Análise profunda de cada cenário considerando múltiplas métricas
   * - Escolhe o melhor cenário baseado em score otimizado para distância
   */
  const otimizarOrdemGeografica = (rota: RotaEquipe): void => {
    const servicosOSs = rota.servicos.filter(s => s.tipo === "SERVICO" && s.ordemServico);
    
    if (servicosOSs.length <= 2) return;
    
    const ordemOriginal = rota.servicos.map(s => ({ ...s }));
    const distanciaOriginal = rota.distanciaTotal;
    
    // Extrair OSs para otimizar
    const servicosParaOtimizar: ItemOtimizacao[] = [];
    
    for (let i = 0; i < rota.servicos.length; i++) {
      const srv = rota.servicos[i];
      if (srv.tipo === "SERVICO" && srv.ordemServico) {
        const osIdxVal = osIdx.get(srv.ordemServico.id);
        if (osIdxVal !== undefined) {
          servicosParaOtimizar.push({
            servico: srv,
            indiceOriginal: i,
            temPrazoCritico: ehEmergencia(srv.ordemServico),
            osIdx: osIdxVal
          });
        }
      }
    }
    
    if (servicosParaOtimizar.length <= 2) return;
    
    const baseIdx = equipeIdx.get(rota.equipe.id)!;
    const inicioJornada = horaParaMinutos(rota.equipe.horaInicio);
    const fimJornada = getFimJornada(rota.equipe);
    
    // Identificar zona/território desta rota para análise individual
    const zonaId = rota.zonaId;
    const territorioId = rota.territorioId;
    const identificadorZona = zonaId !== undefined ? `zona-${zonaId}` : territorioId ? `territorio-${territorioId}` : 'sem-zona';
    
    console.log(`[ROUTING] 🔍 Otimização EXTREMA para ${rota.equipe.codigo} (${identificadorZona}): ${servicosParaOtimizar.length} OSs`);
    
    // ESTRATÉGIA: Gerar 50+ cenários diferentes e escolher o melhor
    interface CenarioOtimizado {
      rota: ItemOtimizacao[];
      tempoTotal: number;
      distanciaTotal: number;
      score: number;
      violacoesPrazo: number;
      estrategia: string;
    }
    
    const cenarios: CenarioOtimizado[] = [];
    
    // ============================================================================
    // GRUPO 1: ESTRATÉGIAS BÁSICAS (Cenários 1-10)
    // ============================================================================
    
    // CENÁRIO 1: Nearest neighbor por tempo
    const cenario1 = otimizarComNearestNeighbor(servicosParaOtimizar, baseIdx, true);
    cenarios.push({ rota: cenario1, ...avaliarCenario(cenario1, baseIdx, inicioJornada, fimJornada), estrategia: "NN-Tempo" });
    
    // CENÁRIO 2: Nearest neighbor por distância
    const cenario2 = otimizarComNearestNeighbor(servicosParaOtimizar, baseIdx, false);
    cenarios.push({ rota: cenario2, ...avaliarCenario(cenario2, baseIdx, inicioJornada, fimJornada), estrategia: "NN-Distância" });
    
    // CENÁRIO 3: Clusters geográficos
    if (servicosParaOtimizar.length > 5) {
      const cenario3 = otimizarPorClusters(servicosParaOtimizar, baseIdx);
      cenarios.push({ rota: cenario3, ...avaliarCenario(cenario3, baseIdx, inicioJornada, fimJornada), estrategia: "Clusters" });
    }
    
    // CENÁRIO 4: Prazo primeiro, depois geográfico
    const cenario4 = otimizarPorPrazoDepoisGeografico(servicosParaOtimizar, baseIdx);
    cenarios.push({ rota: cenario4, ...avaliarCenario(cenario4, baseIdx, inicioJornada, fimJornada), estrategia: "Prazo+Geo" });
    
    // CENÁRIO 5: Simulated annealing
    if (servicosParaOtimizar.length > 4) {
      const cenario5 = simulatedAnnealing(servicosParaOtimizar, baseIdx, inicioJornada, fimJornada);
      cenarios.push({ rota: cenario5, ...avaliarCenario(cenario5, baseIdx, inicioJornada, fimJornada), estrategia: "SimAnnealing" });
    }
    
    // CENÁRIO 6-10: Variações com diferentes pontos de partida
    if (servicosParaOtimizar.length > 3) {
      const pontosPartida = encontrarPontosPartidaInteressantes(servicosParaOtimizar, baseIdx);
      for (let i = 0; i < Math.min(5, pontosPartida.length); i++) {
        const cenario = otimizarComNearestNeighbor(servicosParaOtimizar, pontosPartida[i], true);
        cenarios.push({ rota: cenario, ...avaliarCenario(cenario, baseIdx, inicioJornada, fimJornada), estrategia: `NN-P${i}` });
      }
    }
    
    // ============================================================================
    // GRUPO 2: ORDENAÇÕES POR DISTÂNCIA E LOCALIZAÇÃO (Cenários 11-20)
    // ============================================================================
    
    // CENÁRIO 11-12: Por distância da base
    cenarios.push({ rota: otimizarPorDistanciaBase(servicosParaOtimizar, baseIdx), ...avaliarCenario(otimizarPorDistanciaBase(servicosParaOtimizar, baseIdx), baseIdx, inicioJornada, fimJornada), estrategia: "DistBase-Próximas" });
    if (servicosParaOtimizar.length > 4) {
      cenarios.push({ rota: otimizarPorDistanciaBaseReversa(servicosParaOtimizar, baseIdx), ...avaliarCenario(otimizarPorDistanciaBaseReversa(servicosParaOtimizar, baseIdx), baseIdx, inicioJornada, fimJornada), estrategia: "DistBase-Distantes" });
    }
    
    // CENÁRIO 13-15: Por ângulo polar
    if (servicosParaOtimizar.length > 4) {
      cenarios.push({ rota: otimizarPorAnguloPolar(servicosParaOtimizar, baseIdx), ...avaliarCenario(otimizarPorAnguloPolar(servicosParaOtimizar, baseIdx), baseIdx, inicioJornada, fimJornada), estrategia: "AnguloPolar" });
    }
    
    // CENÁRIO 16-17: Nearest/Farthest insertion
    if (servicosParaOtimizar.length > 4) {
      cenarios.push({ rota: nearestInsertion(servicosParaOtimizar, baseIdx), ...avaliarCenario(nearestInsertion(servicosParaOtimizar, baseIdx), baseIdx, inicioJornada, fimJornada), estrategia: "NearestInsert" });
    }
    if (servicosParaOtimizar.length > 5) {
      cenarios.push({ rota: farthestInsertion(servicosParaOtimizar, baseIdx), ...avaliarCenario(farthestInsertion(servicosParaOtimizar, baseIdx), baseIdx, inicioJornada, fimJornada), estrategia: "FarthestInsert" });
    }
    
    // CENÁRIO 18-19: Por densidade e tempo de execução
    if (servicosParaOtimizar.length > 6) {
      cenarios.push({ rota: otimizarPorDensidade(servicosParaOtimizar, baseIdx), ...avaliarCenario(otimizarPorDensidade(servicosParaOtimizar, baseIdx), baseIdx, inicioJornada, fimJornada), estrategia: "Densidade" });
    }
    cenarios.push({ rota: otimizarPorTempoExecucao(servicosParaOtimizar, baseIdx), ...avaliarCenario(otimizarPorTempoExecucao(servicosParaOtimizar, baseIdx), baseIdx, inicioJornada, fimJornada), estrategia: "TempoExec" });
    
    // CENÁRIO 20: Híbrida
    cenarios.push({ rota: otimizacaoHibrida(servicosParaOtimizar, baseIdx, inicioJornada, fimJornada), ...avaliarCenario(otimizacaoHibrida(servicosParaOtimizar, baseIdx, inicioJornada, fimJornada), baseIdx, inicioJornada, fimJornada), estrategia: "Híbrida" });
    
    // ============================================================================
    // GRUPO 3: ALGORITMOS AVANÇADOS (Cenários 21-30)
    // ============================================================================
    
    // CENÁRIO 21-23: Algoritmo genético
    if (servicosParaOtimizar.length > 5) {
      cenarios.push({ rota: algoritmoGenetico(servicosParaOtimizar, baseIdx, inicioJornada, fimJornada), ...avaliarCenario(algoritmoGenetico(servicosParaOtimizar, baseIdx, inicioJornada, fimJornada), baseIdx, inicioJornada, fimJornada), estrategia: "Genético" });
    }
    
    // CENÁRIO 24-25: Lin-Kernighan
    if (servicosParaOtimizar.length > 6) {
      cenarios.push({ rota: linKernighan(servicosParaOtimizar, baseIdx, inicioJornada, fimJornada), ...avaliarCenario(linKernighan(servicosParaOtimizar, baseIdx, inicioJornada, fimJornada), baseIdx, inicioJornada, fimJornada), estrategia: "LinKernighan" });
    }
    
    // CENÁRIO 26-30: Simulated annealing com diferentes configurações
    if (servicosParaOtimizar.length > 4) {
      for (let temp = 0.5; temp <= 2.0 && cenarios.length < 30; temp += 0.5) {
        for (let iter = 30; iter <= 60 && cenarios.length < 30; iter += 30) {
          const cenario = simulatedAnnealing(servicosParaOtimizar, baseIdx, inicioJornada, fimJornada, iter, temp);
          cenarios.push({ rota: cenario, ...avaliarCenario(cenario, baseIdx, inicioJornada, fimJornada), estrategia: `SA-T${temp}-I${iter}` });
        }
      }
    }
    
    // ============================================================================
    // GRUPO 4: COMBINAÇÕES DE ESTRATÉGIAS (Cenários 31-50)
    // ============================================================================
    
    // CENÁRIO 31-40: Aplicar 2-opt e 3-opt em diferentes estratégias base
    const estrategiasBase = [
      () => otimizarComNearestNeighbor(servicosParaOtimizar, baseIdx, true),
      () => otimizarPorDistanciaBase(servicosParaOtimizar, baseIdx),
      () => nearestInsertion(servicosParaOtimizar, baseIdx),
      () => otimizarPorAnguloPolar(servicosParaOtimizar, baseIdx),
      () => servicosParaOtimizar.length > 5 ? otimizarPorClusters(servicosParaOtimizar, baseIdx) : servicosParaOtimizar
    ];
    
    for (let i = 0; i < estrategiasBase.length && servicosParaOtimizar.length > 4 && cenarios.length < 40; i++) {
      try {
        const base = estrategiasBase[i]();
        const otimizada = aplicar2OptMelhorado(base, baseIdx);
        cenarios.push({ rota: otimizada, ...avaliarCenario(otimizada, baseIdx, inicioJornada, fimJornada), estrategia: `Base${i}+2opt` });
      } catch (e) {
        // Ignorar erros
      }
    }
    
    for (let i = 0; i < Math.min(5, estrategiasBase.length) && servicosParaOtimizar.length > 5 && cenarios.length < 45; i++) {
      try {
        const base = estrategiasBase[i]();
        const otimizada = aplicar3Opt(base, baseIdx);
        cenarios.push({ rota: otimizada, ...avaliarCenario(otimizada, baseIdx, inicioJornada, fimJornada), estrategia: `Base${i}+3opt` });
      } catch (e) {
        // Ignorar erros
      }
    }
    
    // CENÁRIO 41-50: Ordenações por diferentes critérios
    const ordenacoes = [
      (a: ItemOtimizacao, b: ItemOtimizacao) => {
        const distA = getDistanciaKm(baseIdx, a.osIdx);
        const distB = getDistanciaKm(baseIdx, b.osIdx);
        return distA - distB;
      },
      (a: ItemOtimizacao, b: ItemOtimizacao) => {
        const tempoA = a.servico.ordemServico?.tempoExecucao || 0;
        const tempoB = b.servico.ordemServico?.tempoExecucao || 0;
        return tempoA - tempoB;
      },
      (a: ItemOtimizacao, b: ItemOtimizacao) => {
        const [latA, lngA] = locations[a.osIdx];
        const [latB, lngB] = locations[b.osIdx];
        return latA - latB; // Norte para sul
      },
      (a: ItemOtimizacao, b: ItemOtimizacao) => {
        const [latA, lngA] = locations[a.osIdx];
        const [latB, lngB] = locations[b.osIdx];
        return lngA - lngB; // Oeste para leste
      }
    ];
    
    for (let i = 0; i < ordenacoes.length && cenarios.length < 50; i++) {
      const criticas = servicosParaOtimizar.filter(s => s.temPrazoCritico);
      const naoCriticas = servicosParaOtimizar.filter(s => !s.temPrazoCritico);
      naoCriticas.sort(ordenacoes[i]);
      const cenario = [...criticas, ...naoCriticas];
      cenarios.push({ rota: cenario, ...avaliarCenario(cenario, baseIdx, inicioJornada, fimJornada), estrategia: `Ordenação${i}` });
    }
    
    // ============================================================================
    // GRUPO 5: VARIAÇÕES POR SEGMENTAÇÃO E QUADRANTES (Cenários 51-60+)
    // ============================================================================
    
    // CENÁRIO 51-55: Dividir em segmentos
    if (servicosParaOtimizar.length > 8) {
      const numSegmentos = Math.min(5, Math.floor(servicosParaOtimizar.length / 2));
      for (let seg = 2; seg <= numSegmentos && cenarios.length < 56; seg++) {
        const criticas = servicosParaOtimizar.filter(s => s.temPrazoCritico);
        const naoCriticas = servicosParaOtimizar.filter(s => !s.temPrazoCritico);
        const tamanhoSegmento = Math.ceil(naoCriticas.length / seg);
        const resultado: ItemOtimizacao[] = [...criticas];
        let ultimaLocIdx = baseIdx;
        
        for (let s = 0; s < seg; s++) {
          const inicioSeg = s * tamanhoSegmento;
          const fimSeg = Math.min((s + 1) * tamanhoSegmento, naoCriticas.length);
          const segmento = naoCriticas.slice(inicioSeg, fimSeg);
          const segmentoOtimizado = otimizarComNearestNeighbor(segmento, ultimaLocIdx, true);
          resultado.push(...segmentoOtimizado);
          if (segmentoOtimizado.length > 0) {
            ultimaLocIdx = segmentoOtimizado[segmentoOtimizado.length - 1].osIdx;
          }
        }
        
        cenarios.push({ rota: resultado, ...avaliarCenario(resultado, baseIdx, inicioJornada, fimJornada), estrategia: `Segmentos${seg}` });
      }
    }
    
    // CENÁRIO 56-60: Otimização por quadrantes geográficos
    if (servicosParaOtimizar.length > 6) {
      const [baseLat, baseLng] = locations[baseIdx];
      const quadrantes: ItemOtimizacao[][] = [[], [], [], []];
      
      for (const item of servicosParaOtimizar) {
        if (item.temPrazoCritico) continue;
        const [lat, lng] = locations[item.osIdx];
        const dLat = lat - baseLat;
        const dLng = lng - baseLng;
        
        if (dLat >= 0 && dLng >= 0) quadrantes[0].push(item);
        else if (dLat >= 0 && dLng < 0) quadrantes[1].push(item);
        else if (dLat < 0 && dLng >= 0) quadrantes[2].push(item);
        else quadrantes[3].push(item);
      }
      
      const criticas = servicosParaOtimizar.filter(s => s.temPrazoCritico);
      const resultado: ItemOtimizacao[] = [...criticas];
      let ultimaLocIdx = baseIdx;
      
      for (const quadrante of quadrantes) {
        if (quadrante.length > 0) {
          const otimizado = otimizarComNearestNeighbor(quadrante, ultimaLocIdx, true);
          resultado.push(...otimizado);
          if (otimizado.length > 0) {
            ultimaLocIdx = otimizado[otimizado.length - 1].osIdx;
          }
        }
      }
      
      cenarios.push({ rota: resultado, ...avaliarCenario(resultado, baseIdx, inicioJornada, fimJornada), estrategia: "Quadrantes" });
    }
    
    // Garantir que temos pelo menos alguns cenários básicos
    if (cenarios.length < 10) {
      const criticas = servicosParaOtimizar.filter(s => s.temPrazoCritico);
      const naoCriticas = servicosParaOtimizar.filter(s => !s.temPrazoCritico);
      
      // Variação: ordem reversa
      const reversa = [...criticas, ...naoCriticas.reverse()];
      cenarios.push({ rota: reversa, ...avaliarCenario(reversa, baseIdx, inicioJornada, fimJornada), estrategia: "Reversa" });
      
      // Variação: ordem aleatória múltiplas vezes
      for (let i = 0; i < 5 && cenarios.length < 15; i++) {
        const aleatoria = [...naoCriticas];
        for (let j = aleatoria.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [aleatoria[j], aleatoria[k]] = [aleatoria[k], aleatoria[j]];
        }
        const cenario = [...criticas, ...aleatoria];
        cenarios.push({ rota: cenario, ...avaliarCenario(cenario, baseIdx, inicioJornada, fimJornada), estrategia: `Aleatória${i}` });
      }
    }
    
    // Escolher melhor cenário baseado em score (priorizando distância)
    cenarios.sort((a, b) => {
      // Priorizar: sem violações de prazo > melhor score (que prioriza distância)
      if (a.violacoesPrazo !== b.violacoesPrazo) {
        return a.violacoesPrazo - b.violacoesPrazo;
      }
      // Se mesmo número de violações, escolher melhor score (maior = melhor)
      if (Math.abs(a.score - b.score) > 0.1) {
        return b.score - a.score;
      }
      // Se scores muito próximos, priorizar menor distância
      return a.distanciaTotal - b.distanciaTotal;
    });
    
    const melhorCenario = cenarios[0];
    let melhorRota = melhorCenario.rota;
    
    console.log(`[ROUTING]   📊 ${cenarios.length} cenários gerados para ${identificadorZona}`);
    console.log(`[ROUTING]   🏆 Melhor: ${melhorCenario.estrategia} (${melhorCenario.distanciaTotal.toFixed(2)}km, ${melhorCenario.tempoTotal.toFixed(0)}min)`);
    
    // Aplicar melhorias incrementais no melhor cenário (múltiplas passadas)
    if (melhorRota.length > 3) {
      melhorRota = aplicar2OptMelhorado(melhorRota, baseIdx);
    }
    if (melhorRota.length > 5) {
      melhorRota = aplicar3Opt(melhorRota, baseIdx);
    }
    
    // Aplicar simulated annealing local para refinamento (múltiplas tentativas)
    if (melhorRota.length > 4) {
      let melhorRefinada = melhorRota;
      let melhorScoreRefinada = avaliarCenario(melhorRota, baseIdx, inicioJornada, fimJornada).score;
      
      // Tentar múltiplas configurações de simulated annealing
      for (const config of [
        { iter: 20, temp: 0.5 },
        { iter: 30, temp: 0.7 },
        { iter: 40, temp: 1.0 }
      ]) {
        const refinada = simulatedAnnealing(melhorRota, baseIdx, inicioJornada, fimJornada, config.iter, config.temp);
        const metricaRefinada = avaliarCenario(refinada, baseIdx, inicioJornada, fimJornada);
        
        if (metricaRefinada.score > melhorScoreRefinada && metricaRefinada.violacoesPrazo <= melhorCenario.violacoesPrazo) {
          melhorRefinada = refinada;
          melhorScoreRefinada = metricaRefinada.score;
        }
      }
      
      melhorRota = melhorRefinada;
    }
    
    // Aplicar mais uma rodada de 2-opt e 3-opt após refinamento
    if (melhorRota.length > 3) {
      melhorRota = aplicar2OptMelhorado(melhorRota, baseIdx);
    }
    if (melhorRota.length > 5) {
      melhorRota = aplicar3Opt(melhorRota, baseIdx);
    }
    
    // Reconstruir rota mantendo almoços
    const novaRota: RotaServico[] = [];
    let idxOtimizadas = 0;
    
    for (let i = 0; i < rota.servicos.length; i++) {
      const srv = rota.servicos[i];
      if (srv.tipo === "ALMOCO") {
        novaRota.push(srv);
      } else if (srv.tipo === "SERVICO" && srv.ordemServico) {
        if (idxOtimizadas < melhorRota.length) {
          novaRota.push(melhorRota[idxOtimizadas].servico);
          idxOtimizadas++;
        }
      }
    }
    
    rota.servicos = novaRota;
    const valida = recalcularTemposRota(rota);
    
    // Comparar com a melhor métrica dos cenários
    const melhorMetrica = avaliarCenario(melhorRota, baseIdx, inicioJornada, fimJornada);
    const metricaOriginal = avaliarCenario(
      servicosParaOtimizar.map((s, i) => ({ ...s, indiceOriginal: i })),
      baseIdx,
      inicioJornada,
      fimJornada
    );
    
    // Aceitar se melhorou em distância OU tempo, mesmo que pequena melhoria
    const melhorouDistancia = rota.distanciaTotal < distanciaOriginal * 0.999; // Aceita até 0.1% de melhoria
    const melhorouTempo = melhorMetrica.tempoTotal < metricaOriginal.tempoTotal - 1; // Aceita 1 minuto de melhoria
    const semViolacoes = melhorMetrica.violacoesPrazo <= metricaOriginal.violacoesPrazo;
    
    if (!valida || (!melhorouDistancia && !melhorouTempo) || !semViolacoes) {
      rota.servicos = ordemOriginal;
      recalcularTemposRota(rota);
      console.log(`[ROUTING]   ✗ ${rota.equipe.codigo}: Otimização revertida (${cenarios.length} cenários testados)`);
    } else {
      const reducaoDist = ((distanciaOriginal - rota.distanciaTotal) / distanciaOriginal * 100).toFixed(1);
      const reducaoTempo = melhorMetrica.tempoTotal < metricaOriginal.tempoTotal 
        ? ((metricaOriginal.tempoTotal - melhorMetrica.tempoTotal) / metricaOriginal.tempoTotal * 100).toFixed(1)
        : "0";
      console.log(`[ROUTING]   ✓ ${rota.equipe.codigo}: ${distanciaOriginal.toFixed(1)}km → ${rota.distanciaTotal.toFixed(1)}km (${reducaoDist}%), tempo: ${melhorMetrica.tempoTotal.toFixed(0)}min (${reducaoTempo}%), ${cenarios.length} cenários`);
    }
  };
  
  /**
   * Nearest neighbor usando tempo real de deslocamento
   */
  const otimizarComNearestNeighbor = (
    servicos: ItemOtimizacao[],
    pontoInicial: number,
    usarTempo: boolean
  ): ItemOtimizacao[] => {
    const otimizadas: typeof servicos = [];
    const naoVisitadas = [...servicos];
    
    // Separar críticas
    const criticas = naoVisitadas.filter(s => s.temPrazoCritico);
    const naoCriticas = naoVisitadas.filter(s => !s.temPrazoCritico);
    
    let ultimaLocIdx = pontoInicial;
    
    // Primeiro: inserir críticas usando inserção inteligente
    for (const critica of criticas) {
      otimizadas.push(critica);
      ultimaLocIdx = critica.osIdx;
    }
    
    // Depois: inserir não-críticas usando nearest neighbor
    while (naoCriticas.length > 0) {
      let melhorIdx = -1;
      let menorCusto = Infinity;
      
      for (let i = 0; i < naoCriticas.length; i++) {
        const item = naoCriticas[i];
        let custo: number;
        
        if (usarTempo) {
          // Usar tempo de deslocamento real
          custo = getTempo(ultimaLocIdx, item.osIdx);
        } else {
          // Usar distância
          custo = getDistanciaKm(ultimaLocIdx, item.osIdx);
        }
        
        if (custo < menorCusto) {
          menorCusto = custo;
          melhorIdx = i;
        }
      }
      
      if (melhorIdx >= 0) {
        const escolhida = naoCriticas.splice(melhorIdx, 1)[0];
        // Inserir na melhor posição (não só no final)
        const melhorPos = encontrarMelhorPosicaoInsercao(otimizadas, escolhida, ultimaLocIdx);
        otimizadas.splice(melhorPos, 0, escolhida);
        ultimaLocIdx = escolhida.osIdx;
      } else {
        break;
      }
    }
    
    return otimizadas;
  };
  
  /**
   * Encontra a melhor posição para inserir uma OS na rota
   */
  const encontrarMelhorPosicaoInsercao = (
    rotaAtual: ItemOtimizacao[],
    novaOS: ItemOtimizacao,
    ultimaLocIdx: number
  ): number => {
    if (rotaAtual.length === 0) return 0;
    
    let melhorPos = rotaAtual.length;
    let menorCusto = Infinity;
    
    // Tentar inserir em cada posição
    for (let pos = 0; pos <= rotaAtual.length; pos++) {
      let custo = 0;
      
      if (pos === 0) {
        // Inserir no início
        custo = getTempo(ultimaLocIdx, novaOS.osIdx);
        if (rotaAtual.length > 0) {
          custo += getTempo(novaOS.osIdx, rotaAtual[0].osIdx);
          custo -= getTempo(ultimaLocIdx, rotaAtual[0].osIdx);
        }
      } else if (pos === rotaAtual.length) {
        // Inserir no final
        const ultimaOS = rotaAtual[rotaAtual.length - 1];
        custo = getTempo(ultimaOS.osIdx, novaOS.osIdx);
      } else {
        // Inserir no meio
        const antes = rotaAtual[pos - 1];
        const depois = rotaAtual[pos];
        custo = getTempo(antes.osIdx, novaOS.osIdx) + getTempo(novaOS.osIdx, depois.osIdx);
        custo -= getTempo(antes.osIdx, depois.osIdx);
      }
      
      if (custo < menorCusto) {
        menorCusto = custo;
        melhorPos = pos;
      }
    }
    
    return melhorPos;
  };
  
  /**
   * Otimização por clusters geográficos
   */
  const otimizarPorClusters = (
    servicos: ItemOtimizacao[],
    baseIdx: number
  ): ItemOtimizacao[] => {
      // Criar clusters geográficos
      const clusters: ItemOtimizacao[][] = [];
    const servicosRestantes = [...servicos];
    
      while (servicosRestantes.length > 0) {
        const cluster: ItemOtimizacao[] = [];
      const primeira = servicosRestantes.shift()!;
      cluster.push(primeira);
      
      // Adicionar OSs próximas ao cluster
      for (let i = servicosRestantes.length - 1; i >= 0; i--) {
        const item = servicosRestantes[i];
        let proxima = false;
        
        for (const itemCluster of cluster) {
          if (getDistanciaKm(itemCluster.osIdx, item.osIdx) < 3) { // 3km de raio
            proxima = true;
            break;
          }
        }
        
        if (proxima) {
          cluster.push(item);
          servicosRestantes.splice(i, 1);
        }
      }
      
      clusters.push(cluster);
    }
    
    // Ordenar clusters por distância da base
    clusters.sort((a, b) => {
      const distA = getDistanciaKm(baseIdx, a[0].osIdx);
      const distB = getDistanciaKm(baseIdx, b[0].osIdx);
      return distA - distB;
    });
    
    // Otimizar cada cluster e concatenar
    const resultado: ItemOtimizacao[] = [];
    let ultimaLocIdx = baseIdx;
    
    for (const cluster of clusters) {
      // Otimizar cluster internamente
      const clusterOtimizado = otimizarComNearestNeighbor(cluster, ultimaLocIdx, true);
      resultado.push(...clusterOtimizado);
      if (clusterOtimizado.length > 0) {
        ultimaLocIdx = clusterOtimizado[clusterOtimizado.length - 1].osIdx;
      }
    }
    
    return resultado;
  };
  
  /**
   * 2-opt melhorado usando tempo real
   */
  const aplicar2OptMelhorado = (
    rota: ItemOtimizacao[],
    baseIdx: number
  ): ItemOtimizacao[] => {
    let melhorou = true;
    let iteracoes = 0;
    const MAX_ITERACOES = 15;
    
    while (melhorou && iteracoes < MAX_ITERACOES && rota.length >= 4) {
      melhorou = false;
      iteracoes++;
      
      for (let i = 0; i < rota.length - 2; i++) {
        for (let j = i + 2; j < rota.length; j++) {
          // Calcular custo atual (tempo)
          let custoAtual = 0;
          let ultimaIdx = i === 0 ? baseIdx : rota[i - 1].osIdx;
          
          for (let k = i; k <= j; k++) {
            custoAtual += getTempo(ultimaIdx, rota[k].osIdx);
            ultimaIdx = rota[k].osIdx;
          }
          
          // Calcular custo invertido
          let custoInvertido = 0;
          ultimaIdx = i === 0 ? baseIdx : rota[i - 1].osIdx;
          
          for (let k = j; k >= i; k--) {
            custoInvertido += getTempo(ultimaIdx, rota[k].osIdx);
            ultimaIdx = rota[k].osIdx;
          }
          
          if (custoInvertido < custoAtual - 1) { // 1 minuto de tolerância
            const segmento = rota.slice(i, j + 1).reverse();
            for (let k = 0; k < segmento.length; k++) {
              rota[i + k] = segmento[k];
            }
            melhorou = true;
            break;
          }
        }
        if (melhorou) break;
      }
    }
    
    return rota;
  };
  
  /**
   * 3-opt para melhorias adicionais
   */
  const aplicar3Opt = (
    rota: ItemOtimizacao[],
    baseIdx: number
  ): ItemOtimizacao[] => {
    let melhorou = true;
    let iteracoes = 0;
    const MAX_ITERACOES = 5;
    
    while (melhorou && iteracoes < MAX_ITERACOES && rota.length >= 6) {
      melhorou = false;
      iteracoes++;
      
      for (let i = 0; i < rota.length - 4; i++) {
        for (let j = i + 2; j < rota.length - 2; j++) {
          for (let k = j + 2; k < rota.length; k++) {
            // Tentar diferentes rearranjos do segmento
            const segmentos = [
              rota.slice(i, j + 1),
              rota.slice(j + 1, k + 1),
              rota.slice(k + 1)
            ];
            
            // Tentar diferentes combinações
            const combinacoes = [
              [0, 1, 2],
              [0, 2, 1],
              [1, 0, 2],
              [1, 2, 0],
              [2, 0, 1],
              [2, 1, 0]
            ];
            
            for (const comb of combinacoes) {
              const novaOrdem = [
                ...rota.slice(0, i),
                ...segmentos[comb[0]],
                ...segmentos[comb[1]],
                ...segmentos[comb[2]]
              ];
              
              const distAtual = calcularDistanciaTotal(rota, baseIdx);
              const distNova = calcularDistanciaTotal(novaOrdem, baseIdx);
              
              if (distNova < distAtual - 0.2) {
                return novaOrdem;
              }
            }
          }
        }
      }
    }
    
    return rota;
  };
  
  /**
   * Avalia um cenário completo considerando tempo, distância e prazos
   */
  const avaliarCenario = (
    rota: ItemOtimizacao[],
    baseIdx: number,
    inicioJornada: number,
    fimJornada: number
  ): { tempoTotal: number; distanciaTotal: number; score: number; violacoesPrazo: number } => {
    if (rota.length === 0) {
      return { tempoTotal: 0, distanciaTotal: 0, score: 0, violacoesPrazo: 0 };
    }
    
    let tempoAtual = inicioJornada;
    let distanciaTotal = 0;
    let ultimaIdx = baseIdx;
    let violacoesPrazo = 0;
    let tempoDeslocamentoTotal = 0;
    let tempoExecucaoTotal = 0;
    
    for (const item of rota) {
      const tempoDesloc = getTempo(ultimaIdx, item.osIdx);
      const dist = getDistanciaKm(ultimaIdx, item.osIdx);
      
      tempoDeslocamentoTotal += tempoDesloc;
      distanciaTotal += dist;
      tempoAtual += tempoDesloc;
      
      const os = item.servico.ordemServico!;
      tempoExecucaoTotal += os.tempoExecucao;
      tempoAtual += os.tempoExecucao;
      
      // Verificar prazo
      if (os.prazo) {
        const prazoMin = os.prazo.getHours() * 60 + os.prazo.getMinutes();
        if (tempoAtual > prazoMin) {
          if (item.temPrazoCritico) {
            violacoesPrazo += 1000; // Violação crítica = muito ruim
          } else {
            const atraso = tempoAtual - prazoMin;
            violacoesPrazo += Math.min(atraso, 120); // Penalidade proporcional ao atraso
          }
        }
      }
      
      ultimaIdx = item.osIdx;
    }
    
    // Verificar se estoura jornada
    if (tempoAtual > fimJornada) {
      violacoesPrazo += (tempoAtual - fimJornada) * 10;
    }
    
    // Calcular score: maior é melhor
    // Score prioriza DISTÂNCIA (cada km vale muito) + tempo + violações
    // Peso maior na distância para maximizar economia de deslocamento
    const score = -distanciaTotal * 10 - (tempoAtual - inicioJornada) * 0.5 - violacoesPrazo * 1000;
    
    return {
      tempoTotal: tempoAtual - inicioJornada,
      distanciaTotal,
      score,
      violacoesPrazo
    };
  };
  
  /**
   * Otimiza primeiro por prazo, depois geograficamente
   */
  const otimizarPorPrazoDepoisGeografico = (
    servicos: ItemOtimizacao[],
    baseIdx: number
  ): ItemOtimizacao[] => {
    // Separar por urgência de prazo
    const comPrazo: Array<{ item: ItemOtimizacao; prazoMin: number }> = [];
    const semPrazo: ItemOtimizacao[] = [];
    
    for (const item of servicos) {
      if (item.servico.ordemServico?.prazo) {
        const prazo = item.servico.ordemServico.prazo;
        const prazoMin = prazo.getHours() * 60 + prazo.getMinutes();
        comPrazo.push({ item, prazoMin });
      } else {
        semPrazo.push(item);
      }
    }
    
    // Ordenar por prazo
    comPrazo.sort((a, b) => a.prazoMin - b.prazoMin);
    
    // Construir rota: críticas primeiro, depois por prazo, depois sem prazo otimizadas
    const resultado: ItemOtimizacao[] = [];
    const criticas = servicos.filter(s => s.temPrazoCritico);
    const naoCriticasComPrazo = comPrazo.filter(c => !c.item.temPrazoCritico);
    
    // Adicionar críticas primeiro
    resultado.push(...criticas);
    
    // Adicionar outras por prazo
    for (const { item } of naoCriticasComPrazo) {
      resultado.push(item);
    }
    
    // Otimizar sem prazo geograficamente
    const semPrazoOtimizadas = otimizarComNearestNeighbor(semPrazo, baseIdx, true);
    resultado.push(...semPrazoOtimizadas);
    
    return resultado;
  };
  
  /**
   * Simulated Annealing para otimização avançada
   */
  const simulatedAnnealing = (
    rotaInicial: ItemOtimizacao[],
    baseIdx: number,
    inicioJornada: number,
    fimJornada: number,
    iteracoes: number = 50,
    temperaturaInicial: number = 1.0
  ): ItemOtimizacao[] => {
    let melhorRota = [...rotaInicial];
    let melhorScore = avaliarCenario(melhorRota, baseIdx, inicioJornada, fimJornada).score;
    let rotaAtual = [...rotaInicial];
    let temperatura = temperaturaInicial;
    
    const criticas = rotaAtual.filter(r => r.temPrazoCritico);
    const naoCriticas = rotaAtual.filter(r => !r.temPrazoCritico);
    
    for (let i = 0; i < iteracoes; i++) {
      temperatura *= 0.95; // Resfriamento
      
      // Gerar vizinho: trocar duas OSs não-críticas
      if (naoCriticas.length < 2) break;
      
      const novaRota = [...criticas];
      const novaNaoCriticas = [...naoCriticas];
      
      // Trocar duas posições aleatórias
      const idx1 = Math.floor(Math.random() * novaNaoCriticas.length);
      const idx2 = Math.floor(Math.random() * novaNaoCriticas.length);
      
      if (idx1 !== idx2) {
        [novaNaoCriticas[idx1], novaNaoCriticas[idx2]] = [novaNaoCriticas[idx2], novaNaoCriticas[idx1]];
      }
      
      novaRota.push(...novaNaoCriticas);
      
      const scoreAtual = avaliarCenario(rotaAtual, baseIdx, inicioJornada, fimJornada).score;
      const scoreNovo = avaliarCenario(novaRota, baseIdx, inicioJornada, fimJornada).score;
      
      const delta = scoreNovo - scoreAtual;
      
      // Aceitar se melhor ou com probabilidade baseada em temperatura
      if (delta > 0 || Math.random() < Math.exp(delta / temperatura)) {
        rotaAtual = novaRota;
        
        if (scoreNovo > melhorScore) {
          melhorRota = novaRota;
          melhorScore = scoreNovo;
        }
      }
    }
    
    return melhorRota;
  };
  
  /**
   * Encontra pontos de partida interessantes para otimização
   */
  const encontrarPontosPartidaInteressantes = (
    servicos: ItemOtimizacao[],
    baseIdx: number
  ): number[] => {
    const pontos: number[] = [baseIdx];
    
    // OS mais próxima da base
    let maisProxima = servicos[0];
    let menorDist = Infinity;
    for (const item of servicos) {
      const dist = getDistanciaKm(baseIdx, item.osIdx);
      if (dist < menorDist && !item.temPrazoCritico) {
        menorDist = dist;
        maisProxima = item;
      }
    }
    if (maisProxima) pontos.push(maisProxima.osIdx);
    
    // OS mais distante (para explorar extremos)
    let maisDistante = servicos[0];
    let maiorDist = 0;
    for (const item of servicos) {
      const dist = getDistanciaKm(baseIdx, item.osIdx);
      if (dist > maiorDist && !item.temPrazoCritico) {
        maiorDist = dist;
        maisDistante = item;
      }
    }
    if (maisDistante && maisDistante.osIdx !== maisProxima.osIdx) {
      pontos.push(maisDistante.osIdx);
    }
    
    // Centroide geográfico das OSs
    let somaLat = 0, somaLng = 0, count = 0;
    for (const item of servicos) {
      const [lat, lng] = locations[item.osIdx];
      somaLat += lat;
      somaLng += lng;
      count++;
    }
    if (count > 0) {
      const centroLat = somaLat / count;
      const centroLng = somaLng / count;
      // Encontrar OS mais próxima do centroide
      let maisProximaCentro = servicos[0];
      let menorDistCentro = Infinity;
      for (const item of servicos) {
        const [lat, lng] = locations[item.osIdx];
        const dist = calcularDistancia(centroLat, centroLng, lat, lng);
        if (dist < menorDistCentro && !item.temPrazoCritico) {
          menorDistCentro = dist;
          maisProximaCentro = item;
        }
      }
      if (maisProximaCentro && !pontos.includes(maisProximaCentro.osIdx)) {
        pontos.push(maisProximaCentro.osIdx);
      }
    }
    
    return pontos;
  };
  
  /**
   * Otimiza por distância da base (mais próximas primeiro)
   */
  const otimizarPorDistanciaBase = (
    servicos: ItemOtimizacao[],
    baseIdx: number
  ): ItemOtimizacao[] => {
    const criticas = servicos.filter(s => s.temPrazoCritico);
    const naoCriticas = servicos.filter(s => !s.temPrazoCritico);
    
    // Ordenar não-críticas por distância da base
    naoCriticas.sort((a, b) => {
      const distA = getDistanciaKm(baseIdx, a.osIdx);
      const distB = getDistanciaKm(baseIdx, b.osIdx);
      return distA - distB;
    });
    
    return [...criticas, ...naoCriticas];
  };
  
  /**
   * Otimiza por distância da base (mais distantes primeiro - explora extremos)
   */
  const otimizarPorDistanciaBaseReversa = (
    servicos: ItemOtimizacao[],
    baseIdx: number
  ): ItemOtimizacao[] => {
    const criticas = servicos.filter(s => s.temPrazoCritico);
    const naoCriticas = servicos.filter(s => !s.temPrazoCritico);
    
    // Ordenar não-críticas por distância da base (maior primeiro)
    naoCriticas.sort((a, b) => {
      const distA = getDistanciaKm(baseIdx, a.osIdx);
      const distB = getDistanciaKm(baseIdx, b.osIdx);
      return distB - distA;
    });
    
    return [...criticas, ...naoCriticas];
  };
  
  /**
   * Algoritmo genético simples para otimização
   */
  const algoritmoGenetico = (
    servicos: ItemOtimizacao[],
    baseIdx: number,
    inicioJornada: number,
    fimJornada: number
  ): ItemOtimizacao[] => {
    const POPULACAO_SIZE = 20;
    const GERACOES = 30;
    const TAXA_MUTACAO = 0.3;
    
    const criticas = servicos.filter(s => s.temPrazoCritico);
    const naoCriticas = servicos.filter(s => !s.temPrazoCritico);
    
    // Criar população inicial
    let populacao: ItemOtimizacao[][] = [];
    for (let i = 0; i < POPULACAO_SIZE; i++) {
      const individuo = [...naoCriticas];
      // Embaralhar aleatoriamente
      for (let j = individuo.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [individuo[j], individuo[k]] = [individuo[k], individuo[j]];
      }
      populacao.push([...criticas, ...individuo]);
    }
    
    for (let geracao = 0; geracao < GERACOES; geracao++) {
      // Avaliar população
      const avaliacoes = populacao.map(ind => ({
        individuo: ind,
        score: avaliarCenario(ind, baseIdx, inicioJornada, fimJornada).score
      }));
      
      // Ordenar por score
      avaliacoes.sort((a, b) => b.score - a.score);
      
      // Selecionar top 50% para reprodução
      const elite = avaliacoes.slice(0, Math.floor(POPULACAO_SIZE / 2)).map(a => a.individuo);
      
      // Criar nova geração
      const novaGeracao: ItemOtimizacao[][] = [...elite];
      
      while (novaGeracao.length < POPULACAO_SIZE) {
        // Selecionar dois pais aleatórios da elite
        const pai1 = elite[Math.floor(Math.random() * elite.length)];
        const pai2 = elite[Math.floor(Math.random() * elite.length)];
        
        // Crossover: pegar primeira metade de pai1, resto de pai2
        const pontoCorte = Math.floor(pai1.length / 2);
        const filho: ItemOtimizacao[] = [...pai1.slice(0, pontoCorte)];
        const genesPai2 = pai2.filter(g => !filho.some(f => f.osIdx === g.osIdx));
        filho.push(...genesPai2);
        
        // Mutação: trocar duas posições aleatórias
        if (Math.random() < TAXA_MUTACAO && filho.length >= 2) {
          const idx1 = Math.floor(Math.random() * filho.length);
          const idx2 = Math.floor(Math.random() * filho.length);
          if (idx1 !== idx2) {
            [filho[idx1], filho[idx2]] = [filho[idx2], filho[idx1]];
          }
        }
        
        novaGeracao.push(filho);
      }
      
      populacao = novaGeracao;
    }
    
    // Retornar melhor indivíduo
    const melhor = populacao.reduce((melhor, atual) => {
      const scoreMelhor = avaliarCenario(melhor, baseIdx, inicioJornada, fimJornada).score;
      const scoreAtual = avaliarCenario(atual, baseIdx, inicioJornada, fimJornada).score;
      return scoreAtual > scoreMelhor ? atual : melhor;
    }, populacao[0]);
    
    return melhor;
  };
  
  /**
   * Lin-Kernighan heuristic (mais agressivo que 2-opt)
   */
  const linKernighan = (
    servicos: ItemOtimizacao[],
    baseIdx: number,
    inicioJornada: number,
    fimJornada: number
  ): ItemOtimizacao[] => {
    let melhorRota = [...servicos];
    let melhorScore = avaliarCenario(melhorRota, baseIdx, inicioJornada, fimJornada).score;
    let melhorou = true;
    let iteracoes = 0;
    const MAX_ITERACOES = 15;
    
    const criticas = melhorRota.filter(r => r.temPrazoCritico);
    const naoCriticas = melhorRota.filter(r => !r.temPrazoCritico);
    
    while (melhorou && iteracoes < MAX_ITERACOES && naoCriticas.length >= 3) {
      melhorou = false;
      iteracoes++;
      
      // Tentar múltiplas trocas sequenciais
      for (let i = 0; i < naoCriticas.length - 2; i++) {
        for (let j = i + 1; j < naoCriticas.length - 1; j++) {
          for (let k = j + 1; k < naoCriticas.length; k++) {
            // Tentar diferentes rearranjos de 3 elementos
            const variacoes = [
              [i, j, k],
              [i, k, j],
              [j, i, k],
              [j, k, i],
              [k, i, j],
              [k, j, i]
            ];
            
            for (const ordem of variacoes) {
              const novaRota = [...criticas];
              const novaNaoCriticas = [...naoCriticas];
              const temp = [
                novaNaoCriticas[ordem[0]],
                novaNaoCriticas[ordem[1]],
                novaNaoCriticas[ordem[2]]
              ];
              novaNaoCriticas[ordem[0]] = temp[0];
              novaNaoCriticas[ordem[1]] = temp[1];
              novaNaoCriticas[ordem[2]] = temp[2];
              novaRota.push(...novaNaoCriticas);
              
              const scoreNovo = avaliarCenario(novaRota, baseIdx, inicioJornada, fimJornada).score;
              
              if (scoreNovo > melhorScore) {
                melhorRota = novaRota;
                melhorScore = scoreNovo;
                melhorou = true;
                break;
              }
            }
            if (melhorou) break;
          }
          if (melhorou) break;
        }
        if (melhorou) break;
      }
    }
    
    return melhorRota;
  };
  
  /**
   * Otimiza por ângulo polar (spiral pattern a partir da base)
   */
  const otimizarPorAnguloPolar = (
    servicos: ItemOtimizacao[],
    baseIdx: number
  ): ItemOtimizacao[] => {
    const [baseLat, baseLng] = locations[baseIdx];
    const criticas = servicos.filter(s => s.temPrazoCritico);
    const naoCriticas = servicos.filter(s => !s.temPrazoCritico);
    
    // Calcular ângulo polar de cada OS em relação à base
    const comAngulo = naoCriticas.map(item => {
      const [lat, lng] = locations[item.osIdx];
      const dLat = lat - baseLat;
      const dLng = lng - baseLng;
      const angulo = Math.atan2(dLat, dLng);
      const distancia = getDistanciaKm(baseIdx, item.osIdx);
      return { item, angulo, distancia };
    });
    
    // Ordenar por ângulo, depois por distância
    comAngulo.sort((a, b) => {
      if (Math.abs(a.angulo - b.angulo) < 0.1) {
        return a.distancia - b.distancia;
      }
      return a.angulo - b.angulo;
    });
    
    return [...criticas, ...comAngulo.map(c => c.item)];
  };
  
  /**
   * Otimiza por densidade geográfica (agrupa áreas densas)
   */
  const otimizarPorDensidade = (
    servicos: ItemOtimizacao[],
    baseIdx: number
  ): ItemOtimizacao[] => {
    const criticas = servicos.filter(s => s.temPrazoCritico);
    const naoCriticas = servicos.filter(s => !s.temPrazoCritico);
    
    // Calcular densidade ao redor de cada OS
    const comDensidade = naoCriticas.map(item => {
      let densidade = 0;
      for (const outro of naoCriticas) {
        if (item.osIdx !== outro.osIdx) {
          const dist = getDistanciaKm(item.osIdx, outro.osIdx);
          if (dist < 2) { // Raio de 2km
            densidade += 1 / (dist + 0.1);
          }
        }
      }
      return { item, densidade };
    });
    
    // Ordenar por densidade (mais densas primeiro)
    comDensidade.sort((a, b) => b.densidade - a.densidade);
    
    // Construir rota começando pelas mais densas e otimizando geograficamente dentro de cada grupo
    const resultado: ItemOtimizacao[] = [...criticas];
    let ultimaLocIdx = baseIdx;
    
    for (const { item } of comDensidade) {
      resultado.push(item);
      ultimaLocIdx = item.osIdx;
    }
    
    return resultado;
  };
  
  /**
   * Nearest insertion heuristic
   */
  const nearestInsertion = (
    servicos: ItemOtimizacao[],
    baseIdx: number
  ): ItemOtimizacao[] => {
    const criticas = servicos.filter(s => s.temPrazoCritico);
    const naoCriticas = servicos.filter(s => !s.temPrazoCritico);
    
    if (naoCriticas.length === 0) return criticas;
    
    const rota: ItemOtimizacao[] = [...criticas];
    const naoInseridas = [...naoCriticas];
    
    // Começar com a mais próxima da base
    let maisProxima = naoInseridas[0];
    let menorDist = Infinity;
    for (const item of naoInseridas) {
      const dist = getDistanciaKm(baseIdx, item.osIdx);
      if (dist < menorDist) {
        menorDist = dist;
        maisProxima = item;
      }
    }
    rota.push(maisProxima);
    naoInseridas.splice(naoInseridas.indexOf(maisProxima), 1);
    
    // Inserir restantes na melhor posição
    while (naoInseridas.length > 0) {
      let melhorItem: ItemOtimizacao | null = null;
      let melhorPos = -1;
      let menorCusto = Infinity;
      
      for (const item of naoInseridas) {
        for (let pos = 0; pos <= rota.length; pos++) {
          let custo = 0;
          if (pos === 0) {
            custo = getDistanciaKm(baseIdx, item.osIdx);
            if (rota.length > 0) {
              custo += getDistanciaKm(item.osIdx, rota[0].osIdx);
              custo -= getDistanciaKm(baseIdx, rota[0].osIdx);
            }
          } else if (pos === rota.length) {
            custo = getDistanciaKm(rota[rota.length - 1].osIdx, item.osIdx);
          } else {
            const antes = rota[pos - 1];
            const depois = rota[pos];
            custo = getDistanciaKm(antes.osIdx, item.osIdx) + getDistanciaKm(item.osIdx, depois.osIdx);
            custo -= getDistanciaKm(antes.osIdx, depois.osIdx);
          }
          
          if (custo < menorCusto) {
            menorCusto = custo;
            melhorItem = item;
            melhorPos = pos;
          }
        }
      }
      
      if (melhorItem && melhorPos >= 0) {
        rota.splice(melhorPos, 0, melhorItem);
        naoInseridas.splice(naoInseridas.indexOf(melhorItem), 1);
      } else {
        break;
      }
    }
    
    return rota;
  };
  
  /**
   * Farthest insertion heuristic (explora extremos primeiro)
   */
  const farthestInsertion = (
    servicos: ItemOtimizacao[],
    baseIdx: number
  ): ItemOtimizacao[] => {
    const criticas = servicos.filter(s => s.temPrazoCritico);
    const naoCriticas = servicos.filter(s => !s.temPrazoCritico);
    
    if (naoCriticas.length === 0) return criticas;
    
    const rota: ItemOtimizacao[] = [...criticas];
    const naoInseridas = [...naoCriticas];
    
    // Começar com a mais distante da base
    let maisDistante = naoInseridas[0];
    let maiorDist = 0;
    for (const item of naoInseridas) {
      const dist = getDistanciaKm(baseIdx, item.osIdx);
      if (dist > maiorDist) {
        maiorDist = dist;
        maisDistante = item;
      }
    }
    rota.push(maisDistante);
    naoInseridas.splice(naoInseridas.indexOf(maisDistante), 1);
    
    // Inserir restantes na melhor posição (mesmo algoritmo de nearest insertion)
    while (naoInseridas.length > 0) {
      let melhorItem: ItemOtimizacao | null = null;
      let melhorPos = -1;
      let menorCusto = Infinity;
      
      for (const item of naoInseridas) {
        for (let pos = 0; pos <= rota.length; pos++) {
          let custo = 0;
          if (pos === 0) {
            custo = getDistanciaKm(baseIdx, item.osIdx);
            if (rota.length > 0) {
              custo += getDistanciaKm(item.osIdx, rota[0].osIdx);
              custo -= getDistanciaKm(baseIdx, rota[0].osIdx);
            }
          } else if (pos === rota.length) {
            custo = getDistanciaKm(rota[rota.length - 1].osIdx, item.osIdx);
          } else {
            const antes = rota[pos - 1];
            const depois = rota[pos];
            custo = getDistanciaKm(antes.osIdx, item.osIdx) + getDistanciaKm(item.osIdx, depois.osIdx);
            custo -= getDistanciaKm(antes.osIdx, depois.osIdx);
          }
          
          if (custo < menorCusto) {
            menorCusto = custo;
            melhorItem = item;
            melhorPos = pos;
          }
        }
      }
      
      if (melhorItem && melhorPos >= 0) {
        rota.splice(melhorPos, 0, melhorItem);
        naoInseridas.splice(naoInseridas.indexOf(melhorItem), 1);
      } else {
        break;
      }
    }
    
    return rota;
  };
  
  /**
   * Otimiza por tempo de execução (menores primeiro)
   */
  const otimizarPorTempoExecucao = (
    servicos: ItemOtimizacao[],
    baseIdx: number
  ): ItemOtimizacao[] => {
    const criticas = servicos.filter(s => s.temPrazoCritico);
    const naoCriticas = servicos.filter(s => !s.temPrazoCritico);
    
    // Ordenar por tempo de execução (menores primeiro)
    naoCriticas.sort((a, b) => {
      const tempoA = a.servico.ordemServico?.tempoExecucao || 0;
      const tempoB = b.servico.ordemServico?.tempoExecucao || 0;
      return tempoA - tempoB;
    });
    
    return [...criticas, ...naoCriticas];
  };
  
  /**
   * Otimização híbrida: combina múltiplas estratégias
   */
  const otimizacaoHibrida = (
    servicos: ItemOtimizacao[],
    baseIdx: number,
    inicioJornada: number,
    fimJornada: number
  ): ItemOtimizacao[] => {
    // Começar com nearest neighbor
    let melhor = otimizarComNearestNeighbor(servicos, baseIdx, true);
    
    // Aplicar 2-opt
    melhor = aplicar2OptMelhorado(melhor, baseIdx);
    
    // Aplicar simulated annealing
    melhor = simulatedAnnealing(melhor, baseIdx, inicioJornada, fimJornada, 30, 0.8);
    
    // Aplicar 3-opt
    melhor = aplicar3Opt(melhor, baseIdx);
    
    return melhor;
  };
  
  /**
   * Calcula distância total de uma rota
   */
  const calcularDistanciaTotal = (
    rota: ItemOtimizacao[],
    baseIdx: number
  ): number => {
    if (rota.length === 0) return 0;
    
    let distancia = 0;
    let ultimaIdx = baseIdx;
    
    for (const item of rota) {
      distancia += getDistanciaKm(ultimaIdx, item.osIdx);
      ultimaIdx = item.osIdx;
    }
    
    return distancia;
  };
  
  // Otimizar cada rota
  for (const rota of rotas) {
    const servicosCount = rota.servicos.filter(s => s.tipo === "SERVICO").length;
    if (servicosCount > 2) {
      otimizarOrdemGeografica(rota);
    }
  }

  // Reordenar índices
  for (const rota of rotas) {
    let ordem = 1;
    for (const servico of rota.servicos) {
      if (servico.tipo === "SERVICO") {
        servico.ordemNaRota = ordem++;
      }
    }
  }

  // ============================================================================
  // RESULTADO FINAL
  // ============================================================================
  
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] ════════════════════════════════════════════════════════`);
  console.log(`[ROUTING] ═══ RESULTADO V17 ═══`);
  console.log(`[ROUTING] ════════════════════════════════════════════════════════`);
  console.log(`[ROUTING] Modo: ${usarTerritorios ? 'TERRITÓRIOS' : 'ZONAS AUTOMÁTICAS'}`);
  
  for (const rota of rotas) {
    const servicosCount = rota.servicos.filter(s => s.tipo === "SERVICO").length;
    const infoZona = usarTerritorios 
      ? (rota.territorioId ? `território` : 'sem território')
      : (rota.zonaId !== undefined && rota.zonaId >= 0 ? `zona ${rota.zonaId}` : 'backup');
    
    const bairrosAtendidos = new Set<string>();
    for (const s of rota.servicos) {
      if (s.ordemServico) {
        bairrosAtendidos.add(extrairBairro(s.ordemServico.endereco));
      }
    }
    
    console.log(`[ROUTING] ${rota.equipe.codigo} (${infoZona}): ${servicosCount} OSs, ${rota.distanciaTotal.toFixed(1)}km, ${rota.progresso.toFixed(0)}%`);
    console.log(`[ROUTING]   Bairros: ${[...bairrosAtendidos].slice(0, 5).join(', ')}`);
  }
  
  const reguladasNaoAlocadas = naoAlocadas.filter(na => ehReguladaUrgente(na.os));
  
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] Não alocadas: ${naoAlocadas.length}`);
  if (reguladasNaoAlocadas.length > 0) {
    console.log(`[ROUTING] ⚠️ REGULADAS HOJE NÃO ALOCADAS: ${reguladasNaoAlocadas.length}`);
    for (const na of reguladasNaoAlocadas) {
      console.log(`[ROUTING]   - ${na.os.numero}: ${na.motivo}`);
    }
  } else if (osReguladasHoje.length > 0) {
    console.log(`[ROUTING] ✅ TODAS AS REGULADAS HOJE FORAM ALOCADAS!`);
  }
  
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] 📊 SUGESTÃO DE EQUIPES:`);
  console.log(`[ROUTING]   Para reguladas: ${sugestaoEquipes.equipesParaReguladas} equipes (${sugestaoEquipes.totalReguladasHoje} OSs)`);
  console.log(`[ROUTING]   Para todas OSs: ${sugestaoEquipes.equipesParaTodasOSs} equipes (${sugestaoEquipes.totalOSs} OSs)`);
  
  // V21: Resumo de erros por território
  if (naoAlocadas.length > 0 && usarTerritorios && territoriosAtivos.length > 0) {
    console.log(`[ROUTING]`);
    console.log(`[ROUTING] ⚠️ RESUMO DE ERROS POR TERRITÓRIO:`);
    
    const errosPorTerritorio = new Map<string, { total: number; porMotivo: Map<string, number> }>();
    
    for (const na of naoAlocadas) {
      const territorioId = osParaTerritorio.get(na.os.id) || 'FORA_TERRITORIOS';
      if (!errosPorTerritorio.has(territorioId)) {
        errosPorTerritorio.set(territorioId, { total: 0, porMotivo: new Map() });
      }
      const dados = errosPorTerritorio.get(territorioId)!;
      dados.total++;
      dados.porMotivo.set(na.motivo, (dados.porMotivo.get(na.motivo) || 0) + 1);
    }
    
    for (const [territorioId, dados] of errosPorTerritorio) {
      const territorioNome = territorioId === 'FORA_TERRITORIOS' 
        ? 'Fora de todos os territórios' 
        : (territoriosAtivos.find(t => t.id === territorioId)?.nome || territorioId);
      console.log(`[ROUTING]   📍 ${territorioNome}: ${dados.total} OSs não alocadas`);
      for (const [motivo, count] of dados.porMotivo) {
        console.log(`[ROUTING]      - ${motivo}: ${count}`);
      }
    }
  }
  
  console.log(`[ROUTING] ════════════════════════════════════════════════════════`);

  // V20: Gerar múltiplas opções de roteiros APENAS se estratégia não foi especificada
  // IMPORTANTE: Se estratégia foi especificada, NÃO gerar múltiplas opções para evitar recursão infinita
  let opcoesRoteiros: OpcaoRoteiro[] | undefined;
  
  if (!estrategia) {
    // Apenas gerar múltiplas opções quando chamado sem estratégia (chamada inicial)
    opcoesRoteiros = await gerarOpcoesRoteiros(
      oss,
      equipesParaRoteirizar,
      usarTerritorios,
      territoriosAtivos,
      osParaTerritorio,
      equipesPorTerritorio,
      equipeEstaNoTerritorioDaOS,
      sugestaoEquipes
    );
  }

  return { 
    rotas: opcoesRoteiros?.[0]?.rotas || rotas, // Por padrão, retorna a primeira opção ou rota atual
    naoAlocadas: opcoesRoteiros?.[0]?.naoAlocadas || naoAlocadas,
    sugestaoEquipes,
    opcoesRoteiros: estrategia ? undefined : opcoesRoteiros // Não retornar opções quando chamado com estratégia
  };
}

// ============================================================================
// V20: GERAÇÃO DE MÚLTIPLAS OPÇÕES DE ROTEIROS
// ============================================================================

/**
 * Calcula métricas de um roteiro
 */
function calcularMetricasRoteiro(
  rotas: RotaEquipe[],
  naoAlocadas: NaoAlocada[],
  osUrgentesTotal: number
): OpcaoRoteiro['metricas'] {
  const totalOSs = rotas.reduce((sum, r) => 
    sum + r.servicos.filter(s => s.tipo === 'SERVICO').length, 0
  );
  
  const totalDistanciaKm = rotas.reduce((sum, r) => sum + r.distanciaTotal, 0);
  
  const totalFaturamento = rotas.reduce((sum, r) => {
    return sum + r.servicos
      .filter(s => s.tipo === 'SERVICO' && s.ordemServico)
      .reduce((soma, s) => soma + (s.ordemServico?.valor || 0), 0);
  }, 0);
  
  const totalTempoMin = rotas.reduce((sum, r) => sum + r.tempoTotal, 0);
  
  // Contar OSs urgentes alocadas
  const osUrgentesAlocadas = rotas.reduce((sum, r) => {
    return sum + r.servicos.filter(s => {
      if (s.tipo !== 'SERVICO' || !s.ordemServico) return false;
      return ehReguladaUrgente(s.ordemServico) || 
             (ehEmergencia(s.ordemServico) && ['hoje', 'passado'].includes(classificarPrazo(s.ordemServico.prazo)));
    }).length;
  }, 0);
  
  const equipesUtilizadas = rotas.filter(r => 
    r.servicos.filter(s => s.tipo === 'SERVICO').length > 0
  ).length;

  return {
    totalOSs,
    totalDistanciaKm,
    totalFaturamento,
    totalTempoMin,
    osUrgentesAlocadas,
    osUrgentesTotal: osUrgentesTotal,
    equipesUtilizadas
  };
}

/**
 * Gera múltiplas opções de roteiros com diferentes estratégias
 */
async function gerarOpcoesRoteiros(
  oss: OrdemServico[],
  equipes: Equipe[],
  usarTerritorios: boolean,
  territoriosAtivos: Territorio[],
  osParaTerritorio: Map<string, string>,
  equipesPorTerritorio: Map<string, string[]>,
  equipeEstaNoTerritorioDaOS: (osId: string, equipeId: string) => boolean,
  sugestaoEquipes: SugestaoEquipes
): Promise<OpcaoRoteiro[]> {
  console.log(`[ROUTING]`);
  console.log(`[ROUTING] ══ V20: Gerando Múltiplas Opções de Roteiros ══`);
  
  const osUrgentesTotal = oss.filter(os => 
    ehReguladaUrgente(os) || 
    (ehEmergencia(os) && ['hoje', 'passado'].includes(classificarPrazo(os.prazo)))
  ).length;
  
  const opcoes: OpcaoRoteiro[] = [];
  
  // Opção 1: Otimizada por Faturamento (prioriza OSs de maior valor)
  console.log(`[ROUTING] Gerando opção 1: Otimizada por Faturamento...`);
  const resultadoFinanceiro = await otimizarRotasInterno(
    oss,
    equipes,
    usarTerritorios,
    territoriosAtivos,
    osParaTerritorio,
    equipesPorTerritorio,
    equipeEstaNoTerritorioDaOS,
    'financeiro'
  );
  const metricasFinanceiro = calcularMetricasRoteiro(
    resultadoFinanceiro.rotas,
    resultadoFinanceiro.naoAlocadas,
    osUrgentesTotal
  );
  opcoes.push({
    id: 'financeiro',
    nome: 'Melhor Faturamento',
    descricao: 'Otimizada para maximizar o faturamento total',
    rotas: resultadoFinanceiro.rotas,
    naoAlocadas: resultadoFinanceiro.naoAlocadas,
    metricas: metricasFinanceiro,
    destacado: true,
    criterioDestaque: 'financeiro'
  });
  
  // Opção 2: Otimizada por Quantidade (prioriza mais OSs alocadas)
  console.log(`[ROUTING] Gerando opção 2: Otimizada por Quantidade...`);
  const resultadoQuantidade = await otimizarRotasInterno(
    oss,
    equipes,
    usarTerritorios,
    territoriosAtivos,
    osParaTerritorio,
    equipesPorTerritorio,
    equipeEstaNoTerritorioDaOS,
    'quantidade'
  );
  const metricasQuantidade = calcularMetricasRoteiro(
    resultadoQuantidade.rotas,
    resultadoQuantidade.naoAlocadas,
    osUrgentesTotal
  );
  opcoes.push({
    id: 'quantidade',
    nome: 'Mais OSs Alocadas',
    descricao: 'Otimizada para alocar o maior número de OSs',
    rotas: resultadoQuantidade.rotas,
    naoAlocadas: resultadoQuantidade.naoAlocadas,
    metricas: metricasQuantidade,
    destacado: true,
    criterioDestaque: 'quantidade'
  });
  
  // Opção 3: Otimizada por Distância (minimiza distância total)
  console.log(`[ROUTING] Gerando opção 3: Otimizada por Distância...`);
  const resultadoDistancia = await otimizarRotasInterno(
    oss,
    equipes,
    usarTerritorios,
    territoriosAtivos,
    osParaTerritorio,
    equipesPorTerritorio,
    equipeEstaNoTerritorioDaOS,
    'distancia'
  );
  const metricasDistancia = calcularMetricasRoteiro(
    resultadoDistancia.rotas,
    resultadoDistancia.naoAlocadas,
    osUrgentesTotal
  );
  opcoes.push({
    id: 'distancia',
    nome: 'Menor Distância',
    descricao: 'Otimizada para minimizar a distância total percorrida',
    rotas: resultadoDistancia.rotas,
    naoAlocadas: resultadoDistancia.naoAlocadas,
    metricas: metricasDistancia,
    destacado: true,
    criterioDestaque: 'distancia'
  });
  
  // V19.6: Identificar qual é REALMENTE melhor em cada critério (não necessariamente a opção com esse nome)
  const melhorFinanceiro = opcoes.reduce((melhor, atual) => 
    atual.metricas.totalFaturamento > melhor.metricas.totalFaturamento ? atual : melhor
  );
  const melhorQuantidade = opcoes.reduce((melhor, atual) => 
    atual.metricas.totalOSs > melhor.metricas.totalOSs ? atual : melhor
  );
  const melhorDistancia = opcoes.reduce((melhor, atual) => 
    atual.metricas.totalDistanciaKm < melhor.metricas.totalDistanciaKm ? atual : melhor
  );
  
  // V19.6: Limpar destaques anteriores e atribuir corretamente
  opcoes.forEach(opcao => {
    opcao.destacado = false;
    opcao.criterioDestaque = undefined;
  });
  
  // Atribuir destaque ao que REALMENTE é melhor em cada critério
  melhorFinanceiro.destacado = true;
  melhorFinanceiro.criterioDestaque = 'financeiro';
  
  if (melhorQuantidade.id !== melhorFinanceiro.id) {
    melhorQuantidade.destacado = true;
    melhorQuantidade.criterioDestaque = 'quantidade';
  }
  
  if (melhorDistancia.id !== melhorFinanceiro.id && melhorDistancia.id !== melhorQuantidade.id) {
    melhorDistancia.destacado = true;
    melhorDistancia.criterioDestaque = 'distancia';
  }
  
  console.log(`[ROUTING] ✅ ${opcoes.length} opções geradas`);
  console.log(`[ROUTING]   Opção 'financeiro': R$ ${opcoes.find(o => o.id === 'financeiro')?.metricas.totalFaturamento.toFixed(2)}, ${opcoes.find(o => o.id === 'financeiro')?.metricas.totalOSs} OSs, ${opcoes.find(o => o.id === 'financeiro')?.metricas.totalDistanciaKm.toFixed(1)}km`);
  console.log(`[ROUTING]   Opção 'quantidade': R$ ${opcoes.find(o => o.id === 'quantidade')?.metricas.totalFaturamento.toFixed(2)}, ${opcoes.find(o => o.id === 'quantidade')?.metricas.totalOSs} OSs, ${opcoes.find(o => o.id === 'quantidade')?.metricas.totalDistanciaKm.toFixed(1)}km`);
  console.log(`[ROUTING]   Opção 'distancia': R$ ${opcoes.find(o => o.id === 'distancia')?.metricas.totalFaturamento.toFixed(2)}, ${opcoes.find(o => o.id === 'distancia')?.metricas.totalOSs} OSs, ${opcoes.find(o => o.id === 'distancia')?.metricas.totalDistanciaKm.toFixed(1)}km`);
  console.log(`[ROUTING]   🏆 Melhor Faturamento: ${melhorFinanceiro.id} (R$ ${melhorFinanceiro.metricas.totalFaturamento.toFixed(2)})`);
  console.log(`[ROUTING]   🏆 Mais OSs: ${melhorQuantidade.id} (${melhorQuantidade.metricas.totalOSs} OSs)`);
  console.log(`[ROUTING]   🏆 Menor Distância: ${melhorDistancia.id} (${melhorDistancia.metricas.totalDistanciaKm.toFixed(1)}km)`);
  
  return opcoes;
}

/**
 * Função interna de otimização com estratégia específica
 * V19.6: Corrigido para aplicar ordenação ANTES de chamar otimizarRotas
 * e usar OSs ordenadas corretamente
 */
async function otimizarRotasInterno(
  ordensServico: OrdemServico[],
  equipes: Equipe[],
  usarTerritorios: boolean,
  territoriosAtivos: Territorio[],
  osParaTerritorio: Map<string, string>,
  equipesPorTerritorio: Map<string, string[]>,
  equipeEstaNoTerritorioDaOS: (osId: string, equipeId: string) => boolean,
  estrategia: 'financeiro' | 'quantidade' | 'distancia'
): Promise<{ rotas: RotaEquipe[]; naoAlocadas: NaoAlocada[] }> {
  console.log(`[ROUTING]   Estratégia: ${estrategia}`);
  
  // Criar uma cópia profunda das OSs para ordenar conforme a estratégia
  const ossOrdenadas = [...ordensServico];
  
  // Sempre manter urgentes no topo, independente da estratégia
  const separarUrgentes = (oss: OrdemServico[]) => {
    const urgentes: OrdemServico[] = [];
    const naoUrgentes: OrdemServico[] = [];
    
    for (const os of oss) {
      const urgente = ehReguladaUrgente(os) || 
        (ehEmergencia(os) && ['hoje', 'passado'].includes(classificarPrazo(os.prazo)));
      if (urgente) {
        urgentes.push(os);
      } else {
        naoUrgentes.push(os);
      }
    }
    
    return { urgentes, naoUrgentes };
  };
  
  const { urgentes, naoUrgentes } = separarUrgentes(ossOrdenadas);
  
  // V19.6: Ordenar não-urgentes conforme a estratégia de forma mais agressiva
  if (estrategia === 'financeiro') {
    // Ordenar por valor (maior primeiro) - prioriza OSs de maior valor
    // Também considera tempo de execução para maximizar valor/hora
    naoUrgentes.sort((a, b) => {
      const valorHoraA = (a.valor || 0) / Math.max(a.tempoExecucao || 15, 1);
      const valorHoraB = (b.valor || 0) / Math.max(b.tempoExecucao || 15, 1);
      // Primeiro por valor/hora (maior primeiro), depois por valor absoluto
      if (Math.abs(valorHoraA - valorHoraB) > 0.1) {
        return valorHoraB - valorHoraA;
      }
      return (b.valor || 0) - (a.valor || 0);
    });
    console.log(`[ROUTING]   OSs ordenadas por valor/hora (maior primeiro)`);
  } else if (estrategia === 'quantidade') {
    // Ordenar por tempo de execução (menor primeiro) para caber mais OSs na jornada
    // Também considera distância implicitamente (OSs rápidas = mais OSs)
    naoUrgentes.sort((a, b) => {
      const tempoA = a.tempoExecucao || 15;
      const tempoB = b.tempoExecucao || 15;
      return tempoA - tempoB;
    });
    console.log(`[ROUTING]   OSs ordenadas por tempo de execução (menor primeiro)`);
  } else if (estrategia === 'distancia') {
    // Para distância, a ordenação será feita geograficamente durante a alocação
    // Aqui apenas garantimos que OSs próximas umas das outras fiquem juntas
    // Não alteramos a ordem aqui - a otimização geográfica faz isso
    console.log(`[ROUTING]   OSs mantidas para otimização geográfica`);
  }
  
  // V19.6: Recombinar urgentes + não-urgentes ordenadas
  const ossParaOtimizar = [...urgentes, ...naoUrgentes];
  
  // Chamar otimizarRotas com a estratégia específica
  const territoriosSelecionadosIds = territoriosAtivos.map(t => t.id);
  
  const resultado = await otimizarRotas(
    ossParaOtimizar, // V19.6: Usar OSs ordenadas!
    equipes,
    usarTerritorios,
    territoriosSelecionadosIds.length > 0 ? territoriosSelecionadosIds : undefined,
    estrategia // Passar estratégia para aplicar ordenação adicional internamente
  );
  
  console.log(`[ROUTING]   Resultado ${estrategia}: ${resultado.rotas.reduce((sum, r) => sum + r.servicos.filter(s => s.tipo === 'SERVICO').length, 0)} OSs, R$ ${resultado.rotas.reduce((sum, r) => sum + r.faturamentoTotal, 0).toFixed(2)}, ${resultado.rotas.reduce((sum, r) => sum + r.distanciaTotal, 0).toFixed(1)}km`);
  
  return {
    rotas: resultado.rotas,
    naoAlocadas: resultado.naoAlocadas
  };
}

// ============================================================================
// FUNÇÕES AUXILIARES EXPORTADAS
// ============================================================================

export function formatarTempo(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function formatarData(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export interface InconformidadeRota {
  tipo: 'horas_excedidas' | 'urgente_fora_prazo';
  mensagem: string;
  osNumero?: string;
  detalhes?: string;
}

export interface ResultadoRecalculo {
  rota: RotaEquipe;
  inconformidades: InconformidadeRota[];
}

/**
 * Recalcula uma rota manualmente editada, atualizando tempos, distâncias e horários
 * Retorna a rota recalculada e lista de inconformidades encontradas
 */
export function recalcularRota(rota: RotaEquipe): ResultadoRecalculo {
  // Criar cópia da rota
  const rotaRecalculada: RotaEquipe = {
    ...rota,
    servicos: rota.servicos.map(s => ({ ...s })),
    tempoTotal: 0,
    distanciaTotal: 0,
    faturamentoTotal: 0,
    progresso: 0
  };

  const inconformidades: InconformidadeRota[] = [];

  // Obter local de partida da equipe
  const localPartida = obterLocalPartida(rota.equipe);
  let ultimaLat = localPartida.lat;
  let ultimaLng = localPartida.lng;
  
  // Iniciar tempo a partir da hora de início da equipe
  let tempoAtual = horaParaMinutos(rota.equipe.horaInicio);
  
  // Atualizar ordemNaRota para serviços válidos
  let ordemAtual = 1;
  
  // Calcular jornada máxima
  const inicioJornada = horaParaMinutos(rota.equipe.horaInicio);
  const duracaoJornada = (rota.equipe.maxHorasTrabalho || rota.equipe.jornadaHoras || 10) * 60;
  const fimJornada = inicioJornada + duracaoJornada;
  
  // Obter configuração de almoço da equipe
  const configAlmocoRecalc = obterConfigAlmoco(rota.equipe);
  
  // Recalcular cada serviço na sequência
  for (const servico of rotaRecalculada.servicos) {
    if (servico.tipo === "ALMOCO") {
      // Almoço: usar duração configurada da equipe
      // O almoço deve começar no mínimo às config.inicio (ex: 12:00)
      servico.tempoDeslocamento = 0;
      servico.distancia = 0;
      const inicioAlmoco = Math.max(tempoAtual, configAlmocoRecalc.inicio);
      servico.horaInicio = minutosParaHora(inicioAlmoco);
      tempoAtual = inicioAlmoco + configAlmocoRecalc.duracao; // usar duração configurada da equipe
      servico.tempoTotal = tempoAtual;
      servico.horaFim = minutosParaHora(tempoAtual);
      servico.eta = servico.horaInicio;
    } else if (servico.ordemServico) {
      // Serviço: calcular deslocamento e horários
      const os = servico.ordemServico;
      
      // Calcular distância do ponto anterior até esta OS
      const distanciaKm = calcularDistancia(ultimaLat, ultimaLng, os.latitude, os.longitude);
      const tempoDeslocamento = calcularTempoDeslocamento(distanciaKm);
      
      servico.tempoDeslocamento = tempoDeslocamento;
      servico.distancia = distanciaKm;
      servico.ordemNaRota = ordemAtual++;
      
      // Atualizar tempo atual com deslocamento
      tempoAtual += tempoDeslocamento;
      servico.horaInicio = minutosParaHora(tempoAtual);
      servico.eta = servico.horaInicio;
      
      // Verificar se urgente está fora do prazo
      if (os.prazo && os.regulada) {
        const agora = new Date();
        const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
        const prazoDia = new Date(os.prazo.getFullYear(), os.prazo.getMonth(), os.prazo.getDate());
        
        // Calcular diferença em dias
        const diffDias = Math.floor((prazoDia.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        // Se o prazo é hoje, verificar horário
        if (diffDias === 0) {
          const prazoMin = os.prazo.getHours() * 60 + os.prazo.getMinutes();
          // tempoAtual está em minutos desde o início da jornada da equipe
          // Precisamos converter para minutos desde meia-noite
          const horaInicioEquipe = horaParaMinutos(rota.equipe.horaInicio);
          const minutosDesdeMeiaNoite = horaInicioEquipe + (tempoAtual - horaInicioEquipe);
          
          // Se já passou do horário do prazo hoje
          if (minutosDesdeMeiaNoite > prazoMin) {
            const atrasoMinutos = minutosDesdeMeiaNoite - prazoMin;
            inconformidades.push({
              tipo: 'urgente_fora_prazo',
              mensagem: `OS ${os.numero} urgente será atendida fora do prazo`,
              osNumero: os.numero,
              detalhes: `Atraso de ${atrasoMinutos} minutos`
            });
          }
        } else if (diffDias < 0) {
          // Prazo já passou (dia anterior)
          const prazoMin = os.prazo.getHours() * 60 + os.prazo.getMinutes();
          const horaInicioEquipe = horaParaMinutos(rota.equipe.horaInicio);
          const minutosDesdeMeiaNoite = horaInicioEquipe + (tempoAtual - horaInicioEquipe);
          const atrasoMinutos = (Math.abs(diffDias) * 24 * 60) + (minutosDesdeMeiaNoite - prazoMin);
          inconformidades.push({
            tipo: 'urgente_fora_prazo',
            mensagem: `OS ${os.numero} urgente será atendida fora do prazo`,
            osNumero: os.numero,
            detalhes: `Atraso de ${atrasoMinutos} minutos`
          });
        }
        // Se diffDias > 0, o prazo é no futuro, não há problema
      }
      
      // Adicionar tempo de execução
      tempoAtual += os.tempoExecucao || 30;
      servico.tempoTotal = tempoAtual;
      servico.horaFim = minutosParaHora(tempoAtual);
      
      // Atualizar totais
      rotaRecalculada.distanciaTotal += distanciaKm;
      rotaRecalculada.faturamentoTotal += os.valor || 0;
      
      // Atualizar última localização
      ultimaLat = os.latitude;
      ultimaLng = os.longitude;
    }
  }
  
  // Calcular tempo total de trabalho (tempoAtual - inicioJornada)
  const tempoTrabalho = tempoAtual - inicioJornada;
  rotaRecalculada.tempoTotal = tempoTrabalho;
  
  // Verificar se ultrapassou horas máximas
  if (tempoAtual > fimJornada) {
    const horasExcedidas = ((tempoAtual - fimJornada) / 60).toFixed(1);
    inconformidades.push({
      tipo: 'horas_excedidas',
      mensagem: `Jornada máxima ultrapassada em ${horasExcedidas} horas`,
      detalhes: `Tempo total: ${minutosParaHora(tempoAtual)}, Máximo: ${minutosParaHora(fimJornada)}`
    });
  }
  
  // Calcular progresso
  rotaRecalculada.progresso = (tempoTrabalho / duracaoJornada) * 100;
  
  return {
    rota: rotaRecalculada,
    inconformidades
  };
}