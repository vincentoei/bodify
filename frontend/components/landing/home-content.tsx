"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { apiGet } from "@/lib/api";
import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { ScrollMarquee } from "@/components/landing/scroll-marquee";
import { AboutSection } from "@/components/landing/about-section";
import { Footer } from "@/components/landing/footer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, PartyPopper } from "lucide-react";

function ConfirmationModals() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut } = useAuth();
  const processedRef = useRef({ signupPending: false, emailConfirmed: false });
  const [signupPendingOpen, setSignupPendingOpen] = useState(false);
  const [emailConfirmedOpen, setEmailConfirmedOpen] = useState(false);

  useEffect(() => {
    const signupPending = searchParams.get("signup_pending") === "true";
    const emailConfirmed = searchParams.get("email_confirmed") === "true";

    if (signupPending && !processedRef.current.signupPending) {
      processedRef.current.signupPending = true;
      setSignupPendingOpen(true);
    }

    if (emailConfirmed && !processedRef.current.emailConfirmed) {
      processedRef.current.emailConfirmed = true;
      // Ensure the user is signed out so they explicitly sign in after confirming email.
      signOut().catch(() => {
        // Ignore errors from sign-out; the modal flow continues regardless.
      });
      setEmailConfirmedOpen(true);
    }
  }, [searchParams, signOut]);

  const handleContinue = () => {
    setEmailConfirmedOpen(false);
    router.replace("/");
  };

  const handleCloseSignupPending = () => {
    setSignupPendingOpen(false);
    router.replace("/");
  };

  return (
    <>
      <Dialog open={signupPendingOpen} onOpenChange={setSignupPendingOpen}>
        <DialogContent onCloseAutoFocus={handleCloseSignupPending}>
          <DialogHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-lightGreen">
              <Mail className="h-6 w-6 text-brandDark" />
            </div>
            <DialogTitle className="text-brandDark">Check your email</DialogTitle>
            <DialogDescription>
              We&apos;ve sent a confirmation link to your email address. Please click it to complete
              your account setup and start your Bodify journey.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={handleCloseSignupPending}
            className="w-full bg-lightGreen text-brandDark hover:bg-lightGreen/90"
          >
            Got it
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={emailConfirmedOpen} onOpenChange={setEmailConfirmedOpen}>
        <DialogContent onCloseAutoFocus={() => router.replace("/")}>
          <DialogHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-lightGreen">
              <PartyPopper className="h-6 w-6 text-brandDark" />
            </div>
            <DialogTitle className="text-brandDark">Account created successfully</DialogTitle>
            <DialogDescription>
              Your email has been confirmed. Welcome to Bodify — your personal council of AI
              specialists is ready to design a plan that fits your body and life.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={handleContinue}
            className="w-full bg-lightGreen text-brandDark hover:bg-lightGreen/90"
          >
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

type CtaState = "loading" | "dashboard" | "onboarding" | "signup";

function getCtaState(
  isLoading: boolean,
  user: ReturnType<typeof useAuth>["user"],
  planChecked: boolean,
  hasPlan: boolean
): CtaState {
  if (isLoading || (user && !planChecked)) return "loading";
  if (user && hasPlan) return "dashboard";
  if (user) return "onboarding";
  return "signup";
}

export default function HomeContent() {
  const { user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const [hasPlan, setHasPlan] = useState(false);
  const [planChecked, setPlanChecked] = useState(false);

  const ctaState = getCtaState(isLoading, user, planChecked, hasPlan);

  const hasAuthModalParam =
    searchParams.get("signup_pending") === "true" ||
    searchParams.get("email_confirmed") === "true";

  useEffect(() => {
    if (user) {
      apiGet<{ plan: unknown }>("/plan/current")
        .then((data) => {
          setHasPlan(!!data.plan);
        })
        .catch(() => {
          setHasPlan(false);
        })
        .finally(() => {
          setPlanChecked(true);
        });
    } else {
      setHasPlan(false);
      setPlanChecked(true);
    }
  }, [user]);

  if (ctaState === "loading" && !hasAuthModalParam) {
    return (
      <div className="flex h-screen items-center justify-center bg-offWhite">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-lightGreen" />
          <p className="text-sm text-brandDark/60">Loading Bodify...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-offWhite">
      <Header />
      <Hero ctaState={ctaState} />
      <ScrollMarquee />
      <AboutSection />
      <Footer />
      <ConfirmationModals />
    </div>
  );
}
