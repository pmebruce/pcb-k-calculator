import { PCB_SPEC } from "./pcb-spec.ts";

export type CopperUnit = "mil" | "um" | "mm" | "oz";
export type LayerInput = { thickness: string; coverage: string };
export type PcbForm = {
  thickness: string;
  copperK: string;
  dielectricK: string;
  unit: CopperUnit;
  layers: LayerInput[];
};
export type Board = {
  thickness: number;
  copperK: number;
  dielectricK: number;
  layers: { thickness: number; coverage: number }[];
};

// Internal thickness unit: mm. oz means nominal copper foil, 35 µm/oz.
export const MM_PER_UNIT: Record<CopperUnit, number> = { mil: 0.0254, um: 0.001, mm: 1, oz: 0.035 };
export const UNIT_LABEL: Record<CopperUnit, string> = { mil: "mil", um: "µm", mm: "mm", oz: "oz" };

export function parseDecimal(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/，/g, ",").replace(",", ".");
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function inputNumber(number: number): string { return String(Number(number.toPrecision(12))); }

export function photoExample(): PcbForm {
  return {
    thickness: "1.6", copperK: "385", dielectricK: "0.3", unit: "mil",
    layers: Array.from({ length: 6 }, (_, i) => ({ thickness: i === 0 || i === 5 ? "2.0957" : "1.0065", coverage: "60" })),
  };
}

export function specExample(): PcbForm {
  return {
    thickness: PCB_SPEC.totalMm,
    copperK: PCB_SPEC.assumptions.copperK,
    dielectricK: PCB_SPEC.assumptions.dielectricK,
    unit: "mil",
    layers: PCB_SPEC.layers.filter((layer) => layer.kind === "copper").map((layer) => ({
      thickness: layer.minimumMil, coverage: PCB_SPEC.assumptions.coverage,
    })),
  };
}

export function convertUnit(form: PcbForm, unit: CopperUnit): PcbForm {
  if (!(unit in MM_PER_UNIT)) throw new Error("不支援的銅厚單位。");
  return {
    ...form, unit,
    layers: form.layers.map((layer) => {
      const value = parseDecimal(layer.thickness);
      if (value === null || value < 0) throw new Error("請先完成銅厚輸入，再切換單位。");
      return { ...layer, thickness: inputNumber(value * MM_PER_UNIT[form.unit] / MM_PER_UNIT[unit]) };
    }),
  };
}

export function resizeLayers(form: PcbForm, count: number): PcbForm {
  if (!Number.isInteger(count) || count < 1 || count > 32) throw new Error("銅層數需為 1–32 層。");
  const previous = form.layers;
  if (count === previous.length) return form;
  if (count === 1) return { ...form, layers: [{ ...previous[0] }] };
  const top = { ...previous[0] };
  const bottom = { ...previous[previous.length - 1] };
  const inner = previous.slice(1, -1).map((layer) => ({ ...layer }));
  while (inner.length < count - 2) inner.push({ thickness: inputNumber(0.0255651 / MM_PER_UNIT[form.unit]), coverage: "60" });
  return { ...form, layers: [top, ...inner.slice(0, count - 2), bottom] };
}

export function boardFromForm(form: PcbForm): Board {
  const positive = (value: string, label: string): number => {
    const parsed = parseDecimal(value);
    if (parsed === null || parsed <= 0) throw new Error(`${label}需填入大於 0 的數值。`);
    return parsed;
  };
  const thickness = positive(form.thickness, "PCB 總厚度");
  const copperK = positive(form.copperK, "銅導熱係數");
  const dielectricK = positive(form.dielectricK, "基材導熱係數");
  if (!(form.unit in MM_PER_UNIT)) throw new Error("不支援的銅厚單位。");
  const layers = form.layers.map((layer, index) => {
    const value = parseDecimal(layer.thickness);
    const coverage = parseDecimal(layer.coverage);
    if (value === null || value < 0) throw new Error(`L${index + 1} 銅厚需填入 0 或正數。`);
    if (coverage === null || coverage < 0 || coverage > 100) throw new Error(`L${index + 1} 覆銅率需介於 0–100%。`);
    return { thickness: value * MM_PER_UNIT[form.unit], coverage: coverage / 100 };
  });
  return { thickness, copperK, dielectricK, layers };
}

/** Layer homogenization followed by parallel XY and series Z networks.
 * k_i=c_i*k_Cu+(1-c_i)*k_d; t_d=T-sum(t_i).
 * Ignores connectivity and trace direction. The Z model assumes each layer
 * is laterally isothermal. This estimate is not a detailed PCB solver.
 */
export function calculateBoard(board: Board) {
  const { thickness: total, copperK, dielectricK, layers } = board;
  if (![total, copperK, dielectricK].every((n) => Number.isFinite(n) && n > 0)) throw new Error("板厚與材料導熱係數需為有限正數。");
  if (layers.length < 1 || layers.length > 32) throw new Error("銅層數需為 1–32 層。");
  if (layers.some((l) => !Number.isFinite(l.thickness) || l.thickness < 0 || !Number.isFinite(l.coverage) || l.coverage < 0 || l.coverage > 1)) throw new Error("銅厚或覆銅率不在可計算範圍。");
  const copperLayerThickness = layers.reduce((sum, l) => sum + l.thickness, 0);
  if (!Number.isFinite(copperLayerThickness) || copperLayerThickness > total * (1 + 1e-12)) throw new Error("各銅層厚度總和超過 PCB 總厚度，請增加板厚或減少銅厚。");
  const dielectricThickness = Math.max(0, total - copperLayerThickness);
  const equivalentCopperThickness = layers.reduce((sum, l) => sum + l.thickness * l.coverage, 0);
  const copperFraction = equivalentCopperThickness / total;
  const layerResults = layers.map((l) => ({ ...l, effectiveK: l.coverage * copperK + (1 - l.coverage) * dielectricK }));
  const copperOnlyK = copperK * copperFraction;
  const dielectricContribution = dielectricK * (1 - copperFraction);
  const inPlane = copperOnlyK + dielectricContribution;
  const resistanceMm = dielectricThickness / dielectricK + layerResults.reduce((sum, l) => sum + l.thickness / l.effectiveK, 0);
  const throughPlane = total / resistanceMm;
  if (![inPlane, throughPlane, copperFraction, resistanceMm].every(Number.isFinite) || throughPlane <= 0 || inPlane <= 0) throw new Error("數值超出可計算範圍，請檢查輸入。");
  return { inPlane, throughPlane, copperOnlyK, dielectricContribution, copperFraction, copperLayerThickness, equivalentCopperThickness, dielectricThickness, resistanceMm, layerResults };
}

export function evaluateForm(form: PcbForm) {
  try { const board = boardFromForm(form); return { board, result: calculateBoard(board), error: null }; }
  catch (error) { return { board: null, result: null, error: error instanceof Error ? error.message : "請檢查輸入內容。" }; }
}

export function formatResult(value: number | undefined, decimals = 2): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if ((value !== 0 && Math.abs(value) < 10 ** -decimals / 2) || Math.abs(value) >= 100000) return value.toExponential(2);
  return value.toLocaleString("en-US", { useGrouping: false, minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
