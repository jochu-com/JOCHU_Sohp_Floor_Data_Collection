# Backend Setup Guide (Google Apps Script)

## 1. Google Sheets Setup
Create a new Google Sheet (or use your existing one) and create the following sheets (tabs) with the exact names:

### Sheet 1: `用戶資料` (User Data)
- **Header Row (Row 1):**
  - A1: `UID`
  - B1: `Type` (e.g., 一般用戶, 製令開立)
  - C1: `Username`
  - D1: `Password` (Encrypted)
  - E1: `Email`

### Sheet 2: `工站總表` (Product Master)
- **Header Row (Row 1):**
  - A1: `料號`
  - B1: `品名`
  - C1: `客戶圖號`
  - D1: `材質/厚度`
  - E1: `第一站`
  - F1: `標準工時1`
  - ... (Repeat for stations up to 9)
  - W1: `機種`

### Sheet 3: `製令紀錄` (MO Records)
- **Header Row (Row 1):**
  - A1: `製令單號`
  - B1: `開單日期`
  - C1: `料號`
  - D1: `工單單號`
  - E1: `品名`
  - F1: `客戶圖號`
  - G1: `材質/厚度`
  - H1: `生產數量`
  - I1: `第一站`
  - J1: `標準工時1`
  - ... (Stations data)
  - AA1: `機種`

### Sheet 4: `製令表格` (MO Template)
- Design your MO Form within this sheet.
- Use the following placeholders which will be automatically replaced:
  - `{{MO_ID}}` : 製令編號
  - `{{DATE}}` : 日期
  - `{{PART_NO}}` : 料號
  - `{{ORDER_NO}}` : 工單編號
  - `{{NAME}}` : 品名
  - `{{CUST_PART}}` : 客戶圖號
  - `{{MATERIAL}}` : 材質
  - `{{QTY}}` : 數量
  - `{{MODEL}}` : 機種
  - `{{STATION_1}}` ... `{{STATION_9}}` : 第一站到第九站名稱
  - `{{TIME_1}}` ... `{{TIME_9}}` : 第一站到第九站標準工時
  - `{{IMAGE}}` : 料號圖片插入位置 (圖片來源：Drive `Materials_Image` 資料夾，檔名需為 `料號.jpg`)

## 2. Deploy Script
1. Open the Google Sheet.
2. Go to **Extensions** > **Apps Script**.
3. Clear any existing code and paste the content of `backend/Code.js` from this project.
4. (Optional) Rename the project to "JOCHU Backend".
5. Click **Deploy** > **New Deployment**.
6. **Select type**: Web app.
7. **Description**: "Initial Version".
8. **Execute as**: `Me` (your email).
9. **Who has access**: `Anyone` (IMPORTANT! Since the app is client-side, it needs anonymous access to POST).
10. Click **Deploy**.
11. **Authorize** the script (it will ask for permission to access Sheets, Drive, and Mail).
12. Copy the **Web App URL**.

## 3. Environment Variable
Create a `.env` file in the root of your React project (if not exists) and add:

```
VITE_GOOGLE_APP_SCRIPT_URL=your_web_app_url_here
```
