import { useEffect, useRef, useState } from "react";
import { AppState, Platform, BackHandler, Alert } from "react-native";
import * as Battery from "expo-battery";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "@/utils/auth/store";
import {
  resumeLiveTrackingIfNeeded,
  flushPingQueue,
  flushComplianceQueue,
  syncLiveTrackingWithFieldSession,
  syncNativeTrackingState,
  getLiveTrackingHealth,
  openBatteryOptimizationSettings,
  getSessionId,
} from "@/services/liveTracking";
import LiveTrackingComplianceOverlay from "@/components/LiveTrackingComplianceOverlay";
import BatteryOptimizationGate from "@/components/BatteryOptimizationGate";

/** Field check-in drives live tracking; syncs with server on launch/resume, flushes pings, optional kiosk. */
export default function LiveTrackingSessionSync({ children }) {
  const jwt = useAuthStore((s) => s.auth?.jwt);
  const batteryTipShown = useRef(false);
  const notificationPermissionAsked = useRef(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [batteryUnrestricted, setBatteryUnrestricted] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web" || !jwt) {
      setTrackingActive(false);
      return undefined;
    }

    const refreshTrackingFlag = async () => {
      setTrackingActive(!!(await getSessionId()));
    };

    const runSyncAndFlush = () => {
      syncLiveTrackingWithFieldSession()
        .catch(() => {})
        .finally(() => {
          refreshTrackingFlag();
          resumeLiveTrackingIfNeeded()
            .then(() => syncNativeTrackingState())
            .catch(() => {});
          flushPingQueue().catch(() => {});
        });
    };

    runSyncAndFlush();

    const interval = setInterval(() => {
      flushPingQueue().catch(() => {});
      flushComplianceQueue().catch(() => {});
    }, 45_000);

    const pollFlag = setInterval(() => {
      refreshTrackingFlag();
    }, 4000);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        runSyncAndFlush();
        getLiveTrackingHealth()
          .then((h) => {
            if (h) setBatteryUnrestricted(h.batteryOptimizationIgnored !== false);
          })
          .catch(() => {});
      }
    });

    return () => {
      clearInterval(interval);
      clearInterval(pollFlag);
      sub.remove();
    };
  }, [jwt]);

  useEffect(() => {
    if (Platform.OS === "web" || !jwt) return undefined;

    (async () => {
      try {
        const available = await Battery.isAvailableAsync();
        if (!available || batteryTipShown.current) return;
        const st = await Battery.getPowerStateAsync();
        if (st.lowPowerMode) {
          batteryTipShown.current = true;
          Alert.alert(
            "Battery saving active",
            "Low Power Mode can delay GPS and background updates. For reliable live tracking, turn it off or allow unrestricted battery usage for this app in system settings.",
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, [jwt]);

  useEffect(() => {
    if (Platform.OS !== "android" || !jwt || !trackingActive) return undefined;

    let cancelled = false;
    const ensureNativeReadiness = async () => {
      try {
        const health = await getLiveTrackingHealth();
        if (cancelled) return;

        if (!health?.notificationGranted && !notificationPermissionAsked.current) {
          notificationPermissionAsked.current = true;
          await Notifications.requestPermissionsAsync().catch(() => {});
        }

        if (health) {
          setBatteryUnrestricted(health.batteryOptimizationIgnored !== false);
        }
      } catch {
        /* ignore */
      }
    };

    ensureNativeReadiness();
    const id = setInterval(ensureNativeReadiness, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jwt, trackingActive]);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    if (process.env.EXPO_PUBLIC_KIOSK_MODE !== "1" || !jwt) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [jwt]);

  const showBatteryGate =
    Platform.OS === "android" && !!jwt && trackingActive && !batteryUnrestricted;

  return (
    <>
      {children}
      <BatteryOptimizationGate
        visible={showBatteryGate}
        onOpenSettings={() => openBatteryOptimizationSettings().catch(() => {})}
      />
      {jwt && Platform.OS !== "web" ? (
        <LiveTrackingComplianceOverlay trackingActive={trackingActive && !showBatteryGate} />
      ) : null}
    </>
  );
}
