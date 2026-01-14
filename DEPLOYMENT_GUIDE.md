# Thumbnail Tester - Deployment Guide

## Overview
Your thumbnail tester now supports multiple independent tests! Each test gets:
- A unique test ID
- Its own data file (`data-{testId}.json`)
- Its own Google Sheets tab for results

---

## Step 1: Deploy the Apps Script

### Option A: Using Google Apps Script Web Editor (Easier)

1. **Open your Google Sheet** where you want results to appear

2. **Open Apps Script Editor**
   - Go to: Extensions → Apps Script

3. **Replace the existing code**
   - Delete any existing code in `Code.gs`
   - Copy all contents from `Code.gs` (in this folder)
   - Paste into the Apps Script editor

4. **Deploy as Web App**
   - Click "Deploy" → "New deployment"
   - Click the gear icon → Select "Web app"
   - Settings:
     - Description: "Thumbnail Tester Backend"
     - Execute as: **Me**
     - Who has access: **Anyone**
   - Click "Deploy"
   - **Copy the Web App URL** (you'll need this!)

5. **Update index.html**
   - Open `index.html` in a text editor
   - Find line ~628: `const SHEET_URL = 'https://script.google.com/...'`
   - Replace with your new Web App URL
   - Save the file

---

### Option B: Using clasp CLI (For developers)

```bash
# Install clasp if you haven't
npm install -g @google/clasp

# Login to Google
clasp login

# Create a new script (or use existing)
clasp create --title "Thumbnail Tester Backend" --type sheets --rootDir .

# Push the code
clasp push

# Deploy as web app
clasp deploy --description "Thumbnail Tester v1"

# Get the deployment URL
clasp deployments
```

Then update `index.html` with the Web App URL as described above.

---

## Step 2: Create a Test

1. **Open `admin.html`** in your browser

2. **Generate or Enter a Test ID**
   - Click "Generate Random ID" for an automatic ID
   - OR type your own (e.g., `marketing-team-jan2026`)
   - Use only letters, numbers, and hyphens

3. **Upload Thumbnails**
   - Drag and drop thumbnail images
   - Add titles to each video

4. **Publish Test**
   - Click "Publish Test"
   - Download the `data-{testId}.json` file
   - Place it in the same folder as `index.html` and `admin.html`

5. **Copy the Test URL**
   - Example: `https://yoursite.com/index.html?test=marketing-team-jan2026`
   - Share this URL with your testers

---

## Step 3: Run a Test

1. **Testers open the URL** you provided

2. **They sign in** with Google

3. **Complete demographics** questions

4. **Rate thumbnails** (select rating buttons)

5. **Submit feedback**

6. **Results appear automatically** in your Google Sheet
   - New tab created: `Test-{testId}`
   - Each submission adds rows to that tab

---

## Managing Multiple Tests

### Active Tests
Each test is completely independent:
- Different URL: `?test=test1` vs `?test=test2`
- Different data file: `data-test1.json` vs `data-test2.json`
- Different Sheet tab: `Test-test1` vs `Test-test2`

### Test Organization
Recommended naming conventions:
- `marketing-q1-2026` - By department and time
- `sarah-thumbnails-jan14` - By creator and date
- `variant-a` / `variant-b` - For A/B testing

### File Management
Your folder will look like:
```
/thumbnail-tester/
  ├── index.html
  ├── admin.html
  ├── data-test1.json
  ├── data-test2.json
  ├── data-marketing-q1.json
  └── ...
```

---

## Troubleshooting

### "No test ID provided in URL"
- Make sure the URL includes `?test=your-test-id`
- Check that the test ID matches the data file name

### "Test data file not found"
- Verify `data-{testId}.json` is in the same folder as `index.html`
- Check the filename exactly matches the test ID

### Results not appearing in Google Sheets
- Check the Apps Script deployment is set to "Anyone" access
- Verify the SHEET_URL in `index.html` is correct
- Check Apps Script execution logs (View → Executions)

### Testing the Apps Script
Run the `testDoPost()` function in the Apps Script editor:
1. Select `testDoPost` from the function dropdown
2. Click "Run"
3. Check Executions log for results
4. Verify a new tab "Test-test-sample-123" appears in your sheet

---

## What Changed?

### admin.html
- ✅ Added Test ID input field
- ✅ Auto-generate random test IDs
- ✅ Save as `data-{testId}.json`
- ✅ Show shareable test URL with test parameter

### index.html
- ✅ Read test ID from URL parameter `?test=xxx`
- ✅ Load corresponding `data-{testId}.json`
- ✅ Send test ID with all submissions

### Apps Script (Code.gs)
- ✅ Receive test ID from submissions
- ✅ Auto-create sheet tabs per test ID
- ✅ Route data to correct tab
- ✅ Format headers and freeze rows

---

## Next Steps

1. Deploy the Apps Script (Step 1)
2. Create your first test (Step 2)
3. Share the test URL with a small group
4. Verify results appear in correct Sheet tab
5. Create additional tests as needed!

---

**Questions?** Check the troubleshooting section or review the Apps Script execution logs.
