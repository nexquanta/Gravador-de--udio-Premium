const btnRecord = document.getElementById('btnRecord');
const btnStop = document.getElementById('btnStop');
const btnDownload = document.getElementById('btnDownload');
const timerDisplay = document.getElementById('timer');
const canvas = document.getElementById('visualizer');
const statusBadge = document.getElementById('statusBadge');
const playlist = document.getElementById('playlist');
const canvasCtx = canvas.getContext('2d');

let mediaRecorder;
let audioChunks = [];
let startTime;
let timerInterval;
let audioContext;
let analyser;
let dataArray;
let source;
let animationId;
let isRecording = false;

// Initialize Audio Context (must be user triggered ideally, but we'll init on first record)
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // Controls bar density
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    }
}

// Draw Visualizer
function draw() {
    if (!isRecording && !analyser) return;

    animationId = requestAnimationFrame(draw);

    if (analyser) {
        analyser.getByteFrequencyData(dataArray);
    } else {
        // Fallback or empty state if needed, but we usually stop drawing or draw flat line
    }

    const width = canvas.width;
    const height = canvas.height;

    canvasCtx.clearRect(0, 0, width, height);

    // Style for bars
    const gradient = canvasCtx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#f43f5e'); // Primary
    gradient.addColorStop(1, '#8b5cf6'); // Purple

    canvasCtx.fillStyle = gradient;

    const barWidth = (width / dataArray.length) * 2.5;
    let barHeight;
    let x = 0;

    // Symmetric drawing
    // We'll draw from center? Or just simple left-to-right.
    // Let's do a center mirrored look for "premium" feel.

    // Actually, simple bars often look cleaner if done right.
    // Let's try centered mirroring.

    // We only use half the array for one side to mirror it?
    // Or iterate full array.

    // Let's stick to standard left-to-right but adding some spacing and rounding
    for (let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i] / 2; // Scale down

        // Draw mostly in the middle vertically
        const y = (height - barHeight) / 2;

        // Top half
        canvasCtx.fillRect(x, height / 2, barWidth - 1, -barHeight);
        // Bottom half (reflection) - lower opacity
        canvasCtx.fillStyle = 'rgba(244, 63, 94, 0.5)';
        canvasCtx.fillRect(x, height / 2, barWidth - 1, barHeight * 0.5);

        // Reset fill for next top bar
        canvasCtx.fillStyle = gradient;

        x += barWidth;
    }
}

function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const totalSeconds = Math.floor(elapsedTime / 1000);
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerDisplay.textContent = '00:00';
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        initAudioContext();
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            addRecordingToPlaylist(audioUrl, audioBlob);

            // Cleanup visualizer
            cancelAnimationFrame(animationId);
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

            // Stop tracks to release mic
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;
        startTimer();
        draw();
        updateUIState(true);

    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Não foi possível acessar o microfone. Verifique as permissões.");
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        stopTimer();
        updateUIState(false);
    }
}

function updateUIState(recording) {
    if (recording) {
        btnRecord.classList.add('recording');
        btnRecord.disabled = true; // Disable record button while recording
        btnStop.disabled = false;
        btnDownload.disabled = true;
        statusBadge.textContent = "Gravando...";
        statusBadge.classList.add('recording');
        document.querySelector('.play-icon').style.display = 'none';
    } else {
        btnRecord.classList.remove('recording');
        btnRecord.disabled = false;
        btnStop.disabled = true;
        // btnDownload enabled only if there is something (handled in addRecording)
        statusBadge.textContent = "Pronto";
        statusBadge.classList.remove('recording');
        document.querySelector('.play-icon').style.display = 'block';
    }
}

function addRecordingToPlaylist(url, blob) {
    const item = document.createElement('div');
    item.className = 'audio-item';

    const date = new Date();
    const name = `Gravação ${date.toLocaleTimeString()}`;

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;

    // Download Logic for the main download button (defaults to last recording)
    btnDownload.disabled = false;
    btnDownload.onclick = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `gravacao-${Date.now()}.webm`;
        a.click();
    };

    // Item Layout
    item.innerHTML = `
        <div class="audio-info">
            <div class="audio-name">${name}</div>
            <div class="audio-date">${date.toLocaleDateString()}</div>
        </div>
    `;

    // Append Audio element
    item.appendChild(audio);

    // Add individual download button
    const dlBtn = document.createElement('button');
    dlBtn.className = 'action-btn';
    dlBtn.innerHTML = '<span class="material-symbols-rounded">download</span>';
    dlBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.webm`;
        a.click();
    };
    item.appendChild(dlBtn);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn';
    delBtn.innerHTML = '<span class="material-symbols-rounded">delete</span>';
    delBtn.onclick = () => {
        item.remove();
        if (playlist.children.length === 0) btnDownload.disabled = true;
    };
    item.appendChild(delBtn);

    playlist.prepend(item);
}


// Event Listeners
btnRecord.addEventListener('click', startRecording);
btnStop.addEventListener('click', stopRecording);

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'KeyR') {
        if (!isRecording) startRecording();
    }
    if (e.code === 'KeyS' || e.code === 'Escape') {
        if (isRecording) stopRecording();
    }
});
