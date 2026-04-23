import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Share,
  Platform,
  Alert,
  Image,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import * as Contacts from "expo-contacts";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Building2,
  FileText,
  Users,
  Calendar,
  MessageCircle,
  Download,
  ExternalLink,
  UserPlus,
  ClipboardList,
  ShieldCheck,
  Briefcase,
  FolderOpen,
} from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { apiGetJson } from "@/utils/api";

const TABS = [
  { id: "OVERVIEW", label: "Overview", Icon: Building2 },
  { id: "LIVE_ON_SITE", label: "Live on site", Icon: Users },
  { id: "SERVICES", label: "Services", Icon: Briefcase },
  { id: "DOCUMENTS", label: "Documents", Icon: FolderOpen },
  { id: "CONTACTS", label: "Contacts", Icon: Users },
];

function formatDate(d) {
  if (!d) return "—";
  return String(d).slice(0, 10);
}

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function openWhatsApp(phone) {
  const d = digitsOnly(phone);
  if (!d) {
    Alert.alert("No phone", "This contact has no phone number.");
    return;
  }
  Linking.openURL(`https://wa.me/${d}`);
}

function statusTone(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return { bg: "rgba(52, 199, 89, 0.18)", fg: "#1B5E20" };
  if (s === "INACTIVE") return { bg: "rgba(142, 142, 147, 0.2)", fg: "#3A3A3C" };
  return { bg: "rgba(0, 122, 255, 0.15)", fg: "#007AFF" };
}

function expiryTone(label) {
  const s = String(label || "").toUpperCase();
  if (s.includes("EXPIRED")) return { bg: "rgba(255, 59, 48, 0.15)", fg: "#C62828" };
  if (s.includes("SOON") || s.includes("EXPIRING")) return { bg: "rgba(255, 149, 0, 0.2)", fg: "#C05621" };
  return { bg: "rgba(52, 199, 89, 0.15)", fg: "#1B5E20" };
}

function formatCheckInTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const s = String(value);
    return s.length > 5 ? s.slice(11, 16) || s : s;
  }
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function ClientDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [liveOnSite, setLiveOnSite] = useState(null);
  const [liveOnSiteLoading, setLiveOnSiteLoading] = useState(false);
  const [liveOnSiteRefreshing, setLiveOnSiteRefreshing] = useState(false);
  const [liveOnSiteError, setLiveOnSiteError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await apiGetJson(`/apps/operations-manager/clients/${id}`);
        if (!cancelled) setPayload(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setPayload(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadLiveOnSite = async (opts = {}) => {
    const isPull = opts.refresh === true;
    setLiveOnSiteError(null);
    if (isPull) setLiveOnSiteRefreshing(true);
    else setLiveOnSiteLoading(true);
    try {
      const { data } = await apiGetJson(`/apps/operations-manager/clients/${id}/live-on-site`);
      setLiveOnSite(data ?? null);
    } catch (e) {
      setLiveOnSite(null);
      setLiveOnSiteError(e instanceof Error ? e.message : "Failed to load live employees");
    } finally {
      if (isPull) setLiveOnSiteRefreshing(false);
      else setLiveOnSiteLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "LIVE_ON_SITE") return;
    if (liveOnSiteLoading) return;
    if (liveOnSite) return;
    loadLiveOnSite({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const saveContactToDevice = async (contact, clientTitle) => {
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Save to contacts works in the iOS / Android app.");
      return;
    }
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow contacts access to save this person.");
      return;
    }
    const rawName = (contact.contact_name || "Contact").trim();
    const parts = rawName.split(/\s+/);
    const firstName = parts[0] || "Contact";
    const lastName = parts.slice(1).join(" ");
    const record = {
      firstName,
      lastName,
      company: clientTitle,
      phoneNumbers: contact.phone
        ? [{ label: "mobile", number: String(contact.phone) }]
        : [],
      emails: contact.email ? [{ label: "work", email: String(contact.email) }] : [],
    };
    try {
      await Contacts.addContactAsync(record);
      Alert.alert("Saved", "Contact added to your address book.");
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again.");
    }
  };

  const openDocumentUrl = async (url) => {
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Linking.openURL(url);
    }
  };

  const shareDocument = async (doc) => {
    const url = doc.open_url || doc.file_url;
    if (!url) return;
    try {
      await Share.share({
        title: doc.file_name || doc.document_type || "Document",
        message: Platform.OS === "ios" ? url : `${doc.file_name || "Document"}\n${url}`,
        url: Platform.OS === "ios" ? url : undefined,
      });
    } catch {
      /* user dismissed */
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F5F5F7",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 12, fontSize: 15, color: "#666" }}>Loading site…</Text>
      </View>
    );
  }

  if (error || !payload) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F5F5F7",
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, color: "#FF3B30" }}>{error || "Not found"}</Text>
      </View>
    );
  }

  const {
    client,
    special_requirements: specialRequirementsTop,
    service_requirements,
    documents,
    contacts,
    guards_logged_in,
  } = payload;
  const title = client?.clientName ?? "Client";
  const specialReq =
    specialRequirementsTop || client?.specialRequirements || client?.special_requirements || null;

  const statusStyle = statusTone(client?.status);
  const expiryStyle = expiryTone(client?.contractExpiryStatus);

  const SectionLabel = ({ children }) => (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "800",
        color: "#007AFF",
        letterSpacing: 0.8,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );

  const InfoTile = ({ label, value, icon: Icon }) => (
    <GlassView
      style={[
        {
          flex: 1,
          minWidth: "46%",
          padding: 14,
          borderRadius: 16,
          marginBottom: 10,
          marginHorizontal: 4,
          overflow: "hidden",
        },
        isLiquidGlassAvailable() ? {} : { opacity: 0.98, backgroundColor: "#ffffff" },
      ]}
    >
      {Icon ? <Icon size={18} color="#007AFF" style={{ marginBottom: 8 }} /> : null}
      <Text style={{ fontSize: 11, fontWeight: "700", color: "#8E8E93", marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }} numberOfLines={3}>
        {value ?? "—"}
      </Text>
    </GlassView>
  );

  const ContactRow = ({ contact }) => (
    <GlassView
      style={[
        {
          padding: 16,
          borderRadius: 16,
          marginBottom: 12,
          overflow: "hidden",
          borderLeftWidth: 4,
          borderLeftColor: "#34C759",
        },
        isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
      ]}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>
        {contact.contact_name}
        {contact.is_primary ? (
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#007AFF" }}> · Primary</Text>
        ) : null}
      </Text>
      {contact.phone ? (
        <Pressable
          onPress={() => Linking.openURL(`tel:${contact.phone}`)}
          style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}
        >
          <Phone size={14} color="#007AFF" />
          <Text style={{ fontSize: 14, color: "#007AFF", marginLeft: 6 }}>{contact.phone}</Text>
        </Pressable>
      ) : null}
      {contact.email ? (
        <Pressable
          onPress={() => Linking.openURL(`mailto:${contact.email}`)}
          style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}
        >
          <Mail size={14} color="#007AFF" />
          <Text style={{ fontSize: 14, color: "#007AFF", marginLeft: 6 }}>{contact.email}</Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <Pressable
          onPress={() => saveContactToDevice(contact, title)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: "rgba(0,122, 255, 0.12)",
          }}
        >
          <UserPlus size={16} color="#007AFF" />
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#007AFF", marginLeft: 6 }}>
            Save contact
          </Text>
        </Pressable>
        <Pressable
          onPress={() => openWhatsApp(contact.phone)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: "rgba(52, 199, 89, 0.15)",
          }}
        >
          <MessageCircle size={16} color="#34C759" />
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#34C759", marginLeft: 6 }}>
            WhatsApp
          </Text>
        </Pressable>
      </View>
    </GlassView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
      <StatusBar style="dark" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          activeTab === "LIVE_ON_SITE" ? (
            <RefreshControl
              refreshing={liveOnSiteRefreshing}
              onRefresh={() => loadLiveOnSite({ refresh: true })}
            />
          ) : undefined
        }
      >
        <LinearGradient
          colors={["#E8F2FF", "#EEF6FC", "#F5F5F7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(0,122,255,0.1)",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                marginRight: 12,
                padding: 8,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.7)",
              }}
            >
              <ArrowLeft size={22} color="#000" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: "#007AFF",
                  letterSpacing: 1,
                }}
              >
                SITE INTEL
              </Text>
              <Text
                style={{ fontSize: 22, fontWeight: "800", color: "#000", marginTop: 4 }}
                numberOfLines={2}
              >
                {title}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {client?.status ? (
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: statusStyle.bg,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: statusStyle.fg }}>
                  {client.status}
                </Text>
              </View>
            ) : null}
            {client?.complianceStatus ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: "rgba(0, 122, 255, 0.12)",
                }}
              >
                <ShieldCheck size={14} color="#007AFF" />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#007AFF",
                    marginLeft: 6,
                  }}
                >
                  {client.complianceStatus}
                </Text>
              </View>
            ) : null}
            {client?.contractExpiryStatus ? (
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: expiryStyle.bg,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: expiryStyle.fg }}>
                  {client.contractExpiryStatus}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={{ fontSize: 13, color: "#3C3C43", lineHeight: 18, marginBottom: 16 }}>
            {client.deploymentAddress ||
              client.site_label ||
              [client.city, client.state].filter(Boolean).join(", ") ||
              "Address not on file"}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {TABS.map((tab) => {
                const selected = activeTab === tab.id;
                const Icon = tab.Icon;
                return (
                  <TouchableOpacity key={tab.id} activeOpacity={0.85} onPress={() => setActiveTab(tab.id)}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 14,
                        backgroundColor: selected ? "#007AFF" : "rgba(255,255,255,0.85)",
                        borderWidth: selected ? 0 : 1,
                        borderColor: "rgba(0,122,255,0.2)",
                      }}
                    >
                      <Icon size={16} color={selected ? "#FFF" : "#007AFF"} />
                      <Text
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          fontWeight: "700",
                          color: selected ? "#FFF" : "#000",
                        }}
                      >
                        {tab.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </LinearGradient>

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          {activeTab === "OVERVIEW" && (
            <>
              <SectionLabel>SITE OVERVIEW</SectionLabel>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#000", marginBottom: 12 }}>
                Key details
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
                <InfoTile label="Client type" value={client.clientType} />
                <InfoTile label="Compliance" value={client.complianceStatus} icon={ShieldCheck} />
                <InfoTile label="Phone" value={client.primary_phone} icon={Phone} />
                <InfoTile label="Email" value={client.primary_email} icon={Mail} />
              </View>

              <GlassView
                style={[
                  {
                    padding: 16,
                    borderRadius: 18,
                    marginBottom: 16,
                    overflow: "hidden",
                  },
                  isLiquidGlassAvailable() ? {} : { opacity: 0.97, backgroundColor: "#ffffff" },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <MapPin size={18} color="#007AFF" />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#000", marginLeft: 8 }}>
                    Full address
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: "#636366", lineHeight: 20 }}>
                  {client.deploymentAddress ||
                    client.site_label ||
                    [client.city, client.state, client.pincode].filter(Boolean).join(", ") ||
                    "—"}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 14,
                    paddingTop: 14,
                    borderTopWidth: 1,
                    borderTopColor: "rgba(0,0,0,0.06)",
                  }}
                >
                  <Calendar size={18} color="#007AFF" />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#8E8E93" }}>
                      CONTRACT WINDOW
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#000", marginTop: 4 }}>
                      Start {formatDate(client.onboardingDate)}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#000", marginTop: 2 }}>
                      Expires {formatDate(client.contractExpiryDate)}
                    </Text>
                  </View>
                </View>
              </GlassView>

              <SectionLabel>LIVE ROSTER</SectionLabel>
              <GlassView
                style={[
                  {
                    padding: 20,
                    borderRadius: 18,
                    alignItems: "center",
                    overflow: "hidden",
                  },
                  isLiquidGlassAvailable() ? {} : { opacity: 0.97, backgroundColor: "#ffffff" },
                ]}
              >
                <Users size={28} color="#34C759" />
                <Text
                  style={{
                    fontSize: 36,
                    fontWeight: "800",
                    color: "#34C759",
                    marginTop: 8,
                  }}
                >
                  {guards_logged_in?.count ?? 0}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#666", marginTop: 6 }}>
                  Guards checked in now
                </Text>
                {guards_logged_in?.attendance_date ? (
                  <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 8 }}>
                    {guards_logged_in.attendance_date} · {guards_logged_in.timezone}
                  </Text>
                ) : null}
              </GlassView>
            </>
          )}

          {activeTab === "LIVE_ON_SITE" && (
            <>
              <SectionLabel>LIVE ON SITE</SectionLabel>
              <Text style={{ fontSize: 14, color: "#8E8E93", marginBottom: 14, lineHeight: 20 }}>
                Checked in today · pull down to refresh
              </Text>

              {liveOnSiteLoading && !liveOnSite?.items?.length ? (
                <ActivityIndicator style={{ marginVertical: 20 }} color="#007AFF" />
              ) : null}
              {liveOnSiteError ? (
                <Text style={{ color: "#C62828", marginBottom: 10, fontSize: 14 }}>{liveOnSiteError}</Text>
              ) : null}

              {liveOnSite?.items?.length ? (
                liveOnSite.items.map((p) => {
                  const checkInLabel = formatCheckInTime(p.checkIn);
                  return (
                    <GlassView
                      key={p.employeeId}
                      style={[
                        {
                          paddingVertical: 14,
                          paddingHorizontal: 16,
                          borderRadius: 14,
                          marginBottom: 10,
                          overflow: "hidden",
                        },
                        isLiquidGlassAvailable() ? {} : { opacity: 0.96, backgroundColor: "#ffffff" },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 17, fontWeight: "700", color: "#000" }} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 4 }}>
                            {p.employeeCode ? `Code ${p.employeeCode}` : "Code —"}
                          </Text>
                          <Text style={{ fontSize: 13, color: "#3C3C43", marginTop: 8 }} numberOfLines={2}>
                            {[p.designation || "—", checkInLabel ? `Since ${checkInLabel}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                          {p.phone ? (
                            <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 6 }} numberOfLines={1}>
                              {p.phone}
                            </Text>
                          ) : null}
                        </View>
                        {p.phone ? (
                          <Pressable
                            onPress={() => Linking.openURL(`tel:${p.phone}`)}
                            accessibilityRole="button"
                            accessibilityLabel={`Call ${p.name}`}
                            style={({ pressed }) => ({
                              paddingVertical: 10,
                              paddingHorizontal: 14,
                              borderRadius: 12,
                              backgroundColor: "#007AFF",
                              opacity: pressed ? 0.88 : 1,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            })}
                          >
                            <Phone size={18} color="#FFF" />
                            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>Call</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </GlassView>
                  );
                })
              ) : !liveOnSiteLoading ? (
                <Text style={{ color: "#8E8E93", fontSize: 14, lineHeight: 20 }}>
                  No one is checked in right now. Pull down to refresh.
                </Text>
              ) : null}
            </>
          )}

          {activeTab === "SERVICES" && (
            <>
              <SectionLabel>DEPLOYMENT</SectionLabel>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#000", marginBottom: 14 }}>
                Services & requirements
              </Text>
              {specialReq ? (
                <GlassView
                  style={[
                    {
                      padding: 18,
                      borderRadius: 18,
                      marginBottom: 16,
                      overflow: "hidden",
                      borderLeftWidth: 5,
                      borderLeftColor: "#FF9500",
                    },
                    isLiquidGlassAvailable() ? {} : { opacity: 0.97, backgroundColor: "#ffffff" },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <ClipboardList size={20} color="#FF9500" />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: "#000",
                        marginLeft: 8,
                      }}
                    >
                      Special requirements
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, color: "#3C3C43", lineHeight: 22 }}>{specialReq}</Text>
                </GlassView>
              ) : null}
              {service_requirements?.length ? (
                service_requirements.map((row, idx) => (
                  <GlassView
                    key={row.id}
                    style={[
                      {
                        padding: 18,
                        borderRadius: 18,
                        marginBottom: 12,
                        overflow: "hidden",
                        borderLeftWidth: 5,
                        borderLeftColor: idx % 2 === 0 ? "#007AFF" : "#5856D6",
                      },
                      isLiquidGlassAvailable() ? {} : { opacity: 0.97, backgroundColor: "#ffffff" },
                    ]}
                  >
                    <Text style={{ fontSize: 17, fontWeight: "800", color: "#000" }}>
                      {row.service?.name || row.service_type || "Service"}
                    </Text>
                    {row.service_type && row.service?.name ? (
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#8E8E93", marginTop: 6 }}>
                        Type · {row.service_type}
                      </Text>
                    ) : null}
                    <View
                      style={{
                        marginTop: 12,
                        alignSelf: "flex-start",
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 12,
                        backgroundColor: "rgba(0,122, 255, 0.1)",
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "800", color: "#007AFF" }}>
                        {row.number_of_deployment ?? "—"} deployments
                      </Text>
                    </View>
                  </GlassView>
                ))
              ) : (
                <Text style={{ color: "#8E8E93", fontSize: 15 }}>No service requirements recorded.</Text>
              )}
            </>
          )}

          {activeTab === "DOCUMENTS" && (
            <>
              <SectionLabel>VAULT</SectionLabel>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#000", marginBottom: 14 }}>
                Files & compliance docs
              </Text>
              {documents?.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  {documents.map((doc) => {
                    const url = doc.open_url || doc.file_url;
                    const showImage = doc.is_previewable_image && url;
                    return (
                      <GlassView
                        key={doc.id}
                        style={[
                          {
                            width: "47%",
                            maxWidth: 220,
                            borderRadius: 18,
                            overflow: "hidden",
                            padding: 12,
                          },
                          isLiquidGlassAvailable() ? {} : { opacity: 0.97, backgroundColor: "#ffffff" },
                        ]}
                      >
                        <Pressable
                          onPress={() => openDocumentUrl(url)}
                          style={{
                            borderRadius: 14,
                            overflow: "hidden",
                            backgroundColor: "#EEF0F4",
                          }}
                        >
                          {showImage ? (
                            <Image
                              source={{ uri: url }}
                              style={{ width: "100%", aspectRatio: 1, backgroundColor: "#EEF0F4" }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View
                              style={{
                                width: "100%",
                                aspectRatio: 1,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "rgba(0,122,255,0.08)",
                              }}
                            >
                              <FileText size={36} color="#007AFF" />
                            </View>
                          )}
                        </Pressable>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "800",
                            color: "#000",
                            marginTop: 10,
                          }}
                          numberOfLines={2}
                        >
                          {doc.document_type || "Document"}
                        </Text>
                        {doc.file_name ? (
                          <Text style={{ fontSize: 11, color: "#8E8E93", marginTop: 4 }} numberOfLines={2}>
                            {doc.file_name}
                          </Text>
                        ) : null}
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                          <Pressable
                            onPress={() => openDocumentUrl(url)}
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              paddingVertical: 8,
                              borderRadius: 12,
                              backgroundColor: "rgba(0,122,255,0.12)",
                            }}
                          >
                            <ExternalLink size={14} color="#007AFF" />
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "800",
                                color: "#007AFF",
                                marginLeft: 4,
                              }}
                            >
                              Open
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => shareDocument(doc)}
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              paddingVertical: 8,
                              borderRadius: 12,
                              backgroundColor: "rgba(142,142,147,0.12)",
                            }}
                          >
                            <Download size={14} color="#333" />
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "800",
                                color: "#333",
                                marginLeft: 4,
                              }}
                            >
                              Share
                            </Text>
                          </Pressable>
                        </View>
                      </GlassView>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ color: "#8E8E93" }}>No documents uploaded.</Text>
              )}
            </>
          )}

          {activeTab === "CONTACTS" && (
            <>
              <SectionLabel>PEOPLE</SectionLabel>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#000", marginBottom: 14 }}>
                Site contacts
              </Text>
              {contacts?.length ? (
                contacts.map((c) => <ContactRow key={c.id} contact={c} />)
              ) : (
                <Text style={{ color: "#8E8E93" }}>No contacts listed.</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
