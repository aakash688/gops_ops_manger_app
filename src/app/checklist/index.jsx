import { View, Text, Pressable } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { CheckSquare, Square } from "lucide-react-native";
import { useState } from "react";
import StackScreen from "@/components/StackScreen";

const ITEMS = [
  { id: "a", label: "ID documents verified (physical copy)" },
  { id: "b", label: "Police verification on file" },
  { id: "c", label: "Site induction completed" },
  { id: "d", label: "Panic button / app login tested" },
  { id: "e", label: "Supervisor sign-off" },
];

export default function ChecklistScreen() {
  const [done, setDone] = useState({});

  const toggle = (id) => {
    setDone((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const count = ITEMS.filter((i) => done[i.id]).length;

  return (
    <StackScreen title="Compliance checklist" subtitle={`${count}/${ITEMS.length} completed`}>
      {ITEMS.map((item) => (
        <Pressable key={item.id} onPress={() => toggle(item.id)} style={{ marginBottom: 10 }}>
          <GlassView
            isInteractive
            style={[
              {
                padding: 14,
                borderRadius: 14,
                overflow: "hidden",
                flexDirection: "row",
                alignItems: "center",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            {done[item.id] ? (
              <CheckSquare size={22} color="#34C759" />
            ) : (
              <Square size={22} color="#8E8E93" />
            )}
            <Text
              style={{
                marginLeft: 12,
                flex: 1,
                fontSize: 16,
                color: "#000",
                textDecorationLine: done[item.id] ? "line-through" : "none",
                opacity: done[item.id] ? 0.65 : 1,
              }}
            >
              {item.label}
            </Text>
          </GlassView>
        </Pressable>
      ))}

      <View style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 13, color: "#666" }}>
          Checklist is stored when you connect to operations. Offline taps are queued on sync.
        </Text>
      </View>
    </StackScreen>
  );
}
