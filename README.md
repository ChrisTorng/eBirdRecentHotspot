# eBirdRecentHotspot

[網站](https://christorng.idv.tw/eBirdRecentHotspot/) · [原始碼](https://github.com/ChrisTorng/eBirdRecentHotspot)

eBird 最近熱門地點網站。production 使用官方 API，前端不接觸 API key。

## 架構

- `main`：固定 HTML/CSS/JS、scripts、tests、可提交的 examples。
- `data` branch：`data/index.json` 與 `data/snapshots/YYYY-MM-DD.json`，由 Actions 首次執行時建立。
- Snapshot 含 `schemaVersion`、台灣日期 `date`、UTC 擷取時間 `fetchedAt`、`regions` 及依 region code 分組的 `checklists` 原始 API 陣列。
- 先用 `/v2/ref/region/list/subnational1/TW?fmt=json` 取得所有縣市，再抓 `TW` 及每個回傳地區的 `/v2/product/lists/{regionCode}?maxResults=200`。地區名稱以 API 回應為準。
- 每個地區最多最近 200 筆，不是該日完整調查。全台獨立擷取，並非縣市清單聯集。快照日期與觀察日期不同。
- 台灣時間一日一檔，同日重跑覆寫、保留歷史。全部請求成功才寫檔及發布；失敗保留既有網站。網路、429、5xx 最多嘗試三次，其他 HTTP 錯誤立即失敗。
- 日期索引的 `latest` 指向最新日期；未指定 date 或 `date=latest` 都使用 latest。未知日期／地區顯示錯誤。
- 依地點 ID 分組、清單 ID 去重，以紀錄數及最近日期排序。鳥友數為不同顯示名稱數；平均鳥種不是鳥種聯集。個人地點不產生 hotspot 連結。

參考：[官方 eBird API 文件](https://documenter.getpostman.com/view/664302/S1ENwy59)。

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

1. 新 repo Settings → Secrets and variables → Actions 新增 `EBIRD_API_KEY` secret。
2. Settings → Pages → Source 選 **GitHub Actions**。`christorng.idv.tw` 使用者 Pages 網域與 DNS 須已設定；本專案不放 CNAME。
3. Workflow 需 contents write、pages write、id-token write；若保護 data branch，需允許 Actions 更新。
4. Push main、手動 workflow_dispatch，或台灣每日 06:00（UTC `0 22 * * *`）執行。GitHub 定時排程可能延遲。

Workflow 先測試，準備 data branch，擷取、build、提交 data 後將 `_site` 部署至 `/eBirdRecentHotspot/`。流程序列化避免同時覆寫。data push 不觸發此 workflow。首次缺 key 會失敗，不會以範例替代 production。若部署失敗可手動重跑，當日資料會重新抓取覆寫。

此專案取代 [舊 eBird 的 recent-hotspots](https://github.com/ChrisTorng/eBird)，舊 repo 保留 alerts 與搬遷入口。
