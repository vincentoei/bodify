import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Server Component cannot set cookies during render.
            // The middleware/page will handle it on the client.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // Same as above.
          }
        },
      },
    }
  );

  // Use getSession() instead of getUser() in Server Components.
  // getUser() validates the JWT and may try to refresh the session,
  // but Server Components cannot set cookies during render, which can
  // cause a stale-but-refreshable session to be rejected here. The
  // client-side AuthProvider on the onboarding page handles refresh
  // and its own redirect, so this guard only catches absent sessions.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/signin");
  }

  return <>{children}</>;
}
