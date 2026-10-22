// ================= 1. 初始化建筑和窗户 =================
const buildingsContainer = document.getElementById('buildings-container');
const numBuildings = 7;
const buildings = [];

function initBuildings() {
    for (let i = 0; i < numBuildings; i++) {
        const building = document.createElement('div');
        building.className = 'building';
        
        // 随机建筑高度和宽度
        const height = 200 + Math.random() * 200;
        const width = 80 + Math.random() * 40;
        building.style.height = `${height}px`;
        building.style.width = `${width}px`;

        // 生成窗户网格
        const cols = Math.floor(width / 30);
        const rows = Math.floor(height / 40);
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const win = document.createElement('div');
                win.className = 'window';
                win.dataset.state = 'off'; // 记录状态
                
                // 手动添加点击事件 (方便鼠标测试，虽然最终是手势交互)
                win.addEventListener('click', () => toggleWindow(win));
                
                building.appendChild(win);
            }
        }
        buildingsContainer.appendChild(building);
        buildings.push(building);
    }
}
initBuildings();

// ================= 2. 窗户状态逻辑 =================
// 开关窗户
function toggleWindow(win) {
    if (win.dataset.state === 'off') {
        // 开灯
        win.dataset.state = 'on';
        win.classList.add('on');
        // 随机颜色 (HSL色彩空间，随机色相)
        const randomHue = Math.floor(Math.random() * 360);
        win.style.backgroundColor = `hsl(${randomHue}, 80%, 60%)`;
        win.style.color = `hsl(${randomHue}, 80%, 60%)`; // 用于 box-shadow
    } else {
        // 关灯
        win.dataset.state = 'off';
        win.classList.remove('on');
        win.style.backgroundColor = '#0f0f1a';
        win.style.color = 'transparent';
    }
}

// 获取所有已点亮的窗户
function getLitWindows() {
    return Array.from(document.querySelectorAll('.window.on'));
}

// ================= 3. 手势识别逻辑 (MediaPipe) =================
const videoElement = document.querySelector('.input_video');

// 状态锁，防止单次手势触发多次
let isPinching = false;
let isFistClosed = false;
let isBlinking = false;

function onResults(results) {
    // 如果没有检测到手，重置状态
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        isPinching = false;
        return;
    }

    const hands = results.multiHandLandmarks;

    // --- 手势 3: 双手握拳熄灭 ---
    if (hands.length === 2) {
        const isLeftFist = checkFist(hands[0]);
        const isRightFist = checkFist(hands[1]);
        
        if (isLeftFist && isRightFist) {
            if (!isFistClosed) {
                turnOffAllLights();
                isFistClosed = true;
            }
        } else {
            isFistClosed = false;
        }
        return; // 双手模式下不执行单手操作
    }

    // 单手模式
    const landmarks = hands[0];
    const indexTip = landmarks[8]; // 食指指尖
    const thumbTip = landmarks[4]; // 拇指指尖

    // --- 手势 2: 五指张开闪烁 ---
    if (checkOpenPalm(landmarks)) {
        startBlinking();
    } else {
        stopBlinking();
    }

    // --- 手势 1: 捏合 (拇指+食指) 点击窗户 ---
    // 计算拇指和食指的距离 (使用3D坐标)
    const distance = Math.hypot(
        thumbTip.x - indexTip.x,
        thumbTip.y - indexTip.y,
        thumbTip.z - indexTip.z
    );
    
    const pinchThreshold = 0.05; // 捏合距离阈值

    if (distance < pinchThreshold) {
        if (!isPinching) {
            isPinching = true;
            
            // 将归一化的坐标转换为屏幕坐标
            // 因为视频是镜像的，所以 x 需要反向处理 (1 - x)
            const screenX = (1 - indexTip.x) * window.innerWidth;
            const screenY = indexTip.y * window.innerHeight;
            
            // 找到光标下的元素
            const element = document.elementFromPoint(screenX, screenY);
            
            // 如果点到了窗户，触发开关
            if (element && element.classList.contains('window')) {
                toggleWindow(element);
            }
        }
    } else {
        isPinching = false;
    }
}

// 检测是否握拳 (所有手指指尖低于第二关节)
function checkFist(landmarks) {
    let closedFingers = 0;
    // 检查食指(8), 中指(12), 无名指(16), 小指(20)
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    
    for (let i = 0; i < 4; i++) {
        if (landmarks[tips[i]].y > landmarks[pips[i]].y) {
            closedFingers++;
        }
    }
    return closedFingers === 4;
}

// 检测是否五指张开 (所有手指指尖高于第二关节)
function checkOpenPalm(landmarks) {
    let openFingers = 0;
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    
    for (let i = 0; i < 4; i++) {
        if (landmarks[tips[i]].y < landmarks[pips[i]].y) {
            openFingers++;
        }
    }
    return openFingers >= 4; // 允许少量误差
}

// 闪烁控制
function startBlinking() {
    if (isBlinking) return;
    isBlinking = true;
    const litWindows = getLitWindows();
    litWindows.forEach((win, index) => {
        // 设置随机延迟，产生交错闪烁的效果
        win.style.animationDelay = `${Math.random()}s`;
        win.classList.add('blinking');
    });
}

function stopBlinking() {
    if (!isBlinking) return;
    isBlinking = false;
    const windows = document.querySelectorAll('.window');
    windows.forEach(win => {
        win.classList.remove('blinking');
        win.style.animationDelay = '';
    });
}

// 全部熄灭
function turnOffAllLights() {
    stopBlinking();
    const litWindows = getLitWindows();
    // 增加过渡效果，实现逐渐熄灭
    litWindows.forEach(win => {
        win.style.transition = 'all 2s ease'; // 2秒缓慢熄灭
        win.classList.remove('on');
        win.style.backgroundColor = '#0f0f1a';
        win.dataset.state = 'off';
    });
    
    // 2秒后恢复正常过渡时间
    setTimeout(() => {
        document.querySelectorAll('.window').forEach(win => {
            win.style.transition = 'all 0.3s ease';
        });
    }, 2000);
}

// ================= 4. 启动 MediaPipe 摄像头 =================
const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 2, // 需要识别双手
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
});

// 启动摄像头
camera.start().catch(error => {
    console.error("摄像头启动失败，请确保在 HTTPS 或 localhost 下运行", error);
    alert("无法访问摄像头，请确保在 HTTPS 或 localhost 环境运行！");
});