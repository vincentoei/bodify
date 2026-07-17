"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import {
  CalendarDays,
  Activity,
  Sparkles,
  MessageCircleQuestion,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Today", icon: CalendarDays },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/recovery", label: "Recovery", icon: Activity },
  { href: "/dashboard/simulate", label: "What-If", icon: Sparkles },
];

interface SidebarProps {
  currentPath: string;
  isOpen: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SidebarContent({
  currentPath,
  isOpen,
  onToggle,
  isMobile,
  onClose,
}: Omit<SidebarProps, "mobileOpen" | "onMobileClose"> & {
  isMobile?: boolean;
  onClose?: () => void;
}) {
  const { signOut } = useAuth();

  return (
    <>
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center overflow-hidden">
          <Image
            src="/bodify-logo.svg"
            alt="Bodify"
            width={140}
            height={40}
            priority
            className={`h-8 w-auto transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 w-0"}`}
          />
        </Link>
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
          </Button>
        )}
        {isMobile && onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={isMobile ? onClose : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
              title={!isOpen && !isMobile ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span
                className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                  isOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3 space-y-1">
        <Button variant="ghost" className="w-full justify-start gap-3 px-3" asChild>
          <Link href="/dashboard/help" onClick={isMobile ? onClose : undefined}>
            <MessageCircleQuestion className="h-5 w-5 shrink-0" />
            <span
              className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                isOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
              }`}
            >
              Help
            </span>
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 text-destructive hover:text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
              isOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
            }`}
          >
            Sign Out
          </span>
        </Button>
      </div>
    </>
  );
}

export function Sidebar({
  currentPath,
  isOpen,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r bg-white transition-all duration-300 ease-in-out h-screen ${
          isOpen ? "w-64" : "w-16"
        }`}
      >
        <SidebarContent currentPath={currentPath} isOpen={isOpen} onToggle={onToggle} />
      </aside>

      {/* Mobile drawer overlay + sidebar */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-white md:hidden">
            <SidebarContent
              currentPath={currentPath}
              isOpen={true}
              onToggle={onToggle}
              isMobile
              onClose={onMobileClose}
            />
          </aside>
        </>
      )}
    </>
  );
}
