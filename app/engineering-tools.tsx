"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Check, Info, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PCB_COPPER_TABLES } from "@/lib/pcb-copper-tables";
import { calculateStackupCheck, calculateThermalVias } from "@/lib/engineering-tools";
import { formatResult, MM_PER_UNIT, parseDecimal, type Board, type PcbForm } from "@/lib/pcb";

type CopperPreset =
  | { mode: "multilayer"; outerMil: string; innerMil: string; description: string }
  | { mode: "single"; copperMil: string; description: string };

type CopperTablePickerProps = { onApply: (preset: CopperPreset) => void };

export function CopperTablePicker({ onApply }: CopperTablePickerProps) {
  const table3 = PCB_COPPER_TABLES.find((table) => table.number === 3)!;
  const table4 = PCB_COPPER_TABLES.find((table) => table.number === 4)!;
  const table5 = PCB_COPPER_TABLES.find((table) => table.number === 5)!;
  const [boardType, setBoardType] = useState<"multilayer" | "single">("multilayer");
  const [outerOz, setOuterOz] = useState("1.0");
  const [holeColumn, setHoleColumn] = useState("0");
  const [innerOz, setInnerOz] = useState("1.0");
  const [singleOz, setSingleOz] = useState("1.0");
  const outer = table3.rows.find((row) => row.oz === outerOz)!.thicknesses[Number(holeColumn)];
  const inner = table4.rows.find((row) => row.oz === innerOz)!.thicknesses[0];
  const single = table5.rows.find((row) => row.oz === singleOz)!.thicknesses[0];

  function apply() {
    if (boardType === "single") {
      onApply({ mode: "single", copperMil: single.mil, description: `Table 5・${singleOz} oz・${single.mil} mil` });
      return;
    }
    onApply({
      mode: "multilayer",
      outerMil: outer.mil,
      innerMil: inner.mil,
      description: `Table 3 外層 ${outer.mil} mil・Table 4 內層 ${inner.mil} mil`,
    });
  }

  return <section className="copper-autofill" aria-labelledby="copper-autofill-title">
    <div className="tool-subheading"><div><span>TABLE 3–5</span><h3 id="copper-autofill-title">成品銅厚一鍵帶入</h3></div><p>依採購規範的最小成品厚度填入</p></div>
    <div className="autofill-type" role="group" aria-label="板型">
      <Button type="button" variant="ghost" aria-pressed={boardType === "multilayer"} onClick={() => setBoardType("multilayer")}>多層板</Button>
      <Button type="button" variant="ghost" aria-pressed={boardType === "single"} onClick={() => setBoardType("single")}>單面板</Button>
    </div>
    {boardType === "multilayer" ? <div className="autofill-fields">
      <label className="tool-select-field"><span>外層原銅重</span><NativeSelect value={outerOz} onChange={(event) => setOuterOz(event.target.value)}>{table3.rows.map((row) => <NativeSelectOption key={row.oz} value={row.oz}>{row.oz} oz</NativeSelectOption>)}</NativeSelect></label>
      <label className="tool-select-field"><span>孔銅厚度</span><NativeSelect value={holeColumn} onChange={(event) => setHoleColumn(event.target.value)}>{table3.columns.map((column, index) => <NativeSelectOption key={column.platingMil} value={String(index)}>{column.platingMil} mil</NativeSelectOption>)}</NativeSelect></label>
      <label className="tool-select-field"><span>內層原銅重</span><NativeSelect value={innerOz} onChange={(event) => setInnerOz(event.target.value)}>{table4.rows.map((row) => <NativeSelectOption key={row.oz} value={row.oz}>{row.oz} oz</NativeSelectOption>)}</NativeSelect></label>
    </div> : <div className="autofill-fields single">
      <label className="tool-select-field"><span>單面板原銅重</span><NativeSelect value={singleOz} onChange={(event) => setSingleOz(event.target.value)}>{table5.rows.map((row) => <NativeSelectOption key={row.oz} value={row.oz}>{row.oz} oz</NativeSelectOption>)}</NativeSelect></label>
    </div>}
    <div className="autofill-preview">
      {boardType === "multilayer" ? <><span>外層 <b>{outer.um} µm</b><small>{outer.mil} mil</small></span><span>內層 <b>{inner.um} µm</b><small>{inner.mil} mil</small></span></> : <span>單面板 <b>{single.um} µm</b><small>{single.mil} mil</small></span>}
    </div>
    <Button type="button" className="app-button autofill-apply" onClick={apply}><Check aria-hidden="true" />{boardType === "multilayer" ? "填入全部外層與內層" : "切換單銅層並填入"}</Button>
    <p className="tool-fineprint">帶入時會切換成 mil，保留原表列出的成品厚度；覆銅率不變。</p>
  </section>;
}

type ToolFields = Record<string, string>;

function updateField(setter: Dispatch<SetStateAction<ToolFields>>, key: string, value: string) {
  setter((current) => ({ ...current, [key]: value }));
}

function numberFrom(fields: ToolFields, key: string) {
  const value = parseDecimal(fields[key]);
  if (value === null) throw new Error("請完成所有數值輸入。");
  return value;
}

type EngineeringToolsProps = {
  form: PcbForm;
  board: Board | null;
  result: { throughPlane: number; copperLayerThickness: number } | null;
};

export function EngineeringTools({ form, board, result }: EngineeringToolsProps) {
  const [stackFields, setStackFields] = useState<ToolFields>({
    tolerance: "0.15", coreCount: "1", coreThickness: "0.381", prepregCount: "2", prepregThickness: "0.254", otherThickness: "0",
  });
  const [viaFields, setViaFields] = useState<ToolFields>({ count: "16", drill: "0.30", plating: "0.025", width: "10", height: "10" });
  const copperTotalMm = useMemo(() => {
    const values = form.layers.map((layer) => parseDecimal(layer.thickness));
    return values.some((value) => value === null || value < 0) ? null : values.reduce<number>((sum, value) => sum + (value ?? 0), 0) * MM_PER_UNIT[form.unit];
  }, [form.layers, form.unit]);

  const stackCheck = useMemo(() => {
    try {
      const boardThicknessMm = parseDecimal(form.thickness);
      if (boardThicknessMm === null || copperTotalMm === null) throw new Error("請先完成 PCB 板厚與銅厚輸入。");
      return { value: calculateStackupCheck({
        boardThicknessMm,
        toleranceMm: numberFrom(stackFields, "tolerance"),
        copperThicknessMm: copperTotalMm,
        coreCount: numberFrom(stackFields, "coreCount"),
        coreThicknessMm: numberFrom(stackFields, "coreThickness"),
        prepregCount: numberFrom(stackFields, "prepregCount"),
        prepregThicknessMm: numberFrom(stackFields, "prepregThickness"),
        otherThicknessMm: numberFrom(stackFields, "otherThickness"),
      }), error: null };
    } catch (error) { return { value: null, error: error instanceof Error ? error.message : "請檢查輸入。" }; }
  }, [copperTotalMm, form.thickness, stackFields]);

  const viaCheck = useMemo(() => {
    try {
      if (!board || !result) throw new Error("請先完成上方 PCB 參數，才能計算 Thermal Via。");
      return { value: calculateThermalVias({
        count: numberFrom(viaFields, "count"),
        drillDiameterMm: numberFrom(viaFields, "drill"),
        platingThicknessMm: numberFrom(viaFields, "plating"),
        areaWidthMm: numberFrom(viaFields, "width"),
        areaHeightMm: numberFrom(viaFields, "height"),
        boardThicknessMm: board.thickness,
        boardK: result.throughPlane,
        copperK: board.copperK,
      }), error: null };
    } catch (error) { return { value: null, error: error instanceof Error ? error.message : "請檢查輸入。" }; }
  }, [board, result, viaFields]);

  const statusText = stackCheck.value?.status === "within" ? "落在允收範圍" : stackCheck.value?.status === "over" ? "超過公差上限" : "低於公差下限";

  return <>
    <section className="panel engineering-panel" aria-labelledby="stackup-check-heading">
      <div className="section-heading"><span className="section-number">03</span><h2 id="stackup-check-heading">板厚堆疊檢查</h2><span className="section-caption">STACK CHECK</span></div>
      <p className="engineering-intro">銅厚由上方自動加總，再加入 Core、Prepreg 與其他厚度，對照 PCB 名義厚度與公差。</p>
      <div className="derived-value"><Layers3 aria-hidden="true" /><span>銅層厚度合計</span><output>{copperTotalMm === null ? "—" : formatResult(copperTotalMm, 4)} <small>mm</small></output></div>
      <div className="stack-tool-grid">
        <label className="field"><span>板厚公差 ±</span><Input className="numeric-input" inputMode="decimal" value={stackFields.tolerance} onChange={(event) => updateField(setStackFields, "tolerance", event.target.value)} /><small>mm・名義板厚使用上方設定</small></label>
        <label className="field"><span>其他厚度</span><Input className="numeric-input" inputMode="decimal" value={stackFields.otherThickness} onChange={(event) => updateField(setStackFields, "otherThickness", event.target.value)} /><small>mm・阻焊或未列出的厚度</small></label>
      </div>
      <div className="material-thickness-card">
        <div className="material-title"><strong>Core</strong><span>層數 × 單層厚度</span></div>
        <div className="material-inputs"><label><span>層數</span><Input className="numeric-input" inputMode="numeric" value={stackFields.coreCount} onChange={(event) => updateField(setStackFields, "coreCount", event.target.value)} /></label><span>×</span><label><span>單層 mm</span><Input className="numeric-input" inputMode="decimal" value={stackFields.coreThickness} onChange={(event) => updateField(setStackFields, "coreThickness", event.target.value)} /></label><output>{stackCheck.value ? formatResult(stackCheck.value.coreTotalMm, 4) : "—"} mm</output></div>
      </div>
      <div className="material-thickness-card">
        <div className="material-title"><strong>Prepreg</strong><span>層數 × 單層厚度</span></div>
        <div className="material-inputs"><label><span>層數</span><Input className="numeric-input" inputMode="numeric" value={stackFields.prepregCount} onChange={(event) => updateField(setStackFields, "prepregCount", event.target.value)} /></label><span>×</span><label><span>單層 mm</span><Input className="numeric-input" inputMode="decimal" value={stackFields.prepregThickness} onChange={(event) => updateField(setStackFields, "prepregThickness", event.target.value)} /></label><output>{stackCheck.value ? formatResult(stackCheck.value.prepregTotalMm, 4) : "—"} mm</output></div>
      </div>
      {stackCheck.value ? <div className={`stack-check-result ${stackCheck.value.status}`}>
        <div><span>{statusText}</span><strong>{formatResult(stackCheck.value.stackTotalMm, 4)} <small>mm</small></strong></div>
        <p>允收 {formatResult(stackCheck.value.lowerLimitMm, 3)}–{formatResult(stackCheck.value.upperLimitMm, 3)} mm。{stackCheck.value.deltaToNominalMm >= 0 ? `距名義板厚尚差 ${formatResult(stackCheck.value.deltaToNominalMm, 4)} mm。` : `比名義板厚多 ${formatResult(Math.abs(stackCheck.value.deltaToNominalMm), 4)} mm。`}</p>
      </div> : <div className="tool-error"><Info aria-hidden="true" />{stackCheck.error}</div>}
      <p className="tool-fineprint">厚度請使用壓合後的實際值；若填的是材料最小值，結果可能低於成品板厚下限。</p>
    </section>

    <section className="panel engineering-panel" aria-labelledby="via-heading">
      <div className="section-heading"><span className="section-number">04</span><h2 id="via-heading">Thermal Via 計算</h2><span className="section-caption">VIA ARRAY</span></div>
      <p className="engineering-intro">將鍍銅孔壁視為穿板方向的平行導熱路徑，計算指定區域內的等效 kZ 與熱阻改善。</p>
      <div className="via-input-grid">
        <label className="field"><span>Via 數量</span><Input className="numeric-input" inputMode="numeric" value={viaFields.count} onChange={(event) => updateField(setViaFields, "count", event.target.value)} /><small>顆・完整穿板</small></label>
        <label className="field"><span>鑽孔直徑</span><Input className="numeric-input" inputMode="decimal" value={viaFields.drill} onChange={(event) => updateField(setViaFields, "drill", event.target.value)} /><small>mm・孔內徑</small></label>
        <label className="field"><span>孔壁鍍銅</span><Input className="numeric-input" inputMode="decimal" value={viaFields.plating} onChange={(event) => updateField(setViaFields, "plating", event.target.value)} /><small>mm・單邊厚度</small></label>
        <label className="field"><span>計算區域寬</span><Input className="numeric-input" inputMode="decimal" value={viaFields.width} onChange={(event) => updateField(setViaFields, "width", event.target.value)} /><small>mm</small></label>
        <label className="field"><span>計算區域長</span><Input className="numeric-input" inputMode="decimal" value={viaFields.height} onChange={(event) => updateField(setViaFields, "height", event.target.value)} /><small>mm</small></label>
      </div>
      {viaCheck.value ? <>
        <div className="via-k-result"><div><span>加入 Via 後等效 kZ</span><strong>{formatResult(viaCheck.value.effectiveKWithVia, 3)}</strong><small>W/(m·K)</small></div><p>原始 PCB kZ<br /><b>{formatResult(viaCheck.value.boardK, 3)}</b> W/(m·K)</p></div>
        <dl className="via-results">
          <div><dt>無 Via 熱阻</dt><dd>{formatResult(viaCheck.value.resistanceWithoutVia, 3)} <small>K/W</small></dd></div>
          <div><dt>含 Via 熱阻</dt><dd>{formatResult(viaCheck.value.resistanceWithVia, 3)} <small>K/W</small></dd></div>
          <div><dt>Via 群單獨熱阻</dt><dd>{formatResult(viaCheck.value.viaGroupResistance, 3)} <small>K/W</small></dd></div>
          <div><dt>熱阻改善</dt><dd>{viaCheck.value.resistanceReductionPercent >= 0 ? "降低" : "增加"} {formatResult(Math.abs(viaCheck.value.resistanceReductionPercent), 1)}<small> %</small></dd></div>
          <div><dt>單顆孔壁銅面積</dt><dd>{formatResult(viaCheck.value.barrelAreaEachMm2, 4)} <small>mm²</small></dd></div>
          <div><dt>Via 外徑</dt><dd>{formatResult(viaCheck.value.outerDiameterMm, 3)} <small>mm</small></dd></div>
        </dl>
      </> : <div className="tool-error"><Info aria-hidden="true" />{viaCheck.error}</div>}
      <p className="tool-fineprint">簡化模型未計入焊盤、銅平面、填孔材料、接觸熱阻與熱擴散；孔內區域視為不導熱。</p>
    </section>
  </>;
}

export type { CopperPreset };
