// ================= 0. 动态生成闪烁星光 =================
function createTwinklingStars() {
    const container = document.getElementById('twinkling-stars');
    for (let i = 0; i < 60; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = Math.random() * 2 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 50}%`; 
        const animDuration = Math.random() * 2 + 1.5;
        star.style.animationDuration = `${animDuration}s`;
        star.style.animationDelay = `${Math.random() * 2}s`;
        container.appendChild(star);
    }
}
createTwinklingStars();

// ================= 1. 生成窗户 =================
document.querySelectorAll('.windows-wrapper').forEach(wrapper => {
    const rows = parseInt(wrapper.dataset.rows);
    const cols = 4; // 强制锁定每层 4 个
    const totalWindows = cols * rows;

    for (let i = 0; i < totalWindows; i++) {
        const win = document.createElement('div');
        win.className = 'window';
        win.dataset.state = 'off';
        win.addEventListener('click', () => toggleWindow(win));
        wrapper.appendChild(win);
    }
});

// ================= 2. 交互核心逻辑 =================
// 参考图片提取的通透荧光色
const neonColors = [
    '#a8f0d1', // 薄荷绿
    '#a8d8f0', // 冰蓝
    '#f5e6a8', // 鹅黄
    '#d8a8f0', // 淡紫
    '#f0a8c0', // 樱花粉
    '#c0f0a8', // 嫩绿
    '#f0c8a8', // 暖桃
    '#e8e8f0'  // 纯亮白
];

const cursorElement = document.getElementById('hand-cursor');

function toggleWindow(win) {
    if (win.dataset.state === 'off') {
        win.dataset.state = 'on';
        win.classList.add('on');
        const randomColor = neonColors[Math.floor(Math.random() * neonColors.length)];
        win.style.color = randomColor;
    } else {
        win.dataset.state = 'off';
        win.classList.remove('on');
        win.style.color = 'transparent';
    }
}

function getLitWindows() {
    return Array.from(document.querySelectorAll('.window.on'));
}

// ================= 3. 手势识别 =================
const videoElement = document.querySelector('.input_video');

let isPinching = false;
let isFistClosed = false;
let isBlinking = false;

function onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        isPinching = false;
        cursorElement.style.opacity = '0';
        return;
    }

    const hands = results.multiHandLandmarks;
    const landmarks = hands[0];
    const indexTip = landmarks[8]; 
    const thumbTip = landmarks[4]; 

    const screenX = (1 - indexTip.x) * window.innerWidth;
    const screenY = indexTip.y * window.innerHeight;
    
    cursorElement.style.opacity = '1';
    cursorElement.style.left = `${screenX}px`;
    cursorElement.style.top = `${screenY}px`;

    if (hands.length === 2) {
        if (checkFist(hands[0]) && checkFist(hands[1])) {
            if (!isFistClosed) {
                turnOffAllLights();
                isFistClosed = true;
            }
        } else {
            isFistClosed = false;
        }
        return; 
    }

    if (checkOpenPalm(landmarks)) {
        startBlinking();
    } else {
        stopBlinking();
    }

    const distance = Math.hypot(
        thumbTip.x - indexTip.x,
        thumbTip.y - indexTip.y,
        thumbTip.z - indexTip.z
    );
    
    const pinchThreshold = 0.045; 

    if (distance < pinchThreshold) {
        cursorElement.classList.add('pinching');

        if (!isPinching) {
            isPinching = true;
            const element = document.elementFromPoint(screenX, screenY);
            if (element && element.classList.contains('window')) {
                toggleWindow(element);
            }
        }
    } else {
        isPinching = false;
        cursorElement.classList.remove('pinching');
    }
}

function checkFist(landmarks) {
    let closed = 0;
    const tips = [8, 12, 16, 20], pips = [6, 10, 14, 18];
    for (let i = 0; i < 4; i++) {
        if (landmarks[tips[i]].y > landmarks[pips[i]].y) closed++;
    }
    return closed === 4;
}

function checkOpenPalm(landmarks) {
    let open = 0;
    const tips = [8, 12, 16, 20], pips = [6, 10, 14, 18];
    for (let i = 0; i < 4; i++) {
        if (landmarks[tips[i]].y < landmarks[pips[i]].y) open++;
    }
    return open >= 4;
}

function startBlinking() {
    if (isBlinking) return;
    isBlinking = true;
    getLitWindows().forEach(win => {
        win.style.animationDelay = `${Math.random() * 0.8}s`;
        win.classList.add('blinking');
    });
}

function stopBlinking() {
    if (!isBlinking) return;
    isBlinking = false;
    document.querySelectorAll('.window').forEach(win => {
        win.classList.remove('blinking');
        win.style.animationDelay = '';
    });
}

function turnOffAllLights() {
    stopBlinking();
    getLitWindows().forEach(win => {
        win.style.transition = 'all 2s ease'; 
        win.classList.remove('on');
        win.style.color = 'transparent';
        win.dataset.state = 'off';
    });
    setTimeout(() => {
        document.querySelectorAll('.window').forEach(win => {
            win.style.transition = 'all 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)';
        });
    }, 2000);
}

// ================= 4. 初始化 MediaPipe =================
const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});

camera.start().catch(error => {
    console.error("请确保在 HTTPS 或 localhost 环境下运行", error);
});