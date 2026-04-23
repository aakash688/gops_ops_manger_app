/**
 * Unified date picker — calendar modal + optional field row.
 * Props follow: value (YYYY-MM-DD), onChange(dateString), optional minDate / maxDate.
 */
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Platform,
  StyleSheet,
  ScrollView,
} from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Calendar as CalendarIcon, X, ChevronDown } from "lucide-react-native";
import { useState, useEffect, useMemo } from "react";
import { Calendar } from "react-native-calendars";

const ACCENT = "#007AFF";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function todayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function subtractYears(ymd, years) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setFullYear(dt.getFullYear() - years);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Clamp YYYY-MM-01 string to fall within [minDate, maxDate] month range (ISO compare). */
function clampMonthCursor(cursorMonth01, minDate, maxDate) {
  const ym = cursorMonth01.slice(0, 7);
  const minYm = minDate.slice(0, 7);
  const maxYm = maxDate.slice(0, 7);
  if (ym < minYm) return `${minYm}-01`;
  if (ym > maxYm) return `${maxYm}-01`;
  return cursorMonth01.length === 10 ? cursorMonth01 : `${ym}-01`;
}

export function formatDisplayDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const calendarTheme = {
  todayTextColor: ACCENT,
  arrowColor: ACCENT,
  textDayFontSize: 15,
  textMonthFontSize: 16,
  textDayHeaderFontSize: 13,
  textDayFontWeight: "500",
  textMonthFontWeight: "700",
  "stylesheet.calendar.header": {
    dayTextAtIndex0: { color: "#C62828" },
    dayTextAtIndex6: { color: "#C62828" },
  },
};

/**
 * Modal-only picker (used when parent owns the trigger, e.g. roster PickerRow).
 *
 * `birthdatePicker`: adds Year / Month jump controls so decades-old DOB is reachable without swiping months.
 */
export function DatePickerModal({
  visible,
  label = "Select date",
  value,
  minDate,
  maxDate,
  birthdatePicker = false,
  onSelect,
  onClose,
}) {
  const effectiveMax = birthdatePicker ? (maxDate ?? todayYmdLocal()) : maxDate;
  const effectiveMin = birthdatePicker ? (minDate ?? subtractYears(effectiveMax ?? todayYmdLocal(), 100)) : minDate;

  const [cursorMonth, setCursorMonth] = useState(`${(effectiveMax ?? todayYmdLocal()).slice(0, 7)}-01`);
  const [yearListOpen, setYearListOpen] = useState(false);
  const [monthListOpen, setMonthListOpen] = useState(false);

  const yearOptions = useMemo(() => {
    if (!effectiveMin || !effectiveMax) return [];
    const yMin = parseInt(effectiveMin.slice(0, 4), 10);
    const yMax = parseInt(effectiveMax.slice(0, 4), 10);
    const list = [];
    for (let y = yMax; y >= yMin; y--) list.push(y);
    return list;
  }, [effectiveMin, effectiveMax]);

  useEffect(() => {
    if (!visible || !birthdatePicker || !effectiveMin || !effectiveMax) return;
    let seed = value?.trim();
    if (!seed || seed < effectiveMin || seed > effectiveMax) {
      seed = subtractYears(effectiveMax, 25);
    }
    const cm = clampMonthCursor(`${seed.slice(0, 7)}-01`, effectiveMin, effectiveMax);
    setCursorMonth(cm);
  }, [visible, birthdatePicker, value, effectiveMin, effectiveMax]);

  const cursorY = parseInt(cursorMonth.slice(0, 4), 10);
  const cursorM = parseInt(cursorMonth.slice(5, 7), 10);

  const setYear = (year) => {
    if (!effectiveMin || !effectiveMax) return;
    const nextMonth = clampMonthCursor(
      `${year}-${String(cursorM).padStart(2, "0")}-01`,
      effectiveMin,
      effectiveMax,
    );
    setCursorMonth(nextMonth);
    setYearListOpen(false);
  };

  const setMonth = (month1to12) => {
    if (!effectiveMin || !effectiveMax) return;
    const nextMonth = clampMonthCursor(
      `${cursorY}-${String(month1to12).padStart(2, "0")}-01`,
      effectiveMin,
      effectiveMax,
    );
    setCursorMonth(nextMonth);
    setMonthListOpen(false);
  };

  const calendarCurrent = birthdatePicker ? cursorMonth : value || undefined;
  const calendarMin = birthdatePicker ? effectiveMin ?? undefined : minDate ?? undefined;
  const calendarMax = birthdatePicker ? effectiveMax ?? undefined : maxDate ?? undefined;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={[styles.sheet, birthdatePicker && styles.sheetTall]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <X size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {visible && birthdatePicker ? (
              <View style={styles.jumpRow}>
                <TouchableOpacity
                  style={styles.jumpChip}
                  onPress={() => setYearListOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.jumpChipLabel}>Year</Text>
                  <Text style={styles.jumpChipValue}>{cursorY}</Text>
                  <ChevronDown size={16} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.jumpChip}
                  onPress={() => setMonthListOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.jumpChipLabel}>Month</Text>
                  <Text style={styles.jumpChipValue}>{MONTH_SHORT[cursorM - 1]}</Text>
                  <ChevronDown size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            ) : null}

            {visible ? (
              <Calendar
                key={birthdatePicker ? `${cursorMonth}-${effectiveMin}-${effectiveMax}` : "cal"}
                current={calendarCurrent || undefined}
                minDate={calendarMin}
                maxDate={calendarMax}
                markedDates={
                  value ? { [value]: { selected: true, selectedColor: ACCENT } } : {}
                }
                onDayPress={(day) => {
                  const ds = day?.dateString;
                  if (!ds) return;
                  const lo = calendarMin;
                  const hi = calendarMax;
                  if (lo && ds < lo) return;
                  if (hi && ds > hi) return;
                  onSelect(ds);
                  onClose();
                }}
                theme={calendarTheme}
              />
            ) : null}
            <View style={{ height: 16 }} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={yearListOpen} transparent animationType="fade" onRequestClose={() => setYearListOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setYearListOpen(false)}>
          <Pressable style={styles.subSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.subSheetTitle}>Select year</Text>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {yearOptions.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearRow, y === cursorY && styles.yearRowSelected]}
                  onPress={() => setYear(y)}
                >
                  <Text style={[styles.yearRowText, y === cursorY && styles.yearRowTextSelected]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.subCloseBtn} onPress={() => setYearListOpen(false)}>
              <Text style={styles.subCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={monthListOpen} transparent animationType="fade" onRequestClose={() => setMonthListOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMonthListOpen(false)}>
          <Pressable style={styles.subSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.subSheetTitle}>Select month</Text>
            <View style={styles.monthGrid}>
              {MONTH_SHORT.map((name, idx) => {
                const m = idx + 1;
                const ymCandidate = `${cursorY}-${String(m).padStart(2, "0")}`;
                const minYm = (effectiveMin ?? "").slice(0, 7);
                const maxYm = (effectiveMax ?? "").slice(0, 7);
                const disabled = ymCandidate < minYm || ymCandidate > maxYm;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.monthCell,
                      m === cursorM && styles.monthCellSelected,
                      disabled && styles.monthCellDisabled,
                    ]}
                    disabled={disabled}
                    onPress={() => setMonth(m)}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        m === cursorM && styles.monthCellTextSelected,
                        disabled && styles.monthCellTextDisabled,
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.subCloseBtn} onPress={() => setMonthListOpen(false)}>
              <Text style={styles.subCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * Full row + modal (employee forms, leave create, reliever dates).
 */
export function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  birthdatePicker = false,
  placeholder = "Select date",
  disabled = false,
  marginBottom = 16,
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity activeOpacity={0.7} onPress={() => !disabled && setOpen(true)} disabled={disabled}>
        <GlassView
          style={[
            styles.fieldRow,
            isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
          ]}
        >
          <Text style={[styles.fieldValue, !value && styles.placeholder]}>
            {value ? formatDisplayDate(value) : placeholder}
          </Text>
          <CalendarIcon size={20} color="#8E8E93" />
        </GlassView>
      </TouchableOpacity>

      <DatePickerModal
        visible={open}
        label={label}
        value={value}
        minDate={minDate}
        maxDate={maxDate}
        birthdatePicker={birthdatePicker}
        onSelect={(ds) => {
          onChange(ds);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    width: "90%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 12 },
    }),
  },
  sheetTall: {
    maxHeight: "92%",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  jumpRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    justifyContent: "space-between",
  },
  jumpChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.18)",
  },
  jumpChipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
  },
  jumpChipValue: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  subSheet: {
    width: "88%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    maxHeight: "70%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  subSheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
    color: "#000",
  },
  yearRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.12)",
  },
  yearRowSelected: {
    backgroundColor: "rgba(0,122,255,0.12)",
  },
  yearRowText: {
    fontSize: 18,
    color: "#000",
    textAlign: "center",
  },
  yearRowTextSelected: {
    fontWeight: "700",
    color: ACCENT,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  monthCell: {
    width: "22%",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  monthCellSelected: {
    backgroundColor: ACCENT,
  },
  monthCellDisabled: {
    opacity: 0.35,
  },
  monthCellText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  monthCellTextSelected: {
    color: "#fff",
  },
  monthCellTextDisabled: {
    color: "#8E8E93",
  },
  subCloseBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  subCloseBtnText: {
    fontSize: 17,
    color: ACCENT,
    fontWeight: "600",
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldValue: {
    fontSize: 16,
    color: "#000",
    flex: 1,
  },
  placeholder: {
    color: "#999",
  },
});
