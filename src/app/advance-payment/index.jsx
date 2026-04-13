import { View, Text, TextInput, Pressable } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Banknote } from "lucide-react-native";
import { useState } from "react";
import StackScreen from "@/components/StackScreen";

export default function AdvancePaymentScreen() {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [employee, setEmployee] = useState("");

  return (
    <StackScreen title="Advance payment" subtitle="Request salary advance for field staff">
      <GlassView
        isInteractive
        style={[
          {
            padding: 18,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 16,
          },
          isLiquidGlassAvailable()
            ? {}
            : { opacity: 0.95, backgroundColor: "#ffffff" },
        ]}
      >
        <Text style={{ fontWeight: "600", marginBottom: 6, color: "#000" }}>Employee</Text>
        <TextInput
          value={employee}
          onChangeText={setEmployee}
          placeholder="Name or employee ID"
          placeholderTextColor="#999"
          style={{
            borderWidth: 1,
            borderColor: "#E5E5EA",
            borderRadius: 12,
            padding: 12,
            marginBottom: 14,
            color: "#000",
          }}
        />
        <Text style={{ fontWeight: "600", marginBottom: 6, color: "#000" }}>Amount (₹)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          keyboardType="decimal-pad"
          placeholderTextColor="#999"
          style={{
            borderWidth: 1,
            borderColor: "#E5E5EA",
            borderRadius: 12,
            padding: 12,
            marginBottom: 14,
            color: "#000",
          }}
        />
        <Text style={{ fontWeight: "600", marginBottom: 6, color: "#000" }}>Reason</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Emergency, medical, travel…"
          placeholderTextColor="#999"
          multiline
          style={{
            borderWidth: 1,
            borderColor: "#E5E5EA",
            borderRadius: 12,
            padding: 12,
            minHeight: 88,
            textAlignVertical: "top",
            color: "#000",
          }}
        />
      </GlassView>

      <Pressable
        style={({ pressed }) => ({
          backgroundColor: "#007AFF",
          borderRadius: 12,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.88 : 1,
        })}
      >
        <Banknote size={20} color="#FFF" />
        <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>Submit request</Text>
      </Pressable>

      <Text style={{ marginTop: 16, fontSize: 13, color: "#666", lineHeight: 18 }}>
        Finance will review against roster and attendance. You will get a notification when status changes.
      </Text>
    </StackScreen>
  );
}
