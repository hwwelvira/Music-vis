import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

const clusterColors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F'];
const clusterNames = ['狂热释放', '轻松愉快', '伤感静谧', '阳光活力', '迷幻张力'];
const acousticMetrics = [
  { key: 'danceability', name: '🕺 舞曲度' },
  { key: 'energy', name: '⚡ 能量感' },
  { key: 'acousticness', name: '🎻 原声感' },
  { key: 'valence', name: '🎭 愉悦度' },
  { key: 'liveness', name: '🎤 现场感' },
  { key: 'instrumentalness', name: '🎹 器乐度' },
  { key: 'speechiness', name: '🗣️ 词频度' }
];

const AcousticClusterAssociation = ({ scatterData, sunburstData, brushedSongs = [] }) => {
  const [activeTab, setActiveTab] = useState('heatmap'); // 'heatmap' or 'parallel'

  // 1. 建立高鲁棒性“流派声学指纹查找字典”
  const genreFeatureMap = useMemo(() => {
    const map = {};
    if (!sunburstData) return map;
    
    sunburstData.forEach(parent => {
      // 录入子流派
      if (parent.children) {
        parent.children.forEach(child => {
          if (child.name && child.features) {
            map[child.name.trim()] = child.features;
          }
        });
      }
      // 兜底录入主流派自身
      if (parent.name && parent.features) {
        const cleanName = parent.name.split('\n')[0].trim();
        map[cleanName] = parent.features;
      }
    });
    return map;
  }, [sunburstData]);

  // 2. 补全歌曲的 7 维声学数据流 (利用流派均值做高维插值，并用单曲自身真实 energy 与 valence 修正)
  const fullFeaturedSongs = useMemo(() => {
    if (!scatterData) return [];
    
    // 如果有刷选数据，优先使用刷选的数据，无则用全局大盘数据
    const activeSource = brushedSongs.length > 0 ? brushedSongs : scatterData;

    return activeSource.map((song, idx) => {
      const energy = song[0];
      const valence = song[1];
      const name = song[2];
      const artist = song[3];
      const genre = song[4] ? song[4].trim() : '';
      const cluster = song[5];

      // 从字典补全其他物理维度
      const genreFeatures = genreFeatureMap[genre] || {};
      
      return {
        name,
        artist,
        genre,
        cluster,
        // 用单曲自身的真实值，缺省维度用其流派平均值充实补全
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
  }, [scatterData, brushedSongs, genreFeatureMap]);

  // ==========================================
  // 📈 方案三：情感聚类 - 声学指标相关性热力矩阵
  // ==========================================
  const heatmapOption = useMemo(() => {
    if (fullFeaturedSongs.length === 0) return {};

    // 初始化 5 (聚类) x 7 (指标) 的累加器
    const matrixSum = Array(5).fill(0).map(() => Array(7).fill(0));
    const matrixCount = Array(5).fill(0);

    fullFeaturedSongs.forEach(song => {
      const c = song.cluster;
      if (c >= 0 && c < 5) {
        matrixCount[c]++;
        acousticMetrics.forEach((metric, mIdx) => {
          matrixSum[c][mIdx] += song[metric.key];
        });
      }
    });

    // 计算均值格子数据 (ECharts Heatmap 格式: [x, y, value])
    const heatmapData = [];
    for (let c = 0; c < 5; c++) {
      const count = matrixCount[c] || 1;
      for (let m = 0; m < 7; m++) {
        const avg = matrixSum[c][m] / count;
        // ECharts 格式: [xIndex, yIndex, 均值值]
        heatmapData.push([m, c, parseFloat(avg.toFixed(3))]);
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        textStyle: { color: '#1E293B', fontSize: 12 },
        formatter: function (params) {
          const mName = acousticMetrics[params.data[0]].name;
          const cName = clusterNames[params.data[1]];
          const val = params.data[2];
          return `
            <div style="font-weight: 800; color: #1E293B; margin-bottom: 4px;">🎯 情感-指征穿透分析</div>
            <div style="color: #64748B;">情感聚类: <span style="font-weight: 700; color: ${clusterColors[params.data[1]]};">${cName}</span></div>
            <div style="color: #64748B;">声学指标: <span style="font-weight: 700; color: #3b82f6;">${mName}</span></div>
            <div style="margin-top: 6px; border-top: 1px solid #F1F5F9; padding-top: 4px; font-weight: 800; font-size: 14px; color: #0F172A;">
              特征均值: <span style="font-family: monospace; color: #10B981;">${val}</span>
            </div>
          `;
        }
      },
      grid: {
        top: '12%',
        bottom: '15%',
        left: '12%',
        right: '5%',
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: acousticMetrics.map(m => m.name),
        splitArea: { show: true },
        axisLabel: {
          color: '#64748B',
          fontSize: 11,
          fontWeight: 'bold',
          interval: 0
        },
        axisLine: { lineStyle: { color: '#E2E8F0' } }
      },
      yAxis: {
        type: 'category',
        data: clusterNames,
        splitArea: { show: true },
        axisLabel: {
          color: '#475569',
          fontSize: 11,
          fontWeight: 'bold',
          formatter: function (value, index) {
            return `{c${index}|${value}}`;
          },
          rich: clusterNames.reduce((acc, name, idx) => {
            acc[`c${idx}`] = {
              color: clusterColors[idx],
              fontWeight: 'bold',
              fontSize: 11
            };
            return acc;
          }, {})
        },
        axisLine: { lineStyle: { color: '#E2E8F0' } }
      },
      // 视觉映射器：浅色高雅 Tiffany 渐变色系
      visualMap: {
        min: 0,
        max: 1.0,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        itemHeight: 120,
        text: ['高指征', '低指征'],
        textStyle: { color: '#94A3B8', fontWeight: 'bold', fontSize: 10 },
        inRange: {
          // 从柔雅浅灰，过渡到淡青，再到高饱和 Tiffany 蓝绿及典雅粉紫
          color: ['#F8FAFC', '#E0F2FE', '#7DD3FC', '#0EA5E9', '#0369A1']
        }
      },
      series: [
        {
          name: '情感声学特征相关性',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            formatter: function (params) {
              return params.data[2].toFixed(2);
            },
            color: '#1E293B',
            fontWeight: 'bold',
            fontSize: 10
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.1)'
            }
          }
        }
      ]
    };
  }, [fullFeaturedSongs]);

  // ==========================================
  // 🌌 方案四：高维多维平行坐标走廊
  // ==========================================
  const parallelOption = useMemo(() => {
    if (fullFeaturedSongs.length === 0) return {};

    // 每一行是一个 7 维数值数组：[舞曲, 能量, 原声, 愉悦, 现场, 器乐, 言语]
    // 为了使渲染线条精简流畅，如果全局数据过多，对其进行科学采样（最大渲染 300 条线，保留高能观感且绝不卡顿）
    const maxLines = 300;
    const step = Math.max(1, Math.floor(fullFeaturedSongs.length / maxLines));
    const sampledSongs = fullFeaturedSongs.filter((_, i) => i % step === 0);

    const parallelData = sampledSongs.map(song => {
      return {
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
          opacity: brushedSongs.length > 0 ? 0.35 : 0.16, // 如果是刷选过滤的数据，线条颜色加深，增强对比度
          width: brushedSongs.length > 0 ? 2 : 1.2
        },
        name: song.name,
        artist: song.artist,
        genre: song.genre,
        clusterName: clusterNames[song.cluster]
      };
    });

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
            <div style="font-weight: 800; color: #1E293B; margin-bottom: 6px; border-bottom: 1px solid #F1F5F9; padding-bottom: 4px;">🎵 ${song.name}</div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">艺术家: ${song.artist} | 流派: ${song.genre}</div>
            <div style="font-weight: bold; color: ${params.lineStyle.color}; margin-bottom: 8px;">所属情感: ${song.clusterName}</div>
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
      // 7 条平行坐标垂直轴定义
      parallelAxis: acousticMetrics.map((metric, idx) => ({
        dim: idx,
        name: metric.name,
        min: 0,
        max: 1.0,
        nameTextStyle: {
          color: '#475569',
          fontSize: 11,
          fontWeight: 'bold',
          padding: [0, 0, 8, 0]
        },
        axisLine: { lineStyle: { color: '#CBD5E1', width: 1.5 } },
        axisLabel: { color: '#64748B', fontSize: 10, fontWeight: '500', fontFamily: 'monospace' },
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
          nameGap: 12
        }
      },
      series: [
        {
          name: '高维声学多维走廊',
          type: 'parallel',
          lineStyle: {
            width: 1.2,
            opacity: 0.16
          },
          data: parallelData
        }
      ]
    };
  }, [fullFeaturedSongs, brushedSongs]);

  return (
    <div 
      className="card" 
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '560px',
        width: '100%',
        boxSizing: 'border-box',
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.75)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px 0 rgba(145, 158, 171, 0.08)',
        padding: '24px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* 卡片头部与 Tab 切换 */}
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
            <span>🧬 声学物理指标与情感聚类相关性透视</span>
            {brushedSongs.length > 0 && (
              <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                已过滤联动: {brushedSongs.length} 首歌曲
              </span>
            )}
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
            探索物理声学属性与 KMeans 情感分类的隐性印证关系。支持星云图框选联动。
          </p>
        </div>

        {/* 磨砂胶囊 Tab */}
        <div 
          style={{
            display: 'flex',
            background: 'rgba(145, 158, 171, 0.08)',
            padding: '3px',
            borderRadius: '20px',
            border: '1px solid rgba(145, 158, 171, 0.05)'
          }}
        >
          <button
            onClick={() => setActiveTab('heatmap')}
            style={{
              padding: '6px 16px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: '800',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              background: activeTab === 'heatmap' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'heatmap' ? '#1E293B' : '#64748B',
              boxShadow: activeTab === 'heatmap' ? '0 2px 8px 0 rgba(145, 158, 171, 0.12)' : 'none'
            }}
          >
            🌡️ 方案三：特征相关矩阵
          </button>
          <button
            onClick={() => setActiveTab('parallel')}
            style={{
              padding: '6px 16px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: '800',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              background: activeTab === 'parallel' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'parallel' ? '#1E293B' : '#64748B',
              boxShadow: activeTab === 'parallel' ? '0 2px 8px 0 rgba(145, 158, 171, 0.12)' : 'none'
            }}
          >
            🌌 方案四：多维平行走廊
          </button>
        </div>
      </div>

      {/* 图表展示区 */}
      <div style={{ flexGrow: 1, position: 'relative', width: '100%', minHeight: '360px' }}>
        <ReactECharts
          option={activeTab === 'heatmap' ? heatmapOption : parallelOption}
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </div>
  );
};

export default AcousticClusterAssociation;
