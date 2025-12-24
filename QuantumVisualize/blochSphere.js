class BlochSphereVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        this.controls = null;
        this.sphere = null;
        this.stateVector = null;
        this.stateArrow = null;
        this.projectionLine = null;
        this.rotationEnabled = true;
        
        // 量子态参数
        this.theta = 0; // 极角 (0 to π)
        this.phi = 0;   // 方位角 (0 to 2π)
        this.alpha = math.complex(1, 0); // |0⟩ 系数
        this.beta = math.complex(0, 0);  // |1⟩ 系数
        
        this.init();
        this.createBlochSphere();
        this.createStateVector();
        this.setupControls();
        this.animate();
        
        // 窗口大小调整监听
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    init() {
        // 渲染器设置
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        
        // 相机位置
        this.camera.position.set(0, 0, 5);
        
        // 控制器
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // 环境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // 定向光
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }
    
    createBlochSphere() {
        // 创建透明球体
        const sphereGeometry = new THREE.SphereGeometry(2, 64, 64);
        const sphereMaterial = new THREE.MeshPhongMaterial({
            color: 0x1565c0,
            transparent: true,
            opacity: 0.1,
            wireframe: false,
            side: THREE.DoubleSide
        });
        
        this.sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.scene.add(this.sphere);
        
        // 添加经纬线
        this.addLatitudeLines();
        this.addLongitudeLines();
        
        // 添加坐标轴
        this.addAxes();
        
        // 添加基态标签
        this.addLabels();
        
        // 添加赤道圆
        this.addEquator();
    }
    
    addLatitudeLines() {
        const latitudes = [30, 60, 120, 150]; // 纬度 (从北极算起)
        latitudes.forEach(lat => {
            const theta = lat * Math.PI / 180;
            const radius = 2 * Math.sin(theta);
            const y = 2 * Math.cos(theta);
            
            const circleGeometry = new THREE.CircleGeometry(radius, 64);
            circleGeometry.rotateX(Math.PI / 2);
            const circleMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.2
            });
            
            const circle = new THREE.Line(circleGeometry, circleMaterial);
            circle.position.y = y;
            this.scene.add(circle);
        });
    }
    
    addLongitudeLines() {
        const longitudes = [0, 45, 90, 135, 180, 225, 270, 315];
        longitudes.forEach(lon => {
            const phi = lon * Math.PI / 180;
            
            const points = [];
            for (let i = 0; i <= 180; i += 5) {
                const theta = i * Math.PI / 180;
                const x = 2 * Math.sin(theta) * Math.cos(phi);
                const y = 2 * Math.cos(theta);
                const z = 2 * Math.sin(theta) * Math.sin(phi);
                points.push(new THREE.Vector3(x, y, z));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.2
            });
            
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
        });
    }
    
    addAxes() {
        // X轴 (红色)
        const xAxis = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 0, 0),
            2.5,
            0xff4444,
            0.2,
            0.1
        );
        this.scene.add(xAxis);
        
        // Y轴 (绿色)
        const yAxis = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 0),
            2.5,
            0x44ff44,
            0.2,
            0.1
        );
        this.scene.add(yAxis);
        
        // Z轴 (蓝色)
        const zAxis = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, 0),
            2.5,
            0x4444ff,
            0.2,
            0.1
        );
        this.scene.add(zAxis);
    }
    
    addLabels() {
        const createTextSprite = (text, position, color = 0xffffff) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 128;
            
            context.fillStyle = 'rgba(0,0,0,0)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            context.font = 'bold 40px Arial';
            context.fillStyle = `rgb(${color >> 16}, ${(color >> 8) & 255}, ${color & 255})`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, canvas.width / 2, canvas.height / 2);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.copy(position);
            sprite.scale.set(1, 0.5, 1);
            
            return sprite;
        };
        
        this.scene.add(createTextSprite('|0⟩', new THREE.Vector3(0, 2.5, 0), 0x44ff44));
        this.scene.add(createTextSprite('|1⟩', new THREE.Vector3(0, -2.5, 0), 0xff4444));
        this.scene.add(createTextSprite('|+⟩', new THREE.Vector3(2.5, 0, 0), 0xffff44));
        this.scene.add(createTextSprite('|-⟩', new THREE.Vector3(-2.5, 0, 0), 0xff44ff));
        this.scene.add(createTextSprite('|+i⟩', new THREE.Vector3(0, 0, 2.5), 0x44ffff));
        this.scene.add(createTextSprite('|-i⟩', new THREE.Vector3(0, 0, -2.5), 0xff8844));
    }
    
    addEquator() {
        const equatorGeometry = new THREE.CircleGeometry(2, 64);
        equatorGeometry.rotateX(Math.PI / 2);
        const equatorMaterial = new THREE.LineBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.3
        });
        
        const equator = new THREE.Line(equatorGeometry, equatorMaterial);
        this.scene.add(equator);
    }
    
    createStateVector() {
        // 状态向量箭头
        const arrowDirection = this.calculateBlochVector();
        const arrowLength = 1.5;
        const arrowColor = 0xff00ff;
        
        if (this.stateArrow) {
            this.scene.remove(this.stateArrow);
        }
        
        this.stateArrow = new THREE.ArrowHelper(
            arrowDirection,
            new THREE.Vector3(0, 0, 0),
            arrowLength,
            arrowColor,
            0.2,
            0.1
        );
        
        // 添加箭头头部的球体
        const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: arrowColor });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(arrowDirection.multiplyScalar(arrowLength));
        this.stateArrow.add(sphere);
        
        this.scene.add(this.stateArrow);
        
        // 创建投影线
        this.createProjectionLines(arrowDirection);
        
        // 更新显示信息
        this.updateDisplayInfo();
    }
    
    createProjectionLines(blochVector) {
        // 清除旧的投影线
        if (this.projectionLine) {
            this.scene.remove(this.projectionLine);
        }
        
        // 创建到XY平面的投影线
        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(blochVector.x * 2, blochVector.y * 2, 0)
        ];
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0x00ffff,
            dashSize: 0.1,
            gapSize: 0.05,
            opacity: 0.5,
            transparent: true
        });
        
        this.projectionLine = new THREE.Line(geometry, material);
        this.projectionLine.computeLineDistances();
        this.scene.add(this.projectionLine);
    }
    
    calculateBlochVector() {
        // 从球坐标转换到笛卡尔坐标
        const x = Math.sin(this.theta) * Math.cos(this.phi);
        const y = Math.cos(this.theta);
        const z = Math.sin(this.theta) * Math.sin(this.phi);
        
        return new THREE.Vector3(x, y, z).normalize();
    }
    
    updateQuantumState(theta, phi) {
        this.theta = theta * Math.PI / 180;
        this.phi = phi * Math.PI / 180;
        
        // 计算复数系数
        this.alpha = math.complex(
            Math.cos(this.theta / 2),
            0
        );
        this.beta = math.complex(
            Math.sin(this.theta / 2) * Math.cos(this.phi),
            Math.sin(this.theta / 2) * Math.sin(this.phi)
        );
        
        // 重新创建状态向量
        this.createStateVector();
    }
    
    applyQuantumGate(gate) {
        // 量子门矩阵
        const gates = {
            'X': math.matrix([[0, 1], [1, 0]]),
            'Y': math.matrix([[0, math.complex(0, -1)], [math.complex(0, 1), 0]]),
            'Z': math.matrix([[1, 0], [0, -1]]),
            'H': math.multiply(1/Math.sqrt(2), math.matrix([[1, 1], [1, -1]])),
            'S': math.matrix([[1, 0], [0, math.complex(0, 1)]]),
            'T': math.matrix([[1, 0], [0, math.exp(math.complex(0, Math.PI/4))]])
        };
        
        const state = math.matrix([[this.alpha], [this.beta]]);
        const newState = math.multiply(gates[gate], state);
        
        // 更新系数
        this.alpha = newState.get([0, 0]);
        this.beta = newState.get([1, 0]);
        
        // 从系数计算球坐标
        this.updateFromCoefficients();
        this.createStateVector();
    }
    
    updateFromCoefficients() {
        // 从复数系数计算球坐标
        const alphaNorm = math.sqrt(math.add(math.pow(math.re(this.alpha), 2), math.pow(math.im(this.alpha), 2)));
        const betaNorm = math.sqrt(math.add(math.pow(math.re(this.beta), 2), math.pow(math.im(this.beta), 2)));
        
        this.theta = 2 * Math.atan2(betaNorm, alphaNorm);
        this.phi = Math.atan2(math.im(this.beta), math.re(this.beta));
        
        // 更新滑块值
        document.getElementById('theta').value = (this.theta * 180 / Math.PI).toFixed(0);
        document.getElementById('phi').value = ((this.phi + 2 * Math.PI) % (2 * Math.PI) * 180 / Math.PI).toFixed(0);
        
        this.updateSliderDisplay();
    }
    
    updateDisplayInfo() {
        const blochVector = this.calculateBlochVector();
        
        // 更新量子态显示
        const alphaStr = this.formatComplex(this.alpha);
        const betaStr = this.formatComplex(this.beta);
        document.getElementById('quantumState').textContent = `${alphaStr}|0⟩ + ${betaStr}|1⟩`;
        document.getElementById('stateVector').textContent = `${alphaStr}|0⟩ + ${betaStr}|1⟩`;
        
        // 更新坐标显示
        document.getElementById('coordinates').textContent = 
            `(${blochVector.x.toFixed(3)}, ${blochVector.y.toFixed(3)}, ${blochVector.z.toFixed(3)})`;
        document.getElementById('blochVector').textContent = 
            `(${blochVector.x.toFixed(3)}, ${blochVector.y.toFixed(3)}, ${blochVector.z.toFixed(3)})`;
        
        // 更新相位显示
        document.getElementById('phase').textContent = `${(this.phi * 180 / Math.PI).toFixed(1)}°`;
        
        // 更新测量概率
        const prob0 = math.pow(math.abs(this.alpha), 2);
        const prob1 = math.pow(math.abs(this.beta), 2);
        document.getElementById('prob0').textContent = `${(prob0 * 100).toFixed(1)}%`;
        document.getElementById('prob1').textContent = `${(prob1 * 100).toFixed(1)}%`;
        
        // 更新密度矩阵
        const rho00 = math.multiply(this.alpha, math.conj(this.alpha));
        const rho01 = math.multiply(this.alpha, math.conj(this.beta));
        const rho10 = math.multiply(this.beta, math.conj(this.alpha));
        const rho11 = math.multiply(this.beta, math.conj(this.beta));
        document.getElementById('densityMatrix').textContent = 
            `[[${this.formatComplex(rho00)}, ${this.formatComplex(rho01)}], [${this.formatComplex(rho10)}, ${this.formatComplex(rho11)}]]`;
    }
    
    formatComplex(c) {
        const re = math.re(c);
        const im = math.im(c);
        
        if (math.abs(im) < 1e-10) {
            return re.toFixed(3);
        } else if (math.abs(re) < 1e-10) {
            return `${im.toFixed(3)}i`;
        } else {
            const sign = im >= 0 ? '+' : '-';
            return `${re.toFixed(3)} ${sign} ${Math.abs(im).toFixed(3)}i`;
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.rotationEnabled) {
            this.sphere.rotation.y += 0.002;
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
        // 滑块控制
        document.getElementById('theta').addEventListener('input', (e) => {
            this.updateSliderDisplay();
            const phi = parseFloat(document.getElementById('phi').value);
            this.updateQuantumState(e.target.value, phi);
        });
        
        document.getElementById('phi').addEventListener('input', (e) => {
            this.updateSliderDisplay();
            const theta = parseFloat(document.getElementById('theta').value);
            this.updateQuantumState(theta, e.target.value);
        });
        
        // 基础量子态按钮
        document.querySelectorAll('.state-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const state = e.target.dataset.state;
                const states = {
                    '0': { theta: 0, phi: 0 },
                    '1': { theta: 180, phi: 0 },
                    'plus': { theta: 90, phi: 0 },
                    'minus': { theta: 90, phi: 180 },
                    'iplus': { theta: 90, phi: 90 },
                    'iminus': { theta: 90, phi: 270 }
                };
                
                if (states[state]) {
                    document.getElementById('theta').value = states[state].theta;
                    document.getElementById('phi').value = states[state].phi;
                    this.updateQuantumState(states[state].theta, states[state].phi);
                    this.updateSliderDisplay();
                }
            });
        });
        
        // 量子门按钮
        document.querySelectorAll('.gate-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.applyQuantumGate(e.target.dataset.gate);
            });
        });
        
        // 自定义量子态
        document.getElementById('applyCustom').addEventListener('click', () => {
            const alphaReal = parseFloat(document.getElementById('alphaReal').value);
            const alphaImag = parseFloat(document.getElementById('alphaImag').value);
            const betaReal = parseFloat(document.getElementById('betaReal').value);
            const betaImag = parseFloat(document.getElementById('betaImag').value);
            
            this.alpha = math.complex(alphaReal, alphaImag);
            this.beta = math.complex(betaReal, betaImag);
            
            // 归一化
            const norm = math.sqrt(
                math.add(
                    math.pow(math.abs(this.alpha), 2),
                    math.pow(math.abs(this.beta), 2)
                )
            );
            
            this.alpha = math.divide(this.alpha, norm);
            this.beta = math.divide(this.beta, norm);
            
            this.updateFromCoefficients();
            this.createStateVector();
        });
        
        // 重置视角
        document.getElementById('resetView').addEventListener('click', () => {
            this.controls.reset();
        });
        
        // 切换旋转
        document.getElementById('toggleRotation').addEventListener('click', (e) => {
            this.rotationEnabled = !this.rotationEnabled;
            e.target.textContent = `旋转: ${this.rotationEnabled ? '开' : '关'}`;
        });
    }
    
    updateSliderDisplay() {
        document.getElementById('thetaValue').textContent = `${document.getElementById('theta').value}°`;
        document.getElementById('phiValue').textContent = `${document.getElementById('phi').value}°`;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const visualizer = new BlochSphereVisualizer('blochSphere');
    
    // 设置初始状态为 |0⟩
    visualizer.updateQuantumState(0, 0);
    
    // 确保初始显示正确
    visualizer.updateSliderDisplay();
});