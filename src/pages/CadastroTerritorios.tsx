import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Trash2, Edit, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  Territorio,
  Coordenada,
  CORES_TERRITORIOS,
  carregarTerritorios,
  salvarTerritorios,
} from "@/types/territorios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// @ts-ignore - leaflet-draw não tem tipos completos
import "leaflet-draw/dist/leaflet.draw.css";
// @ts-ignore - leaflet-draw não tem tipos completos
import "leaflet-draw";

// Fix para ícones do Leaflet
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

export default function CadastroTerritorios() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  // @ts-ignore - leaflet-draw não tem tipos completos
  const drawControlRef = useRef<any>(null);
  const drawnLayersRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const polygonLayersRef = useRef<Map<string, L.Polygon>>(new Map());
  
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [equipes, setEquipes] = useState<Tables<"tecnicos">[]>([]);
  const [editingTerritorio, setEditingTerritorio] = useState<Territorio | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    cor: CORES_TERRITORIOS[0],
    equipeIds: [] as string[],
  });
  const [showForm, setShowForm] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState<Coordenada[] | null>(null);

  // Carregar equipes do Supabase
  useEffect(() => {
    const fetchEquipes = async () => {
      const { data, error } = await supabase
        .from("tecnicos")
        .select("*")
        .order("codigo");

      if (error) {
        console.error("Erro ao carregar equipes:", error);
        toast.error("Erro ao carregar equipes");
      } else {
        setEquipes(data || []);
      }
    };

    fetchEquipes();
  }, []);

  // Carregar territórios do localStorage
  useEffect(() => {
    const loaded = carregarTerritorios();
    setTerritorios(loaded);
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Inicializar mapa com leaflet-draw
    const initMap = () => {

      const map = L.map(mapRef.current!, {
        center: [-14.8619, -40.8389], // Vitória da Conquista
        zoom: 13,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Adicionar feature group para desenho
      drawnLayersRef.current.addTo(map);

      // Verificar se leaflet-draw está disponível
      if (typeof (L as any).Control?.Draw === 'undefined') {
        toast.error("leaflet-draw não está disponível. Reinicie o servidor.");
        console.error("leaflet-draw não está disponível");
        mapInstanceRef.current = map;
        return;
      }

      // Configurar controles de desenho
      const DrawControl = (L.Control as any).Draw;
      const drawControl = new DrawControl({
        draw: {
          polygon: {
            allowIntersection: true, // Permitir interseções
            showArea: true,
            shapeOptions: {
              color: '#3388ff',
              fillColor: '#3388ff',
              fillOpacity: 0.2
            },
            // Remover limite mínimo de pontos (padrão é 3)
            // O leaflet-draw permite quantos pontos quiser por padrão
          },
          rectangle: {
            shapeOptions: {
              color: '#3388ff',
              fillColor: '#3388ff',
              fillOpacity: 0.2
            }
          },
          circle: false,
          marker: false,
          circlemarker: false,
          polyline: false,
        },
        edit: {
          featureGroup: drawnLayersRef.current,
          remove: true,
        },
      });

      drawControl.addTo(map);
      drawControlRef.current = drawControl;

      mapInstanceRef.current = map;

      // Event listeners para desenho
      const DrawEvents = (L as any).Draw?.Event;
      if (!DrawEvents) {
        console.error("leaflet-draw não está disponível");
        return;
      }

      map.on(DrawEvents.CREATED, (e: any) => {
        const layer = e.layer;
        const type = e.layerType;

        if (type === "polygon" || type === "rectangle") {
          const latlngs = layer.getLatLngs()[0] as L.LatLng[];
          const coordenadas: Coordenada[] = latlngs.map((ll) => ({
            lat: ll.lat,
            lng: ll.lng,
          }));

          console.log(`Polígono criado com ${coordenadas.length} pontos`);
          setCurrentPolygon(coordenadas);
          setShowForm(true);
          drawnLayersRef.current.addLayer(layer);
        }
      });

      // Adicionar instrução visual quando começar a desenhar
      map.on(DrawEvents.DRAWSTART, () => {
        toast.info("💡 Dica: Continue clicando para adicionar mais pontos. Duplo clique ou clique no primeiro ponto para finalizar.", {
          duration: 5000,
        });
      });

      map.on(DrawEvents.DELETED, () => {
        // Atualizar territórios após deletar
        const updated = carregarTerritorios();
        setTerritorios(updated);
        atualizarPoligonosNoMapa(updated);
      });
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Atualizar polígonos no mapa quando territórios mudarem
  useEffect(() => {
    if (mapInstanceRef.current) {
      atualizarPoligonosNoMapa(territorios);
    }
  }, [territorios]);

  const atualizarPoligonosNoMapa = (territoriosParaMostrar: Territorio[]) => {
    // Limpar polígonos existentes
    polygonLayersRef.current.forEach((layer) => {
      drawnLayersRef.current.removeLayer(layer);
    });
    polygonLayersRef.current.clear();

    // Adicionar polígonos dos territórios
    territoriosParaMostrar.forEach((territorio) => {
      if (!territorio.ativo) return;

      const latlngs = territorio.poligono.map(
        (coord) => [coord.lat, coord.lng] as [number, number]
      );

      const polygon = L.polygon(latlngs, {
        color: territorio.cor,
        fillColor: territorio.cor,
        fillOpacity: 0.3,
        weight: 2,
      });

      polygon.bindTooltip(territorio.nome, { permanent: false });
      polygon.on("click", () => {
        handleEditTerritorio(territorio);
      });

      polygon.addTo(drawnLayersRef.current);
      polygonLayersRef.current.set(territorio.id, polygon);
    });
  };

  const handleSalvarTerritorio = () => {
    if (!formData.nome.trim()) {
      toast.error("Informe o nome do território");
      return;
    }

    if (!currentPolygon || currentPolygon.length < 3) {
      toast.error("Desenhe um polígono válido no mapa");
      return;
    }

    const novoTerritorio: Territorio = {
      id: editingTerritorio?.id || `territorio-${Date.now()}`,
      nome: formData.nome,
      cor: formData.cor,
      poligono: currentPolygon,
      equipeIds: formData.equipeIds || [],
      ativo: true,
      criadoEm: editingTerritorio?.criadoEm || new Date(),
      atualizadoEm: new Date(),
    };

    let updated: Territorio[];
    if (editingTerritorio) {
      updated = territorios.map((t) =>
        t.id === editingTerritorio.id ? novoTerritorio : t
      );
    } else {
      updated = [...territorios, novoTerritorio];
    }

    setTerritorios(updated);
    salvarTerritorios(updated);
    toast.success(editingTerritorio ? "Território atualizado!" : "Território criado!");

    // Limpar formulário
    setFormData({ nome: "", cor: CORES_TERRITORIOS[0], equipeIds: [] });
    setShowForm(false);
    setEditingTerritorio(null);
    setCurrentPolygon(null);

    // Limpar desenho atual
    drawnLayersRef.current.clearLayers();
    atualizarPoligonosNoMapa(updated);
  };

  const handleCancelar = () => {
    setShowForm(false);
    setEditingTerritorio(null);
    setCurrentPolygon(null);
    setFormData({ nome: "", cor: CORES_TERRITORIOS[0], equipeIds: [] });
    drawnLayersRef.current.clearLayers();
    atualizarPoligonosNoMapa(territorios);
  };

  const handleEditTerritorio = (territorio: Territorio) => {
    setEditingTerritorio(territorio);
    setFormData({
      nome: territorio.nome,
      cor: territorio.cor,
      equipeIds: territorio.equipeIds || [],
    });
    setCurrentPolygon(territorio.poligono);
    setShowForm(true);

    // Destacar polígono no mapa
    const polygon = polygonLayersRef.current.get(territorio.id);
    if (polygon) {
      polygon.setStyle({ weight: 4, fillOpacity: 0.5 });
      mapInstanceRef.current?.fitBounds(polygon.getBounds());
    }
  };

  const handleDeleteTerritorio = (id: string) => {
    const updated = territorios.filter((t) => t.id !== id);
    setTerritorios(updated);
    salvarTerritorios(updated);
    atualizarPoligonosNoMapa(updated);
    toast.success("Território excluído!");
  };

  const handleToggleAtivo = (id: string) => {
    const updated = territorios.map((t) =>
      t.id === id ? { ...t, ativo: !t.ativo, atualizadoEm: new Date() } : t
    );
    setTerritorios(updated);
    salvarTerritorios(updated);
    atualizarPoligonosNoMapa(updated);
  };

  const handleExportar = () => {
    const dataStr = JSON.stringify(territorios, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `territorios-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Territórios exportados!");
  };

  const handleImportar = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          const territoriosImportados: Territorio[] = imported.map((t: any) => ({
            ...t,
            criadoEm: new Date(t.criadoEm),
            atualizadoEm: new Date(t.atualizadoEm),
          }));

          setTerritorios(territoriosImportados);
          salvarTerritorios(territoriosImportados);
          atualizarPoligonosNoMapa(territoriosImportados);
          toast.success(`${territoriosImportados.length} territórios importados!`);
        } catch (error) {
          toast.error("Erro ao importar arquivo JSON");
          console.error(error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const equipesNomes = (equipeIds: string[]) => {
    if (!equipeIds || equipeIds.length === 0) return "Sem equipes";
    const nomes = equipeIds
      .map((id) => {
        const equipe = equipes.find((e) => e.id === id);
        return equipe ? `${equipe.codigo}` : null;
      })
      .filter((n) => n !== null);
    return nomes.length > 0 ? nomes.join(", ") : "Equipes não encontradas";
  };

  return (
    <MainLayout title="Cadastro de Territórios">
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Sidebar */}
        <div className="w-[300px] bg-slate-900 rounded-lg p-4 overflow-y-auto flex flex-col gap-4">
          <h2 className="text-xl font-bold text-white">Cadastro de Territórios</h2>

          {/* Formulário */}
          {showForm && (
            <div className="bg-slate-800 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  {editingTerritorio ? "Editar Território" : "Novo Território"}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCancelar}
                  className="text-white hover:bg-slate-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="nome" className="text-white">
                    Nome do território
                  </Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData({ ...formData, nome: e.target.value })
                    }
                    className="bg-slate-700 text-white border-slate-600"
                    placeholder="Ex: Zona Norte"
                  />
                </div>

                <div>
                  <Label className="text-white mb-2 block">Cor</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {CORES_TERRITORIOS.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => setFormData({ ...formData, cor })}
                        className={`w-10 h-10 rounded border-2 ${
                          formData.cor === cor
                            ? "border-white scale-110"
                            : "border-slate-600"
                        }`}
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-white mb-2 block">
                    Equipes vinculadas
                  </Label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto bg-slate-700 rounded p-2">
                    {equipes.length === 0 ? (
                      <p className="text-slate-400 text-sm text-center py-2">
                        Nenhuma equipe disponível
                      </p>
                    ) : (
                      equipes.map((equipe) => {
                        const estaSelecionada = formData.equipeIds.includes(equipe.id);
                        return (
                          <label
                            key={equipe.id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-slate-600 cursor-pointer"
                          >
                            <Checkbox
                              checked={estaSelecionada}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({
                                    ...formData,
                                    equipeIds: [...formData.equipeIds, equipe.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    equipeIds: formData.equipeIds.filter(
                                      (id) => id !== equipe.id
                                    ),
                                  });
                                }
                              }}
                            />
                            <span className="text-white text-sm">
                          {equipe.codigo} - {equipe.nome}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {formData.equipeIds.length > 0 && (
                    <p className="text-slate-400 text-xs mt-2">
                      {formData.equipeIds.length} equipe(s) selecionada(s)
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSalvarTerritorio}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Salvar
                  </Button>
                  <Button
                    onClick={handleCancelar}
                    variant="outline"
                    className="flex-1 border-slate-600 text-white hover:bg-slate-700"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de territórios */}
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Button
                onClick={handleExportar}
                variant="outline"
                size="sm"
                className="flex-1 border-slate-600 text-white hover:bg-slate-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar JSON
              </Button>
              <Button
                onClick={handleImportar}
                variant="outline"
                size="sm"
                className="flex-1 border-slate-600 text-white hover:bg-slate-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar JSON
              </Button>
            </div>

            <div className="space-y-2">
              {territorios.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">
                  Nenhum território cadastrado
                </p>
              ) : (
                territorios.map((territorio) => (
                  <div
                    key={territorio.id}
                    className={`bg-slate-800 rounded-lg p-3 cursor-pointer hover:bg-slate-700 transition-colors ${
                      !territorio.ativo ? "opacity-50" : ""
                    }`}
                    onClick={() => handleEditTerritorio(territorio)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: territorio.cor }}
                          />
                          <span className="text-white font-medium">
                            {territorio.nome}
                          </span>
                          {!territorio.ativo && (
                            <Badge variant="secondary" className="text-xs">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-400 text-xs">
                          {equipesNomes(territorio.equipeIds)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-white hover:bg-slate-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleAtivo(territorio.id);
                          }}
                        >
                          {territorio.ativo ? "✓" : "○"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-400 hover:bg-slate-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTerritorio(territorio.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Mapa */}
        <div className="flex-1 rounded-lg overflow-hidden border border-slate-700 relative">
          <div ref={mapRef} className="w-full h-full" />
          {!showForm && (
            <div className="absolute top-4 right-4 bg-slate-900/90 text-white p-3 rounded-lg text-sm z-[1000] max-w-xs shadow-lg">
              <p className="font-semibold mb-2">📝 Como desenhar:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Clique no ícone de polígono ou retângulo</li>
                <li>Clique no mapa para adicionar pontos</li>
                <li>Continue clicando para adicionar mais pontos</li>
                <li>Duplo clique ou clique no primeiro ponto para finalizar</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
