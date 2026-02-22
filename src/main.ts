// Version: 20260219-3 - 强制生成新 hash，彻底清除 CDN 缓存
import { bitable, workspace } from '@lark-base-open/js-sdk';
import * as echarts from 'echarts';
import '@lark-base-open/js-sdk/dist/style/dashboard.css';
import './style.css';

// 字段名称配置
const FIELD_NAMES = {
  demand: '需求趋势得分',
  competition: '竞争强度得分',
  profit: '利润空间得分',
  comprehensive: '综合得分',
  title: '商品标题',
  asin: 'ASIN',
  category: '初步产品分类',
  image: '商品主图',  // 新增商品主图字段
  medianDemand: 'median_需求趋势得分',
  medianCompetition: 'median_竞争强度得分'
};

// 颜色映射（修正：畅销红色，淘汰绿色，潜力黄色，稳健蓝色）
const colorMap: Record<string, string> = {
  '畅销爆品': 'rgba(214, 88, 98, 0.92)',   // 红色
  '淘汰产品': 'rgba(92, 186, 120, 0.92)',  // 绿色
  '潜力产品': 'rgba(255, 193, 7, 0.92)',   // 黄色
  '稳健产品': 'rgba(97, 131, 217, 0.92)',  // 蓝色
  '其他': 'rgba(180, 180, 180, 0.65)'
};

const categoryAlias: Record<string, string> = {
  '畅销爆品': '畅销爆品',
  '稳健产品': '稳健产品',
  '潜力产品': '潜力产品',
  '淘汰产品': '淘汰产品',
  '蓝海爆品': '畅销爆品',
  '潜力蓝海': '潜力产品',
  '观察产品': '稳健产品',
  'optLGIU4WF': '畅销爆品',
  'optlDdYN8t': '稳健产品',
  'optNYHmAtG': '潜力产品',
  'optLeC0N1j': '淘汰产品',
  'optkmQxjzD': '畅销爆品',
  'opt1Tp7Shs': '潜力产品',
  'optkVAQnil': '稳健产品',
  'optRGReDsp': '淘汰产品'
};

function getCategoryColor(categoryZh: string): string {
  return colorMap[categoryZh] || colorMap['其他'];
}

function median(values: number[]): number {
  const arr = values.filter(v => typeof v === 'number' && isFinite(v)).slice().sort((a, b) => a - b);
  if (arr.length === 0) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

let myChart: echarts.ECharts | null = null;
/** 上次渲染使用的中轴线，resize 重绘时复用，避免变成「基于当前 N 条计算」 */
let lastAxis: { midX: number; midY: number } | undefined;

// 计算响应式参数（根据画布大小）
function calculateResponsiveParams(chartDom: HTMLElement, dataLength: number) {
  const chartWidth = chartDom.offsetWidth || 800;
  const chartHeight = chartDom.offsetHeight || 600;
  const minDimension = Math.min(chartWidth, chartHeight);
  
  // 基础缩放因子（基于画布最小尺寸，以 600px 为基准）
  const baseScale = Math.max(0.6, Math.min(1.5, minDimension / 600));
  
  // 气泡大小计算（基于画布可用区域）
  // 先估算 grid 可用区域（用于计算气泡大小）
  const estimatedGridLeft = Math.max(60, Math.min(90, Math.round(70 * (chartWidth / 800))));
  const estimatedGridRight = Math.max(30, Math.min(60, Math.round(40 * (chartWidth / 800))));
  const estimatedGridTop = Math.max(50, Math.min(70, Math.round(60 * baseScale)));
  const estimatedGridBottom = Math.max(50, Math.min(80, Math.round(60 * baseScale)));
  
  const availableWidth = chartWidth - estimatedGridLeft - estimatedGridRight;
  const availableHeight = chartHeight - estimatedGridTop - estimatedGridBottom;
  const availableArea = availableWidth * availableHeight;
  
  // 根据可用区域和数据点数量计算基础气泡大小
  // 参考 test.html 的实现，使用固定大小（不依赖 scaleFactor）
  const avgBubbleArea = availableArea / Math.max(dataLength, 1);
  const baseBubbleRadius = Math.sqrt(avgBubbleArea) * 0.15; // 减小系数，让气泡更小
  // 计算 scaleFactor，但主要用于响应式调整，不直接用于气泡大小
  const densityFactor = Math.min(1.0, 500 / Math.max(dataLength, 1)); // 数据越多，气泡越小
  const sizeFactor = Math.min(1.2, Math.max(0.8, minDimension / 600)); // 画布越大，气泡稍微大一点
  const scaleFactor = Math.max(0.5, Math.min(1.2, (baseBubbleRadius / 10) * densityFactor * sizeFactor));
  
  console.log('📊 气泡大小计算:', {
    chartWidth,
    chartHeight,
    availableArea,
    dataLength,
    avgBubbleArea,
    baseBubbleRadius,
    scaleFactor,
    densityFactor,
    sizeFactor
  });
  
  // 响应式字体大小
  const titleFontSize = Math.max(14, Math.min(18, Math.round(16 * baseScale)));
  const axisLabelFontSize = Math.max(10, Math.min(13, Math.round(11 * baseScale)));
  const axisNameFontSize = Math.max(12, Math.min(15, Math.round(13 * baseScale)));
  const legendFontSize = Math.max(11, Math.min(14, Math.round(12 * baseScale)));
  const statFontSize = Math.max(10, Math.min(13, Math.round(11 * baseScale)));
  
  // 响应式间距（基于画布宽度，优化上方空间）
  const widthScale = chartWidth / 800;
  const gridLeft = Math.max(60, Math.min(90, Math.round(70 * widthScale)));
  const gridRight = Math.max(30, Math.min(60, Math.round(40 * widthScale)));
  const gridTop = Math.max(50, Math.min(70, Math.round(60 * baseScale))); // 减小上方空间
  const gridBottom = Math.max(50, Math.min(80, Math.round(60 * baseScale)));
  const legendTop = Math.max(40, Math.min(60, Math.round(45 * baseScale)));
  const legendRight = Math.max(15, Math.min(30, Math.round(20 * widthScale)));
  const statLeft = Math.max(15, Math.min(30, Math.round(20 * widthScale)));
  const statTop = Math.max(45, Math.min(65, Math.round(50 * baseScale)));
  
  // 坐标轴标签间距
  const xAxisNameGap = Math.max(30, Math.min(45, Math.round(35 * baseScale)));
  const yAxisNameGap = Math.max(45, Math.min(60, Math.round(50 * baseScale)));
  
  return {
    chartWidth,
    chartHeight,
    scaleFactor,
    baseScale,
    titleFontSize,
    axisLabelFontSize,
    axisNameFontSize,
    legendFontSize,
    statFontSize,
    gridLeft,
    gridRight,
    gridTop,
    gridBottom,
    legendTop,
    legendRight,
    statLeft,
    statTop,
    xAxisNameGap,
    yAxisNameGap
  };
}

// 中轴线说明（与表内「初步产品分类」一致）：
// - 使用字段：需求趋势得分（X 轴）→ midX，竞争强度得分（Y 轴）→ midY。取二者在「参与排序的全量数据」上的中位数。
// - 计算量：对几百个数排序取中位数，耗时可忽略。筛选 50/100 只减少展示气泡数量，不改变中轴线。
/** 加载结果：data 为展示用数据，midX/midY 为基于全量数据的中位数（与表内分类依据一致） */
type LoadResult = { data: any[]; midX: number; midY: number };

// 渲染图表。axis 传入时用其 midX/midY 画中轴线（推荐，与表内分类一致）；不传则用当前 data 算（兼容）
function renderChart(data: any[], sizeFieldLabel: string = '利润空间得分', axis?: { midX: number; midY: number }) {
  const chartDom = document.getElementById('chart');
  if (!chartDom) return;
  
  if (myChart) myChart.dispose();
  myChart = echarts.init(chartDom);
  
  if (data.length === 0) {
    chartDom.innerHTML = '<div style="text-align: center; padding: 50px; color: #5e6c84;">暂无数据</div>';
    return;
  }

  const xs = data.map(d => d.x).filter(v => typeof v === 'number' && isFinite(v));
  const ys = data.map(d => d.y).filter(v => typeof v === 'number' && isFinite(v));
  const sizes = data.map(d => d.size).filter(v => typeof v === 'number' && isFinite(v));
  
  const sizeMin = Math.min(...sizes);
  const sizeMax = Math.max(...sizes);
  
  // 中轴线：优先用「全量数据」算好的 axis，与表内初步分类一致；未传则用 lastAxis（resize 复用）或当前 data 算
  if (axis) lastAxis = axis;
  const midX = axis ? axis.midX : (lastAxis ? lastAxis.midX : median(xs));
  const midY = axis ? axis.midY : (lastAxis ? lastAxis.midY : median(ys));
  
  const axisSource = axis ? '全量/指标基准表' : (lastAxis ? '复用上次' : '当前数据');
  console.log(`📊 中轴线：${axisSource} midX=${midX.toFixed(2)}, midY=${midY.toFixed(2)}，当前展示 ${data.length} 条`, {
    dataCount: data.length,
    midX,
    midY,
    xRange: xs.length ? `[${Math.min(...xs)}, ${Math.max(...xs)}]` : '-',
    yRange: ys.length ? `[${Math.min(...ys)}, ${Math.max(...ys)}]` : '-'
  });
  
  const roundDown = (n: number) => Math.floor(n / 10) * 10;
  const roundUp = (n: number) => Math.ceil(n / 10) * 10;
  
  let xMin = roundDown(Math.min(...xs));
  let xMax = roundUp(Math.max(...xs));
  let yMin = roundDown(Math.min(...ys));
  let yMax = roundUp(Math.max(...ys));
  
  // 防止 xMin===xMax 或 yMin===yMax 导致中轴线/四象限渲染异常（如筛选 50/100 时数据范围过窄）
  const eps = 1e-6;
  if (xMax - xMin < eps) { xMin = Math.min(xMin, midX) - 5; xMax = Math.max(xMax, midX) + 5; }
  if (yMax - yMin < eps) { yMin = Math.min(yMin, midY) - 5; yMax = Math.max(yMax, midY) + 5; }
  
  // 确保中轴线在可视范围内，避免 ECharts markLine/markArea 报错
  const safeMidX = Math.max(xMin + eps, Math.min(xMax - eps, midX));
  const safeMidY = Math.max(yMin + eps, Math.min(yMax - eps, midY));

  // 计算分位数（用于气泡大小和透明度计算）
  const sortedSizes = sizes.slice().sort((a, b) => a - b);
  const len = sortedSizes.length;
  const q10 = len ? sortedSizes[Math.floor(len * 0.10)] : sizeMin;
  const q20 = len ? sortedSizes[Math.floor(len * 0.20)] : sizeMin;
  const q30 = len ? sortedSizes[Math.floor(len * 0.30)] : sizeMin;
  const q40 = len ? sortedSizes[Math.floor(len * 0.40)] : sizeMin;
  const q60 = len ? sortedSizes[Math.floor(len * 0.60)] : sizeMin;
  const q80 = len ? sortedSizes[Math.floor(len * 0.80)] : sizeMin;
  const q90 = len ? sortedSizes[Math.floor(len * 0.90)] : sizeMax;

  // 分组统计
  const categoryMap: Record<string, any[]> = {};
  const categoryCounts: Record<string, number> = {
    '畅销爆品': 0,
    '稳健产品': 0,
    '潜力产品': 0,
    '淘汰产品': 0
  };

  // 分类以表字段「初步产品分类」为准（含别名映射）；仅当无分类或无法匹配时才按当前中轴线 midX/midY 推算
  // 筛选 50/100 只是减少气泡数量，不改变中轴线与象限定义，故不应用当前 N 条重新划分分类
  data.forEach(d => {
    let cat = (d.category || '').toString().trim();
    
    if (categoryAlias[cat]) {
      cat = categoryAlias[cat];
    } else if (cat) {
      let matched = false;
      for (const key in categoryAlias) {
        if (cat.includes(key) || key.includes(cat)) {
          cat = categoryAlias[key];
          matched = true;
          break;
        }
      }
      if (!matched) {
        const right = d.x >= midX;
        const top = d.y >= midY;
        if (right && top) cat = '畅销爆品';
        else if (!right && top) cat = '潜力产品';
        else if (right && !top) cat = '稳健产品';
        else cat = '淘汰产品';
      }
    } else {
      const right = d.x >= midX;
      const top = d.y >= midY;
      if (right && top) cat = '畅销爆品';
      else if (!right && top) cat = '潜力产品';
      else if (right && !top) cat = '稳健产品';
      else cat = '淘汰产品';
    }
    
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push([d.x, d.y, d.size, d.title, d.asin, cat, d.image || '']);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  // 计算响应式参数（必须在所有使用之前）
  const responsive = calculateResponsiveParams(chartDom, data.length);

  // 参考 index-DME9M7UI.js：按排名计算气泡大小和透明度
  const sortedBySize = data.slice().sort((a, b) => b.size - a.size);
  const sizeRankMap = new Map<string, number>();
  sortedBySize.forEach((item, index) => {
    const key = `${item.size}-${item.title}`;
    sizeRankMap.set(key, index + 1);
  });

  // 计算自适应缩放因子（参考 index-DME9M7UI.js）
  const xRange = xMax - xMin;
  const yRange = yMax - yMin;
  const dataCount = data.length;
  const minDimension = Math.min(xRange, yRange);
  const baseScale = Math.sqrt(dataCount) / 15;
  const scaleFactor = Math.min(2.5, Math.max(1, (minDimension / 40) / baseScale * 1.2));

  function getSymbolSize(sizeValue: number, title: string): number {
    if (!isFinite(sizeValue)) return 9 * scaleFactor;
    
    const key = `${sizeValue}-${title}`;
    const rank = sizeRankMap.get(key) || dataCount;
    const pct = rank / dataCount;
    
    // 参考 index-DME9M7UI.js：按排名分档
    let size: number;
    if (pct <= 0.10) {
      // Top 10%
      const t = rank / (dataCount * 0.1);
      size = (40 - t * 5) * scaleFactor;
    } else if (pct <= 0.20) {
      // Top 20%
      const t = (rank - dataCount * 0.1) / (dataCount * 0.1);
      size = (35 - t * 7) * scaleFactor;
    } else if (pct <= 0.30) {
      // Top 30%
      const t = (rank - dataCount * 0.2) / (dataCount * 0.1);
      size = (28 - t * 6) * scaleFactor;
    } else {
      // 其他
      const t = (rank - dataCount * 0.3) / (dataCount * 0.7);
      size = (22 - t * 12) * scaleFactor;
    }
    
    return Math.max(6, Math.min(40, size));
  }

  function getItemAlpha(sizeValue: number, title: string): number {
    if (!isFinite(sizeValue)) return 0.25;
    
    const key = `${sizeValue}-${title}`;
    const rank = sizeRankMap.get(key) || dataCount;
    const pct = rank / dataCount;
    
    // 参考 index-DME9M7UI.js：按排名分档，最深 0.70
    if (pct <= 0.10) {
      const t = rank / (dataCount * 0.1);
      return 0.90 - t * 0.05; // 0.90 -> 0.85
    } else if (pct <= 0.20) {
      const t = (rank - dataCount * 0.1) / (dataCount * 0.1);
      return 0.85 - t * 0.10; // 0.85 -> 0.75
    } else if (pct <= 0.30) {
      const t = (rank - dataCount * 0.2) / (dataCount * 0.1);
      return 0.75 - t * 0.10; // 0.75 -> 0.65
    } else {
      const t = (rank - dataCount * 0.3) / (dataCount * 0.7);
      return Math.max(0.25, 0.65 - t * 0.25); // 0.65 -> 0.25
    }
  }

  function withAlpha(rgba: string, alpha: number): string {
    // 支持多种颜色格式
    // 格式1: rgba(r, g, b, oldAlpha)
    let m = rgba.match(/rgba\((\s*\d+\s*,\s*\d+\s*,\s*\d+\s*),\s*[\d.]+\s*\)/);
    if (m) {
      return `rgba(${m[1]}, ${alpha})`;
    }
    // 格式2: rgb(r, g, b)
    m = rgba.match(/rgb\((\s*\d+\s*,\s*\d+\s*,\s*\d+\s*)\)/);
    if (m) {
      return `rgba(${m[1]}, ${alpha})`;
    }
    // 格式3: #rrggbb 或 #rgb
    m = rgba.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
    if (m) {
      const hex = m[1];
      let r: number, g: number, b: number;
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      }
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // 如果都不匹配，返回原色（添加默认透明度）
    console.warn('无法解析颜色格式:', rgba);
    return rgba;
  }

  const CATEGORY_ORDER = ['畅销爆品', '稳健产品', '潜力产品', '淘汰产品'];
  const series = CATEGORY_ORDER.filter(c => categoryMap[c] && categoryMap[c].length > 0).map(category => {
    // 获取分类的基础颜色（用于图例显示）
    const baseColor = getCategoryColor(category);
    
    return {
      name: category,
      type: 'scatter' as const,
      data: categoryMap[category].map((item: any) => {
        const [x, y, size, title] = item;
        const symbolSize = getSymbolSize(size, title);
        const alpha = getItemAlpha(size, title);
        return {
          value: item,
          symbolSize,
          itemStyle: {
            color: withAlpha(baseColor, alpha),
            borderColor: '#ffffff',
            borderWidth: 1.2
          }
        };
      })
    };
  });
  
  // 为图例设置正确的颜色（通过 CSS 或自定义渲染）
  // ECharts 会自动从 series 的第一个数据点获取颜色用于图例
  // 但由于我们使用函数形式的 color，需要确保第一个数据点的颜色正确

  const totalCount = data.length;
  const pct = (n: number) => totalCount ? `${((n * 100) / totalCount).toFixed(1)}%` : '0.0%';

  const option = {
    backgroundColor: '#ffffff',
    title: {
      text: '产品分类四象限（波士顿矩阵）',
      left: 'center',
      top: 15,
      textStyle: {
        fontSize: 18, // 放大主标题
        fontWeight: 600,
        color: '#172b4d'
      }
    },
    tooltip: {
      trigger: 'item',
      confine: true, // 确保 tooltip 显示在画布内，不溢出
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ddd',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 13 },
      formatter: (params: any) => {
        const v = params.value;
        const titleText = v[3] || '未知';
        const categoryZh = v[5] || '其他';
        const categoryColor = getCategoryColor(categoryZh);
        const imageUrl = v[6] || ''; // 商品主图URL（已通过 getCellAttachmentUrls 转为可访问链接）
        
        // 图片固定尺寸，与标题栏相对垂直居中：标题多行时图片居中，标题少时标题居中
        const imageHtml = imageUrl ? `
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <img src="${imageUrl}" alt="商品主图" style="width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid #dfe1e6; flex-shrink: 0;" onerror="this.style.display='none'">
            <div style="flex: 1; min-width: 0; display: flex; align-items: center;">
              <div style="font-weight: 600; color: #172b4d; white-space: normal; word-break: break-word; line-height: 1.4;">${titleText}</div>
            </div>
          </div>
        ` : `
          <div style="font-weight: 600; margin-bottom: 8px; color: #172b4d; white-space: normal; word-break: break-word; line-height: 1.4;">${titleText}</div>
        `;
        
        return `
          <div style="max-width: 320px; word-wrap: break-word; line-height: 1.8;">
            ${imageHtml}
            <div style="font-size: 12px; color: #5e6c84;">
              <div>ASIN: <span style="color: #172b4d; font-weight: 500;">${v[4] || 'N/A'}</span></div>
              <div>需求趋势得分: <span style="color: #0052cc; font-weight: 600;">${v[0].toFixed(2)}</span></div>
              <div>竞争强度得分: <span style="color: #36b37e; font-weight: 600;">${v[1].toFixed(2)}</span></div>
              <div>${sizeFieldLabel}: <span style="color: #ff991f; font-weight: 600;">${v[2].toFixed(2)}</span></div>
              <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #dfe1e6;">分类: <span style="color: ${categoryColor}; font-weight: 600;">${categoryZh}</span></div>
            </div>
          </div>
        `;
      }
    },
    legend: {
      data: CATEGORY_ORDER.filter(c => categoryMap[c] && categoryMap[c].length > 0).map(name => ({
        name,
        itemStyle: {
          color: getCategoryColor(name).replace(/0\.\d+\)$/, '0.85)')
        }
      })),
      top: 50,
      left: 'center',
      itemGap: 20,
      textStyle: { fontSize: 12, color: '#172b4d' }
    },
    grid: {
      left: 70,
      right: 60,
      top: 95,
      bottom: 60,
      containLabel: false // 参考 index-DME9M7UI.js
    },
    xAxis: {
      type: 'value',
      name: '需求趋势得分',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: { 
        fontSize: 14, 
        fontWeight: 500, 
        color: '#172b4d' 
      },
      min: xMin,
      max: xMax,
      interval: 10,
      splitLine: { 
        show: true, 
        lineStyle: { type: 'dashed', color: '#dfe1e6' } 
      },
      axisLine: { 
        lineStyle: { color: '#172b4d' }
      }
    },
    yAxis: {
      type: 'value',
      name: '竞争强度得分',
      nameLocation: 'middle',
      nameGap: 35,
      nameTextStyle: { 
        fontSize: 13, 
        fontWeight: 500, 
        color: '#172b4d' 
      },
      min: yMin,
      max: yMax,
      interval: 10,
      splitLine: { 
        show: true, 
        lineStyle: { type: 'dashed', color: '#dfe1e6' } 
      },
      axisLine: { 
        lineStyle: { color: '#172b4d' }
      }
    },
    series: [
      {
        name: '__areas__',
        type: 'scatter' as const,
        data: [],
        silent: true,
        tooltip: { show: false },
        z: 0,
        markArea: {
          silent: true,
          itemStyle: { opacity: 0.14 },
          data: [
            [
              { xAxis: xMin, yAxis: yMax, itemStyle: { color: 'rgba(255, 193, 7, 0.30)' } },
              { xAxis: safeMidX, yAxis: safeMidY }
            ],
            [
              { xAxis: safeMidX, yAxis: yMax, itemStyle: { color: 'rgba(214, 88, 98, 0.30)' } },
              { xAxis: xMax, yAxis: safeMidY }
            ],
            [
              { xAxis: xMin, yAxis: safeMidY, itemStyle: { color: 'rgba(92, 186, 120, 0.26)' } },
              { xAxis: safeMidX, yAxis: yMin }
            ],
            [
              { xAxis: safeMidX, yAxis: safeMidY, itemStyle: { color: 'rgba(97, 131, 217, 0.26)' } },
              { xAxis: xMax, yAxis: yMin }
            ]
          ]
        }
      },
      ...series,
      {
        name: '__median__',
        type: 'scatter' as const,
        data: [],
        silent: true,
        tooltip: { show: false },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          lineStyle: { color: '#666', type: 'dashed', width: 1.5, opacity: 0.7 },
          label: { show: false },
          data: [{ xAxis: safeMidX }, { yAxis: safeMidY }]
        },
        z: 999,
        zlevel: 10
      }
      // 中轴线：竖线 x=safeMidX，横线 y=safeMidY（由当前 data 的中位数计算）
    ],
    graphic: [
      // 参考 index-DME9M7UI.js：使用百分比定位四象限背景
      {
        type: 'rect',
        z: 0,
        left: '11%',
        top: '16%',
        shape: { width: '42%', height: '40%' },
        style: { fill: 'rgba(92, 186, 120, 0.08)' }
      },
      {
        type: 'rect',
        z: 0,
        left: '53%',
        top: '16%',
        shape: { width: '42%', height: '40%' },
        style: { fill: 'rgba(214, 88, 98, 0.10)' }
      },
      {
        type: 'rect',
        z: 0,
        left: '11%',
        top: '56%',
        shape: { width: '42%', height: '35%' },
        style: { fill: 'rgba(255, 193, 7, 0.08)' }
      },
      {
        type: 'rect',
        z: 0,
        left: '53%',
        top: '56%',
        shape: { width: '42%', height: '35%' },
        style: { fill: 'rgba(97, 131, 217, 0.08)' }
      },
      // 汇总标签放在偏左上角，竖排版
      {
        type: 'text',
        z: 100,
        left: 30, // 向右移动一些距离
        top: 10, // 偏左上角
        style: {
          text: `总产品：${totalCount}
畅销爆品：${categoryCounts['畅销爆品']}（${pct(categoryCounts['畅销爆品'])}）
稳健产品：${categoryCounts['稳健产品']}（${pct(categoryCounts['稳健产品'])}）
潜力产品：${categoryCounts['潜力产品']}（${pct(categoryCounts['潜力产品'])}）
淘汰产品：${categoryCounts['淘汰产品']}（${pct(categoryCounts['淘汰产品'])}）`,
          fontSize: 10,
          fill: '#5e6c84',
          lineHeight: 14 // 紧凑一点
        }
      }
    ]
  };

  myChart.setOption(option as any);
  
  // 添加坐标轴箭头（使用 graphic 组件，在图表渲染后动态计算位置）
  setTimeout(() => {
    if (!myChart || !chartDom) return;
    
    try {
      // 获取 grid 的位置信息
      const gridOption = option.grid || {};
      const gridLeft = typeof gridOption.left === 'number' ? gridOption.left : 40;
      const gridRight = typeof gridOption.right === 'number' ? gridOption.right : 40;
      const gridTop = typeof gridOption.top === 'number' ? gridOption.top : 70;
      const gridBottom = typeof gridOption.bottom === 'number' ? gridOption.bottom : 60;
      
      // 获取坐标轴的像素位置
      const xAxisEndPixel = myChart.convertToPixel({ xAxisIndex: 0 }, [xMax, 0]);
      const yAxisEndPixel = myChart.convertToPixel({ yAxisIndex: 0 }, [0, yMax]);
      const xAxisStartPixel = myChart.convertToPixel({ xAxisIndex: 0 }, [xMin, 0]);
      const yAxisStartPixel = myChart.convertToPixel({ yAxisIndex: 0 }, [0, yMin]);
      
      if (xAxisEndPixel && yAxisEndPixel && xAxisStartPixel && yAxisStartPixel) {
        // 计算箭头位置
        const chartWidth = chartDom.offsetWidth;
        const chartHeight = chartDom.offsetHeight;
        
        // X轴右端箭头（在X轴最大值位置，Y轴最小值位置）
        const xArrowX = xAxisEndPixel[0];
        const xArrowY = yAxisStartPixel[1];
        
        // Y轴上端箭头（在X轴最小值位置，Y轴最大值位置）
        const yArrowX = xAxisStartPixel[0];
        const yArrowY = yAxisEndPixel[1];
        
        // 添加箭头到 graphic
        const arrowGraphics = [
          // X轴右端箭头（向右）
          {
            type: 'polygon',
            shape: {
              points: [
                [xArrowX, xArrowY],
                [xArrowX - 8, xArrowY - 4],
                [xArrowX - 8, xArrowY + 4]
              ]
            },
            style: {
              fill: '#888',
              stroke: '#888',
              lineWidth: 1
            },
            z: 1000
          },
          // Y轴上端箭头（向上）
          {
            type: 'polygon',
            shape: {
              points: [
                [yArrowX, yArrowY],
                [yArrowX - 4, yArrowY + 8],
                [yArrowX + 4, yArrowY + 8]
              ]
            },
            style: {
              fill: '#888',
              stroke: '#888',
              lineWidth: 1
            },
            z: 1000
          }
        ];
        
        // 更新 option 添加箭头
        const currentOption = myChart.getOption() as any;
        const existingGraphics = currentOption.graphic || [];
        // 移除之前的箭头（如果有）
        const filteredGraphics = existingGraphics.filter((g: any) => g.type !== 'polygon' || g.z !== 1000);
        filteredGraphics.push(...arrowGraphics);
        myChart.setOption({ graphic: filteredGraphics }, false);
      }
    } catch (e) {
      console.warn('绘制坐标轴箭头失败:', e);
    }
  }, 200);
  
  // 修复图例颜色：通过 DOM 直接设置图例颜色（确保颜色正确）
  setTimeout(() => {
    const legendElements = chartDom.querySelectorAll('.echarts-legend');
    if (legendElements.length > 0) {
      const legend = legendElements[0] as HTMLElement;
      const items = legend.querySelectorAll('.echarts-legend-item');
      items.forEach((item: any) => {
        const text = item.textContent?.trim();
        if (text) {
          // 提取分类名称（去掉计数部分）
          const categoryName = text.split(' (')[0].trim();
          const color = getCategoryColor(categoryName);
          const icon = item.querySelector('.echarts-legend-icon') || item.querySelector('span[style*="background"]') || item.querySelector('span');
          if (icon) {
            (icon as HTMLElement).style.backgroundColor = color;
            (icon as HTMLElement).style.borderColor = color;
            (icon as HTMLElement).style.color = color;
          }
        }
      });
    }
  }, 200);
  
  // 性能优化：使用防抖和节流减少重渲染
  let rafId: number | null = null;
  let resizeTimer: number | null = null;
  let lastWidth = responsive.chartWidth;
  let lastHeight = responsive.chartHeight;
  let isResizing = false;
  
  // 监听窗口大小变化，自适应画布和所有组件
  const handleResize = () => {
    if (!myChart || !chartDom) return;
    
    const newWidth = chartDom.offsetWidth || 800;
    const newHeight = chartDom.offsetHeight || 600;
    
    // 如果尺寸没有变化，跳过
    if (newWidth === lastWidth && newHeight === lastHeight) return;
    
    // 先立即调整画布大小（ECharts 的 resize 很快，提供即时反馈）
    myChart.resize();
    
    // 使用防抖：只有在停止调整一段时间后才重新渲染
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    
    resizeTimer = window.setTimeout(() => {
      if (!myChart || !chartDom) return;
      
      const currentWidth = chartDom.offsetWidth || 800;
      const currentHeight = chartDom.offsetHeight || 600;
      
      // 实时渲染：任何尺寸变化都重新渲染
      if (currentWidth !== lastWidth || currentHeight !== lastHeight) {
        lastWidth = currentWidth;
        lastHeight = currentHeight;
        
        // 重新渲染整个图表以更新所有响应式参数（字体、间距、气泡大小等）
        // 使用 requestAnimationFrame 确保在下一帧渲染
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
          // resize 重绘时传入上次的 axis，保持中轴线与全量/指标基准表一致
          renderChart(data, sizeFieldLabel, lastAxis);
          rafId = null;
        });
      }
      
      resizeTimer = null;
    }, 300); // 300ms 防抖延迟
  };
  
  // 使用 ResizeObserver 监听画布大小变化（包括拖动调整）
  // ResizeObserver 会在每次尺寸变化时触发，包括拖动过程中的实时变化
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === chartDom) {
        isResizing = true;
        handleResize();
        // 标记拖动结束（延迟检测）
        setTimeout(() => {
          isResizing = false;
        }, 500);
      }
    }
  });
  resizeObserver.observe(chartDom);
  
  // 也监听 window resize（浏览器窗口大小变化）
  window.addEventListener('resize', handleResize);
  
  // 清理函数（如果需要）
  if (myChart) {
    (myChart as any).__resizeHandler = handleResize;
    (myChart as any).__resizeObserver = resizeObserver;
    (myChart as any).__rafId = rafId;
    (myChart as any).__resizeTimer = resizeTimer;
  }
}

// 数据提取辅助函数
function extractValue(val: any): any {
  if (Array.isArray(val) && val.length > 0) return val[0];
  if (val && typeof val === 'object' && 'text' in val) return val.text;
  return val;
}

function toNumber(val: any): number | undefined {
  const extracted = extractValue(val);
  if (typeof extracted === 'number') return extracted;
  if (typeof extracted === 'string') {
    const parsed = parseFloat(extracted);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function toText(val: any): string {
  const extracted = extractValue(val);
  if (typeof extracted === 'string') return extracted;
  if (typeof extracted === 'number') return String(extracted);
  if (extracted && typeof extracted === 'object' && 'text' in extracted) return extracted.text;
  return String(extracted || '');
}

/** 从指标基准表读取中轴线：median_需求趋势得分 → midX，median_竞争强度得分 → midY（公式字段，基于全量结果） */
async function getMedianAxisFromBenchmarkTable(bitableApp: any, benchmarkTableId: string): Promise<{ midX: number; midY: number } | null> {
  try {
    const benchTable = await bitableApp.base.getTableById(benchmarkTableId);
    const recordListResult: any = await benchTable.getRecordListByPage({ pageSize: 1 });
    const records = recordListResult?.records ? Array.from(recordListResult.records) : [];
    if (records.length === 0) {
      console.warn('⚠️ 指标基准表无记录');
      return null;
    }
    const record = records[0] as { getCellByField: (id: string) => Promise<{ getValue: () => Promise<unknown> }> };
    const fieldList = await benchTable.getFieldList();
    let midXId: string | null = null;
    let midYId: string | null = null;
    for (const f of fieldList) {
      const name = await f.getName();
      if (name === FIELD_NAMES.medianDemand) midXId = f.id;
      if (name === FIELD_NAMES.medianCompetition) midYId = f.id;
    }
    if (!midXId || !midYId) {
      console.warn('⚠️ 指标基准表缺少字段：median_需求趋势得分 或 median_竞争强度得分');
      return null;
    }
    const [cx, cy] = await Promise.all([
      record.getCellByField(midXId).then((c: any) => c.getValue().then((v: any) => toNumber(v))),
      record.getCellByField(midYId).then((c: any) => c.getValue().then((v: any) => toNumber(v)))
    ]);
    if (cx === undefined || cy === undefined || !isFinite(cx) || !isFinite(cy)) {
      console.warn('⚠️ 指标基准表中轴线数值无效');
      return null;
    }
    return { midX: cx, midY: cy };
  } catch (e: any) {
    console.warn('⚠️ 读取指标基准表中轴线失败:', e?.message || e);
    return null;
  }
}

// 动态查找包含所需字段的表
async function findTableByRequiredFields(): Promise<any> {
  const requiredFields = [
    FIELD_NAMES.demand,
    FIELD_NAMES.competition,
    FIELD_NAMES.profit,
    FIELD_NAMES.comprehensive
  ];

  const tableList = await bitable.base.getTableList();
  console.log(`🔍 共找到 ${tableList.length} 个数据表`);

  let candidateTables: Array<{ table: any; matchCount: number; name: string }> = [];

  for (const table of tableList) {
    const tableName = await table.getName();
    const fieldList = await table.getFieldList();
    const fieldNames = await Promise.all(fieldList.map((f: any) => f.getName()));

    let matchCount = 0;
    for (const reqField of requiredFields) {
      if (fieldNames.includes(reqField)) matchCount++;
    }

    if (matchCount > 0) {
      console.log(`✓ 表「${tableName}」匹配 ${matchCount}/${requiredFields.length} 个必需字段`);
      candidateTables.push({ table, matchCount, name: tableName });
    }
  }

  if (candidateTables.length === 0) {
    throw new Error(`未找到包含必需字段的数据表。请确保表中包含字段：${requiredFields.join('、')}`);
  }

  candidateTables.sort((a, b) => {
    if (a.name === '选品结果') return -1;
    if (b.name === '选品结果') return 1;
    return b.matchCount - a.matchCount;
  });

  const selectedTable = candidateTables[0];
  console.log(`✅ 选择表「${selectedTable.name}」（匹配度: ${selectedTable.matchCount}/${requiredFields.length}）`);
  return selectedTable.table;
}

// 筛选数据（按排序字段排序，取前N条）
function filterData(data: any[], sortFieldName: string, filterLimit: string | number): any[] {
  if (filterLimit === 'all' || filterLimit === 0) {
    return data;
  }
  
  const limit = typeof filterLimit === 'string' ? parseInt(filterLimit) : filterLimit;
  if (isNaN(limit) || limit <= 0) {
    return data;
  }
  
  // 根据排序字段排序（降序）
  const sorted = [...data].sort((a, b) => {
    let aValue = 0;
    let bValue = 0;
    
    if (sortFieldName === FIELD_NAMES.profit) {
      aValue = a.profit ?? a.size ?? 0;
      bValue = b.profit ?? b.size ?? 0;
    } else if (sortFieldName === FIELD_NAMES.comprehensive) {
      aValue = a.comprehensive ?? a.size ?? 0;
      bValue = b.comprehensive ?? b.size ?? 0;
    } else {
      // 默认使用 size
      aValue = a.size ?? 0;
      bValue = b.size ?? 0;
    }
    
    return bValue - aValue; // 降序
  });
  
  return sorted.slice(0, limit);
}

// 从二维数组解析散点图数据（getPreviewData/getData返回格式：IDataItem[][]）
function parseDataFrom2DArray(data2D: any[][], sizeFieldName: string): any[] {
  if (!data2D || data2D.length < 1) return [];
  
  // 第一行是字段名（可能是字符串或 IDataItem 格式）
  const headers = data2D[0];
  console.log('📋 表头数据:', headers);
  console.log('📋 表头数量:', headers?.length);
  
  const headerMap: Record<string, number> = {};
  headers.forEach((h: any, idx: number) => {
    // 处理 IDataItem 格式 {value, text} 或直接字符串
    const headerName = typeof h === 'string' ? h : (h?.text || h?.value || String(h));
    headerMap[headerName] = idx;
    console.log(`  [${idx}] ${headerName}`);
  });
  
  console.log('📋 字段映射:', headerMap);
  
  // 找到所需字段的索引
  const demandIdx = headerMap[FIELD_NAMES.demand];
  const competitionIdx = headerMap[FIELD_NAMES.competition];
  const sizeIdx = headerMap[sizeFieldName] ?? headerMap[FIELD_NAMES.profit];
  const profitIdx = headerMap[FIELD_NAMES.profit];
  const comprehensiveIdx = headerMap[FIELD_NAMES.comprehensive];
  const titleIdx = headerMap[FIELD_NAMES.title];
  const asinIdx = headerMap[FIELD_NAMES.asin];
  const categoryIdx = headerMap[FIELD_NAMES.category];
  const imageIdx = headerMap[FIELD_NAMES.image]; // 商品主图字段索引
  
  console.log('📋 字段索引:', {
    demand: demandIdx,
    competition: competitionIdx,
    size: sizeIdx,
    profit: profitIdx,
    comprehensive: comprehensiveIdx,
    title: titleIdx,
    asin: asinIdx,
    category: categoryIdx,
    image: imageIdx
  });
  
  if (demandIdx === undefined || competitionIdx === undefined || sizeIdx === undefined) {
    throw new Error(`缺少必需字段：需求趋势得分=${demandIdx}, 竞争强度得分=${competitionIdx}, ${sizeFieldName}=${sizeIdx}`);
  }
  
  // 从第二行开始是数据（每行是 IDataItem[]）
  const data: any[] = [];
  for (let i = 1; i < data2D.length; i++) {
    const row = data2D[i];
    // 处理 IDataItem 格式：{value, text} 或直接值
    const getValue = (item: any) => {
      if (item === null || item === undefined) return undefined;
      if (typeof item === 'object' && 'value' in item) return item.value;
      return item;
    };
    
    const x = toNumber(getValue(row[demandIdx]));
    const y = toNumber(getValue(row[competitionIdx]));
    const size = toNumber(getValue(row[sizeIdx]));
    
    if (x !== undefined && y !== undefined && size !== undefined) {
      // 处理商品主图：可能是URL字符串或附件数组
      let imageUrl = '';
      if (imageIdx !== undefined) {
        const imageValue = getValue(row[imageIdx]);
        if (Array.isArray(imageValue) && imageValue.length > 0) {
          // 如果是附件数组，取第一个附件的URL
          const firstAttachment = imageValue[0];
          imageUrl = firstAttachment?.url || firstAttachment?.token || '';
        } else if (typeof imageValue === 'string') {
          imageUrl = imageValue;
        }
      }
      
      data.push({
        x,
        y,
        size,
        profit: profitIdx !== undefined ? toNumber(getValue(row[profitIdx])) : undefined,
        comprehensive: comprehensiveIdx !== undefined ? toNumber(getValue(row[comprehensiveIdx])) : undefined,
        title: toText(getValue(row[titleIdx])) || '未知',
        asin: toText(getValue(row[asinIdx])) || 'N/A',
        category: toText(getValue(row[categoryIdx])) || '',
        image: imageUrl
      });
    }
  }
  
  return data;
}

// 获取默认 baseToken（从配置或第一个有权限的 base）
async function getDefaultBaseToken(dashboard: any): Promise<string> {
  try {
    // 尝试从配置中获取
    const config = await dashboard.getConfig();
    if (config?.dataConditions?.[0]?.baseToken) {
      return config.dataConditions[0].baseToken;
    }
  } catch (e) {
    // Create 状态下 getConfig 会报错，忽略
  }
  
  // 获取第一个有权限的 base
  const baseList = await workspace.getBaseList({});
  if (baseList.base_list && baseList.base_list.length > 0) {
    return baseList.base_list[0].token;
  }
  
  throw new Error('未找到可用的多维表格');
}

// 构建 dataConditions（符合 SDK 的 IDataCondition 格式，应用插件必须包含 baseToken）
async function buildDataConditions(dashboard: any, sizeFieldName: string): Promise<{ dataConditions: any[]; fieldIds: Record<string, string>; baseToken: string }> {
  // 获取 baseToken
  const baseToken = await getDefaultBaseToken(dashboard);
  
  // 通过 workspace 获取 bitable 实例
  const bitableApp = await workspace.getBitable(baseToken);
  if (!bitableApp) {
    throw new Error(`无法获取多维表格实例: ${baseToken}`);
  }
  
  // 动态查找表
  const table = await findTableByRequiredFieldsInBase(bitableApp.base);
  const tableId = table.id || '';
  const fieldList = await table.getFieldList();
  const fieldIds: Record<string, string> = {};
  
  // 获取字段ID
  for (const field of fieldList) {
    const name = await field.getName();
    if (Object.values(FIELD_NAMES).includes(name)) {
      fieldIds[name] = field.id;
    }
  }
  
  const requiredFieldIds = {
    demand: fieldIds[FIELD_NAMES.demand],
    competition: fieldIds[FIELD_NAMES.competition],
    size: fieldIds[sizeFieldName] || fieldIds[FIELD_NAMES.profit],
    title: fieldIds[FIELD_NAMES.title],
    asin: fieldIds[FIELD_NAMES.asin],
    category: fieldIds[FIELD_NAMES.category]
  };
  
  if (!requiredFieldIds.demand || !requiredFieldIds.competition || !requiredFieldIds.size) {
    throw new Error(`缺少必需字段：需求趋势得分=${requiredFieldIds.demand}, 竞争强度得分=${requiredFieldIds.competition}, ${sizeFieldName}=${requiredFieldIds.size}`);
  }
  
  // 构建 dataRange（指定要获取的字段，而不是 series）
  // 根据 SDK，dataRange 用于指定要查询的字段范围和条件
  // 对于散点图，我们需要获取所有记录的原始数据
  const dataConditions: any[] = [{
    baseToken: baseToken, // 应用插件必须传 baseToken
    tableId: tableId
    // 不传 series，因为 Lookup 字段不需要聚合
    // SDK 会返回所有字段的数据
  }];
  
  return { dataConditions, fieldIds, baseToken };
}

// 在指定 base 中查找表
async function findTableByRequiredFieldsInBase(base: any): Promise<any> {
  const requiredFields = [
    FIELD_NAMES.demand,
    FIELD_NAMES.competition,
    FIELD_NAMES.profit,
    FIELD_NAMES.comprehensive
  ];

  const tableList = await base.getTableList();
  console.log(`🔍 共找到 ${tableList.length} 个数据表`);

  let candidateTables: Array<{ table: any; matchCount: number; name: string }> = [];

  for (const table of tableList) {
    const tableName = await table.getName();
    const fieldList = await table.getFieldList();
    const fieldNames = await Promise.all(fieldList.map((f: any) => f.getName()));

    let matchCount = 0;
    for (const reqField of requiredFields) {
      if (fieldNames.includes(reqField)) matchCount++;
    }

    if (matchCount > 0) {
      console.log(`✓ 表「${tableName}」匹配 ${matchCount}/${requiredFields.length} 个必需字段`);
      candidateTables.push({ table, matchCount, name: tableName });
    }
  }

  if (candidateTables.length === 0) {
    throw new Error('未找到包含必需字段的数据表');
  }

  // 优先选择"选品结果"表
  const preferredTable = candidateTables.find(t => t.name === '选品结果');
  if (preferredTable) {
    console.log(`✅ 选择表「${preferredTable.name}」（匹配度: ${preferredTable.matchCount}/${requiredFields.length}）`);
    return preferredTable.table;
  }

  // 否则选择匹配度最高的表
  candidateTables.sort((a, b) => b.matchCount - a.matchCount);
  const selected = candidateTables[0];
  console.log(`✅ 选择表「${selected.name}」（匹配度: ${selected.matchCount}/${requiredFields.length}）`);
  return selected.table;
}

// Create/Config 状态：使用 dashboard.getPreviewData()
async function loadPreviewData(dashboard: any, sizeFieldName: string, sortFieldName?: string, filterLimit?: string | number, benchmarkTableId?: string): Promise<LoadResult> {
  console.log('🚀 Create/Config 状态：使用 dashboard.getPreviewData()');
  const startTime = Date.now();
  
  try {
    // 问题：getPreviewData 不传 series 时只返回计数，不返回实际数据
    // 解决方案：在 Create/Config 状态下，回退到使用 bitable.base API 直接获取数据
    console.log('⚠️ getPreviewData 无法返回原始数据，改用 bitable.base API');
    
    // 获取 baseToken
    const baseToken = await getDefaultBaseToken(dashboard);
    const bitableApp = await workspace.getBitable(baseToken);
    if (!bitableApp) {
      throw new Error(`无法获取多维表格实例: ${baseToken}`);
    }
    
    // 若配置了指标基准表，优先从该表读取中轴线（基于全量结果的公式字段）
    let axisFromBenchmark: { midX: number; midY: number } | null = null;
    if (benchmarkTableId && benchmarkTableId.trim()) {
      axisFromBenchmark = await getMedianAxisFromBenchmarkTable(bitableApp, benchmarkTableId.trim());
      if (axisFromBenchmark) {
        console.log(`📊 中轴线：来自指标基准表 median_需求趋势得分/median_竞争强度得分 midX=${axisFromBenchmark.midX.toFixed(2)}, midY=${axisFromBenchmark.midY.toFixed(2)}`);
      }
    }
    
    // 使用 bitable.base API 直接获取数据
    const table = await findTableByRequiredFieldsInBase(bitableApp.base);
    const fieldList = await table.getFieldList();
    const fieldIdsMap: Record<string, string> = {};
    
    // 获取字段ID
    for (const field of fieldList) {
      const name = await field.getName();
      if (Object.values(FIELD_NAMES).includes(name)) {
        fieldIdsMap[name] = field.id;
      }
    }
    
    const requiredFieldIds = {
      demand: fieldIdsMap[FIELD_NAMES.demand],
      competition: fieldIdsMap[FIELD_NAMES.competition],
      size: fieldIdsMap[sizeFieldName] || fieldIdsMap[FIELD_NAMES.profit],
      title: fieldIdsMap[FIELD_NAMES.title],
      asin: fieldIdsMap[FIELD_NAMES.asin],
      category: fieldIdsMap[FIELD_NAMES.category],
      profit: fieldIdsMap[FIELD_NAMES.profit],
      comprehensive: fieldIdsMap[FIELD_NAMES.comprehensive],
      image: fieldIdsMap[FIELD_NAMES.image]  // 商品主图字段
    };
    
    if (!requiredFieldIds.demand || !requiredFieldIds.competition || !requiredFieldIds.size) {
      throw new Error(`缺少必需字段：需求趋势得分=${requiredFieldIds.demand}, 竞争强度得分=${requiredFieldIds.competition}, ${sizeFieldName}=${requiredFieldIds.size}`);
    }
    
    // 性能优化：如果用户选择了筛选数量，需要获取足够的数据用于排序
    // 由于飞书SDK不支持直接排序，我们需要：
    // 1. 获取筛选数量的2-3倍记录（确保能覆盖到前N条）
    // 2. 解析所有数据
    // 3. 按排序字段排序
    // 4. 取前N条
    const needLimit = filterLimit && filterLimit !== 'all' && filterLimit !== 0;
    const limitNum = needLimit ? (typeof filterLimit === 'string' ? parseInt(filterLimit) : filterLimit) : undefined;
    const targetRecordCount = limitNum && !isNaN(limitNum) && limitNum > 0 ? limitNum : undefined;
    
    // 必须拉取足够多的记录再排序，否则「前100」只是「前100 of 前200」而非全表前100
    // 例如表共 500 条：至少拉 500 条，排序后取前 N；上限 2000 避免超大表超时
    const fetchRecordCount = targetRecordCount ? Math.min(2000, Math.max(500, targetRecordCount * 2)) : undefined;
    
    console.log('📋 开始获取记录列表...', {
      filterLimit,
      targetRecordCount,
      fetchRecordCount,
      needLimit,
      sortFieldName
    });
    
    const allRecords: any[] = [];
    let pageToken: number | undefined = undefined;
    let pageCount = 0;
    const pageSize = 200; // 每页最多200条
    
    do {
      pageCount++;
      const remainingNeeded = fetchRecordCount ? fetchRecordCount - allRecords.length : undefined;
      const currentPageSize = remainingNeeded && remainingNeeded > 0 ? Math.min(pageSize, remainingNeeded) : pageSize;
      
      console.log(`📋 获取第 ${pageCount} 页数据 (pageSize: ${currentPageSize}, pageToken: ${pageToken || '无'})`);
      
      const recordListResult: any = await table.getRecordListByPage({ 
        pageSize: currentPageSize,
        pageToken: pageToken
      });
      
      if (recordListResult.records) {
        const pageRecords = Array.from(recordListResult.records);
        allRecords.push(...pageRecords);
        console.log(`📋 第 ${pageCount} 页获取 ${pageRecords.length} 条记录，累计 ${allRecords.length} 条`);
      }
      
      // 如果已经获取到足够的记录，停止分页
      if (fetchRecordCount && allRecords.length >= fetchRecordCount) {
        console.log(`✅ 已获取到 ${fetchRecordCount} 条记录（用于排序筛选），停止分页`);
        break;
      }
      
      pageToken = recordListResult.hasMore ? (typeof recordListResult.pageToken === 'number' ? recordListResult.pageToken : parseInt(String(recordListResult.pageToken))) : undefined;
    } while (pageToken);
    
    console.log(`✅ 通过 bitable.base API 获取 ${allRecords.length} 条记录（共 ${pageCount} 页）`);
    
    if (allRecords.length === 0) {
      console.warn('⚠️ 未获取到任何记录，请检查表是否有数据');
      return { data: [], midX: 0, midY: 0 };
    }
    
    // 两阶段加载：阶段1 对「当前拉到的全部记录」算排序字段并排序，阶段2 只对最终前 N 条补全标题/主图等
    // 阶段1：只读取排序必需的字段（需求趋势得分、竞争强度得分、利润空间得分/综合得分）
    // 阶段2：排序后，只对最终显示的数据读取其他字段（标题、ASIN、分类、商品主图）
    // 🔥 VERSION: 20260219-4 - 强制生成新 hash
    console.log('🚀 [NEW v4] View loadViewData 两阶段加载策略启动 - 20260219-4');
    
    // 阶段1：根据配置读取必需字段（需求趋势得分、竞争强度得分、气泡大小字段、排序字段）
    // 优化：只读取实际需要的字段，避免重复读取
    console.log('📋 阶段1：根据配置读取必需字段...', {
      sizeFieldName,
      sortFieldName,
      filterLimit
    });
    
    // 确定需要读取的字段ID
    const fieldsToRead: string[] = [
      requiredFieldIds.demand!,      // 需求趋势得分（X轴，必需）
      requiredFieldIds.competition!, // 竞争强度得分（Y轴，必需）
      requiredFieldIds.size!         // 气泡大小字段（必需）
    ];
    
    // 如果排序字段和气泡大小字段不同，也需要读取排序字段
    let sortFieldId: string | null = null;
    if (sortFieldName && sortFieldName !== sizeFieldName) {
      if (sortFieldName === FIELD_NAMES.profit && requiredFieldIds.profit) {
        sortFieldId = requiredFieldIds.profit;
        fieldsToRead.push(requiredFieldIds.profit);
      } else if (sortFieldName === FIELD_NAMES.comprehensive && requiredFieldIds.comprehensive) {
        sortFieldId = requiredFieldIds.comprehensive;
        fieldsToRead.push(requiredFieldIds.comprehensive);
      }
    }
    
    console.log('📋 阶段1需要读取的字段:', {
      fieldsToRead: fieldsToRead.length,
      includesSortField: !!sortFieldId,
      sizeFieldId: requiredFieldIds.size,
      sortFieldId: sortFieldId
    });
    
    const sortData: Array<{ record: any; x?: number; y?: number; size?: number; sortValue?: number }> = [];
    const batchSize = 50; // 增大批量大小，配合并发处理
    const concurrentBatches = 5; // 同时处理5个批次，提升并发度
    let skippedCount = 0;
    
    // 创建所有批次
    const batches: Array<{ batch: any[]; batchNum: number }> = [];
    for (let i = 0; i < allRecords.length; i += batchSize) {
      batches.push({
        batch: allRecords.slice(i, i + batchSize),
        batchNum: Math.floor(i / batchSize) + 1
      });
    }
    const totalBatches = batches.length;
    
    console.log(`📋 共 ${totalBatches} 个批次，每批 ${batchSize} 条，并发处理 ${concurrentBatches} 个批次`);
    
    // 并发处理批次：使用并发控制，同时处理多个批次
    for (let i = 0; i < batches.length; i += concurrentBatches) {
      const concurrentBatchGroup = batches.slice(i, i + concurrentBatches);
      const batchGroupNum = Math.floor(i / concurrentBatches) + 1;
      const totalGroups = Math.ceil(batches.length / concurrentBatches);
      
      // 只在开始和结束时输出日志
      if (batchGroupNum === 1 || batchGroupNum === totalGroups) {
        console.log(`📋 并发处理批次组 ${batchGroupNum}/${totalGroups}（${concurrentBatchGroup.length} 个批次）...`);
      }
      
      // 并发处理当前批次组
      const batchGroupPromises = concurrentBatchGroup.map(async ({ batch, batchNum }) => {
        // 批次内：并行处理所有记录
        const recordPromises = batch.map(async (record: any) => {
        try {
            // 根据配置动态读取字段（并行获取所有字段的Cell）
            const cellPromises: Promise<any>[] = [
              record.getCellByField(requiredFieldIds.demand!),
              record.getCellByField(requiredFieldIds.competition!),
              record.getCellByField(requiredFieldIds.size!)
            ];
            
            // 如果需要排序字段且与气泡大小字段不同，也读取排序字段
            if (sortFieldId) {
              cellPromises.push(record.getCellByField(sortFieldId));
            }
            
            const cells = await Promise.all(cellPromises);
            
            // 并行获取所有字段的值
          const [
              x,
              y,
              size,
              sortValue
            ] = await Promise.all([
              cells[0].getValue().then((v: any) => toNumber(v)),
              cells[1].getValue().then((v: any) => toNumber(v)),
              cells[2].getValue().then((v: any) => toNumber(v)),
              sortFieldId ? cells[3].getValue().then((v: any) => toNumber(v)) : Promise.resolve(undefined)
            ]);
            
            if (x !== undefined && y !== undefined && size !== undefined) {
              return { record, x, y, size, sortValue };
            } else {
              return null;
            }
          } catch (e: any) {
            return null;
          }
        });
        
        // 等待批次内所有记录处理完成
        const batchResults = await Promise.all(recordPromises);
        const validResults = batchResults.filter(r => r !== null);
        skippedCount += batchResults.length - validResults.length;
        
        return validResults;
      });
      
      // 等待当前批次组的所有批次完成
      const batchGroupResults = await Promise.all(batchGroupPromises);
      // 合并结果
      for (const results of batchGroupResults) {
        sortData.push(...results);
      }
    }
    
    console.log(`✅ 阶段1完成: ${sortData.length} 条有效数据，跳过 ${skippedCount} 条无效记录`);
    
    // 中轴线：优先使用指标基准表公式字段（基于全量结果）；否则用当前 sortData 中位数
    let midX: number;
    let midY: number;
    if (axisFromBenchmark) {
      midX = axisFromBenchmark.midX;
      midY = axisFromBenchmark.midY;
    } else {
      const allXs = sortData.map((r: any) => r.x).filter((v: number) => typeof v === 'number' && isFinite(v));
      const allYs = sortData.map((r: any) => r.y).filter((v: number) => typeof v === 'number' && isFinite(v));
      midX = median(allXs);
      midY = median(allYs);
      console.log(`📊 中轴线（当前 ${sortData.length} 条计算）：midX=${midX.toFixed(2)}，midY=${midY.toFixed(2)}`);
    }
    
    // 先排序，取前N条
    let dataToLoad = sortData;
    if (sortFieldName && filterLimit && filterLimit !== 'all') {
      const filterLimitNum = typeof filterLimit === 'string' ? parseInt(filterLimit) : filterLimit;
      if (!isNaN(filterLimitNum) && filterLimitNum > 0) {
        console.log(`📋 按 ${sortFieldName} 排序，取前 ${filterLimitNum} 条...`);
        // 快速排序：使用 sortValue（如果存在）或 size（气泡大小字段）
        dataToLoad.sort((a: any, b: any) => {
          const aValue = a.sortValue !== undefined ? a.sortValue : a.size ?? 0;
          const bValue = b.sortValue !== undefined ? b.sortValue : b.size ?? 0;
          return bValue - aValue; // 降序
        });
        dataToLoad = dataToLoad.slice(0, filterLimitNum);
        console.log(`✅ 排序完成，保留前 ${dataToLoad.length} 条`);
      }
    }
    
    // 阶段2：只对最终显示的数据读取其他字段（并发处理）
    console.log('📋 阶段2：读取其他字段（标题、ASIN、分类、商品主图）...');
    const parsedData: any[] = [];
    const finalBatchSize = 25; // 批量大小，避免单批过多导致超时
    const concurrentBatchesPhase2 = 3; // 降低并发，减少 API 限流
    
    // 创建所有批次
    const finalBatches: Array<{ batch: any[]; batchNum: number }> = [];
    for (let i = 0; i < dataToLoad.length; i += finalBatchSize) {
      finalBatches.push({
        batch: dataToLoad.slice(i, i + finalBatchSize),
        batchNum: Math.floor(i / finalBatchSize) + 1
      });
    }
    const totalFinalBatches = finalBatches.length;
    
    // 并发处理批次
    for (let i = 0; i < finalBatches.length; i += concurrentBatchesPhase2) {
      const concurrentBatchGroup = finalBatches.slice(i, i + concurrentBatchesPhase2);
      const batchGroupNum = Math.floor(i / concurrentBatchesPhase2) + 1;
      const totalGroups = Math.ceil(finalBatches.length / concurrentBatchesPhase2);
      
      // 只在开始和结束时输出日志
      if (batchGroupNum === 1 || batchGroupNum === totalGroups) {
        console.log(`📋 并发处理批次组 ${batchGroupNum}/${totalGroups}（${concurrentBatchGroup.length} 个批次）...`);
      }
      
      // 并发处理当前批次组
      const batchGroupPromises = concurrentBatchGroup.map(async ({ batch, batchNum }) => {
        // 批次内：并行处理所有记录
        const recordPromises = batch.map(async (item: any) => {
          try {
            const { record, x, y, size, sortValue } = item;
            
            // 并行读取其他字段（标题、ASIN、分类、商品主图）
            const [
            titleCell,
            asinCell,
              categoryCell,
              imageCell
          ] = await Promise.all([
            requiredFieldIds.title ? record.getCellByField(requiredFieldIds.title) : Promise.resolve(null),
            requiredFieldIds.asin ? record.getCellByField(requiredFieldIds.asin) : Promise.resolve(null),
              requiredFieldIds.category ? record.getCellByField(requiredFieldIds.category) : Promise.resolve(null),
              requiredFieldIds.image ? record.getCellByField(requiredFieldIds.image) : Promise.resolve(null)
          ]);
          
          // 并行获取所有字段的值
          const [
            title,
            asin,
              category,
              imageValue
          ] = await Promise.all([
            titleCell ? titleCell.getValue().then((v: any) => toText(v)) : Promise.resolve('未知'),
            asinCell ? asinCell.getValue().then((v: any) => toText(v)) : Promise.resolve('N/A'),
              categoryCell ? categoryCell.getValue().then((v: any) => toText(v)) : Promise.resolve(''),
              imageCell ? imageCell.getValue() : Promise.resolve(null)
            ]);
            
            // 处理商品主图：飞书附件字段返回 token，需用 table.getCellAttachmentUrls 转为可访问 URL
            let imageUrl = '';
            if (imageValue) {
              if (Array.isArray(imageValue) && imageValue.length > 0) {
                const firstAttachment = imageValue[0];
                const url = firstAttachment?.url;
                const token = firstAttachment?.token;
                if (url && typeof url === 'string' && url.startsWith('http')) {
                  imageUrl = url;
                } else if (token && requiredFieldIds.image) {
                  try {
                    const urls = await table.getCellAttachmentUrls([token], requiredFieldIds.image, record.id);
                    imageUrl = urls?.[0] || '';
                  } catch (e: any) {
                    console.warn(`⚠️ 获取附件URL失败:`, e?.message);
                  }
                }
              } else if (typeof imageValue === 'string' && imageValue.startsWith('http')) {
                imageUrl = imageValue;
              }
            }
            
            return {
              x,
              y,
              size,
              profit: sortFieldName === FIELD_NAMES.profit ? sortValue : undefined,
              comprehensive: sortFieldName === FIELD_NAMES.comprehensive ? sortValue : undefined,
              title: title || '未知',
              asin: asin || 'N/A',
              category: category || '',
              image: imageUrl
            };
        } catch (e: any) {
          console.warn(`⚠️ 解析记录失败:`, e?.message);
          return null;
        }
      });
      
        // 等待批次内所有记录处理完成
        const batchResults = await Promise.all(recordPromises);
        return batchResults.filter(r => r !== null);
      });
      
      // 等待当前批次组的所有批次完成
      const batchGroupResults = await Promise.all(batchGroupPromises);
      // 合并结果
      for (const results of batchGroupResults) {
        parsedData.push(...results);
      }
    }
    
    console.log(`✅ 阶段2完成: ${parsedData.length} 条有效数据`);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ 预览数据加载完成: ${parsedData.length} 条有效数据，耗时 ${(elapsed / 1000).toFixed(1)}s`);
    
    return { data: parsedData, midX, midY };
  } catch (error: any) {
    console.error('预览数据加载失败:', error);
    throw error;
  }
}

// View 状态：使用 bitable.base API（getData 也只返回计数，和 getPreviewData 一样的问题）
async function loadViewData(dashboard: any, sizeFieldName: string, savedDataConditions: any[], sortFieldName?: string, filterLimit?: string | number): Promise<LoadResult> {
  console.log('🚀 View 状态：使用 bitable.base API');
  const startTime = Date.now();
  
  try {
    // View 状态：getData 也只返回计数，改用 bitable.base API
    console.log('⚠️ getData 无法返回原始数据，改用 bitable.base API');
    
    // 从配置中获取 baseToken、tableId、指标基准表 ID
    const config: any = await dashboard.getConfig();
    const baseToken = config?.dataConditions?.[0]?.baseToken || await getDefaultBaseToken(dashboard);
    const tableId = config?.dataConditions?.[0]?.tableId || config?.customConfig?.tableId;
    const benchmarkTableId = config?.customConfig?.benchmarkTableId;
    
    if (!tableId) {
      throw new Error('View 状态下需要保存的 tableId，请重新配置组件');
    }
    
    console.log(`📋 使用保存的配置: baseToken=${baseToken}, tableId=${tableId}, benchmarkTableId=${benchmarkTableId || '(未配置)'}`);
    
    const bitableApp = await workspace.getBitable(baseToken);
    if (!bitableApp) {
      throw new Error(`无法获取多维表格实例: ${baseToken}`);
    }
    
    // 若配置了指标基准表，优先从该表读取中轴线（基于全量结果的公式字段）
    let axisFromBenchmark: { midX: number; midY: number } | null = null;
    if (benchmarkTableId && String(benchmarkTableId).trim()) {
      axisFromBenchmark = await getMedianAxisFromBenchmarkTable(bitableApp, String(benchmarkTableId).trim());
      if (axisFromBenchmark) {
        console.log(`📊 中轴线：来自指标基准表 midX=${axisFromBenchmark.midX.toFixed(2)}, midY=${axisFromBenchmark.midY.toFixed(2)}`);
      }
    }
    
    const table = await bitableApp.base.getTableById(tableId);
    const fieldList = await table.getFieldList();
    const fieldIdsMap: Record<string, string> = {};
    
    // 获取字段ID
    for (const field of fieldList) {
      const name = await field.getName();
      if (Object.values(FIELD_NAMES).includes(name)) {
        fieldIdsMap[name] = field.id;
      }
    }
    
    const requiredFieldIds = {
      demand: fieldIdsMap[FIELD_NAMES.demand],
      competition: fieldIdsMap[FIELD_NAMES.competition],
      size: fieldIdsMap[sizeFieldName] || fieldIdsMap[FIELD_NAMES.profit],
      title: fieldIdsMap[FIELD_NAMES.title],
      asin: fieldIdsMap[FIELD_NAMES.asin],
      category: fieldIdsMap[FIELD_NAMES.category],
      profit: fieldIdsMap[FIELD_NAMES.profit],
      comprehensive: fieldIdsMap[FIELD_NAMES.comprehensive],
      image: fieldIdsMap[FIELD_NAMES.image]  // 商品主图字段
    };
    
    if (!requiredFieldIds.demand || !requiredFieldIds.competition || !requiredFieldIds.size) {
      throw new Error(`缺少必需字段：需求趋势得分=${requiredFieldIds.demand}, 竞争强度得分=${requiredFieldIds.competition}, ${sizeFieldName}=${requiredFieldIds.size}`);
    }
    
    // 性能优化：如果用户选择了筛选数量，需要获取足够的数据用于排序
    // 由于飞书SDK不支持直接排序，我们需要：
    // 1. 获取筛选数量的2-3倍记录（确保能覆盖到前N条）
    // 2. 解析所有数据
    // 3. 按排序字段排序
    // 4. 取前N条
    const needLimit = filterLimit && filterLimit !== 'all' && filterLimit !== 0;
    const limitNum = needLimit ? (typeof filterLimit === 'string' ? parseInt(filterLimit) : filterLimit) : undefined;
    const targetRecordCount = limitNum && !isNaN(limitNum) && limitNum > 0 ? limitNum : undefined;
    
    // 必须拉取足够多的记录再排序，否则「前100」只是「前100 of 前200」而非全表前100
    // 例如表共 500 条：至少拉 500 条，排序后取前 N；上限 2000 避免超大表超时
    const fetchRecordCount = targetRecordCount ? Math.min(2000, Math.max(500, targetRecordCount * 2)) : undefined;
    
    console.log('📋 开始获取记录列表...', {
      filterLimit,
      targetRecordCount,
      fetchRecordCount,
      needLimit,
      sortFieldName
    });
    
    const allRecords: any[] = [];
    let pageToken: number | undefined = undefined;
    let pageCount = 0;
    const pageSize = 200; // 每页最多200条
    
    do {
      pageCount++;
      const remainingNeeded = fetchRecordCount ? fetchRecordCount - allRecords.length : undefined;
      const currentPageSize = remainingNeeded && remainingNeeded > 0 ? Math.min(pageSize, remainingNeeded) : pageSize;
      
      console.log(`📋 获取第 ${pageCount} 页数据 (pageSize: ${currentPageSize})`);
      
      const recordListResult: any = await table.getRecordListByPage({ 
        pageSize: currentPageSize,
        pageToken: pageToken
      });
      
      if (recordListResult.records) {
        const pageRecords = Array.from(recordListResult.records);
        allRecords.push(...pageRecords);
        console.log(`📋 第 ${pageCount} 页获取 ${pageRecords.length} 条记录，累计 ${allRecords.length} 条`);
      }
      
      // 如果已经获取到足够的记录，停止分页（性能优化）
      if (fetchRecordCount && allRecords.length >= fetchRecordCount) {
        console.log(`✅ 已获取到 ${fetchRecordCount} 条记录（用于排序筛选），停止分页`);
        break;
      }
      
      pageToken = recordListResult.hasMore ? (typeof recordListResult.pageToken === 'number' ? recordListResult.pageToken : parseInt(String(recordListResult.pageToken))) : undefined;
    } while (pageToken);
    
    console.log(`✅ 通过 bitable.base API 获取 ${allRecords.length} 条记录（共 ${pageCount} 页）`);
    
    if (allRecords.length === 0) {
      console.warn('⚠️ 未获取到任何记录');
      return { data: [], midX: 0, midY: 0 };
    }
    
    // 性能优化：如果用户选择了筛选数量，先排序再处理
    let recordsToProcess = allRecords;
    if (sortFieldName && targetRecordCount) {
      // 先快速排序（只基于size字段，不需要获取所有字段值）
      console.log(`📋 先对 ${allRecords.length} 条记录进行排序（基于字段：${sortFieldName}）...`);
      // 注意：这里不能直接排序，因为需要先获取字段值
      // 所以保持原逻辑：先获取所有需要的字段，然后排序筛选
    }
    
    // 性能优化：两阶段加载策略（与 loadPreviewData 相同）
    console.log('🚀 [NEW] View loadViewData 两阶段加载策略启动');
    
    // 阶段1：根据配置读取必需字段（需求趋势得分、竞争强度得分、气泡大小字段、排序字段）
    console.log('📋 阶段1：根据配置读取必需字段...', {
      sizeFieldName,
      sortFieldName,
      filterLimit
    });
    
    // 确定需要读取的字段ID
    const fieldsToRead: string[] = [
      requiredFieldIds.demand!,      // 需求趋势得分（X轴，必需）
      requiredFieldIds.competition!, // 竞争强度得分（Y轴，必需）
      requiredFieldIds.size!         // 气泡大小字段（必需）
    ];
    
    // 如果排序字段和气泡大小字段不同，也需要读取排序字段
    let sortFieldId: string | null = null;
    if (sortFieldName && sortFieldName !== sizeFieldName) {
      if (sortFieldName === FIELD_NAMES.profit && requiredFieldIds.profit) {
        sortFieldId = requiredFieldIds.profit;
        fieldsToRead.push(requiredFieldIds.profit);
      } else if (sortFieldName === FIELD_NAMES.comprehensive && requiredFieldIds.comprehensive) {
        sortFieldId = requiredFieldIds.comprehensive;
        fieldsToRead.push(requiredFieldIds.comprehensive);
      }
    }
    
    console.log('📋 阶段1需要读取的字段:', {
      fieldsToRead: fieldsToRead.length,
      includesSortField: !!sortFieldId,
      sizeFieldId: requiredFieldIds.size,
      sortFieldId: sortFieldId
    });
    
    const sortData: Array<{ record: any; x?: number; y?: number; size?: number; sortValue?: number }> = [];
    const batchSize = 50; // 增大批量大小，配合并发处理
    const concurrentBatches = 5; // 同时处理5个批次，提升并发度
    let skippedCount = 0;
    
    // 创建所有批次
    const batches: Array<{ batch: any[]; batchNum: number }> = [];
    for (let i = 0; i < recordsToProcess.length; i += batchSize) {
      batches.push({
        batch: recordsToProcess.slice(i, i + batchSize),
        batchNum: Math.floor(i / batchSize) + 1
      });
    }
    const totalBatches = batches.length;
    
    console.log(`📋 共 ${totalBatches} 个批次，每批 ${batchSize} 条，并发处理 ${concurrentBatches} 个批次`);
    
    // 并发处理批次：使用并发控制，同时处理多个批次
    for (let i = 0; i < batches.length; i += concurrentBatches) {
      const concurrentBatchGroup = batches.slice(i, i + concurrentBatches);
      const batchGroupNum = Math.floor(i / concurrentBatches) + 1;
      const totalGroups = Math.ceil(batches.length / concurrentBatches);
      
      // 只在开始和结束时输出日志
      if (batchGroupNum === 1 || batchGroupNum === totalGroups) {
        console.log(`📋 并发处理批次组 ${batchGroupNum}/${totalGroups}（${concurrentBatchGroup.length} 个批次）...`);
      }
      
      // 并发处理当前批次组
      const batchGroupPromises = concurrentBatchGroup.map(async ({ batch, batchNum }) => {
        // 批次内：并行处理所有记录
        const recordPromises = batch.map(async (record: any) => {
        try {
            // 根据配置动态读取字段（并行获取所有字段的Cell）
            const cellPromises: Promise<any>[] = [
              record.getCellByField(requiredFieldIds.demand!),
              record.getCellByField(requiredFieldIds.competition!),
              record.getCellByField(requiredFieldIds.size!)
            ];
            
            // 如果需要排序字段且与气泡大小字段不同，也读取排序字段
            if (sortFieldId) {
              cellPromises.push(record.getCellByField(sortFieldId));
            }
            
            const cells = await Promise.all(cellPromises);
            
            // 并行获取所有字段的值
          const [
              x,
              y,
              size,
              sortValue
            ] = await Promise.all([
              cells[0].getValue().then((v: any) => toNumber(v)),
              cells[1].getValue().then((v: any) => toNumber(v)),
              cells[2].getValue().then((v: any) => toNumber(v)),
              sortFieldId ? cells[3].getValue().then((v: any) => toNumber(v)) : Promise.resolve(undefined)
            ]);
            
            if (x !== undefined && y !== undefined && size !== undefined) {
              return { record, x, y, size, sortValue };
            } else {
              return null;
            }
          } catch (e: any) {
            return null;
          }
        });
        
        // 等待批次内所有记录处理完成
        const batchResults = await Promise.all(recordPromises);
        const validResults = batchResults.filter(r => r !== null);
        skippedCount += batchResults.length - validResults.length;
        
        return validResults;
      });
      
      // 等待当前批次组的所有批次完成
      const batchGroupResults = await Promise.all(batchGroupPromises);
      // 合并结果
      for (const results of batchGroupResults) {
        sortData.push(...results);
      }
    }
    
    console.log(`✅ 阶段1完成: ${sortData.length} 条有效数据，跳过 ${skippedCount} 条无效记录`);
    
    // 中轴线：优先使用指标基准表公式字段（基于全量结果）；否则用当前 sortData 中位数
    let midX: number;
    let midY: number;
    if (axisFromBenchmark) {
      midX = axisFromBenchmark.midX;
      midY = axisFromBenchmark.midY;
    } else {
      const allXs = sortData.map((r: any) => r.x).filter((v: number) => typeof v === 'number' && isFinite(v));
      const allYs = sortData.map((r: any) => r.y).filter((v: number) => typeof v === 'number' && isFinite(v));
      midX = median(allXs);
      midY = median(allYs);
      console.log(`📊 中轴线（当前 ${sortData.length} 条计算）：midX=${midX.toFixed(2)}，midY=${midY.toFixed(2)}`);
    }
    
    // 先排序，取前N条
    let dataToLoad = sortData;
    if (sortFieldName && filterLimit && filterLimit !== 'all') {
      const filterLimitNum = typeof filterLimit === 'string' ? parseInt(filterLimit) : filterLimit;
      if (!isNaN(filterLimitNum) && filterLimitNum > 0) {
        console.log(`📋 按 ${sortFieldName} 排序，取前 ${filterLimitNum} 条...`);
        // 快速排序：使用 sortValue（如果存在）或 size（气泡大小字段）
        dataToLoad.sort((a: any, b: any) => {
          const aValue = a.sortValue !== undefined ? a.sortValue : a.size ?? 0;
          const bValue = b.sortValue !== undefined ? b.sortValue : b.size ?? 0;
          return bValue - aValue; // 降序
        });
        dataToLoad = dataToLoad.slice(0, filterLimitNum);
        console.log(`✅ 排序完成，保留前 ${dataToLoad.length} 条`);
      }
    }
    
    // 阶段2：只对最终显示的数据读取其他字段（并发处理）
    console.log('📋 阶段2：读取其他字段（标题、ASIN、分类、商品主图）...');
    const parsedData: any[] = [];
    const finalBatchSize = 25; // 批量大小，避免单批过多导致超时
    const concurrentBatchesPhase2 = 3; // 降低并发，减少 API 限流
    
    // 创建所有批次
    const finalBatches: Array<{ batch: any[]; batchNum: number }> = [];
    for (let i = 0; i < dataToLoad.length; i += finalBatchSize) {
      finalBatches.push({
        batch: dataToLoad.slice(i, i + finalBatchSize),
        batchNum: Math.floor(i / finalBatchSize) + 1
      });
    }
    const totalFinalBatches = finalBatches.length;
    
    // 并发处理批次
    for (let i = 0; i < finalBatches.length; i += concurrentBatchesPhase2) {
      const concurrentBatchGroup = finalBatches.slice(i, i + concurrentBatchesPhase2);
      const batchGroupNum = Math.floor(i / concurrentBatchesPhase2) + 1;
      const totalGroups = Math.ceil(finalBatches.length / concurrentBatchesPhase2);
      
      // 只在开始和结束时输出日志
      if (batchGroupNum === 1 || batchGroupNum === totalGroups) {
        console.log(`📋 并发处理批次组 ${batchGroupNum}/${totalGroups}（${concurrentBatchGroup.length} 个批次）...`);
      }
      
      // 并发处理当前批次组
      const batchGroupPromises = concurrentBatchGroup.map(async ({ batch, batchNum }) => {
        // 批次内：并行处理所有记录
        const recordPromises = batch.map(async (item: any) => {
          try {
            const { record, x, y, size, sortValue } = item;
            
            // 并行读取其他字段（标题、ASIN、分类、商品主图）
            const [
            titleCell,
            asinCell,
              categoryCell,
              imageCell
          ] = await Promise.all([
            requiredFieldIds.title ? record.getCellByField(requiredFieldIds.title) : Promise.resolve(null),
            requiredFieldIds.asin ? record.getCellByField(requiredFieldIds.asin) : Promise.resolve(null),
              requiredFieldIds.category ? record.getCellByField(requiredFieldIds.category) : Promise.resolve(null),
              requiredFieldIds.image ? record.getCellByField(requiredFieldIds.image) : Promise.resolve(null)
          ]);
          
            // 并行获取所有字段的值
          const [
            title,
            asin,
              category,
              imageValue
          ] = await Promise.all([
            titleCell ? titleCell.getValue().then((v: any) => toText(v)) : Promise.resolve('未知'),
            asinCell ? asinCell.getValue().then((v: any) => toText(v)) : Promise.resolve('N/A'),
              categoryCell ? categoryCell.getValue().then((v: any) => toText(v)) : Promise.resolve(''),
              imageCell ? imageCell.getValue() : Promise.resolve(null)
            ]);
            
            // 处理商品主图：飞书附件字段返回 token，需用 table.getCellAttachmentUrls 转为可访问 URL
            let imageUrl = '';
            if (imageValue) {
              if (Array.isArray(imageValue) && imageValue.length > 0) {
                const firstAttachment = imageValue[0];
                const url = firstAttachment?.url;
                const token = firstAttachment?.token;
                if (url && typeof url === 'string' && url.startsWith('http')) {
                  imageUrl = url;
                } else if (token && requiredFieldIds.image) {
                  try {
                    const urls = await table.getCellAttachmentUrls([token], requiredFieldIds.image, record.id);
                    imageUrl = urls?.[0] || '';
                  } catch (e: any) {
                    console.warn(`⚠️ 获取附件URL失败:`, e?.message);
                  }
                }
              } else if (typeof imageValue === 'string' && imageValue.startsWith('http')) {
                imageUrl = imageValue;
              }
            }
            
            return {
              x,
              y,
              size,
              profit: sortFieldName === FIELD_NAMES.profit ? sortValue : undefined,
              comprehensive: sortFieldName === FIELD_NAMES.comprehensive ? sortValue : undefined,
              title: title || '未知',
              asin: asin || 'N/A',
              category: category || '',
              image: imageUrl
            };
        } catch (e: any) {
          console.warn(`⚠️ 解析记录失败:`, e?.message);
          return null;
        }
      });
      
        // 等待批次内所有记录处理完成
        const batchResults = await Promise.all(recordPromises);
        return batchResults.filter(r => r !== null);
      });
      
      // 等待当前批次组的所有批次完成
      const batchGroupResults = await Promise.all(batchGroupPromises);
      // 合并结果
      for (const results of batchGroupResults) {
        parsedData.push(...results);
      }
    }
    
    console.log(`✅ 阶段2完成: ${parsedData.length} 条有效数据`);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ 数据加载完成: ${parsedData.length} 条有效数据，耗时 ${(elapsed / 1000).toFixed(1)}s`);
    
    return { data: parsedData, midX, midY };
  } catch (error: any) {
    console.error('数据加载失败:', error);
    throw error;
  }
}

// 主初始化函数
async function init() {
  const app = document.getElementById('app')!;

  try {
    console.log('✓ SDK 初始化中...');

    const dashboard = bitable.dashboard;
    if (!dashboard) {
      throw new Error('dashboard 对象不存在，请确认在应用插件环境中运行');
    }

    const state = dashboard.state;
    console.log('📊 当前状态:', state);

    // ===== Create/Config 状态：显示配置面板 + 预览 =====
    if (state === 'Create' || state === 'Config') {
      app.innerHTML = `
        <div class="container" style="display: flex; height: 100vh; padding: 0; gap: 0;">
          <div class="main-content" style="flex: 1; padding: 24px; overflow: auto;">
            <div id="status" style="padding: 12px; font-size: 13px; color: #5e6c84; margin-bottom: 16px;">正在加载预览...</div>
            <div id="chart" style="width: 100%; height: calc(100vh - 100px);"></div>
          </div>
          <div class="config-panel" style="width: 320px; background: #fafbfc; border-left: 1px solid #dfe1e6; padding: 24px; overflow-y: auto; display: flex; flex-direction: column;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">配置选项</h3>
            <div class="field-group" style="margin-bottom: 20px; font-size: 13px; color: #5e6c84;">
              <div style="font-weight: 600; margin-bottom: 8px; color: #172b4d;">气泡大小与排序字段</div>
              <label style="display: block; margin-top: 6px;">
                <input type="radio" name="sizeField" value="${FIELD_NAMES.profit}" checked> ${FIELD_NAMES.profit}
              </label>
              <label style="display: block; margin-top: 6px;">
                <input type="radio" name="sizeField" value="${FIELD_NAMES.comprehensive}"> ${FIELD_NAMES.comprehensive}
              </label>
            </div>
            <div class="field-group" style="margin-bottom: 20px; font-size: 13px; color: #5e6c84;">
              <div style="font-weight: 600; margin-bottom: 8px; color: #172b4d;">筛选数量</div>
              <label style="display: block; margin-top: 6px;">
                <input type="radio" name="filterLimit" value="all" checked> 全部
              </label>
              <label style="display: block; margin-top: 6px;">
                <input type="radio" name="filterLimit" value="100"> 前100
              </label>
              <label style="display: block; margin-top: 6px;">
                <input type="radio" name="filterLimit" value="50"> 前50
              </label>
              <label style="display: block; margin-top: 6px;">
                <input type="radio" name="filterLimit" value="20"> 前20
              </label>
            </div>
            <div class="field-group" style="margin-bottom: 20px; font-size: 13px; color: #5e6c84;">
              <div style="font-weight: 600; margin-bottom: 8px; color: #172b4d;">中轴线（指标基准表）</div>
              <div style="font-size: 12px; color: #6b778c; margin-bottom: 6px;">填写指标基准表 ID 时，中轴线使用该表中的 median_需求趋势得分、median_竞争强度得分（基于全量结果）；不填则按当前数据计算。</div>
              <input type="text" id="benchmark-table-id" placeholder="例如 tblBbKcT94Gr9SLY" style="width: 100%; padding: 8px 10px; border: 1px solid #dfe1e6; border-radius: 4px; font-size: 13px; box-sizing: border-box;">
            </div>
            <button id="save-btn" style="margin-top: auto; width: 100%; padding: 10px 24px; font-size: 14px; font-weight: 600; background: #0052cc; color: white; border: none; border-radius: 4px; cursor: pointer;">
              确定
            </button>
          </div>
        </div>
      `;

      const statusEl = document.getElementById('status')!;
      const chartEl = document.getElementById('chart')!;
      const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
      
      const getSelectedField = () => {
        const checked = document.querySelector('input[name="sizeField"]:checked') as HTMLInputElement | null;
        return checked?.value || FIELD_NAMES.profit;
      };
      
      const getSelectedFilterLimit = () => {
        const checked = document.querySelector('input[name="filterLimit"]:checked') as HTMLInputElement | null;
        return checked?.value || 'all';
      };
      
      const getSelectedBenchmarkTableId = () => {
        const el = document.getElementById('benchmark-table-id') as HTMLInputElement | null;
        return el?.value?.trim() || '';
      };
      
      // 从已保存配置恢复（Config 状态）
      try {
        const config: any = await dashboard.getConfig();
        if (config?.customConfig?.benchmarkTableId) {
          const el = document.getElementById('benchmark-table-id') as HTMLInputElement | null;
          if (el) el.value = String(config.customConfig.benchmarkTableId);
        }
      } catch (_) {}
      
      // 绑定"确定"按钮
      saveBtn.onclick = async () => {
        try {
          const sizeFieldName = getSelectedField();
          const sortFieldName = sizeFieldName; // 排序字段和气泡大小字段相同
          const filterLimit = getSelectedFilterLimit();
          
          saveBtn.disabled = true;
          saveBtn.textContent = '保存中...';
          statusEl.textContent = '正在保存配置...';
          statusEl.style.color = '#0065ff';
          
          // 构建 dataConditions（参考官方示例）
          const { fieldIds, baseToken } = await buildDataConditions(dashboard, sizeFieldName);
          
          // 获取 tableId
          const bitableApp = await workspace.getBitable(baseToken);
          if (!bitableApp) {
            throw new Error(`无法获取多维表格实例: ${baseToken}`);
          }
          const table = await findTableByRequiredFieldsInBase(bitableApp.base);
          const tableId = table.id || '';
          
          console.log('💾 保存配置: sizeFieldName =', sizeFieldName);
          console.log('💾 保存配置: sortFieldName =', sortFieldName);
          console.log('💾 保存配置: filterLimit =', filterLimit);
          console.log('💾 保存表ID:', tableId);
          console.log('💾 保存字段ID:', fieldIds);
          
          // 构建 dataConditions（只包含 tableId 和 baseToken，不传 groups）
          const dataConditions: any = {
            tableId: tableId,
            baseToken: baseToken
          };
          
          console.log('💾 保存dataConditions:', JSON.stringify(dataConditions, null, 2));
          
          const benchmarkTableId = getSelectedBenchmarkTableId() || undefined;
          // 保存dataConditions和customConfig（View状态下getData()会使用保存的dataConditions）
          await dashboard.saveConfig({
            dataConditions: [dataConditions], // SDK 需要数组格式
            customConfig: { sizeFieldName, sortFieldName, filterLimit, tableId, fieldIds, baseToken, benchmarkTableId }
          });
          
          statusEl.textContent = '✓ 配置已保存，组件将自动添加';
          statusEl.style.color = '#36b37e';
        } catch (e: any) {
          console.error('❌ 保存配置失败:', e);
          saveBtn.disabled = false;
          saveBtn.textContent = '确定';
          statusEl.textContent = `❌ 保存失败: ${e?.message || String(e)}`;
          statusEl.style.color = '#de350b';
          alert('保存配置失败: ' + (e?.message || String(e)));
        }
      };
      
      // 加载预览（应用插件：Create/Config 状态使用 dashboard.getPreviewData()）
      const loadPreview = async () => {
        try {
          statusEl.textContent = '正在加载预览数据...';
          statusEl.style.color = '#0065ff';
          
          const sizeField = getSelectedField();
          const sortField = sizeField; // 排序字段和气泡大小字段相同
          const filterLimit = getSelectedFilterLimit();
          
          const result = await loadPreviewData(dashboard, sizeField, sortField, filterLimit, getSelectedBenchmarkTableId() || undefined);
          const data = result.data;
          if (data.length === 0) {
            statusEl.textContent = '⚠️ 暂无数据';
            statusEl.style.color = '#ff991f';
            chartEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;">暂无数据</div>';
          } else {
            statusEl.textContent = `✓ 预览加载 ${data.length} 条数据`;
            statusEl.style.color = '#36b37e';
            renderChart(data, sizeField, { midX: result.midX, midY: result.midY });
            // 图表渲染完成后，延迟隐藏状态消息
            setTimeout(() => {
              statusEl.style.display = 'none';
            }, 500);
          }
        } catch (e: any) {
          console.warn('⚠️ 预览加载失败:', e);
          statusEl.textContent = '⚠️ 预览加载失败: ' + (e?.message || String(e));
          statusEl.style.color = '#de350b';
          chartEl.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#888;text-align:center;padding:20px;">
              <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
              <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">波士顿矩阵散点图</div>
              <div style="font-size: 13px; color: #aaa; margin-bottom: 16px;">预览加载失败: ${e?.message || String(e)}</div>
            </div>
          `;
        }
      };
      
      // 初始加载预览
      await loadPreview();
      
      // 字段或基准表切换时重新加载预览
      document.querySelectorAll('input[name="sizeField"], input[name="filterLimit"]').forEach((el) => {
        el.addEventListener('change', () => loadPreview());
      });
      const benchmarkInput = document.getElementById('benchmark-table-id');
      if (benchmarkInput) benchmarkInput.addEventListener('blur', () => loadPreview());
      
      return;
    }
    
    // ===== View 状态：只显示图表 =====
    app.innerHTML = `
      <div class="container">
        <div id="status" style="padding: 12px; font-size: 13px; color: #5e6c84;">正在加载数据...</div>
        <div id="chart" style="width: 100%; height: calc(100vh - 50px);"></div>
      </div>
    `;
    
    const statusEl = document.getElementById('status')!;
    let sizeFieldName = FIELD_NAMES.profit;
    let sortFieldName = FIELD_NAMES.profit;
    let filterLimit: string | number = 'all';
    let savedDataConditions: any[] | undefined = undefined;
    
    // 读取保存的配置
    try {
      const config: any = await dashboard.getConfig();
      console.log('📋 读取到的完整配置:', config);
      
      if (config?.customConfig?.sizeFieldName) {
        sizeFieldName = config.customConfig.sizeFieldName;
        console.log('✓ 读取配置: sizeFieldName =', sizeFieldName);
      }
      
      if (config?.customConfig?.sortFieldName) {
        sortFieldName = config.customConfig.sortFieldName;
        console.log('✓ 读取配置: sortFieldName =', sortFieldName);
      }
      
      if (config?.customConfig?.filterLimit) {
        filterLimit = config.customConfig.filterLimit;
        console.log('✓ 读取配置: filterLimit =', filterLimit);
      }
      
      // 读取保存的 dataConditions（优先从顶层读取）
      if (config?.dataConditions && Array.isArray(config.dataConditions) && config.dataConditions.length > 0) {
        savedDataConditions = config.dataConditions;
        console.log('✓ 从顶层读取: dataConditions =', savedDataConditions);
      } else if (config?.customConfig?.dataConditions && Array.isArray(config.customConfig.dataConditions) && config.customConfig.dataConditions.length > 0) {
        savedDataConditions = config.customConfig.dataConditions;
        console.log('✓ 从customConfig读取: dataConditions =', savedDataConditions);
      } else {
        console.warn('⚠️ 配置中没有找到dataConditions');
      }
    } catch (e: any) {
      console.warn('⚠️ 读取配置失败:', e?.message);
    }
    
    // View状态：使用 dashboard.getData()
    try {
      statusEl.textContent = '⏳ 正在加载数据...';
      statusEl.style.color = '#0065ff';
      
      const result = await loadViewData(dashboard, sizeFieldName, savedDataConditions || [], sortFieldName, filterLimit);
      const data = result.data;
      statusEl.textContent = `✓ 成功加载 ${data.length} 条数据`;
      statusEl.style.color = '#36b37e';
      renderChart(data, sizeFieldName, { midX: result.midX, midY: result.midY });
      // 图表渲染完成后，延迟隐藏状态消息
      setTimeout(() => {
        statusEl.style.display = 'none';
      }, 500);
    } catch (error: any) {
      console.error('View状态数据加载失败:', error);
      statusEl.textContent = `❌ 数据加载失败: ${error?.message || error}`;
      statusEl.style.color = '#de350b';
      app.innerHTML = `
        <div style="padding: 20px; text-align: center; font-family: sans-serif;">
          <h2 style="color: #de350b;">数据加载失败</h2>
          <p style="color: #5e6c84;">${error?.message || error}</p>
          <p style="font-size: 13px; color: #888;">请检查配置或重新添加组件。</p>
        </div>
      `;
    }
    
  } catch (error: any) {
    console.error('插件初始化失败:', error);
    app.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: sans-serif;">
        <h2 style="color: #de350b;">插件初始化失败</h2>
        <p style="color: #5e6c84;">${error?.message || error}</p>
        <p style="font-size: 13px; color: #888;">请确保字段名与模板一致后重试。</p>
      </div>
    `;
  }
}

// SDK 自动初始化，直接调用 init
init();
