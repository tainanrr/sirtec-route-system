import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { OrdemServico } from "@/data/mockData";
import { Territorio, pontoNoPoligono } from "@/types/territorios";
import {
  Calendar,
  MapPin,
  AlertTriangle,
  CloudRain,
  Sun,
  Cloud,
  Wind,
  Droplets,
  ThermometerSun,
  ThermometerSnowflake,
  Zap,
} from "lucide-react";
import { format, addDays, isSameDay, startOfDay, isToday, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  buscarPrevisaoTempoComCache,
  PrevisaoTempo,
  getCorClima,
  climaFavoravel,
} from "@/services/weatherService";
import { cn } from "@/lib/utils";

interface CalendarioReguladasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordens: OrdemServico[];
  territorios: Territorio[];
}

interface DiaCalendario {
  data: Date;
  dataStr: string;
  diaSemana: string;
  diaNumero: number;
  mesNome: string;
  reguladas: OrdemServico[];
  totalReguladas: number;
  vencidas: number;
  previsao?: PrevisaoTempo;
}

// Coordenadas padrão (Vitória da Conquista, BA)
const COORDENADAS_PADRAO = {
  latitude: -14.8661,
  longitude: -40.8394,
};

export default function CalendarioReguladasDialog({
  open,
  onOpenChange,
  ordens,
  territorios,
}: CalendarioReguladasDialogProps) {
  const [territorioSelecionado, setTerritorioSelecionado] = useState<string>("todos");
  const [municipioSelecionado, setMunicipioSelecionado] = useState<string>("todos");
  const [previsoes, setPrevisoes] = useState<PrevisaoTempo[]>([]);
  const [carregandoPrevisao, setCarregandoPrevisao] = useState(false);

  // Filtrar apenas ordens reguladas
  const ordensReguladas = useMemo(() => {
    return ordens.filter((os) => os.regulada && os.prazo);
  }, [ordens]);

  // Lista única de municípios
  const municipios = useMemo(() => {
    const municipioSet = new Set<string>();
    ordensReguladas.forEach((os) => {
      if (os.municipio) {
        municipioSet.add(os.municipio);
      }
    });
    return Array.from(municipioSet).sort();
  }, [ordensReguladas]);

  // Filtrar ordens por território e município
  const ordensFiltradas = useMemo(() => {
    let filtradas = ordensReguladas;

    // Filtro por território
    if (territorioSelecionado !== "todos") {
      const territorio = territorios.find((t) => t.id === territorioSelecionado);
      if (territorio) {
        filtradas = filtradas.filter((os) => {
          if (os.latitude && os.longitude) {
            return pontoNoPoligono(
              { lat: os.latitude, lng: os.longitude },
              territorio.poligono
            );
          }
          return false;
        });
      }
    }

    // Filtro por município
    if (municipioSelecionado !== "todos") {
      filtradas = filtradas.filter(
        (os) => os.municipio === municipioSelecionado
      );
    }

    return filtradas;
  }, [ordensReguladas, territorioSelecionado, municipioSelecionado, territorios]);

  // Gerar dias do calendário (10 dias a partir de hoje)
  const diasCalendario = useMemo((): DiaCalendario[] => {
    const dias: DiaCalendario[] = [];
    const hoje = startOfDay(new Date());

    for (let i = 0; i < 10; i++) {
      const data = addDays(hoje, i);
      const dataStr = format(data, "yyyy-MM-dd");

      // Filtrar reguladas que vencem neste dia
      const reguladasDoDia = ordensFiltradas.filter((os) => {
        if (!os.prazo) return false;
        return isSameDay(os.prazo, data);
      });

      // Contar vencidas (para hoje, considerar hora atual)
      const vencidas = reguladasDoDia.filter((os) => {
        if (!os.prazo) return false;
        if (i === 0) {
          // Hoje: verificar hora
          return os.prazo < new Date();
        }
        return false;
      }).length;

      // Buscar previsão correspondente
      const previsao = previsoes.find((p) => p.data === dataStr);

      dias.push({
        data,
        dataStr,
        diaSemana: format(data, "EEEE", { locale: ptBR }),
        diaNumero: data.getDate(),
        mesNome: format(data, "MMMM", { locale: ptBR }),
        reguladas: reguladasDoDia,
        totalReguladas: reguladasDoDia.length,
        vencidas,
        previsao,
      });
    }

    return dias;
  }, [ordensFiltradas, previsoes]);

  // Buscar previsão do tempo
  useEffect(() => {
    if (!open) return;

    const buscarPrevisao = async () => {
      setCarregandoPrevisao(true);

      // Calcular centro das OSs filtradas ou usar padrão
      let lat = COORDENADAS_PADRAO.latitude;
      let lng = COORDENADAS_PADRAO.longitude;

      if (ordensFiltradas.length > 0) {
        const lats = ordensFiltradas
          .filter((os) => os.latitude)
          .map((os) => os.latitude);
        const lngs = ordensFiltradas
          .filter((os) => os.longitude)
          .map((os) => os.longitude);

        if (lats.length > 0) {
          lat = lats.reduce((a, b) => a + b, 0) / lats.length;
          lng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
        }
      }

      try {
        const resultado = await buscarPrevisaoTempoComCache(lat, lng, 10);
        setPrevisoes(resultado);
      } catch (error) {
        console.error("Erro ao buscar previsão:", error);
      } finally {
        setCarregandoPrevisao(false);
      }
    };

    buscarPrevisao();
  }, [open, ordensFiltradas]);

  // Calcular totais
  const totalReguladas = ordensFiltradas.length;
  const totalVencidas = diasCalendario[0]?.vencidas || 0;
  const totalVencendoHoje = diasCalendario[0]?.totalReguladas || 0;
  const totalProximos10Dias = diasCalendario.reduce(
    (acc, dia) => acc + dia.totalReguladas,
    0
  );

  const getStatusCor = (dia: DiaCalendario): string => {
    if (dia.totalReguladas === 0) return "border-gray-200 bg-gray-50";
    if (dia.vencidas > 0) return "border-red-400 bg-red-50";
    if (isToday(dia.data)) return "border-amber-400 bg-amber-50";
    if (dia.totalReguladas > 10) return "border-orange-400 bg-orange-50";
    return "border-blue-200 bg-blue-50";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden z-[1000]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendário de Reguladas Vencendo
          </DialogTitle>
          <DialogDescription>
            Visualização das notas reguladas vencendo nos próximos 10 dias por
            território e município.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select
              value={territorioSelecionado}
              onValueChange={setTerritorioSelecionado}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Território" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Territórios</SelectItem>
                {territorios
                  .filter((t) => t.ativo)
                  .map((territorio) => (
                    <SelectItem key={territorio.id} value={territorio.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: territorio.cor }}
                        />
                        {territorio.nome}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select
              value={municipioSelecionado}
              onValueChange={setMunicipioSelecionado}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Município" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Municípios</SelectItem>
                {municipios.map((municipio) => (
                  <SelectItem key={municipio} value={municipio}>
                    {municipio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-3">
              <div className="text-sm text-muted-foreground">Total Reguladas</div>
              <div className="text-2xl font-bold text-blue-700">
                {totalReguladas}
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3">
              <div className="text-sm text-muted-foreground">Vencendo Hoje</div>
              <div className="text-2xl font-bold text-amber-700">
                {totalVencendoHoje}
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-3">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Vencidas Hoje
              </div>
              <div className="text-2xl font-bold text-red-700">{totalVencidas}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-3">
              <div className="text-sm text-muted-foreground">Próx. 10 Dias</div>
              <div className="text-2xl font-bold text-green-700">
                {totalProximos10Dias}
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Calendário */}
        <ScrollArea className="h-[50vh] mt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {diasCalendario.map((dia) => (
              <Card
                key={dia.dataStr}
                className={cn(
                  "transition-all hover:shadow-md cursor-pointer",
                  getStatusCor(dia),
                  dia.previsao && getCorClima(dia.previsao.codigoClima)
                )}
              >
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {dia.diaSemana}
                      </div>
                      <CardTitle className="text-lg">
                        {dia.diaNumero}
                        <span className="text-xs ml-1 font-normal text-muted-foreground capitalize">
                          {dia.mesNome}
                        </span>
                      </CardTitle>
                    </div>
                    {isToday(dia.data) && (
                      <Badge variant="default" className="text-xs">
                        Hoje
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  {/* Quantidade de Reguladas */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <Zap className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">
                        {dia.totalReguladas} reguladas
                      </span>
                    </div>
                    {dia.vencidas > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {dia.vencidas} vencidas
                      </Badge>
                    )}
                  </div>

                  {/* Previsão do Tempo */}
                  {carregandoPrevisao ? (
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : dia.previsao ? (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-2xl">{dia.previsao.icone}</span>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <ThermometerSun className="h-3 w-3 text-red-500" />
                            <span className="text-red-600 font-medium">
                              {dia.previsao.temperaturaMax}°
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ThermometerSnowflake className="h-3 w-3 text-blue-500" />
                            <span className="text-blue-600">
                              {dia.previsao.temperaturaMin}°
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {dia.previsao.descricaoClima}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Droplets className="h-3 w-3" />
                          {dia.previsao.probabilidadeChuva}%
                        </div>
                        <div className="flex items-center gap-1">
                          <Wind className="h-3 w-3" />
                          {dia.previsao.velocidadeVento} km/h
                        </div>
                      </div>
                      {!climaFavoravel(
                        dia.previsao.codigoClima,
                        dia.previsao.precipitacao
                      ) && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                          <CloudRain className="h-3 w-3" />
                          Clima desfavorável
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Detalhes das Reguladas */}
                  {dia.totalReguladas > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-muted-foreground">
                        Por tipo de serviço:
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(
                          dia.reguladas.reduce((acc, os) => {
                            acc[os.tipo] = (acc[os.tipo] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([tipo, count]) => (
                          <Badge
                            key={tipo}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tipo}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {/* Legenda */}
        <div className="mt-4 p-3 rounded-lg border border-border bg-muted/30">
          <div className="text-sm font-medium mb-2">Legenda:</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-red-400 bg-red-50" />
              <span>Com vencidas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-50" />
              <span>Hoje (atenção)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-orange-400 bg-orange-50" />
              <span>Acima de 10</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-gray-200 bg-gray-50" />
              <span>Sem reguladas</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-red-500" />
              <span>Clima desfavorável para trabalho externo</span>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <span>Clima favorável</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
