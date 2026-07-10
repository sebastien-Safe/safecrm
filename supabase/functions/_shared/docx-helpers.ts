// ==========================================================================
// S@FE CRM — Helpers de construction docx (module partagé Edge Functions)
// Palette S@FE : navy #030D26, gold #C9A24B, steel #7C97C4
// Utilisé par generate-cybervictim-report — TableRow/Table utilisent
// `children`, pas `cells` (API de la librairie docx).
// ==========================================================================
import {
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";

export const NAVY  = "030D26";
export const GOLD  = "C9A24B";
export const STEEL = "7C97C4";

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const thinBorder = { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" };

export function p(text: string, opts: { italic?: boolean; bold?: boolean; color?: string; size?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        italics: opts.italic || false,
        bold: opts.bold || false,
        color: opts.color || "222222",
        size: opts.size || 20, // demi-points (10pt)
      }),
    ],
  });
}

export function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 4 } },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 28 })],
  });
}

export function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 23 })],
  });
}

export function bullet(text: string, opts: { color?: string } = {}): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, color: opts.color || "222222", size: 20 })],
  });
}

/** Zone à compléter manuellement (ouvrable/éditable dans Word après génération). */
export function placeholder(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: `[${text}]`, italics: true, color: "888888", size: 20 })],
  });
}

/** Tableau libellé/valeur à deux colonnes (fiche d'identité, description incident…). */
export function infoTable(rows: Array<[string, string]>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            shading: { fill: "F2F2F2" },
            borders: { top: thinBorder, bottom: thinBorder, left: noBorder, right: noBorder },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, color: NAVY })] })],
          }),
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            borders: { top: thinBorder, bottom: thinBorder, left: noBorder, right: noBorder },
            children: [new Paragraph({ children: [new TextRun({ text: value || "—", size: 19 })] })],
          }),
        ],
      })
    ),
  });
}

export interface ChronoEntry {
  when: string;
  action: string;
  detail: string;
}

/** Tableau chronologique (Date/heure — Action — Détail/Résultat), avec en-tête. */
export function chronoTable(entries: ChronoEntry[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: ["Date / heure", "Action", "Détail / résultat"].map(
      (t) =>
        new TableCell({
          shading: { fill: NAVY },
          borders: { top: thinBorder, bottom: thinBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: "FFFFFF", size: 18 })] })],
        })
    ),
  });

  const dataRows = (entries.length ? entries : [{ when: "—", action: "—", detail: "—" }]).map(
    (e) =>
      new TableRow({
        children: [e.when, e.action, e.detail].map(
          (t) =>
            new TableCell({
              borders: { top: thinBorder, bottom: thinBorder, left: noBorder, right: noBorder },
              children: [new Paragraph({ children: [new TextRun({ text: t || "—", size: 18 })] })],
            })
        ),
      })
  );

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] });
}

export function centered(text: string, opts: { bold?: boolean; color?: string; size?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text, bold: opts.bold ?? false, color: opts.color || NAVY, size: opts.size || 20 })],
  });
}
