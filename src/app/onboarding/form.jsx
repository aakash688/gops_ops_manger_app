import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
} from "react-native";
import StackScreen from "@/components/StackScreen";
import { DatePickerModal, todayYmdLocal } from "@/components/DatePicker";
import { apiGetJson, apiPostJson } from "@/utils/api";
import { ChevronRight, Search, X, CalendarDays, UserRound } from "lucide-react-native";

function toYmdFromInput(s) {
  // Accept YYYY-MM-DD only (backend requires this)
  return s.trim();
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8E8E93",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60, 60, 67, 0.18)",
    marginBottom: 18,
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
  label: { fontSize: 13, fontWeight: "600", color: "#3A3A3C", marginBottom: 8 },
  field: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60, 60, 67, 0.18)",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  row: { marginBottom: 14 },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { fontSize: 16, color: "#1C1C1E" },
  selectHint: { fontSize: 16, color: "#AEAEB2" },
  iconInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  iconInput: {
    flex: 1,
    fontSize: 16,
    color: "#1C1C1E",
    paddingVertical: Platform.OS === "ios" ? 11 : 9,
    marginLeft: 8,
  },
  primaryBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 17, fontWeight: "600", color: "#FFFFFF" },
});

function GenderModal({ visible, value, onPick, onClose }) {
  const options = ["Male", "Female", "Other"];
  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}>
      <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
        <View
          style={{
            paddingTop: 16,
            paddingHorizontal: 16,
            paddingBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: "rgba(0,0,0,0.08)",
          }}
        >
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 4, paddingRight: 10 }}>
            <Text style={{ fontSize: 17, color: "#007AFF" }}>Close</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "600", color: "#000", flex: 1, textAlign: "center" }}>Gender</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={{ padding: 16 }}>
          {options.map((opt) => {
            const selected = (value || "").trim().toLowerCase() === opt.toLowerCase();
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => {
                  onPick(opt);
                  onClose();
                }}
                activeOpacity={0.75}
                style={{ marginBottom: 10 }}
              >
                <View style={[styles.field, { paddingVertical: 14, borderColor: selected ? "rgba(0,122,255,0.6)" : "rgba(60, 60, 67, 0.18)" }]}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>{opt}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

function SelectorModal({ visible, title, items, onPick, onClose }) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!visible) setQ("");
  }, [visible]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((it) => {
      const hay = `${it.name ?? ""} ${it.code ?? ""}`.toLowerCase();
      return hay.includes(t);
    });
  }, [items, q]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}>
      <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
        <View
          style={{
            paddingTop: 16,
            paddingHorizontal: 16,
            paddingBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: "rgba(0,0,0,0.08)",
          }}
        >
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 4, paddingRight: 10 }}>
            <Text style={{ fontSize: 17, color: "#007AFF" }}>Close</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "600", color: "#000", flex: 1, textAlign: "center" }}>{title}</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={{ padding: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(60, 60, 67, 0.18)",
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Search size={18} color="#8E8E93" />
            <TextInput
              placeholder="Search…"
              value={q}
              onChangeText={setQ}
              style={{ flex: 1, marginLeft: 8, fontSize: 16, color: "#1C1C1E" }}
              placeholderTextColor="#AEAEB2"
            />
            {q ? (
              <TouchableOpacity onPress={() => setQ("")} hitSlop={10}>
                <X size={18} color="#8E8E93" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                onPick(item);
                onClose();
              }}
              activeOpacity={0.75}
              style={{ marginBottom: 10 }}
            >
              <View style={[styles.field, { paddingVertical: 12 }]}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>{item.name}</Text>
                {item.code ? <Text style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{item.code}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: "#8E8E93", paddingVertical: 24 }}>No matches.</Text>
          }
        />
      </View>
    </Modal>
  );
}

export default function OnboardingFormScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [pincode, setPincode] = useState("");
  const [gender, setGender] = useState("");
  const [joiningDate, setJoiningDate] = useState(todayYmdLocal());

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [department, setDepartment] = useState(null);
  const [designation, setDesignation] = useState(null);
  const [shift, setShift] = useState(null);

  const [pickDeptOpen, setPickDeptOpen] = useState(false);
  const [pickDesigOpen, setPickDesigOpen] = useState(false);
  const [pickShiftOpen, setPickShiftOpen] = useState(false);
  const [pickGenderOpen, setPickGenderOpen] = useState(false);
  const [pickDobOpen, setPickDobOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLists(true);
      try {
        const [dep, des, sh] = await Promise.all([
          apiGetJson("/departments?limit=100&offset=0"),
          apiGetJson("/designations?limit=100&offset=0"),
          apiGetJson("/shifts?limit=100&offset=0"),
        ]);
        if (cancelled) return;
        setDepartments(Array.isArray(dep.data) ? dep.data : []);
        setDesignations(Array.isArray(des.data) ? des.data : []);
        setShifts(Array.isArray(sh.data) ? sh.data : []);
      } catch (e) {
        if (cancelled) return;
        Alert.alert("Error", e instanceof Error ? e.message : "Failed to load masters.");
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    if (!firstName.trim()) return Alert.alert("First name", "First name is required.");
    if (!phoneNumber.trim()) return Alert.alert("Phone", "Phone number is required.");
    if (!dateOfBirth.trim()) return Alert.alert("DOB", "Date of birth is required (YYYY-MM-DD).");
    if (!pincode.trim()) return Alert.alert("Pincode", "Pincode is required.");
    if (!gender.trim()) return Alert.alert("Gender", "Gender is required.");
    if (!department?.id) return Alert.alert("Department", "Select a department.");
    if (!shift?.id) return Alert.alert("Shift", "Select a shift.");
    if (!designation?.id) return Alert.alert("Designation", "Select a designation.");
    if (!joiningDate.trim()) return Alert.alert("Joining date", "Joining date is required (YYYY-MM-DD).");

    setSubmitting(true);
    try {
      await apiPostJson("/apps/operations-manager/employees/onboard", {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        phoneNumber: phoneNumber.trim(),
        dateOfBirth: toYmdFromInput(dateOfBirth),
        pincode: pincode.trim(),
        gender: gender.trim(),
        departmentId: department.id,
        shiftId: shift.id,
        designationId: designation.id,
        joiningDate: toYmdFromInput(joiningDate),
      });
      Alert.alert("Created", "Employee created with status PENDING.", [
        {
          text: "OK",
          onPress: () => {
            setFirstName("");
            setLastName("");
            setPhoneNumber("");
            setDateOfBirth("");
            setPincode("");
            setGender("");
            setJoiningDate(todayYmdLocal());
            setDepartment(null);
            setDesignation(null);
            setShift(null);
          },
        },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create employee.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackScreen title="Employee onboarding" subtitle="Creates employee with status PENDING">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Text style={styles.sectionTitle}>Personal</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>First name</Text>
            <TextInput value={firstName} onChangeText={setFirstName} style={styles.field} placeholder="First name" />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Last name</Text>
            <TextInput value={lastName} onChangeText={setLastName} style={styles.field} placeholder="Last name" />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              style={styles.field}
              placeholder="10-digit phone"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Gender</Text>
            <TouchableOpacity onPress={() => setPickGenderOpen(true)} activeOpacity={0.75}>
              <View style={[styles.field, styles.selectRow]}>
                <Text style={gender ? styles.selectText : styles.selectHint}>{gender || "Select gender"}</Text>
                <ChevronRight size={18} color="#8E8E93" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.row, { marginBottom: 0 }]}>
            <Text style={styles.label}>Date of birth</Text>
            <TouchableOpacity onPress={() => setPickDobOpen(true)} activeOpacity={0.75}>
              <View style={[styles.field, styles.selectRow]}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <CalendarDays size={18} color="#8E8E93" />
                  <Text style={[dateOfBirth ? styles.selectText : styles.selectHint, { marginLeft: 8 }]}>
                    {dateOfBirth || "Pick date"}
                  </Text>
                </View>
                <ChevronRight size={18} color="#8E8E93" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Work details</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Pin code</Text>
            <TextInput
              value={pincode}
              onChangeText={setPincode}
              style={styles.field}
              placeholder="400001"
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Department</Text>
            <TouchableOpacity disabled={loadingLists} onPress={() => setPickDeptOpen(true)} activeOpacity={0.75}>
              <View style={[styles.field, styles.selectRow, { opacity: loadingLists ? 0.6 : 1 }]}>
                <Text style={department ? styles.selectText : styles.selectHint}>{department?.name ?? "Select department"}</Text>
                {loadingLists ? <ActivityIndicator color="#007AFF" /> : <ChevronRight size={18} color="#8E8E93" />}
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Shift type</Text>
            <TouchableOpacity disabled={loadingLists} onPress={() => setPickShiftOpen(true)} activeOpacity={0.75}>
              <View style={[styles.field, styles.selectRow, { opacity: loadingLists ? 0.6 : 1 }]}>
                <Text style={shift ? styles.selectText : styles.selectHint}>{shift?.name ?? "Select shift"}</Text>
                {loadingLists ? <ActivityIndicator color="#007AFF" /> : <ChevronRight size={18} color="#8E8E93" />}
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Designation</Text>
            <TouchableOpacity disabled={loadingLists} onPress={() => setPickDesigOpen(true)} activeOpacity={0.75}>
              <View style={[styles.field, styles.selectRow, { opacity: loadingLists ? 0.6 : 1 }]}>
                <Text style={designation ? styles.selectText : styles.selectHint}>{designation?.name ?? "Select designation"}</Text>
                {loadingLists ? <ActivityIndicator color="#007AFF" /> : <ChevronRight size={18} color="#8E8E93" />}
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.row, { marginBottom: 0 }]}>
            <Text style={styles.label}>Joining date</Text>
            <View style={[styles.field, styles.selectRow]}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <UserRound size={18} color="#8E8E93" />
                <Text style={[joiningDate ? styles.selectText : styles.selectHint, { marginLeft: 8 }]}>
                  {joiningDate || "YYYY-MM-DD"}
                </Text>
              </View>
              <TextInput
                value={joiningDate}
                onChangeText={setJoiningDate}
                style={{ fontSize: 16, color: "#1C1C1E", paddingVertical: 0, textAlign: "right", minWidth: 110 }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#AEAEB2"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={submit} disabled={submitting} style={{ opacity: submitting ? 0.6 : 1 }}>
          <View style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{submitting ? "Creating…" : "Create employee (Pending)"}</Text>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      <SelectorModal
        visible={pickDeptOpen}
        title="Select department"
        items={departments}
        onPick={setDepartment}
        onClose={() => setPickDeptOpen(false)}
      />
      <SelectorModal
        visible={pickShiftOpen}
        title="Select shift"
        items={shifts}
        onPick={setShift}
        onClose={() => setPickShiftOpen(false)}
      />
      <SelectorModal
        visible={pickDesigOpen}
        title="Select designation"
        items={designations}
        onPick={setDesignation}
        onClose={() => setPickDesigOpen(false)}
      />

      <GenderModal
        visible={pickGenderOpen}
        value={gender}
        onPick={(v) => setGender(v)}
        onClose={() => setPickGenderOpen(false)}
      />
      <DatePickerModal
        visible={pickDobOpen}
        label="Select date of birth"
        birthdatePicker
        value={dateOfBirth || undefined}
        minDate={`${new Date().getFullYear() - 100}-01-01`}
        maxDate={todayYmdLocal()}
        onSelect={(v) => setDateOfBirth(v)}
        onClose={() => setPickDobOpen(false)}
      />
    </StackScreen>
  );
}

