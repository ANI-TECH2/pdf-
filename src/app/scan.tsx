import { azureReadOcrFromImageUri } from "@/services/azureOcr"
import { canScan, getScansLeft, recordScan } from "@/services/scanLimit"
import { useScanStore } from "@/store/scanStore"
import { CameraType, CameraView, useCameraPermissions } from "expo-camera"
import * as ImageManipulator from "expo-image-manipulator"
import { useEffect, useRef, useState } from "react"
import {
  ActivityIndicator, Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

export default function ScanTab() {
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>("back")
  const [scansLeft, setScansLeft] = useState<number | null>(null)
  const [limitReached, setLimitReached] = useState(false)

  const cameraRef = useRef<CameraView>(null)
  const { scanState, capturedUri, setScanState, setCapturedUri, setModalVisible } = useScanStore()

  useEffect(() => {
    getScansLeft().then(setScansLeft)
  }, [])

  if (!permission?.granted) {
    return (
      <SafeAreaView edges={["top"]} style={styles.permBox}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permText}>Camera permission required</Text>
        <Text style={styles.permHint}>
          Allow camera access to scan documents
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const handleScan = async () => {
    if (scanState.kind !== "idle") return

    const check = await canScan()
    if (!check.allowed) {
      setLimitReached(true)
      return
    }

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 })
      if (!photo?.uri) throw new Error("Failed to capture photo")

      setCapturedUri(photo.uri)
      setScanState({ kind: "scanning" })

      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      )

      const ocr = await azureReadOcrFromImageUri(manipulated.uri)

      if (!ocr.fullText || ocr.fullText.trim().length === 0) {
        setScanState({
          kind: "error",
          message: "No text detected. Try better lighting or hold steady.",
        })
        setModalVisible(true)
        return
      }

      await recordScan()
      setScansLeft((prev) => (prev !== null ? Math.max(0, prev - 1) : null))

      setScanState({ kind: "result", ocr })
      setModalVisible(true)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setScanState({ kind: "error", message })
      setModalVisible(true)
    }
  }

  return (
    <View style={styles.container}>
      {/* Camera or frozen frame */}
      {capturedUri && scanState.kind !== "idle" ? (
        <Image
          source={{ uri: capturedUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
        />
      )}

      {/* Scans left badge */}
      {scanState.kind === "idle" && scansLeft !== null && (
        <SafeAreaView edges={["top"]} style={styles.badgeWrapper} pointerEvents="none">
          <View style={[
            styles.scansBadge,
            scansLeft <= 2 && styles.scansBadgeWarning,
          ]}>
            <Text style={styles.scansBadgeText}>
              {scansLeft === 0
                ? "No scans left this month"
                : `${scansLeft} / 10 scans left`}
            </Text>
          </View>
        </SafeAreaView>
      )}

      {/* Scanning overlay */}
      {scanState.kind === "scanning" && (
        <View style={styles.scanningOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.scanningText}>Scanning…</Text>
        </View>
      )}

      {/* Limit reached overlay */}
      {limitReached && (
        <View style={styles.limitOverlay}>
          <View style={styles.limitCard}>
            <Text style={styles.limitIcon}>🚫</Text>
            <Text style={styles.limitTitle}>Monthly limit reached</Text>
            <Text style={styles.limitSubtitle}>
              You've used all 10 free scans this month.{"\n"}
              Resets on the 1st of next month.
            </Text>
            <TouchableOpacity
              style={styles.limitDismiss}
              onPress={() => setLimitReached(false)}
            >
              <Text style={styles.limitDismissText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Camera controls */}
      {scanState.kind === "idle" && !limitReached && (
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
          >
            <Text style={styles.flipBtnText}>🔄</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureBtn, scansLeft === 0 && styles.captureBtnDisabled]}
            onPress={handleScan}
            disabled={scansLeft === 0}
          >
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>

          <View style={{ width: 44 }} />
        </View>
      )}

      {/* Bottom spacer so controls sit above tab bar */}
      <View style={styles.bottomSpacer} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  permBox: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: "#0b0f14", padding: 32,
  },
  permIcon: { fontSize: 48, marginBottom: 16 },
  permText: {
    color: "#fff", fontSize: 18, fontWeight: "600",
    textAlign: "center", marginBottom: 8,
  },
  permHint: {
    color: "rgba(255,255,255,0.45)", fontSize: 14,
    textAlign: "center", marginBottom: 28, lineHeight: 20,
  },
  permBtn: {
    backgroundColor: "#378ADD", paddingHorizontal: 32,
    paddingVertical: 14, borderRadius: 12,
  },
  permBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },

  badgeWrapper: {
    position: "absolute", top: 0, left: 0, right: 0,
    alignItems: "center",
  },
  scansBadge: {
    marginTop: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  scansBadgeWarning: {
    borderColor: "rgba(226,75,74,0.5)",
    backgroundColor: "rgba(226,75,74,0.2)",
  },
  scansBadgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  scanningOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)", gap: 14,
  },
  scanningText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  limitOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center", alignItems: "center", padding: 32,
  },
  limitCard: {
    backgroundColor: "#1a1a1a", borderRadius: 20,
    padding: 28, alignItems: "center", gap: 10,
    borderWidth: 0.5, borderColor: "rgba(255,255,255,0.1)",
    width: "100%",
  },
  limitIcon: { fontSize: 44, marginBottom: 4 },
  limitTitle: { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  limitSubtitle: {
    color: "rgba(255,255,255,0.5)", fontSize: 14,
    textAlign: "center", lineHeight: 21,
  },
  limitDismiss: {
    marginTop: 8, backgroundColor: "#378ADD",
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40,
  },
  limitDismissText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  cameraControls: {
    position: "absolute", bottom: 24, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", paddingHorizontal: 40,
  },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 3, borderColor: "#fff",
    justifyContent: "center", alignItems: "center",
  },
  captureBtnDisabled: { opacity: 0.35 },
  captureBtnInner: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: "#fff",
  },
  flipBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
    marginRight: 32,
  },
  flipBtnText: { fontSize: 20 },

  bottomSpacer: { height: 110 },
})