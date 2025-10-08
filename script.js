const ICON_GRID_CONFIG = {
  x: 20, // initial x offset
  y: 20, // initial y offset
  w: 90, // width of a grid cell
  h: 100 // height of a grid cell
};

function layoutIcons() {
  const desktop = document.getElementById('main-desktop');
  const icons = Array.from(desktop.getElementsByClassName('desktop-icon'));
  const taskbarHeight = document.getElementById('taskbar').offsetHeight;
  const desktopHeight = window.innerHeight - taskbarHeight;
  const iconsPerCol = Math.floor((desktopHeight - ICON_GRID_CONFIG.y) / ICON_GRID_CONFIG.h);

  icons.forEach((icon, index) => {
    const col = Math.floor(index / iconsPerCol);
    const row = index % iconsPerCol;
    icon.style.left = `${ICON_GRID_CONFIG.x + col * ICON_GRID_CONFIG.w}px`;
    icon.style.top = `${ICON_GRID_CONFIG.y + row * ICON_GRID_CONFIG.h}px`;
  });
}

function getPointerCoords(e) {
  if (e.changedTouches) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

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
let minWidth = 200;
let minHeight = 150;
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
  if (dragItem) {
    if (isDragging) {
      dragItem.classList.remove('dragging');
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
    } else {
      handleIconClick(dragItem);
    }
  }
  isDragging = false;
  dragItem = null;
  document.removeEventListener('mousemove', onIconDragMove);
  document.removeEventListener('mouseup', onIconDragEnd);
  document.removeEventListener('touchmove', onIconDragMove);
  document.removeEventListener('touchend', onIconDragEnd);
}

function handleIconClick(icon) {
  const windowId = icon.dataset.windowId;
  if (windowId) {
    openWindow(windowId);
  }
}

function openWindow(windowId) {
  const windowElement = document.getElementById(windowId);
  if (windowElement) {
    if (windowElement.style.display !== 'flex') {
        windowElement.style.display = 'flex';
        // Random position only if it's the first time opening
        if (!windowElement.style.left) {
            const taskbarHeight = document.getElementById('taskbar').offsetHeight;
            const x = Math.random() * (window.innerWidth - windowElement.offsetWidth - 200) + 100;
            const y = Math.random() * (window.innerHeight - windowElement.offsetHeight - taskbarHeight - 100) + 50;
            windowElement.style.left = `${x}px`;
            windowElement.style.top = `${y}px`;
        }
    }
    bringToFront(windowId);
    createTaskbarTab(windowId);
  }
}

function closeWindow(windowId) {
  const windowElement = document.getElementById(windowId);
  if (windowElement) {
    windowElement.style.display = 'none';
    const tab = document.querySelector(`.taskbar-tab[data-window-id="${windowId}"]`);
    if (tab) {
        tab.remove();
    }
  }
}

function minimizeWindow(windowId) {
    const windowElement = document.getElementById(windowId);
    if (windowElement) {
        windowElement.style.display = 'none';
        updateTaskbarTab(windowId, false);
    }
}

function maximizeWindow(windowId) {
    const windowElement = document.getElementById(windowId);
    if (windowElement) {
        windowElement.classList.toggle('maximized');
    }
}

function bringToFront(windowId) {
  const windowElement = document.getElementById(windowId);
  if (windowElement) {
    windowElement.style.zIndex = zIndexCounter++;
    document.querySelectorAll('.window').forEach(win => {
      win.classList.remove('active');
    });
    windowElement.classList.add('active');
    updateTaskbarTab(windowId, true);
  }
}

function createTaskbarTab(windowId) {
    if (document.querySelector(`.taskbar-tab[data-window-id="${windowId}"]`)) {
        return; // Tab already exists
    }
    const windowElement = document.getElementById(windowId);
    const title = windowElement.querySelector('.title-bar span').textContent;
    const desktopIcon = document.querySelector(`.desktop-icon[data-window-id="${windowId}"]`);
    const iconSrc = desktopIcon.querySelector('img').src;

    const tab = document.createElement('div');
    tab.className = 'taskbar-tab';
    tab.dataset.windowId = windowId;
    tab.innerHTML = `<img src="${iconSrc}" alt="${title}"> <span>${title}</span>`;
    tab.onclick = () => {
        const win = document.getElementById(windowId);
        if (win.style.display === 'none') {
            win.style.display = 'flex';
            bringToFront(windowId);
        } else if (win.classList.contains('active')) {
            minimizeWindow(windowId);
        } else {
            bringToFront(windowId);
        }
    };
    taskbarTabsContainer.appendChild(tab);
    updateTaskbarTab(windowId, true);
}

function updateTaskbarTab(windowId, isActive) {
    document.querySelectorAll('.taskbar-tab').forEach(t => {
        if (t.dataset.windowId !== windowId) {
            t.classList.remove('active');
        }
    });
    const tab = document.querySelector(`.taskbar-tab[data-window-id="${windowId}"]`);
    if (tab) {
        if (isActive) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    }
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

function onWindowResize(e) {
    if (!resizeItem) return;
    const dx = e.clientX - initialMouseX;
    const dy = e.clientY - initialMouseY;
    const newWidth = Math.max(minWidth, initialWidth + dx);
    const newHeight = Math.max(minHeight, initialHeight + dy);
    resizeItem.style.width = newWidth + 'px';
    resizeItem.style.height = newHeight + 'px';
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
  { name: "baby_youre_a_haunted_house_mels_version.m4a", path: "media/baby_youre_a_haunted_house_mels_version.m4a" },
  { name: "djali_zwan_love_to_love.mp3", path: "media/djali_zwan_love_to_love.mp3" },
  { name: "jethro_tull_teacher.mp3", path: "media/jethro_tull_teacher.mp3" },
  { name: "praise_you_fatboy_slim.mp3", path: "media/praise_you_fatboy_slim.mp3" },
  { name: "the_four_tops_are_you_man_enough.mp3", path: "media/the_four_tops_are_you_man_enough.mp3" },
  { name: "zwan_love_lies_in_ruin_acoustic.mp3", path: "media/zwan_love_lies_in_ruin_acoustic.mp3" },
  { name: "zwan_wasting_time.mp3", path: "media/zwan_wasting_time.mp3" }
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

const startButton = document.getElementById('start');
const startMenu = document.getElementById('startMenu');

startButton.addEventListener('click', (event) => {
  event.stopPropagation();
  startMenu.style.display = startMenu.style.display === 'block' ? 'none' : 'block';
  startButton.classList.toggle('active');
});

document.addEventListener('click', () => {
  startMenu.style.display = 'none';
  startButton.classList.remove('active');
});

startMenu.addEventListener('click', (event) => {
  event.stopPropagation();
});

function updateClock() {
  const clockElement = document.getElementById('clock');
  if (clockElement) {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strTime = hours.toString().padStart(2, '0') + ':' + minutes + ' ' + ampm;
    clockElement.textContent = strTime;
  }
}

populatePlaylist();
initImageViewer();
layoutIcons();
updateClock();
setInterval(updateClock, 1000);

document.querySelectorAll('.desktop-icon').forEach(icon => {
  icon.addEventListener('mousedown', (e) => onIconDragStart(e, icon));
  icon.addEventListener('touchstart', (e) => onIconDragStart(e, icon), { passive: false });
});

document.querySelectorAll('.close-btn').forEach(btn => {
    const windowElement = btn.closest('.window');
    btn.addEventListener('click', () => {
        closeWindow(windowElement.id);
    });
});

document.querySelectorAll('.minimize-btn').forEach(btn => {
    const windowElement = btn.closest('.window');
    btn.addEventListener('click', () => {
        minimizeWindow(windowElement.id);
    });
});

document.querySelectorAll('.maximize-btn').forEach(btn => {
    const windowElement = btn.closest('.window');
    btn.addEventListener('click', () => {
        maximizeWindow(windowElement.id);
    });
});

document.querySelectorAll('.resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        resizeItem = e.target.closest('.window');
        initialWidth = resizeItem.offsetWidth;
        initialHeight = resizeItem.offsetHeight;
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;
        document.addEventListener('mousemove', onWindowResize);
        document.addEventListener('mouseup', () => {
            resizeItem = null;
            document.removeEventListener('mousemove', onWindowResize);
        });
    });
});
