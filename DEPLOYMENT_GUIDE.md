# Thumbnail Tester - Self-Service Deployment Guide

## 🎉 What This Is

A **fully self-service** thumbnail testing platform where:
- ✅ Anyone visits your admin page
- ✅ Uploads thumbnails (full quality)
- ✅ Gets instant shareable test URL
- ✅ No manual file uploads
- ✅ No GitHub access needed
- ✅ Images stored in Google Drive
- ✅ Results in Google Sheets

**One deployment serves unlimited users!**

---

## 📋 One-Time Setup (You do this once)

### Step 1: Update Your Apps Script

1. **Open your Google Sheet** (the one you created earlier)

2. **Go to Extensions → Apps Script**

3. **Replace ALL code** with the contents of `Code.gs` from this repo

4. **Save** (💾 icon or Cmd+S)

5. **Deploy as Web App:**
   - Click **Deploy** → **New deployment**
   - Click ⚙️ icon → Select **"Web app"**
   - Settings:
     - Description: `Thumbnail Tester Self-Service Backend`
     - Execute as: **Me**
     - Who has access: **Anyone**
   - Click **Deploy**
   - **Authorize** permissions when prompted
   - **Copy the Web App URL**

6. **Update the Web App URL in both files:**
   - Open `admin.html` in a text editor
   - Find line ~450: `const SHEET_URL = '...'`
   - Replace with your new Web App URL
   - Open `index.html` in a text editor
   - Find line ~520: `const SHEET_URL = '...'`
   - Replace with the same URL
   - Save both files

### Step 2: Deploy to GitHub Pages (Optional but Recommended)

If you want a public URL anyone can access:

```bash
# Commit changes
git add .
git commit -m "Enable self-service test creation"
git push origin main

# GitHub Pages should auto-deploy
# Your site will be at: https://YOUR-USERNAME.github.io/thumbnail-tester/
```

**OR** just host the HTML files anywhere (any web server, Netlify, Vercel, etc.)

---

## 🚀 How Users Create Tests

### For Test Creators (Anyone):

1. **Open the admin page:**
   ```
   https://YOUR-USERNAME.github.io/thumbnail-tester/admin.html
   ```

2. **Generate or enter a Test ID**
   - Click "Generate Random ID" for automatic ID
   - OR type your own (e.g., `marketing-jan-2026`)

3. **Upload thumbnails**
   - Drag & drop thumbnail images
   - Add titles to each video

4. **Click "Publish Test"**
   - Images automatically upload to Google Drive
   - Test config saved to Google Sheet
   - **Get shareable URL immediately!**

5. **Share the test URL** with your team:
   ```
   https://YOUR-USERNAME.github.io/thumbnail-tester/index.html?test=YOUR-TEST-ID
   ```

### For Test Takers:

1. Click the test URL
2. Sign in with Google
3. Fill out demographics
4. Rate thumbnails
5. Submit feedback
6. Done! Results appear in the Google Sheet

---

## 📊 Viewing Results

### In Your Google Sheet:

- **TestConfigs tab** - All published tests and their configs
- **Test-{testId} tabs** - Results for each specific test
- **Thumbnail Tester Images folder** in Google Drive - All uploaded images organized by test

---

## 🔧 Behind the Scenes

### What Happens When Someone Publishes:

```
User uploads images in browser
  ↓
POST to Apps Script with base64 images
  ↓
Apps Script creates Drive folder "Test-{testId}"
  ↓
Uploads each image to Drive
  ↓
Makes images publicly viewable
  ↓
Stores test config with Drive URLs in Sheet
  ↓
Returns success to admin
  ↓
Admin gets shareable URL instantly
```

### What Happens When Someone Takes Test:

```
User opens index.html?test=abc123
  ↓
GET request to Apps Script
  ↓
Apps Script looks up test config in Sheet
  ↓
Returns video titles + Drive image URLs
  ↓
Browser loads images from Drive
  ↓
User submits ratings
  ↓
POST to Apps Script
  ↓
Apps Script creates/updates results tab
```

---

## 🎯 Key Features

### For Administrators:
- ✅ One-time setup
- ✅ Centralized results in one Sheet
- ✅ All images organized in one Drive folder
- ✅ Track all tests in TestConfigs tab

### For Test Creators:
- ✅ No setup required
- ✅ Just visit admin URL
- ✅ Upload → Publish → Share
- ✅ Full quality images (no compression)
- ✅ Instant shareable links

### For Test Takers:
- ✅ Just click link
- ✅ Sign in and rate
- ✅ Fast loading from Drive
- ✅ Clean, modern interface

---

## 🔐 Security & Privacy

- **Apps Script runs as YOU** - All Drive/Sheet access uses your permissions
- **Images are public with link** - Anyone with Drive URL can view (required for testing)
- **Results are private** - Only you can access the Google Sheet
- **No user auth for creating tests** - Anyone can create tests (by design)
- **Tester auth via Google** - Testers sign in to prevent spam

---

## 🐛 Troubleshooting

### "Failed to publish test"
- Check Apps Script is deployed with "Anyone" access
- Verify Web App URL is correct in admin.html
- Check Apps Script execution logs

### "Test not found" when loading
- Test ID might be mistyped
- Test might not have been published successfully
- Check TestConfigs tab in Sheet for the test ID

### Images not loading
- Check Drive folder permissions
- Verify images were uploaded (check Drive folder)
- Check browser console for errors

### OAuth errors
- Make sure you're using HTTPS (GitHub Pages) not file://
- Clear browser cache and try again

---

## 📈 Scaling

This setup handles:
- ✅ Unlimited tests
- ✅ Unlimited users creating tests
- ✅ 10-20 thumbnails per test (recommended)
- ✅ Hundreds of testers per test

**Limits:**
- Google Drive: 15GB free storage
- Apps Script: 6 min execution time per request
- Very large images (>5MB each) may timeout

**Recommendations:**
- Keep thumbnails under 2MB each
- Limit to 20 thumbnails per test for best performance

---

## 🎊 You're Done!

Your thumbnail tester is now live and ready for anyone to use. No manual steps, no file uploads, just pure self-service magic!

Share your admin URL and let people create their own tests! 🚀
