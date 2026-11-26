# AI Complaint Classification & Grievance Redressal System

**Madhav Institute of Technology & Science (MITS), Gwalior**  
A client-side NLP complaint triage and classification system designed for automated grievance routing, urgency detection, and ticket lifecycle tracking.

---

## Overview

The system processes student and faculty complaint statements locally in the browser, extracts key semantic vocabulary, calculates category confidence scores, assesses urgency levels, and assigns complaints to the appropriate campus department with estimated SLA resolution targets.

---

## Current Progress & Features

### 1. Institutional Branding & Layout
- **MITS Institutional Header**: Centered brand lockup pairing `mits-logo.png` and `flag-logo2.png` alongside *Madhav Institute of Technology & Science, Gwalior*.
- **Theme Controller**: Seamless Light and Dark mode toggle persisting state in `localStorage`.
- **Palette Compliance**: Built strictly using the specified design palette:
  - Primary: `#0F172A` (Slate 900)
  - Secondary: `#4F46E5` (Indigo 600)
  - Tertiary: `#10B981` (Emerald 500)
  - Neutral: `#64748B` (Slate 500)
- **Responsive Navigation**: Collapsible sidebar with real-time open complaint count badge.

### 2. Client-Side NLP Engine (`app.js`)
- **Real-Time Live Classification**: As users type in the problem statement box, a live diagnostic indicator dynamically evaluates and surfaces the predicted category, confidence score, and urgency tag before submission.
- **Multi-Intent & Urgency Flags**: Detects critical emergency keywords (e.g., hazard, shock, leak, fire) to flag urgent tickets for immediate administrative review.
- **Weighted Rule-Based Scoring**: Evaluates multi-word phrases and domain keywords across 8 campus categories:
  - Academic Affairs (SLA: 48h)
  - Examination Cell (SLA: 24h)
  - Hostel Administration (SLA: 24h)
  - Accounts & Finance (SLA: 48h)
  - Facility Maintenance (SLA: 12h)
  - IT Support Services (SLA: 12h)
  - Administrative Services (SLA: 48h)
  - General Triage Queue (Fallback: 72h)

### 3. Interactive Triage Dashboard
- **Live Status Metrics**: KPI cards tracking Total Filed, Pending Triage, In Progress, and Resolved tickets.
- **Category Volume Distribution**: Visual bar chart tracking complaint volume across departments.
- **Interactive Ticket Drawer**: Clicking any table row opens a slide-out drawer to re-assign departments, change resolution status, view audit history, or delete records.
- **Stream Simulation**: One-click simulator that streams realistic incoming complaints into the queue with live toast notifications.
- **Search & Filters**: Instant table filtering by category, status, and search query.
- **CSV Data Export**: One-click export of stored complaint records to `.csv`.

### 4. Ticket Tracking & Routing Reference
- **Status Stepper**: Timeline tracking ticket progression from `Submitted` &rarr; `Assigned` &rarr; `In Progress` &rarr; `Resolved` &rarr; `Closed`.
- **Active Routing Dictionary**: Complete reference table mapping categories to responsible campus departments and SLA targets.

---

## File Structure

```
complaint-classification-system/
├── HTML .html         # Primary application entry point
├── index.html         # Standard web server mirror
├── style.css          # Design system, themes, and interactive component styles
├── app.js             # NLP classification engine, triage controller, and storage
├── mits-logo.png      # MITS Gwalior institutional logo
├── flag-logo2.png     # National emblem / flag logo
└── README.md          # Project documentation
```

---

## Local Development & Setup

1. **Direct Browser**:
   Open [`HTML .html`](HTML%20.html) or [`index.html`](index.html) directly in any modern web browser.

2. **Local HTTP Server**:
   ```bash
   # Start server using Python
   python -m http.server 8080
   ```
   Open `http://localhost:8080/index.html` in your browser.
