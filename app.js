const DAY_COUNT = 30;
const STORAGE_KEY = "timesheet-web-v2";

const fields = {
  monthSelect: document.querySelector("#monthSelect"),
  profileName: document.querySelector("#profileName"),
  employeeId: document.querySelector("#employeeId"),
  position: document.querySelector("#position"),
  department: document.querySelector("#department"),
  costCenter: document.querySelector("#costCenter"),
  division: document.querySelector("#division"),
  dayList: document.querySelector("#dayList"),
  selectedDayTitle: document.querySelector("#selectedDayTitle"),
  savedStatus: document.querySelector("#savedStatus"),
  timeIn: document.querySelector("#timeIn"),
  timeOut: document.querySelector("#timeOut"),
  site: document.querySelector("#site"),
  remark: document.querySelector("#remark"),
  description: document.querySelector("#description"),
  customerName: document.querySelector("#customerName"),
  signaturePad: document.querySelector("#signaturePad"),
  clearSignature: document.querySelector("#clearSignature"),
  exportExcel: document.querySelector("#exportExcel"),
  exportPdf: document.querySelector("#exportPdf"),
  reportRows: document.querySelector("#reportRows")
};

let state = loadState();
let selectedDay = 1;
let drawing = false;
let activeStroke = [];

init();
registerServiceWorker();

function init() {
  buildMonthOptions();
  hydrateProfile();
  renderDayList();
  loadDay(selectedDay);
  bindEvents();
  drawSignature();
}

function defaultState() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    profile: {
      name: "",
      employeeId: "",
      position: "",
      department: "",
      costCenter: "",
      division: ""
    },
    selectedMonth: monthKey,
    months: {}
  };
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  fields.savedStatus.textContent = "Saved";
}

function currentMonthEntries() {
  if (!state.months[state.selectedMonth]) {
    state.months[state.selectedMonth] = Array.from({ length: DAY_COUNT }, (_, index) => ({
      day: index + 1,
      timeIn: index === 0 ? "07:30" : "",
      timeOut: index === 0 ? "16:30" : "",
      site: "",
      description: "",
      employeeSign: "",
      customerName: "",
      signature: [],
      remark: ""
    }));
  }
  return state.months[state.selectedMonth];
}

function currentEntry() {
  return currentMonthEntries()[selectedDay - 1];
}

function buildMonthOptions() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
  fields.monthSelect.innerHTML = "";

  for (let offset = -12; offset <= 12; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const option = document.createElement("option");
    option.value = key;
    option.textContent = formatter.format(date);
    fields.monthSelect.append(option);
  }

  fields.monthSelect.value = state.selectedMonth;
}

function hydrateProfile() {
  fields.profileName.value = state.profile.name;
  fields.employeeId.value = state.profile.employeeId;
  fields.position.value = state.profile.position;
  fields.department.value = state.profile.department;
  fields.costCenter.value = state.profile.costCenter;
  fields.division.value = state.profile.division;
}

function bindEvents() {
  fields.monthSelect.addEventListener("change", () => {
    saveDay();
    state.selectedMonth = fields.monthSelect.value;
    selectedDay = 1;
    renderDayList();
    loadDay(selectedDay);
    saveState();
  });

  [fields.profileName, fields.employeeId, fields.position, fields.department, fields.costCenter, fields.division].forEach((input) => {
    input.addEventListener("input", () => {
      state.profile = {
        name: fields.profileName.value,
        employeeId: fields.employeeId.value,
        position: fields.position.value,
        department: fields.department.value,
        costCenter: fields.costCenter.value,
        division: fields.division.value
      };
      saveState();
    });
  });

  [fields.timeIn, fields.timeOut, fields.site, fields.remark, fields.description, fields.customerName].forEach((input) => {
    input.addEventListener("input", () => {
      saveDay();
      renderDayList();
    });
  });

  fields.clearSignature.addEventListener("click", () => {
    currentEntry().signature = [];
    saveState();
    drawSignature();
    renderDayList();
  });

  fields.exportPdf.addEventListener("click", () => {
    saveDay();
    preparePrint();
    window.print();
  });

  fields.exportExcel.addEventListener("click", () => {
    saveDay();
    preparePrint();
    exportExcel();
  });

  fields.signaturePad.addEventListener("pointerdown", startStroke);
  fields.signaturePad.addEventListener("pointermove", continueStroke);
  fields.signaturePad.addEventListener("pointerup", endStroke);
  fields.signaturePad.addEventListener("pointercancel", endStroke);
  window.addEventListener("resize", drawSignature);
}

function renderDayList() {
  fields.dayList.innerHTML = "";
  currentMonthEntries().forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-row${entry.day === selectedDay ? " active" : ""}`;
    button.innerHTML = `
      <span class="day-number">${entry.day}</span>
      <span>
        <span class="day-title">${escapeHTML(entry.description || "No work description")}</span>
        <span class="day-subtitle">${escapeHTML([entry.site, entry.timeIn && entry.timeOut ? `${entry.timeIn}-${entry.timeOut}` : ""].filter(Boolean).join(" · ") || "Tap to edit")}</span>
      </span>
      <span class="sign-dot">${entry.signature.length ? "Signed" : ""}</span>
    `;
    button.addEventListener("click", () => {
      saveDay();
      selectedDay = entry.day;
      renderDayList();
      loadDay(selectedDay);
    });
    fields.dayList.append(button);
  });
}

function loadDay(day) {
  const entry = currentMonthEntries()[day - 1];
  fields.selectedDayTitle.textContent = String(day);
  fields.timeIn.value = entry.timeIn;
  fields.timeOut.value = entry.timeOut;
  fields.site.value = entry.site;
  fields.remark.value = entry.remark;
  fields.description.value = entry.description;
  fields.customerName.value = entry.customerName;
  drawSignature();
}

function saveDay() {
  const entry = currentEntry();
  entry.timeIn = fields.timeIn.value;
  entry.timeOut = fields.timeOut.value;
  entry.site = fields.site.value;
  entry.remark = fields.remark.value;
  entry.description = fields.description.value;
  entry.customerName = fields.customerName.value;
  entry.employeeSign = state.profile.name;
  fields.savedStatus.textContent = "Saving...";
  saveState();
}

function canvasPoint(event) {
  const rect = fields.signaturePad.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
  };
}

function startStroke(event) {
  fields.signaturePad.setPointerCapture(event.pointerId);
  drawing = true;
  activeStroke = [canvasPoint(event)];
  currentEntry().signature.push(activeStroke);
  drawSignature();
}

function continueStroke(event) {
  if (!drawing) return;
  activeStroke.push(canvasPoint(event));
  drawSignature();
}

function endStroke() {
  if (!drawing) return;
  drawing = false;
  activeStroke = [];
  saveDay();
  renderDayList();
}

function drawSignature() {
  const canvas = fields.signaturePad;
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.clearRect(0, 0, rect.width, rect.height);
  context.lineWidth = 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#111";

  currentEntry().signature.forEach((stroke) => {
    if (!stroke.length) return;
    context.beginPath();
    stroke.forEach((point, index) => {
      const x = point.x * rect.width;
      const y = point.y * rect.height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  });
}

function signatureDataUrl(signature) {
  if (!signature.length) return "";
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 90;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 3;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#111";

  signature.forEach((stroke) => {
    if (!stroke.length) return;
    context.beginPath();
    stroke.forEach((point, index) => {
      const x = 12 + point.x * 336;
      const y = 8 + point.y * 74;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  });

  return canvas.toDataURL("image/png");
}

function preparePrint() {
  const monthText = fields.monthSelect.options[fields.monthSelect.selectedIndex].textContent;
  document.querySelector('[data-print="month"]').textContent = monthText;
  document.querySelector('[data-print="name"]').textContent = state.profile.name;
  document.querySelector('[data-print="employeeId"]').textContent = state.profile.employeeId;
  document.querySelector('[data-print="position"]').textContent = state.profile.position;
  document.querySelector('[data-print="department"]').textContent = state.profile.department;
  document.querySelector('[data-print="costCenter"]').textContent = state.profile.costCenter;
  document.querySelector('[data-print="division"]').textContent = state.profile.division;

  fields.reportRows.innerHTML = "";
  currentMonthEntries().forEach((entry) => {
    const tr = document.createElement("tr");
    const signature = signatureDataUrl(entry.signature);
    tr.innerHTML = `
      <td>${entry.day}</td>
      <td>${escapeHTML(entry.timeIn)}</td>
      <td>${escapeHTML(entry.timeOut)}</td>
      <td>${escapeHTML(entry.site)}</td>
      <td>${escapeHTML(entry.description)}</td>
      <td>${escapeHTML(state.profile.name)}</td>
      <td>${signature ? `<img alt="signature" src="${signature}">` : escapeHTML(entry.customerName)}</td>
      <td>${escapeHTML(entry.remark)}</td>
    `;
    fields.reportRows.append(tr);
  });
}

function exportExcel() {
  const html = `
    <html>
    <head><meta charset="utf-8"></head>
    <body>${document.querySelector("#printPage").outerHTML}</body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `SharePoint-Timesheet-${state.selectedMonth}.xls`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // The app still works without offline caching, for example when opened as a local file.
  });
}
