import assert from 'node:assert/strict';
import test from 'node:test';
import { photoExample, specExample, boardFromForm, calculateBoard, evaluateForm, convertUnit, resizeLayers, parseDecimal } from '../lib/pcb.ts';
import { PCB_SPEC } from '../lib/pcb-spec.ts';
import { calculateStackupCheck, calculateThermalVias } from '../lib/engineering-tools.ts';

const close = (a,b,tolerance=1e-10) => assert.ok(Math.abs(a-b) <= tolerance * Math.max(1,Math.abs(b)), `${a} differs from ${b}`);

test('four-layer specification uses nominal board thickness and the copper minima in mil', () => {
  const form=specExample();const value=evaluateForm(form);
  assert.equal(value.error,null);assert.equal(form.unit,'mil');assert.equal(form.thickness,'1.57');
  assert.deepEqual(form.layers.map(layer=>layer.thickness),['3.8','3.409','3.409','3.8']);
  assert.ok(form.layers.every(layer=>layer.coverage==='60'));
  close(value.result.copperLayerThickness,.3662172);
  close(value.result.dielectricThickness,1.2037828);
  close(value.result.inPlane,54.14092618089172);
  close(value.result.throughPlane,.39111215162794085);
  const minimumStackMm=PCB_SPEC.layers.reduce((sum,layer)=>sum+Number(layer.minimumMil)*.0254,0);
  close(minimumStackMm,1.2552172);
  assert.notEqual(value.board.thickness,minimumStackMm);
});

test('photo inputs retain actual mil thicknesses and reconcile the copper-only result', () => {
  const value = evaluateForm(photoExample());
  assert.equal(value.error, null);
  close(value.result.inPlane,30.4107517545);
  close(value.result.throughPlane,0.3449393528168286);
  close(value.result.copperOnlyK,30.134232975);
  assert.equal(value.result.copperOnlyK.toFixed(1),'30.1');
  assert.equal(value.result.throughPlane.toFixed(2),'0.34');
  close(value.result.equivalentCopperThickness,0.125233176);
});

test('zero coverage and zero-thickness copper both reduce to pure FR4', () => {
  const board=boardFromForm(photoExample());
  for(const layers of [board.layers.map(l=>({...l,coverage:0})),board.layers.map(l=>({...l,thickness:0}))]) {
    const value=calculateBoard({...board,layers});
    close(value.inPlane,.3);close(value.throughPlane,.3);close(value.copperFraction,0);
  }
});

test('pure copper and equal constituent conductivities have the correct physical limits', () => {
  const pure=calculateBoard({thickness:.1,copperK:385,dielectricK:.3,layers:[{thickness:.05,coverage:1},{thickness:.05,coverage:1}]});
  close(pure.inPlane,385);close(pure.throughPlane,385);
  const equal=calculateBoard({...boardFromForm(photoExample()),copperK:2,dielectricK:2});
  close(equal.inPlane,2);close(equal.throughPlane,2);
});

test('a continuous 10% metal slab matches an analytical parallel/series reference', () => {
  const value=calculateBoard({thickness:1,copperK:100,dielectricK:1,layers:[{thickness:.1,coverage:1}]});
  close(value.inPlane,10.9);close(value.throughPlane,1.109877913429523);
});

test('unit switching preserves the same physical board, including repeated round trips', () => {
  let form=photoExample();const expected=evaluateForm(form).result;
  for(let i=0;i<10;i++) for(const unit of ['um','mm','oz','mil']) {
    form=convertUnit(form,unit);const value=evaluateForm(form).result;
    close(value.inPlane,expected.inPlane,1e-9);close(value.throughPlane,expected.throughPlane,1e-9);
  }
  const oneOz={...photoExample(),unit:'oz',layers:[{thickness:'1',coverage:'100'}]};
  close(boardFromForm(oneOz).layers[0].thickness,.035);
});

test('adding and reducing layers preserve the existing outer copper specifications', () => {
  const form=photoExample();form.layers[5]={thickness:'3',coverage:'90'};
  const added=resizeLayers(form,8);
  assert.equal(added.layers.length,8);assert.deepEqual(added.layers[0],form.layers[0]);assert.deepEqual(added.layers[7],form.layers[5]);
  assert.deepEqual(resizeLayers(added,2).layers,[form.layers[0],form.layers[5]]);
  assert.equal(resizeLayers(form,1).layers.length,1);
  assert.throws(()=>resizeLayers(form,33));
});

test('incomplete decimals remain invalid rather than silently becoming zero', () => {
  assert.equal(parseDecimal(''),null);assert.equal(parseDecimal('.'),null);assert.equal(parseDecimal('3.5'),3.5);
  assert.equal(parseDecimal('3.'),3);assert.equal(parseDecimal('.3'),.3);assert.equal(parseDecimal('3,5'),3.5);
  assert.equal(parseDecimal('12abc'),null);assert.equal(parseDecimal('Infinity'),null);
  const form=photoExample();form.thickness='';assert.equal(evaluateForm(form).result,null);
});

test('nonphysical board thickness, conductivity, copper thickness and coverage are rejected', () => {
  for(const field of ['thickness','copperK','dielectricK']) for(const value of ['0','-1','NaN','Infinity']) {
    const form=photoExample();form[field]=value;assert.equal(evaluateForm(form).result,null);
  }
  for(const value of ['-1','100.01','']) {const form=photoExample();form.layers[0].coverage=value;assert.equal(evaluateForm(form).result,null);}
  const tooThick=photoExample();tooThick.thickness='.1';assert.match(evaluateForm(tooThick).error,/超過/);
  const negative=photoExample();negative.layers[0].thickness='-1';assert.equal(evaluateForm(negative).result,null);
});

test('increasing coverage raises both estimates within the material conductivity bounds', () => {
  let previousXY=0,previousZ=0;
  for(const coverage of [0,.1,.4,.6,1]) {
    const original=boardFromForm(photoExample());
    const value=calculateBoard({...original,layers:original.layers.map(l=>({...l,coverage}))});
    assert.ok(value.inPlane>=previousXY && value.throughPlane>=previousZ);
    assert.ok(value.inPlane>=.3-1e-12 && value.inPlane<=385);
    assert.ok(value.throughPlane>=.3-1e-12 && value.throughPlane<=385);
    previousXY=value.inPlane;previousZ=value.throughPlane;
  }
});

test('stack-up check adds copper, Core, Prepreg and other thickness against board tolerance', () => {
  const value=calculateStackupCheck({boardThicknessMm:1.57,toleranceMm:.15,copperThicknessMm:.3662172,coreCount:1,coreThicknessMm:.381,prepregCount:2,prepregThicknessMm:.254,otherThicknessMm:0});
  close(value.stackTotalMm,1.2552172);close(value.lowerLimitMm,1.42);close(value.upperLimitMm,1.72);
  close(value.deltaToNominalMm,.3147828);close(value.outsideByMm,.1647828);assert.equal(value.status,'under');
  const nominal=calculateStackupCheck({...value,prepregThicknessMm:.4113914});
  close(nominal.stackTotalMm,1.57);assert.equal(nominal.status,'within');
  assert.throws(()=>calculateStackupCheck({...value,coreCount:1.5}),/整數/);
});

test('thermal via barrels add a parallel through-plane path over the selected area', () => {
  const input={count:16,drillDiameterMm:.3,platingThicknessMm:.025,areaWidthMm:10,areaHeightMm:10,boardThicknessMm:1.57,boardK:.39111215162794085,copperK:385};
  const value=calculateThermalVias(input);
  close(value.outerDiameterMm,.35);close(value.barrelAreaEachMm2,Math.PI/4*(.35**2-.3**2));
  assert.ok(value.effectiveKWithVia>input.boardK);assert.ok(value.resistanceWithVia<value.resistanceWithoutVia);
  assert.ok(value.resistanceReductionPercent>0 && value.resistanceReductionPercent<100);
  const doubled=calculateThermalVias({...input,count:32});
  assert.ok(doubled.viaConductance>value.viaConductance);assert.ok(doubled.resistanceWithVia<value.resistanceWithVia);
  assert.throws(()=>calculateThermalVias({...input,areaWidthMm:.1,areaHeightMm:.1}),/超過計算區域/);
});
