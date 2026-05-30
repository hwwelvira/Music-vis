import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

const clusterColors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F'];
const clusterNames = ['狂热释放', '轻松愉快', '伤感静谧', '阳光活力', '迷幻张力'];

// 汉化小类流派美化映射，用于在图表上展现精美中文
const genreI18n = {
  "舞蹈": "电子舞曲 Dance",
  "嘻哈": "嘻哈 Hip-Hop",
  "流行": "流行 Pop",
  "latin": "拉丁 Latin",
  "piano": "钢琴古典 Piano/Classic",
  "另类摇滚": "另类摇滚 Alt-Rock",
  "chill": "轻柔民谣 Chill-Acoustic",
  "garage": "英伦车库 Garage-Rock",
  "reggae": "雷鬼 Reggae",
  "latino": "拉丁风情 Latino",
  "民谣": "原声民谣 Folk",
  "硬摇滚": "硬摇滚 Hard-Rock",
  "灵魂乐": "灵魂蓝调 Soul/Blues",
  "朋克摇滚": "朋克摇滚 Punk",
  "唱作人": "独立唱作 Singer-Songwriter",
  "古典乐": "严肃古典 Classical",
  "EDM": "电子舞曲 EDM",
  "泰克诺": "硬核电子 Techno",
  "回响贝斯": "重低音 Dubstep",
  "出神电子": "幻境出神 Trance",
  "浩室": "经典浩室 House",
  "蓝调": "传统蓝调 Blues",
  "爵士": "摇摆爵士 Jazz",
  "华语流行": "华语流行 Mandopop",
  "粤语流行": "粤语流行 Cantopop",
  "韩国流行": "韩国流行 K-Pop"
};

const GenreClusterRelation = ({ scatterData }) => {
  const [activeTab, setActiveTab] = useState('sankey'); // 'sankey' or 'stackedBar'

  // 1. 数据深度挖掘与清洗：汇总“流派细分小类 -> 5大情感聚类”的多对多交叉频数
  const processedData = useMemo(() => {
    if (!scatterData || scatterData.length === 0) return { genres: [], matrix: {}, topGenres: [] };

    const matrix = {}; // genre -> [cluster0_count, cluster1_count, ...]
    const genreTotals = {};

    scatterData.forEach(song => {
      const rawGenre = song[4] ? song[4].trim() : '其它流派';
      const cluster = song[5];
      if (cluster === undefined || cluster < 0 || cluster > 4) return;

      const cleanGenre = genreI18n[rawGenre] || rawGenre;

      if (!matrix[cleanGenre]) {
        matrix[cleanGenre] = Array(5).fill(0);
        genreTotals[cleanGenre] = 0;
      }
      matrix[cleanGenre][cluster]++;
      genreTotals[cleanGenre]++;
    });

    // 为了图表清晰美观，避免数十个极小流派造成画面凌乱拥挤，按歌曲数量排序并筛选出 Top 12 个主干细分流派
    const sortedGenres = Object.entries(genreTotals)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
    
    const topGenres = sortedGenres.slice(0, 12);

    // 将剩余的所有小流派归为“其它流派”节点
    const cleanMatrix = { ...matrix };
    const otherClusters = Array(5).fill(0);
    
    Object.keys(matrix).forEach(g => {
      if (!topGenres.includes(g)) {
        for (let c = 0; c < 5; c++) {
          otherClusters[c] += matrix[g][c];
        }
        delete cleanMatrix[g];
      }
    });

    if (otherClusters.reduce((a, b) => a + b, 0) > 0) {
      topGenres.push('其它流派');
      cleanMatrix['其它流派'] = otherClusters;
    }

    return {
      genres: topGenres,
      matrix: cleanMatrix
    };
  }, [scatterData]);

  // ==========================================
  // 🌌 视图一：流派-情感流向桑基图 (Sankey)
  // ==========================================
  const sankeyOption = useMemo(() => {
    const { genres, matrix } = processedData;
    if (genres.length === 0) return {};

    // A. 节点定义 (左侧流派，右侧情感聚类，颜色相互呼应)
    const nodes = [];
    
    // 左侧小类流派节点 (采用高级雅致的灰蓝色系)
    genres.forEach((genre, idx) => {
      nodes.push({
        name: genre,
        itemStyle: {
          color: '#5C7C99',
          borderColor: '#4A657D',
          borderWidth: 1
        }
      });
    });

    // 右侧情感聚类节点 (严格采用聚类标准配色)
    clusterNames.forEach((name, idx) => {
      nodes.push({
        name: name,
        itemStyle: {
          color: clusterColors[idx],
          borderColor: 'rgba(0,0,0,0.1)',
          borderWidth: 1.5
        }
      });
    });

    // B. 连接线条定义 (links)
    const links = [];
    genres.forEach(genre => {
      const counts = matrix[genre] || Array(5).fill(0);
      counts.forEach((count, clusterIdx) => {
        if (count > 0) {
          links.push({
            source: genre,
            target: clusterNames[clusterIdx],
            value: count,
            lineStyle: {
              // 开启彩色渐变，流向右侧时颜色自然过渡到聚类颜色，视觉美感无敌！
              color: 'gradient',
              curveness: 0.5,
              opacity: 0.28
            }
          });
        }
      });
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        textStyle: { color: '#1E293B', fontSize: 12 },
        formatter: function (params) {
          if (params.dataType === 'node') {
            return `
              <div style="font-weight: 800; color: #1E293B; margin-bottom: 4px;">🏷️ 节点分析</div>
              <div style="color: #64748B;">名称: <span style="font-weight: 700; color: #3b82f6;">${params.name}</span></div>
              <div style="color: #64748B; margin-top: 4px;">歌曲总量: <span style="font-weight: 700; color: #0F172A;">${params.value} 首</span></div>
            `;
          } else {
            const flowColor = clusterColors[clusterNames.indexOf(params.data.target)];
            return `
              <div style="font-weight: 800; color: #1E293B; margin-bottom: 6px; border-bottom: 1px solid #F1F5F9; padding-bottom: 4px;">🌊 细分小类情感流</div>
              <div style="color: #64748B;">细分流派: <span style="font-weight: 700; color: #475569;">${params.data.source}</span></div>
              <div style="color: #64748B; margin-top: 2px;">对应情感: <span style="font-weight: 700; color: ${flowColor};">${params.data.target}</span></div>
              <div style="margin-top: 6px; font-weight: 800; font-size: 13px; color: #0F172A;">
                流向单曲: <span style="color: #10B981; font-family: monospace;">${params.data.value} 首</span>
              </div>
            `;
          }
        }
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          emphasis: {
            focus: 'adjacency' // 悬浮高亮相关关联节点及支流，其它淡出
          },
          nodeGap: 14,
          nodeWidth: 16,
          data: nodes,
          links: links,
          label: {
            color: '#475569',
            fontWeight: 'bold',
            fontSize: 10,
            fontFamily: 'Outfit, Inter, sans-serif'
          },
          lineStyle: {
            color: 'source',
            curveness: 0.5
          }
        }
      ]
    };
  }, [processedData]);

  // ==========================================
  // 📊 视图二：细分流派情感百分比堆叠图
  // ==========================================
  const barOption = useMemo(() => {
    const { genres, matrix } = processedData;
    if (genres.length === 0) return {};

    // 每一列是一个情感系列的数据占比
    const series = clusterNames.map((name, cIdx) => {
      const percentages = genres.map(genre => {
        const counts = matrix[genre] || Array(5).fill(0);
        const total = counts.reduce((a, b) => a + b, 0) || 1;
        return parseFloat(((counts[cIdx] / total) * 100).toFixed(1));
      });

      return {
        name: name,
        type: 'bar',
        stack: 'totalCount', // 完美水平 100% 堆叠
        label: {
          show: true,
          formatter: function(params) {
            // 只显示大于 6% 的比例，防止窄条文字挤爆
            return params.value > 6 ? `${params.value}%` : '';
          },
          color: '#FFFFFF',
          fontSize: 9,
          fontWeight: '900'
        },
        itemStyle: {
          color: clusterColors[cIdx]
        },
        emphasis: {
          focus: 'series'
        },
        data: percentages
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        textStyle: { color: '#1E293B', fontSize: 12 },
        formatter: function (params) {
          const genreName = params[0].name;
          let html = `
            <div style="font-weight: 800; color: #1E293B; margin-bottom: 6px; border-bottom: 1px solid #F1F5F9; padding-bottom: 4px;">📊 情感结构占比: ${genreName}</div>
            <table style="width:100%; font-size:11px; border-collapse:collapse; font-family: monospace;">
          `;
          params.forEach((item, idx) => {
            html += `
              <tr style="height:20px;">
                <td style="display:flex; align-items:center; gap:6px; color:#64748B; padding-right:15px;">
                  <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${item.color};"></span>
                  ${item.seriesName}
                </td>
                <td style="text-align:right; font-weight:700; color:#1E293B;">${item.value}%</td>
              </tr>
            `;
          });
          html += '</table>';
          return html;
        }
      },
      legend: {
        data: clusterNames,
        bottom: '0%',
        icon: 'circle',
        itemGap: 16,
        textStyle: { color: '#64748B', fontWeight: 'bold', fontSize: 11 }
      },
      grid: {
        left: '18%', // 留出足够空间显示流派中文大标签
        right: '5%',
        top: '6%',
        bottom: '12%'
      },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%', color: '#94A3B8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: genres,
        axisLabel: { color: '#475569', fontSize: 10, fontWeight: 'bold' },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
        axisTick: { show: false }
      },
      series: series
    };
  }, [processedData]);

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
        padding: '24px'
      }}
    >
      {/* 头部区域与 Tab 切换 */}
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
            <span>🪐 音乐细分流派小类与情感聚类关联印证</span>
            <span style={{ fontSize: '11px', background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
              📊 交叉关联透视
            </span>
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
            揭示数十个歌曲细分小类（如唱作人、爵士、嘻哈）在五大情感分类中的分流与沉淀比例。
          </p>
        </div>

        {/* 磨砂 Tab */}
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
            onClick={() => setActiveTab('sankey')}
            style={{
              padding: '6px 16px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: '800',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              background: activeTab === 'sankey' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'sankey' ? '#1E293B' : '#64748B',
              boxShadow: activeTab === 'sankey' ? '0 2px 8px 0 rgba(145, 158, 171, 0.12)' : 'none'
            }}
          >
            🌌 方案 A：流派情感桑基图
          </button>
          <button
            onClick={() => setActiveTab('stackedBar')}
            style={{
              padding: '6px 16px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: '800',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              background: activeTab === 'stackedBar' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'stackedBar' ? '#1E293B' : '#64748B',
              boxShadow: activeTab === 'stackedBar' ? '0 2px 8px 0 rgba(145, 158, 171, 0.12)' : 'none'
            }}
          >
            📊 方案 B：情感构成占比图
          </button>
        </div>
      </div>

      {/* 图表渲染展示区 */}
      <div style={{ flexGrow: 1, position: 'relative', width: '100%', minHeight: '360px' }}>
        <ReactECharts
          option={activeTab === 'sankey' ? sankeyOption : barOption}
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </div>
  );
};

export default GenreClusterRelation;
