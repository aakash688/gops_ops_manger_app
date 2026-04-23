import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ArrowLeft } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { apiGetJson, apiPostJson } from "@/utils/api";

function formatDate(d) {
  if (!d) return "—";
  const s = typeof d === "string" ? d.slice(0, 10) : d;
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDt(iso) {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LeaveRequestDetail() {
  const { id } = useLocalSearchParams();
  const rid = typeof id === "string" ? id : id?.[0];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRemark, setRejectRemark] = useState("");

  const load = useCallback(async () => {
    if (!rid) return;
    setErr(null);
    setLoading(true);
    try {
      const { data } = await apiGetJson(`/leave-requests/${rid}`);
      setRow(data && typeof data === "object" ? data : null);
    } catch (e) {
      setRow(null);
      setErr(e instanceof Error ? e.message : "Not found");
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    load();
  }, [load]);

  const doApprove = async () => {
    if (!rid) return;
    setBusy(true);
    try {
      await apiPostJson(`/leave-requests/${rid}/approve`, {});
      Alert.alert("Done", "Leave approved", [
        { text: "OK", onPress: () => router.replace("/leave-approval") },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    if (!rid) return;
    setBusy(true);
    try {
      const body = {};
      if (rejectRemark.trim()) body.remark = rejectRemark.trim();
      await apiPostJson(`/leave-requests/${rid}/reject`, body);
      setRejectOpen(false);
      setRejectRemark("");
      Alert.alert("Done", "Leave rejected", [
        { text: "OK", onPress: () => router.replace("/leave-approval") },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const pending = row?.status === "PENDING";

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
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>Leave detail</Text>
          <Text style={{ fontSize: 13, color: "#666", marginTop: 2 }} numberOfLines={1}>
            {row?.employeeName || "—"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : err ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: "#FF3B30", fontWeight: "600" }}>{err}</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}
          keyboardShouldPersistTaps="handled"
        >
          <GlassView
            style={[
              { padding: 16, borderRadius: 16, marginBottom: 14 },
              isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#8E8E93", marginBottom: 6 }}>STATUS</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#000" }}>{row?.status}</Text>
          </GlassView>

          <GlassView
            style={[
              { padding: 16, borderRadius: 16, marginBottom: 14 },
              isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#8E8E93", marginBottom: 8 }}>DATES</Text>
            <Text style={{ fontSize: 16, color: "#000", fontWeight: "600" }}>
              {formatDate(row?.startDate)} → {formatDate(row?.endDate)}
            </Text>
          </GlassView>

          <GlassView
            style={[
              { padding: 16, borderRadius: 16, marginBottom: 14 },
              isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#8E8E93", marginBottom: 8 }}>REASON</Text>
            <Text style={{ fontSize: 15, color: "#333", lineHeight: 22 }}>{row?.reason || "—"}</Text>
          </GlassView>

          {row?.reviewedAt ? (
            <GlassView
              style={[
                { padding: 16, borderRadius: 16, marginBottom: 14 },
                isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#8E8E93", marginBottom: 8 }}>REVIEW</Text>
              <Text style={{ fontSize: 14, color: "#000" }}>
                By {row?.reviewerName || "—"} · {formatDt(row?.reviewedAt)}
              </Text>
              {row?.reviewRemark ? (
                <Text style={{ fontSize: 14, color: "#666", marginTop: 8 }}>{row.reviewRemark}</Text>
              ) : null}
            </GlassView>
          ) : null}
        </ScrollView>
      )}

      {pending && !loading && !err ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: insets.bottom + 12,
            flexDirection: "row",
            gap: 12,
          }}
        >
          <TouchableOpacity
            onPress={doApprove}
            disabled={busy}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: busy ? "#ccc" : "#34C759",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setRejectOpen(true)}
            disabled={busy}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: busy ? "#ccc" : "#FF3B30",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Reject</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={() => setRejectOpen(false)}>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            padding: 24,
          }}
          onPress={() => setRejectOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", marginBottom: 8 }}>Reject leave</Text>
            <Text style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
              Optional remark for the employee
            </Text>
            <TextInput
              placeholder="Remark"
              value={rejectRemark}
              onChangeText={setRejectRemark}
              multiline
              style={{
                borderWidth: 1,
                borderColor: "#E5E5EA",
                borderRadius: 10,
                padding: 12,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setRejectOpen(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderRadius: 12,
                  backgroundColor: "#E5E5EA",
                }}
              >
                <Text style={{ fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doReject}
                disabled={busy}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderRadius: 12,
                  backgroundColor: "#FF3B30",
                }}
              >
                <Text style={{ fontWeight: "800", color: "#fff" }}>Reject</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
