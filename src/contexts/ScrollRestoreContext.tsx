import { createContext, useContext, useEffect, useRef, ReactNode, useCallback } from "react";
import { useLocation } from "react-router-dom";

// Chave para sessionStorage
const SCROLL_STATE_KEY = "app-scroll-positions";
const DEBUG = false; // Ativar para debug

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
    if (DEBUG) console.log(`[ScrollRestore] Saved scroll for ${path}: ${scrollTop}`);
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
      if (DEBUG) console.log(`[ScrollRestore] Found saved scroll for ${path}: ${saved.scrollTop}`);
      return saved.scrollTop;
    }
    return null;
  } catch {
    return null;
  }
}

// Função para encontrar o elemento scrollável
function getScrollableElement(): HTMLElement | null {
  // Primeiro, tentar o main
  const main = document.querySelector("main");
  if (main && main.scrollHeight > main.clientHeight) {
    return main as HTMLElement;
  }
  
  // Fallback para window/document
  return document.documentElement;
}

export function ScrollRestoreProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const previousPathRef = useRef<string>(location.pathname);
  const isRestoringRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Função para salvar scroll atual
  const saveCurrentScroll = useCallback(() => {
    const scrollElement = getScrollableElement();
    if (scrollElement && location.pathname) {
      const scrollTop = scrollElement === document.documentElement 
        ? window.scrollY 
        : scrollElement.scrollTop;
      
      if (scrollTop > 0) {
        savePosition(location.pathname, scrollTop);
      }
    }
  }, [location.pathname]);

  // Função para restaurar scroll
  const restoreScroll = useCallback((path: string) => {
    const savedScrollTop = getPosition(path);
    if (savedScrollTop !== null && savedScrollTop > 0) {
      isRestoringRef.current = true;
      
      if (DEBUG) console.log(`[ScrollRestore] Attempting to restore scroll to ${savedScrollTop} for ${path}`);
      
      // Tentar restaurar múltiplas vezes com delays crescentes
      const attempts = [0, 50, 100, 200, 400, 800];
      
      attempts.forEach((delay) => {
        setTimeout(() => {
          if (!isRestoringRef.current) return;
          
          const scrollElement = getScrollableElement();
          if (scrollElement) {
            if (scrollElement === document.documentElement) {
              window.scrollTo({ top: savedScrollTop, behavior: "instant" });
            } else {
              scrollElement.scrollTo({ top: savedScrollTop, behavior: "instant" });
            }
            if (DEBUG) console.log(`[ScrollRestore] Restored scroll at ${delay}ms delay`);
          }
        }, delay);
      });
      
      // Parar de tentar restaurar após o último delay
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 1000);
    }
  }, []);

  // Detectar mudança de rota
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;
    
    if (DEBUG) console.log(`[ScrollRestore] Route changed from ${previousPath} to ${currentPath}`);
    
    // Se mudou de rota, salvar scroll da rota anterior
    if (previousPath !== currentPath) {
      // O scroll já foi salvo pelo cleanup do effect anterior
      // Agora restaurar scroll para a nova rota
      restoreScroll(currentPath);
    }
    
    // Atualizar ref
    previousPathRef.current = currentPath;
    
    // Cleanup: salvar scroll quando sair desta rota
    return () => {
      if (!isRestoringRef.current) {
        const scrollElement = getScrollableElement();
        if (scrollElement) {
          const scrollTop = scrollElement === document.documentElement 
            ? window.scrollY 
            : scrollElement.scrollTop;
          
          if (scrollTop > 0) {
            savePosition(currentPath, scrollTop);
            if (DEBUG) console.log(`[ScrollRestore] Cleanup: saved scroll ${scrollTop} for ${currentPath}`);
          }
        }
      }
    };
  }, [location.pathname, restoreScroll]);

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
      }, 300);
    };
    
    // Adicionar listener no main e window
    const main = document.querySelector("main");
    if (main) {
      main.addEventListener("scroll", handleScroll, { passive: true });
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (main) {
        main.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("scroll", handleScroll);
    };
  }, [saveCurrentScroll, location.pathname]);

  // Salvar scroll periodicamente como backup
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRestoringRef.current) {
        saveCurrentScroll();
      }
    }, 3000);
    
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
