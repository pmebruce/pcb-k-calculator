// Values transcribed independently in each printed unit from the three supplied
// procurement tables. Preserve their rounding; do not derive mil from µm.
export type CopperThickness = { um: string; mil: string };
export type CopperTable = {
  number: number;
  clause: string;
  title: string;
  englishTitle: string;
  description: string;
  englishDescription: string;
  columns: { label: string; platingMil?: string }[];
  rows: { oz: string; thicknesses: CopperThickness[] }[];
};

export const PCB_COPPER_TABLES: readonly CopperTable[] = [
  {
    number: 3, clause: "5.2.1", title: "外層成品銅厚", englishTitle: "OUTER COPPER",
    description: "製程完成後，原銅箔加上鍍銅的最小導體厚度。",
    englishDescription: "Copper foil + copper plating, after processing",
    columns: [{ label: "孔銅厚度", platingMil: "1" }, { label: "孔銅厚度", platingMil: "1.2 & 1.4" }],
    rows: [
      { oz: "0.5", thicknesses: [{ um: "38.4", mil: "1.512" }, { um: "43.5", mil: "1.712" }] },
      { oz: "1.0", thicknesses: [{ um: "52.9", mil: "2.083" }, { um: "57.9", mil: "2.283" }] },
      { oz: "1.5", thicknesses: [{ um: "68.3", mil: "2.689" }, { um: "73.4", mil: "2.889" }] },
      { oz: "2.0", thicknesses: [{ um: "83.7", mil: "3.295" }, { um: "88.8", mil: "3.495" }] },
      { oz: "3.0", thicknesses: [{ um: "113.6", mil: "4.472" }, { um: "118.7", mil: "4.672" }] },
      { oz: "4.0", thicknesses: [{ um: "144.5", mil: "5.689" }, { um: "149.6", mil: "5.889" }] },
      { oz: "5.0", thicknesses: [{ um: "174.5", mil: "6.870" }, { um: "179.5", mil: "7.070" }] },
    ],
  },
  {
    number: 4, clause: "5.2.2", title: "內層銅箔厚度", englishTitle: "INNER COPPER",
    description: "製程完成後，內層銅箔的最小厚度。",
    englishDescription: "Internal layer copper foil, after processing",
    columns: [{ label: "最小成品導體厚度" }],
    rows: [
      { oz: "0.5", thicknesses: [{ um: "11.4", mil: "0.449" }] },
      { oz: "1.0", thicknesses: [{ um: "24.9", mil: "0.980" }] },
      { oz: "2.0", thicknesses: [{ um: "55.7", mil: "2.193" }] },
      { oz: "3.0", thicknesses: [{ um: "86.6", mil: "3.409" }] },
      { oz: "4.0", thicknesses: [{ um: "117.5", mil: "4.626" }] },
      { oz: "5.0", thicknesses: [{ um: "148.3", mil: "5.839" }] },
      { oz: "6.0", thicknesses: [{ um: "179.2", mil: "7.056" }] },
    ],
  },
  {
    number: 5, clause: "5.2.3", title: "單面板銅箔厚度", englishTitle: "SINGLE-SIDED BOARD",
    description: "製程完成後，單面板銅箔的最小厚度。",
    englishDescription: "Single-sided board copper foil, after processing",
    columns: [{ label: "最小成品導體厚度" }],
    rows: [
      { oz: "0.5", thicknesses: [{ um: "11.4", mil: "0.449" }] },
      { oz: "1.0", thicknesses: [{ um: "24.9", mil: "0.980" }] },
      { oz: "2.0", thicknesses: [{ um: "55.7", mil: "2.193" }] },
      { oz: "3.0", thicknesses: [{ um: "86.6", mil: "3.409" }] },
      { oz: "4.0", thicknesses: [{ um: "117.5", mil: "4.626" }] },
      { oz: "5.0", thicknesses: [{ um: "148.3", mil: "5.839" }] },
    ],
  },
];
