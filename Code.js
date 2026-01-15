/**
 * HX Thumbnail Tester - Google Apps Script Backend (Self-Service Edition)
 * Handles image storage in Drive, test config storage, and results collection
 */

// Configuration
const DRIVE_FOLDER_NAME = 'Thumbnail Tester Images';

/**
 * Handle GET requests - Serve test configurations or list all tests
 * Uses JSONP to avoid CORS issues
 */
function doGet(e) {
  try {
    const testId = e.parameter.test;
    const action = e.parameter.action;
    const callback = e.parameter.callback || 'callback';

    // List all tests
    if (action === 'listTests') {
      const tests = getAllTests();
      const response = {
        'status': 'success',
        'tests': tests
      };
      return ContentService.createTextOutput(callback + '(' + JSON.stringify(response) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    // Get specific test
    if (!testId) {
      const errorResponse = {
        'status': 'error',
        'message': 'Missing test ID parameter'
      };
      return ContentService.createTextOutput(callback + '(' + JSON.stringify(errorResponse) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    // Get test configuration from sheet
    const testConfig = getTestConfig(testId);

    if (!testConfig) {
      const errorResponse = {
        'status': 'error',
        'message': 'Test not found'
      };
      return ContentService.createTextOutput(callback + '(' + JSON.stringify(errorResponse) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    const successResponse = {
      'status': 'success',
      'testId': testId,
      'videos': testConfig.videos,
      'testType': testConfig.testType || 'grid',
      'matchupsPerThumbnail': testConfig.matchupsPerThumbnail
    };

    return ContentService.createTextOutput(callback + '(' + JSON.stringify(successResponse) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);

  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    const callback = e.parameter.callback || 'callback';
    const errorResponse = {
      'status': 'error',
      'message': error.toString()
    };
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(errorResponse) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

/**
 * Handle POST requests - Create tests, submit results, or delete tests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Check what type of request this is
    if (data.action === 'createTest' || data.action === 'createHeadToHeadTest') {
      return handleTestCreation(data);
    } else if (data.action === 'deleteTest') {
      return handleTestDeletion(data);
    } else if (data.testId && data.ratings) {
      return handleResultSubmission(data);
    } else if (data.testId && data.results) {
      return handleHeadToHeadResultSubmission(data);
    } else {
      throw new Error('Invalid request format');
    }

  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle test creation - Store images in Drive and config in Sheet
 */
function handleTestCreation(data) {
  const testId = data.testId;
  const testName = data.testName || testId; // Use provided name or fall back to ID
  const videos = data.videos || [];
  const matchupsPerThumbnail = data.matchupsPerThumbnail || null; // For head-to-head tests
  const testType = data.action === 'createHeadToHeadTest' ? 'head-to-head' : 'grid';

  if (!testId || videos.length === 0) {
    throw new Error('Invalid test data: missing testId or videos');
  }

  // Get or create the Drive folder
  const folder = getOrCreateDriveFolder();

  // Create a subfolder for this test
  const testFolder = folder.createFolder('Test-' + testId);

  // Upload each image to Drive and get public URLs
  const videosWithUrls = videos.map((video, index) => {
    try {
      // Extract base64 data from data URL
      const base64Data = video.thumbnail.split(',')[1];
      const mimeType = video.thumbnail.split(':')[1].split(';')[0];
      const fileExtension = mimeType.split('/')[1];

      // Decode base64
      const blob = Utilities.newBlob(
        Utilities.base64Decode(base64Data),
        mimeType,
        `thumbnail-${index + 1}.${fileExtension}`
      );

      // Upload to Drive
      const file = testFolder.createFile(blob);

      // Make file publicly viewable
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      // Get public URL - use thumbnail endpoint for better embedding support
      const fileId = file.getId();
      const fileUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

      Logger.log(`Uploaded thumbnail ${index + 1}: ${fileUrl}`);

      return {
        title: video.title,
        thumbnail: fileUrl
      };

    } catch (error) {
      Logger.log(`Error uploading image ${index}: ${error.toString()}`);
      throw new Error(`Failed to upload image ${index + 1}: ${error.message}`);
    }
  });

  // Store test config in sheet
  saveTestConfig(testId, videosWithUrls, testType, matchupsPerThumbnail, testName);

  return ContentService.createTextOutput(JSON.stringify({
    'status': 'success',
    'message': 'Test created successfully',
    'testId': testId,
    'videoCount': videosWithUrls.length
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle result submission - Write to results sheet
 */
function handleResultSubmission(data) {
  const testId = data.testId || 'unknown-test';

  // Grid tests don't need testName, they use Test-{testId} format
  const sheet = getOrCreateTestSheet(testId, 'grid', null);

  // Write the data to the sheet
  writeResponseToSheet(sheet, data);

  return ContentService.createTextOutput(JSON.stringify({
    'status': 'success',
    'message': 'Data recorded successfully',
    'testId': testId
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle head-to-head result submission - Write to results sheet
 */
function handleHeadToHeadResultSubmission(data) {
  const testId = data.testId || 'unknown-test';

  // Get test config to retrieve test name
  const testConfig = getTestConfig(testId);
  const testName = testConfig ? (testConfig.testName || testId) : testId;

  // Get or create the results sheet tab for this test
  const sheet = getOrCreateTestSheet(testId, 'head-to-head', testName);

  // Write the data to the sheet
  writeHeadToHeadResponseToSheet(sheet, data);

  // Update summary section with aggregated results
  updateHeadToHeadSummary(sheet);

  return ContentService.createTextOutput(JSON.stringify({
    'status': 'success',
    'message': 'Data recorded successfully',
    'testId': testId
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get or create the Drive folder for storing images
 */
function getOrCreateDriveFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);

  if (folders.hasNext()) {
    return folders.next();
  } else {
    const folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
    Logger.log('Created Drive folder: ' + DRIVE_FOLDER_NAME);
    return folder;
  }
}

/**
 * Save test configuration to TestConfigs sheet
 */
function saveTestConfig(testId, videos, testType, matchupsPerThumbnail, testName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName('TestConfigs');

  // Create TestConfigs sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet('TestConfigs');
    sheet.getRange(1, 1, 1, 3).setValues([['Test ID', 'Created', 'Config JSON']]);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  // Store config as JSON
  const config = {
    videos: videos,
    testType: testType || 'grid',
    matchupsPerThumbnail: matchupsPerThumbnail,
    testName: testName || testId
  };
  const configJson = JSON.stringify(config);

  sheet.appendRow([
    testId,
    new Date().toISOString(),
    configJson
  ]);

  Logger.log('Saved test config for: ' + testId + ' (' + (testName || testId) + ')');
}

/**
 * Get test configuration from TestConfigs sheet
 */
function getTestConfig(testId) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName('TestConfigs');

  if (!sheet) {
    return null;
  }

  const data = sheet.getDataRange().getValues();

  // Skip header row, search for testId
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === testId) {
      try {
        return JSON.parse(data[i][2]);
      } catch (error) {
        Logger.log('Error parsing config for ' + testId + ': ' + error.toString());
        return null;
      }
    }
  }

  return null;
}

/**
 * Get existing results sheet tab or create a new one for the test ID
 */
function getOrCreateTestSheet(testId, testType, testName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = testType === 'head-to-head' && testName ? testName : 'Test-' + testId;

  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);

    if (testType === 'head-to-head') {
      // Create combined sheet with summary at top, raw data below

      // Summary section headers
      const summaryHeaders = ['RANKING', '', '', '', '', ''];
      sheet.getRange(1, 1, 1, 6).setValues([summaryHeaders]);
      sheet.getRange(1, 1, 1, 6).merge();
      sheet.getRange(1, 1).setFontSize(14).setFontWeight('bold').setBackground('#28a745').setFontColor('#ffffff').setHorizontalAlignment('center');

      const rankingHeaders = ['Rank', 'Thumbnail', 'Wins', 'Losses', 'Total', 'Win Rate %'];
      sheet.getRange(2, 1, 1, 6).setValues([rankingHeaders]);
      const rankHeaderRange = sheet.getRange(2, 1, 1, 6);
      rankHeaderRange.setFontWeight('bold').setBackground('#28a745').setFontColor('#ffffff').setHorizontalAlignment('center');

      // Set column widths for summary
      sheet.setColumnWidth(1, 80);  // Rank
      sheet.setColumnWidth(2, 250); // Thumbnail
      sheet.setColumnWidth(3, 100); // Wins
      sheet.setColumnWidth(4, 100); // Losses
      sheet.setColumnWidth(5, 100); // Total
      sheet.setColumnWidth(6, 120); // Win Rate

      // Add separator and raw data section (starting at row 15)
      const rawDataStartRow = 15;
      sheet.getRange(rawDataStartRow - 1, 1, 1, 10).merge();
      sheet.getRange(rawDataStartRow - 1, 1).setValue('RAW DATA').setFontSize(12).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff').setHorizontalAlignment('center');

      const rawHeaders = ['Timestamp', 'Test ID', 'Name', 'Email', 'Age Group', 'Gender', 'Matchup #', 'Thumbnail A', 'Thumbnail B', 'Winner'];
      sheet.getRange(rawDataStartRow, 1, 1, 10).setValues([rawHeaders]);
      const rawHeaderRange = sheet.getRange(rawDataStartRow, 1, 1, 10);
      rawHeaderRange.setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');

      sheet.setFrozenRows(2); // Freeze summary headers

      Logger.log('Created combined results sheet: ' + sheetName);
    } else {
      // Grid test - original format
      const headers = ['Timestamp', 'Test ID', 'Name', 'Email', 'Age Group', 'Gender', 'Video Title', 'Rating', 'Rating Score'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
      sheet.setFrozenRows(1);

      for (let i = 1; i <= headers.length; i++) {
        sheet.autoResizeColumn(i);
      }

      Logger.log('Created grid results sheet: ' + sheetName);
    }
  }

  return sheet;
}


/**
 * Update head-to-head summary section with aggregated results
 */
function updateHeadToHeadSummary(sheet) {
  const rawDataStartRow = 15;
  const lastRow = sheet.getLastRow();

  if (lastRow < rawDataStartRow + 1) {
    // No raw data yet
    return;
  }

  // Get raw data (starting from row 16, which is rawDataStartRow + 1)
  const dataRange = sheet.getRange(rawDataStartRow + 1, 1, lastRow - rawDataStartRow, 10);
  const data = dataRange.getValues();

  // Aggregate results - column 10 (index 9) is the Winner
  const thumbnailStats = {};

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const thumbnailA = row[7]; // Column H
    const thumbnailB = row[8]; // Column I
    const winner = row[9];     // Column J

    if (!thumbnailA || !thumbnailB) continue; // Skip empty rows

    // Initialize stats for thumbnails
    if (!thumbnailStats[thumbnailA]) {
      thumbnailStats[thumbnailA] = { wins: 0, losses: 0 };
    }
    if (!thumbnailStats[thumbnailB]) {
      thumbnailStats[thumbnailB] = { wins: 0, losses: 0 };
    }

    // Record win/loss
    if (winner === thumbnailA) {
      thumbnailStats[thumbnailA].wins++;
      thumbnailStats[thumbnailB].losses++;
    } else if (winner === thumbnailB) {
      thumbnailStats[thumbnailB].wins++;
      thumbnailStats[thumbnailA].losses++;
    }
  }

  // Convert to array and calculate win rates
  const results = [];
  for (const thumbnail in thumbnailStats) {
    const stats = thumbnailStats[thumbnail];
    const total = stats.wins + stats.losses;
    const winRate = total > 0 ? (stats.wins / total) * 100 : 0;

    results.push({
      thumbnail: thumbnail,
      wins: stats.wins,
      losses: stats.losses,
      total: total,
      winRate: winRate
    });
  }

  // Sort by win rate (descending)
  results.sort((a, b) => b.winRate - a.winRate);

  // Clear existing summary data (rows 3-13)
  if (sheet.getRange(3, 1).getValue()) {
    sheet.getRange(3, 1, 11, 6).clear();
  }

  // Write results to summary section (starting at row 3)
  const outputData = results.map((result, index) => [
    index + 1,                    // Rank
    result.thumbnail,             // Thumbnail
    result.wins,                  // Wins
    result.losses,                // Losses
    result.total,                 // Total Matchups
    result.winRate.toFixed(1) + '%'  // Win Rate %
  ]);

  if (outputData.length > 0) {
    sheet.getRange(3, 1, outputData.length, 6).setValues(outputData);

    // Format the data
    const dataRange = sheet.getRange(3, 1, outputData.length, 6);
    dataRange.setHorizontalAlignment('center');

    // Highlight top 3
    if (outputData.length >= 1) {
      sheet.getRange(3, 1, 1, 6).setBackground('#ffd700'); // Gold
    }
    if (outputData.length >= 2) {
      sheet.getRange(4, 1, 1, 6).setBackground('#c0c0c0'); // Silver
    }
    if (outputData.length >= 3) {
      sheet.getRange(5, 1, 1, 6).setBackground('#cd7f32'); // Bronze
    }

    // Bold rank column
    sheet.getRange(3, 1, outputData.length, 1).setFontWeight('bold');

    // Bold win rate column
    sheet.getRange(3, 6, outputData.length, 1).setFontWeight('bold');
  }

  Logger.log('Updated summary section in sheet: ' + sheet.getName());
}

/**
 * Convert rating text to numeric score (1-5)
 */
function ratingToScore(rating) {
  const ratingMap = {
    'hate': 1,
    'no': 2,
    'meh': 3,
    'interesting': 4,
    'love': 5
  };
  return ratingMap[rating] || 0;
}

/**
 * Write a response to the results sheet
 */
function writeResponseToSheet(sheet, data) {
  const timestamp = data.timestamp || new Date().toISOString();
  const testId = data.testId || 'unknown';
  const name = data.name || '';
  const email = data.email || '';
  const ageGroup = data.ageGroup || '';
  const gender = data.gender || '';

  const ratings = data.ratings || [];

  if (ratings.length === 0) {
    sheet.appendRow([
      timestamp,
      testId,
      name,
      email,
      ageGroup,
      gender,
      'No ratings provided',
      '',
      ''
    ]);
  } else {
    ratings.forEach(rating => {
      const ratingText = rating.rating || '';
      const ratingScore = ratingToScore(ratingText);

      sheet.appendRow([
        timestamp,
        testId,
        name,
        email,
        ageGroup,
        gender,
        rating.video || '',
        ratingText,
        ratingScore
      ]);
    });
  }

  Logger.log('Wrote ' + ratings.length + ' ratings to sheet for test: ' + testId);
}

/**
 * Write head-to-head results to the results sheet (raw data section)
 */
function writeHeadToHeadResponseToSheet(sheet, data) {
  const timestamp = data.timestamp || new Date().toISOString();
  const testId = data.testId || 'unknown';
  const name = data.name || '';
  const email = data.email || '';
  const ageGroup = data.ageGroup || '';
  const gender = data.gender || '';

  const results = data.results || [];

  // Find the last row in the sheet to append data
  const lastRow = sheet.getLastRow();

  if (results.length === 0) {
    sheet.appendRow([
      timestamp,
      testId,
      name,
      email,
      ageGroup,
      gender,
      'No results provided',
      '',
      '',
      ''
    ]);
  } else {
    results.forEach(result => {
      sheet.appendRow([
        timestamp,
        testId,
        name,
        email,
        ageGroup,
        gender,
        result.matchupNumber || '',
        result.thumbnailA || '',
        result.thumbnailB || '',
        result.winner || ''
      ]);
    });
  }

  Logger.log('Wrote ' + results.length + ' head-to-head results to sheet for test: ' + testId);
}

/**
 * Update summaries for all existing head-to-head tests
 * Run this to refresh summary sections with latest data
 */
function updateAllHeadToHeadSummaries() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = spreadsheet.getSheetByName('TestConfigs');

  if (!configSheet) {
    Logger.log('No TestConfigs sheet found');
    return { processed: 0 };
  }

  const data = configSheet.getDataRange().getValues();
  let processed = 0;

  // Skip header row (index 0)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      try {
        const testId = data[i][0];
        const config = JSON.parse(data[i][2]);

        // Only process head-to-head tests
        if (config.testType === 'head-to-head') {
          const testName = config.testName || testId;
          const sheet = spreadsheet.getSheetByName(testName);

          if (sheet) {
            Logger.log('Updating summary for: ' + testName);
            updateHeadToHeadSummary(sheet);
            processed++;
          } else {
            Logger.log('Sheet not found: ' + testName);
          }
        }
      } catch (error) {
        Logger.log('Error processing test ' + data[i][0] + ': ' + error.toString());
      }
    }
  }

  Logger.log('=== Update Complete ===');
  Logger.log('Tests processed: ' + processed);

  return { processed: processed };
}

/**
 * Test function - Create a sample test
 */
function testCreateTest() {
  const testData = {
    action: 'createTest',
    testId: 'test-sample-' + new Date().getTime(),
    videos: [
      {
        title: 'Sample Video 1',
        thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      }
    ]
  };

  const result = handleTestCreation(testData);
  Logger.log(result.getContent());
}

/**
 * Test function - Submit sample results
 */
function testSubmitResults() {
  const testData = {
    testId: 'test-sample-123',
    timestamp: new Date().toISOString(),
    name: 'Test User',
    email: 'test@example.com',
    ageGroup: '25-34',
    gender: 'Prefer not to say',
    ratings: [
      { video: 'Test Video 1', rating: 'love' },
      { video: 'Test Video 2', rating: 'interesting' }
    ]
  };

  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}

/**
 * Get all tests from TestConfigs sheet
 */
function getAllTests() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName('TestConfigs');

  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const tests = [];

  // Skip header row (index 0)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) { // If test ID exists
      try {
        const config = JSON.parse(data[i][2]);
        tests.push({
          testId: data[i][0],
          created: data[i][1],
          videoCount: config.videos ? config.videos.length : 0,
          testType: config.testType || 'grid',
          matchupsPerThumbnail: config.matchupsPerThumbnail || null,
          testName: config.testName || data[i][0]
        });
      } catch (error) {
        Logger.log('Error parsing test config for ' + data[i][0] + ': ' + error.toString());
      }
    }
  }

  // Sort by created date, newest first
  tests.sort((a, b) => new Date(b.created) - new Date(a.created));

  return tests;
}

/**
 * Handle test deletion
 */
function handleTestDeletion(data) {
  const testId = data.testId;

  if (!testId) {
    throw new Error('Missing test ID for deletion');
  }

  // Get test config to find the sheet name
  const testConfig = getTestConfig(testId);
  const testName = testConfig ? testConfig.testName : null;

  // Delete from TestConfigs sheet
  deleteTestConfig(testId);

  // Delete results sheet tab (use test name if available)
  if (testId.startsWith('h2h-') && testName) {
    deleteTestSheetByName(testName);
  } else {
    deleteTestSheet(testId);
  }

  // Delete Drive folder if it exists
  deleteTestDriveFolder(testId);

  return ContentService.createTextOutput(JSON.stringify({
    'status': 'success',
    'message': 'Test deleted successfully',
    'testId': testId
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Delete test configuration from TestConfigs sheet
 */
function deleteTestConfig(testId) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName('TestConfigs');

  if (!sheet) {
    return;
  }

  const data = sheet.getDataRange().getValues();

  // Find and delete the row
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === testId) {
      sheet.deleteRow(i + 1); // +1 because sheet rows are 1-indexed
      Logger.log('Deleted test config for: ' + testId);
      return;
    }
  }
}

/**
 * Delete test results sheet tab
 */
function deleteTestSheet(testId) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'Test-' + testId;
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (sheet) {
    spreadsheet.deleteSheet(sheet);
    Logger.log('Deleted results sheet: ' + sheetName);
  }
}

/**
 * Delete test results sheet by name
 */
function deleteTestSheetByName(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (sheet) {
    spreadsheet.deleteSheet(sheet);
    Logger.log('Deleted results sheet: ' + sheetName);
  }
}

/**
 * Delete test Drive folder
 */
function deleteTestDriveFolder(testId) {
  try {
    const mainFolder = getOrCreateDriveFolder();
    const folders = mainFolder.getFoldersByName('Test-' + testId);

    if (folders.hasNext()) {
      const folder = folders.next();
      folder.setTrashed(true);
      Logger.log('Deleted Drive folder: Test-' + testId);
    }
  } catch (error) {
    Logger.log('Error deleting Drive folder: ' + error.toString());
  }
}
