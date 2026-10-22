// ================= 0. 动态生成闪烁星光 =================
function createTwinklingStars() {
    const container = document.getElementById('twinkling-stars');
    const starCount = 60; // 星星数量

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        
        // 随机大小 (1px 到 3px)
        const size = Math.random() * 2 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        
        // 随机位置
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 80}%`; // 限制在屏幕上方 80% 区域，避免和房子底部重叠太多
        
        // 随机动画时长和延迟，错开闪烁频率
        const animDuration = Math.random() * 2 + 1.5; // 1.5s 到 3.5s
        const animDelay = Math.random() * 2; 
        star.style.animationDuration = `${animDuration}s`;
        star.style.animationDelay = `${animDelay}s`;

        container.appendChild(star);
    }
}
createTwinklingStars();

// ================= 1. 生成窗户 =================
document.querySelectorAll('.windows-wrapper').forEach(wrapper => {
    const cols = parseInt(wrapper.dataset.cols);
    const rows = parseInt(wrapper.dataset.rows);
    const totalWindows = cols * rows;

    for (let i = 0; i < totalWindows; i++) {
        const win = document.createElement('div');
        win.className = 'window';
        win.dataset.state = 'off';
        // 鼠标点击测试
        win.addEventListener('click', () => toggleWindow(win));
        wrapper.appendChild(win);
    }
});

// ================= 2. 交互核心逻辑 =================
const neonColors = [
    '#ffd166', '#ff6b6b', '#4dabf7', 
    '#69db7c', '#ff922b', '#cc5de8'
];

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
        return;
    }

    const hands = results.multiHandLandmarks;

    // 双手握拳：全灭
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

    // 单手操作
    const landmarks = hands[0];
    const indexTip = landmarks[8]; 
    const thumbTip = landmarks[4]; 

    // 张开手掌：闪烁
    if (checkOpenPalm(landmarks)) {
        startBlinking();
    } else {
        stopBlinking();
    }

    // 捏合：点灯
    const distance = Math.hypot(
        thumbTip.x - indexTip.x,
        thumbTip.y - indexTip.y,
        thumbTip.z - indexTip.z
    );
    
    const pinchThreshold = 0.045; 

    if (distance < pinchThreshold) {
        if (!isPinching) {
            isPinching = true;
            
            const screenX = (1 - indexTip.x) * window.innerWidth;
            const screenY = indexTip.y * window.innerHeight;
            
            const element = document.elementFromPoint(screenX, screenY);
            
            if (element && element.classList.contains('window')) {
                toggleWindow(element);
            }
        }
    } else {
        isPinching = false;
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