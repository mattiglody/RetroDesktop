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

// --- Path Configuration ---
const isGithubPages = window.location.hostname.includes('github.io');
const basePath = isGithubPages ? '/retrodesktop/' : '';

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
  if (isDragging && dragItem && dragItem.classList.contains('desktop-icon')) {
    const iconToSnap = dragItem;
    const container = document.getElementById('main-desktop');
    const currentLeft = iconToSnap.offsetLeft;
    const currentTop = iconToSnap.offsetTop;
    let snappedLeft = Math.round((currentLeft - ICON_GRID_CONFIG.x) / ICON_GRID_CONFIG.w) * ICON_GRID_CONFIG.w + ICON_GRID_CONFIG.x;
    let snappedTop = Math.round((currentTop - ICON_GRID_CONFIG.y) / ICON_GRID_CONFIG.h) * ICON_GRID_CONFIG.h + ICON_GRID_CONFIG.y;
    const maxLeft = container.clientWidth - iconToSnap.clientWidth;
    const taskbarHeight = document.getElementById('taskbar').offsetHeight;
    const maxTop = window.innerHeight - iconToSnap.clientHeight - taskbarHeight;
    snappedLeft = Math.max(ICON_GRID_CONFIG.x, Math.min(snappedLeft, maxLeft));
    snappedTop = Math.max(ICON_GRID_CONFIG.y, Math.min(snappedTop, maxTop));
    const otherIcons = Array.from(document.querySelectorAll('.desktop-icon')).filter(i => i !== iconToSnap);
    let isOccupied = otherIcons.some(other => {
      return Math.abs(other.offsetLeft - snappedLeft) < ICON_GRID_CONFIG.w / 2 &&
             Math.abs(other.offsetTop - snappedTop) < ICON_GRID_CONFIG.h / 2;
    });
    if (!isOccupied) {
      iconToSnap.style.transition = 'left 0.1s ease-out, top 0.1s ease-out';
      iconToSnap.style.left = `${snappedLeft}px`;
      iconToSnap.style.top = `${snappedTop}px`;
      setTimeout(() => { if (iconToSnap) iconToSnap.style.transition = ''; }, 100);
    }
  } else if (!isDragging && dragItem) {
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



// --- Media Player Logic with fixed playlist ---
let audioCtx, analyser, sourceNode, bufferLength, dataArray, animationId;

const fileInput = document.getElementById('audioFile');
const playlistDropdown = document.getElementById('playlistDropdown');
const browseAudioBtn = document.getElementById('browseAudioBtn');

const audioElement = document.getElementById('media-player-audio');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');

const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const seekBar = document.getElementById('seekBar');
const volumeControl = document.getElementById('volumeControl');
const visualizerSelect = document.getElementById('visualizerSelect');
const nowPlaying = document.getElementById('nowPlaying');

const playlist = [
  { name: "zwan_love_lies_in_ruin_acoustic_2003.mp3", path: "media/zwan_love_lies_in_ruin_acoustic_2003.mp3" },
  { name: "praise_you_fatboy_slim.mp3", path: "media/praise_you_fatboy_slim.mp3" },
  { name: "jethro_tull_teacher.mp3", path: "media/jethro_tull_teacher.mp3" }
];

function populatePlaylist() {
  playlist.forEach((song, index) => {
    playlistDropdown.innerHTML += `<option value="${index}">${song.name}</option>`;
  });
}

function loadSong(song) {
  audioElement.pause();
  audioElement.currentTime = 0;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (song && song.path) {
    audioElement.src = song.path;
    nowPlaying.textContent = song.name;
    nowPlaying.style.display = 'block';
  } else {
    audioElement.src = '';
    nowPlaying.style.display = 'none';
    seekBar.value = 0;
  }
  if (audioCtx && sourceNode) {
    sourceNode.disconnect();
    sourceNode = audioCtx.createMediaElementSource(audioElement);
    sourceNode.connect(analyser);
  }
  if (song && song.url) {
    playlistDropdown.value = "";
  }
}


// --- Image Viewer Logic ---
const photoAlbum = [
  { src: "pics/photography/jettysea.jpeg", caption: "Barnegat Inlet Jetty, NJ" },
  { src: "pics/photography/morntide.jpg", caption: "Newport Jersey City Walkway" },
  { src: "pics/photography/moonset.jpg", caption: "Hoboken Fire Escape" },
  { src: "pics/photography/nycsuns.jpg", caption: "Midtown Sunset" },
  { src: "pics/photography/sherbsky.jpg", caption: "Hoboken Fire Escape" },
  { src: "pics/photography/wintrrd.jpg", caption: "Adirondack Northway in Winter" }
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


// --- Explorer Logic and Init ---
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
    li.onclick = () => openWindow(windowId);
    fileList.appendChild(li);
  });
}

populatePlaylist();
initImageViewer();
layoutIcons();
