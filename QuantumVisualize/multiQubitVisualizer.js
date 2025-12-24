class MultiQubitVisualizer {
    constructor(containerId, numQubits = 2) {
        this.container = document.getElementById(containerId);
        this.numQubits = numQubits;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75, 
            this.container.clientWidth / this.container.clientHeight, 
            0.1, 
            1000
        );
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        this.controls = null;
        this.qubitSpheres = [];
        this.stateArrows = [];
        this.entanglementLine = null;
        this.rotationEnabled = true;
        
        // 多量子比特状态参数
        this.qubitStates = [];
        this.globalState = null;
        this.densityMatrix = null;
        
        this.init();
        this.createMultiQubitVisualization();
        this.setupControls();
        this.animate();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    init() {
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        
        this.camera.position.set(8, 5, 8);
        
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // 灯光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 10);
        this.scene.add(directionalLight);
        
        // 初始化量子态
        this.initializeQubitStates();
    }
    
    initializeQubitStates() {
        // 默认每个量子比特处于 |0⟩ 态
        this.qubitStates = [];
        for (let i = 0; i < this.numQubits; i++) {
            this.qubitStates.push({
                alpha: math.complex(1, 0),
                beta: math.complex(0, 0),
                theta: 0,
                phi: 0,
                position: new THREE.Vector3(i * 4 - (this.numQubits-1)*2, 0, 0)
            });
        }
        
        // 计算全局态
        this.updateGlobalState();
    }
    
    createMultiQubitVisualization() {
        // 创建每个量子比特的布洛赫球
        for (let i = 0; i < this.numQubits; i++) {
            const qubitSphere = this.createSingleQubitSphere(i);
            this.qubitSpheres.push(qubitSphere);
            
            // 创建状态箭头
            const stateArrow = this.createStateArrow(i);
            this.stateArrows.push(stateArrow);
        }
        
        // 添加量子比特标签
        this.addQubitLabels();
        
        // 添加纠缠连接线
        this.updateEntanglementLines();
    }
    
    createSingleQubitSphere(qubitIndex) {
        const group = new THREE.Group();
        const state = this.qubitStates[qubitIndex];
        
        // 透明球体
        const sphereGeometry = new THREE.SphereGeometry(1.5, 32, 32);
        const sphereMaterial = new THREE.MeshPhongMaterial({
            color: this.getQubitColor(qubitIndex),
            transparent: true,
            opacity: 0.1,
            wireframe: false,
            side: THREE.DoubleSide
        });
        
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        group.add(sphere);
        
        // 坐标轴
        const axesHelper = new THREE.AxesHelper(2);
        group.add(axesHelper);
        
        // 赤道圆
        const equatorGeometry = new THREE.CircleGeometry(1.5, 32);
        equatorGeometry.rotateX(Math.PI / 2);
        const equatorMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3
        });
        const equator = new THREE.Line(equatorGeometry, equatorMaterial);
        group.add(equator);
        
        // 基态标签
        this.addQubitLabelsToSphere(group, qubitIndex);
        
        group.position.copy(state.position);
        this.scene.add(group);
        
        return group;
    }
    
    createStateArrow(qubitIndex) {
        const state = this.qubitStates[qubitIndex];
        const direction = this.calculateBlochVector(state.theta, state.phi);
        const arrowColor = this.getQubitColor(qubitIndex);
        
        const arrow = new THREE.ArrowHelper(
            direction,
            new THREE.Vector3(0, 0, 0),
            1.2,
            arrowColor,
            0.15,
            0.08
        );
        
        // 箭头头部球体
        const sphereGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: arrowColor });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(direction.multiplyScalar(1.2));
        arrow.add(sphere);
        
        arrow.position.copy(state.position);
        this.scene.add(arrow);
        
        return arrow;
    }
    
    addQubitLabels() {
        for (let i = 0; i < this.numQubits; i++) {
            const text = `Qubit ${i}`;
            const sprite = this.createTextSprite(text, this.getQubitColor(i));
            sprite.position.copy(this.qubitStates[i].position);
            sprite.position.y = -2.5;
            this.scene.add(sprite);
        }
    }
    
    addQubitLabelsToSphere(group, qubitIndex) {
        const createLabelSprite = (text, position, color) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 128;
            canvas.height = 64;
            
            context.fillStyle = 'rgba(0,0,0,0)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            context.font = 'bold 20px Arial';
            context.fillStyle = `rgb(${color >> 16}, ${(color >> 8) & 255}, ${color & 255})`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, canvas.width / 2, canvas.height / 2);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.copy(position);
            sprite.scale.set(0.5, 0.25, 1);
            
            return sprite;
        };
        
        group.add(createLabelSprite('|0⟩', new THREE.Vector3(0, 1.8, 0), 0x44ff44));
        group.add(createLabelSprite('|1⟩', new THREE.Vector3(0, -1.8, 0), 0xff4444));
        group.add(createLabelSprite('|+⟩', new THREE.Vector3(1.8, 0, 0), 0xffff44));
        group.add(createLabelSprite('|-⟩', new THREE.Vector3(-1.8, 0, 0), 0xff44ff));
    }
    
    createTextSprite(text, color = 0xffffff) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        context.fillStyle = 'rgba(0,0,0,0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'bold 30px Arial';
        context.fillStyle = `rgb(${color >> 16}, ${(color >> 8) & 255}, ${color & 255})`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1.5, 0.75, 1);
        
        return sprite;
    }
    
    getQubitColor(qubitIndex) {
        const colors = [
            0xff6b6b, 0x4ecdc4, 0xffd166, 0x06d6a0, 
            0x118ab2, 0xef476f, 0x7209b7, 0xf15bb5
        ];
        return colors[qubitIndex % colors.length];
    }
    
    calculateBlochVector(theta, phi) {
        const x = Math.sin(theta) * Math.cos(phi);
        const y = Math.cos(theta);
        const z = Math.sin(theta) * Math.sin(phi);
        
        return new THREE.Vector3(x, y, z).normalize();
    }
    
    updateQubitState(qubitIndex, theta, phi) {
        const state = this.qubitStates[qubitIndex];
        state.theta = theta * Math.PI / 180;
        state.phi = phi * Math.PI / 180;
        
        state.alpha = math.complex(Math.cos(state.theta / 2), 0);
        state.beta = math.complex(
            Math.sin(state.theta / 2) * Math.cos(state.phi),
            Math.sin(state.theta / 2) * Math.sin(state.phi)
        );
        
        this.updateStateArrow(qubitIndex);
        this.updateGlobalState();
        this.updateDisplay();
    }
    
    updateStateArrow(qubitIndex) {
        const state = this.qubitStates[qubitIndex];
        const direction = this.calculateBlochVector(state.theta, state.phi);
        const arrow = this.stateArrows[qubitIndex];
        
        // 更新箭头方向
        arrow.setDirection(direction);
        
        // 更新头部球体位置
        const headSphere = arrow.children[0];
        headSphere.position.copy(direction.multiplyScalar(1.2));
    }
    
    updateGlobalState() {
        // 计算张量积得到全局态
        let globalState = math.matrix([[math.complex(1, 0)]]);
        
        for (const state of this.qubitStates) {
            const qubitState = math.matrix([[state.alpha], [state.beta]]);
            globalState = math.kron(globalState, qubitState);
        }
        
        this.globalState = globalState;
        
        // 计算密度矩阵
        const psi = globalState;
        const psiDagger = math.transpose(math.conj(psi));
        this.densityMatrix = math.multiply(psi, psiDagger);
        
        // 更新纠缠信息
        this.calculateEntanglement();
    }
    
    calculateEntanglement() {
        // 计算纠缠度（简化的纠缠熵）
        if (this.numQubits >= 2) {
            // 这里可以添加更复杂的纠缠度量计算
            this.updateEntanglementLines();
        }
    }
    
    updateEntanglementLines() {
        // 清除旧的纠缠线
        if (this.entanglementLine) {
            this.scene.remove(this.entanglementLine);
        }
        
        // 如果有纠缠，绘制连接线
        if (this.numQubits >= 2) {
            const points = [];
            for (let i = 0; i < this.numQubits; i++) {
                points.push(this.qubitStates[i].position);
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineDashedMaterial({
                color: 0xffff00,
                dashSize: 0.2,
                gapSize: 0.1,
                opacity: 0.5,
                transparent: true
            });
            
            this.entanglementLine = new THREE.Line(geometry, material);
            this.entanglementLine.computeLineDistances();
            this.scene.add(this.entanglementLine);
        }
    }
    
    applyMultiQubitGate(gateType) {
        // 多量子比特门操作
        const gates = {
            'CNOT': this.applyCNOTGate.bind(this),
            'SWAP': this.applySWAPGate.bind(this),
            'CZ': this.applyCZGate.bind(this),
            'Bell': this.createBellState.bind(this),
            'GHZ': this.createGHZState.bind(this)
        };
        
        if (gates[gateType]) {
            gates[gateType]();
            this.updateAllStates();
        }
    }
    
    applyCNOTGate() {
        // CNOT门：控制第一个量子比特，目标第二个量子比特
        if (this.numQubits >= 2) {
            // 简化的CNOT操作（实际应为4x4矩阵）
            // 这里仅演示，实际需要完整的矩阵计算
            const controlState = this.qubitStates[0];
            const targetState = this.qubitStates[1];
            
            if (Math.abs(controlState.theta) < 0.001) {
                // 控制比特接近|0⟩，目标不变
            } else if (Math.abs(controlState.theta - Math.PI) < 0.001) {
                // 控制比特接近|1⟩，目标翻转
                targetState.theta = Math.PI - targetState.theta;
                targetState.phi = targetState.phi + Math.PI;
            }
            
            this.updateGlobalState();
        }
    }

    applySWAPGate() {
        // 交换第一个和第二个量子比特的状态（简化实现）
        if (this.numQubits >= 2) {
            const a0 = this.qubitStates[0];
            const a1 = this.qubitStates[1];

            // 交换振幅和角度表示
            const tmp = {
                alpha: a0.alpha,
                beta: a0.beta,
                theta: a0.theta,
                phi: a0.phi
            };

            a0.alpha = a1.alpha;
            a0.beta = a1.beta;
            a0.theta = a1.theta;
            a0.phi = a1.phi;

            a1.alpha = tmp.alpha;
            a1.beta = tmp.beta;
            a1.theta = tmp.theta;
            a1.phi = tmp.phi;

            this.updateAllStates();
        }
    }

    applyCZGate() {
        // 受控-Z（简化）：如果控制比特接近 |1⟩，对目标比特添加相位 π
        if (this.numQubits >= 2) {
            const control = this.qubitStates[0];
            const target = this.qubitStates[1];

            const controlIsOne = Math.abs(control.theta - Math.PI) < 0.2;
            if (controlIsOne) {
                target.phi = (target.phi + Math.PI) % (2 * Math.PI);
                // 更新复振幅以反映相位变化
                target.alpha = math.complex(Math.cos(target.theta / 2), 0);
                target.beta = math.complex(
                    Math.sin(target.theta / 2) * Math.cos(target.phi),
                    Math.sin(target.theta / 2) * Math.sin(target.phi)
                );
            }

            this.updateAllStates();
        }
    }
    
    createBellState() {
        // 创建贝尔态 |Φ+⟩ = (|00⟩ + |11⟩)/√2
        if (this.numQubits >= 2) {
            // 设置两个量子比特到纠缠态
            this.qubitStates[0].theta = Math.PI / 2;
            this.qubitStates[0].phi = 0;
            this.qubitStates[1].theta = Math.PI / 2;
            this.qubitStates[1].phi = 0;
            
            this.updateAllStates();
        }
    }
    
    createGHZState() {
        // 创建GHZ态 (|000...⟩ + |111...⟩)/√2
        for (let i = 0; i < this.numQubits; i++) {
            this.qubitStates[i].theta = i % 2 === 0 ? 0 : Math.PI;
            this.qubitStates[i].phi = 0;
        }
        
        this.updateAllStates();
    }
    
    updateAllStates() {
        // 更新所有量子比特的显示
        for (let i = 0; i < this.numQubits; i++) {
            this.updateStateArrow(i);
        }
        
        this.updateGlobalState();
        this.updateDisplay();
    }
    
    updateDisplay() {
        // 更新显示信息
        const stateTexts = [];
        for (let i = 0; i < this.numQubits; i++) {
            const state = this.qubitStates[i];
            const alphaStr = this.formatComplex(state.alpha);
            const betaStr = this.formatComplex(state.beta);
            stateTexts.push(`Q${i}: ${alphaStr}|0⟩ + ${betaStr}|1⟩`);
        }
        
        document.getElementById('multiQubitState').textContent = stateTexts.join(' ⊗ ');
        
        // 更新纠缠信息
        const entanglementLevel = this.calculateEntanglementMeasure();
        document.getElementById('entanglementInfo').textContent = 
            `纠缠度: ${entanglementLevel.toFixed(3)}`;
        
        // 更新全局态维度
        document.getElementById('stateDimension').textContent = 
            `${Math.pow(2, this.numQubits)}维希尔伯特空间`;
    }
    
    calculateEntanglementMeasure() {
        // 简化的纠缠度量（实际应为冯·诺依曼熵）
        if (this.numQubits < 2) return 0;
        
        // 基于量子比特状态差异的简单度量
        let measure = 0;
        for (let i = 0; i < this.numQubits; i++) {
            for (let j = i + 1; j < this.numQubits; j++) {
                const diff = Math.abs(this.qubitStates[i].theta - this.qubitStates[j].theta);
                measure += Math.sin(diff / 2);
            }
        }
        
        return measure / (this.numQubits * (this.numQubits - 1) / 2);
    }
    
    formatComplex(c) {
        const re = math.re(c);
        const im = math.im(c);
        
        if (Math.abs(im) < 1e-10) {
            return re.toFixed(3);
        } else if (Math.abs(re) < 1e-10) {
            return `${im.toFixed(3)}i`;
        } else {
            const sign = im >= 0 ? '+' : '-';
            return `${re.toFixed(3)} ${sign} ${Math.abs(im).toFixed(3)}i`;
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.rotationEnabled) {
            this.qubitSpheres.forEach((sphere, index) => {
                sphere.rotation.y += 0.001 * (index + 1);
            });
        }
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    setupControls() {
        // 量子比特数量选择
        document.getElementById('qubitCount').addEventListener('change', (e) => {
            this.changeQubitCount(parseInt(e.target.value));
        });
        
        // 多量子比特门按钮
        document.querySelectorAll('.multi-gate-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.applyMultiQubitGate(e.target.dataset.gate);
            });
        });
        
        // 单个量子比特控制
        for (let i = 0; i < this.numQubits; i++) {
            document.getElementById(`theta${i}`)?.addEventListener('input', (e) => {
                const phi = parseFloat(document.getElementById(`phi${i}`).value);
                this.updateQubitState(i, e.target.value, phi);
            });
            
            document.getElementById(`phi${i}`)?.addEventListener('input', (e) => {
                const theta = parseFloat(document.getElementById(`theta${i}`).value);
                this.updateQubitState(i, theta, e.target.value);
            });
        }
    }
    
    changeQubitCount(newCount) {
        this.numQubits = newCount;
        
        // 清除场景
        while(this.scene.children.length > 0){ 
            this.scene.remove(this.scene.children[0]); 
        }
        
        // 重新初始化
        this.qubitSpheres = [];
        this.stateArrows = [];
        this.entanglementLine = null;
        
        this.initializeQubitStates();
        this.createMultiQubitVisualization();
        
        // 重新设置灯光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 10);
        this.scene.add(directionalLight);
        
        this.updateDisplay();
    }
}