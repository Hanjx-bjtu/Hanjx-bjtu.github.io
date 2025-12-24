// 量子运算引擎 v2.0 - 与 QV2 平台集成
// 依赖：math.js, 提供态矢量操作、门构造、测量等
(function(window, math) {
    'use strict';
    
    // ========== 基础量子门矩阵定义 ==========
    const I2 = math.matrix([[1, 0], [0, 1]]);
    const X = math.matrix([[0, 1], [1, 0]]);
    const Y = math.matrix([[0, math.complex(0, -1)], [math.complex(0, 1), 0]]);
    const Z = math.matrix([[1, 0], [0, -1]]);
    const H = math.multiply(1 / Math.sqrt(2), math.matrix([[1, 1], [1, -1]]));
    const S = math.matrix([[1, 0], [0, math.complex(0, 1)]]);
    const T = math.matrix([[1, 0], [0, math.exp(math.complex(0, Math.PI / 4))]]);
    
    const PAULI_X = X;
    const PAULI_Y = Y;
    const PAULI_Z = Z;
    
    // ========== 工具函数 ==========
    
    /**
     * Kronecker 积（张量积）
     * @param {Matrix} A - 左矩阵
     * @param {Matrix} B - 右矩阵
     * @returns {Matrix} A ⊗ B
     */
    function kron(A, B) {
        const [ar, ac] = [A.size()[0], A.size()[1]];
        const [br, bc] = [B.size()[0], B.size()[1]];
        const M = math.zeros(ar * br, ac * bc);
        
        for (let i = 0; i < ar; i++) {
            for (let j = 0; j < ac; j++) {
                const a = A.get([i, j]);
                for (let p = 0; p < br; p++) {
                    for (let q = 0; q < bc; q++) {
                        M.set([i * br + p, j * bc + q], math.multiply(a, B.get([p, q])));
                    }
                }
            }
        }
        return M;
    }
    
    /**
     * 复数数组转 math.js 向量
     */
    function arrayToVector(arr) {
        const dim = arr.length;
        const M = math.zeros(dim, 1);
        for (let i = 0; i < dim; i++) {
            const c = arr[i];
            M.set([i, 0], math.complex(c.re || 0, c.im || 0));
        }
        return M;
    }
    
    /**
     * math.js 向量转复数数组
     */
    function vectorToArray(vec) {
        const [r, c] = vec.size();
        const out = [];
        for (let i = 0; i < r; i++) {
            const v = vec.get([i, 0]);
            const comp = math.complex(v);
            out.push({ re: comp.re, im: comp.im });
        }
        return out;
    }
    
    /**
     * 归一化态向量（若未归一化）
     */
    function normalize(arr) {
        let norm = 0;
        for (let c of arr) {
            norm += c.re * c.re + c.im * c.im;
        }
        norm = Math.sqrt(norm);
        if (norm < 1e-10) {
            throw new Error('态向量范数为零，无法归一化');
        }
        return arr.map(c => ({
            re: c.re / norm,
            im: c.im / norm
        }));
    }
    
    /**
     * 复数相位（弧度）
     */
    function phase(c) {
        return Math.atan2(c.im, c.re);
    }
    
    /**
     * 复数模长
     */
    function magnitude(c) {
        return Math.sqrt(c.re * c.re + c.im * c.im);
    }
    
    /**
     * 提取全局相位（通过第一个非零分量）
     */
    function globalPhase(arr) {
        for (let c of arr) {
            if (magnitude(c) > 1e-10) {
                return phase(c);
            }
        }
        return 0;
    }
    
    // ========== 单比特门构造 ==========
    
    /**
     * 构造作用在比特 target 上的单比特门（全系统张量积形式）
     */
    function fullGateSingle(gate, n, target) {
        let M = null;
        for (let i = n - 1; i >= 0; i--) {
            const mat = (i === target) ? gate : I2;
            M = M ? kron(M, mat.clone()) : mat.clone();
        }
        return M;
    }
    
    /**
     * 旋转门：RX(θ)
     */
    function rxMatrix(theta) {
        const t = theta * Math.PI / 180;
        const c = Math.cos(t / 2);
        const s = Math.sin(t / 2);
        return math.matrix([
            [c, math.multiply(math.complex(0, -1), s)],
            [math.multiply(math.complex(0, -1), s), c]
        ]);
    }
    
    /**
     * 旋转门：RY(θ)
     */
    function ryMatrix(theta) {
        const t = theta * Math.PI / 180;
        const c = Math.cos(t / 2);
        const s = Math.sin(t / 2);
        return math.matrix([
            [c, -s],
            [s, c]
        ]);
    }
    
    /**
     * 旋转门：RZ(θ)
     */
    function rzMatrix(theta) {
        const t = theta * Math.PI / 180;
        return math.matrix([
            [math.exp(math.complex(0, -t / 2)), 0],
            [0, math.exp(math.complex(0, t / 2))]
        ]);
    }
    
    // ========== 多比特门构造 ==========
    
    /**
     * CNOT 门（受控非）
     * control, target: 比特索引
     */
    function fullGateCNOT(control, target, n) {
        const dim = 1 << n;
        const M = math.zeros(dim, dim);
        
        for (let s = 0; s < dim; s++) {
            const bitC = (s >> control) & 1;
            let tstate = s;
            if (bitC === 1) {
                tstate = s ^ (1 << target);
            }
            M.set([tstate, s], 1);
        }
        return M;
    }
    
    /**
     * CZ 门（受控-Z）
     */
    function fullGateCZ(control, target, n) {
        const dim = 1 << n;
        const M = math.zeros(dim, dim);
        
        for (let s = 0; s < dim; s++) {
            const bitC = (s >> control) & 1;
            const bitT = (s >> target) & 1;
            const phase = (bitC === 1 && bitT === 1) ? -1 : 1;
            M.set([s, s], phase);
        }
        return M;
    }
    
    /**
     * SWAP 门
     */
    function fullGateSWAP(qubit1, qubit2, n) {
        const dim = 1 << n;
        const M = math.zeros(dim, dim);
        
        for (let s = 0; s < dim; s++) {
            let tstate = s;
            const bit1 = (s >> qubit1) & 1;
            const bit2 = (s >> qubit2) & 1;
            
            if (bit1 !== bit2) {
                tstate = s ^ (1 << qubit1) ^ (1 << qubit2);
            }
            M.set([tstate, s], 1);
        }
        return M;
    }
    
    // ========== 特殊态构造 ==========
    
    /**
     * 创建 Bell 态 |Φ+⟩ = (|00⟩ + |11⟩) / √2
     */
    function bellState(n = 2) {
        const arr = Array(1 << n).fill({ re: 0, im: 0 });
        arr[0] = { re: 1 / Math.sqrt(2), im: 0 };
        arr[(1 << n) - 1] = { re: 1 / Math.sqrt(2), im: 0 };
        return arr;
    }
    
    /**
     * 创建 GHZ 态 |GHZ⟩ = (|00...0⟩ + |11...1⟩) / √2
     */
    function ghzState(n) {
        const arr = Array(1 << n).fill({ re: 0, im: 0 });
        arr[0] = { re: 1 / Math.sqrt(2), im: 0 };
        arr[(1 << n) - 1] = { re: 1 / Math.sqrt(2), im: 0 };
        return arr;
    }
    
    /**
     * 创建 W 态 (n 个比特中恰好一个为 |1⟩ 的等幅叠加)
     */
    function wState(n) {
        const val = 1 / Math.sqrt(n);
        const arr = Array(1 << n).fill({ re: 0, im: 0 });
        for (let i = 0; i < n; i++) {
            arr[1 << i] = { re: val, im: 0 };
        }
        return arr;
    }
    
    // ========== 态矢量解析 ==========
    
    /**
     * 解析 token（单个门操作）
     * 支持：X0, Y1, Z2, H3, S4, T5, RX0(90), RY1(45), RZ2(60)
     *       CNOT01, CZ01, SWAP01, BELL, GHZ, W
     */
    function parseToken(token, n) {
        token = token.trim().toUpperCase();
        if (!token) return null;
        
        // 旋转门：RX0(90), RY1(45), RZ2(60)
        const rotMatch = token.match(/^R([XYZ])(\d+)\(([-\d.]+)\)$/);
        if (rotMatch) {
            return {
                type: 'rotation',
                axis: rotMatch[1],
                qubit: parseInt(rotMatch[2]),
                angle: parseFloat(rotMatch[3])
            };
        }
        
        // 多比特特殊态：BELL, GHZ, W
        const specialMatch = token.match(/^(BELL|GHZ|W)$/);
        if (specialMatch) {
            return {
                type: 'special',
                name: specialMatch[1]
            };
        }
        
        // 两比特门：CNOT01, CZ01, SWAP01
        const twoQubitMatch = token.match(/^(CNOT|CZ|SWAP)(\d)(\d)$/);
        if (twoQubitMatch) {
            return {
                type: twoQubitMatch[1].toLowerCase(),
                control: parseInt(twoQubitMatch[2]),
                target: parseInt(twoQubitMatch[3])
            };
        }
        
        // 单比特门：X0, Y1, H2, S3, T4
        const singleMatch = token.match(/^([XYZHST])(\d+)$/);
        if (singleMatch) {
            return {
                type: 'pauli',
                gate: singleMatch[1],
                qubit: parseInt(singleMatch[2])
            };
        }
        
        throw new Error(`无法解析 token: ${token}`);
    }
    
    // ========== 核心运算 ==========
    
    /**
     * 应用门序列到初始态
     * @param {string} expr - 门序列表达式（空格分隔）
     * @param {Array} initArr - 初始态向量（复数数组）
     * @param {number} n - 比特数
     * @returns {Array} 演化后的态向量
     */
    function applySequence(expr, initArr, n) {
        const tokens = expr.split(/\s+/).filter(Boolean);
        let stateMat = arrayToVector(initArr);
        
        for (const tok of tokens) {
            const parsed = parseToken(tok, n);
            if (!parsed) continue;
            
            let gate = null;
            
            if (parsed.type === 'pauli') {
                const gateMap = { 'X': X, 'Y': Y, 'Z': Z, 'H': H, 'S': S, 'T': T };
                gate = gateMap[parsed.gate];
                if (!gate) throw new Error(`未知门: ${parsed.gate}`);
                const fullGate = fullGateSingle(gate, n, parsed.qubit);
                stateMat = math.multiply(fullGate, stateMat);
                
            } else if (parsed.type === 'rotation') {
                let rotGate;
                if (parsed.axis === 'X') rotGate = rxMatrix(parsed.angle);
                else if (parsed.axis === 'Y') rotGate = ryMatrix(parsed.angle);
                else if (parsed.axis === 'Z') rotGate = rzMatrix(parsed.angle);
                const fullGate = fullGateSingle(rotGate, n, parsed.qubit);
                stateMat = math.multiply(fullGate, stateMat);
                
            } else if (parsed.type === 'cnot') {
                const fullGate = fullGateCNOT(parsed.control, parsed.target, n);
                stateMat = math.multiply(fullGate, stateMat);
                
            } else if (parsed.type === 'cz') {
                const fullGate = fullGateCZ(parsed.control, parsed.target, n);
                stateMat = math.multiply(fullGate, stateMat);
                
            } else if (parsed.type === 'swap') {
                const fullGate = fullGateSWAP(parsed.control, parsed.target, n);
                stateMat = math.multiply(fullGate, stateMat);
                
            } else if (parsed.type === 'special') {
                if (parsed.name === 'BELL') {
                    return bellState(n);
                } else if (parsed.name === 'GHZ') {
                    return ghzState(n);
                } else if (parsed.name === 'W') {
                    return wState(n);
                }
            }
        }
        
        return vectorToArray(stateMat);
    }
    
    /**
     * 计算测量概率
     */
    function probabilities(arr) {
        return arr.map(c => c.re * c.re + c.im * c.im);
    }
    
    /**
     * 模拟单次测量，返回测得的比特串索引
     */
    function measure(arr) {
        const probs = probabilities(arr);
        const cdf = [];
        let sum = 0;
        for (let p of probs) {
            sum += p;
            cdf.push(sum);
        }
        
        const r = Math.random();
        for (let i = 0; i < cdf.length; i++) {
            if (r <= cdf[i]) return i;
        }
        return probs.length - 1;
    }
    
    /**
     * 初始化为 |0...0⟩
     */
    function zeroState(n) {
        const arr = Array(1 << n).fill({ re: 0, im: 0 });
        arr[0] = { re: 1, im: 0 };
        return arr;
    }
    
    /**
     * 初始化为 |1⟩（单比特）或 |1...1⟩ (n比特)
     */
    function oneState(n) {
        const arr = Array(1 << n).fill({ re: 0, im: 0 });
        arr[(1 << n) - 1] = { re: 1, im: 0 };
        return arr;
    }
    
    /**
     * 计算 Schmidt 秩（纠缠度）
     * 按前 m 个比特与后 n-m 个比特分割
     */
    function schmidtRank(arr, n, m = null) {
        if (m === null) m = Math.floor(n / 2);
        
        const splitSize = 1 << m;
        const subsystemSize = 1 << (n - m);
        const M = math.zeros(splitSize, subsystemSize);
        
        for (let i = 0; i < arr.length; i++) {
            const row = Math.floor(i / subsystemSize);
            const col = i % subsystemSize;
            M.set([row, col], math.complex(arr[i].re, arr[i].im));
        }
        
        // 计算奇异值分解（简化：计算非零项数作为纠缠指标）
        const nonZeroCount = arr.filter(c => magnitude(c) > 1e-10).length;
        return Math.min(nonZeroCount, Math.min(splitSize, subsystemSize));
    }
    
    /**
     * 计算纠缠熵（von Neumann 熵）
     */
    function entanglementEntropy(arr, n, m = null) {
        if (m === null) m = Math.floor(n / 2);
        
        const splitSize = 1 << m;
        const subsystemSize = 1 << (n - m);
        
        // 约化密度矩阵 ρ_A
        const rhoA = Array(splitSize).fill(0);
        for (let i = 0; i < arr.length; i++) {
            const row = Math.floor(i / subsystemSize);
            const mag2 = arr[i].re * arr[i].re + arr[i].im * arr[i].im;
            rhoA[row] += mag2;
        }
        
        // von Neumann 熵：S = -Σ λ_i log2(λ_i)
        let entropy = 0;
        for (let p of rhoA) {
            if (p > 1e-10) {
                entropy -= p * Math.log2(p);
            }
        }
        return entropy;
    }
    
    /**
     * 生成 Dirac 记号表示
     */
    function toDirac(arr, n, threshold = 1e-4) {
        const terms = [];
        for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            const mag = magnitude(c);
            if (mag < threshold) continue;
            
            const binary = i.toString(2).padStart(n, '0');
            const ph = phase(c) * 180 / Math.PI;
            
            let term = `${mag.toFixed(3)}`;
            if (Math.abs(ph) > 0.1) {
                term += `e^{i${ph.toFixed(1)}°}`;
            }
            term += `|${binary}⟩`;
            terms.push(term);
        }
        return terms.length > 0 ? terms.join(' + ') : '0';
    }
    
    // ========== 公共 API ==========
    window.QuantumEngine = {
        // 基础运算
        zeroState,
        oneState,
        applySequence,
        probabilities,
        measure,
        normalize,
        
        // 特殊态
        bellState,
        ghzState,
        wState,
        
        // 纠缠分析
        schmidtRank,
        entanglementEntropy,
        
        // 显示
        toDirac,
        
        // 辅助
        magnitude,
        phase,
        globalPhase,
        
        // 门矩阵（用于外部需要）
        gates: {
            I: I2, X, Y, Z, H, S, T,
            RX: rxMatrix,
            RY: ryMatrix,
            RZ: rzMatrix
        }
    };
    
})(window, math);