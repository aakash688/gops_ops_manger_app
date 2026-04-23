import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ArrowLeft, Search, User } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { apiGetJson } from "@/utils/api";
import { createLeaveRequest } from "@/utils/leaveRequests";
import { DatePickerField } from "@/components/DatePicker";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function LeaveRequestCreate() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [empQuery, setEmpQuery] = useState("");
  const [empResults, setEmpResults] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const q = empQuery.trim();
    if (q.length < 2) {
      setEmpResults([]);
      return undefined;
    }
    setEmpLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          limit: "10",
          offset: "0",
          brief: "true",
          name: q,
        });
        const { data } = await apiGetJson(`/employees?${params.toString()}`);
        setEmpResults(Array.isArray(data) ? data : []);
      } catch {
        setEmpResults([]);
      } finally {
        setEmpLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [empQuery]);

  const onStartChange = useCallback((d) => {
    setStartDate(d);
    if (endDate && d > endDate) setEndDate(d);
  }, [endDate]);

  const selectEmployee = useCallback((row) => {
    setSelected({
      id: row.employeeId,
      label: `${row.employeeName || ""} · ${row.employeeCode || ""}`.trim(),
    });
    setEmpQuery("");
    setEmpResults([]);
    Keyboard.dismiss();
  }, []);

  const submit = async () => {
    if (!selected?.id) {
      Alert.alert("Required", "Select an employee");
      return;
    }
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
      Alert.alert("Dates", "Select start and end dates");
      return;
    }
    if (startDate > endDate) {
      Alert.alert("Dates", "End date must be on or after start date");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Required", "Enter a reason");
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRequest({
        employeeId: selected.id,
        startDate,
        endDate,
        reason: reason.trim(),
      });
      Alert.alert("Success", "Leave request created", [
        { text: "OK", onPress: () => router.replace("/leave-approval") },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
      <StatusBar style="dark" />

      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(0,0,0,0.06)",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>Create leave</Text>
          <Text style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
            Active org · admin/manager can create for any employee
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 12, fontWeight: "700", color: "#8E8E93", marginBottom: 8 }}>
          EMPLOYEE
        </Text>
        {selected ? (
          <GlassView
            style={[
              {
                padding: 14,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
              },
              isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
            ]}
          >
            <User size={22} color="#007AFF" />
            <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: "#000" }}>
              {selected.label}
            </Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={{ color: "#007AFF", fontWeight: "700" }}>Change</Text>
            </TouchableOpacity>
          </GlassView>
        ) : (
          <>
            <GlassView
              style={[
                {
                  borderRadius: 12,
                  overflow: "hidden",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                },
                isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
              ]}
            >
              <Search size={18} color="#666" />
              <TextInput
                placeholder="Search by name or employee code"
                value={empQuery}
                onChangeText={setEmpQuery}
                style={{ flex: 1, fontSize: 15, color: "#000" }}
                placeholderTextColor="#999"
                autoCorrect={false}
              />
              {empLoading ? <ActivityIndicator size="small" color="#007AFF" /> : null}
            </GlassView>
            {empResults.length > 0 ? (
              <GlassView
                style={[
                  { borderRadius: 12, overflow: "hidden", marginBottom: 16 },
                  isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
                ]}
              >
                {empResults.map((row) => (
                  <Pressable
                    key={row.employeeId}
                    onPress={() => selectEmployee(row)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: "rgba(0,0,0,0.06)",
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>
                      {row.employeeName}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
                      {row.employeeCode}
                      {row.designationName ? ` · ${row.designationName}` : ""}
                    </Text>
                  </Pressable>
                ))}
              </GlassView>
            ) : null}
          </>
        )}

        <DatePickerField
          label="Start date *"
          value={startDate}
          onChange={onStartChange}
          minDate={today}
          placeholder="Select start date"
          marginBottom={16}
        />

        <DatePickerField
          label="End date *"
          value={endDate}
          onChange={setEndDate}
          minDate={startDate || today}
          placeholder="Select end date"
          marginBottom={16}
        />

        <Text style={{ fontSize: 12, fontWeight: "700", color: "#8E8E93", marginBottom: 8 }}>
          REASON
        </Text>
        <GlassView
          style={[
            { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, marginBottom: 20 },
            isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
          ]}
        >
          <TextInput
            placeholder="Reason for leave"
            value={reason}
            onChangeText={setReason}
            multiline
            style={{ fontSize: 16, color: "#000", minHeight: 100, textAlignVertical: "top" }}
            placeholderTextColor="#999"
          />
        </GlassView>

        <TouchableOpacity
          onPress={submit}
          disabled={submitting}
          style={{
            paddingVertical: 16,
            borderRadius: 14,
            backgroundColor: submitting ? "#ccc" : "#007AFF",
            alignItems: "center",
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Submit request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
