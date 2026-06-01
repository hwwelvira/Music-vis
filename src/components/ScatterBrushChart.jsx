import React, { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

const ScatterBrushChart = ({ data, onBrush, selectedSong, hoveredGenres }) => {
  const chartRef = useRef(null);

  // The cluster colors for a modern premium look
  const clusterColors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F'];

  const legendItems = [
    { label: '狂热释放', color: '#A8D8B9' },    // Cluster 0: 高能量+中愉悦
    { label: '轻松愉快', color: '#B4A6CD' },    // Cluster 1: 中能量+高愉悦
    { label: '伤感静谧', color: '#A2CBE6' },    // Cluster 2: 低能量+低愉悦
    { label: '阳光活力', color: '#F1A5B4' },    // Cluster 3: 高能量+高愉悦
    { label: '迷幻张力', color: '#DDE29F' }     // Cluster 4: 中能量+低愉悦
  ];

  const options = {
    backgroundColor: 'transparent',
    grid: {
      left: '4%',
      right: '6%',
      top: '20%',
      bottom: 55, // 调大底部高度，给X轴名称及标签腾出充足的呼吸空间，彻底解决遮挡问题
      containLabel: true
    },
    tooltip: {
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
      toolbox: ['rect', 'polygon', 'keep', 'clear'], // 完美还原 4 个框选小工具
      xAxisIndex: 0,
      inBrush: { opacity: 1 },
      outOfBrush: { opacity: 0.1 }
    },
    toolbox: {
      right: 10, // 完美装在原有的最右上角位置
      top: 2,
      showTitle: false, // 彻底关闭原来在图标下方出现的那个容易被遮挡的默认 title 字符！
      iconStyle: { borderColor: '#7E8B9B', borderWidth: 1.2 },
      emphasis: { iconStyle: { borderColor: '#A8D8B9' } },
      tooltip: { // 启用统一的原生 Tooltip 气泡！悬停时使用我们翻译的中文
        show: true,
        formatter: function (param) {
          return param.title;
        },
        position: 'left', // 核心：将原来在下面弹出的提示字符，完美移动到图标的“左边”固定位置弹出！
        backgroundColor: 'rgba(16, 185, 129, 0.9)', // 优雅且鲜明的森林绿底色（呼应用户的绿色字符需求）
        borderWidth: 0,
        textStyle: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
        padding: [4, 8],
        extraCssText: 'box-shadow: 0 2px 8px rgba(16,185,129,0.15); border-radius: 4px;'
      },
      feature: {
        brush: { 
          type: ['rect', 'polygon', 'keep', 'clear'], // 4 个完整功能选项
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
      axisLine: { show: false }, // 彻底关掉横坐标轴的灰色底基线，消灭绿条上方的灰线
      axisTick: { show: false }  // 彻底关掉刻度短线
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
      axisLine: { show: false }, // 同步关掉纵坐标的基线，整体和谐透亮
      axisTick: { show: false }  // 同步关掉刻度线
    },
    dataZoom: [
      { type: 'inside' },
      { 
        type: 'slider', 
        height: 15, // 黄金高度，适中且明显，方便拖动
        bottom: 8, // 靠最底边缘下浮，与抬高后的 X 轴有 30px 以上的安全空间
        showDataShadow: false, 
        showDetail: false, // 彻底关闭滑块两端的灰色数值提示标签
        borderWidth: 1, // 极细边框
        borderColor: 'rgba(168, 216, 185, 0.25)', // 用淡绿微边框取代灰色边框
        backgroundColor: 'rgba(168, 216, 185, 0.08)', // 极淡绿轨道背景，清晰显眼但温润无灰线
        fillerColor: 'rgba(168, 216, 185, 0.45)', // 马卡龙绿选中滑块，对比鲜明
        handleIcon: 'circle', // 白色包边绿色小圆钮拉手
        handleSize: '120%',
        handleStyle: { 
          color: '#A8D8B9', 
          borderColor: '#FFFFFF', 
          borderWidth: 2, 
          shadowBlur: 4, 
          shadowColor: 'rgba(0,0,0,0.15)' 
        },
        moveHandleStyle: { color: 'transparent' }, // 彻底消除中间拉手的灰色竖线
        backgroundLineStyle: {
          lineStyle: { color: 'transparent', width: 0, opacity: 0 },
          areaStyle: { color: 'transparent', opacity: 0 }
        },
        selectedDataBackground: {
          lineStyle: { color: 'transparent', opacity: 0 },
          areaStyle: { color: 'transparent', opacity: 0 }
        },
        textStyle: { color: 'transparent', fontSize: 0 } // 不显示任何多余文本
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
            
            // 提取同一属性（流派）以及同聚类（同颜色）的标识
            const isSameGenre = hoveredGenres && hoveredGenres.length > 0 && hoveredGenres.includes(songGenre);
            const isSameCluster = selectedSong && param.data[5] === selectedSong[5];
            
            let alpha = 0.8;
            if (hoveredGenres && hoveredGenres.length > 0) {
              if (isSameGenre) {
                // 1. 同一属性（流派，如垃圾摇滚）：最为突出明显！
                alpha = 0.95;
              } else if (isSameCluster) {
                // 2. 同聚类（同颜色，如狂热释放）：次级高亮，稍微没那么明显！
                alpha = 0.40;
              } else {
                // 3. 非同流派且非同聚类：彻底暗化成微弱背景
                alpha = 0.05;
              }
            } else if (selectedSong) {
              if (isSameCluster) {
                // 若无流派高亮，只有单曲选中：同聚类显示为主要高亮
                alpha = 0.85;
              } else {
                alpha = 0.05;
              }
            }
            
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
          }
        },
        large: false,
        largeThreshold: 10000 // 强制阻止 ECharts 进入大批量同色渲染模式
      },
      // 选中的特定歌曲高亮特效点
      {
        type: 'effectScatter',
        symbolSize: 6.5, // 优雅地由 10 缩减为 6.5，小巧精致，在两万点大盘中既清晰又绝不臃肿突兀
        data: selectedSong ? [selectedSong] : [],
        itemStyle: {
          color: '#FF5E7E', // 蔷薇粉特效高亮色
          borderColor: '#FFFFFF',
          borderWidth: 1.2, // 微调为 1.2 像素的超细精致白包边
          shadowColor: 'rgba(255, 94, 126, 0.35)', // 更为柔和深邃的阴影微发光
          shadowBlur: 6
        },
        rippleEffect: { 
          brushType: 'stroke', 
          scale: 2.2, // 波纹扩散半径限制在 2.2，提供局部而克制的高级呼吸感
          period: 4,  // 调慢扩散周期，带来丝滑、极其宁静的深海呼吸波纹
          number: 2   // 采用精细的双层微波纹涟漪，质感成倍增加
        },
        zlevel: 1
      }
    ]
  };

  useEffect(() => {
    if (chartRef.current) {
      const echartInstance = chartRef.current.getEchartsInstance();
      echartInstance.on('brushSelected', function (params) {
        const brushComponent = params.batch[0];
        if (!brushComponent || brushComponent.areas.length === 0) {
          onBrush([]);
          return;
        }
        
        let selectedIndices = [];
        for (let i = 0; i < brushComponent.selected.length; i++) {
          let dataIndices = brushComponent.selected[i].dataIndex;
          selectedIndices = selectedIndices.concat(dataIndices);
        }
        onBrush(selectedIndices);
      });
    }
  }, [onBrush]);

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
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }} 
        />
      </div>
    </div>
  );
};

export default ScatterBrushChart;
