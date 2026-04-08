/**
 * Framer V5 - 高级照片边框编辑器
 * 功能：多图管理、高级边框预设、质感特效、撤销/重做、导出格式选择
 */

// ================================
// HSL / HEX 转换工具
// ================================
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h=0, s=0, l=(max+min)/2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    if (max===r) h = ((g-b)/d + (g<b?6:0))/6;
    else if (max===g) h = ((b-r)/d+2)/6;
    else h = ((r-g)/d+4)/6;
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
}
function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r,g,b;
  if (s === 0) { r=g=b=l; } else {
    const hue2rgb = (p,q,t) => { if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
    const q = l < 0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l - q;
    r = hue2rgb(p,q,h+1/3); g = hue2rgb(p,q,h); b = hue2rgb(p,q,h-1/3);
  }
  return '#' + [r,g,b].map(x => Math.round(x*255).toString(16).padStart(2,'0')).join('');
}


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
  pickingColor: false,
};

const MAX_HISTORY = 40;



// ================================
// 6种全新呈现预设（The Breathing Image 设计系统）
// ================================
const PRESET_CONFIGS = {
  'air':        { bg: '#ffffff', spacing: 18, grainOn: false },
  'soft-paper': { bg: '#f5f5f5', spacing: 14, grainOn: false },
  'float':      { bg: '#e0e0e0', spacing: 12, grainOn: false },
  'archive':    { bg: '#ffffff', spacing: 14, grainOn: false },
  'mist':       { bg: '#f5f5f5', spacing: 16, grainOn: false },
  'ink-space':  { bg: '#000000', spacing: 12, grainOn: false },
  'color-card': { bg: '#ffffff', spacing: 50, grainOn: false },
};

// 默认配置生成器
const createDefaultConfig = (preset = 'air') => {
  const pc = PRESET_CONFIGS[preset] || PRESET_CONFIGS['air'];
  return {
    frameType:    preset,
    frameWidth:   pc.spacing,
    frameColor:   pc.bg,
    gradientOn:   false,
    gradientColor2: '#e0e0e0',
    gradientAngle: 0,
    gradientType: 'linear',
    gradientColor3: '',
    aspectRatio:  'original',
    cornerRadius: 0,
    photoScale:   1.0,
    photoOffsetX: 0,
    photoOffsetY: 0,
    shadowOn:     false,
    shadowIntensity: 6,
    photoStrokeOn: false,
    photoStrokeWidth: 8,
    photoStrokeColor: 'rgba(0,0,0,0.5)',
    grainOn:      pc.grainOn,
    grainIntensity: 5,
    colorCardLayout: 'lr',
    colorCardText: '',
    colorCardFlip: false,
    dominantColor: null,
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
  colorSwatches: null, // 延迟获取，兼容分组色板
  customColor:  document.getElementById('customColor'),
  hexColorInput: document.getElementById('hexColorInput'),
  hexApplyBtn:   document.getElementById('hexApplyBtn'),
  hexPreview:    document.getElementById('hexPreview'),
  hexGradient2Input: document.getElementById('hexGradient2Input'),
  hexGradient2Apply: document.getElementById('hexGradient2Apply'),
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
  // 取色器
  btnEyedropper: document.getElementById('btnEyedropper'),
  // 取色器预览气泡
  pickerTooltip: document.getElementById('pickerTooltip'),
  pickerTooltipSwatch: document.getElementById('pickerTooltipSwatch'),
  pickerTooltipHex: document.getElementById('pickerTooltipHex'),
  // 色卡
  colorCardOptions: document.getElementById('colorCardOptions'),
  ccLayoutLR: document.getElementById('ccLayoutLR'),
  ccLayoutTB: document.getElementById('ccLayoutTB'),
  ccFlipBtn:  document.getElementById('ccFlipBtn'),
  colorCardText: document.getElementById('colorCardText'),
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
    const pc = PRESET_CONFIGS[type] || PRESET_CONFIGS['air'];
    updateActiveConfig({
      frameType: type,
      frameColor: pc.bg,
      frameWidth: pc.spacing,
    });
    // 色卡预设：自动提取主色
    if (type === 'color-card') {
      const item = getActiveItem();
      if (item) {
        const dc = extractDominantColor(item.img);
        updateActiveConfig({ dominantColor: dc, frameColor: dc });
      }
    }
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
  // 色板事件委托（兼容分组色板的所有 .color-swatch）
  document.addEventListener('click', (e) => {
    const sw = e.target.closest('.color-swatch');
    if (!sw || !sw.dataset.color) return;
    const updates = { frameColor: sw.dataset.color };
    const item = getActiveItem();
    if (item && item.config.frameType === 'color-card') updates.dominantColor = sw.dataset.color;
    updateActiveConfig(updates);
    els.customColor.value = sw.dataset.color;
    syncUI(); scheduleRender();
  });
  els.customColor.oninput = (e) => {
    const updates = { frameColor: e.target.value };
    const item = getActiveItem();
    if (item && item.config.frameType === 'color-card') updates.dominantColor = e.target.value;
    updateActiveConfig(updates);
    syncUI(); scheduleRender();
  };

  // HEX 色值输入 —— 主色
  const applyHexColor = () => {
    const v = els.hexColorInput.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    if (v.length === 6) {
      const hex = '#' + v;
      const updates = { frameColor: hex };
      const item = getActiveItem();
      if (item && item.config.frameType === 'color-card') updates.dominantColor = hex;
      updateActiveConfig(updates);
      els.customColor.value = hex;
      syncUI(); scheduleRender();
    }
  };
  els.hexColorInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
  });
  els.hexColorInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyHexColor(); });
  els.hexApplyBtn.onclick = applyHexColor;

  // HEX 色值输入 —— 渐变第二色（如果存在旧版HEX输入）
  if (els.hexGradient2Input) {
    const applyHexGradient2 = () => {
      const v = els.hexGradient2Input.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
      if (v.length === 6) {
        const hex = '#' + v;
        updateActiveConfig({ gradientColor2: hex });
        els.gradientColor2.value = hex;
        syncUI(); scheduleRender();
      }
    };
    els.hexGradient2Input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    });
    els.hexGradient2Input.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyHexGradient2(); });
    if (els.hexGradient2Apply) els.hexGradient2Apply.onclick = applyHexGradient2;
  }

  // 取色器
  els.btnEyedropper.onclick = () => {
    if (!getActiveItem()) return;
    state.pickingColor = !state.pickingColor;
    els.canvasWrap.classList.toggle('picking', state.pickingColor);
    els.btnEyedropper.classList.toggle('on', state.pickingColor);
    // 退出时隐藏预览气泡
    if (!state.pickingColor && els.pickerTooltip) {
      els.pickerTooltip.hidden = true;
    }
  };

  // 取色器：实时预览（mousemove 读取 canvas 像素）
  let pickerRafId = null;
  els.canvas.addEventListener('mousemove', (e) => {
    if (!state.pickingColor || !els.pickerTooltip) return;
    if (pickerRafId) return; // RAF 节流
    pickerRafId = requestAnimationFrame(() => {
      pickerRafId = null;
      const rect = els.canvas.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) * (els.canvas.width / rect.width));
      const y = Math.round((e.clientY - rect.top) * (els.canvas.height / rect.height));
      if (x < 0 || y < 0 || x >= els.canvas.width || y >= els.canvas.height) return;
      const pixel = els.ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      // 更新气泡
      els.pickerTooltip.hidden = false;
      els.pickerTooltipSwatch.style.background = hex;
      els.pickerTooltipHex.textContent = hex.toUpperCase();
      // 定位：光标右下方偏移
      els.pickerTooltip.style.left = (e.clientX + 16) + 'px';
      els.pickerTooltip.style.top = (e.clientY + 16) + 'px';
    });
  });
  // 鼠标离开画布时隐藏气泡
  els.canvas.addEventListener('mouseleave', () => {
    if (els.pickerTooltip) els.pickerTooltip.hidden = true;
  });

  // 取色器：点击确认
  els.canvas.addEventListener('click', (e) => {
    if (!state.pickingColor) return;
    const rect = els.canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (els.canvas.width / rect.width));
    const y = Math.round((e.clientY - rect.top) * (els.canvas.height / rect.height));
    const pixel = els.ctx.getImageData(x, y, 1, 1).data;
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    const updates = { frameColor: hex };
    const item = getActiveItem();
    if (item && item.config.frameType === 'color-card') updates.dominantColor = hex;
    updateActiveConfig(updates);
    // 退出取色模式
    state.pickingColor = false;
    els.canvasWrap.classList.remove('picking');
    els.btnEyedropper.classList.remove('on');
    if (els.pickerTooltip) els.pickerTooltip.hidden = true;
    syncUI(); scheduleRender();
  });

  // 色卡控件
  if (els.ccLayoutLR) {
    els.ccLayoutLR.onclick = () => {
      updateActiveConfig({ colorCardLayout: 'lr' });
      syncUI(); scheduleRender();
    };
  }
  if (els.ccLayoutTB) {
    els.ccLayoutTB.onclick = () => {
      updateActiveConfig({ colorCardLayout: 'tb' });
      syncUI(); scheduleRender();
    };
  }
  if (els.colorCardText) {
    els.colorCardText.oninput = (e) => {
      updateActiveConfig({ colorCardText: e.target.value });
      scheduleRender();
    };
  }
  if (els.ccFlipBtn) {
    els.ccFlipBtn.onclick = () => {
      const item = getActiveItem();
      if (item) updateActiveConfig({ colorCardFlip: !item.config.colorCardFlip });
      syncUI(); scheduleRender();
    };
  }

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
    syncUI(); scheduleRender();
  };

  // 色2 HSL 滑块
  const g2Hue = document.getElementById('grad2Hue');
  const g2Sat = document.getElementById('grad2Sat');
  const g2Lit = document.getElementById('grad2Lit');
  const updateGrad2FromHSL = () => {
    const hex = hslToHex(+g2Hue.value, +g2Sat.value, +g2Lit.value);
    updateActiveConfig({ gradientColor2: hex });
    syncUI(); scheduleRender();
  };
  if (g2Hue) g2Hue.oninput = updateGrad2FromHSL;
  if (g2Sat) g2Sat.oninput = updateGrad2FromHSL;
  if (g2Lit) g2Lit.oninput = updateGrad2FromHSL;

  const grad2HexIn = document.getElementById('grad2HexInput');
  if (grad2HexIn) {
    grad2HexIn.addEventListener('change', (e) => {
      let val = e.target.value.trim().replace(/^#/, '');
      if (/^[0-9A-Fa-f]{6}$/.test(val)) {
        updateActiveConfig({ gradientColor2: '#' + val });
        syncUI(); scheduleRender();
      } else {
        syncUI(); // revert to valid format
      }
    });
  }

  // 渐变方向九宫格
  const dirGrid = document.getElementById('gradientDirGrid');
  if (dirGrid) {
    dirGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.dir-btn');
      if (!btn) return;
      const angle = btn.dataset.angle;
      if (angle === 'radial') {
        updateActiveConfig({ gradientType: 'radial' });
      } else {
        updateActiveConfig({ gradientType: 'linear', gradientAngle: parseInt(angle) });
      }
      syncUI(); scheduleRender();
    });
  }

  // 第三色开关
  const c3Toggle = document.getElementById('gradColor3Toggle');
  const c3Wrap = document.getElementById('gradColor3Wrap');
  const c3Input = document.getElementById('gradientColor3');
  if (c3Toggle) {
    c3Toggle.onclick = () => {
      const item = getActiveItem();
      if (!item) return;
      const has3 = !!item.config.gradientColor3;
      updateActiveConfig({ gradientColor3: has3 ? '' : '#a0a0a0' });
      syncUI(); scheduleRender();
    };
  }
  if (c3Input) {
    c3Input.oninput = (e) => {
      updateActiveConfig({ gradientColor3: e.target.value });
      syncUI(); scheduleRender();
    };
  }
  // 色3 HSL 滑块
  const g3Hue = document.getElementById('grad3Hue');
  const g3Sat = document.getElementById('grad3Sat');
  const g3Lit = document.getElementById('grad3Lit');
  const updateGrad3FromHSL = () => {
    const hex = hslToHex(+g3Hue.value, +g3Sat.value, +g3Lit.value);
    updateActiveConfig({ gradientColor3: hex });
    syncUI(); scheduleRender();
  };
  if (g3Hue) g3Hue.oninput = updateGrad3FromHSL;
  if (g3Sat) g3Sat.oninput = updateGrad3FromHSL;
  if (g3Lit) g3Lit.oninput = updateGrad3FromHSL;

  const grad3HexIn = document.getElementById('grad3HexInput');
  if (grad3HexIn) {
    grad3HexIn.addEventListener('change', (e) => {
      let val = e.target.value.trim().replace(/^#/, '');
      if (/^[0-9A-Fa-f]{6}$/.test(val)) {
        updateActiveConfig({ gradientColor3: '#' + val });
        syncUI(); scheduleRender();
      } else {
        syncUI(); // revert to valid format
      }
    });
  }

  // 渐变预设
  const presetsEl = document.getElementById('gradientPresets');
  if (presetsEl) {
    presetsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.gradient-preset-btn');
      if (!btn) return;
      const updates = {
        gradientOn: true,
        frameColor: btn.dataset.c1,
        gradientColor2: btn.dataset.c2,
        gradientColor3: btn.dataset.c3 || '',
      };
      updateActiveConfig(updates);
      els.customColor.value = btn.dataset.c1;
      syncUI(); scheduleRender();
    });
  }

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
  if (els.hexColorInput) els.hexColorInput.value = cfg.frameColor.slice(1).toUpperCase();
  if (els.hexPreview) els.hexPreview.style.background = cfg.frameColor;
  document.querySelectorAll('.color-swatch').forEach(sw => sw.classList.toggle('active', sw.dataset.color === cfg.frameColor));
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
  // 色2 HSL 滑块同步
  const [h2,s2,l2] = hexToHsl(cfg.gradientColor2);
  const g2h = document.getElementById('grad2Hue');
  const g2s = document.getElementById('grad2Sat');
  const g2l = document.getElementById('grad2Lit');
  if (g2h) { g2h.value = h2; document.getElementById('grad2HueVal').textContent = h2 + '°'; }
  if (g2s) { g2s.value = s2; document.getElementById('grad2SatVal').textContent = s2 + '%'; }
  if (g2l) { g2l.value = l2; document.getElementById('grad2LitVal').textContent = l2 + '%'; }
  const g2hex = document.getElementById('grad2HexInput');
  if (g2hex && document.activeElement !== g2hex) g2hex.value = cfg.gradientColor2.slice(1).toUpperCase();
  // 方向九宫格高亮
  const dirBtns = document.querySelectorAll('.dir-btn');
  dirBtns.forEach(btn => {
    if (cfg.gradientType === 'radial') {
      btn.classList.toggle('active', btn.dataset.angle === 'radial');
    } else {
      btn.classList.toggle('active', btn.dataset.angle === String(cfg.gradientAngle));
    }
  });
  // 第三色同步
  const c3Toggle = document.getElementById('gradColor3Toggle');
  const c3Wrap = document.getElementById('gradColor3Wrap');
  const c3Input = document.getElementById('gradientColor3');
  if (c3Toggle) {
    const has3 = !!cfg.gradientColor3;
    c3Toggle.classList.toggle('on', has3);
    c3Toggle.textContent = has3 ? '− 移除' : '+ 色 3';
    if (c3Wrap) c3Wrap.hidden = !has3;
    if (has3 && c3Input) c3Input.value = cfg.gradientColor3;
    // 色3 HSL 滑块同步
    if (has3 && cfg.gradientColor3) {
      const [h3,s3,l3] = hexToHsl(cfg.gradientColor3);
      const g3h = document.getElementById('grad3Hue');
      const g3s = document.getElementById('grad3Sat');
      const g3l = document.getElementById('grad3Lit');
      if (g3h) { g3h.value = h3; document.getElementById('grad3HueVal').textContent = h3 + '°'; }
      if (g3s) { g3s.value = s3; document.getElementById('grad3SatVal').textContent = s3 + '%'; }
      if (g3l) { g3l.value = l3; document.getElementById('grad3LitVal').textContent = l3 + '%'; }
      const g3hex = document.getElementById('grad3HexInput');
      if (g3hex && document.activeElement !== g3hex) g3hex.value = cfg.gradientColor3.slice(1).toUpperCase();
    }
  }
  // 色 1 指示点
  const grad1Dot = document.getElementById('gradColor1Dot');
  const grad1Hex = document.getElementById('gradColor1Hex');
  if (grad1Dot) grad1Dot.style.background = cfg.frameColor;
  if (grad1Hex) grad1Hex.textContent = cfg.frameColor.toUpperCase();
  // 渐变预览条实时更新
  const previewBar = document.getElementById('gradientPreviewBar');
  if (previewBar && cfg.gradientOn) {
    const isRadial = cfg.gradientType === 'radial';
    const c3 = cfg.gradientColor3;
    if (isRadial) {
      previewBar.style.background = c3
        ? `radial-gradient(circle, ${cfg.frameColor}, ${cfg.gradientColor2}, ${c3})`
        : `radial-gradient(circle, ${cfg.frameColor}, ${cfg.gradientColor2})`;
    } else {
      previewBar.style.background = c3
        ? `linear-gradient(${cfg.gradientAngle}deg, ${cfg.frameColor}, ${cfg.gradientColor2}, ${c3})`
        : `linear-gradient(${cfg.gradientAngle}deg, ${cfg.frameColor}, ${cfg.gradientColor2})`;
    }
  }
  // 胶片颗粒
  els.grainToggle.textContent = cfg.grainOn ? '开启' : '关闭';
  els.grainToggle.classList.toggle('on', cfg.grainOn);
  els.grainSliderWrap.classList.toggle('disabled-slider', !cfg.grainOn);
  els.grainIntensity.value = cfg.grainIntensity;
  // 色卡面板
  const isCC = cfg.frameType === 'color-card';
  if (els.colorCardOptions) {
    els.colorCardOptions.hidden = !isCC;
    if (isCC) {
      els.ccLayoutLR.classList.toggle('active', cfg.colorCardLayout === 'lr');
      els.ccLayoutTB.classList.toggle('active', cfg.colorCardLayout === 'tb');
      if (els.ccFlipBtn) els.ccFlipBtn.classList.toggle('on', cfg.colorCardFlip);
      els.colorCardText.value = cfg.colorCardText || '';
    }
  }
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
  if (state.pickingColor) return;
  if (!state.items.length) return;
  const item = getActiveItem();
  if (item && item.config.frameType === 'color-card') return; // 色卡禁止拖拽
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
  const isCC = cfg.frameType === 'color-card';
  const drawnW = isCC ? photoW : photoW * cfg.photoScale;
  const drawnH = isCC ? photoH : photoH * cfg.photoScale;
  const drawX = isCC ? photoX : photoX + (photoW - drawnW) / 2 + cfg.photoOffsetX;
  const drawY = isCC ? photoY : photoY + (photoH - drawnH) / 2 + cfg.photoOffsetY;
  const pR = Math.min(drawnW, drawnH) / 2 * cfg.cornerRadius / 50;
  const minBorder = Math.min(bT, bR, bB, bL);

  // ---- 渐变填充辅助（支持角度/径向/三色） ----
  const getBgFill = () => {
    if (!cfg.gradientOn) return cfg.frameColor;
    const c1 = cfg.frameColor;
    const c2 = cfg.gradientColor2;
    const c3 = cfg.gradientColor3;
    let grad;
    if (cfg.gradientType === 'radial') {
      // 径向渐变：从中心向外
      const cx = canvasW / 2, cy = canvasH / 2;
      const maxR = Math.sqrt(canvasW * canvasW + canvasH * canvasH) / 2;
      grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    } else {
      // 线性渐变：按角度计算起终点
      const angle = (cfg.gradientAngle || 0) * Math.PI / 180;
      const cx = canvasW / 2, cy = canvasH / 2;
      const len = Math.sqrt(canvasW * canvasW + canvasH * canvasH) / 2;
      const x1 = cx - Math.cos(angle) * len;
      const y1 = cy - Math.sin(angle) * len;
      const x2 = cx + Math.cos(angle) * len;
      const y2 = cy + Math.sin(angle) * len;
      grad = ctx.createLinearGradient(x1, y1, x2, y2);
    }
    grad.addColorStop(0, c1);
    if (c3) {
      grad.addColorStop(0.5, c2);
      grad.addColorStop(1, c3);
    } else {
      grad.addColorStop(1, c2);
    }
    return grad;
  };

  // 辅助：解析 hex 颜色为 rgba
  const hexToRgba = (hex, a) => {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  // =========================================
  // 1. 背景层 — 空间呈现逻辑（The Breathing Image）
  // =========================================
  const ft = cfg.frameType;

  if (ft === 'air') {
    // 空气：暖白纸面 + 极淡纹理，无任何边框/阴影/内层
    ctx.fillStyle = getBgFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.015);

  } else if (ft === 'soft-paper') {
    // 柔纸：有纹理的纸面 + 浅白纸页承托
    ctx.fillStyle = getBgFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.04);
    // 浅白纸页层（比照片略大，仅靠色差分离，适配圆角）
    const paperPad = Math.max(8, Math.round(Math.min(drawnW, drawnH) * 0.04));
    const paperRadius = pR > 0 ? pR + paperPad : 0;
    ctx.save();
    ctx.shadowColor = 'rgba(45,52,50,0.04)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 4;
    // 纸页色 = 背景色稍亮（自适应，避免硬编码白色在深色背景下暴露）
    const _fc1 = cfg.frameColor;
    const _pr = Math.min(255, parseInt(_fc1.slice(1,3), 16) + 20);
    const _pg = Math.min(255, parseInt(_fc1.slice(3,5), 16) + 20);
    const _pb = Math.min(255, parseInt(_fc1.slice(5,7), 16) + 20);
    ctx.fillStyle = `rgb(${_pr},${_pg},${_pb})`;
    roundRectPath(ctx, drawX - paperPad, drawY - paperPad, drawnW + paperPad * 2, drawnH + paperPad * 2, paperRadius);
    ctx.fill();
    ctx.restore();
    applyGrain(ctx, drawX - paperPad, drawY - paperPad, drawnW + paperPad * 2, drawnH + paperPad * 2, 0.02);

  } else if (ft === 'float') {
    // 悬浮：中灰背景 + 大面积弥散投影，图片无包裹
    ctx.fillStyle = getBgFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    // 大面积弥散投影（适配圆角）
    ctx.save();
    const shadowOffY = Math.round(Math.min(drawnW, drawnH) * 0.03);
    ctx.shadowColor = 'rgba(45,52,50,0.07)';
    ctx.shadowBlur = Math.max(40, Math.round(Math.min(drawnW, drawnH) * 0.06));
    ctx.shadowOffsetY = shadowOffY;
    ctx.fillStyle = 'rgba(45,52,50,0.03)';
    roundRectPath(ctx, drawX, drawY, drawnW, drawnH, pR);
    ctx.fill();
    ctx.restore();

  } else if (ft === 'archive') {
    // 档案：纯净背景 + 偏上布局（0.7顶/1.7底），无额外装饰层
    ctx.fillStyle = getBgFill();
    ctx.fillRect(0, 0, canvasW, canvasH);

  } else if (ft === 'mist') {
    // 迷雾：背景 + 纹理，图片溶解效果在照片绘制后处理
    ctx.fillStyle = getBgFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.025);

  } else if (ft === 'ink-space') {
    // 墨空间：深色舞台（非纯黑） + 极微弱内发光
    ctx.fillStyle = getBgFill();
    ctx.fillRect(0, 0, canvasW, canvasH);
    applyGrain(ctx, 0, 0, canvasW, canvasH, 0.012);
    // 图片区域极微弱白色内发光（适配圆角）
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.04)';
    ctx.shadowBlur = Math.max(15, Math.round(Math.min(drawnW, drawnH) * 0.025));
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    const glowPad = 2;
    const glowRadius = pR > 0 ? pR + glowPad : 0;
    roundRectPath(ctx, drawX - glowPad, drawY - glowPad, drawnW + glowPad * 2, drawnH + glowPad * 2, glowRadius);
    ctx.fill();
    ctx.restore();
  } else if (ft === 'color-card') {
    // 色卡：主色填充（支持渐变） + 文字标注
    const dColor = cfg.dominantColor || cfg.frameColor;
    if (cfg.gradientOn) {
      const isLR = cfg.colorCardLayout === 'lr';
      const grad = isLR
        ? ctx.createLinearGradient(0, 0, canvasW, 0)
        : ctx.createLinearGradient(0, 0, 0, canvasH);
      grad.addColorStop(0, dColor);
      grad.addColorStop(1, cfg.gradientColor2);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = dColor;
    }
    ctx.fillRect(0, 0, canvasW, canvasH);
    // 色卡文字
    const label = cfg.colorCardText || getColorName(dColor);
    const isLR = cfg.colorCardLayout === 'lr';
    const flip = cfg.colorCardFlip;
    let textX, textY;
    if (isLR) {
      if (flip) {
        textX = drawX / 2;  // 色块在左
      } else {
        textX = drawX + drawnW + (canvasW - drawX - drawnW) / 2;  // 色块在右
      }
      textY = canvasH / 2;
    } else {
      textX = canvasW / 2;
      if (flip) {
        textY = drawY + drawnH + (canvasH - drawY - drawnH) / 2;  // 色块在底
      } else {
        textY = drawY / 2;  // 色块在顶
      }
    }
    // 文字颜色自适应
    const lum = (parseInt(dColor.slice(1,3),16)*0.299 + parseInt(dColor.slice(3,5),16)*0.587 + parseInt(dColor.slice(5,7),16)*0.114);
    ctx.fillStyle = lum > 140 ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.7)';
    const fontSize = Math.round(Math.min(canvasW, canvasH) * 0.032);
    ctx.font = `300 ${fontSize}px 'Manrope', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '0.08em';
    ctx.fillText(label, textX, textY);
  }

  // =========================================
  // 3. 边缘特效层（通用：溶解/光晕）
  // =========================================
  
  // 环境光晕 (Outer Glow) — 使用画布外偏移技术：载体绘制在远处，仅阴影扩散可见
  if (cfg.photoStrokeOn && cfg.photoStrokeColor === 'rgba(255,255,255,0.7)' && cfg.photoStrokeWidth > 0) {
    ctx.save();
    const dynamicBase = Math.max(canvasW, canvasH);
    const blurRadius = Math.round(dynamicBase * cfg.photoStrokeWidth / 200);
    const isDark = ['ink-space'].includes(ft);
    // 偏移量：将载体绘制在画布右侧远处
    const offsetX = canvasW + 10000;
    ctx.shadowColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = blurRadius;
    ctx.shadowOffsetX = -offsetX;  // 阴影向左偏移回正确位置
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = isDark ? '#ffffff' : '#000000';
    // 载体绘制在 drawX + offsetX（画布外），阴影出现在 drawX（画布内）
    roundRectPath(ctx, drawX + offsetX, drawY, drawnW, drawnH, pR);
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
  // 4b. 预设后处理（Mist 溶解 / Ink Space 暗化）
  // =========================================
  if (ft === 'mist') {
    // 边缘消融：四边渐变从背景色透明到完全不透明
    const fadeSize = Math.round(Math.min(drawnW, drawnH) * 0.25);
    const bgHex = cfg.frameColor || '#f2f4f2';
    const bgO = (a) => hexToRgba(bgHex, a);
    // 上
    const tG = ctx.createLinearGradient(drawX, drawY, drawX, drawY + fadeSize);
    tG.addColorStop(0, bgO(1)); tG.addColorStop(1, bgO(0));
    ctx.fillStyle = tG;
    ctx.fillRect(drawX, drawY, drawnW, fadeSize);
    // 下
    const bG2 = ctx.createLinearGradient(drawX, drawY + drawnH, drawX, drawY + drawnH - fadeSize);
    bG2.addColorStop(0, bgO(1)); bG2.addColorStop(1, bgO(0));
    ctx.fillStyle = bG2;
    ctx.fillRect(drawX, drawY + drawnH - fadeSize, drawnW, fadeSize);
    // 左
    const lG = ctx.createLinearGradient(drawX, drawY, drawX + fadeSize, drawY);
    lG.addColorStop(0, bgO(1)); lG.addColorStop(1, bgO(0));
    ctx.fillStyle = lG;
    ctx.fillRect(drawX, drawY, fadeSize, drawnH);
    // 右
    const rG = ctx.createLinearGradient(drawX + drawnW, drawY, drawX + drawnW - fadeSize, drawY);
    rG.addColorStop(0, bgO(1)); rG.addColorStop(1, bgO(0));
    ctx.fillStyle = rG;
    ctx.fillRect(drawX + drawnW - fadeSize, drawY, fadeSize, drawnH);
  }

  if (ft === 'ink-space') {
    // 轻微暗化照片（暗室柔光效果）
    ctx.save();
    roundRectPath(ctx, drawX, drawY, drawnW, drawnH, pR);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(drawX, drawY, drawnW, drawnH);
    ctx.restore();
  }

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

  // 每种呈现预设的留白比例 [上, 右, 下, 左]
  // 色卡预设：完全独立的分割布局
  if (cfg.frameType === 'color-card') {
    const ratio = Math.max(10, cfg.frameWidth) / 100;
    const photoW = img.width;
    const photoH = img.height;
    const flip = cfg.colorCardFlip;
    if (cfg.colorCardLayout === 'lr') {
      const totalW = Math.round(photoW / (1 - ratio));
      const colorW = totalW - photoW;
      if (flip) {
        return { canvasW: totalW, canvasH: photoH, photoX: colorW, photoY: 0, photoW, photoH, bT: 0, bB: 0, bL: colorW, bR: 0 };
      }
      return { canvasW: totalW, canvasH: photoH, photoX: 0, photoY: 0, photoW, photoH, bT: 0, bB: 0, bL: 0, bR: colorW };
    } else {
      const totalH = Math.round(photoH / (1 - ratio));
      const colorH = totalH - photoH;
      if (flip) {
        return { canvasW: photoW, canvasH: totalH, photoX: 0, photoY: 0, photoW, photoH, bT: 0, bB: colorH, bL: 0, bR: 0 };
      }
      return { canvasW: photoW, canvasH: totalH, photoX: 0, photoY: colorH, photoW, photoH, bT: colorH, bB: 0, bL: 0, bR: 0 };
    }
  }

  const ratios = {
    'air':        [1.0, 1.0, 1.0, 1.0],    // 均匀呼吸
    'soft-paper': [1.0, 1.0, 1.15, 1.0],   // 微底部加重
    'float':      [1.0, 1.0, 1.15, 1.0],   // 底部留空间给投影
    'archive':    [0.7, 1.0, 1.7, 1.0],    // 偏上布局，档案感
    'mist':       [1.0, 1.0, 1.0, 1.0],    // 均匀
    'ink-space':  [1.0, 1.0, 1.1, 1.0],    // 微底部加重
  };
  const r = ratios[cfg.frameType] || [1.0, 1.0, 1.0, 1.0];
  let bT = Math.round(base * r[0]);
  let bR = Math.round(base * r[1]);
  let bB = Math.round(base * r[2]);
  let bL = Math.round(base * r[3]);

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
  let dbT = Math.round(dynamicBase * r[0]);
  let dbR = Math.round(dynamicBase * r[1]);
  let dbB = Math.round(dynamicBase * r[2]);
  let dbL = Math.round(dynamicBase * r[3]);

  const innerW = Math.max(1, canvasW - dbL - dbR);
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
// 主色提取 & 颜色命名
// ================================
function extractDominantColor(img) {
  const size = 80;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0, size, size);
  const data = cx.getImageData(0, 0, size, size).data;
  const bins = {};
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const bright = (r + g + b) / 3;
    if (bright < 25 || bright > 235) continue;
    const key = `${Math.floor(r/16)},${Math.floor(g/16)},${Math.floor(b/16)}`;
    if (!bins[key]) bins[key] = { n: 0, r: 0, g: 0, b: 0 };
    bins[key].n++; bins[key].r += r; bins[key].g += g; bins[key].b += b;
  }
  let best = null, maxN = 0;
  for (const k in bins) { if (bins[k].n > maxN) { maxN = bins[k].n; best = bins[k]; } }
  if (!best) return '#9e9e9e';
  const rr = Math.round(best.r / best.n), gg = Math.round(best.g / best.n), bb = Math.round(best.b / best.n);
  return '#' + [rr, gg, bb].map(v => v.toString(16).padStart(2, '0')).join('');
}

function getColorName(hex) {
  if (!hex || hex.length < 7) return 'Color';
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), l = (max+min)/2, d = max - min;
  if (d < 0.08) {
    if (l > 0.85) return 'White'; if (l > 0.6) return 'Silver';
    if (l > 0.3) return 'Gray'; return 'Black';
  }
  let h = 0;
  if (max === r) h = ((g-b)/d)%6; else if (max === g) h = (b-r)/d+2; else h = (r-g)/d+4;
  h = Math.round(h * 60); if (h < 0) h += 360;
  if (d/max < 0.2) { return l > 0.5 ? 'Silver' : 'Gray'; }
  if (h < 15 || h >= 345) return 'Red'; if (h < 40) return 'Orange';
  if (h < 65) return 'Yellow'; if (h < 80) return 'Lime';
  if (h < 160) return 'Green'; if (h < 195) return 'Cyan';
  if (h < 250) return 'Blue'; if (h < 290) return 'Purple';
  if (h < 330) return 'Pink'; return 'Red';
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
    'air': '空气', 'soft-paper': '柔纸', 'float': '悬浮',
    'archive': '档案', 'mist': '迷雾', 'ink-space': '墨空间'
  };
  els.statusPreset.textContent = `风格: ${presetNames[item.config.frameType] || '--'}`;
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
    item.config.gradientAngle  = src.gradientAngle;
    item.config.gradientType   = src.gradientType;
    item.config.gradientColor3 = src.gradientColor3;
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
