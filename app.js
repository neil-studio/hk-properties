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
  
  // 模态框页签与卖点面板 DOM
  const modalNavTabs = document.getElementById('modalNavTabs');
  const modalNavButtons = document.querySelectorAll('.modal-nav-btn');
  const modalPanes = document.querySelectorAll('.modal-pane');
  const infoBasic = document.getElementById('infoBasic');
  const infoSelling = document.getElementById('infoSelling');
  const infoMainland = document.getElementById('infoMainland');
  
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
  let activeGrade = 'all'; // 新增评级快捷过滤状态
  let activePriceRange = 'all'; // 新增精选价位段过滤状态
  let currentPreviewProject = ''; // 新增：全局缓存当前查看的项目名以用于匹配户型图
  let activePinnedRoom = ''; // 新增：全局缓存当前点击锁定的房间号
  let activePinnedUnitKey = null; // 新增：全局缓存当前点击锁定的单元Key
  let featuredByPriceData = {}; // 缓存各价位段精选项目
  let currentZoom = 1.0;

  // 1. 初始化，获取数据索引
  async function init() {
    try {
      const response = await fetch('data.json?v=' + Date.now());
      if (!response.ok) {
        throw new Error('未找到元数据文件 data.json，请先运行 build_web.py 脚本生成数据库。');
      }
      const data = await response.json();
      allProjects = data.projects || [];
      globalStats = data.global_stats || {};
      
      // 缓存多价位精选数据
      featuredByPriceData = data.featured_by_price || {
        "1000-2000": [],
        "2000-5000": [],
        "5000-10000": [],
        "10000+": []
      };

      // 渲染今日聚焦（3个）与精选推荐大屏区
      renderPromotions(data.focus_projects, featuredByPriceData);
      
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

    // 模态框内部页签 pane 切换
    modalNavButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modalNavButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const targetPaneId = btn.dataset.pane;
        modalPanes.forEach(pane => {
          if (pane.id === targetPaneId) {
            pane.classList.add('active');
          } else {
            pane.classList.remove('active');
          }
        });
      });
    });

    // 新增：评级快捷过滤按钮事件监听
    const gradeFilterButtons = document.querySelectorAll('#gradeFilter .filter-btn');
    gradeFilterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        gradeFilterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeGrade = btn.dataset.grade;
        renderProjects();
      });
    });

    // 新增：精选价格段 Tab 切换事件监听
    const priceTabButtons = document.querySelectorAll('.price-tab-btn');
    priceTabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        priceTabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activePriceRange = btn.dataset.price;
        // 即时重绘右侧精选轮播
        updateFeaturedCarousel();
      });
    });
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
      // 3. 评级筛选
      if (activeGrade !== 'all' && proj.grade !== activeGrade) return false;
      // 4. 搜索框过滤（匹配名称、区域、商圈）
      if (searchQuery) {
        const matchesName = proj.name.toLowerCase().includes(searchQuery);
        const matchesRegion = proj.region.toLowerCase().includes(searchQuery);
        const matchesDistrict = proj.district.toLowerCase().includes(searchQuery);
        if (!matchesName && !matchesRegion && !matchesDistrict) return false;
      }
      return true;
    });

    // 按照 聚焦盘 > 精选盘 > 其他盘 排序
    filtered.sort((a, b) => {
      const getPriority = (p) => {
        if (p.is_focus) return 1;
        if (p.is_featured) return 2;
        return 3;
      };
      return getPriority(a) - getPriority(b);
    });

    if (filtered.length === 0) {
      projectGrid.innerHTML = `
        <div class="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h3>无匹配楼盘</h3>
          <p>请尝试其他搜索词或切换区域分类与评级</p>
        </div>
      `;
      return;
    }

    // 动态生成项目卡片
    filtered.forEach(proj => {
      const card = document.createElement('article');
      card.className = 'project-card';
      
      const stats = proj.stats || { total: 0, sold: 0, sale: 0, priced: 0, stopped: 0, pending: 0, sold_rate: 0 };
      
      // 确定徽章等级样式类
      let gradeClass = 'grade-c';
      if (proj.grade === 'A+') gradeClass = 'grade-aplus';
      else if (proj.grade === 'A') gradeClass = 'grade-a';
      else if (proj.grade === 'B') gradeClass = 'grade-b';

      card.innerHTML = `
        <div class="grade-badge ${gradeClass}">${proj.grade || 'C'}</div>
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
    // 缓存当前预览的项目名
    currentPreviewProject = projectName;
    activePinnedRoom = ''; // 重置锁定房间
    
    // 重置户型图画板状态
    const floorplanTargetLabel = document.getElementById('floorplanTargetLabel');
    const floorplanPlaceholder = document.getElementById('floorplanPlaceholder');
    const floorplanImg = document.getElementById('floorplanImg');
    if (floorplanTargetLabel) floorplanTargetLabel.textContent = '请悬停或点击单元格';
    if (floorplanPlaceholder) floorplanPlaceholder.style.display = 'flex';
    if (floorplanImg) {
      floorplanImg.style.display = 'none';
      floorplanImg.src = '';
    }

    // 1. 判断是否有评级并展示评级徽章
    const proj = allProjects.find(p => p.name === projectName);
    const grade = (proj && proj.grade) || 'C';
    let modalGradeClass = 'modal-grade-c';
    if (grade === 'A+') modalGradeClass = 'modal-grade-aplus';
    else if (grade === 'A') modalGradeClass = 'modal-grade-a';
    else if (grade === 'B') modalGradeClass = 'modal-grade-b';

    modalProjectTitle.innerHTML = `${projectName} <span class="modal-grade-badge ${modalGradeClass}">${grade}</span>`;
    modalProjectSubtitle.textContent = `${region} • ${district} • 销控数据预览`;
    
    // 2. 检查项目是否有录入任何介绍或卖点说明
    const hasInfo = proj && (proj.basic_info || proj.selling_points || proj.mainland_selling_points);
    
    if (hasInfo) {
      // 填充卖点卡片内容
      infoBasic.textContent = proj.basic_info || '暂无基础资料介绍';
      infoSelling.textContent = proj.selling_points || '暂无核心卖点介绍';
      infoMainland.textContent = proj.mainland_selling_points || '暂无内地客群卖点介绍';
      
      // 显示大 Tab 导航栏，并默认激活第一个（网格图）
      modalNavTabs.style.display = 'flex';
      modalNavButtons.forEach(b => {
        if (b.dataset.pane === 'paneGrid') b.classList.add('active');
        else b.classList.remove('active');
      });
      modalPanes.forEach(p => {
        if (p.id === 'paneGrid') p.classList.add('active');
        else p.classList.remove('active');
      });
    } else {
      // 没有卖点说明，隐藏大 Tab 导航栏，并直接展示网格图
      modalNavTabs.style.display = 'none';
      modalPanes.forEach(p => {
        if (p.id === 'paneGrid') p.classList.add('active');
        else p.classList.remove('active');
      });
    }
    
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

  // 6.5 渲染今日聚焦（3个）与精选楼盘专区
  function renderPromotions(focusProjectNames, featuredByPrice) {
    const promotionArea = document.getElementById('promotionArea');
    const featuredCarousel = document.getElementById('featuredCarousel');

    const focusList = focusProjectNames || [];
    const hasFocus = focusList.filter(v => v).length > 0;
    
    // 计算精选总数
    let totalFeatured = 0;
    Object.values(featuredByPrice || {}).forEach(list => totalFeatured += list.length);
    const hasFeatured = totalFeatured > 0;

    // 若均无推荐项目，则彻底隐藏推荐专区
    if (!hasFocus && !hasFeatured) {
      promotionArea.style.display = 'none';
      return;
    }

    promotionArea.style.display = 'grid';

    // 1. 依次渲染左侧的 3 张今日聚焦卡片
    for (let i = 1; i <= 3; i++) {
      const cardEl = document.getElementById(`promoFocusCard${i}`);
      const name = focusList[i - 1];

      if (name) {
        const focusProj = allProjects.find(p => p.name === name);
        if (focusProj) {
          cardEl.style.display = 'flex';
          
          cardEl.querySelector('.promo-focus-title').textContent = focusProj.name;
          cardEl.querySelector('.promo-region').textContent = focusProj.region;
          cardEl.querySelector('.promo-district').textContent = focusProj.district;
          
          const descText = focusProj.selling_points || focusProj.mainland_selling_points || focusProj.basic_info || '主推今日聚焦盘，位置极其优越，点击下方按钮查看可视化销控网格图。';
          cardEl.querySelector('.promo-focus-desc').textContent = descText;
          
          const stats = focusProj.stats || { total: 0, sold: 0, sale: 0, priced: 0, stopped: 0, pending: 0, sold_rate: 0 };
          cardEl.querySelector('.promo-rate').textContent = `${stats.sold_rate}%`;
          cardEl.querySelector('.promo-units').textContent = stats.total.toLocaleString();

          // 重新绑定按钮事件
          const btn = cardEl.querySelector('.promo-btn');
          const newBtn = btn.cloneNode(true);
          btn.parentNode.replaceChild(newBtn, btn);
          
          newBtn.addEventListener('click', () => {
            openPreviewModal(focusProj.filename, focusProj.name, focusProj.region, focusProj.district);
          });
        } else {
          cardEl.style.display = 'none';
        }
      } else {
        cardEl.style.display = 'none';
      }
    }

    // 2. 渲染右侧精选价格段选项卡
    updateFeaturedCarousel();
  }

  // 6.6 渲染精选推荐价格切换轮播
  function updateFeaturedCarousel() {
    const featuredCarousel = document.getElementById('featuredCarousel');
    featuredCarousel.innerHTML = '';

    // 1. 根据当前 activePriceRange 筛选出要展示的楼盘名字列表
    let targets = [];
    if (activePriceRange === 'all') {
      // 合并四个区间
      const set = new Set();
      Object.values(featuredByPriceData).forEach(list => {
        list.forEach(name => set.add(name));
      });
      targets = Array.from(set);
    } else {
      targets = featuredByPriceData[activePriceRange] || [];
    }

    if (targets.length === 0) {
      featuredCarousel.innerHTML = '<div style="color:var(--text-secondary); font-size:0.8rem; padding: 2rem; width:100%; text-align:center;">该价格区间暂无精选盘</div>';
      return;
    }

    // 2. 依次渲染精选盘
    targets.forEach(name => {
      const featProj = allProjects.find(p => p.name === name);
      if (featProj) {
        const card = document.createElement('div');
        card.className = 'featured-card';
        
        const stats = featProj.stats || { total: 0, sold: 0, sale: 0, priced: 0, stopped: 0, pending: 0, sold_rate: 0 };
        
        card.innerHTML = `
          <div class="feat-card-header">
            <span class="feat-badge">精选推荐</span>
            <h4 class="feat-card-title">${featProj.name}</h4>
          </div>
          <div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.3rem;">
              整体去化率：<strong>${stats.sold_rate}%</strong>
            </div>
            <div class="feat-card-meta">
              <span>${featProj.region} • ${featProj.district}</span>
              <span>规划${stats.total}套</span>
            </div>
          </div>
        `;
        
        // 绑定点击事件
        card.addEventListener('click', () => {
          openPreviewModal(featProj.filename, featProj.name, featProj.region, featProj.district);
        });
        
        featuredCarousel.appendChild(card);
      }
    });
  }

  // 7. 关闭模态弹窗
  function closePreviewModal() {
    previewModal.classList.remove('open');
    document.body.style.overflow = '';
    
    // 关闭时重置悬浮折扣面板
    activePinnedUnitKey = null;
    const card = document.getElementById('selectedUnitCard');
    if (card) {
      card.classList.remove('active');
    }
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
      const response = await fetch(url + '?v=' + Date.now());
      if (!response.ok) {
        throw new Error('下载 Excel 文件失败，该文件可能不存在于服务器上。');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      // 使用 SheetJS 解析 Excel
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // 1. 解析“销控汇总明细”表并建立单位详情全局字典
      const detailSheet = workbook.Sheets["销控汇总明细"];
      window.projectUnitsDetail = {};
      activePinnedUnitKey = null; // 重置锁定状态
      if (detailSheet) {
        const detailRows = XLSX.utils.sheet_to_json(detailSheet, { range: 1, defval: "" });
        detailRows.forEach(row => {
          const bname = String(row["楼栋"] || '').trim();
          const floor = String(row["楼层"] || '').trim();
          const flat = String(row["房号"] || '').trim();
          if (bname && floor && flat) {
            const key = `${bname.replace(/\s+/g, '')}_${floor}_${flat}`;
            window.projectUnitsDetail[key] = {
              origPrice: row["总价 (港币)"],
              origFtPrice: row["实用呎价 (港币/呎)"],
              discount: row["最高折扣"],
              discPrice: row["折实总价 (港币)"],
              discFtPrice: row["折实呎价 (港币/呎)"],
              payment: row["付款办法"],
              extraRebate: row["额外回赠/补贴"],
              isTender: row["是否招标"] === '是',
              status: row["销控状态"]
            };
          }
        });
      }

      // 重置卡片展示
      const card = document.getElementById('selectedUnitCard');
      if (card) {
        card.classList.remove('active');
        const placeholder = card.querySelector('.selected-unit-placeholder');
        const detail = card.querySelector('.selected-unit-detail');
        if (placeholder && detail) {
          placeholder.style.display = '';
          detail.style.display = 'none';
        }
      }
      
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
          renderSheetGrid(workbook.Sheets[sheetName], sheetName);
        });
        
        buildingTabs.appendChild(btn);
      });
      
      // 默认渲染第一个楼栋网格
      renderSheetGrid(workbook.Sheets[sheetNames[0]], sheetNames[0]);
      
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
  function renderSheetGrid(sheet, buildingName) {
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

          // 提取房号信息，供联动渲染平面图 (解析第一行 "A | 343呎" 或 "B (开放式)")
          const lines = cellVal.split('\n');
          let roomName = "";
          if (lines.length > 0) {
            const firstLine = lines[0];
            if (firstLine.includes('|')) {
              roomName = firstLine.split('|')[0].trim();
            } else {
              const m = firstLine.match(/([A-Z0-9\-]+)/);
              if (m) roomName = m[1];
            }
          }

          // 联动交互绑定
          if (roomName) {
            td.addEventListener('mouseenter', () => {
              updateFloorplanPanel(roomName, buildingName, false);
              updateSelectedUnitCard(roomName, tdFloor.textContent.trim(), buildingName, false);
            });
            td.addEventListener('click', () => {
              updateFloorplanPanel(roomName, buildingName, true);
              updateSelectedUnitCard(roomName, tdFloor.textContent.trim(), buildingName, true);
            });
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

  // 9.5 联动大画板渲染户型图
  function updateFloorplanPanel(roomName, buildingName, isClick = false) {
    if (!roomName || !currentPreviewProject) return;

    const floorplanTargetLabel = document.getElementById('floorplanTargetLabel');
    const floorplanPlaceholder = document.getElementById('floorplanPlaceholder');
    const floorplanImg = document.getElementById('floorplanImg');

    if (!floorplanTargetLabel || !floorplanPlaceholder || !floorplanImg) return;

    if (isClick) {
      activePinnedRoom = `${buildingName}_${roomName}`;
    } else {
      // 如果已点击锁定，并且悬停的不是锁定的房号，则不予覆盖
      if (activePinnedRoom && activePinnedRoom !== `${buildingName}_${roomName}`) {
        return;
      }
    }

    const cleanBuilding = buildingName ? buildingName.replace(' 销控表', '').replace(' 销控网格', '').trim() : '';
    floorplanTargetLabel.textContent = `${cleanBuilding} • ${roomName}单位 ${isClick ? '📌' : ''}`;

    // 拼装本地图片相对路径
    // 优先：images/floorplans/{项目名}/{楼栋}_{房号}.jpg
    const pathWithBuilding = `images/floorplans/${currentPreviewProject}/${cleanBuilding}_${roomName}.jpg`;
    // 兜底：images/floorplans/{项目名}/{房号}.jpg
    const pathRoomOnly = `images/floorplans/${currentPreviewProject}/${roomName}.jpg`;

    // 异步虚拟图片预加载检测，防止发生裂图
    const tempImg = new Image();
    tempImg.src = pathWithBuilding;
    
    tempImg.onload = () => {
      floorplanPlaceholder.style.display = 'none';
      floorplanImg.style.display = 'block';
      floorplanImg.src = pathWithBuilding;
    };
    
    tempImg.onerror = () => {
      const tempImg2 = new Image();
      tempImg2.src = pathRoomOnly;
      
      tempImg2.onload = () => {
        floorplanPlaceholder.style.display = 'none';
        floorplanImg.style.display = 'block';
        floorplanImg.src = pathRoomOnly;
      };
      
      tempImg2.onerror = () => {
        floorplanImg.style.display = 'none';
        floorplanPlaceholder.style.display = 'flex';
        const pTag = floorplanPlaceholder.querySelector('p');
        if (pTag) {
          pTag.textContent = `该单位 (${cleanBuilding} ${roomName}室) 暂未上线平面户型图`;
        }
      };
    };
  }

  // 9.55 联动数据详情大画板，实时计算最惠折扣与折实价
  function updateSelectedUnitCard(flat, floor, buildingName, isClick = false) {
    const cleanBname = buildingName.replace(' 销控表', '').replace(' 销控网格', '').trim();
    const key = `${cleanBname.replace(/\s+/g, '')}_${String(floor).trim()}_${String(flat).trim()}`;
    const card = document.getElementById('selectedUnitCard');
    if (!card) return;
    
    const placeholder = card.querySelector('.selected-unit-placeholder');
    const detail = card.querySelector('.selected-unit-detail');
    if (!placeholder || !detail) return;
    

    if (isClick) {
      activePinnedUnitKey = key;
    } else {
      if (activePinnedUnitKey && activePinnedUnitKey !== key) {
        return;
      }
    }
    
    const u = window.projectUnitsDetail ? window.projectUnitsDetail[key] : null;
    
    if (!u) {
      placeholder.style.display = '';
      detail.style.display = 'none';
      card.classList.remove('active');
      return;
    }
    
    placeholder.style.display = '';
    detail.style.display = 'flex';
    card.classList.add('active');
    
    document.getElementById('selectedUnitName').textContent = `${cleanBname} • ${floor}楼 ${flat}室 ${isClick ? '📌' : ''}`;
    
    const statusBadge = document.getElementById('selectedUnitStatus');
    statusBadge.textContent = u.status || '待售';
    statusBadge.className = 'unit-status-badge'; 
    
    let statusClass = 'status-pending';
    if (u.status === '在售') statusClass = 'status-sale';
    else if (u.status === '已定价未售') statusClass = 'status-priced';
    else if (u.status === '已售') statusClass = 'status-sold';
    else if (u.status === '暂停销售') statusClass = 'status-stopped';
    statusBadge.classList.add(statusClass);
    
    const origPriceCont = document.getElementById('selectedUnitOrigPriceContainer');
    const discPriceCont = document.getElementById('selectedUnitDiscPriceContainer');
    const discountBadge = document.getElementById('selectedUnitDiscountBadge');
    const origFtPriceCont = document.getElementById('selectedUnitOrigFtPriceContainer');
    const discFtPriceCont = document.getElementById('selectedUnitDiscFtPriceContainer');
    const paymentCont = document.getElementById('selectedUnitPaymentContainer');
    
    const formatMoney = (val) => {
      if (!val || isNaN(val)) return val;
      return '$' + Number(val).toLocaleString('zh-HK');
    };
    
    if (u.status === '已售') {
      origPriceCont.style.display = 'none';
      discPriceCont.style.display = 'flex';
      discPriceCont.querySelector('.price-label').textContent = '成交:';
      document.getElementById('selectedUnitDiscPrice').textContent = formatMoney(u.discPrice);
      
      discountBadge.style.display = 'none';
      
      origFtPriceCont.style.display = 'none';
      discFtPriceCont.style.display = 'flex';
      discFtPriceCont.querySelector('.price-label').textContent = '成交呎:';
      document.getElementById('selectedUnitDiscFtPrice').textContent = formatMoney(u.discFtPrice) + '/呎';
      
      paymentCont.style.display = 'none';
    } 
    else if (u.isTender && u.status !== '已售') {
      origPriceCont.style.display = 'none';
      discPriceCont.style.display = 'flex';
      discPriceCont.querySelector('.price-label').textContent = '发售:';
      document.getElementById('selectedUnitDiscPrice').textContent = '招标发售';
      
      discountBadge.style.display = 'none';
      origFtPriceCont.style.display = 'none';
      discFtPriceCont.style.display = 'none';
      
      paymentCont.style.display = 'flex';
      document.getElementById('selectedUnitPayment').textContent = '详见发售招标文件';
    } 
    else if (u.status === '在售' || u.status === '已定价未售') {
      origPriceCont.style.display = 'flex';
      document.getElementById('selectedUnitOrigPrice').textContent = formatMoney(u.origPrice);
      
      discPriceCont.style.display = 'flex';
      discPriceCont.querySelector('.price-label').textContent = '折实:';
      document.getElementById('selectedUnitDiscPrice').textContent = formatMoney(u.discPrice);
      
      if (u.discount && u.discount !== '-') {
        discountBadge.style.display = 'block';
        discountBadge.textContent = `-${u.discount}`; /* 折扣前缀 - 即可，省略“最高折扣:”汉字更清爽 */
      } else {
        discountBadge.style.display = 'none';
      }
      
      origFtPriceCont.style.display = 'none'; // 在售定价单位直接隐藏原呎价，节省空间
      
      discFtPriceCont.style.display = 'flex';
      discFtPriceCont.querySelector('.price-label').textContent = '折实呎:';
      document.getElementById('selectedUnitDiscFtPrice').textContent = formatMoney(u.discFtPrice) + '/呎';
      
      if (u.payment && u.payment !== '-') {
        paymentCont.style.display = 'flex';
        document.getElementById('selectedUnitPayment').textContent = u.payment;
      } else {
        paymentCont.style.display = 'none';
      }
      
      const rebateCont = document.getElementById('selectedUnitRebateContainer');
      if (rebateCont) {
        if (u.extraRebate && u.extraRebate !== '-') {
          rebateCont.style.display = 'flex';
          document.getElementById('selectedUnitRebate').textContent = u.extraRebate;
        } else {
          rebateCont.style.display = 'none';
        }
      }
    } 
    else {
      origPriceCont.style.display = 'none';
      discPriceCont.style.display = 'flex';
      discPriceCont.querySelector('.price-label').textContent = '发售:';
      document.getElementById('selectedUnitDiscPrice').textContent = '暂未定价';
      
      discountBadge.style.display = 'none';
      origFtPriceCont.style.display = 'none';
      discFtPriceCont.style.display = 'none';
      paymentCont.style.display = 'none';
      const rebateCont = document.getElementById('selectedUnitRebateContainer');
      if (rebateCont) rebateCont.style.display = 'none';
    }

    // 控制第二行的整体显示与隐藏以及各分割线的自适应显隐
    const bottomRow = document.getElementById('selectedUnitRowBottom');
    const div1 = document.getElementById('divider1');
    const divBottom = document.getElementById('dividerBottom');

    if (u.status === '待售' || (u.status === '暂停销售' && !u.origPrice)) {
      if (bottomRow) bottomRow.style.display = 'none';
      if (div1) div1.style.display = 'none';
    } else {
      if (bottomRow) bottomRow.style.display = 'flex';
      if (div1) div1.style.display = '';
      if (divBottom) {
        // 如果是已售（无付款）、招标（无折实呎价）或普通在售没有最惠付款时，隐藏第二行的竖向分割线
        if (u.status === '已售' || (u.isTender && u.status !== '已售') || !u.payment || u.payment === '-') {
          divBottom.style.display = 'none';
        } else {
          divBottom.style.display = '';
        }
      }
    }
  }

  // 9.6 户型图大图全屏缩放放大
  const floorplanImgElement = document.getElementById('floorplanImg');
  if (floorplanImgElement) {
    floorplanImgElement.addEventListener('click', () => {
      if (!floorplanImgElement.src || floorplanImgElement.style.display === 'none') return;
      
      const zoomOverlay = document.createElement('div');
      zoomOverlay.className = 'floorplan-zoom-overlay';
      
      const zoomImg = document.createElement('img');
      zoomImg.className = 'floorplan-zoom-img';
      zoomImg.src = floorplanImgElement.src;
      
      zoomOverlay.appendChild(zoomImg);
      document.body.appendChild(zoomOverlay);
      
      zoomOverlay.addEventListener('click', () => {
        zoomOverlay.remove();
      });
    });
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

  // 安全的 SHA-256 密码哈希值（当前硬编码对应密码: "lm8888"）
  // 如果需要修改密码为其他值，请通过 sha256("新密码") 计算出哈希替换此处。
  const CORRECT_HASH = 'e8ff64cbb018fe63ecd57e93471ad11ce81e510965b63e258f5539134cf27875';

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

  // 绑定悬浮卡片的 Close 按钮交互
  const closeCardBtn = document.getElementById('closeCardBtn');
  if (closeCardBtn) {
    closeCardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      activePinnedUnitKey = null;
      const card = document.getElementById('selectedUnitCard');
      if (card) {
        card.classList.remove('active');
      }
    });
  }

  // 启动应用程序生命周期 (拦截式校验)
  checkLoginStatus();
});
