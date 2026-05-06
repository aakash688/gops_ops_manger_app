import { useEffect } from "react";
import { Modal, View, Text, Pressable, Platform, BackHandler } from "react-native";

/**
 * Blocks interaction until the app is exempt from Android battery optimizations ("Unrestricted"),
 * required for reliable background location and compliance alerts.
 */
export default function BatteryOptimizationGate({ visible, onOpenSettings }) {
  useEffect(() => {
    if (Platform.OS !== "android" || !visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [visible]);

  if (Platform.OS !== "android" || !visible) return null;

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={() => {}}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#0d1117",
          justifyContent: "center",
          paddingHorizontal: 28,
        }}
      >
        <Text
          style={{
            color: "#f0883e",
            fontSize: 22,
            fontWeight: "900",
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          Unrestricted battery required
        </Text>
        <Text
          style={{
            color: "#e6edf3",
            fontSize: 16,
            textAlign: "center",
            lineHeight: 24,
            fontWeight: "600",
          }}
        >
          Live tracking and compliance alerts must keep running when the app is in the background or
          closed. Allow unrestricted battery usage for G-OPS, then return here.
        </Text>
        <Pressable
          onPress={() => onOpenSettings?.()}
          style={({ pressed }) => ({
            marginTop: 32,
            backgroundColor: pressed ? "#1f6feb" : "#238636",
            paddingVertical: 16,
            paddingHorizontal: 24,
            borderRadius: 12,
            alignItems: "center",
          })}
        >
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>Open battery settings</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
