import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OpcaoRoteiro, formatarTempo } from "@/lib/routingUtils";
import { DollarSign, Package, Car, CheckCircle2, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelecaoOpcoesRoteiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opcoes: OpcaoRoteiro[];
  opcaoSelecionada: string | null;
  selecaoIndividualEquipes: Map<string, string>; // Mantido para compatibilidade, mas não usado mais
  onSelecionarOpcao: (opcaoId: string) => void;
  onSelecionarOpcaoEquipe: (equipeId: string, opcaoId: string) => void; // Mantido para compatibilidade
}

export default function SelecaoOpcoesRoteiroDialog({
  open,
  onOpenChange,
  opcoes,
  opcaoSelecionada,
  selecaoIndividualEquipes,
  onSelecionarOpcao,
  onSelecionarOpcaoEquipe,
}: SelecaoOpcoesRoteiroDialogProps) {
  const handleSelecionar = (opcaoId: string) => {
    onSelecionarOpcao(opcaoId);
    onOpenChange(false);
  };
  
  // Calcular ranking por métrica individual
  const calcularRankingMetrica = (getValue: (opcao: OpcaoRoteiro) => number, maiorMelhor: boolean = true) => {
    if (opcoes.length !== 3) return {};
    
    const valores = opcoes.map(opcao => ({ opcaoId: opcao.id, valor: getValue(opcao) }));
    
    // Ordenar por valor
    valores.sort((a, b) => maiorMelhor ? b.valor - a.valor : a.valor - b.valor);
    
    const ranking: Record<string, 'verde' | 'amarelo' | 'vermelho'> = {};
    ranking[valores[0].opcaoId] = 'verde'; // Melhor
    ranking[valores[1].opcaoId] = 'amarelo'; // Médio
    ranking[valores[2].opcaoId] = 'vermelho'; // Pior
    
    return ranking;
  };
  
  // Rankings por métrica
  const rankingOSs = calcularRankingMetrica(o => o.metricas.totalOSs, true);
  const rankingFaturamento = calcularRankingMetrica(o => o.metricas.totalFaturamento, true);
  const rankingDistancia = calcularRankingMetrica(o => o.metricas.totalDistanciaKm, false); // Menor é melhor
  const rankingUrgentes = calcularRankingMetrica(o => o.metricas.osUrgentesAlocadas, true);
  const rankingTempo = calcularRankingMetrica(o => o.metricas.totalTempoMin, false); // Menor é melhor
  
  // Coletar todas as equipes únicas de todas as opções
  const todasEquipes = new Map<string, { codigo: string; nome: string }>();
  opcoes.forEach(opcao => {
    opcao.rotas.forEach(rota => {
      if (!todasEquipes.has(rota.equipe.id)) {
        todasEquipes.set(rota.equipe.id, {
          codigo: rota.equipe.codigo,
          nome: rota.equipe.nome || rota.equipe.tecnico
        });
      }
    });
  });
  
  // Calcular métricas por equipe em cada opção
  const calcularMetricasEquipe = (equipeId: string, opcaoId: string) => {
    const opcao = opcoes.find(o => o.id === opcaoId);
    if (!opcao) return null;
    
    const rota = opcao.rotas.find(r => r.equipe.id === equipeId);
    if (!rota) return null;
    
    const osCount = rota.servicos.filter(s => s.tipo === 'SERVICO').length;
    const faturamento = rota.servicos
      .filter(s => s.tipo === 'SERVICO' && s.ordemServico)
      .reduce((sum, s) => sum + (s.ordemServico?.valor || 0), 0);
    const distancia = rota.distanciaTotal;
    
    return { osCount, faturamento, distancia };
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  const formatarDistancia = (km: number) => {
    return `${km.toFixed(1)} km`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto z-[1002]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Escolha uma Opção de Roteiro
          </DialogTitle>
          <DialogDescription>
            Três opções de roteiros foram geradas, cada uma otimizada para um critério diferente.
            Todas garantem que as OSs urgentes sejam executadas no prazo.
          </DialogDescription>
        </DialogHeader>

        {/* Modo Global: Seleção única para todos os territórios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {opcoes.map((opcao) => {
              const isSelecionada = opcaoSelecionada === opcao.id;
              const isDestaque = opcao.destacado;

              return (
                <div
                  key={opcao.id}
                  className={cn(
                    "border-2 rounded-lg p-4 transition-all cursor-pointer hover:shadow-lg",
                    isSelecionada
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                    isDestaque && "ring-2 ring-primary/20"
                  )}
                  onClick={() => handleSelecionar(opcao.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{opcao.nome}</h3>
                        {isDestaque && (
                          <Badge variant="default" className="text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Melhor em {opcao.criterioDestaque === 'financeiro' ? 'Faturamento' : opcao.criterioDestaque === 'quantidade' ? 'Quantidade' : 'Distância'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {opcao.descricao}
                      </p>
                    </div>
                    {isSelecionada && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">OSs Alocadas:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rankingOSs[opcao.id] && (
                          <div className={cn(
                            "h-3 w-3 rounded-full flex-shrink-0",
                            rankingOSs[opcao.id] === 'verde' && "bg-green-500",
                            rankingOSs[opcao.id] === 'amarelo' && "bg-yellow-500",
                            rankingOSs[opcao.id] === 'vermelho' && "bg-red-500"
                          )} title="Ranking: OSs Alocadas" />
                        )}
                        <span className="font-semibold">{opcao.metricas.totalOSs}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Faturamento:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rankingFaturamento[opcao.id] && (
                          <div className={cn(
                            "h-3 w-3 rounded-full flex-shrink-0",
                            rankingFaturamento[opcao.id] === 'verde' && "bg-green-500",
                            rankingFaturamento[opcao.id] === 'amarelo' && "bg-yellow-500",
                            rankingFaturamento[opcao.id] === 'vermelho' && "bg-red-500"
                          )} title="Ranking: Faturamento" />
                        )}
                        <span className="font-semibold">
                          {formatarMoeda(opcao.metricas.totalFaturamento)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Distância Total:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rankingDistancia[opcao.id] && (
                          <div className={cn(
                            "h-3 w-3 rounded-full flex-shrink-0",
                            rankingDistancia[opcao.id] === 'verde' && "bg-green-500",
                            rankingDistancia[opcao.id] === 'amarelo' && "bg-yellow-500",
                            rankingDistancia[opcao.id] === 'vermelho' && "bg-red-500"
                          )} title="Ranking: Distância (menor é melhor)" />
                        )}
                        <span className="font-semibold">
                          {formatarDistancia(opcao.metricas.totalDistanciaKm)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-muted-foreground">Urgentes Alocadas:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rankingUrgentes[opcao.id] && (
                          <div className={cn(
                            "h-3 w-3 rounded-full flex-shrink-0",
                            rankingUrgentes[opcao.id] === 'verde' && "bg-green-500",
                            rankingUrgentes[opcao.id] === 'amarelo' && "bg-yellow-500",
                            rankingUrgentes[opcao.id] === 'vermelho' && "bg-red-500"
                          )} title="Ranking: Urgentes Alocadas" />
                        )}
                        <span className="font-semibold text-green-600">
                          {opcao.metricas.osUrgentesAlocadas}/{opcao.metricas.osUrgentesTotal}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Tempo Total:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rankingTempo[opcao.id] && (
                          <div className={cn(
                            "h-3 w-3 rounded-full flex-shrink-0",
                            rankingTempo[opcao.id] === 'verde' && "bg-green-500",
                            rankingTempo[opcao.id] === 'amarelo' && "bg-yellow-500",
                            rankingTempo[opcao.id] === 'vermelho' && "bg-red-500"
                          )} title="Ranking: Tempo (menor é melhor)" />
                        )}
                        <span className="font-semibold">{formatarTempo(opcao.metricas.totalTempoMin)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Equipes Utilizadas:</span>
                      <span className="font-semibold">{opcao.metricas.equipesUtilizadas}</span>
                    </div>

                    {opcao.naoAlocadas.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <span className="text-xs text-muted-foreground">
                          {opcao.naoAlocadas.length} OS(s) não alocada(s)
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    className={cn(
                      "w-full mt-4",
                      isSelecionada && "bg-primary"
                    )}
                    variant={isSelecionada ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelecionar(opcao.id);
                    }}
                  >
                    {isSelecionada ? "Selecionada" : "Selecionar"}
                  </Button>
                </div>
              );
            })}
          </div>

        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Todas as opções garantem que as OSs urgentes sejam executadas no prazo.
            Escolha a opção que melhor atende às suas necessidades. Você pode alterar cenários por território na seção "Cenários por Território" após fechar este dialog.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
