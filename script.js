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

// 🔍 前髪シャドウ問題調査用デバッグ関数
function debugBangsMeshes(vrm) {
    console.log('=== 🔍 BANGS DEBUG START ===');

    // 1. 全メッシュの一覧とマテリアル情報
    console.log('\n📦 [1] All Meshes in VRM:');
    vrm.scene.traverse((obj) => {
        if (obj.isMesh) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            const materialInfo = materials.map((mat, idx) => {
                const sideNames = { 0: 'FrontSide', 1: 'BackSide', 2: 'DoubleSide' };
                return `[${idx}] ${mat.name || 'unnamed'} (side=${sideNames[mat.side] || mat.side}, transparent=${mat.transparent})`;
            }).join(', ');

            console.log(`  ${obj.visible ? '✅' : '❌'} ${obj.name} | Materials: ${materialInfo}`);
        }
    });

    // 2. 前髪関連メッシュの詳細
    console.log('\n💇 [2] Bangs-related Meshes (前髪/bangs/hair):');
    vrm.scene.traverse((obj) => {
        if (obj.isMesh) {
            const nameLower = obj.name.toLowerCase();
            if (nameLower.includes('前髪') || nameLower.includes('bangs') || nameLower.includes('hair') || nameLower.includes('kami')) {
                console.log(`  📍 ${obj.name}:`);
                console.log(`     visible: ${obj.visible}`);
                console.log(`     renderOrder: ${obj.renderOrder}`);
                console.log(`     frustumCulled: ${obj.frustumCulled}`);

                const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                materials.forEach((mat, idx) => {
                    console.log(`     Material[${idx}]: ${mat.name || 'unnamed'}`);
                    console.log(`       - side: ${mat.side} (0=Front, 1=Back, 2=Double)`);
                    console.log(`       - transparent: ${mat.transparent}`);
                    console.log(`       - alphaTest: ${mat.alphaTest}`);
                    console.log(`       - depthWrite: ${mat.depthWrite}`);
                    console.log(`       - depthTest: ${mat.depthTest}`);
                    if (mat.isMToonMaterial) {
                        console.log(`       - [MToon] shadeColor: ${mat.shadeColor?.getHexString()}`);
                        console.log(`       - [MToon] outlineWidth: ${mat.outlineWidthFactor || mat.outlineWidth}`);
                    }
                });
            }
        }
    });

    // 3. Spring Bone 情報
    console.log('\n🌸 [3] Spring Bone Info:');
    if (vrm.springBoneManager) {
        const joints = vrm.springBoneManager.joints || [];
        console.log(`  Total joints: ${joints.length}`);

        // 前髪関連のボーンを抽出
        joints.forEach((joint, idx) => {
            const boneName = joint.bone?.name || 'unknown';
            if (boneName.toLowerCase().includes('前髪') || boneName.toLowerCase().includes('bangs') || boneName.toLowerCase().includes('hair')) {
                console.log(`  🔗 [${idx}] ${boneName}`);
            }
        });
    } else {
        console.log('  No Spring Bone Manager found');
    }

    // 4. 影/シャドウ関連メッシュ
    console.log('\n🌑 [4] Shadow-related Meshes:');
    vrm.scene.traverse((obj) => {
        if (obj.isMesh) {
            const nameLower = obj.name.toLowerCase();
            if (nameLower.includes('shadow') || nameLower.includes('kage') || nameLower.includes('影') || nameLower.includes('aozame')) {
                console.log(`  🔍 ${obj.name} (visible: ${obj.visible})`);
            }
        }
    });

    console.log('\n=== 🔍 BANGS DEBUG END ===');
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
        await loadVRMAndFBXAsync('./VRM/kamuro_1.vrm', './Motions/Walking.fbx');

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

    // === 🎭 シンプルなステージ背景 ===

    // 1. 床面 - 暗い色の床（MeshBasicMaterial = 照明不要）
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshBasicMaterial({
        color: 0x1a1a2e,  // 暗い紺色
        transparent: true,
        opacity: 0.9
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.81;  // グリッドの少し下
    gridRoom.add(floor);

    // 2. 背景壁 - グラデーション風（MeshBasicMaterial = 照明不要）
    const wallGeo = new THREE.PlaneGeometry(60, 30);
    const wallMat = new THREE.MeshBasicMaterial({
        color: 0x16213e   // 濃い青
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 10, -15);  // 背景に配置
    gridRoom.add(wall);

    // 3. グリッド（デバッグ用、プロモーション時は非表示にできる）
    const grid = new THREE.GridHelper(20, 40, 0x00aa00, 0x002200);
    grid.position.set(0, -0.8, -5.0);
    grid.visible = false;  // グリッド非表示（プロモーションモード）
    gridRoom.add(grid);

    scene.add(gridRoom);
    console.log('🎭 Stage setup complete (safe mode)');
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

                // 🔧 前髪グレー影問題: 調査中（修正は一時的に削除）

                // 🆕 Skeleton helper removed for production

                // 🔍 前髪シャドウ問題デバッグ
                debugBangsMeshes(vrm);

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
        console.log('=== 🎬 FBX DIAGNOSTIC START ===');
        console.log(`FBX URL: ${url}`);
        console.log(`Animation count: ${fbx.animations.length}`);
        if (fbx.animations.length > 0) {
            const clip = fbx.animations[0];
            console.log(`Clip name: ${clip.name}, duration: ${clip.duration}s, tracks: ${clip.tracks.length}`);

            // Show all track names to diagnose bone naming
            const boneNames = new Set();
            clip.tracks.forEach(t => {
                const base = t.name.split('.')[0].replace(/.*:/, '');
                const prop = t.name.split('.').pop();
                boneNames.add(base);
            });
            console.log('📦 All bone names in FBX:', [...boneNames].sort());

            // Check which ones match mixamoMap
            const matched = [];
            const unmatched = [];
            boneNames.forEach(name => {
                const vrmBone = mixamoMap[name] || mixamoMap['mixamorig' + name];
                if (vrmBone) {
                    matched.push(`${name} -> ${vrmBone}`);
                } else {
                    unmatched.push(name);
                }
            });
            console.log('✅ Matched bones:', matched);
            console.log('❌ Unmatched bones:', unmatched);

            retargetFBX(clip);
        } else {
            console.warn('⚠️ No animations found in FBX file!');
        }
        console.log('=== 🎬 FBX DIAGNOSTIC END ===');
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
        const base = t.name.split('.')[0].replace(/.*:/, '');
        let vrmName = mixamoMap[base] || mixamoMap['mixamorig' + base] || null;

        if (vrmName) {
            const vrmNode = currentVrm.humanoid.getNormalizedBoneNode(vrmName);

            // Allow both quaternion and position
            if (vrmNode && (prop === 'quaternion' || prop === 'position')) {
                const newT = t.clone();
                newT.name = vrmNode.name + '.' + prop;

                // Position Scaling
                if (prop === 'position') {
                    for (let i = 0; i < newT.values.length; i++) {
                        newT.values[i] *= CONFIG.FBX_POSITION_SCALE;
                    }
                    scaledPositionTracks++;
                }

                // Rotation Correction
                if (prop === 'quaternion') {
                    const nameLower = vrmNode.name.toLowerCase();

                    {
                        // ========== Mixamo Rotation Corrections ==========

                        // CASE A: Hips (Body Turn) -> Y-180
                        if (nameLower.includes('hips')) {
                            debugLog(" -> Applied Hips Y-Fix");
                            const qPatch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), CONFIG.ROTATION.HIPS_Y);
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
                                debugLog(` -> UpperLeg (X-180 + Y+180 final): ${newT.name}`);
                                const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CONFIG.ROTATION.UPPER_LEG_X);
                                const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), CONFIG.ROTATION.UPPER_LEG_Y);
                                qFix = qX.multiply(qY);
                            } else if (nameLower.includes('foot') || nameLower.includes('toe')) {
                                isFoot = true;
                                debugLog(` -> Foot/Toe (X-90 restored): ${newT.name}`);
                                qFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CONFIG.ROTATION.FOOT_X);
                            } else {
                                isLowerLeg = true;
                                debugLog(` -> LowerLeg (X+90 + X-Inv): ${newT.name}`);
                                qFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CONFIG.ROTATION.LOWER_LEG_X);
                            }

                            for (let i = 0; i < newT.values.length; i += 4) {
                                const q = new THREE.Quaternion(newT.values[i], newT.values[i + 1], newT.values[i + 2], newT.values[i + 3]);
                                q.multiply(qFix);
                                newT.values[i] = (isLowerLeg || isUpperLeg) ? (q.x * -1.0) : q.x;
                                newT.values[i + 1] = isLowerLeg ? (q.y * -1.0) : q.y;
                                newT.values[i + 2] = isLowerLeg ? (q.z * -1.0) : q.z;
                                newT.values[i + 3] = q.w;
                            }
                        }
                        // CASE C: Arms -> Rotation Fixes
                        else if (nameLower.includes('arm') || nameLower.includes('hand') || nameLower.includes('shoulder')) {
                            debugLog(`[ARM DEBUG] Processing arm track: ${newT.name}`);

                            let qFix = null;
                            let isUpperArm = nameLower.includes('up') || (nameLower.includes('arm') && !nameLower.includes('fore') && !nameLower.includes('lower'));

                            if (isUpperArm) {
                                const isLeftArmFixed = nameLower.endsWith('arml') || nameLower.includes('left');
                                const yAngle = isLeftArmFixed ? Math.PI / 2 : -Math.PI / 2;
                                debugLog(` -> UpperArm (${isLeftArmFixed ? 'Left Y+90' : 'Right Y-90'}): ${newT.name}`);
                                qFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yAngle);

                                for (let i = 0; i < newT.values.length; i += 4) {
                                    const q = new THREE.Quaternion(newT.values[i], newT.values[i + 1], newT.values[i + 2], newT.values[i + 3]);
                                    q.premultiply(qFix);
                                    newT.values[i] = q.x;
                                    newT.values[i + 1] = q.y;
                                    newT.values[i + 2] = q.z;
                                    newT.values[i + 3] = q.w;
                                }
                            }
                        }
                    }
                }

                tracks.push(newT);
            }
        }
    });

    // console.log("FIX: RESET Y-offsets. Applied UpperLegs X-180 + Z-Data Invert. LowerLegs X+90."); // 🆕 Removed log

    console.log(`🎯 Retarget result: ${tracks.length} tracks created from ${clip.tracks.length} original tracks`);
    if (tracks.length > 0) {
        const newClip = new THREE.AnimationClip('FBXDance', clip.duration, tracks);
        const action = mixer.clipAction(newClip);
        action.play();
        console.log(`✅ Animation playing: ${tracks.length} tracks, duration: ${clip.duration}s`);
    } else {
        console.warn('⚠️ No tracks were retargeted! Animation will NOT play.');
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
