# eBirdRecentHotspot

[網站](https://christorng.idv.tw/eBirdRecentHotspot/) · [原始碼](https://github.com/ChrisTorng/eBirdRecentHotspot)

固定 HTML/CSS/JS，production 只使用官方 eBird API；前端不接觸金鑰。

## 逐日資料

- `main` 放前端、scripts、tests、examples；`data` branch 放 `data/index.json`、`locations.json` 與 `snapshots/YYYY-MM-DD.json`。
- 先讀 `/v2/ref/region/list/subnational1/TW?fmt=json`，再對所有縣市逐日讀 `/v2/product/lists/{regionCode}/{year}/{month}/{day}?maxResults=200&sortKey=obs_dt`。不再抓 TW，全台由縣市合併。
- 每次重抓台灣時間今天、昨天、前天、大前天，覆寫日期檔案，以更新補登／修改。超過四天的修改不會自動追溯，可手動指定日期補抓。
- **日期端點仍最多 200 份，官方未提供分頁，無法保證完整單日。** 達 200 筆就記錄 `possiblyTruncated: true`，畫面列出縣市及日期；恰好 200 也提示。今天尚未結束，少於上限也不代表日後不會新增。
- 官方文件的日期 feed 描述使用 submitted，並提供 obs_dt／creation_dt 排序。程式保存指定日期的 API feed，畫面依實際 `observedAt` 過濾，不將擷取時間冒充觀察時間。
- 全部四日請求成功才開始寫入，build 成功才提交 data branch／發布。網路、429、5xx 最多試三次；其他 HTTP 錯誤停止。不以範例替代 production。
- 前端最後日期／天數預設今天／四天，可選 1–31 天。`date=latest` 使用索引最新日期；例如 `?date=2026-09-24&days=4&location=TW-TPE`。缺日會提示，不冒充零筆。
- `?data=examples` 的今天固定指示範最新日期，避免離線範例隨日曆失效；production 使用台灣今天。

參考：[eBird 官方 API 文件](https://documenter.getpostman.com/view/664302/S1ENwy59)。

## 精簡 JSON 與歷史相容

Snapshot schema v2 以清單 ID 為 key：

```json
{
  "schemaVersion": 2,
  "feedKind": "daily",
  "date": "2026-09-25",
  "fetchedAt": "2026-09-25T00:00:00.000Z",
  "regions": [{"code":"TW","name":"台灣"},{"code":"TW-TXG","name":"Taichung City"}],
  "coverage": {"TW-TXG":{"count":1,"possiblyTruncated":false}},
  "regionChecklists": {"TW-TXG":["S395919213"]},
  "checklists": {
    "S395919213": {"locId":"L7983126","userDisplayName":"Shih-Chun Huang","numSpecies":12,"observedAt":"2026-09-25T06:58"}
  }
}
```

`TW` 不另存 ID 陣列，由縣市聯集產生。共用 `locations.json` 為 `{"schemaVersion":1,"updatedAt":"...","locations":{"L7983126":{"name":"台中--台中都會公園北側停車場","isHotspot":true}}}`。

- 不保存 subID、locID、多份日期表示、重複地點名稱、重複座標欄位及階層名稱；地點字典保留一組有效 lat／lng 供地圖連結。production JSON 不縮排。
- 地點字典持續新增／更新並保留歷史用到的地點。較舊快照不覆蓋較新名稱；歷史畫面使用目前字典名稱與熱點狀態。
- 不同鳥友的清單 ID 皆保留，同行合併僅在顯示層。
- 舊 v1／v2 最近清單快照仍可讀，但不視為逐日完整資料。畫面依觀察日期篩選、同 ID 取最新擷取版本，並提示舊資料限制。
- 新一輪抓取覆寫最近四日舊快照，其他舊歷史保留。Actions 的 migrate 將 v1 壓縮成 v2，驗證參照，不偽裝成 daily feed，不改寫 Git history。

## 畫面

保留原繁體中文縣市名稱與順序。中英地點去除括號英文翻譯，提示保留原名；僅英文名稱不猜譯。

桌面使用緊湊比較表；760px 以下改為地點分組，數字仍對齊，地區改下拉選單，無須水平捲動。附 manifest 與 192／512 圖示，供瀏覽器加入主畫面／獨立視窗；未提供離線資料快取，查詢需網路。

同地點、完整時間、鳥種數相同的清單合併；缺時間或鳥種數不合併。依原始清單數及最新日期排序（去除重複 ID，每個人的清單仍各算一筆）；鳥友數按不同顯示名稱，平均鳥種為最近一天合併紀錄的平均，不是鳥種聯集。

地點名稱與箭頭共同展開，鳥點及 Google Maps 座標連結在右側，手機上下排列。個人鳥點連至最新清單以查看地點資訊。日期連至第一人清單；多人合併列各鳥友各自連結，單人列鳥友名純文字。外部連結另開並有 ↗；個人地點不產生公開 hotspot 連結。

## 無金鑰開發

Node.js 22+，無 npm 依賴：

```sh
npm test
npm run examples
python -m http.server 8000 --bind 127.0.0.1
```

開啟 `http://localhost:8000/?data=examples`。合成 fixtures 包含同行、重複 ID、同名不同地點、缺欄位、跨年、極端數字、HTML 注入字串；範例含空縣市、200 筆上限及缺日。跨年範例選 2026-01-01、臺北市。

```sh
node scripts/build.mjs examples/data
```

開啟 `http://localhost:8000/_site/?date=latest` 測試 project path。所有資源與 JSON 路徑相對專案，不使用 `/data/...`。

## 本機 API 資料

至 [eBird API keygen](https://ebird.org/api/keygen) 取得金鑰；PowerShell：

```powershell
$env:EBIRD_API_KEY = '你的金鑰'
npm run collect
# 指定最後日期及回抓天數：
node scripts/collect.mjs .local-data 2026-09-25 4
npm run build
```

`?data=local` 使用 `.local-data/`；`_site/` 則使用 `data/`。兩個本機目錄已忽略，勿提交。舊資料可用 `npm run migrate` 轉換。

## GitHub Actions / Pages

1. Settings → Secrets and variables → Actions：在 **Env** environment 設定 `EBIRD_API_KEY`（也支援 repository secret）。
2. **Settings → Pages → Source 必須選 GitHub Actions。** 直接發布 main 沒有 production JSON，預設 `pages build and deployment` 又會與自訂 workflow 互相覆蓋，導致 `data/index.json` 404。
3. 自訂 `Collect and publish` 應是唯一部署流程。workflow 現在檢查 Pages source，不符明確失敗；修正設定後執行新 workflow。
4. collect job 使用 **Env**：測試、準備 data branch、回抓四天、migrate、build、提交 data 並上傳 `_site` artifact。
5. deploy job 使用 **github-pages**，部署同一 artifact。需要 contents write、pages write、id-token write；data branch 保護須容許 Actions 更新。
6. Push main、workflow_dispatch、台灣每日 06:00（UTC `0 22 * * *`）執行，排程可能延遲。data push 不觸發。本專案不放 CNAME，沿用使用者 Pages 自訂網域。

secret 讀不到時確認 environment 名稱為 **Env**。重跑舊 run 仍使用舊 workflow，修改後應啟動新 run。

參考：[GitHub Pages 發布來源設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。舊 [eBird repo](https://github.com/ChrisTorng/eBird) 保留 alerts 與搬遷入口。

地圖使用 [Google Maps 座標搜尋 URL](https://developers.google.com/maps/documentation/urls/get-started)。舊精簡資料沒有座標時顯示灰色「地圖」，待該地點重新擷取補齊；不猜測位置。

熱門指標與曲線尚在討論，詳見 [熱門排序提案](docs/hotness-proposal.md)，目前尚未套用新評分。
