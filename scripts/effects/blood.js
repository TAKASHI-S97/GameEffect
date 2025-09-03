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

    // 円周上の最短角度差正規化関数
    const shortest = (a, b) => {
        let d = norm(b - a);
        return d > Math.PI ? d - TAU : d;
    }

    // 対数正規分布の確率変数取得関数
    function logNormal(mu = 0, sigma = 0.25) {
        // ボックスミュラー法で、一様分布の乱数から標準正規分布の乱数を作る
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

        // 対数正規化
        return Math.exp(mu + sigma * z);
    }

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

    // 円とベクトルの交点を取得する関数
    function circleLineIntersections(O, r, S, E) {
        /*
            始点から終点の直線上の点（円との交点も含む）を P(t) とし、
            P(t) = S + td で表現できます。（d は始点から終点のベクトル d = E-S）
            円心 O 半径 r の場合、 |P(t) - O|^2 = r^2 で解けます（ピタゴラスの定理）
            展開した二次方程式 a·t^2 + b·t + c = 0 の内、
            a = d·d, b = 2d·(S - O), c = |S - O|^2 - r^2 になります。
            判別式 D = b^2 - 4ac で交点数を判定（D < 0: 交点なし、D = 0: 交点が 1 つ、ベクトル自体が接線上にある、D > 0: 交点が 2 つ）
            t の解は、-((b ± √D) / (2a))
        */
        const d = E.sub(S);                 // 方向ベクトル
        const f = S.sub(O);                 // S->O

        const a = d.dot(d);
        const b = 2 * d.dot(f);
        const c = f.dot(f) - r * r;

        const D = b * b - 4 * a * c;
        if (D < 0) return [];               // 交わらない

        const sqrtD = Math.sqrt(Math.max(0, D));
        const t1 = (-b - sqrtD) / (2*a);
        const t2 = (-b + sqrtD) / (2*a);

        return [ S.add(d.scale(t1)), S.add(d.scale(t2)) ];
    }

    // 2 点の内、指定した角度範囲内にある方を取得
    function pickPointBetweenAngles(O, P1, P2, aFrom, aTo) {
        // 角度を求める関数
        const ang = p => Math.atan2(p.y - O.y, p.x - O.x);

        // 指定角度の正規化
        let A = norm(aFrom), B = norm(aTo);
        if (B <= A) B += TAU;               // 正方向で [A,B)

        // 角度が範囲内かチェックする関数
        const inRange = (theta) => {
            let t = norm(theta);
            if (t < A) t += TAU;
            return t < B;
        };

        // 指定した 2 点の角度
        const a1 = ang(P1), a2 = ang(P2);

        // 区間内の方を優先。両方/どちらも外なら，より近い方を返す等の方針で。
        if (inRange(a1) && !inRange(a2)) return P1;
        if (!inRange(a1) && inRange(a2)) return P2;

        // どちらも該当しない/両方該当 → cp0 に近い方を採用
        return (P1.sub(O).length() < P2.sub(O).length()) ? P1 : P2;
    }

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
        ctx.fillStyle = '#880000';
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

        ctx.fill();

        // アニメーション予約
        if (elapsed < time) requestAnimationFrame(animation);
        else cancelAnimationFrame(frame);
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