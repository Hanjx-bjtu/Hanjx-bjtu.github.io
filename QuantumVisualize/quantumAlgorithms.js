// quantumAlgorithms.js
// 提供 Deutsch-Jozsa, Grover, QFT, QPE 演示，使用 math.js 和 QuantumEngine
(function(window, math, QuantumEngine){
    'use strict';

    // 工具函数
    function arrToVector(arr){
        const dim = arr.length;
        const v = math.zeros(dim,1);
        for(let i=0;i<dim;i++){
            v.set([i,0], math.complex(arr[i].re||0, arr[i].im||0));
        }
        return v;
    }

    function vectorToArr(vec){
        const r = vec.size()[0];
        const out = [];
        for(let i=0;i<r;i++){
            const c = vec.get([i,0]);
            const cc = math.complex(c);
            out.push({re: cc.re, im: cc.im});
        }
        return out;
    }

    function normalizeArr(arr){
        let s = 0;
        for(const c of arr) s += c.re*c.re + c.im*c.im;
        s = Math.sqrt(s);
        return arr.map(c=>({re:c.re/s, im:c.im/s}));
    }

    function kron(A,B){
        const [ar,ac] = A.size();
        const [br,bc] = B.size();
        const M = math.zeros(ar*br, ac*bc);
        for(let i=0;i<ar;i++) for(let j=0;j<ac;j++){
            const a = A.get([i,j]);
            for(let p=0;p<br;p++) for(let q=0;q<bc;q++){
                M.set([i*br+p, j*bc+q], math.multiply(a, B.get([p,q])));
            }
        }
        return M;
    }

    function fullGateFrom2x2(g2, n){
        let M = null;
        for(let i=n-1;i>=0;i--){
            M = M ? kron(M, g2) : g2.clone();
        }
        return M;
    }

    function fullId(dim){ return math.identity(dim); }

    function qftMatrix(n){
        const N = 1<<n;
        const F = math.zeros(N,N);
        for(let j=0;j<N;j++){
            for(let k=0;k<N;k++){
                const val = math.exp(math.complex(0, 2*Math.PI*j*k/N));
                F.set([j,k], math.divide(val, Math.sqrt(N)));
            }
        }
        return F;
    }

    function diagMatrixFromArray(arr){
        const N = arr.length;
        const M = math.zeros(N,N);
        for(let i=0;i<N;i++) M.set([i,i], arr[i]);
        return M;
    }

    // UI 绑定与渲染
    function setText(id, txt){
        const el = document.getElementById(id);
        if(el) el.textContent = txt;
    }

    function populateParams(){
        const sel = document.getElementById('algorithmSelect');
        const box = document.getElementById('algorithmParams');
        box.innerHTML = '';
        if(!sel) return;
        const v = sel.value;
        if(v === 'deutsch'){
            box.innerHTML = `
                <label>输入比特数 n: <input id="dj_n" type="number" value="3" min="1" max="5" style="width:80px;padding:6px;border-radius:6px;"></label>
                <label>oracle 类型: 
                    <select id="dj_type" style="padding:6px;border-radius:6px;">
                        <option value="constant0">常函数 0</option>
                        <option value="constant1">常函数 1</option>
                        <option value="parity">平衡：按位奇偶校验</option>
                    </select>
                </label>
            `;
        } else if(v === 'grover'){
            box.innerHTML = `
                <label>比特数 n: <input id="gr_n" type="number" value="3" min="1" max="5" style="width:80px;padding:6px;border-radius:6px;"></label>
                <label>目标索引 (0..2^n-1): <input id="gr_target" type="number" value="3" min="0" style="width:120px;padding:6px;border-radius:6px;"></label>
            `;
        } else if(v === 'qft'){
            box.innerHTML = `
                <label>比特数 n: <input id="qft_n" type="number" value="3" min="1" max="6" style="width:80px;padding:6px;border-radius:6px;"></label>
                <label>输入基态索引 k: <input id="qft_k" type="number" value="3" min="0" style="width:120px;padding:6px;border-radius:6px;"></label>
            `;
        } else if(v === 'qpe'){
            box.innerHTML = `
                <label>计数比特 m: <input id="qpe_m" type="number" value="3" min="1" max="6" style="width:80px;padding:6px;border-radius:6px;"></label>
                <label>被估计相位 θ (0~1): <input id="qpe_theta" type="number" step="0.01" value="0.3125" min="0" max="1" style="width:120px;padding:6px;border-radius:6px;"></label>
            `;
        }
    }

    // 输出 amplitudes 列表
    function showAmplitudes(arr, n){
        const lines = [];
        for(let i=0;i<arr.length;i++){
            const c = arr[i];
            const mag = Math.sqrt((c.re||0)*(c.re||0) + (c.im||0)*(c.im||0));
            const bin = i.toString(2).padStart(n,'0');
            lines.push(`${bin}: ${(mag).toFixed(3)} (${(c.re||0).toFixed(3)} ${((c.im||0)>=0?'+':'-')} ${Math.abs((c.im||0)).toFixed(3)}i)`);
        }
        const el = document.getElementById('resultAmplitudes'); if(el) el.textContent = lines.join('\n');
    }

    function showProbabilities(arr, n){
        const probs = arr.map(c => (c.re*c.re + c.im*c.im));
        const lines = [];
        for(let i=0;i<probs.length;i++){
            const bin = i.toString(2).padStart(n,'0');
            lines.push(`${bin}: ${(probs[i]*100).toFixed(2)}%`);
        }
        const el = document.getElementById('resultProbabilities'); if(el) el.textContent = lines.join('\n');
    }

    // ========== Algorithms ==========
    function runDeutschJozsa(){
        const n = Math.max(1, Math.min(5, parseInt(document.getElementById('dj_n').value||3)));
        const type = document.getElementById('dj_type').value;
        const total = n + 1; // n inputs + 1 ancilla at qubit 0

        setText('evolutionSteps', '运行 Deutsch-Jozsa...');

        // 初始态 |0...0>, 把 ancilla 置为 |1>
        let state = QuantumEngine.zeroState(total);
        state = QuantumEngine.applySequence('X0', state, total);

        // H 对所有量子比特
        const H_all = Array.from({length: total}, (_,i)=>`H${i}`).join(' ');
        state = QuantumEngine.applySequence(H_all, state, total);

        // Oracle
        let oracleSeq = '';
        if(type === 'constant0'){
            oracleSeq = ''; // 不翻转 ancilla
        } else if(type === 'constant1'){
            // 对 ancilla 永远翻转：X0
            oracleSeq = 'X0';
        } else if(type === 'parity'){
            // parity: 对每个输入比特 i (1..n) 做 CNOT i -> ancilla(0)
            const tokens = [];
            for(let i=1;i<=n;i++) tokens.push(`CNOT${i}0`);
            oracleSeq = tokens.join(' ');
        }

        if(oracleSeq) state = QuantumEngine.applySequence(oracleSeq, state, total);

        // H 仅对输入寄存器 (1..n)
        const H_inputs = Array.from({length: n}, (_,i)=>`H${i+1}`).join(' ');
        state = QuantumEngine.applySequence(H_inputs, state, total);

        // 显示结果
        setText('finalDiracForm', QuantumEngine.toDirac(state, total));
        showAmplitudes(state, total);
        showProbabilities(state, total);

        // 决策：若输入寄存器测量结果全为 0 则为常函数
        const probs = QuantumEngine.probabilities(state);
        // 累加当输入寄存器为 0 的概率（即索引 < 2^n 且最低 n 位为0? careful with ordering)
        // 这里 ancilla 为最低位 (bit0)，输入寄存器是高位，按 quantumEngine 的位序，索引二进制为 [input_(n-1)...input_0 ancilla]
        // 因此要判断输入为 0，需要索引的高 n 位为 0 -> 索引 < 1<<0? Actually ancilla is bit0, so indices where input all zero are those with index having bits 1..n zero -> indices 0 or 1 (depending ancilla)
        // Simpler: sum probabilities where input bits (bits 1..n) are all zero
        let probInputAllZero = 0;
        for(let idx=0; idx<probs.length; idx++){
            // check bits 1..n
            let ok = true;
            for(let b=1;b<=n;b++){
                if(((idx>>b)&1)===1) { ok=false; break; }
            }
            if(ok) probInputAllZero += probs[idx];
        }

        const conclusion = probInputAllZero > 0.99 ? '判断：常函数' : '判断：平衡函数';
        setText('measurementResults', `${conclusion}（输入寄存器全为 |0...0⟩ 的概率 ${(probInputAllZero*100).toFixed(2)}%）`);
    }

    function runGrover(){
        const n = Math.max(1, Math.min(5, parseInt(document.getElementById('gr_n').value||3)));
        const target = Math.max(0, parseInt(document.getElementById('gr_target').value||0));
        const N = 1<<n;
        if(target >= N) { setText('evolutionSteps','目标索引超出范围'); return; }
        setText('evolutionSteps', '运行 Grover 搜索...');

        // 构造初始均匀态
        let psi = QuantumEngine.zeroState(n);
        // apply H to all
        const H_all = Array.from({length: n}, (_,i)=>`H${i}`).join(' ');
        psi = QuantumEngine.applySequence(H_all, psi, n);

        // 构造 Oracle 矩阵：对目标施加 -1 相位
        const diag = [];
        for(let i=0;i<N;i++) diag.push(i===target? math.complex(-1,0) : math.complex(1,0));
        const O = diagMatrixFromArray(diag);

        // 扩散算子 D = 2|s><s| - I
        const svec = math.multiply(1/Math.sqrt(N), math.ones(N,1));
        const proj = math.multiply(svec, math.transpose(math.conj(svec)));
        const D = math.subtract(math.multiply(2, proj), math.identity(N));

        // 将 psi 转换为 math 向量
        let v = arrToVector(psi);

        const iterations = Math.max(1, Math.floor(Math.PI/4*Math.sqrt(N)));
        for(let t=0;t<iterations;t++){
            v = math.multiply(O, v);
            v = math.multiply(D, v);
        }

        const outArr = vectorToArr(v);
        setText('finalDiracForm', QuantumEngine.toDirac(outArr, n));
        showAmplitudes(outArr, n);
        showProbabilities(outArr, n);

        // 显示最可能的索引
        const probs = outArr.map(c => (c.re*c.re + c.im*c.im));
        let best = 0; let bestp = 0;
        for(let i=0;i<probs.length;i++){ if(probs[i]>bestp){ bestp=probs[i]; best=i; } }
        setText('measurementResults', `最可能索引：${best} （概率 ${(bestp*100).toFixed(2)}%）`);
    }

    function runQFT(){
        const n = Math.max(1, Math.min(6, parseInt(document.getElementById('qft_n').value||3)));
        const k = Math.max(0, parseInt(document.getElementById('qft_k').value||0));
        const N = 1<<n;
        if(k>=N){ setText('evolutionSteps','输入索引超出范围'); return; }
        setText('evolutionSteps', '运行 QFT...');

        // 初始基态 |k>
        const psi = Array.from({length:N}, (_,i)=> ({re: i===k?1:0, im:0}));
        const F = qftMatrix(n);
        const v = math.multiply(F, arrToVector(psi));
        const outArr = vectorToArr(v);

        setText('finalDiracForm', QuantumEngine.toDirac(outArr, n));
        showAmplitudes(outArr, n);
        showProbabilities(outArr, n);
        setText('measurementResults', `QFT 将 |${k}\u27E9 映射到其傅里叶幅值分布`);
    }

    function runQPE(){
        const m = Math.max(1, Math.min(6, parseInt(document.getElementById('qpe_m').value||3)));
        const theta = parseFloat(document.getElementById('qpe_theta').value||0.3125);
        const total = m + 1; // m counting + 1 target
        setText('evolutionSteps', '运行 QPE（模拟）...');

        const dim = 1<<total;
        // 初始态 |0>^m ⊗ |1>
        let psi = Array.from({length:dim}, ()=>({re:0,im:0}));
        // index where counting=0 and target=1 -> binary ...1 => index = 1
        psi[1] = {re:1, im:0};

        // Apply H to counting qubits (0..m-1)
        for(let q=0;q<m;q++){
            // apply H on qubit q by building full H matrix
            const H2 = QuantumEngine.gates.H;
            const Hfull = fullGateFrom2x2(H2, total);
            // But we need H on specific qubit q; instead construct by kron product with I
        }
        // Simpler: use applySequence to do H0 H1 ... H(m-1)
        psi = QuantumEngine.applySequence(Array.from({length:m},(_,i)=>`H${i}`).join(' '), psi, total);

        // apply controlled-U^{2^j} for each counting qubit j
        // U acts on target qubit (index m) with eigenvalue exp(2π i theta) on |1>
        for(let j=0;j<m;j++){
            const power = 1<<j;
            // construct controlled-U^{power} matrix of size dim
            const M = math.zeros(dim, dim);
            for(let idx=0; idx<dim; idx++){
                // extract target bit
                const targetBit = (idx >> m) & 1; // target is highest bit? Actually target is bit m (0-based)
                // extract control bit j
                const controlBit = (idx >> j) & 1;
                let val = math.complex(1,0);
                if(controlBit === 1 && targetBit === 1){
                    const phase = 2*Math.PI*theta*power;
                    val = math.exp(math.complex(0, phase));
                }
                M.set([idx, idx], val);
            }
            psi = vectorToArr(math.multiply(M, arrToVector(psi)));
        }

        // apply inverse QFT on counting register (first m qubits)
        const F = qftMatrix(m);
        const Finv = math.conj(math.transpose(F));
        // build Finv ⊗ I_target
        const FinvFull = kron(Finv, math.identity(2));
        const finalVec = math.multiply(FinvFull, arrToVector(psi));
        const outArr = vectorToArr(finalVec);

        setText('finalDiracForm', QuantumEngine.toDirac(outArr, total));
        showAmplitudes(outArr, total);
        showProbabilities(outArr, total);

        // 汇总测量在计数寄存器上的概率分布
        const counts = {};
        for(let idx=0; idx<outArr.length; idx++){
            const prob = outArr[idx].re*outArr[idx].re + outArr[idx].im*outArr[idx].im;
            const countBits = (idx & ((1<<m)-1)).toString(2).padStart(m,'0');
            counts[countBits] = (counts[countBits]||0) + prob;
        }
        // 找到最大项
        let best = null, bestp = 0;
        for(const k in counts){ if(counts[k]>bestp){ bestp = counts[k]; best = k; } }
        // 把二进制 best 转换为估计 theta_hat
        const intval = parseInt(best,2);
        const thetaHat = intval / (1<<m);
        setText('measurementResults', `估计值（计数寄存器）: ${best} ≈ ${thetaHat} （概率 ${(bestp*100).toFixed(2)}%）`);
    }

    // 事件绑定
    document.addEventListener('DOMContentLoaded', ()=>{
        const sel = document.getElementById('algorithmSelect');
        const runBtn = document.getElementById('runAlgorithm');
        if(sel){ sel.addEventListener('change', populateParams); }
        populateParams();
        if(runBtn){
            runBtn.addEventListener('click', ()=>{
                const algo = document.getElementById('algorithmSelect').value;
                setText('evolutionSteps', '');
                setText('finalDiracForm', '');
                setText('resultAmplitudes', '');
                setText('resultProbabilities', '');
                setText('measurementResults', '');
                if(algo === 'deutsch') runDeutschJozsa();
                else if(algo === 'grover') runGrover();
                else if(algo === 'qft') runQFT();
                else if(algo === 'qpe') runQPE();
            });
        }
    });

})(window, math, window.QuantumEngine);
