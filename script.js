console.log("FIX: RESET Y-offsets. Applied UpperLegs X-180 + Z-Data Invert. LowerLegs X+90.");
console.log("--- SCRIPT.JS LOADED (VERSION: Z_DATA_INVERT) ---");
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

// --- Configuration ---
const MONITOR_WIDTH = 0.5;
const ASPECT_RATIO = window.innerWidth / window.innerHeight;
const DEFAULT_EYE_Z = 0.8;
const PROJECTION_DIST = -8.0;

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
let boxHelper = null;
let scaleLogDone = false;

// --- MediaPipe ---
let faceMesh;
let cameraInput;
let userEyePosition = new THREE.Vector3(0, 0, DEFAULT_EYE_Z);
const videoElement = document.getElementById('input_video');

// --- Init ---
function init() {
    // 1. Scene Creation
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // 【Lighting for Texture Recovery】
    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(0, 1.0, 1.0);
    scene.add(light);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    // 【生存確認】赤いキューブ -> REMOVED
    // const testGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    // const testMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    // const testMesh = new THREE.Mesh(testGeo, testMat);
    // testMesh.position.set(0, 1.0, 0); // Head height
    // scene.add(testMesh); // REMOVED

    // 3. Diagnostic help at origin -> REMOVED
    // const originAxes = new THREE.AxesHelper(10);
    // scene.add(originAxes);

    console.log("Scene Initialized (Cleaned)");

    setupThreeJS();
    setupRoom();

    loadVRMAndFBX('./VRM/kamuro.vrm', './Motions/dance.fbx');
    setupFaceMesh();

    // 【カメラ固定】 全身・足元が見える位置に調整
    camera.position.set(0, 1.0, 6.0);
    camera.lookAt(0, 0.5, 0);

    animate();
}

function setupThreeJS() {
    // Camera
    camera = new THREE.PerspectiveCamera(30, ASPECT_RATIO, 0.1, 1000.0);
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
function loadVRMAndFBX(vrmUrl, fbxUrl) {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(vrmUrl, (gltf) => {
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

        // Debug Helpers -> REMOVED
        // boxHelper = new THREE.BoxHelper(vrm.scene, 0xffff00);
        // scene.add(boxHelper);

        const skeletonHelper = new THREE.SkeletonHelper(vrm.scene);
        scene.add(skeletonHelper);

        console.log("VRM added directly to SCENE at (0,0,0). Textures RESTORED. Debug objects commented out, Skeleton Visible.");

        mixer = new THREE.AnimationMixer(vrm.scene);

        // FBX Loading ENABLED
        loadFBX(fbxUrl);

    }, undefined, (err) => console.error("VRM Error:", err));
}

function cleanupScene() {
    if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
        currentVrm = null;
    }
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

        // --- LEFT/RIGHT SWAP for Legs/Feet ---
        if (vrmName) {
            if (vrmName === 'leftUpperLeg') vrmName = 'rightUpperLeg';
            else if (vrmName === 'rightUpperLeg') vrmName = 'leftUpperLeg';
            else if (vrmName === 'leftLowerLeg') vrmName = 'rightLowerLeg';
            else if (vrmName === 'rightLowerLeg') vrmName = 'leftLowerLeg';
            else if (vrmName === 'leftFoot') vrmName = 'rightFoot';
            else if (vrmName === 'rightFoot') vrmName = 'leftFoot';
            else if (vrmName === 'leftToes') vrmName = 'rightToes';
            else if (vrmName === 'rightToes') vrmName = 'leftToes';
        }

        if (vrmName) {
            const vrmNode = currentVrm.humanoid.getNormalizedBoneNode(vrmName);

            // Allow both quaternion and position
            if (vrmNode && (prop === 'quaternion' || prop === 'position')) {
                const newT = t.clone();
                newT.name = vrmNode.name + '.' + prop;

                // 2. Position Scaling (Use 0.01 to fix Air Chair but prevent Giant)
                if (prop === 'position') {
                    for (let i = 0; i < newT.values.length; i++) {
                        newT.values[i] *= 0.01;
                    }
                    scaledPositionTracks++;
                }

                // 3. Arm Freeze (Remove Arm/Hand/Shoulder tracks)
                const nameLower = vrmNode.name.toLowerCase();

                // [DEBUG]
                if (nameLower.includes('leg') || nameLower.includes('hips') || nameLower.includes('foot') || nameLower.includes('toe')) {
                    console.log("Processing Track:", newT.name);
                }

                if (nameLower.includes('arm') || nameLower.includes('hand') || nameLower.includes('shoulder')) {
                    // Skip (Freeze)
                    return;
                }

                // 4. Rotation Correction
                if (prop === 'quaternion') {

                    // CASE A: Hips (Body Turn) -> Y-180
                    if (nameLower.includes('hips')) {
                        console.log(" -> Applied Hips Y-Fix");
                        const qPatch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI); // Y-180
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

                        if (nameLower.includes('up') || nameLower.includes('thigh')) {
                            isUpperLeg = true;
                            // UpperLeg - X-180 + Y+180 to face forward
                            console.log(` -> UpperLeg (X-180 + Y+180 + Z-Inv): ${newT.name}`);
                            const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
                            const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
                            qFix = qX.multiply(qY);
                        } else if (nameLower.includes('foot') || nameLower.includes('toe')) {
                            // Foot/Toe - X-90 only
                            isFoot = true;
                            console.log(` -> Foot/Toe (X-90): ${newT.name}`);
                            qFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
                        } else {
                            // LowerLeg - X+90 only
                            console.log(` -> LowerLeg (X+90): ${newT.name}`);
                            qFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
                        }

                        for (let i = 0; i < newT.values.length; i += 4) {
                            const q = new THREE.Quaternion(newT.values[i], newT.values[i + 1], newT.values[i + 2], newT.values[i + 3]);
                            q.multiply(qFix);

                            newT.values[i] = q.x;
                            newT.values[i + 1] = q.y;
                            // Approach C: Z-Invert for ALL leg parts
                            newT.values[i + 2] = q.z * -1.0;
                            newT.values[i + 3] = q.w;
                        }
                    }
                }

                tracks.push(newT);
            }
        }
    });

    console.log("FIX: RESET Y-offsets. Applied UpperLegs X-180 + Z-Data Invert. LowerLegs X+90.");

    if (tracks.length > 0) {
        const newClip = new THREE.AnimationClip('FBXDance', clip.duration, tracks);
        const action = mixer.clipAction(newClip);
        action.play();
        console.log("Animation Action Playing");
    }
}

// --- Face & OffAxis ---
function setupFaceMesh() {
    const video = document.getElementById('input_video');
    if (!video) return;

    faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    faceMesh.onResults(onFaceResults);

    cameraInput = new Camera(video, {
        onFrame: async () => await faceMesh.send({ image: video }),
        width: 640,
        height: 480
    });
    cameraInput.start();
}

function onFaceResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        updateEye(results.multiFaceLandmarks[0]);
        updateExpr(results.multiFaceLandmarks[0]);
    }
}

function updateEye(lm) {
    const nose = lm[1];
    const scaleX = 8.0;
    const scaleY = 6.0;
    let px = (nose.x - 0.5) * MONITOR_WIDTH * scaleX;
    let py = -(nose.y - 0.5) * (MONITOR_WIDTH / window.innerWidth * window.innerHeight) * scaleY;
    py += 0.8;
    const pz = 1.2;
    const target = new THREE.Vector3(px, py, pz);
    userEyePosition.lerp(target, 0.1);
}

function updateExpr(lm) {
    if (!currentVrm) return;
    const leftOpen = (lm[159].y - lm[145].y) / (lm[33].x - lm[133].x);
    const blink = Math.abs(leftOpen) < 0.08 ? 1.0 : 0.0;
    currentVrm.expressionManager.setValue('blink_l', blink);
    currentVrm.expressionManager.setValue('blink_r', blink);
}

function animate() {
    requestAnimationFrame(animate);

    const d = clock.getDelta();

    // Telemetry
    if (frameCount < 1) {
        console.log("First Frame Rendered");
        frameCount++;
    }

    // 【カメラ】前から確認用アングル
    camera.position.set(0, 1.0, 8.0);
    camera.lookAt(0, 0.8, 0);

    if (currentVrm) {
        currentVrm.update(d);
        // Direct Scene Rotation interaction
        currentVrm.scene.rotation.y = 0; // FIX: No global rotation (Back to 0)
    }

    // Animation ENABLED
    if (mixer) mixer.update(d);

    // Equality Fix: Reset to origin every frame (Back to 0 for Debug)
    if (currentVrm) {
        currentVrm.scene.scale.set(1.0, 1.0, 1.0);
        currentVrm.scene.position.set(0, 0, 0);
    }

    if (boxHelper) {
        boxHelper.update();
    }

    renderer.render(scene, camera);
}

init();
