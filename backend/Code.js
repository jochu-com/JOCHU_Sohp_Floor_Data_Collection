/**
 * Google Apps Script Backend for JOCHU Manufacturing Order App
 */

// Global Constants for Sheet Names
const SHEET_NAMES = {
    USERS: '用戶資料',
    PRODUCTS: '工站總表',
    MO_RECORDS: '製令紀錄',
    MO_TEMPLATE: '製令表格'
};

/**
 * Handle POST requests
 */
function doPost(e) {
    const lock = LockService.getScriptLock();
    try {
        if (!e.postData || !e.postData.contents) {
            return createResponse({ status: 'error', message: 'No data provided' });
        }

        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        switch (action) {
            case 'register':
                return handleRegister(data);
            case 'login':
                return handleLogin(data);
            case 'getProductInfo':
                return handleGetProductInfo(data);
            case 'createMO':
                return handleCreateMO(data);
            case 'batchCreateMO':
                return handleBatchCreateMO(data);
            case 'printMOByOrder': // New Action
                return handlePrintMOByOrder(data);
            default:
                return createResponse({ status: 'error', message: 'Invalid action' });
        }
    } catch (err) {
        return createResponse({ status: 'error', message: err.toString() });
    }
}

/**
 * Handle Print MO By Order (Search & Download)
 */
function handlePrintMOByOrder(data) {
    // No lock needed for reading and generating PDF usually, but safer if high concurrency
    // Reading data...
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const moSheet = ss.getSheetByName(SHEET_NAMES.MO_RECORDS);

    if (!moSheet) return createResponse({ status: 'error', message: 'MO Records sheet not found' });

    const orderNo = String(data.orderNo || '').trim();
    if (!orderNo) return createResponse({ status: 'error', message: '請輸入工單單號' });

    const moRecords = moSheet.getDataRange().getValues();
    // Header is row 0. Data starts row 1.
    // Index 3 is OrderNo (Column D)

    // Find all matching records
    const matchingRecords = moRecords.filter((row, index) => {
        if (index === 0) return false; // Skip header
        return String(row[3]) === orderNo;
    });

    if (matchingRecords.length === 0) {
        return createResponse({ status: 'error', message: `找不到工單號碼 ${orderNo} 的任何製令紀錄` });
    }

    try {
        // Generate PDF
        const pdfBlob = createCombinedPDF(matchingRecords, ss);

        // Convert to Base64
        const base64Data = Utilities.base64Encode(pdfBlob.getBytes());

        return createResponse({
            status: 'success',
            message: `找到 ${matchingRecords.length} 筆製令，準備下載...`,
            fileName: `工單_${orderNo}_製令彙整.pdf`,
            pdfBase64: base64Data
        });

    } catch (e) {
        return createResponse({ status: 'error', message: 'PDF生成失敗: ' + e.toString() });
    }
}

/**
 * Helper to create JSON response with CORS headers
 */
function createResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle Batch Create MO (Multi-page PDF Logic)
 */
function handleBatchCreateMO(data) {
    const lock = LockService.getScriptLock();
    try {
        console.log("Starting batchCreateMO with items:", JSON.stringify(data.items));
        lock.waitLock(60000); // 延長等待時間至60秒

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const moSheet = ss.getSheetByName(SHEET_NAMES.MO_RECORDS);
        const productSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);

        if (!moSheet || !productSheet) return createResponse({ status: 'error', message: 'Sheet not found' });

        const products = productSheet.getDataRange().getValues();
        const moRecords = moSheet.getDataRange().getValues();

        // 1. Determine Starting Sequence
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const prefix = `MO-${year}${month}`; // MO-202310

        let lastNum = 0;
        if (moRecords.length > 1) {
            const currentMonthRecords = moRecords.filter(r => String(r[0]).startsWith(prefix));
            if (currentMonthRecords.length > 0) {
                const lastId = String(currentMonthRecords[currentMonthRecords.length - 1][0]);
                const suffix = lastId.substring(prefix.length);
                lastNum = parseInt(suffix, 10) || 0;
            }
        }

        const generatedMOs = [];
        const newRecords = []; // Collect all successfully created records data
        const errors = [];

        // 2. Process Items (Add to Sheet first)
        for (const item of data.items) {
            try {
                console.log("Processing item:", item.partNo);
                const productRow = products.find(row => String(row[0]) === String(item.partNo));
                if (!productRow) {
                    errors.push(`料號 ${item.partNo} 找不到`);
                    console.warn("Product not found:", item.partNo);
                    continue;
                }

                lastNum++;
                const newSeq = String(lastNum).padStart(4, '0');
                const newMoId = `${prefix}${newSeq}`;

                const newRecord = [
                    newMoId,
                    today,
                    item.partNo,
                    item.orderNo,
                    productRow[1], // Name
                    productRow[2], // Customer Part No
                    productRow[3], // Material
                    item.quantity,
                    ...productRow.slice(4, 22), // Stations
                    productRow[productRow.length - 1] // Model
                ];

                moSheet.appendRow(newRecord);
                generatedMOs.push(newMoId);
                newRecords.push(newRecord); // Store for batch PDF generation

            } catch (err) {
                console.error("Error processing item:", err);
                errors.push(`處理項目 ${item.partNo} 時發生錯誤: ${err.message}`);
            }
        }

        SpreadsheetApp.flush(); // Ensure data is saved before PDF generation

        // 3. Generate Single Combined PDF
        let pdfBlob = null;
        if (newRecords.length > 0) {
            try {
                console.log("Generating combined PDF for", newRecords.length, "records");
                pdfBlob = createCombinedPDF(newRecords, ss);
            } catch (pdfErr) {
                console.error("Combined PDF Error:", pdfErr);
                errors.push("PDF生成失敗: " + pdfErr.message);
            }
        }

        console.log("Batch finished. MOs:", generatedMOs.length, "PDF Blob:", pdfBlob ? "Created" : "Null");

        // 4. Send Batch Email (Single Attachment)
        if (data.email && pdfBlob) {
            console.log("Sending email to:", data.email);
            MailApp.sendEmail({
                to: data.email,
                subject: `批量製令通知 - ${generatedMOs.length} 筆成功 (合併檔)`,
                body: `您好，\n\n已為您批量生成 ${generatedMOs.length} 筆製令。\n單號範圍: ${generatedMOs[0]} ~ ${generatedMOs[generatedMOs.length - 1]}\n\n請查收附件 (已合併為一個 PDF)。\n\n系統自動發送`,
                attachments: [pdfBlob]
            });
        }

        let resultMsg = `成功生成 ${generatedMOs.length} 筆製令。`;
        if (errors.length > 0) {
            resultMsg += `\n\n=== 失敗詳情 ===\n${errors.join('\n')}`;
        }

        return createResponse({
            status: 'success',
            message: resultMsg,
            generatedMOs: generatedMOs,
            errors: errors
        });

    } catch (e) {
        console.error("Fatal error in batchCreateMO:", e);
        return createResponse({ status: 'error', message: e.toString() });
    } finally {
        lock.releaseLock();
    }
}

/**
 * Handle User Registration
 */
function handleRegister(data) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const userSheet = ss.getSheetByName(SHEET_NAMES.USERS);

        if (!userSheet) return createResponse({ status: 'error', message: 'User sheet not found' });

        const users = userSheet.getDataRange().getValues();
        const existingUser = users.find(row => row[2] === data.username);
        if (existingUser) {
            return createResponse({ status: 'error', message: '此用戶名稱已存在！' });
        }

        let lastUid = 0;
        if (users.length > 1) {
            const lastRow = users[users.length - 1];
            lastUid = parseInt(String(lastRow[0]), 10) || 0;
        }
        const newUid = String(lastUid + 1).padStart(6, '0');

        const passwordHash = Utilities.base64Encode(
            Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data.password)
        );

        userSheet.appendRow([
            newUid,
            '一般用戶',
            data.username,
            passwordHash,
            data.email
        ]);

        return createResponse({ status: 'success', message: '用戶註冊成功！', uid: newUid });

    } catch (e) {
        return createResponse({ status: 'error', message: e.toString() });
    } finally {
        lock.releaseLock();
    }
}

/**
 * Handle User Login
 */
function handleLogin(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName(SHEET_NAMES.USERS);

    if (!userSheet) return createResponse({ status: 'error', message: 'User sheet not found' });

    const users = userSheet.getDataRange().getValues();

    const userRow = users.find(row => row[2] === data.username);

    if (!userRow) {
        return createResponse({ status: 'error', message: '此用戶名稱不存在！' });
    }

    const inputHash = Utilities.base64Encode(
        Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data.password)
    );

    if (inputHash !== userRow[3]) {
        return createResponse({ status: 'error', message: '密碼錯誤！' });
    }

    return createResponse({
        status: 'success',
        user: {
            uid: userRow[0],
            type: userRow[1],
            username: userRow[2],
            email: userRow[4]
        }
    });
}

/**
 * Handle Get Product Info
 */
function handleGetProductInfo(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const productSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);

    if (!productSheet) return createResponse({ status: 'error', message: 'Product sheet not found' });

    const products = productSheet.getDataRange().getValues();
    const productRow = products.find(row => String(row[0]) === String(data.partNo));

    if (!productRow) {
        return createResponse({ status: 'error', message: '找不到此料號資料！' });
    }

    const productData = {
        partNo: productRow[0],
        name: productRow[1],
        customerPartNo: productRow[2],
        material: productRow[3],
        stations: [],
        model: productRow[productRow.length - 1]
    };

    for (let i = 4; i < productRow.length - 1; i += 2) {
        if (productRow[i]) {
            productData.stations.push({
                name: productRow[i],
                time: productRow[i + 1]
            });
        }
    }

    return createResponse({ status: 'success', data: productData });
}

/**
 * Handle Single Create MO
 */
function handleCreateMO(data) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const moSheet = ss.getSheetByName(SHEET_NAMES.MO_RECORDS);
        const productSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);

        if (!moSheet) return createResponse({ status: 'error', message: 'MO Record sheet not found' });

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const prefix = `MO-${year}${month}`;

        const moRecords = moSheet.getDataRange().getValues();
        let lastNum = 0;

        if (moRecords.length > 1) {
            const lastRecord = moRecords[moRecords.length - 1];
            const lastMoId = String(lastRecord[0]);
            if (lastMoId.startsWith(prefix)) {
                const suffix = lastMoId.substring(prefix.length);
                lastNum = parseInt(suffix, 10) || 0;
            }
        }

        const newSeq = String(lastNum + 1).padStart(4, '0');
        const newMoId = `${prefix}${newSeq}`;

        const products = productSheet.getDataRange().getValues();
        const productRow = products.find(row => String(row[0]) === String(data.partNo));
        if (!productRow) return createResponse({ status: 'error', message: 'Product not found' });

        const newRecord = [
            newMoId,
            today,
            data.partNo,
            data.orderNo,
            productRow[1],
            productRow[2],
            productRow[3],
            data.quantity,
            ...productRow.slice(4, 22),
            productRow[productRow.length - 1]
        ];

        moSheet.appendRow(newRecord);

        // Generate PDF
        let pdfBlob;
        try {
            pdfBlob = createPDF(newRecord, ss);
        } catch (pdfErr) {
            return createResponse({ status: 'success', message: '製令已建立，但 PDF 生成失敗: ' + pdfErr.message, moNumber: newMoId });
        }

        if (!pdfBlob) {
            return createResponse({ status: 'success', message: '製令已建立，但 PDF 生成異常 (Unknown)', moNumber: newMoId });
        }

        if (data.email) {
            MailApp.sendEmail({
                to: data.email,
                subject: `製令用單通知 - ${newMoId}`,
                body: `您好，\n\n您的製令單 ${newMoId} 已生成，請查收附件。\n\n系統自動發送`,
                attachments: [pdfBlob]
            });
        }

        return createResponse({ status: 'success', message: `製令 ${newMoId} 已建立並寄出！`, moNumber: newMoId });

    } catch (e) {
        return createResponse({ status: 'error', message: e.toString() });
    } finally {
        lock.releaseLock();
    }
}

/**
 * Generate Single PDF from Template (Wrapper using fillSheetWithData logic via temp file)
 */
function createPDF(recordData, ss) {
    try {
        const templateSheet = ss.getSheetByName(SHEET_NAMES.MO_TEMPLATE);
        if (!templateSheet) throw new Error('Template sheet not found');

        // Copy template to temp file
        const tempFile = DriveApp.getFileById(ss.getId()).makeCopy('Temp_MO_' + recordData[0]);
        const tempSS = SpreadsheetApp.open(tempFile);

        // Remove non-template sheets
        const sheets = tempSS.getSheets();
        for (const sheet of sheets) {
            if (sheet.getName() !== SHEET_NAMES.MO_TEMPLATE) {
                tempSS.deleteSheet(sheet);
            }
        }

        const workingSheet = tempSS.getSheetByName(SHEET_NAMES.MO_TEMPLATE);
        if (!workingSheet) throw new Error('Template sheet lost during processing');

        // --- Use Shared Logic to Fill Data ---
        fillSheetWithData(workingSheet, recordData);
        // -------------------------------------

        SpreadsheetApp.flush();

        const url = `https://docs.google.com/spreadsheets/d/${tempSS.getId()}/export?`
            + `format=pdf&size=A4&portrait=false&gridlines=false` // removed fitw=true
            + `&scale=3` // Fit to Height
            + `&top_margin=0.10&bottom_margin=0.10&left_margin=0.10&right_margin=0.10`
            + `&gid=${workingSheet.getSheetId()}`;

        const token = ScriptApp.getOAuthToken();
        const response = UrlFetchApp.fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token },
            muteHttpExceptions: true
        });

        if (response.getResponseCode() !== 200) {
            console.error("PDF Export Failed: " + response.getContentText());
            throw new Error("PDF Export Failed");
        }

        const pdfBlob = response.getBlob().setName(`製令單_${recordData[0]}.pdf`);
        DriveApp.getFileById(tempFile.getId()).setTrashed(true);

        return pdfBlob;

    } catch (e) {
        console.error("createPDF Fatal Error: " + e.toString());
        throw e;
    }
}

/**
 * NEW: Generate Combined PDF for Multiple Records
 */
function createCombinedPDF(allRecords, ss) {
    let tempFile = null;
    try {
        const templateSheet = ss.getSheetByName(SHEET_NAMES.MO_TEMPLATE);
        if (!templateSheet) throw new Error('Template sheet not found');

        // 1. Copy the WHOLE spreadsheet to a temp file
        const fileName = `批量製令單(共${allRecords.length}筆).pdf`;
        tempFile = DriveApp.getFileById(ss.getId()).makeCopy('Temp_Batch_MO_' + new Date().getTime());
        const tempSS = SpreadsheetApp.open(tempFile);

        // 2. Loop through records and create a sheet for each
        const createdSheetsIds = [];
        const tempTemplate = tempSS.getSheetByName(SHEET_NAMES.MO_TEMPLATE); // Use the one inside tempSS

        for (const record of allRecords) {
            const sheetName = record[0]; // MO ID
            // Copy the template sheet WITHIN the temp spreadsheet
            const targetSheet = tempTemplate.copyTo(tempSS);
            targetSheet.setName(sheetName);

            // Fill data
            fillSheetWithData(targetSheet, record);

            createdSheetsIds.push(targetSheet.getSheetId());
        }

        // 3. Delete original template and other existing sheets, keep ONLY created ones
        const allSheets = tempSS.getSheets();
        for (const sheet of allSheets) {
            if (!createdSheetsIds.includes(sheet.getSheetId())) {
                tempSS.deleteSheet(sheet);
            }
        }

        SpreadsheetApp.flush();

        // 4. Export the ENTIRE temp spreadsheet as PDF (no gid = all sheets)
        // 10px ~= 0.104 inches (96DPI) -> 0.1
        const url = `https://docs.google.com/spreadsheets/d/${tempSS.getId()}/export?`
            + `format=pdf`
            + `&size=A4`
            + `&portrait=false`
            // + `&fitw=true` // Remove fitw, use scale=3 for Fit to Height
            + `&scale=3`      // 3 = Fit to Height
            + `&gridlines=false`
            + `&top_margin=0.10`
            + `&bottom_margin=0.10`
            + `&left_margin=0.10`
            + `&right_margin=0.10`;

        const token = ScriptApp.getOAuthToken();
        const response = UrlFetchApp.fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token },
            muteHttpExceptions: true
        });

        if (response.getResponseCode() !== 200) {
            throw new Error("PDF Export Failed: " + response.getContentText());
        }

        return response.getBlob().setName(fileName);

    } catch (e) {
        console.error("createCombinedPDF Error: " + e.toString());
        throw e;
    } finally {
        // Cleanup temp file
        if (tempFile) {
            try { DriveApp.getFileById(tempFile.getId()).setTrashed(true); } catch (e) { }
        }
    }
}

/**
 * Shared Helper: Fill a sheet with MO data (Text + Image + QR)
 */
function fillSheetWithData(sheet, recordData) {
    const replacements = {
        '{{MO_ID}}': recordData[0],
        '{{DATE}}': Utilities.formatDate(recordData[1], Session.getScriptTimeZone(), 'yyyy/MM/dd'),
        '{{PART_NO}}': recordData[2],
        '{{ORDER_NO}}': recordData[3],
        '{{NAME}}': recordData[4],
        '{{CUST_PART}}': recordData[5],
        '{{MATERIAL}}': recordData[6],
        '{{QTY}}': recordData[7],
        '{{MODEL}}': recordData[recordData.length - 1],
    };

    // Stations
    for (let i = 1; i <= 9; i++) {
        const nameIndex = 8 + (i - 1) * 2;
        const timeIndex = 9 + (i - 1) * 2;
        const stName = (nameIndex < recordData.length) ? recordData[nameIndex] : '';
        const stTime = (timeIndex < recordData.length) ? recordData[timeIndex] : '';
        replacements[`{{STATION_${i}}}`] = stName || '';
        replacements[`{{TIME_${i}}}`] = stTime ? `標準工時 ${stTime} 秒` : '';
    }

    // Text Replacement
    for (const [key, value] of Object.entries(replacements)) {
        sheet.createTextFinder(key).replaceAllWith(String(value));
    }

    // --- Image Logic ---
    try {
        const partNo = recordData[2];
        let imageBlob = null;

        // Try to get image
        try {
            const folder = DriveApp.getFolderById('1HN0in8_fNRsD4E0mfdoW95HM-sJ1SStn');
            let fileIter = folder.getFilesByName(`${partNo}.jpg`);
            if (!fileIter.hasNext()) fileIter = folder.getFilesByName(`${partNo}.jpeg`);
            if (fileIter.hasNext()) imageBlob = fileIter.next().getBlob();
        } catch (e) {
            console.warn("Image fetch error: " + e.message);
        }

        // Insert Image
        let tf = sheet.createTextFinder('\\{\\{\\s*IMAGE\\s*\\}\\}').useRegularExpression(true);
        let matches = tf.findAll();
        if (matches.length === 0) {
            tf = sheet.createTextFinder('{{IMAGE}}').useRegularExpression(false);
            matches = tf.findAll();
        }

        if (matches.length > 0) {
            if (imageBlob) {
                for (const cell of matches) {
                    const r = cell.getRow();
                    const c = cell.getColumn();
                    cell.clearContent();
                    const img = sheet.insertImage(imageBlob, c, r);

                    // Resize Logic
                    // 1. Force Width = 175
                    const TARGET_WIDTH = 175;

                    const w = img.getWidth();
                    const h = img.getHeight();
                    const ratio = h / w; // height per unit of width

                    const nw = TARGET_WIDTH;
                    const nh = nw * ratio;

                    img.setWidth(Math.round(nw));
                    img.setHeight(Math.round(nh));
                }
            } else {
                matches.forEach(c => c.setValue('(無圖片)'));
            }
        }
    } catch (e) {
        console.warn("Insert image error: " + e.message);
    }

    // --- QR Code Logic ---
    try {
        const moId = recordData[0];
        const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(moId)}&size=300`;
        const qrResp = UrlFetchApp.fetch(qrUrl);
        if (qrResp.getResponseCode() === 200) {
            const qrBlob = qrResp.getBlob();
            let tf = sheet.createTextFinder('\\{\\{\\s*QR_CODE\\s*\\}\\}').useRegularExpression(true);
            let matches = tf.findAll();
            if (matches.length === 0) {
                tf = sheet.createTextFinder('{{QR_CODE}}').useRegularExpression(false);
                matches = tf.findAll();
            }
            for (const cell of matches) {
                const r = cell.getRow();
                const c = cell.getColumn();
                cell.clearContent();
                const img = sheet.insertImage(qrBlob, c, r);
                img.setWidth(175);
                img.setHeight(175);
            }
        }
    } catch (e) {
        console.warn("QR code error: " + e.message);
    }
}
