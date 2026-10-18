import * as THREE from "three"; // Three.js
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"; // GLB加载器
import {
    FaceLandmarker,
    FilesetResolver,
    DrawingUtils
} from "@mediapipe/tasks-vision"; // MediaPipe

const video = document.getElementById("video"); // 摄像头
const canvas = document.getElementById("canvas"); // MediaPipe画布
const threeCanvas = document.getElementById("three-canvas"); // Three.js画布
const statusText = document.getElementById("status"); // 状态文字
const ctx = canvas.getContext("2d"); // 2D绘图环境

let faceLandmarker = null; // 人脸检测器
let lastVideoTime = -1; // 上一帧视频时间

let threeScene = null; // Three.js场景
let threeCamera = null; // Three.js相机
let threeRenderer = null; // Three.js渲染器
let hairClip = null; // 发卡模型

const WASM_PATH = "/wasm"; // MediaPipe WASM
const MODEL_PATH = "/models/face_landmarker.task"; // 人脸模型

const RIGHT_TEMPLE = [251, 284, 332, 297, 338]; // 右侧太阳穴附近关键点


function getAveragePoint(landmarks, indices) {
    let x = 0;
    let y = 0;
    let z = 0;

    for (const index of indices) {
        x += landmarks[index].x;
        y += landmarks[index].y;
        z += landmarks[index].z;
    }

    return {
        x: x / indices.length,
        y: y / indices.length,
        z: z / indices.length
    };
}


function initThree() {
    threeScene = new THREE.Scene(); // 创建场景

    threeCamera = new THREE.PerspectiveCamera(
        60,
        640 / 480,
        0.1,
        100
    ); // 创建透视相机

    threeCamera.position.z = 5; // 相机后移

    const ambientLight = new THREE.AmbientLight(0xffffff, 2); // 环境光
    threeScene.add(ambientLight); // 加入环境光

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2); // 主光
    directionalLight.position.set(2, 3, 5); // 设置光源位置
    threeScene.add(directionalLight); // 加入主光

    threeRenderer = new THREE.WebGLRenderer({
        canvas: threeCanvas,
        alpha: true,
        antialias: true
    }); // 创建渲染器

    threeRenderer.setPixelRatio(window.devicePixelRatio); // 设置像素比
    threeRenderer.setSize(640, 480, false); // 设置画布大小
    threeCanvas.style.zIndex = "10"; // 放到最上层

    loadHairClip(); // 加载发卡
    renderThree(); // 开始渲染
}


function loadHairClip() {
    const loader = new GLTFLoader(); // 创建GLB加载器

    loader.load(
        "/models/test.glb",
        (gltf) => {
            hairClip = gltf.scene; // 获取模型

            hairClip.scale.set(1, 1,1); // 模型大小

            hairClip.position.set(0, 0, 0); // 初始位置

            threeScene.add(hairClip); // 加入场景

            console.log("发卡模型加载成功", hairClip);
        },
        undefined,
        (error) => {
            console.error("发卡模型加载失败", error);
        }
    );
}


function renderThree() {
    requestAnimationFrame(renderThree); // 持续渲染

    if (threeRenderer && threeScene && threeCamera) {
        threeRenderer.render(threeScene, threeCamera); // 渲染
    }
}


function resizeCanvas() {
    canvas.width = video.videoWidth; // 设置MediaPipe画布宽度
    canvas.height = video.videoHeight; // 设置MediaPipe画布高度

    threeRenderer.setSize(
        video.videoWidth,
        video.videoHeight,
        false
    ); // 设置Three.js画布
}


async function createFaceLandmarker() {
    try {
        statusText.textContent = "正在加载 MediaPipe..."; // 状态

        const vision = await FilesetResolver.forVisionTasks(WASM_PATH); // 加载WASM

        faceLandmarker = await FaceLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath: MODEL_PATH
                },
                runningMode: "VIDEO",
                numFaces: 1,
                outputFaceBlendshapes: false,
                outputFacialTransformationMatrixes: false
            }
        ); // 创建人脸检测器

        console.log("Face Landmarker 创建成功");

        await startCamera(); // 启动摄像头
    } catch (error) {
        console.error("MediaPipe初始化失败:", error);
        statusText.textContent = "MediaPipe初始化失败";
    }
}


async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480
            },
            audio: false
        }); // 获取摄像头

        video.srcObject = stream; // 设置视频源

        await video.play(); // 播放视频

        resizeCanvas(); // 设置画布大小

        console.log("摄像头启动成功");

        statusText.textContent = "正在检测人脸..."; // 状态

        detectFace(); // 开始检测
    } catch (error) {
        console.error("摄像头启动失败:", error);
        statusText.textContent = "摄像头启动失败";
    }
}


function detectFace() {
    if (!faceLandmarker || video.readyState < 2) {
        requestAnimationFrame(detectFace);
        return;
    }

    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;

        const result = faceLandmarker.detectForVideo(
            video,
            performance.now()
        ); // 检测人脸

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        ); // 清除上一帧

        if (
            result.faceLandmarks &&
            result.faceLandmarks.length > 0
        ) {
            const landmarks = result.faceLandmarks[0]; // 获取第一张脸

            drawFaceMesh(landmarks); // 绘制人脸网格
            updateHairClip(landmarks); // 更新发卡位置

            statusText.textContent = "检测到人脸"; // 状态
        } else {
            statusText.textContent = "没有检测到人脸"; // 状态

            if (hairClip) {
                hairClip.visible = false; // 没人脸时隐藏发卡
            }
        }
    }

    requestAnimationFrame(detectFace); // 下一帧
}


function drawFaceMesh(landmarks) {
    const drawingUtils = new DrawingUtils(ctx); // 创建绘图工具

    // drawingUtils.drawConnectors(
    //     landmarks,
    //     FaceLandmarker.FACE_LANDMARKS_TESSELATION,
    //     {
    //         color: "#ffffff",
    //         lineWidth: 1
    //     }
    // ); // 绘制人脸网格
}


function updateHairClip(landmarks) {
    if (!hairClip) return; // 模型还没加载

    const rightTemple = getAveragePoint(
        landmarks,
        RIGHT_TEMPLE
    ); // 获取右侧头部锚点

    const threeX = -(rightTemple.x - 0.5) * 7.4; // X位置
    const threeY = -(rightTemple.y - 0.5) * 4.8; // Y位置
    const threeZ = -(rightTemple.z - 0.5) * 1.8;

    hairClip.position.x = threeX; // 设置X
    hairClip.position.y = threeY; // 设置Y
    hairClip.position.z = threeZ; // 设置Z

    const leftEye = landmarks[33]; // 左眼
    const rightEye = landmarks[263]; // 右眼

    const dx = rightEye.x - leftEye.x; // 双眼X距离
    const dy = rightEye.y - leftEye.y; // 双眼Y距离

const eyeDistance = Math.sqrt(
    dx * dx + dy * dy
); // 当前脸部大小

const baseEyeDistance = 0.176; // 你的正常使用距离，需要根据实际数值调整

const distanceScale =
    eyeDistance / baseEyeDistance; // 计算远近比例

const baseScale = 1; // 你当前已经调好的发卡大小

const finalScale =
    baseScale * distanceScale; // 在原有大小基础上缩放

hairClip.scale.set(
    finalScale,
    finalScale,
    finalScale
); // 设置最终大小


    const roll = Math.atan2(dy, dx); // 计算歪头角度

    const nose = landmarks[1]; // 鼻尖
    const eyeCenter = {
        x: (leftEye.x + rightEye.x) / 2,
        y: (leftEye.y + rightEye.y) / 2,
        z: (leftEye.z + rightEye.z) / 2
    }; // 双眼中心

    const yaw = Math.atan2(
        nose.x - eyeCenter.x,
        -(nose.z - eyeCenter.z)
    ); // 计算左右转头

    hairClip.rotation.z = roll; // 跟随歪头
    hairClip.rotation.y = yaw * -0.8; // 跟随左右转头

    hairClip.visible = true; // 显示发卡
}




initThree(); // 初始化Three.js
createFaceLandmarker(); // 初始化MediaPipe