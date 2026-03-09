const leftVideo = document.getElementById("leftVideo");
const rightVideo = document.getElementById("rightVideo");
const leftVideoWrap = document.getElementById("leftVideoWrap");
const rightVideoWrap = document.getElementById("rightVideoWrap");
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
const commentsList = document.getElementById("commentsList");
const commentCount = document.getElementById("commentCount");
const sortType = document.getElementById("sortType");
const sortOrder = document.getElementById("sortOrder");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const statusMessage = document.getElementById("statusMessage");

let canControl = false;
let isPlaying = false;
let isScrubbing = false;
let seekToken = 0;
let comments = [];
let frameDuration = 1 / 30;
let rafId = null;
let isResizingHorizontalPane = false;
const HARD_SYNC_THRESHOLD = 1 / 240;
const SOFT_SYNC_THRESHOLD = 1 / 1000;

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
  if (!leftVideo.duration || !rightVideo.duration) return 0;
  if (!Number.isFinite(leftVideo.duration) || !Number.isFinite(rightVideo.duration)) return 0;
  return Math.min(leftVideo.duration, rightVideo.duration);
}

function syncControlsState() {
  canControl = Boolean(leftVideo.src && rightVideo.src && getDuration() > 0);
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
  const current = leftVideo.currentTime || 0;
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
  if (!canControl) return;
  if (rightVideo.readyState < 2) return;
  const master = leftVideo.currentTime;
  const slave = rightVideo.currentTime;
  if (!Number.isFinite(master) || !Number.isFinite(slave)) return;

  const drift = master - slave;
  const absDrift = Math.abs(drift);

  if (absDrift > HARD_SYNC_THRESHOLD) {
    rightVideo.currentTime = master;
    rightVideo.playbackRate = 1;
  } else if (isPlaying && absDrift > SOFT_SYNC_THRESHOLD) {
    const nudgedRate = Math.min(1.03, Math.max(0.97, 1 + drift * 0.35));
    rightVideo.playbackRate = nudgedRate;
  } else {
    rightVideo.playbackRate = 1;
  }

  if (isPlaying && rightVideo.paused) {
    rightVideo.play().catch(() => {});
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
  setPlayingState(false);
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function playBoth() {
  if (!canControl) return;
  const t = leftVideo.currentTime;
  rightVideo.currentTime = t;

  Promise.allSettled([leftVideo.play(), rightVideo.play()]).then(() => {
    setPlayingState(true);
    startTick();
  });
}

function seekBoth(seconds, resume = false) {
  if (!canControl) return;

  const duration = getDuration();
  const clamped = Math.min(Math.max(seconds, 0), duration);
  const token = ++seekToken;

  leftVideo.currentTime = clamped;
  rightVideo.currentTime = clamped;

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
    setMessage("2動画を読み込みました。同期再生できます。");
  } else {
    setMessage("もう片方の動画を選択してください。");
  }
}

function handleFileSelection(fileInput, videoEl, filenameEl, placeholderEl) {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".mp4")) {
    setMessage("MP4形式のみ対応しています。");
    return;
  }

  const url = URL.createObjectURL(file);
  videoEl.src = url;
  filenameEl.textContent = file.name;
  placeholderEl.style.display = "none";
  pauseBoth();
  onVideoLoaded();
}

function openFilePicker(fileInput) {
  if (!fileInput) return;
  fileInput.value = "";
  fileInput.click();
}

function addComment() {
  const text = commentInput.value.trim();
  if (!text) return;

  const author = authorInput.value.trim() || "未入力";
  comments.unshift({
    id: crypto.randomUUID(),
    author,
    text,
    seconds: leftVideo.currentTime || 0,
    timecode: formatTime(leftVideo.currentTime || 0),
    updatedAt: Date.now()
  });

  commentInput.value = "";
  renderComments();
}

function sortedComments() {
  const type = sortType.value;
  const order = sortOrder.value;
  const copy = [...comments];

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
  commentCount.textContent = `コメント: ${comments.length}`;

  if (comments.length === 0) {
    commentsList.innerHTML = '<div class="comment-item"><div class="comment-time">--:--:--</div><div class="comment-text" style="color:#667088">コメントはまだありません</div><div></div></div>';
    return;
  }

  commentsList.innerHTML = "";

  sortedComments().forEach((comment) => {
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

function toCsvField(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCommentsCsv() {
  const rows = sortedComments();
  const header = ["動画時間", "秒", "記入者", "コメント", "更新日時"];
  const lines = [header.map(toCsvField).join(",")];

  rows.forEach((row) => {
    const updatedAt = new Date(row.updatedAt).toISOString();
    lines.push(
      [row.timecode, row.seconds.toFixed(3), row.author, row.text, updatedAt]
        .map(toCsvField)
        .join(",")
    );
  });

  const bom = "\uFEFF";
  const csv = `${bom}${lines.join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  a.href = url;
  a.download = `versusview-comments-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

function setupVideoPickerOnSurface(videoWrap, videoEl, fileInput) {
  if (!videoWrap || !videoEl || !fileInput) return;

  videoWrap.addEventListener("click", (e) => {
    if (videoEl.src) return;
    e.preventDefault();
    openFilePicker(fileInput);
  });

  videoWrap.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openFilePicker(fileInput);
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
commentInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.shiftKey) {
    e.preventDefault();
    addComment();
  }
});
sortType.addEventListener("change", renderComments);
sortOrder.addEventListener("change", renderComments);
if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", exportCommentsCsv);
}

paneResizer.addEventListener("pointerdown", beginHorizontalResize);
window.addEventListener("pointermove", updateHorizontalResize);
window.addEventListener("pointerup", endHorizontalResize);
window.addEventListener("pointercancel", endHorizontalResize);

setupVideoPickerOnSurface(leftVideoWrap, leftVideo, leftFile);
setupVideoPickerOnSurface(rightVideoWrap, rightVideo, rightFile);

syncControlsState();
renderComments();
updateTimelineUI();
