
import {
    PoseLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const $ = id => document.getElementById(id);

const videoL = $("leftVideo");
const videoR = $("rightVideo");

const canvasL = $("leftCanvas");
const canvasR = $("rightCanvas");

let cameraStream = null;
let detector = null;
let cameraRunning = false;
let facingMode = "environment";
let lastFrame = -1;
let vrEnabled = false;

// Conexões do esqueleto corporal
const skeleton = [
    [0,1],[1,2],[2,3],[3,7],
    [0,4],[4,5],[5,6],[6,8],
    [9,10],
    [11,12],
    [11,13],[13,15],
    [12,14],[14,16],
    [15,17],[15,19],[15,21],
    [16,18],[16,20],[16,22],
    [11,23],[12,24],
    [23,24],
    [23,25],[25,27],
    [24,26],[26,28],
    [27,29],[29,31],
    [28,30],[30,32],
    [27,31],[28,32]
];

function status(message) {
    $("status").textContent = message;
}

// Inicializar modelo de rastreamento
async function initializeDetector() {

    if (detector) return;

    status("Carregando inteligência artificial...");

    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    detector = await PoseLandmarker.createFromOptions(
        vision,
        {
            baseOptions: {
                modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

                delegate: "GPU"
            },

            runningMode: "VIDEO",
            numPoses: 1,

            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
        }
    );
}

// Desenhar esqueleto
function drawSkeleton(canvas, landmarks, width, height) {

    const ctx = canvas.getContext("2d");

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    if (!landmarks) return;

    ctx.lineWidth = Math.max(3, width / 240);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "#32f5a0";
    ctx.fillStyle = "#ffffff";

    // Desenhar ossos
    for (const [a, b] of skeleton) {

        const p1 = landmarks[a];
        const p2 = landmarks[b];

        if (!p1 || !p2) continue;

        if (
            (p1.visibility ?? 1) < 0.35 ||
            (p2.visibility ?? 1) < 0.35
        ) continue;

        ctx.beginPath();

        ctx.moveTo(
            p1.x * width,
            p1.y * height
        );

        ctx.lineTo(
            p2.x * width,
            p2.y * height
        );

        ctx.stroke();
    }

    // Desenhar articulações
    for (const point of landmarks) {

        if ((point.visibility ?? 1) < 0.35) continue;

        ctx.beginPath();

        ctx.arc(
            point.x * width,
            point.y * height,
            Math.max(3, width / 180),
            0,
            Math.PI * 2
        );

        ctx.fill();
    }
}

// Iniciar câmera
async function startCamera() {

    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
        status("Câmera indisponível. Use HTTPS.");
        return;
    }

    facingMode = $("camera").value;

    try {

        status("Solicitando acesso à câmera...");

        cameraStream = await navigator.mediaDevices.getUserMedia({

            audio: false,

            video: {
                facingMode: {
                    ideal: facingMode
                },

                width: {
                    ideal: 1280
                },

                height: {
                    ideal: 720
                },

                frameRate: {
                    ideal: 30,
                    max: 30
                }
            }

        });

        videoL.srcObject = cameraStream;
        videoR.srcObject = cameraStream;

        await Promise.all([
            videoL.play(),
            videoR.play()
        ]);

        await initializeDetector();

        cameraRunning = true;

        $("placeholder").style.display = "none";

        $("tracking").textContent = "Ativo";

        status("Câmera funcionando. Enquadre o corpo inteiro.");

        requestAnimationFrame(update);

    } catch (error) {

        const errors = {
            NotAllowedError: "Permissão da câmera negada.",
            NotFoundError: "Câmera não encontrada.",
            NotReadableError: "Câmera ocupada por outro aplicativo."
        };

        status(errors[error.name] || error.message);

        $("tracking").textContent = "Erro";
    }
}

// Parar câmera
function stopCamera() {

    cameraRunning = false;

    if (cameraStream) {

        cameraStream.getTracks().forEach(track => {
            track.stop();
        });

        cameraStream = null;
    }

    videoL.srcObject = null;
    videoR.srcObject = null;
}

// Loop de rastreamento
function update() {

    if (!cameraRunning) return;

    if (
        videoL.readyState >= 2 &&
        videoL.currentTime !== lastFrame
    ) {

        lastFrame = videoL.currentTime;

        try {

            const result = detector.detectForVideo(
                videoL,
                performance.now()
            );

            const landmarks =
                result.landmarks?.[0] || null;

            const width = videoL.videoWidth;
            const height = videoL.videoHeight;

            drawSkeleton(
                canvasL,
                landmarks,
                width,
                height
            );

            drawSkeleton(
                canvasR,
                landmarks,
                width,
                height
            );

            if (landmarks) {

                const visible = landmarks.filter(point =>
                    (point.visibility ?? 1) >= 0.35
                ).length;

                $("person").textContent = "Detectada";

                $("points").textContent =
                    visible + " / 33";

            } else {

                $("person").textContent = "Não detectado";
                $("points").textContent = "0 / 33";
            }

        } catch (error) {

            status("Erro no rastreamento: " + error.message);
        }
    }

    requestAnimationFrame(update);
}

// Alternar câmera frontal/traseira
$("switch").addEventListener("click", async () => {

    const next =
        $("camera").value === "environment"
        ? "user"
        : "environment";

    $("camera").value = next;

    await startCamera();
});

$("camera").addEventListener("change", startCamera);

$("start").addEventListener("click", startCamera);

// Modo VR
$("vr").addEventListener("click", async () => {

    vrEnabled = !vrEnabled;

    document.body.classList.toggle(
        "vr",
        vrEnabled
    );

    $("vr").textContent = vrEnabled
        ? "Desativar modo VR"
        : "Ativar modo VR";

    if (vrEnabled) {

        status("Modo VR dividido ativado.");

        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
        } catch (_) {}

    } else {

        status("Modo VR desativado.");

        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {});
        }
    }
});

// Giroscópio
$("gyro").addEventListener("click", async () => {

    try {

        if (
            typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function"
        ) {

            const permission =
                await DeviceOrientationEvent.requestPermission();

            if (permission !== "granted") {
                throw new Error("Permissão negada.");
            }
        }

        window.addEventListener(
            "deviceorientation",
            event => {

                if (event.alpha === null) return;

                $("movement").textContent =
                    "X " + Math.round(event.beta || 0) +
                    "° | Y " + Math.round(event.gamma || 0) +
                    "°";
            }
        );

        $("gyro").textContent = "Giroscópio ativo";

        status("Giroscópio funcionando.");

    } catch (error) {

        status("Não foi possível ativar: " + error.message);
    }
});

// Aviso ao trocar de aplicativo
document.addEventListener("visibilitychange", () => {

    if (document.hidden && cameraStream) {

        status("Página em segundo plano. A câmera pode ser pausada.");

    } else if (!document.hidden && cameraRunning) {

        status("Página voltou ao primeiro plano.");
    }
});

// Encerramento
window.addEventListener("beforeunload", stopCamera);
