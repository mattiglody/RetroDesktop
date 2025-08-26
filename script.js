// --- Dragging Logic (for Windows and Icons) ---
let dragItem = null;
let isDragging = false; // To distinguish click from drag
let dragOffsetX, dragOffsetY;
let zIndexCounter = 10;
// --- Resizing Logic ---
let resizeItem = null;
let initialWidth, initialHeight;
let initialMouseX, initialMouseY;
let minWidth, minHeight;
const taskbarTabsContainer = document.getElementById('taskbar-tabs');
const desktopContainer = document.getElementById('desktop-container');
let activeWindowId = null;

// --- Path Configuration ---
const isGithubPages = window.location.hostname.includes('github.io');
const basePath = isGithubPages ? 'RetroDesktop/' : '';

// Helper to get coordinates from either mouse or touch event
function getPointerCoords(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function makeDraggable(element, handle) {
    const startDrag = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;

        dragItem = element;
        isDragging = false;
        const coords = getPointerCoords(e);
        dragOffsetX = coords.x - dragItem.offsetLeft;
        dragOffsetY = coords.y - dragItem.offsetTop;
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('mouseup', onDragEnd, { once: true });
        document.addEventListener('touchend', onDragEnd, { once: true });
    };

    (handle || element).addEventListener('mousedown', startDrag);
    (handle || element).addEventListener('touchstart', startDrag, { passive: false });
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

// Make icons draggable
document.querySelectorAll('.desktop-icon').forEach(icon => {
    makeDraggable(icon);
});

function onDragMove(e) {
    if (!dragItem) return;
    if (e.type === 'touchmove') e.preventDefault();
    if (dragItem.classList.contains('maximized')) return;

    if (!isDragging) {
        const coords = getPointerCoords(e);
        const currentX = coords.x - dragOffsetX;
        const currentY = coords.y - dragOffsetY;
        const startX = dragItem.offsetLeft;
        const startY = dragItem.offsetTop;
        if (Math.abs(currentX - startX) > 5 || Math.abs(currentY - startY) > 5) {
            isDragging = true;
        }
    }

    if (isDragging) {
        const coords = getPointerCoords(e);
        let newX = coords.x - dragOffsetX;
        let newY = coords.y - dragOffsetY;
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        dragItem.style.left = newX + 'px';
        dragItem.style.top = newY + 'px';
    }
}

function onDragEnd() {
    if (isDragging) {
        setTimeout(() => { isDragging = false; }, 10);
    }
    dragItem = null;
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('touchmove', onDragMove);
}

// --- Icon Click/Double-click Logic ---
let clickTimer = null;
document.querySelectorAll('.desktop-icon').forEach(icon => {
  icon.addEventListener('click', e => {
    if (isDragging) return; // It was a drag, not a click
    const windowId = icon.dataset.windowId;
    if (!windowId) return;

    if (clickTimer) { // Double-click
      clearTimeout(clickTimer);
      clickTimer = null;
      openWindow(windowId);
    } else { // Single-click
      clickTimer = setTimeout(() => { clickTimer = null; }, 300);
    }
  });
});

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
}

function closeWindow(id){
    const win = document.getElementById(id);
    if (!win) return;
    win.style.display = 'none';
    const tab = taskbarTabsContainer.querySelector(`[data-window-id="${id}"]`);
    if (tab) tab.remove();
    if (activeWindowId === id) activeWindowId = null;
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
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (activeWindowId) {
      closeWindow(activeWindowId);
    }
  }
});

startMenu.addEventListener('click', e => {
  const targetLi = e.target.closest('li');
  if (!targetLi) return;
  const windowId = targetLi.dataset.windowId;
  if (windowId) {
    openWindow(windowId);
    startMenu.style.display = 'none'; // Close menu after opening window
    startBtn.classList.remove('active');
  } else if (targetLi.id === 'shutdownBtn') {
    shutdown();
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
let audioCtx, analyser, sourceNode, bufferLength, dataArray, animationId, audioElement;

const fileInput = document.getElementById('audioFile');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');

const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const seekBar = document.getElementById('seekBar');
const volumeControl = document.getElementById('volumeControl');
const nowPlaying = document.getElementById('nowPlaying');

fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) {
    if (audioElement) {
      audioElement.pause();
      cancelAnimationFrame(animationId);
    }
    audioElement = new Audio(URL.createObjectURL(file));
    audioElement.crossOrigin = "anonymous";

    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.connect(audioCtx.destination);
      analyser.fftSize = 256;
    }
    
    sourceNode = audioCtx.createMediaElementSource(audioElement);
    sourceNode.connect(analyser);
    
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    // Resize canvas to fit its container
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    nowPlaying.textContent = file.name;
    nowPlaying.style.display = 'block';

    enableControls();

    // Update seek bar
    audioElement.ontimeupdate = () => {
      if (audioElement.duration) {
        seekBar.value = (audioElement.currentTime / audioElement.duration) * 100;
      }
    };
  }
});

function enableControls(){
  [playBtn,pauseBtn,stopBtn,seekBar,volumeControl].forEach(el=>{
    el.classList.remove('disabled');
    el.disabled = false;
  });
}

function visualize(){
  animationId = requestAnimationFrame(visualize);
  analyser.getByteFrequencyData(dataArray);
  ctx.fillStyle = 'black';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const barWidth = (canvas.width / bufferLength) * 2.5;
  let x = 0;
  for(let i=0; i<bufferLength; i++){
    const barHeight = dataArray[i];
    ctx.fillStyle = 'lime';
    ctx.fillRect(x, canvas.height-barHeight/2, barWidth, barHeight/2);
    x += barWidth + 1;
  }
}

playBtn.onclick = () => {
  audioElement.play();
  audioCtx.resume();
  visualize();
};
pauseBtn.onclick = () => {
  audioElement.pause();
  cancelAnimationFrame(animationId);
};
stopBtn.onclick = () => {
  if (!audioElement) return;
  audioElement.pause();
  audioElement.currentTime = 0;
  cancelAnimationFrame(animationId);
  animationId = null;
  // Clear canvas and title
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  nowPlaying.style.display = 'none';
};
seekBar.oninput = () => {
  audioElement.currentTime = (seekBar.value/100)*audioElement.duration;
};
volumeControl.oninput = () => {
  audioElement.volume = volumeControl.value;
};

// --- Image Viewer Logic ---
const photoAlbum = [
  { src: `${basePath}pics/photography/delgap.jpg`, caption: 'South West NJ Coast, Del Water Gap' },
  { src: `${basePath}pics/photography/morntide.jpg`, caption: 'Newport Jersey City Walkway' },
  { src: `${basePath}pics/photography/moonset.jpg`, caption: 'Hoboken Fire Escape' },
  { src: `${basePath}pics/photography/nycsuns.jpg`, caption: 'Midtown Sunset' },
  { src: `${basePath}pics/photography/sherbsky.jpg`, caption: 'Hoboken Fire Escape' },
  { src: `${basePath}pics/photography/wintrrd.jpg`, caption: 'Adirondack Northway in Winter' }
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

// Initialize apps
window.addEventListener('resize', layoutIcons);
initImageViewer();

// --- Boot/Loading Screen Logic ---
window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loading-screen');
    const desktopContainer = document.getElementById('desktop-container');
    const taskbar = document.getElementById('taskbar');

    // Wait for the loading bar animation to finish (3 seconds)
    setTimeout(() => {
        // Fade out the loading screen
        loadingScreen.style.opacity = '0';

        // After fade out, hide it and show the desktop
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            desktopContainer.classList.remove('hidden');
            taskbar.classList.remove('hidden');
            // Re-layout icons now that the desktop is visible
            layoutIcons();
        }, 500); // This should match the transition duration in CSS
    }, 3000); // This should match the animation duration in CSS
});