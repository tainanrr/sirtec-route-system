import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExpectativaTerritorio, SugestaoUniaoTerritorio, sugerirUniaoTerritorios } from "@/lib/routingUtils";
import { AlertCircle, Users, Zap, Clock, Merge, MapPin } from "lucide-react";
import { formatarTempo } from "@/lib/routingUtils";
import { Territorio } from "@/types/territorios";
import { Equipe } from "@/data/mockData";

interface ExpectativaEquipesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectativas: ExpectativaTerritorio[];
  territorios?: Territorio[];
  equipes?: Equipe[];
}

export default function ExpectativaEquipesDialog({
  open,
  onOpenChange,
  expectativas,
  territorios = [],
}: ExpectativaEquipesDialogProps) {
  // Calcular totais gerais
  const totalTerritorios = expectativas.length;
  const totalOSs = expectativas.reduce((acc, e) => acc + e.totalOSs, 0);
  const totalUrgentes = expectativas.reduce((acc, e) => acc + e.totalUrgentes, 0);
  const totalEquipesUrgentes = expectativas.reduce((acc, e) => acc + e.equipesNecessariasUrgentes, 0);
  const totalEquipesTotal = expectativas.reduce((acc, e) => acc + e.equipesNecessariasTotal, 0);
  
  // Formatar valores com uma casa decimal
  const formatarEquipes = (valor: number): string => {
    return valor.toFixed(1).replace('.', ',');
  };
  
  // Calcular sugestões de união de territórios
  const sugestoesUniao = territorios.length > 0 
    ? sugerirUniaoTerritorios(expectativas, territorios, 15, 0.8)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto z-[1000]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Expectativa de Equipes por Região
          </DialogTitle>
          <DialogDescription>
            Análise da quantidade de equipes necessárias para atender cada região marcada.
            Os cálculos consideram apenas territórios ativos com equipe atribuída.
          </DialogDescription>
        </DialogHeader>

        {expectativas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">
              Nenhum território ativo encontrado
            </p>
            <p className="text-sm text-muted-foreground">
              Certifique-se de que existem territórios cadastrados, ativos e com equipe atribuída.
            </p>
          </div>
        ) : (
          <>
            {/* Resumo Geral */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground mb-1">Territórios</div>
                <div className="text-2xl font-bold text-foreground">{totalTerritorios}</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground mb-1">Total de OSs</div>
                <div className="text-2xl font-bold text-foreground">{totalOSs}</div>
              </div>
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
                <div className="text-sm text-danger mb-1 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  OSs Urgentes
                </div>
                <div className="text-2xl font-bold text-danger">{totalUrgentes}</div>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="text-sm text-primary mb-1 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Equipes Necessárias
                </div>
                <div className="text-2xl font-bold text-primary">{formatarEquipes(totalEquipesTotal)}</div>
              </div>
            </div>

            {/* Tabela de Expectativas */}
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Território</TableHead>
                    <TableHead className="text-center">Equipe Atribuída</TableHead>
                    <TableHead className="text-center">Total OSs</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Zap className="h-4 w-4 text-danger" />
                        <span>OSs Urgentes</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">Equipes para</span>
                        <span className="text-xs font-semibold text-danger">Urgentes</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">Equipes para</span>
                        <span className="text-xs font-semibold">Toda Demanda</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Tempo Total</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expectativas.map((expectativa) => (
                    <TableRow key={expectativa.territorioId}>
                      <TableCell className="font-medium">
                        {expectativa.territorioNome}
                      </TableCell>
                      <TableCell className="text-center">
                        {expectativa.equipeCodigos && expectativa.equipeCodigos.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {expectativa.equipeCodigos.map((codigo, idx) => (
                              <Badge key={idx} variant="secondary">{codigo}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{expectativa.totalOSs}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {expectativa.totalUrgentes > 0 ? (
                          <Badge variant="regulada" className="font-semibold">
                            {expectativa.totalUrgentes}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {expectativa.equipesNecessariasUrgentes > 0 ? (
                          <Badge variant="destructive" className="font-bold">
                            {formatarEquipes(expectativa.equipesNecessariasUrgentes)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0,0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {expectativa.equipesNecessariasTotal > 0 ? (
                          <Badge variant="default" className="font-semibold">
                            {formatarEquipes(expectativa.equipesNecessariasTotal)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0,0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col gap-1">
                          {expectativa.tempoTotalUrgentesMin > 0 && (
                            <span className="text-xs text-danger font-medium">
                              Urgentes: {formatarTempo(expectativa.tempoTotalUrgentesMin)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Total: {formatarTempo(expectativa.tempoTotalDemandaMin)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Sugestões de União */}
            {sugestoesUniao.length > 0 && (
              <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Merge className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">
                    Sugestões de União de Territórios
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Os territórios abaixo são próximos e têm poucas reguladas urgentes. Unir esses territórios pode otimizar o uso de equipes.
                </p>
                <div className="space-y-3">
                  {sugestoesUniao.map((sugestao, index) => (
                    <div
                      key={`${sugestao.territorio1Id}-${sugestao.territorio2Id}`}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="font-semibold">
                              {sugestao.territorio1Nome}
                            </Badge>
                            <span className="text-muted-foreground">+</span>
                            <Badge variant="outline" className="font-semibold">
                              {sugestao.territorio2Nome}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Distância: </span>
                              <span className="font-medium">{sugestao.distanciaKm.toFixed(1)} km</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Equipes Urgentes: </span>
                              <span className="font-medium text-danger">
                                {formatarEquipes(sugestao.equipesUrgentesSomadas)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Benefício: </span>
                              <span className="font-medium text-success text-xs">
                                {sugestao.beneficio}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Equipes: </span>
                              <span className="font-medium">
                                {sugestao.equipe1Codigo || '-'} / {sugestao.equipe2Codigo || '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {sugestao.distanciaKm.toFixed(1)}km
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legenda */}
            <div className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <div className="text-sm font-medium text-foreground mb-2">Legenda:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant="regulada" className="h-4 w-4 p-0" />
                  <span><strong>OSs Urgentes:</strong> Reguladas com prazo até o limite configurado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="h-4 w-4 p-0" />
                  <span><strong>Equipes para Urgentes:</strong> Quantidade mínima para atender apenas OSs urgentes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="h-4 w-4 p-0" />
                  <span><strong>Equipes para Toda Demanda:</strong> Quantidade necessária para atender todas as OSs do território</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span><strong>Tempo Total:</strong> Inclui tempo de execução + deslocamento médio</span>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

