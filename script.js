// --- Drag and Drop State & Logic ---
let dragItem = null;
let isDragging = false;
let dragStartPos = { x: 0, y: 0 }; // Store initial pointer position
let offsetX = 0;
let offsetY = 0;
const DRAG_THRESHOLD = 5; // Pixels to move before a drag starts
let zIndexCounter = 10;
// --- Resizing Logic ---
let resizeItem = null;
let initialWidth, initialHeight;
let initialMouseX, initialMouseY;
let minWidth, minHeight;
const taskbarTabsContainer = document.getElementById('taskbar-tabs');
const desktopContainer = document.getElementById('main-desktop');
let activeWindowId = null;
const maximizedWindows = new Map();

// --- Path Configuration ---
const isGithubPages = window.location.hostname.includes('github.io');
const pathSegments = window.location.pathname.split('/').filter(Boolean);
const repoBasePath = pathSegments.length ? '/' + pathSegments[0] + '/' : '/';
const basePath = isGithubPages ? repoBasePath : '';

function resolveMediaPath(fileName) {
  return `${basePath}media/${fileName}`;
}

/**
 * Starts the drag operation for a desktop icon.
 */
function onIconDragStart(e, item) {
  e.preventDefault();

  dragItem = item;
  isDragging = false;

  const pointer = getPointerCoords(e);

  dragStartPos.x = pointer.x;
  dragStartPos.y = pointer.y;

  const rect = dragItem.getBoundingClientRect();
  offsetX = pointer.x - rect.left;
  offsetY = pointer.y - rect.top;

  document.addEventListener('mousemove', onIconDragMove);
  document.addEventListener('mouseup', onIconDragEnd);
  document.addEventListener('touchmove', onIconDragMove, { passive: false });
  document.addEventListener('touchend', onIconDragEnd);
}

/**
 * Handles the movement of a dragged icon.
 */
function onIconDragMove(e) {
  if (dragItem === null) return;
  e.preventDefault();

  const pointer = getPointerCoords(e);

  if (!isDragging) {
    const dx = pointer.x - dragStartPos.x;
    const dy = pointer.y - dragStartPos.y;
    if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
      isDragging = true;
      dragItem.classList.add('dragging');
    }
  }

  if (isDragging) {
    let newLeft = pointer.x - offsetX;
    let newTop = pointer.y - offsetY;

    const maxLeft = window.innerWidth - dragItem.offsetWidth;
    const taskbarHeight = document.getElementById('taskbar').offsetHeight;
    const maxTop = window.innerHeight - dragItem.offsetHeight - taskbarHeight;
    newTop = Math.max(0, Math.min(newTop, maxTop));

    dragItem.style.left = `${newLeft}px`;
    dragItem.style.top = `${newTop}px`;
  }
}

/**
 * Ends the icon drag operation.
 */
function onIconDragEnd() {
  if (dragItem) dragItem.classList.remove('dragging');

  if (!isDragging && dragItem) {
    handleIconClick(dragItem);
  }

  isDragging = false;
  dragItem = null;

  document.removeEventListener('mousemove', onIconDragMove);
  document.removeEventListener('mouseup', onIconDragEnd);
  document.removeEventListener('touchmove', onIconDragMove);
  document.removeEventListener('touchend', onIconDragEnd);
}

// --- Window Dragging Logic ---
function onWindowDragMove(e) {
  if (!dragItem || dragItem.classList.contains('maximized')) return;
  if (e.type === 'touchmove') e.preventDefault();

  isDragging = true;

  const coords = getPointerCoords(e);
  const taskbarHeight = document.getElementById('taskbar').offsetHeight;

  let newX = coords.x - offsetX;
  let newY = coords.y - offsetY;

  newX = Math.max(0, Math.min(newX, window.innerWidth - dragItem.offsetWidth));
  newY = Math.max(0, Math.min(newY, window.innerHeight - dragItem.offsetHeight - taskbarHeight));

  dragItem.style.left = newX + 'px';
  dragItem.style.top = newY + 'px';
}

function onWindowDragEnd() {
  document.body.style.userSelect = '';
  dragItem = null;
  isDragging = false;
  document.removeEventListener('mousemove', onWindowDragMove);
  document.removeEventListener('mouseup', onWindowDragEnd);
  document.removeEventListener('touchmove', onWindowDragMove);
  document.removeEventListener('touchend', onWindowDragEnd);
}

// --- Grid Configuration ---
const ICON_GRID_CONFIG = {
  x: 20,
  y: 20,
  w: 90,
  h: 90
};

// Helper to get coordinates from either mouse or touch event
function getPointerCoords(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function makeDraggable(element, handle) {
  const onWindowDragStart = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (e.target.closest('.window-controls')) return;

    dragItem = element;
    isDragging = false;

    const coords = getPointerCoords(e);
    const rect = dragItem.getBoundingClientRect();

    offsetX = coords.x - rect.left;
    offsetY = coords.y - rect.top;

    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onWindowDragMove);
    document.addEventListener('touchmove', onWindowDragMove, { passive: false });
    document.addEventListener('mouseup', onWindowDragEnd);
    document.addEventListener('touchend', onWindowDragEnd);
  };

  (handle || element).addEventListener('mousedown', onWindowDragStart);
  (handle || element).addEventListener('touchstart', onWindowDragStart, { passive: false });
}

// Make windows draggable and resizable
document.querySelectorAll('.window').forEach(win => {
  const focusHandler = () => focusWindow(win.id);
  win.addEventListener('mousedown', focusHandler);
  win.addEventListener('touchstart', focusHandler);

  win.addEventListener('click', (e) => {
    const windowId = win.id;
    if (e.target.classList.contains('close-btn')) {
      closeWindow(windowId);
    } else if (e.target.classList.contains('minimize-btn')) {
      minimizeWindow(windowId);
    } else if (e.target.classList.contains('maximize-btn')) {
      maximizeWindow(windowId);
    }
  });
  makeDraggable(win, win.querySelector('.title-bar'));
  makeResizable(win);
});

// --- Icon Click/Double-click Logic ---
let clickTimer = null;
let lastClickedIcon = null;

function handleIconClick(icon) {
  const windowId = icon.dataset.windowId;
  if (!windowId) return;

  if (clickTimer && lastClickedIcon === icon) {
    clearTimeout(clickTimer);
    clickTimer = null;
    lastClickedIcon = null;
    openWindow(windowId);
  } else {
    clearTimeout(clickTimer);
    lastClickedIcon = icon;
    clickTimer = setTimeout(() => {
      clickTimer = null;
      lastClickedIcon = null;
    }, 300);
  }
}

document.querySelectorAll('.desktop-icon').forEach(icon => {
  icon.addEventListener('mousedown', (e) => onIconDragStart(e, icon));
  icon.addEventListener('touchstart', (e) => onIconDragStart(e, icon), { passive: false });
});

/**
 * Calculates the initial position and size for a new window
 */
function setInitialWindowPosition(win) {
  const icons = document.querySelectorAll('.desktop-icon');
  const taskbarHeight = document.getElementById('taskbar').offsetHeight;
  const margin = 20;
  let rightmostIcon = 0;

  icons.forEach(icon => {
    const iconRight = icon.offsetLeft + icon.offsetWidth;
    if (iconRight > rightmostIcon) {
      rightmostIcon = iconRight;
    }
  });

  const startX = rightmostIcon + margin;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const initialWidth = parseInt(win.style.width, 10) || win.offsetWidth;
  const windowWidth = Math.min(initialWidth, viewportWidth - startX - margin);
  const windowHeight = win.offsetHeight;

  const availableRandomWidth = viewportWidth - startX - windowWidth - margin;
  const availableRandomHeight = viewportHeight - taskbarHeight - windowHeight - margin;

  const randomX = startX + Math.random() * Math.max(0, availableRandomWidth);
  const randomY = margin + Math.random() * Math.max(0, availableRandomHeight);

  win.style.width = `${windowWidth}px`;
  win.style.left = `${Math.max(startX, randomX)}px`;
  win.style.top = `${Math.max(margin, randomY)}px`;
}

function openWindow(id) {
  const win = document.getElementById(id);
  let tab = taskbarTabsContainer.querySelector(`[data-window-id="${id}"]`);

  if (tab) {
    focusWindow(id);
    return;
  }

  tab = document.createElement('div');
  tab.className = 'taskbar-tab';
  tab.dataset.windowId = id;

  const iconEl = document.querySelector(`.desktop-icon[data-window-id="${id}"] img`) 
              || document.querySelector(`.start-menu-items li[data-window-id="${id}"] img`);
  const title = win.querySelector('.title-bar span').textContent;

  let tabIconHtml = '';
  if (iconEl && iconEl.src) {
    tabIconHtml = `<img src="${iconEl.src}" />`;
  }
  tab.innerHTML = `${tabIconHtml} <span>${title}</span>`;
  tab.onclick = () => focusWindow(id, true);
  taskbarTabsContainer.appendChild(tab);

  if (win.style.display !== 'flex') {
    setInitialWindowPosition(win);
  }

  if (id === 'explorerWindow') {
    populateExplorer();
  }

  win.style.display = 'flex';
  focusWindow(id);
}

function focusWindow(id, isFromTaskbar = false) {
  const win = document.getElementById(id);
  const tab = taskbarTabsContainer.querySelector(`[data-window-id="${id}"]`);

  if (isFromTaskbar && id === activeWindowId && win.style.display !== 'none') {
    minimizeWindow(id);
    return;
  }

  document.querySelectorAll('.taskbar-tab').forEach(t => t.classList.remove('active'));
  if (tab) tab.classList.add('active');

  if (win.style.display === 'none') {
    win.style.display = 'flex';
  }

  win.style.zIndex = ++zIndexCounter;
  activeWindowId = id;

  const margin = 5;
  const taskbarHeight = document.getElementById('taskbar').offsetHeight;
  const winRect = win.getBoundingClientRect();
  let top = win.offsetTop;
  let left = win.offsetLeft;

  const maxTop = window.innerHeight - winRect.height - taskbarHeight - margin;
  if (top > maxTop) {
    win.style.top = `${Math.max(0, maxTop)}px`;
  }

  const maxLeft = window.innerWidth - winRect.width - margin;
  if (left > maxLeft) {
    win.style.left = `${Math.max(0, maxLeft)}px`;
  }
}

function closeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  restoreMaximizedWindow(win, id);
  win.style.display = 'none';
  const tab = taskbarTabsContainer.querySelector(`[data-window-id="${id}"]`);
  if (tab) tab.remove();

  if (activeWindowId === id) {
    activeWindowId = null;
    const openTabs = taskbarTabsContainer.querySelectorAll('.taskbar-tab');
    if (openTabs.length > 0) {
      const nextWindowId = openTabs[openTabs.length - 1].dataset.windowId;
      focusWindow(nextWindowId);
    }
  }
}

function minimizeWindow(id) {
  document.getElementById(id).style.display = 'none';
  const tab = taskbarTabsContainer.querySelector(`[data-window-id="${id}"]`);
  if (tab) tab.classList.remove('active');
  if (activeWindowId === id) activeWindowId = null;
}

function restoreMaximizedWindow(win, id) {
  if (!win) return;

  const state = maximizedWindows.get(id);
  if (win.classList.contains('maximized')) {
    win.classList.remove('maximized');
  }

  if (state) {
    win.style.left = state.left;
    win.style.top = state.top;
    win.style.width = state.width;
    win.style.height = state.height;
    maximizedWindows.delete(id);
  }
}

function maximizeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;

  if (win.classList.contains('maximized')) {
    restoreMaximizedWindow(win, id);
    focusWindow(id);
    return;
  }

  const computed = window.getComputedStyle(win);
  const rect = win.getBoundingClientRect();

  const storedState = {
    left: win.style.left || (computed.left !== 'auto' ? computed.left : `${rect.left}px`),
    top: win.style.top || (computed.top !== 'auto' ? computed.top : `${rect.top}px`),
    width: win.style.width || (computed.width !== 'auto' ? computed.width : `${rect.width}px`),
    height: win.style.height || (computed.height !== 'auto' ? computed.height : `${rect.height}px`)
  };

  maximizedWindows.set(id, storedState);

  const taskbar = document.getElementById('taskbar');
  const taskbarHeight = taskbar ? taskbar.offsetHeight : 0;

  win.classList.add('maximized');
  win.style.left = '0px';
  win.style.top = '0px';
  win.style.width = '100vw';
  win.style.height = `calc(100vh - ${taskbarHeight}px)`;

  focusWindow(id);
}


// Clock
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// --- Initial Icon Layout ---
function layoutIcons() {
  const icons = document.querySelectorAll('.desktop-icon');
  const iconGrid = { x: 20, y: 20, w: 90, h: 90 };
  let col = 0;
  let row = 0;
  const taskbarHeight = 30;
  const viewHeight = window.innerHeight;

  icons.forEach((icon) => {
    const topPos = iconGrid.y + row * iconGrid.h;
    if (topPos + iconGrid.h > viewHeight - taskbarHeight) {
      col++;
      row = 0;
    }
    icon.style.left = `${iconGrid.x + col * iconGrid.w}px`;
    icon.style.top = `${iconGrid.y + row * iconGrid.h}px`;
    row++;
  });
}

// --- Start Menu Logic ---
const startBtn = document.getElementById('start');
const startMenu = document.getElementById('startMenu');

startBtn.addEventListener('click', e => {
  e.stopPropagation();
  startMenu.style.display = startMenu.style.display === 'block' ? 'none' : 'block';
  startBtn.classList.toggle('active');
});

document.addEventListener('click', e => {
  if (startMenu.style.display === 'block' && !startMenu.contains(e.target) && e.target !== startBtn) {
    startMenu.style.display = 'none';
    startBtn.classList.remove('active');
  }
});

// --- Global Key Listener ---
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (activeWindowId) {
      closeWindow(activeWindowId);
    }
  } else if (e.metaKey && e.key.toLowerCase() === 'r') {
    e.preventDefault();
    e.stopPropagation();
    openWindow('runDialogWindow');
    document.getElementById('runInput').focus();
  }
});

startMenu.addEventListener('click', e => {
  const targetLi = e.target.closest('li');
  if (!targetLi || targetLi.classList.contains('has-submenu')) return;

  const windowId = targetLi.dataset.windowId;
  if (windowId) {
    openWindow(windowId);
    startMenu.style.display = 'none';
    startBtn.classList.remove('active');
  } else if (targetLi.id === 'shutdownBtn') {
    shutdown();
  }
});

// --- Context Menu Logic ---
const contextMenu = document.getElementById('contextMenu');

desktopContainer.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (e.target === desktopContainer) {
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.display = 'block';
  } else {
    contextMenu.style.display = 'none';
  }
});

document.addEventListener('click', e => {
  if (e.button === 0) {
    contextMenu.style.display = 'none';
  }
});

contextMenu.addEventListener('click', e => {
  const action = e.target.dataset.action;
  if (action === 'refresh') layoutIcons();
  if (action === 'properties') openWindow('displayPropertiesWindow');
});

// --- Window Resizing Functions ---
function makeResizable(element) {
  const handle = element.querySelector('.resize-handle');
  if (!handle) return;

  const startResize = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    resizeItem = element;
    const computedStyle = window.getComputedStyle(element);
    minWidth = parseInt(computedStyle.minWidth, 10) || 150;
    minHeight = parseInt(computedStyle.minHeight, 10) || 150;
    initialWidth = resizeItem.offsetWidth;
    initialHeight = resizeItem.offsetHeight;
    const coords = getPointerCoords(e);
    initialMouseX = coords.x;
    initialMouseY = coords.y;

    document.addEventListener('mousemove', resizeWindow);
    document.addEventListener('touchmove', resizeWindow, { passive: false });
    document.addEventListener('mouseup', stopResize, { once: true });
    document.addEventListener('touchend', stopResize, { once: true });
  };

  handle.addEventListener('mousedown', startResize);
  handle.addEventListener('touchstart', startResize, { passive: false });
}

function resizeWindow(e) {
  if (!resizeItem) return;
  if (e.type === 'touchmove') e.preventDefault();
  const coords = getPointerCoords(e);
  const dx = coords.x - initialMouseX;
  const dy = coords.y - initialMouseY;
  const newWidth = Math.max(minWidth, initialWidth + dx);
  const newHeight = Math.max(minHeight, initialHeight + dy);
  resizeItem.style.width = newWidth + 'px';
  resizeItem.style.height = newHeight + 'px';

  if (resizeItem.id === 'mediaPlayer') {
    const canvas = resizeItem.querySelector('#visualizer');
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
}

function stopResize() {
  resizeItem = null;
  document.removeEventListener('mousemove', resizeWindow);
  document.removeEventListener('touchmove', resizeWindow);
}

// --- Media Player Logic ---
let audioCtx, analyser, sourceNode, bufferLength, dataArray, animationId;
let currentSongIndex = null;
let isCustomTrack = false;
let customSongUrl = null;

const fileInput = document.getElementById('audioFile');
const browseAudioBtn = document.getElementById('browseAudioBtn');

const audioElement = document.getElementById('media-player-audio');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');

const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const volumeControl = document.getElementById('volumeControl');
const visualizerSelect = document.getElementById('visualizerSelect');
const nowPlaying = document.getElementById('nowPlaying');
const seekBar = document.getElementById('seekBar');
const playlistDropdown = document.getElementById('playlistDropdown');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

function setPlaybackControlsEnabled(enabled) {
  [playBtn, pauseBtn, stopBtn].forEach(btn => {
    if (btn) {
      btn.disabled = !enabled;
    }
  });
}

function setPlaylistNavigationEnabled(enabled) {
  [prevBtn, nextBtn].forEach(btn => {
    if (btn) {
      btn.disabled = !enabled;
    }
  });
}

function resetSeekBar() {
  if (!seekBar) return;
  seekBar.value = 0;
  seekBar.disabled = true;
}

// --- Playlist Configuration (✅ FIXED PATHS) ---
const playlist = [
  {
    name: 'Love Lies in Ruin (Acoustic) – Zwan',
    path: resolveMediaPath('Zwan_Love_Lies_in_Ruin_acoustic_2003.mp3')
  },
  {
    name: 'Praise You – Fatboy Slim',
    path: resolveMediaPath('Praise_You_Fatboy_Slim.mp3')
  },
  {
    name: 'Are You Man Enough – The Four Tops',
    path: resolveMediaPath('the_four_tops_are_you_man_enough.mp3')
  },
  {
    name: 'Teacher – Jethro Tull',
    path: resolveMediaPath('jethro_tull_teacher.mp3')
  }
];

function populatePlaylist() {
  if (!playlistDropdown) return;

  const defaultOption = "<option value=\"\">Select a song...</option>";
  const options = playlist
    .map((song, index) => "<option value=\"" + index + "\">" + song.name + "</option>")
    .join("");

  playlistDropdown.innerHTML = defaultOption + options;
}

// --- Load Song (✅ FIXED LOGIC) ---
function loadSong(song, options = {}) {
  const { index = null, autoplay = false, isCustom = false } = options;

  audioElement.pause();
  audioElement.currentTime = 0;

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (!song || !song.path) {
    if (customSongUrl) {
      URL.revokeObjectURL(customSongUrl);
      customSongUrl = null;
    }

    audioElement.removeAttribute('src');
    nowPlaying.textContent = '';
    nowPlaying.style.display = 'none';
    if (playlistDropdown) {
      playlistDropdown.value = '';
    }
    currentSongIndex = null;
    isCustomTrack = false;
    setPlaybackControlsEnabled(false);
    setPlaylistNavigationEnabled(false);
    resetSeekBar();

    if (audioCtx && sourceNode) {
      sourceNode.disconnect();
      sourceNode = audioCtx.createMediaElementSource(audioElement);
      sourceNode.connect(analyser);
    }

    return;
  }

  if (isCustom) {
    if (customSongUrl && customSongUrl !== song.path) {
      URL.revokeObjectURL(customSongUrl);
    }
    customSongUrl = song.path;
    if (playlistDropdown) {
      playlistDropdown.value = '';
    }
  } else {
    if (customSongUrl) {
      URL.revokeObjectURL(customSongUrl);
      customSongUrl = null;
    }
    if (playlistDropdown && typeof index === 'number' && !Number.isNaN(index)) {
      playlistDropdown.value = String(index);
    }
  }

  audioElement.src = song.path; // ✅ no new URL trickery
  nowPlaying.textContent = song.name;
  nowPlaying.style.display = 'block';

  currentSongIndex = typeof index === 'number' && !Number.isNaN(index) ? index : null;
  isCustomTrack = isCustom;

  setPlaybackControlsEnabled(true);
  setPlaylistNavigationEnabled(!isCustom && playlist.length > 1);
  resetSeekBar();

  if (audioCtx && sourceNode) {
    sourceNode.disconnect();
    sourceNode = audioCtx.createMediaElementSource(audioElement);
    sourceNode.connect(analyser);
  }

  if (autoplay) {
    playAudio();
  }
}
function playRelativeSong(step, autoplay = false) {
  if (!playlist.length || isCustomTrack) return;

  const hasIndex = typeof currentSongIndex === 'number' && !Number.isNaN(currentSongIndex);
  const startIndex = hasIndex ? currentSongIndex : 0;
  const nextIndex = (startIndex + step + playlist.length) % playlist.length;
  loadSong(playlist[nextIndex], { index: nextIndex, autoplay });
}

if (playlistDropdown) {
  playlistDropdown.addEventListener('change', e => {
    const value = e.target.value;
    if (value === "") {
      loadSong(null);
      return;
    }

    const index = Number(value);
    if (!Number.isNaN(index)) {
      loadSong(playlist[index], { index });
    }
  });
}
if (prevBtn) {
  prevBtn.addEventListener('click', () => {
    const shouldAutoplay = !audioElement.paused;
    playRelativeSong(-1, shouldAutoplay);
  });
}

if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    const shouldAutoplay = !audioElement.paused;
    playRelativeSong(1, shouldAutoplay);
  });
}

if (browseAudioBtn) {
  browseAudioBtn.addEventListener('click', () => {
    if (fileInput) {
      fileInput.click();
    }
  });
}

if (fileInput) {
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      loadSong({ name: file.name, path: fileUrl }, { isCustom: true });
      fileInput.value = '';
    }
  });
}
audioElement.addEventListener('loadedmetadata', () => {
  if (!seekBar) return;
  if (Number.isFinite(audioElement.duration)) {
    seekBar.disabled = false;
    seekBar.value = 0;
  }
});

audioElement.addEventListener('ended', () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (seekBar) {
    seekBar.value = 0;
  }
});

// --- Image Viewer Logic ---
const photoAlbum = [
  { src: "pics/photography/jettysea.jpeg", caption: "Barnegat Inlet Jetty, NJ" },
  { src: "pics/photography/morntide.jpg", caption: "Newport Jersey City Walkway" },
  { src: "pics/photography/moonset.jpg", caption: "Hoboken Fire Escape" },
  { src: "pics/photography/nycsuns.jpg", caption: "Midtown Sunset" },
  { src: "pics/photography/sherbsky.jpg", caption: "Hoboken Fire Escape" },
  { src: "pics/photography/wintrrd.jpg", caption: "Adirondack Northway in Winter" },
  { src: "pics/photography/lkplcid.jpg", caption: "Lake Placid Backroad" }
];
let currentPhotoIndex = 0;

const mainImage = document.getElementById('mainImage');
const imageCaption = document.getElementById('imageCaption');
const thumbnailBar = document.querySelector('.thumbnail-bar');
const prevImageBtn = document.getElementById('prevImageBtn');
const nextImageBtn = document.getElementById('nextImageBtn');

function initImageViewer() {
  thumbnailBar.innerHTML = '';
  photoAlbum.forEach((photo, index) => {
    const thumb = document.createElement('img');
    thumb.src = photo.src;
    thumb.alt = photo.caption;
    thumb.dataset.index = index;
    thumb.onclick = () => displayPhoto(index);
    thumbnailBar.appendChild(thumb);
  });
  displayPhoto(0);
}

// ✅ FIXED: now references photoAlbum, not images[]
function displayPhoto(index) {
  if (index < 0 || index >= photoAlbum.length) return;
  currentPhotoIndex = index;
  const photo = photoAlbum[index];
  mainImage.src = photo.src;
  mainImage.alt = photo.caption;
  imageCaption.textContent = photo.caption;

  document.querySelectorAll('.thumbnail-bar img').forEach((img, i) => {
    img.classList.toggle('active', i === index);
  });
}

prevImageBtn.onclick = () => {
  let newIndex = (currentPhotoIndex - 1 + photoAlbum.length) % photoAlbum.length;
  displayPhoto(newIndex);
};

nextImageBtn.onclick = () => {
  let newIndex = (currentPhotoIndex + 1) % photoAlbum.length;
  displayPhoto(newIndex);
};

// --- Shutdown Logic ---
function shutdown() {
  document.body.innerHTML = `
    <div class="shutdown-screen">
      <img src="pics/icons/winlogo.png" alt="Windows Logo" />
      <p>It is now safe to turn off your computer.</p>
    </div>
  `;
  document.body.style.background = 'black';
  setTimeout(() => {
    window.close();
  }, 1500);
}

// --- Terminal Logic ---
const terminalInput = document.getElementById('terminalInput');
const terminalOutput = document.getElementById('terminalOutput');

const commandHistory = [];
let historyIndex = -1;

const commands = {
  'help': {
    description: 'Shows a list of available commands.',
    execute: () => {
      let helpText = 'Available commands:\n\n';
      for (const cmd in commands) {
        helpText += `${cmd.padEnd(10)} - ${commands[cmd].description}\n`;
      }
      return helpText;
    }
  },
  'clear': {
    description: 'Clears the terminal screen.',
    execute: () => {
      terminalOutput.innerHTML = '';
      return '';
    }
  },
  'about': { description: 'Opens the "About Me" window.', execute: () => openWindow('aboutWindow') },
  'projects': { description: 'Opens the "My Projects" window.', execute: () => openWindow('projectsWindow') },
  'contact': { description: 'Opens the "Contact" window.', execute: () => openWindow('contactWindow') },
  'photos': { description: 'Opens the "My Photos" window.', execute: () => openWindow('imageViewerWindow') },
  'media': { description: 'Opens the "Media Player" window.', execute: () => openWindow('mediaPlayer') },
  'notepad': { description: 'Opens the "Notepad" window.', execute: () => openWindow('notepadWindow') },
  'date': {
    description: 'Displays the current date and time.',
    execute: () => new Date().toString()
  },
  'exit': {
    description: 'Closes the command prompt.',
    execute: () => closeWindow('terminalWindow')
  },
  'log': {
    description: 'Displays the command history for the current session.',
    execute: () => {
      if (commandHistory.length === 0) {
        return 'No commands in history.';
      }
      return commandHistory.join('\n');
    }
  }
};

function processCommand(command) {
  const commandLineDiv = document.createElement('div');
  commandLineDiv.textContent = `C:\\>${command}`;
  terminalOutput.appendChild(commandLineDiv);

  if (command.trim() !== '') {
    commandHistory.push(command);
    historyIndex = commandHistory.length;
  }

  const cmd = command.toLowerCase().trim().split(' ')[0];
  if (commands[cmd]) {
    const result = commands[cmd].execute();
    if (result) {
      const resultLine = document.createElement('div');
      resultLine.textContent = result;
      terminalOutput.appendChild(resultLine);
    }
  } else if (cmd !== '') {
    const errorLine = document.createElement('div');
    errorLine.textContent = `Bad command or file name: "${command}"`;
    terminalOutput.appendChild(errorLine);
  }

  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

if (terminalInput) {
  terminalInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && terminalInput.value.trim() !== '') {
      processCommand(terminalInput.value);
      terminalInput.value = '';
      terminalInput.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        terminalInput.value = commandHistory[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        terminalInput.value = commandHistory[historyIndex];
      }
    }
  });

  const terminalWindow = document.getElementById('terminalWindow');
  if (terminalWindow) {
    terminalWindow.addEventListener('click', () => terminalInput.focus());
  }
}

// --- Run Dialog Logic ---
const runInput = document.getElementById('runInput');
const runOkBtn = document.getElementById('runOkBtn');
const runCancelBtn = document.getElementById('runCancelBtn');

function executeRunCommand() {
  const command = runInput.value.trim();
  if (command) {
    const cmdKey = command.toLowerCase().split(' ')[0];
    if (commands[cmdKey]) {
      commands[cmdKey].execute();
    } else {
      alert(`Cannot find the file '${command}'. Make sure you typed the name correctly, and then try again.`);
    }
    runInput.value = '';
    closeWindow('runDialogWindow');
  }
}

if (runInput) {
  runOkBtn.addEventListener('click', executeRunCommand);
  runCancelBtn.addEventListener('click', () => closeWindow('runDialogWindow'));
  runInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      executeRunCommand();
    }
  });
}

// --- Explorer Logic ---
function populateExplorer() {
  const fileList = document.getElementById('fileList');
  fileList.innerHTML = '';

  const desktopIcons = document.querySelectorAll('.desktop-icon');
  desktopIcons.forEach(icon => {
    const li = document.createElement('li');
    const img = icon.querySelector('img').cloneNode();
    img.className = 'explorer-icon';
    const text = icon.innerText;
    const windowId = icon.dataset.windowId;

    li.innerHTML = `${img.outerHTML} <span>${text}</span>`;
    li.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 5px; cursor: pointer;';
    li.onclick = () => openWindow(windowId);
    li.onmouseover = () => li.style.background = '#e0e0e0';
    li.onmouseout = () => li.style.background = 'white';
    fileList.appendChild(li);
  });
}

// --- Initialization ---
populatePlaylist();
setPlaybackControlsEnabled(false);
setPlaylistNavigationEnabled(false);
resetSeekBar();
initImageViewer();
layoutIcons();

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('main-desktop').classList.remove('hidden');
  document.getElementById('taskbar').classList.remove('hidden');
  layoutIcons();
});

// --- Visualizer Functions (Bars, Waveform, Circle) ---
function visualizeBars() {
  analyser.getByteFrequencyData(dataArray);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const barWidth = (canvas.width / bufferLength) * 2.5;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = dataArray[i];
    ctx.fillStyle = 'lime';
    ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
    x += barWidth + 1;
  }
}

function visualizeWaveform() {
  analyser.getByteTimeDomainData(dataArray);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'lime';
  ctx.beginPath();
  const sliceWidth = canvas.width * 1.0 / bufferLength;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * canvas.height / 2;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
}

function visualizeCircle() {
  analyser.getByteFrequencyData(dataArray);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) * 0.2;

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = dataArray[i] / 2;
    const angle = (i / bufferLength) * 2 * Math.PI;
    const x1 = centerX + radius * Math.cos(angle);
    const y1 = centerY + radius * Math.sin(angle);
    const x2 = centerX + (radius + barHeight) * Math.cos(angle);
    const y2 = centerY + (radius + barHeight) * Math.sin(angle);
    ctx.strokeStyle = 'lime';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

const visualizers = {
  'bars': visualizeBars,
  'waveform': visualizeWaveform,
  'circle': visualizeCircle
};

function visualize() {
  animationId = requestAnimationFrame(visualize);
  const selectedVisualizer = visualizerSelect.value;
  if (visualizers[selectedVisualizer]) {
    visualizers[selectedVisualizer]();
  }
}

// --- Audio Controls ---
async function playAudio() {
  if (!audioElement.src || audioElement.src === '') return;

  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      sourceNode = audioCtx.createMediaElementSource(audioElement);

      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);

      analyser.fftSize = 256;
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    }

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    await audioElement.play();
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    visualize();
  } catch (err) {
    console.error("Error trying to play audio:", err);
  }
}

if (playBtn) {
  playBtn.addEventListener('click', () => {
    playAudio();
  });
}

if (pauseBtn) {
  pauseBtn.addEventListener('click', () => {
    if (!audioElement || !audioElement.src) return;
    audioElement.pause();
    cancelAnimationFrame(animationId);
  });
}

if (stopBtn) {
  stopBtn.addEventListener('click', () => {
    if (!audioElement || !audioElement.src) return;
    audioElement.pause();
    audioElement.currentTime = 0;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    loadSong(null);
  });
}

seekBar.oninput = () => {
  if (!audioElement || !audioElement.src || !audioElement.duration) return;
  audioElement.currentTime = (seekBar.value / 100) * audioElement.duration;
};

audioElement.ontimeupdate = () => {
  if (audioElement && audioElement.duration) {
    seekBar.value = (audioElement.currentTime / audioElement.duration) * 100;
  }
};

volumeControl.oninput = () => {
  if (audioElement) {
    audioElement.volume = volumeControl.value;
  }
};

audioElement.volume = volumeControl.value;
