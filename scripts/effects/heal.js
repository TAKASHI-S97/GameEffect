export function runHealEffect(canvas, ctx, duration = 0) {
    let particles = [];     // 粒子
    let timer = null;       // 粒子生成インターバル制御用変数
    let frame = null;       // 粒子アニメーション再生制御用変数
    let startTime = null;   // 再生時間計算する際の再生開始時間

    // 粒子作成関数
    function spawn() {
        particles.push({
            // 粒子の X 座標は、canvas の幅半分の位置から、左右 15px の間
            x: canvas.width / 2 + Math.random() * 30 - 15,

            // 粒子の Y 座標は、canvas の高さ半分の位置から、上下 15px の間
            y: canvas.height / 2 + Math.random() * 30 - 15,

            // 粒子の半径は、2~5px
            radius: Math.random() * 3 + 2,

            // 透明度は 1 で初期化
            opacity: 1,

            // 移動（1 フレームの）は、-2~-0.5（負の値は上方向） 
            vy: Math.random() * -1.5 - 0.5,
        });
    }

    // アニメーションループ
    function loop(timestamp) {
        // アニメーション開始時間が設定されていない時（アニメーション開始時）、アニメーション開始時刻を記録
        if (!startTime) startTime = timestamp;

        // アニメーション経過時間を計算
        const elapsed = timestamp - startTime;

        // canvas クリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 全粒子描画のループ
        for (const p of particles) {
            // グラデーションの円を作成し描画
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
            g.addColorStop(0, `rgba(255,255,255,${p.opacity})`);
            g.addColorStop(1, `rgba(255,255,255,0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            // 上昇と透明化を進行
            p.y += p.vy;
            p.opacity -= 0.01;
        }

        // 完全透明の粒子（消えた粒子）を削除
        particles = particles.filter(p => p.opacity > 0);

        // 再生時間指定の場合、指定時間内のみアニメーション予約
        if (duration === 0 || elapsed < duration) {
            frame = requestAnimationFrame(loop);  
        // 新たな粒子は作らずに、フェードアウトのみ再生
        } else if (particles.length > 0) {
            clearInterval(timer);
            frame = requestAnimationFrame(loop);
        // 粒子が全部消えたら終了処理
        } else {
            cleanup();
        }
    }

    // 粒子の作成（100 ミリ秒毎に 5 つ ⇒ 50個/秒）
    timer = setInterval(() => { for (let i = 0; i < 5; i++) spawn(); }, 100);

    // 初回のアニメーション実行
    frame = requestAnimationFrame(loop);

    return {
        // 終了処理（粒子生成終了 + アニメーション終了 + 画面クリア）
        cleanup() {
            clearInterval(timer);
            cancelAnimationFrame(frame);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };
}
