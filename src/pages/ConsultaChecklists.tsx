import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  Search,
  Calendar,
  CheckCircle,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Hash,
  FileDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

const ITEMS_PER_PAGE = 20;

interface ChecklistRespostaSimples {
  id: string;
  status: string;
  created_at: string;
  codigo_unico?: number;
  checklists?: {
    nome: string;
    tipo: string;
  } | null;
  ordens_servico?: {
    numero: string;
    tipo: string;
  } | null;
  tecnicos?: {
    codigo: string;
    nome: string;
  } | null;
}

// Função para gerar HTML do PDF
const gerarHtmlPdf = (dados: any, respostas: any, grupos: any[], materiaisEntrega: any) => {
  const codigoUnico = dados?.codigo_unico || '-';
  const nomeChecklist = dados?.checklists?.nome || 'Checklist';
  const dataChecklist = dados?.created_at 
    ? format(new Date(dados.created_at), "dd/MM/yyyy HH:mm")
    : '';

  const respostasMap = respostas 
    ? (Array.isArray(respostas) 
        ? respostas.reduce((acc: any, r: any) => ({ ...acc, [r.pergunta_id]: r }), {})
        : respostas)
    : {};

  // Gerar HTML das fotos
  const gerarHtmlFotos = (fotos: any[]) => {
    if (!fotos || fotos.length === 0) return '';
    return `
      <div style="display: flex; flex-wrap: wrap; gap: 10px;">
        ${fotos.map((foto, idx) => `
          <div style="max-width: 200px;">
            <img src="${foto.url}" alt="Foto ${idx + 1}" style="max-width: 100%; height: auto; border-radius: 4px; border: 1px solid #e5e7eb;" />
            ${foto.data_hora || foto.dataHora ? `<p style="font-size: 9px; color: #666; margin-top: 2px;">📅 ${foto.data_hora || foto.dataHora}</p>` : ''}
            ${foto.latitude && foto.longitude ? `<p style="font-size: 9px; color: #666;">📍 ${foto.latitude.toFixed(4)}, ${foto.longitude.toFixed(4)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  };

  // Gerar HTML da assinatura
  const gerarHtmlAssinatura = (assinaturaUrl: string, dataHora?: string, lat?: number, lng?: number) => {
    if (!assinaturaUrl) return '';
    return `
      <div style="max-width: 300px;">
        <img src="${assinaturaUrl}" alt="Assinatura" style="max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 4px; background: white; padding: 5px;" />
        ${dataHora ? `<p style="font-size: 9px; color: #666; margin-top: 2px;">📅 ${dataHora}</p>` : ''}
        ${lat && lng ? `<p style="font-size: 9px; color: #666;">📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>` : ''}
      </div>
    `;
  };

  // Gerar conteúdo das perguntas
  let perguntasHtml = '';
  if (grupos && grupos.length > 0) {
    perguntasHtml = grupos.map(grupo => {
      const perguntasContent = grupo.perguntas.map((pergunta: any, idx: number) => {
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
              ? '<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #dcfce7; color: #166534;">Sim</span>'
              : resposta.resposta === 'nao'
                ? '<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #fee2e2; color: #991b1b;">Não</span>'
                : String(resposta.resposta || '-');
          } else {
            respostaHtml = String(resposta.resposta || '-');
          }
        }

        return `
          <div style="border-bottom: 1px solid #f3f4f6; padding: 10px 0;">
            <div style="font-weight: 500; margin-bottom: 5px;">
              <span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 8px;">${grupo.ordem || 1}.${idx + 1}</span>
              ${pergunta.texto}
            </div>
            <div style="margin-left: 30px; padding: 8px; background: #f9fafb; border-radius: 4px;">${respostaHtml}</div>
          </div>
        `;
      }).join('');

      return `
        <div style="margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
          <div style="background: #f9fafb; padding: 10px 15px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${grupo.nome}</div>
          <div style="padding: 15px;">${perguntasContent}</div>
        </div>
      `;
    }).join('');
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Checklist #${codigoUnico} - ${nomeChecklist}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div style="border-bottom: 2px solid #7c3aed; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="color: #7c3aed; font-size: 18px; margin-bottom: 5px;">
            <span style="background: #7c3aed; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 10px;">#${codigoUnico}</span>
            ${nomeChecklist}
          </h1>
          <p style="color: #666; font-size: 11px;">
            Tipo: ${dados?.checklists?.tipo?.toUpperCase() || '-'} | 
            Data: ${dataChecklist} |
            Status: ${dados?.status === 'completo' ? 'Completo' : 'Rascunho'}
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
          <div style="border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px;">
            <label style="color: #666; font-size: 10px; display: block; margin-bottom: 3px;">Código Único</label>
            <p style="font-weight: bold; font-size: 12px;">#${codigoUnico}</p>
          </div>
          <div style="border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px;">
            <label style="color: #666; font-size: 10px; display: block; margin-bottom: 3px;">Ordem de Serviço</label>
            <p style="font-weight: bold; font-size: 12px;">${dados?.ordens_servico?.numero ? '#' + dados.ordens_servico.numero : '-'}</p>
          </div>
          <div style="border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px;">
            <label style="color: #666; font-size: 10px; display: block; margin-bottom: 3px;">Equipe</label>
            <p style="font-weight: bold; font-size: 12px;">${dados?.tecnicos?.codigo || '-'}</p>
          </div>
          <div style="border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px;">
            <label style="color: #666; font-size: 10px; display: block; margin-bottom: 3px;">Data/Hora</label>
            <p style="font-weight: bold; font-size: 12px;">${dataChecklist}</p>
          </div>
        </div>

        ${dados?.ordens_servico?.endereco ? `
          <div style="margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
            <div style="background: #f9fafb; padding: 10px 15px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Endereço</div>
            <div style="padding: 15px;">
              <p>${dados.ordens_servico.endereco}</p>
              ${dados.ordens_servico.cliente_nome ? `<p style="color: #666; margin-top: 5px;">Cliente: ${dados.ordens_servico.cliente_nome}</p>` : ''}
            </div>
          </div>
        ` : ''}

        ${materiaisEntrega?.itens && materiaisEntrega.itens.length > 0 ? `
          <div style="margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
            <div style="background: #f9fafb; padding: 10px 15px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">📦 Materiais Recebidos</div>
            <div style="padding: 15px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr>
                    <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 11px; background: #f9fafb;">Código</th>
                    <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 11px; background: #f9fafb;">Material</th>
                    <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 11px; background: #f9fafb;">Quantidade</th>
                    <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 11px; background: #f9fafb;">Nº Série</th>
                  </tr>
                </thead>
                <tbody>
                  ${materiaisEntrega.itens.map((item: any) => `
                    <tr>
                      <td style="border: 1px solid #e5e7eb; padding: 8px; font-size: 11px;">${item.materiais?.codigo || '-'}</td>
                      <td style="border: 1px solid #e5e7eb; padding: 8px; font-size: 11px;">${item.materiais?.nome || '-'}</td>
                      <td style="border: 1px solid #e5e7eb; padding: 8px; font-size: 11px;">${item.quantidade} ${item.materiais?.unidade || ''}</td>
                      <td style="border: 1px solid #e5e7eb; padding: 8px; font-size: 11px;">${item.numero_serie || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${perguntasHtml}

        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 10px;">
          <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
          <p>Checklist #${codigoUnico} - Sistema de Gestão</p>
        </div>
      </body>
    </html>
  `;
};

// Função para buscar dados completos de um checklist
const buscarDadosChecklist = async (id: string) => {
  // Buscar dados básicos
  const { data: dadosBasicos, error: errorBasicos } = await (supabase as any)
    .from("checklist_respostas")
    .select(`
      id,
      status,
      created_at,
      checklist_id,
      codigo_unico,
      respostas,
      checklists (id, nome, tipo, grupos, perguntas),
      ordens_servico (id, numero, tipo, endereco, cliente_nome),
      tecnicos:equipe_id (id, codigo, nome)
    `)
    .eq("id", id)
    .single();

  if (errorBasicos) throw errorBasicos;

  // Processar grupos
  const gruposOriginais = dadosBasicos?.checklists?.grupos as any[] | undefined;
  const perguntasOriginais = (dadosBasicos?.checklists as any)?.perguntas as any[] | undefined;
  
  const grupos = gruposOriginais && gruposOriginais.length > 0
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
      : [];

  // Buscar materiais se for recebimento
  let materiaisEntrega = null;
  if (dadosBasicos?.checklists?.tipo === "recebimento_materiais" && dadosBasicos?.tecnicos) {
    const equipeId = (dadosBasicos.tecnicos as any).id;
    
    const { data: entregas } = await (supabase as any)
      .from("materiais_entregas")
      .select("id, data_entrega, data_confirmacao")
      .eq("equipe_id", equipeId)
      .eq("status", "confirmado")
      .order("data_confirmacao", { ascending: false })
      .limit(1);

    if (entregas && entregas.length > 0) {
      const { data: itens } = await (supabase as any)
        .from("materiais_entregas_itens")
        .select(`
          material_id,
          quantidade,
          numero_serie,
          materiais (codigo, nome, unidade)
        `)
        .eq("entrega_id", entregas[0].id);

      materiaisEntrega = { itens: itens || [], entrega: entregas[0] };
    }
  }

  return { dadosBasicos, grupos, materiaisEntrega };
};

// Função para fazer download do PDF com texto selecionável
const downloadPdf = async (id: string, nomeArquivo: string) => {
  const { dadosBasicos, grupos, materiaisEntrega } = await buscarDadosChecklist(id);
  const respostasMap = dadosBasicos?.respostas 
    ? (Array.isArray(dadosBasicos.respostas) 
        ? dadosBasicos.respostas.reduce((acc: any, r: any) => ({ ...acc, [r.pergunta_id]: r }), {})
        : dadosBasicos.respostas)
    : {};

  const codigoUnico = dadosBasicos?.codigo_unico || '-';
  const nomeChecklist = dadosBasicos?.checklists?.nome || 'Checklist';
  const dataChecklist = dadosBasicos?.created_at 
    ? format(new Date(dadosBasicos.created_at), "dd/MM/yyyy HH:mm")
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
  pdf.text(`Tipo: ${dadosBasicos?.checklists?.tipo?.toUpperCase() || '-'} | Data: ${dataChecklist} | Status: ${dadosBasicos?.status === 'completo' ? 'Completo' : 'Rascunho'}`, margin, yPos);
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
    { label: 'Ordem de Serviço', value: dadosBasicos?.ordens_servico?.numero ? `#${dadosBasicos.ordens_servico.numero}` : '-' },
    { label: 'Equipe', value: (dadosBasicos?.tecnicos as any)?.codigo || '-' },
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
  if (dadosBasicos?.ordens_servico?.endereco) {
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
    const enderecoLines = splitText(dadosBasicos.ordens_servico.endereco, pageWidth - 2 * margin - 6);
    enderecoLines.forEach((line: string) => {
      pdf.text(line, margin + 3, yPos);
      yPos += 4;
    });
    if (dadosBasicos.ordens_servico.cliente_nome) {
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Cliente: ${dadosBasicos.ordens_servico.cliente_nome}`, margin + 3, yPos);
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
    pdf.text('Materiais Recebidos', margin + 3, yPos + 5);
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
    materiaisEntrega.itens.forEach((item: any) => {
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
    grupos.forEach((grupo: any) => {
      checkNewPage(20);
      
      // Header do grupo
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(grupo.nome, margin + 3, yPos + 5);
      yPos += 12;

      (grupo.perguntas || []).forEach((pergunta: any, idx: number) => {
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
              fotos.forEach((foto: any, fotoIdx: number) => {
                checkNewPage(8);
                pdf.setTextColor(...respostaCor);
                pdf.text(`  Foto ${fotoIdx + 1}`, margin + 15, respostaY + 4 + (fotoIdx * 5));
                if (foto.data_hora || foto.dataHora) {
                  pdf.setTextColor(100, 100, 100);
                  pdf.setFontSize(7);
                  pdf.text(`     ${foto.data_hora || foto.dataHora}`, margin + 15, respostaY + 7 + (fotoIdx * 5));
                }
                if (foto.latitude && foto.longitude) {
                  pdf.text(`     ${foto.latitude.toFixed(4)}, ${foto.longitude.toFixed(4)}`, margin + 15, respostaY + 10 + (fotoIdx * 5));
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
              respostaTexto = 'Assinatura registrada';
              respostaCor = [0, 100, 0];
              if (resposta.assinatura_data_hora) {
                checkNewPage(8);
                pdf.setTextColor(100, 100, 100);
                pdf.setFontSize(7);
                pdf.text(`     ${resposta.assinatura_data_hora}`, margin + 15, respostaY + 7);
                yPos += 4;
              }
            } else {
              respostaTexto = 'Sem assinatura';
            }
          } else if (pergunta.tipo === 'sim_nao') {
            if (resposta.resposta === 'sim') {
              respostaTexto = 'Sim';
              respostaCor = [22, 101, 52];
            } else if (resposta.resposta === 'nao') {
              respostaTexto = 'Não';
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
  pdf.save(nomeArquivo);
};

export default function ConsultaChecklists() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);

  // Buscar contagem total de registros
  const { data: totalCount } = useQuery({
    queryKey: ["checklist-respostas-count", filtroStatus],
    queryFn: async () => {
      let query = (supabase as any)
        .from("checklist_respostas")
        .select("id", { count: "exact", head: true });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Buscar respostas de checklists com paginação - QUERY LEVE
  const { data: respostas, isLoading } = useQuery({
    queryKey: ["checklist-respostas", filtroTipo, filtroStatus, currentPage, searchTerm],
    queryFn: async () => {
      // Se a busca começa com #, buscar por código único
      if (searchTerm.startsWith('#')) {
        const codigoNumero = parseInt(searchTerm.slice(1), 10);
        if (!isNaN(codigoNumero)) {
          const { data, error } = await (supabase as any)
            .from("checklist_respostas")
            .select(`
              id,
              status,
              created_at,
              codigo_unico,
              checklists (nome, tipo),
              ordens_servico (numero, tipo),
              tecnicos:equipe_id (codigo, nome)
            `)
            .eq("codigo_unico", codigoNumero);

          if (error) throw error;
          return data as ChecklistRespostaSimples[];
        }
      }

      // Query normal
      let query = (supabase as any)
        .from("checklist_respostas")
        .select(`
          id,
          status,
          created_at,
          codigo_unico,
          checklists (nome, tipo),
          ordens_servico (numero, tipo),
          tecnicos:equipe_id (codigo, nome)
        `)
        .order("created_at", { ascending: false })
        .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filtrar por tipo de checklist (client-side já que é só 20 registros)
      let resultado = data as ChecklistRespostaSimples[];
      if (filtroTipo !== "todos") {
        resultado = resultado.filter(r => r.checklists?.tipo === filtroTipo);
      }

      return resultado;
    },
  });

  // Buscar tipos de checklists disponíveis
  const { data: tiposChecklists } = useQuery({
    queryKey: ["tipos-checklists"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("checklists")
        .select("tipo")
        .order("tipo");

      if (error) throw error;

      const tipos = [...new Set(data.map((c: any) => c.tipo))];
      return tipos;
    },
  });

  // Filtrar por termo de busca (client-side) - exceto se começa com #
  const respostasFiltradas = respostas?.filter(r => {
    if (!searchTerm || searchTerm.startsWith('#')) return true;
    const termo = searchTerm.toLowerCase();
    return (
      r.checklists?.nome?.toLowerCase().includes(termo) ||
      r.ordens_servico?.numero?.toLowerCase().includes(termo) ||
      r.tecnicos?.codigo?.toLowerCase().includes(termo) ||
      r.tecnicos?.nome?.toLowerCase().includes(termo) ||
      r.codigo_unico?.toString().includes(termo)
    );
  });

  // Abrir detalhes em nova guia
  const abrirNovaGuia = (id: string) => {
    window.open(`/consulta-checklists/${id}`, '_blank');
  };

  // Abrir detalhes na guia atual
  const abrirGuiaAtual = (id: string) => {
    navigate(`/consulta-checklists/${id}`);
  };

  // Gerar PDF individual - download direto
  const gerarPdfIndividual = async (id: string, codigoUnico?: number) => {
    setGeneratingPdfId(id);
    toast.loading("Gerando PDF...", { id: `pdf-${id}` });

    try {
      const nomeArquivo = `checklist_${codigoUnico || id}.pdf`;
      await downloadPdf(id, nomeArquivo);
      toast.success("PDF baixado com sucesso!", { id: `pdf-${id}` });
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF", { id: `pdf-${id}` });
    }

    setGeneratingPdfId(null);
  };

  // Calcular total de páginas
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  // Resetar página quando filtros mudam
  const handleFiltroChange = (tipo: "tipo" | "status", valor: string) => {
    setCurrentPage(0);
    if (tipo === "tipo") {
      setFiltroTipo(valor);
    } else {
      setFiltroStatus(valor);
    }
  };

  // Selecionar/deselecionar item
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Selecionar todos da página
  const toggleSelectAll = () => {
    if (!respostasFiltradas) return;
    
    const todosIds = respostasFiltradas.map(r => r.id);
    const todosSelecionados = todosIds.every(id => selectedIds.has(id));
    
    if (todosSelecionados) {
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        todosIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        todosIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  };

  // Abrir selecionados em massa
  const handleAbrirMassa = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um checklist");
      return;
    }

    toast.loading(`Abrindo ${selectedIds.size} checklist(s)...`, { id: "abrir-massa" });

    try {
      for (const id of selectedIds) {
        window.open(`/consulta-checklists/${id}`, '_blank');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      toast.success(`${selectedIds.size} checklist(s) aberto(s)`, { id: "abrir-massa" });
    } catch (error) {
      toast.error("Erro ao abrir checklists", { id: "abrir-massa" });
    }
  };

  // Gerar PDF em massa - download direto
  const handleGerarPdfMassa = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um checklist");
      return;
    }

    setDownloadingPdf(true);
    toast.loading(`Gerando ${selectedIds.size} PDF(s)...`, { id: "pdf-massa" });

    try {
      let count = 0;
      for (const id of selectedIds) {
        const resposta = respostasFiltradas?.find(r => r.id === id);
        const nomeArquivo = `checklist_${resposta?.codigo_unico || id}.pdf`;
        await downloadPdf(id, nomeArquivo);
        count++;
        // Pequeno delay entre downloads
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      toast.success(`${count} PDF(s) baixado(s) com sucesso!`, { id: "pdf-massa" });
      setSelectedIds(new Set());
    } catch (error) {
      toast.error("Erro ao gerar PDFs", { id: "pdf-massa" });
    }

    setDownloadingPdf(false);
  };

  const todosNaPaginaSelecionados = respostasFiltradas?.length 
    ? respostasFiltradas.every(r => selectedIds.has(r.id))
    : false;

  return (
    <MainLayout title="Consulta de Checklists">
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-violet-600" />
            Consulta de Checklists
          </h1>
          <p className="text-muted-foreground">
            Visualize e analise os checklists preenchidos pelas equipes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleAbrirMassa}
            disabled={selectedIds.size === 0}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
          <Button
            onClick={handleGerarPdfMassa}
            disabled={downloadingPdf || selectedIds.size === 0}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {downloadingPdf ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Baixar PDF {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar... (use #número para buscar por código)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchTerm.startsWith('#') && (
                <p className="text-xs text-violet-600 mt-1 ml-1">
                  🔍 Buscando exclusivamente pelo código único #{searchTerm.slice(1)}
                </p>
              )}
            </div>
            <Select value={filtroTipo} onValueChange={(v) => handleFiltroChange("tipo", v)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {tiposChecklists?.map((tipo: string) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={(v) => handleFiltroChange("status", v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="completo">Completo</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Respostas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Checklists Preenchidos
              {totalCount !== undefined && !searchTerm.startsWith('#') && (
                <Badge variant="secondary" className="ml-2">
                  {totalCount}
                </Badge>
              )}
            </CardTitle>
            {totalPages > 1 && !searchTerm.startsWith('#') && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Página {currentPage + 1} de {totalPages}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : respostasFiltradas && respostasFiltradas.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={todosNaPaginaSelecionados}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-20">Código</TableHead>
                    <TableHead>Checklist</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {respostasFiltradas.map((resposta) => (
                    <TableRow 
                      key={resposta.id}
                      className={selectedIds.has(resposta.id) ? "bg-violet-50" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(resposta.id)}
                          onCheckedChange={() => toggleSelection(resposta.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {resposta.codigo_unico ? (
                          <Badge variant="outline" className="font-mono bg-violet-50 text-violet-700 border-violet-200">
                            <Hash className="h-3 w-3 mr-0.5" />
                            {resposta.codigo_unico}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-violet-600" />
                          <div>
                            <p className="font-medium">{resposta.checklists?.nome || "Checklist"}</p>
                            <p className="text-xs text-muted-foreground uppercase">
                              {resposta.checklists?.tipo}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {resposta.ordens_servico ? (
                          <div>
                            <p className="font-medium">#{resposta.ordens_servico.numero}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {resposta.ordens_servico.tipo}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {resposta.tecnicos ? (
                          <div>
                            <p className="font-medium">{resposta.tecnicos.codigo}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {resposta.tecnicos.nome}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(resposta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {resposta.status === "completo" ? (
                          <Badge className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Rascunho
                          </Badge>
                        )}
                      </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirGuiaAtual(resposta.id)}
                              title="Abrir nesta guia"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirNovaGuia(resposta.id)}
                              title="Abrir em nova guia"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => gerarPdfIndividual(resposta.id, resposta.codigo_unico)}
                              title="Baixar PDF"
                              disabled={generatingPdfId === resposta.id}
                            >
                              {generatingPdfId === resposta.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginação */}
              {totalPages > 1 && !searchTerm.startsWith('#') && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {currentPage * ITEMS_PER_PAGE + 1} - {Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalCount || 0)} de {totalCount} registros
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i;
                        } else if (currentPage < 3) {
                          pageNum = i;
                        } else if (currentPage > totalPages - 4) {
                          pageNum = totalPages - 5 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum + 1}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm.startsWith('#') 
                  ? `Nenhum checklist encontrado com o código ${searchTerm}`
                  : "Nenhum checklist encontrado"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </MainLayout>
  );
}
