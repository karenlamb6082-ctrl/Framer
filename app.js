/**
 * Framer V5 - 高级照片边框编辑器
 * 功能：多图管理、高级边框预设、质感特效、撤销/重做、导出格式选择
 */

// ================================
// 状态树
// ================================
const state = {
  items: [],
  activeIndex: -1,
  isDragging: false,
  drag: { x: 0, y: 0, ox: 0, oy: 0 },
  history: [],
  redoStack: [],
  exportFormat: 'png',
  exportQuality: 0.92,
};

const MAX_HISTORY = 40;



// 8种高质感边框预设及其默认配色
const BORDER_DEFAULTS = {
  'gallery-black':     '#0a0a0a',
  'museum-white':      '#faf8f5',
  'editorial':         '#ffffff',
  'floating':          '#131313',
  'soft-ivory':        '#f5f0e6',
  'darkroom':          '#1a1a1a',
  'thin-archive':      '#ffffff',
  'shadow-mat':        '#fafafa',
};

// 每种预设的独立默认参数
const PRESET_DEFAULTS = {
  'gallery-black':   { frameWidth: 14, shadowOn: false, photoStrokeOn: false, grainOn: false },
  'museum-white':    { frameWidth: 12, shadowOn: false, photoStrokeOn: false, grainOn: false },
  'editorial':       { frameWidth: 4,  shadowOn: false, photoStrokeOn: false, grainOn: false },
  'floating':        { frameWidth: 10, shadowOn: false, photoStrokeOn: false, grainOn: false },
  'soft-ivory':      { frameWidth: 10, shadowOn: false, photoStrokeOn: false, grainOn: false },
  'darkroom':        { frameWidth: 12, shadowOn: false, photoStrokeOn: false, grainOn: false },
  'thin-archive':    { frameWidth: 3,  shadowOn: false, photoStrokeOn: false, grainOn: false },
  'shadow-mat':      { frameWidth: 14, shadowOn: false, photoStrokeOn: false, grainOn: false },
};

// 默认配置生成器
const createDefaultConfig = (frame = 'gallery-black') => {
  const pd = PRESET_DEFAULTS[frame] || PRESET_DEFAULTS['gallery-black'];
  return {
    frameType:    frame,
    frameWidth:   pd.frameWidth,
    frameColor:   BORDER_DEFAULTS[frame] || '#ffffff',
    gradientOn:   false,
    gradientColor2: '#f5f0e8',
    aspectRatio:  'original',
    cornerRadius: 0,
    photoScale:   1.0,
    photoOffsetX: 0,
    photoOffsetY: 0,
    shadowOn:     pd.shadowOn,
    shadowIntensity: 6,
    photoStrokeOn: pd.photoStrokeOn,
    photoStrokeWidth: 8,
    photoStrokeColor: 'rgba(0,0,0,0.5)',
    grainOn:      pd.grainOn,
    grainIntensity: 5,
  };
};

// ================================
// DOM 引用
// ================================
const els = {
  // 上传区
  uploadZone:   document.getElementById('uploadZone'),
  emptyState:   document.getElementById('emptyState'),
  fileInput:    document.getElementById('fileInput'),
  btnReupload:  document.getElementById('btnReupload'),
  thumbArea:    document.getElementById('thumbArea'),
  // 画布
  canvasWrap:   document.getElementById('canvasWrap'),
  canvas:       document.getElementById('previewCanvas'),
  ctx:          document.getElementById('previewCanvas').getContext('2d'),
  thumbStrip:   document.getElementById('thumbnailStrip'),
  // 操作按钮
  batchActions: document.getElementById('batchActions'),
  btnDownload:  document.getElementById('btnDownload'),
  btnDownloadSingle: document.getElementById('btnDownloadSingle'),
  btnUndo:      document.getElementById('btnUndo'),
  btnRedo:      document.getElementById('btnRedo'),
  btnSyncAll:   document.getElementById('btnSyncAll'),
  btnDownloadAll: document.getElementById('btnDownloadAll'),
  // 控件
  ratioGrid:    document.getElementById('ratioGrid'),
  frameGrid:    document.getElementById('frameGrid'),
  strokeToggle: document.getElementById('strokeToggle'),
  strokeWidth:  document.getElementById('strokeWidth'),
  strokeSliderWrap: document.getElementById('strokeSliderWrap'),
  strokeColorOptions: document.getElementById('strokeColorOptions'),
  frameWidth:   document.getElementById('frameWidth'),
  widthVal:     document.getElementById('widthVal'),
  colorSwatches: document.querySelectorAll('.color-swatch'),
  customColor:  document.getElementById('customColor'),
  corner:       document.getElementById('cornerRadius'),
  cornerVal:    document.getElementById('cornerVal'),
  photoScale:   document.getElementById('photoScale'),
  scaleVal:     document.getElementById('scaleVal'),
  shadowToggle: document.getElementById('shadowToggle'),
  shadowIntensity: document.getElementById('shadowIntensity'),
  shadowWrap:   document.getElementById('shadowSliderWrap'),
  fmtPng:       document.getElementById('fmtPng'),
  fmtJpeg:      document.getElementById('fmtJpeg'),
  jpegQualityRow: document.getElementById('jpegQualityRow'),
  jpegQuality:  document.getElementById('jpegQuality'),
  jpegQualityVal: document.getElementById('jpegQualityVal'),
  gradientToggle: document.getElementById('gradientToggle'),
  gradientColor2Wrap: document.getElementById('gradientColor2Wrap'),
  gradientColor2: document.getElementById('gradientColor2'),
  grainToggle:    document.getElementById('grainToggle'),
  grainIntensity: document.getElementById('grainIntensity'),
  grainSliderWrap: document.getElementById('grainSliderWrap'),
  // 状态栏
  statusText:   document.getElementById('statusText'),
  statusInfo:   document.getElementById('statusInfo'),
  statusPreset: document.getElementById('statusPreset'),
};

// ================================
// RAF 渲染调度
// ================================
let rafId = null;
const scheduleRender = () => {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    render();
    rafId = null;
  });
};

// ================================
// 初始化与事件绑定
// ================================
function init() {
  // 上传交互（空状态 + 侧边栏上传区）
  els.emptyState.onclick = () => els.fileInput.click();
  els.uploadZone.onclick = () => els.fileInput.click();
  els.fileInput.onchange = (e) => handleFiles(e.target.files);

  // 拖拽上传（在中央画布区）
  const canvasArea = document.querySelector('.canvas-area');
  canvasArea.addEventListener('dragover', (e) => { e.preventDefault(); });
  canvasArea.addEventListener('drop', (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  });

  els.btnReupload.onclick = () => els.fileInput.click();

  // 拖动监听 (Canvas)
  els.canvas.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', doDrag);
  window.addEventListener('mouseup', stopDrag);
  
  // 触摸监听（必须 passive:false 才能正确 preventDefault 阻止页面滚动）
  els.canvas.addEventListener('touchstart', (e) => startDrag(e.touches[0]), { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (state.isDragging) { e.preventDefault(); doDrag(e.touches[0]); }
  }, { passive: false });
  window.addEventListener('touchend', stopDrag);

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    // 如果焦点在输入框内，不拦截
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
      e.preventDefault(); redo(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault(); undo(); return;
    }
    if (!state.items.length) return;
    switch(e.key) {
      case 'ArrowLeft':  e.preventDefault(); switchPhoto(-1); break;
      case 'ArrowRight': e.preventDefault(); switchPhoto(1); break;
      case '+': case '=': e.preventDefault(); adjustScale(5); break;
      case '-': case '_': e.preventDefault(); adjustScale(-5); break;
      case 'Delete':     e.preventDefault(); deleteItem(state.activeIndex); break;
    }
  });

  bindControlEvents();
  initPanelSwitching();
}

/**
 * 面板切换逻辑：点击左侧导航项切换显示对应面板
 */
function initPanelSwitching() {
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.panel-content');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetId = item.dataset.panel;
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      panels.forEach(p => p.hidden = (p.id !== targetId));
    });
  });
}

/**
 * 循环绑定控制面板事件
 */
function bindControlEvents() {
  // 比例 — 使用事件委托，确保动态添加的按钮也能响应
  els.ratioGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.ratio-item');
    if (!btn) return;
    updateActiveConfig({ aspectRatio: btn.dataset.ratio, photoOffsetX: 0, photoOffsetY: 0 });
    syncUI(); scheduleRender();
  });

  // 边框类型 — 同样使用事件委托
  els.frameGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.frame-item');
    if (!btn) return;
    const type = btn.dataset.frame;
    const pd = PRESET_DEFAULTS[type] || {};
    updateActiveConfig({
      frameType: type,
      frameColor: BORDER_DEFAULTS[type],
      frameWidth: pd.frameWidth || 10,
    });
    syncUI(); scheduleRender();
  });

  // 滑块
  els.frameWidth.oninput = (e) => {
    updateActiveConfig({ frameWidth: parseInt(e.target.value) });
    els.widthVal.textContent = e.target.value + '%';
    scheduleRender();
  };
  els.corner.oninput = (e) => {
    updateActiveConfig({ cornerRadius: parseInt(e.target.value) });
    els.cornerVal.textContent = e.target.value;
    scheduleRender();
  };
  els.photoScale.oninput = (e) => {
    updateActiveConfig({ photoScale: parseInt(e.target.value) / 100 });
    els.scaleVal.textContent = e.target.value + '%';
    scheduleRender();
  };
  els.shadowIntensity.oninput = (e) => {
    updateActiveConfig({ shadowIntensity: parseInt(e.target.value) });
    scheduleRender();
  };

  // 颜色
  els.colorSwatches.forEach(sw => sw.onclick = () => {
    updateActiveConfig({ frameColor: sw.dataset.color });
    els.customColor.value = sw.dataset.color;
    syncUI(); scheduleRender();
  });
  els.customColor.oninput = (e) => {
    updateActiveConfig({ frameColor: e.target.value });
    syncUI(); scheduleRender();
  };

  // 效果
  els.shadowToggle.onclick = () => {
    const item = getActiveItem();
    if (!item) return;
    const next = !item.config.shadowOn;
    updateActiveConfig({ shadowOn: next });
    syncUI(); scheduleRender();
  };

  // 极简照片隔离缝隙线
  els.strokeToggle.onclick = () => {
    const item = getActiveItem();
    if (!item) return;
    updateActiveConfig({ photoStrokeOn: !item.config.photoStrokeOn });
    syncUI(); scheduleRender();
  };
  els.strokeWidth.oninput = (e) => {
    updateActiveConfig({ photoStrokeWidth: parseInt(e.target.value) });
    scheduleRender();
  };
  document.getElementById('scolorWhite').onclick = () => {
    updateActiveConfig({ photoStrokeColor: 'rgba(255,255,255,0.7)' });
    document.getElementById('scolorWhite').classList.add('active');
    document.getElementById('scolorBlack').classList.remove('active');
    scheduleRender();
  };
  document.getElementById('scolorBlack').onclick = () => {
    updateActiveConfig({ photoStrokeColor: 'rgba(0,0,0,0.5)' });
    document.getElementById('scolorBlack').classList.add('active');
    document.getElementById('scolorWhite').classList.remove('active');
    scheduleRender();
  };

  // 导出格式
  els.fmtPng.onclick = () => {
    state.exportFormat = 'png';
    els.fmtPng.classList.add('active'); els.fmtJpeg.classList.remove('active');
    els.jpegQualityRow.hidden = true;
  };
  els.fmtJpeg.onclick = () => {
    state.exportFormat = 'jpeg';
    els.fmtJpeg.classList.add('active'); els.fmtPng.classList.remove('active');
    els.jpegQualityRow.hidden = false;
  };
  els.jpegQuality.oninput = (e) => {
    state.exportQuality = parseInt(e.target.value) / 100;
    els.jpegQualityVal.textContent = e.target.value + '%';
  };

  // 渐变开关
  els.gradientToggle.onclick = () => {
    const item = getActiveItem();
    if (!item) return;
    const next = !item.config.gradientOn;
    updateActiveConfig({ gradientOn: next });
    syncUI(); scheduleRender();
  };
  els.gradientColor2.oninput = (e) => {
    updateActiveConfig({ gradientColor2: e.target.value });
    scheduleRender();
  };

  // 胶片颗粒
  els.grainToggle.onclick = () => {
    const item = getActiveItem();
    if (!item) return;
    updateActiveConfig({ grainOn: !item.config.grainOn });
    syncUI(); scheduleRender();
  };
  els.grainIntensity.oninput = (e) => {
    updateActiveConfig({ grainIntensity: parseInt(e.target.value) });
    scheduleRender();
  };

  // 批量操作
  els.btnUndo.onclick = undo;
  els.btnRedo.onclick = redo;
  els.btnSyncAll.onclick = syncAllConfigs;
  els.btnDownloadAll.onclick = batchDownload;
  // 两个下载入口：顶栏导出按钮 + 导出面板下载按钮
  els.btnDownload.onclick = () => downloadOne(getActiveItem());
  if (els.btnDownloadSingle) els.btnDownloadSingle.onclick = () => downloadOne(getActiveItem());

  // 自定义比例
  document.getElementById('btnApplyCustomRatio').onclick = () => {
    const w = parseInt(document.getElementById('customRatioW').value) || 1;
    const h = parseInt(document.getElementById('customRatioH').value) || 1;
    const ratio = `${Math.max(1,w)}:${Math.max(1,h)}`;
    updateActiveConfig({ aspectRatio: ratio, photoOffsetX: 0, photoOffsetY: 0 });
    // 取消预设按钮高亮
    els.ratioGrid.querySelectorAll('.ratio-item').forEach(el => el.classList.remove('active'));
    scheduleRender();
  };
}

// ================================
// 文件处理逻辑
// ================================
async function handleFiles(files) {
  if (!files.length) return;
  const newItems = [];
  
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const item = await createItemFromFile(file);
    newItems.push(item);
  }

  const isFirstLoad = state.items.length === 0;
  state.items.push(...newItems);
  
  if (isFirstLoad) {
    state.activeIndex = 0;
    els.emptyState.hidden = true;
    els.canvasWrap.hidden = false;
    els.batchActions.hidden = false;
    els.btnDownload.disabled = false;
    if (els.btnDownloadSingle) els.btnDownloadSingle.disabled = false;
    els.btnReupload.hidden = false;
    els.thumbArea.hidden = false;
  }

  renderThumbnails();
  syncUI();
  updateStatusBar();
  scheduleRender();
}

const PREVIEW_MAX = 3000; // 大于此尺寸，预览使用降采样

async function createItemFromFile(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const thumb = createThumb(img);
        const baseConfig = state.activeIndex >= 0 ? 
          { ...state.items[state.activeIndex].config, photoOffsetX: 0, photoOffsetY: 0, photoScale: 1.0 } : 
          createDefaultConfig();
        
        // 大图性能优化：生成降采样预览图
        let previewImg = img;
        if (img.width > PREVIEW_MAX || img.height > PREVIEW_MAX) {
          previewImg = createPreview(img);
        }
          
        resolve({
          id: Date.now() + Math.random(),
          img: img,          // 原图（导出用）
          previewImg: previewImg,  // 预览图（渲染用）
          thumb: thumb,
          config: baseConfig
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 大图降采样：生成等比缩小到 PREVIEW_MAX 的预览图
 */
function createPreview(img) {
  const scale = PREVIEW_MAX / Math.max(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const preview = new Image();
  preview.src = c.toDataURL('image/jpeg', 0.9);
  // 同步宽高参数（用于 computeDims）
  preview.width = c.width;
  preview.height = c.height;
  return preview;
}

function createThumb(img) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  c.width = 100; c.height = 100;
  const size = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width-size)/2, (img.height-size)/2, size, size, 0, 0, 100, 100);
  return c.toDataURL('image/jpeg', 0.7);
}

// ================================
// 辅助逻辑
// ================================
const getActiveItem = () => state.items[state.activeIndex];

function updateActiveConfig(patch) {
  const item = getActiveItem();
  if (!item) return;
  pushHistory();
  state.redoStack = []; // 新操作清空重做栈
  els.btnRedo.disabled = true;
  item.config = { ...item.config, ...patch };
}

function pushHistory() {
  const item = getActiveItem();
  if (!item) return;
  state.history.push({ activeIndex: state.activeIndex, config: { ...item.config } });
  if (state.history.length > MAX_HISTORY) state.history.shift();
  els.btnUndo.disabled = false;
}

function undo() {
  if (!state.history.length) return;
  const current = getActiveItem();
  if (current) {
    state.redoStack.push({ activeIndex: state.activeIndex, config: { ...current.config } });
    els.btnRedo.disabled = false;
  }
  const snapshot = state.history.pop();
  const item = state.items[snapshot.activeIndex];
  if (item) {
    item.config = snapshot.config;
    state.activeIndex = snapshot.activeIndex;
    renderThumbnails(); syncUI(); scheduleRender();
  }
  els.btnUndo.disabled = state.history.length === 0;
}

function redo() {
  if (!state.redoStack.length) return;
  const current = getActiveItem();
  if (current) {
    state.history.push({ activeIndex: state.activeIndex, config: { ...current.config } });
    els.btnUndo.disabled = false;
  }
  const snapshot = state.redoStack.pop();
  const item = state.items[snapshot.activeIndex];
  if (item) {
    item.config = snapshot.config;
    state.activeIndex = snapshot.activeIndex;
    renderThumbnails(); syncUI(); scheduleRender();
  }
  els.btnRedo.disabled = state.redoStack.length === 0;
}

/** 快捷键辅助：切换照片 */
function switchPhoto(dir) {
  const next = state.activeIndex + dir;
  if (next < 0 || next >= state.items.length) return;
  state.activeIndex = next;
  renderThumbnails(); syncUI(); scheduleRender();
}

/** 快捷键辅助：调整缩放 */
function adjustScale(delta) {
  const item = getActiveItem();
  if (!item) return;
  const newScale = Math.max(0.2, Math.min(2.5, item.config.photoScale + delta / 100));
  updateActiveConfig({ photoScale: newScale });
  syncUI(); scheduleRender();
}

function syncUI() {
  const item = getActiveItem();
  if (!item) return;
  const cfg = item.config;

  // 比例（使用父容器查询所有子按钮，兼容动态新增的比例按钮）
  els.ratioGrid.querySelectorAll('.ratio-item').forEach(el => 
    el.classList.toggle('active', el.dataset.ratio === cfg.aspectRatio)
  );
  // 边框
  els.frameGrid.querySelectorAll('.frame-item').forEach(el => 
    el.classList.toggle('active', el.dataset.frame === cfg.frameType)
  );
  // 滑块
  els.frameWidth.value = cfg.frameWidth;
  els.widthVal.textContent = cfg.frameWidth + '%';
  els.corner.value = cfg.cornerRadius;
  els.cornerVal.textContent = cfg.cornerRadius;
  els.photoScale.value = cfg.photoScale * 100;
  els.scaleVal.textContent = Math.round(cfg.photoScale * 100) + '%';
  els.shadowIntensity.value = cfg.shadowIntensity;
  // 颜色
  els.customColor.value = cfg.frameColor;
  els.colorSwatches.forEach(sw => sw.classList.toggle('active', sw.dataset.color === cfg.frameColor));
  // 阴影开关
  els.shadowToggle.textContent = cfg.shadowOn ? '开启' : '关闭';
  els.shadowToggle.classList.toggle('on', cfg.shadowOn);
  els.shadowWrap.classList.toggle('disabled-slider', !cfg.shadowOn);
  // 边缘融合
  els.strokeToggle.textContent = cfg.photoStrokeOn ? '开启' : '关闭';
  els.strokeToggle.classList.toggle('on', cfg.photoStrokeOn);
  els.strokeSliderWrap.classList.toggle('disabled-slider', !cfg.photoStrokeOn);
  els.strokeColorOptions.hidden = !cfg.photoStrokeOn;
  els.strokeWidth.value = cfg.photoStrokeWidth || 1;
  const isBlack = cfg.photoStrokeColor === 'rgba(0,0,0,0.5)';
  document.getElementById('scolorBlack').classList.toggle('active', isBlack);
  document.getElementById('scolorWhite').classList.toggle('active', !isBlack);
  // 渐变
  els.gradientToggle.classList.toggle('on', cfg.gradientOn);
  els.gradientToggle.textContent = cfg.gradientOn ? '渐变 开' : '渐变';
  els.gradientColor2Wrap.hidden = !cfg.gradientOn;
  els.gradientColor2.value = cfg.gradientColor2;
  // 胶片颗粒
  els.grainToggle.textContent = cfg.grainOn ? '开启' : '关闭';
  els.grainToggle.classList.toggle('on', cfg.grainOn);
  els.grainSliderWrap.classList.toggle('disabled-slider', !cfg.grainOn);
  els.grainIntensity.value = cfg.grainIntensity;
  // 状态栏
  updateStatusBar();
}

function renderThumbnails() {
  els.thumbStrip.innerHTML = '';
  state.items.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = `thumb-item ${index === state.activeIndex ? 'active' : ''}`;
    div.innerHTML = `<img src="${item.thumb}"><button class="thumb-delete" title="删除此图">×</button>`;
    // 点击缩略图切换
    div.onclick = (e) => {
      if (e.target.classList.contains('thumb-delete')) return; // 不拦截删除按钮
      state.activeIndex = index;
      renderThumbnails();
      syncUI();
      scheduleRender();
    };
    // 删除按钮
    div.querySelector('.thumb-delete').onclick = (e) => {
      e.stopPropagation();
      deleteItem(index);
    };
    els.thumbStrip.appendChild(div);
  });
}

/**
 * 删除指定索引的照片
 */
function deleteItem(index) {
  if (index < 0 || index >= state.items.length) return;
  state.items.splice(index, 1);
  
  // 处理 activeIndex
  if (state.items.length === 0) {
    state.activeIndex = -1;
    state.history = [];
    els.emptyState.hidden = false;
    els.canvasWrap.hidden = true;
    els.batchActions.hidden = true;
    els.btnDownload.disabled = true;
    if (els.btnDownloadSingle) els.btnDownloadSingle.disabled = true;
    els.btnReupload.hidden = true;
    els.thumbArea.hidden = true;
    updateStatusBar();
    return;
  }
  
  if (state.activeIndex >= state.items.length) {
    state.activeIndex = state.items.length - 1;
  } else if (state.activeIndex > index) {
    state.activeIndex--;
  }
  // activeIndex 等于被删的 index 时不需要移动，自然指向下一张
  
  renderThumbnails();
  syncUI();
  scheduleRender();
}

// ================================
// 拖拽逻辑
// ================================
function startDrag(e) {

  if (!state.items.length) return;
  const item = getActiveItem();
  state.isDragging = true;
  state.drag.x = e.clientX;
  state.drag.y = e.clientY;
  state.drag.ox = item.config.photoOffsetX;
  state.drag.oy = item.config.photoOffsetY;
  els.canvas.style.cursor = 'grabbing';
  scheduleRender();
}

function doDrag(e) {

  if (!state.isDragging) return;
  const item = getActiveItem();
  const rect = els.canvas.getBoundingClientRect();
  const scale = els.canvas.width / rect.width;
  item.config.photoOffsetX = state.drag.ox + (e.clientX - state.drag.x) * scale;
  item.config.photoOffsetY = state.drag.oy + (e.clientY - state.drag.y) * scale;
  scheduleRender();
}

function stopDrag() {
  if (state.isDragging) {

    state.isDragging = false;
    els.canvas.style.cursor = 'grab';
    scheduleRender();
  }
}

// ================================
// 核心渲染逻辑
// ================================
function render() {
  const item = getActiveItem();
  if (!item) return;
  
  const d = computeDims(item);
  const { canvasW, canvasH, photoW, photoH, photoX, photoY, bT, bB, bL, bR } = d;
  const cfg = item.config;
  const ctx = els.ctx;

  els.canvas.width = canvasW;
  els.canvas.height = canvasH;
  ctx.clearRect(0, 0, canvasW, canvasH);

  // ---- 准备照片参数 ----
  const drawnW = photoW * cfg.photoScale;
  const drawnH = photoH * cfg.photoScale;
  const drawX = photoX + (photoW - drawnW) / 2 + cfg.photoOffsetX;
  const drawY = photoY + (photoH - drawnH) / 2 + cfg.photoOffsetY;
  const pR = Math.min(drawnW, drawnH) / 2 * cfg.cornerRadius / 50;
  const minBorder = Math.min(bT, bR, bB, bL);

  // ---- 渐变填充辅助 ----
  const getBorderFill = () => {
    if (cfg.gradientOn) {
      const grad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
      grad.addColorStop(0, cfg.frameColor);
      grad.addColorStop(1, cfg.gradientColor2);
      return grad;
    }
    return cfg.frameColor;
  };

  // =========================================
  // 1. 背景层 — 按预设类型分别渲染
  // =========================================
  const ft = cfg.frameType;

  if (ft === 'gallery-black') {
    // Gallery Black: 黑色展览墙 + 冷白装裱面
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasW, canvasH);
    // 冷白卡纸内衬
    const outerFrame = Math.round(minBorder * 0.25);
    ctx.fillStyle = '#f0f0ee';
    ctx.fillRect(outerFrame, outerFrame, canvasW - outerFrame * 2, canvasH - outerFrame * 2);
    // 极微弱纸张纹理
    applyGrain(ctx, outerFrame, outerFrame, canvasW - outerFrame * 2, canvasH - outerFrame * 2, 0.015);

  } else if (ft === 'museum-white') {
    // Museum White: 暖白美术馆墙面 + 米白卡纸
    ctx.fillStyle = getBorderFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    // 柔和纸张纹理
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.025);

  } else if (ft === 'editorial') {
    // Editorial Minimal: 极薄边框，几乎无纹理
    ctx.fillStyle = getBorderFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    // 极微弱纹理
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.005);

  } else if (ft === 'floating') {
    // Floating Print: 深色背景，照片悬浮
    ctx.fillStyle = getBorderFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.02);

  } else if (ft === 'soft-ivory') {
    // Soft Ivory: 象牙白暖调，纸感明显
    ctx.fillStyle = getBorderFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    // 暖色纸张纹理（更重）
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.035);
    // 叠加一层微弱暖色渐变
    ctx.save();
    ctx.globalAlpha = 0.03;
    const warmGrad = ctx.createRadialGradient(canvasW/2, canvasH/2, 0, canvasW/2, canvasH/2, Math.max(canvasW, canvasH) * 0.7);
    warmGrad.addColorStop(0, '#f5e6d0');
    warmGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = warmGrad;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.restore();

  } else if (ft === 'darkroom') {
    // Darkroom Mat: 深灰黑底 + 灰白框面
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvasW, canvasH);
    // 灰白卡纸内衬
    const outerFrame = Math.round(minBorder * 0.3);
    ctx.fillStyle = '#d8d5d0';
    ctx.fillRect(outerFrame, outerFrame, canvasW - outerFrame * 2, canvasH - outerFrame * 2);
    applyGrain(ctx, outerFrame, outerFrame, canvasW - outerFrame * 2, canvasH - outerFrame * 2, 0.03);
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.015);

  } else if (ft === 'thin-archive') {
    // Thin Archive: 极克制，几乎无框
    ctx.fillStyle = getBorderFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    // 极微弱定义线
    if (minBorder > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX - 0.5, drawY - 0.5, drawnW + 1, drawnH + 1);
      ctx.restore();
    }

  } else if (ft === 'shadow-mat') {
    // Shadow Mat: 白色卡纸 + 强调内凹阴影
    ctx.fillStyle = getBorderFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.02);

  }

  // =========================================
  // 2. 预设特效层 — 悬浮阴影 / 装裱阴影
  // =========================================
  
  // Floating Print: 悬浮双层阴影
  if (ft === 'floating' && minBorder > 0) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.10)';
    ctx.shadowBlur = Math.max(photoW, photoH) * 0.10;
    ctx.shadowOffsetY = ctx.shadowBlur * 0.35;
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    roundRectPath(ctx, drawX, drawY, drawnW, drawnH, pR);
    ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0.20)';
    ctx.shadowBlur = Math.max(photoW, photoH) * 0.03;
    ctx.shadowOffsetY = ctx.shadowBlur * 0.5;
    ctx.fill();
    ctx.restore();
  }

  // Gallery Black / Museum White / Darkroom / Shadow Mat: 装裱内凹阴影
  if (['gallery-black', 'museum-white', 'darkroom', 'shadow-mat'].includes(ft) && minBorder > 0) {
    ctx.save();
    // 外层卡纸切割暗边
    const bevelSize = Math.max(1.5, Math.round(minBorder * 0.015));
    ctx.strokeStyle = ft === 'darkroom' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.18)';
    ctx.lineWidth = bevelSize;
    roundRectPath(ctx, drawX - bevelSize/2, drawY - bevelSize/2, drawnW + bevelSize, drawnH + bevelSize, pR);
    ctx.stroke();
    
    // 内层亮边（卡纸切割反光）
    ctx.strokeStyle = ft === 'darkroom' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = Math.max(0.5, bevelSize * 0.4);
    roundRectPath(ctx, drawX + bevelSize * 0.3, drawY + bevelSize * 0.3, drawnW - bevelSize * 0.6, drawnH - bevelSize * 0.6, pR);
    ctx.stroke();

    // Shadow Mat 特殊：加重内凹阴影
    const shadowMult = ft === 'shadow-mat' ? 2.2 : 1.0;
    const shadowDepth = Math.max(6, Math.round(minBorder * 0.08 * shadowMult));
    const shadowAlpha = ft === 'shadow-mat' ? 0.18 : (ft === 'darkroom' ? 0.15 : 0.10);
    
    // 上侧内阴影
    const topGrad = ctx.createLinearGradient(drawX, drawY, drawX, drawY + shadowDepth);
    topGrad.addColorStop(0, `rgba(0,0,0,${shadowAlpha})`);
    topGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(drawX, drawY, drawnW, shadowDepth);
    // 左侧内阴影
    const leftGrad = ctx.createLinearGradient(drawX, drawY, drawX + shadowDepth, drawY);
    leftGrad.addColorStop(0, `rgba(0,0,0,${shadowAlpha * 0.7})`);
    leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(drawX, drawY, shadowDepth, drawnH);
    // 下侧/右侧微弱高光（Shadow Mat 额外）
    if (ft === 'shadow-mat') {
      const botGrad = ctx.createLinearGradient(drawX, drawY + drawnH, drawX, drawY + drawnH - shadowDepth * 0.6);
      botGrad.addColorStop(0, 'rgba(0,0,0,0.06)');
      botGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = botGrad;
      ctx.fillRect(drawX, drawY + drawnH - shadowDepth * 0.6, drawnW, shadowDepth * 0.6);
    }
    ctx.restore();
  }

  // =========================================
  // 3. 边缘特效层（通用：溶解/光晕）
  // =========================================
  
  // 环境光晕 (Outer Glow)
  if (cfg.photoStrokeOn && cfg.photoStrokeColor === 'rgba(255,255,255,0.7)' && cfg.photoStrokeWidth > 0) {
    ctx.save();
    const dynamicBase = Math.max(canvasW, canvasH);
    const blurRadius = Math.round(dynamicBase * cfg.photoStrokeWidth / 200);
    const isDark = ['gallery-black', 'floating', 'darkroom'].includes(ft);
    ctx.shadowColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = blurRadius;
    ctx.fillStyle = isDark ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)';
    roundRectPath(ctx, drawX, drawY, drawnW, drawnH, pR);
    ctx.fill();
    ctx.restore();
  }

  // =========================================
  // 4. 绘制照片
  // =========================================
  const renderImg = item.previewImg || item.img;
  ctx.save();
  roundRectPath(ctx, drawX, drawY, drawnW, drawnH, pR);
  ctx.clip();
  ctx.drawImage(renderImg, drawX, drawY, drawnW, drawnH);

  // 边缘无缝溶解羽化 (Inner Feather Fade)
  if (cfg.photoStrokeOn && cfg.photoStrokeColor === 'rgba(0,0,0,0.5)' && cfg.photoStrokeWidth > 0) {
    const dynamicBase = Math.max(canvasW, canvasH);
    const blurRadius = Math.round(dynamicBase * cfg.photoStrokeWidth / 150);
    ctx.strokeStyle = cfg.frameColor;
    ctx.lineWidth = blurRadius;
    ctx.shadowColor = cfg.frameColor;
    ctx.shadowBlur = blurRadius * 1.5;
    roundRectPath(ctx, drawX, drawY, drawnW, drawnH, pR);
    ctx.stroke();
  }
  ctx.restore();

  // =========================================
  // 5. 后期效果
  // =========================================
  
  // 晕影
  if (cfg.shadowOn) {
    drawVignette(ctx, drawX, drawY, drawnW, drawnH, pR, cfg.shadowIntensity);
  }

  // 拖拽辅助线
  if (state.isDragging) {
    drawGrid(ctx, photoX, photoY, photoW, photoH);
  }

  // 胶片颗粒
  if (cfg.grainOn && cfg.grainIntensity > 0) {
    const grainAlpha = cfg.grainIntensity * 0.006;
    applyGrain(ctx, drawX, drawY, drawnW, drawnH, grainAlpha);
  }

  fitDisplay();
}

/**
 * 核心几何计算
 */
function computeDims(item) {
  const img = item.img;
  const cfg = item.config;
  const base = Math.round(Math.min(img.width, img.height) * cfg.frameWidth / 100);

  // 每种预设的边框倍率
  const multipliers = {
    'gallery-black':  1.6,
    'museum-white':   1.4,
    'editorial':      1.0,
    'floating':       1.2,
    'soft-ivory':     1.3,
    'darkroom':       1.5,
    'thin-archive':   1.0,
    'shadow-mat':     1.5,
  };
  const mult = multipliers[cfg.frameType] || 1.0;
  let bT = Math.round(base * mult);
  let bR = bT, bB = bT, bL = bT;

  const photoW = img.width;
  const photoH = img.height;

  if (cfg.aspectRatio === 'original') {
    return { canvasW: photoW+bL+bR, canvasH: photoH+bT+bB, photoX: bL, photoY: bT, photoW, photoH, bT, bB, bL, bR };
  }

  const [rw, rh] = cfg.aspectRatio.split(':').map(Number);
  const aspect = rw / rh;
  const area = img.width * img.height;
  const canvasH = Math.round(Math.sqrt(area / aspect));
  const canvasW = Math.round(canvasH * aspect);

  // 动态计算该比例下的边框
  const dynamicBase = Math.round(Math.min(canvasW, canvasH) * cfg.frameWidth / 100);
  let dbT = Math.round(dynamicBase * mult);
  let dbR = dbT, dbB = dbT, dbL = dbT;

  const innerW = Math.max(1, canvasW - dbL - dbR);  // 防止边框过大挤占至 0 或负数
  const innerH = Math.max(1, canvasH - dbT - dbB);
  const imgAspect = img.width / img.height;
  
  let finalW, finalH;
  if (imgAspect >= innerW / innerH) { finalW = innerW; finalH = Math.max(1, Math.round(innerW / imgAspect)); }
  else { finalH = innerH; finalW = Math.max(1, Math.round(innerH * imgAspect)); }

  return { 
    canvasW, canvasH, 
    photoX: dbL + (innerW - finalW) / 2, 
    photoY: dbT + (innerH - finalH) / 2, 
    photoW: finalW, photoH: finalH, 
    bT: dbT, bB: dbB, bL: dbL, bR: dbR 
  };
}

// ================================
// 细节渲染器
// ================================
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawFilmHoles(ctx, bT, bB, canvasW, canvasH) {
  const count = Math.max(4, Math.floor(canvasW / (bT * 2.5)));
  const r = Math.max(bT * 0.32, 4);
  const spacing = canvasW / count;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < count; i++) {
    const x = spacing * i + spacing / 2;
    ctx.beginPath(); ctx.arc(x, bT * 0.44, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, canvasH - bB * 0.44, r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawVignette(ctx, x, y, w, h, r, intensity) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const maxR = Math.sqrt(w ** 2 + h ** 2) / 2;
  const alpha = intensity * 0.08;
  const grad = ctx.createRadialGradient(cx, cy, maxR * 0.35, cx, cy, maxR * 1.05);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, `rgba(0,0,0,${alpha * 0.25})`);
  grad.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawGrid(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1;
  // 三分线
  for (let i = 1; i <= 2; i++) {
    const lx = x + (w / 3) * i;
    ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx, y + h); ctx.stroke();
    const ly = y + (h / 3) * i;
    ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + w, ly); ctx.stroke();
  }
  ctx.restore();
}

// ================================
// 噪点纹理系统（边框材质 + 胶片颗粒）
// ================================
let _noiseCanvas = null;
function getNoiseCanvas() {
  if (_noiseCanvas) return _noiseCanvas;
  const size = 256;
  _noiseCanvas = document.createElement('canvas');
  _noiseCanvas.width = size;
  _noiseCanvas.height = size;
  const nctx = _noiseCanvas.getContext('2d');
  const imageData = nctx.createImageData(size, size);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.random() * 255;
    d[i] = v; d[i+1] = v; d[i+2] = v; d[i+3] = 255;
  }
  nctx.putImageData(imageData, 0, 0);
  return _noiseCanvas;
}

/**
 * 在指定区域叠加噪点纹理
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x, y, w, h - 覆盖区域
 * @param {number} opacity - 纹理强度（0~1）
 */
function applyGrain(ctx, x, y, w, h, opacity) {
  if (!opacity || opacity <= 0 || w <= 0 || h <= 0) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = 'overlay';
  const noise = getNoiseCanvas();
  const pattern = ctx.createPattern(noise, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function fitDisplay() {
  const wrap = els.canvasWrap;
  const clientW = wrap.clientWidth - 80;
  const clientH = wrap.clientHeight - 80;
  if (clientW <= 0 || clientH <= 0) return;
  const ratio = Math.min(clientW / els.canvas.width, clientH / els.canvas.height, 1);
  els.canvas.style.width  = Math.round(els.canvas.width * ratio) + 'px';
  els.canvas.style.height = Math.round(els.canvas.height * ratio) + 'px';
}

/**
 * 状态栏更新
 */
function updateStatusBar() {
  const item = getActiveItem();
  if (!item) {
    els.statusText.textContent = '等待输入...';
    els.statusInfo.textContent = '尺寸: --';
    els.statusPreset.textContent = '预设: --';
    return;
  }
  els.statusText.textContent = `策展中 · ${state.items.length} 张照片`;
  els.statusInfo.textContent = `尺寸: ${item.img.width}×${item.img.height}`;
  const presetNames = {
    'gallery-black': '画廊黑', 'museum-white': '美术馆', 'editorial': '编辑风',
    'floating': '悬浮感', 'soft-ivory': '象牙白', 'darkroom': '暗房裱',
    'thin-archive': '档案线', 'shadow-mat': '阴影裱'
  };
  els.statusPreset.textContent = `预设: ${presetNames[item.config.frameType] || '--'}`;
}

// ================================
// 批量操作
// ================================
function syncAllConfigs() {
  const activeItem = getActiveItem();
  if (!activeItem) return;
  const src = activeItem.config;
  
  state.items.forEach((item, idx) => {
    if (idx === state.activeIndex) return;
    // 同步公共参数，保留每张图的位置和缩放
    item.config.frameType    = src.frameType;
    item.config.frameWidth   = src.frameWidth;
    item.config.frameColor   = src.frameColor;
    item.config.gradientOn   = src.gradientOn;
    item.config.gradientColor2 = src.gradientColor2;
    item.config.aspectRatio  = src.aspectRatio;
    item.config.cornerRadius = src.cornerRadius;
    item.config.shadowOn     = src.shadowOn;
    item.config.shadowIntensity = src.shadowIntensity;
    item.config.photoStrokeOn = src.photoStrokeOn;
    item.config.photoStrokeWidth = src.photoStrokeWidth;
    item.config.photoStrokeColor = src.photoStrokeColor;
    item.config.grainOn      = src.grainOn;
    item.config.grainIntensity = src.grainIntensity;
  });
  // 非阻断式提示（2秒后自动消失）
  showToast('已同步到所有图片（保留各自缩放和偏移）');
  scheduleRender();
}

function batchDownload() {
  if (!state.items.length) return;
  showToast(`开始下载 ${state.items.length} 张图片...`);
  state.items.forEach((item, idx) => {
    setTimeout(() => downloadOne(item, `framer_batch_${idx+1}.png`), idx * 600);
  });
}

/**
 * 下载单张：使用离屏 Canvas 渲染，不干扰主画布状态
 */
function downloadOne(item, filename = 'framer_photo.png') {
  if (!item) return;
  const d = computeDims(item);
  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d');
  offscreen.width = d.canvasW;
  offscreen.height = d.canvasH;

  // 临时使用离屏 ctx 渲染
  const origCtx = els.ctx;
  els.ctx = offCtx;
  const origCanvas = els.canvas;
  els.canvas = offscreen;
  
  // 导出时强制使用原图（非降采样）
  const savedPreview = item.previewImg;
  item.previewImg = item.img;
  
  const savedIndex = state.activeIndex;
  state.activeIndex = state.items.indexOf(item);
  render();
  
  // 根据导出设置生成文件
  const mime = state.exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = state.exportFormat === 'jpeg' ? state.exportQuality : 1.0;
  const ext = state.exportFormat === 'jpeg' ? '.jpg' : '.png';
  const finalName = filename.replace(/\.[^.]+$/, ext);
  
  const link = document.createElement('a');
  link.download = finalName;
  link.href = offscreen.toDataURL(mime, quality);
  link.click();
  
  // 还原
  item.previewImg = savedPreview;
  els.ctx = origCtx;
  els.canvas = origCanvas;
  state.activeIndex = savedIndex;
  scheduleRender();
}

/**
 * 轻量 Toast 提示（替代 alert，不阻断交互）
 */
function showToast(msg) {
  let toast = document.getElementById('framerToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'framerToast';
    toast.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);' +
      'background:rgba(30,30,40,0.92);color:#fff;padding:12px 24px;border-radius:12px;' +
      'font-size:13px;z-index:9999;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.1);' +
      'transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// ================================
// 启动
// ================================
window.onload = () => {
  // 读取本地偷好缓存
  try {
    const saved = JSON.parse(localStorage.getItem('framer_prefs'));
    if (saved) {
      if (saved.exportFormat) state.exportFormat = saved.exportFormat;
      if (saved.exportQuality) state.exportQuality = saved.exportQuality;
    }
  } catch(e) { /* ignore */ }
  init();
};
window.onresize = () => { if(state.items.length) fitDisplay(); };

// 页面关闭前保存偏好
window.addEventListener('beforeunload', () => {
  try {
    const item = getActiveItem();
    const prefs = {
      exportFormat: state.exportFormat,
      exportQuality: state.exportQuality,
    };
    if (item) {
      prefs.frameType = item.config.frameType;
      prefs.frameColor = item.config.frameColor;
      prefs.filter = item.config.filter;
    }
    localStorage.setItem('framer_prefs', JSON.stringify(prefs));
  } catch(e) { /* ignore */ }
});
