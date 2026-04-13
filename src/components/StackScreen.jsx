import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

export default function StackScreen({
  title,
  subtitle,
  children,
  contentStyle,
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F5F5F7" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(0,0,0,0.06)",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ArrowLeft size={24} color="#000" />
        </Pressable>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          {
            padding: 20,
            paddingBottom: insets.bottom + 32,
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
