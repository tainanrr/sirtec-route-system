export function getAppParentRoute(pathname: string): string | null {
  // Home
  if (pathname === "/app") return null;

  // Ordens
  // /app/ordens/:id/apr -> /app/ordens/:id
  // /app/ordens/:id/materiais -> /app/ordens/:id
  const ordensSubMatch = pathname.match(/^\/app\/ordens\/([^/]+)\/(apr|materiais)$/);
  if (ordensSubMatch) {
    const id = ordensSubMatch[1];
    return `/app/ordens/${id}`;
  }

  // /app/ordens/:id -> /app/ordens
  const ordemMatch = pathname.match(/^\/app\/ordens\/([^/]+)$/);
  if (ordemMatch) return "/app/ordens";

  // /app/ordens -> /app
  if (pathname === "/app/ordens") return "/app";

  // Estoque (se tiver sub-rotas no futuro)
  if (pathname.startsWith("/app/estoque/")) return "/app/estoque";
  if (pathname === "/app/estoque") return "/app";

  // Perfil (se tiver sub-rotas no futuro)
  if (pathname.startsWith("/app/perfil/")) return "/app/perfil";
  if (pathname === "/app/perfil") return "/app";

  // fallback genérico
  if (pathname.startsWith("/app/")) return "/app";
  return null;
}





