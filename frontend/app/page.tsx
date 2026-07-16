import { Suspense } from "react";
import HomeContent from "@/components/landing/home-content";

function HomeLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-offWhite">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-lightGreen" />
        <p className="text-sm text-brandDark/60">Loading Bodify...</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}
