# Antigravityへのアップロード手順

## 📦 必要なファイル

Antigravityに以下のファイルをアップロードしてください：

### 1. 必須ファイル（必ずアップロード）
- ✅ **PROMPT_FOR_ANTIGRAVITY.md** - 改修指示書（このファイル）
- ✅ **script.js** - 現在のメインスクリプト（オリジナル版）
- ✅ **index.html** - 現在のHTML（オリジナル版）

### 2. 参考ファイル（アップロード推奨）
- 📄 **CODE_REVIEW_REPORT.md** - 詳細なレビュー結果
- 📄 **script_improved.js** - 完成形の参考コード
- 📄 **index_improved.html** - 完成形の参考HTML

### 3. オプション
- 📄 **config.json** - 将来的な設定ファイル（Phase 4以降で使用）
- 📄 **README_improved.md** - 完成後のドキュメント

---

## 🤖 Antigravityへの指示文

Antigravityのチャット欄に、以下のテキストをコピー&ペーストしてください：

```
VRM 3D Viewerのコード改修をお願いします。

アップロードした「PROMPT_FOR_ANTIGRAVITY.md」に詳細な改修指示が記載されています。
この指示に従って、script.jsとindex.htmlを段階的に改修してください。

【改修の優先順位】
Phase 1（最優先）: パフォーマンス破壊コードの修正、セキュリティ対応、メモリリーク修正
Phase 2（重要）: デバッグコードの整理、マジックナンバーの定数化
Phase 3（推奨）: HTML/CSSの改善

各Phaseごとに、修正後のコードを提供してください。
また、修正箇所には必ずコメント「🆕」または「❌ 削除」を付けてください。

参考として、script_improved.jsとindex_improved.htmlに完成形のコードがあります。
ただし、段階的な改修が重要なので、一気に置き換えるのではなく、
PROMPT_FOR_ANTIGRAVITY.mdの指示に従って、既存コードを修正してください。

質問や不明点があれば遠慮なく聞いてください。
```

---

## 📋 アップロード手順（詳細）

### ステップ1: Antigravityを開く
1. Antigravityにアクセス
2. 新しいチャットを開始

### ステップ2: ファイルをアップロード
1. 「📎」（添付ファイル）ボタンをクリック
2. 以下のファイルを選択：
   - PROMPT_FOR_ANTIGRAVITY.md
   - script.js（オリジナル版）
   - index.html（オリジナル版）
   - CODE_REVIEW_REPORT.md（オプション）
   - script_improved.js（参考用）
   - index_improved.html（参考用）

### ステップ3: 指示文を送信
上記の「Antigravityへの指示文」をコピー&ペーストして送信

---

## ⚠️ 注意事項

### 1. ファイル名の確認
アップロードするファイルが正しいか確認してください：
- ❌ **間違い**: script_improved.js（改善版）のみをアップロード
- ✅ **正しい**: script.js（オリジナル版）とscript_improved.js（参考用）の両方をアップロード

### 2. 段階的な改修
Antigravityには以下のように依頼してください：
- ✅ **良い例**: 「Phase 1の3つの修正を適用してください」
- ❌ **悪い例**: 「全部修正してください」

### 3. 確認ポイント
各Phaseの改修後、Antigravityに以下を確認：
- [ ] 修正箇所にコメントが付いているか
- [ ] 削除すべきコードが残っていないか
- [ ] 新しいコードが正しい位置に追加されているか

---

## 🔄 改修の流れ（推奨）

### Phase 1-1: パフォーマンス修正
```
「Phase 1.1のパフォーマンス破壊コードの修正を適用してください。
animate関数とinit関数を修正し、修正後のscript.jsを提供してください。」
```

### Phase 1-2: セキュリティ修正
```
「Phase 1.2のセキュリティ修正を適用してください。
index.htmlにカメラ同意UIを追加し、
script.jsにrequestCameraPermission関数とshowError関数を追加してください。」
```

### Phase 1-3: メモリリーク修正
```
「Phase 1.3のメモリリーク修正を適用してください。
skeletonHelperの管理方法を変更してください。」
```

### Phase 2-1: デバッグコード整理
```
「Phase 2.1のデバッグコード整理を適用してください。
不要なconsole.logを削除し、DEBUG_MODEとdebugLog関数を追加してください。」
```

### Phase 2-2: マジックナンバー定数化
```
「Phase 2.2のマジックナンバー定数化を適用してください。
CONFIGオブジェクトを拡張し、全ての使用箇所を置き換えてください。」
```

---

## 🧪 各Phase完了後の確認

### Phase 1完了後
```
「Phase 1の修正が完了したので、以下を確認させてください：
1. animate関数内の不要な再設定が削除されているか
2. カメラ同意UIが正しく実装されているか
3. メモリリークが修正されているか

修正後の完全なscript.jsとindex.htmlを提供してください。」
```

### Phase 2完了後
```
「Phase 2の修正が完了したので、以下を確認させてください：
1. デバッグログが条件分岐されているか
2. マジックナンバーがすべてCONFIG化されているか

最終的なscript.jsを提供してください。」
```

---

## 📊 期待される出力

Antigravityから以下のような出力が得られるはずです：

### Phase 1完了時
```javascript
// script.js (Phase 1適用済み)

// ✅ パフォーマンス修正済み
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (currentVrm) currentVrm.update(delta);
    if (mixer) mixer.update(delta);
    renderer.render(scene, camera);
}

// ✅ エラーハンドリング追加
async function init() {
    try {
        // ... setup code ...
        await loadVRMAndFBXAsync(...);
        await setupFaceMesh();
        animate();
    } catch (error) {
        showError('初期化に失敗: ' + error.message);
    }
}

// ... 以下省略 ...
```

### Phase 2完了時
```javascript
// script.js (Phase 2適用済み)

// ✅ デバッグモード対応
const DEBUG_MODE = new URLSearchParams(window.location.search).has('debug');

function debugLog(...args) {
    if (DEBUG_MODE) console.log('[DEBUG]', ...args);
}

// ✅ 設定の定数化
const CONFIG = {
    CAMERA_FOV: 30,
    EYE_SCALE_X: 8.0,
    // ... 全ての設定値 ...
};

// ... 以下省略 ...
```

---

## 🆘 トラブルシューティング

### Q1: Antigravityが指示を理解しない場合
**A**: より具体的に指示してください
```
「script.jsの410行目から426行目のanimate関数を見てください。
この関数内の以下の行を削除してください：
- camera.position.set(0, 1.0, 8.0);
- camera.lookAt(0, 0.8, 0);
- currentVrm.scene.rotation.y = 0;
- currentVrm.scene.scale.set(1.0, 1.0, 1.0);
- currentVrm.scene.position.set(0, 0, 0);
」
```

### Q2: 修正箇所が多すぎて混乱する場合
**A**: 一つずつ確認しながら進める
```
「まず最初に、animate関数のパフォーマンス修正だけを適用してください。
修正後のanimate関数のコードを見せてください。
確認後、次の修正に進みます。」
```

### Q3: 参考コードと指示が矛盾している場合
**A**: PROMPT_FOR_ANTIGRAVITY.mdを優先
```
「PROMPT_FOR_ANTIGRAVITY.mdの指示を優先してください。
script_improved.jsは完成形の参考であり、
段階的な改修手順はPROMPT_FOR_ANTIGRAVITY.mdに記載されています。」
```

---

## ✅ 最終確認チェックリスト

改修完了後、以下を確認してください：

### コード品質
- [ ] すべてのPhaseの修正が適用されている
- [ ] 修正箇所にコメントが付いている
- [ ] 不要なコードが削除されている
- [ ] 新しい関数が正しく実装されている

### 動作確認
- [ ] ローカル環境で動作する
- [ ] カメラ同意UIが表示される
- [ ] エラーハンドリングが機能する
- [ ] パフォーマンスが改善している（FPS確認）

### ドキュメント
- [ ] コードにコメントが追加されている
- [ ] 変更履歴が記録されている

---

## 📞 サポート

不明点があれば、以下の情報を添えて質問してください：

1. **現在のPhase**: Phase 1-1など
2. **エラーメッセージ**: ブラウザのコンソールエラー
3. **期待する動作**: どうなるべきか
4. **実際の動作**: どうなっているか

例：
```
【質問】
Phase: Phase 1-2
エラー: "requestCameraPermission is not defined"
期待: カメラ同意UIが表示される
実際: エラーでアプリが起動しない

どこが間違っていますか？
```

---

**作成日**: 2026-02-07  
**バージョン**: 1.0  
**対象**: Antigravity改修作業
