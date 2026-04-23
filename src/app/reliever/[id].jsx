import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
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
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RelieverRequestDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const rid = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [req, setReq] = useState(null);

  const load = useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiGetJson(`/reliever-requests/${encodeURIComponent(rid)}`);
      setReq(data ?? null);
    } catch (e) {
      setReq(null);
      setError(e instanceof Error ? e.message : "Failed to load request");
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    load();
  }, [load]);

  const reject = async () => {
    if (!rid) return;
    setBusy(true);
    try {
      await apiPostJson(`/reliever-requests/${encodeURIComponent(rid)}/reject`, {
        rejectionReason: "Rejected from mobile",
      });
      await load();
    } catch (e) {
      Alert.alert("Reliever request", e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
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
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "800", color: "#000" }}>
          Reliever request
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: "#666" }}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 30 }}>
          <Text style={{ color: "#FF3B30", fontWeight: "800" }}>{error}</Text>
          <TouchableOpacity onPress={load} style={{ marginTop: 16 }}>
            <Text style={{ color: "#007AFF", fontWeight: "800" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          <GlassView
            style={[
              { padding: 16, borderRadius: 16, overflow: "hidden", marginBottom: 12 },
              isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#000" }}>
              {req?.client?.clientName || "Client"}
            </Text>
            <Text style={{ marginTop: 8, color: "#666" }}>
              {formatDate(req?.startDate)} → {formatDate(req?.endDate)}
            </Text>
            <Text style={{ marginTop: 6, color: "#666" }}>
              Relievers needed: {req?.relieversNeeded ?? "—"}
            </Text>
            {!!req?.reason && (
              <Text style={{ marginTop: 10, color: "#000", lineHeight: 20 }}>
                {req.reason}
              </Text>
            )}
            <Text style={{ marginTop: 10, color: "#999", fontSize: 12 }}>
              Status: {req?.status || "—"}
            </Text>
          </GlassView>

          {req?.status === "PENDING" && (
            <TouchableOpacity
              disabled={busy}
              onPress={reject}
              style={{ opacity: busy ? 0.6 : 1, marginTop: 8 }}
            >
              <GlassView
                isInteractive={true}
                style={[
                  { padding: 16, borderRadius: 14, alignItems: "center", overflow: "hidden" },
                  isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#FF3B30" },
                ]}
              >
                <Text style={{ fontWeight: "900", color: isLiquidGlassAvailable() ? "#000" : "#FFF" }}>
                  {busy ? "Working…" : "Reject request"}
                </Text>
              </GlassView>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

