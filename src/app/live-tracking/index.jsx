import { View, Text, Pressable } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { MapPin, Navigation, Radio } from "lucide-react-native";
import StackScreen from "@/components/StackScreen";

const TEAM = [
  { id: "1", name: "Rajesh Kumar", site: "Warehouse 2", status: "On shift", updated: "2m ago" },
  { id: "2", name: "Amit Singh", site: "Office Complex", status: "Break", updated: "6m ago" },
  { id: "3", name: "Priya Sharma", site: "Mall Entrance", status: "Patrol", updated: "1m ago" },
];

export default function LiveTrackingScreen() {
  return (
    <StackScreen title="Live tracking" subtitle="Last known GPS from guard devices">
      <GlassView
        style={[
          {
            height: 160,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(0,122,255,0.2)",
            borderStyle: "dashed",
          },
          isLiquidGlassAvailable()
            ? {}
            : { opacity: 0.95, backgroundColor: "#E8F4FF" },
        ]}
      >
        <MapPin size={36} color="#007AFF" />
        <Text style={{ marginTop: 10, fontWeight: "700", color: "#000" }}>Map preview</Text>
        <Text style={{ fontSize: 13, color: "#666", marginTop: 4, textAlign: "center", paddingHorizontal: 24 }}>
          Connect your map provider (Google/Mapbox) to plot live pins. Coordinates update when guards open the app.
        </Text>
      </GlassView>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <Pressable
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: "#007AFF",
            borderRadius: 12,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Navigation size={18} color="#FFF" />
          <Text style={{ color: "#FFF", fontWeight: "700" }}>Center map</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: "#F2F2F7",
            borderRadius: 12,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Radio size={18} color="#000" />
          <Text style={{ color: "#000", fontWeight: "700" }}>Refresh</Text>
        </Pressable>
      </View>

      <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 10, color: "#000" }}>
        Team
      </Text>
      {TEAM.map((t) => (
        <GlassView
          key={t.id}
          style={[
            {
              padding: 14,
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 10,
            },
            isLiquidGlassAvailable()
              ? {}
              : { opacity: 0.95, backgroundColor: "#ffffff" },
          ]}
        >
          <Text style={{ fontWeight: "700", color: "#000" }}>{t.name}</Text>
          <Text style={{ color: "#666", marginTop: 4 }}>{t.site}</Text>
          <Text style={{ color: "#007AFF", marginTop: 6, fontSize: 13 }}>
            {t.status} · {t.updated}
          </Text>
        </GlassView>
      ))}
    </StackScreen>
  );
}
