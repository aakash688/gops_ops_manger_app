import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ArrowLeft, Camera, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import ClientPickerModal from "@/components/ClientPickerModal";
import { apiPostJson } from "@/utils/api";

export default function CreateTicket() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [client, setClient] = useState(null);
  const [priority, setPriority] = useState("MEDIUM");
  const [images, setImages] = useState([]); // local assets (uri)
  const [loading, setLoading] = useState(false);
  const [pickingClient, setPickingClient] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const next = result.assets
        .map((a) => ({
          uri: a.uri,
          type: a.mimeType || "image/jpeg",
          name: a.fileName || `ticket-${Date.now()}.jpg`,
        }))
        .filter((x) => !!x.uri);
      setImages([...images, ...next]);
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || !description || !client?.id) {
      Alert.alert("Error", "Please fill all required fields (Client, Title, Description)");
      return;
    }

    setLoading(true);
    try {
      // Backend supports an optional single image upload via multipart.
      // For now we create ticket as JSON (works even without image); image support can be added with a dedicated endpoint.
      await apiPostJson("/tickets", {
        clientId: client.id,
        title,
        description,
        societyName: client?.clientName ?? null,
        priority,
      });

      Alert.alert("Success", "Ticket created successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create ticket. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: "#F5F5F7" }}
      behavior="padding"
    >
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 16 }}
        >
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000" }}>
          Create Ticket
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Title *
          </Text>
          <GlassView
            style={[
              {
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 12,
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <TextInput
              placeholder="Brief description of the issue"
              value={title}
              onChangeText={setTitle}
              style={{ fontSize: 16, color: "#000" }}
              placeholderTextColor="#999"
            />
          </GlassView>
        </View>

        {/* Client/Site */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Client / Site *
          </Text>
          <GlassView
            style={[
              {
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 12,
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <TouchableOpacity onPress={() => setPickingClient(true)}>
              <Text style={{ fontSize: 16, color: client ? "#000" : "#999" }}>
                {client ? client.clientName : "Select client"}
              </Text>
            </TouchableOpacity>
          </GlassView>
        </View>

        {/* Priority */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Priority
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPriority(p)}
                style={{ flex: 1 }}
              >
                <GlassView
                  isInteractive={true}
                  style={[
                    {
                      padding: 12,
                      borderRadius: 12,
                      alignItems: "center",
                      overflow: "hidden",
                    },
                    isLiquidGlassAvailable()
                      ? priority === p
                        ? { backgroundColor: "rgba(0, 122, 255, 0.2)" }
                        : {}
                      : {
                          opacity: 0.95,
                          backgroundColor:
                            priority === p ? "#007AFF" : "#ffffff",
                        },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color:
                        priority === p
                          ? isLiquidGlassAvailable()
                            ? "#007AFF"
                            : "#FFF"
                          : "#000",
                    }}
                  >
                    {p}
                  </Text>
                </GlassView>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Description *
          </Text>
          <GlassView
            style={[
              {
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 12,
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <TextInput
              placeholder="Detailed description of the issue"
              value={description}
              onChangeText={setDescription}
              style={{ fontSize: 16, color: "#000" }}
              placeholderTextColor="#999"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </GlassView>
        </View>

        {/* Images */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#000",
              marginBottom: 8,
            }}
          >
            Attachments
          </Text>
          <TouchableOpacity onPress={pickImage}>
            <GlassView
              isInteractive={true}
              style={[
                {
                  padding: 20,
                  borderRadius: 12,
                  alignItems: "center",
                  overflow: "hidden",
                },
                isLiquidGlassAvailable()
                  ? {}
                  : { opacity: 0.95, backgroundColor: "#ffffff" },
              ]}
            >
              <Camera size={32} color="#007AFF" />
              <Text style={{ fontSize: 14, color: "#007AFF", marginTop: 8 }}>
                Add Photos (optional)
              </Text>
            </GlassView>
          </TouchableOpacity>

          {images.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 12,
              }}
            >
              {images.map((img, index) => (
                <View
                  key={index}
                  style={{ position: "relative", width: 100, height: 100 }}
                >
                  <Image
                    source={{ uri: img.uri }}
                    style={{ width: 100, height: 100, borderRadius: 8 }}
                  />
                  <TouchableOpacity
                    onPress={() => removeImage(index)}
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      backgroundColor: "#FF3B30",
                      borderRadius: 12,
                      padding: 4,
                    }}
                  >
                    <X size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={{
            opacity: loading ? 0.6 : 1,
          }}
        >
          <GlassView
            isInteractive={true}
            style={[
              {
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#007AFF" },
            ]}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: "600",
                color: isLiquidGlassAvailable() ? "#000" : "#FFF",
              }}
            >
              {loading ? "Creating..." : "Create Ticket"}
            </Text>
          </GlassView>
        </TouchableOpacity>
      </ScrollView>

      <ClientPickerModal
        visible={pickingClient}
        onClose={() => setPickingClient(false)}
        onSelect={(c) => {
          setClient(c);
          setPickingClient(false);
        }}
        title="Select client"
        subtitle="Ticket will be raised for this site"
      />
    </KeyboardAvoidingAnimatedView>
  );
}
