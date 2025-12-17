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
import jsPDF from "jspdf";

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
      const { data, error } = await (supabase as any)
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
      const { data, error } = await (supabase as any)
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
    queryKey: ["checklist-materiais-entrega", id, (dadosBasicos as any)?.tecnicos, (dadosBasicos as any)?.created_at],
    queryFn: async () => {
      // Buscar a entrega mais recente confirmada para esta equipe próxima à data do checklist
      const equipeId = ((dadosBasicos as any)?.tecnicos as any)?.id;
      const dataChecklist = (dadosBasicos as any)?.created_at;
      
      if (!equipeId || !dataChecklist) return null;

      // Buscar entregas confirmadas para esta equipe
      const { data: entregas, error: entregasError } = await (supabase as any)
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
      const { data: itens, error } = await (supabase as any)
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
    enabled: !!id && !!dadosBasicos && (dadosBasicos as any)?.checklists?.tipo === "recebimento_materiais",
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
      const dados = dadosBasicos as any;
      const codigoUnico = dados?.codigo_unico || '-';
      const nomeChecklist = dados?.checklists?.nome || 'Checklist';
      const dataChecklist = dados?.created_at 
        ? format(new Date(dados.created_at), "dd/MM/yyyy HH:mm")
        : '';

      // Criar PDF com jsPDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Função auxiliar para adicionar nova página se necessário
      const checkNewPage = (height: number) => {
        if (yPos + height > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      // Função auxiliar para quebrar texto em linhas
      const splitText = (text: string, maxWidth: number) => {
        return pdf.splitTextToSize(text, maxWidth);
      };

      // Header
      pdf.setFillColor(124, 58, 237); // Violet
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 12, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`#${codigoUnico} - ${nomeChecklist}`, margin + 3, yPos + 8);
      yPos += 15;

      // Info line
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Tipo: ${dados?.checklists?.tipo?.toUpperCase() || '-'} | Data: ${dataChecklist} | Status: ${dados?.status === 'completo' ? 'Completo' : 'Rascunho'}`, margin, yPos);
      yPos += 8;

      // Linha divisória
      pdf.setDrawColor(124, 58, 237);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      // Info Cards
      const cardWidth = (pageWidth - 2 * margin - 9) / 4;
      const cards = [
        { label: 'Código Único', value: `#${codigoUnico}` },
        { label: 'Ordem de Serviço', value: dados?.ordens_servico?.numero ? `#${dados.ordens_servico.numero}` : '-' },
        { label: 'Equipe', value: dados?.tecnicos?.codigo || '-' },
        { label: 'Data/Hora', value: dataChecklist },
      ];

      cards.forEach((card, idx) => {
        const x = margin + idx * (cardWidth + 3);
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.3);
        pdf.rect(x, yPos, cardWidth, 14);
        
        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(7);
        pdf.text(card.label, x + 2, yPos + 4);
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(card.value, x + 2, yPos + 10);
        pdf.setFont('helvetica', 'normal');
      });
      yPos += 20;

      // Endereço (se houver)
      if (dados?.ordens_servico?.endereco) {
        checkNewPage(20);
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Endereço', margin + 3, yPos + 5);
        yPos += 10;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        const enderecoLines = splitText(dados.ordens_servico.endereco, pageWidth - 2 * margin - 6);
        enderecoLines.forEach((line: string) => {
          pdf.text(line, margin + 3, yPos);
          yPos += 4;
        });
        if (dados.ordens_servico.cliente_nome) {
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Cliente: ${dados.ordens_servico.cliente_nome}`, margin + 3, yPos);
          yPos += 4;
        }
        yPos += 5;
      }

      // Materiais Recebidos (se houver)
      if (materiaisEntrega?.itens && materiaisEntrega.itens.length > 0) {
        checkNewPage(30);
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('📦 Materiais Recebidos', margin + 3, yPos + 5);
        yPos += 12;

        // Tabela de materiais
        const colWidths = [30, 70, 30, 40];
        const headers = ['Código', 'Material', 'Qtd', 'Nº Série'];
        
        // Header da tabela
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
        pdf.setFontSize(8);
        let xPos = margin;
        headers.forEach((h, i) => {
          pdf.text(h, xPos + 2, yPos + 5);
          xPos += colWidths[i];
        });
        yPos += 8;

        // Linhas da tabela
        pdf.setFont('helvetica', 'normal');
        materiaisEntrega.itens.forEach((item) => {
          checkNewPage(7);
          pdf.setDrawColor(230, 230, 230);
          pdf.line(margin, yPos + 6, pageWidth - margin, yPos + 6);
          
          xPos = margin;
          const values = [
            item.materiais?.codigo || '-',
            (item.materiais?.nome || '-').substring(0, 35),
            `${item.quantidade} ${item.materiais?.unidade || ''}`,
            item.numero_serie || '-'
          ];
          values.forEach((v, i) => {
            pdf.text(v, xPos + 2, yPos + 4);
            xPos += colWidths[i];
          });
          yPos += 7;
        });
        yPos += 8;
      }

      // Perguntas e Respostas
      if (grupos && grupos.length > 0) {
        grupos.forEach((grupo) => {
          checkNewPage(20);
          
          // Header do grupo
          pdf.setFillColor(249, 250, 251);
          pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text(grupo.nome, margin + 3, yPos + 5);
          yPos += 12;

          grupo.perguntas.forEach((pergunta, idx) => {
            const resposta = respostasMap[pergunta.id];
            checkNewPage(15);

            // Número e texto da pergunta
            pdf.setFillColor(229, 231, 235);
            pdf.rect(margin, yPos, 10, 5, 'F');
            pdf.setFontSize(8);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`${grupo.ordem || 1}.${idx + 1}`, margin + 1, yPos + 3.5);
            
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            const perguntaLines = splitText(pergunta.texto, pageWidth - 2 * margin - 15);
            perguntaLines.forEach((line: string, lineIdx: number) => {
              pdf.text(line, margin + 12, yPos + 3.5 + (lineIdx * 4));
            });
            yPos += 5 + (perguntaLines.length - 1) * 4;

            // Resposta
            pdf.setFont('helvetica', 'normal');
            pdf.setFillColor(249, 250, 251);
            const respostaY = yPos + 2;
            
            let respostaTexto = 'Não respondida';
            let respostaCor: [number, number, number] = [150, 150, 150];
            
            if (resposta) {
              if (pergunta.tipo === 'foto') {
                const fotos = resposta.fotos || [];
                if (fotos.length > 0) {
                  respostaTexto = `${fotos.length} foto(s) anexada(s)`;
                  respostaCor = [0, 100, 0];
                  // Adicionar info das fotos
                  fotos.forEach((foto: any, fotoIdx: number) => {
                    checkNewPage(8);
                    pdf.setTextColor(...respostaCor);
                    pdf.text(`  📷 Foto ${fotoIdx + 1}`, margin + 15, respostaY + 4 + (fotoIdx * 5));
                    if (foto.data_hora || foto.dataHora) {
                      pdf.setTextColor(100, 100, 100);
                      pdf.setFontSize(7);
                      pdf.text(`     📅 ${foto.data_hora || foto.dataHora}`, margin + 15, respostaY + 7 + (fotoIdx * 5));
                    }
                    if (foto.latitude && foto.longitude) {
                      pdf.text(`     📍 ${foto.latitude.toFixed(4)}, ${foto.longitude.toFixed(4)}`, margin + 15, respostaY + 10 + (fotoIdx * 5));
                    }
                  });
                  yPos += fotos.length * 12;
                } else if (resposta.foto_url) {
                  respostaTexto = '1 foto anexada';
                  respostaCor = [0, 100, 0];
                } else {
                  respostaTexto = 'Sem foto';
                }
              } else if (pergunta.tipo === 'assinatura') {
                if (resposta.assinatura_url) {
                  respostaTexto = '✓ Assinatura registrada';
                  respostaCor = [0, 100, 0];
                  if (resposta.assinatura_data_hora) {
                    checkNewPage(8);
                    pdf.setTextColor(100, 100, 100);
                    pdf.setFontSize(7);
                    pdf.text(`     📅 ${resposta.assinatura_data_hora}`, margin + 15, respostaY + 7);
                    yPos += 4;
                  }
                } else {
                  respostaTexto = 'Sem assinatura';
                }
              } else if (pergunta.tipo === 'sim_nao') {
                if (resposta.resposta === 'sim') {
                  respostaTexto = '✓ Sim';
                  respostaCor = [22, 101, 52];
                } else if (resposta.resposta === 'nao') {
                  respostaTexto = '✗ Não';
                  respostaCor = [153, 27, 27];
                } else {
                  respostaTexto = String(resposta.resposta || '-');
                  respostaCor = [0, 0, 0];
                }
              } else {
                respostaTexto = String(resposta.resposta || '-');
                respostaCor = [0, 0, 0];
              }
            }

            pdf.rect(margin + 10, respostaY, pageWidth - 2 * margin - 10, 6, 'F');
            pdf.setTextColor(...respostaCor);
            pdf.setFontSize(9);
            const respostaLines = splitText(respostaTexto, pageWidth - 2 * margin - 15);
            respostaLines.forEach((line: string, lineIdx: number) => {
              pdf.text(line, margin + 12, respostaY + 4 + (lineIdx * 4));
            });
            
            yPos += 10 + (respostaLines.length - 1) * 4;
          });
          
          yPos += 5;
        });
      }

      // Footer
      checkNewPage(15);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(8);
      pdf.text(`Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;
      pdf.text(`Checklist #${codigoUnico} - Sistema de Gestão`, pageWidth / 2, yPos, { align: 'center' });

      // Salvar PDF
      pdf.save(`checklist_${codigoUnico}.pdf`);
      
      toast.success("PDF baixado com sucesso!", { id: "pdf" });
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

  // Preparar dados derivados (antes de qualquer return condicional)
  const respostasMap = respostasData 
    ? (Array.isArray(respostasData) 
        ? respostasData.reduce((acc: any, r: any) => ({ ...acc, [r.pergunta_id]: r }), {})
        : respostasData)
    : {};

  const dadosAny = dadosBasicos as any;
  const gruposOriginais = dadosAny?.checklists?.grupos as GrupoPerguntas[] | undefined;
  const perguntasOriginais = dadosAny?.checklists?.perguntas as Pergunta[] | undefined;
  
  const grupos: GrupoPerguntas[] | undefined = gruposOriginais && gruposOriginais.length > 0
    ? gruposOriginais
    : perguntasOriginais && perguntasOriginais.length > 0
      ? [{
          id: "grupo-unico",
          nome: dadosAny?.checklists?.nome || "Perguntas",
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

  const codigoUnico = dadosAny?.codigo_unico;

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

  // Loading inicial
  if (loadingBasicos) {
    return (
      <MainLayout title="Carregando...">
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

  // Checklist não encontrado
  if (!dadosBasicos) {
    return (
      <MainLayout title="Não encontrado">
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

  return (
    <MainLayout title={`Checklist #${codigoUnico || ''}`}>
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
                  {dadosAny.checklists?.nome || "Checklist"}
                </h1>
              </div>
              <p className="text-muted-foreground">
                {dadosAny.checklists?.tipo?.toUpperCase()} - Preenchido em {format(new Date(dadosAny.created_at), "dd/MM/yyyy 'às' HH:mm")}
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
            <Badge className={dadosAny.status === "completo" ? "bg-green-600" : ""}>
              {dadosAny.status === "completo" ? (
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
                {dadosAny.ordens_servico ? (
                  <>#{dadosAny.ordens_servico.numero}</>
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
                {dadosAny.tecnicos?.codigo || "-"}
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
                {format(new Date(dadosAny.created_at), "dd/MM/yyyy HH:mm")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4" />
                Status
              </div>
              <Badge className={dadosAny.status === "completo" ? "bg-green-600" : ""}>
                {dadosAny.status === "completo" ? "Completo" : "Rascunho"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Endereço da OS */}
        {dadosAny.ordens_servico?.endereco && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                Endereço
              </div>
              <p>{dadosAny.ordens_servico.endereco}</p>
              {dadosAny.ordens_servico.cliente_nome && (
                <p className="text-sm text-muted-foreground mt-1">
                  Cliente: {dadosAny.ordens_servico.cliente_nome}
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
