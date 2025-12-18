import { createContext, useContext, useEffect, useRef, ReactNode, useCallback } from "react";
import { useLocation } from "react-router-dom";

// Chave para sessionStorage
const SCROLL_STATE_KEY = "app-scroll-positions";
const DEBUG = true; // Ativar para debug

interface ScrollPosition {
  scrollTop: number;
  timestamp: number;
}

interface ScrollRestoreContextType {
  saveCurrentScroll: () => void;
}

const ScrollRestoreContext = createContext<ScrollRestoreContextType | null>(null);

// Funções helper para sessionStorage
function getStoredPositions(): Record<string, ScrollPosition> {
  try {
    const stored = sessionStorage.getItem(SCROLL_STATE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePosition(path: string, scrollTop: number) {
  try {
    const positions = getStoredPositions();
    positions[path] = {
      scrollTop,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(SCROLL_STATE_KEY, JSON.stringify(positions));
    if (DEBUG) console.log(`[ScrollRestore] 💾 Saved scroll for ${path}: ${scrollTop}px`);
  } catch {
    // Ignorar erros de storage
  }
}

function getPosition(path: string): number | null {
  try {
    const positions = getStoredPositions();
    const saved = positions[path];
    // Só restaurar se foi salvo nos últimos 30 minutos
    if (saved && Date.now() - saved.timestamp < 30 * 60 * 1000) {
      if (DEBUG) console.log(`[ScrollRestore] 📖 Found saved scroll for ${path}: ${saved.scrollTop}px`);
      return saved.scrollTop;
    }
    if (DEBUG && saved) console.log(`[ScrollRestore] ⏰ Scroll for ${path} expired`);
    return null;
  } catch {
    return null;
  }
}

export function ScrollRestoreProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const previousPathRef = useRef<string>(location.pathname);
  const targetScrollRef = useRef<number | null>(null);
  const isRestoringRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const restoreAttemptsRef = useRef(0);
  const maxRestoreAttempts = 50; // Máximo de tentativas

  // Função para obter o elemento main
  const getMainElement = useCallback((): HTMLElement | null => {
    return document.querySelector("main");
  }, []);

  // Função para aplicar scroll
  const applyScroll = useCallback((scrollTop: number) => {
    const main = getMainElement();
    if (main) {
      // Verificar se o conteúdo é grande o suficiente para o scroll
      if (main.scrollHeight > main.clientHeight) {
        const maxScroll = main.scrollHeight - main.clientHeight;
        const targetScroll = Math.min(scrollTop, maxScroll);
        main.scrollTop = targetScroll;
        
        if (DEBUG) {
          console.log(`[ScrollRestore] 📍 Applied scroll: ${targetScroll}px (requested: ${scrollTop}px, max: ${maxScroll}px, current: ${main.scrollTop}px)`);
        }
        
        // Verificar se funcionou
        if (Math.abs(main.scrollTop - targetScroll) < 5) {
          return true; // Sucesso
        }
      } else {
        if (DEBUG) {
          console.log(`[ScrollRestore] ⚠️ Content not scrollable yet. scrollHeight: ${main.scrollHeight}px, clientHeight: ${main.clientHeight}px`);
        }
      }
    }
    return false;
  }, [getMainElement]);

  // Função para tentar restaurar scroll continuamente
  const tryRestoreScroll = useCallback(() => {
    if (targetScrollRef.current === null || !isRestoringRef.current) return;
    
    restoreAttemptsRef.current++;
    
    if (restoreAttemptsRef.current > maxRestoreAttempts) {
      if (DEBUG) console.log(`[ScrollRestore] ❌ Max attempts reached, giving up`);
      isRestoringRef.current = false;
      targetScrollRef.current = null;
      return;
    }
    
    const success = applyScroll(targetScrollRef.current);
    
    if (success) {
      if (DEBUG) console.log(`[ScrollRestore] ✅ Scroll restored successfully after ${restoreAttemptsRef.current} attempts`);
      isRestoringRef.current = false;
      targetScrollRef.current = null;
    }
  }, [applyScroll]);

  // Função para salvar scroll atual
  const saveCurrentScroll = useCallback(() => {
    if (isRestoringRef.current) return; // Não salvar enquanto estiver restaurando
    
    const main = getMainElement();
    if (main && location.pathname && main.scrollTop > 0) {
      savePosition(location.pathname, main.scrollTop);
    }
  }, [location.pathname, getMainElement]);

  // Iniciar restauração de scroll
  const startRestoreScroll = useCallback((path: string) => {
    const savedScrollTop = getPosition(path);
    
    if (savedScrollTop !== null && savedScrollTop > 0) {
      if (DEBUG) console.log(`[ScrollRestore] 🔄 Starting scroll restoration to ${savedScrollTop}px for ${path}`);
      
      targetScrollRef.current = savedScrollTop;
      isRestoringRef.current = true;
      restoreAttemptsRef.current = 0;
      
      // Tentar imediatamente
      tryRestoreScroll();
      
      // Configurar MutationObserver para detectar mudanças no DOM
      const main = getMainElement();
      if (main) {
        // Limpar observer anterior
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
        
        observerRef.current = new MutationObserver(() => {
          if (isRestoringRef.current) {
            tryRestoreScroll();
          }
        });
        
        observerRef.current.observe(main, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        
        if (DEBUG) console.log(`[ScrollRestore] 👀 MutationObserver active`);
      }
      
      // Também tentar com intervalos regulares
      const intervalId = setInterval(() => {
        if (!isRestoringRef.current) {
          clearInterval(intervalId);
          return;
        }
        tryRestoreScroll();
      }, 100);
      
      // Parar após 5 segundos
      setTimeout(() => {
        clearInterval(intervalId);
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
        if (isRestoringRef.current) {
          if (DEBUG) console.log(`[ScrollRestore] ⏱️ Timeout reached, stopping restoration`);
          isRestoringRef.current = false;
          targetScrollRef.current = null;
        }
      }, 5000);
      
    } else {
      if (DEBUG) console.log(`[ScrollRestore] ℹ️ No saved scroll for ${path}, starting at top`);
      // Garantir que começa no topo
      const main = getMainElement();
      if (main) {
        main.scrollTop = 0;
      }
    }
  }, [getMainElement, tryRestoreScroll]);

  // Detectar mudança de rota
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;
    
    if (DEBUG) console.log(`[ScrollRestore] 🔀 Route: ${previousPath} → ${currentPath}`);
    
    // Se mudou de rota
    if (previousPath !== currentPath) {
      // Parar qualquer restauração em andamento
      isRestoringRef.current = false;
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      
      // Salvar scroll da rota anterior
      const main = getMainElement();
      if (main && main.scrollTop > 0) {
        savePosition(previousPath, main.scrollTop);
      }
      
      // Iniciar restauração para a nova rota (com pequeno delay)
      setTimeout(() => {
        startRestoreScroll(currentPath);
      }, 50);
    }
    
    // Atualizar ref
    previousPathRef.current = currentPath;
    
    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [location.pathname, startRestoreScroll, getMainElement]);

  // Salvar scroll quando o usuário para de rolar (debounced)
  useEffect(() => {
    const handleScroll = () => {
      if (isRestoringRef.current) return;
      
      // Debounce
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        saveCurrentScroll();
      }, 500);
    };
    
    const main = getMainElement();
    if (main) {
      main.addEventListener("scroll", handleScroll, { passive: true });
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (main) {
        main.removeEventListener("scroll", handleScroll);
      }
    };
  }, [saveCurrentScroll, getMainElement, location.pathname]);

  // Salvar scroll periodicamente como backup
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRestoringRef.current) {
        saveCurrentScroll();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [saveCurrentScroll]);

  // Salvar scroll antes de fechar/recarregar a página
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveCurrentScroll();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [saveCurrentScroll]);

  return (
    <ScrollRestoreContext.Provider value={{ saveCurrentScroll }}>
      {children}
    </ScrollRestoreContext.Provider>
  );
}

export function useScrollRestore() {
  const context = useContext(ScrollRestoreContext);
  return context || { saveCurrentScroll: () => {} };
}

/**
 * Hook simplificado - não precisa mais fazer nada especial
 * O ScrollRestoreProvider já cuida de tudo automaticamente
 * Este hook existe apenas para compatibilidade com código existente
 */
export function usePageScrollRestore(_pageKey?: string, _additionalState?: Record<string, any>) {
  // Não precisa fazer nada - o provider já cuida de tudo
  return { savedState: undefined };
}

/**
 * Hook para salvar/restaurar estado adicional de uma página (além do scroll)
 */
export function usePageState<T extends Record<string, any>>(pageKey: string) {
  const getState = useCallback((): T | null => {
    try {
      const stored = sessionStorage.getItem(`page-state-${pageKey}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [pageKey]);

  const saveState = useCallback((state: T) => {
    try {
      sessionStorage.setItem(`page-state-${pageKey}`, JSON.stringify(state));
    } catch {
      // Ignorar erros
    }
  }, [pageKey]);

  return { getState, saveState };
}
