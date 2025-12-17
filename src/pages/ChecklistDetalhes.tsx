import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  ClipboardCheck,
  ArrowLeft,
  Calendar,
  User,
  FileText,
  CheckCircle,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ZoomIn,
  Loader2,
  Download,
  Package,
  Hash,
  FileDown,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

interface Pergunta {
  id: string;
  texto: string;
  tipo: string;
  obrigatoria: boolean;
  ordem: number;
}

interface GrupoPerguntas {
  id: string;
  nome: string;
  ordem: number;
  perguntas: Pergunta[];
}

interface FotoData {
  url: string;
  latitude?: number;
  longitude?: number;
  dataHora?: string;
  data_hora?: string;
}

interface FotoViewer {
  open: boolean;
  fotos: FotoData[];
  currentIndex: number;
  titulo?: string;
}

interface MaterialEntrega {
  material_id: string;
  quantidade: number;
  numero_serie?: string;
  materiais?: {
    codigo: string;
    nome: string;
    unidade: string;
  };
}

export default function ChecklistDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [fotoViewer, setFotoViewer] = useState<FotoViewer>({
    open: false,
    fotos: [],
    currentIndex: 0,
  });
  const [geratingPdf, setGeratingPdf] = useState(false);
  const [autoPrintExecuted, setAutoPrintExecuted] = useState(false);

  // Query 1: Dados básicos (RÁPIDA) - carrega primeiro para mostrar o header
  const { data: dadosBasicos, isLoading: loadingBasicos } = useQuery({
    queryKey: ["checklist-basico", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_respostas")
        .select(`
          id,
          status,
          created_at,
          checklist_id,
          codigo_unico,
          checklists (id, nome, tipo, grupos, perguntas),
          ordens_servico (id, numero, tipo, endereco, cliente_nome),
          tecnicos:equipe_id (id, codigo, nome)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Query 2: Só as respostas (o mais pesado)
  const { data: respostasData, isLoading: loadingRespostas } = useQuery({
    queryKey: ["checklist-respostas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_respostas")
        .select("respostas")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data?.respostas;
    },
    enabled: !!id,
  });

  // Query 3: Buscar materiais da entrega (se for checklist de recebimento)
  const { data: materiaisEntrega } = useQuery({
    queryKey: ["checklist-materiais-entrega", id, dadosBasicos?.tecnicos, dadosBasicos?.created_at],
    queryFn: async () => {
      // Buscar a entrega mais recente confirmada para esta equipe próxima à data do checklist
      const equipeId = (dadosBasicos?.tecnicos as any)?.id;
      const dataChecklist = dadosBasicos?.created_at;
      
      if (!equipeId || !dataChecklist) return null;

      // Buscar entregas confirmadas para esta equipe
      const { data: entregas, error: entregasError } = await supabase
        .from("materiais_entregas")
        .select("id, data_entrega, data_confirmacao, observacao")
        .eq("equipe_id", equipeId)
        .eq("status", "confirmado")
        .order("data_confirmacao", { ascending: false })
        .limit(5);

      if (entregasError || !entregas || entregas.length === 0) {
        return null;
      }

      // Encontrar a entrega mais próxima da data do checklist
      const dataCheck = new Date(dataChecklist).getTime();
      let entregaMaisProxima = entregas[0];
      let menorDiferenca = Math.abs(new Date(entregas[0].data_confirmacao || entregas[0].data_entrega).getTime() - dataCheck);
      
      for (const entrega of entregas) {
        const dataEntrega = new Date(entrega.data_confirmacao || entrega.data_entrega).getTime();
        const diferenca = Math.abs(dataEntrega - dataCheck);
        if (diferenca < menorDiferenca) {
          menorDiferenca = diferenca;
          entregaMaisProxima = entrega;
        }
      }

      // Buscar itens da entrega
      const { data: itens, error } = await supabase
        .from("materiais_entregas_itens")
        .select(`
          material_id,
          quantidade,
          numero_serie,
          materiais (codigo, nome, unidade)
        `)
        .eq("entrega_id", entregaMaisProxima.id);

      if (error) {
        console.error("Erro ao buscar materiais:", error);
        return null;
      }

      return { 
        itens: itens as MaterialEntrega[], 
        entrega: entregaMaisProxima 
      };
    },
    enabled: !!id && !!dadosBasicos && dadosBasicos?.checklists?.tipo === "recebimento_materiais",
  });

  // Função para gerar HTML das fotos
  const gerarHtmlFotos = (fotos: any[]) => {
    if (!fotos || fotos.length === 0) return '';
    return `
      <div class="fotos-grid">
        ${fotos.map((foto, idx) => `
          <div class="foto-item">
            <img src="${foto.url}" alt="Foto ${idx + 1}" />
            ${foto.data_hora || foto.dataHora ? `<p class="foto-info">📅 ${foto.data_hora || foto.dataHora}</p>` : ''}
            ${foto.latitude && foto.longitude ? `<p class="foto-info">📍 ${foto.latitude.toFixed(4)}, ${foto.longitude.toFixed(4)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  };

  // Função para gerar HTML da assinatura
  const gerarHtmlAssinatura = (assinaturaUrl: string, dataHora?: string, lat?: number, lng?: number) => {
    if (!assinaturaUrl) return '';
    return `
      <div class="assinatura-container">
        <img src="${assinaturaUrl}" alt="Assinatura" class="assinatura-img" />
        ${dataHora ? `<p class="foto-info">📅 ${dataHora}</p>` : ''}
        ${lat && lng ? `<p class="foto-info">📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>` : ''}
      </div>
    `;
  };

  // Função para gerar PDF
  const handleGerarPDF = async () => {
    setGeratingPdf(true);
    toast.loading("Gerando PDF...", { id: "pdf" });

    try {
      const codigoUnico = (dadosBasicos as any)?.codigo_unico || '-';
      const nomeChecklist = dadosBasicos?.checklists?.nome || 'Checklist';
      const dataChecklist = dadosBasicos?.created_at 
        ? format(new Date(dadosBasicos.created_at), "dd/MM/yyyy HH:mm")
        : '';

      // Gerar conteúdo das perguntas com fotos
      let perguntasHtml = '';
      if (grupos && grupos.length > 0) {
        perguntasHtml = grupos.map(grupo => {
          const perguntasContent = grupo.perguntas.map((pergunta, idx) => {
            const resposta = respostasMap[pergunta.id];
            let respostaHtml = '<span style="color: #999;">Não respondida</span>';
            
            if (resposta) {
              if (pergunta.tipo === 'foto') {
                const fotos = resposta.fotos || [];
                if (fotos.length > 0) {
                  respostaHtml = gerarHtmlFotos(fotos);
                } else if (resposta.foto_url) {
                  respostaHtml = gerarHtmlFotos([{ url: resposta.foto_url, data_hora: resposta.foto_data_hora, latitude: resposta.foto_latitude, longitude: resposta.foto_longitude }]);
                } else {
                  respostaHtml = '<span style="color: #999;">Sem foto</span>';
                }
              } else if (pergunta.tipo === 'assinatura') {
                if (resposta.assinatura_url) {
                  respostaHtml = gerarHtmlAssinatura(resposta.assinatura_url, resposta.assinatura_data_hora, resposta.assinatura_latitude, resposta.assinatura_longitude);
                } else {
                  respostaHtml = '<span style="color: #999;">Sem assinatura</span>';
                }
              } else if (pergunta.tipo === 'sim_nao') {
                respostaHtml = resposta.resposta === 'sim'
                  ? '<span class="badge badge-green">Sim</span>'
                  : resposta.resposta === 'nao'
                    ? '<span class="badge badge-red">Não</span>'
                    : String(resposta.resposta || '-');
              } else {
                respostaHtml = String(resposta.resposta || '-');
              }
            }

            return `
              <div class="pergunta">
                <div class="pergunta-texto">
                  <span class="pergunta-numero">${grupo.ordem || 1}.${idx + 1}</span>
                  ${pergunta.texto}
                </div>
                <div class="pergunta-resposta">${respostaHtml}</div>
              </div>
            `;
          }).join('');

          return `
            <div class="section">
              <div class="section-header">${grupo.nome}</div>
              <div class="section-content">${perguntasContent}</div>
            </div>
          `;
        }).join('');
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Checklist #${codigoUnico} - ${nomeChecklist}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
                color: #333;
                font-size: 12px;
              }
              .header { 
                border-bottom: 2px solid #7c3aed; 
                padding-bottom: 15px; 
                margin-bottom: 20px; 
              }
              .header h1 { 
                color: #7c3aed; 
                font-size: 18px;
                margin-bottom: 5px;
              }
              .header .codigo {
                background: #7c3aed;
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                display: inline-block;
                margin-right: 10px;
              }
              .header .info { 
                color: #666; 
                font-size: 11px;
              }
              .info-grid { 
                display: grid; 
                grid-template-columns: repeat(4, 1fr); 
                gap: 15px; 
                margin-bottom: 20px;
              }
              .info-card { 
                border: 1px solid #e5e7eb; 
                padding: 10px; 
                border-radius: 6px;
              }
              .info-card label { 
                color: #666; 
                font-size: 10px; 
                display: block;
                margin-bottom: 3px;
              }
              .info-card p { 
                font-weight: bold; 
                font-size: 12px;
              }
              .section { 
                margin-bottom: 20px; 
                border: 1px solid #e5e7eb; 
                border-radius: 6px;
                overflow: hidden;
                page-break-inside: avoid;
              }
              .section-header { 
                background: #f9fafb; 
                padding: 10px 15px; 
                border-bottom: 1px solid #e5e7eb;
                font-weight: bold;
              }
              .section-content { padding: 15px; }
              .pergunta { 
                border-bottom: 1px solid #f3f4f6; 
                padding: 10px 0;
                page-break-inside: avoid;
              }
              .pergunta:last-child { border-bottom: none; }
              .pergunta-numero { 
                background: #e5e7eb; 
                padding: 2px 6px; 
                border-radius: 4px; 
                font-size: 10px;
                margin-right: 8px;
              }
              .pergunta-texto { font-weight: 500; margin-bottom: 5px; }
              .pergunta-resposta { 
                margin-left: 30px; 
                padding: 8px;
                background: #f9fafb;
                border-radius: 4px;
              }
              .badge { 
                display: inline-block; 
                padding: 2px 8px; 
                border-radius: 4px; 
                font-size: 10px;
                font-weight: bold;
              }
              .badge-green { background: #dcfce7; color: #166534; }
              .badge-red { background: #fee2e2; color: #991b1b; }
              .fotos-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
              }
              .foto-item {
                max-width: 200px;
              }
              .foto-item img {
                max-width: 100%;
                height: auto;
                border-radius: 4px;
                border: 1px solid #e5e7eb;
              }
              .foto-info {
                font-size: 9px;
                color: #666;
                margin-top: 2px;
              }
              .assinatura-container {
                max-width: 300px;
              }
              .assinatura-img {
                max-width: 100%;
                height: auto;
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                background: white;
                padding: 5px;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin: 10px 0;
              }
              th, td { 
                border: 1px solid #e5e7eb; 
                padding: 8px; 
                text-align: left;
                font-size: 11px;
              }
              th { background: #f9fafb; font-weight: bold; }
              .footer {
                margin-top: 30px;
                padding-top: 15px;
                border-top: 1px solid #e5e7eb;
                text-align: center;
                color: #666;
                font-size: 10px;
              }
              @media print {
                body { padding: 10px; }
                .section { page-break-inside: avoid; }
                .foto-item img { max-height: 150px; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>
                <span class="codigo">#${codigoUnico}</span>
                ${nomeChecklist}
              </h1>
              <p class="info">
                Tipo: ${dadosBasicos?.checklists?.tipo?.toUpperCase() || '-'} | 
                Data: ${dataChecklist} |
                Status: ${dadosBasicos?.status === 'completo' ? 'Completo' : 'Rascunho'}
              </p>
            </div>

            <div class="info-grid">
              <div class="info-card">
                <label>Código Único</label>
                <p>#${codigoUnico}</p>
              </div>
              <div class="info-card">
                <label>Ordem de Serviço</label>
                <p>${dadosBasicos?.ordens_servico?.numero ? '#' + dadosBasicos.ordens_servico.numero : '-'}</p>
              </div>
              <div class="info-card">
                <label>Equipe</label>
                <p>${(dadosBasicos?.tecnicos as any)?.codigo || '-'}</p>
              </div>
              <div class="info-card">
                <label>Data/Hora</label>
                <p>${dataChecklist}</p>
              </div>
            </div>

            ${dadosBasicos?.ordens_servico?.endereco ? `
              <div class="section">
                <div class="section-header">Endereço</div>
                <div class="section-content">
                  <p>${dadosBasicos.ordens_servico.endereco}</p>
                  ${dadosBasicos.ordens_servico.cliente_nome ? `<p style="color: #666; margin-top: 5px;">Cliente: ${dadosBasicos.ordens_servico.cliente_nome}</p>` : ''}
                </div>
              </div>
            ` : ''}

            ${materiaisEntrega?.itens && materiaisEntrega.itens.length > 0 ? `
              <div class="section">
                <div class="section-header">📦 Materiais Recebidos</div>
                <div class="section-content">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Material</th>
                        <th>Quantidade</th>
                        <th>Nº Série</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${materiaisEntrega.itens.map(item => `
                        <tr>
                          <td>${item.materiais?.codigo || '-'}</td>
                          <td>${item.materiais?.nome || '-'}</td>
                          <td>${item.quantidade} ${item.materiais?.unidade || ''}</td>
                          <td>${item.numero_serie || '-'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}

            ${perguntasHtml}

            <div class="footer">
              <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
              <p>Checklist #${codigoUnico} - Sistema de Gestão</p>
            </div>
          </body>
        </html>
      `;

      // Criar blob e fazer download automático
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // Abrir janela de impressão
      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        throw new Error("Não foi possível abrir a janela. Verifique se popups estão habilitados.");
      }

      // Aguardar carregamento e imprimir automaticamente
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
      
      toast.success("PDF gerado! Use Ctrl+P para salvar como PDF.", { id: "pdf" });
      setGeratingPdf(false);

    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      toast.error(error.message || "Erro ao gerar PDF", { id: "pdf" });
      setGeratingPdf(false);
    }
  };

  // Abrir visualizador de fotos
  const abrirFotoViewer = (fotos: any[], index: number = 0, titulo?: string) => {
    if (!fotos || fotos.length === 0) {
      toast.error("Nenhuma foto disponível");
      return;
    }
    
    setFotoViewer({
      open: true,
      fotos: fotos.map((f: any) => ({
        url: f.url || f,
        latitude: f.latitude,
        longitude: f.longitude,
        dataHora: f.dataHora || f.data_hora,
      })),
      currentIndex: index,
      titulo,
    });
  };

  // Renderizar coordenadas clicáveis (abre no Google Maps)
  const renderCoordenadasCopiavel = (lat?: number, lng?: number, dataHora?: string) => {
    if (!lat && !lng && !dataHora) return null;
    
    const coordsText = lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : null;
    
    const handleCopy = (e: React.MouseEvent, text: string) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(text);
      toast.success("Copiado!");
    };

    const abrirNoMaps = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (lat && lng) {
        const url = `https://www.google.com/maps?q=${lat},${lng}&z=18`;
        window.open(url, '_blank');
      }
    };

    return (
      <div className="mt-1 space-y-0.5" onClick={(e) => e.stopPropagation()}>
        {dataHora && (
          <p 
            className="text-[10px] text-muted-foreground font-mono cursor-pointer hover:text-foreground"
            onClick={(e) => handleCopy(e, dataHora)}
            title="Clique para copiar"
          >
            📅 {dataHora}
          </p>
        )}
        {coordsText && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-[10px] text-blue-600 font-mono cursor-pointer hover:text-blue-800 hover:underline flex items-center gap-1"
              onClick={abrirNoMaps}
              title="Abrir no Google Maps"
            >
              📍 {coordsText}
            </button>
            <button
              type="button"
              className="text-[9px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted"
              onClick={(e) => handleCopy(e, coordsText)}
              title="Copiar coordenadas"
            >
              📋
            </button>
          </div>
        )}
      </div>
    );
  };

  // Renderizar valor da resposta
  const renderValorResposta = (pergunta: Pergunta, respostaItem: any) => {
    if (!respostaItem) return <span className="text-muted-foreground">Não respondida</span>;

    const valor = respostaItem.resposta;
    const fotoUrl = respostaItem.foto_url;
    const fotos = respostaItem.fotos;
    const assinaturaUrl = respostaItem.assinatura_url;
    const observacao = respostaItem.observacao;
    const fotoLat = respostaItem.foto_latitude;
    const fotoLng = respostaItem.foto_longitude;
    const fotoDataHora = respostaItem.foto_data_hora;
    const assLat = respostaItem.assinatura_latitude;
    const assLng = respostaItem.assinatura_longitude;
    const assDataHora = respostaItem.assinatura_data_hora;

    const handleFotoClick = (e: React.MouseEvent, fotosArray: any[], index: number, titulo: string) => {
      e.preventDefault();
      e.stopPropagation();
      abrirFotoViewer(fotosArray, index, titulo);
    };

    return (
      <div className="space-y-2">
        {pergunta.tipo === "foto" ? (
          fotos && fotos.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {fotos.map((foto: any, index: number) => (
                <div key={index} className="flex flex-col">
                  <button
                    type="button"
                    className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
                    onClick={(e) => handleFotoClick(e, fotos, index, pergunta.texto)}
                  >
                    <img 
                      src={foto.url} 
                      alt={`Foto ${index + 1}`} 
                      className="w-32 h-28 object-cover rounded border-2 border-gray-200 hover:border-violet-500 transition-all shadow-sm hover:shadow-md" 
                      loading="lazy"
                    />
                    <span className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                      {index + 1}
                    </span>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded flex items-center justify-center">
                      <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
                    </div>
                  </button>
                  {renderCoordenadasCopiavel(foto.latitude, foto.longitude, foto.data_hora || foto.dataHora)}
                </div>
              ))}
            </div>
          ) : fotoUrl ? (
            <button
              type="button"
              className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
              onClick={(e) => handleFotoClick(e, [{ url: fotoUrl, latitude: fotoLat, longitude: fotoLng, dataHora: fotoDataHora }], 0, pergunta.texto)}
            >
              <img 
                src={fotoUrl} 
                alt="Foto" 
                className="w-40 h-32 object-cover rounded border-2 border-gray-200 hover:border-violet-500 transition-all shadow-sm hover:shadow-md" 
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
              </div>
              {renderCoordenadasCopiavel(fotoLat, fotoLng, fotoDataHora)}
            </button>
          ) : (
            <span className="text-muted-foreground">Sem foto</span>
          )
        ) : pergunta.tipo === "assinatura" ? (
          assinaturaUrl ? (
            <button
              type="button"
              className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
              onClick={(e) => handleFotoClick(e, [{ url: assinaturaUrl, latitude: assLat, longitude: assLng, dataHora: assDataHora }], 0, "Assinatura")}
            >
              <img 
                src={assinaturaUrl} 
                alt="Assinatura" 
                className="w-56 h-28 object-contain bg-white border-2 border-gray-200 hover:border-violet-500 rounded transition-all shadow-sm hover:shadow-md p-2" 
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all rounded flex items-center justify-center">
                <ZoomIn className="h-5 w-5 text-gray-600 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
              {renderCoordenadasCopiavel(assLat, assLng, assDataHora)}
            </button>
          ) : (
            <span className="text-muted-foreground">Sem assinatura</span>
          )
        ) : pergunta.tipo === "sim_nao" ? (
          valor === "sim" ? (
            <Badge className="bg-green-600">Sim</Badge>
          ) : valor === "nao" ? (
            <Badge variant="secondary">Não</Badge>
          ) : (
            <span className="text-muted-foreground">{String(valor)}</span>
          )
        ) : pergunta.tipo === "multipla_escolha" && Array.isArray(valor) ? (
          <div className="flex flex-wrap gap-1">
            {valor.map((v: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs">{v}</Badge>
            ))}
          </div>
        ) : pergunta.tipo === "conforme_nao_conforme" ? (
          valor === "conforme" ? (
            <Badge className="bg-green-600">Conforme</Badge>
          ) : (
            <Badge variant="destructive">Não Conforme</Badge>
          )
        ) : (
          <span>{String(valor || '-')}</span>
        )}

        {pergunta.tipo !== "foto" && (fotos && fotos.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium">📷 Fotos anexadas:</p>
            <div className="flex flex-wrap gap-4">
              {fotos.map((foto: any, index: number) => (
                <div key={index} className="flex flex-col">
                  <button
                    type="button"
                    className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
                    onClick={(e) => handleFotoClick(e, fotos, index, `${pergunta.texto} - Fotos`)}
                  >
                    <img 
                      src={foto.url} 
                      alt={`Foto ${index + 1}`} 
                      className="w-28 h-24 object-cover rounded border-2 border-gray-200 hover:border-violet-500 transition-all shadow-sm hover:shadow-md" 
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded flex items-center justify-center">
                      <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
                    </div>
                  </button>
                  {renderCoordenadasCopiavel(foto.latitude, foto.longitude, foto.data_hora || foto.dataHora)}
                </div>
              ))}
            </div>
          </div>
        ) : fotoUrl && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium">📷 Foto anexada:</p>
            <button
              type="button"
              className="relative group block focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
              onClick={(e) => handleFotoClick(e, [{ url: fotoUrl, latitude: fotoLat, longitude: fotoLng, dataHora: fotoDataHora }], 0, `${pergunta.texto} - Foto`)}
            >
              <img 
                src={fotoUrl} 
                alt="Foto anexada" 
                className="w-32 h-28 object-cover rounded border-2 border-gray-200 hover:border-violet-500 transition-all shadow-sm hover:shadow-md" 
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded flex items-center justify-center">
                <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
              </div>
            </button>
            {renderCoordenadasCopiavel(fotoLat, fotoLng, fotoDataHora)}
          </div>
        ))}

        {observacao && (
          <div className="mt-2 p-2 bg-muted rounded text-sm">
            <p className="text-xs text-muted-foreground mb-1">Observação:</p>
            <p>{observacao}</p>
          </div>
        )}
      </div>
    );
  };

  if (loadingBasicos) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!dadosBasicos) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6">
          <div className="text-center py-12">
            <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Checklist não encontrado</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/consulta-checklists")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const respostasMap = respostasData 
    ? (Array.isArray(respostasData) 
        ? respostasData.reduce((acc: any, r: any) => ({ ...acc, [r.pergunta_id]: r }), {})
        : respostasData)
    : {};

  const gruposOriginais = dadosBasicos?.checklists?.grupos as GrupoPerguntas[] | undefined;
  const perguntasOriginais = (dadosBasicos?.checklists as any)?.perguntas as Pergunta[] | undefined;
  
  const grupos: GrupoPerguntas[] | undefined = gruposOriginais && gruposOriginais.length > 0
    ? gruposOriginais
    : perguntasOriginais && perguntasOriginais.length > 0
      ? [{
          id: "grupo-unico",
          nome: dadosBasicos?.checklists?.nome || "Perguntas",
          ordem: 1,
          perguntas: perguntasOriginais.map((p: any, idx: number) => ({
            id: p.id || String(idx + 1),
            texto: p.texto,
            tipo: p.tipo,
            obrigatoria: p.obrigatorio || p.obrigatoria || false,
            ordem: p.ordem || idx + 1,
          })),
        }]
      : undefined;

  const codigoUnico = (dadosBasicos as any)?.codigo_unico;

  // Auto-print se parâmetro print=true estiver presente
  useEffect(() => {
    const shouldPrint = searchParams.get('print') === 'true';
    if (shouldPrint && !loadingBasicos && !loadingRespostas && dadosBasicos && !autoPrintExecuted) {
      setAutoPrintExecuted(true);
      // Aguardar um pouco para garantir que tudo foi renderizado
      setTimeout(() => {
        handleGerarPDF();
      }, 1000);
    }
  }, [searchParams, loadingBasicos, loadingRespostas, dadosBasicos, autoPrintExecuted]);

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6" ref={printRef}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => {
                if (window.history.length <= 1) {
                  window.close();
                } else {
                  navigate("/consulta-checklists");
                }
              }}
              title="Fechar / Voltar"
            >
              <X className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                {codigoUnico && (
                  <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-300 font-mono">
                    <Hash className="h-3 w-3 mr-1" />
                    {codigoUnico}
                  </Badge>
                )}
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <ClipboardCheck className="h-7 w-7 text-violet-600" />
                  {dadosBasicos.checklists?.nome || "Checklist"}
                </h1>
              </div>
              <p className="text-muted-foreground">
                {dadosBasicos.checklists?.tipo?.toUpperCase()} - Preenchido em {format(new Date(dadosBasicos.created_at), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleGerarPDF}
              disabled={geratingPdf}
            >
              {geratingPdf ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Gerar PDF
            </Button>
            <Badge className={dadosBasicos.status === "completo" ? "bg-green-600" : ""}>
              {dadosBasicos.status === "completo" ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completo
                </>
              ) : (
                "Rascunho"
              )}
            </Badge>
          </div>
        </div>

        {/* Informações Gerais */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {codigoUnico && (
            <Card className="bg-violet-50 border-violet-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-violet-600 mb-1">
                  <Hash className="h-4 w-4" />
                  Código Único
                </div>
                <p className="font-bold text-xl text-violet-700 font-mono">
                  #{codigoUnico}
                </p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                Ordem de Serviço
              </div>
              <p className="font-semibold">
                {dadosBasicos.ordens_servico ? (
                  <>#{dadosBasicos.ordens_servico.numero}</>
                ) : (
                  "-"
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <User className="h-4 w-4" />
                Equipe
              </div>
              <p className="font-semibold">
                {(dadosBasicos.tecnicos as any)?.codigo || "-"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                Data
              </div>
              <p className="font-semibold">
                {format(new Date(dadosBasicos.created_at), "dd/MM/yyyy HH:mm")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4" />
                Status
              </div>
              <Badge className={dadosBasicos.status === "completo" ? "bg-green-600" : ""}>
                {dadosBasicos.status === "completo" ? "Completo" : "Rascunho"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Endereço da OS */}
        {dadosBasicos.ordens_servico?.endereco && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                Endereço
              </div>
              <p>{dadosBasicos.ordens_servico.endereco}</p>
              {dadosBasicos.ordens_servico.cliente_nome && (
                <p className="text-sm text-muted-foreground mt-1">
                  Cliente: {dadosBasicos.ordens_servico.cliente_nome}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Materiais Recebidos (para checklist de recebimento) */}
        {materiaisEntrega?.itens && materiaisEntrega.itens.length > 0 && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                <Package className="h-5 w-5" />
                Materiais Recebidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Nº Série</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materiaisEntrega.itens.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono font-medium">
                        {item.materiais?.codigo || '-'}
                      </TableCell>
                      <TableCell>{item.materiais?.nome || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">
                          {item.quantidade} {item.materiais?.unidade || ''}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.numero_serie ? (
                          <Badge variant="outline" className="font-mono">
                            {item.numero_serie}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Respostas por Grupo */}
        {loadingRespostas ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                <p className="text-muted-foreground">Carregando respostas...</p>
              </div>
            </CardContent>
          </Card>
        ) : grupos && grupos.length > 0 ? (
          grupos.map((grupo: GrupoPerguntas) => (
            <Card key={grupo.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{grupo.nome}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {grupo.perguntas
                    ?.sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                    .map((pergunta, index) => {
                      const respostaItem = respostasMap[pergunta.id];
                      return (
                        <div key={pergunta.id} className="border-b pb-4 last:border-0 last:pb-0">
                          <div className="flex items-start gap-2 mb-2">
                            <Badge variant="outline" className="shrink-0">
                              {grupo.ordem || 1}.{index + 1}
                            </Badge>
                            <p className="text-sm font-medium">
                              {pergunta.texto}
                              {pergunta.obrigatoria && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </p>
                          </div>
                          <div className="ml-10">
                            {renderValorResposta(pergunta, respostaItem)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                Nenhuma pergunta encontrada neste checklist
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Visualizador de Fotos */}
      <Dialog open={fotoViewer.open} onOpenChange={(open) => setFotoViewer(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 max-h-[95vh] overflow-hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="text-white">
                {fotoViewer.titulo && (
                  <p className="font-medium text-sm">{fotoViewer.titulo}</p>
                )}
                <p className="text-xs opacity-70">
                  {fotoViewer.currentIndex + 1} de {fotoViewer.fotos.length}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setFotoViewer(prev => ({ ...prev, open: false }))}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="relative flex-1 flex items-center justify-center p-4 min-h-[300px]">
              {fotoViewer.fotos[fotoViewer.currentIndex]?.url && (
                <img
                  src={fotoViewer.fotos[fotoViewer.currentIndex].url}
                  alt={`Foto ${fotoViewer.currentIndex + 1}`}
                  className="max-w-full max-h-[50vh] object-contain rounded"
                />
              )}

              {fotoViewer.fotos.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white"
                    onClick={() => setFotoViewer(prev => ({
                      ...prev,
                      currentIndex: prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.fotos.length - 1
                    }))}
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white"
                    onClick={() => setFotoViewer(prev => ({
                      ...prev,
                      currentIndex: prev.currentIndex < prev.fotos.length - 1 ? prev.currentIndex + 1 : 0
                    }))}
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                </>
              )}
            </div>

            <div className="border-t border-white/10 p-4 bg-black/50">
              <div className="text-white text-center space-y-3">
                {fotoViewer.fotos[fotoViewer.currentIndex]?.dataHora && (
                  <p className="text-sm">
                    📅 {fotoViewer.fotos[fotoViewer.currentIndex].dataHora}
                  </p>
                )}

                {fotoViewer.fotos[fotoViewer.currentIndex]?.latitude && fotoViewer.fotos[fotoViewer.currentIndex]?.longitude && (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      className="text-sm font-mono cursor-pointer hover:underline text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      onClick={() => {
                        const foto = fotoViewer.fotos[fotoViewer.currentIndex];
                        const url = `https://www.google.com/maps?q=${foto.latitude},${foto.longitude}&z=18`;
                        window.open(url, '_blank');
                      }}
                      title="Abrir no Google Maps"
                    >
                      📍 {fotoViewer.fotos[fotoViewer.currentIndex].latitude?.toFixed(6)}, {fotoViewer.fotos[fotoViewer.currentIndex].longitude?.toFixed(6)}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-white/70 hover:text-white px-2 py-1 rounded hover:bg-white/20"
                      onClick={() => {
                        const foto = fotoViewer.fotos[fotoViewer.currentIndex];
                        navigator.clipboard.writeText(`${foto.latitude?.toFixed(6)}, ${foto.longitude?.toFixed(6)}`);
                        toast.success("Coordenadas copiadas!");
                      }}
                      title="Copiar coordenadas"
                    >
                      📋 Copiar
                    </button>
                  </div>
                )}

                {fotoViewer.fotos[fotoViewer.currentIndex]?.url && (
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 text-white border-0"
                      onClick={() => {
                        const url = fotoViewer.fotos[fotoViewer.currentIndex]?.url;
                        if (url) {
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `foto_${fotoViewer.currentIndex + 1}_${Date.now()}.jpg`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          toast.success("Download iniciado!");
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar imagem
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 text-white border-0"
                      onClick={() => {
                        const url = fotoViewer.fotos[fotoViewer.currentIndex]?.url;
                        if (url) {
                          const newWindow = window.open('', '_blank');
                          if (newWindow) {
                            newWindow.document.write(`
                              <!DOCTYPE html>
                              <html>
                                <head>
                                  <title>Imagem - Checklist</title>
                                  <style>
                                    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a1a; }
                                    img { max-width: 100%; max-height: 100vh; object-fit: contain; }
                                  </style>
                                </head>
                                <body>
                                  <img src="${url}" alt="Imagem do checklist" />
                                </body>
                              </html>
                            `);
                            newWindow.document.close();
                          }
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Abrir em nova guia
                    </Button>
                  </div>
                )}

                {fotoViewer.fotos.length > 1 && (
                  <div className="flex justify-center gap-2 mt-3 overflow-x-auto pb-1">
                    {fotoViewer.fotos.map((foto, index) => (
                      <button
                        key={index}
                        className={`shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all ${
                          index === fotoViewer.currentIndex
                            ? "border-white ring-1 ring-white"
                            : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                        onClick={() => setFotoViewer(prev => ({ ...prev, currentIndex: index }))}
                      >
                        <img
                          src={foto.url}
                          alt={`Miniatura ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
