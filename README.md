# pcb-k計算

手機與桌面使用的多層 PCB 等效導熱係數計算器。可設定 1–32 層銅、各層成品銅厚與覆銅率；同時計算板面 kX = kY 與板厚 kZ。另可從 Table 3–5 一鍵填入成品銅厚、檢查銅箔／Core／Prepreg 堆疊總厚度，並估算 Thermal Via 陣列對指定區域 kZ 與熱阻的改善。輸入只保存在本機瀏覽器。

「規格範例」會開啟重新繪製的四層 PCB 規格圖，可放大 SVG 或儲存 PNG。保留原圖的 Copper foil、Prepreg、Core、各層厚度下限與總板厚公差。只查看時不修改目前參數；按「套用四層範例」才載入四層範例並捲動至結果，可使用原有復原功能。兩種規格圖均可離線查看。

規格圖下方追加三張重新排版的 PCB 採購表：Table 3 外層成品銅厚、Table 4 內層銅箔厚度、Table 5 單面板銅箔厚度。App 使用可直接閱讀的文字表格，另提供同款 SVG／PNG 圖片。原圖的 µm 與 mil 欄位獨立照錄，保留小數位，不自行重新換算或補入原圖沒有的列。三表與所有下載圖也納入離線資源。

## 計算方式

以 k_i = c_i k_Cu + (1-c_i) k_FR4 均勻化各銅層；板面方向採平行熱阻，厚度方向採層間串聯。後者假設層內等溫；基礎 PCB 模型不解析佈線方向、連通性、導熱孔、阻焊、接觸熱阻或局部熱擴散。Thermal Via 另以鍍銅孔壁與剩餘板材的平行穿板導熱模型估算，孔內視為不導熱，未計焊盤與填孔材料。

目前規格範例：四層銅，L1／L4 最小 3.8 mil，L2／L3 最小 3.409 mil，兩層 Prepreg 各最小 10 mil，Core 最小 15 mil。總板厚 1.57 ± 0.15 mm（61.8 ± 5.9 mil）。各層下限加總只有 49.418 mil = 1.2552172 mm，不能替代標稱總板厚；計算以 1.57 mm 與最小銅厚代入，其餘 1.2037828 mm 作為 FR4。

新圖未提供覆銅率或材料 k 值；範例明確標示沿用覆銅率 60%、k_Cu = 385、k_FR4 = 0.3 的假設，可在套用後修改。此設定 kXY = 54.14092618089172、kZ = 0.39111215162794085 W/(m·K)。首次使用採此四層範例，既有瀏覽器保存的設定會照常載入。舊六層照片數值仍保留為計算模型的回歸參考，不作為目前的規格圖。

1 mil = 0.0254 mm；oz 以名義銅箔 1 oz = 35 µm 換算，不含電鍍。成品銅厚應優先使用板廠數值。

## GitHub Pages

公開網址：<https://pmebruce.github.io/pcb-k-calculator/>

推送至 `main` 後，GitHub Actions 會執行型別檢查、計算測試與靜態建置，再自動發布 `dist/client`。部署時以 `/pcb-k-calculator` 為 PWA 基礎路徑，因此首頁、安裝入口、圖示、規格圖及離線快取都能在 GitHub Pages 的專案子目錄正常運作。

## 本機維護

- `npm ci`：依 lockfile 安裝。
- `npm run build`：產生靜態 App 與所有離線資源清單。
- `npm run test:pcb`：物理極限、解析參考值、單位轉換與輸入防呆測試。
- `node --test tests/pwa.test.mjs`：建置後的 PWA 設定與離線快取測試。
- `node scripts/create-icons.mjs`：由 SVG 字標重新產生 PCB 圖示，需 sharp。
- `node --experimental-strip-types scripts/create-pcb-spec.mjs`：由 `lib/pcb-spec.ts` 的原圖數值重繪 SVG／PNG 規格圖，需 sharp。圖面與計算範例共用這份數值。
- `node --experimental-strip-types scripts/create-copper-tables.mjs`：由 `lib/pcb-copper-tables.ts` 產生 Table 3–5 的 SVG／PNG；畫面與圖片共用這份原表數值。

靜態輸出為 `dist/client`。App 名稱與主畫面名稱均為 `pcb-k計算`；圖示為滿版深藍背景的 PCB 導熱計算圖，沒有內縮邊框或凸起段差。

PNG 圖示直接內嵌於 manifest 與 apple-touch-icon，並保留根目錄 `apple-touch-icon.png` 與 precomposed PNG，確保安裝到主畫面時顯示同一張滿版圖示。

`/pcb-k-calculator/pcb-k/` 與 GitHub Pages 首頁提供相同計算器，是重新安裝的入口。兩個入口皆完整離線快取，並保留原本 localStorage 設定鍵。只有新版入口也已快取時，頁尾才會顯示「已備妥離線使用」。

離線模式只快取本 App 的殼層、腳本、樣式與圖示，不攔截登入路徑或外部網域。所有離線資源完整下載後才啟用；新版本下載完成後，由使用者選擇更新並保留輸入。

## 參考

- [MIT 熱阻原理](https://web.mit.edu/16.unified/www/FALL/thermodynamics/notes/node118.html)
- [SimScale PCB 等效 k 計算](https://www.simscale.com/forum/t/calculating-effective-thermal-conductivity-for-pcbs/96307)
- [Eurocircuits 銅厚公差與名義厚度](https://www.eurocircuits.com/technical-guidelines/understanding-manufacturing-tolerances-on-a-pcb/tolerances-on-copper-thickness/)
- [WebKit Safari 26 的圖示與 Data URL 支援](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [MDN：需要登入憑證的 manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)
