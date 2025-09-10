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

## 開発
静的ファイルのみで構成されています。ブラウザで `index.html` を開くだけで実行できます。
`app.js` 内の `enableUndo` を `false` にすると取り消し機能を無効化できます。
