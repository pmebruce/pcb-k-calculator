import { ArrowUpRight, ImageIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { evaluateForm, formatResult, inputNumber, MM_PER_UNIT, specExample } from "@/lib/pcb";
import { PCB_SPEC } from "@/lib/pcb-spec";

const example = specExample();
const exampleResult = evaluateForm(example).result;
const minimumTotalMil = PCB_SPEC.layers.reduce((sum, layer) => sum + Number(layer.minimumMil), 0);

export function FormulaDetails({ calculated, showPhoto }: { calculated: ReturnType<typeof evaluateForm>; showPhoto: () => void }) {
  const { result, board, error } = calculated;
  return <section className="formula-panel" id="formulas">
    <div className="section-heading"><span className="section-number">05</span><h2>公式與計算過程</h2></div>
    <p className="formula-intro">每次修改參數，下方代入值會同步更新。</p>
    <Accordion type="multiple" className="formula-accordion">
      <AccordionItem value="model"><AccordionTrigger>採用的計算模型</AccordionTrigger><AccordionContent className="formula-content">
        <p>先以覆銅率將每層銅／基材均勻化，再用平行與串聯熱阻求整板等效值。T 為板厚，tᵢ 為第 i 層銅厚，cᵢ 為覆銅率的小數值。</p>
        <div className="equation"><b>各銅層的均勻化 k 值</b><code>kᵢ = cᵢ × kCu + (1 − cᵢ) × kFR4</code></div>
        <div className="equation"><b>剩餘純基材厚度</b><code>td = T − Σtᵢ</code></div>
        <div className="equation"><b>板面方向：平行熱阻</b><code>k∥ = [kFR4 × td + Σ(kᵢ × tᵢ)] / T</code><small>亦即 k∥ = kCu × fCu + kFR4 × (1 − fCu)，其中 fCu = Σ(cᵢ × tᵢ) / T。</small></div>
        <div className="equation"><b>厚度方向：串聯熱阻</b><code>k⊥ = T / [td / kFR4 + Σ(tᵢ / kᵢ)]</code><small>採層內等溫近似。相同覆銅率、不同銅圖形分布，實際 k⊥ 仍可能不同。</small></div>
        <p>厚度只要全部使用同一單位即可，本工具內部統一使用 mm。所有導熱係數單位均為 W/(m·K)。</p>
      </AccordionContent></AccordionItem>
      <AccordionItem value="steps"><AccordionTrigger>目前參數的逐步計算</AccordionTrigger><AccordionContent className="formula-content">{result && board ? <>
        <ol className="calculation-steps">
          <li><strong>銅層厚度總和</strong><code>Σtᵢ = {formatResult(result.copperLayerThickness, 8)} mm</code></li>
          <li><strong>剩餘純基材</strong><code>{inputNumber(board.thickness)} − {formatResult(result.copperLayerThickness, 8)} = {formatResult(result.dielectricThickness, 8)} mm</code></li>
          <li><strong>等效滿版銅厚</strong><code>Σ(cᵢ × tᵢ) = {formatResult(result.equivalentCopperThickness, 8)} mm</code></li>
          <li><strong>銅體積占比</strong><code>fCu = {formatResult(result.equivalentCopperThickness, 8)} / {inputNumber(board.thickness)} = {formatResult(result.copperFraction * 100, 5)}%</code></li>
          <li><strong>板面方向導熱係數</strong><code>{inputNumber(board.copperK)} × {formatResult(result.copperFraction, 8)} + {inputNumber(board.dielectricK)} × {formatResult(1 - result.copperFraction, 8)} = {formatResult(result.inPlane, 5)} W/(m·K)</code></li>
          <li><strong>厚度方向導熱係數</strong><code>T / [td/kFR4 + Σ(tᵢ/kᵢ)] = {inputNumber(board.thickness)} / {formatResult(result.resistanceMm, 8)} = {formatResult(result.throughPlane, 6)} W/(m·K)</code></li>
        </ol>
        <div className="per-layer-summary"><h3>各層代入值</h3>{result.layerResults.map((layer, i) => <p key={i}><b>L{i + 1}</b><span>{formatResult(layer.thickness, 8)} mm · {formatResult(layer.coverage * 100, 2)}%</span><span>kᵢ = {formatResult(layer.effectiveK, 4)}</span></p>)}</div>
      </> : <p className="inline-error">請先修正輸入：{error}</p>}</AccordionContent></AccordionItem>
      <AccordionItem value="engineering-tools"><AccordionTrigger>板厚檢查與 Thermal Via 公式</AccordionTrigger><AccordionContent className="formula-content">
        <div className="equation"><b>板厚堆疊合計</b><code>Tstack = ΣtCu + nCore × tCore + nPrepreg × tPrepreg + tother</code><small>再與名義板厚 T ± 公差比較；材料最小值不一定等於壓合後成品厚度。</small></div>
        <div className="equation"><b>單顆 Via 孔壁銅截面積</b><code>Abarrel = π/4 × [(D + 2p)² − D²]</code><small>D 為鑽孔直徑，p 為單邊孔壁鍍銅厚度。</small></div>
        <div className="equation"><b>Via 群導熱能力</b><code>Gvia = N × kCu × Abarrel / T</code></div>
        <div className="equation"><b>指定區域的穿板總熱導</b><code>Gtotal = kPCB × (Aregion − N × Aout) / T + Gvia</code><small>孔內區域視為不導熱；Aout 為 Via 外徑面積。</small></div>
        <div className="equation"><b>含 Via 的熱阻與等效 kZ</b><code>RZ = 1 / Gtotal　；　kZ,eff = Gtotal × T / Aregion</code></div>
      </AccordionContent></AccordionItem>
      <AccordionItem value="spec"><AccordionTrigger>規格範例的厚度與假設</AccordionTrigger><AccordionContent className="formula-content">
        <p>範例來自四層板規格圖。L1／L4 外層銅箔各最小 {example.layers[0].thickness} mil，L2／L3 內層各最小 {example.layers[1].thickness} mil；兩層 Prepreg 各最小 10 mil，Core 最小 15 mil。標稱總板厚為 {PCB_SPEC.totalMm} ± {PCB_SPEC.toleranceMm} mm（{PCB_SPEC.totalMil} ± {PCB_SPEC.toleranceMil} mil）。</p>
        <p>各層的下限合計為 {formatResult(minimumTotalMil, 3)} mil，即 {formatResult(minimumTotalMil * MM_PER_UNIT.mil, 7)} mm；這些是下限，不能當成標稱總板厚。範例以 {example.thickness} mm 總厚度代入，銅厚合計 {formatResult(exampleResult?.copperLayerThickness, 7)} mm，其餘 {formatResult(exampleResult?.dielectricThickness, 7)} mm 視為 FR4。</p>
        <p>圖面未提供覆銅率與材料導熱係數。範例暫以各銅層覆銅率 {PCB_SPEC.assumptions.coverage}%、銅 k = {example.copperK}、FR4 k = {example.dielectricK} W/(m·K) 估算；這些是假設值，請依實際設計修改。</p>
        <div className="photo-comparison"><span>此四層範例：板面方向</span><b>{formatResult(exampleResult?.inPlane, 4)} <small>W/(m·K)</small></b><span>此四層範例：厚度方向</span><b>{formatResult(exampleResult?.throughPlane, 6)} <small>W/(m·K)</small></b></div>
        <p>使用銅厚下限計算，並不代表成品板的實測導熱係數。圖面總厚度公差未自動轉成 k 值區間，已知成品厚度時可直接修改上方參數。</p>
        <Button variant="outline" className="app-button" onClick={showPhoto}><ImageIcon aria-hidden="true" />查看規格圖與銅厚表</Button>
      </AccordionContent></AccordionItem>
      <AccordionItem value="assumptions"><AccordionTrigger>適用範圍與資料來源</AccordionTrigger><AccordionContent className="formula-content">
        <p>適用於多層 PCB 的初步等效材料估算。假設各材料 k 值固定、FR4 為各向同性，板面方向簡化為 kX = kY。覆銅率模型未解析銅箔連通性與走線方向，分割銅面或細線可能使板面 k 值被高估。</p>
        <p>上方 PCB 基礎 kX／kY／kZ 未包含導熱孔；Thermal Via 區塊另以平行導熱簡化模型估算。兩者都未解析焊盤、阻焊、接觸熱阻與局部熱源的擴散效應。若要分析熱點或大量導熱孔，需依實際佈局建立更詳細模型。材料數值請優先採用板廠資料。</p>
        <p>oz 單位以 <b>1 oz = 35 µm</b> 的業界名義銅箔厚度換算，並不代表電鍍後成品厚度。若已知成品厚度，請直接輸入 mil、µm 或 mm。</p>
        <ul className="source-links"><li><a href="https://web.mit.edu/16.unified/www/FALL/thermodynamics/notes/node118.html" target="_blank" rel="noreferrer">MIT｜串聯與並聯熱阻原理 <ArrowUpRight aria-hidden="true" /></a></li><li><a href="https://www.simscale.com/forum/t/calculating-effective-thermal-conductivity-for-pcbs/96307" target="_blank" rel="noreferrer">SimScale｜PCB 等效導熱係數計算 <ArrowUpRight aria-hidden="true" /></a></li><li><a href="https://www.eurocircuits.com/technical-guidelines/understanding-manufacturing-tolerances-on-a-pcb/tolerances-on-copper-thickness/" target="_blank" rel="noreferrer">Eurocircuits｜銅箔與成品銅厚 <ArrowUpRight aria-hidden="true" /></a></li></ul>
      </AccordionContent></AccordionItem>
    </Accordion>
  </section>;
}
