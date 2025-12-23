import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Zap, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useWebAuth } from "@/contexts/WebAuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn: webSignIn, usuarioWeb, loading: webLoading } = useWebAuth();
  const { signIn: authSignIn, user, loading: authLoading } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const loading = webLoading || authLoading;

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    if (!loading && (user || usuarioWeb)) {
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  }, [user, usuarioWeb, loading, navigate, location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validar formulário
      const validation = loginSchema.safeParse({
        email: loginEmail,
        password: loginPassword,
      });

      if (!validation.success) {
        toast({
          title: "Erro de validação",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Primeiro, tenta login com usuarios_web
      const { error: webError } = await webSignIn(loginEmail, loginPassword);
      
      if (!webError) {
        toast({
          title: "Login realizado!",
          description: "Bem-vindo ao SirtecRoute",
        });
        return;
      }

      // Se falhou no usuarios_web, tenta no Supabase Auth (fallback)
      const { error: authError } = await authSignIn(loginEmail, loginPassword);
      
      if (authError) {
        // Ambos falharam
        toast({
          title: "Erro ao fazer login",
          description: webError.message || "Email ou senha incorretos",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Login via Supabase Auth funcionou
      toast({
        title: "Login realizado!",
        description: "Bem-vindo ao SirtecRoute",
      });
    } catch (err) {
      console.error("Erro no login:", err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao fazer login. Tente novamente.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
        
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm mb-8 shadow-2xl">
            <Zap className="h-10 w-10 text-white" />
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-4">
            Sistema de Roteirização STC
          </h1>
          
          <p className="text-xl text-white/80 mb-8 max-w-md">
            Otimize suas rotas. Maximize resultados.
          </p>

          {/* Abstract Routes Illustration */}
          <div className="relative w-full max-w-md h-48 mt-8">
            <svg viewBox="0 0 400 200" className="w-full h-full">
              {/* Route paths */}
              <path 
                d="M50 150 Q 100 50, 200 100 T 350 80" 
                stroke="rgba(255,255,255,0.3)" 
                strokeWidth="3" 
                fill="none"
                strokeDasharray="10,5"
              />
              <path 
                d="M30 100 Q 150 180, 250 120 T 380 140" 
                stroke="rgba(255,255,255,0.4)" 
                strokeWidth="2" 
                fill="none"
              />
              <path 
                d="M80 180 Q 180 80, 300 130 T 370 100" 
                stroke="rgba(255,255,255,0.2)" 
                strokeWidth="4" 
                fill="none"
                strokeDasharray="15,8"
              />
              
              {/* Location markers */}
              <circle cx="50" cy="150" r="8" fill="rgba(255,255,255,0.8)" />
              <circle cx="200" cy="100" r="6" fill="rgba(255,255,255,0.6)" />
              <circle cx="350" cy="80" r="8" fill="rgba(255,255,255,0.8)" />
              <circle cx="250" cy="120" r="5" fill="rgba(255,255,255,0.5)" />
              <circle cx="300" cy="130" r="7" fill="rgba(255,255,255,0.7)" />
            </svg>
          </div>
          
          <div className="mt-12 grid grid-cols-3 gap-8 text-white/80">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">98%</div>
              <div className="text-sm">Eficiência</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">24/7</div>
              <div className="text-sm">Disponível</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">500+</div>
              <div className="text-sm">Rotas/dia</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl gradient-primary mx-auto mb-4">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">SirtecRoute</h1>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Bem-vindo de volta</h2>
              <p className="text-gray-500 mt-2">Faça login para continuar</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-gray-700">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-gray-700">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" />
                  <label htmlFor="remember" className="text-sm text-gray-500 cursor-pointer">
                    Lembrar de mim
                  </label>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Problemas para acessar? Entre em contato com o administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
