"use client";

import { Check, Download, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { evaluateForm, formatResult, specExample } from "@/lib/pcb";
import { PCB_SPEC } from "@/lib/pcb-spec";
import { withBasePath } from "@/lib/base-path";
import { CopperReferenceTables } from "./copper-reference-tables";

const example = specExample();
const { result } = evaluateForm(example);

export function SpecExampleDialog({ open, onOpenChange, onApply, onCloseAutoFocus }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="app-dialog photo-example-dialog" showCloseButton={false} onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader>
        <div className="photo-example-title"><DialogTitle>PCB 規格範例</DialogTitle><DialogClose asChild><Button variant="ghost" size="icon" className="app-button" aria-label="關閉規格範例"><X aria-hidden="true" /></Button></DialogClose></div>
        <DialogDescription>四層 PCB 層疊圖，下方附外層、內層與單面板的成品銅厚表。</DialogDescription>
      </DialogHeader>
      <div className="photo-example-body">
        <figure className="photo-reference">
          <a href={withBasePath("/examples/pcb-stackup-v1.svg")} target="_blank" rel="noreferrer" aria-label="在新分頁放大 PCB 四層規格圖"><img src={withBasePath("/examples/pcb-stackup-v1.svg")} width="900" height="1260" alt="PCB 四層規格圖：L1、L4 銅箔最小 3.8 mil；L2、L3 最小 3.409 mil；兩層 Prepreg 各最小 10 mil；Core 最小 15 mil。總板厚 1.57 ± 0.15 mm（61.8 ± 5.9 mil）。" /></a>
          <figcaption className="spec-image-links"><a href={withBasePath("/examples/pcb-stackup-v1.svg")} target="_blank" rel="noreferrer">放大規格圖<ExternalLink aria-hidden="true" /></a><a href={withBasePath("/examples/pcb-stackup-v1.png")} download="PCB-4-layer-specification.png">儲存圖片<Download aria-hidden="true" /></a></figcaption>
        </figure>
        <CopperReferenceTables />
        <section aria-labelledby="photo-parameters-heading">
          <h3 id="photo-parameters-heading">範例計算參數</h3>
          <dl className="photo-parameters">
            <div><dt>PCB 標稱厚度</dt><dd>{example.thickness}<small> mm</small></dd><small className="photo-example-note">圖面公差 ±{PCB_SPEC.toleranceMm} mm</small></div>
            <div><dt>銅層數</dt><dd>{example.layers.length}<small> 層</small></dd></div>
            <div><dt>銅 k（假設）</dt><dd>{example.copperK}</dd></div>
            <div><dt>FR4 k（假設）</dt><dd>{example.dielectricK}</dd></div>
          </dl>
          <p className="spec-assumptions">圖面未提供覆銅率與材料 k 值。範例沿用各層覆銅率 {PCB_SPEC.assumptions.coverage}%、銅 {example.copperK}、FR4 {example.dielectricK} W/(m·K)，套用後可修改。</p>
          <table className="photo-layer-table">
            <caption className="sr-only">四層板的最小銅厚與假設覆銅率</caption>
            <thead><tr><th scope="col">層別</th><th scope="col">最小銅厚<small>（mil）</small></th><th scope="col">覆銅率<small>（假設）</small></th></tr></thead>
            <tbody>{example.layers.map((layer, i) => <tr key={i}><th scope="row">L{i + 1}<small>{i === 0 || i === example.layers.length - 1 ? "外層" : "內層"}</small></th><td>{layer.thickness}</td><td>{layer.coverage}%</td></tr>)}</tbody>
          </table>
        </section>
        <section aria-labelledby="photo-results-heading">
          <h3 id="photo-results-heading">以上述假設計算</h3>
          <div className="photo-example-results"><div><span>板面方向 k<sub>XY</sub></span><strong>{formatResult(result?.inPlane, 2)}</strong></div><div><span>厚度方向 k<sub>Z</sub></span><strong>{formatResult(result?.throughPlane, 3)}</strong></div></div>
          <p className="photo-example-note">單位：W/(m·K)。以標稱板厚及銅厚下限估算，其餘厚度視為 FR4。各層下限的加總不等於標稱總板厚，代入方式詳見「公式與計算過程」。</p>
        </section>
      </div>
      <div className="photo-example-actions"><DialogClose asChild><Button variant="outline" className="app-button">關閉</Button></DialogClose><Button className="app-button" onClick={onApply}><Check aria-hidden="true" />套用四層範例</Button></div>
    </DialogContent>
  </Dialog>;
}
