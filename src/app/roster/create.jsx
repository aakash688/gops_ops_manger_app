import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  Check,
  ChevronRight,
  Clock,
  Users,
  X,
  ClipboardList,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import { DatePickerModal, formatDisplayDate } from "@/components/DatePicker";
import { apiGetJson, apiPostJson } from "@/utils/api";

function PickerRow({ icon: Icon, label, value, placeholder, onPress, disabled }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} disabled={disabled}>
      <GlassView
        style={[
          {
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 12,
            overflow: "hidden",
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          },
          isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
        ]}
      >
        {Icon ? <Icon size={20} color="#007AFF" /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#8E8E93", marginBottom: 4 }}>
            {label}
          </Text>
          <Text
            style={{ fontSize: 16, color: value ? "#000" : "#C7C7CC" }}
            numberOfLines={2}
          >
            {value || placeholder}
          </Text>
        </View>
        <ChevronRight size={20} color="#C7C7CC" />
      </GlassView>
    </TouchableOpacity>
  );
}

export default function RosterCreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loadingCtx, setLoadingCtx] = useState(true);
  const [ctxError, setCtxError] = useState(null);
  const [teams, setTeams] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [team, setTeam] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [clientLabel, setClientLabel] = useState("");
  const [shift, setShift] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [memberIds, setMemberIds] = useState(new Set());

  const [hints, setHints] = useState(null);
  const [hintsLoading, setHintsLoading] = useState(false);

  const [teamModal, setTeamModal] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [shiftModal, setShiftModal] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const loadContext = useCallback(async () => {
    setCtxError(null);
    setLoadingCtx(true);
    try {
      const { data } = await apiGetJson("/apps/operations-manager/rosters/form-context");
      setTeams(Array.isArray(data?.teams) ? data.teams : []);
      setShifts(Array.isArray(data?.shifts) ? data.shifts : []);
    } catch (e) {
      setTeams([]);
      setShifts([]);
      setCtxError(e instanceof Error ? e.message : "Could not load form data");
    } finally {
      setLoadingCtx(false);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const clientOptions = useMemo(() => {
    if (!team?.locations) return [];
    return team.locations.filter((l) => l.kind === "client" && l.clientId);
  }, [team]);

  const memberRows = useMemo(() => {
    const details = team?.members?.memberDetails;
    return Array.isArray(details) ? details : [];
  }, [team]);

  useEffect(() => {
    let cancelled = false;
    if (!clientId) {
      setHints(null);
      return;
    }
    (async () => {
      setHintsLoading(true);
      try {
        const { data } = await apiGetJson(
          `/apps/operations-manager/rosters/client-site-hints/${clientId}`,
        );
        if (!cancelled) setHints(data ?? null);
      } catch {
        if (!cancelled) setHints(null);
      } finally {
        if (!cancelled) setHintsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => {
      const name = String(t?.teamInfo?.teamName ?? "").toLowerCase();
      const code = String(t?.teamInfo?.teamCode ?? "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [teams, teamSearch]);

  const toggleMember = (id) => {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSubmit = async () => {
    if (!team?.teamId || !clientId || !shift?.id || !startDate || !endDate) {
      Alert.alert("Missing fields", "Select team, site, shift, and date range.");
      return;
    }
    if (memberIds.size < 1) {
      Alert.alert("Guards", "Select at least one team member for this roster.");
      return;
    }
    setSubmitting(true);
    try {
      await apiPostJson("/apps/operations-manager/rosters", {
        teamId: team.teamId,
        clientId,
        shiftId: shift.id,
        assignment: { startDate, endDate },
        members: [...memberIds],
        status: "active",
      });
      Alert.alert("Roster created", "The assignment has been saved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCtx) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F5F5F7", justifyContent: "center" }}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ textAlign: "center", marginTop: 12, color: "#666" }}>Loading teams & shifts…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1, backgroundColor: "#F5F5F7" }} behavior="padding">
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000", flex: 1 }}>New roster</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {ctxError ? (
          <Text style={{ color: "#C62828", marginBottom: 12 }}>{ctxError}</Text>
        ) : null}

        <Text style={{ fontSize: 13, color: "#8E8E93", marginBottom: 16, lineHeight: 18 }}>
          Choose a team, then a site that team covers. Pick shift, dates, and which guards are on this
          assignment.
        </Text>

        <View style={{ gap: 12, marginBottom: 20 }}>
          <PickerRow
            icon={Users}
            label="Team"
            value={
              team
                ? `${team.teamInfo?.teamName ?? ""} (${team.teamInfo?.teamCode ?? ""})`
                : ""
            }
            placeholder="Select team"
            onPress={() => setTeamModal(true)}
          />
          <PickerRow
            icon={Building2}
            label="Site / client"
            value={clientLabel}
            placeholder={team ? "Select client location" : "Select a team first"}
            onPress={() => team && clientOptions.length > 0 && setClientModal(true)}
            disabled={!team || clientOptions.length === 0}
          />
          <PickerRow
            icon={Clock}
            label="Shift"
            value={shift ? `${shift.name} (${shift.startTime}–${shift.endTime})` : ""}
            placeholder="Select shift"
            onPress={() => shifts.length > 0 && setShiftModal(true)}
            disabled={shifts.length === 0}
          />
          <PickerRow
            icon={CalendarIcon}
            label="Start date"
            value={startDate ? formatDisplayDate(startDate) : ""}
            placeholder="Tap to choose"
            onPress={() => setStartOpen(true)}
          />
          <PickerRow
            icon={CalendarIcon}
            label="End date"
            value={endDate ? formatDisplayDate(endDate) : ""}
            placeholder="Tap to choose"
            onPress={() => setEndOpen(true)}
            disabled={!startDate}
          />
        </View>

        {clientId ? (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <ClipboardList size={18} color="#007AFF" />
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Site requirements</Text>
            </View>
            {hintsLoading ? (
              <ActivityIndicator color="#007AFF" style={{ marginVertical: 8 }} />
            ) : hints ? (
              <GlassView
                style={[
                  {
                    padding: 16,
                    borderRadius: 14,
                    overflow: "hidden",
                  },
                  isLiquidGlassAvailable() ? {} : { opacity: 0.96, backgroundColor: "#fff" },
                ]}
              >
                {hints.summary?.totalDeploymentSlots > 0 ? (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 10,
                      paddingBottom: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: "#E5E5EA",
                    }}
                  >
                    <Text style={{ color: "#3C3C43", fontSize: 14 }}>Deployment slots (contract)</Text>
                    <Text style={{ fontWeight: "700", color: "#000" }}>
                      {hints.summary.totalDeploymentSlots}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: "#3C3C43", fontSize: 14 }}>On site now</Text>
                  <Text style={{ fontWeight: "700", color: "#007AFF" }}>
                    {hints.summary?.guardsOnSiteNow ?? 0}
                  </Text>
                </View>
                {hints.summary?.deploymentGapVsOnSite != null &&
                hints.summary.totalDeploymentSlots > 0 ? (
                  <Text style={{ fontSize: 12, color: "#8E8E93", marginBottom: 10 }}>
                    Gap vs required: {hints.summary.deploymentGapVsOnSite} (rough check vs attendance)
                  </Text>
                ) : null}
                {Array.isArray(hints.serviceRequirements) && hints.serviceRequirements.length > 0 ? (
                  <>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#000", marginTop: 4 }}>
                      Services
                    </Text>
                    {hints.serviceRequirements.map((r) => (
                      <Text key={r.id} style={{ fontSize: 13, color: "#3C3C43", marginTop: 6 }}>
                        • {r.service?.name || r.serviceType || "Service"} — deploy{" "}
                        {r.numberOfDeployment ?? "—"}
                      </Text>
                    ))}
                  </>
                ) : null}
                {hints.specialRequirements ? (
                  <Text style={{ fontSize: 13, color: "#3C3C43", marginTop: 12, lineHeight: 18 }}>
                    <Text style={{ fontWeight: "600" }}>Special: </Text>
                    {hints.specialRequirements}
                  </Text>
                ) : null}
              </GlassView>
            ) : null}
          </View>
        ) : null}

        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Users size={18} color="#007AFF" />
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Guards on this roster</Text>
          </View>
          {!team ? (
            <Text style={{ color: "#8E8E93", fontSize: 14 }}>Select a team to list members.</Text>
          ) : memberRows.length === 0 ? (
            <Text style={{ color: "#8E8E93", fontSize: 14 }}>No members on this team.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {memberRows.map((m) => {
                const id = m.employeeId;
                const on = memberIds.has(id);
                return (
                  <TouchableOpacity key={id} activeOpacity={0.85} onPress={() => toggleMember(id)}>
                    <GlassView
                      style={[
                        {
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          overflow: "hidden",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          borderWidth: on ? 2 : 0,
                          borderColor: on ? "#007AFF" : "transparent",
                        },
                        isLiquidGlassAvailable() ? {} : { opacity: 0.96, backgroundColor: "#fff" },
                      ]}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          borderWidth: 2,
                          borderColor: on ? "#007AFF" : "#C7C7CC",
                          backgroundColor: on ? "#007AFF" : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {on ? <Check size={14} color="#fff" /> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }} numberOfLines={1}>
                          {m.employeeName || "—"}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 2 }} numberOfLines={1}>
                          {[m.designationName, m.employeeCode].filter(Boolean).join(" · ")}
                        </Text>
                      </View>
                    </GlassView>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={onSubmit}
          disabled={submitting}
          style={{ opacity: submitting ? 0.65 : 1 }}
        >
          <GlassView
            isInteractive
            style={[
              {
                padding: 16,
                borderRadius: 14,
                alignItems: "center",
                overflow: "hidden",
              },
              isLiquidGlassAvailable() ? {} : { backgroundColor: "#007AFF", opacity: 0.98 },
            ]}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: "700",
                color: isLiquidGlassAvailable() ? "#000" : "#fff",
              }}
            >
              {submitting ? "Saving…" : "Create roster"}
            </Text>
          </GlassView>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={teamModal} animationType="slide" onRequestClose={() => setTeamModal(false)}>
        <View style={{ flex: 1, backgroundColor: "#F5F5F7", paddingTop: insets.top + 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              marginBottom: 12,
            }}
          >
            <TouchableOpacity onPress={() => setTeamModal(false)} style={{ padding: 8 }}>
              <X size={24} color="#000" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: "700", flex: 1 }}>Select team</Text>
          </View>
          <TextInput
            placeholder="Search team…"
            value={teamSearch}
            onChangeText={setTeamSearch}
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              padding: 14,
              borderRadius: 12,
              backgroundColor: "#fff",
              fontSize: 16,
            }}
            placeholderTextColor="#999"
          />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
            {filteredTeams.map((t) => (
              <TouchableOpacity
                key={t.teamId}
                onPress={() => {
                  setTeam(t);
                  setClientId(null);
                  setClientLabel("");
                  setMemberIds(new Set());
                  setTeamModal(false);
                  setTeamSearch("");
                }}
                style={{
                  padding: 16,
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>
                  {t.teamInfo?.teamName}
                </Text>
                <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 4 }}>
                  {t.teamInfo?.teamCode} · {t.members?.totalMembers ?? 0} members ·{" "}
                  {(t.locations ?? []).filter((l) => l.kind === "client").length} sites
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={clientModal} animationType="slide" onRequestClose={() => setClientModal(false)}>
        <View style={{ flex: 1, backgroundColor: "#F5F5F7", paddingTop: insets.top + 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              marginBottom: 12,
            }}
          >
            <TouchableOpacity onPress={() => setClientModal(false)} style={{ padding: 8 }}>
              <X size={24} color="#000" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: "700", flex: 1 }}>Select site</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
            {clientOptions.map((c) => (
              <TouchableOpacity
                key={c.clientId}
                onPress={() => {
                  setClientId(c.clientId);
                  setClientLabel(
                    `${c.clientName || "Client"}${c.clientCode ? ` (${c.clientCode})` : ""}`,
                  );
                  setClientModal(false);
                }}
                style={{
                  padding: 16,
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>{c.clientName}</Text>
                <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 4 }} numberOfLines={2}>
                  {[c.clientCode, c.locationAddress].filter(Boolean).join(" · ")}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={shiftModal} animationType="slide" onRequestClose={() => setShiftModal(false)}>
        <View style={{ flex: 1, backgroundColor: "#F5F5F7", paddingTop: insets.top + 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              marginBottom: 12,
            }}
          >
            <TouchableOpacity onPress={() => setShiftModal(false)} style={{ padding: 8 }}>
              <X size={24} color="#000" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: "700", flex: 1 }}>Select shift</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
            {shifts.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  setShift(s);
                  setShiftModal(false);
                }}
                style={{
                  padding: 16,
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>{s.name}</Text>
                <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 4 }}>
                  {s.startTime} – {s.endTime}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <DatePickerModal
        visible={startOpen}
        label="Start date"
        value={startDate}
        minDate={today}
        onSelect={(d) => {
          setStartDate(d);
          if (endDate && endDate < d) setEndDate("");
        }}
        onClose={() => setStartOpen(false)}
      />
      <DatePickerModal
        visible={endOpen}
        label="End date"
        value={endDate}
        minDate={startDate || today}
        onSelect={setEndDate}
        onClose={() => setEndOpen(false)}
      />
    </KeyboardAvoidingAnimatedView>
  );
}
