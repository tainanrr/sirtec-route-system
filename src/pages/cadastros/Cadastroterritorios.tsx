// ============================================================================
// CadastroTerritorios.tsx - Página para desenhar e gerenciar territórios
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTelaPermissao } from "@/hooks/usePermissoes";

// Tipos
interface Coordenada {
  lat: number;
  lng: number;
}

interface Territorio {
  id: string;
  nome: string;
  cor: string;
  poligono: Coordenada[];
  equipeId: string | null;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

interface Equipe {
  id: string;
  codigo: string;
  nome: string;
}

// Cores disponíveis
const CORES = [
  { nome: 'Vermelho', valor: '#EF4444' },
  { nome: 'Laranja', valor: '#F97316' },
  { nome: 'Amarelo', valor: '#EAB308' },
  { nome: 'Verde', valor: '#22C55E' },
  { nome: 'Teal', valor: '#14B8A6' },
  { nome: 'Azul', valor: '#3B82F6' },
  { nome: 'Roxo', valor: '#8B5CF6' },
  { nome: 'Rosa', valor: '#EC4899' },
  { nome: 'Indigo', valor: '#6366F1' },
  { nome: 'Cyan', valor: '#06B6D4' },
];

// Centro de Vitória da Conquista
const CENTRO_MAPA = { lat: -14.8619, lng: -40.8389 };

// Mock de equipes
const equipesMock: Equipe[] = [
  { id: 'eq-001', codigo: 'EQ-001', nome: 'Equipe Alpha' },
  { id: 'eq-002', codigo: 'EQ-002', nome: 'Equipe Beta' },
  { id: 'eq-003', codigo: 'EQ-003', nome: 'Equipe Gamma' },
  { id: 'eq-004', codigo: 'EQ-004', nome: 'Equipe Delta' },
  { id: 'eq-005', codigo: 'EQ-005', nome: 'Equipe Epsilon' },
];

export default function CadastroTerritorios() {
  // Permissões da tela
  const { podeEditar, loading: loadingPermissoes, isAdmin } = useTelaPermissao("territorios");
  
  // Debug de permissões
  console.log("[Territorios] podeEditar:", podeEditar, "loading:", loadingPermissoes, "isAdmin:", isAdmin);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const drawLayerRef = useRef<any>(null);
  const territoriosLayerRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);
  
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [territorioSelecionado, setTerritorioSelecionado] = useState<Territorio | null>(null);
  const [modoEdicao, setModoEdicao] = useState<'visualizar' | 'criar' | 'editar'>('visualizar');
  const [poligonoAtual, setPoligonoAtual] = useState<Coordenada[]>([]);
  const [formData, setFormData] = useState({
    nome: '',
    cor: CORES[0].valor,
    equipeId: '' as string | null,
  });
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Carregar territórios do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('territorios');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTerritorios(parsed.map((t: any) => ({
          ...t,
          criadoEm: new Date(t.criadoEm),
          atualizadoEm: new Date(t.atualizadoEm)
        })));
      } catch (e) {
        console.error('Erro ao carregar territórios:', e);
      }
    }
  }, []);

  // Salvar territórios no localStorage
  useEffect(() => {
    if (territorios.length > 0) {
      localStorage.setItem('territorios', JSON.stringify(territorios));
    }
  }, [territorios]);

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Carregar Leaflet dinamicamente
    const loadLeaflet = async () => {
      // CSS do Leaflet
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // CSS do Leaflet Draw
      if (!document.getElementById('leaflet-draw-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-draw-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css';
        document.head.appendChild(link);
      }

      // Script do Leaflet
      await new Promise<void>((resolve) => {
        if ((window as any).L) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => resolve();
        document.body.appendChild(script);
      });

      // Script do Leaflet Draw
      await new Promise<void>((resolve) => {
        if ((window as any).L?.Draw) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js';
        script.onload = () => resolve();
        document.body.appendChild(script);
      });

      const L = (window as any).L;

      // Criar mapa
      const map = L.map(mapRef.current).setView([CENTRO_MAPA.lat, CENTRO_MAPA.lng], 13);

      // Adicionar tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Layer para desenhos
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
      drawLayerRef.current = drawnItems;

      // Layer para territórios salvos
      const territoriosLayer = new L.FeatureGroup();
      map.addLayer(territoriosLayer);
      territoriosLayerRef.current = territoriosLayer;

      // Controle de desenho - será adicionado/removido baseado nas permissões
      // O controle é gerenciado pelo useEffect abaixo

      // Evento quando desenha
      map.on(L.Draw.Event.CREATED, (e: any) => {
        const layer = e.layer;
        drawnItems.addLayer(layer);

        // Extrair coordenadas
        const latlngs = layer.getLatLngs()[0];
        const coords: Coordenada[] = latlngs.map((ll: any) => ({
          lat: ll.lat,
          lng: ll.lng
        }));
        setPoligonoAtual(coords);
        setModoEdicao('criar');
      });

      // Evento quando edita
      map.on(L.Draw.Event.EDITED, (e: any) => {
        const layers = e.layers;
        layers.eachLayer((layer: any) => {
          const latlngs = layer.getLatLngs()[0];
          const coords: Coordenada[] = latlngs.map((ll: any) => ({
            lat: ll.lat,
            lng: ll.lng
          }));
          setPoligonoAtual(coords);
        });
      });

      // Evento quando deleta
      map.on(L.Draw.Event.DELETED, () => {
        setPoligonoAtual([]);
        setModoEdicao('visualizar');
      });

      mapInstanceRef.current = map;
    };

    loadLeaflet();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Gerenciar controle de desenho baseado nas permissões
  useEffect(() => {
    console.log("[Territorios] useEffect drawControl - loading:", loadingPermissoes, "podeEditar:", podeEditar);
    
    // Aguardar permissões carregarem
    if (loadingPermissoes) {
      console.log("[Territorios] Aguardando permissões carregarem...");
      return;
    }
    
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !drawLayerRef.current) {
      console.log("[Territorios] Leaflet ou mapa não inicializado ainda");
      return;
    }

    const map = mapInstanceRef.current;

    // Remover controle existente se houver
    if (drawControlRef.current) {
      console.log("[Territorios] Removendo controle de desenho existente");
      map.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }

    // Adicionar controle apenas se tiver permissão de edição
    if (podeEditar) {
      console.log("[Territorios] Adicionando controle de desenho (tem permissão)");
      const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            shapeOptions: {
              color: formData.cor
            }
          },
          polyline: false,
          circle: false,
          circlemarker: false,
          marker: false,
          rectangle: {
            shapeOptions: {
              color: formData.cor
            }
          }
        },
        edit: {
          featureGroup: drawLayerRef.current
        }
      });
      map.addControl(drawControl);
      drawControlRef.current = drawControl;
    } else {
      console.log("[Territorios] NÃO adicionando controle de desenho (sem permissão)");
    }
  }, [podeEditar, loadingPermissoes, formData.cor]);

  // Atualizar territórios no mapa
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !territoriosLayerRef.current) return;

    territoriosLayerRef.current.clearLayers();

    territorios.forEach(t => {
      if (!t.ativo || t.poligono.length < 3) return;

      const latlngs = t.poligono.map(p => [p.lat, p.lng]);
      const polygon = L.polygon(latlngs, {
        color: t.cor,
        fillColor: t.cor,
        fillOpacity: 0.3,
        weight: 2
      });

      // Popup com info
      const equipe = equipesMock.find(e => e.id === t.equipeId);
      polygon.bindPopup(`
        <strong>${t.nome}</strong><br>
        Equipe: ${equipe ? equipe.codigo : 'Não vinculada'}<br>
        Área: ${calcularArea(t.poligono).toFixed(2)} km²
      `);

      // Tooltip com nome
      polygon.bindTooltip(t.nome, {
        permanent: true,
        direction: 'center',
        className: 'territorio-label'
      });

      polygon.on('click', () => {
        setTerritorioSelecionado(t);
        setFormData({
          nome: t.nome,
          cor: t.cor,
          equipeId: t.equipeId
        });
      });

      territoriosLayerRef.current.addLayer(polygon);
    });
  }, [territorios]);

  // Calcular área do polígono
  const calcularArea = (poligono: Coordenada[]): number => {
    if (poligono.length < 3) return 0;
    let area = 0;
    const n = poligono.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += poligono[i].lng * poligono[j].lat;
      area -= poligono[j].lng * poligono[i].lat;
    }
    area = Math.abs(area) / 2;
    return area * 111 * 111; // Aproximação para km²
  };

  // Salvar território
  const salvarTerritorio = () => {
    // Verificar permissão
    if (!podeEditar) {
      setMensagem({ tipo: 'erro', texto: 'Você não tem permissão para criar territórios' });
      return;
    }
    
    if (!formData.nome.trim()) {
      setMensagem({ tipo: 'erro', texto: 'Nome é obrigatório' });
      return;
    }

    if (poligonoAtual.length < 3) {
      setMensagem({ tipo: 'erro', texto: 'Desenhe um polígono no mapa' });
      return;
    }

    const novoTerritorio: Territorio = {
      id: `terr-${Date.now()}`,
      nome: formData.nome.trim(),
      cor: formData.cor,
      poligono: poligonoAtual,
      equipeId: formData.equipeId || null,
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    setTerritorios(prev => [...prev, novoTerritorio]);
    
    // Limpar
    if (drawLayerRef.current) {
      drawLayerRef.current.clearLayers();
    }
    setPoligonoAtual([]);
    setFormData({ nome: '', cor: CORES[0].valor, equipeId: '' });
    setModoEdicao('visualizar');
    setMensagem({ tipo: 'sucesso', texto: 'Território salvo com sucesso!' });

    setTimeout(() => setMensagem(null), 3000);
  };

  // Atualizar território
  const atualizarTerritorio = () => {
    // Verificar permissão
    if (!podeEditar) {
      setMensagem({ tipo: 'erro', texto: 'Você não tem permissão para editar territórios' });
      return;
    }
    
    if (!territorioSelecionado) return;

    setTerritorios(prev => prev.map(t => {
      if (t.id === territorioSelecionado.id) {
        return {
          ...t,
          nome: formData.nome,
          cor: formData.cor,
          equipeId: formData.equipeId || null,
          atualizadoEm: new Date()
        };
      }
      return t;
    }));

    setTerritorioSelecionado(null);
    setFormData({ nome: '', cor: CORES[0].valor, equipeId: '' });
    setMensagem({ tipo: 'sucesso', texto: 'Território atualizado!' });
    setTimeout(() => setMensagem(null), 3000);
  };

  // Excluir território
  const excluirTerritorio = (id: string) => {
    // Verificar permissão
    if (!podeEditar) {
      setMensagem({ tipo: 'erro', texto: 'Você não tem permissão para excluir territórios' });
      return;
    }
    
    if (!confirm('Tem certeza que deseja excluir este território?')) return;
    
    setTerritorios(prev => prev.filter(t => t.id !== id));
    setTerritorioSelecionado(null);
    setFormData({ nome: '', cor: CORES[0].valor, equipeId: '' });
    setMensagem({ tipo: 'sucesso', texto: 'Território excluído!' });
    setTimeout(() => setMensagem(null), 3000);
  };

  // Cancelar edição
  const cancelar = () => {
    if (drawLayerRef.current) {
      drawLayerRef.current.clearLayers();
    }
    setPoligonoAtual([]);
    setTerritorioSelecionado(null);
    setFormData({ nome: '', cor: CORES[0].valor, equipeId: '' });
    setModoEdicao('visualizar');
  };

  // Exportar configuração
  const exportarConfig = () => {
    const config = {
      territorios,
      exportadoEm: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'territorios-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Importar configuração
  const importarConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Verificar permissão
    if (!podeEditar) {
      setMensagem({ tipo: 'erro', texto: 'Você não tem permissão para importar territórios' });
      return;
    }
    
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target?.result as string);
        if (config.territorios && Array.isArray(config.territorios)) {
          setTerritorios(config.territorios.map((t: any) => ({
            ...t,
            criadoEm: new Date(t.criadoEm),
            atualizadoEm: new Date(t.atualizadoEm)
          })));
          setMensagem({ tipo: 'sucesso', texto: `${config.territorios.length} territórios importados!` });
          setTimeout(() => setMensagem(null), 3000);
        }
      } catch (err) {
        setMensagem({ tipo: 'erro', texto: 'Erro ao importar arquivo' });
        setTimeout(() => setMensagem(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              🗺️ Cadastro de Territórios
              {/* Badge de permissão para debug */}
              {loadingPermissoes ? (
                <span className="text-xs px-2 py-1 bg-yellow-600 rounded">Carregando...</span>
              ) : podeEditar ? (
                <span className="text-xs px-2 py-1 bg-green-600 rounded">✏️ Pode Editar</span>
              ) : (
                <span className="text-xs px-2 py-1 bg-red-600 rounded">👁️ Somente Leitura</span>
              )}
              {isAdmin && <span className="text-xs px-2 py-1 bg-purple-600 rounded">Admin</span>}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {podeEditar 
                ? "Desenhe polígonos para definir as áreas de atuação das equipes"
                : "Visualize as áreas de atuação das equipes (modo somente leitura)"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportarConfig}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
            >
              📤 Exportar
            </button>
            {podeEditar && (
              <label className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm cursor-pointer transition-colors">
                📥 Importar
                <input
                  type="file"
                  accept=".json"
                  onChange={importarConfig}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </header>

      {/* Mensagem */}
      {mensagem && (
        <div className={`mx-6 mt-4 p-3 rounded-lg ${
          mensagem.tipo === 'sucesso' ? 'bg-green-900/50 border border-green-700 text-green-300' : 
          'bg-red-900/50 border border-red-700 text-red-300'
        }`}>
          {mensagem.texto}
        </div>
      )}

      <div className="flex h-[calc(100vh-80px)]">
        {/* Painel lateral */}
        <div className="w-80 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto">
          {/* Formulário */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {modoEdicao === 'criar' ? '➕ Novo Território' : 
               territorioSelecionado ? (podeEditar ? '✏️ Editar Território' : '👁️ Visualizar Território') : 
               '📋 Territórios'}
            </h2>

            {!podeEditar && (modoEdicao === 'criar' || territorioSelecionado) && (
              <div className="mb-4 p-2 bg-yellow-900/30 border border-yellow-600/50 rounded-lg text-yellow-400 text-sm">
                🔒 Modo somente leitura
              </div>
            )}

            {(modoEdicao === 'criar' || territorioSelecionado) && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Nome</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Zona Norte"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!podeEditar}
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Cor</label>
                  <div className="flex flex-wrap gap-2">
                    {CORES.map(cor => (
                      <button
                        key={cor.valor}
                        onClick={() => podeEditar && setFormData({ ...formData, cor: cor.valor })}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          formData.cor === cor.valor ? 'border-white scale-110' : 'border-transparent'
                        } ${!podeEditar ? 'opacity-50 cursor-not-allowed' : ''}`}
                        style={{ backgroundColor: cor.valor }}
                        title={cor.nome}
                        disabled={!podeEditar}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Equipe Vinculada</label>
                  <select
                    value={formData.equipeId || ''}
                    onChange={(e) => setFormData({ ...formData, equipeId: e.target.value || null })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!podeEditar}
                  >
                    <option value="">Sem vínculo</option>
                    {equipesMock.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        {eq.codigo} - {eq.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {poligonoAtual.length > 0 && (
                  <div className="text-sm text-slate-400">
                    <p>📐 {poligonoAtual.length} pontos</p>
                    <p>📏 Área: {calcularArea(poligonoAtual).toFixed(2)} km²</p>
                  </div>
                )}

                {podeEditar && (
                  <div className="flex gap-2">
                    {modoEdicao === 'criar' ? (
                      <button
                        onClick={salvarTerritorio}
                        className="flex-1 py-2 rounded-lg font-medium transition-colors bg-green-600 hover:bg-green-500"
                      >
                        💾 Salvar
                      </button>
                    ) : (
                      <button
                        onClick={atualizarTerritorio}
                        className="flex-1 py-2 rounded-lg font-medium transition-colors bg-blue-600 hover:bg-blue-500"
                      >
                        ✅ Atualizar
                      </button>
                    )}
                    <button
                      onClick={cancelar}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
                    >
                      ✖️
                    </button>
                  </div>
                )}
                {!podeEditar && territorioSelecionado && (
                  <button
                    onClick={() => setTerritorioSelecionado(null)}
                    className="w-full py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
                  >
                    ✖️ Fechar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Lista de territórios */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">
              Territórios Cadastrados ({territorios.length})
            </h3>
            
            {territorios.length === 0 ? (
              <p className="text-slate-500 text-sm italic">
                Nenhum território cadastrado. Use as ferramentas do mapa para desenhar polígonos.
              </p>
            ) : (
              <div className="space-y-2">
                {territorios.map(t => {
                  const equipe = equipesMock.find(e => e.id === t.equipeId);
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setTerritorioSelecionado(t);
                        setFormData({
                          nome: t.nome,
                          cor: t.cor,
                          equipeId: t.equipeId
                        });
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                        territorioSelecionado?.id === t.id 
                          ? 'bg-slate-600 border-blue-500' 
                          : 'bg-slate-700 border-transparent hover:bg-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: t.cor }}
                        />
                        <span className="font-medium">{t.nome}</span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        {equipe ? `🏢 ${equipe.codigo}` : '⚠️ Sem equipe'}
                        <span className="mx-2">•</span>
                        {calcularArea(t.poligono).toFixed(1)} km²
                      </div>
                      {territorioSelecionado?.id === t.id && podeEditar && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            excluirTerritorio(t.id);
                          }}
                          className="mt-2 text-sm text-red-400 hover:text-red-300"
                        >
                          🗑️ Excluir
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Instruções */}
          {podeEditar ? (
            <div className="mt-6 p-4 bg-slate-700/50 rounded-lg">
              <h3 className="font-medium text-sm mb-2">📖 Como usar</h3>
              <ol className="text-xs text-slate-400 space-y-1">
                <li>1. Use os botões no canto superior direito do mapa</li>
                <li>2. Clique no ícone de polígono ou retângulo</li>
                <li>3. Desenhe a área clicando nos pontos</li>
                <li>4. Preencha nome, cor e vincule à equipe</li>
                <li>5. Clique em Salvar</li>
              </ol>
            </div>
          ) : (
            <div className="mt-6 p-4 bg-slate-700/50 rounded-lg">
              <h3 className="font-medium text-sm mb-2">👁️ Modo Visualização</h3>
              <p className="text-xs text-slate-400">
                Você está em modo somente leitura. Clique nos territórios para visualizar seus detalhes.
              </p>
            </div>
          )}
        </div>

        {/* Mapa */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />
          
          {/* Legenda */}
          {territorios.length > 0 && (
            <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur rounded-lg p-3 text-sm">
              <h4 className="font-medium mb-2">Legenda</h4>
              {territorios.map(t => {
                const equipe = equipesMock.find(e => e.id === t.equipeId);
                return (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: t.cor }}
                    />
                    <span>{t.nome}</span>
                    {equipe && <span className="text-slate-400">({equipe.codigo})</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Estilos adicionais */}
      <style>{`
        .territorio-label {
          background: rgba(0,0,0,0.7) !important;
          border: none !important;
          color: white !important;
          font-weight: bold;
          font-size: 11px;
          padding: 2px 6px !important;
          border-radius: 4px;
        }
        .leaflet-draw-toolbar a {
          background-color: #334155 !important;
        }
        .leaflet-draw-toolbar a:hover {
          background-color: #475569 !important;
        }
      `}</style>
    </div>
  );
}
