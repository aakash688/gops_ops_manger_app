import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  Building2,
  Settings,
  LogOut,
  Fingerprint,
  ChevronRight,
  LogIn,
  GraduationCap,
  Check,
  RefreshCw,
  ChevronDown,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useRef, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import FloatingActionButton from "@/components/FloatingActionButton";
import { useAuthStore, authKey } from "@/utils/auth/store";
import { apiGetJson, apiPostJson } from "@/utils/api";

function resolveOrgId(org) {
  if (!org) return "";
  const raw = org.org_id ?? org.id;
  return raw != null ? String(raw) : "";
}

function normalizeOrgs(list) {
  if (!Array.isArray(list)) return [];
  return list.map((o) => ({
    ...o,
    org_id: o.org_id ?? o.id,
    id: o.id ?? o.org_id,
  }));
}

/** Union login + /me org lists so multi-org accounts always see every workspace. */
function mergeOrgLists(a, b) {
  const map = new Map();
  for (const o of [...normalizeOrgs(a), ...normalizeOrgs(b)]) {
    const k = resolveOrgId(o);
    if (k) map.set(k, o);
  }
  return Array.from(map.values());
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useAuthStore((s) => s.auth);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState(null);
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);
  const [orgSwitching, setOrgSwitching] = useState(false);
  const profileFocusCount = useRef(0);

  const loadProfile = useCallback(async (silent) => {
    const authSnapshot = useAuthStore.getState().auth;
    if (!authSnapshot?.jwt) {
      setMeLoading(false);
      setMe(null);
      return;
    }
    if (!silent) {
      setMeError(null);
      setMeLoading(true);
    }
    try {
      const { data } = await apiGetJson("/apps/auth/me");
      setMe(data);
      const latest = useAuthStore.getState().auth;
      if (latest?.jwt && Array.isArray(data?.organizations)) {
        const merged = mergeOrgLists(data.organizations, latest.organizations);
        if (merged.length > 0) {
          const next = { ...latest, organizations: merged };
          await SecureStore.setItemAsync(authKey, JSON.stringify(next));
          useAuthStore.setState({ auth: next });
        }
      }
    } catch (e) {
      setMeError(e instanceof Error ? e.message : "Could not load profile");
      if (!silent) setMe(null);
    } finally {
      if (!silent) setMeLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      profileFocusCount.current += 1;
      const silent = profileFocusCount.current > 1;
      loadProfile(silent);
    }, [loadProfile, auth?.jwt]),
  );

  const handleLogout = () => {
    setAuth(null);
    router.replace("/");
  };

  const activeOrgId =
    me?.active_org_id ?? me?.active_organization?.id ?? auth?.user?.orgId ?? null;
  const activeOrgIdStr = activeOrgId != null ? String(activeOrgId) : "";
  const organizations = useMemo(
    () => mergeOrgLists(me?.organizations, auth?.organizations),
    [me?.organizations, auth?.organizations],
  );
  const canSwitchOrg = organizations.length > 1;

  const switchToOrganization = async (org) => {
    const orgId = resolveOrgId(org);
    if (!orgId || orgId === activeOrgIdStr || orgSwitching) return;
    setOrgSwitching(true);
    try {
      const { data } = await apiPostJson("/apps/auth/switch-org", {
        org_id: orgId,
      });
      const authNow = useAuthStore.getState().auth;
      const nextAuth = {
        jwt: data.token,
        user: {
          ...(authNow?.user || {}),
          name: authNow?.user?.name || me?.employee?.name,
          email: authNow?.user?.email || me?.employee?.email,
          orgName: data.active_organization?.name ?? "",
          orgId: data.active_organization?.id ?? orgId,
        },
        organizations: mergeOrgLists(me?.organizations, authNow?.organizations),
      };
      await SecureStore.setItemAsync(authKey, JSON.stringify(nextAuth));
      useAuthStore.setState({ auth: nextAuth });
      setOrgPickerOpen(false);
      await loadProfile(true);
      Alert.alert(
        "Organization updated",
        `Now working in ${data.active_organization?.name ?? "selected org"}.`,
      );
    } catch (e) {
      Alert.alert(
        "Switch failed",
        e instanceof Error ? e.message : "Could not change organization.",
      );
    } finally {
      setOrgSwitching(false);
    }
  };

  const displayName =
    me?.employee?.name || auth?.user?.name || "Operations Manager";
  const displayEmail =
    me?.employee?.email || auth?.user?.email || "";
  const workPhone = me?.logged_in_contact?.phone || me?.employee?.phone || null;
  const orgName =
    me?.active_organization?.name || auth?.user?.orgName || "";
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "OM";

  const MenuItem = ({ icon: Icon, label, onPress, rightElement }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        marginBottom: 12,
      })}
    >
      <GlassView
        isInteractive={true}
        style={[
          {
            padding: 16,
            borderRadius: 16,
            overflow: "hidden",
          },
          isLiquidGlassAvailable()
            ? {}
            : { opacity: 0.95, backgroundColor: "#ffffff" },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Icon size={22} color="#007AFF" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "500",
                color: "#000",
                marginLeft: 12,
              }}
            >
              {label}
            </Text>
          </View>
          {rightElement || <ChevronRight size={20} color="#C7C7CC" />}
        </View>
      </GlassView>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
      <StatusBar style="dark" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: insets.top + 20,
            paddingBottom: 32,
          }}
        >
          <Text style={{ fontSize: 32, fontWeight: "700", color: "#000" }}>
            Profile
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
          <GlassView
            style={[
              {
                padding: 20,
                borderRadius: 20,
                alignItems: "center",
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            {me?.employee?.avatar_url ? (
              <Image
                source={{ uri: me.employee.avatar_url }}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  marginBottom: 16,
                }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  backgroundColor: "#007AFF",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: "700", color: "#FFF" }}>
                  {initials}
                </Text>
              </View>
            )}
            {meLoading ? (
              <ActivityIndicator style={{ marginVertical: 8 }} />
            ) : null}
            {meError ? (
              <Text style={{ fontSize: 13, color: "#FF3B30", marginBottom: 8 }}>
                {meError}
              </Text>
            ) : null}
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: "#000",
                marginBottom: 4,
                textAlign: "center",
              }}
            >
              {displayName}
            </Text>
            {me?.post?.name ? (
              <Text style={{ fontSize: 15, color: "#666", marginBottom: 4 }}>
                {me.post.name}
              </Text>
            ) : null}
            <Text
              style={{
                fontSize: 15,
                color: "#666",
                marginBottom: 2,
                textAlign: "center",
              }}
            >
              {displayEmail}
            </Text>
            {workPhone ? (
              <Text
                style={{
                  fontSize: 15,
                  color: "#666",
                  marginBottom: 2,
                  textAlign: "center",
                }}
              >
                {workPhone}
              </Text>
            ) : null}
            {me?.employee?.joining_date ? (
              <Text style={{ fontSize: 13, color: "#999", marginTop: 4 }}>
                Joined {me.employee.joining_date}
              </Text>
            ) : null}
            {auth?.jwt && orgName ? (
              <Pressable
                onPress={() => setOrgPickerOpen(true)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.88 : 1,
                  marginTop: 12,
                  alignSelf: "stretch",
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "rgba(0, 122, 255, 0.1)",
                  }}
                >
                  <Building2 size={16} color="#007AFF" />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#007AFF",
                      marginLeft: 6,
                      flex: 1,
                    }}
                  >
                    {orgName}
                  </Text>
                  <ChevronDown size={18} color="#007AFF" />
                </View>
              </Pressable>
            ) : null}
            {auth?.jwt ? (
              <Text
                style={{
                  fontSize: 12,
                  color: "#666",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                {canSwitchOrg
                  ? "Tap to switch organization"
                  : organizations.length <= 1
                    ? "Workspace · ask an admin to link more orgs to switch"
                    : "Tap to view workspaces"}
              </Text>
            ) : null}
          </GlassView>
        </View>

        <Modal
          visible={orgPickerOpen}
          animationType="fade"
          transparent
          statusBarTranslucent={Platform.OS === "android"}
          presentationStyle="overFullScreen"
          onRequestClose={() => !orgSwitching && setOrgPickerOpen(false)}
        >
          <View style={styles.orgModalRoot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close organization picker"
              style={styles.orgModalBackdrop}
              onPress={() => !orgSwitching && setOrgPickerOpen(false)}
            />
            <View
              style={[
                styles.orgSheet,
                { paddingBottom: Math.max(insets.bottom, 14) + 8 },
              ]}
            >
              <View style={styles.orgSheetGrabber} />
              <Text style={styles.orgSheetTitle}>Switch organization</Text>
              <Text style={styles.orgSheetSubtitle}>
                Clients and attendance follow the workspace you select.
              </Text>
              {orgSwitching ? (
                <ActivityIndicator style={{ marginVertical: 28 }} color="#007AFF" />
              ) : organizations.length === 0 ? (
                <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
                  <Text style={styles.orgEmptyText}>
                    No organizations loaded. Sign in again or retry.
                  </Text>
                  <Pressable
                    onPress={() => loadProfile(false)}
                    style={styles.orgRetryBtn}
                  >
                    <Text style={styles.orgRetryBtnText}>Retry</Text>
                  </Pressable>
                </View>
              ) : (
                <ScrollView
                  style={styles.orgListScroll}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                >
                  {organizations.map((org) => {
                    const rowKey = resolveOrgId(org) || org.id;
                    const isActive = resolveOrgId(org) === activeOrgIdStr;
                    return (
                      <Pressable
                        key={rowKey}
                        onPress={() => switchToOrganization(org)}
                        style={({ pressed }) => [
                          styles.orgRow,
                          pressed && styles.orgRowPressed,
                          isActive && styles.orgRowActive,
                        ]}
                      >
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={styles.orgRowTitle}>{org.name}</Text>
                          {org.code ? (
                            <Text style={styles.orgRowMeta}>
                              {org.code}
                              {org.role ? ` · ${org.role}` : ""}
                            </Text>
                          ) : org.role ? (
                            <Text style={styles.orgRowMeta}>{org.role}</Text>
                          ) : null}
                          {org.is_primary ? (
                            <Text style={styles.orgRowBadge}>Primary</Text>
                          ) : null}
                        </View>
                        {isActive ? (
                          <Check size={22} color="#007AFF" />
                        ) : (
                          <ChevronRight size={20} color="#C7C7CC" />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              <Pressable
                onPress={() => !orgSwitching && setOrgPickerOpen(false)}
                style={styles.orgCancelBtn}
              >
                <Text style={styles.orgCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View style={{ paddingHorizontal: 20 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#000",
              marginBottom: 12,
            }}
          >
            Settings
          </Text>

          {auth?.jwt ? (
            <MenuItem
              icon={RefreshCw}
              label="Switch organization"
              onPress={() => setOrgPickerOpen(true)}
            />
          ) : null}

          {!auth?.jwt ? (
            <MenuItem
              icon={LogIn}
              label="Sign in"
              onPress={() => router.push("/login")}
            />
          ) : null}

          <MenuItem
            icon={GraduationCap}
            label="Training updates"
            onPress={() => router.push("/training")}
          />

          <MenuItem
            icon={Fingerprint}
            label="Biometric unlock"
            onPress={() => {}}
            rightElement={
              <Switch
                value={biometricEnabled}
                onValueChange={setBiometricEnabled}
                trackColor={{ false: "#E5E5EA", true: "#34C759" }}
                thumbColor="#FFFFFF"
              />
            }
          />

          <MenuItem
            icon={Settings}
            label="App settings"
            onPress={() => router.push("/settings")}
          />

          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              marginTop: 20,
            })}
          >
            <GlassView
              isInteractive={true}
              style={[
                {
                  padding: 16,
                  borderRadius: 16,
                  overflow: "hidden",
                },
                isLiquidGlassAvailable()
                  ? {}
                  : { opacity: 0.95, backgroundColor: "#ffffff" },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LogOut size={22} color="#FF3B30" />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#FF3B30",
                    marginLeft: 12,
                  }}
                >
                  Log Out
                </Text>
              </View>
            </GlassView>
          </Pressable>
        </View>

        <View
          style={{ paddingHorizontal: 20, marginTop: 32, alignItems: "center" }}
        >
          <Text style={{ fontSize: 13, color: "#999" }}>Version 1.0.0</Text>
        </View>
      </ScrollView>

      <FloatingActionButton />
    </View>
  );
}

const styles = StyleSheet.create({
  orgModalRoot: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  /** Full-screen dim so it never appears “half height” on any device. */
  orgModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28, 28, 30, 0.5)",
  },
  orgSheet: {
    width: "100%",
    maxHeight: "56%",
    backgroundColor: "#F5F5F7",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60, 60, 67, 0.29)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  orgSheetGrabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(60, 60, 67, 0.3)",
    alignSelf: "center",
    marginBottom: 14,
  },
  orgSheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  orgSheetSubtitle: {
    fontSize: 13,
    color: "#636366",
    paddingHorizontal: 20,
    marginBottom: 12,
    lineHeight: 18,
  },
  orgListScroll: {
    maxHeight: 320,
  },
  orgRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  orgRowPressed: {
    opacity: 0.92,
  },
  orgRowActive: {
    backgroundColor: "rgba(0, 122, 255, 0.08)",
  },
  orgRowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  orgRowMeta: {
    fontSize: 13,
    color: "#636366",
    marginTop: 3,
  },
  orgRowBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
    marginTop: 6,
  },
  orgEmptyText: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 14,
  },
  orgRetryBtn: {
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#007AFF",
  },
  orgRetryBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },
  orgCancelBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  orgCancelText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#007AFF",
  },
});
