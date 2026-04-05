/**
 * Framer V4 - 高级照片边框编辑器
 * 功能：多图管理、高级边框、滤镜、撤销/重做、导出格式选择
 */

// ================================
// 状态树
// ================================
const state = {
  items: [],        // { id, img, thumb, config: { ... } }
  activeIndex: -1,
  isDragging: false,
  drag: { x: 0, y: 0, ox: 0, oy: 0 },
  history: [],      // 撤销栈
  redoStack: [],    // 重做栈
  exportFormat: 'png',
  exportQuality: 0.92,
};

const MAX_HISTORY = 40;

// 滤镜映射表
const FILTERS = {
  none:      'none',
  grayscale: 'grayscale(100%)',
  sepia:     'sepia(80%) saturate(120%)',
  warm:      'sepia(25%) saturate(140%) hue-rotate(-10deg)',
  cool:      'saturate(80%) hue-rotate(20deg) brightness(1.05)',
  fade:      'saturate(50%) contrast(85%) brightness(1.1)',
};

// 预设边框初始颜色
const BORDER_DEFAULTS = {
  white: '#ffffff', black: '#1a1a1a', museum: '#ffffff',
  polaroid: '#ffffff', film: '#111111', float: '#f9f9f9', none: '#ffffff'
};

// 默认配置生成器
const createDefaultConfig = (frame = 'white') => ({
  frameType:    frame,
  frameWidth:   6,
  frameColor:   BORDER_DEFAULTS[frame],
  aspectRatio:  'original',
  cornerRadius: 0,
  photoScale:   1.0,
  photoOffsetX: 0,
  photoOffsetY: 0,
  shadowOn:     false,
  shadowIntensity: 6,
  filter:       'none',
});

// ================================
// DOM 引用
// ================================
const els = {
  uploadZone:   document.getElementById('uploadZone'),
  fileInput:    document.getElementById('fileInput'),
  btnUpload:    document.getElementById('btnUpload'),
  canvasWrap:   document.getElementById('canvasWrap'),
  canvas:       document.getElementById('previewCanvas'),
  ctx:          document.getElementById('previewCanvas').getContext('2d'),
  thumbStrip:   document.getElementById('thumbnailStrip'),
  batchActions: document.getElementById('batchActions'),
  btnDownload:  document.getElementById('btnDownload'),
  btnUndo:      document.getElementById('btnUndo'),
  btnRedo:      document.getElementById('btnRedo'),
  btnSyncAll:   document.getElementById('btnSyncAll'),
  btnDownloadAll: document.getElementById('btnDownloadAll'),
  // Controls
  ratioGrid:    document.getElementById('ratioGrid'),
  frameGrid:    document.getElementById('frameGrid'),
  filterGrid:   document.getElementById('filterGrid'),
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
};

// ================================
// RAF 渲染调度
// ================================
let rafId = null;
const scheduleRender = () => {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => { render(); rafId = null; });
};

// ================================
// 初始化与事件绑定
// ================================
function init() {
  els.uploadZone.onclick = () => els.fileInput.click();
  els.btnUpload.onclick = (e) => { e.stopPropagation(); els.fileInput.click(); };
  els.fileInput.onchange = (e) => handleFiles(e.target.files);

  // 拖拽上传
  els.uploadZone.ondragover = (e) => { e.preventDefault(); els.uploadZone.classList.add('drag-over'); };
  els.uploadZone.ondragleave = () => els.uploadZone.classList.remove('drag-over');
  els.uploadZone.ondrop = (e) => {
    e.preventDefault(); els.uploadZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  };

  document.getElementById('btnReupload').onclick = () => els.fileInput.click();

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
    updateActiveConfig({ frameType: type, frameColor: BORDER_DEFAULTS[type] });
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

  // 滤镜 — 事件委托
  els.filterGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-item');
    if (!btn) return;
    updateActiveConfig({ filter: btn.dataset.filter });
    syncUI(); scheduleRender();
  });

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

  // 批量操作
  els.btnUndo.onclick = undo;
  els.btnRedo.onclick = redo;
  els.btnSyncAll.onclick = syncAllConfigs;
  els.btnDownloadAll.onclick = batchDownload;
  els.btnDownload.onclick = () => downloadOne(getActiveItem());

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
    els.uploadZone.hidden = true;
    els.canvasWrap.hidden = false;
    els.batchActions.hidden = false;
    els.btnDownload.disabled = false;
  }

  renderThumbnails();
  syncUI();
  scheduleRender();
}

async function createItemFromFile(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 生成缩略图以便 UI 展示
        const thumb = createThumb(img);
        // 如果已有图片，新图片继承当前选中的配置（用户体验：复制上一张）
        const baseConfig = state.activeIndex >= 0 ? 
          { ...state.items[state.activeIndex].config, photoOffsetX: 0, photoOffsetY: 0, photoScale: 1.0 } : 
          createDefaultConfig();
          
        resolve({
          id: Date.now() + Math.random(),
          img: img,
          thumb: thumb,
          config: baseConfig
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
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
  els.shadowToggle.textContent = cfg.shadowOn ? '开 启' : '关 闭';
  els.shadowToggle.classList.toggle('on', cfg.shadowOn);
  els.shadowWrap.classList.toggle('shadow-slider-disabled', !cfg.shadowOn);
  // 滤镜
  els.filterGrid.querySelectorAll('.filter-item').forEach(el =>
    el.classList.toggle('active', el.dataset.filter === cfg.filter)
  );
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
    // 全部删完，回到上传界面
    state.activeIndex = -1;
    state.history = [];
    els.uploadZone.hidden = false;
    els.canvasWrap.hidden = true;
    els.batchActions.hidden = true;
    els.btnDownload.disabled = true;
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

  // 1. 绘制背景层
  if (cfg.frameType === 'film') {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (cfg.frameType === 'museum') {
    // 博物馆风：实色外框 + 极其轻微的内切阴影效果
    ctx.fillStyle = cfg.frameColor;
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (cfg.frameType !== 'none') {
    ctx.fillStyle = cfg.frameColor;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // 2. 准备照片参数
  const drawnW = photoW * cfg.photoScale;
  const drawnH = photoH * cfg.photoScale;
  const drawX = photoX + (photoW - drawnW) / 2 + cfg.photoOffsetX;
  const drawY = photoY + (photoH - drawnH) / 2 + cfg.photoOffsetY;
  const pR = Math.min(drawnW, drawnH) / 2 * cfg.cornerRadius / 50;

  // 3. 特殊效果：Float (悬浮阴影增强)
  if (cfg.frameType === 'float') {
    ctx.save();
    // 第一层：大范围弥散阴影
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = Math.max(photoW, photoH) * 0.12;
    ctx.shadowOffsetY = ctx.shadowBlur * 0.4;
    ctx.fillStyle = "rgba(0,0,0,0.1)"; 
    roundRectPath(ctx, drawX, drawY, drawnW, drawnH, pR);
    ctx.fill();
    
    // 第二层：核心深色阴影
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = Math.max(photoW, photoH) * 0.04;
    ctx.shadowOffsetY = ctx.shadowBlur * 0.3;
    ctx.fill();
    ctx.restore();
  }

  // 4. 绘制照片 (裁剪圆角 + 滤镜)
  ctx.save();
  roundRectPath(ctx, drawX, drawY, drawnW, drawnH, pR);
  ctx.clip();
  // 应用滤镜
  const filterStr = FILTERS[cfg.filter] || 'none';
  if (filterStr !== 'none') ctx.filter = filterStr;
  ctx.drawImage(item.img, drawX, drawY, drawnW, drawnH);
  ctx.filter = 'none'; // 重置，避免影响后续装饰层
  ctx.restore();

  // 5. 装饰层：Museum 艺术装裱增强（增加卡纸凹陷感）
  if (cfg.frameType === 'museum' && bT > 0) {
    ctx.save();
    // 模拟相框内边缘的斜面投影 (Bevel Shadow)
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(photoX, photoY, photoW, photoH);
    
    // 增加一个极细的亮内边，体现立体感
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.strokeRect(photoX + 1, photoY + 1, photoW - 2, photoH - 2);

    // 内部微弱渐变，体现凹陷
    const innerGrad = ctx.createLinearGradient(photoX, photoY, photoX + 20, photoY + 20);
    innerGrad.addColorStop(0, 'rgba(0,0,0,0.08)');
    innerGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = innerGrad;
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.restore();
  }

  // 6. 装饰层：Film 穿孔
  if (cfg.frameType === 'film' && bT > 0) {
    drawFilmHoles(ctx, bT, bB, canvasW, canvasH);
  }

  // 7. 边缘晕影功能
  if (cfg.shadowOn) {
    drawVignette(ctx, drawX, drawY, drawnW, drawnH, pR, cfg.shadowIntensity);
  }

  // 8. 网格辅助线 (修正：完全静止在相框槽位)
  if (state.isDragging) {
    drawGrid(ctx, photoX, photoY, photoW, photoH);
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

  let bT = base, bR = base, bB = base, bL = base;
  if (cfg.frameType === 'polaroid') { bB = Math.round(base * 3.2); }
  else if (cfg.frameType === 'film') { bT = Math.round(base * 1.6); bB = Math.round(base * 1.6); }
  else if (cfg.frameType === 'museum') { bT = bR = bB = bL = Math.round(base * 1.5); }
  else if (cfg.frameType === 'none') { bT = bR = bB = bL = 0; }

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
  let dbT = dynamicBase, dbR = dynamicBase, dbB = dynamicBase, dbL = dynamicBase;
  if (cfg.frameType === 'polaroid') { dbB = Math.round(dynamicBase * 3.2); }
  else if (cfg.frameType === 'film') { dbT = Math.round(dynamicBase * 1.6); dbB = Math.round(dynamicBase * 1.6); }
  else if (cfg.frameType === 'museum') { dbT = dbR = dbB = dbL = Math.round(dynamicBase * 1.5); }
  else if (cfg.frameType === 'none') { dbT = dbR = dbB = dbL = 0; }

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
  const alpha = intensity * 0.05;
  const grad = ctx.createRadialGradient(cx, cy, maxR * 0.3, cx, cy, maxR);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
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

function fitDisplay() {
  const clientW = els.canvasWrap.clientWidth - 48;
  const clientH = 520;  // 与预览区高度匹配，作为唯一尺寸约束
  const ratio = Math.min(clientW / els.canvas.width, clientH / els.canvas.height, 1);
  els.canvas.style.width  = Math.round(els.canvas.width * ratio) + 'px';
  els.canvas.style.height = Math.round(els.canvas.height * ratio) + 'px';
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
    item.config.aspectRatio  = src.aspectRatio;
    item.config.cornerRadius = src.cornerRadius;
    item.config.shadowOn     = src.shadowOn;
    item.config.shadowIntensity = src.shadowIntensity;
    item.config.filter       = src.filter;
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

// 启动
window.onload = init;
window.onresize = () => { if(state.items.length) fitDisplay(); };
