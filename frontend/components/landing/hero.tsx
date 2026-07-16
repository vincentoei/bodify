"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { RotatingText } from "./rotating-text";
import { AgentShowcase } from "./agent-showcase";
import { DotBackground } from "./dot-background";
import { Loader2 } from "lucide-react";

type CtaState = "loading" | "dashboard" | "onboarding" | "signup";

interface HeroProps {
  ctaState: CtaState;
}

const CTA_CONFIG: Record<CtaState, { label: string; href: string; disabled?: boolean }> = {
  loading: { label: "Loading...", href: "#", disabled: true },
  dashboard: { label: "Go to Dashboard", href: "/dashboard" },
  onboarding: { label: "Create Your Journey", href: "/onboarding" },
  signup: { label: "Create Your Journey", href: "/signup" },
};

export function Hero({ ctaState }: HeroProps) {
  const { signInAsDemo } = useAuth();
  const router = useRouter();

  const handleDemo = async () => {
    await signInAsDemo();
    router.push("/dashboard");
  };

  const cta = CTA_CONFIG[ctaState];
  const isLoading = ctaState === "loading";

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-4 pt-16 text-center sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 bottom-0 top-16 z-0 overflow-hidden pointer-events-none">
        <DotBackground />
      </div>
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center bg-offWhite rounded-3xl px-4 sm:px-8 py-12 will-change-transform">
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-brandDark sm:text-5xl lg:text-7xl">
          <span className="block">Your body. Your journey.</span>
          <span className="block mt-2">
            <RotatingText />
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-brandDark/60 sm:text-lg">
          A council of five specialized AI agents designs your body transformation journey and adapts as life gets messy.
        </p>

        <div className="mx-auto mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            onClick={handleDemo}
            className="bg-lightGreen text-brandDark hover:bg-lightGreen/90"
          >
            Try Demo Account
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => router.push(cta.href)}
            disabled={cta.disabled}
            className="border-brandDark/20 bg-white text-brandDark hover:bg-gray-100 disabled:opacity-70 disabled:cursor-not-allowed min-w-[180px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {cta.label}
              </>
            ) : (
              cta.label
            )}
          </Button>
        </div>

        <div className="mt-12">
          <AgentShowcase />
        </div>
      </div>
    </section>
  );
}
