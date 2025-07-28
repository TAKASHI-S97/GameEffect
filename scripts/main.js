// エフェクトアニメーションのモジュールを読込
import { runHealEffect } from './effects/heal.js';

// canvas の下準備
const canvas = document.getElementById('effectCanvas');
const ctx = canvas.getContext('2d');

// 現在実行中のエフェクト
let currentEffect = null;

// エフェクト集の連想配列
const effects = {
  heal: runHealEffect,
};

// 現在実行中のエフェクトを終了
function stopCurrentEffect() {
  if (currentEffect?.cleanup) currentEffect.cleanup();
  currentEffect = null;
}

// プレビューのリストから実行したいエフェクトを取得するイベント
document.getElementById('effectSelector').addEventListener('change', e => {
  stopCurrentEffect();
  const effect = effects[e.target.value];
  if (effect) currentEffect = effect(canvas, ctx);
});

// 初期状態では「回復」エフェクトのアニメーションを再生（無限再生）
currentEffect = runHealEffect(canvas, ctx);
