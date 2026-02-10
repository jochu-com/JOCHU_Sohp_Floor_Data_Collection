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
            default:
                return createResponse({ status: 'error', message: 'Invalid action' });
        }
    } catch (err) {
        return createResponse({ status: 'error', message: err.toString() });
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
 * Handle User Registration
 */
function handleRegister(data) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000); // Wait up to 30 seconds for lock

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const userSheet = ss.getSheetByName(SHEET_NAMES.USERS);

        if (!userSheet) return createResponse({ status: 'error', message: 'User sheet not found' });

        const users = userSheet.getDataRange().getValues();
        // Check if username exists (Column C: index 2)
        const existingUser = users.find(row => row[2] === data.username);
        if (existingUser) {
            return createResponse({ status: 'error', message: '此用戶名稱已存在！' });
        }

        // Generate New UID
        let lastUid = 0;
        if (users.length > 1) { // has data rows
            const lastRow = users[users.length - 1];
            const lastUidStr = String(lastRow[0]); // Column A
            lastUid = parseInt(lastUidStr, 10) || 0;
        }
        const newUid = String(lastUid + 1).padStart(6, '0');

        // Hash Password
        const passwordHash = Utilities.base64Encode(
            Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data.password)
        );

        userSheet.appendRow([
            newUid,
            '一般用戶', // Default type
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

    const users = userSheet.getDataRange().getValues(); // Header is row 0

    const userRow = users.find(row => row[2] === data.username);

    if (!userRow) {
        return createResponse({ status: 'error', message: '此用戶名稱不存在！' });
    }

    // Check Password
    const inputHash = Utilities.base64Encode(
        Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data.password)
    );

    // Stored password is in Column D (index 3)
    if (inputHash !== userRow[3]) {
        return createResponse({ status: 'error', message: '密碼錯誤！' });
    }

    // Success
    return createResponse({
        status: 'success',
        user: {
            uid: userRow[0],
            type: userRow[1], // Column B
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
    // PartNo is Column A (index 0)

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
        model: productRow[productRow.length - 1] // Last column
    };

    // Stations are from index 4 to length-2 (Machine is last)
    // Pairs of (Station, Time)
    for (let i = 4; i < productRow.length - 1; i += 2) {
        if (productRow[i]) { // If station name exists
            productData.stations.push({
                name: productRow[i],
                time: productRow[i + 1]
            });
        }
    }

    return createResponse({ status: 'success', data: productData });
}

/**
 * Handle Create MO (Manufacturing Order)
 */
function handleCreateMO(data) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const moSheet = ss.getSheetByName(SHEET_NAMES.MO_RECORDS);
        const productSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS); // Re-fetch product data for consistency

        if (!moSheet) return createResponse({ status: 'error', message: 'MO Record sheet not found' });

        // 1. Generate MO Number
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const prefix = `MO-${year}${month}`; // MO-202310

        // Find last MO number to increment
        const moRecords = moSheet.getDataRange().getValues();
        let lastNum = 0;

        if (moRecords.length > 1) {
            const lastRecord = moRecords[moRecords.length - 1];
            const lastMoId = String(lastRecord[0]); // Column A: MO-YYYYMM-XXXX
            const currentPrefix = `MO-${year}${month}`;
            if (lastMoId.startsWith(currentPrefix)) {
                const suffix = lastMoId.substring(currentPrefix.length); // get remainder
                lastNum = parseInt(suffix, 10) || 0;
            }
        }

        const newSeq = String(lastNum + 1).padStart(4, '0');
        const newMoId = `MO-${year}${month}${newSeq}`;

        // 2. Get Product Data again (to be safe and get all fields)
        const products = productSheet.getDataRange().getValues();
        const productRow = products.find(row => String(row[0]) === String(data.partNo));
        if (!productRow) return createResponse({ status: 'error', message: 'Product not found' });

        // 3. Prepare Row Data
        const newRecord = [
            newMoId,
            today, // Date object
            data.partNo,
            data.orderNo, // From QR Code
            productRow[1], // Name
            productRow[2], // Customer Part No
            productRow[3], // Material
            data.quantity, // Production Quantity
            // Stations (copy from productRow index 4 to 21 (9 stations * 2 = 18 cols))
            ...productRow.slice(4, 22),
            productRow[productRow.length - 1] // Model
        ];

        // Append to MO Records
        moSheet.appendRow(newRecord);

        // 4. Generate PDF
        let pdfBlob;
        try {
            pdfBlob = createPDF(newRecord, ss);
        } catch (pdfErr) {
            return createResponse({ status: 'success', message: '製令已建立，但 PDF 生成失敗: ' + pdfErr.message, moNumber: newMoId });
        }

        if (!pdfBlob) {
            return createResponse({ status: 'success', message: '製令已建立，但 PDF 生成異常 (Unknown)', moNumber: newMoId });
        }

        // 5. Send Email
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
 * Generate PDF from Template
 */
function createPDF(recordData, ss) {
    try {
        const templateSheet = ss.getSheetByName(SHEET_NAMES.MO_TEMPLATE);
        if (!templateSheet) throw new Error('Template sheet not found');

        // 1. Copy the WHOLE spreadsheet to preserve styles
        const tempFile = DriveApp.getFileById(ss.getId()).makeCopy('Temp_MO_' + recordData[0]);
        const tempSS = SpreadsheetApp.open(tempFile);

        // 2. Remove all sheets EXCEPT the template to ensure clean PDF
        const sheets = tempSS.getSheets();
        for (const sheet of sheets) {
            if (sheet.getName() !== SHEET_NAMES.MO_TEMPLATE) {
                tempSS.deleteSheet(sheet);
            }
        }

        const workingSheet = tempSS.getSheetByName(SHEET_NAMES.MO_TEMPLATE);
        if (!workingSheet) throw new Error('Template sheet lost during processing');

        // 3. Fill data
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

        // Add Station and Time placeholders (1 to 9)
        for (let i = 1; i <= 9; i++) {
            const nameIndex = 8 + (i - 1) * 2;
            const timeIndex = 9 + (i - 1) * 2;

            const stName = (nameIndex < recordData.length) ? recordData[nameIndex] : '';
            const stTime = (timeIndex < recordData.length) ? recordData[timeIndex] : '';

            replacements[`{{STATION_${i}}}`] = stName || '';
            replacements[`{{TIME_${i}}}`] = stTime ? `標準工時 ${stTime} 秒` : '';
        }

        // Perform replacement
        for (const [key, value] of Object.entries(replacements)) {
            workingSheet.createTextFinder(key).replaceAllWith(String(value));
        }

        // --- Insert Image Logic (Robust + Resize + Multiple) ---
        try {
            const partNo = recordData[2];
            let imageBlob = null;
            let debugDetails = [];

            // 1. Get Image Blob (Load once)
            // Strategy: Direct Access via Folder ID (User Provided)
            // ID: 1HN0in8_fNRsD4E0mfdoW95HM-sJ1SStn

            let folder;
            try {
                folder = DriveApp.getFolderById('1HN0in8_fNRsD4E0mfdoW95HM-sJ1SStn');
            } catch (e) {
                debugDetails.push(`Folder Access Error: ${e.message}`);
            }

            if (folder) {
                try {
                    let fileIter = folder.getFilesByName(`${partNo}.jpg`);
                    if (!fileIter.hasNext()) {
                        fileIter = folder.getFilesByName(`${partNo}.jpeg`);
                    }

                    if (fileIter.hasNext()) {
                        imageBlob = fileIter.next().getBlob();
                    } else {
                        debugDetails.push(`File ${partNo}.jpg/.jpeg not found in folder`);
                    }
                } catch (e) {
                    debugDetails.push(`File Access Error: ${e.message}`);
                }
            } else {
                debugDetails.push("Folder ID '1HN0in8_fNRsD4E0mfdoW95HM-sJ1SStn' not found/accessible");
            }

            // 2. Find ALL Placeholders and Insert
            // Use regex to find {{IMAGE}}, {{ IMAGE }} etc.
            // Reset text finder for loop
            let textFinder = workingSheet.createTextFinder('\\{\\{\\s*IMAGE\\s*\\}\\}').useRegularExpression(true);
            let occurrences = textFinder.findAll(); // Get all locations first

            if (occurrences.length === 0) {
                // Fallback simple search
                textFinder = workingSheet.createTextFinder('{{IMAGE}}').useRegularExpression(false);
                occurrences = textFinder.findAll();
            }

            if (occurrences.length > 0) {
                // Determine what to write
                if (imageBlob) {
                    // Loop through ALL occurrences
                    for (const cell of occurrences) {
                        const row = cell.getRow();
                        const col = cell.getColumn();

                        // Clear text
                        cell.clearContent();

                        // Insert Image
                        const img = workingSheet.insertImage(imageBlob, col, row);

                        // --- RESIZE LOGIC ---
                        const MAX_WIDTH = 300;
                        const MAX_HEIGHT = 200;

                        const originalWidth = img.getWidth();
                        const originalHeight = img.getHeight();
                        const ratio = originalWidth / originalHeight;

                        let newWidth = originalWidth;
                        let newHeight = originalHeight;

                        if (newWidth > MAX_WIDTH) {
                            newWidth = MAX_WIDTH;
                            newHeight = newWidth / ratio;
                        }

                        if (newHeight > MAX_HEIGHT) {
                            newHeight = MAX_HEIGHT;
                            newWidth = newHeight * ratio;
                        }

                        img.setWidth(Math.round(newWidth));
                        img.setHeight(Math.round(newHeight));
                    }
                } else {
                    // Image NOT found, update ALL matched cells with error msg
                    const msg = debugDetails.length > 0 ? debugDetails.join(", ") : "Unknown";
                    for (const cell of occurrences) {
                        cell.setValue(`(無圖片: ${msg})`);
                    }
                }
            } else {
                console.warn("Placeholder {{IMAGE}} not found");
                try {
                    workingSheet.appendRow([""]);
                    workingSheet.appendRow(["[Debug]: Template missing {{IMAGE}} placeholder"]);
                } catch (e) { }
            }
        } catch (imgErr) {
            console.warn("Image error: " + imgErr.toString());
            try {
                workingSheet.appendRow([""]);
                workingSheet.appendRow(["[Debug]: Image Error: " + imgErr.toString()]);
            } catch (e) { }
        }
        // ---------------------------

        // --- Insert QR Code Logic ---
        try {
            const moId = recordData[0]; // MO ID is the first element
            const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(moId)}&size=300`;

            // Fetch QR Code Image
            const qrResponse = UrlFetchApp.fetch(qrUrl);
            if (qrResponse.getResponseCode() === 200) {
                const qrBlob = qrResponse.getBlob();

                // Find {{QR_CODE}} placeholder
                let qrFinder = workingSheet.createTextFinder('\\{\\{\\s*QR_CODE\\s*\\}\\}').useRegularExpression(true);
                let qrOccurrences = qrFinder.findAll();

                if (qrOccurrences.length === 0) {
                    qrFinder = workingSheet.createTextFinder('{{QR_CODE}}').useRegularExpression(false);
                    qrOccurrences = qrFinder.findAll();
                }

                if (qrOccurrences.length > 0) {
                    for (const cell of qrOccurrences) {
                        const row = cell.getRow();
                        const col = cell.getColumn();

                        cell.clearContent();
                        const img = workingSheet.insertImage(qrBlob, col, row);

                        // Resize QR Code (e.g. 250x250 for user request)
                        img.setWidth(250);
                        img.setHeight(250);
                    }
                } else {
                    console.warn("Placeholder {{QR_CODE}} not found");
                }
            } else {
                console.warn("Failed to fetch QR Code from API");
            }
        } catch (qrErr) {
            console.warn("QR Code Error: " + qrErr.toString());
            // Optional: Write error to sheet for debug?
        }
        // ---------------------------

        // Save and Flush
        SpreadsheetApp.flush();

        // 4. Export PDF with specific options (A4 Landscape)
        // We use UrlFetchApp to access the export endpoint for more control
        const url = `https://docs.google.com/spreadsheets/d/${tempSS.getId()}/export?`
            + `format=pdf`
            + `&size=A4`              // A4 Size
            + `&portrait=false`       // Landscape
            + `&fitw=true`            // Fit to width
            + `&gridlines=false`      // No gridlines
            + `&gid=${workingSheet.getSheetId()}`; // Specific Sheet

        const token = ScriptApp.getOAuthToken();
        const response = UrlFetchApp.fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + token
            },
            muteHttpExceptions: true
        });

        if (response.getResponseCode() !== 200) {
            console.error("PDF Export Failed: " + response.getContentText());
            throw new Error("PDF Export Failed");
        }

        const pdfBlob = response.getBlob().setName(`製令單_${recordData[0]}.pdf`);

        // 5. Cleanup
        DriveApp.getFileById(tempFile.getId()).setTrashed(true);

        return pdfBlob;

    } catch (e) {
        console.error("createPDF Fatal Error: " + e.toString());
        throw e; // Throw error to be caught by caller and sent to UI
    }
}

/**
 * Helper function to trigger Authorization scopes.
 * Run this function in the GAS Editor once to authorize new scopes (UrlFetchApp, ScriptApp).
 */
function testAuth() {
    ScriptApp.getOAuthToken();
    UrlFetchApp.fetch('https://www.google.com');
    DriveApp.getRootFolder();
    SpreadsheetApp.getActiveSpreadsheet();
    console.log("Authorization Successful");
}
