import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ArrowLeft } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGetJson, apiPatchJson, apiPostJson } from "@/utils/api";

function formatAgo(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "ON_HOLD", "CANCELLED"];

export default function TicketDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const ticketId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [view, setView] = useState(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setErr(null);
    try {
      const { data } = await apiGetJson(`/tickets/${encodeURIComponent(ticketId)}/view`);
      setView(data ?? null);
    } catch (e) {
      setView(null);
      setErr(e instanceof Error ? e.message : "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const details = view?.ticketDetails ?? null;
  const conversation = useMemo(() => {
    const c = view?.ticketConversation;
    const items = Array.isArray(c?.items) ? c.items : Array.isArray(c) ? c : [];
    return items;
  }, [view]);

  const setStatus = async (next) => {
    if (!ticketId) return;
    setBusy(true);
    try {
      await apiPatchJson(`/tickets/${encodeURIComponent(ticketId)}/status`, { status: next });
      await reload();
    } catch (e) {
      Alert.alert("Ticket", e instanceof Error ? e.message : "Failed to change status");
    } finally {
      setBusy(false);
    }
  };

  const addComment = async () => {
    if (!ticketId) return;
    const text = comment.trim();
    if (!text) return;
    setBusy(true);
    try {
      await apiPostJson(`/tickets/${encodeURIComponent(ticketId)}/conversation`, { comment: text });
      setComment("");
      await reload();
    } catch (e) {
      Alert.alert("Ticket", e instanceof Error ? e.message : "Failed to add comment");
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
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000" }}>
          Ticket
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: "#666" }}>Loading…</Text>
        </View>
      ) : err ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 30 }}>
          <Text style={{ color: "#FF3B30", fontWeight: "800", fontSize: 16 }}>
            {err}
          </Text>
          <TouchableOpacity onPress={reload} style={{ marginTop: 16 }}>
            <Text style={{ color: "#007AFF", fontWeight: "700" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <GlassView
            style={[
              { padding: 16, borderRadius: 16, overflow: "hidden", marginBottom: 14 },
              isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#000" }}>
              {details?.title ?? "—"}
            </Text>
            {!!details?.ticketId && (
              <Text style={{ marginTop: 6, color: "#666" }}>{details.ticketId}</Text>
            )}
            <Text style={{ marginTop: 6, color: "#666" }}>
              {details?.siteName ?? "—"} • {formatAgo(details?.createdAt)}
            </Text>
            {!!details?.description && (
              <Text style={{ marginTop: 12, color: "#000", lineHeight: 20 }}>
                {details.description}
              </Text>
            )}
          </GlassView>

          <Text style={{ fontSize: 16, fontWeight: "800", color: "#000", marginBottom: 10 }}>
            Status
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {STATUSES.map((s) => {
              const active = details?.status === s;
              return (
                <TouchableOpacity
                  key={s}
                  disabled={busy}
                  onPress={() => setStatus(s)}
                  style={{ opacity: busy ? 0.6 : 1 }}
                >
                  <GlassView
                    isInteractive={true}
                    style={[
                      {
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        overflow: "hidden",
                        backgroundColor: isLiquidGlassAvailable()
                          ? active
                            ? "rgba(0,122,255,0.18)"
                            : undefined
                          : active
                            ? "#007AFF"
                            : "#ffffff",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: isLiquidGlassAvailable()
                          ? active
                            ? "#007AFF"
                            : "#000"
                          : active
                            ? "#FFF"
                            : "#000",
                      }}
                    >
                      {s}
                    </Text>
                  </GlassView>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 16, fontWeight: "800", color: "#000", marginBottom: 10 }}>
            Conversation
          </Text>
          {conversation.length === 0 ? (
            <Text style={{ color: "#666", marginBottom: 10 }}>No messages yet</Text>
          ) : (
            conversation.map((c) => (
              <GlassView
                key={c.id}
                style={[
                  { padding: 14, borderRadius: 14, overflow: "hidden", marginBottom: 10 },
                  isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
                ]}
              >
                <Text style={{ color: "#000", fontWeight: "700" }}>
                  {c.authorName || c.authorId || "User"}
                </Text>
                <Text style={{ color: "#000", marginTop: 6, lineHeight: 20 }}>
                  {c.commentText || c.comment || "—"}
                </Text>
                <Text style={{ color: "#999", marginTop: 8, fontSize: 12 }}>
                  {formatAgo(c.createdAt)}
                </Text>
              </GlassView>
            ))
          )}

          <Text style={{ fontSize: 16, fontWeight: "800", color: "#000", marginTop: 6 }}>
            Add message
          </Text>
          <GlassView
            style={[
              { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, overflow: "hidden", marginTop: 10 },
              isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <TextInput
              placeholder="Write an update…"
              value={comment}
              onChangeText={setComment}
              placeholderTextColor="#999"
              multiline
              style={{ minHeight: 90, fontSize: 15, color: "#000" }}
              textAlignVertical="top"
            />
          </GlassView>

          <TouchableOpacity
            onPress={addComment}
            disabled={busy || !comment.trim()}
            style={{ marginTop: 12, opacity: busy || !comment.trim() ? 0.6 : 1 }}
          >
            <GlassView
              isInteractive={true}
              style={[
                { padding: 16, borderRadius: 14, alignItems: "center", overflow: "hidden" },
                isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#007AFF" },
              ]}
            >
              <Text style={{ fontSize: 16, fontWeight: "800", color: isLiquidGlassAvailable() ? "#000" : "#FFF" }}>
                {busy ? "Sending…" : "Send"}
              </Text>
            </GlassView>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

