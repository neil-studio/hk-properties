// ==========================================================================
// 香港一手新盘销控中心 - 前端核心逻辑 (Vanilla JS)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 登录模块元素引用
  const loginOverlay = document.getElementById('loginOverlay');
  const loginCard = document.getElementById('loginCard');
  const passwordInput = document.getElementById('passwordInput');
  const loginBtn = document.getElementById('loginBtn');
  const loginErrorMsg = document.getElementById('loginErrorMsg');

  // DOM 元素引用
  const lastUpdatedBadge = document.getElementById('lastUpdatedBadge');
  const statProjects = document.getElementById('statProjects');
  const statUnits = document.getElementById('statUnits');
  const statSoldRate = document.getElementById('statSoldRate');
  const statOnSale = document.getElementById('statOnSale');
  
  const searchInput = document.getElementById('searchInput');
  const regionButtons = document.querySelectorAll('#regionFilter .filter-btn');
  const districtSelect = document.getElementById('districtSelect');
  const projectGrid = document.getElementById('projectGrid');
  
  const previewModal = document.getElementById('previewModal');
  const modalProjectTitle = document.getElementById('modalProjectTitle');
  const modalProjectSubtitle = document.getElementById('modalProjectSubtitle');
  const closeModalBtn = document.getElementById('closeModalBtn');
  
  const buildingTabs = document.getElementById('buildingTabs');
  const gridRenderArea = document.getElementById('gridRenderArea');
  
  // 楼栋统计元素
  const bStatTotal = document.getElementById('bStatTotal');
  const bStatSale = document.getElementById('bStatSale');
  const bStatPriced = document.getElementById('bStatPriced');
  const bStatSold = document.getElementById('bStatSold');
  const bStatStopped = document.getElementById('bStatStopped');

  // 缩放控制元素
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');
  const zoomLevelLabel = document.getElementById('zoomLevel');

  // 全局数据状态
  let allProjects = [];
  let globalStats = {};
  let activeRegion = 'all';
  let activeDistrict = 'all';
  let searchQuery = '';
  let currentZoom = 1.0;

  // 1. 初始化，获取数据索引
  async function init() {
    try {
      const response = await fetch('data.json');
      if (!response.ok) {
        throw new Error('未找到元数据文件 data.json，请先运行 build_web.py 脚本生成数据库。');
      }
      const data = await response.json();
      allProjects = data.projects || [];
      globalStats = data.global_stats || {};
      
      // 更新大屏统计数据
      updateDashboard();
      // 初始化商圈下拉列表
      populateDistricts();
      // 渲染项目卡片列表
      renderProjects();
      
      // 注册事件监听
      setupEventListeners();
    } catch (error) {
      console.error(error);
      projectGrid.innerHTML = `
        <div class="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <h3>数据加载失败</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  // 2. 更新大屏看板
  function updateDashboard() {
    if (globalStats.last_updated) {
      // 格式化更新时间显示
      lastUpdatedBadge.textContent = `上次更新: ${globalStats.last_updated}`;
    }
    statProjects.textContent = globalStats.total_projects || 0;
    statUnits.textContent = (globalStats.total_units || 0).toLocaleString();
    statSoldRate.textContent = `${globalStats.overall_sold_rate || 0}%`;
    statOnSale.textContent = (globalStats.total_sale || 0).toLocaleString();
  }

  // 3. 构建商圈下拉列表
  function populateDistricts() {
    // 过滤出符合当前 Region 区域的所有商圈
    const districts = new Set();
    allProjects.forEach(proj => {
      if (activeRegion === 'all' || proj.region === activeRegion) {
        districts.add(proj.district);
      }
    });

    // 重新填充下拉框
    districtSelect.innerHTML = '<option value="all">所有商圈</option>';
    Array.from(districts).sort().forEach(dist => {
      const option = document.createElement('option');
      option.value = dist;
      option.textContent = dist;
      if (activeDistrict === dist) {
        option.selected = true;
      }
      districtSelect.appendChild(option);
    });
    
    // 如果之前选中的商圈在过滤后不存在了，重置为 all
    if (activeDistrict !== 'all' && !districts.has(activeDistrict)) {
      activeDistrict = 'all';
      districtSelect.value = 'all';
    }
  }

  // 4. 事件监听器配置
  function setupEventListeners() {
    // 搜索输入过滤
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderProjects();
    });

    // 区域 Tab 切换
    regionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        regionButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeRegion = btn.dataset.region;
        
        // 区域变动时重新过滤并重置商圈列表
        populateDistricts();
        renderProjects();
      });
    });

    // 商圈下拉框切换
    districtSelect.addEventListener('change', (e) => {
      activeDistrict = e.target.value;
      renderProjects();
    });

    // 模态弹窗关闭事件
    closeModalBtn.addEventListener('click', closePreviewModal);
    
    // 点击遮罩层关闭模态弹窗
    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) {
        closePreviewModal();
      }
    });

    // ESC 键关闭模态弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && previewModal.classList.contains('open')) {
        closePreviewModal();
      }
    });

    // 缩放控制按钮事件
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        applyZoom(currentZoom - 0.1);
      });
    }
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        applyZoom(currentZoom + 0.1);
      });
    }
    if (zoomResetBtn) {
      zoomResetBtn.addEventListener('click', () => {
        applyZoom(1.0);
      });
    }

    // 销控网格大区绑定双指捏合手势
    if (gridRenderArea) {
      setupTouchZoom(gridRenderArea);
    }
  }

  // 5. 渲染项目列表
  function renderProjects() {
    projectGrid.innerHTML = '';

    // 执行多重交叉过滤
    const filtered = allProjects.filter(proj => {
      // 1. 区域过滤
      if (activeRegion !== 'all' && proj.region !== activeRegion) return false;
      // 2. 商圈过滤
      if (activeDistrict !== 'all' && proj.district !== activeDistrict) return false;
      // 3. 搜索框过滤（匹配名称、区域、商圈）
      if (searchQuery) {
        const matchesName = proj.name.toLowerCase().includes(searchQuery);
        const matchesRegion = proj.region.toLowerCase().includes(searchQuery);
        const matchesDistrict = proj.district.toLowerCase().includes(searchQuery);
        if (!matchesName && !matchesRegion && !matchesDistrict) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      projectGrid.innerHTML = `
        <div class="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h3>无匹配楼盘</h3>
          <p>请尝试其他搜索词或切换区域分类</p>
        </div>
      `;
      return;
    }

    // 动态生成项目卡片
    filtered.forEach(proj => {
      const card = document.createElement('article');
      card.className = 'project-card';
      
      const stats = proj.stats || { total: 0, sold: 0, sale: 0, priced: 0, stopped: 0, pending: 0, sold_rate: 0 };
      
      card.innerHTML = `
        <div class="card-header">
          <div class="card-meta">
            <span class="badge badge-region">${proj.region}</span>
            <span class="badge badge-district">${proj.district}</span>
          </div>
          <h3 class="project-title">${proj.name}</h3>
        </div>
        
        <div class="card-body">
          <!-- 去化率进度条 -->
          <div class="sold-progress-area">
            <div class="progress-info">
              <span class="progress-label">去化进度</span>
              <span class="progress-val">${stats.sold_rate}%</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${stats.sold_rate}%"></div>
            </div>
          </div>
          
          <!-- 详细套数统计 -->
          <div class="card-stats">
            <div class="stat-item sold-count">
              <span class="lbl">已售单位</span>
              <span class="val">${stats.sold}套</span>
            </div>
            <div class="stat-item sale-count">
              <span class="lbl">在售 (Sale)</span>
              <span class="val">${stats.sale}套</span>
            </div>
            <div class="stat-item">
              <span class="lbl">已定价未售</span>
              <span class="val">${stats.priced}套</span>
            </div>
            <div class="stat-item">
              <span class="lbl">总规划套数</span>
              <span class="val">${stats.total}套</span>
            </div>
          </div>
        </div>
        
        <div class="card-footer">
          <button class="btn btn-primary btn-preview" data-filename="${proj.filename}" data-name="${proj.name}" data-region="${proj.region}" data-district="${proj.district}">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            在线预览
          </button>
          
          <a class="btn btn-secondary" href="files/${proj.filename}" download="${proj.filename}">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            下载 Excel
          </a>
        </div>
      `;
      
      projectGrid.appendChild(card);
    });

    // 绑定在线预览按钮事件
    const previewButtons = projectGrid.querySelectorAll('.btn-preview');
    previewButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const dataset = btn.dataset;
        openPreviewModal(dataset.filename, dataset.name, dataset.region, dataset.district);
      });
    });
  }

  // 6. 打开在线预览 Modal 弹窗
  function openPreviewModal(filename, projectName, region, district) {
    modalProjectTitle.textContent = projectName;
    modalProjectSubtitle.textContent = `${region} • ${district} • 销控数据预览`;
    
    // 清空旧数据，展示 Loading Spinner
    buildingTabs.innerHTML = '';
    gridRenderArea.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>正在解析 Excel 楼栋数据，请稍候...</p>
      </div>
    `;
    resetBuildingStatsPanel();

    previewModal.classList.add('open');
    document.body.style.overflow = 'hidden'; // 阻止背景滚动

    // 异步下载并解析 Excel 文件
    fetchExcelAndRender(`files/${filename}`);
  }

  // 7. 关闭模态弹窗
  function closePreviewModal() {
    previewModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // 重置楼栋统计仪表板
  function resetBuildingStatsPanel() {
    bStatTotal.textContent = '-';
    bStatSale.textContent = '-';
    bStatPriced.textContent = '-';
    bStatSold.textContent = '-';
    bStatStopped.textContent = '-';
  }

  // 8. Fetch Excel 文件并使用 SheetJS 解析
  async function fetchExcelAndRender(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('下载 Excel 文件失败，该文件可能不存在于服务器上。');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      // 使用 SheetJS 解析 Excel
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // 过滤出除了"销控汇总明细"以外的所有 Tab 页（代表各楼栋）
      const sheetNames = workbook.SheetNames.filter(name => name !== "销控汇总明细");
      
      if (sheetNames.length === 0) {
        // 如果没有其他表，则 fallback 使用第一张表
        sheetNames.push(workbook.SheetNames[0]);
      }
      
      // 动态生成楼栋 Tab 按钮
      sheetNames.forEach((sheetName, index) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
        // 去除名字末尾可能包含的“销控表”字样以精简显示
        btn.textContent = sheetName.replace(' 销控表', '');
        btn.dataset.sheet = sheetName;
        
        btn.addEventListener('click', () => {
          buildingTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderSheetGrid(workbook.Sheets[sheetName]);
        });
        
        buildingTabs.appendChild(btn);
      });
      
      // 默认渲染第一个楼栋网格
      renderSheetGrid(workbook.Sheets[sheetNames[0]]);
      
    } catch (error) {
      console.error(error);
      gridRenderArea.innerHTML = `
        <div class="no-results" style="border: none; padding: 2rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:3rem; height:3rem;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3>解析 Excel 失败</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  // 9. 渲染具体的楼栋网格图 HTML 结构
  function renderSheetGrid(sheet) {
    gridRenderArea.innerHTML = '';
    
    // 转换为 2D 数组（保留空值以便定位格子）
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (rows.length === 0) {
      gridRenderArea.innerHTML = '<p style="color:var(--text-secondary); text-align:center; width:100%;">本工作表无数据</p>';
      return;
    }

    // 楼栋销控网格解析与重构：
    // 行索引定位：
    // 1. 寻找表头行，通常在第 5 行 (index 4)，其第一个单元格是“楼层\房号”或类似的文字。
    let headerRowIndex = 4; // 默认第 5 行为表头
    for (let r = 0; r < rows.length; r++) {
      if (rows[r] && rows[r][0] && (String(rows[r][0]).includes('楼层') || String(rows[r][0]).includes('/') || String(rows[r][0]).includes('F'))) {
        headerRowIndex = r;
        break;
      }
    }

    // 2. 统计当前楼栋各状态套数 (通过扫描 headerRowIndex 以下的数据区)
    let bTotal = 0;
    let bSold = 0;
    let bSale = 0;
    let bPriced = 0;
    let bStopped = 0;

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row[0] === "" || row[0] === undefined) continue; // 空行跳过
      
      for (let c = 1; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (!val) continue; // 空白单元格（如电梯/走道）
        
        bTotal++;
        if (val.includes('(在售)')) {
          bSale++;
        } else if (val.includes('(已定价未售)')) {
          bPriced++;
        } else if (val.includes('(暂停销售)')) {
          bStopped++;
        } else if (val.includes('(待售)')) {
          // 待售不算入这几个高亮面板，也可以并入 default
        } else {
          // 已售的特点是第四行是成交日期如 (26年-06月)
          // 只要存在内容，且不是以上几种情况，就属于已售
          bSold++;
        }
      }
    }

    // 更新楼栋去化面板值
    bStatTotal.textContent = `${bTotal} 套`;
    bStatSale.textContent = `${bSale} 套`;
    bStatPriced.textContent = `${bPriced} 套`;
    bStatSold.textContent = `${bSold} 套`;
    bStatStopped.textContent = `${bStopped} 套`;

    // 3. 构建 HTML Table
    const table = document.createElement('table');
    table.className = 'excel-grid-table';
    
    // 渲染表头 (Columns Header)
    const thead = document.createElement('thead');
    const headerRow = rows[headerRowIndex] || [];
    const trHead = document.createElement('tr');
    
    headerRow.forEach((cellVal, cIndex) => {
      // 最后一列或中间某些列如果全是空白，可能多余，这里保留全部原始定义宽度
      const th = document.createElement('th');
      th.textContent = cellVal !== undefined ? String(cellVal).trim() : '';
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);
    
    // 渲染数据行 (Body Rows)
    const tbody = document.createElement('tbody');
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row[0] === "" || row[0] === undefined) continue; // 忽略后方多余的空行
      
      const tr = document.createElement('tr');
      
      // 第一列是楼层列
      const tdFloor = document.createElement('td');
      tdFloor.className = 'grid-header-cell';
      tdFloor.textContent = String(row[0] || '').trim();
      tr.appendChild(tdFloor);
      
      // 后续列为房号单元格
      for (let c = 1; c < headerRow.length; c++) {
        const td = document.createElement('td');
        const cellVal = String(row[c] || '').trim();
        
        if (!cellVal) {
          // 没有房号，代表电梯、走道或空洞，设置置灰类名
          td.className = 'grid-empty-cell';
          td.innerHTML = '';
        } else {
          // 解析内容填充
          td.innerHTML = cellVal; // 保留换行（CSS中使用了 white-space: pre-line）
          
          // 判断销售状态分配样式类名
          if (cellVal.includes('(在售)')) {
            td.className = 'status-sale-cell';
          } else if (cellVal.includes('(已定价未售)')) {
            td.className = 'status-priced-cell';
          } else if (cellVal.includes('(暂停销售)')) {
            td.className = 'status-stopped-cell';
          } else if (cellVal.includes('(待售)')) {
            td.className = 'status-pending-cell';
          } else {
            // 已售状态 (XX年-XX月)
            td.className = 'status-sold-cell';
          }
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    gridRenderArea.appendChild(table);

    // 每次渲染新楼栋时，均初始化缩放比例为 100%
    applyZoom(1.0);
  }

  // 10. 应用缩放值并处理浏览器兼容性
  function applyZoom(scale) {
    // 限制缩放区间在 40% - 200% 之间
    currentZoom = Math.min(Math.max(scale, 0.4), 2.0);
    
    if (zoomLevelLabel) {
      zoomLevelLabel.textContent = `${Math.round(currentZoom * 100)}%`;
    }
    
    const table = gridRenderArea.querySelector('.excel-grid-table');
    if (table) {
      if ('zoom' in table.style) {
        // 主流移动端浏览器 (Safari, Chrome, 微信等) 均原生支持高能效的 zoom 属性
        table.style.zoom = currentZoom;
        table.style.transform = '';
        table.style.transformOrigin = '';
        table.style.marginRight = '';
        table.style.marginBottom = '';
      } else {
        // 对不支持 zoom 的浏览器 (如 Firefox) 采用 transform: scale 缩放，并用 margin 抵消布局空白
        table.style.transform = `scale(${currentZoom})`;
        table.style.transformOrigin = 'top left';
        
        table.style.marginRight = '';
        table.style.marginBottom = '';
        
        if (currentZoom < 1.0) {
          const widthDiff = table.offsetWidth * (1 - currentZoom);
          const heightDiff = table.offsetHeight * (1 - currentZoom);
          table.style.marginRight = `-${widthDiff}px`;
          table.style.marginBottom = `-${heightDiff}px`;
        } else if (currentZoom > 1.0) {
          const widthDiff = table.offsetWidth * (currentZoom - 1);
          const heightDiff = table.offsetHeight * (currentZoom - 1);
          table.style.marginRight = `${widthDiff}px`;
          table.style.marginBottom = `${heightDiff}px`;
        }
      }
    }
  }

  // 11. 双指捏合手势缩放核心算法
  function setupTouchZoom(element) {
    let initialDistance = 0;
    let initialZoom = 1.0;
    
    element.addEventListener('touchstart', (e) => {
      // 仅在双指触碰时启动缩放逻辑
      if (e.touches.length === 2) {
        e.preventDefault(); // 阻止浏览器缩放全屏
        initialDistance = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        initialZoom = currentZoom;
      }
    }, { passive: false });
    
    element.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        e.preventDefault(); // 阻止原生手势引起的冲突
        const currentDistance = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        const factor = currentDistance / initialDistance;
        applyZoom(initialZoom * factor);
      }
    }, { passive: false });
    
    element.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        initialDistance = 0;
      }
    });
  }

  // ==========================================================================
  // 12. 访问控制与安全校验模块 (Login & Access Control)
  // ==========================================================================

  // 安全的 SHA-256 密码哈希值（当前硬编码对应密码: "8888"）
  // 如果需要修改密码为其他值，请通过 sha256("新密码") 计算出哈希替换此处。
  const CORRECT_HASH = '19290a6e03399cf70a92d19f56360c7b6d13264ec4008269ec264ecdf6cc447a';

  // 原生计算文本的 SHA-256 哈希值 (无需引入外部库)
  async function getSHA256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 校验登录逻辑
  async function handleLogin() {
    const password = passwordInput.value;
    if (!password) {
      showLoginError('请输入密码！');
      return;
    }
    
    try {
      const inputHash = await getSHA256(password);
      if (inputHash === CORRECT_HASH) {
        // 校验通过：本地持久化登录态并平滑淡出登录框
        localStorage.setItem('hk_sales_logged_in', 'true');
        loginOverlay.classList.add('hidden');
        loginErrorMsg.style.display = 'none';
        
        // 验证通过后方可执行数据加载，确保敏感数据请求的安全隔离
        init();
      } else {
        showLoginError('密码错误，请重新输入');
      }
    } catch (e) {
      console.error(e);
      showLoginError('密码验证出现异常，请重试');
    }
  }

  // 显示报错信息并触发登录卡片物理抖动动画
  function showLoginError(msg) {
    loginErrorMsg.textContent = msg;
    loginErrorMsg.style.display = 'block';
    
    // 触发重绘以重启 shake 关键帧动画
    loginCard.classList.remove('shake');
    void loginCard.offsetWidth; 
    loginCard.classList.add('shake');
    
    // 聚焦并自动选中框中文字
    passwordInput.focus();
    passwordInput.select();
  }

  // 初始化引导控制 (登录态拦截)
  function checkLoginStatus() {
    if (localStorage.getItem('hk_sales_logged_in') === 'true') {
      // 已登录状态：隐藏遮罩并加载真实数据
      if (loginOverlay) {
        loginOverlay.classList.add('hidden');
      }
      init();
    } else {
      // 未登录状态：绑定登录交互事件
      if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
      }
      if (passwordInput) {
        passwordInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            handleLogin();
          }
        });
        passwordInput.focus();
      }
    }
  }

  // 启动应用程序生命周期 (拦截式校验)
  checkLoginStatus();
});
