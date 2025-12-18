import { createContext, useContext, useEffect, useRef, ReactNode, useCallback } from "react";
import { useLocation } from "react-router-dom";

// Chave para sessionStorage
const SCROLL_STATE_KEY = "app-scroll-positions";

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
      return saved.scrollTop;
    }
    return null;
  } catch {
    return null;
  }
}

export function ScrollRestoreProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const previousPathRef = useRef<string | null>(null);
  const isRestoringRef = useRef(false);

  // Função para salvar scroll atual
  const saveCurrentScroll = useCallback(() => {
    const mainElement = document.querySelector("main");
    if (mainElement && location.pathname) {
      savePosition(location.pathname, mainElement.scrollTop);
    }
  }, [location.pathname]);

  // Salvar scroll quando a rota vai mudar (antes da navegação)
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveCurrentScroll();
    };

    // Salvar quando a janela fecha ou recarrega
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [saveCurrentScroll]);

  // Detectar mudança de rota e salvar/restaurar scroll
  useEffect(() => {
    const currentPath = location.pathname;
    
    // Se temos um caminho anterior diferente do atual, salvar o scroll do anterior
    if (previousPathRef.current && previousPathRef.current !== currentPath) {
      // Já foi salvo no cleanup do effect anterior
    }
    
    // Restaurar scroll para o novo caminho
    const savedScrollTop = getPosition(currentPath);
    if (savedScrollTop !== null && savedScrollTop > 0) {
      isRestoringRef.current = true;
      
      // Tentar restaurar múltiplas vezes para garantir que o conteúdo carregou
      const attempts = [50, 150, 300, 500];
      attempts.forEach((delay) => {
        setTimeout(() => {
          const mainElement = document.querySelector("main");
          if (mainElement && isRestoringRef.current) {
            mainElement.scrollTo({ top: savedScrollTop, behavior: "instant" });
          }
        }, delay);
      });
      
      // Parar de tentar restaurar após 1 segundo
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 1000);
    }
    
    // Atualizar ref do caminho anterior
    previousPathRef.current = currentPath;
    
    // Cleanup: salvar scroll quando sair desta rota
    return () => {
      if (!isRestoringRef.current) {
        const mainElement = document.querySelector("main");
        if (mainElement) {
          savePosition(currentPath, mainElement.scrollTop);
        }
      }
    };
  }, [location.pathname]);

  // Salvar scroll periodicamente enquanto na página
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRestoringRef.current) {
        saveCurrentScroll();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [saveCurrentScroll]);

  // Salvar scroll quando o usuário para de rolar
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      if (isRestoringRef.current) return;
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        saveCurrentScroll();
      }, 200);
    };
    
    const mainElement = document.querySelector("main");
    if (mainElement) {
      mainElement.addEventListener("scroll", handleScroll, { passive: true });
    }
    
    return () => {
      clearTimeout(scrollTimeout);
      if (mainElement) {
        mainElement.removeEventListener("scroll", handleScroll);
      }
    };
  }, [saveCurrentScroll, location.pathname]);

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
