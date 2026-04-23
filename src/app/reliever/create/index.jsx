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
import ClientPickerModal from "@/components/ClientPickerModal";
import { DatePickerField } from "@/components/DatePicker";
import { apiPostJson } from "@/utils/api";

export default function CreateRelieverRequest() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [client, setClient] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [relieversNeeded, setRelieversNeeded] = useState("");
  const [reason, setReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [pickingClient, setPickingClient] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const handleSubmit = async () => {
    if (!client?.id || !startDate || !endDate || !relieversNeeded) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      await apiPostJson("/reliever-requests", {
        clientId: client.id,
        relieversNeeded: parseInt(relieversNeeded, 10),
        startDate,
        endDate,
        reason: reason || null,
        additionalNotes: additionalNotes || null,
      });

      Alert.alert("Success", "Reliever request created successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to create request. Please try again.",
      );
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
        {/* Client/Site */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Client / Site *
          </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setPickingClient(true)}>
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
              <Text style={{ fontSize: 16, color: client ? "#000" : "#999" }}>
                {client ? client.clientName : "Select client"}
              </Text>
            </GlassView>
          </TouchableOpacity>
        </View>

        <DatePickerField
          label="Start Date *"
          value={startDate}
          onChange={setStartDate}
          minDate={today}
          placeholder="Select start date"
          marginBottom={20}
        />

        <DatePickerField
          label="End Date *"
          value={endDate}
          onChange={setEndDate}
          minDate={startDate || today}
          placeholder="Select end date"
          marginBottom={20}
        />

        {/* Relievers Needed */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Relievers Needed *
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
              placeholder="Enter number of relievers"
              value={relieversNeeded}
              onChangeText={setRelieversNeeded}
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
              style={{ fontSize: 16, color: "#000", minHeight: 80 }}
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </GlassView>
        </View>

        {/* Notes */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Additional notes
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
              placeholder="Optional"
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              style={{ fontSize: 16, color: "#000", minHeight: 60 }}
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
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

      <ClientPickerModal
        visible={pickingClient}
        onClose={() => setPickingClient(false)}
        onSelect={(c) => {
          setClient(c);
          setPickingClient(false);
        }}
        title="Select client"
        subtitle="Reliever request will be raised for this site"
      />
    </KeyboardAvoidingAnimatedView>
  );
}
