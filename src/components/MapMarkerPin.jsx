import { View, Text, StyleSheet } from "react-native";
import { Building2, Navigation, UserRound } from "lucide-react-native";

const TYPE_ICON = {
  client: Building2,
  guard: UserRound,
  playback: Navigation,
};

export default function MapMarkerPin({
  color = "#1A73E8",
  selected = false,
  type = "client",
  label,
  compact = false,
}) {
  const Icon = TYPE_ICON[type] || Building2;
  const pinSize = compact ? 36 : 42;
  const innerSize = compact ? 22 : 26;

  return (
    <View style={[styles.wrap, selected && styles.wrapSelected]}>
      <View style={[styles.shadow, { width: pinSize, height: pinSize + 12 }]}>
        <View
          style={[
            styles.tip,
            {
              top: pinSize - 10,
              backgroundColor: color,
              borderColor: "#FFFFFF",
            },
          ]}
        />
        <View
          style={[
            styles.head,
            {
              width: pinSize,
              height: pinSize,
              borderRadius: pinSize / 2,
              backgroundColor: color,
            },
          ]}
        >
          <View style={[styles.iconDisc, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
            <Icon size={compact ? 14 : 16} color={color} strokeWidth={2.6} />
          </View>
        </View>
      </View>
      {label ? (
        <View style={styles.labelPill}>
          <Text style={styles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  wrapSelected: {
    transform: [{ scale: 1.12 }],
  },
  shadow: {
    alignItems: "center",
    shadowColor: "#1F2937",
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  head: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    zIndex: 2,
  },
  tip: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    transform: [{ rotate: "45deg" }],
    zIndex: 1,
  },
  iconDisc: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  labelPill: {
    position: "absolute",
    bottom: 54,
    maxWidth: 118,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.94)",
    shadowColor: "#1F2937",
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  labelText: {
    color: "#202124",
    fontSize: 11,
    fontWeight: "700",
  },
});
