"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthIllustration } from "@/components/auth/auth-illustration";
import { apiGet } from "@/lib/api";
import {
  signInSchema,
  getFieldErrors,
  getAuthErrorMessage,
  type FieldErrors,
} from "@/lib/validation/auth";
import { safeParse } from "valibot";
import { Eye, EyeOff } from "lucide-react";

export default function SignInPage() {
  const { signInWithPassword } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    const result = safeParse(signInSchema, { email, password });
    if (!result.success) {
      setFieldErrors(getFieldErrors(result.issues));
      setLoading(false);
      return;
    }

    try {
      await signInWithPassword(email, password);
      try {
        const planData = await apiGet<{ plan: unknown }>("/plan/current");
        if (planData.plan) {
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      } catch {
        router.push("/onboarding");
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen overflow-hidden bg-offWhite">
      {/* Form side */}
      <div className="flex w-full flex-col px-6 py-8 md:w-1/2 lg:px-16 xl:px-24">
        <Link href="/" className="self-start">
          <Image
            src="/bodify-logo.svg"
            alt="Bodify"
            width={140}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-6 flex flex-col items-center text-center">
              <h1 className="text-2xl font-bold text-brandDark sm:text-3xl">
                Sign in
              </h1>
              <p className="mt-1 text-sm text-brandDark/60">
                to continue to your Bodify account.
              </p>
            </div>

          <form onSubmit={handleSignIn} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-brandDark">
                Email{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 border-brandDark/10 bg-white text-brandDark placeholder:text-brandDark/40 focus-visible:ring-darkGreen"
              />
              {fieldErrors.email && (
                <p className="text-sm text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-brandDark">
                Password{" "}
                <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 border-brandDark/10 bg-white pr-10 text-brandDark placeholder:text-brandDark/40 focus-visible:ring-darkGreen"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brandDark/40 hover:text-brandDark/70"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-sm text-destructive">{fieldErrors.password}</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="h-11 w-full bg-lightGreen text-brandDark hover:bg-lightGreen/90"
            >
              {loading ? "Signing in..." : "Continue"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-brandDark/60">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-darkGreen hover:underline"
            >
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>

    {/* Illustration side */}
      <div className="hidden h-full md:flex md:w-1/2">
        <AuthIllustration variant="heart" />
      </div>
    </main>
  );
}
