// renderer.js
const openBtn = document.getElementById('btn-open');
const playlistEl = document.getElementById('playlist');
const audio = document.getElementById('audio');
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const seek = document.getElementById('seek');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const volume = document.getElementById('volume');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const albumArt = document.getElementById('album-art');
const dragHint = document.getElementById('drag-hint');

let playlist = []; // { path, name, duration }
let currentIndex = -1;
let isSeeking = false;

function formatTime(seconds){
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

function renderPlaylist(){
  playlistEl.innerHTML = '';
  playlist.forEach((item, idx) => {
    const li = document.createElement('li');
    li.dataset.index = idx;
    if (idx === currentIndex) li.classList.add('playing');

    const meta = document.createElement('div');
    meta.className = 'track-meta';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = item.name || `Track ${idx + 1}`;
    const metaLine = document.createElement('div');
    metaLine.className = 'meta';
    metaLine.textContent = item.duration ? formatTime(item.duration) : 'local file';

    meta.appendChild(title);
    meta.appendChild(metaLine);

    const actions = document.createElement('div');
    const removeBtn = document.createElement('button');
    removeBtn.className = 'small-btn';
    removeBtn.innerText = '✖';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      removeFromPlaylist(idx);
    });

    actions.appendChild(removeBtn);

    li.appendChild(meta);
    li.appendChild(actions);

    li.addEventListener('dblclick', () => {
      playIndex(idx);
    });

    playlistEl.appendChild(li);
  });
}

function removeFromPlaylist(index){
  if (index === currentIndex){
    audio.pause();
    currentIndex = -1;
  }
  playlist.splice(index, 1);
  if (index < currentIndex) currentIndex--;
  renderPlaylist();
}

function playIndex(index){
  if (index < 0 || index >= playlist.length) return;
  currentIndex = index;
  const track = playlist[currentIndex];
  audio.src = pathToFileUrl(track.path);
  audio.play();
  updateTrackInfo(track);
  renderPlaylist();
}

function updateTrackInfo(track){
  trackTitle.textContent = track.name || 'Unknown';
  trackArtist.textContent = track.path.split(/[/\\]/).slice(-2, -1)[0] || 'Local file';
  // album art placeholder stays same (could be extended to read metadata)
}

function pathToFileUrl(filePath){
  // on Windows need to ensure correct file URI
  // Using new URL with file: works
  try {
    const url = new URL(`file://${filePath}`);
    return url.href;
  } catch(e){
    // fallback: replace backslashes
    const normalized = filePath.replace(/\\/g, '/').replace(/ /g, '%20');
    return `file://${normalized}`;
  }
}

openBtn.addEventListener('click', async () => {
  const files = await window.electronAPI.openFiles();
  if (!files || files.length === 0) return;
  addFiles(files);
});

function addFiles(files){
  // files: array of full paths
  files.forEach(f => {
    const name = f.split(/[/\\]/).pop();
    playlist.push({ path: f, name });
  });
  // attempt to prime durations by loading metadata offscreen sequentially
  primeDurationsForNewTracks();
  if (currentIndex === -1 && playlist.length > 0){
    playIndex(0);
  } else {
    renderPlaylist();
  }
}

function primeDurationsForNewTracks(){
  // To get durations, create a temp audio element per file (async).
  // We'll iterate through any tracks without duration.
  playlist.forEach((item, idx) => {
    if (item.duration) return;
    const tmp = document.createElement('audio');
    tmp.preload = 'metadata';
    tmp.src = pathToFileUrl(item.path);
    tmp.addEventListener('loadedmetadata', () => {
      item.duration = tmp.duration;
      renderPlaylist();
      tmp.src = ''; // free
    });
    tmp.addEventListener('error', () => {
      tmp.src = '';
    });
  });
}

// audio events
audio.addEventListener('timeupdate', () => {
  if (!isSeeking) {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    seek.value = pct || 0;
  }
  currentTimeEl.textContent = formatTime(audio.currentTime);
});

audio.addEventListener('loadedmetadata', () => {
  durationEl.textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', () => {
  playNext();
});

playBtn.addEventListener('click', () => {
  if (audio.paused) {
    if (!audio.src && playlist.length > 0) {
      playIndex(0);
      return;
    }
    audio.play();
    playBtn.textContent = '⏸';
  } else {
    audio.pause();
    playBtn.textContent = '▶️';
  }
});

prevBtn.addEventListener('click', () => {
  playPrev();
});
nextBtn.addEventListener('click', () => {
  playNext();
});

function playNext(){
  if (playlist.length === 0) return;
  let next = currentIndex + 1;
  if (next >= playlist.length) next = 0;
  playIndex(next);
}

function playPrev(){
  if (playlist.length === 0) return;
  let prev = currentIndex - 1;
  if (prev < 0) prev = playlist.length - 1;
  playIndex(prev);
}

seek.addEventListener('input', () => {
  isSeeking = true;
});
seek.addEventListener('change', () => {
  isSeeking = false;
  if (audio.duration) {
    audio.currentTime = (seek.value / 100) * audio.duration;
  }
});

volume.addEventListener('input', () => {
  audio.volume = parseFloat(volume.value);
});

// Drag & drop files onto whole window
document.addEventListener('dragover', (ev) => {
  ev.preventDefault();
  dragHint.style.opacity = '0.6';
});
document.addEventListener('dragleave', (ev) => {
  dragHint.style.opacity = '1';
});
document.addEventListener('drop', (ev) => {
  ev.preventDefault();
  dragHint.style.opacity = '1';
  const dt = ev.dataTransfer;
  if (!dt) return;
  const files = [...dt.files].map(f => f.path).filter(Boolean);
  // filter audio extensions
  const supported = ['mp3','wav','ogg','m4a','flac'];
  const audioFiles = files.filter(p => {
    const ext = p.split('.').pop().toLowerCase();
    return supported.includes(ext);
  });
  addFiles(audioFiles);
});

// handle play/pause button text state with audio events
audio.addEventListener('play', () => playBtn.textContent = '⏸');
audio.addEventListener('pause', () => playBtn.textContent = '▶️');

// make initial UI
renderPlaylist();
