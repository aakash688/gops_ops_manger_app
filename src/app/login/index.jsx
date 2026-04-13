import { View, Text, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LogIn } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import StackScreen from "@/components/StackScreen";
import { apiPostJson } from "@/utils/api";
import { useAuthStore } from "@/utils/auth/store";

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Enter work email and password.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiPostJson("/apps/auth/login", {
        email: email.trim(),
        password,
      });
      setAuth({
        jwt: data.token,
        user: {
          name: data.employee?.name ?? "",
          email: data.employee?.email ?? email.trim(),
          orgName: data.active_organization?.name ?? "",
          orgId: data.active_organization?.id ?? "",
        },
        organizations: Array.isArray(data.organizations) ? data.organizations : [],
      });
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      Alert.alert("Sign in failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <StackScreen
      title="Login"
      subtitle="Sign in with your organization email (mobile access required)"
    >
      <GlassView
        isInteractive
        style={[
          {
            padding: 20,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 20,
          },
          isLiquidGlassAvailable()
            ? {}
            : { opacity: 0.95, backgroundColor: "#ffffff" },
        ]}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: "#000",
            marginBottom: 8,
          }}
        >
          Work email
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@company.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          style={{
            borderWidth: 1,
            borderColor: "#E5E5EA",
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 16,
            color: "#000",
            marginBottom: 14,
          }}
        />
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: "#000",
            marginBottom: 8,
          }}
        >
          Password
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#999"
          secureTextEntry
          style={{
            borderWidth: 1,
            borderColor: "#E5E5EA",
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 16,
            color: "#000",
            marginBottom: 16,
          }}
        />
        <Pressable
          onPress={handleEmailLogin}
          disabled={loading}
          style={({ pressed }) => ({
            backgroundColor: "#007AFF",
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
            opacity: pressed || loading ? 0.85 : 1,
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          })}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <LogIn size={20} color="#FFF" />
          )}
          <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}>
            Sign in
          </Text>
        </Pressable>
      </GlassView>

      <Text
        style={{
          fontSize: 13,
          color: "#666",
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        Uses the same account as G-ops when mobile access is enabled for your
        employee profile.
      </Text>

      <Pressable onPress={() => router.back()} style={{ marginTop: 24 }}>
        <Text
          style={{
            fontSize: 15,
            color: "#007AFF",
            textAlign: "center",
            fontWeight: "600",
          }}
        >
          Back
        </Text>
      </Pressable>
    </StackScreen>
  );
}
