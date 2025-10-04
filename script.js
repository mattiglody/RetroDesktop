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
const basePath = isGithubPages ? '/RetroDesktop/' : '';

/**
 * Starts the drag operation for a desktop icon.
 */
function onIconDragStart(e, item) {
  // Prevent default browser actions like text selection
  e.preventDefault();

  dragItem = item;
  isDragging = false; // Reset dragging state

  const pointer = getPointerCoords(e);

  // Store initial pointer position to calculate drag threshold
  dragStartPos.x = pointer.x;
  dragStartPos.y = pointer.y;

  const rect = dragItem.getBoundingClientRect();
  // Calculate where the click happened inside the icon
  offsetX = pointer.x - rect.left;
  offsetY = pointer.y - rect.top;

  // Add listeners to the document to track movement anywhere on the page
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
  e.preventDefault(); // Important for touch devices

  const pointer = getPointerCoords(e);

  if (!isDragging) {
    const dx = pointer.x - dragStartPos.x;
    const dy = pointer.y - dragStartPos.y;
    if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
      isDragging = true;
      // Add a class to indicate dragging, useful for styling
      dragItem.classList.add('dragging');
    }
  }

  if (isDragging) {
    // Calculate new position relative to the viewport, then constrain
    let newLeft = pointer.x - offsetX;
    let newTop = pointer.y - offsetY;

    // Constrain icon dragging within the desktop container
    const maxLeft = window.innerWidth - dragItem.offsetWidth;
    const taskbarHeight = document.getElementById('taskbar').offsetHeight;
    const maxTop = window.innerHeight - dragItem.offsetHeight - taskbarHeight;
    newTop = Math.max(0, Math.min(newTop, maxTop)); // Ensure it doesn't go above screen or below taskbar

    dragItem.style.left = `${newLeft}px`;
    dragItem.style.top = `${newTop}px`;
  }
}

/**
 * Ends the icon drag operation.
 * If it was a drag, it snaps the icon to the grid.
 * If it was a click, it calls the icon click handler.
 */
function onIconDragEnd() {
  if (dragItem) dragItem.classList.remove('dragging');

  // If a drag occurred, snap the icon to the grid
  if (isDragging && dragItem && dragItem.classList.contains('desktop-icon')) {
    const iconToSnap = dragItem;
    const container = document.getElementById('main-desktop');
    const currentLeft = iconToSnap.offsetLeft;
    const currentTop = iconToSnap.offsetTop;

    // Calculate the nearest grid point
    let snappedLeft = Math.round((currentLeft - ICON_GRID_CONFIG.x) / ICON_GRID_CONFIG.w) * ICON_GRID_CONFIG.w + ICON_GRID_CONFIG.x;
    let snappedTop = Math.round((currentTop - ICON_GRID_CONFIG.y) / ICON_GRID_CONFIG.h) * ICON_GRID_CONFIG.h + ICON_GRID_CONFIG.y;

    // Constrain to container bounds
    const maxLeft = container.clientWidth - iconToSnap.clientWidth;
    const taskbarHeight = document.getElementById('taskbar').offsetHeight;
    const maxTop = window.innerHeight - iconToSnap.clientHeight - taskbarHeight;
    snappedLeft = Math.max(ICON_GRID_CONFIG.x, Math.min(snappedLeft, maxLeft));
    snappedTop = Math.max(ICON_GRID_CONFIG.y, Math.min(snappedTop, maxTop));

    // --- Collision Detection ---
    // Check if the target spot is occupied
    const otherIcons = Array.from(document.querySelectorAll('.desktop-icon')).filter(i => i !== iconToSnap);
    let isOccupied = otherIcons.some(other => {
        return Math.abs(other.offsetLeft - snappedLeft) < ICON_GRID_CONFIG.w / 2 &&
               Math.abs(other.offsetTop - snappedTop) < ICON_GRID_CONFIG.h / 2;
    });

    // If occupied, don't move it (or find next available spot - for now, just revert)
    if (!isOccupied) {
        iconToSnap.style.transition = 'left 0.1s ease-out, top 0.1s ease-out';
        iconToSnap.style.left = `${snappedLeft}px`;
        iconToSnap.style.top = `${snappedTop}px`;
        setTimeout(() => {
          if (iconToSnap) iconToSnap.style.transition = '';
        }, 100);
    } // If you wanted to revert, you'd add an else block here. For now, it just stays where it was dropped if occupied.

  } else if (!isDragging && dragItem) { // If no drag occurred, it was a click.
    handleIconClick(dragItem);
  }

  // --- Cleanup ---
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

    isDragging = true; // For windows, dragging starts immediately on move

    const coords = getPointerCoords(e);
    const taskbarHeight = document.getElementById('taskbar').offsetHeight;

    // We calculate position based on the initial click offset relative to the viewport
    let newX = coords.x - offsetX;
    let newY = coords.y - offsetY;

    // Constrain to viewport, leaving space for the taskbar
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
    x: 20, // Horizontal offset from the edge
    y: 20, // Vertical offset from the edge
    w: 90, // Grid cell width
    h: 90  // Grid cell height
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
        // Only drag with left mouse button
        if (e.type === 'mousedown' && e.button !== 0) return;
        // Don't drag if clicking on a window control button
        if (e.target.closest('.window-controls')) return;

        dragItem = element;
        isDragging = false;

        const coords = getPointerCoords(e);
        const rect = dragItem.getBoundingClientRect();

        // Calculate offset from top-left of the element relative to viewport
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

    // Add listeners for window controls
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

    if (clickTimer && lastClickedIcon === icon) { // Double-click on the same icon
        clearTimeout(clickTimer);
        clickTimer = null;
        lastClickedIcon = null;
        openWindow(windowId);
    } else { // Single-click or click on a different icon
        clearTimeout(clickTimer); // Clear timer for any previous single click
        lastClickedIcon = icon;
        // You could add logic here for selecting an icon on single click
        clickTimer = setTimeout(() => {
            clickTimer = null;
            lastClickedIcon = null;
        }, 300); // 300ms double-click threshold
    }
}

document.querySelectorAll('.desktop-icon').forEach(icon => {
  // This listener initiates both drags and click/double-click detection
  icon.addEventListener('mousedown', (e) => onIconDragStart(e, icon));
  icon.addEventListener('touchstart', (e) => onIconDragStart(e, icon), { passive: false });
});

/**
 * Calculates the initial position and size for a new window to avoid icons.
 * @param {HTMLElement} win - The window element to position.
 */
function setInitialWindowPosition(win) {
    const icons = document.querySelectorAll('.desktop-icon');
    const taskbarHeight = document.getElementById('taskbar').offsetHeight;
    const margin = 20; // Margin from edges and icons
    let rightmostIcon = 0;

    // Find the rightmost edge of all icons
    icons.forEach(icon => {
        const iconRight = icon.offsetLeft + icon.offsetWidth;
        if (iconRight > rightmostIcon) {
            rightmostIcon = iconRight;
        }
    });

    const startX = rightmostIcon + margin;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Use the window's inline or CSS width if it's larger than available space, otherwise fill space
    const initialWidth = parseInt(win.style.width, 10) || win.offsetWidth;
    const windowWidth = Math.min(initialWidth, viewportWidth - startX - margin);
    const windowHeight = win.offsetHeight;

    // Calculate random position within the available space
    const availableRandomWidth = viewportWidth - startX - windowWidth - margin;
    const availableRandomHeight = viewportHeight - taskbarHeight - windowHeight - margin;

    const randomX = startX + Math.random() * Math.max(0, availableRandomWidth);
    const randomY = margin + Math.random() * Math.max(0, availableRandomHeight);

    win.style.width = `${windowWidth}px`;
    win.style.left = `${Math.max(startX, randomX)}px`;
    win.style.top = `${Math.max(margin, randomY)}px`;
}

function openWindow(id){
    const win = document.getElementById(id);
    let tab = taskbarTabsContainer.querySelector(`[data-window-id="${id}"]`);

    if (tab) { // If tab exists, just focus the window
        focusWindow(id);
        return;
    }

    // Create a new tab on the taskbar
    tab = document.createElement('div');
    tab.className = 'taskbar-tab';
    tab.dataset.windowId = id;

    const iconEl = document.querySelector(`.desktop-icon[data-window-id="${id}"] img`) || document.querySelector(`.start-menu-items li[data-window-id="${id}"] img`);
    const title = win.querySelector('.title-bar span').textContent;

    let tabIconHtml = '';
    if (iconEl && iconEl.src) {
        tabIconHtml = `<img src="${iconEl.src}" />`;
    }
    tab.innerHTML = `${tabIconHtml} <span>${title}</span>`;
    tab.onclick = () => focusWindow(id, true); // Pass true for isFromTaskbar
    taskbarTabsContainer.appendChild(tab);

    // Set initial position only if it's a fresh open (not restored)
    if (win.style.display !== 'flex') {
        setInitialWindowPosition(win);
    }

    // If opening explorer, populate it
    if (id === 'explorerWindow') {
        populateExplorer();
    }

    win.style.display = 'flex';
    focusWindow(id);
}

function focusWindow(id, isFromTaskbar = false) {
    const win = document.getElementById(id);
    const tab = taskbarTabsContainer.querySelector(`[data-window-id="${id}"]`);

    // If clicking the active window's tab, minimize it
    if (isFromTaskbar && id === activeWindowId && win.style.display !== 'none') {
        minimizeWindow(id);
        return;
    }

    // Deactivate all other tabs
    document.querySelectorAll('.taskbar-tab').forEach(t => t.classList.remove('active'));
    
    // Activate current tab
    if (tab) tab.classList.add('active');

    // If window is minimized, restore it
    if (win.style.display === 'none') {
        win.style.display = 'flex';
    }

    // Bring window to front
    win.style.zIndex = ++zIndexCounter;
    activeWindowId = id;

    // Ensure the restored window is within bounds
    const margin = 5; // Small margin from the edges
    const taskbarHeight = document.getElementById('taskbar').offsetHeight;
    const winRect = win.getBoundingClientRect();
    let top = win.offsetTop;
    let left = win.offsetLeft;

    // Check vertical position (against taskbar)
    const maxTop = window.innerHeight - winRect.height - taskbarHeight - margin;
    if (top > maxTop) {
        win.style.top = `${Math.max(0, maxTop)}px`;
    }

    // Check horizontal position (against right edge)
    const maxLeft = window.innerWidth - winRect.width - margin;
    if (left > maxLeft) {
        win.style.left = `${Math.max(0, maxLeft)}px`;
    }
}

function closeWindow(id){
    const win = document.getElementById(id);
    if (!win) return;
    win.style.display = 'none';
    const tab = taskbarTabsContainer.querySelector(`[data-window-id="${id}"]`);
    if (tab) {
        tab.remove();
    }

    if (activeWindowId === id) {
        activeWindowId = null;
        // Find the next available window to focus
        const openTabs = taskbarTabsContainer.querySelectorAll('.taskbar-tab');
        if (openTabs.length > 0) {
            // Focus the last tab in the list, which is the most recently focused one
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

// Clock
function updateClock(){
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// --- Initial Icon Layout ---
function layoutIcons() {
  const icons = document.querySelectorAll('.desktop-icon');
  const iconGrid = { x: 20, y: 20, w: 90, h: 90 }; // Spacing for icons
  let col = 0;
  let row = 0;
  const taskbarHeight = 30;
  const viewHeight = window.innerHeight;

  icons.forEach((icon) => {
    const topPos = iconGrid.y + row * iconGrid.h;
    // Check if next icon would overlap taskbar or go off-screen
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
  e.stopPropagation(); // Prevent document click from closing it right away
  startMenu.style.display = startMenu.style.display === 'block' ? 'none' : 'block';
  startBtn.classList.toggle('active');
});

document.addEventListener('click', e => {
  // Hide menu if clicking outside of it and the start button
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
    // Meta key is the Windows key on Windows, Command key on Mac
    e.preventDefault(); // Prevent the browser/OS default Run dialog
    e.stopPropagation(); // Stop the event from propagating further
    openWindow('runDialogWindow');
    // Focus the input field after opening
    document.getElementById('runInput').focus();
  }
});

startMenu.addEventListener('click', e => {
  const targetLi = e.target.closest('li');
  if (!targetLi || targetLi.classList.contains('has-submenu')) return; // Ignore clicks on submenu parents

  const windowId = targetLi.dataset.windowId;
  if (windowId) {
    openWindow(windowId);
    startMenu.style.display = 'none'; // Close menu after opening window
    startBtn.classList.remove('active');
  } else if (targetLi.id === 'shutdownBtn') {
    shutdown();
  }
});

startMenu.addEventListener('mouseover', e => {
    const targetLi = e.target.closest('li');
    if (targetLi && targetLi.classList.contains('has-submenu')) {
        const submenu = targetLi.querySelector('.submenu');
        if (!submenu) return;

        const taskbarHeight = document.getElementById('taskbar').offsetHeight;
        const menuRect = submenu.getBoundingClientRect();
        const parentRect = targetLi.getBoundingClientRect();

        // If the bottom of the submenu would go past the top of the taskbar
        if (parentRect.top + menuRect.height > window.innerHeight - taskbarHeight) {
            submenu.style.top = `auto`;
            submenu.style.bottom = `0px`;
        } else {
            submenu.style.top = `-2px`;
            submenu.style.bottom = `auto`;
        }
    }
});

// --- Context Menu Logic ---
const contextMenu = document.getElementById('contextMenu');

desktopContainer.addEventListener('contextmenu', e => {
  e.preventDefault(); // Always prevent the default browser menu on the desktop

  // Only show our context menu if right-clicking the desktop itself
  if (e.target === desktopContainer) {
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.display = 'block';
  } else {
    // If right-clicking on an icon, just hide our menu if it's open
    contextMenu.style.display = 'none';
  }
});

document.addEventListener('click', e => {
  // Hide context menu on left click
  if (e.button === 0) {
    contextMenu.style.display = 'none';
  }
});

contextMenu.addEventListener('click', e => {
  const action = e.target.dataset.action;
  if (action === 'refresh') layoutIcons();
  if (action === 'properties') openWindow('displayPropertiesWindow');
});

function maximizeWindow(id) {
    const win = document.getElementById(id);
    if (win.classList.contains('maximized')) {
        // Restore
        win.classList.remove('maximized');
        const oldState = JSON.parse(win.dataset.oldState);
        win.style.top = oldState.top;
        win.style.left = oldState.left;
        win.style.width = oldState.width;
        win.style.height = oldState.height;
    } else {
        // Maximize
        win.dataset.oldState = JSON.stringify({
            top: win.style.top,
            left: win.style.left,
            width: win.offsetWidth + 'px',
            height: win.offsetHeight + 'px',
        });
        win.classList.add('maximized');
    }
}
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

// Media Player Logic
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

// --- Playlist Configuration ---
const playlist = [
    { name: "zwan_love_lies_in_ruin_acoustic_2003.mp3", path: "./media/zwan_love_lies_in_ruin_acoustic_2003.mp3" },
    { name: "praise_you_fatboy_slim.mp3", path: './media/praise_you_fatboy_slim.mp3' },
    { name: "jethro_tull_teacher.mp3", path: './media/jethro_tull_teacher.mp3' },
    // Add more songs here
];

function populatePlaylist() {
    playlist.forEach((song, index) => {
        playlistDropdown.innerHTML += `<option value="${index}">${song.name}</option>`;
    });
}

function loadSong(song) {
    // Stop any current playback and animation
    audioElement.pause();
    audioElement.currentTime = 0;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    // If a song object is provided, load it. Otherwise, we're just stopping.
    if (song && song.path) {
        const audioSrc = song.url ? song.url : new URL(song.path.replace('./', ''), window.location.href).href;
        audioElement.src = audioSrc;
        nowPlaying.textContent = song.name;
        nowPlaying.style.display = 'block';
        enableControls();
    } else {
        audioElement.src = '';
        nowPlaying.style.display = 'none';
        seekBar.value = 0;
        disableControls();
    }

    // If the audio graph exists, we need to reconnect the source for the new src
    if (audioCtx && sourceNode) {
        sourceNode.disconnect();
        sourceNode = audioCtx.createMediaElementSource(audioElement);
        sourceNode.connect(analyser);
    }

    // When loading a new song from a file, reset the dropdown
    if (song && song.url) {
        playlistDropdown.value = "";
    }
}

function loadSongByUrl(file) {
    const fileUrl = URL.createObjectURL(file);
    const audioSrc = song.url ? song.url : new URL(song.path.replace('./', ''), window.location.href).href;
    loadSong({ name: file.name, url: fileUrl, path: fileUrl });
}

playlistDropdown.addEventListener('change', e => {
    const songIndex = e.target.value;
    if (songIndex !== "") {
        loadSong(playlist[songIndex]);
    }
});

browseAudioBtn.addEventListener('click', () => {
    fileInput.click(); // Trigger the hidden file input
});

fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
        loadSongByUrl(file);
    }
});

function enableControls(){
  [playBtn, pauseBtn, stopBtn, seekBar, volumeControl, prevBtn, nextBtn].forEach(el=>{
    el.classList.remove('disabled');
    el.disabled = false;
  });
}

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
    analyser.getByteTimeDomainData(dataArray); // Use time domain data for waveform
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

playBtn.onclick = async () => {
    if (!audioElement.src || audioElement.src === '') return;
    
    try {
        // --- THIS IS THE FUNDAMENTAL FIX ---
        // Create the audio context on the first user interaction (play click)
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

        // If context is suspended (e.g., by browser policy), resume it.
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        await audioElement.play();
        visualize();

    } catch (err) {
        console.error("Error trying to play audio:", err);
    }
};
pauseBtn.onclick = () => {
  if (!audioElement || !audioElement.src) return;
  audioElement.pause();
  cancelAnimationFrame(animationId);
};
stopBtn.onclick = () => {
  if (!audioElement || !audioElement.src) return;
  audioElement.pause();
  audioElement.currentTime = 0;
  if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
  }
  loadSong(null); // Reset the player
};
seekBar.oninput = () => {
  if (!audioElement || !audioElement.src || !audioElement.duration) return;
  audioElement.currentTime = (seekBar.value/100)*audioElement.duration;
};

// Attach global event listeners once
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

// --- Image Viewer Logic ---
const photoAlbum = [
  { src: "./pics/photography/jettysea.jpeg", caption: "Barnegat Inlet Jetty, NJ" },
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
  thumbnailBar.innerHTML = ''; // Clear existing thumbnails
  photoAlbum.forEach((photo, index) => {
    const thumb = document.createElement('img');
    thumb.src = basePath + photo.src;
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
  mainImage.src = basePath + photo.src;
  mainImage.alt = photo.caption;
  imageCaption.textContent = photo.caption;
  // Update active thumbnail
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

function shutdown() {
  document.body.innerHTML = `
    <div class="shutdown-screen">
      <img src="${basePath}pics/icons/winlogo.png" alt="Windows Logo" />
      <p>It is now safe to turn off your computer.</p>
    </div>
  `;
  document.body.style.background = 'black';
  // Note: window.close() may not work in all browsers due to security restrictions.
  // It typically only works for windows opened by a script.
  setTimeout(() => {
    window.close();
  }, 1500); // Close after 1.5 seconds
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
            return ''; // No output message
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
            // Join history with line breaks for display
            return commandHistory.join('\n');
        }
    }
};

function processCommand(command) {
    // Append the command itself to the output history
    const commandLineDiv = document.createElement('div');
    commandLineDiv.textContent = `C:\\>${command}`;
    terminalOutput.appendChild(commandLineDiv);

    if (command.trim() !== '') {
        commandHistory.push(command);
        historyIndex = commandHistory.length; // Reset index to the end
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

    // Scroll to bottom
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

if (terminalInput) {
    terminalInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && terminalInput.value.trim() !== '') {
            processCommand(terminalInput.value); // Process the command
            terminalInput.value = ''; // Clear the input field
            terminalInput.focus(); // Ensure input field remains focused
        } else if (e.key === 'ArrowUp') {
            e.preventDefault(); // Prevent cursor from moving to start
            if (historyIndex > 0) {
                historyIndex--;
                terminalInput.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault(); // Prevent cursor from moving to end
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                terminalInput.value = commandHistory[historyIndex];
            }
        }
    });
    // Focus input when terminal window is clicked
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
    fileList.innerHTML = ''; // Clear previous content

    const desktopIcons = document.querySelectorAll('.desktop-icon');
    desktopIcons.forEach(icon => {
        const li = document.createElement('li');
        const img = icon.querySelector('img').cloneNode();
        img.className = 'explorer-icon'; // Add a class for styling
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

// Initialize apps
// window.addEventListener('resize', layoutIcons);
populatePlaylist();
initImageViewer(); // Ensure controls are disabled on page load

// --- Boot/Loading Screen Logic ---
// For development: Immediately show the desktop and skip the loading screen.
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('main-desktop').classList.remove('hidden');
    document.getElementById('taskbar').classList.remove('hidden');
    layoutIcons();
});