export function runBloodEffect(canvas, ctx) {
    /* 定数、ベルパー関数 */
    // 範囲内乱数取得
    const randIn = (a, b) => a + Math.random() * (b - a);

    // 円周角度 τ = 2π
    const TAU = Math.PI * 2;

    // 角度の正規化関数
    const norm = a => (a % TAU + TAU) % TAU;

    // 値を指定範囲に圧縮する関数
    const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

    // 線形補間
    const lerp = (a, b, t) => a + (b - a) * t;

    // 2D ベクター関数
    const vector2 = (x, y) => ({
        x,
        y,
        add(v) { return vector2(this.x + v.x, this.y + v.y); },
        sub(v) { return vector2(this.x - v.x, this.y - v.y); },
        scale(s) { return vector2(this.x * s, this.y * s); },
        dot(v) { return this.x * v.x + this.y * v.y; },
        length() { return Math.hypot(this.x, this.y); },
        length2() { return this.x * this.x + this.y * this.y; },
        // 正投影ベクトル取得
        proj(v) {
            const d = this.length2();           // ||a||^2
            if (d === 0) return vector2(0, 0);  // ゼロベクトル保護

            const s = this.dot(v) / d;          // S = a·b / ||a||^2
            return this.scale(s);               // a * S
        }
    });

    // 極座標から直交座標の変換関数（[R, θ] ⇒ vector2）
    const polarToXY = (centerX, centerY, a, r) => vector2(
        centerX + Math.cos(a) * r,
        centerY + Math.sin(a) * r
    );

    /* 描画領域の中心座標を取得 */
    const width = canvas.width;                     // canvas の幅
    const height = canvas.height;                   // canvas の高さ
    const centerX = width / 2;                      // canvas の幅の半分（中心 X 座標）
    const centerY = height / 2;                     // canvas の高さの半分（中心 Y 座標）

    /* 血痕基本形状の定義 */
    const basicRadius = width / 6;                  // 血痕の中心円の基準半径（ここから凸凹させる）
    const bumps = [];                               // 出っ張りの端点の配列（角度、半径）
    let bumpAngle = randIn(TAU / 16, TAU / 10);     // 出っ張りの角度

    while (true) {
        const bumpRadius = basicRadius * randIn(1.15, 1.35);
        bumps.push({ a: bumpAngle, r: bumpRadius });
        console.log(`角度：${Math.floor(bumpAngle / Math.PI * 180)}\n半径：${Math.floor(bumpRadius)}`);

        bumpAngle += randIn(TAU / 16, TAU / 10);
        if (bumpAngle > TAU) break;
    }

    // スパイク生成
    const spikeCount = Math.floor(randIn(3, 5));                        // スパイクの数
    let spikeIdx = Math.floor(randIn(0, bumps.length / spikeCount));    // スパイクになる出っ張りのインデックス
    bumps[spikeIdx].r = randIn(1.8, 2.0) * basicRadius;                 // 最初のスパイクを作る

    for (let i = 1; i < spikeCount; i++) {
        spikeIdx += Math.floor(bumps.length / spikeCount + randIn(-1, 2));
        bumps[spikeIdx % bumps.length].r = randIn(1.8, 2.0) * basicRadius;
    }

    /* 血しぶきの描画 */
    function drawTearDrops() {
        ctx.save();
        
        for (let i = 0; i < bumps.length; i++) {
            // 現在の出っ張りはスパイクがどうかで、血しぶきの個数を調整（スパイクは確実に 1 個、通常出っ張りは 0~1 個）
            const dropCount = bumps[i].r > basicRadius * 1.35 ? 1 : Math.floor(randIn(0, 2));

            for (let j = 0; j < dropCount; j++) {
                const P = polarToXY(centerX, centerY, bumps[i].a, bumps[i].r);              // 現在の出っ張りの頂点座標 P

                const angle = bumps[i].a + randIn(-Math.PI / 180, Math.PI / 180);           // 角度は ±1 度の偏差
                const radius = bumps[i].r + lerp(10, 40, bumps[i].r / (basicRadius * 2));   // 半径は出っ張りから 10~40px 離れたところ（出っ張りが尖っていれば尖っている程離れる）
                const S = polarToXY(centerX, centerY, angle, radius);                       // 描画開始座標 S

                const l = lerp(5, 50, Math.max(bumps[i].r / (basicRadius * 1.35), 1));      // 血しぶきの長さ（出っ張りが尖っていれば尖っている程長い）
                const w = randIn(2, 5);                                                     // 血しぶきの幅（コントロールポイント計算用なので、実際は幅の 2 倍値）

                // 出っ張りの頂点から血しぶきの方向を計算し、終点を計算
                const PS = vector2(S.x - P.x, S.y - P.y);                                   // ベクトル PS
                const SE = PS.scale(l / PS.length());                                       // ベクトル SE
                const E = S.add(SE);                                                        // 描画終点

                const N = vector2(SE.y, -SE.x).scale(1 / SE.length());                      // 法線ベクトル

                // 終点から、法線ベクトル方向とその逆方向から 2 点を取得し、描画するベジェ曲線のコントロールポイントとします
                const CP_L = vector2(E.x + N.x * w, E.y + N.y * w);
                const CP_R = vector2(E.x - N.x * w, E.y - N.y * w);

                // 2本の二次ベジェで涙型を閉じて塗る
                ctx.beginPath();
                ctx.moveTo(S.x, S.y);
                ctx.quadraticCurveTo(CP_L.x, CP_L.y, E.x, E.y); // 左側
                ctx.quadraticCurveTo(CP_R.x, CP_R.y, S.x, S.y); // 右側で戻る
                ctx.closePath();

                const mid = { // S→E の中間を少し “尻側” に寄せてコクを出す
                    x: (S.x * 0.6 + E.x * 0.4),
                    y: (S.y * 0.6 + E.y * 0.4)
                };
                const L = Math.hypot(E.x - S.x, E.y - S.y);
                const g = ctx.createRadialGradient(
                    mid.x, mid.y, 0,
                    mid.x, mid.y, L * 0.8
                );
                g.addColorStop(0.00, "#4b0000");   // 内：濃
                g.addColorStop(0.75, "#830000");   // 中
                g.addColorStop(1.00, "#b00000");   // 外：明

                ctx.fillStyle = g;
                ctx.fill();
            }
        }

        ctx.restore();
    }

    /* ランダムな血痕を描画 */
    function drawRandomDot() {
        const count = 200;  // 描画個数

        for (let i = 0; i < count; i++) {
            const x = randIn(0, width);
            const y = randIn(0, height);
            
            if (x > (width - basicRadius * 2) / 2 && 
                x < width - (width - basicRadius * 2) / 2 &&
                y > (height - basicRadius * 2) / 2 &&
                y < height - ((height - basicRadius * 2) / 2)
            ) continue;
            const r = randIn(1, 3);

            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.closePath();
            if (r < 1.8) {
                ctx.fillStyle = "#ba0000";
            } else {
                const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.2);
                g.addColorStop(0.00, "#8b0000");
                g.addColorStop(0.65, "#c20000");
                g.addColorStop(1.00, "#ba0000");
                ctx.fillStyle = g;
            }
            ctx.fill();
        }
    }

    /* アニメーション再生関連 */
    const time = 300;           // アニメーション再生時間
    let startTime = null;       // 再生開始時間
    let frame = null;

    function animation(timestamp) {
        // アニメーション開始時間が設定されていない時（アニメーション開始時）、アニメーション開始時刻を記録
        if (!startTime) startTime = timestamp;

        // アニメーション経過時間を計算
        const elapsed = timestamp - startTime;

        // 画面クリア
        ctx.clearRect(0, 0, width, height);

        // 血痕の円の描画
        ctx.beginPath()

        // パスを閉じるため、初期切替点とコントロールポイントを保持
        let initCP = null;
        let initTP = null;

        // 0..1 に制限した進行率
        const progress = Math.min(1, (timestamp - startTime) / time);
        const easeOut = (t) => 1 - Math.pow(1 - t, 3);   // easeOutCubic
        const p = easeOut(progress);

        const currentBumps = bumps.map((b) => ({
            a: b.a,
            r: lerp(basicRadius, b.r, p)
            })
        );

        // 出っ張りを描画
        for (let i = 0; i < currentBumps.length; i++) {
            const b0 = currentBumps[i];                                             // 現在の出っ張りの端点
            const d0 = Math.abs(b0.r - basicRadius);                                // 現在の出っ張りが基準半径からの離れ量
            const CP0 = polarToXY(centerX, centerY, b0.a, b0.r + d0);               // 現在の出っ張りを描画するためのコントロールポイント CP0 の座標

            const b1 = currentBumps[(i + 1) % currentBumps.length];                 // 次の出っ張りの端点
            const d1 = Math.abs(b1.r - basicRadius);                                // 次の出っ張りが基準半径からの離れ量
            const CP1 = polarToXY(centerX, centerY, b1.a, b1.r + d1);               // 次の出っ張りを描画するためのコントロールポイント CP1 の座標

            // 谷描画するためのコントロールポイントを計算
            // 谷の角度は、半径が長い出っ張りに寄る
            const deltaAngle = norm(b1.a - b0.a);                                   // 両端点の角度差
            const t = lerp(0, 1, d1 / (d0 + d1));                                   // 半径レート
            const cpAngle = norm(b0.a + deltaAngle * t);                            // 谷のコントロールポイントの角度を計算

            const cpRadius = lerp(basicRadius * 0.88, basicRadius * 0.62, t);       // 谷のコントロールポイントの半径を計算
            const CP2 = polarToXY(centerX, centerY, cpAngle, cpRadius);             // 谷のコントロールポイント CP2 の座標

            /*
                前回の終了位置から切替点までのアーク A1 と、
                切替点から次の終了位置までのアーク A2 、
                上記 2 つのアークを滑らかに繋ぐには、
                A1 終点位置の接線と、A2 開始位置の接線が同じベクトルである必要があります。

                ベジェ曲線の始点を S、終点を E、コントロールポイントを Cとします。
                終点の接線はベクトル CE、始点の接線はベクトル SC。
                
                よって、A1 と A2 の切替点 T は、A1 のコントロールポイント C1 と A2 のコントロールポイント C2 を繋いだ線分上に配置する必要があります。 
            */

            // 切替点 TP0 を CP0 ~ CP2 の間から取得
            const s0 = clamp(0.35 + 0.5 * (d0 / (d0 + basicRadius)), 0.3, 0.75);
            const TP0 = vector2(
                CP0.x + (CP2.x - CP0.x) * s0,
                CP0.y + (CP2.y - CP0.y) * s0
            );

            // 切替点 TP1 を CP2 ~ CP1 の間から取得
            const s1 = clamp(0.35 + 0.5 * (d1 / (d1 + basicRadius)), 0.3, 0.75);
            const TP1 = vector2(
                CP1.x + (CP2.x - CP1.x) * s1,
                CP1.y + (CP2.y - CP1.y) * s1
            );

            // 最初は描画開始位置まで移動する
            if (i === 0) {
                ctx.moveTo(TP0.x, TP0.y);
                initCP = CP0;
                initTP = TP0;
            }
            // 初回ループ以降は山を描画
            else ctx.quadraticCurveTo(CP0.x, CP0.y, TP0.x, TP0.y);

            // 谷を描画
            ctx.quadraticCurveTo(CP2.x, CP2.y, TP1.x, TP1.y);
        }

        // パスを閉じる
        ctx.quadraticCurveTo(initCP.x, initCP.y, initTP.x, initTP.y);
        ctx.closePath();

        // ラジアルグラデーション
        const g = ctx.createRadialGradient(
            centerX, centerY, basicRadius * 0.05,
            centerX, centerY, basicRadius * 2.2
        );
        
        g.addColorStop(0.00, "#4d0000");        // かなり暗い赤（内）
        g.addColorStop(0.55, "#880000");        // 基本色
        g.addColorStop(1.00, "#c20000");        // やや明（外）

        ctx.fillStyle = g;
        ctx.fill();

        // アニメーション予約
        if (elapsed < time) requestAnimationFrame(animation);
        else {
            drawTearDrops();
            drawRandomDot();
        }
    }

    // 初回アニメーション実行
    frame = requestAnimationFrame(animation);

    return {
        cleanup() {
            cancelAnimationFrame(frame);
            ctx.clearRect(0, 0, width, height);
        }
    }
}