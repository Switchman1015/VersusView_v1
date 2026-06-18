const leftVideo = document.getElementById("leftVideo");
const rightVideo = document.getElementById("rightVideo");
const leftVideoWrap = document.getElementById("leftVideoWrap");
const rightVideoWrap = document.getElementById("rightVideoWrap");
const videoGrid = document.getElementById("videoGrid");
const viewModeTabs = document.querySelector(".view-mode-tabs");
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
const tenSecondBackBtn = document.getElementById("tenSecondBackBtn");
const secondBackBtn = document.getElementById("secondBackBtn");
const stepBackBtn = document.getElementById("stepBackBtn");
const stepForwardBtn = document.getElementById("stepForwardBtn");
const secondForwardBtn = document.getElementById("secondForwardBtn");
const tenSecondForwardBtn = document.getElementById("tenSecondForwardBtn");
const seekSlider = document.getElementById("seekSlider");
const seekMarkers = document.getElementById("seekMarkers");
const timeInput = document.getElementById("timeInput");
const durationLabel = document.getElementById("durationLabel");
const remainLabel = document.getElementById("remainLabel");
const speedButtons = document.getElementById("speedButtons");
const volumeSlider = document.getElementById("volumeSlider");

const authorInput = document.getElementById("authorInput");
const commentInput = document.getElementById("commentInput");
const addCommentBtn = document.getElementById("addCommentBtn");
const compareModeTab = document.getElementById("compareModeTab");
const singleModeTab = document.getElementById("singleModeTab");
const singleTargetRow = document.getElementById("singleTargetRow");
const singleTargetSelect = document.getElementById("singleTargetSelect");
const tagButtons = document.getElementById("tagButtons");
const tagSelect = document.getElementById("tagSelect");
const commentTimeModeButtons = document.getElementById("commentTimeModeButtons");
const commentTimeModeSelect = document.getElementById("commentTimeModeSelect");
const manualTimeField = document.getElementById("manualTimeField");
const manualTimeInput = document.getElementById("manualTimeInput");
const copyCurrentTimeBtn = document.getElementById("copyCurrentTimeBtn");
const commentTimeHint = document.getElementById("commentTimeHint");
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

const ENABLE_COMPARE_MODE = false;
const DEFAULT_SORT_TYPE = "timeline";
const DEFAULT_SORT_ORDER = "asc";
const COMMENT_TAGS = [
  { value: "none", label: "ー" },
  { value: "caption", label: "テロップ" },
  { value: "design", label: "デザイン" },
  { value: "audio", label: "音声" },
  { value: "video", label: "映像" },
  { value: "transition", label: "切り替わり" },
  { value: "other", label: "その他" }
];
const COMMENT_TIME_MODES = [
  {
    value: "auto",
    label: "自動（表示画面の時間）",
    shortLabel: "自動",
    buttonLabel: "現在時間",
    hint: "このまま追加すると表示中の時間で登録します。",
    actionLabel: "今"
  },
  {
    value: "manual",
    label: "手動入力",
    shortLabel: "固定",
    buttonLabel: "手動",
    hint: "必要なら時間を直接修正できます。",
    actionLabel: "今"
  },
  {
    value: "none",
    label: "無し",
    shortLabel: "無し",
    buttonLabel: "指定無し",
    hint: "時間を付けずにコメントを追加します。",
    actionLabel: "今"
  }
];

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
let playbackRateSetting = 1;
let volumeSetting = 1;
let composerManualTimeDraft = "";
let tagButtonsController = null;
let commentTimeModeButtonsController = null;

leftVideo.controls = false;
rightVideo.controls = false;
rightVideo.muted = true;

function applyVolumeSetting() {
  leftVideo.volume = volumeSetting;
  rightVideo.volume = volumeSetting;
}

function setMessage(text) {
  if (!statusMessage) return;
  statusMessage.textContent = text || "";
}

function getTagLabel(tagValue) {
  return COMMENT_TAGS.find((tag) => tag.value === tagValue)?.label || "ー";
}

function getTimeModeLabel(modeValue) {
  const mode = COMMENT_TIME_MODES.find((entry) => entry.value === modeValue);
  return mode?.shortLabel || mode?.label || "自動";
}

function getTimeModeButtonLabel(modeValue) {
  const mode = COMMENT_TIME_MODES.find((entry) => entry.value === modeValue);
  return mode?.buttonLabel || mode?.shortLabel || mode?.label || "現在時間";
}

function getTimeModeExportLabel(modeValue) {
  return COMMENT_TIME_MODES.find((mode) => mode.value === modeValue)?.label || "自動（表示画面の時間）";
}

function getTimeModeHint(modeValue) {
  return COMMENT_TIME_MODES.find((mode) => mode.value === modeValue)?.hint || "このまま追加すると表示中の時間で登録します。";
}

function getTimeModeActionLabel(modeValue) {
  return COMMENT_TIME_MODES.find((mode) => mode.value === modeValue)?.actionLabel || "現在を固定";
}

function normalizeCommentTag(tagValue) {
  return COMMENT_TAGS.some((tag) => tag.value === tagValue) ? tagValue : "none";
}

function normalizeCommentTimeMode(modeValue) {
  return COMMENT_TIME_MODES.some((mode) => mode.value === modeValue) ? modeValue : "auto";
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

function getSelectedSingleTarget() {
  return singleTargetSelect?.value === "right" ? "right" : "left";
}

function getSingleModeVideo() {
  return getSelectedSingleTarget() === "right" ? rightVideo : leftVideo;
}

function getReferenceVideo() {
  return viewMode === "single" ? getSingleModeVideo() : leftVideo;
}

function getInactiveSingleModeVideo() {
  return getSelectedSingleTarget() === "right" ? leftVideo : rightVideo;
}

function isTimedComment(comment) {
  return Number.isFinite(comment?.seconds);
}

function getCommentDisplayTime(comment) {
  return isTimedComment(comment) ? comment.timecode : "—";
}

function createChoiceButtonsController({
  container,
  options,
  initialValue,
  normalizeValue,
  getLabel,
  kind,
  onChange = null
}) {
  if (!container) return null;

  let currentValue = normalizeValue(initialValue);

  const sync = () => {
    const buttons = container.querySelectorAll(".choice-btn");
    buttons.forEach((button) => {
      const isActive = button.dataset.value === currentValue;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const setValue = (nextValue, { notify = true } = {}) => {
    currentValue = normalizeValue(nextValue);
    sync();
    if (notify && typeof controller.onChange === "function") {
      controller.onChange(currentValue);
    }
  };

  container.innerHTML = "";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn";
    button.dataset.value = option.value;
    if (kind === "tag") button.dataset.tag = option.value;
    if (kind === "timeMode") button.dataset.timeMode = option.value;
    button.textContent = getLabel(option);
    button.addEventListener("click", () => {
      setValue(option.value);
    });
    container.appendChild(button);
  });

  const controller = {
    element: container,
    onChange,
    getValue: () => currentValue,
    setValue
  };

  sync();
  return controller;
}

function getDisplayedTimelineTime() {
  return timeInput?.value || "00:00:00";
}

function updateManualTimeField() {
  if (!manualTimeField || !commentTimeModeSelect || !manualTimeInput) return;

  const modeValue = normalizeCommentTimeMode(commentTimeModeSelect.value);
  const wasDisabled = manualTimeInput.disabled;
  manualTimeField.dataset.mode = modeValue;
  manualTimeInput.dataset.mode = modeValue;

  if (modeValue === "manual") {
    const nextValue = composerManualTimeDraft.trim() || getDisplayedTimelineTime();
    manualTimeInput.disabled = false;
    manualTimeInput.readOnly = false;
    manualTimeInput.placeholder = "00:00:00";
    if (!manualTimeInput.value.trim() || wasDisabled) {
      manualTimeInput.value = nextValue;
    }
  } else if (modeValue === "auto") {
    manualTimeInput.disabled = true;
    manualTimeInput.readOnly = true;
    manualTimeInput.value = getDisplayedTimelineTime();
    manualTimeInput.placeholder = getDisplayedTimelineTime();
  } else {
    manualTimeInput.disabled = true;
    manualTimeInput.readOnly = true;
    manualTimeInput.value = "--:--:--";
    manualTimeInput.placeholder = "--:--:--";
  }

  if (copyCurrentTimeBtn) {
    copyCurrentTimeBtn.textContent = getTimeModeActionLabel(modeValue);
    copyCurrentTimeBtn.classList.toggle("is-hidden", modeValue !== "manual");
  }
  if (commentTimeHint) {
    commentTimeHint.textContent = getTimeModeHint(modeValue);
  }
}

function syncComposerCurrentTimePreview() {
  if (!manualTimeInput || normalizeCommentTimeMode(commentTimeModeSelect?.value) !== "auto") return;
  manualTimeInput.value = getDisplayedTimelineTime();
}

function setComposerTagValue(value) {
  const nextValue = normalizeCommentTag(value);
  if (tagSelect) tagSelect.value = nextValue;
  tagButtonsController?.setValue(nextValue, { notify: false });
}

function setComposerTimeMode(value) {
  const nextValue = normalizeCommentTimeMode(value);
  const previousValue = normalizeCommentTimeMode(commentTimeModeSelect?.value);
  if (previousValue === "manual" && manualTimeInput?.value.trim()) {
    composerManualTimeDraft = manualTimeInput.value.trim();
  }
  if (commentTimeModeSelect) commentTimeModeSelect.value = nextValue;
  commentTimeModeButtonsController?.setValue(nextValue, { notify: false });
  updateManualTimeField();
}

function applyCurrentTimeToComposer() {
  const currentTime = getDisplayedTimelineTime();
  composerManualTimeDraft = currentTime;
  setComposerTimeMode("manual");
  if (!manualTimeInput) return;
  manualTimeInput.value = currentTime;
  manualTimeInput.focus();
  manualTimeInput.setSelectionRange(manualTimeInput.value.length, manualTimeInput.value.length);
}

function applyModeFeatureFlags() {
  if (ENABLE_COMPARE_MODE) {
    if (compareModeTab) compareModeTab.classList.remove("is-hidden");
    if (viewModeTabs) viewModeTabs.classList.remove("single-only");
    return;
  }
  if (compareModeTab) compareModeTab.classList.add("is-hidden");
  if (viewModeTabs) viewModeTabs.classList.add("single-only");
}

function buildCommentTiming({ requestedMode, manualValue = "", existingComment = null, useCurrentTime = false }) {
  const timeMode = normalizeCommentTimeMode(requestedMode);

  if (timeMode === "none") {
    return { timeMode, seconds: null, timecode: "" };
  }

  if (timeMode === "manual") {
    const parsed = parseTimeInput(manualValue);
    if (parsed === null) return null;
    return {
      timeMode,
      seconds: parsed,
      timecode: formatTime(parsed)
    };
  }

  if (!useCurrentTime && existingComment && isTimedComment(existingComment)) {
    return {
      timeMode,
      seconds: existingComment.seconds,
      timecode: existingComment.timecode || formatTime(existingComment.seconds)
    };
  }

  const seconds = getReferenceVideo().currentTime || 0;
  return {
    timeMode,
    seconds,
    timecode: formatTime(seconds)
  };
}

function updateVideoSizing(videoEl) {
  if (!videoEl) return;
  const wrap = videoEl === leftVideo ? leftVideoWrap : rightVideoWrap;
  if (!wrap) return;

  wrap.dataset.videoReady = "true";
  delete wrap.dataset.videoOrientation;
}

function getDuration() {
  if (viewMode === "single") {
    const video = getSingleModeVideo();
    if (!video.duration || !Number.isFinite(video.duration)) return 0;
    return video.duration;
  }
  if (!leftVideo.duration || !rightVideo.duration) return 0;
  if (!Number.isFinite(leftVideo.duration) || !Number.isFinite(rightVideo.duration)) return 0;
  return Math.min(leftVideo.duration, rightVideo.duration);
}

function syncControlsState() {
  if (viewMode === "single") {
    const video = getSingleModeVideo();
    canControl = Boolean(video.src && getDuration() > 0);
  } else {
    canControl = Boolean(leftVideo.src && rightVideo.src && getDuration() > 0);
  }
  playPauseBtn.disabled = !canControl;
  tenSecondBackBtn.disabled = !canControl;
  secondBackBtn.disabled = !canControl;
  stepBackBtn.disabled = !canControl;
  stepForwardBtn.disabled = !canControl;
  secondForwardBtn.disabled = !canControl;
  tenSecondForwardBtn.disabled = !canControl;
  seekSlider.disabled = !canControl;
}

function updateStatusMessage() {
  if (canControl) {
    setMessage(
      viewMode === "compare"
        ? "2動画を読み込みました。同期再生できます。"
        : "動画を読み込みました。単体チェックできます。"
    );
    return;
  }

  if (viewMode === "compare") {
    const loadedCount = Number(Boolean(leftVideo.src)) + Number(Boolean(rightVideo.src));
    if (loadedCount === 0) {
      setMessage("左右の動画を選択してください。");
      return;
    }
    if (loadedCount === 1) {
      setMessage("もう片方の動画を選択してください。");
      return;
    }
    setMessage("2動画を読み込んでいます...");
    return;
  }

  const targetLabel = getSelectedSingleTarget() === "right" ? "右動画" : "左動画";
  if (getSingleModeVideo().src) {
    setMessage(`${targetLabel}を読み込んでいます...`);
    return;
  }
  setMessage(`${targetLabel}を選択すると単体チェックできます。`);
}

function setPlayingState(playing) {
  isPlaying = playing;
  playPauseBtn.textContent = playing ? "⏸" : "▶";
  playStatus.textContent = playing ? "再生中" : "停止中";
  playStatus.classList.toggle("playing", playing);
}

function updateTimelineUI() {
  const baseVideo = getReferenceVideo();
  const current = baseVideo.currentTime || 0;
  const duration = getDuration();

  if (!isScrubbing) {
    seekSlider.value = duration > 0 ? String(Math.min(current / duration, 1)) : "0";
  }

  timeInput.value = formatTime(current);
  durationLabel.textContent = `/ ${formatTime(duration)}`;
  const remain = Math.max(duration - current, 0);
  remainLabel.textContent = `-${formatTime(remain)}`;
  syncComposerCurrentTimePreview();
}

function renderSeekMarkers() {
  if (!seekMarkers) return;

  const duration = getDuration();
  seekMarkers.innerHTML = "";

  if (!Number.isFinite(duration) || duration <= 0 || comments.length === 0) return;

  const grouped = new Map();
  comments.forEach((comment) => {
    if (!Number.isFinite(comment.seconds)) return;
    if (comment.seconds < 0 || comment.seconds > duration) return;

    const ratio = comment.seconds / duration;
    const clampedRatio = Math.min(Math.max(ratio, 0.001), 0.999);
    const key = clampedRatio.toFixed(4);
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    grouped.set(key, {
      ratio: clampedRatio,
      count: 1,
      timecode: comment.timecode
    });
  });

  [...grouped.values()]
    .sort((a, b) => a.ratio - b.ratio)
    .forEach((markerInfo) => {
      const marker = document.createElement("span");
      marker.className = "seek-marker";
      marker.style.left = `${markerInfo.ratio * 100}%`;
      marker.style.setProperty("--marker-scale", String(Math.min(1.8, 1 + (markerInfo.count - 1) * 0.18)));
      if (markerInfo.count > 1) {
        marker.style.setProperty("--marker-width", "4px");
      }
      marker.title =
        markerInfo.count > 1
          ? `${markerInfo.timecode} に ${markerInfo.count} 件`
          : `${markerInfo.timecode} にコメント`;
      seekMarkers.appendChild(marker);
    });
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
  rightVideo.playbackRate = Math.abs(playbackRateSetting);

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
  if (!isPlaying || !canControl || viewMode !== "compare") {
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
    rightVideo.playbackRate = Math.abs(playbackRateSetting);
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
  if (!isPlaying || !canControl || viewMode !== "compare") return;
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
  leftVideo.playbackRate = 1;
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
  stopFrameLock();
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  const forwardRate = playbackRateSetting;
  if (viewMode === "single") {
    const video = getSingleModeVideo();
    const other = getInactiveSingleModeVideo();
    other.pause();
    video.playbackRate = forwardRate;
    Promise.allSettled([video.play()]).then(() => {
      setPlayingState(true);
      startTick();
    });
    return;
  }
  const t = leftVideo.currentTime;
  rightVideo.currentTime = t;
  leftVideo.playbackRate = forwardRate;
  rightVideo.playbackRate = forwardRate;

  Promise.allSettled([leftVideo.play(), rightVideo.play()]).then(() => {
    setPlayingState(true);
    startTick();
    startFrameLock();
  });
}

function seekBoth(seconds, resume = false, options = {}) {
  if (!canControl) return;
  const { preserveScrubbing = false } = options;

  if (!preserveScrubbing) {
    isScrubbing = false;
  }

  const duration = getDuration();
  const clamped = Math.min(Math.max(seconds, 0), duration);
  const token = ++seekToken;

  if (viewMode === "single") {
    getSingleModeVideo().currentTime = clamped;
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
  const next = getReferenceVideo().currentTime + frameDuration * dir;
  seekBoth(next, false);
}

function stepSecond(dir) {
  if (!canControl) return;
  pauseBoth();
  const base = getReferenceVideo().currentTime;
  seekBoth(base + dir, false);
}

function stepTenSeconds(dir) {
  if (!canControl) return;
  pauseBoth();
  const base = getReferenceVideo().currentTime;
  seekBoth(base + dir * 10, false);
}

function recalcFrameDuration() {
  // Browser APIs do not expose FPS reliably. Keep stable default.
  frameDuration = 1 / 30;
}

function onVideoLoaded(event) {
  const loadedVideo = event?.currentTarget instanceof HTMLVideoElement ? event.currentTarget : null;
  if (loadedVideo) updateVideoSizing(loadedVideo);
  recalcFrameDuration();
  syncControlsState();
  updateTimelineUI();
  renderSeekMarkers();
  updateStatusMessage();
  if (canControl) seekBoth(0, false);
}

async function loadSelectedVideoFile(file, videoEl, filenameEl, placeholderEl) {
  if (!file.name.toLowerCase().endsWith(".mp4")) {
    setMessage("MP4形式のみ対応しています。");
    return false;
  }

  const url = URL.createObjectURL(file);
  videoEl.src = url;
  filenameEl.textContent = file.name;
  placeholderEl.style.display = "none";
  pauseBoth();
  syncControlsState();
  updateTimelineUI();
  renderSeekMarkers();
  updateStatusMessage();
  return true;
}

async function handleFileSelection(fileInput, videoEl, filenameEl, placeholderEl) {
  const file = fileInput.files?.[0];
  if (!file) return;
  const ok = await loadSelectedVideoFile(file, videoEl, filenameEl, placeholderEl);
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
      const ok = await loadSelectedVideoFile(file, videoEl, filenameEl, placeholderEl);
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
  const timing = buildCommentTiming({
    requestedMode: commentTimeModeSelect?.value || "auto",
    manualValue: manualTimeInput?.value || "",
    useCurrentTime: true
  });
  if (!timing) {
    setMessage("手動時間の形式を確認してください。");
    return;
  }

  comments.unshift({
    id: crypto.randomUUID(),
    author,
    tag: normalizeCommentTag(tagSelect?.value),
    text,
    timeMode: timing.timeMode,
    seconds: timing.seconds,
    timecode: timing.timecode,
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
      const aTimed = isTimedComment(a);
      const bTimed = isTimedComment(b);
      if (aTimed && bTimed) {
        diff = a.seconds - b.seconds;
      } else if (aTimed) {
        diff = -1;
      } else if (bTimed) {
        diff = 1;
      } else {
        diff = a.updatedAt - b.updatedAt;
      }
    }
    return order === "asc" ? diff : -diff;
  });

  return copy;
}

function renderComments() {
  const rows = sortedComments();
  commentCount.textContent = `コメント: ${rows.length}`;
  renderSeekMarkers();

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
    time.textContent = getCommentDisplayTime(comment);

    const main = document.createElement("div");
    const author = document.createElement("div");
    author.className = "comment-author";
    author.textContent = comment.author;

    const metaRow = document.createElement("div");
    metaRow.className = "comment-meta-row";

    const tagBadge = document.createElement("span");
    tagBadge.className = "comment-tag";
    tagBadge.dataset.tag = normalizeCommentTag(comment.tag);
    tagBadge.textContent = getTagLabel(comment.tag);

    const timeModeBadge = document.createElement("span");
    timeModeBadge.className = "comment-time-mode";
    timeModeBadge.dataset.timeMode = normalizeCommentTimeMode(comment.timeMode);
    timeModeBadge.textContent = getTimeModeLabel(comment.timeMode);

    metaRow.append(tagBadge, timeModeBadge);

    const text = document.createElement("button");
    text.className = "comment-text btn";
    text.style.textAlign = "left";
    text.style.padding = "6px 8px";
    text.style.borderRadius = "8px";
    text.textContent = comment.text;
    if (isTimedComment(comment)) {
      text.title = "クリックでこの時刻に移動";
      text.addEventListener("click", () => {
        pauseBoth();
        seekBoth(comment.seconds, false);
      });
    } else {
      text.disabled = true;
      text.title = "時間指定なしのコメントです";
    }

    main.append(author, metaRow, text);

    const actions = document.createElement("div");
    actions.className = "comment-actions";

    const edit = document.createElement("button");
    edit.className = "btn";
    edit.textContent = "編集";
    edit.addEventListener("click", () => {
      const editor = document.createElement("div");
      editor.className = "inline-editor";

      const input = document.createElement("textarea");
      input.className = "inline-editor-input";
      input.value = comment.text;

      const editorGrid = document.createElement("div");
      editorGrid.className = "inline-editor-grid";

      const tagField = document.createElement("div");
      tagField.className = "field grow";
      const tagFieldLabel = document.createElement("label");
      tagFieldLabel.textContent = "タグ";
      const tagEditorButtons = document.createElement("div");
      tagEditorButtons.className = "choice-buttons";
      let selectedTag = normalizeCommentTag(comment.tag);
      createChoiceButtonsController({
        container: tagEditorButtons,
        options: COMMENT_TAGS,
        initialValue: selectedTag,
        normalizeValue: normalizeCommentTag,
        getLabel: (tagOption) => tagOption.label,
        kind: "tag",
        onChange: (nextValue) => {
          selectedTag = nextValue;
        }
      });
      tagField.append(tagFieldLabel, tagEditorButtons);

      const timeModeField = document.createElement("div");
      timeModeField.className = "field grow";
      const timeModeFieldLabel = document.createElement("label");
      timeModeFieldLabel.textContent = "コメント時間";
      const inlineTimePanel = document.createElement("div");
      inlineTimePanel.className = "time-setting-panel";
      const timeModeEditorButtons = document.createElement("div");
      timeModeEditorButtons.className = "choice-buttons compact segment-switch";
      const manualField = document.createElement("div");
      manualField.className = "time-entry-row";
      const manualEditorInput = document.createElement("input");
      manualEditorInput.type = "text";
      manualEditorInput.value = isTimedComment(comment) ? comment.timecode : "";
      manualEditorInput.placeholder = "00:00:00";
      const applyCurrentInlineTimeBtn = document.createElement("button");
      applyCurrentInlineTimeBtn.type = "button";
      applyCurrentInlineTimeBtn.className = "btn time-fill-btn";
      const timeModeHint = document.createElement("p");
      timeModeHint.className = "field-note";
      const originalTimeMode = normalizeCommentTimeMode(comment.timeMode);
      let selectedTimeMode = originalTimeMode;
      let inlineAutoPreview = originalTimeMode === "auto" && isTimedComment(comment)
        ? comment.timecode
        : getDisplayedTimelineTime();
      let inlineManualDraft = isTimedComment(comment) ? comment.timecode : "";

      const syncInlineTimeField = () => {
        const preserveExistingAutoTime =
          selectedTimeMode === "auto" && originalTimeMode === "auto" && isTimedComment(comment);
        const wasManual = !manualEditorInput.disabled;

        if (selectedTimeMode === "manual") {
          manualField.dataset.mode = "manual";
          manualEditorInput.dataset.mode = "manual";
          manualEditorInput.disabled = false;
          manualEditorInput.readOnly = false;
          manualEditorInput.placeholder = "00:00:00";
          if (!manualEditorInput.value.trim() || !wasManual) {
            manualEditorInput.value = inlineManualDraft.trim() || getDisplayedTimelineTime();
          }
        } else if (selectedTimeMode === "auto") {
          if (wasManual && manualEditorInput.value.trim()) {
            inlineManualDraft = manualEditorInput.value.trim();
          }
          manualField.dataset.mode = "auto";
          manualEditorInput.dataset.mode = "auto";
          manualEditorInput.disabled = true;
          manualEditorInput.readOnly = true;
          manualEditorInput.value = preserveExistingAutoTime ? comment.timecode : inlineAutoPreview;
          manualEditorInput.placeholder = manualEditorInput.value || getDisplayedTimelineTime();
        } else {
          if (wasManual && manualEditorInput.value.trim()) {
            inlineManualDraft = manualEditorInput.value.trim();
          }
          manualField.dataset.mode = "none";
          manualEditorInput.dataset.mode = "none";
          manualEditorInput.disabled = true;
          manualEditorInput.readOnly = true;
          manualEditorInput.value = "";
          manualEditorInput.placeholder = "時間なし";
        }

        applyCurrentInlineTimeBtn.textContent = getTimeModeActionLabel(selectedTimeMode);
        timeModeHint.textContent = preserveExistingAutoTime
          ? "保存すると現在のコメント時間を維持します。"
          : getTimeModeHint(selectedTimeMode);
      };

      const timeModeController = createChoiceButtonsController({
        container: timeModeEditorButtons,
        options: COMMENT_TIME_MODES,
        initialValue: selectedTimeMode,
        normalizeValue: normalizeCommentTimeMode,
        getLabel: (timeModeOption) => getTimeModeButtonLabel(timeModeOption.value),
        kind: "timeMode",
        onChange: (nextValue) => {
          if (selectedTimeMode === "manual" && manualEditorInput.value.trim()) {
            inlineManualDraft = manualEditorInput.value.trim();
          }
          if (nextValue === "auto" && selectedTimeMode !== "auto") {
            inlineAutoPreview = getDisplayedTimelineTime();
          }
          selectedTimeMode = nextValue;
          syncInlineTimeField();
        }
      });

      manualEditorInput.addEventListener("input", () => {
        inlineManualDraft = manualEditorInput.value;
      });
      applyCurrentInlineTimeBtn.addEventListener("click", () => {
        const currentTime = getDisplayedTimelineTime();
        inlineAutoPreview = currentTime;
        inlineManualDraft = currentTime;
        timeModeController?.setValue("manual");
        manualEditorInput.value = currentTime;
        manualEditorInput.focus();
        manualEditorInput.setSelectionRange(manualEditorInput.value.length, manualEditorInput.value.length);
      });

      manualField.append(manualEditorInput, applyCurrentInlineTimeBtn);
      inlineTimePanel.append(timeModeEditorButtons, manualField, timeModeHint);
      timeModeField.append(timeModeFieldLabel, inlineTimePanel);
      syncInlineTimeField();

      editorGrid.append(tagField, timeModeField);

      const row = document.createElement("div");
      row.className = "inline-editor-actions";

      const save = document.createElement("button");
      save.className = "btn btn-primary";
      save.textContent = "保存";
      const saveInlineEdit = () => {
        const trimmed = input.value.trim();
        if (!trimmed) return;
        const requestedTimeMode = selectedTimeMode;
        const nextTiming = buildCommentTiming({
          requestedMode: requestedTimeMode,
          manualValue: manualEditorInput.value,
          existingComment: comment,
          useCurrentTime: normalizeCommentTimeMode(requestedTimeMode) !== normalizeCommentTimeMode(comment.timeMode)
        });
        if (!nextTiming) {
          setMessage("手動時間の形式を確認してください。");
          return;
        }
        comment.tag = normalizeCommentTag(selectedTag);
        comment.text = trimmed;
        comment.timeMode = nextTiming.timeMode;
        comment.seconds = nextTiming.seconds;
        comment.timecode = nextTiming.timecode;
        comment.updatedAt = Date.now();
        renderComments();
      };
      save.addEventListener("click", saveInlineEdit);

      const cancel = document.createElement("button");
      cancel.className = "btn";
      cancel.textContent = "キャンセル";
      cancel.addEventListener("click", () => {
        renderComments();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          saveInlineEdit();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          renderComments();
        }
      });

      row.append(save, cancel);
      editor.append(input, editorGrid, row);
      main.replaceChild(editor, text);
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
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
  if (!ENABLE_COMPARE_MODE) {
    viewMode = "single";
  } else {
    viewMode = nextMode === "single" ? "single" : "compare";
  }
  const singleTarget = getSelectedSingleTarget();

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

  applyVolumeSetting();
  pauseBoth();
  syncControlsState();
  updateTimelineUI();
  renderSeekMarkers();
  updateStatusMessage();
}

function setPlaybackRateSetting(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;
  playbackRateSetting = Math.max(0.25, Math.min(5, parsed));
  if (speedButtons) {
    const buttons = speedButtons.querySelectorAll(".speed-btn");
    buttons.forEach((btn) => {
      const rate = Number(btn.getAttribute("data-speed"));
      btn.classList.toggle("active", Math.abs(rate - playbackRateSetting) < 0.0001);
    });
  }
}

function getAvailablePlaybackRates() {
  if (!speedButtons) return [playbackRateSetting];
  return [...speedButtons.querySelectorAll(".speed-btn")]
    .map((btn) => Number(btn.getAttribute("data-speed")))
    .filter((rate) => Number.isFinite(rate))
    .sort((a, b) => a - b);
}

function stepPlaybackRate(direction) {
  const rates = getAvailablePlaybackRates();
  if (rates.length === 0) return;

  const currentIndex = rates.findIndex((rate) => Math.abs(rate - playbackRateSetting) < 0.0001);
  const safeIndex = currentIndex === -1 ? rates.indexOf(1) : currentIndex;
  const nextIndex = Math.min(Math.max(safeIndex + direction, 0), rates.length - 1);
  if (nextIndex === safeIndex) return;

  setPlaybackRateSetting(rates[nextIndex]);
  if (isPlaying) {
    pauseBoth();
    playBoth();
  }
}

function toCsvField(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

const EXPORT_FIELDS = [
  { key: "timecode", label: "動画時間", value: (row) => row.timecode },
  { key: "seconds", label: "秒", value: (row) => (isTimedComment(row) ? row.seconds.toFixed(3) : "") },
  { key: "tag", label: "タグ", value: (row) => getTagLabel(row.tag) },
  { key: "author", label: "記入者", value: (row) => row.author },
  { key: "text", label: "コメント", value: (row) => row.text },
  { key: "timeMode", label: "コメント時間設定", value: (row) => getTimeModeExportLabel(row.timeMode) },
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
  a.download = `switchman-comments-${stamp}.${ext}`;
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
      suggestedName: `switchman-comments.${ext}`,
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
    tag: byLabel("タグ"),
    author: byLabel("記入者"),
    text: byLabel("コメント"),
    timeMode: byLabel("コメント時間設定"),
    updatedAt: byLabel("更新日時")
  };

  return table.slice(1).map((cols, rowIndex) => {
    const secondsRaw = idx.seconds >= 0 ? Number(cols[idx.seconds]) : NaN;
    const timecodeRaw = idx.timecode >= 0 ? cols[idx.timecode] : "";
    const parsedByTimecode = parseTimeInput(timecodeRaw);
    const inferredSeconds = Number.isFinite(secondsRaw)
      ? secondsRaw
      : Number.isFinite(parsedByTimecode)
        ? parsedByTimecode
        : null;
    const rawTag = idx.tag >= 0 ? cols[idx.tag] : "";
    const tag = COMMENT_TAGS.find((entry) => entry.label === rawTag)?.value || normalizeCommentTag(rawTag);
    const rawTimeMode = idx.timeMode >= 0 ? cols[idx.timeMode] : "";
    const inferredTimeMode = COMMENT_TIME_MODES.find((entry) => entry.label === rawTimeMode || entry.shortLabel === rawTimeMode)?.value
      || normalizeCommentTimeMode(rawTimeMode || (Number.isFinite(inferredSeconds) ? "auto" : "none"));
    const updatedRaw = idx.updatedAt >= 0 ? Date.parse(cols[idx.updatedAt]) : NaN;
    return {
      id: crypto.randomUUID(),
      author: idx.author >= 0 ? (cols[idx.author] || "未入力") : "未入力",
      tag,
      text: idx.text >= 0 ? (cols[idx.text] || "") : "",
      timeMode: inferredTimeMode,
      seconds: inferredTimeMode === "none" ? null : inferredSeconds,
      timecode: inferredTimeMode === "none"
        ? ""
        : Number.isFinite(parsedByTimecode)
          ? formatTime(parsedByTimecode)
          : Number.isFinite(inferredSeconds)
            ? formatTime(inferredSeconds)
            : "",
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
    const inferredSeconds = Number.isFinite(secondsRaw)
      ? secondsRaw
      : Number.isFinite(parsedByTimecode)
        ? parsedByTimecode
        : null;
    const rawTag = map["タグ"] || "";
    const tag = COMMENT_TAGS.find((entry) => entry.label === rawTag)?.value || normalizeCommentTag(rawTag);
    const rawTimeMode = map["コメント時間設定"] || "";
    const inferredTimeMode = COMMENT_TIME_MODES.find((entry) => entry.label === rawTimeMode || entry.shortLabel === rawTimeMode)?.value
      || normalizeCommentTimeMode(rawTimeMode || (Number.isFinite(inferredSeconds) ? "auto" : "none"));
    const updatedRaw = Date.parse(map["更新日時"] || "");
    return {
      id: crypto.randomUUID(),
      author: map["記入者"] || "未入力",
      tag,
      text: map["コメント"] || "",
      timeMode: inferredTimeMode,
      seconds: inferredTimeMode === "none" ? null : inferredSeconds,
      timecode: inferredTimeMode === "none"
        ? ""
        : Number.isFinite(parsedByTimecode)
          ? formatTime(parsedByTimecode)
          : Number.isFinite(inferredSeconds)
            ? formatTime(inferredSeconds)
            : "",
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

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
}

function handleGlobalShortcut(event) {
  if (exportOverlay && !exportOverlay.classList.contains("hidden")) return;
  if (isEditableTarget(event.target)) return;
  if (event.altKey || event.metaKey) return;

  if (event.ctrlKey && event.key === "ArrowLeft") {
    if (!canControl) return;
    event.preventDefault();
    stepTenSeconds(-1);
    return;
  }

  if (event.ctrlKey && event.key === "ArrowRight") {
    if (!canControl) return;
    event.preventDefault();
    stepTenSeconds(1);
    return;
  }

  if (event.ctrlKey) return;

  if (event.key === " ") {
    if (!canControl) return;
    if (event.repeat) return;
    event.preventDefault();
    if (isPlaying) pauseBoth();
    else playBoth();
    return;
  }

  if (event.key === "ArrowLeft") {
    if (!canControl) return;
    event.preventDefault();
    if (event.shiftKey) stepSecond(-1);
    else stepFrame(-1);
    return;
  }

  if (event.key === "ArrowRight") {
    if (!canControl) return;
    event.preventDefault();
    if (event.shiftKey) stepSecond(1);
    else stepFrame(1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    stepPlaybackRate(1);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    stepPlaybackRate(-1);
  }
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
tenSecondBackBtn.addEventListener("click", () => stepTenSeconds(-1));
secondBackBtn.addEventListener("click", () => stepSecond(-1));
secondForwardBtn.addEventListener("click", () => stepSecond(1));
tenSecondForwardBtn.addEventListener("click", () => stepTenSeconds(1));

seekSlider.addEventListener("input", () => {
  if (!canControl) return;
  isScrubbing = true;
  pauseBoth();
  const duration = getDuration();
  const target = Number(seekSlider.value) * duration;
  timeInput.value = formatTime(target);
  seekBoth(target, false, { preserveScrubbing: true });
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
  const syncSingleTargetMode = () => {
    setViewMode("single");
    requestAnimationFrame(() => {
      updateStatusMessage();
      updateTimelineUI();
    });
  };
  singleTargetSelect.addEventListener("change", syncSingleTargetMode);
  singleTargetSelect.addEventListener("input", syncSingleTargetMode);
}
if (manualTimeInput) {
  manualTimeInput.addEventListener("input", () => {
    composerManualTimeDraft = manualTimeInput.value;
  });
}
if (copyCurrentTimeBtn) {
  copyCurrentTimeBtn.addEventListener("click", applyCurrentTimeToComposer);
}
if (speedButtons) {
  speedButtons.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest(".speed-btn");
    if (!btn) return;
    const value = btn.getAttribute("data-speed");
    if (!value) return;
    setPlaybackRateSetting(value);
    if (isPlaying) {
      pauseBoth();
      playBoth();
    }
  });
}
if (volumeSlider) {
  volumeSlider.addEventListener("input", () => {
    const parsed = Number(volumeSlider.value);
    if (!Number.isFinite(parsed)) return;
    volumeSetting = Math.max(0, Math.min(1, parsed));
    applyVolumeSetting();
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
window.addEventListener("keydown", handleGlobalShortcut);
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

tagButtonsController = createChoiceButtonsController({
  container: tagButtons,
  options: COMMENT_TAGS,
  initialValue: tagSelect?.value || "none",
  normalizeValue: normalizeCommentTag,
  getLabel: (tagOption) => tagOption.label,
  kind: "tag",
  onChange: (nextValue) => {
    if (tagSelect) tagSelect.value = nextValue;
  }
});
commentTimeModeButtonsController = createChoiceButtonsController({
  container: commentTimeModeButtons,
  options: COMMENT_TIME_MODES,
  initialValue: commentTimeModeSelect?.value || "auto",
  normalizeValue: normalizeCommentTimeMode,
  getLabel: (timeModeOption) => getTimeModeButtonLabel(timeModeOption.value),
  kind: "timeMode",
  onChange: (nextValue) => {
    if (commentTimeModeSelect) commentTimeModeSelect.value = nextValue;
    updateManualTimeField();
  }
});

applyModeFeatureFlags();
if (sortType) sortType.value = DEFAULT_SORT_TYPE;
if (sortOrder) sortOrder.value = DEFAULT_SORT_ORDER;
setComposerTagValue(tagSelect?.value || "none");
setComposerTimeMode(commentTimeModeSelect?.value || "auto");
syncControlsState();
renderComments();
updateTimelineUI();
updateExportLocationUI();
applyVolumeSetting();
setViewMode("single");
setPlaybackRateSetting(1);
