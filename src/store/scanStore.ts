import { create } from "zustand"
import type { AzureOcrClientResult } from "@/services/azureOcr"

type ScanState =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "result"; ocr: AzureOcrClientResult }
  | { kind: "error"; message: string }

type ScanStore = {
  scanState: ScanState
  capturedUri: string | null
  modalVisible: boolean
  setScanState: (state: ScanState) => void
  setCapturedUri: (uri: string | null) => void
  setModalVisible: (visible: boolean) => void
  reset: () => void
}

export const useScanStore = create<ScanStore>((set) => ({
  scanState: { kind: "idle" },
  capturedUri: null,
  modalVisible: false,
  setScanState: (scanState) => set({ scanState }),
  setCapturedUri: (capturedUri) => set({ capturedUri }),
  setModalVisible: (modalVisible) => set({ modalVisible }),
  reset: () => set({ scanState: { kind: "idle" }, capturedUri: null, modalVisible: false }),
}))