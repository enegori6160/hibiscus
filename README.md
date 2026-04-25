# ハナハナ風スロット

シンプルなブラウザ用スロットマシンです。ハイビスカスが光ればボーナス！
リセットボタンでいつでも残高を初期化できます。

## デザイン指針
- システムフォントとCSSカスタムプロパティ（デザイントークン）で一貫した配色・余白を管理
- ダークモードとライトモードをワンクリックで切替可能
- メッセージ・ボタンにフェードやホバーなどのアニメーションを付与
- モバイルからデスクトップまで対応したレスポンシブレイアウト
- メッセージ領域は `aria-live="polite"` でスクリーンリーダー対応

### カラーパレット
| トークン | ライト | ダーク |
| --- | --- | --- |
| `--color-bg` | `#f8fafc` | `#0f172a` |
| `--color-text` | `#0f172a` | `#f8fafc` |
| `--color-primary` | `#1e40af` | `#3b82f6` |
| `--color-border` | `#94a3b8` | `#334155` |
| `--color-error` | `#dc2626` | `#dc2626` |

フォント: `system-ui, sans-serif`

## サウンド
Web Audio API でシンプルなクリック/勝利/エラー音を生成しています。右上のスピーカーボタンでオン・オフを切り替え可能です。

## プレミア演出
フリーズ当選時は `premiumFx` による全画面演出を再生できます。

```html
<script src="./premium-fx.js"></script>
<script>premiumFx.mount();</script>
```

```js
premiumFx.play({
  durationMs: 3200,
  palette: { bg: "#000", primary: "#e40913", secondary: "#ffd166" },
  anchor: { mode: "selector", selector: "#reel1" },
  audio: { enabled: true, volume: 0.9 },
  accessibility: {
    reduceMotion: matchMedia('(prefers-reduced-motion)').matches,
    safeFlash: true
  }
});
```

### 追加API

| メソッド | 説明 |
| --- | --- |
| `premiumFx.stop()` | 再生中の演出を即座に停止し、オーバーレイやオーディオを破棄する。再生中でない場合もクリーンアップを実行する |
| `premiumFx.isPlaying()` | 演出が再生中であれば `true`、そうでなければ `false` を返す |

```js
// 演出の再生状態を確認してから停止する例
if (premiumFx.isPlaying()) {
  premiumFx.stop();
  console.log('演出を中断しました');
}

// play() は Promise を返すため、正常終了と手動停止の両方に対応できる
premiumFx.play({ durationMs: 3200 }).then(() => {
  console.log('演出が完了しました（正常終了または stop() による中断）');
});

// 一定時間後に自動停止するタイムアウト付きの例
const timeout = setTimeout(() => premiumFx.stop(), 5000);
premiumFx.play().then(() => clearTimeout(timeout));
```

## キーバインド
- **Space / Enter**: スピン
- **Ctrl+Z / Cmd+Z**: 直前のスピンを取り消し
- **R**: ゲームをリセット

## アクセシビリティ
- 主要ボタンに `aria-label`・`aria-disabled`・`aria-busy` を付与
- メッセージは `role="status"` で動的更新を通知
- キーボードのみで操作可能

## 使用ライブラリ/フレームワーク
- 外部ライブラリは使用せず、プレーンなHTML/CSS/JavaScriptで構成
- サウンドは Web Audio API を使用

## 広告設定（AD_CONFIG）
`ad-config.js` がエクスポートするフリーズ済み設定オブジェクトです。広告の表示間隔やコイン経済のパラメータを一元管理します。

### プロパティ

| プロパティ | 型 | デフォルト値 | 説明 |
| --- | --- | --- | --- |
| `INITIAL_COINS` | `number` | `100` | ゲーム開始時の初期コイン数 |
| `COINS_PER_PLAY` | `number` | `3` | 1回のプレイで消費するコイン数 |
| `REWARD_COINS` | `number` | `50` | リワード広告視聴で獲得できるコイン数 |
| `INTERSTITIAL_INTERVAL` | `number` | `50` | インタースティシャル広告を表示するプレイ回数の間隔 |
| `REWARD_AD_SECONDS` | `number` | `5` | リワード広告のカウントダウン秒数 |
| `INTERSTITIAL_AD_SECONDS` | `number` | `4` | インタースティシャル広告のカウントダウン秒数 |

### 使用例

```js
// コイン残高が1プレイ分あるか確認する
if (currentCoins >= AD_CONFIG.COINS_PER_PLAY) {
  currentCoins -= AD_CONFIG.COINS_PER_PLAY;
}

// インタースティシャル広告の表示タイミングを判定する
if (playCount % AD_CONFIG.INTERSTITIAL_INTERVAL === 0) {
  AdService.showInterstitialAd();
}
```

## 広告サービス（AdService）
`ad-service.js` が提供するファサードで、広告表示のライフサイクルを管理します。内部で `AdSystem`（`ad-system.js`）をアダプターとして利用し、二重表示防止のガード処理を備えています。

### API

| メソッド | 説明 |
| --- | --- |
| `AdService.init(options)` | 広告システムを初期化する。`options` でコールバックを登録する |
| `AdService.showRewardAd()` | リワード広告を表示する。成功時 `true`、広告表示中なら `false` |
| `AdService.showInterstitialAd()` | インタースティシャル広告を表示する。戻り値は同上 |
| `AdService.showOutOfCoinsModal()` | コイン不足モーダルを表示する |
| `AdService.isAnyAdOpen()` | いずれかの広告 UI が開いているか返す |
| `AdService.setCurrentCoins(n)` | 現在のコイン数を設定する |
| `AdService.setPlayCount(n)` | プレイ回数を設定する |
| `AdService.getState()` | 現在の広告状態オブジェクトを返す |

### 使用例

```js
AdService.init({
  onRewardGranted: function (coins) {
    console.log('報酬獲得:', coins);
    coinBalance += coins;
  },
  onStateChange: function (state) {
    console.log('広告状態:', state.isRewardAdOpen, state.isInterstitialAdOpen);
  },
  onInterstitialClosed: function () {
    console.log('インタースティシャル広告を閉じました');
  }
});

// リワード広告を表示
if (!AdService.showRewardAd()) {
  console.log('広告を表示できません（既に表示中）');
}
```

## 広告システム（AdSystem）
`ad-system.js` が提供する低レベルアダプターで、`AdService` の内部で使用されます。直接呼び出す場合は `window.AdSystem` 経由でアクセスします。

### API（抜粋）

| メソッド | 説明 |
| --- | --- |
| `AdSystem.shouldShowInterstitial()` | 現在のプレイ回数がインタースティシャル広告の表示タイミングかどうかを返す（`boolean`） |
| `AdSystem.destroy()` | 広告 UI をすべて DOM から除去し、タイマーを停止してリソースを解放する |
| `AdSystem.incrementPlayCount()` | プレイ回数を 1 増やし、必要に応じてインタースティシャル広告をトリガーする |

### 未ドキュメント関数の追記（AdSystem）

| メソッド | 説明 |
| --- | --- |
| `AdSystem.init(options)` | 広告システムを初期化し、コールバック（`onRewardComplete` / `onStateChange` / `onInterstitialClose`）を登録する |
| `AdSystem.setCurrentCoins(value)` | 現在コイン数を設定し、状態更新を通知する |
| `AdSystem.setPlayCount(value)` | プレイ回数を設定し、状態更新を通知する |
| `AdSystem.showRewardAd()` | リワード広告モーダルを表示する。表示できた場合 `true`、表示不可なら `false` |
| `AdSystem.showOutOfCoinsModal()` | コイン不足モーダルを表示する |
| `AdSystem.showInterstitialAd()` | インタースティシャル広告モーダルを表示する。表示できた場合 `true`、表示不可なら `false` |
| `AdSystem.isAnyAdOpen()` | いずれかの広告関連モーダルが開いているかを返す |
| `AdSystem.getState()` | 現在の内部状態（コイン数、プレイ回数、各モーダル表示状態）を返す |

### 使用例

```js
// インタースティシャル広告を手動で判定・表示する
AdSystem.incrementPlayCount();
if (AdSystem.shouldShowInterstitial()) {
  AdSystem.showInterstitialAd();
}

// ページ離脱前にリソースを解放する
window.addEventListener('beforeunload', function () {
  AdSystem.destroy();
});
```

## コインカウントアップ演出（addCoinsGradually）

`app.js` 内のユーティリティ関数で、コインを即時加算するのではなく一定間隔で少しずつ増やしながら SE を再生し、視覚的なカウントアップ演出を実現します。

```js
addCoinsGradually(amount, onDone, opts)
```

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `amount` | `number` | 加算するコインの合計枚数 |
| `onDone` | `function \| null` | カウントアップ完了時に呼ばれるコールバック |
| `opts.fixedTicks` | `number?` | カウント回数を固定する（総時間 = `fixedTicks × intervalMs`） |
| `opts.maxDurationMs` | `number?` | `fixedTicks` 使用時の総演出時間（デフォルト `600`ms） |
| `opts.unitOverride` | `number?` | 1 tick あたりの加算枚数を上書きする |
| `opts.intervalOverrideMs` | `number?` | tick 間隔（ms）を上書きする |
| `opts.soundEveryOverride` | `number?` | SE を何 tick ごとに鳴らすか上書きする |

`amount` が 2000 以上の場合は自動的に 100 枚単位でカウントし、高速に演出を終わらせます。

### 使用例

```js
// ボーナス入賞時に 350 枚を約 0.6 秒かけて加算する
addCoinsGradually(350, () => {
  console.log('コイン加算完了');
  updatePanelControls();
});

// 固定 20 カウント・1 秒かけてゆっくり加算する
addCoinsGradually(120, null, { fixedTicks: 20, maxDurationMs: 1000 });

// 1000 枚を 10 枚刻み・12ms 間隔で高速加算する
addCoinsGradually(1000, onDone, { unitOverride: 10, intervalOverrideMs: 12 });
```

## シンボル確率計算（perCellFromSpinProb）

`app.js` 内のユーティリティ関数で、スピン単位の当選確率 P（例: 1/8）をセル単位の出現確率に変換します。内部でシンボルの重み付きランダム抽選（`randomSymbolManual`）に使用する `MANUAL_PROBS` テーブルを構築するために呼ばれます。

```js
perCellFromSpinProb(P)
```

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `P` | `number` | 1スピンあたりの目標当選確率（0〜1） |
| 戻り値 | `number` | 3行×5列リールにおけるセルごとの出現確率 |

計算式は 3行×5列リールを想定した逆算で、`p = (1 - (1 - P)^(1/5))^(1/3)` となります。この値で各リールの各行を独立に抽選することで、スピン全体の当選確率が P に近似します。

### 使用例

```js
// 「🔔」を約 1/8 のスピン確率にしたい場合
const pCell = perCellFromSpinProb(1 / 7.97); // ≈ 0.0566（セルごとの出現確率）

// 低確率シンボル（🍒）の確認
const pCherry = perCellFromSpinProb(1 / 61.8); // ≈ 0.0157
```

## 開発
静的ファイルのみで構成されています。ブラウザで `index.html` を開くだけで実行できます。
`app.js` 内の `enableUndo` を `false` にすると取り消し機能を無効化できます。
