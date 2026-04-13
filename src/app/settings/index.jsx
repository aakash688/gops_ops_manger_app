import { View, Text, Switch } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Bell, Smartphone, Cloud } from "lucide-react-native";
import { useState } from "react";
import StackScreen from "@/components/StackScreen";

export default function SettingsScreen() {
  const [push, setPush] = useState(true);
  const [sync, setSync] = useState(true);

  return (
    <StackScreen title="App settings" subtitle="Notifications & data">
      <GlassView
        style={[
          {
            padding: 16,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
          isLiquidGlassAvailable()
            ? {}
            : { opacity: 0.95, backgroundColor: "#ffffff" },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <Bell size={22} color="#007AFF" />
          <Text style={{ marginLeft: 12, fontSize: 16, color: "#000", fontWeight: "500" }}>
            Push alerts
          </Text>
        </View>
        <Switch value={push} onValueChange={setPush} />
      </GlassView>

      <GlassView
        style={[
          {
            padding: 16,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
          isLiquidGlassAvailable()
            ? {}
            : { opacity: 0.95, backgroundColor: "#ffffff" },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <Cloud size={22} color="#007AFF" />
          <Text style={{ marginLeft: 12, fontSize: 16, color: "#000", fontWeight: "500" }}>
            Background sync
          </Text>
        </View>
        <Switch value={sync} onValueChange={setSync} />
      </GlassView>

      <GlassView
        style={[
          {
            padding: 16,
            borderRadius: 16,
            overflow: "hidden",
            flexDirection: "row",
            alignItems: "center",
          },
          isLiquidGlassAvailable()
            ? {}
            : { opacity: 0.95, backgroundColor: "#ffffff" },
        ]}
      >
        <Smartphone size={22} color="#8E8E93" />
        <View style={{ marginLeft: 12 }}>
          <Text style={{ fontSize: 16, color: "#000", fontWeight: "500" }}>Build</Text>
          <Text style={{ fontSize: 13, color: "#666", marginTop: 4 }}>Expo · production channel</Text>
        </View>
      </GlassView>
    </StackScreen>
  );
}
