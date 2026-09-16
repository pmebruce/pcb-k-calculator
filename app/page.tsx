"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowLeftRight, Check, CheckCheck, ChevronRight, Copy, ImageIcon, Info, Layers3, Plus, Smartphone, Trash2, Undo2, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { calculationSchema, savedFormSchema } from "@/lib/form-schema";
import { withBasePath } from "@/lib/base-path";
import { convertUnit, evaluateForm, formatResult, inputNumber, MM_PER_UNIT, parseDecimal, specExample, resizeLayers, UNIT_LABEL, type CopperUnit, type PcbForm } from "@/lib/pcb";
import { FormulaDetails } from "./formula-details";
import { SpecExampleDialog } from "./spec-example";
import { CopperTablePicker, EngineeringTools, type CopperPreset } from "./engineering-tools";

const STORAGE_KEY = "pcb-thermal-calculator-v1";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function Home() {
  const { register, control, reset, getValues } = useForm<PcbForm>({ defaultValues: specExample(), resolver: zodResolver(calculationSchema), mode: "onChange" });
  const { fields, remove } = useFieldArray({ control, name: "layers" });
  const values = useWatch({ control }) as PcbForm;
  const form = values.layers ? values : specExample();
  const calculated = useMemo(() => evaluateForm(form), [form]);
  const { result, board, error } = calculated;
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [offline, setOffline] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [copyText, setCopyText] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [undo, setUndo] = useState<PcbForm | null>(null);
  const [bulk, setBulk] = useState(() => {
    const example = specExample();
    return { outer: example.layers[0].thickness, inner: example.layers[1].thickness, coverage: example.layers[0].coverage };
  });
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultPanelRef = useRef<HTMLElement>(null);
  const focusResultsAfterPhoto = useRef(false);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3800);
  }

  useEffect(() => {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (text) {
        const data = savedFormSchema.safeParse(JSON.parse(text));
        if (data.success) {
          reset(data.data);
          setBulk({ outer: data.data.layers[0].thickness, inner: data.data.layers[1]?.thickness ?? data.data.layers[0].thickness, coverage: data.data.layers[0].coverage });
        }
      }
    } catch { setStorageError(true); }
    setLoaded(true);
  }, [reset]);

  useEffect(() => {
    if (!loaded) return;
    setSaved(false);
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); setSaved(true); setStorageError(false); }
      catch { setStorageError(true); }
    }, 250);
    return () => clearTimeout(timer);
  }, [form, loaded]);

  useEffect(() => {
    const onlineChanged = () => setOffline(!navigator.onLine);
    onlineChanged();
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const didInstall = () => { setInstalled(true); setInstallEvent(null); setInstallOpen(false); };
    window.addEventListener("online", onlineChanged);
    window.addEventListener("offline", onlineChanged);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", didInstall);
    let alive = true;
    let updating = false;
    const checkReady = () => {
      const worker = navigator.serviceWorker?.controller;
      if (!worker) return;
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (alive && event.data?.type === "OFFLINE_READY") {
          const page = window.location.pathname.replace(/\/$/, "") || "/";
          setOfflineReady(Boolean(event.data.ready && event.data.routes?.includes(page)));
        }
        channel.port1.close();
      };
      worker.postMessage({ type: "CHECK_OFFLINE" }, [channel.port2]);
    };
    const controllerChanged = () => { if (updating) window.location.reload(); else checkReady(); };
    const updateRequested = () => { updating = true; };
    window.addEventListener("pcb-apply-update", updateRequested);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
      navigator.serviceWorker.register(withBasePath("/sw.js"), { scope: withBasePath("/"), updateViaCache: "none" }).then((registration) => {
        if (!alive) return;
        if (registration.waiting) setWaitingWorker(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller && alive) setWaitingWorker(worker);
          });
        });
        navigator.serviceWorker.ready.then(checkReady);
        checkReady();
      }).catch(() => { if (alive) setOfflineReady(false); });
    }
    return () => {
      alive = false;
      window.removeEventListener("online", onlineChanged); window.removeEventListener("offline", onlineChanged);
      window.removeEventListener("beforeinstallprompt", beforeInstall); window.removeEventListener("appinstalled", didInstall);
      window.removeEventListener("pcb-apply-update", updateRequested);
      navigator.serviceWorker?.removeEventListener("controllerchange", controllerChanged);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function replaceForm(next: PcbForm, message: string) {
    setUndo(structuredClone(getValues())); reset(next); notify(message);
  }

  function changeUnit(unit: CopperUnit) {
    try {
      const current = getValues();
      const next = convertUnit(current, unit);
      const conversion = MM_PER_UNIT[current.unit] / MM_PER_UNIT[unit];
      setBulk((b) => ({ ...b,
        outer: parseDecimal(b.outer) === null ? "" : inputNumber(Number(parseDecimal(b.outer)) * conversion),
        inner: parseDecimal(b.inner) === null ? "" : inputNumber(Number(parseDecimal(b.inner)) * conversion),
      }));
      reset(next);
    } catch (e) { notify((e as Error).message); }
  }

  function applyBulk() {
    const outer = parseDecimal(bulk.outer), inner = parseDecimal(bulk.inner), coverage = parseDecimal(bulk.coverage);
    if (outer === null || outer < 0 || inner === null || inner < 0 || coverage === null || coverage < 0 || coverage > 100) { notify("銅厚需為 0 或正數，覆銅率需介於 0–100%。"); return; }
    const current = getValues();
    replaceForm({ ...current, layers: current.layers.map((_, i) => ({ thickness: i === 0 || i === current.layers.length - 1 ? bulk.outer : bulk.inner, coverage: bulk.coverage })) }, "已套用至所有銅層");
  }

  function applyCopperPreset(preset: CopperPreset) {
    const current = getValues();
    if (preset.mode === "single") {
      const layers = [{ thickness: preset.copperMil, coverage: current.layers[0]?.coverage ?? "60" }];
      replaceForm({ ...current, unit: "mil", layers }, `已帶入 ${preset.description}`);
      setBulk({ outer: preset.copperMil, inner: preset.copperMil, coverage: layers[0].coverage });
      return;
    }
    const layers = current.layers.map((layer, index) => ({
      ...layer,
      thickness: index === 0 || index === current.layers.length - 1 ? preset.outerMil : preset.innerMil,
    }));
    replaceForm({ ...current, unit: "mil", layers }, `已帶入 ${preset.description}`);
    setBulk({ outer: preset.outerMil, inner: preset.innerMil, coverage: layers[0]?.coverage ?? "60" });
  }

  function restorePhoto() {
    const example = specExample();
    replaceForm(example, "已套用四層 PCB 規格範例，計算結果如下");
    setBulk({ outer: example.layers[0].thickness, inner: example.layers[1].thickness, coverage: example.layers[0].coverage });
    focusResultsAfterPhoto.current = true;
    setPhotoOpen(false);
  }

  function closePhotoAutoFocus(event: Event) {
    if (!focusResultsAfterPhoto.current) return;
    event.preventDefault();
    focusResultsAfterPhoto.current = false;
    resultPanelRef.current?.focus({ preventScroll: true });
    resultPanelRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }

  async function copyResults() {
    if (!result || !board) return;
    const text = [
      "PCB 等效導熱係數（層內均勻化模型）",
      `PCB 位於 XY 平面，Z 為板厚方向；${form.layers.length} 層，板厚 ${board.thickness} mm`,
      `kX = kY = ${formatResult(result.inPlane, 4)} W/(m·K)`,
      `kZ = ${formatResult(result.throughPlane, 5)} W/(m·K)`,
      `銅 k = ${board.copperK}；基材 k = ${board.dielectricK} W/(m·K)`,
      ...board.layers.map((l, i) => `L${i + 1}: 銅厚 ${inputNumber(l.thickness)} mm；覆銅率 ${inputNumber(l.coverage * 100)}%`),
      `銅層近似 k∥ = ${formatResult(result.copperOnlyK, 4)} W/(m·K)`,
      "未包含導熱孔、阻焊、銅圖形連通性、局部熱源與接觸熱阻；kX = kY 是方向簡化假設。",
    ].join("\n");
    try { await navigator.clipboard.writeText(text); notify("已複製結果與各層參數"); }
    catch { setCopyText(text); }
  }

  async function installApp() {
    if (!installEvent) { setInstallOpen(true); return; }
    try { await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); }
    catch { setInstallOpen(true); }
  }

  function applyUpdate() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(getValues())); }
    catch { notify("目前設定無法保存，請先複製結果再更新。"); return; }
    window.dispatchEvent(new Event("pcb-apply-update"));
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  }

  const unitLabel = UNIT_LABEL[form.unit];
  return <>
    <a className="skip-link" href="#board-settings">前往輸入參數</a>
    <header className="app-header">
      <div className="brand"><img src={withBasePath("/icons/pcb-192-v4.png")} alt="PCB thermal conductivity calculator" width="54" height="54" /><div><h1>pcb-k計算</h1><p>THERMAL CALCULATOR</p></div></div>
      <Button variant="outline" className="app-button install-button" aria-label={installed ? "查看安裝說明" : "安裝 pcb-k計算"} onClick={installApp}><Smartphone aria-hidden="true" /><span>{installed ? "安裝說明" : "安裝 App"}</span></Button>
    </header>
    <main className="page-shell">
      <div className="workspace-topline"><span className="workspace-label"><span className="status-dot" />多層板・各向異性估算</span><span className="save-state" role="status">{storageError ? "設定無法保存" : saved ? <><CheckCheck aria-hidden="true" />已保存於本機</> : "參數即時更新"}</span></div>
      {waitingWorker && <div className="update-banner"><span>有新版本可用，更新會保留目前參數。</span><Button className="app-button" onClick={applyUpdate}>更新 App</Button></div>}
      <div className="workbench">
        <aside className="result-column" id="calculation-results" aria-label="計算結果" ref={resultPanelRef} tabIndex={-1}>
          <div className="result-heading"><h2>計算結果</h2><span>W/(m·K)</span></div>
          <div className="result-grid" aria-live="polite" aria-atomic="true">
            <article className="result-card result-primary"><div className="result-label"><span>板面方向</span><ArrowLeftRight aria-hidden="true" /></div><div className="result-axis">k<sub>X</sub> = k<sub>Y</sub> = k<sub>∥</sub></div><output className="result-number" data-testid="k-in-plane">{formatResult(result?.inPlane, 2)}</output><span className="result-caption">沿 PCB 平面傳熱</span></article>
            <article className="result-card result-secondary"><div className="result-label"><span>厚度方向</span><ArrowDown aria-hidden="true" /></div><div className="result-axis">k<sub>Z</sub> = k<sub>⊥</sub></div><output className="result-number" data-testid="k-through-plane">{formatResult(result?.throughPlane, 3)}</output><span className="result-caption">穿過 PCB 層疊傳熱</span></article>
          </div>
          {error ? <div className="error-box" role="alert"><Info aria-hidden="true" /><span>{error}</span></div> : <div className="result-meta"><span>含銅層與基材</span><span>未計入導熱孔</span></div>}
          <Button variant="outline" className="app-button copy-button" onClick={copyResults} disabled={!result}><Copy aria-hidden="true" />複製結果與參數</Button>
          <p className="axis-note">以上假設 PCB 位於 XY 平面；在模擬軟體中，請依板子方向對應各軸。</p>
          <section className="stack-panel" aria-label="層疊摘要">
            <div className="stack-title"><Layers3 aria-hidden="true" /><h3>層疊摘要</h3><span>{form.layers.length} 層</span></div>
            <div className="stack-visual" aria-label="各銅層覆銅率示意">{form.layers.map((layer, i) => <div className="stack-row" key={fields[i]?.id ?? i}><span>L{i + 1}</span><div className="stack-track"><span style={{ width: `${Math.min(100, Math.max(0, parseDecimal(layer.coverage) ?? 0))}%` }} /></div><span>{parseDecimal(layer.coverage) ?? "—"}%</span></div>)}</div>
            <p className="stack-note"><span className="copper-swatch" />銅覆蓋區 <span className="fr4-swatch" />未覆銅區／基材</p>
            <dl className="stack-stats"><div><dt>銅體積占比</dt><dd>{formatResult(result ? result.copperFraction * 100 : undefined, 2)}<small> %</small></dd></div><div><dt>等效滿版銅厚</dt><dd>{formatResult(result ? result.equivalentCopperThickness * 1000 : undefined, 2)}<small> µm</small></dd></div></dl>
            <p className="stack-note">橫條表示覆銅率，厚度未依比例繪製。</p>
          </section>
        </aside>
        <div className="input-column">
          <section className="panel" id="board-settings">
            <div className="section-heading"><span className="section-number">01</span><h2>基本設定</h2><span className="section-caption">BOARD</span></div>
            <div className="board-fields">
              <label className="field field-wide" htmlFor="board-thickness"><span>PCB 總厚度</span><div className="input-with-unit"><Input id="board-thickness" className="numeric-input" type="text" inputMode="decimal" autoComplete="off" {...register("thickness")} /><span>mm</span></div><small>銅層與 FR4 的堆疊總厚度</small></label>
              <label className="field" htmlFor="copper-k"><span>銅 k 值</span><Input id="copper-k" className="numeric-input" type="text" inputMode="decimal" autoComplete="off" {...register("copperK")} /><small>W/(m·K)</small></label>
              <label className="field" htmlFor="dielectric-k"><span>FR4 k 值</span><Input id="dielectric-k" className="numeric-input" type="text" inputMode="decimal" autoComplete="off" {...register("dielectricK")} /><small>W/(m·K)・可依基材修改</small></label>
            </div>
          </section>
          <section className="panel layer-panel" aria-labelledby="layers-heading">
            <div className="section-heading"><span className="section-number">02</span><h2 id="layers-heading">銅層設定</h2><span className="section-caption">STACK-UP</span></div>
            <div className="layer-toolbar"><label className="count-field" htmlFor="layer-count"><span>銅層數</span><NativeSelect id="layer-count" className="app-select" value={form.layers.length} onChange={(e) => replaceForm(resizeLayers(getValues(), Number(e.target.value)), `已設為 ${e.target.value} 層銅`)}>{Array.from({ length: 32 }, (_, i) => <NativeSelectOption key={i} value={i + 1}>{i + 1} 層</NativeSelectOption>)}</NativeSelect></label><Button variant="ghost" className="app-button photo-button" onClick={() => setPhotoOpen(true)}><ImageIcon aria-hidden="true" />規格範例</Button></div>
            <div className="unit-row"><span>銅厚單位</span><div className="unit-switch" role="group" aria-label="銅厚單位">{(["mil", "um", "mm", "oz"] as CopperUnit[]).map((unit) => <Button key={unit} variant="ghost" className="unit-button" aria-pressed={form.unit === unit} onClick={() => changeUnit(unit)}>{UNIT_LABEL[unit]}</Button>)}</div></div>
            <p className="unit-help">{form.unit === "oz" ? "1 oz 按名義 35 µm 換算，不含製程電鍍。已知成品銅厚時，請改用 mil、µm 或 mm。" : "1 mil = 25.4 µm = 0.0254 mm。銅厚請填實際成品值。"}</p>
            <CopperTablePicker onApply={applyCopperPreset} />
            <Accordion type="single" collapsible className="bulk-accordion"><AccordionItem value="bulk"><AccordionTrigger className="bulk-trigger">批次設定外層、內層與覆銅率</AccordionTrigger><AccordionContent><div className="bulk-fields">
              <label className="field" htmlFor="bulk-outer"><span>外層銅厚</span><Input id="bulk-outer" className="numeric-input" type="text" inputMode="decimal" value={bulk.outer} onChange={(e) => setBulk({ ...bulk, outer: e.target.value })} /><small>{unitLabel}</small></label>
              <label className="field" htmlFor="bulk-inner"><span>內層銅厚</span><Input id="bulk-inner" className="numeric-input" type="text" inputMode="decimal" value={bulk.inner} onChange={(e) => setBulk({ ...bulk, inner: e.target.value })} /><small>{unitLabel}</small></label>
              <label className="field" htmlFor="bulk-coverage"><span>覆銅率</span><Input id="bulk-coverage" className="numeric-input" type="text" inputMode="decimal" value={bulk.coverage} onChange={(e) => setBulk({ ...bulk, coverage: e.target.value })} /><small>%・全部銅層</small></label>
            </div><Button className="app-button apply-bulk" onClick={applyBulk}><Check aria-hidden="true" />套用至所有層</Button></AccordionContent></AccordionItem></Accordion>
            <div className="layers-head" aria-hidden="true"><span>層別</span><span>銅厚 <small>{unitLabel}</small></span><span>覆銅率 <small>%</small></span><span /></div>
            <div className="layer-list">{fields.map((field, index) => {
              const thickness = parseDecimal(form.layers[index]?.thickness);
              const coverage = parseDecimal(form.layers[index]?.coverage);
              const isOuter = index === 0 || index === fields.length - 1;
              return <div className="layer-row" key={field.id}>
                <div className="layer-name"><strong>L{index + 1}</strong><span className={isOuter ? "layer-badge outer" : "layer-badge"}>{isOuter ? "外層" : "內層"}</span></div>
                <div className="layer-input"><Input className="numeric-input" type="text" inputMode="decimal" autoComplete="off" aria-label={`L${index + 1} 銅厚（${unitLabel}）`} aria-invalid={thickness === null || thickness < 0} {...register(`layers.${index}.thickness`)} /><small>{thickness !== null ? `${formatResult(thickness * MM_PER_UNIT[form.unit] * 1000, 3)} µm` : "請輸入銅厚"}</small></div>
                <div className="layer-input"><Input className="numeric-input" type="text" inputMode="decimal" autoComplete="off" aria-label={`L${index + 1} 覆銅率（%）`} aria-invalid={coverage === null || coverage < 0 || coverage > 100} {...register(`layers.${index}.coverage`)} /><small>0–100%</small></div>
                <Button variant="ghost" size="icon" className="remove-button" aria-label={`刪除 L${index + 1}`} disabled={fields.length <= 1} onClick={() => { setUndo(structuredClone(getValues())); remove(index); notify(`已刪除 L${index + 1}`); }}><Trash2 aria-hidden="true" /></Button>
              </div>;
            })}</div>
            <div className="layer-actions"><Button variant="outline" className="app-button add-layer" disabled={fields.length >= 32} onClick={() => replaceForm(resizeLayers(getValues(), fields.length + 1), "已新增一層銅")}><Plus aria-hidden="true" />新增銅層</Button>{undo && <Button variant="ghost" className="app-button undo-button" onClick={() => { const previous = undo; setUndo(null); reset(previous); setBulk({ outer: previous.layers[0].thickness, inner: previous.layers[1]?.thickness ?? previous.layers[0].thickness, coverage: previous.layers[0].coverage }); notify("已還原上一步"); }}><Undo2 aria-hidden="true" />還原上一步</Button>}</div>
            <p className="layer-footnote">第一層與最後一層標示為外層。新增銅層置於最下方外層之前。</p>
          </section>
          <EngineeringTools form={form} board={board} result={result} />
        </div>
      </div>
      <FormulaDetails calculated={calculated} showPhoto={() => setPhotoOpen(true)} />
      <footer className="app-footer"><span className={offline ? "connection-state is-offline" : "connection-state"}>{offline ? <WifiOff aria-hidden="true" /> : <span className="status-dot" />}{offline ? "離線使用中" : offlineReady ? "已備妥離線使用" : "連線使用中"}</span><span>pcb-k計算 · v1.5</span><a href="#board-settings">回到參數 <ChevronRight aria-hidden="true" /></a></footer>
    </main>
    <SpecExampleDialog open={photoOpen} onOpenChange={setPhotoOpen} onApply={restorePhoto} onCloseAutoFocus={closePhotoAutoFocus} />
    <Dialog open={installOpen} onOpenChange={setInstallOpen}><DialogContent className="app-dialog" showCloseButton={false}><DialogHeader><img className="install-icon" src={withBasePath("/icons/pcb-apple-v4.png")} width="76" height="76" alt="簡化 PCB λ 導熱計算桌面圖示" /><DialogTitle>將 pcb-k計算 加入主畫面</DialogTitle><DialogDescription>圖示為簡化的 PCB、熱流與「PCB λ」字樣，名稱為「pcb-k計算」。</DialogDescription></DialogHeader><div className="install-instructions"><h3>iPhone / iPad</h3><ol><li>用 <b>Safari</b> 開啟<a href={withBasePath("/install-v4/")}>新版圖示安裝頁</a>。</li><li>點「分享」，選「加入主畫面」。</li><li>確認圖示顯示 <b>PCB λ 導熱圖</b>，名稱為 <b>pcb-k計算</b>，開啟「作為網頁 App 打開」，再點「新增」。</li></ol><p>重開舊 App 不會更新主畫面圖示；請先加入新版，確認後再移除舊捷徑。</p><h3>Android / 電腦</h3><p>使用 Chrome 或 Edge，點網址列的安裝圖示，或選單中的「安裝應用程式」。</p><p className="install-offline">請先連網開啟，等頁尾顯示「已備妥離線使用」，之後即可離線計算。</p></div><DialogClose asChild><Button className="app-button">知道了</Button></DialogClose></DialogContent></Dialog>
    <Dialog open={copyText !== null} onOpenChange={(open) => !open && setCopyText(null)}><DialogContent className="app-dialog" showCloseButton={false}><DialogHeader><DialogTitle>複製計算結果</DialogTitle><DialogDescription>目前瀏覽器無法直接複製，請長按下方文字，全選並複製。</DialogDescription></DialogHeader><Textarea className="copy-textarea" aria-label="完整計算結果" value={copyText ?? ""} readOnly onFocus={(e) => e.target.select()} /><DialogClose asChild><Button className="app-button">完成</Button></DialogClose></DialogContent></Dialog>
    {toast && <div className="app-toast" role="status"><span>{toast}</span><button type="button" aria-label="關閉提示" onClick={() => setToast("")}><X aria-hidden="true" /></button></div>}
  </>;
}
