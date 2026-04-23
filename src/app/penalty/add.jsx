import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  ScrollView,
  Modal,
  Keyboard,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ArrowLeft, Search, User, X, Filter } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { apiGetJson, apiPostJson } from "@/utils/api";

const filterStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8E8E93",
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  filterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60, 60, 67, 0.18)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
    marginBottom: 10,
  },
  filterRowLast: { marginBottom: 0 },
  filterInput: {
    flex: 1,
    fontSize: 16,
    color: "#1C1C1E",
    paddingVertical: Platform.OS === "ios" ? 11 : 9,
    marginLeft: 8,
  },
  clearFilters: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
    textAlign: "right",
    marginTop: 8,
  },
  latestTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.3,
    marginBottom: 12,
  },
});

const modalStyles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  field: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60, 60, 67, 0.18)",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  fieldMultiline: {
    minHeight: 100,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3A3A3C",
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

const PAGE_SIZE = 20;
const DEFAULT_CATEGORY = "PENALTY";
/** Bundled from `.env` at build — must match a URL the phone can reach (LAN IP or adb reverse). */
const CONFIGURED_API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
const FETCH_TIMEOUT_MS = 45000;

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function todayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function firstOfMonthYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function PenaltyRow({ item }) {
  return (
    <GlassView
      style={[
        {
          padding: 16,
          borderRadius: 12,
          marginBottom: 12,
          overflow: "hidden",
        },
        isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>
            {item.employeeName ?? "—"}{" "}
            <Text style={{ fontWeight: "400", color: "#666" }}>({item.employeeCode ?? "—"})</Text>
          </Text>
          <Text style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
            {item.category}
            {item.subCategory ? ` · ${item.subCategory}` : ""}
          </Text>
          <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 4 }} numberOfLines={3}>
            {item.transactionDate} · {item.reason || "—"}
          </Text>
        </View>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#FF3B30" }}>
          ₹{Number(item.amount).toFixed(2)}
        </Text>
      </View>
    </GlassView>
  );
}

export default function PenaltiesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const prefillEmployeeId = useMemo(() => {
    const raw = params?.employeeId;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params?.employeeId]);

  const [searchInput, setSearchInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedCategory, setDebouncedCategory] = useState("");

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState(null);
  const [listVersion, setListVersion] = useState(0);
  const loadingMoreRef = useRef(false);

  const [createOpen, setCreateOpen] = useState(false);
  const openedFromQueryRef = useRef(false);

  const [empQuery, setEmpQuery] = useState("");
  const [empLoading, setEmpLoading] = useState(false);
  const [empResults, setEmpResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCategory(categoryInput.trim()), 350);
    return () => clearTimeout(t);
  }, [categoryInput]);

  const buildListPath = useCallback(
    (pageNum) => {
      const paramsQs = new URLSearchParams({
        transactionType: "DEBIT",
        limit: String(PAGE_SIZE),
        page: String(pageNum),
      });
      if (debouncedSearch.length > 0) paramsQs.set("search", debouncedSearch);
      if (debouncedCategory.length > 0) paramsQs.set("category", debouncedCategory);
      return `/employee-adjustments?${paramsQs.toString()}`;
    },
    [debouncedSearch, debouncedCategory],
  );

  /** First page: filters, pull-to-refresh, after creating a penalty (listVersion). */
  useEffect(() => {
    let cancelled = false;
    setListError(null);
    setLoading(true);

    (async () => {
      try {
        const path = buildListPath(1);
        const { data, meta } = await withTimeout(
          apiGetJson(path),
          FETCH_TIMEOUT_MS,
          "Request timed out — phone could not reach the API in time. See tips below.",
        );
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        const total = meta?.pagination?.total ?? 0;
        setItems(rows);
        const offset = meta?.pagination?.offset ?? 0;
        const loadedThrough = offset + rows.length;
        setHasMore(loadedThrough < total && rows.length > 0);
        setPage(1);
      } catch (e) {
        if (cancelled) return;
        setListError(e instanceof Error ? e.message : "Could not load penalties.");
        setItems([]);
        setHasMore(false);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, debouncedCategory, buildListPath, listVersion]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setListVersion((v) => v + 1);
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const path = buildListPath(nextPage);
      const { data, meta } = await withTimeout(
        apiGetJson(path),
        FETCH_TIMEOUT_MS,
        "Request timed out.",
      );
      const rows = Array.isArray(data) ? data : [];
      const total = meta?.pagination?.total ?? 0;
      setItems((prev) => [...prev, ...rows]);
      const offset = meta?.pagination?.offset ?? (nextPage - 1) * PAGE_SIZE;
      const loadedThrough = offset + rows.length;
      setHasMore(loadedThrough < total && rows.length > 0);
      setPage(nextPage);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [loading, loadingMore, hasMore, page, buildListPath]);

  useEffect(() => {
    if (!prefillEmployeeId || openedFromQueryRef.current) return;
    openedFromQueryRef.current = true;
    setCreateOpen(true);
  }, [prefillEmployeeId]);

  useEffect(() => {
    if (!createOpen || !prefillEmployeeId) return;
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams({
          id: prefillEmployeeId,
          brief: "true",
          limit: "1",
          offset: "0",
        });
        const { data } = await apiGetJson(`/employees?${q.toString()}`);
        const row = Array.isArray(data) && data[0] ? data[0] : null;
        if (!cancelled && row?.employeeId) {
          setSelected({
            employeeId: row.employeeId,
            employeeName: row.employeeName ?? "—",
            employeeCode: row.employeeCode ?? "—",
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createOpen, prefillEmployeeId]);

  useEffect(() => {
    const q = empQuery.trim();
    if (q.length < 2) {
      setEmpResults([]);
      setEmpLoading(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setEmpLoading(true);
      try {
        const sp = new URLSearchParams({
          name: q,
          brief: "true",
          limit: "15",
          offset: "0",
        });
        const { data } = await apiGetJson(`/employees?${sp.toString()}`);
        const rows = Array.isArray(data) ? data : [];
        if (!cancelled) setEmpResults(rows);
      } catch {
        if (!cancelled) setEmpResults([]);
      } finally {
        if (!cancelled) setEmpLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [empQuery]);

  const openCreate = () => {
    setEmpQuery("");
    setEmpResults([]);
    if (!prefillEmployeeId) setSelected(null);
    setReason("");
    setAmount("");
    setCreateOpen(true);
  };

  const closeCreate = () => {
    Keyboard.dismiss();
    setCreateOpen(false);
  };

  const handleSubmit = async () => {
    if (!selected?.employeeId) {
      Alert.alert("Employee required", "Search and select an employee.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Reason required", "Enter a reason.");
      return;
    }
    const amt = parseFloat(String(amount).replace(",", "."));
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert("Amount", "Enter a valid positive amount.");
      return;
    }

    setSubmitting(true);
    try {
      await apiPostJson("/employee-adjustments", {
        employeeId: selected.employeeId,
        transactionType: "DEBIT",
        category: DEFAULT_CATEGORY,
        subCategory: null,
        amount: amt,
        reason: reason.trim(),
        remarks: null,
        transactionDate: todayYmdLocal(),
        effectiveMonth: firstOfMonthYmdLocal(),
      });
      Alert.alert("Success", "Penalty recorded.", [
        {
          text: "OK",
          onPress: () => {
            closeCreate();
            setSearchInput("");
            setCategoryInput("");
            setDebouncedSearch("");
            setDebouncedCategory("");
            setListVersion((v) => v + 1);
          },
        },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasFilterText = searchInput.length > 0 || categoryInput.length > 0;

  const listHeader = (
    <View style={{ paddingBottom: 4 }}>
      <Text style={filterStyles.sectionLabel}>Search & filter</Text>
      <View style={filterStyles.filterCard}>
        <View style={filterStyles.filterRow}>
          <Search size={20} color="#8E8E93" />
          <TextInput
            placeholder="Name, code, reason, notes…"
            value={searchInput}
            onChangeText={setSearchInput}
            style={filterStyles.filterInput}
            placeholderTextColor="#AEAEB2"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <View style={[filterStyles.filterRow, filterStyles.filterRowLast]}>
          <Filter size={20} color="#8E8E93" />
          <TextInput
            placeholder="Category contains…"
            value={categoryInput}
            onChangeText={setCategoryInput}
            style={filterStyles.filterInput}
            placeholderTextColor="#AEAEB2"
            autoCapitalize="none"
          />
        </View>
        {hasFilterText ? (
          <TouchableOpacity
            onPress={() => {
              setSearchInput("");
              setCategoryInput("");
            }}
            hitSlop={8}
          >
            <Text style={filterStyles.clearFilters}>Clear filters</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={filterStyles.latestTitle}>Latest</Text>
      <Text style={{ fontSize: 13, color: "#8E8E93", marginBottom: 4, marginTop: -6 }}>
        Salary debits · pull down to refresh · scroll for more
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
      <StatusBar style="dark" />

      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000", flex: 1 }}>Penalties</Text>
        <TouchableOpacity onPress={openCreate} hitSlop={10}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#007AFF" }}>New</Text>
        </TouchableOpacity>
      </View>

      {loading && items.length === 0 && !listError ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ marginTop: 12, color: "#666", textAlign: "center" }}>Loading penalties…</Text>
        </View>
      ) : !loading && listError && items.length === 0 ? (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 16, color: "#C62828", marginBottom: 12, textAlign: "center" }}>{listError}</Text>
          <Text style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
            <Text style={{ fontWeight: "600", color: "#000" }}>API base in this build:{"\n"}</Text>
            {CONFIGURED_API_URL || "(EXPO_PUBLIC_API_URL is empty — set it in .env and restart Expo with --clear)"}
          </Text>
          <Text style={{ fontSize: 13, color: "#666", lineHeight: 20, marginBottom: 20 }}>
            • PC and phone on the same Wi‑Fi (not guest isolation).{"\n"}
            • On PC run `ipconfig` — if IPv4 changed, update EXPO_PUBLIC_API_URL (e.g. http://YOUR_IP:3000/api/v1).{"\n"}
            • Windows: allow inbound TCP 3000 for Node (or turn off firewall briefly to test).{"\n"}
            • USB debugging: run `adb reverse tcp:3000 tcp:3000`, then set EXPO_PUBLIC_API_URL to
            http://127.0.0.1:3000/api/v1 and reload the app.{"\n"}
            • Confirm the backend is running and shows “listening on 0.0.0.0:3000”.
          </Text>
          <TouchableOpacity
            onPress={() => {
              setListError(null);
              setListVersion((v) => v + 1);
            }}
            style={{ alignSelf: "center", paddingVertical: 12, paddingHorizontal: 24 }}
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#007AFF" }}>Retry</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <PenaltyRow item={item} />}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 24,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
          ListEmptyComponent={
            !loading ? (
              <Text style={{ color: "#8E8E93", textAlign: "center", paddingVertical: 24 }}>
                No penalties match your filters.
              </Text>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color="#007AFF" />
            ) : hasMore && items.length > 0 ? (
              <Text style={{ textAlign: "center", color: "#C7C7CC", fontSize: 12, marginBottom: 8 }}>
                Scroll for more
              </Text>
            ) : null
          }
        />
      )}

      <Modal
        visible={createOpen}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
        onRequestClose={closeCreate}
      >
        <View style={modalStyles.sheet}>
          <StatusBar style="dark" />
          <View
            style={{
              paddingTop: insets.top + 8,
              paddingHorizontal: 16,
              paddingBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: "#C6C6C8",
              backgroundColor: "#F2F2F7",
            }}
          >
            <TouchableOpacity onPress={closeCreate} style={{ paddingVertical: 4, paddingRight: 12 }}>
              <Text style={{ fontSize: 17, color: "#007AFF" }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#000", flex: 1, textAlign: "center" }}>
              New penalty
            </Text>
            <View style={{ width: 72 }} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
          >
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: insets.bottom + 28,
              }}
            >
              <Text style={modalStyles.hint}>
                Recorded as category <Text style={{ fontWeight: "600", color: "#1C1C1E" }}>Penalty</Text> ({DEFAULT_CATEGORY}
                ). Choose the employee, then reason and amount.
              </Text>

              <Text style={modalStyles.label}>Employee</Text>
              <View style={[modalStyles.field, { flexDirection: "row", alignItems: "center", marginBottom: 12 }]}>
                <Search size={20} color="#8E8E93" />
                <TextInput
                  placeholder="Search name or code (2+ letters)"
                  value={empQuery}
                  onChangeText={setEmpQuery}
                  style={[filterStyles.filterInput, { marginLeft: 6, paddingVertical: 8 }]}
                  placeholderTextColor="#AEAEB2"
                  autoCapitalize="none"
                  editable={!selected}
                />
                {empLoading ? <ActivityIndicator size="small" color="#007AFF" /> : null}
              </View>

              {selected ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#E8F4FF",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 16,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: "rgba(0, 122, 255, 0.25)",
                  }}
                >
                  <User size={22} color="#007AFF" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>{selected.employeeName}</Text>
                    <Text style={{ fontSize: 14, color: "#666" }}>{selected.employeeCode}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelected(null)} hitSlop={12}>
                    <X size={22} color="#8E8E93" />
                  </TouchableOpacity>
                </View>
              ) : null}

              {!selected && empQuery.trim().length >= 2 && empResults.length > 0 ? (
                <View style={{ marginBottom: 16, maxHeight: 220 }}>
                  {empResults.map((row) => (
                    <TouchableOpacity
                      key={row.employeeId}
                      onPress={() => {
                        setSelected({
                          employeeId: row.employeeId,
                          employeeName: row.employeeName ?? "—",
                          employeeCode: row.employeeCode ?? "—",
                        });
                        setEmpQuery("");
                        setEmpResults([]);
                      }}
                      activeOpacity={0.7}
                      style={{ marginBottom: 8 }}
                    >
                      <View style={[modalStyles.field, { paddingVertical: 12 }]}>
                        <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>{row.employeeName}</Text>
                        <Text style={{ fontSize: 14, color: "#666" }}>{row.employeeCode}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <Text style={modalStyles.label}>Reason</Text>
              <TextInput
                placeholder="What happened?"
                value={reason}
                onChangeText={setReason}
                style={[modalStyles.field, modalStyles.fieldMultiline, { marginBottom: 16 }]}
                placeholderTextColor="#AEAEB2"
                multiline
                textAlignVertical="top"
              />

              <Text style={{ fontSize: 12, color: "#8E8E93", marginBottom: 16 }}>
                Transaction {todayYmdLocal()} · Salary month {firstOfMonthYmdLocal()}
              </Text>

              <Text style={modalStyles.label}>Amount (₹)</Text>
              <TextInput
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                style={[modalStyles.field, { marginBottom: 28 }]}
                placeholderTextColor="#AEAEB2"
              />

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                style={[modalStyles.primaryBtn, { opacity: submitting ? 0.55 : 1 }]}
              >
                <Text style={modalStyles.primaryBtnText}>{submitting ? "Saving…" : "Save penalty"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
