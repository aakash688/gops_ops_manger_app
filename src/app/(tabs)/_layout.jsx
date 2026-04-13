import { Tabs } from "expo-router";
import {
  Home,
  Building2,
  MapPin,
  List,
  User,
} from "lucide-react-native";

const ROUTE_ICONS = {
  "dashboard/index": Home,
  "clients/index": Building2,
  "attendance/index": MapPin,
  "activities/index": List,
  "profile/index": User,
};

const ROUTE_TITLES = {
  "dashboard/index": "Home",
  "clients/index": "Clients",
  "attendance/index": "Attendance",
  "activities/index": "Activities",
  "profile/index": "Profile",
};

const iconSize = 24;

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="dashboard/index"
      screenOptions={({ route }) => {
        const Icon = ROUTE_ICONS[route.name] || Home;
        return {
          headerShown: false,
          title: ROUTE_TITLES[route.name] ?? route.name,
          tabBarActiveTintColor: "#000000",
          tabBarInactiveTintColor: "#8E8E93",
          tabBarIcon: ({ color }) => (
            <Icon size={iconSize} color={color} strokeWidth={2} />
          ),
        };
      }}
    />
  );
}
