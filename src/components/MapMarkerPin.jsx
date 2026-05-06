import { View, Text, StyleSheet } from "react-native";
import { Building2, Navigation, UserRound } from "lucide-react-native";
import { initialsFromName } from "@/utils/mapMarkerPhoto";

const TYPE_ICON = {
  client: Building2,
  guard: UserRound,
  playback: Navigation,
};

/**
 * MapLibre rasterizes PointAnnotation children; keep subtree tiny and stable:
 * **Do not use Text** inside PointAnnotation on Android (maplibre-react-native glitches / blank map).
 * Use view-only shapes; full names stay in parent UI (cards below / over the map).
 */
export default function MapMarkerPin({
  color = "#1A73E8",
  selected = false,
  type = "client",
  label,
  compact = false,
  forMapLibre = false,
  name = null,
}) {
  const Icon = TYPE_ICON[type] || Building2;
  const pinSize = compact ? 36 : 42;
  const innerSize = compact ? 22 : 26;

  const initials = initialsFromName(name);
  const guardInitials = initials !== "?" ? initials : "·";

  if (forMapLibre) {
    const outer = compact ? 36 : 40;
    const ringColor = selected ? "#F9AB00" : "#FFFFFF";
    return (
      <View style={[styles.mlRootPlain, { width: outer + 8, height: outer + 8 }]} collapsable={false}>
        <View
          style={[
            styles.mlDiscPlainOuter,
            {
              width: outer,
              height: outer,
              borderRadius: outer / 2,
              backgroundColor: color,
              borderColor: ringColor,
            },
          ]}
          collapsable={false}
        >
          {type === "client" ? (
            <View style={styles.mlClientMark} collapsable={false} />
          ) : (
            <View style={styles.mlGuardMark} collapsable={false} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, selected && styles.wrapSelected]} collapsable={false}>
      <View style={[styles.shadow, { width: pinSize, height: pinSize + 12 }]} collapsable={false}>
        <View
          style={[
            styles.tip,
            {
              top: pinSize - 10,
              backgroundColor: color,
              borderColor: "#FFFFFF",
            },
          ]}
          collapsable={false}
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
          collapsable={false}
        >
          <View
            style={[
              styles.iconDisc,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize / 2,
                overflow: "hidden",
                backgroundColor: "#FFFFFF",
              },
            ]}
            collapsable={false}
          >
            <Icon size={compact ? 14 : 16} color={color} strokeWidth={2.6} />
          </View>
        </View>
      </View>
      {label ? (
        <View style={styles.namePopup} collapsable={false}>
          <Text style={styles.namePopupText} numberOfLines={4}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mlRootPlain: {
    alignItems: "center",
    justifyContent: "center",
  },
  mlDiscPlainOuter: {
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  /** Square mark = site/client (no Text — Android PointAnnotation safe). */
  mlClientMark: {
    width: 11,
    height: 11,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  /** Round mark = team/guard. */
  mlGuardMark: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },
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
  namePopup: {
    position: "absolute",
    bottom: 56,
    maxWidth: 280,
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  namePopupText: {
    color: "#202124",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
  },
  initials: {
    fontWeight: "800",
    textAlign: "center",
    includeFontPadding: false,
  },
});
