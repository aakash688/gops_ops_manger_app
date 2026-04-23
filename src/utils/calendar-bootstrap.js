/**
 * react-native-calendars calls getLocale().dayNamesShort on Calendar mount.
 * If XDate.defaultLocale points at a missing key (or a duplicate xdate copy from Metro), that throws.
 * Import this once from the root layout (side effect only).
 */
import XDate from "xdate";

function patch(X) {
  if (!X?.locales) return;
  if (!X.locales[X.defaultLocale]) {
    X.defaultLocale = "";
  }
}

patch(XDate);
try {
  const XR = require("xdate");
  if (XR && XR !== XDate) patch(XR);
} catch {
  /* ignore */
}
