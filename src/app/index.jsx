import { Redirect } from "expo-router";
import { useAuthStore } from "@/utils/auth/store";

export default function Index() {
  const auth = useAuthStore((s) => s.auth);
  const isReady = useAuthStore((s) => s.isReady);

  if (!isReady) {
    return null;
  }

  if (!auth?.jwt) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
