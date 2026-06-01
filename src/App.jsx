import React, { useEffect, useState } from 'react';
import './App.css';
import ScatterBrushChart from './components/ScatterBrushChart';
import SongTable from './components/SongTable';
import ToggleableChordRadar from './components/ToggleableChordRadar';
import TimelineEvolutionCombined from './components/TimelineEvolutionCombined';
import AcousticClusterAssociation from './components/AcousticClusterAssociation';
import InteractiveKMeansExplorer from './components/InteractiveKMeansExplorer';
import GenreClusterRelation from './components/GenreClusterRelation';
import CockpitView from './components/CockpitView';

function App() {
  const [data, setData] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [brushedData, setBrushedData] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [viewMode, setViewMode] = useState('main'); // 'main' or 'cockpit'

  useEffect(() => {
    fetch('/data.json?t=' + Date.now())
      .then(res => res.json())
      .then(jsonData => {
        if (jsonData.sunburst) {
          const colors = ['#A8D8B9', '#B4A6CD', '#A2CBE6', '#F1A5B4', '#DDE29F', '#F3D291', '#E7AB87'];
          
          const tintColor = (hex, factor) => {
            hex = hex.replace('#', '');
            let r = parseInt(hex.substring(0, 2), 16);
            let g = parseInt(hex.substring(2, 4), 16);
            let b = parseInt(hex.substring(4, 6), 16);
          
            r = Math.round(r + (255 - r) * factor);
            g = Math.round(g + (255 - g) * factor);
            b = Math.round(b + (255 - b) * factor);
          
            return `#${(r).toString(16).padStart(2, '0')}${(g).toString(16).padStart(2, '0')}${(b).toString(16).padStart(2, '0')}`;
          };

          jsonData.sunburst.forEach((parent, i) => {
            const baseColor = colors[i % colors.length];
            if (parent.children && parent.children.length > 0) {
              const pops = parent.children.map(c => c.popularity || 0);
              const minPop = Math.min(...pops);
              const maxPop = Math.max(...pops);
              
              parent.children.forEach(child => {
                const normPop = maxPop > minPop ? (child.popularity - minPop) / (maxPop - minPop) : 1;
                // Lighten by up to 55% for low popularity
                const factor = (1 - normPop) * 0.55; 
                child.itemStyle = { color: tintColor(baseColor, factor) };
              });
            }
          });

          // Calculate maximums for each feature to auto-scale the radar charts
          let maxes = {};
          jsonData.sunburst.forEach(parent => {
            if (parent.children) {
              parent.children.forEach(child => {
                if (child.features) {
                  Object.keys(child.features).forEach(k => {
                    maxes[k] = Math.max(maxes[k] || 0, child.features[k]);
                  });
                }
              });
            }
          });
          // For danceability and energy which are usually well-distributed, force them closer to 1
          maxes['danceability'] = Math.max(maxes['danceability'] || 0, 0.9);
          maxes['energy'] = Math.max(maxes['energy'] || 0, 0.9);
          jsonData.featureMaxes = maxes;
        }
        setData(jsonData);
      })
      .catch(err => console.error("Failed to load data:", err));
  }, []);

  if (!data) {
    return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#A8D8B9'}}>正在加载音乐数据集...</div>;
  }

  // Find radar features to display
  let radarData = null;
  let radarName = '';

  if (selectedGenre && selectedGenre.features) {
    radarData = selectedGenre.features;
    radarName = selectedGenre.name;
  } else if (data.sunburst && data.sunburst.length > 0) {
    // Default to the first category if none selected
    radarData = data.sunburst[0].features;
    radarName = data.sunburst[0].name;
  }

  return (
    <div className="dashboard-container" style={{ paddingBottom: viewMode === 'cockpit' ? '10px' : '40px' }}>
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Music Dimension Visualizer</h1>
          <p style={{ margin: '4px 0 0 0' }}>探索数十万首流行音乐的特征演变与流派聚类</p>
        </div>
        {/* 极简高透双视图药丸切换胶囊 */}
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
            onClick={() => setViewMode('main')}
            style={{
              padding: '8px 18px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: '800',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              background: viewMode === 'main' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'main' ? '#1E293B' : '#64748B',
              boxShadow: viewMode === 'main' ? '0 2px 8px 0 rgba(145, 158, 171, 0.12)' : 'none'
            }}
          >
            🌍 时空演变多维大盘
          </button>
          <button
            onClick={() => setViewMode('cockpit')}
            style={{
              padding: '8px 18px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: '800',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              background: viewMode === 'cockpit' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'cockpit' ? '#1E293B' : '#64748B',
              boxShadow: viewMode === 'cockpit' ? '0 2px 8px 0 rgba(145, 158, 171, 0.12)' : 'none'
            }}
          >
            🖥️ 极客一屏集成驾驶舱 (实验)
          </button>
        </div>
      </div>


      {viewMode === 'cockpit' ? (
        /* 🌌 视图二：一屏不溢出极客控制驾驶舱 */
        <CockpitView 
          data={data}
          selectedGenre={selectedGenre}
          setSelectedGenre={setSelectedGenre}
          brushedData={brushedData}
          setBrushedData={setBrushedData}
          selectedSong={selectedSong}
          setSelectedSong={setSelectedSong}
          genreDetails={data.genre_details}
        />
      ) : (
        /* 🌍 视图一：全局时空演变多维大盘 (原先的滚动长看板流，完全保留不影响) */
        <>
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 className="card-title">流派结构与特征分析 - {radarName}</h2>
            <ToggleableChordRadar 
              sunburstData={data.sunburst}
              graphData={data.graph}
              radarFeatures={radarData}
              radarName={radarName}
              indicatorNames={data.radar_features}
              featureMaxes={data.featureMaxes}
              scatterData={data.scatter}
              onNodeClick={(node) => setSelectedGenre(node)} 
              onNodeHover={(node) => setSelectedGenre(node)}
            />
          </div>

          <div className="grid-middle">
            <div className="card">
              <h2 className="card-title">歌曲聚类与框选过滤 (Energy vs Valence)</h2>
              <ScatterBrushChart 
                data={data.scatter} 
                selectedSong={selectedSong}
                onBrush={(selectedIndices) => {
                  const selected = selectedIndices.map(i => data.scatter[i]);
                  setBrushedData(selected);
                  setSelectedSong(null); // Clear selected song on brush
                }} 
              />
            </div>
            <div className="card" style={{overflow: 'hidden'}}>
              <h2 className="card-title">筛选歌曲列表 ({brushedData.length > 0 ? brushedData.length : data.scatter.length})</h2>
              <SongTable 
                songs={brushedData.length > 0 ? brushedData : data.scatter} 
                selectedSong={selectedSong}
                onSongClick={(song) => setSelectedSong(song)}
              />
            </div>
          </div>
          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <AcousticClusterAssociation 
              scatterData={data.scatter} 
              sunburstData={data.sunburst} 
              brushedSongs={brushedData}
            />
          </div>

          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <GenreClusterRelation 
              scatterData={data.scatter}
            />
          </div>

          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <InteractiveKMeansExplorer 
              scatterData={data.scatter} 
              sunburstData={data.sunburst}
            />
          </div>

          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <TimelineEvolutionCombined 
              timelineData={data.timeline} 
              wordsData={data.timeline_words} 
              scatterData={data.scatter} 
            />
          </div>
        </>
      )}

    </div>
  );
}

export default App;
