import {
  TouchableOpacity,
  View,
  Text,
  Animated,
  Pressable,
} from "react-native";
import { useState, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Plus, QrCode, AlertCircle, DollarSign } from "lucide-react-native";
import { useRouter } from "expo-router";

export default function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      friction: 6,
    }).start();
    setIsOpen(!isOpen);
  };

  const scanRotate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-60deg"],
  });

  const penaltyRotate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-120deg"],
  });

  const relieverRotate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-180deg"],
  });

  const scanTranslate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -70],
  });

  const penaltyTranslate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -130],
  });

  const relieverTranslate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -190],
  });

  const opacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleScanQR = () => {
    toggleMenu();
    router.push("/scanner");
  };

  const handleAddPenalty = () => {
    toggleMenu();
    router.push("/penalty/add");
  };

  const handleReliever = () => {
    toggleMenu();
    router.push("/reliever/create");
  };

  return (
    <View
      style={{ position: "absolute", right: 20, bottom: insets.bottom + 80 }}
    >
      {/* Scan QR Button */}
      <Animated.View
        style={{
          position: "absolute",
          right: 0,
          opacity,
          transform: [{ translateY: scanTranslate }],
        }}
      >
        <Pressable
          onPress={handleScanQR}
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <GlassView
            isInteractive={true}
            style={[
              {
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.9, backgroundColor: "#ffffff" },
            ]}
          >
            <QrCode size={24} color="#000000" />
          </GlassView>
        </Pressable>
      </Animated.View>

      {/* Add Penalty Button */}
      <Animated.View
        style={{
          position: "absolute",
          right: 0,
          opacity,
          transform: [{ translateY: penaltyTranslate }],
        }}
      >
        <Pressable
          onPress={handleAddPenalty}
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <GlassView
            isInteractive={true}
            style={[
              {
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.9, backgroundColor: "#ffffff" },
            ]}
          >
            <DollarSign size={24} color="#000000" />
          </GlassView>
        </Pressable>
      </Animated.View>

      {/* Request Reliever Button */}
      <Animated.View
        style={{
          position: "absolute",
          right: 0,
          opacity,
          transform: [{ translateY: relieverTranslate }],
        }}
      >
        <Pressable
          onPress={handleReliever}
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <GlassView
            isInteractive={true}
            style={[
              {
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.9, backgroundColor: "#ffffff" },
            ]}
          >
            <AlertCircle size={24} color="#000000" />
          </GlassView>
        </Pressable>
      </Animated.View>

      {/* Main FAB */}
      <Pressable
        onPress={toggleMenu}
        style={({ pressed }) => ({
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}
      >
        <GlassView
          isInteractive={true}
          style={[
            {
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            },
            isLiquidGlassAvailable()
              ? {}
              : { opacity: 0.9, backgroundColor: "#007AFF" },
          ]}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "45deg"],
                  }),
                },
              ],
            }}
          >
            <Plus
              size={32}
              color={isLiquidGlassAvailable() ? "#000000" : "#FFFFFF"}
            />
          </Animated.View>
        </GlassView>
      </Pressable>
    </View>
  );
}
