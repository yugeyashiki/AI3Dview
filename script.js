
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

// --- MediaPipe ---
let faceMesh;
let cameraInput;
let userEyePosition = new THREE.Vector3(0, 0, DEFAULT_EYE_Z);
const videoElement = document.getElementById('input_video');

// --- Init ---
function init() {
    setupThreeJS();
    setupRoom();
    loadVRMAndFBX('./VRM/kamuro.vrm', './Motions/dance.fbx');
    setupFaceMesh();
    animate();
}

function setupThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    camera = new THREE.PerspectiveCamera(30, ASPECT_RATIO, 0.1, 100.0); // Narrower FOV for deep view
    camera.position.set(0, 0, DEFAULT_EYE_Z);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.SoftShadowMap;

    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2.0, 5.0, 5.0);
    dirLight.castShadow = true;
    dirLight.shadow.bias = -0.005;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    scene.add(dirLight);

    window.addEventListener('resize', onWindowResize, false);
}

function setupRoom() {
    gridRoom = new THREE.Group();
    // Floor (Shadow Catcher)
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

        // Position
        vrm.scene.position.set(0, -0.8, PROJECTION_DIST);
        vrm.scene.rotation.y = Math.PI;
        vrm.scene.scale.set(1, 1, 1);

        vrm.scene.traverse((obj) => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = false;
                obj.frustumCulled = false;
            }
        });

        scene.add(vrm.scene);

        mixer = new THREE.AnimationMixer(vrm.scene);
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

function retargetFBX(clip) {
    if (!currentVrm || !mixer) return;
    const tracks = [];

    // Standard Retargeting with Root Motion Fix
    clip.tracks.forEach(t => {
        if (!t.name) return;
        const base = t.name.split('.')[0].replace(/.*:/, '');
        const prop = t.name.split('.').pop();
        const vrmName = mixamoMap[base] || mixamoMap['mixamorig' + base];

        if (vrmName) {
            const vrmNode = currentVrm.humanoid.getNormalizedBoneNode(vrmName);
            if (vrmNode) {
                const newT = t.clone();
                newT.name = vrmNode.name + '.' + prop;

                if (prop === 'position' && vrmName === 'hips') {
                    // Root Motion Fix
                    for (let i = 0; i < newT.values.length; i += 3) {
                        newT.values[i] = 0.0;    // X
                        newT.values[i + 1] *= 0.01; // Y (Scale)
                        newT.values[i + 2] = 0.0;  // Z
                    }
                    tracks.push(newT);
                } else if (prop === 'quaternion') {
                    tracks.push(newT);
                }
            }
        }
    });

    if (tracks.length > 0) {
        const newClip = new THREE.AnimationClip('FBXDance', clip.duration, tracks);
        const action = mixer.clipAction(newClip);
        action.play();
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

    // Sensitivity
    const scaleX = 8.0;
    const scaleY = 6.0;

    // Calculate raw position from face
    let px = (nose.x - 0.5) * MONITOR_WIDTH * scaleX;
    let py = -(nose.y - 0.5) * (MONITOR_WIDTH / window.innerWidth * window.innerHeight) * scaleY;

    // Add Height Offset for "Looking Down" feel
    py += 0.8;

    const pz = 1.2; // Camera distance

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

function updateCameraLogic() {
    // 1. Move Camera with Head
    camera.position.copy(userEyePosition);

    // 2. Lock View on Model Center (Fixes "Out of Frame")
    const target = new THREE.Vector3(0, -0.8 + 0.8, PROJECTION_DIST); // Look at chest/head height
    camera.lookAt(target);

    // 3. (Optional) Distortion removed for stability. 
    // This creates "Parallax" (Moving camera) without "Off-Axis Skew".
    // It's robust and prevents the glitch.
}

function animate() {
    requestAnimationFrame(animate);
    const d = clock.getDelta();

    updateCameraLogic();

    if (currentVrm) {
        currentVrm.update(d);
        currentVrm.scene.position.set(0, -0.8, PROJECTION_DIST);
        currentVrm.scene.rotation.y = Math.PI + (userEyePosition.x * 0.3); // Interactive rotation
    }

    if (mixer) mixer.update(d);

    renderer.render(scene, camera);
}

init();
