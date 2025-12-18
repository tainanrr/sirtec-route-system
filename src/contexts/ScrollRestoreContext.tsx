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
  const isRestoringRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mainElementRef = useRef<HTMLElement | null>(null);

  // Função para encontrar e cachear o elemento main
  const getMainElement = useCallback(() => {
    if (!mainElementRef.current) {
      mainElementRef.current = document.querySelector("main");
    }
    return mainElementRef.current;
  }, []);

  // Função para obter scroll atual
  const getCurrentScroll = useCallback(() => {
    const main = getMainElement();
    if (main) {
      return main.scrollTop;
    }
    return window.scrollY;
  }, [getMainElement]);

  // Função para definir scroll
  const setScroll = useCallback((scrollTop: number) => {
    const main = getMainElement();
    if (main) {
      main.scrollTop = scrollTop;
      if (DEBUG) console.log(`[ScrollRestore] 📍 Set main.scrollTop = ${scrollTop}`);
    } else {
      window.scrollTo(0, scrollTop);
      if (DEBUG) console.log(`[ScrollRestore] 📍 Set window.scrollY = ${scrollTop}`);
    }
  }, [getMainElement]);

  // Função para salvar scroll atual
  const saveCurrentScroll = useCallback(() => {
    const scrollTop = getCurrentScroll();
    if (location.pathname && scrollTop > 0) {
      savePosition(location.pathname, scrollTop);
    }
  }, [location.pathname, getCurrentScroll]);

  // Função para restaurar scroll
  const restoreScroll = useCallback((path: string) => {
    const savedScrollTop = getPosition(path);
    if (savedScrollTop !== null && savedScrollTop > 0) {
      isRestoringRef.current = true;
      
      if (DEBUG) console.log(`[ScrollRestore] 🔄 Attempting to restore scroll to ${savedScrollTop}px for ${path}`);
      
      // Tentar restaurar múltiplas vezes com delays crescentes
      // Isso é necessário porque o conteúdo pode ainda estar carregando
      const attempts = [0, 50, 100, 200, 300, 500, 800, 1200];
      
      attempts.forEach((delay) => {
        setTimeout(() => {
          if (!isRestoringRef.current) return;
          
          setScroll(savedScrollTop);
          
          // Verificar se funcionou
          const currentScroll = getCurrentScroll();
          if (DEBUG && delay === attempts[attempts.length - 1]) {
            console.log(`[ScrollRestore] ✅ Final scroll position: ${currentScroll}px (target: ${savedScrollTop}px)`);
          }
        }, delay);
      });
      
      // Parar de tentar restaurar após o último delay + margem
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 1500);
    } else {
      if (DEBUG) console.log(`[ScrollRestore] ℹ️ No saved scroll for ${path}, starting at top`);
    }
  }, [setScroll, getCurrentScroll]);

  // Detectar mudança de rota
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;
    
    if (DEBUG) console.log(`[ScrollRestore] 🔀 Route: ${previousPath} → ${currentPath}`);
    
    // Se mudou de rota
    if (previousPath !== currentPath) {
      // Salvar scroll da rota anterior ANTES de mudar
      const scrollTop = getCurrentScroll();
      if (scrollTop > 0) {
        savePosition(previousPath, scrollTop);
      }
      
      // Restaurar scroll para a nova rota
      // Pequeno delay para garantir que o DOM foi atualizado
      setTimeout(() => {
        restoreScroll(currentPath);
      }, 10);
    }
    
    // Atualizar ref
    previousPathRef.current = currentPath;
    
  }, [location.pathname, restoreScroll, getCurrentScroll]);

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
    
    // Adicionar listener no main
    const main = getMainElement();
    if (main) {
      main.addEventListener("scroll", handleScroll, { passive: true });
      if (DEBUG) console.log(`[ScrollRestore] 👂 Listening to main scroll events`);
    }
    // Também no window como fallback
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
  }, [saveCurrentScroll, getMainElement, location.pathname]);

  // Salvar scroll periodicamente como backup
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRestoringRef.current) {
        const scrollTop = getCurrentScroll();
        if (scrollTop > 0) {
          savePosition(location.pathname, scrollTop);
        }
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [location.pathname, getCurrentScroll]);

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

  // Re-capturar o elemento main quando a rota muda
  useEffect(() => {
    mainElementRef.current = null; // Resetar cache
    setTimeout(() => {
      mainElementRef.current = document.querySelector("main");
      if (DEBUG && mainElementRef.current) {
        console.log(`[ScrollRestore] 🎯 Main element found, scrollHeight: ${mainElementRef.current.scrollHeight}px`);
      }
    }, 100);
  }, [location.pathname]);

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
