import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      style={{ zIndex: 99999 }}
      toastOptions={{
        duration: (t) => {
          // Erros ficam abertos por 30 segundos ou até fechar manualmente
          if (t.type === "error") {
            return 30000;
          }
          // Sucesso e info ficam por 5 segundos
          if (t.type === "success" || t.type === "info") {
            return 5000;
          }
          // Outros tipos ficam por 4 segundos
          return 4000;
        },
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:z-[99999]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toast]:border-destructive group-[.toast]:bg-destructive/10",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
