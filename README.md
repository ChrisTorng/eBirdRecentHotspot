# eBirdRecentHotspot

[網站](https://christorng.idv.tw/eBirdRecentHotspot/) · [原始碼](https://github.com/ChrisTorng/eBirdRecentHotspot)

eBird 最近熱門地點網站。production 使用官方 API，前端不接觸 API key。

## 架構

- `main`：固定 HTML/CSS/JS、scripts、tests、可提交的 examples。
- `data` branch：`data/index.json`、共用 `data/locations.json` 與 `data/snapshots/YYYY-MM-DD.json`，由 Actions 首次執行時建立。
- Snapshot v2 含 `schemaVersion`、台灣日期 `date`、UTC 擷取時間 `fetchedAt`、`regions`、每區清單 ID 陣列 `regionChecklists`，以及以 `subId` 為 key 的 `checklists`。API 原始回應僅於擷取時暫存在記憶體，不再直接存檔。
- 先用 `/v2/ref/region/list/subnational1/TW?fmt=json` 取得所有縣市，再抓 `TW` 及每個回傳地區的 `/v2/product/lists/{regionCode}?maxResults=200`。快照保留 API 原始名稱；前端使用原版的繁體中文縣市名稱與順序（台灣、六都、其餘縣市、離島），只列出該快照提供的地區。
- 每個地區最多最近 200 筆，不是該日完整調查。全台獨立擷取，並非縣市清單聯集。快照日期與觀察日期不同。
- 台灣時間一日一檔，同日重跑覆寫、保留歷史。全部請求成功才寫檔及發布；失敗保留既有網站。網路、429、5xx 最多嘗試三次，其他 HTTP 錯誤立即失敗。
- 日期索引的 `latest` 指向最新日期；未指定 date 或 `date=latest` 都使用 latest。未知日期／地區顯示錯誤。
- 依地點 ID 分組、清單 ID 去重，同地點、完整觀察時間、鳥種數相同的清單合併為一筆紀錄（缺時間或鳥種數不合併），以合併後紀錄數及最近日期排序。鳥友數為不同顯示名稱數；平均鳥種不是鳥種聯集。個人地點不產生 hotspot 連結。
- 畫面沿用原版比較表，新增最右側 eBird 地點欄，左側固定對齊紀錄／人、最近日期、平均鳥種／紀錄，右側地點名稱和箭頭共同作為展開按鈕。日期連至合併組第一人的清單，各鳥友連至自己的清單；鳥種數只顯示數字。紀錄數、當日筆數和平均皆以合併後計算，人數保留所有不同鳥友名稱。所有外部連結另開分頁／視窗並顯示 ↗；個人地點無公開 hotspot 頁，請由清單查看。中英並列地點隱藏括號內的英文翻譯，滑鼠提示保留完整 API 名稱；只有英文的名稱照原文顯示，不猜譯。

參考：[官方 eBird API 文件](https://documenter.getpostman.com/view/664302/S1ENwy59)。

## 精簡資料格式與舊資料轉換

每日快照只保存每份清單一次；TW 與縣市可以參照同一 ID，各地區仍保留 API 原本的成員和順序，不將 TW 換成縣市聯集。例如：

```json
{
  "schemaVersion": 2,
  "date": "2026-09-25",
  "fetchedAt": "2026-09-25T00:00:00.000Z",
  "regions": [{"code":"TW","name":"台灣"},{"code":"TW-TXG","name":"Taichung City"}],
  "regionChecklists": {"TW":["S395919213"],"TW-TXG":["S395919213"]},
  "checklists": {
    "S395919213": {"locId":"L7983126","userDisplayName":"Shih-Chun Huang","numSpecies":12,"observedAt":"2026-09-25T06:58"}
  }
}
```

共用 `locations.json` 的格式為 `{"schemaVersion":1,"updatedAt":"...","locations":{"L7983126":{"name":"台中--台中都會公園北側停車場(Taichung--Taichung Metropolitan Park Northern Parking Lot)","isHotspot":true}}}`。

- `subId` 作為 key，不再重複 `subID`。`locId` 只留作地點參照，不再存 `locID`。
- `obsDt`／`obsTime`／`isoObsDate` 統一為 `observedAt`；無時間的觀察保留日期，無效日期為空字串，不虛構時間。
- 地點只留 `name` 和 `isHotspot`。移除重複名稱、未使用的座標、國家／行政區名稱和 `hierarchicalName`，目前畫面不需要重建階層名稱。
- 同次擷取若不同地區回傳同一 subId 的不同內容，以第一次出現為準。不同鳥友的 subId 仍全部保留；畫面中的同行合併是另外一層。
- 地點字典每天新增／更新，保留歷史用到的地點；補較舊快照不覆蓋新名稱。歷史頁面會使用**目前字典中的地點名稱與熱點狀態**，並非當時的名稱；每日清單內容仍獨立保存。
- 所有 production JSON 採無縮排格式，降低傳輸量。字典隨歷史地點累積；瀏覽器可使用 HTTP 快取重新驗證共用檔案。
- 前端同時支援 v1 與 v2，v1 不需要字典。Actions 在 build 前自動轉換 data branch 現存 v1 快照，並驗證所有參照，成功後才一起 commit／部署。Git 過往 commit 中的原始資料仍在，這次不重寫 Git history。

本機轉換舊資料（不需要 API key）：

```sh
npm run migrate
# 指定其他資料根目錄：
node scripts/migrate.mjs .data-worktree/data
```

轉換可重跑；已有 v2 檔不重複處理。`npm run examples` 會產生 v2 範例，`examples/fixtures/` 保留可閱讀的原始格式測試資料。

以 2026-09-25 的完整資料實測：原檔 4,333,056 bytes；v2 快照 574,669 bytes，加地點字典 190,657 bytes，首次合計 765,326 bytes（減少 82.3%，未計 HTTP 壓縮）。23 個地區轉換前後的地點、排序、統計及清單連結均比對一致。

## 無金鑰開發

需要 Node.js 22+，無 npm 依賴。啟動靜態 server 可使用 Python：

```sh
npm test
npm run examples
python -m http.server 8000 --bind 127.0.0.1
```

開啟 `http://localhost:8000/?data=examples`。`examples/data/` 已提交，可直接使用。fixtures 全為合成資料：正常、空清單、重複 ID、同名不同地點、缺欄位、跨年、無效日期、0/大數字、HTML 注入字串。臺北市是極端案例、連江縣是空清單；可切換兩個快照日期。

## 本機 API 資料

至 [eBird API keygen](https://ebird.org/api/keygen) 取得金鑰。PowerShell：

```powershell
$env:EBIRD_API_KEY = '你的金鑰'
npm run collect
python -m http.server 8000 --bind 127.0.0.1
```

開啟 `http://localhost:8000/?data=local`。資料預設寫入 `.local-data/`，已 gitignore，勿提交金鑰與本機資料。

`npm run build` 組合前端和 `.local-data` 成 `_site/`。離線可用 `node scripts/build.mjs examples/data`，再開啟 `http://localhost:8000/_site/` 驗證 project path。所有 fetch 相對頁面 URL，不使用 `/data/...`。`data` query 僅接受 `examples` 或 `local`，其他值使用 production。

## GitHub Actions / Pages

1. 新 repo Settings → Secrets and variables → Actions 在 **Env** environment 新增 `EBIRD_API_KEY` secret（也支援 repository secret）。
2. Settings → Pages → Source 選 **GitHub Actions**。`christorng.idv.tw` 使用者 Pages 網域與 DNS 須已設定；本專案不放 CNAME。
3. Workflow 需 contents write、pages write、id-token write；若保護 data branch，需允許 Actions 更新。
4. Push main、手動 workflow_dispatch，或台灣每日 06:00（UTC `0 22 * * *`）執行。GitHub 定時排程可能延遲。

Workflow 的 `collect` job 使用 **Env** environment 讀取金鑰、測試、準備 data branch、擷取、build、提交 data 並上傳 Pages artifact；`deploy` job 等待成功後，使用 **github-pages** environment 將同一 artifact 部署至 `/eBirdRecentHotspot/`。流程序列化避免同時覆寫。data push 不觸發此 workflow。首次缺 key 會失敗，不會以範例替代 production。若部署失敗可手動重跑，當日資料會重新抓取覆寫。

此專案取代 [舊 eBird 的 recent-hotspots](https://github.com/ChrisTorng/eBird)，舊 repo 保留 alerts 與搬遷入口。

若顯示「請設定 EBIRD_API_KEY」但已建立 secret，請確認 environment 名稱：Environment secrets 只提供給引用該 environment 的 job；`Env` 的金鑰不會提供給 `github-pages`。本 workflow 已分開兩個 job，無需搬移金鑰。變更推送後啟動新的 workflow run；重跑舊 run 仍會使用舊版 workflow。
