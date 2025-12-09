import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  showDatePicker?: boolean;
}

export function MainLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
  showDatePicker = true,
}: MainLayoutProps) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isDark={isDark} setIsDark={setIsDark} />
      <div className="lg:ml-64">
        <Header
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          showDatePicker={showDatePicker}
        />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
