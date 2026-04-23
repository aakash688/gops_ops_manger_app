import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Search, MapPin, Clock, ChevronRight, Tag, ChevronDown } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { apiGetJson } from "@/utils/api";
import { filterImageUrls, priorityAccent, statusAccent, formatActivityTime } from "@/utils/activityStyles";

const { width: SCREEN_W } = Dimensions.get("window");
const LIST_PAD = 16;
const CARD_INNER_W = SCREEN_W - LIST_PAD * 2;
const THUMB_H = 108;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "PENDING", label: "Pending" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All priorities" },
  { value: "Critical", label: "Critical" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

function SelectModal({ visible, title, options, value, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value || "__all__"}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={[styles.modalRow, item.value === value && styles.modalRowActive]}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
              >
                <Text style={[styles.modalRowText, item.value === value && styles.modalRowTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function Activities() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [statusModal, setStatusModal] = useState(false);
  const [priorityModal, setPriorityModal] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "50");
    p.set("offset", "0");
    if (debounced) p.set("q", debounced);
    if (status) p.set("status", status);
    if (priority) p.set("priority", priority);
    return p.toString();
  }, [debounced, status, priority]);

  const fetchList = useCallback(async () => {
    setError(null);
    try {
      const { data } = await apiGetJson(`/apps/activities?${queryString}`);
      const list = data?.items;
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [queryString]);

  useEffect(() => {
    setLoading(true);
    fetchList();
  }, [fetchList]);

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "All statuses";
  const priorityLabel = PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? "All priorities";

  const renderItem = useCallback(
    ({ item: row }) => {
      const priA = priorityAccent(row.priority);
      const stA = statusAccent(row.status);
      const imgs = filterImageUrls(row.images);
      const thumb = imgs[0];
      const loc = row.locationAddress || row.locationClientName || row.location || "—";

      return (
        <Pressable
          onPress={() => router.push(`/activities/${row.id}`)}
          style={({ pressed }) => ({
            opacity: pressed ? 0.94 : 1,
            marginBottom: 10,
          })}
        >
          <GlassView
            isInteractive={true}
            style={[
              {
                borderRadius: 12,
                overflow: "hidden",
                borderLeftWidth: 4,
                borderLeftColor: priA.border,
              },
              isLiquidGlassAvailable() ? {} : { backgroundColor: "#FFFFFF" },
            ]}
          >
            <View style={{ flexDirection: "row", minHeight: thumb ? THUMB_H : undefined }}>
              {thumb ? (
                <Image
                  source={{ uri: thumb }}
                  style={{ width: THUMB_H, height: THUMB_H, backgroundColor: "#E5E5EA" }}
                  resizeMode="cover"
                />
              ) : null}
              <View
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  paddingRight: 28,
                  justifyContent: "center",
                }}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
                  {row.activityType ? (
                    <View style={[styles.tag, { backgroundColor: "rgba(0,122,255,0.15)" }]}>
                      <Text style={[styles.tagText, { color: "#007AFF" }]} numberOfLines={1}>
                        {row.activityType}
                      </Text>
                    </View>
                  ) : null}
                  {row.status ? (
                    <View
                      style={[
                        styles.tag,
                        { backgroundColor: stA.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: stA.border },
                      ]}
                    >
                      <Text style={[styles.tagText, { color: stA.text }]} numberOfLines={1}>
                        {row.status}
                      </Text>
                    </View>
                  ) : null}
                  {row.priority ? (
                    <View style={[styles.tag, { backgroundColor: priA.soft, flexDirection: "row", alignItems: "center" }]}>
                      <Tag size={10} color={priA.text} />
                      <Text style={[styles.tagText, { color: priA.text, marginLeft: 4 }]} numberOfLines={1}>
                        {row.priority}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {row.title}
                </Text>
                <View style={styles.metaRow}>
                  <MapPin size={12} color="#8E8E93" />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {loc}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Clock size={12} color="#8E8E93" />
                  <Text style={styles.metaText}>
                    {row.scheduledDate || "—"}
                    {row.scheduledTime ? ` · ${formatActivityTime(row.scheduledTime)}` : ""}
                  </Text>
                </View>
                {row.activityCode ? (
                  <Text style={styles.codeText}>{row.activityCode}</Text>
                ) : null}
              </View>
              <View style={styles.chevronWrap}>
                <ChevronRight size={18} color="#C7C7CC" />
              </View>
            </View>
          </GlassView>
        </Pressable>
      );
    },
    [router],
  );

  const listHeader = (
    <>
      <View style={{ paddingTop: insets.top + 12, paddingBottom: 8, paddingHorizontal: LIST_PAD }}>
        <Text style={styles.screenTitle}>Activities</Text>
        <Text style={styles.screenSub}>Sites, schedule, and priority</Text>
      </View>

      <View style={{ paddingHorizontal: LIST_PAD, marginBottom: 10 }}>
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
            placeholder="Search title or code…"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor="#C7C7CC"
          />
        </GlassView>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.dropdown, styles.dropdownHalf]}
          onPress={() => setStatusModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.dropdownLabel} numberOfLines={1}>
            {statusLabel}
          </Text>
          <ChevronDown size={18} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dropdown, styles.dropdownHalf]}
          onPress={() => setPriorityModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.dropdownLabel} numberOfLines={1}>
            {priorityLabel}
          </Text>
          <ChevronDown size={18} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading && !refreshing ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : null}
    </>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <SelectModal
        visible={statusModal}
        title="Status"
        options={STATUS_OPTIONS}
        value={status}
        onSelect={setStatus}
        onClose={() => setStatusModal(false)}
      />
      <SelectModal
        visible={priorityModal}
        title="Priority"
        options={PRIORITY_OPTIONS}
        value={priority}
        onSelect={setPriority}
        onClose={() => setPriorityModal(false)}
      />

      <FlatList
        data={loading && !refreshing ? [] : items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{
          paddingHorizontal: LIST_PAD,
          paddingBottom: insets.bottom + 120,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchList(); }} tintColor="#007AFF" />
        }
        ListEmptyComponent={
          !loading || refreshing ? (
            <Text style={styles.emptyText}>No activities match your filters.</Text>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F2F2F7" },
  screenTitle: { fontSize: 28, fontWeight: "700", color: "#000" },
  screenSub: { fontSize: 13, color: "#8E8E93", marginTop: 2 },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: "#000",
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: LIST_PAD,
    marginBottom: 12,
    justifyContent: "space-between",
  },
  dropdownHalf: { width: "48%" },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60, 60, 67, 0.2)",
  },
  dropdownLabel: { fontSize: 14, fontWeight: "600", color: "#000", flex: 1, marginRight: 6 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
    maxWidth: CARD_INNER_W * 0.45,
  },
  tagText: { fontSize: 11, fontWeight: "800" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#000", marginTop: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  metaText: { fontSize: 13, color: "#8E8E93", marginLeft: 4, flex: 1 },
  codeText: { fontSize: 11, color: "#C7C7CC", marginTop: 6 },
  chevronWrap: { justifyContent: "center", paddingRight: 8 },
  errorText: { color: "#FF3B30", fontSize: 13, paddingHorizontal: LIST_PAD, marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#8E8E93", textAlign: "center", marginTop: 24 },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    maxHeight: "60%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    overflow: "hidden",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  modalRow: { paddingVertical: 14, paddingHorizontal: 16 },
  modalRowActive: { backgroundColor: "rgba(0,122,255,0.08)" },
  modalRowText: { fontSize: 16, color: "#000" },
  modalRowTextActive: { fontWeight: "700", color: "#007AFF" },
});
