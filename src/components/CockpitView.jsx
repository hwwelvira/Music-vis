import React from 'react';
import ToggleableChordRadar from './ToggleableChordRadar';
import ScatterBrushChart from './ScatterBrushChart';
import SongTable from './SongTable';
import ReactECharts from 'echarts-for-react';

const clusterNames = ['狂热释放', '轻松愉快', '伤感静谧', '阳光活力', '迷幻张力'];
const clusterColors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F'];

const CockpitView = ({ 
  data, 
  selectedGenre, 
  setSelectedGenre, 
  brushedData, 
  setBrushedData, 
  selectedSong, 
  setSelectedSong,
  genreDetails
}) => {
  
  if (!data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '500px', color: '#637381' }}>
        ⏳ 正在加载极客驾驶舱...
      </div>
    );
  }

  // 联动雷达图的数据源
  let radarData = null;
  let radarName = '';

  if (selectedGenre && selectedGenre.features) {
    radarData = selectedGenre.features;
    radarName = selectedGenre.name;
  } else if (data.sunburst && data.sunburst.length > 0) {
    radarData = data.sunburst[0].features;
    radarName = data.sunburst[0].name;
  }

  // 整理所有可用的对比流派（包含大类和子流派）
  const compareGenresList = React.useMemo(() => {
    if (!data || !data.sunburst) return [];
    const list = [];
    
    data.sunburst.forEach(parent => {
      const cleanParentName = parent.name.split('\n')[0].trim();
      const parentEn = parent.name.split('\n')[1] ? parent.name.split('\n')[1].trim() : '';
      const displayName = parentEn ? `${cleanParentName} (${parentEn})` : cleanParentName;

      list.push({
        id: `parent_${cleanParentName}`,
        name: cleanParentName,
        displayName: displayName,
        features: parent.features,
        isParent: true,
        category: cleanParentName
      });

      if (parent.children) {
        parent.children.forEach(child => {
          list.push({
            id: `child_${child.name}`,
            name: child.name,
            displayName: child.name,
            features: child.features,
            isParent: false,
            category: cleanParentName
          });
        });
      }
    });

    return list;
  }, [data]);

  const [hoveredCategory, setHoveredCategory] = React.useState(null);
  const [isDetailExpanded, setIsDetailExpanded] = React.useState(true); // 控制歌曲多维悬浮窗的折叠与展开状态

  // 流派专属详情悬浮窗状态与拖动平移状态
  const [clickedGenre, setClickedGenre] = React.useState(null);
  const [posGenre, setPosGenre] = React.useState({ x: 0, y: 0 });
  const [isDraggingGenre, setIsDraggingGenre] = React.useState(false);
  const draggingRefGenre = React.useRef(false);
  const dragStartPosGenre = React.useRef({ x: 0, y: 0 });
  const dragStartOffsetGenre = React.useRef({ x: 0, y: 0 });

  // 线性平铺所有旭日图节点（包含父大类和子流派），用于在详情浮窗左右箭头点击时依次切换
  const flatGenresList = React.useMemo(() => {
    if (!data || !data.sunburst) return [];
    const list = [];
    data.sunburst.forEach(parent => {
      list.push(parent);
      if (parent.children) {
        parent.children.forEach(child => {
          list.push(child);
        });
      }
    });
    return list;
  }, [data]);

  const handleSwitchGenre = (direction) => {
    if (flatGenresList.length === 0 || !clickedGenre) return;
    const currentIndex = flatGenresList.findIndex(g => g.name === clickedGenre.name);
    if (currentIndex === -1) return;
    
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % flatGenresList.length;
    } else {
      nextIndex = (currentIndex - 1 + flatGenresList.length) % flatGenresList.length;
    }
    
    const nextGenre = flatGenresList[nextIndex];
    setSelectedGenre(nextGenre);
    setClickedGenre(nextGenre);
    setHoveredCategory(nextGenre.name); // 同步更新 hoveredCategory，驱动旭日图弦线与聚类散点图联动切换
  };

  // 📊 对比雷达图的状态管理
  const [isCompareModalOpen, setIsCompareModalOpen] = React.useState(false);
  const [selectedCompareGenres, setSelectedCompareGenres] = React.useState([]);

  // 🧬 计算选中对比流派的声学维度综合相似度（7维声学向量两两平均绝对误差逆向折算）
  const genreSimilarity = React.useMemo(() => {
    if (selectedCompareGenres.length < 2) return null;
    const featuresList = data.radar_features || [
      'danceability', 'energy', 'acousticness', 'valence', 'liveness', 'instrumentalness', 'speechiness'
    ];

    // 提取每个选定流派的特征向量
    const vectors = selectedCompareGenres.map(genre => {
      return featuresList.map(key => genre.features?.[key] ?? 0.5);
    });

    let totalSim = 0;
    let count = 0;

    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        const v1 = vectors[i];
        const v2 = vectors[j];
        
        // 计算平均绝对误差（MAE）
        let sumDiff = 0;
        for (let k = 0; k < v1.length; k++) {
          sumDiff += Math.abs(v1[k] - v2[k]);
        }
        const mae = sumDiff / v1.length;
        
        // 相似度换算：相似度 = 1 - mae * 1.6 并限制在 0 ~ 1 之间
        const sim = Math.max(0, 1 - mae * 1.6);
        totalSim += sim;
        count++;
      }
    }

    if (count === 0) return null;
    return (totalSim / count) * 100;
  }, [selectedCompareGenres, data]);

  // 🔮 KMeans 分布对比的状态管理
  const [isKMeansCompareOpen, setIsKMeansCompareOpen] = React.useState(false);
  const [selectedKMeansGenres, setSelectedKMeansGenres] = React.useState([]);
  const [hoveredKMeansGenreId, setHoveredKMeansGenreId] = React.useState(null);
  const kmeansChartRef = React.useRef(null);

  // 📝 歌词词频点击分析悬浮窗状态与拖拽平移状态
  const [clickedWord, setClickedWord] = React.useState(null);
  const [posWord, setPosWord] = React.useState({ x: 0, y: 0 });
  const [isDraggingWord, setIsDraggingWord] = React.useState(false);
  const draggingRefWord = React.useRef(false);
  const dragStartPosWord = React.useRef({ x: 0, y: 0 });
  const dragStartOffsetWord = React.useRef({ x: 0, y: 0 });

  const handleMouseMoveWord = React.useCallback((e) => {
    if (!draggingRefWord.current) return;
    const dx = e.clientX - dragStartPosWord.current.x;
    const dy = e.clientY - dragStartPosWord.current.y;
    
    setPosWord({
      x: dragStartOffsetWord.current.x + dx,
      y: dragStartOffsetWord.current.y + dy
    });
  }, []);

  const handleMouseUpWord = React.useCallback(() => {
    draggingRefWord.current = false;
    setIsDraggingWord(false);
    window.removeEventListener('mousemove', handleMouseMoveWord);
    window.removeEventListener('mouseup', handleMouseUpWord);
  }, [handleMouseMoveWord]);

  const handleMouseDownWord = React.useCallback((e) => {
    if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button') || e.target.closest('.echarts-for-react')) {
      return;
    }
    
    draggingRefWord.current = true;
    setIsDraggingWord(true);
    dragStartPosWord.current = { x: e.clientX, y: e.clientY };
    dragStartOffsetWord.current = { ...posWord };
    
    window.addEventListener('mousemove', handleMouseMoveWord);
    window.addEventListener('mouseup', handleMouseUpWord);
    
    e.preventDefault();
  }, [posWord, handleMouseMoveWord, handleMouseUpWord]);

  // 当切换词时，仅在首次打开时重置位置，在切换词时不重置
  const prevClickedWordRef = React.useRef(null);
  React.useEffect(() => {
    if (clickedWord && !prevClickedWordRef.current) {
      setPosWord({ x: 0, y: 0 });
    }
    prevClickedWordRef.current = clickedWord;
  }, [clickedWord]);

  // 🧬 计算选中歌词词频的流派与加权声学情感特征
  const wordAnalysisData = React.useMemo(() => {
    if (!clickedWord || !genreDetails) return null;
    
    // 1. 统计各具体子流派/叶子流派的频次统计
    const genreFreqs = {};
    let totalFreq = 0;

    compareGenresList.forEach(cg => {
      // 如果是大类并且它拥有子流派，我们就不统计它本身（以防和子流派重复统计）
      const hasChildren = compareGenresList.some(other => !other.isParent && other.category === cg.name);
      if (cg.isParent && hasChildren) return;
      
      const words = genreDetails[cg.name]?.words || [];
      const found = words.find(w => w.name === clickedWord);
      if (found) {
        genreFreqs[cg.name] = (genreFreqs[cg.name] || 0) + found.value;
        totalFreq += found.value;
      }
    });

    // 2. 将结果转换为 ECharts 饼图/玫瑰图所需的数据格式
    const genreDist = Object.keys(genreFreqs)
      .map(gName => ({
        name: gName,
        value: genreFreqs[gName]
      }))
      .filter(item => item.value > 0) // 只显示有频次的流派
      .sort((a, b) => b.value - a.value);

    // 3. 计算声学情感维度的加权均值
    const featuresList = [
      'danceability', 'energy', 'acousticness', 'valence', 'liveness', 'instrumentalness', 'speechiness'
    ];
    
    const weightedFeatures = {
      danceability: 0, energy: 0, acousticness: 0, valence: 0, liveness: 0, instrumentalness: 0, speechiness: 0
    };
    let weightSum = 0;

    genreDist.forEach(item => {
      // 寻找对应的流派特征
      const matchedObj = compareGenresList.find(cg => cg.name === item.name);
      if (matchedObj && matchedObj.features) {
        featuresList.forEach(key => {
          weightedFeatures[key] += (matchedObj.features[key] ?? 0.5) * item.value;
        });
        weightSum += item.value;
      }
    });

    const finalFeatures = {};
    if (weightSum > 0) {
      featuresList.forEach(key => {
        finalFeatures[key] = weightedFeatures[key] / weightSum;
      });
    } else {
      featuresList.forEach(key => {
        finalFeatures[key] = 0.5;
      });
    }

    return {
      word: clickedWord,
      genreDist: genreDist,
      features: finalFeatures,
      totalFreq
    };
  }, [clickedWord, genreDetails, compareGenresList]);

  // 🌹 图表一：流派亲和度分析 -> ECharts 南丁格尔玫瑰图
  const getWordGenreOption = () => {
    if (!wordAnalysisData) return {};
    const colors = ['#FF8A9A', '#6BBAA7', '#5B9BD5', '#B088F5', '#EDC948', '#F28E2B', '#86BCB6', '#CBD5E1'];

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        padding: [6, 10],
        textStyle: { color: '#333333', fontSize: 10, fontFamily: '"Outfit", sans-serif' },
        formatter: '🏷️ {b}: <b>{c} 次</b> ({d}%)'
      },
      series: [
        {
          name: '流派词频浓度',
          type: 'pie',
          radius: [10, 52],
          center: ['50%', '50%'],
          roseType: 'area',
          itemStyle: {
            borderRadius: 4
          },
          color: colors,
          label: {
            show: true,
            fontSize: 8,
            color: '#64748B',
            fontWeight: 'bold',
            formatter: '{b}'
          },
          labelLine: {
            length: 4,
            length2: 4,
            lineStyle: {
              color: '#CBD5E1'
            }
          },
          data: wordAnalysisData.genreDist
        }
      ]
    };
  };

  // 🧪 图表二：声学维度情感指纹 -> ECharts 极坐标单轴柱状图
  const getWordAcousticOption = () => {
    if (!wordAnalysisData) return {};
    
    const translations = {
      danceability: '可舞度',
      energy: '能量',
      acousticness: '声学度',
      valence: '愉悦度',
      liveness: '现场感',
      instrumentalness: '器乐度',
      speechiness: '言语度'
    };
    
    const featuresList = [
      'danceability', 'energy', 'acousticness', 'valence', 'liveness', 'instrumentalness', 'speechiness'
    ];

    const dataPoints = featuresList.map(key => ({
      name: translations[key],
      value: wordAnalysisData.features[key] ?? 0.5
    }));

    return {
      backgroundColor: 'transparent',
      angleAxis: {
        type: 'category',
        data: dataPoints.map(d => d.name),
        boundaryGap: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#64748B',
          fontSize: 8,
          fontWeight: 'bold',
          fontFamily: '"Outfit", sans-serif'
        }
      },
      radiusAxis: {
        min: 0,
        max: 1.0,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.08)',
            type: 'dashed'
          }
        }
      },
      polar: {
        radius: '70%',
        center: ['50%', '50%']
      },
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        padding: [6, 10],
        textStyle: { color: '#333333', fontSize: 10, fontFamily: '"Outfit", sans-serif' },
        formatter: '🧪 {b}: <b>{c}</b>'
      },
      series: [
        {
          type: 'bar',
          data: dataPoints.map((d, i) => {
            const colors = ['#FF8A9A', '#6BBAA7', '#5B9BD5', '#B088F5', '#EDC948', '#F28E2B', '#86BCB6'];
            return {
              value: parseFloat(d.value.toFixed(2)),
              itemStyle: {
                color: colors[i % colors.length],
                borderRadius: 2
              }
            };
          }),
          coordinateSystem: 'polar',
          barWidth: '40%'
        }
      ]
    };
  };



  // 判断一首歌曲是否属于某个给定的对比流派（包含大类和子细分类的匹配，升级全兼容高防卫版）
  const isSongInGenre = React.useCallback((song, compareGenre) => {
    if (!song || !compareGenre) return false;
    
    // 支持 compareGenre 既是对象 { name, ... }，也是纯字符串
    // 🧬 核心清洗：自动将带换行符或括号后缀的大类名字（如 "流行\nPop"）规约清洗到标准中文大类名称（"流行"），打通与歌曲及子流派的匹配通道
    const targetName = typeof compareGenre === 'string' 
      ? compareGenre.split('\n')[0].split('(')[0].trim()
      : ((compareGenre.name || '').split('\n')[0].split('(')[0].trim());

    if (!targetName) return false;

    const songGenreLower = (song[4] || '').toString().toLowerCase().trim();
    const genreNameLower = targetName.toLowerCase().trim();
    
    const isParent = typeof compareGenre === 'object' && (
      compareGenre.isParent || 
      (compareGenre.children && compareGenre.children.length > 0) ||
      compareGenresList.some(cg => cg.name === targetName && cg.isParent)
    );
    
    if (isParent) {
      const childrenNames = compareGenresList
        .filter(cg => cg && cg.category === targetName && !cg.isParent)
        .map(cg => (cg.name || '').toLowerCase().trim());
      
      return childrenNames.includes(songGenreLower) || songGenreLower === genreNameLower;
    } else {
      return songGenreLower === genreNameLower;
    }
  }, [compareGenresList]);

  // 默认选中对比流派，以便在一打开时就展示效果！
  React.useEffect(() => {
    if (compareGenresList.length > 0 && selectedCompareGenres.length === 0) {
      const defaults = compareGenresList.filter(g => 
        ['华语流行', '韩国流行', '粤语流行'].includes(g.name)
      );
      if (defaults.length > 0) {
        setSelectedCompareGenres(defaults);
      } else {
        setSelectedCompareGenres(compareGenresList.slice(0, 3));
      }
    }
  }, [compareGenresList, selectedCompareGenres]);

  // KMeans 默认勾选流派
  React.useEffect(() => {
    if (compareGenresList.length > 0 && selectedKMeansGenres.length === 0) {
      const defaults = compareGenresList.filter(g => 
        ['华语流行', '韩国流行', '粤语流行'].includes(g.name)
      );
      if (defaults.length > 0) {
        setSelectedKMeansGenres(defaults);
      } else {
        setSelectedKMeansGenres(compareGenresList.slice(0, 3));
      }
    }
  }, [compareGenresList, selectedKMeansGenres]);

  // 过滤当前 KMeans 选中对比流派的所有歌曲
  const kMeansCompareSongs = React.useMemo(() => {
    if (!data || !data.scatter || selectedKMeansGenres.length === 0) return [];
    
    return data.scatter.filter(song => {
      return selectedKMeansGenres.some(cg => isSongInGenre(song, cg));
    }).sort((a, b) => {
      const popA = a[6] ?? 0;
      const popB = b[6] ?? 0;
      return popB - popA;
    });
  }, [data, selectedKMeansGenres, isSongInGenre]);

  // 🌊 主界面歌曲列表的数据源（叠加支持 Scatter Brush 框选与 Sunburst/Chord 点击流派双重过滤）
  const displayedSongs = React.useMemo(() => {
    const baseSongs = brushedData.length > 0 ? brushedData : (data.scatter || []);
    if (clickedGenre) {
      return baseSongs.filter(song => isSongInGenre(song, clickedGenre));
    }
    return baseSongs;
  }, [brushedData, data, clickedGenre, isSongInGenre]);

  const getCompareRadarOption = () => {
    if (selectedCompareGenres.length < 2) return {};

    const indicators = (data.radar_features || [
      'danceability', 'energy', 'acousticness', 'valence', 'liveness', 'instrumentalness', 'speechiness'
    ]).map(key => {
      const translations = {
        danceability: '可舞度',
        energy: '能量',
        acousticness: '声学度',
        valence: '愉悦度',
        liveness: '现场感',
        instrumentalness: '器乐度',
        speechiness: '言语度'
      };
      const maxVal = data.featureMaxes?.[key] ?? 1.0;
      return {
        name: translations[key] || key,
        max: maxVal
      };
    });

    const colors = ['#FF5E7E', '#4DABF7', '#51CF66', '#FCC419'];

    const seriesData = selectedCompareGenres.map((genre, idx) => {
      const values = (data.radar_features || [
        'danceability', 'energy', 'acousticness', 'valence', 'liveness', 'instrumentalness', 'speechiness'
      ]).map(key => genre.features?.[key] ?? 0.5);

      return {
        value: values,
        name: genre.name,
        itemStyle: { color: colors[idx % colors.length] },
        lineStyle: { width: 2, color: colors[idx % colors.length] },
        areaStyle: {
          color: colors[idx % colors.length],
          opacity: 0.15
        }
      };
    });

    return {
      backgroundColor: 'transparent',
      color: colors,
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#EEEEEE',
        padding: [6, 10],
        textStyle: { color: '#333333', fontSize: 10, fontFamily: '"Outfit", "Inter", sans-serif' },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px;'
      },
      legend: {
        show: true,
        bottom: 0,
        icon: 'circle',
        itemGap: 12,
        textStyle: { fontSize: 10, color: '#475569', fontWeight: 'bold', fontFamily: '"Outfit", "Inter", sans-serif' }
      },
      radar: {
        indicator: indicators,
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: '#64748B',
          fontSize: 9.5,
          fontWeight: 'bold',
          fontFamily: '"Outfit", "Inter", sans-serif'
        },
        splitLine: {
          lineStyle: { color: 'rgba(145, 158, 171, 0.12)' }
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgba(255, 255, 255, 0.6)', 'rgba(248, 250, 252, 0.4)']
          }
        },
        axisLine: {
          lineStyle: { color: 'rgba(145, 158, 171, 0.12)' }
        }
      },
      series: [{
        type: 'radar',
        data: seriesData,
        symbol: 'circle',
        symbolSize: 4
      }]
    };
  };
  const getKMeansCompareOption = () => {
    if (!data || !data.scatter || selectedKMeansGenres.length === 0) return {};

    const clusterNames = ['狂热释放', '轻松愉快', '伤感静谧', '阳光活力', '迷幻张力'];
    const clusterColors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F'];
    const genreColors = ['#FF5E7E', '#4DABF7', '#51CF66', '#FCC419'];

    // ── 1. 计算 5 个聚类的质心 ──
    const clusterSums = Array.from({ length: 5 }, () => ({ v: 0, e: 0, n: 0 }));
    data.scatter.forEach(song => {
      if (!song) return;
      const ci = song[5];
      if (ci >= 0 && ci < 5) {
        clusterSums[ci].v += song[1]; // valence
        clusterSums[ci].e += song[0]; // energy
        clusterSums[ci].n++;
      }
    });
    const centroids = clusterSums.map(s => ([
      s.n > 0 ? s.e / s.n : 0.5, // x: energy
      s.n > 0 ? s.v / s.n : 0.5  // y: valence
    ]));

    // ── 2. Voronoi 背景网格：将坐标空间按最近质心分块着色 ──
    const gridRes = 50; // 50×50 = 2500 个网格单元，足以呈现丝滑的 Voronoi 边界
    const cellW = 1.0 / gridRes;
    const cellH = 1.0 / gridRes;
    const bgData = [];
    for (let i = 0; i < gridRes; i++) {
      for (let j = 0; j < gridRes; j++) {
        const e = (i + 0.5) * cellW; // x: energy
        const v = (j + 0.5) * cellH; // y: valence
        let minDist = Infinity, nearest = 0;
        centroids.forEach((c, idx) => {
          const d = (e - c[0]) ** 2 + (v - c[1]) ** 2;
          if (d < minDist) { minDist = d; nearest = idx; }
        });
        bgData.push({ value: [e, v, nearest] });
      }
    }

    // 背景 Voronoi 系列
    const bgSeries = {
      name: '__voronoi_bg__',
      type: 'custom',
      renderItem: (params, api) => {
        const cx = api.value(0);
        const cy = api.value(1);
        const ci = api.value(2);
        const topLeft = api.coord([cx - cellW / 2, cy + cellH / 2]);
        const bottomRight = api.coord([cx + cellW / 2, cy - cellH / 2]);
        if (!topLeft || !bottomRight) return null;
        return {
          type: 'rect',
          shape: {
            x: topLeft[0],
            y: topLeft[1],
            width: bottomRight[0] - topLeft[0],
            height: bottomRight[1] - topLeft[1]
          },
          style: {
            fill: clusterColors[ci],
            opacity: 0.32 // 清晰明显的背景色块，确保聚类分区一目了然
          },
          z2: -1
        };
      },
      data: bgData,
      encode: { x: 0, y: 1 },
      silent: true, // 背景色块不响应鼠标交互
      z: 0
    };

    // 质心标注系列：在每个聚类区域中心标注聚类名
    const labelSeries = {
      name: '__cluster_labels__',
      type: 'scatter',
      symbol: 'none',
      symbolSize: 0,
      data: centroids.map((c, i) => ({
        value: [c[0], c[1]],
        label: {
          show: true,
          formatter: clusterNames[i],
          fontSize: 9,
          fontWeight: '800',
          color: clusterColors[i],
          textBorderColor: '#fff',
          textBorderWidth: 2,
          fontFamily: '"Outfit", "Inter", sans-serif'
        }
      })),
      silent: true,
      z: 1
    };

    // ── 3. 流派散点系列：简洁的纯色圆点 ──
    const scatterSeries = selectedKMeansGenres.map((genre, idx) => {
      const activeColor = genreColors[idx % genreColors.length];
      const genreSongs = data.scatter.filter(song => {
        if (!song) return false;
        const belong = isSongInGenre(song, genre);
        if (!belong) return false;
        
        // 🧬 优先级排他过滤：若当前渲染的是 Parent 大流派系列，应当排除那些已经被单独作为子流派系列勾选了的歌曲，防止因为散点在坐标空间完全重合而被最后一个渲染的系列遮挡覆盖。
        if (genre.isParent) {
          const isBelongToSelectedChild = selectedKMeansGenres.some(otherGenre => {
            if (otherGenre.id === genre.id || otherGenre.isParent) return false;
            return isSongInGenre(song, otherGenre);
          });
          if (isBelongToSelectedChild) return false;
        }
        return true;
      });

      return {
        name: genre.name,
        type: 'scatter',
        data: genreSongs.map(song => ({
          value: [
            song[0], // x: energy
            song[1], // y: valence
            song[2], // 歌名
            song[3], // 歌手
            song[4], // 流派
            song[6], // 流行度
            clusterNames[song[5]] || '未知'
          ]
        })),
        symbolSize: 5.5,
        itemStyle: {
          color: activeColor,
          opacity: hoveredKMeansGenreId === null 
            ? 0.88 
            : (genre.id === hoveredKMeansGenreId ? 0.95 : 0.08), // 🧬 核心高级感降噪：被悬停流派保留高对比度，其余对比度调低成微淡虚影，不晃眼、极具艺术性
          borderColor: 'rgba(255,255,255,0.7)',
          borderWidth: 0.6
        },
        emphasis: {
          scale: false, // 彻底关闭粒子的突然放大，防止产生粗糙的高亮闪烁
          focus: 'none',
          itemStyle: {
            borderColor: 'rgba(255,255,255,0.9)',
            borderWidth: 0.8,
            shadowBlur: 0
          }
        },
        z: 2
      };
    });

    // ── 4. 聚类背景色图例（顶部横排，替代 ECharts 原生 Legend） ──
    const clusterLegendGraphic = clusterNames.map((name, i) => ([
      {
        type: 'rect',
        left: 10 + i * 88,
        top: 4,
        shape: { width: 8, height: 8, r: 2 },
        style: { fill: clusterColors[i], opacity: 0.6 },
        silent: true,
        z: 100
      },
      {
        type: 'text',
        left: 22 + i * 88,
        top: 3,
        style: {
          text: name,
          fill: '#64748B',
          fontSize: 8,
          fontWeight: 'bold',
          fontFamily: '"Outfit", "Inter", sans-serif'
        },
        silent: true,
        z: 100
      }
    ])).flat();

    return {
      backgroundColor: 'transparent',
      graphic: clusterLegendGraphic,
      legend: {
        show: false // 流派图例已由上方卡片承担，此处仅显示聚类背景色图例
      },
      grid: { left: 22, right: 10, top: 22, bottom: 20, containLabel: true },
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#EEEEEE',
        padding: [6, 10],
        textStyle: { color: '#333333', fontSize: 10, fontFamily: '"Outfit", "Inter", sans-serif' },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px;',
        formatter: function(params) {
          if (!params.value || params.value.length < 7) return '';
          const songEnergy = params.value[0];
          const songValence = params.value[1];
          const songTitle = params.value[2];
          const songArtist = params.value[3];
          const songGenre = params.value[4];
          const songPop = params.value[5];
          const cName = params.value[6];

          return `<div style="font-weight:bold; font-size:10.5px; color:#1E293B; margin-bottom:4px;">🎵 ${songTitle}</div>
            <div style="font-size:9.5px; color:#64748B;">🎤 歌手: ${songArtist}</div>
            <div style="font-size:9.5px; color:#64748B;">🏷️ 流派: <b style="color:${params.color}">${songGenre}</b></div>
            <div style="font-size:9.5px; color:#64748B;">🧪 KMeans聚类: <b>${cName}</b> (背景色区域) | 流行度: <b>${songPop}%</b></div>
            <div style="font-size:9.5px; color:#64748B; margin-top:3px; border-top:1px solid #EEE; padding-top:2px;">
              能量 (Energy): <b>${songEnergy.toFixed(2)}</b> | 愉悦度 (Valence): <b>${songValence.toFixed(2)}</b>
            </div>`;
        }
      },
      xAxis: {
        type: 'value',
        name: '能量 (Energy)',
        nameLocation: 'middle',
        nameGap: 14,
        min: 0, max: 1,
        nameTextStyle: { fontSize: 8, color: '#94A3B8', fontWeight: 'bold' },
        splitLine: { show: false },
        axisLabel: { color: '#94A3B8', fontSize: 7.5 },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        name: '愉悦度 (Valence)',
        nameLocation: 'middle',
        nameGap: 18,
        min: 0, max: 1,
        nameTextStyle: { fontSize: 8, color: '#94A3B8', fontWeight: 'bold' },
        splitLine: { show: false },
        axisLabel: { color: '#94A3B8', fontSize: 7.5 },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [bgSeries, labelSeries, ...scatterSeries]
    };
  };

  const getKMeansCompositionOption = () => {
    if (!data || !data.scatter || selectedKMeansGenres.length === 0) return {};

    const clusterNames = ['狂热释放', '轻松愉快', '伤感静谧', '阳光活力', '迷幻张力'];
    const clusterColors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F'];

    // 计算每个选中流派的 5 个聚类成分数量和比例
    const seriesData = clusterNames.map((clusterName, clusterIdx) => {
      const dataPoints = selectedKMeansGenres.map(genre => {
        if (!genre) return { value: 0, rawCount: 0, totalCount: 1, genreName: '' };
        
        const genreSongs = data.scatter.filter(song => song && isSongInGenre(song, genre));
        const totalCount = genreSongs.length || 1;
        const clusterCount = genreSongs.filter(song => song && song[5] === clusterIdx).length;
        const percentage = Math.round((clusterCount / totalCount) * 100);
        return {
          value: percentage,
          rawCount: clusterCount,
          totalCount: totalCount,
          genreName: typeof genre === 'string' ? genre : (genre.name || '')
        };
      });

      return {
        name: clusterName,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        itemStyle: { color: clusterColors[clusterIdx] },
        barWidth: '55%',
        data: dataPoints
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        appendToBody: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#EEEEEE',
        padding: [6, 10],
        textStyle: { color: '#333333', fontSize: 10, fontFamily: '"Outfit", "Inter", sans-serif' },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px;',
        formatter: function(params) {
          if (!params || params.length === 0) return '';
          let html = `<div style="font-weight:bold; font-size:10.5px; color:#1E293B; margin-bottom:5px;">📊 ${params[0].name} 情感构成</div>`;
          params.forEach(p => {
            if (p && p.data) {
              html += `<div style="font-size:9.5px; display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:2px;">
                <div style="display:flex; align-items:center; gap:4px; color:#64748B;">
                  <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:${p.color};"></span>
                  ${p.seriesName}
                </div>
                <span style="font-weight:800; color:#1E293B;">${p.value}% <span style="font-size:8px; font-weight:normal; color:#94A3B8;">(${p.data.rawCount}首)</span></span>
              </div>`;
            }
          });
          return html;
        }
      },
      legend: {
        show: false
      },
      grid: { left: 5, right: 15, top: 10, bottom: 5, containLabel: true },
      xAxis: {
        type: 'value',
        max: 100,
        splitLine: { show: false },
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'category',
        data: selectedKMeansGenres.map(g => g ? (typeof g === 'string' ? g : (g.name || '')) : ''),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#475569',
          fontSize: 9.5,
          fontWeight: '800',
          margin: 8
        }
      },
      series: seriesData
    };
  };

  // 预计算 5 个聚类簇的 8 维声学特征均值，作为同聚类基准
  const clusterMeans = React.useMemo(() => {
    if (!data || !data.scatter) return [];
    const sums = Array.from({ length: 5 }, () => ({
      energy: 0, valence: 0, popularity: 0, danceability: 0,
      acousticness: 0, liveness: 0, instrumentalness: 0, speechiness: 0,
      count: 0
    }));
    
    data.scatter.forEach(song => {
      const c = song[5];
      if (c >= 0 && c < 5) {
        sums[c].energy += song[0] ?? 0;
        sums[c].valence += song[1] ?? 0;
        sums[c].popularity += song[6] ?? 40.0;
        sums[c].danceability += song[7] ?? 0.5;
        sums[c].acousticness += song[8] ?? 0.3;
        sums[c].liveness += song[9] ?? 0.18;
        sums[c].instrumentalness += song[10] ?? 0.05;
        sums[c].speechiness += song[11] ?? 0.06;
        sums[c].count += 1;
      }
    });
    
    return sums.map(s => {
      const cnt = s.count || 1;
      return {
        energy: s.energy / cnt,
        valence: s.valence / cnt,
        popularity: (s.popularity / cnt) / 100, // 规约至 0.0 - 1.0
        danceability: s.danceability / cnt,
        acousticness: s.acousticness / cnt,
        liveness: s.liveness / cnt,
        instrumentalness: s.instrumentalness / cnt,
        speechiness: s.speechiness / cnt
      };
    });
  }, [data]);

  // 悬浮窗拖动平移状态
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const draggingRef = React.useRef(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  const dragStartOffset = React.useRef({ x: 0, y: 0 });



  const handleMouseMove = React.useCallback((e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    
    setPos({
      x: dragStartOffset.current.x + dx,
      y: dragStartOffset.current.y + dy
    });
  }, []);

  const handleMouseUp = React.useCallback(() => {
    draggingRef.current = false;
    setIsDragging(false);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = React.useCallback((e) => {
    // 若点击的是关闭/折叠按钮，则不触发拖拽
    if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) {
      return;
    }
    
    draggingRef.current = true;
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartOffset.current = { ...pos };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    e.preventDefault();
  }, [pos, handleMouseMove, handleMouseUp]);



  const handleMouseMoveGenre = React.useCallback((e) => {
    if (!draggingRefGenre.current) return;
    const dx = e.clientX - dragStartPosGenre.current.x;
    const dy = e.clientY - dragStartPosGenre.current.y;
    
    setPosGenre({
      x: dragStartOffsetGenre.current.x + dx,
      y: dragStartOffsetGenre.current.y + dy
    });
  }, []);

  const handleMouseUpGenre = React.useCallback(() => {
    draggingRefGenre.current = false;
    setIsDraggingGenre(false);
    window.removeEventListener('mousemove', handleMouseMoveGenre);
    window.removeEventListener('mouseup', handleMouseUpGenre);
  }, [handleMouseMoveGenre]);

  const handleMouseDownGenre = React.useCallback((e) => {
    if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button') || e.target.closest('.echarts-for-react')) {
      return;
    }
    
    draggingRefGenre.current = true;
    setIsDraggingGenre(true);
    dragStartPosGenre.current = { x: e.clientX, y: e.clientY };
    dragStartOffsetGenre.current = { ...posGenre };
    
    window.addEventListener('mousemove', handleMouseMoveGenre);
    window.addEventListener('mouseup', handleMouseUpGenre);
    
    e.preventDefault();
  }, [posGenre, handleMouseMoveGenre, handleMouseUpGenre]);

  // 当切换选中不同流派时，仅在首次打开时重置流派位置，在切换流派时不重置
  const prevClickedGenreRef = React.useRef(null);
  React.useEffect(() => {
    if (clickedGenre && !prevClickedGenreRef.current) {
      setPosGenre({ x: 0, y: 0 });
    }
    prevClickedGenreRef.current = clickedGenre;
  }, [clickedGenre]);


  // 组件卸载时安全清理全局事件监听
  React.useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMoveGenre);
      window.removeEventListener('mouseup', handleMouseUpGenre);
      window.removeEventListener('mousemove', handleMouseMoveWord);
      window.removeEventListener('mouseup', handleMouseUpWord);
    };
  }, [handleMouseMove, handleMouseUp, handleMouseMoveGenre, handleMouseUpGenre, handleMouseMoveWord, handleMouseUpWord]);

  // 计算旭日图激活节点关联的所有流派名字（包含主流派旗下的所有子流派），支持悬停与点击锁定流派
  const hoveredGenres = React.useMemo(() => {
    const activeCategory = hoveredCategory || (clickedGenre ? clickedGenre.name : null);
    if (!activeCategory || !data || !data.sunburst) return [];
    
    const cleanHover = activeCategory.trim().toLowerCase();
    
    // 寻找匹配的主流派
    const matchedParent = data.sunburst.find(parent => {
      const cleanParentName = parent.name.split('\n')[0].trim().toLowerCase();
      return cleanParentName === cleanHover || parent.name.trim().toLowerCase() === cleanHover;
    });

    if (matchedParent) {
      const childrenNames = matchedParent.children 
        ? matchedParent.children.map(c => c.name.trim().toLowerCase()) 
        : [];
      const parentNameClean = matchedParent.name.split('\n')[0].trim().toLowerCase();
      return [parentNameClean, ...childrenNames];
    } else {
      return [cleanHover];
    }
  }, [hoveredCategory, clickedGenre, data]);

  // 核心逆向联动副作用：当用户点击歌曲列表中的歌曲时，自动反向检索该歌曲所属的流派，并同步高亮雷达与旭日图；取消选中时自动清空复位
  React.useEffect(() => {
    if (selectedSong && data && data.sunburst) {
      const songGenre = selectedSong[4]; // 提取歌曲的中文流派，例如 "另类摇滚"
      if (!songGenre) return;

      const cleanSongGenre = songGenre.trim().toLowerCase();

      // 在流派树（data.sunburst）中深入检索匹配 the 流派节点
      let foundGenreNode = null;
      for (const parent of data.sunburst) {
        if (parent.children) {
          const matchedChild = parent.children.find(child => 
            child.name.trim().toLowerCase() === cleanSongGenre
          );
          if (matchedChild) {
            foundGenreNode = {
              name: matchedChild.name,
              features: matchedChild.features,
              value: matchedChild.value,
              popularity: matchedChild.popularity
            };
            break;
          }
        }
        // 若子流派未匹配，尝试匹配主流派自身
        const cleanParentName = parent.name.split('\n')[0].trim().toLowerCase();
        if (cleanParentName === cleanSongGenre || parent.name.trim().toLowerCase() === cleanSongGenre) {
          foundGenreNode = {
            name: parent.name.split('\n')[0].trim(),
            features: parent.features
          };
          break;
        }
      }

      if (foundGenreNode) {
        // 1. 同步设置 selectedGenre，使雷达图秒切到该流派的声音维度画像
        setSelectedGenre(foundGenreNode);
        // 2. 同步设置 hoveredCategory，让左侧旭日图自动亮起当前流派，并联动星云图聚焦该流派群星！
        setHoveredCategory(foundGenreNode.name);
        setIsDetailExpanded(true); // 核心联动：选中新单曲时，自动向外弹开并展开详细信息面板！
      }
    } else {
      // 核心复位分支：当取消选中歌曲（selectedSong 为 null）时，清空流派选择，使雷达和旭日图瞬间消退恢复初始状态
      setSelectedGenre(null);
      setHoveredCategory(null);
    }
  }, [selectedSong, data, setSelectedGenre]);

  return (
    <div 
      style={{
        display: 'flex',
        position: 'relative', // 启用相对定位，作为绝对定位悬浮窗口的定位父基准！
        width: '100%',
        height: 'calc(100vh - 120px)', // 精准锁死一屏高度，减去头部与药丸导航高度，完全禁止外层滚动
        gap: '16px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* ==========================================
          🖥️ 左栏 (40% 宽度): 流派旭日分布窗格
          ========================================== */}
      <div 
        className="card"
        style={{
          flex: '0 0 40%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          border: '1px solid rgba(255, 255, 255, 0.75)',
          borderRadius: '20px',
          boxShadow: '0 8px 32px 0 rgba(145, 158, 171, 0.08)',
          padding: '20px',
          overflow: 'hidden',
          minWidth: 0
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(145,158,171,0.1)', paddingBottom: '10px', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '11.5px', color: '#1E293B', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🌀 流派分布结构</span>
          </h3>
          <span style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 'bold' }}>鼠标悬停/点击</span>
        </div>
        
        <div style={{ flexGrow: 1, minHeight: 0, width: '100%', position: 'relative' }}>
          <ToggleableChordRadar 
            viewMode="sunburst"
            selectedSong={selectedSong} // 传递单曲选中状态，以实现 ECharts 事件底层冻结
            clickedGenre={clickedGenre} // 传递流派锁定状态，实现点击冻结
            hoveredCategory={hoveredCategory}
            setHoveredCategory={setHoveredCategory}
            sunburstData={data.sunburst}
            graphData={data.graph}
            radarFeatures={radarData}
            radarName={radarName}
            indicatorNames={data.radar_features}
            featureMaxes={data.featureMaxes}
            scatterData={data.scatter}
            onNodeClick={(node) => {
              if (selectedSong || clickedGenre) return; // 歌曲或流派已锁定选中时冻结点击切换
              setSelectedGenre(node);
              setClickedGenre(node); // 点击触发流派小窗弹出！
            }} 
            onNodeHover={(node) => {
              if (selectedSong || clickedGenre) return; // 歌曲或流派已锁定选中时彻底冻结悬停，鼠标划过任何地方均不切换
              setSelectedGenre(node);
              setHoveredCategory(node ? node.name : null);
            }}
          />
        </div>
      </div>

      {/* ==========================================
          🖥️ 中栏 (38% 宽度): 雷达图 + KMeans图 上下布局
          ========================================== */}
      <div 
        style={{
          flex: '0 0 38%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          minWidth: 0
        }}
      >
        {/* 上子卡片: 雷达图 */}
        <div
          className="card"
          style={{
            height: 'calc(50% - 8px)',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            background: 'rgba(255, 255, 255, 0.45)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            border: '1px solid rgba(255, 255, 255, 0.75)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px 0 rgba(145, 158, 171, 0.08)',
            padding: '16px 20px',
            overflow: 'hidden',
            minWidth: 0
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(145,158,171,0.1)', paddingBottom: '6px', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '11.5px', color: '#1E293B', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🌀 流派声学特征七维雷达</span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 'bold' }}>实时相似流派对比</span>
              <button
                onClick={() => setIsCompareModalOpen(true)}
                style={{
                  border: 'none',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #FF8A9A 0%, #B088F5 100%)',
                  color: '#FFFFFF',
                  fontSize: '8.5px',
                  fontWeight: '800',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  boxShadow: '0 2px 6px rgba(176, 136, 245, 0.25)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-0.5px) scale(1.03)';
                  e.target.style.boxShadow = '0 4px 10px rgba(176, 136, 245, 0.38)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'none';
                  e.target.style.boxShadow = '0 2px 6px rgba(176, 136, 245, 0.25)';
                }}
              >
                📊 开启多流派对比
              </button>
            </div>
          </div>

          <div style={{ flexGrow: 1, minHeight: 0, width: '100%', position: 'relative' }}>
            <ToggleableChordRadar 
              viewMode="radar"
              selectedSong={selectedSong} // 传递单曲选中状态，以实现 ECharts 事件底层冻结
              clickedGenre={clickedGenre} // 传递流派锁定状态，实现点击冻结
              hoveredCategory={hoveredCategory}
              setHoveredCategory={setHoveredCategory}
              sunburstData={data.sunburst}
              graphData={data.graph}
              radarFeatures={radarData}
              radarName={radarName}
              indicatorNames={data.radar_features}
              featureMaxes={data.featureMaxes}
              scatterData={data.scatter}
              onNodeClick={(node) => {
                if (selectedSong || clickedGenre) return; // 歌曲或流派已锁定选中时冻结点击切换
                setSelectedGenre(node);
                setClickedGenre(node); // 点击触发流派小窗弹出！
              }} 
              onNodeHover={(node) => {
                if (selectedSong || clickedGenre) return; // 歌曲或流派已锁定选中时彻底冻结悬停，鼠标划过任何地方均不切换
                setSelectedGenre(node);
                setHoveredCategory(node ? node.name : null);
              }}
            />
          </div>
        </div>

        {/* 下子卡片: KMeans 星云聚类图 */}
        <div
          className="card"
          style={{
            height: 'calc(50% - 8px)',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            background: 'rgba(255, 255, 255, 0.45)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            border: '1px solid rgba(255, 255, 255, 0.75)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px 0 rgba(145, 158, 171, 0.08)',
            padding: '16px 20px',
            overflow: 'hidden',
            minWidth: 0
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(145,158,171,0.1)', paddingBottom: '6px', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '11.5px', color: '#1E293B', fontWeight: '800' }}>
              🌌 歌曲KMeans聚类与框选 （能量与愉悦度）
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setIsKMeansCompareOpen(true)}
                style={{
                  border: 'none',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6BBAA7 0%, #5B9BD5 100%)',
                  color: '#FFFFFF',
                  fontSize: '8.5px',
                  fontWeight: '800',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  boxShadow: '0 2px 6px rgba(91, 155, 213, 0.25)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-0.5px) scale(1.03)';
                  e.target.style.boxShadow = '0 4px 10px rgba(91, 155, 213, 0.38)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'none';
                  e.target.style.boxShadow = '0 2px 6px rgba(91, 155, 213, 0.25)';
                }}
              >
                📊 开启流派分布对比
              </button>
            </div>
          </div>

          <div style={{ flexGrow: 1, minHeight: 0, width: '100%', position: 'relative' }}>
            <ScatterBrushChart 
              data={data.scatter} 
              selectedSong={selectedSong}
              clickedGenre={clickedGenre} // 传递锁定的流派，用于在此状态下冰冻 KMeans 交互
              hoveredGenres={hoveredGenres}
              onBrush={(selectedIndices) => {
                if (clickedGenre) return; // 流派已锁定时冻结框选交互
                const selected = selectedIndices.map(i => data.scatter[i]);
                setBrushedData(selected);
                setSelectedSong(null);
              }} 
            />
          </div>
        </div>
      </div>

      {/* ==========================================
          🖥️ 右栏 (22% 宽度): 歌曲列表竖向长条卡片
          ========================================== */}
      <div 
        className="card"
        style={{
          flex: '0 0 22%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          border: '1px solid rgba(255, 255, 255, 0.75)',
          borderRadius: '20px',
          boxShadow: '0 8px 32px 0 rgba(145, 158, 171, 0.08)',
          padding: '20px',
          overflow: 'hidden',
          minWidth: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(145,158,171,0.1)', paddingBottom: '10px', marginBottom: '8px', minHeight: '32px', overflow: 'hidden' }}>
          <h3 style={{ margin: 0, fontSize: '11.5px', color: '#1E293B', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span>📋 歌曲列表</span>
            {clickedGenre && (() => {
              const showName = clickedGenre.name.split('\n')[0].trim();
              return (
                <span 
                  style={{ 
                    fontSize: '8px', 
                    color: '#B088F5', 
                    background: 'rgba(176, 136, 245, 0.1)', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    fontWeight: '800',
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={`当前筛选流派: ${showName}`}
                >
                  {showName}
                </span>
              );
            })()}
          </h3>
          {selectedSong && !isDetailExpanded && (
            <button
              onClick={() => setIsDetailExpanded(true)}
              style={{
                flexShrink: 0,
                border: '1px solid rgba(255, 94, 126, 0.4)',
                borderRadius: '12px',
                padding: '3px 8px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                boxShadow: '0 4px 12px rgba(255, 94, 126, 0.12)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                fontWeight: '800',
                color: '#FF5E7E',
                transition: 'all 0.3s ease',
                animation: 'pulse-pink 2s infinite ease-in-out',
                outline: 'none',
                marginLeft: '2px',
                position: 'relative',
                top: '1.5px'
              }}
            >
              <span style={{ fontSize: '10px' }}>🎵</span> 详情
            </button>
          )}
        </div>

        <div style={{ flexGrow: 1, minHeight: 0, width: '100%', position: 'relative' }}>
          <SongTable 
            songs={displayedSongs} 
            selectedSong={selectedSong}
            onSongClick={(song) => setSelectedSong(song)}
            isCompact={true} // 启用精简模式，确保在窄栏中文字呼吸顺畅绝不折行拥挤！
          />
        </div>
      </div>

      {/* 🔮 终极马卡龙极速抽屉：单曲多维信息深度透视悬浮窗 */}
      {selectedSong && (() => {
        const clusterNames = ['狂热释放', '轻松愉快', '伤感静谧', '阳光活力', '迷幻张力'];
        const clusterColors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F'];
        const i18n = {
          danceability: '可舞度',
          energy: '能量',
          acousticness: '声学度',
          valence: '愉悦度',
          liveness: '现场感',
          instrumentalness: '器乐度',
          speechiness: '言语度'
        };
        const getSongFeatureValue = (song, key) => {
          const mapping = {
            energy: song[0],
            valence: song[1],
            danceability: song[7] ?? 0.5,
            acousticness: song[8] ?? 0.3,
            liveness: song[9] ?? 0.18,
            instrumentalness: song[10] ?? 0.05,
            speechiness: song[11] ?? 0.06
          };
          return mapping[key] ?? 0.5;
        };
        return (
          <>
            {/* 水晶蔷薇粉呼吸脉冲灯 Keyframes 动画 */}
            <style>{`
              @keyframes pulse-pink {
                0% { box-shadow: 0 4px 12px rgba(255, 94, 126, 0.12); border-color: rgba(255, 94, 126, 0.4); }
                50% { box-shadow: 0 4px 18px rgba(255, 94, 126, 0.35); border-color: rgba(255, 94, 126, 0.8); }
                100% { box-shadow: 0 4px 12px rgba(255, 94, 126, 0.12); border-color: rgba(255, 94, 126, 0.4); }
              }
            `}</style>

            {/* 2. 歌曲多维信息高透玻璃微融悬浮窗（鼠标点到任意地方均可进行拖动，按钮除外） */}
            <div
              onMouseDown={handleMouseDown}
              style={{
                position: 'absolute',
                right: '23%',
                top: '55px',
                width: '270px',
                zIndex: 100,
                background: 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(20px) saturate(120%)',
                WebkitBackdropFilter: 'blur(20px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.85)',
                borderRadius: '20px',
                boxShadow: '0 12px 36px rgba(145, 158, 171, 0.18), 0 4px 16px rgba(0, 0, 0, 0.04)',
                padding: '18px',
                boxSizing: 'border-box',
                transition: isDragging 
                  ? 'opacity 0.4s ease' 
                  : 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                transformOrigin: 'right top', // 引力缩回至右上角查看详情按钮位置
                opacity: isDetailExpanded ? 1 : 0,
                transform: isDetailExpanded 
                  ? `scale(1) translate(${pos.x}px, ${pos.y}px)` 
                  : 'scale(0.05) translate(120px, -180px)',
                pointerEvents: isDetailExpanded ? 'auto' : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                touchAction: 'none'
              }}
            >
              {/* 头部：歌曲标题、歌手与关闭叉键 */}
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  borderBottom: '1px solid rgba(145, 158, 171, 0.12)', 
                  paddingBottom: '8px'
                }}
              >
                <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={selectedSong[2]}>
                    🎵 {selectedSong[2]}
                  </h4>
                  <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 'bold', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    🎤 {selectedSong[3]}
                  </div>
                </div>
                <button
                  onClick={() => setIsDetailExpanded(false)}
                  title="折叠收起面板"
                  style={{
                    border: 'none',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    background: 'rgba(241, 165, 180, 0.15)',
                    color: '#F1A5B4',
                    fontSize: '9px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    outline: 'none',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => { e.target.style.background = 'rgba(255, 94, 126, 0.2)'; e.target.style.color = '#FF5E7E'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'rgba(241, 165, 180, 0.15)'; e.target.style.color = '#F1A5B4'; }}
                >
                  ✖
                </button>
              </div>

              {/* 流派、聚类群与单曲真实流行度标签 */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid rgba(145, 158, 171, 0.08)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '9px', background: 'rgba(168, 216, 185, 0.18)', color: '#88B04B', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                  🌀 {selectedSong[4]}
                </span>
                <span style={{ 
                  fontSize: '9px', 
                  background: `rgba(${parseInt(clusterColors[selectedSong[5] % clusterColors.length].slice(1,3), 16)}, ${parseInt(clusterColors[selectedSong[5] % clusterColors.length].slice(3,5), 16)}, ${parseInt(clusterColors[selectedSong[5] % clusterColors.length].slice(5,7), 16)}, 0.15)`, 
                  color: clusterColors[selectedSong[5] % clusterColors.length], 
                  padding: '2px 8px', 
                  borderRadius: '10px', 
                  fontWeight: 'bold' 
                }}>
                  🧪 {clusterNames[selectedSong[5]] || '未知群组'}
                </span>
                <span style={{ 
                  fontSize: '9px', 
                  background: (selectedSong[6] ?? 40) === 0 ? 'rgba(148, 163, 184, 0.12)' : 'rgba(129, 199, 132, 0.15)', 
                  color: (selectedSong[6] ?? 40) === 0 ? '#94A3B8' : '#81C784', 
                  padding: '2px 8px', 
                  borderRadius: '10px', 
                  fontWeight: 'bold' 
                }}>
                  📈 流行度: {(selectedSong[6] ?? 40) === 0 ? '<1%' : `${Math.round(selectedSong[6])}%`}
                </span>
              </div>

              {/* 💡 极其清爽的微型三色雷达图例（对应雷达图内的线圈样式） */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', fontSize: '8.5px', color: '#64748B', fontWeight: 'bold', borderBottom: '1px solid rgba(145, 158, 171, 0.08)', paddingBottom: '8px', marginTop: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'rgba(255, 94, 126, 0.22)', border: '1.5px solid #FF5E7E', borderRadius: '2px' }} />
                  <span>本歌</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '0px', borderTop: '1.5px dashed #A2CBE6' }} />
                  <span>同流派均值</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '0px', borderTop: '1.5px solid #81C784' }} />
                  <span>同聚类均值</span>
                </div>
              </div>

              {/* 🌀 微型三色重叠声学指纹雷达图 (7维声音基因) */}
              <div style={{ width: '100%', height: '220px', position: 'relative', marginTop: '8px' }}>
                <ReactECharts
                  style={{ width: '100%', height: '100%' }}
                  option={{
                    backgroundColor: 'transparent',
                    grid: { left: 0, right: 0, top: 0, bottom: 0 },
                    tooltip: {
                      show: true,
                      appendToBody: true,
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderColor: '#EEEEEE',
                      textStyle: { color: '#333333', fontSize: 10 },
                      padding: 8,
                      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px;'
                    },
                    radar: {
                      indicator: (data.radar_features || []).map(key => ({
                        name: i18n[key] || key,
                        max: data.featureMaxes && data.featureMaxes[key] ? Math.max(data.featureMaxes[key] * 1.25, 0.9) : 1.0
                      })),
                      shape: 'polygon',
                      radius: '74%',
                      center: ['50%', '50%'],
                      axisName: {
                        color: '#64748B',
                        fontSize: 8.5,
                        fontWeight: 'bold',
                        padding: [-4, -4]
                      },
                      splitArea: { show: false },
                      splitLine: { lineStyle: { color: 'rgba(145,158,171,0.12)' } },
                      axisLine: { lineStyle: { color: 'rgba(145,158,171,0.12)' } }
                    },
                    series: [{
                      type: 'radar',
                      data: [
                        {
                          value: (data.radar_features || []).map(key => getSongFeatureValue(selectedSong, key)),
                          name: '本歌',
                          itemStyle: { color: '#FF5E7E' },
                          lineStyle: { width: 2, color: '#FF5E7E' },
                          areaStyle: { color: 'rgba(255, 94, 126, 0.22)' }
                        },
                        {
                          value: (data.radar_features || []).map(key => selectedGenre?.features?.[key] ?? 0.5),
                          name: '同流派均值',
                          itemStyle: { color: '#A2CBE6' },
                          lineStyle: { width: 1.5, type: 'dashed', color: '#A2CBE6' },
                          symbol: 'none'
                        },
                        {
                          value: (data.radar_features || []).map(key => clusterMeans[selectedSong[5]]?.[key] ?? 0.5),
                          name: '同聚类均值',
                          itemStyle: { color: '#81C784' },
                          lineStyle: { width: 1.5, color: '#81C784' },
                          symbol: 'none'
                        }
                      ]
                    }]
                  }}
                />
              </div>
            </div>
          </>
        );
      })()}

      {/* 🔮 终极马卡龙极速抽屉：流派历史与文化画像悬浮舱 */}
      {clickedGenre && (() => {
        const genreNameClean = clickedGenre.name.split('\n')[0].trim();
        const detail = genreDetails ? genreDetails[genreNameClean] : null;

        return (
          <>
            <div
              onMouseDown={handleMouseDownGenre}
              style={{
                position: 'absolute',
                left: '20px',
                bottom: '20px',
                width: '280px',
                zIndex: 101,
                background: 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(20px) saturate(120%)',
                WebkitBackdropFilter: 'blur(20px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.85)',
                borderRadius: '20px',
                boxShadow: '0 12px 36px rgba(145, 158, 171, 0.18), 0 4px 16px rgba(0, 0, 0, 0.04)',
                padding: '16px',
                boxSizing: 'border-box',
                transition: isDraggingGenre ? 'opacity 0.4s ease' : 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                transformOrigin: 'left bottom',
                transform: `scale(1) translate(${posGenre.x}px, ${posGenre.y}px)`,
                cursor: isDraggingGenre ? 'grabbing' : 'grab',
                userSelect: 'none',
                touchAction: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* 头部：流派中文名与关闭叉键 */}
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  borderBottom: '1px solid rgba(145, 158, 171, 0.12)', 
                  paddingBottom: '8px'
                }}
              >
                <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '12.5px', fontWeight: '800', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    🌀 {genreNameClean} 画像
                  </h4>
                </div>
                <button
                  onClick={() => {
                    setClickedGenre(null);
                  }}
                  title="收起流派画像"
                  style={{
                    border: 'none',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    background: 'rgba(255, 94, 126, 0.12)',
                    color: '#FF5E7E',
                    fontSize: '9px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    outline: 'none',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => { e.target.style.background = 'rgba(255, 94, 126, 0.25)'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'rgba(255, 94, 126, 0.12)'; }}
                >
                  ✖
                </button>
              </div>

              {/* 🧬 1. 流派专属歌名词云（胶囊标签云 - 优化版，大小层次更加鲜明分立） */}
              <div>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '800', marginBottom: '6px' }}>
                  🧬 核心歌名特征词云
                </div>
                {detail && detail.words && detail.words.length > 0 ? (
                  <div 
                    style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '5px', 
                      maxHeight: '90px', 
                      overflowY: 'auto', 
                      padding: '6px',
                      background: 'rgba(145, 158, 171, 0.04)',
                      borderRadius: '12px',
                      border: '1px solid rgba(145, 158, 171, 0.06)'
                    }}
                  >
                    {detail.words.slice(0, 20).map((item, idx) => {
                      let fontSize = '8.5px';
                      let fontWeight = '500';
                      if (idx < 3) {
                        fontSize = '14.5px';
                        fontWeight = '800';
                      } else if (idx < 8) {
                        fontSize = '11.5px';
                        fontWeight = '700';
                      } else if (idx < 14) {
                        fontSize = '9.5px';
                        fontWeight = '600';
                      }

                      // 经典又充满品质感的柔和马卡龙配色
                      const colors = [
                        '#FF8A9A', // 甜美蔷薇粉
                        '#6BBAA7', // 薄荷复古绿
                        '#5B9BD5', // 晴空澄澈蓝
                        '#B088F5', // 梦幻薰衣紫
                        '#EDC948', // 阳光浅柠檬黄
                        '#F28E2B', // 柔和珊瑚橙
                        '#86BCB6'  // 莫兰迪青灰
                      ];
                      const wordColor = colors[idx % colors.length];

                      return (
                        <span
                          key={item.name}
                          onClick={() => setClickedWord(item.name)}
                          style={{
                            fontSize: fontSize,
                            color: wordColor,
                            fontWeight: fontWeight,
                            padding: idx < 3 ? '4px 9px' : (idx < 8 ? '3px 7px' : '2px 5px'),
                            background: 'rgba(255, 255, 255, 0.88)',
                            border: '1px solid rgba(255, 255, 255, 0.5)',
                            borderRadius: '8px',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            userSelect: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-1px) scale(1.06)';
                            e.target.style.background = '#FFFFFF';
                            e.target.style.borderColor = wordColor;
                            e.target.style.boxShadow = `0 4px 10px rgba(0, 0, 0, 0.06), 0 2px 4px ${wordColor}15`;
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'none';
                            e.target.style.background = 'rgba(255, 255, 255, 0.88)';
                            e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                            e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.03)';
                          }}
                        >
                          {item.name}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '9.5px', color: '#94A3B8', padding: '10px', textAlign: 'center' }}>
                    ⏳ 正在计算该流派声学词频...
                  </div>
                )}
              </div>

              {/* 📈 2. 流派流行度随年份变迁折线图 */}
              <div>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '800', marginBottom: '4px' }}>
                  📈 流派历代流行度变迁 (1960-2020)
                </div>
                {detail && detail.timeline ? (
                  <div style={{ width: '100%', height: '110px' }}>
                    <ReactECharts
                      style={{ width: '100%', height: '100%' }}
                      option={{
                        backgroundColor: 'transparent',
                        grid: { left: 5, right: 5, top: 22, bottom: 5, containLabel: true },
                        legend: {
                          show: true,
                          top: 0,
                          icon: 'circle',
                          itemWidth: 5,
                          itemHeight: 5,
                          itemGap: 6,
                          textStyle: { fontSize: 8, color: '#64748B', fontFamily: '"Outfit", "Inter", sans-serif' }
                        },
                        tooltip: {
                          show: true,
                          trigger: 'axis',
                          appendToBody: true,
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          borderColor: '#EEEEEE',
                          padding: [5, 8],
                          textStyle: { color: '#333333', fontSize: 9, fontFamily: '"Outfit", "Inter", sans-serif' },
                          extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-radius: 5px;',
                          formatter: function(params) {
                            let html = `<div style="font-weight:bold; font-size:9.5px; margin-bottom:3px; color:#1E293B;">📅 ${params[0].name}年</div>`;
                            params.forEach(p => {
                              html += `<div style="font-size:9px; display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:2px;">
                                <div style="display:flex; align-items:center; gap:3px; color:#64748B;">
                                  <span style="display:inline-block; width:5px; height:5px; border-radius:50%; background-color:${p.color};"></span>
                                  ${p.seriesName}
                                </div>
                                <span style="font-weight:800; color:#1E293B;">${p.value}%</span>
                              </div>`;
                            });
                            return html;
                          }
                        },
                        xAxis: {
                          type: 'category',
                          data: detail.timeline.map(item => item.year),
                          axisLine: { show: false },
                          axisTick: { show: false },
                          axisLabel: {
                            color: '#94A3B8',
                            fontSize: 7.5,
                            fontWeight: 'bold',
                            margin: 5
                          }
                        },
                        yAxis: {
                          type: 'value',
                          splitLine: { show: false },
                          axisLine: { show: false },
                          axisLabel: { show: false }
                        },
                        series: [
                          {
                            name: '本流派',
                            data: detail.timeline.map(item => item.popularity),
                            type: 'line',
                            smooth: true,
                            symbol: 'circle',
                            symbolSize: 4,
                            showSymbol: false,
                            itemStyle: { color: '#FF5E7E' },
                            lineStyle: { width: 2, color: '#FF5E7E' },
                            areaStyle: {
                              color: {
                                type: 'linear',
                                x: 0, y: 0, x2: 0, y2: 1,
                                colorStops: [
                                  { offset: 0, color: 'rgba(255, 94, 126, 0.2)' },
                                  { offset: 1, color: 'rgba(255, 94, 126, 0.0)' }
                                ]
                              }
                            }
                          },
                          {
                            name: `大类 (${detail.parentName || '大类'})`,
                            data: detail.parentTimeline ? detail.parentTimeline.map(item => item.popularity) : detail.timeline.map(item => item.popularity),
                            type: 'line',
                            smooth: true,
                            symbol: 'circle',
                            symbolSize: 3,
                            showSymbol: false,
                            itemStyle: { color: '#88B04B' },
                            lineStyle: { width: 1.2, type: 'dashed', color: '#88B04B' }
                          },
                          {
                            name: '大盘均值',
                            data: detail.globalTimeline ? detail.globalTimeline.map(item => item.popularity) : detail.timeline.map(item => item.popularity),
                            type: 'line',
                            smooth: true,
                            symbol: 'circle',
                            symbolSize: 3,
                            showSymbol: false,
                            itemStyle: { color: '#A2CBE6' },
                            lineStyle: { width: 1.2, type: 'dashed', color: '#A2CBE6' }
                          }
                        ]
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: '9.5px', color: '#94A3B8', padding: '10px', textAlign: 'center' }}>
                    ⏳ 正在追溯历史数据...
                  </div>
                )}
              </div>

              {/* 左右流派切换微动小箭头 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwitchGenre('prev');
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title="上一个流派 (逆时针)"
                style={{
                  position: 'absolute',
                  left: '-16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(145, 158, 171, 0.2)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                  color: '#64748B',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  outline: 'none',
                  zIndex: 102
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#FFFFFF';
                  e.target.style.color = '#B088F5';
                  e.target.style.transform = 'translateY(-50%) scale(1.08)';
                  e.target.style.boxShadow = '0 6px 16px rgba(176, 136, 245, 0.2)';
                  e.target.style.borderColor = '#B088F5';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                  e.target.style.color = '#64748B';
                  e.target.style.transform = 'translateY(-50%) scale(1)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  e.target.style.borderColor = 'rgba(145, 158, 171, 0.2)';
                }}
              >
                ◀
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwitchGenre('next');
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title="下一个流派 (顺时针)"
                style={{
                  position: 'absolute',
                  right: '-16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(145, 158, 171, 0.2)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                  color: '#64748B',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  outline: 'none',
                  zIndex: 102
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#FFFFFF';
                  e.target.style.color = '#B088F5';
                  e.target.style.transform = 'translateY(-50%) scale(1.08)';
                  e.target.style.boxShadow = '0 6px 16px rgba(176, 136, 245, 0.2)';
                  e.target.style.borderColor = '#B088F5';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                  e.target.style.color = '#64748B';
                  e.target.style.transform = 'translateY(-50%) scale(1)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  e.target.style.borderColor = 'rgba(145, 158, 171, 0.2)';
                }}
              >
                ▶
              </button>
            </div>
          </>
        );
      })()}

      {/* 📝 歌词词频点击深度分析拖拽悬浮窗 */}
      {clickedWord && wordAnalysisData && (
        <div
          onMouseDown={handleMouseDownWord}
          style={{
            position: 'absolute',
            left: '320px',
            bottom: '20px',
            width: '430px',
            height: '280px',
            zIndex: 102,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(25px) saturate(130%)',
            WebkitBackdropFilter: 'blur(25px) saturate(130%)',
            border: '1px solid rgba(255, 255, 255, 0.9)',
            borderRadius: '20px',
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12), 0 4px 16px rgba(0, 0, 0, 0.03)',
            padding: '16px',
            boxSizing: 'border-box',
            transition: isDraggingWord ? 'opacity 0.4s ease' : 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: `translate(${posWord.x}px, ${posWord.y}px)`,
            cursor: isDraggingWord ? 'grabbing' : 'grab',
            userSelect: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {/* 头部：标题与关闭按钮 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(145, 158, 171, 0.12)',
              paddingBottom: '6px',
              flexShrink: 0
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '11.5px', fontWeight: '800', color: '#0F172A' }}>
                🔤 歌名中词汇「{clickedWord}」流派与情感全维透视
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '8px', color: '#94A3B8' }}>
                基于所含流派歌曲中词频总数 {wordAnalysisData.totalFreq} 次的加权特征映射
              </p>
            </div>
            <button
              onClick={() => setClickedWord(null)}
              title="关闭分析"
              style={{
                border: 'none',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                background: 'rgba(255, 94, 126, 0.1)',
                color: '#FF5E7E',
                fontSize: '9px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              ✕
            </button>
          </div>

          {/* 可视化核心内容：左右分栏 */}
          <div style={{ display: 'flex', flexGrow: 1, minHeight: 0, gap: '10px' }}>
            
            {/* 左半部分：流派亲和度分析（玫瑰图） */}
            <div 
              style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                borderRight: '1px solid rgba(145, 158, 171, 0.08)',
                paddingRight: '6px'
              }}
            >
              <div style={{ fontSize: '8px', color: '#64748B', fontWeight: '800', marginBottom: '2px' }}>
                🌹 1. 流派词频分布
              </div>
              <div style={{ flexGrow: 1, minHeight: 0, width: '100%' }}>
                <ReactECharts
                  style={{ width: '100%', height: '100%' }}
                  option={getWordGenreOption()}
                  notMerge={true}
                />
              </div>
            </div>

            {/* 右半部分：声学情感指纹图（极坐标单轴柱状图） */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '8px', color: '#64748B', fontWeight: '800', marginBottom: '2px' }}>
                🧪 2. 声学维度分布
              </div>
              <div style={{ flexGrow: 1, minHeight: 0, width: '100%' }}>
                <ReactECharts
                  style={{ width: '100%', height: '100%' }}
                  option={getWordAcousticOption()}
                  notMerge={true}
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 📊 流派声学特征横向大对比弹窗 */}
      {isCompareModalOpen && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          <div
            style={{
              width: '860px',
              height: '560px',
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(30px) saturate(140%)',
              border: '1px solid rgba(255, 255, 255, 0.85)',
              borderRadius: '24px',
              boxShadow: '0 24px 50px rgba(15, 23, 42, 0.12), 0 4px 20px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
              boxSizing: 'border-box',
              position: 'relative'
            }}
          >
            {/* 头部 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(145, 158, 171, 0.12)',
                paddingBottom: '14px',
                marginBottom: '16px',
                flexShrink: 0
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '13px', fontWeight: '900', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  跨流派声学维度对比
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '9.5px', color: '#64748B', fontWeight: 'bold' }}>
                  支持任意勾选 2 到 4 个流派类别（大类及子流派）
                </p>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                title="关闭对比窗口"
                style={{
                  border: 'none',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  background: 'rgba(255, 94, 126, 0.1)',
                  color: '#FF5E7E',
                  fontSize: '12px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseEnter={(e) => { e.target.style.background = 'rgba(255, 94, 126, 0.22)'; }}
                onMouseLeave={(e) => { e.target.style.background = 'rgba(255, 94, 126, 0.1)'; }}
              >
                ✖
              </button>
            </div>

            {/* 左右分栏 */}
            <div style={{ display: 'flex', gap: '20px', flexGrow: 1, minHeight: 0 }}>
              
              {/* 左栏：选择列表 */}
              <div
                style={{
                  width: '350px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderRight: '1px solid rgba(145, 158, 171, 0.12)',
                  paddingRight: '20px',
                  boxSizing: 'border-box'
                }}
              >
                {/* 滚动流派列表 */}
                <div
                  style={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    paddingRight: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {(() => {
                    const grouped = {};
                    compareGenresList.forEach(g => {
                      if (!grouped[g.category]) {
                        grouped[g.category] = [];
                      }
                      grouped[g.category].push(g);
                    });

                    return Object.keys(grouped).map(catName => {
                      return (
                        <div key={catName} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '9.5px', color: '#1E293B', fontWeight: '800', borderLeft: '3px solid #B088F5', paddingLeft: '5px', lineHeight: 1 }}>
                            {catName}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {grouped[catName].map(genre => {
                              const isSelected = selectedCompareGenres.some(sg => sg.id === genre.id);
                              const isDisabled = !isSelected && selectedCompareGenres.length >= 4;

                              let btnBg = 'rgba(145, 158, 171, 0.04)';
                              let btnBorder = '1px solid rgba(145, 158, 171, 0.08)';
                              let btnColor = '#64748B';

                              if (isSelected) {
                                btnBg = 'rgba(176, 136, 245, 0.12)';
                                btnBorder = '1px solid #B088F5';
                                btnColor = '#B088F5';
                              } else if (isDisabled) {
                                btnBg = 'transparent';
                                btnBorder = '1px dashed rgba(145, 158, 171, 0.08)';
                                btnColor = '#CBD5E1';
                              }

                              return (
                                <button
                                  key={genre.id}
                                  disabled={isDisabled}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedCompareGenres(selectedCompareGenres.filter(sg => sg.id !== genre.id));
                                    } else {
                                      if (selectedCompareGenres.length < 4) {
                                        setSelectedCompareGenres([...selectedCompareGenres, genre]);
                                      }
                                    }
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    background: btnBg,
                                    border: btnBorder,
                                    color: btnColor,
                                    fontSize: genre.isParent ? '9.5px' : '8.5px',
                                    fontWeight: genre.isParent ? '800' : '600',
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                >
                                  <span>{genre.isParent ? '🏷️' : '🔹'}</span>
                                  {genre.displayName}
                                  {isSelected && <span style={{ fontSize: '8px', background: '#B088F5', color: '#FFF', borderRadius: '50%', width: '10px', height: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 右栏：对比雷达图 */}
              <div
                style={{
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxSizing: 'border-box'
                }}
              >
                {selectedCompareGenres.length >= 2 ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                    {/* 已选流派展示 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px', flexShrink: 0, justifyContent: 'center' }}>
                      {selectedCompareGenres.map((sg, idx) => {
                        const colors = ['#FF5E7E', '#4DABF7', '#51CF66', '#FCC419'];
                        return (
                          <div
                            key={sg.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: 'rgba(255, 255, 255, 0.9)',
                              border: `1px solid ${colors[idx % colors.length]}`,
                              fontSize: '9px',
                              fontWeight: 'bold',
                              color: colors[idx % colors.length],
                              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors[idx % colors.length] }}></span>
                            {sg.name}
                            <button
                              onClick={() => setSelectedCompareGenres(selectedCompareGenres.filter(g => g.id !== sg.id))}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#94A3B8',
                                cursor: 'pointer',
                                fontSize: '8px',
                                padding: 0,
                                outline: 'none'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* 🧬 声学相似度显示 */}
                    {genreSimilarity !== null && (
                      <div 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          margin: '2px auto 8px auto',
                          padding: '4px 12px',
                          background: '#F8FAFC',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          fontSize: '10px',
                          color: '#64748B',
                          flexShrink: 0
                        }}
                      >
                        <span>🧬 选中流派声学维度相似度:</span>
                        <strong 
                          style={{ 
                            fontSize: '12px', 
                            color: '#0F172A',
                            fontFamily: '"Outfit", "Inter", sans-serif'
                          }}
                        >
                          {genreSimilarity.toFixed(1)}%
                        </strong>
                        <span style={{ fontSize: '9px', color: '#94A3B8', marginLeft: '4px' }}>
                          ({genreSimilarity >= 88 ? '高度相似' : genreSimilarity >= 70 ? '中度相似' : '差异显著'})
                        </span>
                      </div>
                    )}

                    {/* 雷达图渲染 */}
                    <div style={{ flexGrow: 1, minHeight: 0, width: '100%' }}>
                      <ReactECharts
                        style={{ width: '100%', height: '100%' }}
                        option={getCompareRadarOption()}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#94A3B8', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px' }}>📊</div>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
                      请在左侧勾选至少 2 个流派进行对比
                    </div>
                    <div style={{ fontSize: '9px', color: '#CBD5E1', maxWidth: '240px' }}>
                      您可以选择代表性的大分类（如“流行”）与小流派（如“韩国流行”），横向映射，洞察它们的声学特性倾斜。
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 📊 KMeans 流派星云聚类对比弹窗（含歌曲列表） */}
      {isKMeansCompareOpen && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          <div
            style={{
              width: '1000px',
              height: '660px',
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(30px) saturate(140%)',
              border: '1px solid rgba(255, 255, 255, 0.85)',
              borderRadius: '24px',
              boxShadow: '0 24px 50px rgba(15, 23, 42, 0.12), 0 4px 20px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
              boxSizing: 'border-box',
              position: 'relative'
            }}
          >
            {/* 头部 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(145, 158, 171, 0.12)',
                paddingBottom: '14px',
                marginBottom: '16px',
                flexShrink: 0
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '13px', fontWeight: '900', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  跨流派 KMeans 聚类情感分布对比
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '9.5px', color: '#64748B', fontWeight: 'bold' }}>
                  自主选择 2 到 4 个流派类别，展示它们在 能量vs愉悦度 双维度情感象限的散点分布对比
                </p>
              </div>
              <button
                onClick={() => setIsKMeansCompareOpen(false)}
                title="关闭对比窗口"
                style={{
                  border: 'none',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  background: 'rgba(255, 94, 126, 0.1)',
                  color: '#FF5E7E',
                  fontSize: '12px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseEnter={(e) => { e.target.style.background = 'rgba(255, 94, 126, 0.22)'; }}
                onMouseLeave={(e) => { e.target.style.background = 'rgba(255, 94, 126, 0.1)'; }}
              >
                ✖
              </button>
            </div>

            {/* 三栏流式布局 */}
            <div style={{ display: 'flex', gap: '16px', flexGrow: 1, minHeight: 0 }}>
              
              {/* 🖥️ 左栏 (200px): 流派勾选列表 */}
              <div
                style={{
                  width: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  borderRight: '1px solid rgba(145, 158, 171, 0.12)',
                  paddingRight: '16px',
                  boxSizing: 'border-box',
                  flexShrink: 0
                }}
              >
                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '900', marginBottom: '2px' }}>
                  🎯 请勾选 2 到 4 个流派对比
                </div>

                {/* 滚动流派列表 */}
                <div
                  style={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    paddingRight: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  {(() => {
                    const grouped = {};
                    compareGenresList.forEach(g => {
                      if (!grouped[g.category]) {
                        grouped[g.category] = [];
                      }
                      grouped[g.category].push(g);
                    });

                    return Object.keys(grouped).map(catName => {
                      return (
                        <div key={catName} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <div style={{ fontSize: '9px', color: '#1E293B', fontWeight: '800', borderLeft: '3px solid #6BBAA7', paddingLeft: '5px', lineHeight: 1 }}>
                            {catName}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {grouped[catName].map(genre => {
                              const isSelected = selectedKMeansGenres.some(sg => sg.id === genre.id);
                              const isDisabled = !isSelected && selectedKMeansGenres.length >= 4;

                              let btnBg = 'rgba(145, 158, 171, 0.04)';
                              let btnBorder = '1px solid rgba(145, 158, 171, 0.08)';
                              let btnColor = '#64748B';

                              if (isSelected) {
                                btnBg = 'rgba(107, 186, 167, 0.12)';
                                btnBorder = '1px solid #6BBAA7';
                                btnColor = '#6BBAA7';
                              } else if (isDisabled) {
                                btnBg = 'transparent';
                                btnBorder = '1px dashed rgba(145, 158, 171, 0.08)';
                                btnColor = '#CBD5E1';
                              }

                              return (
                                <button
                                  key={genre.id}
                                  disabled={isDisabled}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedKMeansGenres(selectedKMeansGenres.filter(sg => sg.id !== genre.id));
                                    } else {
                                      if (selectedKMeansGenres.length < 4) {
                                        setSelectedKMeansGenres([...selectedKMeansGenres, genre]);
                                      }
                                    }
                                  }}
                                  style={{
                                    padding: '3px 6px',
                                    borderRadius: '5px',
                                    background: btnBg,
                                    border: btnBorder,
                                    color: btnColor,
                                    fontSize: genre.isParent ? '9px' : '8px',
                                    fontWeight: genre.isParent ? '800' : '600',
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                  }}
                                >
                                  <span>{genre.isParent ? '🏷️' : '🔹'}</span>
                                  {genre.displayName}
                                  {isSelected && <span style={{ fontSize: '7.5px', background: '#6BBAA7', color: '#FFF', borderRadius: '50%', width: '9px', height: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 🖥️ 中栏 (500px): 散点图 + 堆叠构成图 */}
              <div
                style={{
                  width: '500px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  borderRight: '1px solid rgba(145, 158, 171, 0.12)',
                  paddingRight: '16px'
                }}
              >
                {selectedKMeansGenres.length >= 2 ? (
                  <>
                    {/* 已选流派极光触板图例 */}
                    {/* 已选流派标识图例 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flexShrink: 0, justifyContent: 'center' }}>
                      {selectedKMeansGenres.map((sg, idx) => {
                        const colors = ['#FF5E7E', '#4DABF7', '#51CF66', '#FCC419'];
                        const activeColor = colors[idx % colors.length];

                        return (
                          <div
                            key={sg.id}
                            onMouseEnter={() => {
                              setHoveredKMeansGenreId(sg.id);
                            }}
                            onMouseLeave={() => {
                              setHoveredKMeansGenreId(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              background: hoveredKMeansGenreId === sg.id ? `${activeColor}0A` : 'rgba(255, 255, 255, 0.9)',
                              border: hoveredKMeansGenreId === sg.id ? `1px solid ${activeColor}` : `1px solid rgba(145, 158, 171, 0.18)`,
                              fontSize: '9px',
                              fontWeight: 'bold',
                              color: hoveredKMeansGenreId === sg.id ? '#0F172A' : '#475569',
                              boxShadow: hoveredKMeansGenreId === sg.id ? `0 4px 12px ${activeColor}15` : '0 2px 4px rgba(0,0,0,0.01)',
                              transform: hoveredKMeansGenreId === sg.id ? 'translateY(-1px) scale(1.03)' : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              userSelect: 'none'
                            }}
                          >
                            {/* 流派专属彩色圆点标识 */}
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: activeColor, marginRight: '1px', display: 'inline-block' }}></span>
                            {sg.name}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedKMeansGenres(selectedKMeansGenres.filter(g => g.id !== sg.id));
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#94A3B8',
                                cursor: 'pointer',
                                fontSize: '8px',
                                padding: 0,
                                outline: 'none',
                                marginLeft: '3px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="移除此流派"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* 对比散点图 (同心圆双层编码) */}
                    <div style={{ height: '250px', width: '100%', flexShrink: 0 }}>
                      <ReactECharts
                        ref={kmeansChartRef}
                        style={{ width: '100%', height: '100%' }}
                        option={getKMeansCompareOption()}
                        notMerge={true}
                      />
                    </div>

                    {/* 下半部分：聚类成分构成比例 100% 堆叠图 */}
                    <div style={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '9px', color: '#64748B', fontWeight: '800', borderLeft: '3px solid #6BBAA7', paddingLeft: '5px', lineHeight: 1 }}>
                        各流派的聚类情感成分构成
                      </div>
                      <div style={{ flexGrow: 1, minHeight: 0, width: '100%' }}>
                        <ReactECharts
                          style={{ width: '100%', height: '100%' }}
                          option={getKMeansCompositionOption()}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#94A3B8', textAlign: 'center', height: '100%', justifyContent: 'center' }}>
                    <div style={{ fontSize: '32px' }}>🌌</div>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>请在左侧勾选至少 2 个流派</div>
                  </div>
                )}
              </div>

              {/* 🖥️ 右栏 (230px): 歌曲明细表格竖向滚动 */}
              <div
                style={{
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxSizing: 'border-box',
                  minWidth: 0,
                  height: '100%'
                }}
              >
                {selectedKMeansGenres.length >= 2 ? (
                  <>
                    <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '800', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>📋 选中流派高热度代表单曲</span>
                      <span style={{ fontSize: '8px', color: '#94A3B8', fontWeight: 'normal' }}>显示前 100 首</span>
                    </div>
                    <div style={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', border: '1px solid rgba(145, 158, 171, 0.12)', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.5)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', textAlign: 'left', tableLayout: 'fixed' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#F8FAFC', zIndex: 1, borderBottom: '1px solid rgba(145, 158, 171, 0.12)' }}>
                          <tr>
                            <th style={{ padding: '6px 8px', color: '#64748B', fontWeight: '800', width: '22px' }}>#</th>
                            <th style={{ padding: '6px 8px', color: '#64748B', fontWeight: '800' }}>歌名 / 歌手</th>
                            <th style={{ padding: '6px 8px', color: '#64748B', fontWeight: '800', width: '68px', textAlign: 'right' }}>流行度</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kMeansCompareSongs.slice(0, 100).map((song, idx) => {
                            const clusterColors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F'];
                            const clusterIdx = song[5];
                            const dotColor = (clusterIdx >= 0 && clusterIdx < 5) ? clusterColors[clusterIdx] : '#94A3B8';

                            // 匹配流派标识色彩
                            const matchedGenreIdx = selectedKMeansGenres.findIndex(cg => isSongInGenre(song, cg));
                            const colors = ['#FF5E7E', '#4DABF7', '#51CF66', '#FCC419'];
                            const activeColor = matchedGenreIdx !== -1 ? colors[matchedGenreIdx % colors.length] : '#94A3B8';

                            return (
                              <tr 
                                key={`kmsong-${idx}`}
                                style={{ 
                                  borderBottom: '1px solid rgba(145, 158, 171, 0.05)',
                                  transition: 'background 0.2s',
                                  opacity: 1
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(145, 158, 171, 0.03)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                <td style={{ padding: '6px 8px', color: '#94A3B8', fontWeight: 'bold' }}>{idx + 1}</td>
                                <td style={{ padding: '6px 8px', overflow: 'hidden' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '100%' }}>
                                    {/* 流派色圆点 */}
                                    <span 
                                      style={{ 
                                        width: '6px', 
                                        height: '6px', 
                                        borderRadius: '50%', 
                                        background: activeColor,
                                        border: '0.6px solid rgba(255,255,255,0.7)',
                                        flexShrink: 0 
                                      }} 
                                    ></span>
                                    {/* 聚类色小圆点 */}
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor, flexShrink: 0 }}></span>
                                    {/* 流派专属彩色小胶囊 */}
                                    <span style={{ fontSize: '8px', color: activeColor, fontWeight: '800', flexShrink: 0, padding: '1px 4px', background: `${activeColor}10`, borderRadius: '3px' }}>{song[4]}</span>
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', marginLeft: '2px' }}>
                                      <div style={{ fontWeight: '800', color: '#1E293B', fontSize: '9px' }} title={song[2]}>{song[2]}</div>
                                      <div style={{ color: '#94A3B8', fontSize: '8px' }} title={song[3]}>{song[3]}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#1E293B' }}>{song[6] ?? 0}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#94A3B8', textAlign: 'center', height: '100%', justifyContent: 'center' }}>
                    <div style={{ fontSize: '9px', color: '#CBD5E1', maxWidth: '200px' }}>
                      在左侧勾选流派后，此处将以滚动列表形式呈现这几个流派的歌曲排行。
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CockpitView;
