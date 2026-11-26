/**
 * AI-Based Complaint Classification Engine & Interactive UI Controller
 */

const CATEGORIES = {
  Academic: {
    dept: "Academic Affairs",
    sla: "48h",
    keywords: [
      "class", "lecture", "faculty", "professor", "teacher", "teaching", "syllabus",
      "course", "subject", "timetable", "attendance", "curriculum", "assignment",
      "study material", "lab session", "semester", "classes missed"
    ]
  },
  Examination: {
    dept: "Examination Cell",
    sla: "24h",
    keywords: [
      "exam", "examination", "result", "admit card", "hall ticket", "marks",
      "evaluation", "revaluation", "answer sheet", "grade", "invigilator",
      "marksheet", "backlog", "question paper", "paper checking"
    ]
  },
  Hostel: {
    dept: "Hostel Administration",
    sla: "24h",
    keywords: [
      "hostel", "mess", "food", "warden", "roommate", "laundry", "dorm",
      "room allotment", "curfew", "bed", "mattress", "dining", "water cooler"
    ]
  },
  "Fees & Finance": {
    dept: "Accounts & Finance",
    sla: "48h",
    keywords: [
      "fee", "tuition", "refund", "payment", "scholarship", "receipt", "challan",
      "deposit", "fine", "overcharged", "installment", "paid twice", "late fee", "bank"
    ]
  },
  Infrastructure: {
    dept: "Facility Maintenance",
    sla: "12h",
    keywords: [
      "building", "classroom", "bench", "projector", "washroom", "toilet", "water",
      "electricity", "fan", "light", "parking", "library", "playground", "leak",
      "broken", "lift", "air conditioner", "power cut", "furniture", "dirty"
    ]
  },
  "IT / Technical": {
    dept: "IT Support Services",
    sla: "12h",
    keywords: [
      "wifi", "wi-fi", "internet", "portal", "website", "login", "password",
      "server", "network", "software", "email", "computer", "lms", "otp",
      "error", "crash", "app", "not loading", "account locked"
    ]
  },
  Administration: {
    dept: "Administrative Services",
    sla: "48h",
    keywords: [
      "office", "certificate", "bonafide", "transcript", "id card", "document",
      "clerk", "staff", "admission", "transfer", "noc", "rude", "harassment",
      "delay", "application", "bus", "transport"
    ]
  },
  Other: {
    dept: "General Triage Queue",
    sla: "72h",
    keywords: []
  }
};

const URGENT_TRIGGERS = [
  "fire", "leak", "electric shock", "harassment", "emergency", "urgent",
  "broken glass", "hazard", "food poison", "assault", "severe", "spark"
];

const STATUS_LIST = ["Pending", "Assigned", "In Progress", "Resolved", "Closed"];
const CAT_KEYS = Object.keys(CATEGORIES);

const MATCH_RULES = {};
CAT_KEYS.forEach(cat => {
  MATCH_RULES[cat] = CATEGORIES[cat].keywords.map(kw => ({
    term: kw,
    weight: kw.includes(" ") ? 2.5 : 1.0,
    rx: new RegExp("\\b" + kw.replace(/[-]/g, "[- ]?") + "(s|es)?\\b", "i")
  }));
});

const EXAMPLES = [
  "Hostel mess food quality is substandard and causing illness.",
  "Semester exam result missing marks for data structures subject.",
  "Tuition fee deducted twice from bank account. Refund needed.",
  "Wi-Fi down in engineering block and student portal gives error 502.",
  "Ceiling fan sparking wire fire in lecture hall 302.",
  "Bonafide certificate request delayed for over two weeks."
];

let COMPLAINTS = [];
let ACTIVE_INSPECT_ID = null;

// DOM Helpers
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const escapeHTML = str => String(str || "").replace(/[&<>"]/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
}[c]));

const formatDate = ts => new Date(ts).toLocaleString("en-US", {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false
});

// Toast System
function showToast(message) {
  const container = $("#toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

// Storage
function loadData() {
  try {
    COMPLAINTS = JSON.parse(localStorage.getItem("complaints_db") || "[]");
  } catch (e) {
    COMPLAINTS = [];
  }
}

function saveData() {
  try {
    localStorage.setItem("complaints_db", JSON.stringify(COMPLAINTS));
  } catch (e) {}
}

// NLP Engine
function classifyText(text) {
  const scores = {};
  const matchedTerms = {};
  let totalScore = 0;

  CAT_KEYS.forEach(cat => {
    scores[cat] = 0;
    matchedTerms[cat] = [];
    MATCH_RULES[cat].forEach(rule => {
      if (rule.rx.test(text)) {
        scores[cat] += rule.weight;
        matchedTerms[cat].push(rule.term);
      }
    });
    totalScore += scores[cat];
  });

  const ranked = CAT_KEYS.filter(c => c !== "Other").sort((a, b) => scores[b] - scores[a]);
  const primaryCat = ranked[0];
  const secondaryCat = ranked[1];

  let urgency = "Normal";
  for (const term of URGENT_TRIGGERS) {
    if (new RegExp("\\b" + term + "\\b", "i").test(text)) {
      urgency = "Urgent";
      break;
    }
  }

  if (scores[primaryCat] <= 0) {
    return {
      category: "Other",
      confidence: 38,
      matched: [],
      secondary: null,
      urgency,
      dept: CATEGORIES.Other.dept,
      sla: CATEGORIES.Other.sla
    };
  }

  const ratio = scores[primaryCat] / Math.max(1, totalScore);
  const confidence = Math.min(98, Math.round(52 + (ratio * 40) + Math.min(6, scores[primaryCat] * 2)));
  const secondary = (scores[secondaryCat] >= 2 && scores[secondaryCat] >= 0.5 * scores[primaryCat])
    ? secondaryCat
    : null;

  const finalCat = confidence < 50 ? "Other" : primaryCat;

  return {
    category: finalCat,
    confidence,
    matched: matchedTerms[finalCat] || [],
    secondary,
    urgency,
    dept: CATEGORIES[finalCat].dept,
    sla: CATEGORIES[finalCat].sla
  };
}

function generateId() {
  const num = 1000 + COMPLAINTS.length + 1;
  return "CMP-" + num;
}

function highlightText(text, terms) {
  let res = escapeHTML(text);
  if (!terms || !terms.length) return res;
  terms.forEach(t => {
    const rx = new RegExp("\\b(" + t.replace(/[-]/g, "[- ]?") + "(?:s|es)?)\\b", "ig");
    res = res.replace(rx, "<mark>$1</mark>");
  });
  return res;
}

// Live typing classification handler
function handleLiveTyping() {
  const text = $("#in-text").value.trim();
  const charCountEl = $("#char-counter");
  const liveTag = $("#live-detect-tag");
  const liveUrgency = $("#live-urgency-tag");

  if (charCountEl) charCountEl.textContent = `${text.length} chars`;

  if (text.length < 5) {
    if (liveTag) {
      liveTag.textContent = "Awaiting input...";
      liveTag.classList.remove("active");
    }
    if (liveUrgency) liveUrgency.style.display = "none";
    return;
  }

  const analysis = classifyText(text);
  if (liveTag) {
    liveTag.textContent = `${analysis.category} (${analysis.confidence}%)`;
    liveTag.classList.add("active");
  }

  if (liveUrgency) {
    if (analysis.urgency === "Urgent") {
      liveUrgency.style.display = "inline-flex";
      liveUrgency.textContent = "High Urgency";
    } else {
      liveUrgency.style.display = "none";
    }
  }
}

// Navigation & View Controller
function switchView(viewName) {
  $$(".view-section").forEach(sec => {
    sec.style.display = (sec.id === `view-${viewName}`) ? "block" : "none";
  });

  $$(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });

  const titles = {
    submit: "File Complaint",
    triage: "Triage Dashboard",
    track: "Track Status",
    routing: "Routing Rules"
  };
  $("#header-view-title").textContent = titles[viewName] || "Complaint Classification";

  if (viewName === "triage") {
    renderTriage();
  } else if (viewName === "routing") {
    renderRouting();
  }

  closeDrawer();
  $("#sidebar").classList.remove("open");
  $("#sidebar-overlay").classList.remove("active");
}

// Submission Logic
async function handleSubmission() {
  const name = $("#in-name").value.trim();
  const idNum = $("#in-id").value.trim();
  const email = $("#in-email").value.trim();
  const text = $("#in-text").value.trim();
  const errBox = $("#submit-err");

  if (!name || text.length < 8) {
    errBox.style.display = "block";
    errBox.textContent = !name ? "Name required" : "Description too short (minimum 8 characters)";
    return;
  }
  errBox.style.display = "none";

  const btnSubmit = $("#btn-submit");
  btnSubmit.disabled = true;

  $("#submit-idle").style.display = "none";
  $("#submit-result").style.display = "none";
  $("#submit-pipeline").style.display = "block";

  const steps = [
    "Tokenizing input stream",
    "Extracting semantic vocabulary",
    "Evaluating confidence weights",
    "Assigning target department"
  ];

  const pipelineUl = $("#pipeline-steps");
  pipelineUl.innerHTML = steps.map(s => `
    <li class="pipeline-item">
      <span class="pipeline-indicator"></span>
      <span>${s}</span>
    </li>
  `).join("");

  for (let i = 0; i < steps.length; i++) {
    const item = pipelineUl.children[i];
    item.classList.add("active");
    await new Promise(r => setTimeout(r, 220));
    item.classList.remove("active");
    item.classList.add("done");
  }

  const analysis = classifyText(text);
  const complaintId = generateId();

  const record = {
    id: complaintId,
    name,
    studentId: idNum,
    email,
    text,
    category: analysis.category,
    confidence: analysis.confidence,
    department: analysis.dept,
    urgency: analysis.urgency,
    sla: analysis.sla,
    status: "Assigned",
    createdAt: Date.now(),
    history: [
      { status: "Submitted", time: Date.now() },
      { status: "Assigned", time: Date.now() }
    ],
    secondary: analysis.secondary,
    matched: analysis.matched
  };

  COMPLAINTS.push(record);
  saveData();

  $("#submit-pipeline").style.display = "none";
  renderSubmissionResult(record);
  btnSubmit.disabled = false;
  updateStatsHeader();
  showToast(`Filed ${complaintId} → ${analysis.dept}`);
}

function renderSubmissionResult(record) {
  const resBox = $("#submit-result");
  resBox.style.display = "block";

  const urgencyBadge = record.urgency === "Urgent" 
    ? `<span class="badge badge-urgent">Urgent</span>` 
    : `<span class="badge">Standard</span>`;

  resBox.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${escapeHTML(record.category)}</div>
        <div class="card-desc">Target: ${escapeHTML(record.department)}</div>
      </div>
      <div>${urgencyBadge}</div>
    </div>

    <div style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:4px;">
        <span>AI Confidence</span>
        <span class="font-mono">${record.confidence}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill tertiary" style="width: ${record.confidence}%;"></div>
      </div>
    </div>

    <div class="kv-grid">
      <div class="kv-key">Ticket ID</div>
      <div class="kv-val"><span class="font-mono"><strong>${record.id}</strong></span></div>
      <div class="kv-key">Department</div>
      <div class="kv-val">${escapeHTML(record.department)}</div>
      <div class="kv-key">SLA Target</div>
      <div class="kv-val">${record.sla}</div>
      <div class="kv-key">Status</div>
      <div class="kv-val"><span class="badge badge-assigned">${record.status}</span></div>
      <div class="kv-key">Signals Found</div>
      <div class="kv-val">${record.matched.length ? record.matched.map(m => `<mark>${escapeHTML(m)}</mark>`).join(" ") : "None"}</div>
    </div>

    <div style="font-size:13px; line-height:1.5; color:var(--text-muted); border-top:1px solid var(--border); padding-top:10px; margin-top:10px;">
      ${highlightText(record.text, record.matched)}
    </div>

    ${record.secondary ? `
      <div class="notice">
        Secondary issue detected: <strong>${escapeHTML(record.secondary)}</strong>. Department can cross-assign.
      </div>
    ` : ""}

    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn btn-outlined btn-sm" id="btn-submit-another">
        File Another
      </button>
      <button class="btn btn-secondary btn-sm" id="btn-view-queue">
        View in Queue
      </button>
    </div>
  `;

  $("#btn-submit-another").onclick = () => {
    $("#in-text").value = "";
    handleLiveTyping();
    resBox.style.display = "none";
    $("#submit-idle").style.display = "block";
  };

  $("#btn-view-queue").onclick = () => {
    switchView("triage");
  };
}

// Track Logic
function handleTrack(targetId) {
  const query = (targetId || $("#track-id").value || "").trim().toUpperCase();
  const outBox = $("#track-output");

  if (!query) {
    outBox.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:32px;">Enter a Complaint ID above to view history.</div>`;
    return;
  }

  const item = COMPLAINTS.find(c => c.id === query);
  if (!item) {
    outBox.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); padding:32px;">No complaint found for ID: <strong>${escapeHTML(query)}</strong></div>`;
    return;
  }

  const currIdx = STATUS_LIST.indexOf(item.status);

  outBox.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title font-mono">${item.id}</div>
          <div class="card-desc">${escapeHTML(item.category)} &bull; ${escapeHTML(item.department)}</div>
        </div>
        <span class="badge badge-${item.status.toLowerCase().replace(" ", "-")}">${item.status}</span>
      </div>

      <div class="stepper">
        ${STATUS_LIST.map((st, idx) => `
          <div class="step-item ${idx <= currIdx ? "active" : ""}">
            ${st}
          </div>
        `).join("")}
      </div>

      <div class="kv-grid">
        <div class="kv-key">Reporter</div>
        <div class="kv-val">${escapeHTML(item.name)} ${item.studentId ? `(${escapeHTML(item.studentId)})` : ""}</div>
        <div class="kv-key">Logged</div>
        <div class="kv-val">${formatDate(item.createdAt)}</div>
        <div class="kv-key">Confidence</div>
        <div class="kv-val font-mono">${item.confidence}%</div>
        <div class="kv-key">Urgency</div>
        <div class="kv-val">${item.urgency}</div>
      </div>

      <div style="font-size:13px; line-height:1.5; padding:12px; background:var(--bg-surface-subtle); border-radius:var(--radius-md); margin-top:10px;">
        ${escapeHTML(item.text)}
      </div>

      <div style="margin-top:18px;">
        <div style="font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:8px;">Audit History</div>
        ${item.history.map(h => `
          <div style="font-size:12px; color:var(--text-muted); display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border);">
            <span>${h.status}</span>
            <span class="font-mono">${formatDate(h.time)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// Drawer Controller
function openDrawer(id) {
  const item = COMPLAINTS.find(c => c.id === id);
  if (!item) return;
  ACTIVE_INSPECT_ID = id;

  $("#drawer-id").textContent = item.id;
  $("#drawer-category").textContent = item.category;
  $("#drawer-body-content").innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:11.5px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:6px;">Summary</div>
      <div style="font-size:13px; line-height:1.5; background:var(--bg-surface-subtle); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border);">
        ${escapeHTML(item.text)}
      </div>
    </div>

    <div class="kv-grid">
      <div class="kv-key">Department</div>
      <div class="kv-val">
        <select id="drawer-dept-select" style="padding:4px 8px; font-size:12px;">
          ${CAT_KEYS.map(k => `<option value="${CATEGORIES[k].dept}" ${CATEGORIES[k].dept === item.department ? "selected" : ""}>${CATEGORIES[k].dept}</option>`).join("")}
        </select>
      </div>
      <div class="kv-key">Status</div>
      <div class="kv-val">
        <select id="drawer-status-select" style="padding:4px 8px; font-size:12px;">
          ${STATUS_LIST.map(st => `<option value="${st}" ${st === item.status ? "selected" : ""}>${st}</option>`).join("")}
        </select>
      </div>
      <div class="kv-key">Reporter</div>
      <div class="kv-val">${escapeHTML(item.name)} ${item.email ? `&lt;${escapeHTML(item.email)}&gt;` : ""}</div>
      <div class="kv-key">Confidence</div>
      <div class="kv-val font-mono">${item.confidence}%</div>
      <div class="kv-key">SLA</div>
      <div class="kv-val">${item.sla}</div>
      <div class="kv-key">Urgency</div>
      <div class="kv-val">${item.urgency === "Urgent" ? `<span class="badge badge-urgent">Urgent</span>` : "Standard"}</div>
    </div>

    <div style="margin-top:16px;">
      <div style="font-size:11.5px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Timeline</div>
      ${item.history.map(h => `
        <div style="font-size:11.5px; color:var(--text-muted); display:flex; justify-content:space-between; padding:3px 0;">
          <span>${h.status}</span>
          <span class="font-mono">${formatDate(h.time)}</span>
        </div>
      `).join("")}
    </div>
  `;

  $("#drawer-status-select").onchange = e => {
    item.status = e.target.value;
    item.history.push({ status: item.status, time: Date.now() });
    saveData();
    renderTriage();
    updateStatsHeader();
    showToast(`Status set to ${item.status}`);
  };

  $("#drawer-dept-select").onchange = e => {
    item.department = e.target.value;
    item.history.push({ status: `Re-routed to ${item.department}`, time: Date.now() });
    saveData();
    renderTriage();
    showToast(`Re-routed to ${item.department}`);
  };

  $("#drawer").classList.add("active");
  $("#drawer-backdrop").classList.add("active");
}

function closeDrawer() {
  $("#drawer").classList.remove("active");
  $("#drawer-backdrop").classList.remove("active");
  ACTIVE_INSPECT_ID = null;
}

// Triage Dashboard Logic
function renderTriage() {
  const total = COMPLAINTS.length;
  const pending = COMPLAINTS.filter(c => c.status === "Pending" || c.status === "Assigned").length;
  const inProg = COMPLAINTS.filter(c => c.status === "In Progress").length;
  const resolved = COMPLAINTS.filter(c => c.status === "Resolved" || c.status === "Closed").length;

  $("#stat-total").textContent = total;
  $("#stat-pending").textContent = pending;
  $("#stat-inprog").textContent = inProg;
  $("#stat-resolved").textContent = resolved;

  // Category Distribution Chart
  const catChart = $("#chart-categories");
  const catCounts = {};
  CAT_KEYS.forEach(c => catCounts[c] = 0);
  COMPLAINTS.forEach(c => {
    if (catCounts[c.category] !== undefined) catCounts[c.category]++;
  });

  const maxCatCount = Math.max(1, ...Object.values(catCounts));
  catChart.innerHTML = CAT_KEYS.map(cat => {
    const count = catCounts[cat] || 0;
    const pct = Math.round((count / maxCatCount) * 100);
    return `
      <div class="chart-row">
        <span class="chart-title">${cat}</span>
        <div class="progress-bar" style="margin:0;">
          <div class="progress-fill" style="width:${pct}%;"></div>
        </div>
        <span class="chart-val">${count}</span>
      </div>
    `;
  }).join("");

  // Filters & Search
  const filterCat = $("#filter-cat").value;
  const filterStat = $("#filter-status").value;
  const query = ($("#filter-search").value || "").toLowerCase().trim();

  const filtered = COMPLAINTS.filter(item => {
    if (filterCat && item.category !== filterCat) return false;
    if (filterStat && item.status !== filterStat) return false;
    if (query) {
      const matchSearch = item.id.toLowerCase().includes(query) ||
                          item.name.toLowerCase().includes(query) ||
                          item.text.toLowerCase().includes(query) ||
                          item.department.toLowerCase().includes(query);
      if (!matchSearch) return false;
    }
    return true;
  }).slice().reverse();

  const tbody = $("#table-body");
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:32px;">No complaints match active filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => `
    <tr class="table-row" data-id="${item.id}">
      <td><strong class="font-mono">${item.id}</strong></td>
      <td style="max-width:260px;">
        <div style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${escapeHTML(item.text)}
        </div>
        <div style="font-size:11.5px; color:var(--text-muted);">${escapeHTML(item.name)}</div>
      </td>
      <td>
        <span>${escapeHTML(item.category)}</span>
        <span style="font-size:11px; color:var(--text-muted); display:block;" class="font-mono">${item.confidence}%</span>
      </td>
      <td>${escapeHTML(item.department)}</td>
      <td>
        <select class="status-select" data-id="${item.id}" style="padding:4px 8px; font-size:11.5px; border-radius:var(--radius-sm);" onclick="event.stopPropagation();">
          ${STATUS_LIST.map(st => `
            <option value="${st}" ${st === item.status ? "selected" : ""}>${st}</option>
          `).join("")}
        </select>
      </td>
      <td style="font-size:11.5px; color:var(--text-muted);">${formatDate(item.createdAt)}</td>
    </tr>
  `).join("");

  $$("#table-body tr.table-row").forEach(row => {
    row.onclick = () => openDrawer(row.dataset.id);
  });

  $$(".status-select").forEach(sel => {
    sel.onchange = e => {
      const id = e.target.dataset.id;
      const target = COMPLAINTS.find(c => c.id === id);
      if (target) {
        target.status = e.target.value;
        target.history.push({ status: target.status, time: Date.now() });
        saveData();
        renderTriage();
        updateStatsHeader();
        showToast(`Updated ${id} to ${target.status}`);
      }
    };
  });
}

function renderRouting() {
  const tbody = $("#routing-table-body");
  tbody.innerHTML = CAT_KEYS.map(cat => {
    const item = CATEGORIES[cat];
    return `
      <tr>
        <td><strong>${cat}</strong></td>
        <td>${escapeHTML(item.dept)}</td>
        <td><span class="badge font-mono">${item.sla}</span></td>
        <td style="font-size:12px; color:var(--text-muted);">${item.keywords.slice(0, 8).join(", ") || "General fallback"}</td>
      </tr>
    `;
  }).join("");
}

function updateStatsHeader() {
  const activeCount = COMPLAINTS.filter(c => c.status !== "Resolved" && c.status !== "Closed").length;
  $("#header-active-count").textContent = `${activeCount} Open`;
  const navBadge = $("#nav-triage-count");
  if (navBadge) navBadge.textContent = activeCount;
}

// Sample Data Generator
function seedSampleData() {
  const samples = [
    { name: "Dev Joshi", text: "Mess food is spoiled and hygiene in hostel kitchen is zero." },
    { name: "Priya Nair", text: "Marks for exam revaluation still not updated on university portal." },
    { name: "Aman Verma", text: "Double tuition fee charged on semester bill. Need immediate refund." },
    { name: "Sanya Gupta", text: "Wi-Fi in library 2nd floor disconnecting repeatedly." },
    { name: "Rohan Das", text: "AC in room 405 leaking water on electrical switchboard. Urgent hazard." },
    { name: "Kunal Shah", text: "Administrative office staff refusing bonafide letter verification." }
  ];

  samples.forEach((s, idx) => {
    const analysis = classifyText(s.text);
    const id = generateId();
    const st = STATUS_LIST[idx % STATUS_LIST.length];
    const created = Date.now() - (idx + 1) * 3600000 * 3;

    COMPLAINTS.push({
      id,
      name: s.name,
      studentId: "STU-" + (8800 + idx),
      email: s.name.toLowerCase().replace(" ", ".") + "@univ.edu",
      text: s.text,
      category: analysis.category,
      confidence: analysis.confidence,
      department: analysis.dept,
      urgency: analysis.urgency,
      sla: analysis.sla,
      status: st,
      createdAt: created,
      history: [
        { status: "Submitted", time: created },
        { status: st, time: created + 1800000 }
      ],
      secondary: analysis.secondary,
      matched: analysis.matched
    });
  });

  saveData();
  renderTriage();
  updateStatsHeader();
  showToast("Loaded 6 test complaints");
}

// Live Stream Simulation
async function simulateStream() {
  const streamQueue = [
    { name: "Vikram Sen", text: "Broken pipe leaking drinking water on 1st floor corridor." },
    { name: "Ananya Roy", text: "Late submission penalty fee incorrectly applied to my ledger." },
    { name: "Harsh Vardhan", text: "Hostel room fan regulator broke and sparks when turned on." }
  ];

  showToast("Simulating incoming complaints stream...");
  for (const s of streamQueue) {
    await new Promise(r => setTimeout(r, 650));
    const analysis = classifyText(s.text);
    const id = generateId();
    const record = {
      id,
      name: s.name,
      studentId: "STU-" + Math.floor(1000 + Math.random() * 9000),
      email: s.name.toLowerCase().replace(" ", ".") + "@univ.edu",
      text: s.text,
      category: analysis.category,
      confidence: analysis.confidence,
      department: analysis.dept,
      urgency: analysis.urgency,
      sla: analysis.sla,
      status: "Assigned",
      createdAt: Date.now(),
      history: [
        { status: "Submitted", time: Date.now() },
        { status: "Assigned", time: Date.now() }
      ],
      secondary: analysis.secondary,
      matched: analysis.matched
    };
    COMPLAINTS.push(record);
    saveData();
    renderTriage();
    updateStatsHeader();
    showToast(`New Ticket: ${id} → ${analysis.category}`);
  }
}

// CSV Export
function exportCSV() {
  if (!COMPLAINTS.length) {
    showToast("No complaints to export");
    return;
  }
  const headers = ["ID", "Name", "Student_ID", "Email", "Category", "Confidence", "Department", "Urgency", "Status", "Date", "Complaint_Text"];
  const rows = COMPLAINTS.map(c => [
    c.id,
    `"${(c.name || "").replace(/"/g, '""')}"`,
    c.studentId || "",
    c.email || "",
    c.category,
    `${c.confidence}%`,
    `"${c.department}"`,
    c.urgency,
    c.status,
    new Date(c.createdAt).toISOString(),
    `"${(c.text || "").replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `complaints_export_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported complaints to CSV");
}

// Theme Controller
function initTheme() {
  const savedTheme = localStorage.getItem("app_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeToggleUI(savedTheme);

  $("#theme-toggle-btn").onclick = () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("app_theme", next);
    updateThemeToggleUI(next);
    showToast(`Switched to ${next} theme`);
  };
}

function updateThemeToggleUI(theme) {
  const label = $("#theme-toggle-label");
  if (label) {
    label.textContent = theme === "dark" ? "Dark" : "Light";
  }
}

// Initialization
function init() {
  loadData();
  initTheme();

  // Navigation
  $$(".nav-item").forEach(item => {
    item.onclick = () => switchView(item.dataset.view);
  });

  // Mobile menu
  $("#menu-toggle-btn").onclick = () => {
    $("#sidebar").classList.toggle("open");
    $("#sidebar-overlay").classList.toggle("active");
  };

  $("#sidebar-overlay").onclick = () => {
    $("#sidebar").classList.remove("open");
    $("#sidebar-overlay").classList.remove("active");
  };

  // Drawer Close
  $("#drawer-close-btn").onclick = closeDrawer;
  $("#drawer-backdrop").onclick = closeDrawer;
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDrawer();
  });

  // Quick Chips
  const chipsContainer = $("#quick-chips");
  if (chipsContainer) {
    chipsContainer.innerHTML = EXAMPLES.map(ex => `
      <button type="button" class="chip">${escapeHTML(ex.slice(0, 32))}...</button>
    `).join("");

    $$("#quick-chips .chip").forEach((chip, i) => {
      chip.onclick = () => {
        $("#in-text").value = EXAMPLES[i];
        handleLiveTyping();
      };
    });
  }

  // Real-time live input binding
  $("#in-text").oninput = handleLiveTyping;

  // Filter bindings
  const catFilter = $("#filter-cat");
  if (catFilter) {
    catFilter.innerHTML = `<option value="">All Categories</option>` +
      CAT_KEYS.map(c => `<option value="${c}">${c}</option>`).join("");
    catFilter.onchange = renderTriage;
  }

  const statFilter = $("#filter-status");
  if (statFilter) {
    statFilter.innerHTML = `<option value="">All Statuses</option>` +
      STATUS_LIST.map(s => `<option value="${s}">${s}</option>`).join("");
    statFilter.onchange = renderTriage;
  }

  const searchInput = $("#filter-search");
  if (searchInput) {
    searchInput.oninput = renderTriage;
  }

  // Actions
  $("#btn-submit").onclick = handleSubmission;
  $("#btn-track").onclick = () => handleTrack();
  $("#track-id").onkeydown = e => {
    if (e.key === "Enter") handleTrack();
  };

  $("#btn-seed-data").onclick = seedSampleData;
  $("#btn-clear-data").onclick = () => {
    if (confirm("Reset all stored complaint records?")) {
      COMPLAINTS = [];
      saveData();
      renderTriage();
      updateStatsHeader();
      showToast("All complaints cleared");
    }
  };

  $("#btn-simulate-stream").onclick = simulateStream;
  $("#btn-export-csv").onclick = exportCSV;

  // Drawer action delete
  $("#drawer-delete-btn").onclick = () => {
    if (!ACTIVE_INSPECT_ID) return;
    COMPLAINTS = COMPLAINTS.filter(c => c.id !== ACTIVE_INSPECT_ID);
    saveData();
    renderTriage();
    updateStatsHeader();
    showToast(`Deleted ${ACTIVE_INSPECT_ID}`);
    closeDrawer();
  };

  // Drawer action quick-resolve
  $("#drawer-resolve-btn").onclick = () => {
    if (!ACTIVE_INSPECT_ID) return;
    const item = COMPLAINTS.find(c => c.id === ACTIVE_INSPECT_ID);
    if (item) {
      item.status = "Resolved";
      item.history.push({ status: "Resolved", time: Date.now() });
      saveData();
      renderTriage();
      updateStatsHeader();
      showToast(`Marked ${ACTIVE_INSPECT_ID} Resolved`);
      closeDrawer();
    }
  };

  updateStatsHeader();
  switchView("submit");
}

document.addEventListener("DOMContentLoaded", init);
