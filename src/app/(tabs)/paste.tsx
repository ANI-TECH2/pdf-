import React, { useState, useRef } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useScanStore } from "@/store/scanStore"
import type { AzureOcrClientResult } from "@/services/azureOcr"

type Selection = { start: number; end: number }

function buildOcrFromText(text: string): AzureOcrClientResult {
  const lines = text.split("\n").filter((l) => l.trim().length > 0)
  return {
    fullText: text,
    pages: [{ pageNumber: 1, lines: lines.map((l) => ({ text: l, words: [] })) }],
    paragraphs: lines.map((l) => ({ text: l, role: null })),
    tables: [],
  }
}

export default function PasteTab() {
  const [pasteText, setPasteText] = useState("")
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 })
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<TextInput>(null)

  const { setScanState, setModalVisible } = useScanStore()

  const handleConvert = () => {
    const text = pasteText.trim()
    if (!text) return
    const ocr = buildOcrFromText(text)
    setScanState({ kind: "result", ocr })
    setModalVisible(true)
  }

  const handlePasteFromClipboard = async () => {
    const text = await Clipboard.getString()
    if (text) setPasteText((prev) => prev + text)
  }

  const handleSelectionChange = (
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>
  ) => {
    setSelection(e.nativeEvent.selection)
  }

  const wordCount = pasteText.trim().split(/\s+/).filter(Boolean).length
  const charCount = pasteText.length
  const hasText = pasteText.trim().length > 0

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Paste text</Text>
          <Text style={styles.headerSubtitle}>Turn any text into a document</Text>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={pasteText}
              onChangeText={setPasteText}
              onSelectionChange={handleSelectionChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Paste your text here…"
              placeholderTextColor="rgba(255,255,255,0.2)"
              multiline
              textAlignVertical="top"
              autoCorrect={false}
              autoCapitalize="sentences"
              selection={selection}
            />

            {hasText && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  setPasteText("")
                  setSelection({ start: 0, end: 0 })
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.clearBtnText}>✕  Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Words</Text>
              <Text style={styles.statValue}>{wordCount}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Characters</Text>
              <Text style={styles.statValue}>{charCount}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.convertBtn, !hasText && styles.convertBtnDisabled]}
            onPress={handleConvert}
            disabled={!hasText}
            activeOpacity={0.85}
          >
            <Text style={styles.convertBtnIcon}>📑</Text>
            <Text style={styles.convertBtnText}>Convert to document</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clipboardBtn}
            onPress={handlePasteFromClipboard}
            activeOpacity={0.7}
          >
            <Text style={styles.clipboardBtnText}>📋  Paste from clipboard</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f14" },
  flex: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 8, paddingBottom: 120, gap: 14 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
    marginBottom: 4,
  },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "500", marginBottom: 4 },
  headerSubtitle: { color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 20 },

  inputWrapper: {
    backgroundColor: "#121821",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    minHeight: 200,
  },
  inputWrapperFocused: { borderColor: "rgba(55,138,221,0.4)" },
  input: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 24,
    minHeight: 160,
    fontFamily: "serif",
  },
  clearBtn: {
    alignSelf: "flex-end",
    marginTop: 10,
    backgroundColor: "rgba(226,75,74,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(226,75,74,0.2)",
  },
  clearBtnText: { color: "#E24B4A", fontSize: 12, fontWeight: "500" },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: "#121821",
    borderRadius: 10,
    padding: 12,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statLabel: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 4 },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "500" },

  convertBtn: {
    backgroundColor: "#378ADD",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  convertBtnDisabled: { opacity: 0.35 },
  convertBtnIcon: { fontSize: 18 },
  convertBtnText: { color: "#fff", fontWeight: "500", fontSize: 15 },

  clipboardBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  clipboardBtnText: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
})

