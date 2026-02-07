// 🆕 Phase 2: Debug Cleanup (Header logs removed)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

// --- Configuration ---
// 🆕 Constants Object
const CONFIG = {
    // Display
    MONITOR_WIDTH: 0.5,
    ASPECT_RATIO: window.innerWidth / window.innerHeight,
    DEFAULT_EYE_Z: 0.8,
    PROJECTION_DIST: -8.0,

    // 🆕 Camera Settings
    CAMERA_FOV: 30,
    CAMERA_NEAR: 0.1,
    CAMERA_FAR: 1000.0,
    CAMERA_POSITION: { x: 0, y: 1.0, z: 6.0 }, // 🆕 正面からの視点
    CAMERA_LOOKAT: { x: 0, y: 0.5, z: 0 },

    // 🆕 Animation
    FBX_POSITION_SCALE: 0.01,  // Mixamo to VRM position scale factor

    // 🆕 Face Tracking
    EYE_SCALE_X: 8.0,          // Horizontal eye tracking sensitivity
    EYE_SCALE_Y: 6.0,          // Vertical eye tracking sensitivity
    EYE_OFFSET_Y: 0.8,         // Y-axis offset for head height
    EYE_POS_Z: 1.2,            // Z-axis distance
    LERP_SPEED: 0.1,           // Eye position interpolation speed
    BLINK_THRESHOLD: 0.08,     // Blink detection threshold

    // 🆕 Scene
    BACKGROUND_COLOR: 0x000000,
    LIGHT_INTENSITY: 1.0,
    AMBIENT_INTENSITY: 0.5,

    // 🆕 Bone Rotation Offsets (in radians)
    ROTATION: {
        HIPS_Y: Math.PI,        // 180 degrees
        UPPER_LEG_X: Math.PI,   // 180 degrees
        UPPER_LEG_Y: Math.PI,   // 180 degrees
        LOWER_LEG_X: Math.PI / 2, // 90 degrees
        FOOT_X: -Math.PI / 2    // -90 degrees
    }
};

// 🆕 デバッグモード判定
const DEBUG_MODE = new URLSearchParams(window.location.search).has('debug');

// 🆕 デバッグログ関数
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('[DEBUG]', ...args);
    }
}

// --- Globals ---
let scene, camera, renderer;
let currentVrm = null;
let mixer = null;
let clock = new THREE.Clock();
let gridRoom = null;
// hologramStage removed entirely
let vrmLoaded = false;
let frameCount = 0;
let renderLogDone = false;
let boxHelper = null; // 🆕 削除予定だが参照エラー防止のため一旦nullで残す
let scaleLogDone = false;
let skeletonHelper = null; // 🆕 グローバルに保持

// --- MediaPipe ---
let faceMesh;
let cameraInput;
let userEyePosition = new THREE.Vector3(0, 0, CONFIG.DEFAULT_EYE_Z); // 🆕 CONFIG
const videoElement = document.getElementById('input_video');

// --- Init ---
async function init() {
    try {
        // 1. Scene Creation
        scene = new THREE.Scene();
        scene.background = new THREE.Color(CONFIG.BACKGROUND_COLOR); // 🆕 CONFIG

        // 【Lighting for Texture Recovery】
        const light = new THREE.DirectionalLight(0xffffff, CONFIG.LIGHT_INTENSITY); // 🆕 CONFIG
        light.position.set(0, 1.0, 1.0);
        scene.add(light);

        const ambient = new THREE.AmbientLight(0xffffff, CONFIG.AMBIENT_INTENSITY); // 🆕 CONFIG
        scene.add(ambient);

        // console.log("Scene Initialized (Cleaned)"); // 🆕 Removed log

        setupThreeJS();
        setupRoom();

        // 【カメラ固定】一度だけ設定
        camera.position.set(CONFIG.CAMERA_POSITION.x, CONFIG.CAMERA_POSITION.y, CONFIG.CAMERA_POSITION.z); // 🆕 CONFIG
        camera.lookAt(CONFIG.CAMERA_LOOKAT.x, CONFIG.CAMERA_LOOKAT.y, CONFIG.CAMERA_LOOKAT.z); // 🆕 CONFIG

        // 🆕 非同期でVRM読み込み
        await loadVRMAndFBXAsync('./VRM/kamuro.vrm', './Motions/Walking.fbx'); // 🆕 Walkingモーションでテスト

        // 🆕 非同期でフェイストラッキング開始
        await setupFaceMesh();

        animate();

    } catch (error) {
        showError('アプリケーションの初期化に失敗しました: ' + error.message);
    }
}

function setupThreeJS() {
    // Camera
    camera = new THREE.PerspectiveCamera(CONFIG.CAMERA_FOV, CONFIG.ASPECT_RATIO, CONFIG.CAMERA_NEAR, CONFIG.CAMERA_FAR); // 🆕 CONFIG
    camera.position.set(0, 0, 5); // Initial setup
    camera.updateProjectionMatrix();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.SoftShadowMap;

    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);
}

function setupRoom() {
    gridRoom = new THREE.Group();
    // Floor
    const planeGeo = new THREE.PlaneGeometry(50, 50);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.5, color: 0x000000 });
    const floorMesh = new THREE.Mesh(planeGeo, planeMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.8;
    floorMesh.receiveShadow = true;
    gridRoom.add(floorMesh);

    // Grid 
    const grid = new THREE.GridHelper(20, 40, 0x00aa00, 0x002200);
    grid.position.set(0, -0.801, -5.0);
    gridRoom.add(grid);

    scene.add(gridRoom);
}

function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

// --- Loading ---
// --- Loading ---
// 🆕 loadVRMAndFBXを非同期関数に変更
async function loadVRMAndFBXAsync(vrmUrl, fbxUrl) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        loader.load(vrmUrl, (gltf) => {
            try {
                const vrm = gltf.userData.vrm;
                cleanupScene();

                currentVrm = vrm;

                // Force Reset Position/Rotation/Scale (Local to Scene)
                vrm.scene.position.set(0, 0, 0);
                vrm.scene.rotation.y = 0; // Rotation Reset (Back to 0)
                vrm.scene.scale.set(1, 1, 1);

                vrm.scene.traverse((obj) => {
                    if (obj.isMesh) {
                        obj.castShadow = true;
                        obj.receiveShadow = false;

                        // 【Render Guard】
                        obj.frustumCulled = false;
                        obj.renderOrder = 999;

                        // MToon Material is kept securely.
                        // Re-enable skinning if needed? MToon handles it.
                        // We just ensure 'visible = true'
                        obj.visible = true;

                        obj.layers.set(0);
                    }
                });

                // 【EVIDENCE: DIRECT SCENE ADD】
                scene.add(vrm.scene);

                // 🆕 影用オブジェクトを非表示
                vrm.scene.traverse((obj) => {
                    if (obj.isMesh) {
                        const nameLower = obj.name.toLowerCase();
                        if (nameLower.includes('shadow') || nameLower.includes('aozame')) {
                            obj.visible = false;
                        }
                    }
                });

                // 🆕 Skeleton helper removed for production

                // console.log("VRM added directly to SCENE at (0,0,0). Textures RESTORED. Debug objects commented out, Skeleton Visible."); // 🆕 Removed log

                mixer = new THREE.AnimationMixer(vrm.scene);

                // FBX Loading ENABLED
                loadFBX(fbxUrl);

                resolve();

            } catch (error) {
                reject(error);
            }

        }, undefined, (err) => {
            console.error("VRM Error:", err);
            reject(new Error('VRMの読み込みに失敗しました: ' + err.message));
        });
    });
}

function cleanupScene() {
    if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
        currentVrm = null;
    }

    // 🆕 スケルトンヘルパーのクリーンアップ（不要になったが互換性のため残す）

    if (mixer) {
        mixer.stopAllAction();
        mixer = null;
    }
    scene.children.forEach(c => {
        if (c.type === 'Group' && c !== gridRoom) scene.remove(c);
    });
}

function loadFBX(url) {
    const loader = new FBXLoader();
    loader.load(url, (fbx) => {
        if (fbx.animations.length > 0) {
            retargetFBX(fbx.animations[0]);
        }
    }, undefined, (err) => console.warn("FBX Error:", err));
}

const mixamoMap = {
    'mixamorigHips': 'hips', 'Hips': 'hips',
    'mixamorigSpine': 'spine', 'Spine': 'spine',
    'mixamorigSpine1': 'chest', 'Spine1': 'chest',
    'mixamorigSpine2': 'upperChest', 'Spine2': 'upperChest',
    'mixamorigNeck': 'neck', 'Neck': 'neck',
    'mixamorigHead': 'head', 'Head': 'head',
    'mixamorigLeftShoulder': 'leftShoulder', 'LeftShoulder': 'leftShoulder',
    'mixamorigLeftArm': 'leftUpperArm', 'LeftArm': 'leftUpperArm',
    'mixamorigLeftForeArm': 'leftLowerArm', 'LeftForeArm': 'leftLowerArm',
    'mixamorigLeftHand': 'leftHand', 'LeftHand': 'leftHand',
    'mixamorigRightShoulder': 'rightShoulder', 'RightShoulder': 'rightShoulder',
    'mixamorigRightArm': 'rightUpperArm', 'RightArm': 'rightUpperArm',
    'mixamorigRightForeArm': 'rightLowerArm', 'RightForeArm': 'rightLowerArm',
    'mixamorigRightHand': 'rightHand', 'RightHand': 'rightHand',
    'mixamorigLeftUpLeg': 'leftUpperLeg', 'LeftUpLeg': 'leftUpperLeg',
    'mixamorigLeftLeg': 'leftLowerLeg', 'LeftLeg': 'leftLowerLeg',
    'mixamorigLeftFoot': 'leftFoot', 'LeftFoot': 'leftFoot',
    'mixamorigRightUpLeg': 'rightUpperLeg', 'RightUpLeg': 'rightUpperLeg',
    'mixamorigRightLeg': 'rightLowerLeg', 'RightLeg': 'rightLowerLeg',
    'mixamorigRightFoot': 'rightFoot', 'RightFoot': 'rightFoot'
};

// --- Retargeting with Safeguards ---
// --- Retargeting with Safeguards ---
function retargetFBX(clip) {
    if (!currentVrm || !mixer) return;
    const tracks = [];
    let scaledPositionTracks = 0;

    clip.tracks.forEach(t => {
        if (!t.name) return;

        const prop = t.name.split('.').pop();

        // 1. Position handling: We no longer delete, but we must map normally.
        // However, we need to check VRM mapping first.

        const base = t.name.split('.')[0].replace(/.*:/, '');
        let vrmName = mixamoMap[base] || mixamoMap['mixamorig' + base];

        // --- LEFT/RIGHT SWAP DISABLED ---
        // if (vrmName) {
        //     if (vrmName === 'leftUpperLeg') vrmName = 'rightUpperLeg';
        //     else if (vrmName === 'rightUpperLeg') vrmName = 'leftUpperLeg';
        //     else if (vrmName === 'leftLowerLeg') vrmName = 'rightLowerLeg';
        //     else if (vrmName === 'rightLowerLeg') vrmName = 'leftLowerLeg';
        //     else if (vrmName === 'leftFoot') vrmName = 'rightFoot';
        //     else if (vrmName === 'rightFoot') vrmName = 'leftFoot';
        //     else if (vrmName === 'leftToes') vrmName = 'rightToes';
        //     else if (vrmName === 'rightToes') vrmName = 'leftToes';
        // }

        if (vrmName) {
            const vrmNode = currentVrm.humanoid.getNormalizedBoneNode(vrmName);

            // Allow both quaternion and position
            if (vrmNode && (prop === 'quaternion' || prop === 'position')) {
                const newT = t.clone();
                newT.name = vrmNode.name + '.' + prop;

                // 2. Position Scaling (Use 0.01 to fix Air Chair but prevent Giant)
                if (prop === 'position') {
                    for (let i = 0; i < newT.values.length; i++) {
                        newT.values[i] *= CONFIG.FBX_POSITION_SCALE; // 🆕 CONFIG
                    }
                    scaledPositionTracks++;
                }

                // 3. Arm Freeze (Remove Arm/Hand/Shoulder tracks)
                const nameLower = vrmNode.name.toLowerCase();

                // [DEBUG]
                if (nameLower.includes('leg') || nameLower.includes('hips') || nameLower.includes('foot') || nameLower.includes('toe')) {
                    debugLog("Processing Track:", newT.name); // 🆕 debugLog に変更
                }

                // 🆕 Arm Freeze REMOVED - arm animations now enabled
                // if (nameLower.includes('arm') || nameLower.includes('hand') || nameLower.includes('shoulder')) {
                //     // Skip (Freeze)
                //     return;
                // }

                // 4. Rotation Correction
                if (prop === 'quaternion') {

                    // CASE A: Hips (Body Turn) -> Y-180
                    if (nameLower.includes('hips')) {
                        debugLog(" -> Applied Hips Y-Fix"); // 🆕 debugLog
                        const qPatch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), CONFIG.ROTATION.HIPS_Y); // 🆕 CONFIG
                        for (let i = 0; i < newT.values.length; i += 4) {
                            const qRaw = new THREE.Quaternion(newT.values[i], newT.values[i + 1], newT.values[i + 2], newT.values[i + 3]);
                            qRaw.multiply(qPatch);
                            newT.values[i] = qRaw.x;
                            newT.values[i + 1] = qRaw.y;
                            newT.values[i + 2] = qRaw.z;
                            newT.values[i + 3] = qRaw.w;
                        }
                    }
                    // CASE B: Legs/Feet -> Rotation Fixes
                    else if (nameLower.includes('leg') || nameLower.includes('foot') || nameLower.includes('toe')) {
                        let qFix = null;
                        let isUpperLeg = false;
                        let isFoot = false;
                        let isLowerLeg = false;

                        if (nameLower.includes('up') || nameLower.includes('thigh')) {
                            isUpperLeg = true;
                            // 🆕 Final: UpperLeg - X-180 + Y+180 (straight legs + correct foot direction)
                            debugLog(` -> UpperLeg (X-180 + Y+180 final): ${newT.name}`);
                            const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CONFIG.ROTATION.UPPER_LEG_X);
                            const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), CONFIG.ROTATION.UPPER_LEG_Y); // 🆕 Y+180度を追加
                            qFix = qX.multiply(qY);
                        } else if (nameLower.includes('foot') || nameLower.includes('toe')) {
                            // 🆕 Restored: Foot/Toe - X-90 rotation
                            isFoot = true;
                            debugLog(` -> Foot/Toe (X-90 restored): ${newT.name}`);
                            qFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CONFIG.ROTATION.FOOT_X);
                        } else {
                            // LowerLeg - X+90 + X-Invert
                            isLowerLeg = true;
                            debugLog(` -> LowerLeg (X+90 + X-Inv): ${newT.name}`); // 🆕 debugLog
                            qFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CONFIG.ROTATION.LOWER_LEG_X); // 🆕 CONFIG
                        }

                        for (let i = 0; i < newT.values.length; i += 4) {
                            const q = new THREE.Quaternion(newT.values[i], newT.values[i + 1], newT.values[i + 2], newT.values[i + 3]);
                            q.multiply(qFix);

                            // X-Invert for LowerLeg AND UpperLeg
                            newT.values[i] = (isLowerLeg || isUpperLeg) ? (q.x * -1.0) : q.x;
                            // Y-Invert for LowerLeg only
                            newT.values[i + 1] = isLowerLeg ? (q.y * -1.0) : q.y;
                            // 🆕 Z-Invert for LowerLeg only (Foot excluded to fix twisting)
                            newT.values[i + 2] = isLowerLeg ? (q.z * -1.0) : q.z;
                            newT.values[i + 3] = q.w;
                        }
                    }
                    // 🆕 CASE C: Arms -> Rotation Fixes
                    else if (nameLower.includes('arm') || nameLower.includes('hand') || nameLower.includes('shoulder')) {
                        debugLog(`[ARM DEBUG] Processing arm track: ${newT.name}`);

                        let qFix = null;
                        let isUpperArm = nameLower.includes('up') || (nameLower.includes('arm') && !nameLower.includes('fore') && !nameLower.includes('lower'));
                        let isLeftArm = nameLower.includes('left') || nameLower.includes('_l');

                        if (isUpperArm) {
                            // 🆕 左右判定を修正: 名前の末尾で判断
                            const isLeftArmFixed = nameLower.endsWith('arml') || nameLower.includes('left');
                            // 🆕 両腕が下がるように: 左はY+90、右はY-90
                            const yAngle = isLeftArmFixed ? Math.PI / 2 : -Math.PI / 2;
                            debugLog(` -> UpperArm (${isLeftArmFixed ? 'Left Y+90' : 'Right Y-90'}): ${newT.name}`);
                            qFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yAngle);

                            for (let i = 0; i < newT.values.length; i += 4) {
                                const q = new THREE.Quaternion(newT.values[i], newT.values[i + 1], newT.values[i + 2], newT.values[i + 3]);
                                q.premultiply(qFix); // 🆕 premultiply に変更
                                newT.values[i] = q.x;
                                newT.values[i + 1] = q.y;
                                newT.values[i + 2] = q.z;
                                newT.values[i + 3] = q.w;
                            }
                        }
                        // LowerArm/Hand/Shoulder - no rotation correction
                    }
                }

                tracks.push(newT);
            }
        }
    });

    // console.log("FIX: RESET Y-offsets. Applied UpperLegs X-180 + Z-Data Invert. LowerLegs X+90."); // 🆕 Removed log

    if (tracks.length > 0) {
        const newClip = new THREE.AnimationClip('FBXDance', clip.duration, tracks);
        const action = mixer.clipAction(newClip);
        action.play();
        // console.log("Animation Action Playing"); // 🆕 Removed log
    }
}

// --- Face & OffAxis ---
// 🆕 カメラ権限取得関数を追加
async function requestCameraPermission() {
    return new Promise((resolve, reject) => {
        const consentOverlay = document.getElementById('consent-overlay');
        const allowButton = document.getElementById('allow-camera');
        const denyButton = document.getElementById('deny-camera');

        if (!consentOverlay || !allowButton || !denyButton) {
            console.warn('Consent UI not found');
            resolve();
            return;
        }

        allowButton.onclick = () => {
            consentOverlay.style.display = 'none';
            resolve();
        };

        denyButton.onclick = () => {
            consentOverlay.style.display = 'none';
            reject(new Error('ユーザーがカメラアクセスを拒否しました'));
        };
    });
}

// 🆕 エラー表示関数を追加
function showError(message) {
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');

    if (errorContainer && errorMessage) {
        errorMessage.textContent = message;
        errorContainer.style.display = 'block';
    }

    console.error('[ERROR]', message);
}
async function setupFaceMesh() {
    try {
        // 🆕 カメラ権限を取得
        await requestCameraPermission();

        const video = document.getElementById('input_video');
        if (!video) {
            throw new Error('Video element not found');
        }

        faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        faceMesh.onResults(onFaceResults);

        cameraInput = new Camera(video, {
            onFrame: async () => {
                try {
                    await faceMesh.send({ image: video });
                } catch (error) {
                    console.error('Face mesh processing error:', error);
                }
            },
            width: 640,
            height: 480
        });

        // 🆕 カメラ起動エラーをキャッチ
        await cameraInput.start();

        // 🆕 成功したらビデオコンテナを表示
        const videoContainer = document.getElementById('video-container');
        if (videoContainer) {
            videoContainer.style.display = 'block';
        }

        console.log('Face tracking started successfully');

    } catch (error) {
        showError('カメラの起動に失敗しました。ブラウザの設定でカメラ権限を確認してください。');
    }
}

function onFaceResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        updateEye(results.multiFaceLandmarks[0]);
        updateExpr(results.multiFaceLandmarks[0]);
    }
}

function updateEye(lm) {
    const nose = lm[1];
    const scaleX = CONFIG.EYE_SCALE_X; // 🆕 CONFIG
    const scaleY = CONFIG.EYE_SCALE_Y; // 🆕 CONFIG
    let px = (nose.x - 0.5) * CONFIG.MONITOR_WIDTH * scaleX;
    let py = -(nose.y - 0.5) * (CONFIG.MONITOR_WIDTH / window.innerWidth * window.innerHeight) * scaleY;
    py += CONFIG.EYE_OFFSET_Y; // 🆕 CONFIG
    const pz = CONFIG.EYE_POS_Z; // 🆕 CONFIG
    const target = new THREE.Vector3(px, py, pz);
    userEyePosition.lerp(target, CONFIG.LERP_SPEED); // 🆕 CONFIG
}

function updateExpr(lm) {
    if (!currentVrm) return;
    const leftOpen = (lm[159].y - lm[145].y) / (lm[33].x - lm[133].x);
    const blink = Math.abs(leftOpen) < CONFIG.BLINK_THRESHOLD ? 1.0 : 0.0; // 🆕 CONFIG
    currentVrm.expressionManager.setValue('blink_l', blink);
    currentVrm.expressionManager.setValue('blink_r', blink);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Telemetry
    if (frameCount < 1) {
        // console.log("First Frame Rendered"); // 🆕 Removed log
        frameCount++;
    }

    // VRM更新
    if (currentVrm) {
        currentVrm.update(delta);
    }

    // アニメーション更新
    if (mixer) {
        mixer.update(delta);
    }

    // 🆕 カメラ位置を顔の動きに追従
    if (currentVrm && userEyePosition) {
        const sensitivity = 2.0;
        camera.position.x = userEyePosition.x * sensitivity;
        camera.position.y = userEyePosition.y * sensitivity + CONFIG.CAMERA_POSITION.y;
        camera.position.z = CONFIG.CAMERA_POSITION.z;
        camera.lookAt(CONFIG.CAMERA_LOOKAT.x, CONFIG.CAMERA_LOOKAT.y, CONFIG.CAMERA_LOOKAT.z);
    }

    // レンダリング
    renderer.render(scene, camera);
}

init();
