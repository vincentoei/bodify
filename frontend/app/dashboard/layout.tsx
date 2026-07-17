"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

const SIDEBAR_STORAGE_KEY = "bodify-sidebar-open";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/signin");
    }
  }, [user, isLoading, router]);

  // Restore desktop sidebar state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved !== null) {
        setSidebarOpen(saved === "true");
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Persist desktop sidebar state
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen));
    } catch {
      // Ignore localStorage errors
    }
  }, [sidebarOpen]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading your journey...</p>
      </div>
    );
  }

  const pageTitle =
    {
      "/dashboard": "Today",
      "/dashboard/calendar": "Calendar",
      "/dashboard/recovery": "Recovery",
      "/dashboard/simulate": "What-If",
      "/dashboard/help": "Help",
    }[pathname] || "";

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar
        currentPath={pathname}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Top bar with mobile menu toggle */}
        <header className="flex h-14 items-center gap-3 border-b bg-white px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-sm font-medium text-muted-foreground md:text-base">
            {pageTitle}
          </h1>
        </header>

        <div className="relative flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
