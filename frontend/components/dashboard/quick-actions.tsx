"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Sparkles } from "lucide-react";

const actions = [
  {
    label: "Report Setback",
    href: "/dashboard/recovery",
    icon: Activity,
    description: "Get back on track compassionately",
    color: "text-purple-600 bg-purple-50",
  },
  {
    label: "What-If",
    href: "/dashboard/simulate",
    icon: Sparkles,
    description: "Explore scenario simulations",
    color: "text-amber-600 bg-amber-50",
  },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.href}
              variant="outline"
              className="h-auto justify-start gap-3 p-3 text-left"
              asChild
            >
              <Link href={action.href}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${action.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </Link>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
