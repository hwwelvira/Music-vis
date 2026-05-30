import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

const clusterColors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F'];
const clusterNames = ['聚类群 A', '聚类群 B', '聚类群 C', '聚类群 D', '聚类群 E'];
const acousticMetrics = [
  { key: 'danceability', name: '🕺 舞曲度' },
  { key: 'energy', name: '⚡ 能量感' },
  { key: 'acousticness', name: '🎻 原声感' },
  { key: 'valence', name: '🎭 愉悦度' },
  { key: 'liveness', name: '🎤 现场感' },
  { key: 'instrumentalness', name: '🎹 器乐度' },
  { key: 'speechiness', name: '🗣️ 词频度' }
];

// 前端超快速、极度稳定的 2D KMeans 聚类算法 (K=5)
function runKMeans(points, featX, featY, k = 5, maxIterations = 15) {
  // 1. 提取二维特征坐标，并附带原始数据的引用
  const data = points.map((p, idx) => ({
    x: p[featX] !== undefined ? p[featX] : 0.5,
    y: p[featY] !== undefined ? p[featY] : 0.5,
    original: p,
    index: idx
  }));

  // 2. 使用均匀分布的静态格点做初始质心以防止色彩剧烈抖动闪烁，获得完全稳定的确定性聚类
  let centroids = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.5, y: 0.5 },
    { x: 0.2, y: 0.8 },
    { x: 0.8, y: 0.8 }
  ];

  let assignments = new Array(data.length).fill(-1);
  let changed = true;
  let iter = 0;

  while (changed && iter < maxIterations) {
    changed = false;
    iter++;

    // Assign Step
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      let minDist = Infinity;
      let closestCentroid = 0;

      for (let c = 0; c < k; c++) {
        const dx = p.x - centroids[c].x;
        const dy = p.y - centroids[c].y;
        const dist = dx * dx + dy * dy; // 欧氏距离平方
        if (dist < minDist) {
          minDist = dist;
          closestCentroid = c;
        }
      }

      if (assignments[i] !== closestCentroid) {
        assignments[i] = closestCentroid;
        changed = true;
      }
    }

    // Update Step
    const sumX = new Array(k).fill(0);
    const sumY = new Array(k).fill(0);
    const counts = new Array(k).fill(0);

    for (let i = 0; i < data.length; i++) {
      const c = assignments[i];
      sumX[c] += data[i].x;
      sumY[c] += data[i].y;
      counts[c]++;
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c] = {
          x: sumX[c] / counts[c],
          y: sumY[c] / counts[c]
        };
      }
    }
  }

  // 3. 返回附带了实时聚类 ID (cluster) 的歌曲对象数组
  return data.map((p, idx) => ({
    ...p.original,
    cluster: assignments[idx],
    x: p.x,
    y: p.y
  }));
}

const InteractiveKMeansExplorer = ({ scatterData, sunburstData }) => {
  // 默认 X轴选择“舞曲度”，Y轴选择“原声感”进行实时重新聚类
  const [metricX, setMetricX] = useState('danceability');
  const [metricY, setMetricY] = useState('acousticness');

  // 1. 建立高鲁棒性“流派声学指纹查找字典”
  const genreFeatureMap = useMemo(() => {
    const map = {};
    if (!sunburstData) return map;
    
    sunburstData.forEach(parent => {
      if (parent.children) {
        parent.children.forEach(child => {
          if (child.name && child.features) {
            map[child.name.trim()] = child.features;
          }
        });
      }
      if (parent.name && parent.features) {
        const cleanName = parent.name.split('\n')[0].trim();
        map[cleanName] = parent.features;
      }
    });
    return map;
  }, [sunburstData]);

  // 2. 补齐歌曲的 7 维声学数据流 (结合单曲已有物理值与流派投影值，形成多维基座)
  const fullFeaturedSongs = useMemo(() => {
    if (!scatterData) return [];
    
    return scatterData.map((song, idx) => {
      const energy = song[0];
      const valence = song[1];
      const name = song[2];
      const artist = song[3];
      const genre = song[4] ? song[4].trim() : '';

      const genreFeatures = genreFeatureMap[genre] || {};
      
      return {
        name,
        artist,
        genre,
        danceability: genreFeatures.danceability !== undefined ? genreFeatures.danceability : 0.5,
        energy: energy, 
        acousticness: genreFeatures.acousticness !== undefined ? genreFeatures.acousticness : 0.3,
        valence: valence,
        liveness: genreFeatures.liveness !== undefined ? genreFeatures.liveness : 0.18,
        instrumentalness: genreFeatures.instrumentalness !== undefined ? genreFeatures.instrumentalness : 0.05,
        speechiness: genreFeatures.speechiness !== undefined ? genreFeatures.speechiness : 0.06,
        id: idx
      };
    });
  }, [scatterData, genreFeatureMap]);

  // 3. 运行实时 KMeans 聚类计算 (根据用户在下拉框选取的 X/Y 维度，毫秒级快速收敛)
  const kMeansCalculatedSongs = useMemo(() => {
    if (fullFeaturedSongs.length === 0) return [];
    return runKMeans(fullFeaturedSongs, metricX, metricY, 5);
  }, [fullFeaturedSongs, metricX, metricY]);

  const xLabel = useMemo(() => acousticMetrics.find(m => m.key === metricX)?.name || metricX, [metricX]);
  const yLabel = useMemo(() => acousticMetrics.find(m => m.key === metricY)?.name || metricY, [metricY]);

  // ==========================================
  // 🎛️ 左侧：实时聚类散点图配置
  // ==========================================
  const scatterOption = useMemo(() => {
    if (kMeansCalculatedSongs.length === 0) return {};

    const seriesData = kMeansCalculatedSongs.map(song => ({
      value: [song.x, song.y],
      name: song.name,
      artist: song.artist,
      genre: song.genre,
      cluster: song.cluster,
      itemStyle: {
        color: clusterColors[song.cluster % clusterColors.length]
      }
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        textStyle: { color: '#1E293B', fontSize: 12 },
        formatter: function (params) {
          const song = params.data;
          return `
            <div style="font-weight: 800; color: #1E293B; margin-bottom: 4px;">🎵 ${song.name}</div>
            <div style="color: #64748B; font-size: 11px;">歌手: ${song.artist} | 流派: ${song.genre}</div>
            <div style="margin-top: 6px; border-top: 1px solid #F1F5F9; padding-top: 4px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${params.color}; margin-right:6px;"></span>
              实时聚类: <span style="font-weight:700; color:${params.color};">${clusterNames[song.cluster]}</span>
            </div>
            <div style="font-size: 11px; color: #475569; margin-top: 4px; font-family: monospace;">
              ${xLabel}: <b>${song.value[0].toFixed(3)}</b><br/>
              ${yLabel}: <b>${song.value[1].toFixed(3)}</b>
            </div>
          `;
        }
      },
      grid: {
        left: '10%',
        right: '12%',
        top: '10%',
        bottom: '12%'
      },
      xAxis: {
        type: 'value',
        name: xLabel,
        nameTextStyle: { color: '#64748B', fontWeight: 'bold', fontSize: 11 },
        min: 0,
        max: 1.0,
        splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
        axisLabel: { color: '#64748B', fontSize: 10, fontWeight: 'bold' },
        axisLine: { lineStyle: { color: '#E2E8F0' } }
      },
      yAxis: {
        type: 'value',
        name: yLabel,
        nameTextStyle: { color: '#64748B', fontWeight: 'bold', fontSize: 11 },
        min: 0,
        max: 1.0,
        splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
        axisLabel: { color: '#64748B', fontSize: 10, fontWeight: 'bold' },
        axisLine: { lineStyle: { color: '#E2E8F0' } }
      },
      series: [
        {
          name: '实时二维KMeans聚类',
          type: 'scatter',
          symbolSize: 6,
          data: seriesData,
          itemStyle: {
            opacity: 0.8,
            borderColor: '#FFFFFF',
            borderWidth: 0.5
          }
        }
      ]
    };
  }, [kMeansCalculatedSongs, xLabel, yLabel]);

  // ==========================================
  // 🎛️ 右侧：高维平行坐标走廊配置
  // ==========================================
  const parallelOption = useMemo(() => {
    if (kMeansCalculatedSongs.length === 0) return {};

    // 同样对其进行科学抽样，确保渲染流畅无卡顿
    const maxLines = 220;
    const step = Math.max(1, Math.floor(kMeansCalculatedSongs.length / maxLines));
    const sampledSongs = kMeansCalculatedSongs.filter((_, i) => i % step === 0);

    const parallelData = sampledSongs.map(song => ({
      value: [
        song.danceability,
        song.energy,
        song.acousticness,
        song.valence,
        song.liveness,
        song.instrumentalness,
        song.speechiness
      ],
      lineStyle: {
        color: clusterColors[song.cluster % clusterColors.length],
        opacity: 0.18,
        width: 1.3
      },
      name: song.name,
      artist: song.artist,
      genre: song.genre,
      clusterName: clusterNames[song.cluster]
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        textStyle: { color: '#1E293B', fontSize: 12 },
        formatter: function (params) {
          const song = params.data;
          const vals = song.value;
          return `
            <div style="font-weight: 800; color: #1E293B; margin-bottom: 4px; border-bottom: 1px solid #F1F5F9; padding-bottom: 4px;">🎵 ${song.name}</div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">歌手: ${song.artist} | 流派: ${song.genre}</div>
            <div style="font-weight: bold; color: ${params.lineStyle.color}; margin-bottom: 8px;">实时聚类: ${song.clusterName}</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; font-family: monospace;">
              <tr><td style="color: #64748B; padding-right: 12px;">舞曲度:</td><td style="text-align: right; font-weight: 700;">${vals[0].toFixed(2)}</td></tr>
              <tr><td style="color: #64748B;">能量感:</td><td style="text-align: right; font-weight: 700;">${vals[1].toFixed(2)}</td></tr>
              <tr><td style="color: #64748B;">原声感:</td><td style="text-align: right; font-weight: 700;">${vals[2].toFixed(2)}</td></tr>
              <tr><td style="color: #64748B;">愉悦度:</td><td style="text-align: right; font-weight: 700;">${vals[3].toFixed(2)}</td></tr>
              <tr><td style="color: #64748B;">现场感:</td><td style="text-align: right; font-weight: 700;">${vals[4].toFixed(2)}</td></tr>
              <tr><td style="color: #64748B;">器乐度:</td><td style="text-align: right; font-weight: 700;">${vals[5].toFixed(2)}</td></tr>
              <tr><td style="color: #64748B;">言语度:</td><td style="text-align: right; font-weight: 700;">${vals[6].toFixed(2)}</td></tr>
            </table>
          `;
        }
      },
      parallelAxis: acousticMetrics.map((metric, idx) => ({
        dim: idx,
        name: metric.name,
        min: 0,
        max: 1.0,
        nameTextStyle: {
          color: '#475569',
          fontSize: 10,
          fontWeight: 'bold',
          padding: [0, 0, 6, 0]
        },
        axisLine: { lineStyle: { color: '#CBD5E1', width: 1.2 } },
        axisLabel: { color: '#64748B', fontSize: 9, fontFamily: 'monospace' },
        splitLine: { show: false }
      })),
      parallel: {
        left: '8%',
        right: '8%',
        bottom: '12%',
        top: '18%',
        parallelAxisDefault: {
          type: 'value',
          nameLocation: 'end',
          nameGap: 10
        }
      },
      series: [
        {
          name: '高维声学特征平行轴',
          type: 'parallel',
          data: parallelData
        }
      ]
    };
  }, [kMeansCalculatedSongs]);

  return (
    <div 
      className="card" 
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '620px',
        width: '100%',
        boxSizing: 'border-box',
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.75)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px 0 rgba(145, 158, 171, 0.08)',
        padding: '24px'
      }}
    >
      {/* 头部控制区域 */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(145, 158, 171, 0.12)',
          paddingBottom: '16px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '15px'
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1E293B', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🧬 自选特征 KMeans 实时聚类与多维关联透视</span>
            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
              ⚡ 前端实时机器学习
            </span>
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
            任意挑选 2 个物理声学维度进行即时 KMeans 划分，并在右侧一键检视其与 7 维度指标的相关线样流向！
          </p>
        </div>

        {/* 维度下拉框交互区 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 'bold' }}>横坐标 X 轴:</span>
            <select
              value={metricX}
              onChange={(e) => setMetricX(e.target.value)}
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(145,158,171,0.25)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#1E293B',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {acousticMetrics.map(m => (
                <option key={m.key} value={m.key} disabled={m.key === metricY}>{m.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 'bold' }}>纵坐标 Y 轴:</span>
            <select
              value={metricY}
              onChange={(e) => setMetricY(e.target.value)}
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(145,158,171,0.25)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#1E293B',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {acousticMetrics.map(m => (
                <option key={m.key} value={m.key} disabled={m.key === metricX}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 左右并排双图表显示区 */}
      <div 
        style={{
          display: 'flex',
          flexGrow: 1,
          width: '100%',
          minHeight: '380px',
          gap: '20px'
        }}
      >
        {/* 左半侧：二维散点聚类 */}
        <div 
          style={{
            flex: '1 1 50%',
            height: '100%',
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'absolute', top: '10px', left: '15px', zIndex: 10, fontSize: '11px', fontWeight: 'bold', color: '#94A3B8' }}>
            📊 2D 聚类散点投影 (K=5)
          </div>
          <ReactECharts
            option={scatterOption}
            style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
            notMerge={true}
            lazyUpdate={true}
          />
        </div>

        {/* 右半侧：平行坐标走廊 */}
        <div 
          style={{
            flex: '1 1 50%',
            height: '100%',
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'absolute', top: '10px', left: '15px', zIndex: 10, fontSize: '11px', fontWeight: 'bold', color: '#94A3B8' }}>
            🌌 7 轴高维声学特征平行走廊 (色彩实时映射聚类分类)
          </div>
          <ReactECharts
            option={parallelOption}
            style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
            notMerge={true}
            lazyUpdate={true}
          />
        </div>
      </div>
    </div>
  );
};

export default InteractiveKMeansExplorer;
