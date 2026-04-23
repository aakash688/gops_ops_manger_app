import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useRouter } from "expo-router";
import { X, Flashlight, FlashlightOff } from "lucide-react-native";

export default function Scanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 40,
        }}
      >
        <StatusBar style="light" />
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: "#FFF",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Camera access is required to scan QR codes
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{
            backgroundColor: "#007AFF",
            paddingHorizontal: 32,
            paddingVertical: 14,
            borderRadius: 12,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFF" }}>
            Grant Permission
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);

    try {
      // Mode: field check-in site QR (return token back to /remote-checkin)
      if (params?.mode === "field-checkin") {
        router.replace({ pathname: "/remote-checkin", params: { qrToken: String(data) } });
        return;
      }

      // Default: legacy employee QR flow (kept as-is)
      const response = await fetch(`/api/qr/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrData: data }),
      });

      if (!response.ok) throw new Error("Invalid QR code");

      const employee = await response.json();
      router.push(`/employee/${employee.id}`);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Invalid QR code. Please try again.", [
        { text: "OK", onPress: () => setScanned(false) },
      ]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          zIndex: 10,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <X size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "600", color: "#FFF" }}>
          Scan QR Code
        </Text>
        <TouchableOpacity
          onPress={() => setTorchOn(!torchOn)}
          style={{ padding: 8 }}
        >
          {torchOn ? (
            <FlashlightOff size={24} color="#FFF" />
          ) : (
            <Flashlight size={24} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Camera */}
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torchOn}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      >
        {/* Scanning Frame */}
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <View
            style={{
              width: 250,
              height: 250,
              borderWidth: 3,
              borderColor: "#FFF",
              borderRadius: 20,
              backgroundColor: "transparent",
            }}
          />
          <Text
            style={{
              fontSize: 16,
              color: "#FFF",
              marginTop: 24,
              textAlign: "center",
            }}
          >
            Position QR code within the frame
          </Text>
        </View>
      </CameraView>
    </View>
  );
}
