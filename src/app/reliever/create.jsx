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

export default function CreateRelieverRequest() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [site, setSite] = useState("");
  const [date, setDate] = useState("");
  const [guardsRequired, setGuardsRequired] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!site || !date || !guardsRequired || !reason) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/reliever-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site,
          date,
          guardsRequired: parseInt(guardsRequired),
          reason,
          status: "PENDING",
        }),
      });

      if (!response.ok) throw new Error("Failed to create request");

      Alert.alert("Success", "Reliever request created successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to create request. Please try again.");
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
          Request Reliever
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
        {/* Site */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Site
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
              placeholder="Enter site name"
              value={site}
              onChangeText={setSite}
              style={{ fontSize: 16, color: "#000" }}
              placeholderTextColor="#999"
            />
          </GlassView>
        </View>

        {/* Date */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Date Required
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
              placeholder="YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
              style={{ fontSize: 16, color: "#000" }}
              placeholderTextColor="#999"
            />
          </GlassView>
        </View>

        {/* Guards Required */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Number of Guards
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
              placeholder="Enter number of guards required"
              value={guardsRequired}
              onChangeText={setGuardsRequired}
              keyboardType="numeric"
              style={{ fontSize: 16, color: "#000" }}
              placeholderTextColor="#999"
            />
          </GlassView>
        </View>

        {/* Reason */}
        <View style={{ marginBottom: 32 }}>
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
              placeholder="e.g., Emergency leave, Sick leave"
              value={reason}
              onChangeText={setReason}
              style={{ fontSize: 16, color: "#000" }}
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
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
              {loading ? "Submitting..." : "Submit Request"}
            </Text>
          </GlassView>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingAnimatedView>
  );
}
