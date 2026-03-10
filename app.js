const leftVideo = document.getElementById("leftVideo");
const rightVideo = document.getElementById("rightVideo");
const leftVideoWrap = document.getElementById("leftVideoWrap");
const rightVideoWrap = document.getElementById("rightVideoWrap");
const videoGrid = document.getElementById("videoGrid");
const splitLayout = document.getElementById("splitLayout");
const paneResizer = document.getElementById("paneResizer");
const leftFile = document.getElementById("leftFile");
const rightFile = document.getElementById("rightFile");
const leftFilename = document.getElementById("leftFilename");
const rightFilename = document.getElementById("rightFilename");
const leftPlaceholder = document.getElementById("leftPlaceholder");
const rightPlaceholder = document.getElementById("rightPlaceholder");

const playStatus = document.getElementById("playStatus");
const playPauseBtn = document.getElementById("playPauseBtn");
const stepBackBtn = document.getElementById("stepBackBtn");
const stepForwardBtn = document.getElementById("stepForwardBtn");
const seekSlider = document.getElementById("seekSlider");
const timeInput = document.getElementById("timeInput");
const durationLabel = document.getElementById("durationLabel");
const remainLabel = document.getElementById("remainLabel");

const authorInput = document.getElementById("authorInput");
const commentInput = document.getElementById("commentInput");
const addCommentBtn = document.getElementById("addCommentBtn");
const compareModeTab = document.getElementById("compareModeTab");
const singleModeTab = document.getElementById("singleModeTab");
const singleTargetRow = document.getElementById("singleTargetRow");
const singleTargetSelect = document.getElementById("singleTargetSelect");
const commentsList = document.getElementById("commentsList");
const commentCount = document.getElementById("commentCount");
const sortType = document.getElementById("sortType");
const sortOrder = document.getElementById("sortOrder");
const openExportOverlayBtn = document.getElementById("openExportOverlayBtn");
const importCommentsBtn = document.getElementById("importCommentsBtn");
const importCommentsFile = document.getElementById("importCommentsFile");
const exportOverlay = document.getElementById("exportOverlay");
const closeExportOverlayBtn = document.getElementById("closeExportOverlayBtn");
const chooseExportLocationBtn = document.getElementById("chooseExportLocationBtn");
const exportLocationLabel = document.getElementById("exportLocationLabel");
const runExportBtn = document.getElementById("runExportBtn");
const exportFormatInputs = document.querySelectorAll('input[name="exportFormat"]');
const exportLocationTypeInputs = document.querySelectorAll('input[name="exportLocationType"]');
const exportFieldInputs = document.querySelectorAll('input[data-export-field]');
const statusMessage = document.getElementById("statusMessage");

let canControl = false;
let isPlaying = false;
let isScrubbing = false;
let seekToken = 0;
let comments = [];
let frameDuration = 1 / 30;
let rafId = null;
let isResizingHorizontalPane = false;
let frameLockRequestId = null;
let exportFileHandle = null;
let viewMode = "compare";

leftVideo.controls = false;
rightVideo.controls = false;
rightVideo.muted = true;

function setMessage(text) {
  if (!statusMessage) return;
  statusMessage.textContent = text || "";
}

function formatTime(seconds) {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const fps = Math.max(1, Math.round(1 / frameDuration));
  const totalFrames = Math.round(s * fps);
  const minutes = Math.floor(totalFrames / (fps * 60));
  const sec = Math.floor((totalFrames % (fps * 60)) / fps);
  const frame = totalFrames % fps;
  return `${String(minutes).padStart(2, "0")}:${String(sec).padStart(2, "0")}:${String(frame).padStart(2, "0")}`;
}

function normalizeTimeInput(value) {
  return value
    .normalize("NFKC")
    .replaceAll("：", ":")
    .replaceAll("．", ":")
    .replaceAll("，", ":")
    .replaceAll(".", ":")
    .replaceAll("　", "")
    .replaceAll(" ", "")
    .trim();
}

function parseTimeInput(value) {
  const text = normalizeTimeInput(value);
  if (!text) return null;

  const fps = Math.max(1, Math.round(1 / frameDuration));
  const parts = text.split(":");

  if (parts.length === 1) {
    const sec = Number(parts[0]);
    return Number.isFinite(sec) ? sec : null;
  }

  if (parts.length !== 3) return null;

  const min = Number(parts[0]);
  const sec = Number(parts[1]);
  const frame = Number(parts[2]);
  if (!Number.isInteger(min) || !Number.isInteger(sec) || !Number.isInteger(frame)) return null;
  if (min < 0 || sec < 0 || sec >= 60) return null;
  if (frame < 0 || frame >= fps) return null;

  return min * 60 + sec + frame / fps;
}

function nearestFrame(seconds) {
  const step = Math.max(frameDuration, 1 / 120);
  return Math.round(seconds / step) * step;
}

function getDuration() {
  if (viewMode === "single") {
    const singleTarget = singleTargetSelect?.value || "left";
    const video = singleTarget === "right" ? rightVideo : leftVideo;
    if (!video.duration || !Number.isFinite(video.duration)) return 0;
    return video.duration;
  }
  if (!leftVideo.duration || !rightVideo.duration) return 0;
  if (!Number.isFinite(leftVideo.duration) || !Number.isFinite(rightVideo.duration)) return 0;
  return Math.min(leftVideo.duration, rightVideo.duration);
}

function syncControlsState() {
  if (viewMode === "single") {
    const singleTarget = singleTargetSelect?.value || "left";
    const video = singleTarget === "right" ? rightVideo : leftVideo;
    canControl = Boolean(video.src && getDuration() > 0);
  } else {
    canControl = Boolean(leftVideo.src && rightVideo.src && getDuration() > 0);
  }
  playPauseBtn.disabled = !canControl;
  stepBackBtn.disabled = !canControl;
  stepForwardBtn.disabled = !canControl;
  seekSlider.disabled = !canControl;
}

function setPlayingState(playing) {
  isPlaying = playing;
  playPauseBtn.textContent = playing ? "⏸" : "▶";
  playStatus.textContent = playing ? "再生中" : "停止中";
  playStatus.classList.toggle("playing", playing);
}

function updateTimelineUI() {
  const singleTarget = singleTargetSelect?.value || "left";
  const baseVideo =
    viewMode === "single"
      ? (singleTarget === "right" ? rightVideo : leftVideo)
      : leftVideo;
  const current = baseVideo.currentTime || 0;
  const duration = getDuration();

  if (!isScrubbing) {
    seekSlider.value = duration > 0 ? String(Math.min(current / duration, 1)) : "0";
  }

  timeInput.value = formatTime(current);
  durationLabel.textContent = `/ ${formatTime(duration)}`;
  const remain = Math.max(duration - current, 0);
  remainLabel.textContent = `-${formatTime(remain)}`;
}

function syncRightToLeft() {
  if (viewMode !== "compare") return;
  if (!canControl) return;
  if (rightVideo.readyState < 2) return;
  const master = leftVideo.currentTime;
  const slave = rightVideo.currentTime;
  if (!Number.isFinite(master) || !Number.isFinite(slave)) return;

  const fps = Math.max(1, Math.round(1 / frameDuration));
  const masterFrame = Math.round(master * fps);
  const slaveFrame = Math.round(slave * fps);
  if (masterFrame !== slaveFrame) {
    rightVideo.currentTime = masterFrame / fps;
  }
  rightVideo.playbackRate = 1;

  if (isPlaying && rightVideo.paused) {
    rightVideo.play().catch(() => {});
  }
}

function stopFrameLock() {
  if (frameLockRequestId !== null && typeof leftVideo.cancelVideoFrameCallback === "function") {
    leftVideo.cancelVideoFrameCallback(frameLockRequestId);
  }
  frameLockRequestId = null;
}

function frameLockTick(_now, metadata) {
  if (!isPlaying || !canControl) {
    frameLockRequestId = null;
    return;
  }
  if (!Number.isFinite(metadata?.mediaTime)) {
    syncRightToLeft();
  } else {
    const fps = Math.max(1, Math.round(1 / frameDuration));
    const masterFrame = Math.round(metadata.mediaTime * fps);
    const target = masterFrame / fps;
    const slave = rightVideo.currentTime;
    const slaveFrame = Math.round(slave * fps);
    if (slaveFrame !== masterFrame) {
      rightVideo.currentTime = target;
    }
    rightVideo.playbackRate = 1;
    if (isPlaying && rightVideo.paused) {
      rightVideo.play().catch(() => {});
    }
  }

  if (typeof leftVideo.requestVideoFrameCallback === "function") {
    frameLockRequestId = leftVideo.requestVideoFrameCallback(frameLockTick);
  } else {
    frameLockRequestId = null;
  }
}

function startFrameLock() {
  stopFrameLock();
  if (!isPlaying || !canControl) return;
  if (typeof leftVideo.requestVideoFrameCallback === "function") {
    frameLockRequestId = leftVideo.requestVideoFrameCallback(frameLockTick);
  }
}

function tick() {
  updateTimelineUI();
  syncRightToLeft();
  if (isPlaying) {
    rafId = requestAnimationFrame(tick);
  }
}

function startTick() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
}

function pauseBoth() {
  leftVideo.pause();
  rightVideo.pause();
  rightVideo.playbackRate = 1;
  stopFrameLock();
  setPlayingState(false);
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function playBoth() {
  if (!canControl) return;
  if (viewMode === "single") {
    const singleTarget = singleTargetSelect?.value || "left";
    const video = singleTarget === "right" ? rightVideo : leftVideo;
    const other = singleTarget === "right" ? leftVideo : rightVideo;
    other.pause();
    Promise.allSettled([video.play()]).then(() => {
      setPlayingState(true);
      startTick();
      stopFrameLock();
    });
    return;
  }
  const t = leftVideo.currentTime;
  rightVideo.currentTime = t;

  Promise.allSettled([leftVideo.play(), rightVideo.play()]).then(() => {
    setPlayingState(true);
    startTick();
    startFrameLock();
  });
}

function seekBoth(seconds, resume = false) {
  if (!canControl) return;

  const duration = getDuration();
  const clamped = Math.min(Math.max(seconds, 0), duration);
  const token = ++seekToken;

  if (viewMode === "single") {
    const singleTarget = singleTargetSelect?.value || "left";
    const video = singleTarget === "right" ? rightVideo : leftVideo;
    video.currentTime = clamped;
  } else {
    leftVideo.currentTime = clamped;
    rightVideo.currentTime = clamped;
  }

  setTimeout(() => {
    if (token !== seekToken) return;
    updateTimelineUI();
    if (resume) playBoth();
  }, 0);
}

function stepFrame(dir) {
  if (!canControl) return;
  pauseBoth();
  const next = leftVideo.currentTime + frameDuration * dir;
  seekBoth(next, false);
}

function recalcFrameDuration() {
  // Browser APIs do not expose FPS reliably. Keep stable default.
  frameDuration = 1 / 30;
}

function onVideoLoaded() {
  recalcFrameDuration();
  syncControlsState();
  updateTimelineUI();
  if (canControl) {
    seekBoth(0, false);
    if (viewMode === "compare") {
      setMessage("2動画を読み込みました。同期再生できます。");
    } else {
      setMessage("動画を読み込みました。単体チェックできます。");
    }
  } else {
    if (viewMode === "compare") {
      setMessage("もう片方の動画を選択してください。");
    } else {
      setMessage("単体チェックする動画を選択してください。");
    }
  }
}

function loadSelectedVideoFile(file, videoEl, filenameEl, placeholderEl) {
  if (!file.name.toLowerCase().endsWith(".mp4")) {
    setMessage("MP4形式のみ対応しています。");
    return false;
  }

  const url = URL.createObjectURL(file);
  videoEl.src = url;
  filenameEl.textContent = file.name;
  placeholderEl.style.display = "none";
  pauseBoth();
  onVideoLoaded();
  return true;
}

function handleFileSelection(fileInput, videoEl, filenameEl, placeholderEl) {
  const file = fileInput.files?.[0];
  if (!file) return;
  const ok = loadSelectedVideoFile(file, videoEl, filenameEl, placeholderEl);
  if (!ok) return;
}

async function openFilePicker(fileInput, videoEl, filenameEl, placeholderEl) {
  if (!fileInput || !videoEl || !filenameEl || !placeholderEl) return;
  if (window.showOpenFilePicker) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "MP4 Video", accept: { "video/mp4": [".mp4"] } }]
      });
      if (!handles?.length) return;
      const handle = handles[0];
      const file = await handle.getFile();
      const ok = loadSelectedVideoFile(file, videoEl, filenameEl, placeholderEl);
      if (!ok) return;
      return;
    } catch {
      // User cancelled or API unavailable in this context.
    }
  }
  fileInput.value = "";
  fileInput.click();
}

function addComment() {
  const text = commentInput.value.trim();
  if (!text) return;

  const author = authorInput.value.trim() || "未入力";
  const baseTime = leftVideo.currentTime || 0;

  comments.unshift({
    id: crypto.randomUUID(),
    author,
    text,
    seconds: baseTime,
    timecode: formatTime(baseTime),
    updatedAt: Date.now()
  });

  commentInput.value = "";
  renderComments();
}

function sortedComments(source) {
  const type = sortType.value;
  const order = sortOrder.value;
  const copy = [...(source || comments)];

  copy.sort((a, b) => {
    let diff = 0;
    if (type === "updatedAt") {
      diff = a.updatedAt - b.updatedAt;
    } else {
      diff = a.seconds - b.seconds;
    }
    return order === "asc" ? diff : -diff;
  });

  return copy;
}

function renderComments() {
  const rows = sortedComments();
  commentCount.textContent = `コメント: ${rows.length}`;

  if (rows.length === 0) {
    commentsList.innerHTML = '<div class="comment-item"><div class="comment-time">--:--:--</div><div class="comment-text" style="color:#667088">コメントはまだありません</div><div></div></div>';
    return;
  }

  commentsList.innerHTML = "";

  rows.forEach((comment) => {
    const item = document.createElement("div");
    item.className = "comment-item";

    const time = document.createElement("div");
    time.className = "comment-time";
    time.textContent = comment.timecode;

    const main = document.createElement("div");
    const author = document.createElement("div");
    author.className = "comment-author";
    author.textContent = comment.author;

    const text = document.createElement("button");
    text.className = "comment-text btn";
    text.style.textAlign = "left";
    text.style.padding = "6px 8px";
    text.style.borderRadius = "8px";
    text.textContent = comment.text;
    text.title = "クリックでこの時刻に移動";
    text.addEventListener("click", () => {
      pauseBoth();
      seekBoth(comment.seconds, false);
    });

    main.append(author, text);

    const actions = document.createElement("div");
    actions.className = "comment-actions";

    const edit = document.createElement("button");
    edit.className = "btn";
    edit.textContent = "編集";
    edit.addEventListener("click", () => {
      const updated = prompt("コメントを編集", comment.text);
      if (updated === null) return;
      const trimmed = updated.trim();
      if (!trimmed) return;
      comment.text = trimmed;
      comment.updatedAt = Date.now();
      renderComments();
    });

    const remove = document.createElement("button");
    remove.className = "btn btn-danger";
    remove.textContent = "削除";
    remove.addEventListener("click", () => {
      comments = comments.filter((c) => c.id !== comment.id);
      renderComments();
    });

    actions.append(edit, remove);
    item.append(time, main, actions);
    commentsList.appendChild(item);
  });
}

function setViewMode(nextMode) {
  viewMode = nextMode === "single" ? "single" : "compare";
  const singleTarget = singleTargetSelect?.value || "left";

  if (compareModeTab) compareModeTab.classList.toggle("active", viewMode === "compare");
  if (singleModeTab) singleModeTab.classList.toggle("active", viewMode === "single");
  if (singleTargetRow) singleTargetRow.classList.toggle("is-hidden", viewMode !== "single");

  if (videoGrid) {
    videoGrid.classList.remove("single-left", "single-right");
    if (viewMode === "single") {
      videoGrid.classList.add(singleTarget === "right" ? "single-right" : "single-left");
    }
  }

  if (viewMode === "compare") {
    leftVideo.muted = false;
    rightVideo.muted = true;
  } else if (singleTarget === "right") {
    leftVideo.muted = true;
    rightVideo.muted = false;
  } else {
    leftVideo.muted = false;
    rightVideo.muted = true;
  }

  pauseBoth();
  syncControlsState();
  updateTimelineUI();
}

function toCsvField(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

const EXPORT_FIELDS = [
  { key: "timecode", label: "動画時間", value: (row) => row.timecode },
  { key: "seconds", label: "秒", value: (row) => row.seconds.toFixed(3) },
  { key: "author", label: "記入者", value: (row) => row.author },
  { key: "text", label: "コメント", value: (row) => row.text },
  { key: "updatedAt", label: "更新日時", value: (row) => new Date(row.updatedAt).toISOString() }
];

function getSelectedExportFormat() {
  const selected = [...exportFormatInputs].find((input) => input.checked);
  return selected?.value === "txt" ? "txt" : "csv";
}

function getSelectedExportFields() {
  const selectedKeys = [...exportFieldInputs]
    .filter((input) => input.checked)
    .map((input) => input.getAttribute("data-export-field"));
  return EXPORT_FIELDS.filter((field) => selectedKeys.includes(field.key));
}

function getSelectedExportLocationType() {
  const selected = [...exportLocationTypeInputs].find((input) => input.checked);
  return selected?.value || "download";
}

function updateExportLocationUI() {
  const type = getSelectedExportLocationType();
  if (chooseExportLocationBtn) {
    chooseExportLocationBtn.style.display = type === "custom" ? "inline-flex" : "none";
  }

  if (!exportLocationLabel) return;
  if (type === "download") {
    exportLocationLabel.textContent = "通常ダウンロードします";
    return;
  }
  exportLocationLabel.textContent = exportFileHandle
    ? `選択中: ${exportFileHandle.name || "(ファイル)"}`
    : "未選択（未選択時は通常ダウンロード）";
}

function buildCsvContent(rows, fields) {
  const header = fields.map((field) => field.label);
  const lines = [header.map(toCsvField).join(",")];
  rows.forEach((row) => {
    lines.push(fields.map((field) => toCsvField(field.value(row))).join(","));
  });
  return `\uFEFF${lines.join("\n")}`;
}

function buildTxtContent(rows, fields) {
  const lines = rows.map((row) =>
    fields.map((field) => `${field.label}: ${field.value(row)}`).join(" | ")
  );
  return lines.join("\n");
}

async function saveByHandle(content) {
  if (!exportFileHandle) return false;
  try {
    const writable = await exportFileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    const name = exportFileHandle.name || "(ファイル)";
    exportLocationLabel.textContent = `選択中: ${name}`;
    return true;
  } catch {
    exportFileHandle = null;
    exportLocationLabel.textContent = "未選択（未選択時は通常ダウンロード）";
    return false;
  }
}

function saveByDownload(content, format) {
  const mimeType = format === "txt" ? "text/plain;charset=utf-8;" : "text/csv;charset=utf-8;";
  const ext = format === "txt" ? "txt" : "csv";
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  a.href = url;
  a.download = `versusview-comments-${stamp}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function chooseExportLocation() {
  if (!window.showSaveFilePicker) {
    exportFileHandle = null;
    exportLocationLabel.textContent = "このブラウザでは保存場所指定に未対応（通常ダウンロード）";
    return;
  }
  const format = getSelectedExportFormat();
  const ext = format === "txt" ? "txt" : "csv";
  const accept = format === "txt" ? { "text/plain": [".txt"] } : { "text/csv": [".csv"] };
  try {
    exportFileHandle = await window.showSaveFilePicker({
      suggestedName: `versusview-comments.${ext}`,
      types: [{ description: format.toUpperCase(), accept }]
    });
    updateExportLocationUI();
  } catch {
    // User cancelled picker.
  }
}

function setExportOverlayVisible(visible) {
  if (!exportOverlay) return;
  exportOverlay.classList.toggle("hidden", !visible);
  exportOverlay.setAttribute("aria-hidden", visible ? "false" : "true");
}

async function runExport() {
  const fields = getSelectedExportFields();
  if (fields.length === 0) return;
  const rows = sortedComments();
  const format = getSelectedExportFormat();
  const content = format === "txt" ? buildTxtContent(rows, fields) : buildCsvContent(rows, fields);
  const locationType = getSelectedExportLocationType();
  if (locationType === "download") {
    saveByDownload(content, format);
    setExportOverlayVisible(false);
    return;
  }

  // Custom location selected:
  // If no file has been chosen, fall back to regular download.
  if (!exportFileHandle) {
    saveByDownload(content, format);
    setExportOverlayVisible(false);
    return;
  }

  const saved = await saveByHandle(content);
  if (!saved) {
    saveByDownload(content, format);
  }
  setExportOverlayVisible(false);
}

function parseCsvText(text) {
  const normalized = text.replace(/^\uFEFF/, "");
  const table = [];
  let row = [];
  let field = "";
  let inQuote = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    if (ch === '"') {
      if (inQuote && normalized[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === "," && !inQuote) {
      row.push(field);
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuote) {
      if (ch === "\r" && normalized[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((v) => v.length > 0)) table.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.length > 0)) table.push(row);
  }

  if (table.length === 0) return [];
  const headers = table[0];
  const byLabel = (label) => headers.indexOf(label);
  const idx = {
    timecode: byLabel("動画時間"),
    seconds: byLabel("秒"),
    author: byLabel("記入者"),
    text: byLabel("コメント"),
    updatedAt: byLabel("更新日時")
  };

  return table.slice(1).map((cols, rowIndex) => {
    const secondsRaw = idx.seconds >= 0 ? Number(cols[idx.seconds]) : NaN;
    const timecodeRaw = idx.timecode >= 0 ? cols[idx.timecode] : "";
    const parsedByTimecode = parseTimeInput(timecodeRaw);
    const seconds = Number.isFinite(secondsRaw)
      ? secondsRaw
      : Number.isFinite(parsedByTimecode)
        ? parsedByTimecode
        : 0;
    const updatedRaw = idx.updatedAt >= 0 ? Date.parse(cols[idx.updatedAt]) : NaN;
    return {
      id: crypto.randomUUID(),
      author: idx.author >= 0 ? (cols[idx.author] || "未入力") : "未入力",
      text: idx.text >= 0 ? (cols[idx.text] || "") : "",
      seconds,
      timecode: Number.isFinite(parsedByTimecode) ? formatTime(parsedByTimecode) : formatTime(seconds),
      updatedAt: Number.isFinite(updatedRaw) ? updatedRaw : Date.now() + rowIndex
    };
  }).filter((row) => row.text.length > 0);
}

function parseTxtText(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line, rowIndex) => {
    const pairs = line.split(" | ").map((part) => {
      const sep = part.indexOf(":");
      if (sep === -1) return ["", ""];
      const key = part.slice(0, sep).trim();
      const value = part.slice(sep + 1).trim();
      return [key, value];
    });
    const map = Object.fromEntries(pairs);
    const secondsRaw = Number(map["秒"]);
    const parsedByTimecode = parseTimeInput(map["動画時間"] || "");
    const seconds = Number.isFinite(secondsRaw)
      ? secondsRaw
      : Number.isFinite(parsedByTimecode)
        ? parsedByTimecode
        : 0;
    const updatedRaw = Date.parse(map["更新日時"] || "");
    return {
      id: crypto.randomUUID(),
      author: map["記入者"] || "未入力",
      text: map["コメント"] || "",
      seconds,
      timecode: Number.isFinite(parsedByTimecode) ? formatTime(parsedByTimecode) : formatTime(seconds),
      updatedAt: Number.isFinite(updatedRaw) ? updatedRaw : Date.now() + rowIndex
    };
  }).filter((row) => row.text.length > 0);
}

async function importCommentsFromFile(file) {
  if (!file) return;
  const text = await file.text();
  const lower = file.name.toLowerCase();
  const parsed = lower.endsWith(".txt") ? parseTxtText(text) : parseCsvText(text);
  if (parsed.length === 0) {
    setMessage("読み込み可能なコメントが見つかりませんでした。");
    return;
  }
  comments = parsed;
  renderComments();
  setMessage(`${parsed.length}件のコメントで一覧を更新しました。`);
}

function beginHorizontalResize(event) {
  isResizingHorizontalPane = true;
  document.body.classList.add("resizing");
  event.preventDefault();
}

function updateHorizontalResize(event) {
  if (!isResizingHorizontalPane) return;
  const rect = splitLayout.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const minLeft = 560;
  const minRight = 300;
  const maxLeft = Math.max(rect.width - minRight - 10, minLeft);
  const clamped = Math.min(Math.max(localX, minLeft), maxLeft);
  splitLayout.style.gridTemplateColumns = `${clamped}px 10px minmax(${minRight}px, 1fr)`;
}

function endHorizontalResize() {
  if (!isResizingHorizontalPane) return;
  isResizingHorizontalPane = false;
  document.body.classList.remove("resizing");
}

leftFile.addEventListener("change", () => {
  handleFileSelection(leftFile, leftVideo, leftFilename, leftPlaceholder);
});

rightFile.addEventListener("change", () => {
  handleFileSelection(rightFile, rightVideo, rightFilename, rightPlaceholder);
});

playPauseBtn.addEventListener("click", () => {
  if (!canControl) return;
  if (isPlaying) pauseBoth();
  else playBoth();
});

function setupVideoPickerOnSurface(videoWrap, videoEl, fileInput, filenameEl, placeholderEl) {
  if (!videoWrap || !videoEl || !fileInput || !filenameEl || !placeholderEl) return;

  videoWrap.addEventListener("click", async (e) => {
    if (videoEl.src) return;
    e.preventDefault();
    await openFilePicker(fileInput, videoEl, filenameEl, placeholderEl);
  });

  videoWrap.addEventListener("dblclick", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await openFilePicker(fileInput, videoEl, filenameEl, placeholderEl);
  });
}

stepBackBtn.addEventListener("click", () => stepFrame(-1));
stepForwardBtn.addEventListener("click", () => stepFrame(1));

seekSlider.addEventListener("input", () => {
  if (!canControl) return;
  isScrubbing = true;
  pauseBoth();
  const duration = getDuration();
  const target = Number(seekSlider.value) * duration;
  timeInput.value = formatTime(target);
  seekBoth(target, false);
});

seekSlider.addEventListener("change", () => {
  isScrubbing = false;
});

timeInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const parsed = parseTimeInput(timeInput.value);
  const duration = getDuration();
  if (parsed === null) return;
  if (parsed < 0 || parsed > duration) return;

  pauseBoth();
  seekBoth(nearestFrame(parsed), false);
});

[leftVideo, rightVideo].forEach((video) => {
  video.addEventListener("loadedmetadata", onVideoLoaded);
  video.addEventListener("ended", pauseBoth);
});
leftVideo.addEventListener("timeupdate", syncRightToLeft);
leftVideo.addEventListener("seeking", syncRightToLeft);
leftVideo.addEventListener("seeked", syncRightToLeft);

if (addCommentBtn) {
  addCommentBtn.addEventListener("click", addComment);
}
if (compareModeTab) {
  compareModeTab.addEventListener("click", () => setViewMode("compare"));
}
if (singleModeTab) {
  singleModeTab.addEventListener("click", () => setViewMode("single"));
}
if (singleTargetSelect) {
  singleTargetSelect.addEventListener("change", () => {
    if (viewMode === "single") setViewMode("single");
  });
}
commentInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.shiftKey) {
    e.preventDefault();
    addComment();
  }
});
sortType.addEventListener("change", renderComments);
sortOrder.addEventListener("change", renderComments);
if (openExportOverlayBtn) {
  openExportOverlayBtn.addEventListener("click", () => {
    updateExportLocationUI();
    setExportOverlayVisible(true);
  });
}
if (closeExportOverlayBtn) {
  closeExportOverlayBtn.addEventListener("click", () => setExportOverlayVisible(false));
}
if (exportOverlay) {
  exportOverlay.addEventListener("click", (e) => {
    if (e.target === exportOverlay) setExportOverlayVisible(false);
  });
}
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setExportOverlayVisible(false);
});
if (chooseExportLocationBtn) {
  chooseExportLocationBtn.addEventListener("click", chooseExportLocation);
}
if (runExportBtn) {
  runExportBtn.addEventListener("click", runExport);
}
if (importCommentsBtn && importCommentsFile) {
  importCommentsBtn.addEventListener("click", () => {
    importCommentsFile.value = "";
    importCommentsFile.click();
  });
  importCommentsFile.addEventListener("change", async () => {
    const file = importCommentsFile.files?.[0];
    await importCommentsFromFile(file);
  });
}
exportFormatInputs.forEach((input) => {
  input.addEventListener("change", () => {
    exportFileHandle = null;
    updateExportLocationUI();
  });
});
exportLocationTypeInputs.forEach((input) => {
  input.addEventListener("change", updateExportLocationUI);
});

paneResizer.addEventListener("pointerdown", beginHorizontalResize);
window.addEventListener("pointermove", updateHorizontalResize);
window.addEventListener("pointerup", endHorizontalResize);
window.addEventListener("pointercancel", endHorizontalResize);

setupVideoPickerOnSurface(leftVideoWrap, leftVideo, leftFile, leftFilename, leftPlaceholder);
setupVideoPickerOnSurface(rightVideoWrap, rightVideo, rightFile, rightFilename, rightPlaceholder);

syncControlsState();
renderComments();
updateTimelineUI();
updateExportLocationUI();
setViewMode("compare");
