import type { Metadata } from "next";
import { Suspense } from "react";
import { Onboarding } from "@/components/app/auth/Onboarding";

export const metadata: Metadata = { title: "Atlethera", robots: { index: false } };

export default function OnboardingPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
