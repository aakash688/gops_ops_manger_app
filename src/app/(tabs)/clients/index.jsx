import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Search, MapPin, ChevronRight, Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { apiGetJson } from "@/utils/api";

function formatDate(d) {
  if (!d) return "—";
  return String(d).slice(0, 10);
}

export default function Clients() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchClients = useCallback(async () => {
    setError(null);
    try {
      const q = encodeURIComponent(debounced);
      const { data } = await apiGetJson(
        `/apps/operations-manager/clients?limit=100&offset=0&q=${q}`,
      );
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clients");
      setClients([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debounced]);

  useEffect(() => {
    setLoading(true);
    fetchClients();
  }, [fetchClients]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClients();
  };

  const ClientRow = ({ client }) => (
    <Pressable
      onPress={() => router.push(`/clients/${client.id}`)}
      style={({ pressed }) => ({
        opacity: pressed ? 0.92 : 1,
        marginBottom: 8,
      })}
    >
      <GlassView
        isInteractive={true}
        style={[
          {
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 12,
            overflow: "hidden",
          },
          isLiquidGlassAvailable()
            ? {}
            : { backgroundColor: "#FFFFFF" },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#000",
              }}
              numberOfLines={1}
            >
              {client.clientName}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              <MapPin size={12} color="#8E8E93" />
              <Text
                style={{
                  fontSize: 13,
                  color: "#8E8E93",
                  marginLeft: 4,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {client.site_label || "—"}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 12,
                color: "#AEAEB2",
                marginTop: 5,
              }}
              numberOfLines={1}
            >
              {formatDate(client.onboardingDate)} – {formatDate(client.contractExpiryDate)}
              {client.contractExpiryStatus ? ` · ${client.contractExpiryStatus}` : ""}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 10 }}>
            <View style={{ alignItems: "flex-end", marginRight: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Users size={14} color="#34C759" />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#000",
                    marginLeft: 4,
                  }}
                >
                  {client.guards_logged_in_now ?? 0}
                </Text>
              </View>
              <Text style={{ fontSize: 10, color: "#8E8E93", marginTop: 2 }}>on-site</Text>
            </View>
            <ChevronRight size={18} color="#C7C7CC" />
          </View>
        </View>
      </GlassView>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
      <StatusBar style="dark" />

      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 10,
          backgroundColor: "#F2F2F7",
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: "700", color: "#000" }}>Clients</Text>
        <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 2 }}>
          Search and open a site
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <GlassView
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              overflow: "hidden",
            },
            isLiquidGlassAvailable() ? {} : { backgroundColor: "#FFFFFF" },
          ]}
        >
          <Search size={18} color="#8E8E93" />
          <TextInput
            placeholder="Search…"
            value={search}
            onChangeText={setSearch}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 16,
              color: "#000",
              paddingVertical: 0,
            }}
            placeholderTextColor="#C7C7CC"
          />
        </GlassView>
      </View>

      {error ? (
        <Text style={{ paddingHorizontal: 16, color: "#FF3B30", marginBottom: 8, fontSize: 13 }}>
          {error}
        </Text>
      ) : null}

      {loading && !refreshing ? (
        <View style={{ paddingVertical: 32, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
        }
      >
        {!loading || refreshing
          ? clients.map((client) => <ClientRow key={client.id} client={client} />)
          : null}
        {!loading && clients.length === 0 ? (
          <Text style={{ fontSize: 14, color: "#8E8E93", textAlign: "center", marginTop: 32 }}>
            No clients match your search.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
