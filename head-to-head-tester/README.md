# Head-to-Head Thumbnail Tester

A comparison-based thumbnail testing tool where users choose between two thumbnails at a time, creating a tournament-style ranking system.

## Features

- **Head-to-Head Comparisons**: Users see two thumbnails side-by-side and pick the better one
- **Fair Matchup Distribution**: Each thumbnail appears equally (configurable: 3, 5, 7, or 10 times)
- **Win/Loss Tracking**: Results show clear winners based on win rate
- **Self-Service**: Create tests without any manual file management
- **Google Auth**: Users sign in with Google account to participate
- **Auto-Created Sheets**: Each test gets its own results tab automatically

## Files

- `admin.html` - Create and manage head-to-head tests
- `test.html` - The comparison interface where users pick winners
- Shares backend with main thumbnail-tester (Code.js in root)

## How It Works

1. **Admin creates test** → Uploads images, selects matchups per thumbnail
2. **Backend uploads to Drive** → Images stored in Google Drive
3. **Test link generated** → Unique URL created (format: `?test=h2h-xxxxx`)
4. **Users take test** → Sign in with Google, compare thumbnails head-to-head
5. **Results recorded** → Each matchup winner recorded in Google Sheets

## Results Structure

Each comparison records:
- Timestamp
- User info (name, email, age, gender)
- Matchup number
- Thumbnail A title
- Thumbnail B title
- Winner

## Scoring

Results can be aggregated to show:
- **Win Rate**: Wins ÷ Total Matchups
- **Total Wins**: Number of times each thumbnail won
- **Ranking**: Sort by win rate to see clear winner

## Deployment

Host the HTML files on any static server (e.g., GitHub Pages). The backend runs on Google Apps Script and handles all data storage.

## Setup

1. Ensure Code.js is deployed to Apps Script
2. Update `SHEET_URL` in both HTML files with your Apps Script Web App URL
3. Update `SHEET_ID` in admin.html with your Google Sheets ID
4. Deploy HTML files to web server

## Comparison with Grid Tester

| Feature | Grid Tester | Head-to-Head |
|---------|-------------|--------------|
| UI | All thumbnails at once | Two at a time |
| Rating | 5-point scale per thumbnail | Winner/loser binary |
| Comparisons | Independent ratings | Relative comparisons |
| Best for | Overall appeal | Direct competition |
| Results | Average rating score | Win rate ranking |
