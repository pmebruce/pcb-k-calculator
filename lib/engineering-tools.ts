export type StackupCheckInput = {
  boardThicknessMm: number;
  toleranceMm: number;
  copperThicknessMm: number;
  coreCount: number;
  coreThicknessMm: number;
  prepregCount: number;
  prepregThicknessMm: number;
  otherThicknessMm: number;
};

export type StackupStatus = "within" | "under" | "over";

function finiteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}需填入 0 或正數。`);
}

function finitePositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}需填入大於 0 的數值。`);
}

function layerCount(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0 || value > 64) throw new Error(`${label}需為 0–64 的整數。`);
}

export function calculateStackupCheck(input: StackupCheckInput) {
  finitePositive(input.boardThicknessMm, "PCB 總厚度");
  finiteNonNegative(input.toleranceMm, "板厚公差");
  finiteNonNegative(input.copperThicknessMm, "銅層合計");
  layerCount(input.coreCount, "Core 層數");
  layerCount(input.prepregCount, "Prepreg 層數");
  finiteNonNegative(input.coreThicknessMm, "單層 Core 厚度");
  finiteNonNegative(input.prepregThicknessMm, "單層 Prepreg 厚度");
  finiteNonNegative(input.otherThicknessMm, "其他厚度");

  const coreTotalMm = input.coreCount * input.coreThicknessMm;
  const prepregTotalMm = input.prepregCount * input.prepregThicknessMm;
  const stackTotalMm = input.copperThicknessMm + coreTotalMm + prepregTotalMm + input.otherThicknessMm;
  const lowerLimitMm = Math.max(0, input.boardThicknessMm - input.toleranceMm);
  const upperLimitMm = input.boardThicknessMm + input.toleranceMm;
  const deltaToNominalMm = input.boardThicknessMm - stackTotalMm;
  const status: StackupStatus = stackTotalMm < lowerLimitMm ? "under" : stackTotalMm > upperLimitMm ? "over" : "within";
  const outsideByMm = status === "under" ? lowerLimitMm - stackTotalMm : status === "over" ? stackTotalMm - upperLimitMm : 0;

  return { ...input, coreTotalMm, prepregTotalMm, stackTotalMm, lowerLimitMm, upperLimitMm, deltaToNominalMm, status, outsideByMm };
}

export type ThermalViaInput = {
  count: number;
  drillDiameterMm: number;
  platingThicknessMm: number;
  areaWidthMm: number;
  areaHeightMm: number;
  boardThicknessMm: number;
  boardK: number;
  copperK: number;
};

export function calculateThermalVias(input: ThermalViaInput) {
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 10000) throw new Error("Via 數量需為 1–10,000 的整數。");
  finitePositive(input.drillDiameterMm, "鑽孔直徑");
  finitePositive(input.platingThicknessMm, "孔壁鍍銅厚度");
  finitePositive(input.areaWidthMm, "計算區域寬度");
  finitePositive(input.areaHeightMm, "計算區域長度");
  finitePositive(input.boardThicknessMm, "PCB 總厚度");
  finitePositive(input.boardK, "PCB 原始 kZ");
  finitePositive(input.copperK, "銅導熱係數");

  const outerDiameterMm = input.drillDiameterMm + 2 * input.platingThicknessMm;
  const barrelAreaEachMm2 = Math.PI / 4 * (outerDiameterMm ** 2 - input.drillDiameterMm ** 2);
  const holeAreaEachMm2 = Math.PI / 4 * outerDiameterMm ** 2;
  const totalAreaMm2 = input.areaWidthMm * input.areaHeightMm;
  const barrelAreaTotalMm2 = barrelAreaEachMm2 * input.count;
  const holeAreaTotalMm2 = holeAreaEachMm2 * input.count;
  if (holeAreaTotalMm2 >= totalAreaMm2) throw new Error("Via 外徑總面積已超過計算區域，請增加區域尺寸或減少 Via 數量。");

  const lengthM = input.boardThicknessMm / 1000;
  const totalAreaM2 = totalAreaMm2 / 1_000_000;
  const remainingBoardAreaM2 = (totalAreaMm2 - holeAreaTotalMm2) / 1_000_000;
  const barrelAreaTotalM2 = barrelAreaTotalMm2 / 1_000_000;
  const conductanceWithoutVia = input.boardK * totalAreaM2 / lengthM;
  const boardConductanceWithHoles = input.boardK * remainingBoardAreaM2 / lengthM;
  const viaConductance = input.copperK * barrelAreaTotalM2 / lengthM;
  const conductanceWithVia = boardConductanceWithHoles + viaConductance;
  const resistanceWithoutVia = 1 / conductanceWithoutVia;
  const resistanceWithVia = 1 / conductanceWithVia;
  const viaGroupResistance = 1 / viaConductance;
  const effectiveKWithVia = conductanceWithVia * lengthM / totalAreaM2;
  const resistanceReductionPercent = (1 - resistanceWithVia / resistanceWithoutVia) * 100;
  const copperAreaFraction = barrelAreaTotalMm2 / totalAreaMm2;

  return {
    ...input,
    outerDiameterMm,
    barrelAreaEachMm2,
    barrelAreaTotalMm2,
    holeAreaTotalMm2,
    totalAreaMm2,
    copperAreaFraction,
    conductanceWithoutVia,
    viaConductance,
    conductanceWithVia,
    resistanceWithoutVia,
    resistanceWithVia,
    viaGroupResistance,
    effectiveKWithVia,
    resistanceReductionPercent,
  };
}
