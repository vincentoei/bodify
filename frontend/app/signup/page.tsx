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
import { PasswordRequirements } from "@/components/auth/password-requirements";
import {
  signUpSchema,
  getFieldErrors,
  getAuthErrorMessage,
  passwordRequirements,
  type FieldErrors,
} from "@/lib/validation/auth";
import { safeParse } from "valibot";
import { Eye, EyeOff } from "lucide-react";

export default function SignUpPage() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const isPasswordValid = passwordRequirements.every((requirement) =>
    requirement.test(password)
  );

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const result = safeParse(signUpSchema, {
      fullName,
      email,
      password,
      confirmPassword,
    });
    if (!result.success) {
      setFieldErrors(getFieldErrors(result.issues));
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, fullName || undefined);
      router.push("/?signup_pending=true");
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen overflow-hidden bg-offWhite">
      {/* Illustration side */}
      <div className="hidden h-full md:flex md:w-1/2">
        <AuthIllustration variant="constellation" />
      </div>

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
                Welcome to Bodify!
              </h1>
              <p className="mt-1 text-sm text-brandDark/60">
                Sign up and let your agents guide you.
              </p>
            </div>

          <form onSubmit={handleSignUp} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-sm text-brandDark">
                Full Name{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="e.g. Vincent Oei"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11 border-brandDark/10 bg-white text-brandDark placeholder:text-brandDark/40 focus-visible:ring-darkGreen"
              />
              {fieldErrors.fullName && (
                <p className="text-sm text-destructive">{fieldErrors.fullName}</p>
              )}
            </div>

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
                  placeholder="Password"
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
              <PasswordRequirements password={password} />
              {fieldErrors.password && (
                <p className="text-sm text-destructive">{fieldErrors.password}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm text-brandDark">
                Confirm Password{" "}
                <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-11 border-brandDark/10 bg-white pr-10 text-brandDark placeholder:text-brandDark/40 focus-visible:ring-darkGreen"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brandDark/40 hover:text-brandDark/70"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              disabled={
                loading ||
                !fullName.trim() ||
                !email.trim() ||
                !password ||
                !confirmPassword ||
                !isPasswordValid
              }
              className="h-11 w-full bg-lightGreen text-brandDark hover:bg-lightGreen/90"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-brandDark/60">
            Already have an account?{" "}
            <Link
              href="/signin"
              className="font-medium text-darkGreen hover:underline"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
    </main>
  );
}
