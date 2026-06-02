import React from 'react';
import ToggleableChordRadar from './ToggleableChordRadar';
import ScatterBrushChart from './ScatterBrushChart';
import SongTable from './SongTable';
import ReactECharts from 'echarts-for-react';

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

  const [hoveredCategory, setHoveredCategory] = React.useState(null);
  const [isDetailExpanded, setIsDetailExpanded] = React.useState(true); // 控制歌曲多维悬浮窗的折叠与展开状态

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

  // 流派专属详情悬浮窗状态与拖动平移状态
  const [clickedGenre, setClickedGenre] = React.useState(null);
  const [posGenre, setPosGenre] = React.useState({ x: 0, y: 0 });
  const [isDraggingGenre, setIsDraggingGenre] = React.useState(false);
  const draggingRefGenre = React.useRef(false);
  const dragStartPosGenre = React.useRef({ x: 0, y: 0 });
  const dragStartOffsetGenre = React.useRef({ x: 0, y: 0 });

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

  // 当切换选中不同流派时，重置流派位置
  React.useEffect(() => {
    setPosGenre({ x: 0, y: 0 });
  }, [clickedGenre]);

  // 组件卸载时安全清理全局事件监听
  React.useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMoveGenre);
      window.removeEventListener('mouseup', handleMouseUpGenre);
    };
  }, [handleMouseMove, handleMouseUp, handleMouseMoveGenre, handleMouseUpGenre]);

  // 计算旭日图悬停节点关联的所有流派名字（包含主流派旗下的所有子流派）
  const hoveredGenres = React.useMemo(() => {
    if (!hoveredCategory || !data || !data.sunburst) return [];
    
    const cleanHover = hoveredCategory.trim().toLowerCase();
    
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
  }, [hoveredCategory, data]);

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
            <span>🌀 流派多维分布结构</span>
          </h3>
          <span style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 'bold' }}>点击/悬停 联动雷达与星云</span>
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
            <span style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 'bold' }}>实时相似流派对比</span>
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
              🌌 歌曲KMeans星云聚类与框选过滤 (Energy vs Valence)
            </h3>
            <span style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 'bold' }}>支持框选/高亮联动</span>
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
          <h3 style={{ margin: 0, fontSize: '11.5px', color: '#1E293B', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
            📋 歌曲列表 ({brushedData.length > 0 ? brushedData.length : data.scatter.length} 首)
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
            songs={brushedData.length > 0 ? brushedData : data.scatter} 
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
                  <span>本歌真实</span>
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
                          name: '本歌真实',
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
                          style={{
                            fontSize: fontSize,
                            color: wordColor,
                            fontWeight: fontWeight,
                            padding: idx < 3 ? '4px 9px' : (idx < 8 ? '3px 7px' : '2px 5px'),
                            background: 'rgba(255, 255, 255, 0.88)',
                            border: '1px solid rgba(255, 255, 255, 0.5)',
                            borderRadius: '8px',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                            cursor: 'default',
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
                    ⏳ 正在追溯历史音轨纪元...
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
};

export default CockpitView;
