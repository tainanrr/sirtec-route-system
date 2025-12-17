import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Territorio } from "@/types/territorios";
import { Equipe } from "@/data/mockData";
import { MapPin, CheckCircle2, Edit, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { salvarTerritorios } from "@/types/territorios";

interface SelecaoTerritoriosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  territorios: Territorio[];
  equipes: Equipe[];
  territoriosSelecionados: string[];
  onTerritoriosChange: (ids: string[]) => void;
  onTerritoriosUpdate?: (territorios: Territorio[]) => void; // Callback para atualizar territórios após edição
}

export default function SelecaoTerritoriosDialog({
  open,
  onOpenChange,
  territorios,
  equipes,
  territoriosSelecionados,
  onTerritoriosChange,
  onTerritoriosUpdate,
}: SelecaoTerritoriosDialogProps) {
  const [selecionados, setSelecionados] = useState<string[]>(territoriosSelecionados);
  const [editandoEquipes, setEditandoEquipes] = useState<string | null>(null);
  const [equipesEditando, setEquipesEditando] = useState<string[]>([]);

  useEffect(() => {
    setSelecionados(territoriosSelecionados);
  }, [territoriosSelecionados]);

  const territoriosAtivos = territorios.filter(t => t.ativo && t.equipeIds && t.equipeIds.length > 0 && t.poligono.length >= 3);

  const handleToggleTerritorio = (territorioId: string) => {
    setSelecionados(prev => {
      if (prev.includes(territorioId)) {
        return prev.filter(id => id !== territorioId);
      } else {
        return [...prev, territorioId];
      }
    });
  };

  const handleSelecionarTodos = () => {
    if (selecionados.length === territoriosAtivos.length) {
      setSelecionados([]);
    } else {
      setSelecionados(territoriosAtivos.map(t => t.id));
    }
  };

  const handleConfirmar = () => {
    onTerritoriosChange(selecionados);
    onOpenChange(false);
  };

  const handleIniciarEdicaoEquipes = (territorioId: string) => {
    const territorio = territorios.find(t => t.id === territorioId);
    if (territorio) {
      setEditandoEquipes(territorioId);
      setEquipesEditando([...territorio.equipeIds]);
    }
  };

  const handleSalvarEquipes = (territorioId: string) => {
    const territoriosAtualizados = territorios.map(t => 
      t.id === territorioId 
        ? { ...t, equipeIds: equipesEditando, atualizadoEm: new Date() }
        : t
    );
    salvarTerritorios(territoriosAtualizados);
    if (onTerritoriosUpdate) {
      onTerritoriosUpdate(territoriosAtualizados);
    }
    setEditandoEquipes(null);
    setEquipesEditando([]);
  };

  const handleCancelarEdicaoEquipes = () => {
    setEditandoEquipes(null);
    setEquipesEditando([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto z-[1000]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Selecionar Territórios para Roteirização
          </DialogTitle>
          <DialogDescription>
            Escolha quais territórios serão considerados na roteirização. Apenas OSs dentro dos territórios selecionados serão alocadas.
          </DialogDescription>
        </DialogHeader>

        {territoriosAtivos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">
              Nenhum território ativo encontrado
            </p>
            <p className="text-sm text-muted-foreground">
              Certifique-se de que existem territórios cadastrados, ativos e com equipe atribuída.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {selecionados.length} de {territoriosAtivos.length} territórios selecionados
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelecionarTodos}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {selecionados.length === territoriosAtivos.length ? "Desselecionar Todos" : "Selecionar Todos"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
              {territoriosAtivos.map((territorio) => {
                const estaSelecionado = selecionados.includes(territorio.id);
                const estaEditando = editandoEquipes === territorio.id;
                const equipesVinculadas = territorio.equipeIds
                  .map(id => equipes.find(e => e.id === id))
                  .filter(e => e !== undefined) as Equipe[];

                return (
                  <div
                    key={territorio.id}
                    className={`
                      rounded-lg border p-4 transition-all
                      ${estaSelecionado 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border bg-card hover:bg-muted/50'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={estaSelecionado}
                        onCheckedChange={() => handleToggleTerritorio(territorio.id)}
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: territorio.cor }}
                            />
                            <Label className="font-semibold text-foreground cursor-pointer" onClick={() => handleToggleTerritorio(territorio.id)}>
                              {territorio.nome}
                            </Label>
                          </div>
                          {!estaEditando && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIniciarEdicaoEquipes(territorio.id);
                              }}
                              className="h-6 px-2"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        
                        {estaEditando ? (
                          <div className="space-y-2 mt-2">
                            <div className="text-xs font-medium text-foreground mb-1">
                              Selecionar equipes:
                            </div>
                            <div className="space-y-1 max-h-[120px] overflow-y-auto">
                              {equipes.map((equipe) => {
                                const selecionada = equipesEditando.includes(equipe.id);
                                return (
                                  <label
                                    key={equipe.id}
                                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={selecionada}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setEquipesEditando([...equipesEditando, equipe.id]);
                                        } else {
                                          setEquipesEditando(equipesEditando.filter(id => id !== equipe.id));
                                        }
                                      }}
                                    />
                                    <span>{equipe.codigo} - {equipe.tecnico}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSalvarEquipes(territorio.id);
                                }}
                                className="h-7 text-xs"
                              >
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelarEdicaoEquipes();
                                }}
                                className="h-7 text-xs"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {equipesVinculadas.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {equipesVinculadas.map((equipe) => (
                                  <Badge key={equipe.id} variant="secondary" className="text-xs">
                                    {equipe.codigo}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Sem equipes
                              </Badge>
                            )}
                            <div className="text-xs text-muted-foreground mt-2">
                              {territorio.poligono.length} pontos no polígono
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmar} disabled={selecionados.length === 0}>
                Confirmar ({selecionados.length})
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

