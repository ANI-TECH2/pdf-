import { Tabs } from "expo-router"
import { View, Text, StyleSheet, Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ResultModal } from "@/component/ResultModal"

const TAB_BAR_HEIGHT = 56

function TabIcon({
  emoji,
  label,
  focused,
}: {
  emoji: string
  label: string
  focused: boolean
}) {
  return (
    <View style={styles.tabItem}>
      <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
        <Text style={styles.icon}>{emoji}</Text>
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
    </View>
  )
}

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const bottomInset = Platform.OS === "android" ? Math.max(insets.bottom, 0) : insets.bottom

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: [
            styles.tabBar,
            { height: TAB_BAR_HEIGHT + bottomInset, paddingBottom: bottomInset },
          ],
        }}
      >
        <Tabs.Screen
          name="imageToPdf"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="📄" label="PDF Reader" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="📷" label="Scan" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="paste"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="📝" label="Paste" focused={focused} />
            ),
          }}
        />
      </Tabs>

      {/* ResultModal outside Tabs but inside the root — overlays everything */}
      <ResultModal />
    </>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#111",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    elevation: 0,
    shadowOpacity: 0,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },

  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  iconWrapper: {
    width: 44,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  iconWrapperActive: {
    backgroundColor: "rgba(77,163,255,0.15)",
  },

  icon: { fontSize: 22 },

  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: "#4DA3FF",
  },
})