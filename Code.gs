/**
 * HX Thumbnail Tester - Google Apps Script Backend
 * This script receives POST requests from the thumbnail tester and writes results to separate tabs per test
 */

/**
 * Handle POST requests from the thumbnail tester
 */
function doPost(e) {
  try {
    // Parse incoming data
    const data = JSON.parse(e.postData.contents);

    // Extract test ID
    const testId = data.testId || 'unknown-test';

    // Get or create the sheet tab for this test
    const sheet = getOrCreateTestSheet(testId);

    // Write the data to the sheet
    writeResponseToSheet(sheet, data);

    return ContentService.createTextOutput(JSON.stringify({
      'status': 'success',
      'message': 'Data recorded successfully',
      'testId': testId
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get existing sheet tab or create a new one for the test ID
 */
function getOrCreateTestSheet(testId) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'Test-' + testId;

  // Try to get existing sheet
  let sheet = spreadsheet.getSheetByName(sheetName);

  // If sheet doesn't exist, create it
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);

    // Add header row
    const headers = [
      'Timestamp',
      'Test ID',
      'Name',
      'Email',
      'Age Group',
      'Gender',
      'Video Title',
      'Rating'
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');

    // Freeze header row
    sheet.setFrozenRows(1);

    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }

    Logger.log('Created new sheet: ' + sheetName);
  }

  return sheet;
}

/**
 * Write a response to the sheet
 * Each rating gets its own row
 */
function writeResponseToSheet(sheet, data) {
  const timestamp = data.timestamp || new Date().toISOString();
  const testId = data.testId || 'unknown';
  const name = data.name || '';
  const email = data.email || '';
  const ageGroup = data.ageGroup || '';
  const gender = data.gender || '';

  // Each rating becomes a separate row
  const ratings = data.ratings || [];

  if (ratings.length === 0) {
    // If no ratings, still record the response
    sheet.appendRow([
      timestamp,
      testId,
      name,
      email,
      ageGroup,
      gender,
      'No ratings provided',
      ''
    ]);
  } else {
    // Write each rating as a separate row
    ratings.forEach(rating => {
      sheet.appendRow([
        timestamp,
        testId,
        name,
        email,
        ageGroup,
        gender,
        rating.video || '',
        rating.rating || ''
      ]);
    });
  }

  Logger.log('Wrote ' + ratings.length + ' ratings to sheet for test: ' + testId);
}

/**
 * Test function to verify script works
 * Run this from the Apps Script editor to test
 */
function testDoPost() {
  const testData = {
    testId: 'test-sample-123',
    timestamp: new Date().toISOString(),
    name: 'Test User',
    email: 'test@example.com',
    ageGroup: '25-34',
    gender: 'Prefer not to say',
    ratings: [
      { video: 'Test Video 1', rating: 'love' },
      { video: 'Test Video 2', rating: 'interesting' },
      { video: 'Test Video 3', rating: 'meh' }
    ]
  };

  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  const result = doPost(mockEvent);
  Logger.log('Test result: ' + result.getContent());
}
