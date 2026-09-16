// Transcribed from the user's four-layer PWB specification image.
// All individual layer thicknesses are minima, not finished-stack exact values.
export const PCB_SPEC = {
  totalMm: "1.57", toleranceMm: "0.15",
  totalMil: "61.8", toleranceMil: "5.9",
  layers: [
    { label: "L1", position: "Outside", material: "Copper foil", kind: "copper", minimumMil: "3.8" },
    { label: "", position: "", material: "Prepreg", kind: "prepreg", minimumMil: "10" },
    { label: "L2", position: "Inner", material: "Copper foil", kind: "copper", minimumMil: "3.409" },
    { label: "", position: "", material: "Core", kind: "core", minimumMil: "15" },
    { label: "L3", position: "Inner", material: "Copper foil", kind: "copper", minimumMil: "3.409" },
    { label: "", position: "", material: "Prepreg", kind: "prepreg", minimumMil: "10" },
    { label: "L4", position: "Outside", material: "Copper foil", kind: "copper", minimumMil: "3.8" },
  ],
  assumptions: { copperK: "385", dielectricK: "0.3", coverage: "60" },
} as const;
