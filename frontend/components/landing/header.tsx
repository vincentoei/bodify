"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import Image from "next/image";

export function Header() {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignOut = async () => {
    setSignOutOpen(false);
    await signOut();
    router.push("/");
  };

  return (
    <>
      <header
        className={`fixed top-0 z-50 w-full px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
          scrolled
            ? "bg-offWhite/80 backdrop-blur-md shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
          <button
            onClick={() => router.push("/")}
            aria-label="Go to homepage"
          >
            <Image
              src="/bodify-logo.svg"
              alt="Bodify"
              width={120}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </button>

          <nav className="flex items-center gap-2 sm:gap-3">
            {isLoading ? (
              <div className="h-9 w-20 animate-pulse rounded-md bg-brandDark/10" />
            ) : user ? (
              <Button
                variant="outline"
                onClick={() => setSignOutOpen(true)}
                className="border-red-500 bg-transparent text-red-500 hover:bg-red-50 hover:text-red-600"
              >
                Sign Out
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => router.push("/signin")}
                  className="text-brandDark hover:bg-brandDark/5 hover:text-brandDark"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => router.push("/signup")}
                  className="bg-lightGreen text-brandDark hover:bg-lightGreen/90"
                >
                  Sign Up
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out of your Bodify account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button
              variant="outline"
              onClick={() => setSignOutOpen(false)}
              className="border-brandDark/20 text-brandDark hover:bg-brandDark/5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSignOut}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
