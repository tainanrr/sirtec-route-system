import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      expand
      visibleToasts={5}
      toastOptions={{
        duration: 5000,
        style: {
          zIndex: 999999,
          background: "white",
          color: "black",
          border: "1px solid #e5e5e5",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        },
        classNames: {
          toast: "!bg-white !text-black !border !shadow-xl",
          title: "!text-black !font-semibold",
          description: "!text-gray-600",
          error: "!bg-red-50 !text-red-900 !border-red-200",
          success: "!bg-green-50 !text-green-900 !border-green-200",
          warning: "!bg-yellow-50 !text-yellow-900 !border-yellow-200",
          info: "!bg-blue-50 !text-blue-900 !border-blue-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
