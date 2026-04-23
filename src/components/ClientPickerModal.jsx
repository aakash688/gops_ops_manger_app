import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { X, Search } from "lucide-react-native";
import { apiGetJson } from "@/utils/api";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function getClientLabel(c) {
  return safeStr(c?.clientName || c?.name || c?.title || c?.clientCode || c?.id);
}

export default function ClientPickerModal({
  visible,
  onClose,
  onSelect,
  title = "Select Client",
  subtitle = "Choose a client/site",
}) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data } = await apiGetJson("/apps/field-checkin/clients");
        if (!mounted) return;
        setClients(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setClients([]);
        setErr(e instanceof Error ? e.message : "Could not load clients");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) => {
      const name = getClientLabel(c).toLowerCase();
      const code = safeStr(c?.clientCode).toLowerCase();
      return name.includes(needle) || code.includes(needle);
    });
  }, [clients, q]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
        <View
          style={{
            paddingTop: 18,
            paddingHorizontal: 16,
            paddingBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#000" }}>
              {title}
            </Text>
            <Text style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
              {subtitle}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: 6 })}
          >
            <X size={22} color="#000" />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
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
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <Search size={18} color="#666" />
            <TextInput
              placeholder="Search by name or code"
              value={q}
              onChangeText={setQ}
              style={{ flex: 1, fontSize: 15, color: "#000" }}
              placeholderTextColor="#999"
              autoCorrect={false}
              autoCapitalize="none"
            />
          </GlassView>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 10, color: "#666" }}>Loading…</Text>
          </View>
        ) : err ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#FF3B30", fontWeight: "700" }}>{err}</Text>
            <Text style={{ color: "#666", marginTop: 6 }}>
              Please check API connectivity and try again.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          >
            {filtered.map((c) => (
              <Pressable
                key={safeStr(c?.id)}
                onPress={() => onSelect?.(c)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                  marginBottom: 10,
                })}
              >
                <GlassView
                  isInteractive={true}
                  style={[
                    {
                      padding: 14,
                      borderRadius: 14,
                      overflow: "hidden",
                    },
                    isLiquidGlassAvailable()
                      ? {}
                      : { opacity: 0.95, backgroundColor: "#ffffff" },
                  ]}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>
                    {getClientLabel(c)}
                  </Text>
                  {!!c?.clientCode && (
                    <Text style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                      Code: {safeStr(c.clientCode)}
                    </Text>
                  )}
                </GlassView>
              </Pressable>
            ))}

            {filtered.length === 0 && (
              <View style={{ paddingTop: 30, alignItems: "center" }}>
                <Text style={{ color: "#666" }}>No clients found</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

