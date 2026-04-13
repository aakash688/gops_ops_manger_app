import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ArrowLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";

export default function AddPenalty() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [guardId, setGuardId] = useState("");
  const [guardName, setGuardName] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!guardId || !reason || !amount) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/penalties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: guardId,
          reason,
          amount: parseFloat(amount),
          date: new Date().toISOString().split("T")[0],
        }),
      });

      if (!response.ok) throw new Error("Failed to add penalty");

      Alert.alert("Success", "Penalty added successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to add penalty. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: "#F5F5F7" }}
      behavior="padding"
    >
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 16 }}
        >
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000" }}>
          Add Penalty
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Guard ID */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Employee ID
          </Text>
          <GlassView
            style={[
              {
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 12,
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <TextInput
              placeholder="Enter employee ID"
              value={guardId}
              onChangeText={setGuardId}
              style={{ fontSize: 16, color: "#000" }}
              placeholderTextColor="#999"
            />
          </GlassView>
        </View>

        {/* Guard Name */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Employee Name
          </Text>
          <GlassView
            style={[
              {
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 12,
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <TextInput
              placeholder="Enter employee name"
              value={guardName}
              onChangeText={setGuardName}
              style={{ fontSize: 16, color: "#000" }}
              placeholderTextColor="#999"
            />
          </GlassView>
        </View>

        {/* Reason */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Reason
          </Text>
          <GlassView
            style={[
              {
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 12,
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <TextInput
              placeholder="e.g., Uniform violation, Late arrival"
              value={reason}
              onChangeText={setReason}
              style={{ fontSize: 16, color: "#000" }}
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </GlassView>
        </View>

        {/* Amount */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Amount (₹)
          </Text>
          <GlassView
            style={[
              {
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 12,
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <TextInput
              placeholder="Enter amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              style={{ fontSize: 16, color: "#000" }}
              placeholderTextColor="#999"
            />
          </GlassView>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={{
            opacity: loading ? 0.6 : 1,
          }}
        >
          <GlassView
            isInteractive={true}
            style={[
              {
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#007AFF" },
            ]}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: "600",
                color: isLiquidGlassAvailable() ? "#000" : "#FFF",
              }}
            >
              {loading ? "Submitting..." : "Submit Penalty"}
            </Text>
          </GlassView>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingAnimatedView>
  );
}
