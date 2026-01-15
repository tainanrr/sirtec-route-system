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
import { Button } from "@/components/ui/button";
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
  Download,
} from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { toast } from "sonner";
import { format, addDays, isSameDay, startOfDay, isToday, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  buscarPrevisaoTempoComCache,
  PrevisaoTempo,
  getCorClima,
  climaFavoravel,
} from "@/services/weatherService";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Mapeamento de tipo para grupo de serviço (cache local)
interface GrupoServicoMap {
  [tipo: string]: string;
}

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
  const [localizacaoPrevisao, setLocalizacaoPrevisao] = useState<string>("Vitória da Conquista, BA");
  const [gruposServico, setGruposServico] = useState<GrupoServicoMap>({});

  // Carregar mapeamento de tipo -> grupo de serviço
  useEffect(() => {
    const carregarGrupos = async () => {
      try {
        const { data, error } = await supabase
          .from("skills")
          .select("codigo, grupo_servico")
          .eq("ativo", true);

        if (error) {
          console.error("Erro ao carregar grupos de serviço:", error);
          return;
        }

        const mapa: GrupoServicoMap = {};
        (data || []).forEach((skill) => {
          if (skill.codigo && skill.grupo_servico) {
            // Mapear tanto código original quanto normalizado
            mapa[skill.codigo] = skill.grupo_servico;
            mapa[skill.codigo.toUpperCase()] = skill.grupo_servico;
            // Também mapear sem sufixo " -" se existir
            const codigoSemSufixo = skill.codigo.replace(/ -$/, "").trim();
            mapa[codigoSemSufixo] = skill.grupo_servico;
            mapa[codigoSemSufixo.toUpperCase()] = skill.grupo_servico;
          }
        });
        setGruposServico(mapa);
      } catch (err) {
        console.error("Erro ao carregar grupos:", err);
      }
    };

    carregarGrupos();
  }, []);

  // Função para obter grupo de serviço de um tipo
  const getGrupoServico = (tipo: string): string => {
    // Tentar encontrar o grupo de várias formas
    const tipoUpper = tipo.toUpperCase();
    return gruposServico[tipo] || 
           gruposServico[tipoUpper] || 
           gruposServico[`${tipoUpper} -`] ||
           "Outros";
  };

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

  // Calcular localização para previsão do tempo e município predominante
  const infoLocalizacaoPrevisao = useMemo(() => {
    if (ordensFiltradas.length === 0) {
      return {
        lat: COORDENADAS_PADRAO.latitude,
        lng: COORDENADAS_PADRAO.longitude,
        descricao: "Vitória da Conquista, BA (padrão)",
        municipioPredominante: null,
      };
    }

    // Contar municípios para encontrar o predominante
    const contagemMunicipios: Record<string, number> = {};
    ordensFiltradas.forEach((os) => {
      if (os.municipio) {
        contagemMunicipios[os.municipio] = (contagemMunicipios[os.municipio] || 0) + 1;
      }
    });

    // Encontrar o município com mais OSs
    let municipioPredominante: string | null = null;
    let maxCount = 0;
    Object.entries(contagemMunicipios).forEach(([municipio, count]) => {
      if (count > maxCount) {
        maxCount = count;
        municipioPredominante = municipio;
      }
    });

    // Calcular centro das coordenadas
    const ossComCoordenadas = ordensFiltradas.filter((os) => os.latitude && os.longitude);
    
    if (ossComCoordenadas.length === 0) {
      return {
        lat: COORDENADAS_PADRAO.latitude,
        lng: COORDENADAS_PADRAO.longitude,
        descricao: municipioPredominante 
          ? `${municipioPredominante} (sem coordenadas, usando padrão)`
          : "Vitória da Conquista, BA (padrão)",
        municipioPredominante,
      };
    }

    const lats = ossComCoordenadas.map((os) => os.latitude);
    const lngs = ossComCoordenadas.map((os) => os.longitude);
    const lat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const lng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    // Gerar descrição baseada nos filtros e municípios
    let descricao = "";
    const totalMunicipios = Object.keys(contagemMunicipios).length;
    
    if (municipioSelecionado !== "todos") {
      descricao = municipioSelecionado;
    } else if (totalMunicipios === 1 && municipioPredominante) {
      descricao = municipioPredominante;
    } else if (municipioPredominante && totalMunicipios > 1) {
      descricao = `${municipioPredominante} (principal de ${totalMunicipios} municípios)`;
    } else {
      const territorio = territorios.find((t) => t.id === territorioSelecionado);
      descricao = territorio ? `Centro do território ${territorio.nome}` : "Centro das OSs";
    }

    return {
      lat,
      lng,
      descricao,
      municipioPredominante,
    };
  }, [ordensFiltradas, municipioSelecionado, territorioSelecionado, territorios]);

  // Buscar previsão do tempo
  useEffect(() => {
    if (!open) return;

    const buscarPrevisao = async () => {
      setCarregandoPrevisao(true);
      setLocalizacaoPrevisao(infoLocalizacaoPrevisao.descricao);

      try {
        const resultado = await buscarPrevisaoTempoComCache(
          infoLocalizacaoPrevisao.lat, 
          infoLocalizacaoPrevisao.lng, 
          10
        );
        setPrevisoes(resultado);
      } catch (error) {
        console.error("Erro ao buscar previsão:", error);
      } finally {
        setCarregandoPrevisao(false);
      }
    };

    buscarPrevisao();
  }, [open, infoLocalizacaoPrevisao]);

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

  // Função de exportação para Excel
  const handleExportar = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Estilos
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "2563EB" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };

      const cellStyle = {
        alignment: { horizontal: "left", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "CCCCCC" } },
          bottom: { style: "thin", color: { rgb: "CCCCCC" } },
          left: { style: "thin", color: { rgb: "CCCCCC" } },
          right: { style: "thin", color: { rgb: "CCCCCC" } },
        },
      };

      const cellCenterStyle = {
        ...cellStyle,
        alignment: { horizontal: "center", vertical: "center" },
      };

      const alertStyle = {
        ...cellCenterStyle,
        fill: { fgColor: { rgb: "FEE2E2" } },
        font: { bold: true, color: { rgb: "DC2626" } },
      };

      // ===== ABA 1: RESUMO =====
      const territorioNome = territorioSelecionado !== "todos" 
        ? territorios.find(t => t.id === territorioSelecionado)?.nome || "Todos"
        : "Todos os Territórios";
      const municipioNome = municipioSelecionado !== "todos" ? municipioSelecionado : "Todos os Municípios";

      const resumoData: any[][] = [
        [{ v: "CALENDÁRIO DE REGULADAS VENCENDO", s: { ...headerStyle, fill: { fgColor: { rgb: "1E40AF" } } } }],
        [],
        [{ v: "Filtros Aplicados:", s: { font: { bold: true } } }],
        [{ v: "Território:", s: cellStyle }, { v: territorioNome, s: cellStyle }],
        [{ v: "Município:", s: cellStyle }, { v: municipioNome, s: cellStyle }],
        [{ v: "Localização Previsão:", s: cellStyle }, { v: localizacaoPrevisao, s: cellStyle }],
        [],
        [{ v: "Resumo Geral:", s: { font: { bold: true } } }],
        [{ v: "Total de Reguladas:", s: cellStyle }, { v: totalReguladas, s: cellCenterStyle }],
        [{ v: "Vencendo Hoje:", s: cellStyle }, { v: totalVencendoHoje, s: cellCenterStyle }],
        [{ v: "Vencidas Hoje:", s: cellStyle }, { v: totalVencidas, s: totalVencidas > 0 ? alertStyle : cellCenterStyle }],
        [{ v: "Próximos 10 Dias:", s: cellStyle }, { v: totalProximos10Dias, s: cellCenterStyle }],
        [],
        [{ v: "Detalhamento por Dia:", s: { font: { bold: true } } }],
        [
          { v: "Data", s: headerStyle },
          { v: "Dia da Semana", s: headerStyle },
          { v: "Reguladas", s: headerStyle },
          { v: "Vencidas", s: headerStyle },
          { v: "Clima", s: headerStyle },
          { v: "Temp. Máx", s: headerStyle },
          { v: "Temp. Mín", s: headerStyle },
          { v: "Prob. Chuva", s: headerStyle },
          { v: "Vento (km/h)", s: headerStyle },
        ],
      ];

      // Adicionar linhas dos dias
      diasCalendario.forEach((dia) => {
        resumoData.push([
          { v: format(dia.data, "dd/MM/yyyy"), s: cellCenterStyle },
          { v: dia.diaSemana.charAt(0).toUpperCase() + dia.diaSemana.slice(1), s: cellStyle },
          { v: dia.totalReguladas, s: dia.totalReguladas > 10 ? alertStyle : cellCenterStyle },
          { v: dia.vencidas, s: dia.vencidas > 0 ? alertStyle : cellCenterStyle },
          { v: dia.previsao?.descricaoClima || "-", s: cellStyle },
          { v: dia.previsao ? `${dia.previsao.temperaturaMax}°C` : "-", s: cellCenterStyle },
          { v: dia.previsao ? `${dia.previsao.temperaturaMin}°C` : "-", s: cellCenterStyle },
          { v: dia.previsao ? `${dia.previsao.probabilidadeChuva}%` : "-", s: cellCenterStyle },
          { v: dia.previsao?.velocidadeVento || "-", s: cellCenterStyle },
        ]);
      });

      const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
      wsResumo["!cols"] = [
        { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, 
        { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }
      ];
      wsResumo["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      // ===== ABA 2: DETALHAMENTO OS A OS =====
      const detalheData: any[][] = [
        [
          { v: "Número OS", s: headerStyle },
          { v: "Grupo Serviço", s: headerStyle },
          { v: "Tipo", s: headerStyle },
          { v: "Prazo", s: headerStyle },
          { v: "Data Vencimento", s: headerStyle },
          { v: "Hora Vencimento", s: headerStyle },
          { v: "Status", s: headerStyle },
          { v: "Município", s: headerStyle },
          { v: "Bairro", s: headerStyle },
          { v: "Endereço", s: headerStyle },
          { v: "Contrato", s: headerStyle },
          { v: "Valor", s: headerStyle },
          { v: "Dias p/ Vencer", s: headerStyle },
        ],
      ];

      // Ordenar reguladas por prazo
      const reguladasOrdenadas = [...ordensFiltradas].sort((a, b) => {
        if (!a.prazo) return 1;
        if (!b.prazo) return -1;
        return a.prazo.getTime() - b.prazo.getTime();
      });

      const hoje = startOfDay(new Date());

      reguladasOrdenadas.forEach((os) => {
        const prazoDate = os.prazo ? new Date(os.prazo) : null;
        const diasParaVencer = prazoDate 
          ? Math.ceil((startOfDay(prazoDate).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        
        const isVencida = diasParaVencer !== null && diasParaVencer < 0;
        const isHoje = diasParaVencer === 0;
        
        let statusVencimento = "-";
        let statusStyle = cellStyle;
        
        if (diasParaVencer !== null) {
          if (isVencida) {
            statusVencimento = "VENCIDA";
            statusStyle = alertStyle;
          } else if (isHoje) {
            statusVencimento = "VENCE HOJE";
            statusStyle = { ...cellCenterStyle, fill: { fgColor: { rgb: "FEF3C7" } }, font: { bold: true, color: { rgb: "D97706" } } };
          } else if (diasParaVencer <= 3) {
            statusVencimento = "PRÓXIMA";
            statusStyle = { ...cellCenterStyle, fill: { fgColor: { rgb: "DBEAFE" } } };
          } else {
            statusVencimento = "NO PRAZO";
          }
        }

        detalheData.push([
          { v: os.numero, s: cellStyle },
          { v: getGrupoServico(os.tipo), s: cellStyle },
          { v: os.tipo, s: cellCenterStyle },
          { v: prazoDate ? format(prazoDate, "dd/MM/yyyy HH:mm") : "-", s: cellCenterStyle },
          { v: prazoDate ? format(prazoDate, "dd/MM/yyyy") : "-", s: cellCenterStyle },
          { v: prazoDate ? format(prazoDate, "HH:mm") : "-", s: cellCenterStyle },
          { v: statusVencimento, s: statusStyle },
          { v: os.municipio || "-", s: cellStyle },
          { v: os.bairro || "-", s: cellStyle },
          { v: os.endereco || "-", s: cellStyle },
          { v: os.contrato_codigo || "-", s: cellStyle },
          { v: os.valor ? `R$ ${os.valor.toFixed(2)}` : "-", s: cellStyle },
          { v: diasParaVencer !== null ? diasParaVencer : "-", s: isVencida ? alertStyle : cellCenterStyle },
        ]);
      });

      const wsDetalhe = XLSX.utils.aoa_to_sheet(detalheData);
      wsDetalhe["!cols"] = [
        { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
        { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 14 }
      ];
      XLSX.utils.book_append_sheet(wb, wsDetalhe, "Detalhamento OSs");

      // ===== ABA 3: RESUMO POR DIA (detalhado) =====
      const porDiaData: any[][] = [];

      diasCalendario.forEach((dia, index) => {
        if (index > 0) {
          porDiaData.push([]); // linha vazia entre dias
        }

        const dataFormatada = format(dia.data, "dd/MM/yyyy (EEEE)", { locale: ptBR });
        
        // Agrupar por grupo de serviço
        const porGrupo = dia.reguladas.reduce((acc, os) => {
          const grupo = getGrupoServico(os.tipo);
          acc[grupo] = (acc[grupo] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const resumoGrupos = Object.entries(porGrupo)
          .sort((a, b) => b[1] - a[1])
          .map(([g, c]) => `${g}: ${c}`)
          .join(" | ");

        porDiaData.push([
          { v: `📅 ${dataFormatada}`, s: { ...headerStyle, fill: { fgColor: { rgb: "059669" } } } },
          { v: `${dia.totalReguladas} reguladas`, s: { ...headerStyle, fill: { fgColor: { rgb: dia.totalReguladas > 10 ? "DC2626" : "059669" } } } },
          { v: dia.previsao ? `${dia.previsao.icone} ${dia.previsao.descricaoClima}` : "", s: { ...headerStyle, fill: { fgColor: { rgb: "059669" } } } },
        ]);

        if (dia.reguladas.length > 0 && resumoGrupos) {
          porDiaData.push([
            { v: `Grupos: ${resumoGrupos}`, s: { font: { italic: true, color: { rgb: "666666" } } } },
          ]);
        }

        if (dia.reguladas.length === 0) {
          porDiaData.push([{ v: "Nenhuma regulada vencendo neste dia", s: { font: { italic: true, color: { rgb: "666666" } } } }]);
        } else {
          porDiaData.push([
            { v: "Número", s: { font: { bold: true } } },
            { v: "Grupo Serviço", s: { font: { bold: true } } },
            { v: "Tipo", s: { font: { bold: true } } },
            { v: "Horário Limite", s: { font: { bold: true } } },
            { v: "Município", s: { font: { bold: true } } },
            { v: "Endereço", s: { font: { bold: true } } },
          ]);

          dia.reguladas.forEach((os) => {
            porDiaData.push([
              { v: os.numero, s: cellStyle },
              { v: getGrupoServico(os.tipo), s: cellStyle },
              { v: os.tipo, s: cellStyle },
              { v: os.prazo ? format(os.prazo, "HH:mm") : "-", s: cellCenterStyle },
              { v: os.municipio || "-", s: cellStyle },
              { v: os.endereco || "-", s: cellStyle },
            ]);
          });
        }
      });

      const wsPorDia = XLSX.utils.aoa_to_sheet(porDiaData);
      wsPorDia["!cols"] = [{ wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, wsPorDia, "Por Dia");

      // Gerar arquivo
      const dataAtual = format(new Date(), "yyyy-MM-dd_HH-mm");
      const nomeArquivo = `calendario_reguladas_${dataAtual}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);

      toast.success(`Exportado com sucesso: ${nomeArquivo}`);
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar calendário");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[92vh] h-[92vh] overflow-hidden z-[1000] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Calendar className="h-6 w-6" />
            Calendário de Reguladas Vencendo
          </DialogTitle>
          <DialogDescription className="text-sm">
            Visualização das notas reguladas vencendo nos próximos 10 dias por território e município.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros e Exportar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <Select
                value={territorioSelecionado}
                onValueChange={setTerritorioSelecionado}
              >
                <SelectTrigger className="w-[220px] h-10">
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
                            className="w-4 h-4 rounded-full"
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
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <Select
                value={municipioSelecionado}
                onValueChange={setMunicipioSelecionado}
              >
                <SelectTrigger className="w-[220px] h-10">
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

          <Button
            onClick={handleExportar}
            disabled={ordensFiltradas.length === 0}
            variant="outline"
            className="gap-2 h-10"
          >
            <Download className="h-5 w-5" />
            Exportar Excel
          </Button>
        </div>

        {/* Resumo + Localização */}
        <div className="flex items-center justify-between gap-6 mb-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="font-bold text-xl text-blue-700">{totalReguladas}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-sm text-muted-foreground">Hoje:</span>
              <span className="font-bold text-xl text-amber-700">{totalVencendoHoje}</span>
            </div>
            {totalVencidas > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="font-bold text-xl text-red-700">{totalVencidas} vencidas</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 border border-green-200">
              <span className="text-sm text-muted-foreground">10 dias:</span>
              <span className="font-bold text-xl text-green-700">{totalProximos10Dias}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Cloud className="h-5 w-5" />
            <Badge variant="outline" className="text-sm py-1 px-3">
              <MapPin className="h-4 w-4 mr-1" />
              {localizacaoPrevisao}
            </Badge>
          </div>
        </div>

        {/* Calendário - 10 dias em linha, flexível */}
        <div className="flex-1 grid grid-cols-5 lg:grid-cols-10 gap-3 min-h-0">
          {diasCalendario.map((dia) => (
            <div
              key={dia.dataStr}
              className={cn(
                "rounded-xl border-2 p-3 transition-all hover:shadow-lg cursor-pointer flex flex-col",
                getStatusCor(dia),
                dia.previsao && getCorClima(dia.previsao.codigoClima)
              )}
            >
              {/* Cabeçalho: Dia da Semana + Data */}
              <div className="text-center mb-2">
                <div className="text-xs text-muted-foreground capitalize">
                  {dia.diaSemana.substring(0, 3)}
                </div>
                <div className="font-bold text-lg flex items-center justify-center gap-1">
                  {dia.diaNumero}
                  {isToday(dia.data) && (
                    <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-semibold">
                      HOJE
                    </span>
                  )}
                </div>
              </div>

              {/* Quantidade - DESTACADO */}
              <div className="flex justify-center mb-2">
                <div className={cn(
                  "flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xl min-w-[60px]",
                  dia.totalReguladas === 0 && "bg-gray-100 text-gray-400 text-lg",
                  dia.totalReguladas > 0 && dia.totalReguladas <= 5 && "bg-blue-200 text-blue-800",
                  dia.totalReguladas > 5 && dia.totalReguladas <= 10 && "bg-amber-200 text-amber-800",
                  dia.totalReguladas > 10 && "bg-red-200 text-red-800 animate-pulse"
                )}>
                  <Zap className="h-5 w-5" />
                  {dia.totalReguladas}
                </div>
              </div>

              {/* Vencidas */}
              {dia.vencidas > 0 && (
                <div className="text-center mb-2">
                  <span className="text-xs bg-red-600 text-white px-2 py-1 rounded font-bold">
                    ⚠️ {dia.vencidas} vencidas
                  </span>
                </div>
              )}

              {/* Previsão do Tempo - CENTRALIZADA */}
              {dia.previsao && !carregandoPrevisao && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-2">
                  {/* Ícone grande */}
                  <div className="text-5xl leading-none mb-2">{dia.previsao.icone}</div>
                  
                  {/* Temperaturas grandes */}
                  <div className="flex items-center justify-center gap-1 text-lg font-bold">
                    <span className="text-red-600">{dia.previsao.temperaturaMax}°</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-blue-600">{dia.previsao.temperaturaMin}°</span>
                  </div>
                  
                  {/* Probabilidade de chuva */}
                  {dia.previsao.probabilidadeChuva > 0 && (
                    <div className="text-sm text-blue-600 flex items-center justify-center gap-1 mt-1.5">
                      <Droplets className="h-4 w-4" />
                      <span className="font-medium">{dia.previsao.probabilidadeChuva}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Grupos - INFERIOR */}
              {dia.totalReguladas > 0 && (
                <div className="mt-auto pt-2 border-t border-gray-300/50">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {Object.entries(
                      dia.reguladas.reduce((acc, os) => {
                        const grupo = getGrupoServico(os.tipo);
                        acc[grupo] = (acc[grupo] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    )
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([grupo, count]) => (
                      <span
                        key={grupo}
                        className="text-[10px] bg-white/90 border rounded px-1.5 py-0.5 truncate max-w-[80px]"
                        title={`${grupo}: ${count}`}
                      >
                        {grupo.substring(0, 8)}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div className="mt-4 pt-3 border-t flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
          <span className="font-semibold">Legenda:</span>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-200 border border-blue-300" />
            <span>1-5 reguladas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber-200 border border-amber-300" />
            <span>6-10 reguladas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-red-200 border border-red-300" />
            <span>+10 reguladas</span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-500" />
            <span>Probabilidade de chuva</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
