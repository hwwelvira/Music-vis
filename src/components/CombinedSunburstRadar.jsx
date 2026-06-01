import React from 'react';
import ReactECharts from 'echarts-for-react';

const CombinedSunburstRadar = ({ sunburstData, radarFeatures, indicatorNames, featureMaxes, onNodeHover, onNodeClick }) => {
  const i18n = {
    danceability: '可舞度',
    energy: '能量',
    acousticness: '声学度',
    valence: '愉悦度',
    liveness: '现场感',
    instrumentalness: '器乐度',
    speechiness: '言语度'
  };

  const dataValues = radarFeatures ? indicatorNames.map(key => radarFeatures[key]) : [];

  const options = {
    color: ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F', '#F3D291', '#E7AB87'],
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#A8D8B9',
      textStyle: {
        color: '#333333',
        fontFamily: '"Outfit", "Inter", sans-serif'
      }
    },
    radar: {
      center: ['50%', '50%'],
      radius: '18%', // Smaller inner radar to leave room for labels
      indicator: indicatorNames.map(name => ({
        name: i18n[name] || name,
        max: featureMaxes && featureMaxes[name] ? Math.max(featureMaxes[name] * 1.25, 0.9) : 1
      })),
      splitNumber: 4,
      axisName: {
        color: '#666666',
        fontWeight: 'bold',
        fontSize: 10,
        borderRadius: 3,
        padding: [2, 4],
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        nameGap: 8 // Bring the label closer to the radar vertices
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(250, 250, 250, 0.3)', 'rgba(240, 240, 240, 0.5)', 'rgba(230, 230, 230, 0.8)', 'rgba(168, 216, 185, 0.2)']
        }
      },
      axisLine: { lineStyle: { color: '#EEEEEE' } },
      splitLine: { lineStyle: { color: '#EEEEEE' } }
    },
    series: [
      {
        type: 'sunburst',
        data: sunburstData,
        sort: null,
        radius: ['38%', '95%'], // Outer sunburst ring pushed further out
        itemStyle: {
          borderRadius: 4,
          borderWidth: 2,
          borderColor: '#FFFFFF'
        },
        label: {
          show: true,
          color: '#333333',
          textBorderColor: 'rgba(255,255,255,0.7)',
          textBorderWidth: 2,
          fontFamily: '"Outfit", "Inter", sans-serif',
          lineHeight: 16
        },
        levels: [
          {},
          {
            r0: '38%',
            r: '60%',
            itemStyle: { borderWidth: 2 },
            label: {
              rotate: 'tangential',
              fontSize: 12,
              fontWeight: 'bold'
            }
          },
          {
            r0: '60%',
            r: '92%',
            label: {
              position: 'inside',
              fontSize: 10,
              minAngle: 3
            },
            itemStyle: { borderWidth: 1 }
          }
        ]
      },
      {
        name: '流派特征 (Genre Features)',
        type: 'radar',
        data: [
          {
            value: dataValues,
            name: '平均特征值 (Average Features)',
            areaStyle: { color: 'rgba(168, 216, 185, 0.5)' },
            lineStyle: { width: 3, color: '#A8D8B9' },
            itemStyle: { color: '#88B04B' }
          }
        ],
        z: 3 // Ensure radar is rendered on top
      }
    ]
  };

  const onEvents = {
    click: (params) => {
      if (params.seriesType === 'sunburst' && params.data && params.data.features) {
        onNodeClick(params.data);
      }
    },
    mouseover: (params) => {
      if (params.seriesType === 'sunburst' && params.data && params.data.features) {
        onNodeHover(params.data);
      }
    }
  };

  return (
    <div className="chart-container" style={{ height: '800px', width: '100%' }}>
      <ReactECharts option={options} style={{ height: '100%', width: '100%' }} onEvents={onEvents} />
    </div>
  );
};

export default CombinedSunburstRadar;
