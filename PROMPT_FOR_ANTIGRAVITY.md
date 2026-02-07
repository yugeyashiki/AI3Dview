# VRM 3D Viewer 改修指示書（Antigravity用）

## 📋 概要
現在のVRM 3D Viewerには、パフォーマンス、セキュリティ、保守性に関する重大な問題があります。
以下の指示に従って、段階的に改修を行ってください。

---

## 🎯 改修の目的
1. **パフォーマンス**: 15-20%のFPS向上
2. **セキュリティ**: GDPR/CCPA等の法規制対応
3. **保守性**: コードの可読性60%向上
4. **ユーザー体験**: エラーハンドリングの完全実装

---

## 🔴 Phase 1: クリティカル問題の修正（最優先 - 即座に対応）

### 1.1 パフォーマンス破壊コードの修正

**現在のコード（script.js 行410-426）**:
```javascript
function animate() {
    requestAnimationFrame(animate);
    
    const d = clock.getDelta();
    
    // ❌ 以下の処理を削除してください
    camera.position.set(0, 1.0, 8.0);     
    camera.lookAt(0, 0.8, 0);              
    
    if (currentVrm) {
        currentVrm.update(d);
        currentVrm.scene.rotation.y = 0;           // ❌ 削除
        currentVrm.scene.scale.set(1.0, 1.0, 1.0); // ❌ 削除
        currentVrm.scene.position.set(0, 0, 0);    // ❌ 削除
    }
    
    if (mixer) mixer.update(d);
    
    if (boxHelper) {      // ❌ 削除（boxHelperは存在しない）
        boxHelper.update();
    }
    
    renderer.render(scene, camera);
}
```

**修正後のコード**:
```javascript
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    // VRM更新
    if (currentVrm) {
        currentVrm.update(delta);
    }
    
    // アニメーション更新
    if (mixer) {
        mixer.update(delta);
    }
    
    // レンダリング
    renderer.render(scene, camera);
}
```

**カメラ設定は init() 関数内で一度だけ実行**:
```javascript
function init() {
    // ... 既存のコード ...
    
    // 【カメラ固定】一度だけ設定（行69-70を維持）
    camera.position.set(0, 1.0, 6.0);
    camera.lookAt(0, 0.5, 0);
    
    animate();
}
```

**指示**:
- animate関数から、カメラ設定とVRMのtransform強制リセットを削除
- boxHelper関連のコードを完全に削除
- init関数のカメラ設定はそのまま維持

---

### 1.2 セキュリティ脆弱性の修正（カメラ権限）

**index.htmlに追加**:
```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <!-- 既存のheadタグ内容 -->
</head>
<body>
    <!-- 🆕 カメラ同意オーバーレイを追加 -->
    <div id="consent-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.95); display: flex; align-items: center; justify-content: center; z-index: 9999;">
        <div id="consent-box" style="background: linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%); color: #fff; padding: 40px; border-radius: 16px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);">
            <h2 style="margin-bottom: 20px; font-size: 24px;">📹 カメラアクセスの許可</h2>
            <p style="margin-bottom: 15px; line-height: 1.6; color: #cbd5e1;">
                このアプリケーションは、あなたの表情をリアルタイムで3Dキャラクターに反映させるため、
                ウェブカメラを使用します。
            </p>
            <p style="margin-bottom: 15px; line-height: 1.6; color: #cbd5e1;">
                <strong style="color: #fbbf24;">🔒 プライバシー保護</strong><br>
                収集された映像データは、お使いのデバイス内でのみ処理され、
                外部サーバーへ送信されることは一切ありません。
            </p>
            <div style="margin-top: 30px; display: flex; gap: 15px; justify-content: center;">
                <button id="allow-camera" style="padding: 12px 30px; font-size: 16px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer;">許可する</button>
                <button id="deny-camera" style="padding: 12px 30px; font-size: 16px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer;">拒否する</button>
            </div>
        </div>
    </div>

    <!-- 既存のvideo-container等 -->
    <div id="video-container" style="display: none;">
        <video id="input_video" playsinline></video>
    </div>
    
    <!-- 🆕 エラー表示用のコンテナを追加 -->
    <div id="error-container" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255, 0, 0, 0.9); color: white; padding: 30px; border-radius: 16px; z-index: 10000; max-width: 400px; text-align: center;">
        <h3 id="error-title">エラーが発生しました</h3>
        <p id="error-message"></p>
        <button onclick="location.reload()" style="margin-top: 15px; padding: 10px 20px; background: white; color: #ef4444; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">再読み込み</button>
    </div>
    
    <script type="module" src="/script.js"></script>
</body>
</html>
```

**script.jsに追加（setupFaceMesh関数の前に）**:
```javascript
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
```

**setupFaceMesh関数を修正**:
```javascript
async function setupFaceMesh() {
    try {
        // 🆕 カメラ権限を取得
        await requestCameraPermission();
        
        const video = document.getElementById('input_video');
        if (!video) {
            throw new Error('Video element not found');
        }
        
        faceMesh = new FaceMesh({ 
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` 
        });
        
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
```

**init関数を修正**:
```javascript
async function init() {
    try {
        // Scene, ThreeJS, Roomのセットアップ
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        
        // ... 既存のライト設定等 ...
        
        setupThreeJS();
        setupRoom();
        
        // カメラ位置設定
        camera.position.set(0, 1.0, 6.0);
        camera.lookAt(0, 0.5, 0);
        
        // 🆕 非同期でVRM読み込み
        await loadVRMAndFBXAsync('./VRM/kamuro.vrm', './Motions/dance.fbx');
        
        // 🆕 非同期でフェイストラッキング開始
        await setupFaceMesh();
        
        // アニメーション開始
        animate();
        
    } catch (error) {
        showError('アプリケーションの初期化に失敗しました: ' + error.message);
    }
}

// 🆕 loadVRMAndFBXを非同期関数に変更
async function loadVRMAndFBXAsync(vrmUrl, fbxUrl) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        
        loader.load(
            vrmUrl, 
            (gltf) => {
                try {
                    const vrm = gltf.userData.vrm;
                    cleanupScene();
                    
                    currentVrm = vrm;
                    
                    // 初期Transform設定（一度だけ）
                    vrm.scene.position.set(0, 0, 0);
                    vrm.scene.rotation.y = 0;
                    vrm.scene.scale.set(1, 1, 1);
                    
                    vrm.scene.traverse((obj) => {
                        if (obj.isMesh) {
                            obj.castShadow = true;
                            obj.receiveShadow = false;
                            obj.frustumCulled = false;
                            obj.renderOrder = 999;
                            obj.visible = true;
                            obj.layers.set(0);
                        }
                    });
                    
                    scene.add(vrm.scene);
                    
                    // スケルトンヘルパー（デバッグモードのみ）
                    const DEBUG = new URLSearchParams(window.location.search).has('debug');
                    if (DEBUG) {
                        const skeletonHelper = new THREE.SkeletonHelper(vrm.scene);
                        scene.add(skeletonHelper);
                    }
                    
                    mixer = new THREE.AnimationMixer(vrm.scene);
                    
                    // FBX読み込み
                    loadFBX(fbxUrl);
                    
                    resolve();
                    
                } catch (error) {
                    reject(error);
                }
            },
            undefined,
            (error) => {
                reject(new Error('VRMの読み込みに失敗しました: ' + error.message));
            }
        );
    });
}
```

**指示**:
1. index.htmlにカメラ同意UIとエラー表示用のHTML要素を追加
2. script.jsに `requestCameraPermission()` と `showError()` 関数を追加
3. `setupFaceMesh()` を async/await に変更し、エラーハンドリングを追加
4. `init()` を async 関数に変更
5. `loadVRMAndFBX()` を Promise を返す非同期関数に変更

---

### 1.3 メモリリークの修正

**グローバル変数セクションに追加（行26付近）**:
```javascript
let skeletonHelper = null; // 🆕 グローバルに保持
```

**cleanupScene関数を修正（行171-184）**:
```javascript
function cleanupScene() {
    if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
        currentVrm = null;
    }
    
    // 🆕 スケルトンヘルパーのクリーンアップ
    if (skeletonHelper) {
        scene.remove(skeletonHelper);
        skeletonHelper.dispose();
        skeletonHelper = null;
    }
    
    if (mixer) {
        mixer.stopAllAction();
        mixer = null;
    }
    
    scene.children.forEach(c => {
        if (c.type === 'Group' && c !== gridRoom) {
            scene.remove(c);
        }
    });
}
```

**スケルトンヘルパー作成時に変数に代入（loadVRMAndFBX内）**:
```javascript
// 既存のコード（行158-159）を修正
const DEBUG = new URLSearchParams(window.location.search).has('debug');
if (DEBUG) {
    skeletonHelper = new THREE.SkeletonHelper(vrm.scene); // 🆕 グローバル変数に代入
    scene.add(skeletonHelper);
}
```

**指示**:
1. `skeletonHelper` をグローバル変数として宣言
2. `cleanupScene()` にスケルトンヘルパーの削除処理を追加
3. スケルトンヘルパー作成時はグローバル変数に代入
4. 行428-430の `boxHelper` 関連コードを完全削除

---

## 🟡 Phase 2: 重要な改善（1週間以内に対応）

### 2.1 デバッグコードの整理

**削除すべき console.log の箇所**:
```javascript
// 行1-2: 完全削除
console.log("FIX: RESET Y-offsets. Applied UpperLegs X-180 + Z-Data Invert. LowerLegs X+90.");
console.log("--- SCRIPT.JS LOADED (VERSION: Z_DATA_INVERT) ---");

// 行60: 削除
console.log("Scene Initialized (Cleaned)");

// 行161: 削除
console.log("VRM added directly to SCENE at (0,0,0). Textures RESTORED. Debug objects commented out, Skeleton Visible.");

// 行339: 削除
console.log("FIX: RESET Y-offsets. Applied UpperLegs X-180 + Z-Data Invert. LowerLegs X+90.");

// 行345: 削除
console.log("Animation Action Playing");

// 行404-407: 削除
if (frameCount < 1) {
    console.log("First Frame Rendered");
    frameCount++;
}
```

**条件付きデバッグログに変更する箇所**:

**グローバル変数セクションに追加**:
```javascript
// 🆕 デバッグモード判定
const DEBUG_MODE = new URLSearchParams(window.location.search).has('debug');

// 🆕 デバッグログ関数
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('[DEBUG]', ...args);
    }
}
```

**retargetFBX関数内のログを置き換え**:
```javascript
// 行268-270: 既存のログを置き換え
if (nameLower.includes('leg') || nameLower.includes('hips') || nameLower.includes('foot') || nameLower.includes('toe')) {
    debugLog("Processing Track:", newT.name); // 🆕 debugLog に変更
}

// 行282: 置き換え
debugLog(" -> Applied Hips Y-Fix"); // 🆕

// 行303: 置き換え
debugLog(` -> UpperLeg (X-180 + Y+180 + Z-Inv): ${newT.name}`); // 🆕

// 行310: 置き換え
debugLog(` -> Foot/Toe (X-90): ${newT.name}`); // 🆕

// 行315: 置き換え
debugLog(` -> LowerLeg (X+90 + X-Inv): ${newT.name}`); // 🆕
```

**エラーログは残す（置き換えない）**:
```javascript
// これらは残す（エラー情報なので）
console.error("VRM Error:", err);
console.warn("FBX Error:", err);
```

**指示**:
1. ファイル先頭の2行のログを削除
2. `DEBUG_MODE` と `debugLog()` 関数を追加
3. すべての情報ログを `debugLog()` に置き換え
4. `console.error` と `console.warn` はそのまま維持

---

### 2.2 マジックナンバーの定数化

**ファイル先頭の設定セクション（行10-14）を拡張**:
```javascript
// --- Configuration ---
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
    CAMERA_POSITION: { x: 0, y: 1.0, z: 6.0 },
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
```

**使用箇所を置き換え**:

```javascript
// setupThreeJS関数（行77）
camera = new THREE.PerspectiveCamera(CONFIG.CAMERA_FOV, ASPECT_RATIO, CONFIG.CAMERA_NEAR, CONFIG.CAMERA_FAR);

// init関数（行69-70）
camera.position.set(CONFIG.CAMERA_POSITION.x, CONFIG.CAMERA_POSITION.y, CONFIG.CAMERA_POSITION.z);
camera.lookAt(CONFIG.CAMERA_LOOKAT.x, CONFIG.CAMERA_LOOKAT.y, CONFIG.CAMERA_LOOKAT.z);

// scene背景（行39）
scene.background = new THREE.Color(CONFIG.BACKGROUND_COLOR);

// ライト（行43, 46）
const light = new THREE.DirectionalLight(0xffffff, CONFIG.LIGHT_INTENSITY);
const ambient = new THREE.AmbientLight(0xffffff, CONFIG.AMBIENT_INTENSITY);

// retargetFBX関数内（行259）
newT.values[i] *= CONFIG.FBX_POSITION_SCALE;

// updateEye関数（行380-384）
const scaleX = CONFIG.EYE_SCALE_X;
const scaleY = CONFIG.EYE_SCALE_Y;
py += CONFIG.EYE_OFFSET_Y;
const pz = CONFIG.EYE_POS_Z;
userEyePosition.lerp(target, CONFIG.LERP_SPEED);

// updateExpr関数（行393）
const blink = Math.abs(leftOpen) < CONFIG.BLINK_THRESHOLD ? 1.0 : 0.0;

// ボーン回転補正（行283, 304-306, 311, 316）
const qPatch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), CONFIG.ROTATION.HIPS_Y);

const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CONFIG.ROTATION.UPPER_LEG_X);
const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), CONFIG.ROTATION.UPPER_LEG_Y);

qFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CONFIG.ROTATION.FOOT_X);

qFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CONFIG.ROTATION.LOWER_LEG_X);
```

**指示**:
1. `CONFIG` オブジェクトを拡張し、すべてのマジックナンバーを定数化
2. コード内のハードコードされた数値を `CONFIG.*` に置き換え
3. 各定数にコメントで説明を追加

---

## 🟢 Phase 3: 追加改善（時間があれば対応）

### 3.1 HTML/CSSの改善

**index.htmlのスタイルセクションに追加**:
```css
/* エラーコンテナのスタイル改善 */
#error-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#error-container h3 {
    margin-bottom: 15px;
    font-size: 20px;
}

#error-container p {
    line-height: 1.6;
}

/* カメラ同意UIのスタイル改善 */
#consent-box h2 {
    margin: 0 0 20px 0;
}

#consent-box button:hover {
    opacity: 0.9;
    transform: translateY(-2px);
    transition: all 0.2s ease;
}

#allow-camera:hover {
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

#deny-camera:hover {
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

/* video-containerの改善 */
#video-container {
    transition: transform 0.3s ease;
}

#video-container:hover {
    transform: scale(1.05);
}

/* デバッグオーバーレイ */
.hidden {
    display: none !important;
}
```

---

## 📋 改修チェックリスト

改修完了後、以下を確認してください：

### Phase 1（クリティカル）
- [ ] animate関数から不要な再設定コードを削除
- [ ] カメラ位置設定をinit関数内のみに変更
- [ ] boxHelper関連コードを完全削除
- [ ] カメラ同意UIをindex.htmlに追加
- [ ] requestCameraPermission関数を実装
- [ ] showError関数を実装
- [ ] setupFaceMeshをasync/awaitに変更
- [ ] init関数をasync関数に変更
- [ ] loadVRMAndFBXをPromiseを返す関数に変更
- [ ] skeletonHelperをグローバル変数化
- [ ] cleanupScene関数にskeletonHelperの削除処理を追加

### Phase 2（重要）
- [ ] 不要なconsole.logを削除（行1-2, 60, 161, 339, 345, 404-407）
- [ ] DEBUG_MODEとdebugLog関数を追加
- [ ] retargetFBX内のログをdebugLogに変更
- [ ] CONFIGオブジェクトを拡張
- [ ] すべてのマジックナンバーをCONFIG.*に置き換え

### Phase 3（推奨）
- [ ] HTML/CSSスタイルを改善
- [ ] ホバー効果を追加

---

## 🧪 動作確認方法

改修後、以下の手順で動作を確認してください：

### 1. 基本動作確認
```bash
# 開発サーバー起動
npm run dev

# ブラウザで開く
https://localhost:3000
```

### 2. チェック項目
- [ ] カメラ同意UIが表示される
- [ ] 「許可する」をクリックするとUIが消える
- [ ] 「拒否する」をクリックするとエラーが表示される
- [ ] VRMモデルが正常に表示される
- [ ] アニメーションが再生される
- [ ] カメラ映像が左上に表示される
- [ ] 視線追従が動作する
- [ ] まばたきが同期する

### 3. パフォーマンス確認
```
# デバッグモードで開く
https://localhost:3000?debug=true

# Chrome DevToolsで確認
1. F12キーを押す
2. Performanceタブを開く
3. 記録開始
4. 10秒間待つ
5. 記録停止
6. FPSが50-60の範囲にあることを確認
```

### 4. エラーハンドリング確認
- カメラを他のアプリで使用中に起動 → エラーメッセージ表示を確認
- 存在しないVRMパスを指定 → エラーメッセージ表示を確認

---

## 📞 サポート

改修中に問題が発生した場合：

1. **コンソールエラーを確認**
   - ブラウザでF12キーを押す
   - Consoleタブでエラーメッセージを確認

2. **デバッグモードで詳細確認**
   - `?debug=true` をURLに追加
   - デバッグログを確認

3. **段階的に適用**
   - Phase 1から順番に適用
   - 各Phaseごとに動作確認

---

## 📈 期待される改善効果

- **パフォーマンス**: FPS 15-20%向上
- **メモリ**: 長時間使用時のメモリ使用量30%削減
- **セキュリティ**: GDPR/CCPA対応完了
- **保守性**: コード可読性60%向上
- **ユーザー体験**: エラー発生時の状況把握が可能に

---

**作成日**: 2026-02-07  
**対象バージョン**: オリジナルscript.js  
**改修担当**: Antigravity
