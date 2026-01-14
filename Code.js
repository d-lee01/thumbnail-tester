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
      'videos': testConfig.videos
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
    if (data.action === 'createTest') {
      return handleTestCreation(data);
    } else if (data.action === 'deleteTest') {
      return handleTestDeletion(data);
    } else if (data.testId && data.ratings) {
      return handleResultSubmission(data);
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
  const videos = data.videos || [];

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
  saveTestConfig(testId, videosWithUrls);

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

  // Get or create the results sheet tab for this test
  const sheet = getOrCreateTestSheet(testId);

  // Write the data to the sheet
  writeResponseToSheet(sheet, data);

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
function saveTestConfig(testId, videos) {
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
  const configJson = JSON.stringify({ videos: videos });

  sheet.appendRow([
    testId,
    new Date().toISOString(),
    configJson
  ]);

  Logger.log('Saved test config for: ' + testId);
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
function getOrCreateTestSheet(testId) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'Test-' + testId;

  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);

    const headers = [
      'Timestamp',
      'Test ID',
      'Name',
      'Email',
      'Age Group',
      'Gender',
      'Video Title',
      'Rating',
      'Rating Score'
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');

    sheet.setFrozenRows(1);

    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }

    Logger.log('Created new results sheet: ' + sheetName);
  }

  return sheet;
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
          videoCount: config.videos ? config.videos.length : 0
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

  // Delete from TestConfigs sheet
  deleteTestConfig(testId);

  // Delete results sheet tab if it exists
  deleteTestSheet(testId);

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
