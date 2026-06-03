import React, { useRef, useCallback, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

const ScatterBrushChart = ({ data, onBrush, selectedSong, hoveredGenres, clickedGenre = null, isSongInGenre }) => {
  const chartRef = useRef(null);
  // 用 ref 保存最新的 props，避免事件回调中闭包过期
  const onBrushRef = useRef(onBrush);
  onBrushRef.current = onBrush;
  const dataRef = useRef(data);
  dataRef.current = data;

  // 追踪是否曾经有过有效框选
  const hadSelectionRef = useRef(false);

  // The cluster colors for a modern premium look
  const clusterColors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F'];

  const legendItems = [
    { label: '狂热释放', color: '#A8D8B9' },    // Cluster 0: 高能量+中愉悦
    { label: '轻松愉快', color: '#B4A6CD' },    // Cluster 1: 中能量+高愉悦
    { label: '伤感静谧', color: '#A2CBE6' },    // Cluster 2: 低能量+低愉悦
    { label: '阳光活力', color: '#F1A5B4' },    // Cluster 3: 高能量+高愉悦
    { label: '迷幻张力', color: '#DDE29F' }     // Cluster 4: 中能量+低愉悦
  ];

  const options = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: {
      left: '4%',
      right: '6%',
      top: '20%',
      bottom: 55,
      containLabel: true
    },
    tooltip: {
      show: true,
      formatter: function (param) {
        return `
          <div style="font-weight: 600; font-size: 11px; line-height: 1.4;">${param.data[2]}</div>
          <div style="color:#666666; font-size: 9.5px; margin-top: 1px;">${param.data[3]}</div>
          <div style="margin-top: 4px; font-size: 9.5px; color:#333; line-height: 1.5;">
            能量: ${param.data[0]}<br/>
            愉悦度: ${param.data[1]}<br/>
            流派: ${param.data[4]}
          </div>
        `;
      },
      appendToBody: true,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#EEEEEE',
      textStyle: { color: '#333333', fontSize: 10, fontFamily: '"Outfit", "Inter", sans-serif' },
      padding: [6, 10],
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 6px;'
    },
    brush: {
      toolbox: ['rect', 'polygon', 'keep', 'clear'],
      xAxisIndex: 0,
      inBrush: { opacity: 1 },
      outOfBrush: { opacity: 0.1 }
    },
    toolbox: {
      right: 10,
      top: 2,
      showTitle: false,
      iconStyle: { borderColor: '#7E8B9B', borderWidth: 1.2 },
      emphasis: { iconStyle: { borderColor: '#A8D8B9' } },
      tooltip: {
        show: true,
        formatter: function (param) {
          return param.title;
        },
        position: 'left',
        backgroundColor: 'rgba(16, 185, 129, 0.9)',
        borderWidth: 0,
        textStyle: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
        padding: [4, 8],
        extraCssText: 'box-shadow: 0 2px 8px rgba(16,185,129,0.15); border-radius: 4px;'
      },
      feature: {
        brush: { 
          type: ['rect', 'polygon', 'keep', 'clear'],
          title: {
            rect: '矩形框选',
            polygon: '圈选 (多边形)',
            keep: '多重框选',
            clear: '清除选择'
          }
        }
      }
    },
    xAxis: {
      type: 'value',
      name: '能量 (Energy)',
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: { color: '#666666', fontWeight: 'bold', fontSize: 10 },
      scale: true,
      splitLine: { show: true, lineStyle: { color: '#EEEEEE' } },
      axisLabel: { color: '#666666', fontSize: 9 },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      name: '愉悦度',
      nameLocation: 'center',
      nameGap: 24,
      nameTextStyle: { color: '#666666', fontWeight: 'bold', fontSize: 10 },
      scale: true,
      splitLine: { show: true, lineStyle: { color: '#EEEEEE' } },
      axisLabel: { color: '#666666', fontSize: 9 },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    dataZoom: [
      { type: 'inside' },
      { 
        type: 'slider', 
        height: 15,
        bottom: 8,
        showDataShadow: false, 
        showDetail: false,
        borderWidth: 1,
        borderColor: 'rgba(168, 216, 185, 0.25)',
        backgroundColor: 'rgba(168, 216, 185, 0.08)',
        fillerColor: 'rgba(168, 216, 185, 0.45)',
        handleIcon: 'circle',
        handleSize: '120%',
        handleStyle: { 
          color: '#A8D8B9', 
          borderColor: '#FFFFFF', 
          borderWidth: 2, 
          shadowBlur: 4, 
          shadowColor: 'rgba(0,0,0,0.15)' 
        },
        moveHandleStyle: { color: 'transparent' },
        backgroundLineStyle: {
          lineStyle: { color: 'transparent', width: 0, opacity: 0 },
          areaStyle: { color: 'transparent', opacity: 0 }
        },
        selectedDataBackground: {
          lineStyle: { color: 'transparent', opacity: 0 },
          areaStyle: { color: 'transparent', opacity: 0 }
        },
        textStyle: { color: 'transparent', fontSize: 0 }
      }
    ],
    series: [
      {
        type: 'scatter',
        symbolSize: 3,
        data: data,
        itemStyle: {
          color: function (param) {
            const hex = clusterColors[param.data[5] % clusterColors.length];
            const songGenre = param.data[4] ? param.data[4].trim().toLowerCase() : '';
            
            let alpha = 0.8;
            
            // 1. 如果有 clickedGenre 流派锁定，非选中流派粒子立刻进行高对比淡化
            let isFilteredOut = false;
            if (clickedGenre && isSongInGenre) {
              if (!isSongInGenre(param.data, clickedGenre)) {
                isFilteredOut = true;
              }
            }

            if (isFilteredOut) {
              alpha = 0.05; // 虚化底图背景
            } else {
              // 2. 属于当前 clickedGenre 的点（或无流派锁定时），响应悬停与选中状态的高亮
              const isSameGenre = hoveredGenres && hoveredGenres.length > 0 && hoveredGenres.includes(songGenre);
              const isSameCluster = selectedSong && param.data[5] === selectedSong[5];
              
              if (hoveredGenres && hoveredGenres.length > 0) {
                if (isSameGenre) {
                  alpha = 0.95;
                } else if (isSameCluster) {
                  alpha = 0.40;
                } else {
                  alpha = 0.05;
                }
              } else if (selectedSong) {
                if (isSameCluster) {
                  alpha = 0.85;
                } else {
                  alpha = 0.05;
                }
              }
            }
            
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
          }
        },
        large: false,
        largeThreshold: 10000
      },
      // 选中的特定歌曲高亮特效点
      {
        type: 'effectScatter',
        symbolSize: 6.5,
        data: selectedSong ? [selectedSong] : [],
        itemStyle: {
          color: '#FF5E7E',
          borderColor: '#FFFFFF',
          borderWidth: 1.2,
          shadowColor: 'rgba(255, 94, 126, 0.35)',
          shadowBlur: 6
        },
        rippleEffect: { 
          brushType: 'stroke', 
          scale: 2.2,
          period: 4,
          number: 2
        },
        zlevel: 1
      }
    ]
  }), [data, hoveredGenres, selectedSong, clickedGenre, isSongInGenre]);

  // 使用 onEvents 绑定事件 —— echarts-for-react 的推荐方式，
  // 自动管理事件的绑定与解绑，避免手动操作实例的竞态问题。
  const onEvents = useMemo(() => ({
    'brushSelected': (params) => {
      const brushComponent = params.batch[0];
      if (!brushComponent || brushComponent.areas.length === 0) {
        if (hadSelectionRef.current) {
          hadSelectionRef.current = false;
          onBrushRef.current([]);
        }
        return;
      }
      
      hadSelectionRef.current = true;
      let selectedIndices = [];
      for (let i = 0; i < brushComponent.selected.length; i++) {
        let dataIndices = brushComponent.selected[i].dataIndex;
        selectedIndices = selectedIndices.concat(dataIndices);
      }
      onBrushRef.current(selectedIndices);
    }
  }), []); // 空依赖 —— 通过 ref 读取最新回调

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 聚类颜色图例 Legend */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: '16px', 
        flexWrap: 'wrap',
        padding: '0 10px 10px 10px',
        borderBottom: '1px solid #EEEEEE'
      }}>
        {legendItems.map((item, idx) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ 
              display: 'inline-block', 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              backgroundColor: item.color,
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
            }}></span>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666666' }}>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="chart-container" style={{ flexGrow: 1, position: 'relative' }}>
        <ReactECharts 
          ref={chartRef}
          option={options} 
          notMerge={false}
          lazyUpdate={true}
          onEvents={onEvents}
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }} 
        />
      </div>
    </div>
  );
};

export default ScatterBrushChart;
