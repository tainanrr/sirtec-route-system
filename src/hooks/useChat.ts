import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useOfflineSyncContext } from "./useOfflineSync";
import { CACHE_KEYS } from "./useOfflineData";

// Debounce helper
function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// ============================================
// TIPOS
// ============================================

export interface ChatConversa {
  id: string;
  created_at: string;
  updated_at: string;
  tipo: "direto" | "grupo" | "suporte";
  equipe_id: string | null;
  titulo: string | null;
  descricao: string | null;
  status: "ativo" | "arquivado" | "fechado";
  ultima_mensagem_id: string | null;
  ultima_mensagem_at: string | null;
  ultima_mensagem_preview: string | null;
  nao_lidas_torre: number;
  nao_lidas_equipe: number;
  // Joins
  equipe?: {
    id: string;
    codigo: string;
    nome: string;
    color?: string;
  };
}

export interface ChatMensagem {
  id: string;
  created_at: string;
  conversa_id: string;
  remetente_tipo: "torre" | "equipe";
  remetente_id: string | null;
  remetente_nome: string | null;
  tipo: "texto" | "imagem" | "arquivo" | "localizacao" | "audio" | "sistema";
  conteudo: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  arquivo_tamanho: number | null;
  audio_duracao: number | null;
  latitude: number | null;
  longitude: number | null;
  status: "enviando" | "enviada" | "entregue" | "lida" | "erro";
  lida_at: string | null;
  metadata: Record<string, unknown>;
}

interface UseChatOptions {
  tipoUsuario: "torre" | "equipe";
  usuarioId?: string;
  usuarioNome?: string;
  equipeId?: string;
  equipeCodigo?: string;
  onNovaMensagem?: (mensagem: ChatMensagem) => void;
}

// Som de notificação
const notificationSound = typeof window !== "undefined" 
  ? new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleUAOYJ/NtGk8GVKZz7JhPRxQmM22YjwdUJjNtmI8HVCYzbZiPB1QmM22YjwdUJjNtmI8HVCYzbZiPB1Q")
  : null;

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useChat(options: UseChatOptions) {
  const { 
    tipoUsuario, 
    usuarioId, 
    usuarioNome, 
    equipeId, 
    equipeCodigo,
    onNovaMensagem 
  } = options;

  const { isOnline, queueOperation, saveToCache, getFromCache } = useOfflineSyncContext();

  const [conversas, setConversas] = useState<ChatConversa[]>([]);
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [conversaAtiva, setConversaAtiva] = useState<ChatConversa | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const mensagensChannelRef = useRef<RealtimeChannel | null>(null);
  const lastConversaLoadRef = useRef<number>(0);
  const conversaAtivaIdRef = useRef<string | null>(null);

  // ============================================
  // CARREGAR CONVERSAS
  // ============================================

  const carregarConversasInternal = useCallback(async () => {
    // Debounce: evitar chamadas muito frequentes (mínimo 500ms entre chamadas)
    const now = Date.now();
    if (now - lastConversaLoadRef.current < 500) {
      return;
    }
    lastConversaLoadRef.current = now;

    try {
      // Se offline, tentar carregar do cache
      if (!isOnline) {
        const cached = await getFromCache<ChatConversa[]>(`${CACHE_KEYS.MENSAGENS_CHAT}_conversas_${equipeId}`);
        if (cached) {
          console.log("[Chat] Usando conversas do cache:", cached.length);
          setConversas(cached);
          const total = cached.reduce((acc, conv) => {
            return acc + (tipoUsuario === "torre" ? conv.nao_lidas_torre : conv.nao_lidas_equipe);
          }, 0);
          setTotalNaoLidas(total);
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      let query = supabase
        .from("chat_conversas")
        .select(`
          *,
          equipe:tecnicos!chat_conversas_equipe_id_fkey(id, codigo, nome, color)
        `)
        .eq("status", "ativo")
        .order("ultima_mensagem_at", { ascending: false, nullsFirst: false });

      // Se for equipe, filtrar apenas conversas dela
      if (tipoUsuario === "equipe" && equipeId) {
        query = query.eq("equipe_id", equipeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setConversas(data || []);
      
      // Cachear conversas para uso offline
      if (equipeId && data) {
        await saveToCache(`${CACHE_KEYS.MENSAGENS_CHAT}_conversas_${equipeId}`, data, 24);
      }

      // Calcular total de não lidas
      const total = (data || []).reduce((acc, conv) => {
        return acc + (tipoUsuario === "torre" ? conv.nao_lidas_torre : conv.nao_lidas_equipe);
      }, 0);
      setTotalNaoLidas(total);

    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
    } finally {
      setLoading(false);
    }
  }, [tipoUsuario, equipeId, isOnline, getFromCache, saveToCache]);

  // Versão debounced para chamadas frequentes
  const carregarConversas = useMemo(
    () => debounce(carregarConversasInternal, 300),
    [carregarConversasInternal]
  );

  // ============================================
  // CARREGAR MENSAGENS DE UMA CONVERSA
  // ============================================

  const carregarMensagens = useCallback(async (conversaId: string) => {
    try {
      // Se offline, tentar carregar do cache
      if (!isOnline) {
        const cached = await getFromCache<ChatMensagem[]>(`${CACHE_KEYS.MENSAGENS_CHAT}_mensagens_${conversaId}`);
        if (cached) {
          console.log("[Chat] Usando mensagens do cache:", cached.length);
          setMensagens(cached);
          return;
        }
        setMensagens([]);
        return;
      }

      const { data, error } = await supabase
        .from("chat_mensagens")
        .select("*")
        .eq("conversa_id", conversaId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMensagens(data || []);
      
      // Cachear mensagens para uso offline
      if (data) {
        await saveToCache(`${CACHE_KEYS.MENSAGENS_CHAT}_mensagens_${conversaId}`, data, 24);
      }

      // Marcar como lidas
      await supabase.rpc("marcar_mensagens_lidas", {
        p_conversa_id: conversaId,
        p_tipo_leitor: tipoUsuario
      });

      // Atualizar lista de conversas
      carregarConversas();

    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    }
  }, [tipoUsuario, carregarConversas, isOnline, getFromCache, saveToCache]);

  // ============================================
  // ABRIR CONVERSA
  // ============================================

  const abrirConversa = useCallback(async (conversa: ChatConversa) => {
    setConversaAtiva(conversa);
    await carregarMensagens(conversa.id);

    // Subscrever para novas mensagens desta conversa
    if (mensagensChannelRef.current) {
      supabase.removeChannel(mensagensChannelRef.current);
    }

    mensagensChannelRef.current = supabase
      .channel(`chat-mensagens-${conversa.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_mensagens",
          filter: `conversa_id=eq.${conversa.id}`
        },
        (payload) => {
          console.log("[Chat Realtime] Nova mensagem recebida:", payload.new);
          const novaMensagem = payload.new as ChatMensagem;
          
          setMensagens(prev => {
            // Evitar duplicatas (checar tanto por ID real quanto por conteúdo similar de mensagens temporárias)
            if (prev.some(m => m.id === novaMensagem.id)) {
              console.log("[Chat Realtime] Mensagem já existe, ignorando");
              return prev;
            }
            
            // Se encontrar uma mensagem temporária com mesmo conteúdo, substituir
            const tempIndex = prev.findIndex(m => 
              m.id.startsWith("temp-") && 
              m.conteudo === novaMensagem.conteudo &&
              m.remetente_tipo === novaMensagem.remetente_tipo
            );
            
            if (tempIndex >= 0) {
              console.log("[Chat Realtime] Substituindo mensagem temporária");
              const updated = [...prev];
              updated[tempIndex] = novaMensagem;
              return updated;
            }
            
            console.log("[Chat Realtime] Adicionando nova mensagem");
            return [...prev, novaMensagem];
          });

          // Se não for mensagem própria, tocar som e notificar
          if (novaMensagem.remetente_tipo !== tipoUsuario) {
            notificationSound?.play().catch(() => {});
            onNovaMensagem?.(novaMensagem);
          }

          // Marcar como lida automaticamente se a conversa estiver aberta
          supabase.rpc("marcar_mensagens_lidas", {
            p_conversa_id: conversa.id,
            p_tipo_leitor: tipoUsuario
          });
        }
      )
      .subscribe((status) => {
        console.log("[Chat Realtime] Status da subscription:", status);
      });

  }, [carregarMensagens, tipoUsuario, onNovaMensagem]);

  // ============================================
  // CRIAR OU OBTER CONVERSA COM EQUIPE
  // ============================================

  const obterOuCriarConversa = useCallback(async (equipeDest: { id: string; codigo: string; nome: string }) => {
    try {
      // Se offline, tentar usar conversa do cache
      if (!isOnline) {
        console.log("[Chat] Offline - buscando conversa do cache...");
        const conversasCache = await getFromCache<ChatConversa[]>(`${CACHE_KEYS.MENSAGENS_CHAT}_conversas_${equipeDest.id}`);
        if (conversasCache && conversasCache.length > 0) {
          const conversaExistente = conversasCache.find(c => c.status === "ativo");
          if (conversaExistente) {
            console.log("[Chat] Conversa encontrada no cache:", conversaExistente.id);
            const conversaCompleta = {
              ...conversaExistente,
              equipe: equipeDest
            } as ChatConversa;
            await abrirConversa(conversaCompleta);
            return conversaCompleta;
          }
        }
        
        // Se não encontrou conversa no cache, informar ao usuário
        toast.info("Chat disponível apenas com conexão à internet para primeira vez.", { duration: 4000 });
        return null;
      }

      // Verificar se já existe conversa ativa para esta equipe (qualquer tipo)
      const { data: existentes, error: searchError } = await supabase
        .from("chat_conversas")
        .select("*")
        .eq("equipe_id", equipeDest.id)
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1);

      if (searchError) {
        console.error("Erro ao buscar conversa:", searchError);
      }

      // Se encontrou conversa existente, usar ela
      if (existentes && existentes.length > 0) {
        const existente = existentes[0];
        console.log("[Chat] Conversa existente encontrada:", existente.id);
        const conversaCompleta = {
          ...existente,
          equipe: equipeDest
        } as ChatConversa;
        await abrirConversa(conversaCompleta);
        return conversaCompleta;
      }

      console.log("[Chat] Nenhuma conversa encontrada, criando nova...");
      
      // Criar nova conversa
      const { data: nova, error } = await supabase
        .from("chat_conversas")
        .insert({
          tipo: "direto",
          equipe_id: equipeDest.id,
          titulo: `Chat com ${equipeDest.codigo}`
        })
        .select()
        .single();

      if (error) throw error;

      const conversaCompleta = {
        ...nova,
        equipe: equipeDest
      } as ChatConversa;

      await abrirConversa(conversaCompleta);
      carregarConversas();

      return conversaCompleta;

    } catch (error) {
      console.error("Erro ao criar/obter conversa:", error);
      // Se falhou por causa de rede, tentar cache
      if (!isOnline) {
        const conversasCache = await getFromCache<ChatConversa[]>(`${CACHE_KEYS.MENSAGENS_CHAT}_conversas_${equipeDest.id}`);
        if (conversasCache && conversasCache.length > 0) {
          const conversaExistente = conversasCache.find(c => c.status === "ativo");
          if (conversaExistente) {
            const conversaCompleta = { ...conversaExistente, equipe: equipeDest } as ChatConversa;
            await abrirConversa(conversaCompleta);
            return conversaCompleta;
          }
        }
        toast.info("Chat indisponível offline. Conversas anteriores serão exibidas quando houver conexão.");
      } else {
        toast.error("Erro ao iniciar conversa");
      }
      return null;
    }
  }, [abrirConversa, carregarConversas, isOnline, getFromCache]);

  // ============================================
  // ENVIAR MENSAGEM DE TEXTO
  // ============================================

  const enviarMensagem = useCallback(async (conteudo: string) => {
    if (!conversaAtiva || !conteudo.trim()) return;

    setEnviando(true);
    
    // Criar mensagem temporária para feedback otimista
    const tempId = `temp-${Date.now()}`;
    const mensagemOtimista: ChatMensagem = {
      id: tempId,
      created_at: new Date().toISOString(),
      conversa_id: conversaAtiva.id,
      remetente_tipo: tipoUsuario,
      remetente_id: tipoUsuario === "torre" ? usuarioId || null : equipeId || null,
      remetente_nome: tipoUsuario === "torre" ? usuarioNome || null : equipeCodigo || null,
      tipo: "texto",
      conteudo: conteudo.trim(),
      arquivo_url: null,
      arquivo_nome: null,
      arquivo_tipo: null,
      arquivo_tamanho: null,
      audio_duracao: null,
      latitude: null,
      longitude: null,
      status: isOnline ? "enviando" : "enviada",
      lida_at: null,
      metadata: isOnline ? {} : { offline: true }
    };
    
    // Adicionar mensagem otimista imediatamente
    setMensagens(prev => [...prev, mensagemOtimista]);
    
    // Atualizar cache local com a nova mensagem
    const cacheKey = `${CACHE_KEYS.MENSAGENS_CHAT}_mensagens_${conversaAtiva.id}`;
    const cachedMsgs = await getFromCache<ChatMensagem[]>(cacheKey) || [];
    await saveToCache(cacheKey, [...cachedMsgs, mensagemOtimista], 24);
    
    // Se offline, enfileirar e retornar
    if (!isOnline) {
      console.log("[Chat] Enfileirando mensagem offline");
      await queueOperation({
        id: `chat-msg-${tempId}`,
        type: "insert",
        table: "chat_mensagens",
        data: {
          conversa_id: conversaAtiva.id,
          remetente_tipo: tipoUsuario,
          remetente_id: tipoUsuario === "torre" ? usuarioId : equipeId,
          remetente_nome: tipoUsuario === "torre" ? usuarioNome : equipeCodigo,
          tipo: "texto",
          conteudo: conteudo.trim(),
          status: "enviada"
        },
        timestamp: Date.now(),
        retryCount: 0,
      });
      toast.success("Mensagem salva! Será enviada quando houver internet.", { duration: 2000 });
      setEnviando(false);
      return;
    }
    
    try {
      const novaMensagem = {
        conversa_id: conversaAtiva.id,
        remetente_tipo: tipoUsuario,
        remetente_id: tipoUsuario === "torre" ? usuarioId : equipeId,
        remetente_nome: tipoUsuario === "torre" ? usuarioNome : equipeCodigo,
        tipo: "texto" as const,
        conteudo: conteudo.trim(),
        status: "enviada" as const
      };

      const { data, error } = await supabase
        .from("chat_mensagens")
        .insert(novaMensagem)
        .select()
        .single();

      if (error) throw error;

      // Substituir mensagem temporária pela real
      setMensagens(prev => prev.map(m => 
        m.id === tempId ? { ...data, status: "enviada" as const } : m
      ));
      
      // Recarregar conversas para atualizar preview
      carregarConversas();

    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Erro ao enviar mensagem");
      // Remover mensagem otimista em caso de erro
      setMensagens(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setEnviando(false);
    }
  }, [conversaAtiva, tipoUsuario, usuarioId, usuarioNome, equipeId, equipeCodigo, carregarConversas, isOnline, queueOperation, getFromCache, saveToCache]);

  // ============================================
  // ENVIAR IMAGEM
  // ============================================

  const enviarImagem = useCallback(async (file: File) => {
    if (!conversaAtiva) return;

    // Imagens requerem upload - não suportado offline
    if (!isOnline) {
      toast.error("Não é possível enviar imagens offline. Aguarde conexão com internet.");
      return;
    }

    setEnviando(true);
    
    // Criar mensagem otimista
    const tempId = `temp-img-${Date.now()}`;
    const mensagemOtimista: ChatMensagem = {
      id: tempId,
      created_at: new Date().toISOString(),
      conversa_id: conversaAtiva.id,
      remetente_tipo: tipoUsuario,
      remetente_id: tipoUsuario === "torre" ? usuarioId || null : equipeId || null,
      remetente_nome: tipoUsuario === "torre" ? usuarioNome || null : equipeCodigo || null,
      tipo: "imagem",
      conteudo: "📷 Enviando imagem...",
      arquivo_url: URL.createObjectURL(file),
      arquivo_nome: file.name,
      arquivo_tipo: file.type,
      arquivo_tamanho: file.size,
      audio_duracao: null,
      latitude: null,
      longitude: null,
      status: "enviando",
      lida_at: null,
      metadata: {}
    };
    
    setMensagens(prev => [...prev, mensagemOtimista]);
    
    try {
      // Upload para storage
      const fileName = `${conversaAtiva.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(fileName);

      // Criar mensagem
      const novaMensagem = {
        conversa_id: conversaAtiva.id,
        remetente_tipo: tipoUsuario,
        remetente_id: tipoUsuario === "torre" ? usuarioId : equipeId,
        remetente_nome: tipoUsuario === "torre" ? usuarioNome : equipeCodigo,
        tipo: "imagem" as const,
        conteudo: "📷 Imagem",
        arquivo_url: urlData.publicUrl,
        arquivo_nome: file.name,
        arquivo_tipo: file.type,
        arquivo_tamanho: file.size,
        status: "enviada" as const
      };

      const { data, error } = await supabase
        .from("chat_mensagens")
        .insert(novaMensagem)
        .select()
        .single();

      if (error) throw error;

      // Substituir mensagem temporária
      setMensagens(prev => prev.map(m => 
        m.id === tempId ? { ...data, status: "enviada" as const } : m
      ));
      
      carregarConversas();

    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
      toast.error("Erro ao enviar imagem");
      setMensagens(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setEnviando(false);
    }
  }, [conversaAtiva, tipoUsuario, usuarioId, usuarioNome, equipeId, equipeCodigo, carregarConversas]);

  // ============================================
  // ENVIAR LOCALIZAÇÃO
  // ============================================

  const enviarLocalizacao = useCallback(async (latitude: number, longitude: number) => {
    if (!conversaAtiva) return;

    setEnviando(true);
    
    // Criar mensagem otimista
    const tempId = `temp-loc-${Date.now()}`;
    const mensagemOtimista: ChatMensagem = {
      id: tempId,
      created_at: new Date().toISOString(),
      conversa_id: conversaAtiva.id,
      remetente_tipo: tipoUsuario,
      remetente_id: tipoUsuario === "torre" ? usuarioId || null : equipeId || null,
      remetente_nome: tipoUsuario === "torre" ? usuarioNome || null : equipeCodigo || null,
      tipo: "localizacao",
      conteudo: "📍 Localização compartilhada",
      arquivo_url: null,
      arquivo_nome: null,
      arquivo_tipo: null,
      arquivo_tamanho: null,
      audio_duracao: null,
      latitude,
      longitude,
      status: isOnline ? "enviando" : "enviada",
      lida_at: null,
      metadata: isOnline ? {} : { offline: true }
    };
    
    setMensagens(prev => [...prev, mensagemOtimista]);
    
    // Atualizar cache local com a nova mensagem
    const cacheKey = `${CACHE_KEYS.MENSAGENS_CHAT}_mensagens_${conversaAtiva.id}`;
    const cachedMsgs = await getFromCache<ChatMensagem[]>(cacheKey) || [];
    await saveToCache(cacheKey, [...cachedMsgs, mensagemOtimista], 24);
    
    // Se offline, enfileirar e retornar
    if (!isOnline) {
      console.log("[Chat] Enfileirando localização offline");
      await queueOperation({
        id: `chat-loc-${tempId}`,
        type: "insert",
        table: "chat_mensagens",
        data: {
          conversa_id: conversaAtiva.id,
          remetente_tipo: tipoUsuario,
          remetente_id: tipoUsuario === "torre" ? usuarioId : equipeId,
          remetente_nome: tipoUsuario === "torre" ? usuarioNome : equipeCodigo,
          tipo: "localizacao",
          conteudo: "📍 Localização compartilhada",
          latitude,
          longitude,
          status: "enviada"
        },
        timestamp: Date.now(),
        retryCount: 0,
      });
      toast.success("Localização salva! Será enviada quando houver internet.", { duration: 2000 });
      setEnviando(false);
      return;
    }
    
    try {
      const novaMensagem = {
        conversa_id: conversaAtiva.id,
        remetente_tipo: tipoUsuario,
        remetente_id: tipoUsuario === "torre" ? usuarioId : equipeId,
        remetente_nome: tipoUsuario === "torre" ? usuarioNome : equipeCodigo,
        tipo: "localizacao" as const,
        conteudo: "📍 Localização compartilhada",
        latitude,
        longitude,
        status: "enviada" as const
      };

      const { data, error } = await supabase
        .from("chat_mensagens")
        .insert(novaMensagem)
        .select()
        .single();

      if (error) throw error;

      // Substituir mensagem temporária
      setMensagens(prev => prev.map(m => 
        m.id === tempId ? { ...data, status: "enviada" as const } : m
      ));
      
      carregarConversas();

    } catch (error) {
      console.error("Erro ao enviar localização:", error);
      toast.error("Erro ao enviar localização");
      setMensagens(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setEnviando(false);
    }
  }, [conversaAtiva, tipoUsuario, usuarioId, usuarioNome, equipeId, equipeCodigo, carregarConversas, isOnline, queueOperation, getFromCache, saveToCache]);

  // ============================================
  // ENVIAR ÁUDIO
  // ============================================

  const enviarAudio = useCallback(async (audioBlob: Blob, duracao: number) => {
    if (!conversaAtiva) return;

    // Áudios requerem upload - não suportado offline
    if (!isOnline) {
      toast.error("Não é possível enviar áudio offline. Aguarde conexão com internet.");
      return;
    }

    setEnviando(true);
    
    // Criar mensagem otimista
    const tempId = `temp-audio-${Date.now()}`;
    const mensagemOtimista: ChatMensagem = {
      id: tempId,
      created_at: new Date().toISOString(),
      conversa_id: conversaAtiva.id,
      remetente_tipo: tipoUsuario,
      remetente_id: tipoUsuario === "torre" ? usuarioId || null : equipeId || null,
      remetente_nome: tipoUsuario === "torre" ? usuarioNome || null : equipeCodigo || null,
      tipo: "audio",
      conteudo: "🎤 Enviando áudio...",
      arquivo_url: URL.createObjectURL(audioBlob),
      arquivo_nome: `audio_${Date.now()}.webm`,
      arquivo_tipo: audioBlob.type,
      arquivo_tamanho: audioBlob.size,
      audio_duracao: duracao,
      latitude: null,
      longitude: null,
      status: "enviando",
      lida_at: null,
      metadata: {}
    };
    
    setMensagens(prev => [...prev, mensagemOtimista]);
    
    try {
      // Upload para storage
      const fileName = `${conversaAtiva.id}/${Date.now()}_audio.webm`;
      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(fileName, audioBlob, {
          contentType: audioBlob.type || "audio/webm"
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(fileName);

      // Criar mensagem
      const novaMensagem = {
        conversa_id: conversaAtiva.id,
        remetente_tipo: tipoUsuario,
        remetente_id: tipoUsuario === "torre" ? usuarioId : equipeId,
        remetente_nome: tipoUsuario === "torre" ? usuarioNome : equipeCodigo,
        tipo: "audio" as const,
        conteudo: "🎤 Mensagem de voz",
        arquivo_url: urlData.publicUrl,
        arquivo_nome: `audio_${Date.now()}.webm`,
        arquivo_tipo: audioBlob.type || "audio/webm",
        arquivo_tamanho: audioBlob.size,
        audio_duracao: duracao,
        status: "enviada" as const
      };

      const { data, error } = await supabase
        .from("chat_mensagens")
        .insert(novaMensagem)
        .select()
        .single();

      if (error) throw error;

      // Substituir mensagem temporária
      setMensagens(prev => prev.map(m => 
        m.id === tempId ? { ...data, status: "enviada" as const } : m
      ));
      
      carregarConversas();

    } catch (error) {
      console.error("Erro ao enviar áudio:", error);
      toast.error("Erro ao enviar áudio");
      setMensagens(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setEnviando(false);
    }
  }, [conversaAtiva, tipoUsuario, usuarioId, usuarioNome, equipeId, equipeCodigo, carregarConversas]);

  // ============================================
  // FECHAR CONVERSA
  // ============================================

  const fecharConversa = useCallback(() => {
    setConversaAtiva(null);
    setMensagens([]);

    if (mensagensChannelRef.current) {
      supabase.removeChannel(mensagensChannelRef.current);
      mensagensChannelRef.current = null;
    }
  }, []);

  // Manter ref atualizada para uso nos callbacks do realtime
  useEffect(() => {
    conversaAtivaIdRef.current = conversaAtiva?.id || null;
  }, [conversaAtiva]);

  // ============================================
  // REALTIME - NOVAS CONVERSAS E ATUALIZAÇÕES
  // ============================================

  useEffect(() => {
    // Carregar conversas inicialmente
    carregarConversasInternal();

    // Evitar criar canais duplicados
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Subscrever para atualizações de conversas
    channelRef.current = supabase
      .channel(`chat-conversas-${tipoUsuario}-${equipeId || "torre"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_conversas"
        },
        () => {
          console.log("[Chat Realtime] Atualização de conversas recebida");
          carregarConversasInternal();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_mensagens"
        },
        (payload) => {
          const novaMensagem = payload.new as ChatMensagem;
          console.log("[Chat Realtime] Nova mensagem global:", novaMensagem.id);
          
          // Se não estiver na conversa ativa, atualizar lista e mostrar notificação
          if (!conversaAtivaIdRef.current || novaMensagem.conversa_id !== conversaAtivaIdRef.current) {
            if (novaMensagem.remetente_tipo !== tipoUsuario) {
              notificationSound?.play().catch(() => {});
              carregarConversasInternal();
              onNovaMensagem?.(novaMensagem);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("[Chat Realtime] Status do canal global:", status);
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (mensagensChannelRef.current) {
        supabase.removeChannel(mensagensChannelRef.current);
        mensagensChannelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoUsuario, equipeId]); // Apenas recriar quando tipo/equipe mudam

  return {
    // Estado
    conversas,
    mensagens,
    conversaAtiva,
    loading,
    enviando,
    totalNaoLidas,
    
    // Ações
    carregarConversas,
    carregarMensagens,
    abrirConversa,
    obterOuCriarConversa,
    enviarMensagem,
    enviarImagem,
    enviarLocalizacao,
    enviarAudio,
    fecharConversa,
    setConversaAtiva
  };
}

export default useChat;

