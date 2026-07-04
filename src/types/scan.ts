export type ScanState =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "result"; text: string }
  | { kind: "error"; message: string };

