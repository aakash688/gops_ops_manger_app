import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LogIn, Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState, useRef } from "react";
import StackScreen from "@/components/StackScreen";
import { apiPostJson } from "@/utils/api";
import { useAuthStore } from "@/utils/auth/store";

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const passwordRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
          employeeId: data.employee?.id ?? "",
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
    <StackScreen title="Sign in" subtitle="G-ops · operations app" showBack={false}>
      <View style={styles.hero}>
        <LinearGradient
          colors={["#007AFF", "#0051D5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroIconWrap}
        >
          <ShieldCheck size={32} color="#FFF" strokeWidth={2} />
        </LinearGradient>
        <Text style={styles.heroTitle}>Welcome back</Text>
        <Text style={styles.heroSubtitle}>Sign in with your organization email</Text>
      </View>

      <View style={styles.cardShadow}>
        <GlassView
          isInteractive
          style={[
            styles.card,
            isLiquidGlassAvailable() ? {} : { backgroundColor: "#FFFFFF", opacity: 0.98 },
          ]}
        >
          <Text style={styles.fieldLabel}>Work email</Text>
          <View
            style={[
              styles.inputShell,
              emailFocused && styles.inputShellFocused,
            ]}
          >
            <Mail size={20} color={emailFocused ? "#007AFF" : "#8E8E93"} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor="#AEAEB2"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              style={styles.input}
              editable={!loading}
            />
          </View>

          <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Password</Text>
          <View
            style={[
              styles.inputShell,
              passwordFocused && styles.inputShellFocused,
            ]}
          >
            <Lock size={20} color={passwordFocused ? "#007AFF" : "#8E8E93"} />
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor="#AEAEB2"
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleEmailLogin}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              style={styles.input}
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff size={22} color="#8E8E93" />
              ) : (
                <Eye size={22} color="#8E8E93" />
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={handleEmailLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryBtn,
              (pressed || loading) && styles.primaryBtnPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <LogIn size={20} color="#FFF" />
                <Text style={styles.primaryBtnText}>Sign in</Text>
              </>
            )}
          </Pressable>
        </GlassView>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          Same account as G-ops web when{" "}
          <Text style={styles.noticeEm}>mobile access</Text> is enabled on your profile.
        </Text>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    marginBottom: 28,
    marginTop: 4,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    ...Platform.select({
      ios: {
        shadowColor: "#007AFF",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 15,
    color: "#636366",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  cardShadow: {
    borderRadius: 18,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  card: {
    padding: 22,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3A3A3C",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  fieldLabelSpaced: {
    marginTop: 4,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    backgroundColor: "rgba(245,245,247,0.65)",
  },
  inputShellFocused: {
    borderColor: "#007AFF",
    backgroundColor: "#FAFBFF",
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#000",
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
  },
  primaryBtn: {
    marginTop: 22,
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primaryBtnPressed: {
    opacity: 0.88,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
    marginLeft: 10,
  },
  notice: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  noticeText: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 19,
  },
  noticeEm: {
    fontWeight: "700",
    color: "#636366",
  },
});
