import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function OnboardingScreen() {
  // Direct-open flow: this screen exists only for routing compatibility.
  // If user lands here, immediately redirect to the onboarding form.
  const router = useRouter();
  useEffect(() => {
    router.replace("/onboarding/form");
  }, [router]);
  return null;
}
