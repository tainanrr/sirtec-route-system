# PROMPT: Tornar Linha de Intervalo Visível no Mapa e Exportação

## PROBLEMA IDENTIFICADO

Atualmente, quando os usuários visualizam os roteiros no mapa e exportam os dados:
- A linha de intervalo (polyline que conecta os pontos da rota) pode não estar visível ou suficientemente destacada no mapa
- A exportação para Excel não inclui informações sobre a sequência da rota e coordenadas dos segmentos

## OBJETIVO

Tornar a linha de intervalo claramente visível tanto na visualização do mapa quanto na análise dos dados exportados.

## CORREÇÕES NECESSÁRIAS

### 1. MELHORAR VISIBILIDADE DA LINHA NO MAPA (`src/pages/components/MapaLeaflet.tsx`)

**Problema Atual:**
- As polylines podem estar com opacidade baixa ou cor pouco visível
- Não há diferenciação visual clara entre rotas de equipes diferentes
- Falta indicador visual de direção da rota

**Correções:**

1. **Aumentar visibilidade das linhas:**
   ```typescript
   // Linha 214-221: Aumentar opacidade e peso
   const polyline = L.polyline(leafletCoords, {
     color: cor,
     weight: isHovered ? 6 : 4, // Aumentado de 5/3 para 6/4
     opacity: isHovered ? 1 : 0.9, // Aumentado de 1/0.7 para 1/0.9
     className: isHovered ? "route-highlighted" : "",
   });
   ```

2. **Adicionar setas de direção na rota:**
   ```typescript
   // Após criar a polyline, adicionar setas de direção
   import 'leaflet-arrowheads'; // Se disponível, ou usar marcadores customizados
   
   // Alternativa: Adicionar marcadores de direção a cada X pontos
   const arrowInterval = Math.max(1, Math.floor(leafletCoords.length / 5));
   for (let i = arrowInterval; i < leafletCoords.length - 1; i += arrowInterval) {
     const [lat, lng] = leafletCoords[i];
     const [nextLat, nextLng] = leafletCoords[i + 1];
     const angle = Math.atan2(nextLng - lng, nextLat - lat) * 180 / Math.PI;
     
     const arrowMarker = L.marker([lat, lng], {
       icon: L.divIcon({
         className: 'route-arrow',
         html: `<div style="transform: rotate(${angle}deg); color: ${cor}; font-size: 12px;">→</div>`,
         iconSize: [20, 20],
         iconAnchor: [10, 10],
       }),
     });
     arrowMarker.addTo(map);
     markersRef.current.push(arrowMarker);
   }
   ```

3. **Melhorar linha provisória (fallback):**
   ```typescript
   // Linha 231-237: Tornar linha provisória mais visível
   const polyline = L.polyline(pontos, {
     color: cor,
     weight: isHovered ? 5 : 4, // Aumentado
     opacity: isHovered ? 0.8 : 0.6, // Aumentado de 0.5/0.3
     dashArray: "10, 5", // Traços mais longos
     className: isHovered ? "route-highlighted" : "",
   });
   ```

4. **Adicionar legenda de cores no mapa:**
   ```typescript
   // Adicionar controle de legenda no canto do mapa
   const legend = L.control({ position: 'bottomright' });
   legend.onAdd = function(map) {
     const div = L.DomUtil.create('div', 'route-legend');
     div.innerHTML = `
       <div style="background: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
         <strong>Rotas</strong><br>
         ${rotas.map((r, idx) => `
           <div style="margin-top: 5px;">
             <span style="display: inline-block; width: 20px; height: 4px; background: ${r.equipe.color || coresRotas[idx]}; margin-right: 5px;"></span>
             ${r.equipe.codigo}
           </div>
         `).join('')}
       </div>
     `;
     return div;
   };
   legend.addTo(map);
   ```

### 2. ADICIONAR INFORMAÇÃO DE ROTA NA EXPORTAÇÃO (`src/pages/Roteirizacao.tsx`)

**Problema Atual:**
- A exportação não inclui informações sobre a sequência completa da rota
- Não há coluna indicando o segmento da rota (de onde para onde)
- Falta informação sobre distância entre pontos consecutivos

**Correções:**

1. **Adicionar colunas de rota na exportação:**
   ```typescript
   // Na função handleExportarRotas, após linha 470, adicionar:
   const os = servico.ordemServico;
   
   // Determinar origem (ponto anterior ou base)
   let origemLat = rota.equipe.latitude;
   let origemLng = rota.equipe.longitude;
   let origemDesc = `${rota.equipe.codigo} (Base)`;
   
   if (index > 0) {
     // Encontrar serviço anterior (pode ter ALMOCO no meio)
     let idxAnterior = index - 1;
     while (idxAnterior >= 0 && rota.servicos[idxAnterior].tipo === "ALMOCO") {
       idxAnterior--;
     }
     if (idxAnterior >= 0 && rota.servicos[idxAnterior].ordemServico) {
       origemLat = rota.servicos[idxAnterior].ordemServico.latitude;
       origemLng = rota.servicos[idxAnterior].ordemServico.longitude;
       origemDesc = `OS ${rota.servicos[idxAnterior].ordemServico.numero}`;
     }
   }
   
   // Calcular distância do segmento
   const distanciaSegmento = calcularDistancia(
     origemLat, origemLng,
     os.latitude, os.longitude
   );
   
   dadosExportacao.push({
     "Equipe": rota.equipe.codigo,
     "Técnico": rota.equipe.tecnico,
     "Ordem na Rota": servico.ordemNaRota,
     "Número OS": os.numero,
     "Tipo": os.tipo,
     "Endereço": os.endereco,
     "Latitude": os.latitude,
     "Longitude": os.longitude,
     // NOVAS COLUNAS:
     "Origem": origemDesc,
     "Origem Latitude": origemLat,
     "Origem Longitude": origemLng,
     "Distância Segmento (km)": distanciaSegmento.toFixed(2),
     "Distância Acumulada (km)": (rota.distanciaTotal - distanciaSegmento).toFixed(2), // Aproximado
     // ... resto das colunas existentes
   });
   ```

2. **Adicionar linha de resumo da rota completa:**
   ```typescript
   // Após processar todos os serviços de uma equipe, adicionar linha de resumo:
   if (rota.servicos.length > 0) {
     const servicosValidos = rota.servicos.filter(s => s.tipo === "SERVICO" && s.ordemServico);
     const ultimoServico = servicosValidos[servicosValidos.length - 1];
     
     if (ultimoServico && ultimoServico.ordemServico) {
       dadosExportacao.push({
         "Equipe": rota.equipe.codigo,
         "Técnico": rota.equipe.tecnico,
         "Ordem na Rota": "RESUMO",
         "Número OS": "-",
         "Tipo": "-",
         "Endereço": `Rota completa: ${rota.equipe.codigo} → ${servicosValidos.length} paradas`,
         "Latitude": "-",
         "Longitude": "-",
         "Origem": `${rota.equipe.codigo} (Base)`,
         "Origem Latitude": rota.equipe.latitude,
         "Origem Longitude": rota.equipe.longitude,
         "Distância Segmento (km)": "-",
         "Distância Acumulada (km)": "-",
         "Prazo": "-",
         "Regulada": "-",
         "Prioridade": "-",
         "Duração Serviço (min)": "-",
         "Valor (R$)": "-",
         "Tempo Deslocamento (min)": "-",
         "Hora Início": rota.servicos[0]?.horaInicio || "-",
         "Hora Fim": ultimoServico.horaFim,
         "ETA": "-",
         "Status": "Rota Completa",
         "Motivo Não Alocada": "-",
         "Distância Total (km)": rota.distanciaTotal.toFixed(2),
         "Tempo Total (min)": formatarTempo(rota.tempoTotal),
         "Faturamento Total (R$)": rota.faturamentoTotal,
         "Progresso (%)": rota.progresso.toFixed(1),
       });
     }
   }
   ```

3. **Ajustar larguras das colunas:**
   ```typescript
   // Atualizar colWidths para incluir novas colunas:
   const colWidths = [
     { wch: 12 }, // Equipe
     { wch: 20 }, // Técnico
     { wch: 15 }, // Ordem na Rota
     { wch: 12 }, // Número OS
     { wch: 12 }, // Tipo
     { wch: 40 }, // Endereço
     { wch: 12 }, // Latitude
     { wch: 12 }, // Longitude
     { wch: 25 }, // Origem (NOVA)
     { wch: 12 }, // Origem Latitude (NOVA)
     { wch: 12 }, // Origem Longitude (NOVA)
     { wch: 20 }, // Distância Segmento (NOVA)
     { wch: 20 }, // Distância Acumulada (NOVA)
     // ... resto das colunas existentes
   ];
   ```

### 3. ADICIONAR VISUALIZAÇÃO DE ROTA NA ANÁLISE (`src/pages/Roteirizacao.tsx`)

**Adicionar seção de visualização da rota:**

1. **Criar componente de visualização de rota:**
   ```typescript
   // Adicionar após o mapa, uma seção mostrando a rota como lista conectada:
   <div className="mt-4 p-4 bg-muted/30 rounded-lg">
     <h3 className="text-sm font-semibold mb-2">Visualização da Rota</h3>
     <div className="space-y-2">
       {rota.servicos.map((servico, idx) => {
         if (servico.tipo === "ALMOCO") {
           return (
             <div key={`almoco-${idx}`} className="flex items-center gap-2 text-muted-foreground">
               <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white text-xs">🍽</div>
               <div className="flex-1 border-t-2 border-dashed border-yellow-500"></div>
               <span className="text-xs">Almoço ({servico.horaInicio} - {servico.horaFim})</span>
             </div>
           );
         }
         
         const origem = idx === 0 
           ? `${rota.equipe.codigo} (Base)`
           : rota.servicos[idx - 1].tipo === "ALMOCO"
             ? "Almoço"
             : rota.servicos[idx - 1].ordemServico?.numero || "Anterior";
         
         return (
           <div key={`servico-${idx}`} className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
               {servico.ordemNaRota}
             </div>
             <div className="flex-1 border-t-2 border-primary"></div>
             <div className="text-sm">
               <strong>{servico.ordemServico?.numero}</strong> - {servico.ordemServico?.tipo}
               <span className="text-xs text-muted-foreground ml-2">
                 ({origem} → {servico.ordemServico?.numero})
               </span>
             </div>
           </div>
         );
       })}
     </div>
   </div>
   ```

## IMPLEMENTAÇÃO PRIORITÁRIA

**Ordem de implementação:**

1. **PRIORIDADE ALTA:** Melhorar visibilidade das linhas no mapa (opacidade e peso)
2. **PRIORIDADE ALTA:** Adicionar colunas de origem e distância na exportação
3. **PRIORIDADE MÉDIA:** Adicionar setas de direção na rota do mapa
4. **PRIORIDADE BAIXA:** Adicionar legenda de cores no mapa
5. **PRIORIDADE BAIXA:** Adicionar visualização de rota como lista conectada

## RESULTADO ESPERADO

Após as correções:
- ✅ Linhas de rota claramente visíveis no mapa (opacidade ≥ 0.9, peso ≥ 4px)
- ✅ Setas indicando direção da rota
- ✅ Exportação contendo informações completas sobre cada segmento da rota
- ✅ Colunas "Origem", "Distância Segmento" e "Distância Acumulada" na planilha
- ✅ Visualização clara da sequência da rota na interface

## NOTAS TÉCNICAS

- Usar `calcularDistancia` de `routingUtils.ts` para calcular distâncias entre pontos
- Garantir que as cores das rotas sejam distintas e visíveis
- Testar com diferentes quantidades de rotas para garantir performance
- Considerar adicionar toggle para mostrar/ocultar linhas de rota específicas











