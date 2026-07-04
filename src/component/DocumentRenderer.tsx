import React from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
import type { AzureOcrClientResult, OcrTable } from "@/services/azureOcr";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// A4 aspect ratio (210mm x 297mm) — gives a realistic tall page shape
const PAGE_ASPECT_RATIO = 297 / 210;
const PAGE_WIDTH = SCREEN_WIDTH - 40; // accounts for sheet horizontal padding (20 each side)
const PAGE_MIN_HEIGHT = PAGE_WIDTH * PAGE_ASPECT_RATIO;

type DocumentType = "letter" | "receipt" | "document";

const TYPE_THEME: Record<DocumentType, { title: string; color: string; accent: string; icon: string }> = {
  letter: { title: "Letter", color: "#7F77DD", accent: "rgba(127,119,221,0.15)", icon: "✉️" },
  receipt: { title: "Receipt", color: "#1D9E75", accent: "rgba(29,158,117,0.15)", icon: "🧾" },
  document: { title: "Document", color: "#378ADD", accent: "rgba(55,138,221,0.15)", icon: "📄" },
};

type RenderBlock =
  | { kind: "title"; id: string; text: string }
  | { kind: "sectionHeading"; id: string; text: string }
  | { kind: "footnote"; id: string; text: string }
  | { kind: "paragraph"; id: string; text: string }
  | { kind: "table"; id: string; table: OcrTable };

function buildBlocks(result: AzureOcrClientResult): RenderBlock[] {
  const blocks: RenderBlock[] = [];

  if (result.paragraphs?.length) {
    result.paragraphs.forEach((p, i) => {
      const text = (p.text || "").trim();
      if (!text) return;

      switch (p.role) {
        case "title":
          blocks.push({ kind: "title", id: `t_${i}`, text });
          break;
        case "sectionHeading":
          blocks.push({ kind: "sectionHeading", id: `h_${i}`, text });
          break;
        case "footnote":
        case "pageFooter":
        case "pageHeader":
        case "pageNumber":
          blocks.push({ kind: "footnote", id: `f_${i}`, text });
          break;
        default:
          blocks.push({ kind: "paragraph", id: `p_${i}`, text });
      }
    });
  } else {
    let current = "";
    let idx = 0;
    for (const page of result.pages || []) {
      for (const line of page.lines || []) {
        const t = (line.text || "").trim();
        if (!t) continue;
        if (current && (t.length < 6 || /^[\-–—]{1,}$/.test(t))) {
          blocks.push({ kind: "paragraph", id: `b_${idx++}`, text: current.trim() });
          current = t;
        } else {
          current = current ? `${current} ${t}` : t;
        }
      }
    }
    if (current.trim()) blocks.push({ kind: "paragraph", id: `b_${idx++}`, text: current.trim() });
  }

  (result.tables || []).forEach((table, i) => {
    blocks.push({ kind: "table", id: `tbl_${i}`, table });
  });

  return blocks;
}

// Group ALL blocks onto a single page — most single-photo scans are one page.
// Only split into multiple pages if Azure itself reports multiple physical pages.
function groupByActualPages(blocks: RenderBlock[], pageCount: number): RenderBlock[][] {
  if (pageCount <= 1) return [blocks];
  const perPage = Math.ceil(blocks.length / pageCount) || 1;
  const pages: RenderBlock[][] = [];
  for (let i = 0; i < blocks.length; i += perPage) {
    pages.push(blocks.slice(i, i + perPage));
  }
  return pages.length ? pages : [[]];
}

function TableGrid({ table }: { table: OcrTable }) {
  const grid: string[][] = Array.from({ length: table.rowCount }, () =>
    Array.from({ length: table.columnCount }, () => "")
  );

  table.cells.forEach((cell) => {
    if (grid[cell.rowIndex]) {
      grid[cell.rowIndex][cell.columnIndex] = cell.text;
    }
  });

  return (
    <View style={tableStyles.wrapper}>
      {grid.map((row, rIdx) => (
        <View key={`row_${rIdx}`} style={tableStyles.row}>
          {row.map((cellText, cIdx) => (
            <View
              key={`cell_${rIdx}_${cIdx}`}
              style={[tableStyles.cell, rIdx === 0 && tableStyles.headerCell]}
            >
              <Text style={[tableStyles.cellText, rIdx === 0 && tableStyles.headerCellText]}>
                {cellText}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const tableStyles = StyleSheet.create({
  wrapper: { borderWidth: 1, borderColor: "#D8D6CC", borderRadius: 4, overflow: "hidden", marginTop: 4 },
  row: { flexDirection: "row" },
  cell: {
    flex: 1, paddingHorizontal: 6, paddingVertical: 6,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#E5E3D9",
  },
  headerCell: { backgroundColor: "#F0EEE4" },
  cellText: { fontSize: 11, color: "#2C2C2A" },
  headerCellText: { fontWeight: "700", color: "#1a1a1a" },
});

export function DocumentRenderer({
  ocr,
  docType,
}: {
  ocr: AzureOcrClientResult;
  docType: DocumentType;
}) {
  const theme = TYPE_THEME[docType] || TYPE_THEME.document;
  const blocks = buildBlocks(ocr);
  const physicalPageCount = ocr.pages?.length || 1;
  const pages = groupByActualPages(blocks, physicalPageCount);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.badgeBar, { backgroundColor: theme.accent, borderColor: `${theme.color}4D` }]}>
        <Text style={styles.badgeIcon}>{theme.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.badgeTitle, { color: theme.color }]}>{theme.title}</Text>
          <Text style={styles.badgeSubtitle}>Rendered from Azure OCR</Text>
        </View>
        <Text style={styles.badgePageCount}>
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {blocks.length === 0 ? (
          <View style={[styles.paper, { minHeight: PAGE_MIN_HEIGHT }]}>
            <Text style={styles.emptyText}>No structured content found.</Text>
          </View>
        ) : (
          pages.map((pageBlocks, pageIdx) => (
            <View key={`page_${pageIdx}`} style={[styles.paper, { minHeight: PAGE_MIN_HEIGHT }]}>
              <Text style={styles.pageLabel}>PAGE {pageIdx + 1}</Text>

              {pageBlocks.map((b) => {
                if (b.kind === "title") {
                  return <Text key={b.id} style={styles.blockTitle}>{b.text}</Text>;
                }
                if (b.kind === "sectionHeading") {
                  return <Text key={b.id} style={styles.blockHeading}>{b.text}</Text>;
                }
                if (b.kind === "footnote") {
                  return <Text key={b.id} style={styles.blockFootnote}>{b.text}</Text>;
                }
                if (b.kind === "table") {
                  return <TableGrid key={b.id} table={b.table} />;
                }
                return <Text key={b.id} style={styles.paperText}>{b.text}</Text>;
              })}

              <View style={styles.foldCorner} />
            </View>
          ))
        )}

        <Text style={styles.scrollHint}>
          {pages.length > 1 ? "Scroll to view full document" : ""}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  badgeBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1, marginBottom: 14,
  },
  badgeIcon: { fontSize: 18 },
  badgeTitle: { fontSize: 13, fontWeight: "800" },
  badgeSubtitle: { fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "600", marginTop: 1 },
  badgePageCount: { fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: "700" },

  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 24, gap: 18 },

  paper: {
    width: PAGE_WIDTH,
    alignSelf: "center",
    backgroundColor: "#fdfdfb",
    borderRadius: 4,
    paddingHorizontal: 22,
    paddingVertical: 26,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    gap: 12,
  },
  pageLabel: {
    position: "absolute", top: 10, right: 12,
    fontSize: 9, color: "#C2C0B6", fontWeight: "700", letterSpacing: 0.5,
  },

  blockTitle: {
    fontFamily: "serif",
    fontSize: 20,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 4,
    marginTop: 8,
  },
  blockHeading: {
    fontFamily: "serif",
    fontSize: 15,
    fontWeight: "700",
    color: "#2C2C2A",
    marginTop: 8,
  },
  blockFootnote: {
    fontFamily: "serif",
    fontSize: 11,
    fontStyle: "italic",
    color: "#8a8a85",
  },
  paperText: {
    fontFamily: "serif",
    fontSize: 14,
    lineHeight: 23,
    color: "#2C2C2A",
  },

  foldCorner: {
    position: "absolute", bottom: 0, right: 0,
    width: 0, height: 0,
    borderStyle: "solid",
    borderTopWidth: 0, borderRightWidth: 18, borderBottomWidth: 18, borderLeftWidth: 0,
    borderTopColor: "transparent", borderRightColor: "transparent",
    borderBottomColor: "#e8e6df", borderLeftColor: "transparent",
  },

  emptyText: { color: "#8a8a85", fontSize: 14, textAlign: "center", marginTop: 40 },

  scrollHint: {
    textAlign: "center", fontSize: 11,
    color: "rgba(255,255,255,0.35)", fontWeight: "600", marginTop: 4,
  },
});