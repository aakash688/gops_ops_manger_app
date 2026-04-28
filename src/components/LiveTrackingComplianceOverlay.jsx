import { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Platform,
  AppState,
  Vibration,
  BackHandler,
} from "react-native";
import * as Location from "expo-location";
import NetInfo from "@react-native-community/netinfo";
import { Audio } from "expo-av";
import { reportComplianceEvent } from "@/services/liveTracking";
import { ensureLocalSirenUri } from "@/services/liveTracking/sirenCache";

/**
 * Full-screen alert + looping audio/vibration when tracking cannot run (spec: siren until resolved).
 * Only enforced while a live tracking session is active (field check-in open).
 */
export default function LiveTrackingComplianceOverlay({ trackingActive }) {
  const [breach, setBreach] = useState(null);
  const soundRef = useRef(null);
  const vibTimerRef = useRef(null);
  const candidateRef = useRef({ type: null, since: 0 });
  const reportedRef = useRef({ perm: false, gps: false, network: false });

  useEffect(() => {
    if (Platform.OS === "web" || !trackingActive) {
      setBreach(null);
      candidateRef.current = { type: null, since: 0 };
      return undefined;
    }

    let cancelled = false;

    const evaluate = async () => {
      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        if (cancelled) return;
        // Permission revoked → no grace (must fix immediately)
        candidateRef.current = { type: "perm", since: Date.now() };
        setBreach("perm");
        if (!reportedRef.current.perm) {
          reportedRef.current.perm = true;
          reportComplianceEvent({ type: "PERMISSION_REVOKED", status: "START", severity: "CRITICAL" }).catch(() => {});
        }
        return;
      }
      const servicesOk = await Location.hasServicesEnabledAsync();
      if (!servicesOk) {
        if (cancelled) return;
        const now = Date.now();
        const graceMs = 10_000; // GPS off: short 10-second grace before siren
        if (candidateRef.current.type !== "gps") {
          candidateRef.current = { type: "gps", since: now };
          setBreach(null);
          return;
        }
        if (now - candidateRef.current.since >= graceMs) {
          setBreach("gps");
          if (!reportedRef.current.gps) {
            reportedRef.current.gps = true;
            reportComplianceEvent({ type: "GPS_OFF", status: "START", severity: "CRITICAL" }).catch(() => {});
          }
        }
        return;
      }
      const net = await NetInfo.fetch();
      if (net.isConnected === false) {
        if (cancelled) return;
        const now = Date.now();
        const graceMs = 45_000; // Network offline: 45-second grace (short, but allows brief drops)
        if (candidateRef.current.type !== "network") {
          candidateRef.current = { type: "network", since: now };
          setBreach(null);
          return;
        }
        if (now - candidateRef.current.since >= graceMs) {
          setBreach("network");
          if (!reportedRef.current.network) {
            reportedRef.current.network = true;
            reportComplianceEvent({ type: "NETWORK_OFFLINE", status: "START", severity: "WARN" }).catch(() => {});
          }
        }
        return;
      }
      if (!cancelled) {
        candidateRef.current = { type: null, since: 0 };
        setBreach(null);
        if (reportedRef.current.perm) {
          reportedRef.current.perm = false;
          reportComplianceEvent({ type: "PERMISSION_REVOKED", status: "END" }).catch(() => {});
        }
        if (reportedRef.current.gps) {
          reportedRef.current.gps = false;
          reportComplianceEvent({ type: "GPS_OFF", status: "END" }).catch(() => {});
        }
        if (reportedRef.current.network) {
          reportedRef.current.network = false;
          reportComplianceEvent({ type: "NETWORK_OFFLINE", status: "END" }).catch(() => {});
        }
      }
    };

    evaluate();
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") evaluate();
    });
    const netUnsub = NetInfo.addEventListener(() => evaluate());
    const poll = setInterval(evaluate, 4000);

    return () => {
      cancelled = true;
      appSub.remove();
      netUnsub();
      clearInterval(poll);
    };
  }, [trackingActive]);

  useEffect(() => {
    if (Platform.OS === "web" || !trackingActive) return undefined;
    if (!breach) {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      if (vibTimerRef.current) {
        clearInterval(vibTimerRef.current);
        vibTimerRef.current = null;
      }
      Vibration.cancel();
      return undefined;
    }

    vibTimerRef.current = setInterval(() => {
      Vibration.vibrate(500);
    }, 700);

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });
        const uri = await ensureLocalSirenUri();
        const { sound } = await Audio.Sound.createAsync(
          {
            uri: uri || "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg",
          },
          { isLooping: true, volume: 1 },
        );
        soundRef.current = sound;
        await sound.playAsync();
      } catch {
        /* vibration only */
      }
    })();

    const backSub = BackHandler.addEventListener("hardwareBackPress", () => true);

    return () => {
      backSub.remove();
      if (vibTimerRef.current) {
        clearInterval(vibTimerRef.current);
        vibTimerRef.current = null;
      }
      Vibration.cancel();
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [breach, trackingActive]);

  if (Platform.OS === "web" || !trackingActive || !breach) return null;

  const lines =
    breach === "perm"
      ? "Location permission was revoked. Open system settings and allow location for this app (including “Always” / background if prompted)."
      : breach === "gps"
        ? "Location services are turned off. Enable GPS/location in device settings."
        : "No network connection. Turn on Wi‑Fi or mobile data so tracking can sync.";

  return (
    <Modal
      visible
      animationType="fade"
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={() => {}}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#1a0505",
          justifyContent: "center",
          paddingHorizontal: 28,
        }}
      >
        <Text
          style={{
            color: "#ff4444",
            fontSize: 22,
            fontWeight: "900",
            textAlign: "center",
            marginBottom: 16,
            letterSpacing: 0.5,
          }}
        >
          Tracking disabled
        </Text>
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            textAlign: "center",
            lineHeight: 24,
            fontWeight: "600",
          }}
        >
          Please enable GPS/Data.
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 15,
            textAlign: "center",
            lineHeight: 22,
            marginTop: 20,
          }}
        >
          {lines}
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            textAlign: "center",
            marginTop: 28,
            lineHeight: 18,
          }}
        >
          This alert clears automatically when the issue is fixed. Audio and vibration stop only after
          tracking can resume.
        </Text>
      </View>
    </Modal>
  );
}
