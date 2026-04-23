import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ArrowLeft, Calendar as CalendarIcon, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Calendar } from "react-native-calendars";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import ClientPickerModal from "@/components/ClientPickerModal";
import { apiPostJson } from "@/utils/api";

function formatDisplayDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DatePickerField({ label, value, onSelect, minDate, placeholder }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <View style={{ marginBottom: 20 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: "600",
            color: "#000",
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
        <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen(true)}>
          <GlassView
            style={[
              {
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 12,
                overflow: "hidden",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <Text style={{ fontSize: 16, color: value ? "#000" : "#999", flex: 1 }}>
              {value ? formatDisplayDate(value) : placeholder || "Select date"}
            </Text>
            <CalendarIcon size={20} color="#8E8E93" />
          </GlassView>
        </TouchableOpacity>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{
              width: "90%",
              maxWidth: 380,
              backgroundColor: "#fff",
              borderRadius: 20,
              overflow: "hidden",
              ...Platform.select({
                ios: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
                android: { elevation: 12 },
              }),
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 18,
                paddingTop: 16,
                paddingBottom: 8,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#000" }}>
                {label}
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <X size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {open ? (
              <Calendar
                current={value || undefined}
                minDate={minDate || undefined}
                markedDates={
                  value
                    ? { [value]: { selected: true, selectedColor: "#007AFF" } }
                    : {}
                }
                onDayPress={(day) => {
                  const ds = day?.dateString;
                  if (!ds) return;
                  onSelect(ds);
                  setOpen(false);
                }}
                theme={{
                  todayTextColor: "#007AFF",
                  arrowColor: "#007AFF",
                  textDayFontSize: 15,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 13,
                  textDayFontWeight: "500",
                  textMonthFontWeight: "700",
                  "stylesheet.calendar.header": {
                    dayTextAtIndex0: { color: "#C62828" },
                    dayTextAtIndex6: { color: "#C62828" },
                  },
                }}
              />
            ) : null}

            <View style={{ height: 16 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

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
          onSelect={setStartDate}
          minDate={today}
          placeholder="Select start date"
        />

        <DatePickerField
          label="End Date *"
          value={endDate}
          onSelect={setEndDate}
          minDate={startDate || today}
          placeholder="Select end date"
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
