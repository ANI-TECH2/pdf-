import React, { useRef, useEffect } from "react"
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { DocumentRenderer } from "@/component/DocumentRenderer"
import { useScanStore } from "@/store/scanStore"
let Print: typeof import("expo-print") | null = null
let Sharing: typeof import("expo-sharing") | null = null
let FileSystem: typeof import("expo-file-system") | null = null

const loadExpoModules = async () => {
  if (Print && Sharing && FileSystem) return
  Print = (await import("expo-print")) as any
  Sharing = (await import("expo-sharing")) as any
  FileSystem = (await import("expo-file-system")) as any
}


const { height: SCREEN_HEIGHT } = Dimensions.get("window")

type DocumentType = "letter" | "receipt" | "document"


function detectDocumentType(text: string): DocumentType {
  const letterSignals = [
    /\bdear\s+[a-z]/i,
    /\bsincerely\b/i,
    /\byours? (faithfully|truly|sincerely)\b/i,
    /\bbest regards\b/i,
    /\bkind regards\b/i,
    /\bto whom it may concern\b/i,
  ]
  const receiptSignals = [
    /\btotal\b.*[\d,]+\.\d{2}/i,
    /\bsubtotal\b/i,
    /\binvoice\s*(no|number|#)/i,
    /\breceipt\b/i,
    /\bvat\b/i,
    /\bqty\b/i,
    /\bcash\b.*\bchange\b/i,
    /\bthank you for your (purchase|patronage)\b/i,
  ]
  const letterScore = letterSignals.filter((re) => re.test(text)).length
  const receiptScore = receiptSignals.filter((re) => re.test(text)).length
  if (receiptScore >= 2) return "receipt"
  if (letterScore >= 1) return "letter"
  return "document"
}

export function ResultModal() {
  const { scanState, modalVisible, setModalVisible, reset } = useScanStore()

  useEffect(() => {
    if (__DEV__) {
      console.log("[ResultModal] modalVisible:", modalVisible, "scanState.kind:", scanState.kind)
    }
  }, [modalVisible, scanState.kind])
  const [creatingPdf, setCreatingPdf] = React.useState(false)
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current

  useEffect(() => {
    if (modalVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start()
    } else {
      slideAnim.setValue(SCREEN_HEIGHT)
    }
  }, [modalVisible])

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false)
      setTimeout(reset, 50)
    })
  }

  const detectedType =
    scanState.kind === "result" ? detectDocumentType(scanState.ocr.fullText) : null

  const buildPdfHtml = (fullText: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body{
            font-family: Arial;
            padding:40px;
            color:#222;
            line-height:1.7;
          }
          h1{
            font-size:24px;
            margin-bottom:25px;
          }
          p{
            white-space:pre-wrap;
            font-size:15px;
          }
          hr{
            margin:20px 0;
          }
        </style>
      </head>
      <body>
        <h1>Scanned Document</h1>
        <hr/>
        <p>${fullText.replace(/\n/g, "<br/>")}</p>
      </body>
    </html>
  `

  const generateAndSavePdf = async () => {
    if (scanState.kind !== "result") return null

    if (!Print || !Sharing || !FileSystem) {
      await loadExpoModules()
    }

    // If native modules aren't available, don't crash the whole app.
    if (!Print || !Sharing || !FileSystem) return null

    setCreatingPdf(true)
    try {
      const html = buildPdfHtml(scanState.ocr.fullText)

      // expo-print API differs across versions; try common variants.
      const maybe = (Print as any).printToFileAsync
        ? await (Print as any).printToFileAsync({ html })
        : (await (Print as any).printToFile({ html }))

      const uri: string = maybe?.uri ?? maybe?.fileUri
      if (!uri) throw new Error("expo-print did not return a file uri")



      const fileName = `Scan-${Date.now()}.pdf`
      // Keep it simple: use the app cache directory if available at runtime,
      // otherwise fall back to documentDirectory when present.
      const dir =
        // @ts-expect-error - directory constants differ across Expo SDK versions
        (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? "";
      const newUri = dir + fileName




      await FileSystem.copyAsync({
        from: uri,
        to: newUri,
      })

      return newUri
    } finally {
      setCreatingPdf(false)
    }
  }

  const handleSavePdf = async () => {
    await generateAndSavePdf()
  }

  const handleSharePdf = async () => {
    const newUri = await generateAndSavePdf()
    if (!newUri) return

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(newUri, {
        mimeType: "application/pdf",
        dialogTitle: "Share PDF",
        UTI: ".pdf",
      })
    }
  }


  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>

            {scanState.kind === "result" && detectedType && (
              <>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>

                <View style={styles.rendererArea}>
                  <DocumentRenderer ocr={scanState.ocr} docType={detectedType} />
                </View>

                <View style={styles.footer}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.saveBtn, creatingPdf && styles.pdfBtnDisabled]}
                    onPress={handleSavePdf}
                    disabled={creatingPdf}
                  >
                    {creatingPdf ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Text style={styles.actionBtnIcon}>📄</Text>
                        <Text style={styles.actionBtnText}>Save PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.shareBtn, creatingPdf && styles.pdfBtnDisabled]}
                    onPress={handleSharePdf}
                    disabled={creatingPdf}
                  >
                    {creatingPdf ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Text style={styles.actionBtnIcon}>📤</Text>
                        <Text style={styles.actionBtnText}>Share PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleClose}>
                    <Text style={styles.secondaryBtnText}>🔍 Scan Again</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {scanState.kind === "error" && (
              <>
                <View style={styles.errorHeader}>
                  <Text style={styles.errorTitle}>Scan Failed</Text>
                  <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.errorBody}>
                  <Text style={styles.errorText}>{scanState.message}</Text>
                </View>
                <View style={styles.footer}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleClose}>
                    <Text style={styles.secondaryBtnText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  sheet: {
    flex: 1, backgroundColor: "#1a1a1a", paddingHorizontal: 20,
  },
  closeBtn: {
    position: "absolute", top: 12, right: 20, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center", alignItems: "center",
  },
  closeBtnText: { color: "#aaa", fontSize: 14, fontWeight: "700" },
  rendererArea: { flex: 1, marginTop: 50, marginBottom: 12 },
  footer: { paddingTop: 12, paddingBottom: 8, gap: 10 },
  pdfBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#4da3ff", borderRadius: 14,
    paddingVertical: 15, gap: 8,
    shadowColor: "#4da3ff", shadowOpacity: 0.4,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pdfBtnDisabled: { opacity: 0.6 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 15,
    gap: 8,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  saveBtn: {
    backgroundColor: "#4da3ff",
    shadowColor: "#4da3ff",
  },
  shareBtn: {
    backgroundColor: "#21c7a8",
    shadowColor: "#21c7a8",
  },
  actionBtnIcon: { fontSize: 18 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  secondaryBtn: {
    alignItems: "center", paddingVertical: 12,
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  secondaryBtnText: { color: "#aaa", fontWeight: "600", fontSize: 14 },
  errorHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginTop: 20, marginBottom: 10,
  },
  errorTitle: { color: "#ff5c5c", fontSize: 19, fontWeight: "800" },
  errorBody: { flex: 1, marginTop: 10 },
  errorText: { color: "#e0e0e0", fontSize: 14, lineHeight: 21 },
})