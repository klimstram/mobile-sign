import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
import {
  PDFDocument,
  StandardFonts,
  degrees,
} from "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.esm.min.js";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const state = {
  originalBytes: null,
  originalName: "document.pdf",
  pdfJsDoc: null,
  currentPage: 1,
  placements: [],
  signatureDataUrl: null,
  activeTool: null,
  selectedId: null,
  renderWidth: 0,
  renderHeight: 0,
  preparedBlob: null,
  preparedUrl: null,
};

const draftStorageKey = "sign-return-pdf-draft-v1";
const profileStorageKey = "sign-return-pdf-profile-v1";
const shortcutSetupKey = "sign-return-pdf-shortcut-installed-v1";
const shortcutInstallUrl = "https://www.icloud.com/shortcuts/REPLACE_WITH_YOUR_SHORTCUT_ID";

const el = {};

function byId(id) {
  return document.getElementById(id);
}

function setStatus(message, kind = "") {
  el.appStatus.textContent = message;
  el.appStatus.className = `status-box${kind ? ` ${kind}` : ""}`;
}

function readDraftState() {
  try {
    const raw = localStorage.getItem(draftStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readProfileState() {
  try {
    const raw = localStorage.getItem(profileStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraftState() {
  try {
    localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        fullName: el.fullName.value,
        signDate: el.signDate.value,
        customText: el.customText.value,
        emailFrom: el.emailFrom.value,
        emailSubject: el.emailSubject.value,
        signatureDataUrl: state.signatureDataUrl,
      }),
    );
  } catch {
    // Ignore storage failures; the app still works without persistence.
  }
}

function restoreDraftState() {
  const draft = readDraftState();
  if (!draft) return;

  if (typeof draft.fullName === "string") el.fullName.value = draft.fullName;
  if (typeof draft.signDate === "string") el.signDate.value = draft.signDate;
  if (typeof draft.customText === "string") el.customText.value = draft.customText;
  if (typeof draft.emailFrom === "string") el.emailFrom.value = draft.emailFrom;
  if (typeof draft.emailSubject === "string") el.emailSubject.value = draft.emailSubject;
  if (typeof draft.signatureDataUrl === "string" && draft.signatureDataUrl) {
    state.signatureDataUrl = draft.signatureDataUrl;
    el.signatureStatus.textContent = "Saved signature restored.";
  }
}

function normalizeQueryValue(value) {
  if (!value) return "";
  return value.replace(/\+/g, " ").trim();
}

function applyInboundMailContext() {
  const params = new URLSearchParams(window.location.search || "");
  const hasIncomingFrom = params.has("from") || params.has("sender");
  const hasIncomingSubject = params.has("subject") || params.has("subj");
  const hasMailContext = hasIncomingFrom || hasIncomingSubject;
  if (!hasMailContext) return;

  const incomingFrom = normalizeQueryValue(params.get("from") || params.get("sender") || "");
  const incomingSubject = normalizeQueryValue(params.get("subject") || params.get("subj") || "");

  // Always overwrite fields when context is supplied so each message can provide fresh values.
  el.emailFrom.value = incomingFrom;
  el.emailSubject.value = incomingSubject;
  setStatus("Email details were updated from this Shortcut launch.", "success");
  saveDraftState();
}

function clearDraftState() {
  try {
    localStorage.removeItem(draftStorageKey);
  } catch {
    // Ignore storage failures; the app still works without persistence.
  }
}

function saveProfileState() {
  const fullName = el.fullName.value.trim();
  if (!fullName) {
    el.profileStatus.textContent = "Enter your full name before saving your profile.";
    setStatus("Enter your full name, then save profile.", "error");
    return;
  }
  if (!state.signatureDataUrl) {
    el.profileStatus.textContent = "Save a signature first, then save your profile.";
    setStatus("Draw and save your signature first.", "error");
    return;
  }

  try {
    localStorage.setItem(
      profileStorageKey,
      JSON.stringify({
        fullName,
        signatureDataUrl: state.signatureDataUrl,
      }),
    );
    el.profileStatus.textContent = "Saved locally on this device.";
    setStatus("Profile saved for later use on this device.", "success");
  } catch {
    el.profileStatus.textContent = "Could not save profile on this device/browser.";
    setStatus("Could not save profile on this device/browser.", "error");
  }
}

function restoreProfileState() {
  const profile = readProfileState();
  if (!profile) return;

  if (!el.fullName.value && typeof profile.fullName === "string") {
    el.fullName.value = profile.fullName;
  }
  if (!state.signatureDataUrl && typeof profile.signatureDataUrl === "string" && profile.signatureDataUrl) {
    state.signatureDataUrl = profile.signatureDataUrl;
    el.signatureStatus.textContent = "Saved signature restored.";
  }
  el.profileStatus.textContent = "Saved signer profile is loaded.";
}

function clearProfileState() {
  try {
    localStorage.removeItem(profileStorageKey);
    el.profileStatus.textContent = "Saved signer profile removed from this device.";
    setStatus("Saved signer profile removed.", "success");
  } catch {
    el.profileStatus.textContent = "Could not clear saved profile in this browser.";
    setStatus("Could not clear saved profile in this browser.", "error");
  }
}

function isShortcutConfigured() {
  return !shortcutInstallUrl.includes("REPLACE_WITH_YOUR_SHORTCUT_ID");
}

function isShortcutInstalled() {
  try {
    return localStorage.getItem(shortcutSetupKey) === "1";
  } catch {
    return false;
  }
}

function setShortcutInstalled(installed) {
  try {
    if (installed) {
      localStorage.setItem(shortcutSetupKey, "1");
    } else {
      localStorage.removeItem(shortcutSetupKey);
    }
  } catch {
    // Ignore storage failures; onboarding can still be used for this session.
  }
}

function updateShortcutOnboarding() {
  const installed = isShortcutInstalled();
  el.shortcutOnboarding.classList.toggle("hidden", installed);
  if (installed) {
    el.shortcutStatus.textContent = "Shortcut setup is complete on this device.";
    return;
  }

  if (isShortcutConfigured()) {
    el.shortcutStatus.textContent = "Install once, then return and tap \"I installed it\".";
  } else {
    el.shortcutStatus.textContent = "Shortcut link not configured yet. Ask your admin for the iCloud Shortcut URL.";
  }
}

function installShortcut() {
  if (!isShortcutConfigured()) {
    el.shortcutStatus.textContent = "Shortcut link not configured yet. Ask your admin for the iCloud Shortcut URL.";
    setStatus("Shortcut install link is not configured yet.", "error");
    return;
  }
  window.open(shortcutInstallUrl, "_blank", "noopener");
  el.shortcutStatus.textContent = "After installation, return here and tap \"I installed it\".";
}

function confirmShortcutInstalled() {
  setShortcutInstalled(true);
  updateShortcutOnboarding();
  setStatus("Shortcut marked as installed on this device.", "success");
}

function escapeFilename(name) {
  const stem = (name || "document.pdf").replace(/\.pdf$/i, "");
  return `signed_${stem.replace(/[\\/:*?"<>|]+/g, "-")}.pdf`;
}

function invalidatePrepared() {
  state.preparedBlob = null;
  if (state.preparedUrl) URL.revokeObjectURL(state.preparedUrl);
  state.preparedUrl = null;
  el.exportActions.classList.add("hidden");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function setTodayIfNeeded() {
  if (el.signDate.value) return;
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  el.signDate.value = local;
}

// ---------------- Signature pad ----------------
let sigCtx;
let sigDrawing = false;
let sigHasInk = false;
let lastPoint = null;

function resizeSignatureCanvas(preserve = true) {
  const canvas = el.signatureCanvas;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  let backup = null;
  if (preserve && sigHasInk && canvas.width && canvas.height) {
    backup = document.createElement("canvas");
    backup.width = canvas.width;
    backup.height = canvas.height;
    backup.getContext("2d").drawImage(canvas, 0, 0);
  }

  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  sigCtx = canvas.getContext("2d");
  sigCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sigCtx.lineWidth = 2.5;
  sigCtx.lineCap = "round";
  sigCtx.lineJoin = "round";
  sigCtx.strokeStyle = "#111111";

  if (backup) {
    sigCtx.save();
    sigCtx.setTransform(1, 0, 0, 1, 0, 0);
    sigCtx.drawImage(backup, 0, 0, canvas.width, canvas.height);
    sigCtx.restore();
  }
}

function signaturePoint(event) {
  const rect = el.signatureCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function startSignature(event) {
  event.preventDefault();
  sigDrawing = true;
  sigHasInk = true;
  lastPoint = signaturePoint(event);
  el.signatureCanvas.setPointerCapture?.(event.pointerId);
}

function moveSignature(event) {
  if (!sigDrawing) return;
  event.preventDefault();
  const point = signaturePoint(event);
  sigCtx.beginPath();
  sigCtx.moveTo(lastPoint.x, lastPoint.y);
  sigCtx.lineTo(point.x, point.y);
  sigCtx.stroke();
  lastPoint = point;
}

function stopSignature(event) {
  if (!sigDrawing) return;
  event.preventDefault();
  sigDrawing = false;
  lastPoint = null;
}

function clearSignature() {
  const rect = el.signatureCanvas.getBoundingClientRect();
  sigCtx.clearRect(0, 0, rect.width, rect.height);
  sigHasInk = false;
  state.signatureDataUrl = null;
  el.signatureStatus.textContent = "Draw above, then tap “Use this signature.”";
  saveDraftState();
  invalidatePrepared();
}

function trimmedSignatureDataUrl() {
  const canvas = el.signatureCanvas;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = pixels;
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;
  let found = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        found = true;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (!found) return null;
  const pad = Math.max(8, Math.round(width * 0.012));
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);

  const out = document.createElement("canvas");
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext("2d").putImageData(
    ctx.getImageData(left, top, out.width, out.height),
    0,
    0,
  );
  return out.toDataURL("image/png");
}

function saveSignature() {
  const dataUrl = trimmedSignatureDataUrl();
  if (!dataUrl) {
    el.signatureStatus.textContent = "Please draw a signature first.";
    return;
  }
  state.signatureDataUrl = dataUrl;
  el.signatureStatus.textContent = "Signature saved and ready to place.";
  setStatus("Signature saved. Open a PDF or place it on the current page.", "success");
  saveDraftState();
  invalidatePrepared();
}

// ---------------- PDF rendering ----------------
async function loadPdf(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    setStatus("Please choose a PDF file.", "error");
    return;
  }

  setStatus("Opening PDF…");
  el.fileStatus.textContent = `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`;

  try {
    const buffer = await file.arrayBuffer();
    state.originalBytes = new Uint8Array(buffer);
    state.originalName = file.name;
    state.pdfJsDoc = await pdfjsLib.getDocument({ data: state.originalBytes.slice() }).promise;
    state.currentPage = 1;
    state.placements = [];
    state.selectedId = null;
    state.activeTool = null;
    invalidatePrepared();
    updateToolButtons();
    el.documentPanel.classList.remove("hidden");
    await renderCurrentPage();
    setStatus(`PDF ready. ${state.pdfJsDoc.numPages} page${state.pdfJsDoc.numPages === 1 ? "" : "s"}.`, "success");
    setTimeout(() => el.documentPanel.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  } catch (error) {
    console.error(error);
    const message = String(error?.message || error);
    if (/password/i.test(message)) {
      setStatus("Password-protected PDFs are not supported in this version.", "error");
    } else {
      setStatus("This PDF could not be opened. Try saving a fresh copy of it and opening that copy.", "error");
    }
  }
}

async function renderCurrentPage() {
  if (!state.pdfJsDoc) return;
  const page = await state.pdfJsDoc.getPage(state.currentPage);
  const base = page.getViewport({ scale: 1 });
  const stageWidth = Math.max(260, el.pdfStage.clientWidth);
  const targetWidth = Math.min(stageWidth, 850);
  const scale = targetWidth / base.width;
  const viewport = page.getViewport({ scale });
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const canvas = el.pdfCanvas;
  const context = canvas.getContext("2d", { alpha: false });

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  state.renderWidth = viewport.width;
  state.renderHeight = viewport.height;
  el.overlayLayer.style.width = `${viewport.width}px`;
  el.overlayLayer.style.height = `${viewport.height}px`;
  el.pdfStage.style.minHeight = `${viewport.height}px`;

  await page.render({
    canvasContext: context,
    viewport,
    transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0],
  }).promise;

  el.pageIndicator.textContent = `Page ${state.currentPage} of ${state.pdfJsDoc.numPages}`;
  el.prevPageBtn.disabled = state.currentPage <= 1;
  el.nextPageBtn.disabled = state.currentPage >= state.pdfJsDoc.numPages;
  state.selectedId = null;
  renderPlacements();
  updateSelectionControls();
}

function updateToolButtons() {
  document.querySelectorAll(".tool-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === state.activeTool);
  });
}

function selectTool(tool) {
  state.activeTool = state.activeTool === tool ? null : tool;
  state.selectedId = null;
  updateToolButtons();
  updateSelectionControls();

  if (!state.activeTool) {
    setStatus("Placement tool cancelled.");
    return;
  }
  const labels = { signature: "signature", name: "typed name", date: "date", text: "text" };
  setStatus(`Tap the PDF where the ${labels[tool]} should go.`);
}

function imageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function addPlacement(event) {
  if (!state.activeTool || !state.pdfJsDoc) return;
  if (event.target !== el.overlayLayer) return;

  const rect = el.overlayLayer.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;
  const type = state.activeTool;
  let item;

  if (type === "signature") {
    if (!state.signatureDataUrl) {
      setStatus("Draw and save your signature first.", "error");
      return;
    }
    const dims = await imageDimensions(state.signatureDataUrl);
    const widthNorm = 0.28;
    const heightNorm = widthNorm * (dims.height / dims.width) * (state.renderWidth / state.renderHeight);
    item = {
      id: uid(),
      page: state.currentPage,
      type,
      x: clamp(clickX / rect.width - widthNorm / 2, 0, 1 - widthNorm),
      y: clamp(clickY / rect.height - heightNorm / 2, 0, 1 - heightNorm),
      width: widthNorm,
      height: heightNorm,
      dataUrl: state.signatureDataUrl,
    };
  } else {
    let value = "";
    if (type === "name") value = el.fullName.value.trim();
    if (type === "date") value = formatDate(el.signDate.value);
    if (type === "text") value = el.customText.value.trim();
    if (!value) {
      const prompt = type === "name" ? "Enter your full name first." : type === "date" ? "Choose a date first." : "Enter optional text first.";
      setStatus(prompt, "error");
      return;
    }
    const fontSize = 0.026;
    item = {
      id: uid(),
      page: state.currentPage,
      type,
      x: clamp(clickX / rect.width, 0, 0.96),
      y: clamp(clickY / rect.height - fontSize / 2, 0, 0.96),
      fontSize,
      value,
    };
  }

  state.placements.push(item);
  state.selectedId = item.id;
  state.activeTool = null;
  invalidatePrepared();
  updateToolButtons();
  renderPlacements();
  updateSelectionControls();
  setStatus("Item placed. Drag it to fine-tune the position.", "success");
}

function renderPlacements() {
  el.overlayLayer.innerHTML = "";
  const pageItems = state.placements.filter((item) => item.page === state.currentPage);

  for (const item of pageItems) {
    const node = document.createElement("div");
    node.className = `placed-item ${item.type === "signature" ? "placed-signature" : "placed-text"}`;
    if (state.selectedId === item.id) node.classList.add("selected");
    node.dataset.id = item.id;
    node.style.left = `${item.x * state.renderWidth}px`;
    node.style.top = `${item.y * state.renderHeight}px`;

    if (item.type === "signature") {
      node.style.width = `${item.width * state.renderWidth}px`;
      node.style.height = `${item.height * state.renderHeight}px`;
      const img = document.createElement("img");
      img.src = item.dataUrl;
      img.alt = "Placed signature";
      node.appendChild(img);
    } else {
      node.textContent = item.value;
      node.style.fontSize = `${Math.max(10, item.fontSize * state.renderHeight)}px`;
    }

    attachDrag(node, item);
    el.overlayLayer.appendChild(node);
  }
}

function attachDrag(node, item) {
  let start = null;

  node.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.selectedId = item.id;
    el.overlayLayer
      .querySelectorAll(".placed-item.selected")
      .forEach((selectedNode) => selectedNode.classList.remove("selected"));
    node.classList.add("selected");
    updateSelectionControls();
    node.setPointerCapture?.(event.pointerId);
    start = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      itemX: item.x,
      itemY: item.y,
    };
  });

  node.addEventListener("pointermove", (event) => {
    if (!start) return;
    event.preventDefault();
    const widthNorm = item.type === "signature" ? item.width : 0.03;
    const heightNorm = item.type === "signature" ? item.height : item.fontSize * 1.2;
    item.x = clamp(start.itemX + (event.clientX - start.pointerX) / state.renderWidth, 0, 1 - widthNorm);
    item.y = clamp(start.itemY + (event.clientY - start.pointerY) / state.renderHeight, 0, 1 - heightNorm);
    const current = el.overlayLayer.querySelector(`[data-id="${item.id}"]`);
    if (current) {
      current.style.left = `${item.x * state.renderWidth}px`;
      current.style.top = `${item.y * state.renderHeight}px`;
    }
    invalidatePrepared();
  });

  const stop = () => { start = null; };
  node.addEventListener("pointerup", stop);
  node.addEventListener("pointercancel", stop);
}

function selectedItem() {
  return state.placements.find((item) => item.id === state.selectedId) || null;
}

function updateSelectionControls() {
  el.selectionControls.classList.toggle("hidden", !selectedItem());
}

function resizeSelected(factor) {
  const item = selectedItem();
  if (!item) return;
  if (item.type === "signature") {
    const ratio = item.height / item.width;
    item.width = clamp(item.width * factor, 0.08, 0.75);
    item.height = item.width * ratio;
    item.x = clamp(item.x, 0, 1 - item.width);
    item.y = clamp(item.y, 0, 1 - item.height);
  } else {
    item.fontSize = clamp(item.fontSize * factor, 0.014, 0.065);
  }
  invalidatePrepared();
  renderPlacements();
}

function deleteSelected() {
  if (!state.selectedId) return;
  state.placements = state.placements.filter((item) => item.id !== state.selectedId);
  state.selectedId = null;
  invalidatePrepared();
  renderPlacements();
  updateSelectionControls();
}

function undoLast() {
  if (!state.placements.length) return;
  state.placements.pop();
  state.selectedId = null;
  invalidatePrepared();
  renderPlacements();
  updateSelectionControls();
  setStatus("Last item removed.");
}

// ---------------- PDF creation and export ----------------
function visualToPageAnchor(rotation, visualX, visualY, pageWidth, pageHeight) {
  const r = ((rotation % 360) + 360) % 360;
  if (r === 90) return { x: pageWidth - visualY, y: visualX };
  if (r === 180) return { x: pageWidth - visualX, y: pageHeight - visualY };
  if (r === 270) return { x: visualY, y: pageHeight - visualX };
  return { x: visualX, y: visualY };
}

async function buildSignedPdf() {
  if (!state.originalBytes) throw new Error("Open a PDF first.");
  if (!state.placements.length) throw new Error("Place at least one item on the PDF first.");

  const pdfDoc = await PDFDocument.load(state.originalBytes.slice(), {
    updateMetadata: false,
  });
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const signatureCache = new Map();

  for (const item of state.placements) {
    const page = pages[item.page - 1];
    if (!page) continue;
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const rotation = page.getRotation().angle || 0;
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const visualWidth = normalizedRotation === 90 || normalizedRotation === 270 ? pageHeight : pageWidth;
    const visualHeight = normalizedRotation === 90 || normalizedRotation === 270 ? pageWidth : pageHeight;

    if (item.type === "signature") {
      let image = signatureCache.get(item.dataUrl);
      if (!image) {
        image = await pdfDoc.embedPng(item.dataUrl);
        signatureCache.set(item.dataUrl, image);
      }
      const drawWidth = item.width * visualWidth;
      const drawHeight = item.height * visualHeight;
      const visualX = item.x * visualWidth;
      const visualY = visualHeight - (item.y * visualHeight + drawHeight);
      const anchor = visualToPageAnchor(rotation, visualX, visualY, pageWidth, pageHeight);
      page.drawImage(image, {
        x: anchor.x,
        y: anchor.y,
        width: drawWidth,
        height: drawHeight,
        rotate: degrees(normalizedRotation),
      });
    } else {
      const size = item.fontSize * visualHeight;
      const visualX = item.x * visualWidth;
      const visualY = visualHeight - item.y * visualHeight - size;
      const anchor = visualToPageAnchor(rotation, visualX, visualY, pageWidth, pageHeight);
      page.drawText(item.value, {
        x: anchor.x,
        y: anchor.y,
        size,
        font,
        rotate: degrees(normalizedRotation),
      });
    }
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

async function preparePdf() {
  setStatus("Preparing signed PDF…");
  el.prepareBtn.disabled = true;
  try {
    state.preparedBlob = await buildSignedPdf();
    if (state.preparedUrl) URL.revokeObjectURL(state.preparedUrl);
    state.preparedUrl = URL.createObjectURL(state.preparedBlob);
    el.exportActions.classList.remove("hidden");
    setStatus("Signed PDF is ready. Tap “Share or Save.”", "success");
  } catch (error) {
    console.error(error);
    setStatus(error?.message || "Could not create the signed PDF.", "error");
  } finally {
    el.prepareBtn.disabled = false;
  }
}

async function sharePrepared() {
  if (!state.preparedBlob) {
    setStatus("Prepare the signed PDF first.", "error");
    return;
  }
  const filename = escapeFilename(state.originalName);
  const file = new File([state.preparedBlob], filename, { type: "application/pdf" });

  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ files: [file], title: filename });
      setStatus(
        "Share sheet opened. For same-thread replies, choose Save to Files, then attach it from Reply in Mail.",
        "success",
      );
    } else {
      downloadPrepared();
      setStatus("File sharing is unavailable in this browser, so the PDF was downloaded instead.");
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      setStatus("The share sheet could not open. Use “Download copy” instead.", "error");
    }
  }
}

function downloadPrepared() {
  if (!state.preparedBlob) {
    setStatus("Prepare the signed PDF first.", "error");
    return;
  }
  const link = document.createElement("a");
  link.href = state.preparedUrl || URL.createObjectURL(state.preparedBlob);
  link.download = escapeFilename(state.originalName);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// ---------------- Wiring ----------------
function cacheElements() {
  [
    "pdfFile", "fileStatus", "fullName", "signDate", "customText", "emailFrom", "emailSubject",
    "saveProfileBtn", "clearProfileBtn", "profileStatus",
    "shortcutOnboarding", "installShortcutBtn", "confirmShortcutBtn", "shortcutStatus",
    "signatureCanvas", "clearSignatureBtn", "saveSignatureBtn", "signatureStatus",
    "documentPanel", "prevPageBtn", "nextPageBtn", "pageIndicator",
    "selectionControls", "smallerBtn", "largerBtn", "deleteItemBtn",
    "pdfStage", "pdfCanvas", "overlayLayer", "undoBtn", "prepareBtn",
    "exportActions", "shareBtn", "downloadBtn", "appStatus",
  ].forEach((id) => { el[id] = byId(id); });
}

function wireEvents() {
  el.pdfFile.addEventListener("change", (event) => loadPdf(event.target.files?.[0]));
  el.installShortcutBtn.addEventListener("click", installShortcut);
  el.confirmShortcutBtn.addEventListener("click", confirmShortcutInstalled);
  el.saveProfileBtn.addEventListener("click", saveProfileState);
  el.clearProfileBtn.addEventListener("click", clearProfileState);
  el.clearSignatureBtn.addEventListener("click", clearSignature);
  el.saveSignatureBtn.addEventListener("click", saveSignature);

  el.signatureCanvas.addEventListener("pointerdown", startSignature);
  el.signatureCanvas.addEventListener("pointermove", moveSignature);
  el.signatureCanvas.addEventListener("pointerup", stopSignature);
  el.signatureCanvas.addEventListener("pointercancel", stopSignature);
  el.signatureCanvas.addEventListener("pointerleave", stopSignature);

  document.querySelectorAll(".tool-btn").forEach((button) => {
    button.addEventListener("click", () => selectTool(button.dataset.tool));
  });

  el.overlayLayer.addEventListener("pointerdown", addPlacement);
  el.prevPageBtn.addEventListener("click", async () => {
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      await renderCurrentPage();
    }
  });
  el.nextPageBtn.addEventListener("click", async () => {
    if (state.pdfJsDoc && state.currentPage < state.pdfJsDoc.numPages) {
      state.currentPage += 1;
      await renderCurrentPage();
    }
  });

  el.smallerBtn.addEventListener("click", () => resizeSelected(0.86));
  el.largerBtn.addEventListener("click", () => resizeSelected(1.16));
  el.deleteItemBtn.addEventListener("click", deleteSelected);
  el.undoBtn.addEventListener("click", undoLast);
  el.prepareBtn.addEventListener("click", preparePdf);
  el.shareBtn.addEventListener("click", sharePrepared);
  el.downloadBtn.addEventListener("click", downloadPrepared);

  [el.fullName, el.signDate, el.customText, el.emailFrom, el.emailSubject].forEach((input) => {
    input.addEventListener("input", () => {
      invalidatePrepared();
      saveDraftState();
    });
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(async () => {
      resizeSignatureCanvas(true);
      if (state.pdfJsDoc) await renderCurrentPage();
    }, 180);
  });
}

function init() {
  cacheElements();
  updateShortcutOnboarding();
  restoreDraftState();
  restoreProfileState();
  applyInboundMailContext();
  setTodayIfNeeded();
  resizeSignatureCanvas(false);
  wireEvents();
  saveDraftState();
  setStatus("Choose a PDF, enter your details, and draw your signature.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
