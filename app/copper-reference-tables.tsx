import { Download, ExternalLink } from "lucide-react";
import { PCB_COPPER_TABLES } from "@/lib/pcb-copper-tables";
import { withBasePath } from "@/lib/base-path";

export function CopperReferenceTables() {
  return <section className="copper-references" aria-labelledby="copper-references-title">
    <div className="copper-references-intro">
      <h3 id="copper-references-title">PCB 採購規範</h3>
      <p>製程完成後的最小銅厚，依你提供的 Table 3–5 重繪。</p>
      <span className="copper-unit-note">1 mil = 0.001 in</span>
    </div>
    {PCB_COPPER_TABLES.map((table) => <article className="copper-table-card" key={table.number} aria-labelledby={`copper-table-${table.number}-title`}>
      <header className="copper-table-heading">
        <span className="copper-table-tag">TABLE {table.number}<small>§ {table.clause}</small></span>
        <h4 id={`copper-table-${table.number}-title`}>{table.title}</h4>
        <p>{table.description}</p>
      </header>
      <div className="copper-table-frame">
        <table className={`copper-reference-table ${table.columns.length > 1 ? "copper-reference-outer" : ""}`}>
          <caption className="sr-only">Table {table.number}：{table.title}，依基銅重量列出最小成品導體厚度</caption>
          <colgroup><col className="copper-weight-column" />{table.columns.map((_, index) => <col key={index} />)}</colgroup>
          <thead>{table.columns.length > 1 ? <>
            <tr><th scope="col" rowSpan={2}><span>基銅</span><span>重量</span><small>oz</small></th><th scope="colgroup" colSpan={table.columns.length}>成品導體厚度<small>最小值</small></th></tr>
            <tr>{table.columns.map((column, index) => <th scope="col" key={index}><span className="plating-label">{column.label}</span><strong>{column.platingMil}</strong><small>mil</small></th>)}</tr>
          </> : <tr><th scope="col">基銅重量<small>oz</small></th><th scope="col">成品導體厚度<small>最小值</small></th></tr>}</thead>
          <tbody>{table.rows.map((row) => <tr key={row.oz}>
            <th scope="row">{row.oz}</th>
            {row.thicknesses.map((thickness, index) => <td key={index}><span className="copper-thickness-value">{thickness.um}<small>µm</small></span><span className="copper-thickness-mil">{thickness.mil} mil</span></td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <div className="copper-table-downloads">
        <a href={withBasePath(`/examples/pcb-table-${table.number}-v1.svg`)} target="_blank" rel="noreferrer" aria-label={`放大 Table ${table.number} 重繪圖`}>放大表格<ExternalLink aria-hidden="true" /></a>
        <a href={withBasePath(`/examples/pcb-table-${table.number}-v1.png`)} download={`PCB-Table-${table.number}.png`} aria-label={`儲存 Table ${table.number} 圖片`}>儲存圖片<Download aria-hidden="true" /></a>
      </div>
    </article>)}
    <p className="copper-reference-source">µm 與 mil 均照原表列值保留，未重新換算。</p>
  </section>;
}
