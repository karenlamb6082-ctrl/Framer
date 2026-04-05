/**
 * Framer V4 - 高级照片边框编辑器
 * 功能：多图管理、高级边框、滤镜、撤销/重做、导出格式选择
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
  // 拼图模式（独立功能，不依赖 state.items）
  collageMode: false,
  collageLayout: 'side-by-side',
  collageRatio: '4:3',
  collageBg: '#ffffff',
  collageLayers: [],        // [{ img, previewImg, x, y, w, h, cornerRadius, borderWidth, borderColor, zIndex }]
  selectedLayerIdx: -1,
  layerDragMode: null,      // 'move' | 'resize-nw/ne/sw/se'
};

const MAX_HISTORY = 40;

// 拼图布局模板（每个 region 是 0~1 的比例坐标）
const COLLAGE_LAYOUTS = {
  'side-by-side': {
    slots: 2,
    regions: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 }
    ]
  },
  'top-bottom': {
    slots: 2,
    regions: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 }
    ]
  },
  'grid-2x2': {
    slots: 4,
    regions: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
    ]
  },
  'one-two': {
    slots: 3,
    regions: [
      { x: 0, y: 0, w: 0.55, h: 1 },
      { x: 0.55, y: 0, w: 0.45, h: 0.5 },
      { x: 0.55, y: 0.5, w: 0.45, h: 0.5 }
    ]
  }
};

// 极简高定风格预设初始颜色
const BORDER_DEFAULTS = {
  white: '#ffffff', black: '#000000', museum: '#fafafa', gallery: '#1a1a1a', none: '#ffffff'
};

// 默认配置生成器
const createDefaultConfig = (frame = 'white') => ({
  frameType:    frame,
  frameWidth:   10,
  frameColor:   BORDER_DEFAULTS[frame],
  gradientOn:   false,
  gradientColor2: '#f5f0e8',
  aspectRatio:  'original',
  cornerRadius: 0,
  photoScale:   1.0,
  photoOffsetX: 0,
  photoOffsetY: 0,
  shadowOn:     false,
  shadowIntensity: 6,
  photoStrokeOn: true,
  photoStrokeWidth: 8,
  photoStrokeColor: 'rgba(0,0,0,0.5)',
  grainOn:      false,
  grainIntensity: 5,
});

// ================================
// DOM 引用
// ================================
const els = {
  uploadZone:   document.getElementById('uploadZone'),
  fileInput:    document.getElementById('fileInput'),
  btnUpload:    document.getElementById('btnUpload'),
  btnReupload:  document.getElementById('btnReupload'),
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
  // 拼图
  btnCollage:     document.getElementById('btnCollage'),
  collagePanel:   document.getElementById('collagePanel'),
  controlPanel:   document.getElementById('controlPanel'),
  layoutGrid:     document.getElementById('layoutGrid'),
  layerLabel:     document.getElementById('layerLabel'),
  layerRadius:    document.getElementById('layerRadius'),
  layerRadiusVal: document.getElementById('layerRadiusVal'),
  layerBorder:    document.getElementById('layerBorder'),
  layerBorderVal: document.getElementById('layerBorderVal'),
  layerColorPicker: document.getElementById('layerColorPicker'),
  layerUp:        document.getElementById('layerUp'),
  layerDown:      document.getElementById('layerDown'),
  collageBgPicker: document.getElementById('collageBgPicker'),
  btnCollageAdd:   document.getElementById('btnCollageAdd'),
  collageFileInput: document.getElementById('collageFileInput'),
};

// ================================
// RAF 渲染调度
// ================================
let rafId = null;
const scheduleRender = () => {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    if (state.collageMode) renderCollage();
    else render();
    rafId = null;
  });
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
  els.btnDownload.onclick = () => {
    if (state.collageMode) { downloadCollage(); }
    else { downloadOne(getActiveItem()); }
  };

  // 拼图模式
  els.btnCollage.onclick = toggleCollageMode;
  els.layoutGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.layout-item');
    if (!btn) return;
    state.collageLayout = btn.dataset.layout;
    initCollageLayers();
    els.layoutGrid.querySelectorAll('.layout-item').forEach(b => 
      b.classList.toggle('active', b.dataset.layout === state.collageLayout)
    );
    scheduleRender();
  });
  // 图层控件
  els.layerRadius.oninput = (e) => {
    const layer = state.collageLayers[state.selectedLayerIdx];
    if (!layer) return;
    layer.cornerRadius = parseInt(e.target.value);
    els.layerRadiusVal.textContent = e.target.value;
    scheduleRender();
  };
  els.layerBorder.oninput = (e) => {
    const layer = state.collageLayers[state.selectedLayerIdx];
    if (!layer) return;
    layer.borderWidth = parseInt(e.target.value);
    els.layerBorderVal.textContent = e.target.value + '%';
    scheduleRender();
  };
  document.querySelectorAll('[data-lcolor]').forEach(sw => {
    sw.onclick = () => {
      const layer = state.collageLayers[state.selectedLayerIdx];
      if (!layer) return;
      layer.borderColor = sw.dataset.lcolor;
      document.querySelectorAll('[data-lcolor]').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      scheduleRender();
    };
  });
  els.layerColorPicker.oninput = (e) => {
    const layer = state.collageLayers[state.selectedLayerIdx];
    if (!layer) return;
    layer.borderColor = e.target.value;
    scheduleRender();
  };
  els.layerUp.onclick = () => moveLayer(1);
  els.layerDown.onclick = () => moveLayer(-1);
  // 画布背景
  document.querySelectorAll('[data-bgc]').forEach(sw => {
    sw.onclick = () => {
      state.collageBg = sw.dataset.bgc;
      document.querySelectorAll('[data-bgc]').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      scheduleRender();
    };
  });
  els.collageBgPicker.oninput = (e) => {
    state.collageBg = e.target.value;
    scheduleRender();
  };
  // 拼图模式：添加照片
  els.btnCollageAdd.onclick = () => els.collageFileInput.click();
  els.collageFileInput.onchange = (e) => {
    addPhotosToCollage(e.target.files);
    e.target.value = '';
  };
  // 拼图画布比例
  document.querySelectorAll('[data-cratio]').forEach(btn => {
    btn.onclick = () => {
      state.collageRatio = btn.dataset.cratio;
      document.querySelectorAll('[data-cratio]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      scheduleRender();
    };
  });

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
  els.shadowToggle.textContent = cfg.shadowOn ? '开 启' : '关 闭';
  els.shadowToggle.classList.toggle('on', cfg.shadowOn);
  els.shadowWrap.classList.toggle('shadow-slider-disabled', !cfg.shadowOn);
  // 隔离线
  els.strokeToggle.textContent = cfg.photoStrokeOn ? '开 启' : '关 闭';
  els.strokeToggle.classList.toggle('on', cfg.photoStrokeOn);
  els.strokeSliderWrap.classList.toggle('shadow-slider-disabled', !cfg.photoStrokeOn);
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
  els.grainToggle.textContent = cfg.grainOn ? '开 启' : '关 闭';
  els.grainToggle.classList.toggle('on', cfg.grainOn);
  els.grainSliderWrap.classList.toggle('shadow-slider-disabled', !cfg.grainOn);
  els.grainIntensity.value = cfg.grainIntensity;
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
  if (state.collageMode) { startCollageDrag(e); return; }
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
  if (state.collageMode) { doCollageDrag(e); return; }
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
    if (state.collageMode) { stopCollageDrag(); return; }
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
  const getBorderFill = () => {
    if (cfg.gradientOn && cfg.frameType !== 'film' && cfg.frameType !== 'none') {
      const grad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
      grad.addColorStop(0, cfg.frameColor);
      grad.addColorStop(1, cfg.gradientColor2);
      return grad;
    }
    return cfg.frameColor;
  };
  
  if (cfg.frameType === 'film') {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (cfg.frameType === 'gallery') {
    // 画廊装裱：黑色外框 + 白色内衬纸
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvasW, canvasH);
    // 内衬纸（outer frame 占边框总宽的 30%）
    const outerFrame = Math.round(Math.min(bT, bR, bB, bL) * 0.3);
    const matColor = cfg.frameColor === '#1a1a1a' ? '#f5f2ed' : cfg.frameColor;
    ctx.fillStyle = matColor;
    ctx.fillRect(outerFrame, outerFrame, canvasW - outerFrame * 2, canvasH - outerFrame * 2);
    // 叠加纸张纹理
    applyGrain(ctx, outerFrame, outerFrame, canvasW - outerFrame * 2, canvasH - outerFrame * 2, 0.025);
    // 外框纫理
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.015);
  } else if (cfg.frameType === 'museum') {
    ctx.fillStyle = getBorderFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    // Museum 卡纸纹理
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.02);
  } else if (cfg.frameType !== 'none') {
    ctx.fillStyle = getBorderFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    // 边框微妙纹理
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.012);
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

  // 3.5 环境光晕 (Outer Glow)
  if (cfg.photoStrokeOn && cfg.photoStrokeColor === 'rgba(255,255,255,0.7)' && cfg.photoStrokeWidth > 0) {
    ctx.save();
    const dynamicBase = Math.max(canvasW, canvasH);
    const blurRadius = Math.round(dynamicBase * cfg.photoStrokeWidth / 200);
    ctx.shadowColor = cfg.frameColor === '#ffffff' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.3)';
    ctx.shadowBlur = blurRadius;
    ctx.fillStyle = cfg.frameColor === '#ffffff' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)';
    roundRectPath(ctx, drawX, drawY, drawnW, drawnH, pR);
    ctx.fill();
    ctx.restore();
  }

  // 4. 绘制照片 (裁剪圆角)
  // 预览时使用降采样图提高性能，导出时用原图
  const renderImg = item.previewImg || item.img;
  ctx.save();
  roundRectPath(ctx, drawX, drawY, drawnW, drawnH, pR);
  ctx.clip();
  ctx.drawImage(renderImg, drawX, drawY, drawnW, drawnH);

  // 4.5 边缘无缝溶解羽化 (Inner Feather Fade)
  if (cfg.photoStrokeOn && cfg.photoStrokeColor === 'rgba(0,0,0,0.5)' && cfg.photoStrokeWidth > 0) {
    const dynamicBase = Math.max(canvasW, canvasH);
    const blurRadius = Math.round(dynamicBase * cfg.photoStrokeWidth / 150);
    ctx.strokeStyle = cfg.frameColor;
    ctx.lineWidth = blurRadius;
    ctx.shadowColor = cfg.frameColor;
    ctx.shadowBlur = blurRadius * 1.5;
    // 由于之前已经 ctx.clip() 限定在照片边缘内侧，这道带有高斯模糊的粗线只会向内渗透，制造完美的图片融入背景的错觉。
    roundRectPath(ctx, drawX, drawY, drawnW, drawnH, pR);
    ctx.stroke();
  }
  ctx.restore();

  // 5. 装饰层：Museum / Gallery 艺术装裱增强
  if ((cfg.frameType === 'museum' || cfg.frameType === 'gallery') && bT > 0) {
    ctx.save();
    // 卡纸切割边缘 — 外层暗边
    const bevelSize = Math.max(2, Math.round(Math.min(bT, bL) * 0.02));
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = bevelSize;
    roundRectPath(ctx, drawX - bevelSize/2, drawY - bevelSize/2, drawnW + bevelSize, drawnH + bevelSize, pR);
    ctx.stroke();
    
    // 内层亮边 — 模拟卡纸切割的反光
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1, bevelSize * 0.5);
    roundRectPath(ctx, drawX + bevelSize * 0.3, drawY + bevelSize * 0.3, drawnW - bevelSize * 0.6, drawnH - bevelSize * 0.6, pR);
    ctx.stroke();

    // 内部微弱渐变，体现凹陷感
    const shadowDepth = Math.max(8, Math.round(Math.min(bT, bL) * 0.08));
    // 上边暗角
    const topGrad = ctx.createLinearGradient(drawX, drawY, drawX, drawY + shadowDepth);
    topGrad.addColorStop(0, 'rgba(0,0,0,0.12)');
    topGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(drawX, drawY, drawnW, shadowDepth);
    // 左边暗角
    const leftGrad = ctx.createLinearGradient(drawX, drawY, drawX + shadowDepth, drawY);
    leftGrad.addColorStop(0, 'rgba(0,0,0,0.08)');
    leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(drawX, drawY, shadowDepth, drawnH);
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

  // 8. 网格辅助线
  if (state.isDragging) {
    drawGrid(ctx, photoX, photoY, photoW, photoH);
  }

  // 9. 胶片颗粒效果
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

  let bT = base, bR = base, bB = base, bL = base;
  if (cfg.frameType === 'polaroid') { bB = Math.round(base * 3.2); }
  else if (cfg.frameType === 'film') { bT = Math.round(base * 1.6); bB = Math.round(base * 1.6); }
  else if (cfg.frameType === 'museum') { bT = bR = bB = bL = Math.round(base * 1.5); }
  else if (cfg.frameType === 'gallery') { bT = bR = bB = bL = Math.round(base * 2.0); }
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
  else if (cfg.frameType === 'gallery') { dbT = dbR = dbB = dbL = Math.round(dynamicBase * 2.0); }
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
// 拼图模式（独立功能）
// ================================

const COLLAGE_W = 2400;
const COLLAGE_H = 1800;
const HANDLE_SZ = 20;
const PREVIEW_MAX_C = 1600; // 拼图预览降采样上限

function toggleCollageMode() {
  state.collageMode = !state.collageMode;
  els.btnCollage.classList.toggle('active', state.collageMode);
  els.collagePanel.hidden = !state.collageMode;

  if (state.collageMode) {
    // 进入拼图模式：显示画布，隐藏普通编辑区
    els.uploadZone.style.display = 'none';
    els.canvasWrap.hidden = false;
    els.btnReupload.hidden = true;
    els.btnCollageAdd.hidden = false;
    els.controlPanel.hidden = true;
    document.querySelector('.thumbnail-outer').style.display = 'none';
    if (state.collageLayers.length === 0) {
      renderCollage();
    } else {
      scheduleRender();
    }
  } else {
    // 退出拼图模式：恢复普通状态
    els.btnCollageAdd.hidden = true;
    els.btnReupload.hidden = false;
    els.controlPanel.hidden = false;
    document.querySelector('.thumbnail-outer').style.display = '';
    if (state.items.length) {
      els.canvasWrap.hidden = false;
      els.uploadZone.style.display = 'none';
    } else {
      els.canvasWrap.hidden = true;
      els.uploadZone.style.display = '';
    }
    state.collageLayers = [];
    state.selectedLayerIdx = -1;
    scheduleRender();
  }
}

/** 拼图模式专用：上传照片并添加为图层 */
async function addPhotosToCollage(files) {
  if (!files || !files.length) return;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const imgData = await loadCollageImage(file);
    // 计算默认大小（根据图层数自适应缩小）
    const { w: CW, h: CH } = getCollageSize();
    const totalAfter = state.collageLayers.length + 1;
    const sizeFactor = totalAfter <= 2 ? 0.5 : totalAfter <= 4 ? 0.4 : 0.3;
    const maxW = CW * sizeFactor;
    const maxH = CH * sizeFactor;
    const ratio = Math.min(maxW / imgData.img.width, maxH / imgData.img.height, 1);
    const w = Math.round(imgData.img.width * ratio);
    const h = Math.round(imgData.img.height * ratio);
    // 偏移避免完全重叠（按序散开）
    const idx = state.collageLayers.length;
    const cols = Math.ceil(Math.sqrt(totalAfter));
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cellW = CW / cols;
    const cellH = CH / Math.ceil(totalAfter / cols);
    state.collageLayers.push({
      img: imgData.img,
      previewImg: imgData.previewImg,
      x: Math.round(col * cellW + (cellW - w) / 2),
      y: Math.round(row * cellH + (cellH - h) / 2),
      w, h,
      cornerRadius: 0,
      borderWidth: 0,
      borderColor: '#ffffff',
      zIndex: state.collageLayers.length
    });
  }
  state.selectedLayerIdx = state.collageLayers.length - 1;
  syncLayerUI();
  scheduleRender();
}

/** 加载单张图片（拼图专用） */
function loadCollageImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let previewImg = img;
        if (img.width > PREVIEW_MAX_C || img.height > PREVIEW_MAX_C) {
          previewImg = createPreview(img);
        }
        resolve({ img, previewImg });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/** 布局模板：重新排列当前图层 */
function initCollageLayers() {
  if (!state.collageLayers.length) return;
  const { w: CW, h: CH } = getCollageSize();
  const gap = 30;
  const count = state.collageLayers.length;
  const layout = COLLAGE_LAYOUTS[state.collageLayout];

  // 如果模板region数 >= 图层数，直接用模板；否则自动均分网格
  if (layout && layout.regions.length >= count) {
    state.collageLayers.forEach((layer, i) => {
      const r = layout.regions[i];
      layer.x = Math.round(r.x * CW + gap);
      layer.y = Math.round(r.y * CH + gap);
      layer.w = Math.round(r.w * CW - gap * 2);
      layer.h = Math.round(r.h * CH - gap * 2);
      layer.zIndex = i;
    });
  } else {
    // 自动网格：根据图层数计算行列
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellW = CW / cols;
    const cellH = CH / rows;
    state.collageLayers.forEach((layer, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      layer.x = Math.round(col * cellW + gap);
      layer.y = Math.round(row * cellH + gap);
      layer.w = Math.round(cellW - gap * 2);
      layer.h = Math.round(cellH - gap * 2);
      layer.zIndex = i;
    });
  }
  state.selectedLayerIdx = 0;
  syncLayerUI();
}

function syncLayerUI() {
  const layer = state.collageLayers[state.selectedLayerIdx];
  if (!layer) { els.layerLabel.textContent = '未选择'; return; }
  els.layerLabel.textContent = '#' + (state.selectedLayerIdx + 1);
  els.layerRadius.value = layer.cornerRadius;
  els.layerRadiusVal.textContent = layer.cornerRadius;
  els.layerBorder.value = layer.borderWidth;
  els.layerBorderVal.textContent = layer.borderWidth + '%';
  els.layerColorPicker.value = layer.borderColor;
}

function moveLayer(dir) {
  const layer = state.collageLayers[state.selectedLayerIdx];
  if (!layer) return;
  const sorted = [...state.collageLayers].sort((a, b) => a.zIndex - b.zIndex);
  const pos = sorted.indexOf(layer);
  const target = pos + dir;
  if (target < 0 || target >= sorted.length) return;
  const tmp = layer.zIndex;
  layer.zIndex = sorted[target].zIndex;
  sorted[target].zIndex = tmp;
  scheduleRender();
}

function getCollageSize() {
  const base = 2400;
  const [rw, rh] = state.collageRatio.split(':').map(Number);
  return { w: base, h: Math.round(base * rh / rw) };
}

function renderCollage() {
  const { w: CW, h: CH } = getCollageSize();
  const ctx = els.ctx;
  els.canvas.width = CW;
  els.canvas.height = CH;

  // 画布背景
  ctx.fillStyle = state.collageBg;
  ctx.fillRect(0, 0, CW, CH);

  if (!state.collageLayers.length) {
    // 空画布提示
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('点击「+ 添加照片」开始拼图', CW / 2, CH / 2);
    fitDisplay();
    return;
  }

  const sorted = [...state.collageLayers]
    .map((l, i) => ({ ...l, _i: i }))
    .sort((a, b) => a.zIndex - b.zIndex);

  sorted.forEach(layer => {
    const { x, y, w, h, cornerRadius, borderWidth, borderColor } = layer;
    const bw = Math.round(Math.min(w, h) * borderWidth / 100);
    const oR = Math.min(w, h) / 2 * cornerRadius / 50;

    // 边框
    if (bw > 0) {
      ctx.save();
      ctx.fillStyle = borderColor;
      roundRectPath(ctx, x, y, w, h, oR);
      ctx.fill();
      ctx.restore();
    }

    // 照片
    const px = x + bw, py = y + bw, pw = w - bw * 2, ph = h - bw * 2;
    if (pw <= 0 || ph <= 0) return;
    const iR = Math.max(0, oR - bw);
    ctx.save();
    roundRectPath(ctx, px, py, pw, ph, iR);
    ctx.clip();

    const img = layer.previewImg || layer.img;
    const ia = img.width / img.height, sa = pw / ph;
    let dw, dh;
    if (ia > sa) { dh = ph; dw = dh * ia; }
    else { dw = pw; dh = dw / ia; }
    ctx.drawImage(img, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
    ctx.restore();

    // 选中高亮
    if (layer._i === state.selectedLayerIdx) {
      ctx.save();
      ctx.strokeStyle = '#7c6bff';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 6]);
      roundRectPath(ctx, x - 2, y - 2, w + 4, h + 4, oR);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#7c6bff';
      const hs = HANDLE_SZ;
      [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([hx, hy]) => {
        ctx.beginPath();
        ctx.arc(hx, hy, hs / 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
  });
  fitDisplay();
}

function startCollageDrag(e) {
  const rect = els.canvas.getBoundingClientRect();
  const sx = els.canvas.width / rect.width;
  const sy = els.canvas.height / rect.height;
  const cx = (e.clientX - rect.left) * sx;
  const cy = (e.clientY - rect.top) * sy;

  // 检查缩放手柄
  const sel = state.collageLayers[state.selectedLayerIdx];
  if (sel) {
    const hs = HANDLE_SZ;
    const corners = [
      { n: 'nw', hx: sel.x, hy: sel.y },
      { n: 'ne', hx: sel.x + sel.w, hy: sel.y },
      { n: 'sw', hx: sel.x, hy: sel.y + sel.h },
      { n: 'se', hx: sel.x + sel.w, hy: sel.y + sel.h },
    ];
    for (const c of corners) {
      if (Math.hypot(cx - c.hx, cy - c.hy) < hs) {
        state.layerDragMode = 'resize-' + c.n;
        state.isDragging = true;
        state.drag = { x: e.clientX, y: e.clientY, ox: sel.x, oy: sel.y, ow: sel.w, oh: sel.h };
        els.canvas.style.cursor = 'nwse-resize';
        return;
      }
    }
  }

  // 点选图层
  const sorted = [...state.collageLayers].map((l, i) => ({ ...l, idx: i })).sort((a, b) => b.zIndex - a.zIndex);
  for (const layer of sorted) {
    if (cx >= layer.x && cx <= layer.x + layer.w && cy >= layer.y && cy <= layer.y + layer.h) {
      state.selectedLayerIdx = layer.idx;
      state.layerDragMode = 'move';
      state.isDragging = true;
      const s = state.collageLayers[layer.idx];
      state.drag = { x: e.clientX, y: e.clientY, ox: s.x, oy: s.y };
      els.canvas.style.cursor = 'grabbing';
      syncLayerUI();
      scheduleRender();
      return;
    }
  }
  state.selectedLayerIdx = -1;
  syncLayerUI();
  scheduleRender();
}

function doCollageDrag(e) {
  if (!state.isDragging || !state.layerDragMode) return;
  const layer = state.collageLayers[state.selectedLayerIdx];
  if (!layer) return;
  const rect = els.canvas.getBoundingClientRect();
  const sx = els.canvas.width / rect.width;
  const sy = els.canvas.height / rect.height;
  const dx = (e.clientX - state.drag.x) * sx;
  const dy = (e.clientY - state.drag.y) * sy;
  const MIN = 100;

  if (state.layerDragMode === 'move') {
    layer.x = state.drag.ox + dx;
    layer.y = state.drag.oy + dy;
  } else {
    const c = state.layerDragMode.split('-')[1];
    if (c === 'se') { layer.w = Math.max(MIN, state.drag.ow + dx); layer.h = Math.max(MIN, state.drag.oh + dy); }
    else if (c === 'sw') { const nw = Math.max(MIN, state.drag.ow - dx); layer.x = state.drag.ox + state.drag.ow - nw; layer.w = nw; layer.h = Math.max(MIN, state.drag.oh + dy); }
    else if (c === 'ne') { layer.w = Math.max(MIN, state.drag.ow + dx); const nh = Math.max(MIN, state.drag.oh - dy); layer.y = state.drag.oy + state.drag.oh - nh; layer.h = nh; }
    else if (c === 'nw') { const nw = Math.max(MIN, state.drag.ow - dx); const nh = Math.max(MIN, state.drag.oh - dy); layer.x = state.drag.ox + state.drag.ow - nw; layer.y = state.drag.oy + state.drag.oh - nh; layer.w = nw; layer.h = nh; }
  }
  scheduleRender();
}

function stopCollageDrag() {
  if (state.isDragging) {
    state.isDragging = false;
    state.layerDragMode = null;
    els.canvas.style.cursor = 'default';
  }
}

function downloadCollage() {
  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d');
  const origCtx = els.ctx, origCanvas = els.canvas;
  els.ctx = offCtx; els.canvas = offscreen;

  // 导出用原图
  const savedPreviews = state.collageLayers.map(l => {
    const s = l.previewImg;
    l.previewImg = l.img;
    return s;
  });
  const savedSel = state.selectedLayerIdx;
  state.selectedLayerIdx = -1;
  renderCollage();
  state.selectedLayerIdx = savedSel;

  const mime = state.exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = state.exportFormat === 'jpeg' ? state.exportQuality : 1.0;
  const ext = state.exportFormat === 'jpeg' ? '.jpg' : '.png';
  const link = document.createElement('a');
  link.download = 'framer_collage' + ext;
  link.href = offscreen.toDataURL(mime, quality);
  link.click();

  state.collageLayers.forEach((l, i) => { l.previewImg = savedPreviews[i]; });
  els.ctx = origCtx; els.canvas = origCanvas;
  scheduleRender();
}

// 启动

// 启动
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
